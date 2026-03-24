import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { alignLyricsToMelody, enforceStressPattern, rapFlowMode, countSyllables } from './ProsodyAlignEngine';
import { scoreHook, optimizeHook } from './HookOptimizer';
import { calculateHitProbability } from '../analytics/HitProbabilityEngine';
import { hexToRgba } from '../accentThemes';
import { useTranslation } from '../i18n/I18nContext.jsx';

/**
 * LyricsTab — Lyrics analysis & generation workspace.
 * Contains three panels:
 *   1. Prosody Alignment (melody-aware lyrics)
 *   2. Hook Optimizer
 *   3. Hit Probability meter
 */
export default function LyricsTab({
    theme = 'dark',
    accentColors,
    globalKey = 'C',
    globalScale = 'major',
    globalTempo = 120,
    globalBars = 4,
    melodyNotes = [],
    genre = '',
    mood = '',
    importedLyrics = '',
    importedGenre = '',
    importedMood = '',
    importedBpm = 0,
}) {
    const { t } = useTranslation();
    const isDark = theme === 'dark';
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || `linear-gradient(135deg, ${ac}, ${acSec})`;

    // Genre/mood options for manual lyrics (same as Lyric Engine)
    const GENRES = ['Pop', 'Hip Hop', 'Rock', 'Country', 'R&B', 'EDM', 'Indie', 'Folk', 'Metal', 'Jazz', 'K-Pop', 'Latin', 'Gospel'];
    const MOODS = ['Happy', 'Sad', 'Romantic', 'Aggressive', 'Dreamy', 'Dark', 'Epic', 'Hopeful', 'Melancholic'];

    // State
    const [lyrics, setLyrics] = useState('');
    const [melodyAwareMode, setMelodyAwareMode] = useState(false);
    const [rapMode, setRapMode] = useState(false);
    const [hookLines, setHookLines] = useState('');
    const [optimizedResult, setOptimizedResult] = useState(null);
    const [activePanel, setActivePanel] = useState('prosody'); // 'prosody' | 'hook' | 'hit'
    const [optimizeMode, setOptimizeMode] = useState('refine'); // 'refine' | 'fresh'
    const [localGenre, setLocalGenre] = useState('');
    const [localMood, setLocalMood] = useState('');
    const [localBpm, setLocalBpm] = useState(globalTempo || 120);
    const [isEditingLocalBpm, setIsEditingLocalBpm] = useState(false);
    const [localRhymeScheme, setLocalRhymeScheme] = useState('AABB');
    const tapTimesRef = useRef([]);
    const lastImportRef = useRef('');

    // Extract chorus content lines from full lyrics (excludes section headers)
    const extractChorusLines = useCallback((fullText) => {
        const lines = fullText.split('\n');
        const chorusLines = [];
        let inChorus = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (/^\[chorus\b/i.test(trimmed)) {
                inChorus = true;
                continue; // Skip the header itself
            } else if (/^\[.+\]/.test(trimmed)) {
                inChorus = false;
            } else if (inChorus && trimmed.length > 0) {
                chorusLines.push(trimmed);
            }
        }
        return chorusLines;
    }, []);

    // Replace ALL chorus content in full lyrics while keeping section headers
    const replaceChorusContent = useCallback((fullText, newChorusLines) => {
        const lines = fullText.split('\n');
        const result = [];
        let inChorus = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (/^\[chorus\b/i.test(trimmed)) {
                inChorus = true;
                result.push(line); // Keep the [Chorus] header
                // Insert new chorus lines after every [Chorus] header
                for (const cl of newChorusLines) result.push(cl);
            } else if (/^\[.+\]/.test(trimmed)) {
                inChorus = false;
                result.push(line);
            } else if (inChorus) {
                // Skip old chorus content lines — already replaced above
                continue;
            } else {
                result.push(line);
            }
        }
        return result.join('\n');
    }, []);

    // Receive imported lyrics from Lyric Engine — auto-update selectors
    useEffect(() => {
        if (importedLyrics && importedLyrics !== lastImportRef.current) {
            lastImportRef.current = importedLyrics;
            setLyrics(importedLyrics);
            // Extract only the chorus lines for the Hook Optimizer
            const chorus = extractChorusLines(importedLyrics);
            setHookLines(chorus.length > 0 ? chorus.join('\n') : importedLyrics);
            // Auto-fill selectors from Lyric Engine settings
            if (importedGenre) setLocalGenre(importedGenre);
            if (importedMood) setLocalMood(importedMood);
            if (importedBpm) setLocalBpm(importedBpm);
        }
    }, [importedLyrics, importedGenre, importedMood, importedBpm, extractChorusLines]);

    // Parse lyrics into lines
    const lyricLines = useMemo(() => lyrics.split('\n').filter(l => l.trim().length > 0), [lyrics]);
    const hookLinesParsed = useMemo(() => hookLines.split('\n').filter(l => l.trim().length > 0), [hookLines]);

    // Prosody alignment result
    const prosodyResult = useMemo(() => {
        if (!melodyAwareMode || lyricLines.length === 0 || melodyNotes.length === 0) return null;
        if (rapMode) {
            return lyricLines.map(line => ({
                line,
                ...rapFlowMode(line, melodyNotes)
            }));
        }
        return lyricLines.map(line => {
            const alignment = alignLyricsToMelody(line, melodyNotes);
            const stress = enforceStressPattern(line, melodyNotes);
            return { line, alignment, stress };
        });
    }, [melodyAwareMode, rapMode, lyricLines, melodyNotes]);

    // Hook score (live)
    const hookScore = useMemo(() => {
        if (hookLinesParsed.length === 0) return null;
        return scoreHook(hookLinesParsed);
    }, [hookLinesParsed]);

    // Hit probability (live from all lyrics)
    const hitResult = useMemo(() => {
        const allLines = lyrics.split('\n').filter(l => l.trim().length > 0);
        if (allLines.length === 0) return null;
        return calculateHitProbability(allLines, { genre, mood });
    }, [lyrics, genre, mood]);

    // Optimize hook handler — localGenre is auto-set from imports or manual selection
    const effectiveGenre = localGenre || genre;
    const effectiveMood = localMood || mood;

    // Tap Tempo for local BPM
    const handleLocalTapTempo = useCallback(() => {
        const now = performance.now();
        const taps = tapTimesRef.current;
        taps.push(now);
        // Keep last 4 taps
        if (taps.length > 4) taps.shift();
        if (taps.length >= 2) {
            const intervals = [];
            for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
            const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const bpm = Math.round(60000 / avgMs);
            setLocalBpm(Math.max(20, Math.min(300, bpm)));
        }
        // Reset if gap > 3 seconds
        if (taps.length >= 2 && taps[taps.length - 1] - taps[taps.length - 2] > 3000) {
            tapTimesRef.current = [now];
        }
    }, []);

    const handleOptimizeHook = useCallback(() => {
        if (hookLinesParsed.length === 0) return;
        const result = optimizeHook(hookLinesParsed, effectiveGenre, effectiveMood, optimizeMode, localRhymeScheme);
        setOptimizedResult(result);
    }, [hookLinesParsed, effectiveGenre, effectiveMood, optimizeMode, localRhymeScheme]);

    // Apply optimized hook — replaces only the chorus in full lyrics if they have section headers
    const handleApplyOptimized = useCallback(() => {
        if (optimizedResult?.improvedLines) {
            const newLines = optimizedResult.improvedLines;
            setHookLines(newLines.join('\n'));
            // If lyrics have section headers, replace only the chorus content
            if (lyrics && /^\[.+\]/m.test(lyrics)) {
                const updatedLyrics = replaceChorusContent(lyrics, newLines);
                setLyrics(updatedLyrics);
            }
            setOptimizedResult(null);
        }
    }, [optimizedResult, lyrics, replaceChorusContent]);

    // Styles
    const panelBg = isDark ? 'rgba(20, 20, 28, 0.9)' : '#f8f8fa';
    const cardBg = isDark ? 'rgba(30, 30, 40, 0.8)' : '#fff';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e0e0e0';
    const textPrimary = isDark ? '#e0e0e0' : '#222';
    const textSecondary = isDark ? '#888' : '#666';
    const inputBg = isDark ? 'rgba(15, 15, 22, 0.9)' : '#fff';

    // Hit probability color
    const getHitColor = (pct) => {
        if (pct >= 75) return '#22c55e';
        if (pct >= 50) return '#eab308';
        return '#ef4444';
    };

    // Circular progress SVG
    const CircularProgress = ({ percent, size = 140, strokeWidth = 10 }) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        const color = getHitColor(percent);
        return (
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={isDark ? 'rgba(255,255,255,0.06)' : '#e5e5e5'} strokeWidth={strokeWidth} />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={color} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
                    fill={color} fontSize="24" fontWeight="800"
                    style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
                    {typeof percent === 'number' ? percent.toFixed(2) : percent}%
                </text>
            </svg>
        );
    };

    // Breakdown bar — percentages to 2 decimal places
    const BreakdownBar = ({ label, value, max = 100 }) => {
        const pct = Math.min(100, Math.max(0, value));
        const color = getHitColor(pct);
        return (
            <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: textSecondary, marginBottom: '3px' }}>
                    <span>{label}</span>
                    <span style={{ color: textPrimary, fontWeight: 600 }}>{pct.toFixed(2)}%</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e5e5', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', borderRadius: '3px', background: color,
                        width: `${pct}%`, transition: 'width 0.4s ease',
                        boxShadow: `0 0 8px ${hexToRgba(color, 0.4)}`
                    }} />
                </div>
            </div>
        );
    };

    // Score meter for hook optimizer — displays to 2 decimal places
    const ScoreMeter = ({ label, value, color }) => (
        <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color, textShadow: `0 0 12px ${hexToRgba(color, 0.4)}` }}>
                {(value * 100).toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: textSecondary, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        </div>
    );

    // Panel tab button
    const PanelTab = ({ id, label }) => (
        <button
            onClick={() => setActivePanel(id)}
            style={{
                padding: '8px 20px',
                background: activePanel === id ? hexToRgba(ac, isDark ? 0.15 : 1) : 'transparent',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                color: activePanel === id ? (isDark ? ac : '#fff') : textSecondary,
                fontSize: '11px', fontWeight: '700', letterSpacing: '1px',
                transition: 'all 0.2s',
                boxShadow: activePanel === id ? `0 0 12px ${hexToRgba(ac, 0.15)}` : 'none'
            }}
        >
            {label}
        </button>
    );

    return (
        <div style={{ padding: '20px', height: '100%', overflowY: 'auto', background: panelBg, color: textPrimary }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '1px', color: textPrimary }}>
                        {t('lyricsStudio.title')}
                    </h2>
                    <span style={{ fontSize: '10px', color: textSecondary, padding: '2px 8px', background: hexToRgba(ac, 0.1), borderRadius: '4px' }}>
                        {t('lyricsStudio.contextInfo', { key: globalKey, scale: globalScale, tempo: globalTempo, bars: globalBars })}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Melody-Aware Mode Toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: textSecondary }}>
                        <div
                            onClick={() => setMelodyAwareMode(!melodyAwareMode)}
                            style={{
                                width: '36px', height: '20px', borderRadius: '10px', position: 'relative', cursor: 'pointer',
                                background: melodyAwareMode ? ac : (isDark ? 'rgba(255,255,255,0.1)' : '#ccc'),
                                transition: 'background 0.2s',
                                boxShadow: melodyAwareMode ? `0 0 8px ${hexToRgba(ac, 0.3)}` : 'none'
                            }}
                        >
                            <div style={{
                                width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                                position: 'absolute', top: '2px',
                                left: melodyAwareMode ? '18px' : '2px',
                                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                            }} />
                        </div>
                        {t('lyricsStudio.melodyAware')}
                    </label>
                    {/* Rap Flow Toggle */}
                    {melodyAwareMode && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: textSecondary }}>
                            <div
                                onClick={() => setRapMode(!rapMode)}
                                style={{
                                    width: '36px', height: '20px', borderRadius: '10px', position: 'relative', cursor: 'pointer',
                                    background: rapMode ? acSec : (isDark ? 'rgba(255,255,255,0.1)' : '#ccc'),
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                                    position: 'absolute', top: '2px',
                                    left: rapMode ? '18px' : '2px',
                                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                }} />
                            </div>
                            {t('lyricsStudio.rapFlow')}
                        </label>
                    )}
                </div>
            </div>

            {/* Panel Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                <PanelTab id="prosody" label={t('lyricsStudio.prosodyAlign')} />
                <PanelTab id="hook" label={t('lyricsStudio.hookOptimizer')} />
                <PanelTab id="hit" label={t('lyricsStudio.hitPotential')} />
            </div>

            {/* ======== PROSODY ALIGNMENT PANEL ======== */}
            {activePanel === 'prosody' && (
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Lyrics Input */}
                    <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
                        <div style={{
                            background: cardBg, borderRadius: '10px', padding: '16px',
                            border: `1px solid ${borderColor}`
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '10px' }}>
                                {t('lyricsStudio.lyricsInput')}
                            </div>
                            <textarea
                                value={lyrics}
                                onChange={(e) => setLyrics(e.target.value)}
                                placeholder={t('lyricsStudio.lyricsPlaceholder')}
                                rows={14}
                                style={{
                                    width: '100%', background: inputBg, border: `1px solid ${borderColor}`,
                                    borderRadius: '8px', padding: '12px', color: textPrimary,
                                    fontSize: '14px', lineHeight: '1.8', resize: 'vertical',
                                    fontFamily: 'inherit', outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = ac}
                                onBlur={(e) => e.target.style.borderColor = borderColor}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: textSecondary }}>
                                <span>{lyricLines.length} {lyricLines.length !== 1 ? t('lyricsStudio.lines') : t('common.line')}</span>
                                <span>{lyrics.split(/\s+/).filter(Boolean).length} {t('lyricsStudio.words')}</span>
                                <span>{lyricLines.reduce((s, l) => s + l.split(/\s+/).filter(Boolean).reduce((a, w) => a + countSyllables(w), 0), 0)} {t('lyricsStudio.syllables')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Prosody Analysis Results */}
                    <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
                        <div style={{
                            background: cardBg, borderRadius: '10px', padding: '16px',
                            border: `1px solid ${borderColor}`
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '10px' }}>
                                {rapMode ? t('lyricsStudio.rapFlowAnalysis') : t('lyricsStudio.stressAlignment')}
                            </div>
                            {!melodyAwareMode && (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: textSecondary, fontSize: '13px' }}>
                                    {t('lyricsStudio.enableMelodyAware')} <span style={{ color: ac, fontWeight: 600 }}>{t('lyricsStudio.melodyAwareMode')}</span> {t('lyricsStudio.toSeeProsody')}
                                </div>
                            )}
                            {melodyAwareMode && melodyNotes.length === 0 && (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: textSecondary, fontSize: '13px' }}>
                                    {t('lyricsStudio.generateMelodyFirst')}
                                </div>
                            )}
                            {melodyAwareMode && melodyNotes.length > 0 && lyricLines.length === 0 && (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: textSecondary, fontSize: '13px' }}>
                                    {t('lyricsStudio.enterLyricsToAnalyze')}
                                </div>
                            )}
                            {prosodyResult && prosodyResult.map((item, idx) => (
                                <div key={idx} style={{
                                    padding: '10px 12px', borderRadius: '6px', marginBottom: '8px',
                                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa',
                                    border: `1px solid ${borderColor}`
                                }}>
                                    {/* Line with stress highlights */}
                                    <div style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '6px' }}>
                                        {rapMode ? (
                                            <span>{item.line}</span>
                                        ) : (
                                            item.stress?.stressMap?.length > 0 ? (
                                                <span>
                                                    {item.line.split(/\s+/).map((word, wi) => {
                                                        const isStressed = item.stress.stressMap.some(s => s.syllable && word.toLowerCase().includes(s.syllable.toLowerCase()) && s.shouldBeStressed);
                                                        return (
                                                            <span key={wi}>
                                                                {wi > 0 && ' '}
                                                                <span style={{
                                                                    color: isStressed ? acSec : textPrimary,
                                                                    fontWeight: isStressed ? '700' : '400',
                                                                    textShadow: isStressed ? `0 0 6px ${hexToRgba(acSec, 0.3)}` : 'none'
                                                                }}>{word}</span>
                                                            </span>
                                                        );
                                                    })}
                                                </span>
                                            ) : (
                                                <span>{item.line}</span>
                                            )
                                        )}
                                    </div>
                                    {/* Metrics */}
                                    <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: textSecondary }}>
                                        {rapMode ? (
                                            <>
                                                <span>{t('lyricsStudio.flow')}: <span style={{ color: item.flowScore >= 0.6 ? '#22c55e' : '#eab308', fontWeight: 600 }}>
                                                    {Math.round(item.flowScore * 100)}%</span></span>
                                                <span>{t('lyricsStudio.density')}: {item.density?.toFixed(1)} {t('lyricsStudio.sylPerBeat')}</span>
                                                <span>{t('lyricsStudio.internalRhymes')}: {item.internalRhymes}</span>
                                                <span style={{ color: item.isRapReady ? '#22c55e' : '#ef4444' }}>
                                                    {item.isRapReady ? t('lyricsStudio.rapReady') : t('lyricsStudio.needsDensity')}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span>{t('lyricsStudio.stressMatch')}: <span style={{
                                                    color: (item.stress?.score || 0) >= 0.7 ? '#22c55e' : (item.stress?.score || 0) >= 0.4 ? '#eab308' : '#ef4444',
                                                    fontWeight: 600
                                                }}>{Math.round((item.stress?.score || 0) * 100)}%</span></span>
                                                <span>{t('lyricsStudio.syllablesLabel')}: {item.alignment?.syllableCount || 0}</span>
                                                <span>{t('lyricsStudio.notesLabel')}: {item.alignment?.noteCount || 0}</span>
                                                {item.alignment?.issues?.length > 0 && (
                                                    <span style={{ color: '#eab308' }}>{item.alignment.issues.length} {item.alignment.issues.length !== 1 ? t('lyricsStudio.issues') : t('lyricsStudio.issue')}</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {item.stress?.suggestion && (
                                        <div style={{ fontSize: '10px', color: '#eab308', marginTop: '4px', fontStyle: 'italic' }}>
                                            {item.stress.suggestion}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ======== HOOK OPTIMIZER PANEL ======== */}
            {activePanel === 'hook' && (
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Hook Input */}
                    <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
                        <div style={{
                            background: cardBg, borderRadius: '10px', padding: '16px',
                            border: `1px solid ${borderColor}`
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '10px' }}>
                                {t('lyricsStudio.hookChorusLines')}
                            </div>
                            {/* Genre / Mood / BPM selectors — always visible, auto-updated from Lyric Engine */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 110px' }}>
                                    <div style={{ fontSize: '9px', color: textSecondary, marginBottom: '3px', fontWeight: 600, letterSpacing: '0.5px' }}>{t('lyricsStudio.genre')}</div>
                                    <select
                                        value={localGenre}
                                        onChange={(e) => setLocalGenre(e.target.value)}
                                        style={{
                                            width: '100%', padding: '6px 8px', borderRadius: '5px',
                                            background: inputBg, border: `1px solid ${borderColor}`,
                                            color: textPrimary, fontSize: '11px', outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">{t('lyricsStudio.selectGenre')}</option>
                                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 110px' }}>
                                    <div style={{ fontSize: '9px', color: textSecondary, marginBottom: '3px', fontWeight: 600, letterSpacing: '0.5px' }}>{t('lyricsStudio.mood')}</div>
                                    <select
                                        value={localMood}
                                        onChange={(e) => setLocalMood(e.target.value)}
                                        style={{
                                            width: '100%', padding: '6px 8px', borderRadius: '5px',
                                            background: inputBg, border: `1px solid ${borderColor}`,
                                            color: textPrimary, fontSize: '11px', outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">{t('lyricsStudio.selectMood')}</option>
                                        {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: '0 0 auto' }}>
                                    <div style={{ fontSize: '9px', color: textSecondary, marginBottom: '3px', fontWeight: 600, letterSpacing: '0.5px' }}>{t('lyricsStudio.bpm')}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {isEditingLocalBpm ? (
                                            <input type="number" autoFocus defaultValue={localBpm} min={20} max={300}
                                                onFocus={(e) => e.target.select()}
                                                onBlur={(e) => { const v = Math.max(20, Math.min(300, Math.round(Number(e.target.value) || 120))); setLocalBpm(v); setIsEditingLocalBpm(false); }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); else if (e.key === 'Escape') setIsEditingLocalBpm(false); }}
                                                style={{ width: '50px', padding: '5px 6px', background: inputBg, border: `1px solid ${ac}`, borderRadius: '5px', color: ac, fontSize: '13px', fontWeight: '900', textAlign: 'center', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                            />
                                        ) : (
                                            <div
                                                onMouseDown={(e) => {
                                                    const startY = e.clientY; const startBpm = localBpm;
                                                    const onMouseMove = (moveEvent) => { const deltaY = startY - moveEvent.clientY; setLocalBpm(Math.max(20, Math.min(300, startBpm + Math.round(deltaY / 2)))); };
                                                    const onMouseUp = () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = 'default'; };
                                                    window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp); document.body.style.cursor = 'ns-resize';
                                                }}
                                                onDoubleClick={() => setIsEditingLocalBpm(true)}
                                                style={{ padding: '5px 10px', background: inputBg, border: `1px solid ${borderColor}`, borderRadius: '5px', color: ac, fontSize: '13px', fontWeight: '900', cursor: 'ns-resize', textAlign: 'center', minWidth: '42px', transition: 'background 0.2s', display: 'inline-block' }}
                                                title={t('lyricsStudio.bpmDragTooltip')}
                                            >{localBpm}</div>
                                        )}
                                        <button onClick={handleLocalTapTempo} style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: '12px', color: textSecondary, fontSize: '9px', fontWeight: '800', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.1s', lineHeight: 1, whiteSpace: 'nowrap' }} title={t('lyricsStudio.tapToSetTempo')}>{t('lyricsStudio.tap')}</button>
                                    </div>
                                </div>
                                <div style={{ flex: '0 0 auto' }}>
                                    <div style={{ fontSize: '9px', color: textSecondary, marginBottom: '3px', fontWeight: 600, letterSpacing: '0.5px' }}>{t('lyricsStudio.rhymeScheme')}</div>
                                    <select
                                        value={localRhymeScheme}
                                        onChange={(e) => setLocalRhymeScheme(e.target.value)}
                                        style={{
                                            padding: '6px 8px', borderRadius: '5px',
                                            background: inputBg, border: `1px solid ${borderColor}`,
                                            color: textPrimary, fontSize: '11px', outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="AABB">{t('lyricsStudio.aabbCouplets')}</option>
                                        <option value="ABAB">{t('lyricsStudio.ababAlternate')}</option>
                                        <option value="ABCB">{t('lyricsStudio.abcbBallad')}</option>
                                        <option value="AABA">{t('lyricsStudio.aabaClassic')}</option>
                                        <option value="ABBA">{t('lyricsStudio.abbaEnclosed')}</option>
                                    </select>
                                </div>
                            </div>
                            <textarea
                                value={hookLines}
                                onChange={(e) => { setHookLines(e.target.value); setOptimizedResult(null); }}
                                placeholder={t('lyricsStudio.hookPlaceholder')}
                                rows={8}
                                style={{
                                    width: '100%', background: inputBg, border: `1px solid ${borderColor}`,
                                    borderRadius: '8px', padding: '12px', color: textPrimary,
                                    fontSize: '14px', lineHeight: '1.8', resize: 'vertical',
                                    fontFamily: 'inherit', outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = ac}
                                onBlur={(e) => e.target.style.borderColor = borderColor}
                            />
                            {/* Refine / Fresh toggle + Optimize button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                                <div style={{
                                    display: 'flex', borderRadius: '6px', overflow: 'hidden',
                                    border: `1px solid ${borderColor}`
                                }}>
                                    <button
                                        onClick={() => setOptimizeMode('refine')}
                                        style={{
                                            padding: '8px 14px', border: 'none', cursor: 'pointer',
                                            background: optimizeMode === 'refine' ? hexToRgba(ac, 0.2) : 'transparent',
                                            color: optimizeMode === 'refine' ? ac : textSecondary,
                                            fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {t('lyricsStudio.refine')}
                                    </button>
                                    <button
                                        onClick={() => setOptimizeMode('fresh')}
                                        style={{
                                            padding: '8px 14px', border: 'none', cursor: 'pointer',
                                            borderLeft: `1px solid ${borderColor}`,
                                            background: optimizeMode === 'fresh' ? hexToRgba(ac, 0.2) : 'transparent',
                                            color: optimizeMode === 'fresh' ? ac : textSecondary,
                                            fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {t('lyricsStudio.fresh')}
                                    </button>
                                </div>
                                <button
                                    onClick={handleOptimizeHook}
                                    disabled={hookLinesParsed.length === 0}
                                    style={{
                                        padding: '10px 24px',
                                        background: hookLinesParsed.length > 0 ? acGrad : (isDark ? 'rgba(255,255,255,0.05)' : '#ddd'),
                                        border: 'none', borderRadius: '6px', cursor: hookLinesParsed.length > 0 ? 'pointer' : 'not-allowed',
                                        color: hookLinesParsed.length > 0 ? '#fff' : textSecondary,
                                        fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px',
                                        boxShadow: hookLinesParsed.length > 0 ? `0 0 15px ${hexToRgba(ac, 0.3)}` : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {t('lyricsStudio.optimizeHook')}
                                </button>
                            </div>
                            <div style={{ fontSize: '9px', color: textSecondary, marginTop: '6px' }}>
                                {optimizeMode === 'refine'
                                    ? t('lyricsStudio.refineDesc')
                                    : t('lyricsStudio.freshDesc')}
                                {effectiveGenre && <span style={{ color: ac, marginLeft: '6px' }}>{t('lyricsStudio.genreLabel')} {effectiveGenre}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Hook Score & Results */}
                    <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
                        {/* Live Score */}
                        {hookScore && (
                            <div style={{
                                background: cardBg, borderRadius: '10px', padding: '16px',
                                border: `1px solid ${borderColor}`, marginBottom: '16px'
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '12px' }}>
                                    {t('lyricsStudio.hookScore')}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                                    <ScoreMeter label={t('lyricsStudio.overall')} value={hookScore.total} color={ac} />
                                </div>
                                <BreakdownBar label={t('lyricsStudio.repetition')} value={hookScore.repetitionRatio * 100} />
                                <BreakdownBar label={t('lyricsStudio.simplicity')} value={hookScore.simplicityIndex * 100} />
                                <BreakdownBar label={t('lyricsStudio.phoneticPunch')} value={hookScore.phoneticPunch * 100} />
                                <BreakdownBar label={t('lyricsStudio.emotionalClarity')} value={hookScore.emotionalClarity * 100} />
                                <BreakdownBar label={t('lyricsStudio.rhymeDensity')} value={hookScore.rhymeDensity * 100} />
                                <BreakdownBar label={t('lyricsStudio.vowelOpenness')} value={hookScore.vowelOpenness * 100} />
                            </div>
                        )}

                        {/* Optimization Result */}
                        {optimizedResult && (
                            <div style={{
                                background: cardBg, borderRadius: '10px', padding: '16px',
                                border: `1px solid ${borderColor}`
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '12px' }}>
                                    {t('lyricsStudio.optimizationResult')}
                                </div>
                                {/* Before / After Score */}
                                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '16px' }}>
                                    <ScoreMeter label={t('lyricsStudio.before')} value={optimizedResult.hookScoreBefore / 100} color={textSecondary} />
                                    <div style={{ display: 'flex', alignItems: 'center', color: textSecondary, fontSize: '20px' }}>
                                        &rarr;
                                    </div>
                                    <ScoreMeter label={t('lyricsStudio.after')} value={optimizedResult.hookScoreAfter / 100}
                                        color={optimizedResult.hookScoreAfter > optimizedResult.hookScoreBefore ? '#22c55e' : ac} />
                                </div>
                                {/* Improved lines */}
                                <div style={{
                                    background: inputBg, borderRadius: '8px', padding: '12px',
                                    border: `1px solid ${borderColor}`, marginBottom: '12px'
                                }}>
                                    {optimizedResult.improvedLines.map((line, i) => (
                                        <div key={i} style={{ fontSize: '13px', lineHeight: '1.8', color: textPrimary }}>{line}</div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleApplyOptimized}
                                    style={{
                                        padding: '8px 20px', background: '#22c55e', border: 'none',
                                        borderRadius: '6px', cursor: 'pointer', color: '#fff',
                                        fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px'
                                    }}
                                >
                                    {t('lyricsStudio.applyChanges')}
                                </button>
                            </div>
                        )}

                        {!hookScore && !optimizedResult && (
                            <div style={{
                                background: cardBg, borderRadius: '10px', padding: '40px 20px',
                                border: `1px solid ${borderColor}`, textAlign: 'center', color: textSecondary, fontSize: '13px'
                            }}>
                                {t('lyricsStudio.enterHookToScore')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ======== HIT POTENTIAL PANEL ======== */}
            {activePanel === 'hit' && (
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Circular Progress + Overall */}
                    <div style={{ flex: '0 0 280px' }}>
                        <div style={{
                            background: cardBg, borderRadius: '10px', padding: '24px',
                            border: `1px solid ${borderColor}`, textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '16px' }}>
                                {t('lyricsStudio.hitProbability')}
                            </div>
                            {hitResult ? (
                                <>
                                    <CircularProgress percent={hitResult.hitProbabilityPercent} />
                                    <div style={{
                                        fontSize: '11px', color: textSecondary, marginTop: '12px',
                                        padding: '6px 12px', borderRadius: '4px',
                                        background: hexToRgba(getHitColor(hitResult.hitProbabilityPercent), 0.1)
                                    }}>
                                        {hitResult.hitProbabilityPercent >= 75 ? t('lyricsStudio.strongCommercial') :
                                         hitResult.hitProbabilityPercent >= 50 ? t('lyricsStudio.moderatePotential') :
                                         t('lyricsStudio.needsWork')}
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '40px 0', color: textSecondary, fontSize: '13px' }}>
                                    {t('lyricsStudio.enterLyricsForHit')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Breakdown + Suggestions */}
                    <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
                        {hitResult ? (
                            <>
                                {/* Breakdown bars */}
                                <div style={{
                                    background: cardBg, borderRadius: '10px', padding: '16px',
                                    border: `1px solid ${borderColor}`, marginBottom: '16px'
                                }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '12px' }}>
                                        {t('lyricsStudio.metricBreakdown')}
                                    </div>
                                    <BreakdownBar label={t('lyricsStudio.hookStrength')} value={hitResult.breakdown.hookScore} />
                                    <BreakdownBar label={t('lyricsStudio.simplicity')} value={hitResult.breakdown.simplicity} />
                                    <BreakdownBar label={t('lyricsStudio.emotionalClarity')} value={hitResult.breakdown.emotionalClarity} />
                                    <BreakdownBar label={t('lyricsStudio.repetitionBalance')} value={hitResult.breakdown.repetitionBalance} />
                                    <BreakdownBar label={t('lyricsStudio.genreTrend')} value={hitResult.breakdown.genreTrendWeight} />
                                    <BreakdownBar label={t('lyricsStudio.flowConsistency')} value={hitResult.breakdown.flowConsistency} />
                                    <BreakdownBar label={t('lyricsStudio.originality')} value={hitResult.breakdown.originalityIndex} />
                                </div>

                                {/* Strengths & Weaknesses */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{
                                        flex: 1, background: cardBg, borderRadius: '10px', padding: '12px',
                                        border: `1px solid ${borderColor}`
                                    }}>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#22c55e', letterSpacing: '1px', marginBottom: '8px' }}>
                                            {t('lyricsStudio.strengths')}
                                        </div>
                                        {hitResult.strengths.length > 0 ? hitResult.strengths.map((s, i) => (
                                            <div key={i} style={{ fontSize: '11px', color: textPrimary, marginBottom: '4px' }}>
                                                + {s}
                                            </div>
                                        )) : (
                                            <div style={{ fontSize: '11px', color: textSecondary }}>{t('lyricsStudio.noneYet')}</div>
                                        )}
                                    </div>
                                    <div style={{
                                        flex: 1, background: cardBg, borderRadius: '10px', padding: '12px',
                                        border: `1px solid ${borderColor}`
                                    }}>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#ef4444', letterSpacing: '1px', marginBottom: '8px' }}>
                                            {t('lyricsStudio.weaknesses')}
                                        </div>
                                        {hitResult.weaknesses.length > 0 ? hitResult.weaknesses.map((w, i) => (
                                            <div key={i} style={{ fontSize: '11px', color: textPrimary, marginBottom: '4px' }}>
                                                - {w}
                                            </div>
                                        )) : (
                                            <div style={{ fontSize: '11px', color: textSecondary }}>{t('lyricsStudio.noneWeaknesses')}</div>
                                        )}
                                    </div>
                                </div>

                                {/* Suggestions */}
                                <div style={{
                                    background: cardBg, borderRadius: '10px', padding: '12px',
                                    border: `1px solid ${borderColor}`
                                }}>
                                    <div style={{ fontSize: '10px', fontWeight: '700', color: ac, letterSpacing: '1px', marginBottom: '8px' }}>
                                        {t('lyricsStudio.improvementSuggestions')}
                                    </div>
                                    {hitResult.improvementSuggestions.map((s, i) => (
                                        <div key={i} style={{ fontSize: '11px', color: textPrimary, marginBottom: '6px', paddingLeft: '12px', borderLeft: `2px solid ${hexToRgba(ac, 0.3)}` }}>
                                            {s}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={{
                                background: cardBg, borderRadius: '10px', padding: '40px 20px',
                                border: `1px solid ${borderColor}`, textAlign: 'center', color: textSecondary, fontSize: '13px'
                            }}>
                                {t('lyricsStudio.enterLyricsForHitAnalysis')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
