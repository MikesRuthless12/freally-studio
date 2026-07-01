import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from '../i18n/I18nContext';

const STORAGE_KEY = 'freally-teleprompter-settings';
const RTL_LANGUAGES = new Set(['Arabic', 'Hebrew', 'Persian', 'Urdu']);

const SECTION_COLORS = {
    verse: '#4ade80',
    chorus: null, // uses accent
    bridge: null, // uses secondary
    prechorus: '#a855f7',
    intro: '#06b6d4',
    outro: '#6366f1',
};

const DEFAULT_SETTINGS = {
    fontSize: 36,
    lookAhead: 2,
    textColor: '#ffffff',
    highlightColor: '', // empty = use accent
    bgColor: '#000000',
    dimOpacity: 0.35,
    fontFamily: 'system-ui, -apple-system, sans-serif',
};

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// Pause duration in seconds for each "-" dash (breath/cadence break) — English only
const DASH_PAUSE_SECONDS = 0.5;

/**
 * Tokenize a lyric line into words and dash-pause markers.
 * Returns array of { type: 'word'|'pause', text: string }
 * Dashes surrounded by spaces (" - ") become pause tokens.
 */
function tokenizeLine(text) {
    if (!text) return [];
    const parts = text.split(/(\s+-\s+)/);
    const tokens = [];
    for (const part of parts) {
        if (/^\s+-\s+$/.test(part)) {
            tokens.push({ type: 'pause', text: ' - ' });
        } else {
            const words = part.split(/\s+/).filter(w => w.length > 0);
            for (const w of words) {
                tokens.push({ type: 'word', text: w });
            }
        }
    }
    return tokens;
}

/**
 * Returns { wordIdx, wordProgress } where:
 *   wordIdx = index of active word (-1 during pause or no match)
 *   wordProgress = 0-1 how far through that word's time slot (for karaoke sweep)
 */
function getActiveWordInfo(tokens, lineProgress, lineDurationSec, useDashPause) {
    const NONE = { wordIdx: -1, wordProgress: 0 };
    if (!tokens.length) return NONE;
    const wordTokens = tokens.filter(t => t.type === 'word');
    if (!wordTokens.length) return NONE;

    const pauseCount = useDashPause ? tokens.filter(t => t.type === 'pause').length : 0;
    const totalPauseTime = pauseCount * DASH_PAUSE_SECONDS;
    const wordTime = Math.max(0, lineDurationSec - totalPauseTime);
    const timePerWord = wordTokens.length > 0 ? wordTime / wordTokens.length : 0;

    const elapsed = lineProgress * lineDurationSec;
    let accum = 0;
    let wordIdx = 0;

    for (const token of tokens) {
        if (token.type === 'pause') {
            if (useDashPause) {
                const pauseStart = accum;
                const pauseEnd = accum + DASH_PAUSE_SECONDS;
                if (elapsed >= pauseStart && elapsed < pauseEnd) return NONE;
                accum += DASH_PAUSE_SECONDS;
            }
        } else {
            const start = accum;
            const end = accum + timePerWord;
            if (elapsed >= start && elapsed < end) {
                const progress = timePerWord > 0 ? (elapsed - start) / timePerWord : 1;
                return { wordIdx, wordProgress: Math.max(0, Math.min(1, progress)) };
            }
            accum += timePerWord;
            wordIdx++;
        }
    }
    return { wordIdx: wordTokens.length - 1, wordProgress: 1 };
}

const GENRE_BASE_BARS = {
    'Pop': 4,
    'Hip Hop': 2,
    'Rock': 2,
    'Country': 4,
    'R&B': 2,
    'EDM': 4,
    'Indie': 2,
    'Folk': 4,
    'Metal': 2,
    'Jazz': 2,
    'K-Pop': 4,
    'Latin': 2,
    'Gospel': 4,
};

function getBarsPerLine(genre, bpm) {
    let bars = GENRE_BASE_BARS[genre] || 2;
    const lineDuration = bars * 4 * (60 / (bpm || 120));
    if (lineDuration < 2.0) bars *= 2;
    return bars;
}

function flattenSong(song, barsPerLine) {
    if (!song?.sections?.length) return [];
    const flat = [];
    let contentIdx = 0;

    for (const section of song.sections) {
        flat.push({
            text: section.label,
            type: section.type,
            isHeader: true,
            barStart: contentIdx * barsPerLine + 1,
            contentIndex: -1,
            lineIndex: flat.length,
        });

        for (let i = 0; i < section.lines.length; i++) {
            const barStart = contentIdx * barsPerLine + 1;
            flat.push({
                text: section.lines[i],
                type: section.type,
                isHeader: false,
                barStart,
                barEnd: barStart + barsPerLine - 1,
                contentIndex: contentIdx,
                lineIndex: flat.length,
            });
            contentIdx++;
        }
    }
    return flat;
}

// Custom memo: skip re-render when only globalCurrentStep or globalContinuousProgress changed.
// The step ref + useEffect inside handles those without needing a full re-render.
const Teleprompter = React.memo(function Teleprompter({
    song, theme = 'dark', accentColors,
    globalTempo = 120, globalBars = 4,
    globalIsPlaying = false, globalCurrentStep = 0, globalContinuousProgress = 0,
    isRecording = false, isCountingIn = false,
    genre = '',
    lyricLanguage = 'English',
    metronomeEnabled = false, setMetronomeEnabled,
    metronomeVolume = 0.5, setMetronomeVolume,
    recordingStartBar = 0,
    onClose,
}) {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const barsPerLine = getBarsPerLine(genre, globalTempo);

    // Settings
    const [settings, setSettings] = useState(loadSettings);
    const [showSettings, setShowSettings] = useState(false);
    const [toolbarVisible, setToolbarVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const containerRef = useRef(null);
    const lineRefs = useRef([]);
    const hideTimerRef = useRef(null);

    const highlightColor = settings.highlightColor || ac;

    const updateSetting = useCallback((key, value) => {
        setSettings(prev => {
            const next = { ...prev, [key]: value };
            saveSettings(next);
            return next;
        });
    }, []);

    const resetSettings = useCallback(() => {
        setSettings({ ...DEFAULT_SETTINGS });
        saveSettings(DEFAULT_SETTINGS);
    }, []);

    // Flatten song into timed lines
    const flatLines = useMemo(() => flattenSong(song, barsPerLine), [song, barsPerLine]);

    const totalSongBars = useMemo(() => {
        const contentCount = flatLines.filter(l => !l.isHeader).length;
        return contentCount * barsPerLine;
    }, [flatLines, barsPerLine]);

    // ─── User-selected start line for recording / comping ───
    const [startContentIndex, setStartContentIndex] = useState(0);

    // ─── HIGH-FREQUENCY STEP TRACKING ───
    // Store globalCurrentStep in a ref — NEVER use it in useMemo/useState
    // to avoid 30x/sec React re-renders. All per-tick updates use refs + rAF.
    const stepRef = useRef(0);
    stepRef.current = globalCurrentStep;

    const barsPerLineRef = useRef(barsPerLine);
    barsPerLineRef.current = barsPerLine;
    const startContentIndexRef = useRef(startContentIndex);
    startContentIndexRef.current = startContentIndex;
    const recordingStartBarRef = useRef(recordingStartBar);
    recordingStartBarRef.current = recordingStartBar;

    // lineProgressRef: updated every render from the ref-based step, read by KaraokeLine rAF
    const lineProgressRef = useRef(0);

    // currentBar for toolbar display only (low-frequency state)
    const [currentBar, setCurrentBar] = useState(1);

    // currentLineIndex: React state that ONLY updates when the active line changes
    const [currentLineIndex, setCurrentLineIndex] = useState(-1);

    // Refs for rAF-based tracking (avoids useEffect on globalCurrentStep)
    // Count-in pauses the karaoke — treat it as "not playing" so the active line resets
    const isPlayingRef = useRef(false);
    isPlayingRef.current = (globalIsPlaying || isRecording) && !isCountingIn;
    const flatLinesRef = useRef(flatLines);
    flatLinesRef.current = flatLines;
    const prevLineRef = useRef(-1);
    const prevBarRef = useRef(1);
    const barIndicatorRef = useRef(null);

    // rAF loop: reads stepRef, computes line index + progress, only sets
    // React state when the active LINE changes (not every tick).
    useEffect(() => {
        let rafId;
        const tick = () => {
            const playing = isPlayingRef.current;
            if (!playing) {
                if (prevLineRef.current !== -1) {
                    prevLineRef.current = -1;
                    prevBarRef.current = 1;
                    setCurrentLineIndex(-1);
                    setCurrentBar(1);
                }
                lineProgressRef.current = 0;
                rafId = requestAnimationFrame(tick);
                return;
            }

            const step = stepRef.current;
            const bpl = barsPerLineRef.current;
            const bar = Math.floor(step / 32) + 1;
            // Bars since recording started (not since bar 0) — so comping resets correctly
            const recStartBar = recordingStartBarRef.current || 0;
            const barsSinceRecStart = Math.max(0, bar - 1 - recStartBar);
            const contentLineIdx = startContentIndexRef.current + Math.floor(barsSinceRecStart / bpl);
            const fl = flatLinesRef.current;
            const match = fl.find(l => !l.isHeader && l.contentIndex === contentLineIdx);
            const lineIdx = match ? match.lineIndex : -1;

            // Update lineProgress ref (read by KaraokeLine rAF)
            const stepsPerLine = bpl * 32;
            const lineStartStep = Math.floor(barsSinceRecStart / bpl) * stepsPerLine;
            const stepInLine = step - (recStartBar * 32) - lineStartStep;
            lineProgressRef.current = Math.max(0, Math.min(1, stepInLine / (stepsPerLine - 1)));

            // Only trigger React re-render if the LINE changed
            if (lineIdx !== prevLineRef.current) {
                prevLineRef.current = lineIdx;
                setCurrentLineIndex(lineIdx);
            }

            // Update bar indicator via DOM (no React re-render)
            if (bar !== prevBarRef.current) {
                prevBarRef.current = bar;
                if (barIndicatorRef.current) {
                    barIndicatorRef.current.textContent = `Bar ${bar} / ${totalSongBars || globalBars}`;
                }
            }

            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, []); // no deps — reads everything from refs

    const useDashPause = lyricLanguage === 'English';
    const isRtl = RTL_LANGUAGES.has(lyricLanguage);

    const lineDurationSec = useMemo(() => {
        return barsPerLine * 4 * (60 / (globalTempo || 120));
    }, [barsPerLine, globalTempo]);

    const nextLineIndex = useMemo(() => {
        if (currentLineIndex < 0) return -1;
        for (let i = currentLineIndex + 1; i < flatLines.length; i++) {
            if (!flatLines[i].isHeader) return i;
        }
        return -1;
    }, [currentLineIndex, flatLines]);

    // Flat-line index of the user's selected start line (for visual marker)
    const startFlatLineIndex = useMemo(() => {
        const match = flatLines.find(l => !l.isHeader && l.contentIndex === startContentIndex);
        return match ? match.lineIndex : -1;
    }, [flatLines, startContentIndex]);

    // Whether the teleprompter is idle (can select start line)
    const isIdle = !globalIsPlaying && !isRecording && !isCountingIn;

    // Click handler: select start line when idle
    const handleLineClick = useCallback((contentIndex) => {
        if (!isIdle) return;
        setStartContentIndex(contentIndex);
    }, [isIdle]);

    const activeLineIdxRef = useRef(-1);

    // Auto-scroll when current line changes
    useEffect(() => {
        if (currentLineIndex >= 0) {
            const targetIdx = isRecording
                ? Math.min(currentLineIndex + 1 + settings.lookAhead, flatLines.length - 1)
                : Math.min(currentLineIndex + settings.lookAhead, flatLines.length - 1);
            const el = lineRefs.current[targetIdx];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentLineIndex, isRecording, settings.lookAhead, flatLines.length]);

    // Scroll back to START line during count-in (comp restart)
    useEffect(() => {
        if (isCountingIn && startFlatLineIndex >= 0) {
            const el = lineRefs.current[startFlatLineIndex];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isCountingIn, startFlatLineIndex]);

    // Auto-hide toolbar
    const resetHideTimer = useCallback(() => {
        setToolbarVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 3000);
    }, []);

    useEffect(() => {
        resetHideTimer();
        return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
    }, [resetHideTimer]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') { onClose?.(); return; }
            if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); return; }
            if (e.key === '+' || e.key === '=') { updateSetting('fontSize', Math.min(settings.fontSize + 2, 72)); return; }
            if (e.key === '-') { updateSetting('fontSize', Math.max(settings.fontSize - 2, 24)); return; }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose, settings.fontSize, updateSetting]);

    // Fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(() => {});
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const getTypeColor = (type) => {
        if (type === 'chorus') return ac;
        if (type === 'bridge') return acSec;
        return SECTION_COLORS[type] || '#888';
    };

    // Determine which flat-line index is the "active" karaoke line
    const activeKaraokeIdx = isRecording ? nextLineIndex : currentLineIndex;
    activeLineIdxRef.current = activeKaraokeIdx;

    return (
        <div
            ref={containerRef}
            onMouseMove={resetHideTimer}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: settings.bgColor,
                display: 'flex', flexDirection: 'column',
                fontFamily: settings.fontFamily,
                cursor: toolbarVisible ? 'default' : 'none',
            }}
        >
            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                opacity: toolbarVisible ? 1 : 0,
                transition: 'opacity 0.4s',
                pointerEvents: toolbarVisible ? 'auto' : 'none',
                zIndex: 2,
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }} title={t('teleprompter.close')}>✕</button>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', letterSpacing: '1px' }}>TELEPROMPTER</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span ref={barIndicatorRef} style={{ fontSize: '12px', color: '#aaa', fontVariantNumeric: 'tabular-nums', fontWeight: '600' }}>
                        {`Bar ${currentBar} / ${totalSongBars || globalBars}`}
                    </span>
                    {isRecording ? (
                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#ff3939', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff3939', animation: 'pulse 1.5s infinite' }} />
                            {t('teleprompter.recording')}
                        </span>
                    ) : globalIsPlaying ? (
                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#39ff14', letterSpacing: '1px' }}>{t('teleprompter.playing')}</span>
                    ) : (
                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#666', letterSpacing: '1px' }}>{t('teleprompter.stopped')}</span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            onClick={() => setMetronomeEnabled?.(!metronomeEnabled)}
                            style={{
                                background: metronomeEnabled ? 'rgba(255,255,255,0.15)' : 'none',
                                border: `1px solid ${metronomeEnabled ? ac : 'rgba(255,255,255,0.2)'}`,
                                borderRadius: '4px', color: metronomeEnabled ? ac : '#888',
                                fontSize: '10px', fontWeight: '800', cursor: 'pointer',
                                padding: '4px 10px', letterSpacing: '0.5px', transition: 'all 0.2s',
                            }}
                            title={t('app.toggleMetronome')}
                        >
                            {t('app.met')}
                        </button>
                        {metronomeEnabled && (
                            <input
                                type="range" min={0} max={1} step={0.05}
                                value={metronomeVolume}
                                onChange={e => setMetronomeVolume?.(parseFloat(e.target.value))}
                                style={{ width: '50px', height: '3px', accentColor: ac, cursor: 'pointer' }}
                                title={t('app.metronomeVolume', { volume: Math.round(metronomeVolume * 100) })}
                            />
                        )}
                    </div>
                    <button onClick={() => setShowSettings(p => !p)} style={{ background: showSettings ? 'rgba(255,255,255,0.15)' : 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }} title={t('teleprompter.settings')}>⚙</button>
                    <button onClick={toggleFullscreen} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }} title={isFullscreen ? t('teleprompter.exitFullscreen') : t('teleprompter.fullscreen')}>
                        {isFullscreen ? '⧉' : '⛶'}
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div style={{
                    position: 'absolute', top: '56px', right: 0, width: '280px', bottom: 0,
                    background: 'rgba(20,20,25,0.95)', backdropFilter: 'blur(20px)',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                    padding: '20px', overflowY: 'auto', zIndex: 3,
                }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#999', letterSpacing: '1px', marginBottom: '16px' }}>{t('teleprompter.settings')}</div>

                    <SettingRow label={t('teleprompter.fontSize')} value={`${settings.fontSize}px`}>
                        <input type="range" min={24} max={72} value={settings.fontSize} onChange={e => updateSetting('fontSize', Number(e.target.value))} style={{ width: '100%', accentColor: ac }} />
                    </SettingRow>
                    <SettingRow label={t('teleprompter.lookAhead')} value={settings.lookAhead}>
                        <input type="range" min={0} max={5} value={settings.lookAhead} onChange={e => updateSetting('lookAhead', Number(e.target.value))} style={{ width: '100%', accentColor: ac }} />
                    </SettingRow>
                    <SettingRow label={t('teleprompter.dimOpacity')} value={Math.round(settings.dimOpacity * 100) + '%'}>
                        <input type="range" min={10} max={80} value={Math.round(settings.dimOpacity * 100)} onChange={e => updateSetting('dimOpacity', Number(e.target.value) / 100)} style={{ width: '100%', accentColor: ac }} />
                    </SettingRow>
                    <SettingRow label={t('teleprompter.textColor')}>
                        <input type="color" value={settings.textColor} onChange={e => updateSetting('textColor', e.target.value)} style={{ width: '40px', height: '24px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    </SettingRow>
                    <SettingRow label={t('teleprompter.highlightColor')}>
                        <input type="color" value={highlightColor} onChange={e => updateSetting('highlightColor', e.target.value)} style={{ width: '40px', height: '24px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    </SettingRow>
                    <SettingRow label={t('teleprompter.bgColor')}>
                        <input type="color" value={settings.bgColor} onChange={e => updateSetting('bgColor', e.target.value)} style={{ width: '40px', height: '24px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    </SettingRow>
                    <SettingRow label={t('teleprompter.fontFamily')}>
                        <select
                            value={settings.fontFamily}
                            onChange={e => updateSetting('fontFamily', e.target.value)}
                            style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '10px', padding: '4px 6px' }}
                        >
                            <option value="system-ui, -apple-system, sans-serif">{t('teleprompter.sansSerif')}</option>
                            <option value="Georgia, 'Times New Roman', serif">{t('teleprompter.serif')}</option>
                            <option value="'Courier New', Consolas, monospace">{t('teleprompter.monospace')}</option>
                        </select>
                    </SettingRow>
                    <button onClick={resetSettings} style={{ marginTop: '16px', width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#888', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                        {t('teleprompter.resetDefaults')}
                    </button>
                </div>
            )}

            {/* Count-in overlay */}
            {isCountingIn && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.8)',
                }}>
                    <div style={{
                        fontSize: '120px', fontWeight: '900', color: '#ff3939',
                        animation: 'pulse 0.5s infinite',
                        textShadow: '0 0 60px rgba(255,57,57,0.5)',
                    }}>
                        ●
                    </div>
                </div>
            )}

            {/* Main scrolling lyrics area */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: flatLines.length === 0 ? 'center' : 'flex-start',
                paddingTop: '30vh', paddingBottom: '50vh',
                overflowY: 'auto', overflowX: 'hidden',
            }}>
                {flatLines.length === 0 ? (
                    <div style={{ color: '#666', fontSize: '16px', textAlign: 'center' }}>
                        {t('teleprompter.noSong')}
                    </div>
                ) : (
                    flatLines.map((line, idx) => {
                        const isCurrent = idx === currentLineIndex;
                        const isNext = idx === nextLineIndex;
                        const isActive = isCurrent && !isCountingIn;
                        const isCurrentDuringRec = isRecording && isCurrent && !isCountingIn;

                        if (line.isHeader) {
                            return (
                                <div
                                    key={idx}
                                    ref={el => lineRefs.current[idx] = el}
                                    style={{
                                        fontSize: Math.round(settings.fontSize * 0.4),
                                        fontWeight: '800',
                                        color: getTypeColor(line.type),
                                        letterSpacing: '2px',
                                        textTransform: 'uppercase',
                                        marginTop: idx === 0 ? 0 : '32px',
                                        marginBottom: '12px',
                                        opacity: isCurrent || isNext ? 1 : settings.dimOpacity + 0.2,
                                        transition: 'all 0.4s ease',
                                    }}
                                >
                                    {line.text}
                                </div>
                            );
                        }

                        const isStartLine = idx === startFlatLineIndex;

                        return (
                            <div
                                key={idx}
                                ref={el => lineRefs.current[idx] = el}
                                onClick={() => handleLineClick(line.contentIndex)}
                                style={{
                                    position: 'relative', textAlign: 'center', maxWidth: '80%', marginBottom: '8px',
                                    cursor: isIdle ? 'pointer' : 'default',
                                    direction: isRtl ? 'rtl' : 'ltr',
                                }}
                            >
                                {/* Start-line marker (visible when idle or during recording) */}
                                {isStartLine && (
                                    <span style={{
                                        position: 'absolute', left: '-70px', top: '50%', transform: 'translateY(-50%)',
                                        fontSize: '9px', fontWeight: '900', color: '#39ff14',
                                        letterSpacing: '1px', opacity: isIdle ? 1 : 0.5,
                                        whiteSpace: 'nowrap',
                                    }}>
                                        ▶ START
                                    </span>
                                )}

                                {/* NEXT badge for recording mode */}
                                {isRecording && isNext && !isStartLine && (
                                    <span style={{
                                        position: 'absolute', left: '-60px', top: '50%', transform: 'translateY(-50%)',
                                        fontSize: '9px', fontWeight: '900', color: highlightColor,
                                        letterSpacing: '1.5px', opacity: 0.8,
                                    }}>
                                        {t('teleprompter.nextLine')}
                                    </span>
                                )}

                                {isActive ? (
                                    <KaraokeLine
                                        text={line.text}
                                        lineProgressRef={lineProgressRef}
                                        lineDurationSec={lineDurationSec}
                                        useDashPause={useDashPause}
                                        fontSize={settings.fontSize}
                                        highlightColor={highlightColor}
                                        isPlaying={(globalIsPlaying || isRecording) && !isCountingIn}
                                    />
                                ) : (
                                    <div style={{
                                        fontSize: isStartLine && isIdle ? settings.fontSize : Math.round(settings.fontSize * 0.85),
                                        fontWeight: isStartLine && isIdle ? '600' : '400',
                                        color: isStartLine && isIdle ? highlightColor : settings.textColor,
                                        opacity: isCurrentDuringRec ? 0.7 : (isStartLine && isIdle ? 0.9 : settings.dimOpacity),
                                        transition: 'all 0.4s ease',
                                        lineHeight: 1.5,
                                        padding: '4px 0',
                                        borderLeft: isStartLine && isIdle ? `3px solid #39ff14` : 'none',
                                        paddingLeft: isStartLine && isIdle ? '12px' : '0',
                                    }}>
                                        {line.text}
                                    </div>
                                )}

                                {isRecording && isCurrent && (
                                    <RecordingProgressBar
                                        lineProgressRef={lineProgressRef}
                                        highlightColor={highlightColor}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Click-to-select hint when idle */}
            {isIdle && flatLines.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
                    fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px',
                    opacity: toolbarVisible ? 1 : 0, transition: 'opacity 0.4s',
                }}>
                    Click a line to set your start point
                </div>
            )}

            {/* ESC hint */}
            <div style={{
                position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.5px',
                opacity: toolbarVisible ? 1 : 0, transition: 'opacity 0.4s',
            }}>
                {t('teleprompter.pressEscToClose')}
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}, (prev, next) => {
    // Skip re-render if ONLY globalCurrentStep or globalContinuousProgress changed.
    // The useEffect + refs inside handle step tracking without needing a re-render.
    for (const key of Object.keys(next)) {
        if (key === 'globalCurrentStep' || key === 'globalContinuousProgress') continue;
        if (prev[key] !== next[key]) return false; // props differ → re-render
    }
    return true; // only step changed → skip re-render
});

export default Teleprompter;

/**
 * RecordingProgressBar — reads lineProgressRef via rAF, updates DOM directly.
 */
function RecordingProgressBar({ lineProgressRef, highlightColor }) {
    const barRef = useRef(null);

    useEffect(() => {
        let rafId;
        const tick = () => {
            if (barRef.current) {
                barRef.current.style.width = `${(lineProgressRef.current * 100).toFixed(1)}%`;
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [lineProgressRef]);

    return (
        <div style={{
            width: '100%', height: '3px', borderRadius: '2px',
            background: 'rgba(255,255,255,0.1)', marginTop: '4px', overflow: 'hidden',
        }}>
            <div
                ref={barRef}
                style={{
                    width: '0%', height: '100%',
                    background: highlightColor, borderRadius: '2px',
                }}
            />
        </div>
    );
}

/**
 * KaraokeLine — the ONLY line that does high-frequency updates.
 * Uses requestAnimationFrame to read lineProgressRef and update
 * DOM directly (no React re-renders per step tick).
 */
function KaraokeLine({ text, lineProgressRef, lineDurationSec, useDashPause, fontSize, highlightColor, isPlaying }) {
    const containerEl = useRef(null);
    const tokens = useMemo(() => tokenizeLine(text), [text]);

    // Build a list of word span refs for direct DOM updates
    const wordSpanRefs = useRef([]);
    const dashSpanRefs = useRef([]);
    const spaceSpanRefs = useRef([]);

    const sungColor = '#ffffff';

    // rAF loop: read lineProgressRef, compute active word, update DOM directly
    useEffect(() => {
        if (!isPlaying) return;
        let rafId;
        let lastWordIdx = -2;
        let lastPct = -1;
        let lastSungWordIdx = -1;

        const wordTokens = tokens.filter(t => t.type === 'word');
        const wordCount = wordTokens.length;

        // Reset all word spans to unhighlighted state (fresh start / comp restart)
        for (let i = 0; i < wordCount; i++) {
            const el = wordSpanRefs.current[i];
            if (!el) continue;
            el.style.backgroundImage = 'none';
            el.style.webkitBackgroundClip = 'unset';
            el.style.webkitTextFillColor = 'unset';
            el.style.backgroundClip = 'unset';
            el.style.color = highlightColor;
            el.style.textShadow = `0 0 30px ${highlightColor}40`;
            el.style.textDecoration = 'none';
        }
        for (let i = 0; i < spaceSpanRefs.current.length; i++) {
            const el = spaceSpanRefs.current[i];
            if (el) el.style.color = highlightColor;
        }
        for (let i = 0; i < dashSpanRefs.current.length; i++) {
            const el = dashSpanRefs.current[i];
            if (el) { el.style.color = 'rgba(255,255,255,0.3)'; el.style.fontSize = '1em'; }
        }

        const tick = () => {
            const progress = lineProgressRef.current;
            const info = getActiveWordInfo(tokens, progress, lineDurationSec, useDashPause);
            const { wordIdx, wordProgress } = info;
            const pct = Math.round(wordProgress * 100);

            // Update the high-water mark for sung words
            if (wordIdx >= 0) lastSungWordIdx = wordIdx;

            // Only touch DOM if something changed
            if (wordIdx !== lastWordIdx || pct !== lastPct) {
                // During a pause, all words up to lastSungWordIdx are "sung"
                const sungUpTo = wordIdx >= 0 ? wordIdx : lastSungWordIdx + 1;

                // Update word spans
                for (let i = 0; i < wordCount; i++) {
                    const el = wordSpanRefs.current[i];
                    if (!el) continue;
                    if (i === wordIdx) {
                        // Current word: karaoke gradient sweep
                        el.style.backgroundImage = `linear-gradient(to right, ${sungColor} ${pct}%, ${highlightColor} ${pct}%)`;
                        el.style.webkitBackgroundClip = 'text';
                        el.style.webkitTextFillColor = 'transparent';
                        el.style.backgroundClip = 'text';
                        el.style.textShadow = 'none';
                        el.style.textDecoration = 'underline';
                        el.style.textDecorationColor = highlightColor;
                        el.style.textUnderlineOffset = '4px';
                        el.style.textDecorationThickness = '2px';
                    } else if (i < sungUpTo) {
                        // Already sung
                        el.style.backgroundImage = 'none';
                        el.style.webkitBackgroundClip = 'unset';
                        el.style.webkitTextFillColor = 'unset';
                        el.style.backgroundClip = 'unset';
                        el.style.color = sungColor;
                        el.style.textShadow = '0 0 8px rgba(255,255,255,0.3)';
                        el.style.textDecoration = 'none';
                    } else {
                        // Not yet
                        el.style.backgroundImage = 'none';
                        el.style.webkitBackgroundClip = 'unset';
                        el.style.webkitTextFillColor = 'unset';
                        el.style.backgroundClip = 'unset';
                        el.style.color = highlightColor;
                        el.style.textShadow = `0 0 30px ${highlightColor}40`;
                        el.style.textDecoration = 'none';
                    }
                }

                // Update space spans
                for (let i = 0; i < spaceSpanRefs.current.length; i++) {
                    const el = spaceSpanRefs.current[i];
                    if (!el) continue;
                    // Space before word i+1 (since first word has no leading space)
                    const wIdx = i + 1;
                    el.style.color = wIdx < sungUpTo || wIdx <= wordIdx ? sungColor : highlightColor;
                }

                // Update dash spans
                for (let i = 0; i < dashSpanRefs.current.length; i++) {
                    const el = dashSpanRefs.current[i];
                    if (!el) continue;
                    const inPause = wordIdx === -1;
                    el.style.color = inPause ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)';
                    el.style.fontSize = inPause ? '1.1em' : '1em';
                }

                lastWordIdx = wordIdx;
                lastPct = pct;
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [isPlaying, tokens, lineDurationSec, useDashPause, highlightColor]);

    // Render the static structure once; rAF updates styles directly
    let wordCounter = 0;
    let dashCounter = 0;
    // Track word index for spaces (space goes before each word except the first after a non-pause)
    let spaceCounter = 0;

    return (
        <div
            ref={containerEl}
            style={{
                fontSize: fontSize,
                fontWeight: '700',
                lineHeight: 1.5,
                padding: '4px 0',
            }}
        >
            {tokens.map((token, ti) => {
                if (token.type === 'pause') {
                    const di = dashCounter++;
                    return (
                        <span
                            key={ti}
                            ref={el => { dashSpanRefs.current[di] = el; }}
                            style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                            {token.text}
                        </span>
                    );
                }
                const wi = wordCounter++;
                const needsSpace = ti > 0 && tokens[ti - 1]?.type !== 'pause';
                const si = needsSpace ? spaceCounter++ : -1;

                return (
                    <span key={ti}>
                        {needsSpace && (
                            <span
                                ref={el => { if (si >= 0) spaceSpanRefs.current[si] = el; }}
                                style={{ color: highlightColor }}
                            >
                                {' '}
                            </span>
                        )}
                        <span
                            ref={el => { wordSpanRefs.current[wi] = el; }}
                            style={{ color: highlightColor, textShadow: `0 0 30px ${highlightColor}40` }}
                        >
                            {token.text}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}

/** Small reusable settings row */
function SettingRow({ label, value, children }) {
    return (
        <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', color: '#aaa' }}>{label}</span>
                {value !== undefined && <span style={{ fontSize: '10px', color: '#666', fontVariantNumeric: 'tabular-nums' }}>{value}</span>}
            </div>
            {children}
        </div>
    );
}
