import React, { useState, useCallback, useMemo } from 'react';
import { hexToRgba } from './accentThemes';
import {
    generateArrangement,
    getEstimatedDuration,
    getTotalBars,
    getSectionTypes
} from './core/music-intelligence/ArrangementEngine';
import { useTranslation } from './i18n/I18nContext.jsx';

const SECTION_TYPES = getSectionTypes();

/**
 * ArrangementIntelligencePanel — Collapsible panel for AI-driven song structure generation.
 *
 * Props:
 *   genre, mood, tempo      – current global settings
 *   theme, accentColors     – styling
 *   onApplyToTimeline       – callback(clipPlacements) to push sections onto timeline
 */
const ArrangementIntelligencePanel = ({
    genre = 'Trap',
    mood,
    tempo = 120,
    theme,
    accentColors,
    onApplyToTimeline
}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';
    const isDark = theme === 'dark';

    const [expanded, setExpanded] = useState(false);
    const [variation, setVariation] = useState(30);
    const [generated, setGenerated] = useState(null); // clipPlacements array
    const [applied, setApplied] = useState(false);

    // Derive section summary from generated placements
    const sections = useMemo(() => {
        if (!generated) return [];
        // Group by timelineBar (each bar position has 4 trackType entries)
        const seen = new Map();
        for (const cp of generated) {
            if (!seen.has(cp.timelineBar)) {
                seen.set(cp.timelineBar, {
                    section: cp.sectionType,
                    bars: cp.bars,
                    intensity: cp.intensity,
                    color: cp.color,
                    timelineBar: cp.timelineBar
                });
            }
        }
        return [...seen.values()].sort((a, b) => a.timelineBar - b.timelineBar);
    }, [generated]);

    const totalBars = generated ? getTotalBars(generated) : 0;
    const durationSec = generated ? getEstimatedDuration(generated, tempo) : 0;
    const durationStr = durationSec > 0
        ? `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, '0')}`
        : '--:--';

    const handleGenerate = useCallback(() => {
        const result = generateArrangement({
            genre,
            mood,
            variation: variation / 100,
            seed: null // random each time
        });
        setGenerated(result);
        setApplied(false);
    }, [genre, mood, variation]);

    const handleApply = useCallback(() => {
        if (!generated || !onApplyToTimeline) return;
        onApplyToTimeline(generated);
        setApplied(true);
    }, [generated, onApplyToTimeline]);

    const borderColor = isDark ? 'rgba(255,255,255,0.05)' : '#e8e8e8';
    const textPrimary = isDark ? '#e0e0e0' : '#333';
    const textMuted = isDark ? '#666' : '#999';

    const btnStyle = (color, disabled) => ({
        padding: '5px 14px',
        background: disabled ? (isDark ? 'rgba(255,255,255,0.03)' : '#f0f0f0')
            : (isDark ? hexToRgba(color, 0.15) : hexToRgba(color, 0.1)),
        border: `1px solid ${disabled ? (isDark ? '#222' : '#ccc') : color}`,
        borderRadius: '6px',
        color: disabled ? (isDark ? '#555' : '#aaa') : color,
        fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', opacity: disabled ? 0.5 : 1
    });

    // Intensity curve SVG
    const renderIntensityCurve = () => {
        if (sections.length === 0) return null;
        const w = 280, h = 40, pad = 4;
        const usableW = w - pad * 2;
        const usableH = h - pad * 2;

        const points = [];
        let barAcc = 0;
        for (const sec of sections) {
            const x1 = pad + (barAcc / totalBars) * usableW;
            const x2 = pad + ((barAcc + sec.bars) / totalBars) * usableW;
            const y = pad + (1 - sec.intensity) * usableH;
            points.push({ x1, x2, y, color: sec.color });
            barAcc += sec.bars;
        }

        return (
            <svg width={w} height={h} style={{ display: 'block', margin: '4px 0' }}>
                {/* Background */}
                <rect x={0} y={0} width={w} height={h} rx={4} fill={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} />
                {/* Filled sections */}
                {points.map((p, i) => (
                    <rect key={i} x={p.x1} y={p.y} width={p.x2 - p.x1} height={h - pad - p.y}
                        fill={hexToRgba(p.color, 0.4)} rx={1} />
                ))}
                {/* Line */}
                <polyline
                    points={points.flatMap(p => [`${p.x1},${p.y}`, `${p.x2},${p.y}`]).join(' ')}
                    fill="none" stroke={ac} strokeWidth={1.5} strokeLinejoin="round"
                />
            </svg>
        );
    };

    return (
        <div style={{
            borderBottom: expanded ? `1px solid ${borderColor}` : 'none',
            background: isDark ? 'rgba(12, 12, 16, 0.4)' : 'rgba(245, 245, 247, 0.6)',
            transition: 'all 0.2s'
        }}>
            {/* Toggle header */}
            <div
                onClick={() => setExpanded(prev => !prev)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', cursor: 'pointer', userSelect: 'none'
                }}
            >
                <span style={{
                    fontSize: '8px', color: isDark ? '#555' : '#aaa',
                    transition: 'transform 0.2s',
                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block'
                }}>&#9654;</span>
                <span style={{
                    fontSize: '9px', fontWeight: '800', letterSpacing: '1px',
                    color: isDark ? '#888' : '#666', textTransform: 'uppercase'
                }}>
                    {t('arrangementIntelligence.title') !== 'arrangementIntelligence.title'
                        ? t('arrangementIntelligence.title') : 'ARRANGEMENT AI'}
                </span>
                {!expanded && generated && (
                    <span style={{ fontSize: '8px', color: ac, fontWeight: '700', marginLeft: 'auto' }}>
                        {sections.length} sections &middot; {totalBars} bars &middot; {durationStr}
                    </span>
                )}
            </div>

            {/* Expanded content */}
            {expanded && (
                <div style={{ padding: '4px 12px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Controls row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Genre display */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '8px', fontWeight: '800', color: textMuted, letterSpacing: '0.5px' }}>GENRE</span>
                            <span style={{
                                fontSize: '10px', fontWeight: '700', color: ac,
                                padding: '2px 8px', borderRadius: '4px',
                                background: hexToRgba(ac, 0.1)
                            }}>
                                {genre}
                            </span>
                        </div>

                        {/* Variation slider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '8px', fontWeight: '800', color: textMuted, letterSpacing: '0.5px' }}>VARIATION</span>
                            <input
                                type="range" min={0} max={100} value={variation}
                                onChange={(e) => setVariation(Number(e.target.value))}
                                style={{ width: '80px', height: '3px', accentColor: acSec, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '9px', fontWeight: '700', color: isDark ? '#aaa' : '#555', minWidth: '28px' }}>
                                {variation}%
                            </span>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                            <button onClick={handleGenerate} style={btnStyle('#39ff14', false)}>
                                GENERATE
                            </button>
                            <button onClick={handleApply} disabled={!generated || applied} style={btnStyle(ac, !generated || applied)}>
                                {applied ? 'APPLIED' : 'APPLY TO TIMELINE'}
                            </button>
                        </div>
                    </div>

                    {/* Generated section list */}
                    {sections.length > 0 && (
                        <>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {sections.map((sec, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '3px 8px', borderRadius: '4px',
                                        background: hexToRgba(sec.color, isDark ? 0.15 : 0.12),
                                        border: `1px solid ${hexToRgba(sec.color, 0.3)}`
                                    }}>
                                        <div style={{
                                            width: '6px', height: '6px', borderRadius: '50%',
                                            background: sec.color
                                        }} />
                                        <span style={{
                                            fontSize: '9px', fontWeight: '700', color: textPrimary,
                                            textTransform: 'capitalize'
                                        }}>
                                            {sec.section}
                                        </span>
                                        <span style={{ fontSize: '8px', color: textMuted }}>
                                            {sec.bars}b
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Intensity curve */}
                            {renderIntensityCurve()}

                            {/* Stats */}
                            <div style={{ display: 'flex', gap: '12px', fontSize: '9px', color: textMuted }}>
                                <span>{totalBars} bars</span>
                                <span>{durationStr} @ {tempo} BPM</span>
                                <span>{sections.length} sections</span>
                            </div>
                        </>
                    )}

                    {/* Empty state */}
                    {!generated && (
                        <div style={{
                            fontSize: '10px', color: textMuted, fontStyle: 'italic',
                            padding: '8px 0'
                        }}>
                            Click GENERATE to create a song structure based on {genre}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ArrangementIntelligencePanel;
