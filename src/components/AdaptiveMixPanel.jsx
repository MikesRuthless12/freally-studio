import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AdaptiveMixEngine } from '../core/music-intelligence/AdaptiveMixEngine.js';
import { useTranslation } from '../i18n/I18nContext';

const TRACK_IDS = ['drums', 'chords', 'melody', 'bass'];
const TRACK_COLORS = { drums: '#ff6b6b', chords: '#6bafff', melody: '#6bffb8', bass: '#ffb86b' };

/** Format dB values for display */
const fmtDb = (v) => {
    if (v === 0) return '0 dB';
    return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
};

/** Format RMS as dBFS */
const rmsToDbfs = (rms) => {
    if (rms <= 0.0001) return '-inf';
    return (20 * Math.log10(rms)).toFixed(1);
};

/** Small horizontal meter bar */
const MeterBar = ({ value, max = 1, color, width = 80, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label && <span style={{ fontSize: 9, color: '#888', width: 28, textAlign: 'right' }}>{label}</span>}
        <div style={{
            width, height: 6, background: '#111118', borderRadius: 3,
            border: '1px solid #222230', overflow: 'hidden'
        }}>
            <div style={{
                width: `${Math.min(100, (value / max) * 100)}%`, height: '100%',
                background: color, borderRadius: 2, transition: 'width 0.15s ease'
            }} />
        </div>
    </div>
);

/** EQ visualization — 3-band bar graph */
const EQBars = ({ low, mid, high, color, labels }) => {
    const bands = [
        { label: labels?.lo || 'Lo', value: low },
        { label: labels?.mid || 'Mid', value: mid },
        { label: labels?.hi || 'Hi', value: high },
    ];
    const maxAbs = 8;
    return (
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 32 }}>
            {bands.map(b => {
                const norm = b.value / maxAbs; // -1 to 1
                const barH = Math.abs(norm) * 14;
                const isBoost = norm >= 0;
                return (
                    <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                        <div style={{
                            width: 10, height: 28, position: 'relative',
                            background: '#111118', borderRadius: 2, border: '1px solid #222230'
                        }}>
                            {/* Center line */}
                            <div style={{
                                position: 'absolute', top: '50%', left: 0, right: 0,
                                height: 1, background: '#333'
                            }} />
                            {/* Bar */}
                            <div style={{
                                position: 'absolute',
                                left: 1, right: 1,
                                ...(isBoost
                                    ? { bottom: '50%', height: barH }
                                    : { top: '50%', height: barH }),
                                background: isBoost ? color : '#ff4444',
                                borderRadius: 1, opacity: 0.8
                            }} />
                        </div>
                        <span style={{ fontSize: 7, color: '#666', marginTop: 1 }}>{b.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * AdaptiveMixPanel — UI component for the Adaptive Mix Engine.
 *
 * Props:
 *   samplerEngine   — SamplerEngine instance (required)
 *   genre           — Current genre name string (e.g. "Trap")
 *   genreDNA        — Full genre definition object from GENRE_DEFINITIONS (optional)
 *   accentColor     — Theme accent color (optional, default '#6bafff')
 *   effectsManager  — EffectsManager instance. When provided, real effects (EQEight,
 *                     Compressor, StereoWidener, character FX) are added to each
 *                     track's chain and appear in the DetailPanel with adjustable knobs.
 *   onEffectsChanged — Callback fired after effects are added/removed, so the parent
 *                     can trigger re-render / re-sync.
 *   mood            — Current mood string (e.g. "Dark", "Energetic")
 */
const AdaptiveMixPanel = ({ samplerEngine, genre, genreDNA, accentColor = '#6bafff', effectsManager, onEffectsChanged, mood }) => {
    const { t } = useTranslation();
    const TRACK_LABELS = { drums: t('adaptiveMix.drums'), chords: t('adaptiveMix.chords'), melody: t('adaptiveMix.melody'), bass: t('adaptiveMix.bass') };
    const engineRef = useRef(null);
    const [applied, setApplied] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [settings, setSettings] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const animFrameRef = useRef(null);
    const [liveMeters, setLiveMeters] = useState(null);

    // Initialize engine once
    if (!engineRef.current) {
        engineRef.current = new AdaptiveMixEngine();
    }
    const engine = engineRef.current;

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    // Live metering loop
    useEffect(() => {
        if (!applied || !samplerEngine) return;

        let running = true;
        const tick = () => {
            if (!running) return;
            const snap = engine.analyzeMix(samplerEngine);
            setLiveMeters(snap);
            animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);

        return () => {
            running = false;
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [applied, samplerEngine, engine]);

    const handleAutoMix = useCallback(() => {
        if (!samplerEngine) return;

        setAnalyzing(true);

        // Small delay to let UI update before potentially heavy work
        requestAnimationFrame(() => {
            const dna = genreDNA || { genre: genre || 'Hip Hop' };
            if (!dna.genre && genre) dna.genre = genre;
            if (mood && !dna.mood) dna.mood = mood;

            const snap = engine.analyzeMix(samplerEngine);
            setAnalysis(snap);

            const result = engine.applyAdaptiveMix(samplerEngine, dna, effectsManager || null);
            setSettings(result);
            setApplied(true);
            setAnalyzing(false);
            if (onEffectsChanged) onEffectsChanged();
        });
    }, [samplerEngine, genre, genreDNA, engine, effectsManager, onEffectsChanged, mood]);

    const handleReset = useCallback(() => {
        if (!samplerEngine) return;
        engine.reset(samplerEngine, effectsManager || null);
        setApplied(false);
        setSettings(null);
        setAnalysis(null);
        setLiveMeters(null);
        if (onEffectsChanged) onEffectsChanged();
    }, [samplerEngine, engine, effectsManager, onEffectsChanged]);

    const profileLabel = settings?.profile
        ? settings.profile.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : null;

    return (
        <div style={{
            background: '#1a1a24',
            border: '1px solid #2a2a36',
            borderRadius: 8,
            padding: 12,
            minWidth: 280,
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: applied ? '#4ade80' : '#555',
                        boxShadow: applied ? '0 0 6px #4ade80' : 'none'
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e0e0e0', letterSpacing: 0.5 }}>
                        {t('adaptiveMix.title')}
                    </span>
                </div>
                {profileLabel && (
                    <span style={{
                        fontSize: 9, color: accentColor, background: `${accentColor}18`,
                        padding: '2px 6px', borderRadius: 3, fontWeight: 600
                    }}>
                        {profileLabel}
                    </span>
                )}
            </div>

            {/* Genre indicator */}
            <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>
                {t('adaptiveMix.genre')}: <span style={{ color: '#ccc' }}>{genre || t('adaptiveMix.none')}</span>
            </div>

            {/* Auto Mix Button */}
            <button
                onClick={applied ? handleReset : handleAutoMix}
                disabled={!samplerEngine || analyzing}
                style={{
                    width: '100%',
                    padding: '8px 0',
                    background: applied
                        ? 'linear-gradient(180deg, #333 0%, #222 100%)'
                        : `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                    color: applied ? '#ccc' : '#fff',
                    border: applied ? '1px solid #444' : `1px solid ${accentColor}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: analyzing ? 'wait' : 'pointer',
                    letterSpacing: 1,
                    transition: 'all 0.2s ease',
                    opacity: !samplerEngine ? 0.4 : 1,
                }}
            >
                {analyzing ? t('adaptiveMix.analyzing') : applied ? t('adaptiveMix.resetMix') : t('adaptiveMix.autoMixBeat')}
            </button>

            {/* Per-track adjustments display */}
            {settings && (
                <div style={{ marginTop: 10 }}>
                    {TRACK_IDS.map(trackId => {
                        const adj = settings.adjustments[trackId];
                        const meters = liveMeters?.[trackId];
                        const color = TRACK_COLORS[trackId];
                        if (!adj) return null;

                        return (
                            <div key={trackId} style={{
                                background: '#14141c',
                                border: '1px solid #222230',
                                borderRadius: 6,
                                padding: 8,
                                marginBottom: 6,
                            }}>
                                {/* Track header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    marginBottom: 6
                                }}>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, color,
                                        letterSpacing: 0.5
                                    }}>
                                        {TRACK_LABELS[trackId]}
                                    </span>
                                    <span style={{ fontSize: 9, color: '#888' }}>
                                        {fmtDb(adj.volumeDb)}
                                    </span>
                                </div>

                                {/* Meters row */}
                                {meters && (
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                        <MeterBar value={meters.rms} max={0.5} color={color} width={60} label={t('adaptiveMix.rms')} />
                                        <MeterBar value={meters.peak} max={1} color={`${color}aa`} width={60} label={t('adaptiveMix.peak')} />
                                    </div>
                                )}

                                {/* Settings row */}
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    {/* EQ bars */}
                                    <EQBars low={adj.eqLow} mid={adj.eqMid} high={adj.eqHigh} color={color} labels={{ lo: t('adaptiveMix.lo'), mid: t('adaptiveMix.mid'), hi: t('adaptiveMix.hi') }} />

                                    {/* Params */}
                                    <div style={{ fontSize: 9, color: '#777', lineHeight: '14px', flex: 1 }}>
                                        <div>{t('adaptiveMix.width')}: <span style={{ color: '#aaa' }}>
                                            {adj.stereoWidth === 0 ? t('adaptiveMix.mono') : `${(adj.stereoWidth * 200).toFixed(0)}%`}
                                        </span></div>
                                        <div>{t('adaptiveMix.comp')}: <span style={{ color: '#aaa' }}>
                                            {adj.compThreshold}dB / {adj.compRatio}:1
                                        </span></div>
                                        {meters && (
                                            <div>{t('adaptiveMix.level')}: <span style={{ color: '#aaa' }}>
                                                {rmsToDbfs(meters.rms)} dBFS
                                            </span></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Master meter */}
                    {liveMeters?.master && (
                        <div style={{
                            background: '#14141c', border: '1px solid #222230',
                            borderRadius: 6, padding: 8, marginTop: 2
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                marginBottom: 4
                            }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#e0e0e0', letterSpacing: 0.5 }}>
                                    {t('adaptiveMix.master')}
                                </span>
                                <span style={{ fontSize: 9, color: '#888' }}>
                                    {rmsToDbfs(liveMeters.master.rms)} dBFS
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <MeterBar value={liveMeters.master.rms} max={0.5} color="#e0e0e0" width={70} label={t('adaptiveMix.rms')} />
                                <MeterBar value={liveMeters.master.peak} max={1} color={liveMeters.master.peak > 0.9 ? '#ff4444' : '#aaa'} width={70} label={t('adaptiveMix.peak')} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Pre-analysis info when not applied */}
            {!settings && !analyzing && (
                <div style={{
                    marginTop: 8, fontSize: 9, color: '#555', textAlign: 'center', lineHeight: '14px'
                }}>
                    {t('adaptiveMix.infoLine1')}<br />
                    {t('adaptiveMix.infoLine2')}
                </div>
            )}
        </div>
    );
};

export default AdaptiveMixPanel;
