import React, { useState, useCallback, useRef } from 'react';
import { hexToRgba } from './accentThemes';
import { applyEnergy, getEnergyProfile } from './core/music-intelligence/EnergyEngine';
import { useTranslation } from './i18n/I18nContext.jsx';

/**
 * BeatEnergyPanel — Collapsible panel for controlling beat section energy.
 *
 * Props:
 *   drumPattern     – current drum pattern state object
 *   onApplyEnergy   – callback(modifiedPattern) to push result into drums
 *   arrangement     – array of arrangement sections (for per-section mode)
 *   onApplyToArrangement – callback(sectionIndex, energy) to apply per-section energy
 *   theme           – 'dark' | 'light'
 *   accentColors    – { accent, secondary, gradient }
 *   sampler         – SamplerEngine instance (for preview)
 */
const BeatEnergyPanel = ({
    drumPattern,
    onApplyEnergy,
    arrangement,
    onApplyToArrangement,
    theme,
    accentColors,
    sampler
}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const isDark = theme === 'dark';

    const [expanded, setExpanded] = useState(false);
    const [energy, setEnergy] = useState(50);
    const [sectionEnergies, setSectionEnergies] = useState({});
    const previewTimeoutRef = useRef(null);
    const [isPreviewing, setIsPreviewing] = useState(false);

    const level = energy / 100;
    const profile = getEnergyProfile(level);

    // Use accent color consistently for energy display
    const energyColor = ac;

    const handleApply = useCallback(() => {
        if (!drumPattern || !onApplyEnergy) return;
        const modified = applyEnergy(drumPattern, level);
        onApplyEnergy(modified);
    }, [drumPattern, level, onApplyEnergy]);

    const handlePreview = useCallback(() => {
        if (!drumPattern || !onApplyEnergy || isPreviewing) return;
        setIsPreviewing(true);

        // Apply temporarily
        const modified = applyEnergy(drumPattern, level);
        const originalPattern = drumPattern;
        onApplyEnergy(modified);

        // Revert after 1.5 seconds
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = setTimeout(() => {
            onApplyEnergy(originalPattern);
            setIsPreviewing(false);
        }, 1500);
    }, [drumPattern, level, onApplyEnergy, isPreviewing]);

    const handleApplyToArrangement = useCallback(() => {
        if (!arrangement || !onApplyToArrangement) return;
        arrangement.forEach((sec, idx) => {
            const secEnergy = (sectionEnergies[idx] ?? 50) / 100;
            onApplyToArrangement(idx, secEnergy);
        });
    }, [arrangement, sectionEnergies, onApplyToArrangement]);

    const handleSectionEnergy = useCallback((idx, val) => {
        setSectionEnergies(prev => ({ ...prev, [idx]: Number(val) }));
    }, []);

    const labelStyle = {
        fontSize: '8px', fontWeight: '800', letterSpacing: '0.5px',
        color: isDark ? '#666' : '#999', whiteSpace: 'nowrap'
    };

    const btnStyle = (color, disabled) => ({
        padding: '4px 10px',
        background: disabled ? (isDark ? 'rgba(255,255,255,0.03)' : '#f0f0f0')
            : (isDark ? hexToRgba(color, 0.15) : hexToRgba(color, 0.1)),
        border: `1px solid ${disabled ? (isDark ? '#222' : '#ccc') : color}`,
        borderRadius: '10px', color: disabled ? (isDark ? '#555' : '#aaa') : color,
        fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px',
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1, lineHeight: 1
    });

    const hasSections = arrangement && arrangement.length > 1;

    return (
        <div style={{
            borderBottom: expanded ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e8e8e8'}` : 'none',
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
                    transition: 'transform 0.2s',
                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block'
                }}>&#9654;</span>
                <span style={{
                    fontSize: '9px', fontWeight: '800', letterSpacing: '1px',
                    color: isDark ? '#666' : '#999'
                }}>
                    {t('energy.title') !== 'energy.title' ? t('energy.title') : 'BEAT ENERGY'}
                </span>
                {!expanded && (
                    <span style={{ fontSize: '8px', color: energyColor, fontWeight: '700', marginLeft: '8px' }}>
                        {profile.label} ({energy}%)
                    </span>
                )}
            </div>

            {/* Expanded content */}
            {expanded && (
                <div style={{ padding: '0 20px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Main energy slider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={labelStyle}>ENERGY</span>
                        <input
                            type="range" min={0} max={100} value={energy}
                            onChange={(e) => setEnergy(Number(e.target.value))}
                            style={{ flex: 1, height: '3px', accentColor: energyColor, cursor: 'pointer' }}
                        />
                        <span style={{
                            fontSize: '10px', fontWeight: '700', color: energyColor,
                            minWidth: '50px', textAlign: 'center'
                        }}>
                            {profile.label}
                        </span>
                        <span style={{
                            fontSize: '9px', fontWeight: '700', color: isDark ? '#aaa' : '#555',
                            minWidth: '28px', textAlign: 'center'
                        }}>
                            {energy}%
                        </span>
                    </div>

                    {/* Per-section sliders (when arrangement has multiple sections) */}
                    {hasSections && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '4px',
                            padding: '6px 0', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e8e8e8'}`
                        }}>
                            <span style={{ ...labelStyle, marginBottom: '2px' }}>PER-SECTION</span>
                            {arrangement.map((sec, idx) => {
                                const secVal = sectionEnergies[idx] ?? 50;
                                const secColor = ac;
                                return (
                                    <div key={sec.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{
                                            fontSize: '8px', fontWeight: '700', color: sec.color || (isDark ? '#888' : '#666'),
                                            minWidth: '50px', textAlign: 'right', overflow: 'hidden',
                                            textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {sec.name || `S${idx + 1}`}
                                        </span>
                                        <input
                                            type="range" min={0} max={100} value={secVal}
                                            onChange={(e) => handleSectionEnergy(idx, e.target.value)}
                                            style={{ flex: 1, height: '3px', accentColor: secColor, cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '8px', fontWeight: '700', color: secColor, minWidth: '24px', textAlign: 'center' }}>
                                            {secVal}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={handlePreview} disabled={!drumPattern || isPreviewing} style={btnStyle(ac, !drumPattern || isPreviewing)}>
                            {isPreviewing ? 'PREVIEWING...' : 'PREVIEW'}
                        </button>
                        <button onClick={handleApply} disabled={!drumPattern} style={btnStyle(energyColor, !drumPattern)}>
                            APPLY
                        </button>
                        {hasSections && onApplyToArrangement && (
                            <button onClick={handleApplyToArrangement} style={btnStyle(ac, false)}>
                                APPLY TO ARRANGEMENT
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BeatEnergyPanel;
