import React, { useState, useCallback } from 'react';

/**
 * StemSeparationModal — Modal dialog for stem separation (audio) and MIDI extraction.
 * Shared by both modes with different stem options.
 *
 * Props:
 *   isOpen, mode ('audio'|'midi'), clipName, isDark, accentColors,
 *   onClose, onConfirm({ stems, quality }), processing, progress (0-1)
 */
export default function StemSeparationModal({
    isOpen, mode = 'audio', clipName = 'Audio Clip',
    isDark = true, accentColors = {},
    onClose, onConfirm,
    processing = false, progress = 0
}) {
    if (!isOpen) return null;

    const ac = accentColors?.accent || '#ff6b6b';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const AUDIO_STEMS = [
        { key: 'vocals', label: 'Vocals', icon: '\uD83C\uDFA4', color: '#ff6b9d' },
        { key: 'drums', label: 'Drums', icon: '\uD83E\uDD41', color: '#ffd93d' },
        { key: 'bass', label: 'Bass', icon: '\uD83C\uDFB8', color: '#6bcfff' },
        { key: 'other', label: 'Others', icon: '\uD83C\uDFB9', color: '#a8e6cf' }
    ];

    const MIDI_STEMS = [
        { key: 'bass', label: 'Bass', icon: '\uD83C\uDFB8', color: '#6bcfff' },
        { key: 'melody', label: 'Melody', icon: '\uD83C\uDFB5', color: '#ff6b9d' },
        { key: 'chords', label: 'Chords', icon: '\uD83C\uDFB9', color: '#a8e6cf' },
        { key: 'drums', label: 'Drums', icon: '\uD83E\uDD41', color: '#ffd93d' }
    ];

    const stemOptions = mode === 'audio' ? AUDIO_STEMS : MIDI_STEMS;

    const [selected, setSelected] = useState(() => {
        const init = {};
        stemOptions.forEach(s => { init[s.key] = true; });
        return init;
    });
    const [quality, setQuality] = useState('fast');

    const toggleStem = useCallback((key) => {
        setSelected(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleConfirm = useCallback(() => {
        const stems = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
        if (stems.length === 0) return;
        onConfirm({ stems, quality });
    }, [selected, quality, onConfirm]);

    const anySelected = Object.values(selected).some(v => v);

    const bg = isDark ? '#1a1a22' : '#fff';
    const textColor = isDark ? '#e0e0e0' : '#333';
    const mutedColor = isDark ? '#888' : '#999';
    const borderColor = isDark ? '#333' : '#ddd';
    const hoverBg = isDark ? '#252530' : '#f5f5f5';

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2500
        }} onClick={processing ? undefined : onClose}>
            <div style={{
                background: bg, border: `1px solid ${ac}`,
                borderRadius: '10px', padding: '0', minWidth: '340px', maxWidth: '400px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: `1px solid ${borderColor}`,
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            background: acGrad, borderRadius: '4px',
                            padding: '2px 8px', fontSize: '10px', fontWeight: 800,
                            color: '#fff', letterSpacing: '0.5px'
                        }}>
                            Live
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: textColor }}>
                            {mode === 'audio' ? 'Separate Stems' : 'Extract MIDI Stems'}
                        </span>
                    </div>
                    {!processing && (
                        <div
                            onClick={onClose}
                            style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontSize: '14px', color: mutedColor,
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#333' : '#eee'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            \u2715
                        </div>
                    )}
                </div>

                {/* Stem options */}
                <div style={{ padding: '6px 0' }}>
                    {stemOptions.map(stem => (
                        <div
                            key={stem.key}
                            onClick={processing ? undefined : () => toggleStem(stem.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 18px', cursor: processing ? 'default' : 'pointer',
                                transition: 'background 0.15s',
                                opacity: processing ? 0.6 : 1
                            }}
                            onMouseEnter={e => { if (!processing) e.currentTarget.style.background = hoverBg; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: '28px', height: '28px', borderRadius: '6px',
                                background: `${stem.color}22`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '15px'
                            }}>
                                {stem.icon}
                            </div>
                            {/* Label */}
                            <span style={{
                                flex: 1, fontSize: '13px', fontWeight: 600,
                                color: textColor
                            }}>
                                {stem.label}
                            </span>
                            {/* Checkbox */}
                            <div style={{
                                width: '20px', height: '20px', borderRadius: '4px',
                                border: `2px solid ${selected[stem.key] ? ac : borderColor}`,
                                background: selected[stem.key] ? ac : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s', flexShrink: 0
                            }}>
                                {selected[stem.key] && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quality toggle */}
                <div style={{
                    padding: '12px 18px',
                    borderTop: `1px solid ${borderColor}`,
                    display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                    <span style={{ fontSize: '12px', color: mutedColor, marginRight: 'auto' }}>
                        {quality === 'fast' ? 'High Speed' : 'High Quality'}
                    </span>
                    {/* Toggle switch */}
                    <div
                        onClick={processing ? undefined : () => setQuality(q => q === 'fast' ? 'high' : 'fast')}
                        style={{
                            width: '40px', height: '20px', borderRadius: '10px',
                            background: quality === 'high' ? ac : (isDark ? '#444' : '#ccc'),
                            position: 'relative', cursor: processing ? 'default' : 'pointer',
                            transition: 'background 0.2s', flexShrink: 0
                        }}
                    >
                        <div style={{
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: '#fff', position: 'absolute', top: '2px',
                            left: quality === 'high' ? '22px' : '2px',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }} />
                    </div>
                </div>

                {/* Warning */}
                <div style={{
                    padding: '10px 18px',
                    borderTop: `1px solid ${borderColor}`,
                    fontSize: '11px', color: mutedColor
                }}>
                    {processing
                        ? `Processing... ${Math.round(progress * 100)}%`
                        : 'This action will stop audio.'}
                </div>

                {/* Progress bar (during processing) */}
                {processing && (
                    <div style={{ padding: '0 18px 12px', marginTop: '-4px' }}>
                        <div style={{
                            height: '4px', borderRadius: '2px',
                            background: isDark ? '#333' : '#ddd',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%', borderRadius: '2px',
                                background: acGrad,
                                width: `${Math.round(progress * 100)}%`,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                )}

                {/* Buttons */}
                <div style={{
                    display: 'flex', gap: '8px',
                    padding: '12px 18px',
                    borderTop: `1px solid ${borderColor}`
                }}>
                    <button
                        onClick={onClose}
                        disabled={processing}
                        style={{
                            flex: 1, padding: '8px 16px', borderRadius: '6px',
                            border: `1px solid ${borderColor}`,
                            background: isDark ? '#252530' : '#f0f0f0',
                            color: textColor, fontSize: '12px', fontWeight: 600,
                            cursor: processing ? 'not-allowed' : 'pointer',
                            opacity: processing ? 0.5 : 1,
                            transition: 'all 0.15s'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={processing || !anySelected}
                        style={{
                            flex: 1, padding: '8px 16px', borderRadius: '6px',
                            border: 'none',
                            background: (!anySelected || processing) ? (isDark ? '#333' : '#ccc') : acGrad,
                            color: '#fff', fontSize: '12px', fontWeight: 700,
                            cursor: (!anySelected || processing) ? 'not-allowed' : 'pointer',
                            opacity: (!anySelected || processing) ? 0.5 : 1,
                            transition: 'all 0.15s'
                        }}
                    >
                        {mode === 'audio' ? 'Separate' : 'Extract'}
                    </button>
                </div>
            </div>
        </div>
    );
}
