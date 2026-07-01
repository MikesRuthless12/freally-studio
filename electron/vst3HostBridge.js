/**
 * VST3 Host Bridge — Main process bridge between IPC and native addon.
 *
 * Loads the compiled native .node module and registers all IPC handlers
 * for VST3 plugin hosting operations.
 */

const path = require('path');
const { app, BrowserWindow } = require('electron');

let vst3Host = null;
let loaded = false;

// SECURITY: paths returned by the latest vst3Scanner.scan() — only plugins
// from this allowlist may be loaded by loadPlugin (A6).
const allowedPluginPaths = new Set();

/** Mark a list of plugin paths as safe to load. */
function setAllowedPluginPaths(paths) {
    allowedPluginPaths.clear();
    if (Array.isArray(paths)) {
        for (const p of paths) {
            if (typeof p === 'string' && p) {
                try { allowedPluginPaths.add(path.resolve(p)); } catch (_) {}
            }
        }
    }
}

/** Reject IPC events that did not come from the main window's main frame (A5). */
function requireMainFrame(event) {
    try {
        const wins = BrowserWindow.getAllWindows();
        const main = wins.find(w => !w.isDestroyed());
        return !!(main && event && event.senderFrame === main.webContents.mainFrame);
    } catch (_) {
        return false;
    }
}

/**
 * Attempt to load the native VST3 host addon.
 * @returns {boolean} true if loaded successfully
 */
function loadNativeAddon() {
    if (loaded) return !!vst3Host;

    const isDev = !app.isPackaged;

    // Try multiple paths for the compiled .node file
    const searchPaths = isDev
        ? [
            path.join(__dirname, '..', 'native', 'build', 'Release', 'freally_vst3_host.node'),
            path.join(__dirname, '..', 'native', 'build', 'Debug', 'freally_vst3_host.node'),
            path.join(__dirname, '..', 'native', 'build', 'freally_vst3_host.node'),
        ]
        : [
            path.join(process.resourcesPath, 'native', 'freally_vst3_host.node'),
        ];

    for (const addonPath of searchPaths) {
        try {
            vst3Host = require(addonPath);
            loaded = true;
            console.log(`[VST3Host] Native addon loaded from: ${addonPath}`);
            console.log(`[VST3Host] Version: ${vst3Host.getVersion()}, SDK available: ${vst3Host.isAvailable()}`);
            return true;
        } catch (err) {
            // Try next path
        }
    }

    console.warn('[VST3Host] Native addon not found. VST3 plugin hosting disabled.');
    loaded = true; // Mark as attempted
    return false;
}

/**
 * Get the native addon instance (null if not loaded).
 */
function getAddon() {
    return vst3Host;
}

/**
 * Register all VST3 host IPC handlers.
 * @param {Electron.IpcMain} ipcMain
 */
function registerIPC(ipcMain) {
    // Load plugin
    ipcMain.handle('vst3host:loadPlugin', async (event, pluginPath, uid) => {
        if (!requireMainFrame(event)) return { error: 'forbidden' };
        if (!vst3Host || !vst3Host.isAvailable()) {
            return { error: 'VST3 native addon not available' };
        }
        // SECURITY (A6): only plugins discovered by the most recent
        // vst3Scanner.scan() are loadable.
        if (typeof pluginPath !== 'string' || !pluginPath) {
            return { error: 'Invalid plugin path' };
        }
        const resolved = path.resolve(pluginPath);
        if (!allowedPluginPaths.has(resolved)) {
            console.warn('[VST3Host] loadPlugin rejected — not in allowlist:', resolved);
            return { error: 'Plugin path not in allowlist' };
        }
        try {
            const result = vst3Host.loadPlugin(pluginPath, uid || '');
            return { ...result, error: null };
        } catch (err) {
            return { error: err.message || String(err) };
        }
    });

    // Unload plugin
    ipcMain.handle('vst3host:unloadPlugin', (event, instanceId) => {
        if (!requireMainFrame(event)) return false;
        if (!vst3Host) return false;
        try {
            return vst3Host.unloadPlugin(instanceId);
        } catch (err) {
            console.error('[VST3Host] unloadPlugin error:', err);
            return false;
        }
    });

    // Process audio block
    let _pbLogCount = 0;
    let _pbNonZeroCount = 0;  // track how many blocks had non-zero audio
    let _pbTotalCount = 0;    // total blocks processed
    let _pbLastSummary = Date.now();  // last summary log time
    let _pbRoundTripDone = false; // one-time base64 round-trip verification
    const _testToneCounts = {}; // per-instance test tone block counter

    ipcMain.handle('vst3host:processBlock', (event, instanceId, inputBuffer, numFrames, numInCh, numOutCh) => {
        if (!requireMainFrame(event)) return null;
        if (!vst3Host) return null;
        try {
            // TEST TONE: First 5 blocks per instance — inject 440Hz sine wave
            // to verify the entire IPC→decode→AudioBufferSource→bus→destination path.
            if (!_testToneCounts[instanceId]) _testToneCounts[instanceId] = 0;
            _testToneCounts[instanceId]++;
            if (_testToneCounts[instanceId] <= 5) {
                const sr = 44100;
                const tone = new Float32Array(numFrames * 2);
                const phase = (_testToneCounts[instanceId] - 1) * numFrames;
                for (let i = 0; i < numFrames; i++) {
                    const t = (phase + i) / sr;
                    const val = 0.3 * Math.sin(2 * Math.PI * 440 * t);
                    tone[i * 2] = val;
                    tone[i * 2 + 1] = val;
                }
                const b64 = Buffer.from(tone.buffer).toString('base64');
                console.log(`[VST3 TEST TONE] block ${_testToneCounts[instanceId]}/5 for ${instanceId.slice(0,8)}`);
                _pbLogCount++;
                return b64;
            }

            const input = inputBuffer ? new Float32Array(inputBuffer) : new Float32Array(0);
            const result = vst3Host.processBlock(instanceId, input, numFrames, numInCh, numOutCh);

            _pbTotalCount++;
            let peak = 0;
            if (result) {
                for (let i = 0; i < Math.min(result.length, 200); i++) {
                    const v = Math.abs(result[i]);
                    if (v > peak) peak = v;
                }
                if (peak > 0.0001) _pbNonZeroCount++;
            }

            // Debug: log first 20 calls and then every 200th
            if (result && (_pbLogCount < 20 || _pbLogCount % 200 === 0)) {
                console.log(`[VST3 processBlock #${_pbLogCount}] id=${instanceId.slice(0,8)} frames=${numFrames} peak=${peak.toFixed(6)}`);
            }
            if (!result && _pbLogCount < 20) {
                console.log(`[VST3 processBlock #${_pbLogCount}] returned null/undefined`);
            }
            _pbLogCount++;

            // Periodic summary every 5 seconds (reliable main-process logging)
            const now = Date.now();
            if (now - _pbLastSummary > 5000) {
                console.log(`[VST3 AUDIO SUMMARY] total=${_pbTotalCount} nonZero=${_pbNonZeroCount} rate=${(_pbTotalCount / ((now - _pbLastSummary) / 1000)).toFixed(1)}/s`);
                _pbTotalCount = 0;
                _pbNonZeroCount = 0;
                _pbLastSummary = now;
            }

            if (!result) return null;
            // Copy to JS-owned buffer then encode as base64 (survives contextBridge)
            const copy = new Float32Array(result);
            const b64 = Buffer.from(copy.buffer).toString('base64');

            // ONE-TIME: verify base64 round-trip on first non-zero block
            if (!_pbRoundTripDone && peak > 0.001) {
                _pbRoundTripDone = true;
                try {
                    const rtBuf = Buffer.from(b64, 'base64');
                    const rtArr = new Float32Array(rtBuf.buffer, rtBuf.byteOffset, rtBuf.byteLength / 4);
                    let rtPeak = 0;
                    for (let i = 0; i < Math.min(rtArr.length, 200); i++) {
                        const v = Math.abs(rtArr[i]);
                        if (v > rtPeak) rtPeak = v;
                    }
                    console.log(`[VST3 B64 VERIFY] origPeak=${peak.toFixed(6)} rtPeak=${rtPeak.toFixed(6)} b64len=${b64.length} samples=${copy.length}`);
                    console.log(`[VST3 B64 VERIFY] first8: [${Array.from(copy.slice(0,8)).map(v=>v.toFixed(6)).join(', ')}]`);
                } catch(e) {
                    console.error('[VST3 B64 VERIFY] error:', e);
                }
            }

            return b64;
        } catch (err) {
            console.error('[VST3Host] processBlock error:', err);
            return null;
        }
    });

    // MIDI events
    ipcMain.handle('vst3host:noteOn', (event, instanceId, ch, note, vel) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.sendNoteOn(instanceId, ch, note, vel); } catch (_) {}
    });

    ipcMain.handle('vst3host:noteOff', (event, instanceId, ch, note, vel) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.sendNoteOff(instanceId, ch, note, vel); } catch (_) {}
    });

    ipcMain.handle('vst3host:sendCC', (event, instanceId, ch, cc, val) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.sendCC(instanceId, ch, cc, val); } catch (_) {}
    });

    // Parameters
    ipcMain.handle('vst3host:setParameter', (event, instanceId, paramId, value) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.setParameter(instanceId, paramId, value); } catch (_) {}
    });

    ipcMain.handle('vst3host:getParameter', (event, instanceId, paramId) => {
        if (!requireMainFrame(event)) return 0;
        if (!vst3Host) return 0;
        try { return vst3Host.getParameter(instanceId, paramId); } catch (_) { return 0; }
    });

    ipcMain.handle('vst3host:getParameterList', (event, instanceId) => {
        if (!requireMainFrame(event)) return [];
        if (!vst3Host) return [];
        try { return vst3Host.getParameterList(instanceId); } catch (_) { return []; }
    });

    // State (presets)
    ipcMain.handle('vst3host:getPluginState', (event, instanceId) => {
        if (!requireMainFrame(event)) return null;
        if (!vst3Host) return null;
        try { return vst3Host.getPluginState(instanceId); } catch (_) { return null; }
    });

    ipcMain.handle('vst3host:setPluginState', (event, instanceId, stateData) => {
        if (!requireMainFrame(event)) return false;
        if (!vst3Host) return false;
        try { return vst3Host.setPluginState(instanceId, stateData); } catch (_) { return false; }
    });

    // Audio settings
    ipcMain.handle('vst3host:setSampleRate', (event, rate) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.setSampleRate(rate); } catch (_) {}
    });

    ipcMain.handle('vst3host:setBlockSize', (event, size) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.setBlockSize(size); } catch (_) {}
    });

    // Transport
    ipcMain.handle('vst3host:setTransportState', (event, state) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.setTransportState(state); } catch (_) {}
    });

    // Cleanup
    ipcMain.handle('vst3host:unloadAll', (event) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.unloadAll(); } catch (_) {}
    });

    // Editor (plugin GUI window)
    ipcMain.handle('vst3host:openEditor', (event, instanceId) => {
        if (!requireMainFrame(event)) return { success: false, error: 'forbidden' };
        if (!vst3Host || !vst3Host.isAvailable()) {
            return { success: false, error: 'VST3 native addon not available' };
        }
        try {
            return vst3Host.openEditor(instanceId);
        } catch (err) {
            return { success: false, error: err.message || String(err) };
        }
    });

    ipcMain.handle('vst3host:closeEditor', (event, instanceId) => {
        if (!requireMainFrame(event)) return;
        if (!vst3Host) return;
        try { vst3Host.closeEditor(instanceId); } catch (_) {}
    });

    ipcMain.handle('vst3host:isEditorOpen', (event, instanceId) => {
        if (!requireMainFrame(event)) return false;
        if (!vst3Host) return false;
        try { return vst3Host.isEditorOpen(instanceId); } catch (_) { return false; }
    });

    // Check availability
    ipcMain.handle('vst3host:isAvailable', (event) => {
        if (!requireMainFrame(event)) return false;
        return !!(vst3Host && vst3Host.isAvailable());
    });
}

module.exports = { loadNativeAddon, getAddon, registerIPC, setAllowedPluginPaths };
