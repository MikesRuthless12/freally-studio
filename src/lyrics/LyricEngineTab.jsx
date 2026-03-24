import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { hexToRgba } from '../accentThemes';
import {
    generateSong,
    regenerateSection,
    exportLyrics,
    getAvailableStructures,
    registerPlugin,
    getPlugins,
} from './engine/LyricEngine';
import { countLineSyllables } from './engine/SyllableBalancer';
import { wordsRhyme, getLastWord, detectRhymePattern } from './engine/RhymeEngine';
import { formatAsProject, downloadFile } from './engine/ExportFormatter';
import { useTranslation } from '../i18n/I18nContext.jsx';
import { preloadPhraseBank, resolveLangCode } from './engine/PhraseLoader';

const GENRES = ['Pop', 'Hip Hop', 'Rock', 'Country', 'R&B', 'EDM', 'Indie', 'Folk', 'Metal', 'Jazz', 'K-Pop', 'Latin', 'Gospel'];
const MOODS = ['Happy', 'Sad', 'Romantic', 'Aggressive', 'Dreamy', 'Dark', 'Epic', 'Hopeful', 'Melancholic'];
const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SCALES = ['Major', 'Minor', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian'];
const RHYME_SCHEMES = ['AABB', 'ABAB', 'AAAA', 'Freeform'];
const LYRIC_LANGUAGES = [
    'English', 'Arabic', 'Chinese', 'French', 'German',
    'Italian', 'Japanese', 'Korean', 'Portuguese', 'Russian',
    'Spanish', 'Custom',
];
const LANG_CODE_TO_NAME = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean',
    zh: 'Chinese', ru: 'Russian', ar: 'Arabic', hi: 'Hindi',
    nl: 'Dutch', pl: 'Polish', tr: 'Turkish', sv: 'Swedish',
    nb: 'Norwegian', da: 'Danish', fi: 'Finnish', cs: 'Czech',
    ro: 'Romanian', hu: 'Hungarian', th: 'Thai', vi: 'Vietnamese',
    id: 'Indonesian', uk: 'Ukrainian', el: 'Greek', he: 'Hebrew',
    sk: 'Slovak', ms: 'Malay', hr: 'Croatian', ca: 'Catalan',
    bg: 'Bulgarian', sr: 'Serbian', lt: 'Lithuanian', lv: 'Latvian',
    sl: 'Slovenian', et: 'Estonian', gl: 'Galician', af: 'Afrikaans',
    az: 'Azerbaijani', bs: 'Bosnian', mk: 'Macedonian', tl: 'Filipino',
    be: 'Belarusian',
};
const NAME_TO_LANG_CODE = Object.fromEntries(Object.entries(LANG_CODE_TO_NAME).map(([k, v]) => [v, k]));
const MELODY_MODES = ['Auto Detect', 'Manual Pattern', 'Import MIDI'];
const STRUCTURES = getAvailableStructures();
const EXPORT_FORMATS = [
    { key: 'txt', label: 'TXT' },
    { key: 'lrc', label: 'LRC (Timed)' },
    { key: 'json', label: 'JSON' },
    { key: 'project', label: 'Project' },
];

// ── Stable sub-components (defined outside to avoid remount on parent render) ──

function LESelect({ label, value, onChange, options, inputBg, borderColor, textPrimary, textSecondary, isDark, title }) {
    return (
        <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' }}>
                {label}
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                title={title || label}
                style={{
                    width: '100%', padding: '8px 10px', background: inputBg,
                    border: `1px solid ${borderColor}`, borderRadius: '6px',
                    color: textPrimary, fontSize: '12px', cursor: 'pointer',
                    outline: 'none', appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${isDark ? '%23888' : '%23666'}' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 8px center',
                    paddingRight: '28px',
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

function LESlider({ label, value, onChange, min, max, suffix, textSecondary, ac, isDark }) {
    return (
        <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {label}
                </label>
                <span style={{ fontSize: '12px', fontWeight: '700', color: ac }}>{value}{suffix || ''}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{
                    width: '100%', height: '4px', appearance: 'none',
                    background: isDark ? 'rgba(255,255,255,0.1)' : '#ddd',
                    borderRadius: '2px', outline: 'none', cursor: 'pointer',
                    accentColor: ac,
                }}
            />
        </div>
    );
}

function SectionCard({ section, sectionIndex, isLocked, rhymeIndicators, isDark, ac, acSec, cardBg, borderColor, textPrimary, textSecondary, hoverBg, onRegenerate, onToggleLock, onLineEdit, t, isNonEnglish }) {
    const sectionTypeColors = {
        verse: isDark ? '#4ade80' : '#16a34a',
        chorus: ac,
        bridge: acSec,
        prechorus: '#a855f7',
        intro: '#06b6d4',
        outro: '#6366f1',
    };
    const typeColor = sectionTypeColors[section.type] || textSecondary;

    return (
        <div style={{
            background: cardBg,
            borderRadius: '10px',
            border: `1px solid ${isLocked ? hexToRgba(ac, 0.3) : borderColor}`,
            marginBottom: '12px',
            overflow: 'hidden',
            transition: 'border-color 0.2s',
        }}>
            {/* Section header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px',
                borderBottom: `1px solid ${borderColor}`,
                background: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: typeColor,
                        boxShadow: `0 0 6px ${hexToRgba(typeColor, 0.4)}`,
                    }} />
                    <span style={{ fontSize: '11px', fontWeight: '800', color: textPrimary, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {section.label}
                    </span>
                    <span style={{
                        fontSize: '9px', color: textSecondary,
                        padding: '2px 6px', borderRadius: '3px',
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0',
                    }}>
                        {section.lines.length} {t ? t('common.lines') : 'lines'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => onRegenerate(sectionIndex)}
                        disabled={isLocked}
                        title={t ? t('lyricEngine.regenerateSection') : 'Regenerate section'}
                        style={{
                            padding: '4px 8px', background: 'transparent',
                            border: `1px solid ${borderColor}`, borderRadius: '4px',
                            color: isLocked ? textSecondary : textPrimary,
                            fontSize: '10px', cursor: isLocked ? 'not-allowed' : 'pointer',
                            opacity: isLocked ? 0.4 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        {t ? t('lyricEngine.gen') : 'GEN'}
                    </button>
                    <button
                        onClick={() => onToggleLock(sectionIndex)}
                        title={isLocked ? (t ? t('common.unlock') : 'Unlock section') : (t ? t('common.lock') : 'Lock section')}
                        style={{
                            padding: '4px 8px', background: isLocked ? hexToRgba(ac, 0.15) : 'transparent',
                            border: `1px solid ${isLocked ? hexToRgba(ac, 0.3) : borderColor}`,
                            borderRadius: '4px',
                            color: isLocked ? ac : textSecondary,
                            fontSize: '10px', cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {isLocked ? (t ? t('common.locked') : 'LOCKED') : (t ? t('common.lock') : 'LOCK')}
                    </button>
                </div>
            </div>

            {/* Lines */}
            <div style={{ padding: '10px 14px' }}>
                {section.lines.map((line, lineIdx) => {
                    const syllables = countLineSyllables(line);
                    const rhymeInd = rhymeIndicators[lineIdx] || { color: textSecondary, symbol: '-' };
                    const timing = section.timing?.[lineIdx];

                    return (
                        <div key={lineIdx} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '8px',
                            padding: '6px 0',
                            borderBottom: lineIdx < section.lines.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f0f0f0'}` : 'none',
                        }}>
                            <span style={{
                                fontSize: '9px', color: textSecondary, fontWeight: '600',
                                minWidth: '16px', textAlign: 'right', paddingTop: '4px',
                            }}>
                                {lineIdx + 1}
                            </span>

                            <input
                                type="text"
                                value={line}
                                onChange={(e) => onLineEdit(sectionIndex, lineIdx, e.target.value)}
                                disabled={isLocked}
                                style={{
                                    flex: 1, background: 'transparent', border: 'none',
                                    color: textPrimary, fontSize: '13px', lineHeight: '1.6',
                                    padding: '2px 4px', borderRadius: '4px', outline: 'none',
                                    fontFamily: 'inherit',
                                    opacity: isLocked ? 0.7 : 1,
                                }}
                                onFocus={(e) => { if (!isLocked) e.target.style.background = hoverBg; }}
                                onBlur={(e) => { e.target.style.background = 'transparent'; }}
                            />

                            {!isNonEnglish && <span style={{
                                fontSize: '9px', color: textSecondary,
                                padding: '3px 5px', borderRadius: '3px',
                                background: isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
                                whiteSpace: 'nowrap', fontWeight: '600',
                            }}>
                                {syllables} {t ? t('lyricEngine.syl') : 'syl'}
                            </span>}

                            {!isNonEnglish && <span style={{
                                fontSize: '10px', fontWeight: '800', color: rhymeInd.color,
                                minWidth: '14px', textAlign: 'center', paddingTop: '3px',
                            }}>
                                {rhymeInd.symbol}
                            </span>}

                            {timing && (
                                <span style={{
                                    fontSize: '8px', color: textSecondary,
                                    padding: '3px 4px', borderRadius: '3px',
                                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f8f8f8',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {formatMs(timing.startMs)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function StatBadge({ label, value, color, isDark, textSecondary }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '2px 8px', borderRadius: '4px',
            background: isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f5',
        }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color }}>{value}</span>
            <span style={{ fontSize: '8px', color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        </div>
    );
}

function formatMs(ms) {
    const s = ms / 1000;
    const min = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return min > 0 ? `${min}:${sec.padStart(4, '0')}` : `${sec}s`;
}

// ── Main component ──

export default function LyricEngineTab({
    theme = 'dark',
    accentColors,
    globalKey = 'C',
    globalScale = 'major',
    globalTempo = 120,
    globalBars = 4,
    melodyNotes = [],
    genre: parentGenre = '',
    mood: parentMood = '',
    onSendToLyrics,
    onEnterRecordMode,
}) {
    const isDark = theme === 'dark';
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || `linear-gradient(135deg, ${ac}, ${acSec})`;

    const { t, language: uiLanguage, getLanguageName } = useTranslation();

    // Settings state
    const [genre, setGenre] = useState(parentGenre || 'Pop');
    const [mood, setMood] = useState(parentMood || 'Happy');
    const [songKey, setSongKey] = useState(globalKey);
    const [scale, setScale] = useState(globalScale);
    const [bpm, setBpm] = useState(globalTempo);
    const [syncBpm, setSyncBpm] = useState(true);
    const [melodyMode, setMelodyMode] = useState('Auto Detect');
    const [structureKey, setStructureKey] = useState('verse-chorus-verse-chorus');
    const [rhymeScheme, setRhymeScheme] = useState('AABB');
    const [lyricLanguage, setLyricLanguage] = useState(() => LANG_CODE_TO_NAME[uiLanguage] || 'English');
    const [creativity, setCreativity] = useState(50);
    const [usePunchlines, setUsePunchlines] = useState(false);

    // Maximize/restore state
    const [isMaximized, setIsMaximized] = useState(false);

    // ESC key to exit maximized mode
    useEffect(() => {
        if (!isMaximized) return;
        const handleEsc = (e) => { if (e.key === 'Escape') setIsMaximized(false); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isMaximized]);

    // Generation state
    const [song, setSong] = useState(null);
    const [lockedSections, setLockedSections] = useState(new Set());
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationTime, setGenerationTime] = useState(null);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Sync lyric generation language with UI language when a mapping exists
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

    // Auto-regenerate lyrics when language changes (if song already exists)
    const prevLyricLangRef = useRef(lyricLanguage);
    useEffect(() => {
        if (prevLyricLangRef.current === lyricLanguage) return;
        prevLyricLangRef.current = lyricLanguage;
        if (!song) return;
        let cancelled = false;
        // Await phrase bank preload, then regenerate
        (async () => {
            const langCode = resolveLangCode(lyricLanguage);
            if (langCode !== 'en') {
                await preloadPhraseBank(langCode);
            }
            if (cancelled) return;
            const config = buildConfig();
            const result = generateSong(config);
            // Preserve locked sections
            if (lockedSections.size > 0) {
                for (const idx of lockedSections) {
                    if (idx < result.sections.length && idx < song.sections.length) {
                        result.sections[idx] = song.sections[idx];
                    }
                }
            }
            setSong(result);
            setGenerationTime(result.metadata.generationTimeMs);
        })();
        return () => { cancelled = true; };
    }, [lyricLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-select matching structure when hip-hop genres are chosen
    useEffect(() => {
        const g = genre.toLowerCase().replace(/\s+/g, '');
        if (g === 'hiphop') setStructureKey('hip-hop');
    }, [genre]);

    // Sync BPM, key, and scale with global values when sync is enabled
    useEffect(() => {
        if (syncBpm) setBpm(globalTempo);
    }, [globalTempo, syncBpm]);
    useEffect(() => { setSongKey(globalKey); }, [globalKey]);
    useEffect(() => { setScale(globalScale); }, [globalScale]);

    // Ref for scroll container
    const workspaceRef = useRef(null);

    // Ref for lyrics file input (save/load)
    const lyricsFileInputRef = useRef(null);

    // Theme styles
    const panelBg = isDark ? 'rgba(20, 20, 28, 0.9)' : '#f8f8fa';
    const cardBg = isDark ? 'rgba(30, 30, 40, 0.8)' : '#fff';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e0e0e0';
    const textPrimary = isDark ? '#e0e0e0' : '#222';
    const textSecondary = isDark ? '#888' : '#666';
    const inputBg = isDark ? 'rgba(15, 15, 22, 0.9)' : '#fff';
    const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5';

    // Shared theme props for sub-components
    const themeProps = { inputBg, borderColor, textPrimary, textSecondary, isDark, ac, acSec };

    // Structure options memo
    const structureOptions = useMemo(() => STRUCTURES.map(s => ({ key: s.key, label: s.label })), []);

    // Translated lyric language options — English first, rest sorted alphabetically
    // Show language names in the currently selected LYRIC language (not UI language)
    const lyricLangCode = NAME_TO_LANG_CODE[lyricLanguage] || 'en';
    const lyricLanguageOptions = useMemo(() => {
        const all = LYRIC_LANGUAGES.map(lang => {
            const code = NAME_TO_LANG_CODE[lang];
            return { key: lang, label: code ? getLanguageName(code, lyricLangCode) : t('common.custom') };
        });
        // English first, Custom last, rest sorted by translated label
        const english = all.find(o => o.key === 'English');
        const custom = all.find(o => o.key === 'Custom');
        const rest = all.filter(o => o.key !== 'English' && o.key !== 'Custom')
            .sort((a, b) => a.label.localeCompare(b.label));
        return [english, ...rest, custom].filter(Boolean);
    }, [getLanguageName, t, lyricLangCode]);

    // Build config from current settings
    const buildConfig = useCallback(() => ({
        genre: genre.toLowerCase().replace(/\s+/g, ''),
        mood: mood.toLowerCase(),
        key: songKey,
        scale: scale.toLowerCase(),
        bpm,
        melodyPattern: melodyMode === 'Auto Detect' ? melodyNotes : [],
        structure: structureKey,
        rhymeScheme,
        language: lyricLanguage,
        creativity,
        globalBars,
        usePunchlines,
    }), [genre, mood, songKey, scale, bpm, melodyMode, melodyNotes, structureKey, rhymeScheme, lyricLanguage, creativity, globalBars, usePunchlines]);

    // Generate lyrics
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        // Ensure phrase bank is loaded before generating
        const config = buildConfig();
        const langCode = resolveLangCode(config.language);
        if (langCode !== 'en') {
            await preloadPhraseBank(langCode);
        }
        requestAnimationFrame(() => {
            const result = generateSong(config);

            if (song && lockedSections.size > 0) {
                for (const idx of lockedSections) {
                    if (idx < result.sections.length && idx < song.sections.length) {
                        result.sections[idx] = song.sections[idx];
                    }
                }
            }

            setSong(result);
            setGenerationTime(result.metadata.generationTimeMs);
            setIsGenerating(false);
        });
    }, [buildConfig, song, lockedSections]);

    // Regenerate a single section
    const handleRegenerateSection = useCallback(async (sectionIndex) => {
        if (!song || lockedSections.has(sectionIndex)) return;
        const config = buildConfig();
        const langCode = resolveLangCode(config.language);
        if (langCode !== 'en') {
            await preloadPhraseBank(langCode);
        }
        const result = regenerateSection(song, sectionIndex, config);
        setSong(result);
    }, [song, lockedSections, buildConfig]);

    // Toggle section lock
    const toggleLock = useCallback((sectionIndex) => {
        setLockedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionIndex)) {
                next.delete(sectionIndex);
            } else {
                next.add(sectionIndex);
            }
            return next;
        });
    }, []);

    // Edit a line in a section
    const handleLineEdit = useCallback((sectionIndex, lineIndex, newText) => {
        if (!song) return;
        setSong(prev => {
            const newSections = [...prev.sections];
            const newLines = [...newSections[sectionIndex].lines];
            newLines[lineIndex] = newText;
            newSections[sectionIndex] = { ...newSections[sectionIndex], lines: newLines };
            return { ...prev, sections: newSections };
        });
    }, [song]);

    // Export handler
    const handleExport = useCallback((format) => {
        if (!song) return;
        exportLyrics(song, format, { title: 'WavLoom Song', artist: 'WavLoom User' });
        setShowExportMenu(false);
    }, [song]);

    // Send lyrics to Lyrics Studio — includes genre/mood/bpm for optimizer
    const handleSendToLyrics = useCallback(() => {
        if (!song || !onSendToLyrics) return;
        const text = song.sections.map(s => {
            const header = `[${s.type.charAt(0).toUpperCase() + s.type.slice(1)}]`;
            return header + '\n' + s.lines.join('\n');
        }).join('\n\n');
        onSendToLyrics(text, genre, mood, bpm);
    }, [song, onSendToLyrics, genre, mood, bpm]);

    // Save lyrics to .wavloom-lyrics file
    const handleSaveLyrics = useCallback(() => {
        if (!song) return;
        const projectData = formatAsProject(song.sections, song.metadata || {
            genre: genre.toLowerCase().replace(/\s+/g, ''),
            mood: mood.toLowerCase(), key: songKey, scale: scale.toLowerCase(),
            bpm, structure: structureKey, rhymeScheme, creativity, usePunchlines,
        });
        const content = JSON.stringify(projectData, null, 2);
        downloadFile(content, `lyrics-${Date.now()}.wavloom-lyrics`, 'application/json');
    }, [song, genre, mood, songKey, scale, bpm, structureKey, rhymeScheme, creativity, usePunchlines]);

    // Load lyrics from .wavloom-lyrics file
    const handleLoadLyrics = useCallback(() => {
        lyricsFileInputRef.current?.click();
    }, []);

    const handleLyricsFileSelect = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.type === 'wavloom-lyrics' && data.sections) {
                    const sections = data.sections.map(s => ({
                        type: s.type, label: s.label, lines: s.lines, timing: s.timing || null,
                    }));
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
                    // Recompute analysis
                    let totalLines = 0, totalSyllables = 0, rhymeTotal = 0, rhymeCount = 0, hookTotal = 0, hookCount = 0;
                    for (const s of sections) {
                        totalLines += s.lines.length;
                        for (const line of s.lines) totalSyllables += countLineSyllables(line);
                        if (s.lines.length >= 2) {
                            const p = detectRhymePattern(s.lines);
                            const matching = p.split('').filter(c => c !== 'X').length;
                            rhymeTotal += (matching / s.lines.length) * 100;
                            rhymeCount++;
                        }
                        if (s.type === 'chorus') { hookTotal += 65; hookCount++; }
                    }
                    setSong({
                        sections,
                        metadata: data.settings || {},
                        analysis: {
                            totalLines,
                            avgSyllablesPerLine: totalLines > 0 ? Math.round(totalSyllables / totalLines) : 0,
                            rhymeAccuracy: rhymeCount > 0 ? Math.round(rhymeTotal / rhymeCount) : 0,
                            avgHookScore: hookCount > 0 ? Math.round(hookTotal / hookCount) : 0,
                            punchlineLines: 0,
                        },
                    });
                    setLockedSections(new Set());
                }
            } catch (err) {
                console.error('[LyricEngine] Failed to load lyrics file:', err);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, []);

    // Enter Record Mode
    const handleEnterRecordMode = useCallback(() => {
        if (song && onEnterRecordMode) onEnterRecordMode(song);
    }, [song, onEnterRecordMode]);

    // Compute rhyme indicators for a section's lines
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

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: panelBg, color: textPrimary,
            ...(isMaximized ? {
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 9999, width: '100vw', height: '100vh',
            } : {}),
        }}>
            {/* Hidden file input for loading lyrics */}
            <input
                ref={lyricsFileInputRef}
                type="file"
                accept=".wavloom-lyrics,.json"
                style={{ display: 'none' }}
                onChange={handleLyricsFileSelect}
            />

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: `1px solid ${borderColor}`,
                background: isDark ? 'rgba(15, 15, 22, 0.6)' : '#fff',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', letterSpacing: '1.5px', color: textPrimary }}>
                        {t('lyricEngine.title')}
                    </h2>
                    <span style={{
                        fontSize: '10px', color: textSecondary,
                        padding: '3px 8px', background: hexToRgba(ac, 0.1),
                        borderRadius: '4px', fontWeight: '600',
                    }}>
                        {songKey} {scale} | {bpm} BPM
                    </span>
                    {generationTime !== null && (
                        <span style={{
                            fontSize: '9px', color: '#22c55e',
                            padding: '2px 6px', borderRadius: '3px',
                            background: hexToRgba('#22c55e', 0.1),
                        }}>
                            {generationTime}ms
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {song && song.analysis && (
                        <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
                            <StatBadge label={t('lyricEngine.linesLabel')} value={song.analysis.totalLines} color={ac} isDark={isDark} textSecondary={textSecondary} />
                            <StatBadge label={t('lyricEngine.rhymeLabel')} value={`${song.analysis.rhymeAccuracy}%`} color={song.analysis.rhymeAccuracy >= 70 ? '#22c55e' : '#eab308'} isDark={isDark} textSecondary={textSecondary} />
                            <StatBadge label={t('lyricEngine.hookLabel')} value={`${song.analysis.avgHookScore}%`} color={song.analysis.avgHookScore >= 60 ? '#22c55e' : '#eab308'} isDark={isDark} textSecondary={textSecondary} />
                            {usePunchlines && song.analysis.punchlineLines > 0 && (
                                <StatBadge label={t('lyricEngine.punchLabel')} value={song.analysis.punchlineLines} color={acSec} isDark={isDark} textSecondary={textSecondary} />
                            )}
                        </div>
                    )}
                    {getPlugins().length > 0 && (
                        <span style={{
                            fontSize: '9px', color: acSec, padding: '2px 6px',
                            borderRadius: '3px', background: hexToRgba(acSec, 0.1),
                        }}>
                            {getPlugins().length} {getPlugins().length > 1 ? t('lyricEngine.plugins') : t('lyricEngine.plugin')}
                        </span>
                    )}
                    {/* Maximize / Restore Button */}
                    <button
                        onClick={() => setIsMaximized(prev => !prev)}
                        title={isMaximized ? t('common.restore') : t('common.maximize')}
                        style={{
                            width: '28px', height: '28px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isDark ? hexToRgba(ac, 0.08) : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${isDark ? hexToRgba(ac, 0.2) : '#d0d0d0'}`,
                            borderRadius: '6px',
                            color: ac,
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            marginLeft: '4px',
                            padding: 0,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = hexToRgba(ac, 0.18);
                            e.currentTarget.style.borderColor = ac;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.08) : 'rgba(0,0,0,0.04)';
                            e.currentTarget.style.borderColor = isDark ? hexToRgba(ac, 0.2) : '#d0d0d0';
                        }}
                    >
                        {isMaximized ? '⧉' : '⛶'}
                    </button>
                </div>
            </div>

            {/* Main content area: left panel + right workspace */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* LEFT PANEL — Song Settings */}
                <div style={{
                    width: '240px', minWidth: '240px',
                    borderRight: `1px solid ${borderColor}`,
                    overflowY: 'auto', padding: '14px',
                    background: isDark ? 'rgba(15, 15, 22, 0.4)' : '#fafafa',
                }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: textSecondary, letterSpacing: '1px', marginBottom: '12px' }}>
                        {t('lyricEngine.songSettings')}
                    </div>

                    <LESelect label={t('lyricEngine.genre')} value={genre} onChange={setGenre} options={GENRES} {...themeProps} />
                    <LESelect label={t('lyricEngine.mood')} value={mood} onChange={setMood} options={MOODS} {...themeProps} />
                    <LESelect label={t('lyricEngine.key')} value={songKey} onChange={setSongKey} options={KEYS} {...themeProps} />
                    <LESelect label={t('lyricEngine.scale')} value={scale} onChange={setScale} options={SCALES} {...themeProps} />
                    {/* BPM — synced with global or manual override */}
                    <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '600', color: textSecondary, letterSpacing: '0.5px' }}>{t('lyricEngine.bpm')}</span>
                            <button
                                onClick={() => {
                                    const next = !syncBpm;
                                    setSyncBpm(next);
                                    if (next) setBpm(globalTempo);
                                }}
                                title={syncBpm ? t('lyricEngine.syncedTooltip') : t('lyricEngine.manualTooltip')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '2px 8px', fontSize: '9px', fontWeight: '700',
                                    background: syncBpm ? hexToRgba(ac, 0.15) : (isDark ? 'rgba(255,255,255,0.06)' : '#eee'),
                                    color: syncBpm ? ac : textSecondary,
                                    border: `1px solid ${syncBpm ? hexToRgba(ac, 0.3) : borderColor}`,
                                    borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.5px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {syncBpm ? t('lyricEngine.synced') : t('lyricEngine.manual')}
                            </button>
                        </div>
                        {syncBpm ? (
                            <div style={{
                                padding: '6px 10px', borderRadius: '6px',
                                background: inputBg, border: `1px solid ${borderColor}`,
                                fontSize: '13px', fontWeight: '700', color: textPrimary,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <span>{bpm} BPM</span>
                                <span style={{ fontSize: '9px', color: textSecondary }}>{t('lyricEngine.fromGlobal')}</span>
                            </div>
                        ) : (
                            <LESlider label="" value={bpm} onChange={setBpm} min={60} max={200} {...themeProps} />
                        )}
                    </div>
                    <LESelect label={t('lyricEngine.melodyInput')} value={melodyMode} onChange={setMelodyMode} options={MELODY_MODES} {...themeProps} />
                    <LESelect label={t('lyricEngine.structure')} value={structureKey} onChange={setStructureKey} options={structureOptions} {...themeProps} />
                    <LESelect label={t('lyricEngine.rhymeScheme')} value={rhymeScheme} onChange={setRhymeScheme} options={RHYME_SCHEMES} {...themeProps} />
                    <LESelect label={t('lyricEngine.language')} value={lyricLanguage} onChange={setLyricLanguage} options={lyricLanguageOptions} {...themeProps} />

                    <div style={{ height: '1px', background: borderColor, margin: '8px 0 12px' }} />

                    <LESlider
                        label={t('lyricEngine.creativity')}
                        value={creativity}
                        onChange={setCreativity}
                        min={0} max={100}
                        suffix={creativity <= 30 ? ` ${t('lyricEngine.structured')}` : creativity >= 70 ? ` ${t('lyricEngine.experimental')}` : ''}
                        {...themeProps}
                    />

                    {/* PUNCHLINES toggle */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <label style={{
                                fontSize: '10px', fontWeight: '700', color: textSecondary,
                                letterSpacing: '1px', textTransform: 'uppercase',
                            }}>
                                {t('lyricEngine.punchlines')}
                            </label>
                            <button
                                onClick={() => setUsePunchlines(!usePunchlines)}
                                title={t('lyricEngine.punchlinesTooltip')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 10px', fontSize: '10px', fontWeight: '700',
                                    background: usePunchlines ? hexToRgba(acSec, 0.15) : (isDark ? 'rgba(255,255,255,0.06)' : '#eee'),
                                    color: usePunchlines ? acSec : textSecondary,
                                    border: `1px solid ${usePunchlines ? hexToRgba(acSec, 0.3) : borderColor}`,
                                    borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.5px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <span style={{
                                    width: '28px', height: '14px', borderRadius: '7px',
                                    background: usePunchlines ? acSec : (isDark ? 'rgba(255,255,255,0.15)' : '#ccc'),
                                    position: 'relative', transition: 'background 0.2s',
                                    display: 'inline-block',
                                }}>
                                    <span style={{
                                        width: '10px', height: '10px', borderRadius: '50%',
                                        background: '#fff', position: 'absolute', top: '2px',
                                        left: usePunchlines ? '16px' : '2px',
                                        transition: 'left 0.2s',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    }} />
                                </span>
                                {usePunchlines ? t('common.on') : t('common.off')}
                            </button>
                        </div>
                        <div style={{
                            fontSize: '9px', color: textSecondary, marginTop: '4px',
                            lineHeight: '1.4',
                        }}>
                            {usePunchlines
                                ? t('lyricEngine.punchlinesOnDesc')
                                : t('lyricEngine.punchlinesOffDesc')}
                        </div>
                    </div>

                    {melodyMode === 'Auto Detect' && (
                        <div style={{
                            padding: '8px 10px', borderRadius: '6px',
                            background: isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f5',
                            fontSize: '10px', color: textSecondary,
                        }}>
                            {melodyNotes.length > 0
                                ? <span style={{ color: '#22c55e' }}>{t('lyricEngine.melodyDetected', { count: melodyNotes.length })}</span>
                                : t('lyricEngine.noMelodyData')}
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL — Lyric Workspace */}
                <div
                    ref={workspaceRef}
                    style={{
                        flex: 1, overflowY: 'auto', padding: '14px 20px',
                    }}
                >
                    {!song ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', height: '100%', gap: '16px',
                        }}>
                            <div style={{
                                width: '80px', height: '80px', borderRadius: '20px',
                                background: hexToRgba(ac, 0.1),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '36px',
                            }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="1.5">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '16px', fontWeight: '700', color: textPrimary, marginBottom: '6px' }}>
                                    {t('lyricEngine.readyToWrite')}
                                </div>
                                <div style={{ fontSize: '12px', color: textSecondary, maxWidth: '300px', lineHeight: '1.6' }}>
                                    {t('lyricEngine.readyToWriteDesc')}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {song.sections.map((section, idx) => (
                                <SectionCard
                                    key={`${section.label}-${idx}`}
                                    section={section}
                                    sectionIndex={idx}
                                    isLocked={lockedSections.has(idx)}
                                    rhymeIndicators={getRhymeIndicators(section.lines)}
                                    isDark={isDark}
                                    ac={ac}
                                    acSec={acSec}
                                    cardBg={cardBg}
                                    borderColor={borderColor}
                                    textPrimary={textPrimary}
                                    textSecondary={textSecondary}
                                    hoverBg={hoverBg}
                                    onRegenerate={handleRegenerateSection}
                                    onToggleLock={toggleLock}
                                    onLineEdit={handleLineEdit}
                                    t={t}
                                    isNonEnglish={lyricLangCode !== 'en'}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* BOTTOM PANEL — Generation Controls */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 20px',
                borderTop: `1px solid ${borderColor}`,
                background: isDark ? 'rgba(15, 15, 22, 0.6)' : '#fff',
            }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        title={t('lyricEngine.generateLyrics')}
                        style={{
                            padding: '10px 28px',
                            background: isGenerating ? (isDark ? 'rgba(255,255,255,0.05)' : '#eee') : acGrad,
                            border: 'none', borderRadius: '8px',
                            color: isGenerating ? textSecondary : '#fff',
                            fontSize: '12px', fontWeight: '800', letterSpacing: '1px',
                            cursor: isGenerating ? 'wait' : 'pointer',
                            boxShadow: isGenerating ? 'none' : `0 0 20px ${hexToRgba(ac, 0.3)}`,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: isGenerating ? 'scale(0.98)' : 'scale(1)',
                        }}
                    >
                        {isGenerating ? t('lyricEngine.generating') : t('lyricEngine.generateLyrics')}
                    </button>

                    {song && (
                        <button
                            onClick={handleGenerate}
                            title={t('lyricEngine.regenerate')}
                            style={{
                                padding: '10px 16px', background: 'transparent',
                                border: `1px solid ${borderColor}`, borderRadius: '8px',
                                color: textPrimary, fontSize: '11px', fontWeight: '700',
                                cursor: 'pointer', transition: 'all 0.2s',
                                letterSpacing: '0.5px',
                            }}
                        >
                            {t('lyricEngine.regenerate')}
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {song && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                title={t('lyricEngine.export')}
                                style={{
                                    padding: '10px 16px', background: 'transparent',
                                    border: `1px solid ${borderColor}`, borderRadius: '8px',
                                    color: textPrimary, fontSize: '11px', fontWeight: '700',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    letterSpacing: '0.5px',
                                }}
                            >
                                {t('lyricEngine.export')}
                            </button>
                            {showExportMenu && (
                                <div style={{
                                    position: 'absolute', bottom: '100%', right: 0,
                                    marginBottom: '4px', background: cardBg,
                                    border: `1px solid ${borderColor}`, borderRadius: '8px',
                                    padding: '4px', minWidth: '140px',
                                    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
                                    zIndex: 100,
                                }}>
                                    {EXPORT_FORMATS.map(fmt => (
                                        <button
                                            key={fmt.key}
                                            onClick={() => handleExport(fmt.key)}
                                            style={{
                                                display: 'block', width: '100%', padding: '8px 12px',
                                                background: 'transparent', border: 'none',
                                                color: textPrimary, fontSize: '11px', fontWeight: '600',
                                                cursor: 'pointer', textAlign: 'left', borderRadius: '4px',
                                            }}
                                            onMouseEnter={(e) => { e.target.style.background = hoverBg; }}
                                            onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                                        >
                                            {fmt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {song && onSendToLyrics && (
                        <button
                            onClick={handleSendToLyrics}
                            title={t('lyricEngine.sendToLyricsTooltip')}
                            style={{
                                padding: '10px 16px', background: 'transparent',
                                border: `1px solid ${borderColor}`, borderRadius: '8px',
                                color: acSec, fontSize: '11px', fontWeight: '700',
                                cursor: 'pointer', transition: 'all 0.2s',
                                letterSpacing: '0.5px',
                            }}
                        >
                            {t('lyricEngine.sendToLyrics')}
                        </button>
                    )}

                    <button
                        onClick={handleSaveLyrics}
                        disabled={!song}
                        title={t('lyricEngine.saveLyrics')}
                        style={{
                            padding: '10px 16px', background: 'transparent',
                            border: `1px solid ${borderColor}`, borderRadius: '8px',
                            color: song ? textPrimary : textSecondary, fontSize: '11px', fontWeight: '700',
                            cursor: song ? 'pointer' : 'default', transition: 'all 0.2s',
                            letterSpacing: '0.5px',
                        }}
                    >
                        {t('lyricEngine.saveLyrics')}
                    </button>

                    <button
                        onClick={handleLoadLyrics}
                        title={t('lyricEngine.loadLyrics')}
                        style={{
                            padding: '10px 16px', background: 'transparent',
                            border: `1px solid ${borderColor}`, borderRadius: '8px',
                            color: textPrimary, fontSize: '11px', fontWeight: '700',
                            cursor: 'pointer', transition: 'all 0.2s',
                            letterSpacing: '0.5px',
                        }}
                    >
                        {t('lyricEngine.loadLyrics')}
                    </button>

                    {song && onEnterRecordMode && (
                        <button
                            onClick={handleEnterRecordMode}
                            title={t('lyricEngine.recordMode')}
                            style={{
                                padding: '10px 16px',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                border: 'none', borderRadius: '8px',
                                color: '#fff', fontSize: '11px', fontWeight: '800',
                                cursor: 'pointer', transition: 'all 0.2s',
                                letterSpacing: '0.5px',
                                boxShadow: '0 0 12px rgba(239,68,68,0.3)',
                            }}
                        >
                            {t('lyricEngine.recordMode')}
                        </button>
                    )}

                    {song && (
                        <button
                            onClick={() => {
                                if (lockedSections.size === song.sections.length) {
                                    setLockedSections(new Set());
                                } else {
                                    setLockedSections(new Set(song.sections.map((_, i) => i)));
                                }
                            }}
                            title={lockedSections.size === song?.sections?.length ? t('common.unlock') : t('common.lock')}
                            style={{
                                padding: '10px 16px', background: 'transparent',
                                border: `1px solid ${borderColor}`, borderRadius: '8px',
                                color: textSecondary, fontSize: '11px', fontWeight: '700',
                                cursor: 'pointer', transition: 'all 0.2s',
                                letterSpacing: '0.5px',
                            }}
                        >
                            {lockedSections.size === song?.sections?.length ? t('common.unlock') + ' ALL' : t('common.lock') + ' ALL'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
