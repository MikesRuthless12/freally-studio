import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateAllPatterns, generateCounterMelody, determineComplexity } from './PatternEngine';
import { getProPattern } from './drumPatterns';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

// ─── Drum IDs (must match DrumGeneratorEnhanced) ────────────────────────
const DRUM_IDS = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];

// ─── Track colours ──────────────────────────────────────────────────────
const TRACK_COLORS = {
    drums: '#ff6b6b',
    chords: '#54a0ff',
    melody: '#39ff14',
    bass: '#ff9f43',
};

// ─── Generate a full drum state object (same shape as DrumGeneratorEnhanced) ─
function generateDrumPatterns(genre, mood, bars, key, scale) {
    const result = {};
    DRUM_IDS.forEach(drumId => {
        const effectiveDrumId = drumId.toLowerCase();
        const lanes = getProPattern(genre, effectiveDrumId, bars, key, scale, mood);
        result[drumId] = { powered: true, lanes };
    });
    return result;
}

// ─── Convert drum lane data → flat array of { time, note } for mini-canvas ──
function drumStatesToPreview(drumState, bars) {
    const notes = [];
    const totalSteps = bars * 32;
    DRUM_IDS.forEach((drumId, drumIdx) => {
        const d = drumState[drumId];
        if (!d || !d.lanes) return;
        const rootLane = d.lanes.root;
        if (!rootLane) return;
        for (let s = 0; s < Math.min(rootLane.pattern.length, totalSteps); s++) {
            if (rootLane.pattern[s]) {
                notes.push({ time: s, note: 36 + drumIdx * 4, duration: 2, velocity: (rootLane.velocity?.[s] || 100) / 100 });
            }
        }
    });
    return notes;
}

// ─── Mini Piano Roll Canvas ─────────────────────────────────────────────
const MiniPianoRoll = ({ pattern, bars, trackColor, width = 200, height = 80, isDark }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        // Background
        ctx.fillStyle = isDark ? '#0d0d15' : '#f0f0f0';
        ctx.fillRect(0, 0, width, height);

        // Beat grid lines
        const totalSteps = bars * 32;
        for (let b = 0; b < bars * 4; b++) {
            const x = (b * 8 / totalSteps) * width;
            ctx.strokeStyle = b % 4 === 0
                ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)')
                : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)');
            ctx.lineWidth = b % 4 === 0 ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        if (!pattern || pattern.length === 0) {
            ctx.fillStyle = isDark ? '#444' : '#999';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Empty', width / 2, height / 2 + 3);
            return;
        }

        // Find note range
        let minNote = 127, maxNote = 0;
        pattern.forEach(n => {
            if (n.note < minNote) minNote = n.note;
            if (n.note > maxNote) maxNote = n.note;
        });
        const noteRange = Math.max(maxNote - minNote, 12);
        const pad = 4;

        ctx.fillStyle = trackColor;

        pattern.forEach(n => {
            const x = (n.time / totalSteps) * width;
            const w = Math.max(((n.duration || 1) / totalSteps) * width, 1.5);
            const y = pad + ((maxNote - n.note) / noteRange) * (height - pad * 2);
            const h = Math.max((height - pad * 2) / noteRange, 2);
            ctx.globalAlpha = n.velocity || 0.8;
            ctx.fillRect(x, y, w, h);
        });
        ctx.globalAlpha = 1.0;
    }, [pattern, bars, trackColor, width, height, isDark]);

    return <canvas ref={canvasRef} style={{ borderRadius: '4px', display: 'block' }} />;
};

// ─── Main SuggestionPanel ───────────────────────────────────────────────
const SuggestionPanel = ({
    isOpen,
    onClose,
    isDark,
    // Generation params
    globalKey,
    globalScale,
    globalGenre,
    globalMood,
    globalBars,
    globalTempo,
    humanizeParams,
    // Apply callback
    onApply,          // (suggestion) => void — applies full suggestion
    onApplyMixed,     // (mixedSuggestion) => void — applies mix-and-match
    accentColors}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const [suggestions, setSuggestions] = useState([]);
    const [activePreview, setActivePreview] = useState('chords'); // track to preview
    const [mixSelections, setMixSelections] = useState({ drums: 0, chords: 0, melody: 0, bass: 0 });
    const [showMixMode, setShowMixMode] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [appliedIdx, setAppliedIdx] = useState(null); // track which suggestion was last applied
    const [includeCounterMelody, setIncludeCounterMelody] = useState(false);
    const [complexityOverride, setComplexityOverride] = useState('auto'); // 'auto' | 'simple' | 'complex'

    // ─── Generate 4 suggestions ───
    const generateSuggestions = useCallback(() => {
        setGenerating(true);
        // Small timeout so the UI can show the loading state
        setTimeout(() => {
            const complexity = complexityOverride === 'auto'
                ? determineComplexity(globalGenre, globalMood)
                : complexityOverride;
            const results = [];
            for (let i = 0; i < 4; i++) {
                const { chords, melody, bass } = generateAllPatterns({
                    key: globalKey,
                    scale: globalScale,
                    genre: globalGenre,
                    mood: globalMood,
                    bars: globalBars,
                    complexity,
                    tempo: globalTempo,
                    humanize: humanizeParams,
                });

                // Optionally add counter melody
                let finalMelody = melody;
                if (includeCounterMelody && melody.length > 0) {
                    const counter = generateCounterMelody({
                        melody,
                        key: globalKey,
                        scale: globalScale,
                        genre: globalGenre,
                        mood: globalMood,
                        bars: globalBars,
                        complexity,
                        octave: 4,
                        chordPattern: chords
                    });
                    if (counter.length > 0) {
                        const tagged = counter.map(n => ({ ...n, layer: 'counter' }));
                        finalMelody = [...melody, ...tagged];
                    }
                }

                const drums = generateDrumPatterns(globalGenre, globalMood, globalBars, globalKey, globalScale);
                results.push({ chords, melody: finalMelody, bass, drums });
            }
            setSuggestions(results);
            setMixSelections({ drums: 0, chords: 0, melody: 0, bass: 0 });
            setAppliedIdx(null);
            setGenerating(false);
        }, 50);
    }, [globalKey, globalScale, globalGenre, globalMood, globalBars, globalTempo, humanizeParams, includeCounterMelody, complexityOverride]);

    // Auto-generate when panel opens
    useEffect(() => {
        if (isOpen && suggestions.length === 0) {
            generateSuggestions();
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard handler — prevent Space from activating buttons (playback handled by global window listener),
    // and allow Escape to close the panel
    const handlePanelKeyDown = useCallback((e) => {
        if (e.code === 'Space') {
            e.preventDefault(); // prevents focused button click; global handler still toggles playback
        }
        if (e.code === 'Escape') {
            onClose();
        }
    }, [onClose]);

    if (!isOpen) return null;

    // ─── Get preview pattern for a suggestion ───
    const getPreviewNotes = (suggestion, track) => {
        if (track === 'drums') {
            return drumStatesToPreview(suggestion.drums, globalBars);
        }
        return suggestion[track] || [];
    };

    // ─── Build mixed suggestion from per-track selections ───
    const buildMixedSuggestion = () => {
        if (suggestions.length === 0) return null;
        return {
            drums: suggestions[mixSelections.drums]?.drums,
            chords: suggestions[mixSelections.chords]?.chords,
            melody: suggestions[mixSelections.melody]?.melody,
            bass: suggestions[mixSelections.bass]?.bass,
        };
    };

    const trackTabs = ['chords', 'melody', 'bass', 'drums'];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)'
        }} tabIndex={-1} ref={el => el && el.focus()} onKeyDown={handlePanelKeyDown} onClick={onClose}>
            <div style={{
                background: isDark ? '#14141a' : '#fff',
                border: `1px solid ${isDark ? '#333' : '#ccc'}`,
                borderRadius: '12px',
                padding: '24px',
                width: '920px',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                color: isDark ? '#ccc' : '#333'
            }} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: isDark ? ac : '#333' }}>
                            {t('suggest.title')}
                        </h2>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                            {globalGenre} • {globalKey} {globalScale} • {globalBars} {t('suggest.bars')} • {globalTempo} BPM
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setShowMixMode(!showMixMode)}
                            style={{
                                padding: '6px 14px',
                                background: showMixMode ? (isDark ? 'rgba(255,159,67,0.2)' : `${acSec}22`) : 'transparent',
                                border: `1px solid ${showMixMode ? acSec : (isDark ? '#444' : '#ccc')}`,
                                borderRadius: '6px',
                                color: showMixMode ? acSec : (isDark ? '#aaa' : '#666'),
                                fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            {t('suggest.mixMatch')}
                        </button>
                        <button
                            onClick={generateSuggestions}
                            disabled={generating}
                            style={{
                                padding: '6px 14px',
                                background: isDark ? hexToRgba(ac, 0.15) : `${ac}22`,
                                border: `1px solid ${ac}`,
                                borderRadius: '6px',
                                color: ac,
                                fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                                opacity: generating ? 0.5 : 1
                            }}
                        >
                            {generating ? t('suggest.generating') : `↻ ${t('suggest.regenerateAll')}`}
                        </button>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none',
                            color: isDark ? '#888' : '#999',
                            fontSize: '18px', cursor: 'pointer', padding: '0 4px'
                        }}>✕</button>
                    </div>
                </div>

                {/* Track preview tabs + counter melody toggle */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
                    {trackTabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActivePreview(tab)}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '4px',
                                border: `1px solid ${activePreview === tab ? TRACK_COLORS[tab] : (isDark ? '#333' : '#ddd')}`,
                                background: activePreview === tab
                                    ? (isDark ? `${TRACK_COLORS[tab]}22` : `${TRACK_COLORS[tab]}15`)
                                    : 'transparent',
                                color: activePreview === tab ? TRACK_COLORS[tab] : (isDark ? '#888' : '#666'),
                                fontSize: '10px', fontWeight: 'bold', cursor: 'pointer',
                                textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}
                        >
                            {t(`app.${tab}`)}
                        </button>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* Complexity selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {['auto', 'simple', 'complex'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setComplexityOverride(opt)}
                                    style={{
                                        padding: '2px 8px', borderRadius: '4px',
                                        border: `1px solid ${complexityOverride === opt ? ac : (isDark ? '#333' : '#ccc')}`,
                                        background: complexityOverride === opt ? (isDark ? hexToRgba(ac, 0.15) : `${ac}22`) : 'transparent',
                                        color: complexityOverride === opt ? ac : (isDark ? '#888' : '#666'),
                                        fontSize: '9px', fontWeight: 'bold', cursor: 'pointer',
                                        textTransform: 'uppercase', letterSpacing: '0.3px'
                                    }}
                                >
                                    {t(`suggest.${opt}`)}
                                </button>
                            ))}
                        </div>
                        {/* Counter melody toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', color: isDark ? '#888' : '#666' }}>{t('suggest.counterMelody')}</span>
                            <button
                                onClick={() => setIncludeCounterMelody(!includeCounterMelody)}
                                style={{
                                    width: '32px', height: '16px', borderRadius: '8px', border: 'none',
                                    background: includeCounterMelody ? ac : (isDark ? '#333' : '#ccc'),
                                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                                    padding: 0
                                }}
                            >
                                <div style={{
                                    width: '12px', height: '12px', borderRadius: '50%',
                                    background: '#fff',
                                    position: 'absolute', top: '2px',
                                    left: includeCounterMelody ? '18px' : '2px',
                                    transition: 'left 0.2s'
                                }} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Suggestion cards */}
                {generating ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
                        {t('suggest.generatingPatterns')}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {suggestions.map((suggestion, idx) => (
                            <div
                                key={idx}
                                style={{
                                    border: `1px solid ${appliedIdx === idx ? '#39ff14' : (isDark ? '#2a2a3e' : '#e0e0e0')}`,
                                    borderRadius: '8px',
                                    padding: '12px',
                                    background: appliedIdx === idx
                                        ? (isDark ? 'rgba(57,255,20,0.04)' : 'rgba(57,255,20,0.05)')
                                        : (isDark ? '#1a1a2e' : '#fafafa'),
                                    transition: 'all 0.2s',
                                    boxShadow: appliedIdx === idx ? '0 0 12px rgba(57,255,20,0.1)' : 'none'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: isDark ? '#ddd' : '#333' }}>
                                        {t('suggest.option')} {idx + 1}
                                    </span>
                                    <button
                                        onClick={() => { onApply(suggestion); setAppliedIdx(idx); }}
                                        style={{
                                            padding: '4px 12px',
                                            background: appliedIdx === idx
                                                ? (isDark ? 'rgba(57,255,20,0.25)' : 'rgba(57,255,20,0.2)')
                                                : (isDark ? 'rgba(57,255,20,0.1)' : '#39ff1422'),
                                            border: `1px solid ${appliedIdx === idx ? '#39ff14' : '#39ff14'}`,
                                            borderRadius: '4px',
                                            color: '#39ff14',
                                            fontSize: '10px', fontWeight: 'bold', cursor: 'pointer',
                                            boxShadow: appliedIdx === idx ? '0 0 8px rgba(57,255,20,0.3)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {appliedIdx === idx ? `✓ ${t('suggest.applied')}` : t('suggest.useThis')}
                                    </button>
                                </div>

                                {/* Mini preview for active track */}
                                <MiniPianoRoll
                                    pattern={getPreviewNotes(suggestion, activePreview)}
                                    bars={globalBars}
                                    trackColor={TRACK_COLORS[activePreview]}
                                    width={410}
                                    height={80}
                                    isDark={isDark}
                                />

                                {/* Mini track indicators */}
                                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                    {trackTabs.map(tab => {
                                        const hasNotes = tab === 'drums'
                                            ? Object.values(suggestion.drums || {}).some(d => d.lanes?.root?.pattern?.some(Boolean))
                                            : (suggestion[tab]?.length || 0) > 0;
                                        return (
                                            <div key={tab} style={{
                                                flex: 1,
                                                height: '3px',
                                                borderRadius: '2px',
                                                background: hasNotes ? TRACK_COLORS[tab] : (isDark ? '#222' : '#ddd'),
                                                opacity: hasNotes ? 0.8 : 0.3
                                            }} />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Mix & Match panel */}
                {showMixMode && suggestions.length > 0 && (
                    <div style={{
                        marginTop: '16px',
                        padding: '14px',
                        background: isDark ? '#1a1a2e' : '#f5f5f5',
                        borderRadius: '8px',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`
                    }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', color: isDark ? acSec : '#333' }}>
                            {t('suggest.mixMatchDesc')}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            {trackTabs.map(track => (
                                <div key={track} style={{ flex: 1 }}>
                                    <label style={{
                                        display: 'block', fontSize: '9px', fontWeight: 'bold',
                                        color: TRACK_COLORS[track], letterSpacing: '0.5px',
                                        marginBottom: '4px', textTransform: 'uppercase'
                                    }}>
                                        {t(`app.${track}`)}
                                    </label>
                                    <div style={{ display: 'flex', gap: '3px' }}>
                                        {[0, 1, 2, 3].map(i => (
                                            <button
                                                key={i}
                                                onClick={() => setMixSelections(prev => ({ ...prev, [track]: i }))}
                                                style={{
                                                    flex: 1,
                                                    padding: '4px 0',
                                                    borderRadius: '3px',
                                                    border: `1px solid ${mixSelections[track] === i ? TRACK_COLORS[track] : (isDark ? '#333' : '#ccc')}`,
                                                    background: mixSelections[track] === i
                                                        ? `${TRACK_COLORS[track]}33`
                                                        : (isDark ? '#0d0d15' : '#fff'),
                                                    color: mixSelections[track] === i ? TRACK_COLORS[track] : (isDark ? '#666' : '#999'),
                                                    fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                                                }}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    const mixed = buildMixedSuggestion();
                                    if (mixed && onApplyMixed) {
                                        onApplyMixed(mixed);
                                        setAppliedIdx('mix');
                                    }
                                }}
                                style={{
                                    padding: '8px 18px',
                                    background: appliedIdx === 'mix'
                                        ? (isDark ? 'rgba(255,159,67,0.3)' : 'rgba(255,159,67,0.2)')
                                        : (isDark ? 'rgba(255,159,67,0.15)' : `${acSec}22`),
                                    border: `1px solid ${acSec}`,
                                    borderRadius: '6px',
                                    color: acSec,
                                    fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                                    whiteSpace: 'nowrap', alignSelf: 'flex-end',
                                    boxShadow: appliedIdx === 'mix' ? '0 0 8px rgba(255,159,67,0.3)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {appliedIdx === 'mix' ? `✓ ${t('suggest.mixApplied')}` : t('suggest.applyMix')}
                            </button>
                        </div>

                        {/* Mixed preview */}
                        <div style={{ marginTop: '10px' }}>
                            <MiniPianoRoll
                                pattern={getPreviewNotes(
                                    buildMixedSuggestion() || suggestions[0],
                                    activePreview
                                )}
                                bars={globalBars}
                                trackColor={TRACK_COLORS[activePreview]}
                                width={860}
                                height={60}
                                isDark={isDark}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SuggestionPanel;
