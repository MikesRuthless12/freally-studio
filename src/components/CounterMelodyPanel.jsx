import React, { useState, useCallback, useRef, useEffect } from 'react';
import { hexToRgba } from '../accentThemes';
import { generateCounterMelody, generateAndMerge } from '../core/music-intelligence/CounterMelodyEngine';
import { useTranslation } from '../i18n/I18nContext';

/**
 * CounterMelodyPanel — Collapsible panel for generating smart counter melodies.
 *
 * Props:
 *   melody         – current melody pattern (note array)
 *   chordPattern   – current chord pattern (note array, optional)
 *   globalKey      – key name string
 *   globalScale    – scale name string
 *   globalBars     – number of bars
 *   globalOctave   – base octave
 *   theme          – 'dark' | 'light'
 *   accentColors   – { accent, secondary, gradient }
 *   sampler        – SamplerEngine instance (for preview)
 *   loadedInstrument – instrument ID loaded in melody track
 *   globalTempo    – BPM (for preview timing)
 *   onInsert       – callback(mergedPattern) to push result into melody track
 */
const CounterMelodyPanel = ({
    melody,
    chordPattern,
    globalKey,
    globalScale,
    globalBars,
    globalOctave,
    theme,
    accentColors,
    sampler,
    loadedInstrument,
    globalTempo,
    onInsert
}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#54a0ff';
    const isDark = theme === 'dark';

    const [expanded, setExpanded] = useState(false);
    const [density, setDensity] = useState(60);       // 0-100 → mapped to 0.3-1.0
    const [motionBias, setMotionBias] = useState('contrary');
    const [preview, setPreview] = useState(null);      // generated counter notes for preview
    const [isPreviewing, setIsPreviewing] = useState(false);
    const previewTimerRef = useRef(null);

    // Clean up preview playback on unmount
    useEffect(() => {
        return () => {
            if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        };
    }, []);

    const originalMelody = (melody || []).filter(n => n.layer !== 'counter');
    const hasOriginal = originalMelody.length > 0;

    const handleGenerate = useCallback(() => {
        if (!hasOriginal) return;
        const densityNorm = 0.3 + (density / 100) * 0.7; // map 0-100 → 0.3-1.0
        const counter = generateCounterMelody({
            melody: originalMelody,
            chordPattern: chordPattern || null,
            key: globalKey,
            scale: globalScale,
            bars: globalBars,
            octave: globalOctave,
            density: densityNorm,
            motionBias
        });
        setPreview(counter);
    }, [hasOriginal, originalMelody, chordPattern, globalKey, globalScale, globalBars, globalOctave, density, motionBias]);

    const handlePreviewMidi = useCallback(() => {
        if (!preview || preview.length === 0 || !sampler || !loadedInstrument) return;
        if (isPreviewing) return;

        setIsPreviewing(true);
        const tempo = globalTempo || 120;
        const stepDurationMs = (60000 / tempo) / 8; // ms per step (32 steps per bar, 8 steps per beat)

        // Schedule each counter note for playback
        let maxTime = 0;
        for (const n of preview) {
            const delayMs = n.time * stepDurationMs;
            const durationSec = (n.duration / 8) * (60 / tempo);
            const endMs = delayMs + durationSec * 1000;
            if (endMs > maxTime) maxTime = endMs;

            setTimeout(() => {
                try {
                    sampler.playNote(loadedInstrument, n.note, n.velocity, durationSec, null, 'melody');
                } catch (_) { /* ignore playback errors during preview */ }
            }, delayMs);
        }

        // Clear previewing state after all notes finish
        previewTimerRef.current = setTimeout(() => setIsPreviewing(false), maxTime + 200);
    }, [preview, sampler, loadedInstrument, globalTempo, isPreviewing]);

    const handleInsert = useCallback(() => {
        if (!preview || preview.length === 0 || !onInsert) return;
        const totalSteps = (globalBars || 4) * 32;
        const merged = [...originalMelody, ...preview]
            .filter(n => n.time < totalSteps)
            .sort((a, b) => a.time - b.time);
        onInsert(merged);
        setPreview(null);
    }, [preview, originalMelody, globalBars, onInsert]);

    // ─── Styles ────────────────────────────────────────────────────────────────

    const panelBg = isDark ? 'rgba(12, 12, 16, 0.4)' : 'rgba(245, 245, 247, 0.6)';
    const borderColor = isDark ? 'rgba(255,255,255,0.05)' : '#e8e8e8';

    const btnStyle = (active, color) => ({
        padding: '5px 12px',
        background: active
            ? (isDark ? hexToRgba(color || ac, 0.2) : hexToRgba(color || ac, 0.12))
            : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
        border: `1px solid ${isDark ? '#2a2a3e' : '#ddd'}`,
        borderRadius: '4px',
        color: active ? (color || ac) : (isDark ? '#aaa' : '#666'),
        fontSize: '10px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '0.3px'
    });

    const actionBtnStyle = (color, disabled) => ({
        padding: '6px 14px',
        background: disabled
            ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')
            : (isDark ? hexToRgba(color, 0.15) : hexToRgba(color, 0.1)),
        border: `1px solid ${disabled ? (isDark ? '#222' : '#ccc') : color}`,
        borderRadius: '4px',
        color: disabled ? (isDark ? '#555' : '#aaa') : color,
        fontSize: '10px',
        fontWeight: '800',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '0.5px',
        opacity: disabled ? 0.5 : 1
    });

    const labelStyle = {
        fontSize: '9px',
        fontWeight: '700',
        color: isDark ? '#777' : '#888',
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
    };

    return (
        <div style={{
            borderBottom: expanded ? `1px solid ${borderColor}` : 'none',
            background: panelBg,
            transition: 'all 0.2s'
        }}>
            {/* Toggle header */}
            <div
                onClick={() => setExpanded(prev => !prev)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 20px',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                <span style={{
                    fontSize: '8px',
                    color: isDark ? '#555' : '#aaa',
                    transform: expanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s'
                }}>
                    ▶
                </span>
                <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    letterSpacing: '1px',
                    color: isDark ? '#888' : '#666',
                    textTransform: 'uppercase'
                }}>
                    {t('counterMelody.title')}
                </span>
                {preview && preview.length > 0 && (
                    <span style={{
                        fontSize: '8px',
                        color: ac,
                        fontWeight: '700',
                        marginLeft: 'auto'
                    }}>
                        {t('counterMelody.notesReady', { count: preview.length })}
                    </span>
                )}
            </div>

            {/* Expanded content */}
            {expanded && (
                <div style={{ padding: '8px 20px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Controls row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        {/* Density slider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={labelStyle}>{t('counterMelody.density')}</span>
                            <input
                                type="range"
                                min={10}
                                max={100}
                                value={density}
                                onChange={e => setDensity(Number(e.target.value))}
                                style={{ width: '80px', accentColor: ac }}
                            />
                            <span style={{ fontSize: '9px', fontWeight: '700', color: isDark ? '#aaa' : '#555', minWidth: '24px', textAlign: 'center' }}>
                                {density}%
                            </span>
                        </div>

                        {/* Motion bias selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={labelStyle}>{t('counterMelody.motion')}</span>
                            {['contrary', 'oblique', 'mixed'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMotionBias(m)}
                                    style={btnStyle(motionBias === m, ac)}
                                >
                                    {t(`counterMelody.${m}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action buttons row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={handleGenerate}
                            disabled={!hasOriginal}
                            style={actionBtnStyle('#39ff14', !hasOriginal)}
                            title={hasOriginal ? t('counterMelody.generateTooltip') : t('counterMelody.generateFirst')}
                        >
                            {t('counterMelody.generate')}
                        </button>

                        <button
                            onClick={handlePreviewMidi}
                            disabled={!preview || preview.length === 0 || !sampler || isPreviewing}
                            style={actionBtnStyle('#54a0ff', !preview || preview.length === 0 || !sampler)}
                            title={t('counterMelody.previewTooltip')}
                        >
                            {isPreviewing ? t('counterMelody.playing') : t('counterMelody.previewMidi')}
                        </button>

                        <button
                            onClick={handleInsert}
                            disabled={!preview || preview.length === 0}
                            style={actionBtnStyle('#ff9f43', !preview || preview.length === 0)}
                            title={t('counterMelody.insertTooltip')}
                        >
                            {t('counterMelody.insertIntoTrack')}
                        </button>
                    </div>

                    {/* Status info */}
                    {!hasOriginal && (
                        <div style={{ fontSize: '9px', color: isDark ? '#666' : '#999', fontStyle: 'italic' }}>
                            {t('counterMelody.noMelody')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CounterMelodyPanel;
