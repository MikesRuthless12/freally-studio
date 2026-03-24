import React, { useState } from 'react';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

/**
 * HumanizePanel — Compact collapsible panel with humanization sliders
 * and Humanize / Variation action buttons.
 */
const HumanizePanel = ({ humanizeParams, setHumanizeParams, onHumanize, onVariation, theme, accentColors}) => {
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const { t } = useTranslation();
    const isDark = theme === 'dark';
    const [expanded, setExpanded] = useState(false);
    const [variationAmount, setVariationAmount] = useState(25); // 0-100

    const sliders = [
        { key: 'swing',             label: t('humanize.swing'),    color: ac },
        { key: 'velocityVariation', label: t('humanize.vel'),  color: acSec },
        { key: 'timingJitter',      label: t('humanize.jitter'),   color: '#54a0ff' },
        { key: 'ghostNotes',        label: t('humanize.ghosts'),   color: '#5f27cd' }
    ];

    const handleSlider = (key, value) => {
        setHumanizeParams(prev => ({ ...prev, [key]: Number(value) }));
    };

    const labelStyle = {
        fontSize: '8px',
        fontWeight: '800',
        letterSpacing: '0.5px',
        color: isDark ? '#666' : '#999',
        whiteSpace: 'nowrap',
        minWidth: '48px',
        textAlign: 'right'
    };

    const valueStyle = {
        fontSize: '9px',
        fontWeight: '700',
        color: isDark ? '#aaa' : '#555',
        minWidth: '24px',
        textAlign: 'center'
    };

    const btnStyle = (active) => ({
        padding: '4px 10px',
        background: active
            ? (isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.1))
            : 'transparent',
        border: `1px solid ${isDark ? '#2a2a3e' : '#ddd'}`,
        borderRadius: '10px',
        color: isDark ? '#ccc' : '#444',
        fontSize: '9px',
        fontWeight: '800',
        letterSpacing: '0.5px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        lineHeight: 1
    });

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
                    transition: 'transform 0.2s',
                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block'
                }}>
                    {'\u25B6'}
                </span>
                <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    letterSpacing: '1px',
                    color: isDark ? '#666' : '#999'
                }}>
                    {t('humanize.title')}
                </span>
                {!expanded && (
                    <span style={{
                        fontSize: '8px',
                        color: isDark ? '#444' : '#bbb',
                        marginLeft: '8px'
                    }}>
                        {t('humanize.sw')}:{humanizeParams.swing} {t('humanize.vel')}:{humanizeParams.velocityVariation} {t('humanize.jit')}:{humanizeParams.timingJitter} {t('humanize.gh')}:{humanizeParams.ghostNotes}
                    </span>
                )}
            </div>

            {/* Expanded content */}
            {expanded && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '0 20px 10px 20px',
                    flexWrap: 'wrap'
                }}>
                    {/* Sliders */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                        {sliders.map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={labelStyle}>{s.label}</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={humanizeParams[s.key]}
                                    onChange={(e) => handleSlider(s.key, e.target.value)}
                                    style={{
                                        width: '60px',
                                        height: '3px',
                                        accentColor: s.color,
                                        cursor: 'pointer'
                                    }}
                                    title={`${s.label}: ${humanizeParams[s.key]}%`}
                                />
                                <span style={valueStyle}>{humanizeParams[s.key]}</span>
                            </div>
                        ))}
                    </div>

                    {/* Divider */}
                    <div style={{
                        width: '1px',
                        height: '24px',
                        background: isDark ? 'rgba(255,255,255,0.08)' : '#ddd'
                    }} />

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={onHumanize}
                            style={btnStyle(false)}
                            title={t('humanize.applyTooltip')}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.2) : hexToRgba(ac, 0.15);
                                e.currentTarget.style.borderColor = ac;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = isDark ? '#2a2a3e' : '#ddd';
                            }}
                        >
                            {t('humanize.apply')}
                        </button>

                        <div style={{
                            width: '1px',
                            height: '16px',
                            background: isDark ? 'rgba(255,255,255,0.06)' : '#e0e0e0'
                        }} />

                        <button
                            onClick={() => onVariation(variationAmount / 100)}
                            style={btnStyle(false)}
                            title={t('humanize.varyTooltip', { amount: variationAmount })}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = isDark ? 'rgba(255,159,67,0.2)' : 'rgba(255,159,67,0.15)';
                                e.currentTarget.style.borderColor = acSec;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = isDark ? '#2a2a3e' : '#ddd';
                            }}
                        >
                            {t('humanize.vary')}
                        </button>
                        <input
                            type="range"
                            min={5}
                            max={100}
                            value={variationAmount}
                            onChange={(e) => setVariationAmount(Number(e.target.value))}
                            style={{
                                width: '40px',
                                height: '3px',
                                accentColor: acSec,
                                cursor: 'pointer'
                            }}
                            title={`Variation amount: ${variationAmount}%`}
                        />
                        <span style={valueStyle}>{variationAmount}%</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HumanizePanel;
