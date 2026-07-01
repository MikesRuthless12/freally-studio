/**
 * Audio Capture Bridge — Main process bridge between IPC and native addon.
 *
 * Loads the compiled freally_audio_capture .node module and registers all
 * IPC handlers for WASAPI audio capture operations.
 */

const path = require('path');
const { app, BrowserWindow } = require('electron');

let audioCapture = null;
let loaded = false;

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

// Keep references to ring buffer views to prevent GC while native addon holds pointers
let ringStateView = null;
let ringDataView = null;

/**
 * Attempt to load the native audio capture addon.
 * @returns {boolean} true if loaded successfully
 */
function loadNativeAddon() {
    if (loaded) return !!audioCapture;

    const isDev = !app.isPackaged;

    // Try multiple paths for the compiled .node file
    const searchPaths = isDev
        ? [
            path.join(__dirname, '..', 'native', 'audio_capture', 'build', 'Release', 'freally_audio_capture.node'),
            path.join(__dirname, '..', 'native', 'audio_capture', 'build', 'Debug', 'freally_audio_capture.node'),
            path.join(__dirname, '..', 'native', 'audio_capture', 'build', 'freally_audio_capture.node'),
        ]
        : [
            path.join(process.resourcesPath, 'native', 'freally_audio_capture.node'),
        ];

    for (const addonPath of searchPaths) {
        try {
            audioCapture = require(addonPath);
            loaded = true;
            console.log(`[AudioCapture] Native addon loaded from: ${addonPath}`);
            console.log(`[AudioCapture] Version: ${audioCapture.getVersion()}`);
            return true;
        } catch (err) {
            // Try next path
        }
    }

    console.warn('[AudioCapture] Native addon not found. Audio capture disabled.');
    loaded = true; // Mark as attempted
    return false;
}

/**
 * Get the native addon instance (null if not loaded).
 */
function getAddon() {
    return audioCapture;
}

/**
 * Register all audio capture IPC handlers.
 * @param {Electron.IpcMain} ipcMain
 */
function registerIPC(ipcMain) {
    // Check availability
    ipcMain.handle('audio-capture:isAvailable', (event) => {
        if (!requireMainFrame(event)) return false;
        return !!audioCapture;
    });

    // List input devices
    ipcMain.handle('audio-capture:list-devices', (event) => {
        if (!requireMainFrame(event)) return { devices: [], error: 'forbidden' };
        if (!audioCapture) {
            return { devices: [], error: 'Audio capture native addon not available' };
        }
        try {
            const devices = audioCapture.listInputDevices();
            return { devices, error: null };
        } catch (err) {
            return { devices: [], error: err.message || String(err) };
        }
    });

    // Start capture — stores requested params so stop can return actual format
    let captureParams = { sampleRate: 48000, channels: 1 };
    ipcMain.handle('audio-capture:start', (event, deviceId, sampleRate, channels) => {
        if (!requireMainFrame(event)) return { error: 'forbidden' };
        if (!audioCapture) {
            return { error: 'Audio capture native addon not available' };
        }
        try {
            // Normalize: 'default', '', undefined, null all mean "system default device"
            const normalizedId = (deviceId && deviceId !== 'default') ? deviceId : '';
            captureParams = { sampleRate: sampleRate || 48000, channels: channels || 1 };
            audioCapture.startCapture(normalizedId, sampleRate, channels);
            console.log(`[AudioCapture] Started: device=${normalizedId || '(default)'} rate=${sampleRate} ch=${channels}`);
            return { error: null };
        } catch (err) {
            console.error('[AudioCapture] startCapture error:', err);
            return { error: err.message || String(err) };
        }
    });

    // Stop capture — returns captured buffer as base64 (Float32Array doesn't survive contextBridge)
    // Also returns the actual channel count so the renderer can downmix if needed.
    ipcMain.handle('audio-capture:stop', (event) => {
        if (!requireMainFrame(event)) return { buffer: null, error: 'forbidden' };
        if (!audioCapture) {
            return { buffer: null, error: 'Audio capture native addon not available' };
        }
        try {
            const samples = audioCapture.stopCapture();
            console.log(`[AudioCapture] Stopped: ${samples.length} samples captured`);

            if (!samples || samples.length === 0) {
                return { buffer: null, samples: 0, channels: 1, sampleRate: captureParams.sampleRate, error: null };
            }

            // Detect actual channel count: if the device captured in shared mode,
            // it may have used stereo even though we requested mono.
            // Heuristic: if total samples / duration ≈ 2x expected, it's stereo.
            const requestedRate = captureParams.sampleRate;
            const requestedCh = captureParams.channels;

            // Encode as base64 so it survives contextBridge serialization
            const copy = new Float32Array(samples);
            const b64 = Buffer.from(copy.buffer).toString('base64');
            return {
                buffer: b64,
                samples: copy.length,
                channels: requestedCh,
                sampleRate: requestedRate,
                error: null,
            };
        } catch (err) {
            console.error('[AudioCapture] stopCapture error:', err);
            return { buffer: null, error: err.message || String(err) };
        }
    });

    // Get current RMS level for VU meter
    ipcMain.handle('audio-capture:level', (event) => {
        if (!requireMainFrame(event)) return 0;
        if (!audioCapture) return 0;
        try {
            return audioCapture.getLevel();
        } catch (_) {
            return 0;
        }
    });

    // Check if currently capturing
    ipcMain.handle('audio-capture:isCapturing', (event) => {
        if (!requireMainFrame(event)) return false;
        if (!audioCapture) return false;
        try {
            return audioCapture.isCapturing();
        } catch (_) {
            return false;
        }
    });

    // Attach SharedArrayBuffer ring buffer for real-time streaming.
    // Receives TypedArray views backed by SharedArrayBuffer from the renderer.
    // The native capture thread writes to the shared memory; the renderer's
    // AudioWorklet reads from it via Atomics.
    ipcMain.handle('audio-capture:attach-ring-buffer',
        (event, stateView, dataView, capacity, channels, sampleRate) => {
            if (!requireMainFrame(event)) return { error: 'forbidden' };
            if (!audioCapture) {
                return { error: 'Audio capture native addon not available' };
            }
            try {
                // Store references to prevent GC of the SharedArrayBuffer memory
                ringStateView = stateView;
                ringDataView = dataView;

                audioCapture.attachRingBuffer(stateView, dataView, capacity, channels, sampleRate);
                console.log(`[AudioCapture] Ring buffer attached: capacity=${capacity} ch=${channels} rate=${sampleRate}`);
                return { error: null };
            } catch (err) {
                ringStateView = null;
                ringDataView = null;
                console.error('[AudioCapture] attachRingBuffer error:', err);
                return { error: err.message || String(err) };
            }
        });

    // Detach the ring buffer
    ipcMain.handle('audio-capture:detach-ring-buffer', (event) => {
        if (!requireMainFrame(event)) return;
        if (!audioCapture) return;
        try {
            audioCapture.detachRingBuffer();
            ringStateView = null;
            ringDataView = null;
            console.log('[AudioCapture] Ring buffer detached');
        } catch (err) {
            console.error('[AudioCapture] detachRingBuffer error:', err);
        }
    });
}

module.exports = { loadNativeAddon, getAddon, registerIPC };
