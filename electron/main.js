const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { TransportClock } = require('./transportClock');
const { VST3Scanner } = require('./vst3Scanner');
const { loadNativeAddon, getAddon, registerIPC: registerVST3HostIPC } = require('./vst3HostBridge');

// Enable SharedArrayBuffer without requiring strict COOP (same-origin).
// This lets us use same-origin-allow-popups for COOP so Google auth popups work.
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// Allow self-signed certs from Vite's dev HTTPS server in dev mode
if (!app.isPackaged) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
}

let mainWindow = null;
const isDev = !app.isPackaged;
const transport = new TransportClock();
let vst3Scanner = null; // Initialized after app.getPath('userData') is available
let vst3HostLoaded = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        frame: false,
        icon: path.join(__dirname, '..', 'src', 'images', 'wavloom_app_icon.png'),
        backgroundColor: '#0a0a0f',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
        },
    });

    // SharedArrayBuffer is enabled via command-line flag (line 10).
    // No COOP/COEP headers needed — removing them avoids blocking
    // Google Identity Services iframes and auth popups.

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

    // Forward renderer console messages to terminal for debugging
    mainWindow.webContents.on('console-message', (_event, level, message) => {
        // level: 0=verbose, 1=info, 2=warn, 3=error
        if (message.includes('[VST3') || message.includes('[DIAG') || level >= 2) {
            const prefix = level >= 3 ? '[Renderer ERR]' : level >= 2 ? '[Renderer WARN]' : '[Renderer]';
            console.log(`${prefix} ${message}`);
        }
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
}

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

// File system dialogs
ipcMain.handle('fs:showOpenDialog', async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('fs:showSaveDialog', async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

// File system operations
ipcMain.handle('fs:readFile', async (_event, filePath) => {
    try {
        const data = await fs.promises.readFile(filePath);
        return { data: data.buffer, error: null };
    } catch (err) {
        return { data: null, error: err.message };
    }
});

ipcMain.handle('fs:writeFile', async (_event, filePath, data) => {
    try {
        await fs.promises.writeFile(filePath, Buffer.from(data));
        return { error: null };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('fs:readDir', async (_event, dirPath) => {
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        return {
            entries: entries.map(e => ({
                name: e.name,
                isDirectory: e.isDirectory(),
                isFile: e.isFile(),
                path: path.join(dirPath, e.name),
            })),
            error: null,
        };
    } catch (err) {
        return { entries: [], error: err.message };
    }
});

ipcMain.handle('fs:stat', async (_event, filePath) => {
    try {
        const stat = await fs.promises.stat(filePath);
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

ipcMain.handle('fs:exists', async (_event, filePath) => {
    try {
        await fs.promises.access(filePath);
        return true;
    } catch {
        return false;
    }
});

ipcMain.handle('fs:mkdir', async (_event, dirPath, options) => {
    try {
        await fs.promises.mkdir(dirPath, { recursive: options?.recursive ?? true });
        return { error: null };
    } catch (err) {
        return { error: err.message };
    }
});

// Shell operations
ipcMain.handle('shell:openExternal', async (_event, url) => {
    await shell.openExternal(url);
});

ipcMain.handle('shell:showItemInFolder', async (_event, filePath) => {
    shell.showItemInFolder(filePath);
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
        return { plugins, error: null };
    } catch (err) {
        return { plugins: [], error: err.message };
    }
});

ipcMain.handle('vst3:getCache', () => {
    if (!vst3Scanner) return null;
    return vst3Scanner.loadCache();
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

ipcMain.handle('vst3:browseForFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select VST3 Plugin Folder',
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

// ---- App lifecycle ----

app.whenReady().then(() => {
    // Initialize VST3 scanner with user data path
    vst3Scanner = new VST3Scanner(app.getPath('userData'));

    // Initialize VST3 native host addon
    vst3HostLoaded = loadNativeAddon();
    registerVST3HostIPC(ipcMain);

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
