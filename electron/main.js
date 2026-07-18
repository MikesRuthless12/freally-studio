const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { TransportClock } = require('./transportClock');
const { VST3Scanner } = require('./vst3Scanner');
const { loadNativeAddon, getAddon, registerIPC: registerVST3HostIPC, setAllowedPluginPaths } = require('./vst3HostBridge');
const { loadNativeAddon: loadAudioCaptureAddon, registerIPC: registerAudioCaptureIPC } = require('./audioCaptureBridge');

// --- Security helpers ---

// Set of paths the user explicitly chose via dialog, plus default safe roots.
// Used by assertSafePath() to reject IPC fs:* requests for arbitrary paths.
const userChosenPaths = new Set();

function getSafeRoots() {
    const roots = [];
    try { roots.push(app.getPath('userData')); } catch (_) {}
    try { roots.push(app.getPath('documents')); } catch (_) {}
    try { roots.push(app.getPath('music')); } catch (_) {}
    try { roots.push(app.getPath('downloads')); } catch (_) {}
    try { roots.push(app.getPath('desktop')); } catch (_) {}
    try { roots.push(app.getPath('temp')); } catch (_) {}
    try { roots.push(app.getAppPath()); } catch (_) {}
    return roots.filter(Boolean).map(p => path.resolve(p));
}

/**
 * Validate that a filesystem path is inside an allowed root.
 * Throws an Error if the path is unsafe. Returns the resolved path on success.
 */
function assertSafePath(p) {
    if (typeof p !== 'string' || !p) {
        throw new Error('Invalid path: must be a non-empty string');
    }
    if (p.includes('\0')) {
        throw new Error('Invalid path: contains null byte');
    }
    const resolved = path.resolve(p);
    // Reject traversal attempts in the original (pre-resolve) string
    if (p.split(/[\\/]/).includes('..')) {
        throw new Error('Invalid path: traversal not allowed');
    }
    const roots = getSafeRoots();
    for (const root of roots) {
        if (resolved === root || resolved.startsWith(root + path.sep)) {
            return resolved;
        }
    }
    for (const chosen of userChosenPaths) {
        if (resolved === chosen || resolved.startsWith(chosen + path.sep)) {
            return resolved;
        }
    }
    throw new Error('Path not allowed: ' + resolved);
}

/**
 * Verify an IPC event came from the main window's main frame.
 * Mitigates the case where a compromised <iframe> or sub-frame could
 * invoke privileged IPC handlers.
 */
function requireMainFrame(event) {
    try {
        return !!(mainWindow && !mainWindow.isDestroyed() &&
            event && event.senderFrame === mainWindow.webContents.mainFrame);
    } catch (_) {
        return false;
    }
}

// Content-Security-Policy applied to all packaged-app responses (A3).
const CSP_VALUE = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' wss://*.peerjs.com https://*.peerjs.com https://0.peerjs.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://api.github.com https://mikesruthless12.github.io data: blob:; img-src 'self' data: blob: https:; media-src 'self' blob: data:; worker-src 'self' blob:; child-src 'self' blob:;";

// Suppress EPIPE errors on stdout/stderr (harmless — occurs when pipe closes during shutdown)
process.stdout?.on('error', (err) => { if (err.code === 'EPIPE') return; throw err; });
process.stderr?.on('error', (err) => { if (err.code === 'EPIPE') return; throw err; });

// Crash diagnostics — log unhandled errors instead of silently dying
process.on('uncaughtException', (err) => {
    console.error('[MAIN CRASH] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[MAIN CRASH] unhandledRejection:', reason);
});

// --- Window bounds & folder persistence ---
function getSettingsPath() {
    return path.join(app.getPath('userData'), 'freally-settings.json');
}
function loadSettings() {
    try {
        const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
        return JSON.parse(raw);
    } catch (_) { return {}; }
}
function saveSettings(data) {
    try {
        const existing = loadSettings();
        const merged = { ...existing, ...data };
        fs.writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');
    } catch (_) {}
}

// Register freally:// protocol for deep-link collab invites
if (process.defaultApp) {
    // Dev mode: register with path to electron executable + script
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('freally', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('freally');
}

// Extract room param from a freally:// URL.
// Validates the room id against /^[A-Za-z0-9_-]{1,64}$/ to prevent
// injection of arbitrary strings via the deep-link channel.
const ROOM_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
function extractRoomFromUrl(url) {
    if (!url || !url.startsWith('freally://')) return null;
    try {
        // freally://join?room=abc123 → abc123
        const parsed = new URL(url.replace('freally://', 'https://freally/'));
        const room = parsed.searchParams.get('room');
        if (!room || !ROOM_ID_REGEX.test(room)) return null;
        return room;
    } catch { return null; }
}

// Pending deep-link room (set before window is ready)
let pendingDeepLinkRoom = null;

// Check if launched with a freally:// URL (Windows/Linux pass it as argv)
const deepLinkArg = process.argv.find(a => a.startsWith('freally://'));
if (deepLinkArg) {
    pendingDeepLinkRoom = extractRoomFromUrl(deepLinkArg);
}

// Single instance lock — prevent multiple copies of the app from running.
// If a second instance launches, focus the existing window and forward the deep link.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, argv) => {
        // Forward deep-link room param from second instance
        const url = argv.find(a => a.startsWith('freally://'));
        const room = url ? extractRoomFromUrl(url) : null;
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            if (room) {
                mainWindow.webContents.send('deeplink:room', room);
            }
        }
    });
}

// Enable SharedArrayBuffer without requiring strict COOP (same-origin).
// This lets us use same-origin-allow-popups for COOP so Google auth popups work.
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// ---- Audio engine flags (platform-aware) ----

// Windows-only: bypass Chromium's internal audio resampler to reduce latency.
// NOTE: 'force-wave-audio' was removed — it causes periodic 3-6 second stuttering
// on Realtek drivers. WASAPI (the default) handles audio better despite earlier
// static issues, which are now mitigated by context management and keepalive.
if (process.platform === 'win32') {
    app.commandLine.appendSwitch('disable-audio-output-resampler');
}

// All platforms: keep the audio service in-process for lower latency,
// and disable WebRTC audio processing (AGC/noise suppression) for DAW-quality audio.
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess,WebRtcApmInAudioService');

// All platforms: disable Chromium's built-in audio processing pipeline for mic
// input — prevents automatic gain control, noise suppression, and echo
// cancellation from being applied at the engine level.
app.commandLine.appendSwitch('disable-audio-input-processing');

// Allow self-signed certs from Vite's dev HTTPS server in dev mode.
// SECURITY: This is DEV-ONLY and gated by !app.isPackaged. The flag is never
// applied in production builds, so packaged installations always perform
// full certificate validation for any HTTPS resource they load.
if (!app.isPackaged) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
}

let mainWindow = null;
const isDev = !app.isPackaged;
const transport = new TransportClock();
let vst3Scanner = null; // Initialized after app.getPath('userData') is available
let vst3HostLoaded = false;
let audioCaptureLoaded = false;

function createWindow() {
    const settings = loadSettings();
    const bounds = settings.windowBounds || {};

    const isMac = process.platform === 'darwin';

    mainWindow = new BrowserWindow({
        width: bounds.width || 1400,
        height: bounds.height || 900,
        x: bounds.x,
        y: bounds.y,
        minWidth: 1024,
        minHeight: 700,
        frame: isMac,                                  // macOS: native frame with traffic lights
        titleBarStyle: isMac ? 'hiddenInset' : undefined, // macOS: hide title but keep traffic lights
        transparent: !isMac,                            // transparent only on Windows/Linux (splash)
        trafficLightPosition: isMac ? { x: 12, y: 12 } : undefined,
        icon: path.join(__dirname, '..', 'src', 'images', 'freally_app_icon.png'),
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            // sandbox:true plus contextIsolation:true gives the renderer a
            // Chromium-sandboxed process with no Node primitives — only what
            // the preload exposes via contextBridge. Our preload only uses
            // require('electron'), which is permitted under sandbox.
            sandbox: true,
            webSecurity: true,
        },
    });

    // When splash video finishes, disable transparency so the app renders normally.
    // Transparent windows have performance overhead, so we only use it during splash.
    // macOS doesn't use transparent mode, so skip this.
    if (!isMac) {
        ipcMain.once('splash:done', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setBackgroundColor('#0a0a0f');
            }
        });
    }

    // Restore maximized state if it was saved
    if (settings.wasMaximized) {
        mainWindow.maximize();
    }

    // Save window bounds on resize/move (debounced)
    let boundsTimer = null;
    const saveBounds = () => {
        if (mainWindow.isMaximized() || mainWindow.isMinimized()) return;
        clearTimeout(boundsTimer);
        boundsTimer = setTimeout(() => {
            saveSettings({ windowBounds: mainWindow.getBounds() });
        }, 500);
    };
    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);
    mainWindow.on('maximize', () => saveSettings({ wasMaximized: true }));
    mainWindow.on('unmaximize', () => saveSettings({ wasMaximized: false }));
    mainWindow.on('close', () => {
        saveSettings({ wasMaximized: mainWindow.isMaximized() });
    });

    // SharedArrayBuffer is enabled via command-line flag (line 10).
    // SECURITY TRADE-OFF: We deliberately do NOT set strict
    // Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy headers here.
    // Strict COOP/COEP would give us cross-origin isolation (full SAB
    // protection against Spectre-style cross-origin reads) but breaks Google
    // Identity Services popups (postMessage between auth popup and main window
    // requires same-origin-allow-popups COOP) and several legitimate
    // third-party iframes used by the auth flow. The Chromium SAB flag above
    // re-enables SharedArrayBuffer without strict isolation; this is
    // acceptable for a packaged Electron app where the renderer only loads
    // local content + a small allowlist enforced by CSP (connect-src).

    // Show window once ready to avoid white flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Load content
    if (isDev) {
        mainWindow.loadURL('https://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    // SECURITY (A4): Open all https:// links in the user's external browser
    // and deny everything else. Prevents the renderer from spawning new
    // Electron windows pointing at arbitrary URLs.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            if (typeof url === 'string' && url.startsWith('https://')) {
                shell.openExternal(url);
            }
        } catch (_) { /* ignore */ }
        return { action: 'deny' };
    });

    // SECURITY (A4): Block top-level navigation to remote origins. The app
    // only ever needs to navigate within localhost (dev) or file:// (prod);
    // any other http(s) navigation is treated as hostile and cancelled.
    mainWindow.webContents.on('will-navigate', (event, navUrl) => {
        try {
            const u = new URL(navUrl);
            const allowed = ['localhost', '127.0.0.1'];
            if (!allowed.includes(u.hostname) && navUrl.startsWith('http')) {
                event.preventDefault();
            }
        } catch (_) { /* ignore unparseable URLs */ }
    });

    // Forward renderer console messages to terminal for debugging
    mainWindow.webContents.on('console-message', (_event, level, message) => {
        // level: 0=verbose, 1=info, 2=warn, 3=error
        if (message.includes('[VST3') || message.includes('[DIAG') || message.includes('[Recording') || level >= 2) {
            const prefix = level >= 3 ? '[Renderer ERR]' : level >= 2 ? '[Renderer WARN]' : '[Renderer]';
            try { console.log(`${prefix} ${message}`); } catch (_) { /* pipe closed */ }
        }
    });

    // Detect renderer crash
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error('[MAIN] Renderer process gone:', details.reason, details.exitCode);
    });

    // Forward maximize/unmaximize events to renderer
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:maximizeChanged', true);
    });
    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window:maximizeChanged', false);
    });

    // Wire transport clock to send position updates to renderer and VST3 host
    transport.setSendCallback((positionData) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('transport:position', positionData);
        }
        // NOTE: VST3 plugin transport position is auto-advanced in processBlock
        // (C++ side) per audio block for sample-accurate timing. We do NOT
        // overwrite positionBeats from here — doing so causes position oscillation
        // because the native clock and audio-thread positions drift apart.
        // Transport state (isPlaying, tempo) is set via explicit IPC calls from
        // the renderer at play/stop/tempo-change events.
    });

    mainWindow.on('closed', () => {
        transport.stop();
        mainWindow = null;
    });

    // Send pending deep-link room once renderer is ready
    mainWindow.webContents.on('did-finish-load', () => {
        if (pendingDeepLinkRoom) {
            mainWindow.webContents.send('deeplink:room', pendingDeepLinkRoom);
            pendingDeepLinkRoom = null;
        }
    });
}

// macOS: handle freally:// URLs via open-url event
app.on('open-url', (event, url) => {
    event.preventDefault();
    const room = extractRoomFromUrl(url);
    if (room) {
        if (mainWindow) {
            mainWindow.webContents.send('deeplink:room', room);
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        } else {
            pendingDeepLinkRoom = room;
        }
    }
});

// ---- IPC Handlers ----

// Forward renderer debug logs to terminal
ipcMain.on('debug:log', (_event, ...args) => {
    console.log('[Renderer]', ...args);
});

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

// File system dialogs — record any user-chosen paths so subsequent fs:*
// calls against them are accepted by assertSafePath().
ipcMain.handle('fs:showOpenDialog', async (event, options) => {
    if (!requireMainFrame(event)) return { canceled: true, filePaths: [] };
    const result = await dialog.showOpenDialog(mainWindow, options);
    if (result && Array.isArray(result.filePaths)) {
        for (const fp of result.filePaths) {
            try { userChosenPaths.add(path.resolve(fp)); } catch (_) {}
        }
    }
    return result;
});

ipcMain.handle('fs:showSaveDialog', async (event, options) => {
    if (!requireMainFrame(event)) return { canceled: true };
    const result = await dialog.showSaveDialog(mainWindow, options);
    if (result && result.filePath) {
        try { userChosenPaths.add(path.resolve(path.dirname(result.filePath))); } catch (_) {}
    }
    return result;
});

// File system operations — every path is validated by assertSafePath().
ipcMain.handle('fs:readFile', async (event, filePath) => {
    if (!requireMainFrame(event)) return { data: null, error: 'forbidden' };
    try {
        const safe = assertSafePath(filePath);
        const data = await fs.promises.readFile(safe);
        return { data: data.buffer, error: null };
    } catch (err) {
        return { data: null, error: err.message };
    }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
    if (!requireMainFrame(event)) return { error: 'forbidden' };
    try {
        const safe = assertSafePath(filePath);
        await fs.promises.writeFile(safe, Buffer.from(data));
        return { error: null };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('fs:readDir', async (event, dirPath) => {
    if (!requireMainFrame(event)) return { entries: [], error: 'forbidden' };
    try {
        const safe = assertSafePath(dirPath);
        const entries = await fs.promises.readdir(safe, { withFileTypes: true });
        return {
            entries: entries.map(e => ({
                name: e.name,
                isDirectory: e.isDirectory(),
                isFile: e.isFile(),
                path: path.join(safe, e.name),
            })),
            error: null,
        };
    } catch (err) {
        return { entries: [], error: err.message };
    }
});

ipcMain.handle('fs:stat', async (event, filePath) => {
    if (!requireMainFrame(event)) return { error: 'forbidden' };
    try {
        const safe = assertSafePath(filePath);
        const stat = await fs.promises.stat(safe);
        return {
            size: stat.size,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            modifiedMs: stat.mtimeMs,
            error: null,
        };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('fs:exists', async (event, filePath) => {
    if (!requireMainFrame(event)) return false;
    try {
        const safe = assertSafePath(filePath);
        await fs.promises.access(safe);
        return true;
    } catch {
        return false;
    }
});

ipcMain.handle('fs:mkdir', async (event, dirPath, options) => {
    if (!requireMainFrame(event)) return { error: 'forbidden' };
    try {
        const safe = assertSafePath(dirPath);
        await fs.promises.mkdir(safe, { recursive: options?.recursive ?? true });
        return { error: null };
    } catch (err) {
        return { error: err.message };
    }
});

// Scanned folders persistence — save/load/validate folder paths
ipcMain.handle('folders:save', async (_event, folderPaths) => {
    try {
        saveSettings({ scannedFolders: folderPaths });
        return { error: null };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('folders:load', async () => {
    try {
        const settings = loadSettings();
        const saved = settings.scannedFolders || [];
        // Filter out folders that no longer exist on disk
        const valid = [];
        for (const folderPath of saved) {
            try {
                await fs.promises.access(folderPath);
                const stat = await fs.promises.stat(folderPath);
                if (stat.isDirectory()) valid.push(folderPath);
            } catch (_) { /* folder no longer exists — skip */ }
        }
        // Update saved list if any were removed
        if (valid.length !== saved.length) {
            saveSettings({ scannedFolders: valid });
        }
        return { folders: valid, error: null };
    } catch (err) {
        return { folders: [], error: err.message };
    }
});

ipcMain.handle('folders:scan', async (event, dirPath) => {
    if (!requireMainFrame(event)) return { files: [], error: 'forbidden' };
    try {
        // Block root drives and validate path is in an allowed root.
        const normalized = (typeof dirPath === 'string' ? dirPath : '').replace(/\\/g, '/').replace(/\/+$/, '');
        if (/^[A-Za-z]:$/.test(normalized) || normalized === '' || normalized === '/') {
            return { files: [], error: 'Cannot scan root drives' };
        }
        const safeRoot = assertSafePath(dirPath);
        const results = [];
        const scanDir = async (dir, prefix) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
                if (entry.isDirectory()) {
                    await scanDir(fullPath, relPath);
                } else if (/\.(wav|mp3|ogg|flac|aiff|aif)$/i.test(entry.name)) {
                    results.push({ name: entry.name, path: fullPath, relPath, type: 'audio' });
                } else if (/\.(mid|midi)$/i.test(entry.name)) {
                    results.push({ name: entry.name, path: fullPath, relPath, type: 'midi' });
                }
            }
        };
        await scanDir(safeRoot, '');
        return { files: results, error: null };
    } catch (err) {
        return { files: [], error: err.message };
    }
});

// Folder watching — notify renderer when files change in watched directories.
// SECURITY (A10): Cap simultaneous watchers at 16 to prevent resource
// exhaustion, reject system roots, and validate path against allowed roots.
const activeWatchers = new Map(); // path → FSWatcher
const MAX_WATCHERS = 16;

function isSystemRoot(p) {
    if (typeof p !== 'string') return true;
    const norm = p.replace(/\\/g, '/').replace(/\/+$/, '');
    if (norm === '' || norm === '/') return true;
    if (/^[A-Za-z]:$/.test(norm)) return true;          // C:
    if (/^[A-Za-z]:[\\/]?$/.test(p)) return true;       // C:\ or C:/
    return false;
}

ipcMain.handle('folders:watch', (event, dirPath) => {
    if (!requireMainFrame(event)) return { error: 'forbidden' };
    if (isSystemRoot(dirPath)) {
        console.warn('[folders:watch] rejected system root:', dirPath);
        return { error: 'Cannot watch system root' };
    }
    let safe;
    try { safe = assertSafePath(dirPath); }
    catch (err) { return { error: err.message }; }
    if (activeWatchers.has(safe)) return { error: null }; // Already watching
    if (activeWatchers.size >= MAX_WATCHERS) {
        console.warn(`[folders:watch] rejected — already watching ${activeWatchers.size}/${MAX_WATCHERS}`);
        return { error: 'Watcher limit reached' };
    }
    try {
        let debounce = null;
        const watcher = fs.watch(safe, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            // Only care about audio/midi files
            if (!/\.(wav|mp3|ogg|flac|aiff|aif|mid|midi)$/i.test(filename)) return;
            // Debounce to avoid flooding on bulk operations
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('folders:changed', { dirPath: safe, eventType, filename });
                }
            }, 500);
        });
        activeWatchers.set(safe, watcher);
        return { error: null };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('folders:unwatch', (event, dirPath) => {
    if (!requireMainFrame(event)) return { error: 'forbidden' };
    let key = dirPath;
    try { key = path.resolve(dirPath); } catch (_) {}
    const watcher = activeWatchers.get(key) || activeWatchers.get(dirPath);
    if (watcher) {
        watcher.close();
        activeWatchers.delete(key);
        activeWatchers.delete(dirPath);
    }
    return { error: null };
});

// Clean up all watchers on quit
app.on('will-quit', () => {
    activeWatchers.forEach(w => w.close());
    activeWatchers.clear();
});

// Shell operations
// SECURITY (A1): Only allow http(s) and mailto: URLs through shell.openExternal.
// Any other scheme (file:, javascript:, vbscript:, custom protocols, etc.) is
// rejected to prevent the renderer from launching arbitrary system handlers.
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);
ipcMain.handle('shell:openExternal', async (event, url) => {
    if (!requireMainFrame(event)) return { error: 'forbidden' };
    if (typeof url !== 'string' || !url) return { error: 'Invalid URL' };
    let parsed;
    try { parsed = new URL(url); }
    catch { return { error: 'Invalid URL' }; }
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        console.warn('[shell:openExternal] rejected scheme:', parsed.protocol);
        return { error: 'Protocol not allowed' };
    }
    try {
        await shell.openExternal(url);
        return { error: null };
    } catch (err) {
        return { error: err.message || String(err) };
    }
});

ipcMain.handle('shell:showItemInFolder', async (event, filePath) => {
    if (!requireMainFrame(event)) return { error: 'forbidden' };
    try {
        const safe = assertSafePath(filePath);
        shell.showItemInFolder(safe);
        return { error: null };
    } catch (err) {
        return { error: err.message };
    }
});

// App info
ipcMain.handle('app:getPath', (_event, name) => {
    return app.getPath(name);
});

ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

// ---- System Metrics IPC ----
let prevCpuTimes = null;

ipcMain.handle('system:getMetrics', () => {
    // CPU usage: compare cumulative cpu times between calls
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpus) {
        for (const type in cpu.times) totalTick += cpu.times[type];
        totalIdle += cpu.times.idle;
    }

    let cpuPercent = 0;
    if (prevCpuTimes) {
        const idleDelta = totalIdle - prevCpuTimes.idle;
        const totalDelta = totalTick - prevCpuTimes.total;
        if (totalDelta > 0) {
            cpuPercent = Math.round((1 - idleDelta / totalDelta) * 100);
        }
    }
    prevCpuTimes = { idle: totalIdle, total: totalTick };

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

    return { cpuPercent, memPercent };
});

// ---- Transport Clock IPC ----
ipcMain.on('transport:play', () => { console.log('[Transport] play()'); transport.play(); });
ipcMain.on('transport:stop', () => { console.log('[Transport] stop()'); transport.stop(); });
ipcMain.on('transport:pause', () => transport.pause());
ipcMain.on('transport:seek', (_event, data) => transport.seek(data.positionBeats));
ipcMain.on('transport:setTempo', (_event, data) => transport.setTempo(data.bpm));
ipcMain.on('transport:setBars', (_event, data) => transport.setBars(data.bars));
ipcMain.on('transport:setLoop', (_event, data) => {
    transport.setLoop(data.enabled, data.startBeats, data.endBeats);
});
ipcMain.handle('transport:getState', () => transport._getPositionData());

// ---- VST3 Scanner IPC ----

ipcMain.handle('vst3:scan', async (_event, forceRescan) => {
    if (!vst3Scanner) return { plugins: [], error: 'Scanner not initialized' };

    // Wire progress updates to renderer
    vst3Scanner.setProgressCallback((progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('vst3:scanProgress', progress);
        }
    });

    try {
        const plugins = await vst3Scanner.scan(forceRescan === true);
        // SECURITY (A6): tell vst3HostBridge which plugin paths are loadable.
        try {
            const paths = (plugins || []).map(p => p && p.path).filter(Boolean);
            setAllowedPluginPaths(paths);
        } catch (_) {}
        return { plugins, error: null };
    } catch (err) {
        return { plugins: [], error: err.message };
    }
});

ipcMain.handle('vst3:getCache', () => {
    if (!vst3Scanner) return null;
    const cache = vst3Scanner.loadCache();
    // Also seed the plugin allowlist from the persisted cache so previously
    // scanned plugins remain loadable without a fresh scan on each launch.
    try {
        if (cache && Array.isArray(cache.plugins)) {
            const paths = cache.plugins.map(p => p && p.path).filter(Boolean);
            setAllowedPluginPaths(paths);
        }
    } catch (_) {}
    return cache;
});

ipcMain.handle('vst3:clearCache', () => {
    if (vst3Scanner) vst3Scanner.clearCache();
});

ipcMain.handle('vst3:getPluginInfo', async (_event, pluginPath) => {
    if (!vst3Scanner) return null;
    return await vst3Scanner.extractPluginInfo(pluginPath);
});

ipcMain.handle('vst3:getCustomPaths', () => {
    if (!vst3Scanner) return ['', '', ''];
    return vst3Scanner.getCustomPaths();
});

ipcMain.handle('vst3:setCustomPaths', (_event, paths) => {
    if (!vst3Scanner) return;
    vst3Scanner.setCustomPaths(paths);
    // Invalidate cache when paths change
    vst3Scanner.clearCache();
});

ipcMain.handle('vst3:browseForFolder', async (event) => {
    if (!requireMainFrame(event)) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select VST3 Plugin Folder',
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return null;
    }
    // Track user-chosen path so subsequent fs:* calls against it pass assertSafePath.
    try { userChosenPaths.add(path.resolve(result.filePaths[0])); } catch (_) {}
    return result.filePaths[0];
});

// ---- App lifecycle ----

app.whenReady().then(() => {
    // SECURITY (A3): Inject Content-Security-Policy on every response in
    // packaged builds. In dev we leave headers untouched so Vite's HMR and
    // basicSsl behave normally; the CSP <meta> tag in index.html still
    // provides a baseline policy.
    if (app.isPackaged) {
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            const headers = { ...(details.responseHeaders || {}) };
            headers['Content-Security-Policy'] = [CSP_VALUE];
            callback({ responseHeaders: headers });
        });
    }

    // Initialize VST3 scanner with user data path
    vst3Scanner = new VST3Scanner(app.getPath('userData'));

    // Initialize VST3 native host addon
    vst3HostLoaded = loadNativeAddon();
    registerVST3HostIPC(ipcMain);

    // Initialize audio capture native addon
    audioCaptureLoaded = loadAudioCaptureAddon();
    registerAudioCaptureIPC(ipcMain);

    createWindow();

    // Register spacebar callback from VST3 editor windows → toggle playback in renderer
    if (vst3HostLoaded) {
        const addon = getAddon();
        if (addon && addon.registerEditorKeyCallback) {
            addon.registerEditorKeyCallback((key) => {
                if (key === 'space' && mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('vst3:togglePlayback');
                }
            });
        }
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Clean up all VST3 plugins (close editors + unload) before the app exits
app.on('will-quit', () => {
    transport.stop();
    if (vst3HostLoaded) {
        try {
            const addon = getAddon();
            if (addon && addon.isAvailable()) {
                addon.unloadAll();
                console.log('[VST3Host] All plugins unloaded on quit.');
            }
        } catch (err) {
            console.error('[VST3Host] Cleanup error on quit:', err);
        }
    }
});
