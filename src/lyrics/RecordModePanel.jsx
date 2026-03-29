import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { hexToRgba } from '../accentThemes';
import {
    generateSong,
    regenerateSection,
    exportLyrics,
    getAvailableStructures,
} from './engine/LyricEngine';
import { countLineSyllables } from './engine/SyllableBalancer';
import { detectRhymePattern } from './engine/RhymeEngine';
import { optimizeHook } from './HookOptimizer';
import { formatAsProject, downloadFile } from './engine/ExportFormatter';
import { useTranslation } from '../i18n/I18nContext.jsx';
import { preloadPhraseBank, getAvailableGenres, resolveLangCode } from './engine/PhraseLoader';
import Teleprompter from './Teleprompter';

const GENRES = ['Pop', 'Hip Hop', 'Rock', 'Country', 'R&B', 'EDM', 'Indie', 'Folk', 'Metal', 'Jazz', 'K-Pop', 'Latin', 'Gospel'];
const LYRIC_LANGUAGES = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
    'Japanese', 'Korean', 'Chinese', 'Russian', 'Arabic', 'Hindi',
    'Dutch', 'Polish', 'Turkish', 'Swedish', 'Norwegian', 'Danish',
    'Finnish', 'Czech', 'Romanian', 'Hungarian', 'Thai', 'Vietnamese',
    'Indonesian', 'Ukrainian', 'Greek', 'Hebrew',
];
const LANG_CODE_TO_NAME = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean',
    zh: 'Chinese', ru: 'Russian', ar: 'Arabic', hi: 'Hindi',
    nl: 'Dutch', pl: 'Polish', tr: 'Turkish', sv: 'Swedish',
    nb: 'Norwegian', da: 'Danish', fi: 'Finnish', cs: 'Czech',
    ro: 'Romanian', hu: 'Hungarian', th: 'Thai', vi: 'Vietnamese',
    id: 'Indonesian', uk: 'Ukrainian', el: 'Greek', he: 'Hebrew',
};
const NAME_TO_LANG_CODE = Object.fromEntries(Object.entries(LANG_CODE_TO_NAME).map(([k, v]) => [v, k]));
const RTL_LANGUAGES = new Set(['Arabic', 'Hebrew', 'Persian', 'Urdu']);
const MOODS = ['Happy', 'Sad', 'Romantic', 'Aggressive', 'Dreamy', 'Dark', 'Epic', 'Hopeful', 'Melancholic'];
const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SCALES = ['Major', 'Minor', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian'];
const RHYME_SCHEMES = ['AABB', 'ABAB', 'AAAA', 'Freeform'];
const STRUCTURES = getAvailableStructures();

// ── Compact sub-components ──

function RMSelect({ label, value, onChange, options, inputBg, borderColor, textPrimary, textSecondary, isDark }) {
    return (
        <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: '700', color: textSecondary, letterSpacing: '0.5px', marginBottom: '2px', textTransform: 'uppercase' }}>
                {label}
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%', padding: '5px 8px', background: inputBg,
                    border: `1px solid ${borderColor}`, borderRadius: '4px',
                    color: textPrimary, fontSize: '11px', cursor: 'pointer',
                    outline: 'none', appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='${isDark ? '%23888' : '%23666'}' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 6px center',
                    paddingRight: '22px',
                }}
            >
                {options.map(opt => {
                    const val = typeof opt === 'string' ? opt : opt.key || opt.value;
                    const lbl = typeof opt === 'string' ? opt : opt.label;
                    return <option key={val} value={val}>{lbl}</option>;
                })}
            </select>
        </div>
    );
}

function RMSlider({ label, value, onChange, min, max, suffix, textSecondary, ac, isDark }) {
    return (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <label style={{ fontSize: '9px', fontWeight: '700', color: textSecondary, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</label>
                <span style={{ fontSize: '11px', fontWeight: '700', color: ac }}>{value}{suffix || ''}</span>
            </div>
            <input
                type="range" min={min} max={max} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{
                    width: '100%', height: '3px', appearance: 'none',
                    background: isDark ? 'rgba(255,255,255,0.1)' : '#ddd',
                    borderRadius: '2px', outline: 'none', cursor: 'pointer', accentColor: ac,
                }}
            />
        </div>
    );
}

function StatBadge({ label, value, color, isDark, textSecondary }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '2px 6px', borderRadius: '4px',
            background: isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f5',
        }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color }}>{value}</span>
            <span style={{ fontSize: '7px', color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        </div>
    );
}

// ── Main component ──

export default function RecordModePanel({
    theme = 'dark',
    accentColors,
    globalKey = 'C',
    globalScale = 'major',
    globalTempo = 120,
    globalBars = 4,
    globalGenre = '',
    globalMood = '',
    melodyNotes = [],
    onClose,
    initialLyrics = null,
    globalIsPlaying = false,
    globalCurrentStep = 0,
    globalContinuousProgress = 0,
    isRecording = false,
    isCountingIn = false,
    metronomeEnabled = false,
    setMetronomeEnabled,
    metronomeVolume = 0.5,
    setMetronomeVolume,
    recordingStartBar = 0,
}) {
    const { t } = useTranslation();
    const isDark = theme === 'dark';
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || `linear-gradient(135deg, ${ac}, ${acSec})`;

    const { language: uiLanguage, getLanguageName } = useTranslation();

    // Settings state
    const [genre, setGenre] = useState(globalGenre || 'Pop');
    const [mood, setMood] = useState(globalMood || 'Happy');
    const [songKey, setSongKey] = useState(globalKey);
    const [scale, setScale] = useState(globalScale);
    const [bpm, setBpm] = useState(globalTempo);
    const [syncBpm, setSyncBpm] = useState(true);
    const [structureKey, setStructureKey] = useState('verse-chorus-verse-chorus');
    const [rhymeScheme, setRhymeScheme] = useState('AABB');
    const [lyricLanguage, setLyricLanguage] = useState(() => LANG_CODE_TO_NAME[uiLanguage] || 'English');
    const isRtl = RTL_LANGUAGES.has(lyricLanguage);
    const [creativity, setCreativity] = useState(50);
    const [usePunchlines, setUsePunchlines] = useState(false);

    // Generation state
    const [song, setSong] = useState(initialLyrics);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [hookMode, setHookMode] = useState('refine');

    // Settings panel toggle
    const [showSettings, setShowSettings] = useState(false);

    // Teleprompter toggle
    const [showTeleprompter, setShowTeleprompter] = useState(false);

    // File input ref for loading lyrics
    const fileInputRef = useRef(null);

    // Sync BPM/key/scale with global values
    useEffect(() => {
        if (syncBpm) setBpm(globalTempo);
    }, [globalTempo, syncBpm]);
    useEffect(() => { setSongKey(globalKey); }, [globalKey]);
    useEffect(() => { setScale(globalScale); }, [globalScale]);

    // Accept new initialLyrics when they change
    useEffect(() => {
        if (initialLyrics) setSong(initialLyrics);
    }, [initialLyrics]);

    // Sync lyric generation language with UI language
    useEffect(() => {
        const mapped = LANG_CODE_TO_NAME[uiLanguage];
        if (mapped) setLyricLanguage(mapped);
    }, [uiLanguage]);

    // Preload phrase bank when lyric language changes
    useEffect(() => {
        const code = NAME_TO_LANG_CODE[lyricLanguage];
        if (code && code !== 'en') {
            preloadPhraseBank(code).catch(() => {});
        }
    }, [lyricLanguage]);

    // Filter genres based on what the selected language actually supports
    const filteredGenres = useMemo(() => {
        const code = NAME_TO_LANG_CODE[lyricLanguage];
        const available = getAvailableGenres(code);
        if (!available) return GENRES;
        return GENRES.filter(g => {
            const key = g.toLowerCase().replace(/[\s-]/g, '');
            return available.includes(key);
        });
    }, [lyricLanguage]);

    useEffect(() => {
        if (filteredGenres.length > 0 && !filteredGenres.includes(genre)) {
            setGenre(filteredGenres[0]);
        }
    }, [filteredGenres, genre]);

    // Auto-regenerate lyrics when language changes (if song already exists)
    const prevLyricLangRef = useRef(lyricLanguage);
    useEffect(() => {
        if (prevLyricLangRef.current === lyricLanguage) return;
        prevLyricLangRef.current = lyricLanguage;
        if (!song) return;
        const timer = setTimeout(() => {
            const config = buildConfig();
            const result = generateSong(config);
            setSong(result);
        }, 150);
        return () => clearTimeout(timer);
    }, [lyricLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-select matching structure when hip-hop genres are chosen
    useEffect(() => {
        const g = genre.toLowerCase().replace(/\s+/g, '');
        if (g === 'hiphop') setStructureKey('hip-hop');
    }, [genre]);

    // Theme styles
    const panelBg = isDark ? 'rgba(20, 20, 28, 0.95)' : '#f8f8fa';
    const cardBg = isDark ? 'rgba(30, 30, 40, 0.8)' : '#fff';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e0e0e0';
    const textPrimary = isDark ? '#e0e0e0' : '#222';
    const textSecondary = isDark ? '#888' : '#666';
    const inputBg = isDark ? 'rgba(15, 15, 22, 0.9)' : '#fff';
    const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5';

    const themeProps = { inputBg, borderColor, textPrimary, textSecondary, isDark, ac, acSec };

    const structureOptions = useMemo(() => STRUCTURES.map(s => ({ key: s.key, label: s.label })), []);

    // Build config
    const buildConfig = useCallback(() => ({
        genre: genre.toLowerCase().replace(/\s+/g, ''),
        mood: mood.toLowerCase(),
        key: songKey,
        scale: scale.toLowerCase(),
        bpm,
        melodyPattern: melodyNotes,
        structure: structureKey,
        rhymeScheme,
        language: lyricLanguage,
        creativity,
        globalBars,
        usePunchlines,
    }), [genre, mood, songKey, scale, bpm, melodyNotes, structureKey, rhymeScheme, lyricLanguage, creativity, globalBars, usePunchlines]);

    // Generate
    const handleGenerate = useCallback(() => {
        setIsGenerating(true);
        requestAnimationFrame(() => {
            const config = buildConfig();
            const result = generateSong(config);
            setSong(result);
            setIsGenerating(false);
        });
    }, [buildConfig]);

    // Hook optimizer
    const handleOptimizeHook = useCallback(() => {
        if (!song) return;
        setIsOptimizing(true);
        requestAnimationFrame(() => {
            const newSections = [...song.sections];
            let optimized = false;
            for (let i = 0; i < newSections.length; i++) {
                if (newSections[i].type === 'chorus') {
                    const result = optimizeHook(
                        newSections[i].lines,
                        genre.toLowerCase().replace(/\s+/g, ''),
                        mood.toLowerCase(),
                        hookMode,
                        rhymeScheme
                    );
                    if (result.improvedLines && result.improvedLines.length > 0) {
                        newSections[i] = { ...newSections[i], lines: result.improvedLines };
                        optimized = true;
                    }
                }
            }
            if (optimized) {
                setSong(prev => ({ ...prev, sections: newSections }));
            }
            setIsOptimizing(false);
        });
    }, [song, genre, mood, hookMode, rhymeScheme]);

    // Save lyrics to .wavloom-lyrics file
    const handleSave = useCallback(() => {
        if (!song) return;
        const projectData = formatAsProject(song.sections, song.metadata || {
            genre, mood, key: songKey, scale, bpm, structure: structureKey,
            rhymeScheme, creativity, usePunchlines,
        });
        const content = JSON.stringify(projectData, null, 2);
        downloadFile(content, `lyrics-${Date.now()}.wavloom-lyrics`, 'application/json');
    }, [song, genre, mood, songKey, scale, bpm, structureKey, rhymeScheme, creativity, usePunchlines]);

    // Load lyrics from .wavloom-lyrics file
    const handleLoad = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelect = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.type === 'wavloom-lyrics' && data.sections) {
                    // Reconstruct song object from project file
                    const sections = data.sections.map(s => ({
                        type: s.type,
                        label: s.label,
                        lines: s.lines,
                        timing: s.timing || null,
                    }));
                    // Restore settings if available
                    if (data.settings) {
                        if (data.settings.genre) setGenre(data.settings.genre.charAt(0).toUpperCase() + data.settings.genre.slice(1));
                        if (data.settings.mood) setMood(data.settings.mood.charAt(0).toUpperCase() + data.settings.mood.slice(1));
                        if (data.settings.bpm) { setBpm(data.settings.bpm); setSyncBpm(false); }
                        if (data.settings.key) setSongKey(data.settings.key);
                        if (data.settings.scale) setScale(data.settings.scale);
                        if (data.settings.structure) setStructureKey(data.settings.structure);
                        if (data.settings.rhymeScheme) setRhymeScheme(data.settings.rhymeScheme);
                        if (data.settings.creativity != null) setCreativity(data.settings.creativity);
                        if (data.settings.usePunchlines != null) setUsePunchlines(data.settings.usePunchlines);
                    }
                    setSong({
                        sections,
                        metadata: data.settings || {},
                        analysis: computeAnalysis(sections),
                    });
                }
            } catch (err) {
                console.error('[RecordMode] Failed to load lyrics file:', err);
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be re-selected
        e.target.value = '';
    }, []);

    // Compute analysis for loaded lyrics
    const computeAnalysis = useCallback((sections) => {
        let totalLines = 0;
        let totalSyllables = 0;
        let rhymeTotal = 0;
        let rhymeCount = 0;
        let hookTotal = 0;
        let hookCount = 0;

        for (const s of sections) {
            totalLines += s.lines.length;
            for (const line of s.lines) {
                totalSyllables += countLineSyllables(line);
            }
            if (s.lines.length >= 2) {
                const pattern = detectRhymePattern(s.lines);
                const matching = pattern.split('').filter(c => c !== 'X').length;
                rhymeTotal += (matching / s.lines.length) * 100;
                rhymeCount++;
            }
            if (s.type === 'chorus' && s.lines.length > 0) {
                hookTotal += 65; // Default estimate
                hookCount++;
            }
        }

        return {
            totalLines,
            avgSyllablesPerLine: totalLines > 0 ? Math.round(totalSyllables / totalLines) : 0,
            rhymeAccuracy: rhymeCount > 0 ? Math.round(rhymeTotal / rhymeCount) : 0,
            avgHookScore: hookCount > 0 ? Math.round(hookTotal / hookCount) : 0,
            punchlineLines: 0,
        };
    }, []);

    // Rhyme indicators
    const getRhymeIndicators = useCallback((lines) => {
        if (!lines || lines.length < 2) return lines?.map(() => ({ color: textSecondary, symbol: '-' })) || [];
        const pattern = detectRhymePattern(lines);
        const colorMap = {};
        const colors = [ac, acSec, '#22c55e', '#eab308', '#8b5cf6', '#06b6d4'];
        let colorIdx = 0;
        return pattern.split('').map(letter => {
            if (letter === 'X') return { color: textSecondary, symbol: '-' };
            if (!colorMap[letter]) {
                colorMap[letter] = colors[colorIdx % colors.length];
                colorIdx++;
            }
            return { color: colorMap[letter], symbol: letter };
        });
    }, [ac, acSec, textSecondary]);

    const analysis = song?.analysis || null;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: panelBg, color: textPrimary, overflow: 'hidden',
        }}>
            {/* Hidden file input for loading lyrics */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".wavloom-lyrics,.json"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
            />

            {/* Header */}
            <div style={{
                padding: '10px 12px',
                borderBottom: `1px solid ${borderColor}`,
                background: isDark ? 'rgba(15, 15, 22, 0.8)' : '#fff',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: analysis ? '6px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                            animation: 'pulse 2s infinite',
                        }} />
                        <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', color: textPrimary }}>
                            {t('recordMode.title')}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        title={t('recordMode.backToLyricEngine')}
                        style={{
                            padding: '4px 14px', minWidth: '160px', background: 'transparent',
                            border: `1px solid ${borderColor}`, borderRadius: '4px',
                            color: acSec, fontSize: '9px', fontWeight: '700',
                            cursor: 'pointer', letterSpacing: '0.5px',
                            transition: 'all 0.2s', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        {t('recordMode.backToLyricEngine')}
                    </button>
                </div>

                {/* Score badges */}
                {analysis && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <StatBadge label={t('lyricEngine.linesLabel')} value={analysis.totalLines} color={ac} isDark={isDark} textSecondary={textSecondary} />
                        <StatBadge label={t('lyricEngine.rhymeLabel')} value={`${analysis.rhymeAccuracy}%`} color={analysis.rhymeAccuracy >= 70 ? '#22c55e' : '#eab308'} isDark={isDark} textSecondary={textSecondary} />
                        <StatBadge label={t('lyricEngine.hookLabel')} value={`${analysis.avgHookScore}%`} color={analysis.avgHookScore >= 60 ? '#22c55e' : '#eab308'} isDark={isDark} textSecondary={textSecondary} />
                        {analysis.punchlineLines > 0 && (
                            <StatBadge label={t('lyricEngine.punchLabel')} value={analysis.punchlineLines} color={acSec} isDark={isDark} textSecondary={textSecondary} />
                        )}
                    </div>
                )}
            </div>

            {/* Settings toggle + action buttons */}
            <div style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${borderColor}`,
                background: isDark ? 'rgba(18, 18, 26, 0.6)' : '#fafafa',
                flexShrink: 0,
            }}>
                {/* Row 1: Settings toggle + Generate */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        style={{
                            padding: '5px 14px', minWidth: '120px', background: showSettings ? hexToRgba(ac, 0.15) : 'transparent',
                            border: `1px solid ${showSettings ? ac : borderColor}`, borderRadius: '4px',
                            color: showSettings ? ac : textSecondary, fontSize: '9px', fontWeight: '700',
                            cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.2s', whiteSpace: 'nowrap',
                        }}
                    >
                        {t('recordMode.settings')} {showSettings ? '\u25B2' : '\u25BC'}
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        style={{
                            padding: '5px 14px',
                            background: isGenerating ? (isDark ? 'rgba(255,255,255,0.05)' : '#eee') : acGrad,
                            border: 'none', borderRadius: '4px',
                            color: isGenerating ? textSecondary : '#fff',
                            fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px',
                            cursor: isGenerating ? 'wait' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {isGenerating ? t('lyricEngine.generating') : t('lyricEngine.generateLyrics')}
                    </button>
                    <button
                        onClick={() => setShowTeleprompter(true)}
                        disabled={!song}
                        style={{
                            padding: '5px 14px',
                            background: song ? 'rgba(255,57,57,0.15)' : (isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f5'),
                            border: `1px solid ${song ? 'rgba(255,57,57,0.3)' : borderColor}`,
                            borderRadius: '4px',
                            color: song ? '#ff3939' : textSecondary,
                            fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px',
                            cursor: song ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                        }}
                    >
                        {t('teleprompter.open')}
                    </button>
                </div>

                {/* Row 2: Hook Optimizer + Save/Load */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {song && (
                        <>
                            <button
                                onClick={handleOptimizeHook}
                                disabled={isOptimizing || !song.sections?.some(s => s.type === 'chorus')}
                                title={t('recordMode.optimizeTooltip')}
                                style={{
                                    padding: '5px 14px', minWidth: '140px', background: 'transparent',
                                    border: `1px solid ${borderColor}`, borderRadius: '4px',
                                    color: isOptimizing ? textSecondary : ac,
                                    fontSize: '9px', fontWeight: '700', cursor: isOptimizing ? 'wait' : 'pointer',
                                    letterSpacing: '0.5px', transition: 'all 0.2s', whiteSpace: 'nowrap',
                                }}
                            >
                                {isOptimizing ? t('recordMode.optimizing') : t('lyricsStudio.hookOptimizer')}
                            </button>
                            <select
                                value={hookMode}
                                onChange={(e) => setHookMode(e.target.value)}
                                style={{
                                    padding: '4px 6px', background: inputBg,
                                    border: `1px solid ${borderColor}`, borderRadius: '4px',
                                    color: textSecondary, fontSize: '9px', cursor: 'pointer',
                                    outline: 'none',
                                }}
                            >
                                <option value="refine">{t('lyricsStudio.refine')}</option>
                                <option value="fresh">{t('lyricsStudio.fresh')}</option>
                            </select>
                        </>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!song}
                        title={t('recordMode.saveTooltip')}
                        style={{
                            padding: '5px 10px', background: 'transparent',
                            border: `1px solid ${borderColor}`, borderRadius: '4px',
                            color: song ? textPrimary : textSecondary,
                            fontSize: '9px', fontWeight: '700', cursor: song ? 'pointer' : 'default',
                            letterSpacing: '0.5px', transition: 'all 0.2s',
                        }}
                    >
                        {t('lyricEngine.saveLyrics')}
                    </button>
                    <button
                        onClick={handleLoad}
                        title={t('recordMode.loadTooltip')}
                        style={{
                            padding: '5px 10px', background: 'transparent',
                            border: `1px solid ${borderColor}`, borderRadius: '4px',
                            color: textPrimary, fontSize: '9px', fontWeight: '700',
                            cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.2s',
                        }}
                    >
                        {t('lyricEngine.loadLyrics')}
                    </button>
                </div>
            </div>

            {/* Collapsible Settings Panel */}
            {showSettings && (
                <div style={{
                    padding: '10px 12px',
                    borderBottom: `1px solid ${borderColor}`,
                    background: isDark ? 'rgba(15, 15, 22, 0.6)' : '#f5f5f8',
                    maxHeight: '300px', overflowY: 'auto',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                        <RMSelect label={t('lyricEngine.genre')} value={genre} onChange={setGenre} options={filteredGenres} {...themeProps} />
                        <RMSelect label={t('lyricEngine.mood')} value={mood} onChange={setMood} options={MOODS} {...themeProps} />
                        <RMSelect label={t('lyricEngine.key')} value={songKey} onChange={setSongKey} options={KEYS} {...themeProps} />
                        <RMSelect label={t('lyricEngine.scale')} value={scale} onChange={setScale} options={SCALES} {...themeProps} />
                    </div>

                    {/* BPM */}
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontSize: '9px', fontWeight: '700', color: textSecondary, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('lyricEngine.bpm')}</span>
                            <button
                                onClick={() => { const next = !syncBpm; setSyncBpm(next); if (next) setBpm(globalTempo); }}
                                style={{
                                    padding: '2px 6px', background: syncBpm ? hexToRgba(ac, 0.15) : 'transparent',
                                    border: `1px solid ${syncBpm ? ac : borderColor}`, borderRadius: '3px',
                                    color: syncBpm ? ac : textSecondary, fontSize: '8px', fontWeight: '700',
                                    cursor: 'pointer', letterSpacing: '0.5px',
                                }}
                            >
                                {syncBpm ? t('lyricEngine.synced') : t('lyricEngine.manual')}
                            </button>
                        </div>
                        {syncBpm ? (
                            <div style={{ padding: '4px 8px', background: inputBg, border: `1px solid ${borderColor}`, borderRadius: '4px', fontSize: '11px', color: textPrimary }}>
                                {bpm} {t('lyricEngine.bpm')} <span style={{ fontSize: '8px', color: textSecondary }}>({t('lyricEngine.fromGlobal')})</span>
                            </div>
                        ) : (
                            <RMSlider label="" value={bpm} onChange={setBpm} min={60} max={200} {...themeProps} />
                        )}
                    </div>

                    <RMSelect label={t('lyricEngine.structure')} value={structureKey} onChange={setStructureKey} options={structureOptions} {...themeProps} />
                    <RMSelect label={t('lyricEngine.rhymeScheme')} value={rhymeScheme} onChange={setRhymeScheme} options={RHYME_SCHEMES} {...themeProps} />
                    <RMSelect label={t('lyricEngine.language')} value={lyricLanguage} onChange={setLyricLanguage} options={LYRIC_LANGUAGES} {...themeProps} />
                    <RMSlider label={t('lyricEngine.creativity')} value={creativity} onChange={setCreativity} min={0} max={100} suffix="%" textSecondary={textSecondary} ac={ac} isDark={isDark} />

                    {/* Punchlines toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '9px', fontWeight: '700', color: textSecondary, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('lyricEngine.punchlines')}</label>
                        <button
                            onClick={() => setUsePunchlines(!usePunchlines)}
                            style={{
                                padding: '2px 8px', background: usePunchlines ? hexToRgba(ac, 0.15) : 'transparent',
                                border: `1px solid ${usePunchlines ? ac : borderColor}`, borderRadius: '3px',
                                color: usePunchlines ? ac : textSecondary, fontSize: '9px', fontWeight: '700',
                                cursor: 'pointer',
                            }}
                        >
                            {usePunchlines ? t('common.on') : t('common.off')}
                        </button>
                    </div>
                </div>
            )}

            {/* Lyrics Display Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                {!song ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        height: '100%', gap: '12px', color: textSecondary,
                    }}>
                        <div style={{ fontSize: '36px', opacity: 0.3 }}>&#127908;</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', textAlign: 'center', lineHeight: '1.6' }}>
                            {t('recordMode.emptyState')}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {song.sections.map((section, sIdx) => {
                            const sectionTypeColors = {
                                verse: isDark ? '#4ade80' : '#16a34a',
                                chorus: ac,
                                bridge: acSec,
                                prechorus: '#a855f7',
                                intro: '#06b6d4',
                                outro: '#6366f1',
                            };
                            const typeColor = sectionTypeColors[section.type] || textSecondary;
                            const rhymeIndicators = getRhymeIndicators(section.lines);

                            return (
                                <div key={`${section.label}-${sIdx}`} style={{
                                    background: cardBg, borderRadius: '8px',
                                    border: `1px solid ${borderColor}`, overflow: 'hidden',
                                }}>
                                    {/* Section header */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '6px 10px',
                                        borderBottom: `1px solid ${borderColor}`,
                                        background: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{
                                                width: '6px', height: '6px', borderRadius: '50%',
                                                background: typeColor,
                                            }} />
                                            <span style={{ fontSize: '10px', fontWeight: '700', color: typeColor, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                {section.label}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '9px', color: textSecondary }}>
                                            {section.lines.length} {t('common.lines')}
                                        </span>
                                    </div>

                                    {/* Lines */}
                                    <div style={{ padding: '6px 10px', direction: isRtl ? 'rtl' : 'ltr' }}>
                                        {section.lines.map((line, lIdx) => {
                                            const syllables = countLineSyllables(line);
                                            const indicator = rhymeIndicators[lIdx] || { color: textSecondary, symbol: '-' };

                                            return (
                                                <div key={lIdx} style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '3px 0',
                                                    borderBottom: lIdx < section.lines.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f0f0f0'}` : 'none',
                                                }}>
                                                    {/* Line number */}
                                                    <span style={{ fontSize: '8px', color: textSecondary, width: '14px', textAlign: 'right', flexShrink: 0 }}>
                                                        {lIdx + 1}
                                                    </span>
                                                    {/* Rhyme indicator */}
                                                    <span style={{
                                                        fontSize: '9px', fontWeight: '800', color: indicator.color,
                                                        width: '12px', textAlign: 'center', flexShrink: 0,
                                                    }}>
                                                        {indicator.symbol}
                                                    </span>
                                                    {/* Lyric line */}
                                                    <span style={{
                                                        fontSize: '13px', color: textPrimary, flex: 1,
                                                        lineHeight: '1.5', fontWeight: section.type === 'chorus' ? '600' : '400',
                                                        textAlign: isRtl ? 'right' : 'left',
                                                    }}>
                                                        {line}
                                                    </span>
                                                    {/* Syllable count */}
                                                    <span style={{
                                                        fontSize: '8px', color: textSecondary, flexShrink: 0,
                                                        padding: '1px 4px', borderRadius: '3px',
                                                        background: isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f5',
                                                    }}>
                                                        {syllables}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* CSS animation for pulsing record indicator */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>

            {/* Teleprompter overlay */}
            {showTeleprompter && song && (
                <Teleprompter
                    song={song}
                    theme={theme}
                    accentColors={accentColors}
                    globalTempo={bpm}
                    globalBars={globalBars}
                    globalIsPlaying={globalIsPlaying}
                    globalCurrentStep={globalCurrentStep}
                    globalContinuousProgress={globalContinuousProgress}
                    isRecording={isRecording}
                    isCountingIn={isCountingIn}
                    genre={genre}
                    lyricLanguage={lyricLanguage}
                    recordingStartBar={recordingStartBar}
                    metronomeEnabled={metronomeEnabled}
                    setMetronomeEnabled={setMetronomeEnabled}
                    metronomeVolume={metronomeVolume}
                    setMetronomeVolume={setMetronomeVolume}
                    onClose={() => setShowTeleprompter(false)}
                />
            )}
        </div>
    );
}
