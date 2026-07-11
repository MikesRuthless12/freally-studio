import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isElectron } from './electronBridge.js';
import { ACCENT_THEMES, SOLID_ACCENT_KEYS, GRADIENT_ACCENT_KEYS } from './accentThemes.js';
import { useTranslation } from './i18n/I18nContext.jsx';
import {
    BUILTIN_SKINS, loadSkin, loadSkinByName, saveSkinChoice, getSavedSkinChoice, exportSkin,
} from './ui/SkinEngine.js';

const SETTINGS_KEY = 'freally_settings';

const DEFAULT_SETTINGS = {
    showTooltips: true,
    language: 'English',
    languageCode: 'en',
    autoSaveEnabled: true,
    autoSaveInterval: 30,       // seconds
    confirmBeforeClear: true,
    showCursorLabels: true,
    followPlayhead: true,
    vst3CustomPaths: ['', '', ''],
    // Audio
    latencyHint: 'playback',    // 'interactive' | 'balanced' | 'playback'
    sampleRate: 0,              // 0 = auto-detect system native rate (requires reload)
    audioInputDeviceId: '',     // '' = system default
    audioOutputDeviceId: '',    // '' = system default
    // Theme
    uiBrightness: 100,          // 50-150%
    gridLineIntensity: 100,     // 0-100%
    autoAssignTrackColors: true,
    clipColor: 'track',         // 'track' | 'accent'
    // Plug-Ins
    useVst3SystemFolders: true,
    multiplePluginWindows: true,
    autoHidePluginWindows: true,
    autoOpenPluginWindows: true,
    // Native Audio Capture (Electron / WASAPI)
    useNativeCapture: true,         // default ON in Electron
    captureBufferSize: 256,         // samples: 64, 128, 256, 512, 1024
    captureSampleRate: 48000,       // Hz: 44100, 48000, 88200, 96000
    // Vocal
    autoAnalyzeVocalOnRecord: false,
    recordingEchoCancellation: false,
    recordingNoiseSuppression: false,
    recordingInputMonitor: false,
    // Splash
    skipIntro: false,
};

export function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        }
    } catch (e) {
        console.warn('[Settings] Failed to load:', e);
    }
    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('[Settings] Failed to save:', e);
    }
}

// Tooltip suppression: strips/restores title attributes globally
let tooltipObserver = null;

export function applyTooltipSetting(enabled) {
    if (enabled) {
        if (tooltipObserver) { tooltipObserver.disconnect(); tooltipObserver = null; }
        document.querySelectorAll('[data-title-backup]').forEach(el => {
            el.setAttribute('title', el.getAttribute('data-title-backup'));
            el.removeAttribute('data-title-backup');
        });
    } else {
        const stripTitles = (root) => {
            root.querySelectorAll('[title]').forEach(el => {
                el.setAttribute('data-title-backup', el.getAttribute('title'));
                el.removeAttribute('title');
            });
        };
        stripTitles(document);
        tooltipObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.hasAttribute('title')) {
                            node.setAttribute('data-title-backup', node.getAttribute('title'));
                            node.removeAttribute('title');
                        }
                        stripTitles(node);
                    }
                }
                if (m.type === 'attributes' && m.attributeName === 'title' && m.target.hasAttribute('title')) {
                    m.target.setAttribute('data-title-backup', m.target.getAttribute('title'));
                    m.target.removeAttribute('title');
                }
            }
        });
        tooltipObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
    }
}

const NATIVE_RATE = window._freallyNativeSampleRate || 48000;

const SAMPLE_RATES = [
    { label: `Auto (${NATIVE_RATE.toLocaleString()} Hz)`, value: 0 },
    { label: '22,050 Hz', value: 22050 },
    { label: '44,100 Hz', value: 44100 },
    { label: '48,000 Hz', value: 48000 },
    { label: '88,200 Hz', value: 88200 },
    { label: '96,000 Hz', value: 96000 },
    { label: '192,000 Hz', value: 192000 },
];

const CAPTURE_BUFFER_SIZES = [
    { label: '64 samples', value: 64 },
    { label: '128 samples', value: 128 },
    { label: '256 samples', value: 256 },
    { label: '512 samples', value: 512 },
    { label: '1024 samples', value: 1024 },
];

const CAPTURE_SAMPLE_RATES = [
    { label: '44,100 Hz', value: 44100 },
    { label: '48,000 Hz', value: 48000 },
    { label: '88,200 Hz', value: 88200 },
    { label: '96,000 Hz', value: 96000 },
];

function getDefaultVst3Paths() {
    const platform = navigator.platform || '';
    if (platform.startsWith('Win')) {
        return ['C:\\Program Files\\Common Files\\VST3'];
    } else if (platform.startsWith('Mac')) {
        return ['/Library/Audio/Plug-Ins/VST3', '~/Library/Audio/Plug-Ins/VST3'];
    } else {
        return ['~/.vst3', '/usr/lib/vst3', '/usr/local/lib/vst3'];
    }
}

// --- Toggle Switch ---
function ToggleSwitch({ value, onChange, accentColor, isDark, disabled }) {
    return (
        <div
            onClick={disabled ? undefined : onChange}
            style={{
                width: '36px', height: '18px', borderRadius: '9px',
                background: value ? accentColor : (isDark ? '#444' : '#ccc'),
                position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s', flexShrink: 0,
                opacity: disabled ? 0.4 : 1,
            }}
        >
            <div style={{
                width: '14px', height: '14px', borderRadius: '50%',
                background: '#fff', position: 'absolute', top: '2px',
                left: value ? '20px' : '2px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
        </div>
    );
}

// --- Sub-section divider ---
function SubSectionTitle({ children, isDark }) {
    return (
        <div style={{
            fontSize: '10px', fontWeight: 700, color: isDark ? '#666' : '#999',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            margin: '16px 0 8px', paddingBottom: '6px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            display: 'flex', alignItems: 'center', gap: '6px',
        }}>
            <span style={{ flex: 1 }}>{children}</span>
            <span style={{
                flex: '1 1 0', height: '1px',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            }} />
        </div>
    );
}

export function SettingsModal({
    isOpen, onClose, onSave, isDark, accentColor,
    theme, accentTheme, onThemeToggle, onAccentChange,
}) {
    const { t, language, setLanguage, sortedLanguages, getLanguageName } = useTranslation();

    // Section definitions — translated
    const SECTIONS = [
        { key: 'general', labelKey: 'settings.general' },
        { key: 'audio', labelKey: 'settings.audio' },
        { key: 'theme', labelKey: 'settings.themeColors' },
        { key: 'autosave', labelKey: 'settings.autoSave' },
        { key: 'vocal', labelKey: 'settings.vocal' },
        { key: 'safety', labelKey: 'settings.safety' },
        { key: 'plugins', labelKey: 'settings.plugins' },
    ];

    // Auto-save interval options — translated
    const AUTO_SAVE_INTERVALS = [
        { labelKey: 'settings.interval15s', value: 15 },
        { labelKey: 'settings.interval30s', value: 30 },
        { labelKey: 'settings.interval1m', value: 60 },
        { labelKey: 'settings.interval2m', value: 120 },
        { labelKey: 'settings.interval5m', value: 300 },
    ];

    // Latency mode options — translated
    const LATENCY_MODES = [
        { labelKey: 'settings.interactive', value: 'interactive' },
        { labelKey: 'settings.balanced', value: 'balanced' },
        { labelKey: 'settings.playback', value: 'playback' },
    ];

    const [draft, setDraft] = useState(() => loadSettings());
    const [vst3Paths, setVst3Paths] = useState(['', '', '']);
    const [vst3ScanStatus, setVst3ScanStatus] = useState('');
    const [activeSection, setActiveSection] = useState('general');
    const [hoveredSection, setHoveredSection] = useState(null);
    const [testToneActive, setTestToneActive] = useState(false);
    const [hoveredAccent, setHoveredAccent] = useState(null);
    // UI skin (TASK-C03)
    const [activeSkin, setActiveSkin] = useState(() => getSavedSkinChoice().name);
    const skinFileRef = useRef(null);
    const [audioInputDevices, setAudioInputDevices] = useState([]);
    const [audioOutputDevices, setAudioOutputDevices] = useState([]);
    const [nativeInputDevices, setNativeInputDevices] = useState([]);
    const [nativeCaptureAvailable, setNativeCaptureAvailable] = useState(false);
    const [micTestActive, setMicTestActive] = useState(false);
    const [micLevel, setMicLevel] = useState(0);
    const micTestRef = useRef(null); // { stream, ctx, analyser, animId } or { nativePolling }
    const modalRef = useRef(null);
    const testToneRef = useRef(null);
    const handleCloseRef = useRef(null);
    const inElectron = isElectron();

    // Check native audio capture availability
    useEffect(() => {
        if (inElectron && window.electronAPI?.audioCapture) {
            window.electronAPI.audioCapture.isAvailable().then(avail => {
                setNativeCaptureAvailable(avail);
            }).catch(() => setNativeCaptureAvailable(false));
        }
    }, [inElectron]);

    // Enumerate audio devices (browser + native)
    const enumerateAudioDevices = useCallback(async () => {
        try {
            // Browser devices (always enumerate for output + fallback input)
            await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
            const devices = await navigator.mediaDevices.enumerateDevices();
            setAudioInputDevices(devices.filter(d => d.kind === 'audioinput'));
            setAudioOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
        } catch (e) {
            console.warn('[Settings] Failed to enumerate browser audio devices:', e);
        }
        // Native WASAPI devices
        if (inElectron && window.electronAPI?.audioCapture) {
            try {
                const result = await window.electronAPI.audioCapture.listDevices();
                if (result.devices && result.devices.length > 0) {
                    setNativeInputDevices(result.devices);
                }
            } catch (e) {
                console.warn('[Settings] Failed to enumerate native audio devices:', e);
            }
        }
    }, [inElectron]);

    // Reset draft when modal opens
    useEffect(() => {
        if (isOpen) {
            setDraft(loadSettings());
            setVst3ScanStatus('');
            setActiveSection('general');
            enumerateAudioDevices();
            if (inElectron && window.electronAPI?.vst3) {
                window.electronAPI.vst3.getCustomPaths().then(paths => {
                    const p = Array.isArray(paths) ? paths : ['', '', ''];
                    setVst3Paths([p[0] || '', p[1] || '', p[2] || '']);
                }).catch(() => {});
            }
        } else {
            // Stop test tone and mic test when modal closes
            stopTestTone();
            stopMicTest();
        }
    }, [isOpen, inElectron, enumerateAudioDevices]);

    // Device hot-plug: re-enumerate when USB mic plugged/unplugged
    useEffect(() => {
        if (!isOpen) return;
        const handleDeviceChange = () => enumerateAudioDevices();
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    }, [isOpen, enumerateAudioDevices]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => { if (e.key === 'Escape' && handleCloseRef.current) handleCloseRef.current(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Cleanup test tone and mic test on unmount
    useEffect(() => {
        return () => { stopTestTone(); stopMicTest(); };
    }, []);

    // Auto-save settings to localStorage on every draft change
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const settingsToSave = { ...draft, languageCode: language, vst3CustomPaths: vst3Paths };
        saveSettings(settingsToSave);
        applyTooltipSetting(draft.showTooltips);
        if (onSave) onSave(settingsToSave);
    }, [draft]);

    function startTestTone() {
        if (testToneRef.current) return;
        try {
            const ctx = window.sharedAnalysisCtx || new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 440;
            gain.gain.value = 0.05; // -26 dB, safe default
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            testToneRef.current = { osc, gain, ctx };
            setTestToneActive(true);
        } catch (e) {
            console.warn('[Settings] Test tone error:', e);
        }
    }

    function stopTestTone() {
        if (testToneRef.current) {
            try {
                testToneRef.current.osc.stop();
                testToneRef.current.osc.disconnect();
                testToneRef.current.gain.disconnect();
            } catch (e) { /* ignore */ }
            testToneRef.current = null;
        }
        setTestToneActive(false);
    }

    async function startMicTest() {
        if (micTestRef.current) return;

        const useNative = draft.useNativeCapture && nativeCaptureAvailable && inElectron;

        if (useNative) {
            // Native WASAPI VU meter — start capture then poll getLevel()
            try {
                const api = window.electronAPI.audioCapture;
                const result = await api.start(
                    draft.audioInputDeviceId || '',
                    draft.captureSampleRate || 48000,
                    1
                );
                if (result.error) {
                    console.warn('[Settings] Native mic test start error:', result.error);
                    return;
                }
                const pollId = setInterval(async () => {
                    try {
                        const level = await api.getLevel();
                        setMicLevel(Math.min(100, (level || 0) * 400));
                    } catch (_) {}
                }, 50);
                micTestRef.current = { nativePolling: pollId };
                setMicTestActive(true);
            } catch (e) {
                console.warn('[Settings] Native mic test error:', e);
            }
        } else {
            // Browser MediaDevices VU meter
            try {
                const deviceId = draft.audioInputDeviceId || undefined;
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: !!draft.recordingEchoCancellation,
                        noiseSuppression: !!draft.recordingNoiseSuppression,
                        ...(deviceId && { deviceId: { exact: deviceId } })
                    }
                });
                const Ctx = window.AudioContext || window.webkitAudioContext;
                const ctx = new Ctx();
                if (ctx.state === 'suspended') await ctx.resume();

                if (draft.audioOutputDeviceId && ctx.setSinkId) {
                    try { await ctx.setSinkId(draft.audioOutputDeviceId); } catch (_) {}
                }

                const source = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                const dataArray = new Float32Array(analyser.fftSize);

                const monitorGain = ctx.createGain();
                monitorGain.gain.value = draft.recordingInputMonitor ? 0.8 : 0;
                source.connect(monitorGain);
                monitorGain.connect(ctx.destination);

                const tick = () => {
                    analyser.getFloatTimeDomainData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
                    const rms = Math.sqrt(sum / dataArray.length);
                    setMicLevel(Math.min(100, rms * 400));
                    if (micTestRef.current) micTestRef.current.animId = requestAnimationFrame(tick);
                };
                micTestRef.current = { stream, ctx, source, analyser, monitorGain, animId: requestAnimationFrame(tick) };
                setMicTestActive(true);
            } catch (e) {
                console.warn('[Settings] Mic test error:', e);
            }
        }
    }

    function stopMicTest() {
        if (micTestRef.current) {
            if (micTestRef.current.nativePolling) {
                // Native capture VU — stop polling and stop capture
                clearInterval(micTestRef.current.nativePolling);
                if (window.electronAPI?.audioCapture) {
                    window.electronAPI.audioCapture.stop().catch(() => {});
                }
            } else {
                // Browser VU — clean up Web Audio nodes
                cancelAnimationFrame(micTestRef.current.animId);
                micTestRef.current.stream.getTracks().forEach(t => t.stop());
                micTestRef.current.source.disconnect();
                if (micTestRef.current.monitorGain) {
                    try { micTestRef.current.monitorGain.disconnect(); } catch (_) {}
                }
                try { micTestRef.current.ctx.close(); } catch (_) {}
            }
            micTestRef.current = null;
        }
        setMicTestActive(false);
        setMicLevel(0);
    }

    if (!isOpen) return null;

    const ac = accentColor || '#39ff14';

    const handleBrowseVst3 = async (slotIndex) => {
        if (!inElectron || !window.electronAPI?.vst3) return;
        const folderPath = await window.electronAPI.vst3.browseForFolder();
        if (folderPath) {
            setVst3Paths(prev => {
                const next = [...prev];
                next[slotIndex] = folderPath;
                return next;
            });
        }
    };

    const handleClearVst3 = (slotIndex) => {
        setVst3Paths(prev => {
            const next = [...prev];
            next[slotIndex] = '';
            return next;
        });
    };

    const handleScanNow = async () => {
        if (!inElectron || !window.electronAPI?.vst3) return;
        setVst3ScanStatus('scanning');
        try {
            await window.electronAPI.vst3.setCustomPaths(vst3Paths);
            await window.electronAPI.vst3.scan(true);
            setVst3ScanStatus('done');
        } catch {
            setVst3ScanStatus('done');
        }
    };

    const handleClose = () => {
        // Final save (captures VST3 paths + language which may not trigger draft changes)
        if (inElectron && window.electronAPI?.vst3) {
            window.electronAPI.vst3.setCustomPaths(vst3Paths);
        }
        const settingsToSave = { ...draft, languageCode: language, vst3CustomPaths: vst3Paths };
        saveSettings(settingsToSave);
        applyTooltipSetting(draft.showTooltips);
        if (onSave) onSave(settingsToSave);
        stopTestTone();
        onClose();
    };
    handleCloseRef.current = handleClose;

    const update = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

    // Get live audio context info
    const audioCtx = window.sharedAnalysisCtx;
    const sampleRate = audioCtx?.sampleRate || 44100;
    const baseLatency = audioCtx?.baseLatency ? Math.round(audioCtx.baseLatency * 1000 * 10) / 10 : null;
    const outputLatency = audioCtx?.outputLatency ? Math.round(audioCtx.outputLatency * 1000 * 10) / 10 : null;
    const overallLatency = (baseLatency || 0) + (outputLatency || 0);
    const channelCount = audioCtx?.destination?.maxChannelCount || 2;

    // --- Shared styles ---
    const rowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    };
    const lastRowStyle = { ...rowStyle, borderBottom: 'none' };

    const descStyle = {
        fontSize: '9px',
        color: isDark ? '#666' : '#999',
        marginTop: '2px',
    };

    const checkboxStyle = {
        width: '16px', height: '16px',
        accentColor: ac, cursor: 'pointer',
    };

    const selectStyle = {
        padding: '6px 10px',
        background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
        color: isDark ? '#ddd' : '#333',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#ccc'}`,
        borderRadius: '6px', fontSize: '12px',
        cursor: 'pointer', outline: 'none', minWidth: '130px',
    };

    // Option elements need explicit dark text + white bg so they're visible in OS dropdowns
    const optionStyle = {
        background: '#fff',
        color: '#222',
    };

    const sectionTitleStyle = {
        fontSize: '11px', fontWeight: 700,
        color: isDark ? '#888' : '#777',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        marginBottom: '4px', paddingBottom: '8px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    };

    const readonlyValueStyle = {
        fontSize: '12px', fontWeight: 600,
        color: ac, fontFamily: 'monospace',
        padding: '4px 10px',
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        borderRadius: '4px',
    };

    const rangeStyle = {
        width: '120px', accentColor: ac, cursor: 'pointer',
    };

    const labelStyle = { fontSize: '12px', color: isDark ? '#ddd' : '#333' };

    // ===== SECTION RENDERERS =====

    const renderGeneral = () => (
        <div>
            <div style={sectionTitleStyle}>{t('settings.general')}</div>
            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.language')}</div>
                    <div style={descStyle}>{t('settings.languageDesc')}</div>
                </div>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={selectStyle}
                >
                    {sortedLanguages.map(lang => (
                        <option key={lang.code} value={lang.code} style={optionStyle}>
                            {lang.name}
                        </option>
                    ))}
                </select>
            </div>
            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.showTooltips')}</div>
                    <div style={descStyle}>{t('settings.showTooltipsDesc')}</div>
                </div>
                <input type="checkbox" checked={draft.showTooltips} onChange={(e) => update('showTooltips', e.target.checked)} style={checkboxStyle} />
            </div>
            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.showCursorLabels')}</div>
                    <div style={descStyle}>{t('settings.showCursorLabelsDesc')}</div>
                </div>
                <input type="checkbox" checked={draft.showCursorLabels} onChange={(e) => update('showCursorLabels', e.target.checked)} style={checkboxStyle} />
            </div>
            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.followPlayhead')}</div>
                    <div style={descStyle}>{t('settings.followPlayheadDesc')}</div>
                </div>
                <input type="checkbox" checked={draft.followPlayhead} onChange={(e) => update('followPlayhead', e.target.checked)} style={checkboxStyle} />
            </div>
            <div style={lastRowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.skipIntro')}</div>
                    <div style={descStyle}>{t('settings.skipIntroDesc')}</div>
                </div>
                <input type="checkbox" checked={draft.skipIntro} onChange={(e) => update('skipIntro', e.target.checked)} style={checkboxStyle} />
            </div>
        </div>
    );

    const renderAudio = () => {
        const latencyColor = overallLatency < 20 ? '#4ade80' : overallLatency < 50 ? '#facc15' : '#ef4444';
        const latencyBarWidth = Math.min(100, (overallLatency / 100) * 100);

        const useNative = draft.useNativeCapture && nativeCaptureAvailable && inElectron;
        // Derive input device list based on capture mode
        const inputDeviceList = useNative ? nativeInputDevices : audioInputDevices;
        // Compute capture latency from buffer size and sample rate
        const captureLatencyMs = draft.captureBufferSize && draft.captureSampleRate
            ? Math.round((draft.captureBufferSize / draft.captureSampleRate) * 1000 * 100) / 100
            : null;

        return (
            <div>
                <div style={sectionTitleStyle}>{t('settings.audio')}</div>

                <SubSectionTitle isDark={isDark}>{t('settings.devices')}</SubSectionTitle>

                {/* Native Audio Capture toggle — only visible in Electron */}
                {inElectron && (
                    <div style={rowStyle}>
                        <div>
                            <div style={labelStyle}>{t('settings.useNativeCapture')}</div>
                            <div style={descStyle}>{t('settings.useNativeCaptureDesc')}</div>
                        </div>
                        <ToggleSwitch
                            value={draft.useNativeCapture}
                            onChange={() => {
                                // Stop any active mic test when toggling
                                if (micTestActive) stopMicTest();
                                update('useNativeCapture', !draft.useNativeCapture);
                            }}
                            accentColor={ac}
                            isDark={isDark}
                            disabled={!nativeCaptureAvailable}
                        />
                    </div>
                )}

                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>{t('settings.inputDevice')}</div>
                        <div style={descStyle}>{t('settings.inputDeviceDesc')}</div>
                    </div>
                    <select
                        value={draft.audioInputDeviceId}
                        onChange={(e) => update('audioInputDeviceId', e.target.value)}
                        style={{ ...selectStyle, maxWidth: '220px' }}
                    >
                        <option value="" style={optionStyle}>{t('settings.systemDefault')}</option>
                        {useNative
                            ? inputDeviceList.map((d, i) => (
                                <option key={d.id || i} value={d.id || ''} style={optionStyle}>
                                    {d.name || `${t('settings.microphone')} ${i + 1}`}
                                </option>
                            ))
                            : inputDeviceList.map(d => (
                                <option key={d.deviceId} value={d.deviceId} style={optionStyle}>
                                    {d.label || `${t('settings.microphone')} (${d.deviceId.slice(0, 8)}...)`}
                                </option>
                            ))
                        }
                    </select>
                </div>

                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>{t('settings.testMic')}</div>
                        <div style={descStyle}>{t('settings.testMicDesc')}</div>
                        {micTestActive && (
                            <div style={{
                                marginTop: '6px', width: '180px', height: '8px',
                                borderRadius: '4px', background: isDark ? '#222' : '#ddd',
                                overflow: 'hidden', position: 'relative',
                            }}>
                                <div style={{
                                    width: `${micLevel}%`, height: '100%',
                                    borderRadius: '4px',
                                    background: micLevel > 80 ? '#ef4444' : micLevel > 50 ? '#facc15' : '#4ade80',
                                    transition: 'width 0.05s, background 0.15s',
                                }} />
                            </div>
                        )}
                    </div>
                    <ToggleSwitch
                        value={micTestActive}
                        onChange={() => micTestActive ? stopMicTest() : startMicTest()}
                        accentColor={ac}
                        isDark={isDark}
                    />
                </div>

                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>{t('settings.outputDevice')}</div>
                        <div style={descStyle}>{t('settings.outputDeviceDesc')}</div>
                    </div>
                    <select
                        value={draft.audioOutputDeviceId}
                        onChange={(e) => update('audioOutputDeviceId', e.target.value)}
                        style={{ ...selectStyle, maxWidth: '220px' }}
                    >
                        <option value="" style={optionStyle}>{t('settings.systemDefault')}</option>
                        {audioOutputDevices.map(d => (
                            <option key={d.deviceId} value={d.deviceId} style={optionStyle}>
                                {d.label || `${t('settings.speaker')} (${d.deviceId.slice(0, 8)}...)`}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Native capture settings — buffer size, sample rate, latency */}
                {useNative && (
                    <>
                        <div style={rowStyle}>
                            <div>
                                <div style={labelStyle}>{t('settings.captureBufferSize')}</div>
                                <div style={descStyle}>{t('settings.captureBufferSizeDesc')}</div>
                            </div>
                            <select
                                value={draft.captureBufferSize}
                                onChange={(e) => update('captureBufferSize', Number(e.target.value))}
                                style={selectStyle}
                            >
                                {CAPTURE_BUFFER_SIZES.map(b => (
                                    <option key={b.value} value={b.value} style={optionStyle}>{b.label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={rowStyle}>
                            <div>
                                <div style={labelStyle}>{t('settings.captureSampleRate')}</div>
                                <div style={descStyle}>{t('settings.captureSampleRateDesc')}</div>
                            </div>
                            <select
                                value={draft.captureSampleRate}
                                onChange={(e) => update('captureSampleRate', Number(e.target.value))}
                                style={selectStyle}
                            >
                                {CAPTURE_SAMPLE_RATES.map(sr => (
                                    <option key={sr.value} value={sr.value} style={optionStyle}>{sr.label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={rowStyle}>
                            <div style={labelStyle}>{t('settings.captureLatency')}</div>
                            <span style={readonlyValueStyle}>
                                {captureLatencyMs !== null ? `${captureLatencyMs} ms` : '--'}
                            </span>
                        </div>
                    </>
                )}

                <SubSectionTitle isDark={isDark}>{t('settings.audioEngine')}</SubSectionTitle>

                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>{t('settings.latencyMode')}</div>
                        <div style={descStyle}>{t('settings.latencyModeDesc')}</div>
                    </div>
                    <select value={draft.latencyHint} onChange={(e) => update('latencyHint', e.target.value)} style={selectStyle}>
                        {LATENCY_MODES.map(m => <option key={m.value} value={m.value} style={optionStyle}>{t(m.labelKey)}</option>)}
                    </select>
                </div>

                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>{t('settings.sampleRate')}</div>
                        <div style={descStyle}>{t('settings.sampleRateDesc')}</div>
                    </div>
                    <select value={draft.sampleRate} onChange={(e) => update('sampleRate', Number(e.target.value))} style={selectStyle}>
                        {SAMPLE_RATES.map(sr => <option key={sr.value} value={sr.value} style={optionStyle}>{sr.label}</option>)}
                    </select>
                </div>

                <div style={rowStyle}>
                    <div style={labelStyle}>{t('settings.outputChannels')}</div>
                    <span style={readonlyValueStyle}>{channelCount}ch</span>
                </div>

                <SubSectionTitle isDark={isDark}>{t('settings.latency')}</SubSectionTitle>

                <div style={rowStyle}>
                    <div style={labelStyle}>{t('settings.baseLatency')}</div>
                    <span style={readonlyValueStyle}>{baseLatency !== null ? `${baseLatency} ms` : '--'}</span>
                </div>

                <div style={rowStyle}>
                    <div style={labelStyle}>{t('settings.outputLatency')}</div>
                    <span style={readonlyValueStyle}>{outputLatency !== null ? `${outputLatency} ms` : '--'}</span>
                </div>

                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>{t('settings.overallLatency')}</div>
                        {/* Visual latency bar */}
                        <div style={{
                            width: '100px', height: '4px', borderRadius: '2px',
                            background: isDark ? '#333' : '#ddd', marginTop: '6px', overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${latencyBarWidth}%`, height: '100%',
                                background: latencyColor, borderRadius: '2px',
                                transition: 'width 0.3s',
                            }} />
                        </div>
                    </div>
                    <span style={{ ...readonlyValueStyle, color: latencyColor }}>
                        {overallLatency > 0 ? `${Math.round(overallLatency * 10) / 10} ms` : '--'}
                    </span>
                </div>

                <SubSectionTitle isDark={isDark}>{t('settings.test')}</SubSectionTitle>

                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>{t('settings.testTone')}</div>
                        <div style={descStyle}>{t('settings.testToneDesc')}</div>
                    </div>
                    <ToggleSwitch
                        value={testToneActive}
                        onChange={() => testToneActive ? stopTestTone() : startTestTone()}
                        accentColor={ac}
                        isDark={isDark}
                    />
                </div>
            </div>
        );
    };

    const renderTheme = () => (
        <div>
            <div style={sectionTitleStyle}>{t('settings.themeColors')}</div>

            <SubSectionTitle isDark={isDark}>{t('settings.appearance')}</SubSectionTitle>

            <div style={rowStyle}>
                <div style={labelStyle}>{t('settings.theme')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: isDark ? '#888' : '#666' }}>
                        {theme === 'dark' ? t('settings.dark') : t('settings.light')}
                    </span>
                    <ToggleSwitch
                        value={theme === 'dark'}
                        onChange={() => { if (onThemeToggle) onThemeToggle(); }}
                        accentColor={ac}
                        isDark={isDark}
                    />
                </div>
            </div>

            {/* Accent Color Picker */}
            <div style={{ padding: '10px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                <div style={labelStyle}>{t('settings.accentColor')}</div>
                <div style={descStyle}>{t('settings.accentColorDesc')}</div>

                {/* Solid colors */}
                <div style={{ marginTop: '10px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '9px', color: isDark ? '#555' : '#aaa', marginBottom: '6px' }}>{t('settings.solid')}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {SOLID_ACCENT_KEYS.map(key => {
                            const thm = ACCENT_THEMES[key];
                            const isActive = accentTheme === key;
                            const isHov = hoveredAccent === key;
                            return (
                                <div
                                    key={key}
                                    onClick={() => { if (onAccentChange) onAccentChange(key); }}
                                    onMouseEnter={() => setHoveredAccent(key)}
                                    onMouseLeave={() => setHoveredAccent(null)}
                                    title={thm.name}
                                    style={{
                                        width: '26px', height: '26px', borderRadius: '50%',
                                        background: thm.accent, cursor: 'pointer',
                                        border: isActive ? '2px solid #fff' : '2px solid transparent',
                                        boxShadow: isActive ? `0 0 8px ${thm.accent}` : isHov ? `0 0 6px ${thm.accent}80` : 'none',
                                        transition: 'all 0.15s',
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Gradient colors */}
                <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '9px', color: isDark ? '#555' : '#aaa', marginBottom: '6px' }}>{t('settings.gradient')}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {GRADIENT_ACCENT_KEYS.map(key => {
                            const thm = ACCENT_THEMES[key];
                            const isActive = accentTheme === key;
                            const isHov = hoveredAccent === key;
                            return (
                                <div
                                    key={key}
                                    onClick={() => { if (onAccentChange) onAccentChange(key); }}
                                    onMouseEnter={() => setHoveredAccent(key)}
                                    onMouseLeave={() => setHoveredAccent(null)}
                                    title={thm.name}
                                    style={{
                                        width: '26px', height: '26px', borderRadius: '50%',
                                        background: thm.gradient, cursor: 'pointer',
                                        border: isActive ? '2px solid #fff' : '2px solid transparent',
                                        boxShadow: isActive ? `0 0 8px ${thm.accent}` : isHov ? `0 0 6px ${thm.accent}80` : 'none',
                                        transition: 'all 0.15s',
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* UI Skin picker (TASK-C03) — live preview, persisted in freally_settings */}
            <div style={{ padding: '10px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                <div style={labelStyle}>UI Skin</div>
                <div style={descStyle}>Complete token themes, Ableton-style. Applies live.</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {Object.entries(BUILTIN_SKINS).map(([id, skin]) => {
                        const tk = skin.tokens;
                        const isActive = activeSkin === id;
                        return (
                            <div
                                key={id}
                                onClick={() => {
                                    try {
                                        loadSkinByName(id);
                                        saveSkinChoice(id);
                                        setActiveSkin(id);
                                    } catch (e) { alert(e.message); }
                                }}
                                title={skin.name}
                                style={{
                                    cursor: 'pointer', borderRadius: '6px', padding: '4px',
                                    border: isActive ? `2px solid ${ac}` : '2px solid transparent',
                                }}
                            >
                                {/* live preview swatches: surfaces + text + accent */}
                                <div style={{ display: 'flex', width: '84px', height: '28px', borderRadius: '4px', overflow: 'hidden', border: `1px solid ${tk['--border-hairline']}` }}>
                                    <div style={{ flex: 1, background: tk['--surface-0'] }} />
                                    <div style={{ flex: 1, background: tk['--surface-2'] }} />
                                    <div style={{ flex: 1, background: tk['--text-1'] }} />
                                    <div style={{ flex: 1, background: tk['--accent'] }} />
                                </div>
                                <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '3px', color: isDark ? '#999' : '#666' }}>
                                    {skin.name}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                        onClick={() => skinFileRef.current?.click()}
                        style={{ fontSize: '10px', padding: '3px 10px', cursor: 'pointer' }}
                    >
                        Import skin (.json)
                    </button>
                    <button
                        onClick={() => {
                            const choice = getSavedSkinChoice();
                            const skin = choice.name === 'custom' ? choice.custom : BUILTIN_SKINS[choice.name];
                            const blob = new Blob([exportSkin(skin)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${(skin.name || 'skin').replace(/\s+/g, '-').toLowerCase()}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        style={{ fontSize: '10px', padding: '3px 10px', cursor: 'pointer' }}
                    >
                        Export skin
                    </button>
                    {activeSkin === 'custom' && (
                        <span style={{ fontSize: '10px', color: isDark ? '#888' : '#666', alignSelf: 'center' }}>
                            custom skin active
                        </span>
                    )}
                    <input
                        ref={skinFileRef}
                        type="file"
                        accept=".json,application/json"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            try {
                                const skin = JSON.parse(await file.text());
                                loadSkin(skin); // throws with useful errors on a bad skin
                                saveSkinChoice(skin);
                                setActiveSkin('custom');
                            } catch (err) {
                                alert(`Could not import skin: ${err.message}`);
                            }
                        }}
                    />
                </div>
            </div>

            <SubSectionTitle isDark={isDark}>{t('settings.customization')}</SubSectionTitle>

            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.uiBrightness')}</div>
                    <div style={descStyle}>{t('settings.uiBrightnessDesc')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="range" min="50" max="150" step="5"
                        value={draft.uiBrightness}
                        onChange={(e) => update('uiBrightness', Number(e.target.value))}
                        style={rangeStyle}
                    />
                    <span style={{ fontSize: '10px', color: isDark ? '#888' : '#666', minWidth: '36px', textAlign: 'right' }}>
                        {draft.uiBrightness}%
                    </span>
                </div>
            </div>

            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.gridLineIntensity')}</div>
                    <div style={descStyle}>{t('settings.gridLineIntensityDesc')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="range" min="0" max="100" step="5"
                        value={draft.gridLineIntensity}
                        onChange={(e) => update('gridLineIntensity', Number(e.target.value))}
                        style={rangeStyle}
                    />
                    <span style={{ fontSize: '10px', color: isDark ? '#888' : '#666', minWidth: '36px', textAlign: 'right' }}>
                        {draft.gridLineIntensity}%
                    </span>
                </div>
            </div>

            <SubSectionTitle isDark={isDark}>{t('settings.trackClipColors')}</SubSectionTitle>

            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.autoAssignTrackColors')}</div>
                    <div style={descStyle}>{t('settings.autoAssignTrackColorsDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.autoAssignTrackColors}
                    onChange={() => update('autoAssignTrackColors', !draft.autoAssignTrackColors)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>

            <div style={lastRowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.clipColor')}</div>
                    <div style={descStyle}>{t('settings.clipColorDesc')}</div>
                </div>
                <select value={draft.clipColor} onChange={(e) => update('clipColor', e.target.value)} style={selectStyle}>
                    <option value="track" style={optionStyle}>{t('settings.trackColor')}</option>
                    <option value="accent" style={optionStyle}>{t('settings.accentColorOption')}</option>
                </select>
            </div>
        </div>
    );

    const renderAutoSave = () => (
        <div>
            <div style={sectionTitleStyle}>{t('settings.autoSave')}</div>
            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.enableAutoSave')}</div>
                    <div style={descStyle}>{t('settings.enableAutoSaveDesc')}</div>
                </div>
                <input type="checkbox" checked={draft.autoSaveEnabled} onChange={(e) => update('autoSaveEnabled', e.target.checked)} style={checkboxStyle} />
            </div>
            <div style={{ ...lastRowStyle, opacity: draft.autoSaveEnabled ? 1 : 0.4, pointerEvents: draft.autoSaveEnabled ? 'auto' : 'none' }}>
                <div>
                    <div style={labelStyle}>{t('settings.saveInterval')}</div>
                    <div style={descStyle}>{t('settings.saveIntervalDesc')}</div>
                </div>
                <select value={draft.autoSaveInterval} onChange={(e) => update('autoSaveInterval', Number(e.target.value))} style={selectStyle} disabled={!draft.autoSaveEnabled}>
                    {AUTO_SAVE_INTERVALS.map(opt => <option key={opt.value} value={opt.value} style={optionStyle}>{t(opt.labelKey)}</option>)}
                </select>
            </div>
        </div>
    );

    const renderVocal = () => (
        <div>
            <div style={sectionTitleStyle}>{t('settings.vocal')}</div>

            <SubSectionTitle isDark={isDark}>{t('settings.recording')}</SubSectionTitle>

            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.autoAnalyzeVocal')}</div>
                    <div style={descStyle}>{t('settings.autoAnalyzeVocalDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.autoAnalyzeVocalOnRecord}
                    onChange={() => update('autoAnalyzeVocalOnRecord', !draft.autoAnalyzeVocalOnRecord)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>
            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.echoCancellation')}</div>
                    <div style={descStyle}>{t('settings.echoCancellationDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.recordingEchoCancellation}
                    onChange={() => update('recordingEchoCancellation', !draft.recordingEchoCancellation)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>
            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.noiseSuppression')}</div>
                    <div style={descStyle}>{t('settings.noiseSuppressionDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.recordingNoiseSuppression}
                    onChange={() => update('recordingNoiseSuppression', !draft.recordingNoiseSuppression)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>
            <div style={lastRowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.inputMonitor')}</div>
                    <div style={descStyle}>{t('settings.inputMonitorDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.recordingInputMonitor}
                    onChange={() => update('recordingInputMonitor', !draft.recordingInputMonitor)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>
        </div>
    );

    const renderSafety = () => (
        <div>
            <div style={sectionTitleStyle}>{t('settings.safety')}</div>
            <div style={lastRowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.confirmBeforeClear')}</div>
                    <div style={descStyle}>{t('settings.confirmBeforeClearDesc')}</div>
                </div>
                <input type="checkbox" checked={draft.confirmBeforeClear} onChange={(e) => update('confirmBeforeClear', e.target.checked)} style={checkboxStyle} />
            </div>
        </div>
    );

    const renderPlugins = () => (
        <div>
            <div style={sectionTitleStyle}>{t('settings.plugins')}</div>

            <SubSectionTitle isDark={isDark}>{t('settings.pluginSources')}</SubSectionTitle>

            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.useVst3SystemFolders')}</div>
                    <div style={descStyle}>{t('settings.useVst3SystemFoldersDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.useVst3SystemFolders}
                    onChange={() => update('useVst3SystemFolders', !draft.useVst3SystemFolders)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>

            {/* Rescan button */}
            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.rescanPlugins')}</div>
                    <div style={descStyle}>{inElectron ? t('settings.rescanPluginsDesc') : t('settings.desktopAppOnly')}</div>
                </div>
                <button
                    onClick={inElectron ? handleScanNow : undefined}
                    disabled={!inElectron || vst3ScanStatus === 'scanning'}
                    style={{
                        padding: '5px 14px', fontSize: '10px', fontWeight: 'bold',
                        background: (!inElectron || vst3ScanStatus === 'scanning')
                            ? (isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5')
                            : ac,
                        color: (!inElectron || vst3ScanStatus === 'scanning')
                            ? (isDark ? '#555' : '#aaa') : '#000',
                        border: 'none', borderRadius: '6px',
                        cursor: (!inElectron || vst3ScanStatus === 'scanning') ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    {vst3ScanStatus === 'scanning' ? t('settings.scanning') : t('settings.rescan')}
                </button>
            </div>

            {vst3ScanStatus === 'done' && (
                <div style={{ fontSize: '9px', color: '#4ade80', padding: '0 0 6px' }}>{t('settings.scanComplete')}</div>
            )}

            {/* Custom VST3 paths */}
            <div style={{ padding: '6px 0 10px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                <div style={{ fontSize: '10px', color: isDark ? '#888' : '#777', marginBottom: '6px' }}>
                    {t('settings.customVst3Folders')}
                </div>
                {[0, 1, 2].map(idx => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                        <div style={{
                            flex: 1, fontSize: '10px', fontFamily: 'monospace',
                            color: !inElectron ? (isDark ? '#444' : '#bbb') : vst3Paths[idx] ? (isDark ? '#ccc' : '#333') : (isDark ? '#555' : '#aaa'),
                            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                            padding: '5px 8px', borderRadius: '4px',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: '22px',
                        }}>
                            {!inElectron ? t('settings.desktopAppOnly') : (vst3Paths[idx] || t('settings.notSet'))}
                        </div>
                        {inElectron && (
                            <>
                                <button
                                    onClick={() => handleBrowseVst3(idx)}
                                    style={{
                                        padding: '4px 8px', fontSize: '9px', fontWeight: 'bold',
                                        background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
                                        color: isDark ? '#ccc' : '#555',
                                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}`,
                                        borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}
                                >
                                    {t('common.browse')}
                                </button>
                                {vst3Paths[idx] && (
                                    <button
                                        onClick={() => handleClearVst3(idx)}
                                        style={{
                                            padding: '4px 6px', fontSize: '9px',
                                            background: 'transparent', color: isDark ? '#666' : '#999',
                                            border: 'none', cursor: 'pointer',
                                        }}
                                    >
                                        &#10005;
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>

            <SubSectionTitle isDark={isDark}>{t('settings.pluginWindows')}</SubSectionTitle>

            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.multiplePluginWindows')}</div>
                    <div style={descStyle}>{t('settings.multiplePluginWindowsDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.multiplePluginWindows}
                    onChange={() => update('multiplePluginWindows', !draft.multiplePluginWindows)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>

            <div style={rowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.autoHidePluginWindows')}</div>
                    <div style={descStyle}>{t('settings.autoHidePluginWindowsDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.autoHidePluginWindows}
                    onChange={() => update('autoHidePluginWindows', !draft.autoHidePluginWindows)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>

            <div style={lastRowStyle}>
                <div>
                    <div style={labelStyle}>{t('settings.autoOpenPluginWindows')}</div>
                    <div style={descStyle}>{t('settings.autoOpenPluginWindowsDesc')}</div>
                </div>
                <ToggleSwitch
                    value={draft.autoOpenPluginWindows}
                    onChange={() => update('autoOpenPluginWindows', !draft.autoOpenPluginWindows)}
                    accentColor={ac}
                    isDark={isDark}
                />
            </div>
        </div>
    );

    const sectionRenderers = {
        general: renderGeneral,
        audio: renderAudio,
        theme: renderTheme,
        autosave: renderAutoSave,
        vocal: renderVocal,
        safety: renderSafety,
        plugins: renderPlugins,
    };

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                zIndex: 10000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            <div
                ref={modalRef}
                style={{
                    width: '620px',
                    background: isDark ? 'rgba(22, 22, 28, 0.98)' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}`,
                    borderRadius: '14px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px 14px',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#eee'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>&#9881;</span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: isDark ? '#fff' : '#222', letterSpacing: '0.5px' }}>
                            {t('settings.title')}
                        </span>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none', border: 'none',
                            color: isDark ? '#666' : '#999', fontSize: '18px',
                            cursor: 'pointer', padding: '4px', lineHeight: 1,
                        }}
                    >
                        &#10005;
                    </button>
                </div>

                {/* Body: Left nav + Right content — FIXED HEIGHT */}
                <div style={{
                    display: 'flex',
                    height: '420px', minHeight: '420px',
                    overflow: 'hidden',
                }}>
                    {/* Left navigation sidebar */}
                    <div style={{
                        width: '160px', flexShrink: 0,
                        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#eee'}`,
                        padding: '12px 0',
                        overflowY: 'auto',
                        background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                    }}>
                        {SECTIONS.map(section => {
                            const isActive = activeSection === section.key;
                            const isHovered = hoveredSection === section.key;
                            return (
                                <div
                                    key={section.key}
                                    onClick={() => setActiveSection(section.key)}
                                    onMouseEnter={() => setHoveredSection(section.key)}
                                    onMouseLeave={() => setHoveredSection(null)}
                                    style={{
                                        padding: '9px 18px', fontSize: '12px',
                                        fontWeight: isActive ? 700 : 500,
                                        color: isActive ? ac : (isDark ? '#aaa' : '#555'),
                                        cursor: 'pointer',
                                        background: isActive
                                            ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
                                            : isHovered
                                                ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')
                                                : 'transparent',
                                        borderLeft: isActive ? `2px solid ${ac}` : '2px solid transparent',
                                        transition: 'all 0.15s', userSelect: 'none',
                                    }}
                                >
                                    {t(section.labelKey)}
                                </div>
                            );
                        })}
                    </div>

                    {/* Right content area */}
                    <div style={{
                        flex: 1, padding: '18px 22px',
                        overflowY: 'auto',
                    }}>
                        {sectionRenderers[activeSection]?.()}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 20px',
                    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#eee'}`,
                    display: 'flex', justifyContent: 'flex-end', gap: '10px',
                    flexShrink: 0,
                }}>
                    <button
                        onClick={handleClose}
                        style={{
                            padding: '8px 20px', background: ac, color: '#000',
                            border: 'none', borderRadius: '8px',
                            fontSize: '11px', fontWeight: 'bold',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}
                    >
                        {t('common.done')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
