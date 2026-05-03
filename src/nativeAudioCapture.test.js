/**
 * Native Audio Capture — comprehensive unit tests.
 *
 * Covers:
 *  1. DEFAULT_SETTINGS – new capture fields exist with correct defaults
 *  2. loadSettings / saveSettings – round-trip persistence of capture settings
 *  3. audioCaptureBridge – IPC handler registration and behaviour
 *  4. Preload API surface – every audioCapture method exists
 *  5. Device enumeration – native vs browser device lists
 *  6. Mic test – native polling path and browser AnalyserNode path
 *  7. Capture latency calculation – bufferSize / sampleRate arithmetic
 *  8. Buffer size & sample rate validation – only accepted values
 *  9. Device hot-plug – devicechange event triggers re-enumeration
 * 10. i18n – all 7 new keys present in every locale file
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ── Browser globals must exist before SettingsModal module is evaluated ──
// vi.hoisted() runs before any import is resolved.
vi.hoisted(() => {
    // localStorage mock — Node's built-in localStorage is incomplete,
    // so we force-replace it via Object.defineProperty.
    const _store = {};
    const mockStorage = {
        getItem: (k) => (k in _store ? _store[k] : null),
        setItem: (k, v) => { _store[k] = String(v); },
        removeItem: (k) => { delete _store[k]; },
        clear: () => { for (const k in _store) delete _store[k]; },
    };
    Object.defineProperty(globalThis, 'localStorage', {
        value: mockStorage, writable: true, configurable: true,
    });

    globalThis.window = globalThis.window || {};
    globalThis.window.AudioContext = globalThis.window.AudioContext || class MockAudioContext {};
    globalThis.window._wavloomNativeSampleRate = 48000;
});

import { loadSettings, saveSettings } from './SettingsModal.jsx';

// =========================================================================
//  1. DEFAULT_SETTINGS — new native capture fields
// =========================================================================

describe('DEFAULT_SETTINGS includes native capture fields', () => {
    it('loadSettings() returns useNativeCapture = true by default', () => {
        localStorage.removeItem('wavloom_settings');
        const s = loadSettings();
        expect(s.useNativeCapture).toBe(true);
    });

    it('loadSettings() returns captureBufferSize = 256 by default', () => {
        localStorage.removeItem('wavloom_settings');
        const s = loadSettings();
        expect(s.captureBufferSize).toBe(256);
    });

    it('loadSettings() returns captureSampleRate = 48000 by default', () => {
        localStorage.removeItem('wavloom_settings');
        const s = loadSettings();
        expect(s.captureSampleRate).toBe(48000);
    });
});

// =========================================================================
//  2. loadSettings / saveSettings round-trip
// =========================================================================

describe('Settings persistence round-trip', () => {
    beforeEach(() => localStorage.removeItem('wavloom_settings'));

    it('persists useNativeCapture = false and restores it', () => {
        const s = loadSettings();
        s.useNativeCapture = false;
        saveSettings(s);
        const restored = loadSettings();
        expect(restored.useNativeCapture).toBe(false);
    });

    it('persists captureBufferSize = 1024 and restores it', () => {
        const s = loadSettings();
        s.captureBufferSize = 1024;
        saveSettings(s);
        expect(loadSettings().captureBufferSize).toBe(1024);
    });

    it('persists captureSampleRate = 96000 and restores it', () => {
        const s = loadSettings();
        s.captureSampleRate = 96000;
        saveSettings(s);
        expect(loadSettings().captureSampleRate).toBe(96000);
    });

    it('preserves all three capture settings together', () => {
        saveSettings({
            ...loadSettings(),
            useNativeCapture: false,
            captureBufferSize: 64,
            captureSampleRate: 44100,
        });
        const r = loadSettings();
        expect(r.useNativeCapture).toBe(false);
        expect(r.captureBufferSize).toBe(64);
        expect(r.captureSampleRate).toBe(44100);
    });

    it('merges with DEFAULT_SETTINGS when stored JSON is partial', () => {
        // Simulate old settings that predate native capture
        localStorage.setItem('wavloom_settings', JSON.stringify({ showTooltips: false }));
        const r = loadSettings();
        expect(r.showTooltips).toBe(false);
        // New fields come from defaults
        expect(r.useNativeCapture).toBe(true);
        expect(r.captureBufferSize).toBe(256);
        expect(r.captureSampleRate).toBe(48000);
    });

    it('handles corrupted localStorage gracefully', () => {
        localStorage.setItem('wavloom_settings', '{{{bad json');
        const r = loadSettings();
        // Falls back to defaults
        expect(r.useNativeCapture).toBe(true);
        expect(r.captureBufferSize).toBe(256);
    });
});

// =========================================================================
//  3. audioCaptureBridge — IPC handler registration & behaviour
// =========================================================================

describe('audioCaptureBridge IPC registration', () => {
    let bridge;
    let handlers;
    let mockIpcMain;

    beforeEach(async () => {
        handlers = {};
        mockIpcMain = {
            handle: vi.fn((channel, handler) => {
                handlers[channel] = handler;
            }),
        };

        // We need to load the bridge module fresh each test.
        // It uses require() internally, so we dynamically import via a
        // function that evaluates the module source.
        // Instead, we test the contract by reading the source and verifying channels.
        const bridgeSrc = fs.readFileSync(
            path.resolve(__dirname, '../electron/audioCaptureBridge.js'),
            'utf-8'
        );
        // The source should contain ipcMain.handle calls for these channels:
        const expectedChannels = [
            'audio-capture:isAvailable',
            'audio-capture:list-devices',
            'audio-capture:start',
            'audio-capture:stop',
            'audio-capture:level',
            'audio-capture:isCapturing',
            'audio-capture:attach-ring-buffer',
            'audio-capture:detach-ring-buffer',
        ];

        for (const ch of expectedChannels) {
            expect(bridgeSrc, `Bridge should register IPC channel: ${ch}`).toContain(`'${ch}'`);
        }
    });

    it('exports loadNativeAddon, getAddon, registerIPC', () => {
        const bridgeSrc = fs.readFileSync(
            path.resolve(__dirname, '../electron/audioCaptureBridge.js'),
            'utf-8'
        );
        expect(bridgeSrc).toContain('module.exports');
        expect(bridgeSrc).toContain('loadNativeAddon');
        expect(bridgeSrc).toContain('getAddon');
        expect(bridgeSrc).toContain('registerIPC');
    });

    it('startCapture IPC handler passes deviceId, sampleRate, channels', () => {
        const bridgeSrc = fs.readFileSync(
            path.resolve(__dirname, '../electron/audioCaptureBridge.js'),
            'utf-8'
        );
        // The IPC handler receives deviceId, normalizes it, and calls startCapture
        expect(bridgeSrc).toContain('startCapture');
        // Handler signature contains deviceId, sampleRate, channels
        // Matches both "(_event, ..." (legacy) and "(event, ..." (post sender-frame validation).
        expect(bridgeSrc).toMatch(/_?event,\s*deviceId,\s*sampleRate,\s*channels/);
    });

    it('stopCapture IPC handler encodes result as base64', () => {
        const bridgeSrc = fs.readFileSync(
            path.resolve(__dirname, '../electron/audioCaptureBridge.js'),
            'utf-8'
        );
        expect(bridgeSrc).toContain("toString('base64')");
    });

    it('getLevel IPC handler returns 0 when addon unavailable', () => {
        const bridgeSrc = fs.readFileSync(
            path.resolve(__dirname, '../electron/audioCaptureBridge.js'),
            'utf-8'
        );
        // Pattern: if (!audioCapture) return 0;
        expect(bridgeSrc).toMatch(/audio-capture:level.*?return 0/s);
    });
});

// =========================================================================
//  4. Preload API surface — every audioCapture method
// =========================================================================

describe('Preload exposes complete audioCapture API', () => {
    let preloadSrc;

    beforeEach(() => {
        preloadSrc = fs.readFileSync(
            path.resolve(__dirname, '../electron/preload.js'),
            'utf-8'
        );
    });

    const requiredMethods = [
        'isAvailable',
        'listDevices',
        'start',
        'stop',
        'getLevel',
        'isCapturing',
        'createRingBuffer',
        'detachRingBuffer',
    ];

    for (const method of requiredMethods) {
        it(`exposes audioCapture.${method}`, () => {
            // Check both the method name and the IPC channel it maps to
            expect(preloadSrc).toContain(method);
        });
    }

    it('audioCapture section maps to correct IPC channels', () => {
        expect(preloadSrc).toContain("'audio-capture:isAvailable'");
        expect(preloadSrc).toContain("'audio-capture:list-devices'");
        expect(preloadSrc).toContain("'audio-capture:start'");
        expect(preloadSrc).toContain("'audio-capture:stop'");
        expect(preloadSrc).toContain("'audio-capture:level'");
        expect(preloadSrc).toContain("'audio-capture:isCapturing'");
        expect(preloadSrc).toContain("'audio-capture:attach-ring-buffer'");
        expect(preloadSrc).toContain("'audio-capture:detach-ring-buffer'");
    });

    it('start() passes deviceId, sampleRate, channels to IPC', () => {
        // The preload start method should forward all three args
        const startMatch = preloadSrc.match(/start:\s*\((.*?)\)\s*=>/);
        expect(startMatch).not.toBeNull();
        const args = startMatch[1];
        expect(args).toContain('deviceId');
        expect(args).toContain('sampleRate');
        expect(args).toContain('channels');
    });

    it('createRingBuffer creates SharedArrayBuffers in the preload world', () => {
        expect(preloadSrc).toContain('new SharedArrayBuffer(32)');
        expect(preloadSrc).toContain('new SharedArrayBuffer(capacity * 4)');
    });

    it('createRingBuffer returns stateBuffer, dataBuffer, error to renderer', () => {
        expect(preloadSrc).toContain('return { stateBuffer, dataBuffer, error: null }');
    });

    it('renderer uses SharedArrayBuffer ring buffer for native capture', () => {
        const recorderSrc = fs.readFileSync(path.resolve(__dirname, 'AudioRecorder.js'), 'utf-8');
        // AudioRecorder manages SharedArrayBuffer ring buffers for native WASAPI capture
        expect(recorderSrc).toContain('SharedArrayBuffer');
        expect(recorderSrc).toContain('detachRingBuffer');
    });

    it('SamplerEngine uses createRingBuffer instead of creating SABs directly', () => {
        const samplerSrc = fs.readFileSync(path.resolve(__dirname, 'SamplerEngine.js'), 'utf-8');
        expect(samplerSrc).toContain('api.createRingBuffer(');
        expect(samplerSrc).not.toContain('new SharedArrayBuffer');
    });
});

// =========================================================================
//  5. Device enumeration — native vs browser
// =========================================================================

describe('Device enumeration logic', () => {
    it('native device list format has id and name fields', () => {
        // The SettingsModal expects native devices shaped as { id, name }
        // Verify bridge returns this shape by checking bridge source
        const bridgeSrc = fs.readFileSync(
            path.resolve(__dirname, '../electron/audioCaptureBridge.js'),
            'utf-8'
        );
        // listInputDevices is called and result forwarded as { devices, error }
        expect(bridgeSrc).toContain('listInputDevices');
        expect(bridgeSrc).toContain('devices');
    });

    it('browser device list format has deviceId and label fields', () => {
        // Standard Web API contract — MediaDeviceInfo has deviceId, label, kind
        // Verified by SettingsModal using d.deviceId and d.label
        const settingsSrc = fs.readFileSync(
            path.resolve(__dirname, 'SettingsModal.jsx'),
            'utf-8'
        );
        expect(settingsSrc).toContain('d.deviceId');
        expect(settingsSrc).toContain('d.label');
    });

    it('SettingsModal switches input list based on useNative flag', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'SettingsModal.jsx'),
            'utf-8'
        );
        // Should pick nativeInputDevices when useNative is true
        expect(src).toContain('useNative ? nativeInputDevices : audioInputDevices');
    });
});

// =========================================================================
//  6. Mic test — native polling vs browser analyser paths
// =========================================================================

describe('Mic test paths', () => {
    let src;
    beforeEach(() => {
        src = fs.readFileSync(path.resolve(__dirname, 'SettingsModal.jsx'), 'utf-8');
    });

    it('native path starts capture via audioCapture.start()', () => {
        expect(src).toContain('api.start(');
    });

    it('native path polls getLevel() on an interval', () => {
        expect(src).toContain('api.getLevel()');
        expect(src).toContain('setInterval');
    });

    it('native path stores nativePolling interval ref', () => {
        expect(src).toContain('nativePolling');
    });

    it('stopMicTest clears native polling interval', () => {
        expect(src).toContain('clearInterval(micTestRef.current.nativePolling)');
    });

    it('stopMicTest calls audioCapture.stop() for native path', () => {
        expect(src).toContain('audioCapture.stop()');
    });

    it('browser path uses getUserMedia and AnalyserNode', () => {
        expect(src).toContain('getUserMedia');
        expect(src).toContain('createAnalyser');
        expect(src).toContain('getFloatTimeDomainData');
    });

    it('browser path uses requestAnimationFrame for VU meter', () => {
        expect(src).toContain('requestAnimationFrame(tick)');
    });

    it('stopMicTest cleans up browser path nodes', () => {
        expect(src).toContain('cancelAnimationFrame');
        expect(src).toContain('.stream.getTracks()');
        expect(src).toContain('.source.disconnect()');
    });
});

// =========================================================================
//  7. Capture latency calculation
// =========================================================================

describe('Capture latency calculation', () => {
    // The formula in SettingsModal: (bufferSize / sampleRate) * 1000
    function computeLatency(bufferSize, sampleRate) {
        return Math.round((bufferSize / sampleRate) * 1000 * 100) / 100;
    }

    it('256 samples @ 48000 Hz → ~5.33 ms', () => {
        expect(computeLatency(256, 48000)).toBeCloseTo(5.33, 1);
    });

    it('64 samples @ 48000 Hz → ~1.33 ms', () => {
        expect(computeLatency(64, 48000)).toBeCloseTo(1.33, 1);
    });

    it('128 samples @ 44100 Hz → ~2.90 ms', () => {
        expect(computeLatency(128, 44100)).toBeCloseTo(2.90, 1);
    });

    it('512 samples @ 96000 Hz → ~5.33 ms', () => {
        expect(computeLatency(512, 96000)).toBeCloseTo(5.33, 1);
    });

    it('1024 samples @ 44100 Hz → ~23.22 ms', () => {
        expect(computeLatency(1024, 44100)).toBeCloseTo(23.22, 1);
    });

    it('1024 samples @ 48000 Hz → ~21.33 ms', () => {
        expect(computeLatency(1024, 48000)).toBeCloseTo(21.33, 1);
    });

    it('64 samples @ 96000 Hz → ~0.67 ms', () => {
        expect(computeLatency(64, 96000)).toBeCloseTo(0.67, 1);
    });

    it('SettingsModal source contains the same latency formula', () => {
        const src = fs.readFileSync(path.resolve(__dirname, 'SettingsModal.jsx'), 'utf-8');
        expect(src).toContain('captureBufferSize / draft.captureSampleRate) * 1000');
    });
});

// =========================================================================
//  8. Buffer size & sample rate — only valid options
// =========================================================================

describe('Buffer size and sample rate options', () => {
    const VALID_BUFFER_SIZES = [64, 128, 256, 512, 1024];
    const VALID_CAPTURE_RATES = [44100, 48000, 88200, 96000];

    let src;
    beforeEach(() => {
        src = fs.readFileSync(path.resolve(__dirname, 'SettingsModal.jsx'), 'utf-8');
    });

    for (const size of VALID_BUFFER_SIZES) {
        it(`CAPTURE_BUFFER_SIZES includes ${size}`, () => {
            expect(src).toContain(`value: ${size}`);
        });
    }

    for (const rate of VALID_CAPTURE_RATES) {
        it(`CAPTURE_SAMPLE_RATES includes ${rate}`, () => {
            expect(src).toContain(`value: ${rate}`);
        });
    }

    it('CAPTURE_BUFFER_SIZES has exactly 5 entries', () => {
        const matches = src.match(/CAPTURE_BUFFER_SIZES\s*=\s*\[([\s\S]*?)\];/);
        expect(matches).not.toBeNull();
        const entries = matches[1].match(/value:\s*\d+/g);
        expect(entries).toHaveLength(5);
    });

    it('CAPTURE_SAMPLE_RATES has exactly 4 entries', () => {
        const matches = src.match(/CAPTURE_SAMPLE_RATES\s*=\s*\[([\s\S]*?)\];/);
        expect(matches).not.toBeNull();
        const entries = matches[1].match(/value:\s*\d+/g);
        expect(entries).toHaveLength(4);
    });

    it('default captureBufferSize is in the valid set', () => {
        expect(VALID_BUFFER_SIZES).toContain(loadSettings().captureBufferSize);
    });

    it('default captureSampleRate is in the valid set', () => {
        expect(VALID_CAPTURE_RATES).toContain(loadSettings().captureSampleRate);
    });
});

// =========================================================================
//  9. Device hot-plug — devicechange listener
// =========================================================================

describe('Device hot-plug handling', () => {
    it('SettingsModal registers devicechange event listener', () => {
        const src = fs.readFileSync(path.resolve(__dirname, 'SettingsModal.jsx'), 'utf-8');
        expect(src).toContain("addEventListener('devicechange'");
    });

    it('SettingsModal removes devicechange listener on cleanup', () => {
        const src = fs.readFileSync(path.resolve(__dirname, 'SettingsModal.jsx'), 'utf-8');
        expect(src).toContain("removeEventListener('devicechange'");
    });

    it('devicechange handler calls enumerateAudioDevices', () => {
        const src = fs.readFileSync(path.resolve(__dirname, 'SettingsModal.jsx'), 'utf-8');
        // The handler should invoke the enumeration function
        expect(src).toMatch(/devicechange.*enumerateAudioDevices/s);
    });
});

// =========================================================================
// 10. i18n — all 7 new keys present in every locale
// =========================================================================

describe('i18n keys for native audio capture', () => {
    const REQUIRED_KEYS = [
        'settings.useNativeCapture',
        'settings.useNativeCaptureDesc',
        'settings.captureBufferSize',
        'settings.captureBufferSizeDesc',
        'settings.captureSampleRate',
        'settings.captureSampleRateDesc',
        'settings.captureLatency',
    ];

    const localesDir = path.resolve(__dirname, 'i18n', 'locales');
    const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

    // Sanity: we should have exactly 18 locale files
    it('has 18 locale files', () => {
        expect(localeFiles).toHaveLength(18);
    });

    for (const file of localeFiles) {
        const code = file.replace('.json', '');
        const locale = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf-8'));

        for (const key of REQUIRED_KEYS) {
            it(`[${code}] has key "${key}"`, () => {
                expect(locale[key], `Missing "${key}" in ${file}`).toBeDefined();
                expect(typeof locale[key]).toBe('string');
                expect(locale[key].length).toBeGreaterThan(0);
            });
        }
    }

    it('English keys are used in SettingsModal JSX', () => {
        const src = fs.readFileSync(path.resolve(__dirname, 'SettingsModal.jsx'), 'utf-8');
        for (const key of REQUIRED_KEYS) {
            expect(src, `SettingsModal should reference t('${key}')`).toContain(`'${key}'`);
        }
    });
});

// =========================================================================
// 11. Native capture toggle — UI integration checks
// =========================================================================

describe('Native capture toggle integration', () => {
    let src;
    beforeEach(() => {
        src = fs.readFileSync(path.resolve(__dirname, 'SettingsModal.jsx'), 'utf-8');
    });

    it('toggle is only rendered in Electron', () => {
        // Should be gated behind {inElectron && (...)}
        expect(src).toMatch(/inElectron\s*&&\s*\(/);
    });

    it('toggle is disabled when native addon is unavailable', () => {
        expect(src).toContain('disabled={!nativeCaptureAvailable}');
    });

    it('toggling stops any active mic test', () => {
        expect(src).toMatch(/stopMicTest.*useNativeCapture/s);
    });

    it('native capture settings (buffer/rate/latency) only show when useNative is true', () => {
        expect(src).toContain('{useNative && (');
    });

    it('checks audioCapture.isAvailable() on mount', () => {
        expect(src).toContain('audioCapture.isAvailable()');
    });

    it('enumerateAudioDevices fetches native devices when in Electron', () => {
        expect(src).toContain('audioCapture.listDevices()');
    });
});

// =========================================================================
// 12. Bridge ring buffer management
// =========================================================================

describe('Ring buffer management', () => {
    let bridgeSrc;
    beforeEach(() => {
        bridgeSrc = fs.readFileSync(
            path.resolve(__dirname, '../electron/audioCaptureBridge.js'),
            'utf-8'
        );
    });

    it('attachRingBuffer stores references to prevent GC', () => {
        expect(bridgeSrc).toContain('ringStateView = stateView');
        expect(bridgeSrc).toContain('ringDataView = dataView');
    });

    it('detachRingBuffer nulls out references', () => {
        expect(bridgeSrc).toContain('ringStateView = null');
        expect(bridgeSrc).toContain('ringDataView = null');
    });

    it('attachRingBuffer passes capacity, channels, sampleRate to addon', () => {
        expect(bridgeSrc).toContain('attachRingBuffer(stateView, dataView, capacity, channels, sampleRate)');
    });
});
