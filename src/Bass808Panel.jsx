import React, { useState, useCallback } from 'react';
import { hexToRgba } from './accentThemes';
import { generate808Bassline } from './core/music-intelligence/Bass808Engine';
import { useTranslation } from './i18n/I18nContext.jsx';

/**
 * Bass808Panel — Collapsible panel for 808 Bass Intelligence generation.
 *
 * Props:
 *   drumPattern     – current drum pattern state (for kick alignment)
 *   chordPattern    – current chord note array (for root following)
 *   globalKey, globalScale, globalBars, globalOctave – music settings
 *   theme, accentColors – styling
 *   onInsert        – callback(bassNotes) to push 808 pattern into bass track
 */
const Bass808Panel = ({
    drumPattern,
    chordPattern,
    globalKey,
    globalScale,
    globalBars,
    globalOctave,
    theme,
    accentColors,
    onInsert
}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const isDark = theme === 'dark';

    const [expanded, setExpanded] = useState(false);
    const [enableSlides, setEnableSlides] = useState(true);
    const [enableOctaveJumps, setEnableOctaveJumps] = useState(true);
    const [density, setDensity] = useState(50);
    const [lastResult, setLastResult] = useState(null);

    const handleGenerate = useCallback(() => {
        // Extract chord progression roots from chord pattern if available
        let chordProgression = null;
        if (chordPattern && chordPattern.length > 0) {
            // Group chord notes by time to find chord changes, extract root
            const chordsByTime = {};
            for (const n of chordPattern) {
                if (!chordsByTime[n.time]) chordsByTime[n.time] = [];
                chordsByTime[n.time].push(n.note);
            }
            // We don't need Roman numerals — the engine's buildChordRootMap handles that.
            // But generate808Bassline also accepts the raw drum pattern for kick detection.
        }

        const notes = generate808Bassline({
            drumPattern,
            chordProgression,
            key: globalKey,
            scale: globalScale,
            bars: globalBars,
            octave: 1, // 808s always sit at octave 1-2
            enableSlides,
            enableOctaveJumps,
            density: density / 100
        });

        setLastResult(notes);
    }, [drumPattern, chordPattern, globalKey, globalScale, globalBars, enableSlides, enableOctaveJumps, density]);

    const handleInsert = useCallback(() => {
        if (!lastResult || lastResult.length === 0 || !onInsert) return;
        onInsert(lastResult);
        setLastResult(null);
    }, [lastResult, onInsert]);

    const slideCount = lastResult ? lastResult.filter(n => n.slide).length : 0;
    const borderColor = isDark ? 'rgba(255,255,255,0.05)' : '#e8e8e8';
    const textMuted = isDark ? '#666' : '#999';

    const labelStyle = {
        fontSize: '8px', fontWeight: '800', letterSpacing: '0.5px',
        color: textMuted, whiteSpace: 'nowrap'
    };

    const toggleStyle = (active, color) => ({
        padding: '4px 10px',
        background: active
            ? (isDark ? hexToRgba(color, 0.2) : hexToRgba(color, 0.12))
            : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
        border: `1px solid ${isDark ? '#2a2a3e' : '#ddd'}`,
        borderRadius: '4px',
        color: active ? color : (isDark ? '#aaa' : '#666'),
        fontSize: '9px', fontWeight: '800', letterSpacing: '0.3px',
        cursor: 'pointer', transition: 'all 0.15s'
    });

    const btnStyle = (color, disabled) => ({
        padding: '5px 12px',
        background: disabled ? (isDark ? 'rgba(255,255,255,0.03)' : '#f0f0f0')
            : (isDark ? hexToRgba(color, 0.15) : hexToRgba(color, 0.1)),
        border: `1px solid ${disabled ? (isDark ? '#222' : '#ccc') : color}`,
        borderRadius: '4px',
        color: disabled ? (isDark ? '#555' : '#aaa') : color,
        fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', opacity: disabled ? 0.5 : 1
    });

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
                    padding: '6px 20px', cursor: 'pointer', userSelect: 'none'
                }}
            >
                <span style={{
                    fontSize: '8px', color: isDark ? '#555' : '#aaa',
                    transition: 'transform 0.15s',
                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block'
                }}>&#9654;</span>
                <span style={{
                    fontSize: '9px', fontWeight: '800', letterSpacing: '1px',
                    color: isDark ? '#888' : '#666'
                }}>
                    808 BASS INTELLIGENCE
                </span>
                {lastResult && lastResult.length > 0 && (
                    <span style={{ fontSize: '8px', color: acSec, fontWeight: '700', marginLeft: 'auto' }}>
                        {lastResult.length} notes{slideCount > 0 ? ` (${slideCount} slides)` : ''}
                    </span>
                )}
            </div>

            {/* Expanded content */}
            {expanded && (
                <div style={{ padding: '4px 20px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Controls row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Slides toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={labelStyle}>SLIDES</span>
                            <button onClick={() => setEnableSlides(p => !p)} style={toggleStyle(enableSlides, acSec)}>
                                {enableSlides ? 'ON' : 'OFF'}
                            </button>
                        </div>

                        {/* Octave Jumps toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={labelStyle}>OCT JUMPS</span>
                            <button onClick={() => setEnableOctaveJumps(p => !p)} style={toggleStyle(enableOctaveJumps, '#54a0ff')}>
                                {enableOctaveJumps ? 'ON' : 'OFF'}
                            </button>
                        </div>

                        {/* Density slider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={labelStyle}>DENSITY</span>
                            <input
                                type="range" min={0} max={100} value={density}
                                onChange={(e) => setDensity(Number(e.target.value))}
                                style={{ width: '70px', height: '3px', accentColor: ac, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '9px', fontWeight: '700', color: isDark ? '#aaa' : '#555', minWidth: '28px' }}>
                                {density}%
                            </span>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={handleGenerate} style={btnStyle('#39ff14', false)}>
                            GENERATE 808
                        </button>
                        <button onClick={handleInsert} disabled={!lastResult || lastResult.length === 0} style={btnStyle(acSec, !lastResult || lastResult.length === 0)}>
                            INSERT INTO BASS
                        </button>

                        {/* Status */}
                        {lastResult && (
                            <span style={{ fontSize: '9px', color: isDark ? '#888' : '#777', marginLeft: '4px' }}>
                                {lastResult.length} notes generated
                                {enableSlides && slideCount > 0 ? ` (slides enabled)` : ''}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bass808Panel;
