/**
 * DetailPanelEffectCard.jsx — Compact horizontal effect card for the detail panel.
 *
 * Renders a single effect with its interactive canvas visualizer and parameter
 * controls. Used inside DetailPanel's horizontal effects chain.
 *
 * Supports:
 * - Real-time interactive canvas visualizer (via InteractiveCanvas)
 * - Dynamic knob sizing based on panelHeight
 * - Enlarged/focus mode (fills entire chain area)
 * - Bypass, remove, drag-reorder, selection highlight
 */

import React, { useState, useCallback, useMemo } from 'react';
import Knob from './Knob';
import InteractiveCanvas from './InteractiveCanvas';
import { EFFECT_PARAM_DEFS, EFFECT_DISPLAY_NAMES } from './effects/effectParamDefs.js';
import { LOOMSAUCE_FACTORY_PRESETS } from './effects/LoomSauce.js';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

// i18n lookup map for effect names
const EFFECT_NAME_I18N = {
    'Compressor': 'effects.name.compressor',
    'GlueCompressor': 'effects.name.glueCompressor',
    'Glue Compressor': 'effects.name.glueCompressor',
    'Limiter': 'effects.name.limiter',
    'Gate': 'effects.name.gate',
    'SidechainCompressor': 'effects.name.sidechain',
    'Sidechain': 'effects.name.sidechain',
    'EQEight': 'effects.name.eqEight',
    'EQ Eight': 'effects.name.eqEight',
    'Saturation': 'effects.name.saturation',
    'Distortion': 'effects.name.distortion',
    'Reverb': 'effects.name.reverb',
    'Delay': 'effects.name.delay',
    'Echo': 'effects.name.echo',
    'Chorus': 'effects.name.chorus',
    'Phaser': 'effects.name.phaser',
    'StereoWidener': 'effects.name.stereoWidener',
    'Stereo Widener': 'effects.name.stereoWidener',
    'AutoPan': 'effects.name.autoPan',
    'Auto Pan': 'effects.name.autoPan',
    'Auto Pan (Ping-Pong)': 'effects.name.autoPan',
    'Utility': 'effects.name.utility',
    'Tuner': 'effects.name.tuner',
    'LoomSauce': 'effects.name.loomSauce',
    'Loom Sauce': 'effects.name.loomSauce',
    'Vocoder': 'effects.name.vocoder',
    'SoftClipper': 'effects.name.softClipper',
    'Soft Clipper': 'effects.name.softClipper',
    'Tremolo': 'effects.name.tremolo',
    'RingModulator': 'effects.name.ringModulator',
    'Ring Modulator': 'effects.name.ringModulator',
    'Flanger': 'effects.name.flanger',
    'FrequencyShifter': 'effects.name.frequencyShifter',
    'Freq Shifter': 'effects.name.frequencyShifter',
    'BitCrusher': 'effects.name.bitCrusher',
    'Bit Crusher': 'effects.name.bitCrusher',
    'Tape': 'effects.name.tape',
    'Vinyl': 'effects.name.vinyl',
    'Cabinet': 'effects.name.cabinet',
    'TransientShaper': 'effects.name.transientShaper',
    'Transient Shaper': 'effects.name.transientShaper',
    'DeEsser': 'effects.name.deEsser',
    'De-Esser': 'effects.name.deEsser',
    'MultibandCompressor': 'effects.name.multibandCompressor',
    'Multiband Comp': 'effects.name.multibandCompressor',
    'HalfTime': 'effects.name.halfTime',
    'Half-Time': 'effects.name.halfTime',
    'MasteringRack': 'effects.name.masteringRack',
    'Mastering Rack': 'effects.name.masteringRack',
};

const BASE_CARD_WIDTH = 200;
const MIN_KNOB = 28;
const MAX_KNOB = 52;
const ENLARGED_KNOB = 60;

// Effects that need wider cards to fit all controls (multiplier on base width)
const WIDE_EFFECT_MULTIPLIERS = {
    MasteringRack: 2.0,
    MultibandCompressor: 1.6,
};

export default function DetailPanelEffectCard({
    effect,
    onRemove,
    onUpdate,
    isDark,
    accentColors,
    draggable = true,
    onDragStart,
    onDragOver,
    onDragEnd,
    isSelected = false,
    onHeaderClick,
    panelHeight = 200,
    enlarged = false,
    onEnlarge,
    onRestore,
    isMaximized = false,
    onToggleMaximize,
}) {
    const { t } = useTranslation();
    const [hovered, setHovered] = useState(false);
    const [bypassed, setBypassed] = useState(effect?.bypassed || false);

    const ac = accentColors?.accent || '#ff6b6b';
    const bg = isDark ? 'linear-gradient(180deg, #1e1e28, #16161e)' : 'linear-gradient(180deg, #f5f5f8, #ebebf0)';
    const bgFlat = isDark ? '#1a1a22' : '#f0f0f5';
    const headerBg = isDark ? 'linear-gradient(180deg, #1e1e28, #18181f)' : 'linear-gradient(180deg, #ebebf0, #e4e4ec)';
    const textColor = isDark ? '#d0d0d0' : '#333';
    const dimColor = isDark ? '#777' : '#999';
    const borderColor = isDark ? '#2a2a36' : '#d0d0d8';

    const effectType = effect?.name || 'Unknown';
    const rawDisplayName = EFFECT_DISPLAY_NAMES[effectType] || effectType;
    const displayName = EFFECT_NAME_I18N[effectType] ? t(EFFECT_NAME_I18N[effectType]) : rawDisplayName;
    const paramDefs = EFFECT_PARAM_DEFS[effectType] || [];
    const params = effect?.getParams?.() || {};

    // Dynamic knob size based on panel height (120–500 range)
    const knobSize = useMemo(() => {
        if (enlarged) return ENLARGED_KNOB;
        const interp = Math.max(0, Math.min(1, (panelHeight - 120) / (500 - 120)));
        return Math.round(MIN_KNOB + interp * (MAX_KNOB - MIN_KNOB));
    }, [panelHeight, enlarged]);

    // Dynamic card width: scale with knob size, wider when enlarged
    const widthMult = WIDE_EFFECT_MULTIPLIERS[effectType] || 1;
    const cardWidth = useMemo(() => {
        if (enlarged) return '100%';
        const interp = Math.max(0, Math.min(1, (panelHeight - 120) / (500 - 120)));
        return Math.round((BASE_CARD_WIDTH + interp * 80) * widthMult);
    }, [panelHeight, enlarged, widthMult]);

    // Font sizes scale slightly
    const labelFontSize = enlarged ? '11px' : (knobSize >= 40 ? '9px' : '8px');
    const valueFontSize = enlarged ? '9px' : (knobSize >= 40 ? '8px' : '7px');
    const headerFontSize = enlarged ? '11px' : '9px';

    // Theme object for InteractiveCanvas
    const canvasTheme = useMemo(() => ({
        isDark: isDark,
        accentColor: ac,
    }), [isDark, ac]);

    const handleBypassToggle = useCallback(() => {
        if (!effect) return;
        const newState = !bypassed;
        setBypassed(newState);
        effect.bypassed = newState;
        if (effect._applyBypass) effect._applyBypass();
        if (onUpdate) onUpdate();
    }, [effect, bypassed, onUpdate]);

    const handleParamChange = useCallback((key, value, def) => {
        if (!effect) return;
        // Handle EQ Eight virtual band knobs — write to bands array
        if (def?._bandIndex !== undefined && def?._bandParam) {
            const bands = effect.getParams?.().bands;
            if (bands && bands[def._bandIndex]) {
                const newBands = bands.map((b, i) =>
                    i === def._bandIndex ? { ...b, [def._bandParam]: value } : b
                );
                effect.setParam('bands', newBands);
            }
        } else {
            effect.setParam(key, value);
        }
        if (onUpdate) onUpdate();
    }, [effect, onUpdate]);

    const handleCanvasUpdate = useCallback(() => {
        if (onUpdate) onUpdate();
    }, [onUpdate]);

    // Render a single param control
    const renderParam = (def) => {
        // Handle EQ Eight virtual band knobs — read from bands array
        let val;
        if (def._bandIndex !== undefined && def._bandParam && params.bands) {
            const band = params.bands[def._bandIndex];
            val = band ? band[def._bandParam] : 0;
        } else {
            val = params[def.key];
        }
        const toggleH = enlarged ? 24 : (knobSize >= 40 ? 22 : 18);
        const selectW = enlarged ? 100 : Math.min(knobSize + 30, 62);

        if (def.type === 'knob') {
            return (
                <div key={def.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: enlarged ? '3px' : '1px' }}>
                    <Knob
                        label=""
                        value={val ?? def.min ?? 0}
                        min={def.min ?? 0}
                        max={def.max ?? 1}
                        onChange={(v) => handleParamChange(def.key, v, def)}
                        color={ac}
                        size={knobSize}
                        isDark={isDark}
                        accentColors={accentColors}
                    />
                    <span style={{ fontSize: labelFontSize, color: dimColor, fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase', textAlign: 'center', lineHeight: enlarged ? '14px' : '10px', maxWidth: knobSize + 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {def.label}
                    </span>
                    {def.display && (
                        <span style={{ fontSize: valueFontSize, color: ac, fontWeight: '700', marginTop: '-1px' }}>
                            {def.display(val ?? def.min ?? 0)}
                        </span>
                    )}
                </div>
            );
        }

        if (def.type === 'toggle') {
            const isOn = !!val;
            return (
                <div key={def.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <div
                        onClick={() => handleParamChange(def.key, !isOn, def)}
                        style={{
                            width: knobSize, height: toggleH, borderRadius: '3px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', userSelect: 'none',
                            background: isOn ? hexToRgba(ac, 0.25) : (isDark ? '#2a2a36' : '#d8d8e0'),
                            border: `1px solid ${isOn ? ac : (isDark ? '#3a3a46' : '#c0c0c8')}`,
                            color: isOn ? ac : dimColor,
                            fontSize: labelFontSize, fontWeight: '700',
                        }}
                    >
                        {isOn ? t('common.on') : t('common.off')}
                    </div>
                    <span style={{ fontSize: labelFontSize, color: dimColor, fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                        {def.label}
                    </span>
                </div>
            );
        }

        if (def.type === 'select') {
            return (
                <div key={def.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <select
                        value={val || ''}
                        onChange={(e) => handleParamChange(def.key, e.target.value, def)}
                        style={{
                            width: selectW, height: toggleH, borderRadius: '3px',
                            background: isDark ? '#2a2a36' : '#e0e0e8',
                            color: textColor, border: `1px solid ${borderColor}`,
                            fontSize: labelFontSize, fontWeight: '600', outline: 'none', cursor: 'pointer',
                            padding: '0 2px',
                        }}
                    >
                        {(def.options || []).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                    <span style={{ fontSize: labelFontSize, color: dimColor, fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                        {def.label}
                    </span>
                </div>
            );
        }

        // eq-bands: skip placeholder (real band knobs follow in the array)
        if (def.type === 'eq-bands') {
            return null;
        }

        // loom-sauce: render preset selector instead of placeholder
        if (def.type === 'loom-sauce') {
            const presets = LOOMSAUCE_FACTORY_PRESETS || [];
            // Find current preset by comparing params
            const currentParams = effect?.getParams?.() || {};
            const currentPresetName = (() => {
                for (const p of presets) {
                    let match = true;
                    for (const [k, v] of Object.entries(p.params)) {
                        if (typeof v === 'number' && Math.abs((currentParams[k] ?? 0) - v) > 0.01) { match = false; break; }
                        if (typeof v === 'boolean' && currentParams[k] !== v) { match = false; break; }
                    }
                    if (match) return p.name;
                }
                return '';
            })();
            return (
                <div key={def.key} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0', gap: '6px' }}>
                    <span style={{ fontSize: enlarged ? '10px' : '8px', color: dimColor, fontWeight: '700', flexShrink: 0 }}>{t('effects.rack.preset')}</span>
                    <select
                        value={currentPresetName}
                        onChange={(e) => {
                            const preset = presets.find(p => p.name === e.target.value);
                            if (preset && effect) {
                                Object.entries(preset.params).forEach(([k, v]) => {
                                    effect.setParam(k, v);
                                });
                                if (onUpdate) onUpdate();
                            }
                        }}
                        style={{
                            flex: 1, maxWidth: enlarged ? 200 : 120,
                            height: enlarged ? 24 : 20, borderRadius: '3px',
                            background: isDark ? '#2a2a36' : '#e0e0e8',
                            color: textColor, border: `1px solid ${borderColor}`,
                            fontSize: enlarged ? '10px' : '8px', fontWeight: '600',
                            outline: 'none', cursor: 'pointer', padding: '0 4px',
                        }}
                    >
                        <option value="">{t('detailPanel.custom')}</option>
                        {presets.map(p => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                </div>
            );
        }

        return null;
    };

    // Show canvas when panel is tall enough (>150px) or enlarged
    const showCanvas = enlarged || panelHeight >= 150;

    return (
        <div
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: enlarged ? '100%' : cardWidth,
                minWidth: enlarged ? 0 : cardWidth,
                flexShrink: enlarged ? 1 : 0,
                flex: enlarged ? 1 : 'none',
                display: 'flex', flexDirection: 'column',
                background: bg,
                border: `1px solid ${isSelected ? ac : (hovered ? ac : borderColor)}`,
                borderRadius: '6px',
                overflow: 'hidden',
                opacity: bypassed ? 0.5 : 1,
                transition: 'border-color 0.15s, opacity 0.15s, box-shadow 0.2s',
                cursor: draggable ? 'grab' : 'default',
                boxShadow: isSelected
                    ? `0 0 0 1px ${ac}, inset 0 0 8px ${hexToRgba(ac, 0.1)}, 0 4px 12px rgba(0,0,0,0.3)`
                    : hovered
                        ? `0 0 12px ${hexToRgba(ac, 0.12)}, inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}, 0 2px 8px rgba(0,0,0,${isDark ? '0.3' : '0.1'})`
                        : `inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}, 0 2px 8px rgba(0,0,0,${isDark ? '0.3' : '0.1'})`,
            }}
        >
            {/* Header — Shift/Ctrl+click to select for grouping */}
            <div
                onClick={(e) => { if (onHeaderClick) onHeaderClick(e); }}
                style={{
                    height: enlarged ? 32 : 26, flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '0 6px',
                    background: isSelected ? hexToRgba(ac, 0.15) : headerBg,
                    borderBottom: `1px solid ${isSelected ? hexToRgba(ac, 0.3) : borderColor}`,
                    boxShadow: `0 1px 0 ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}`,
                    cursor: 'pointer',
                }}>
                {/* Active LED indicator */}
                <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: bypassed ? (isDark ? '#333' : '#bbb') : ac,
                    boxShadow: bypassed ? 'none' : `0 0 4px ${ac}, 0 0 8px ${hexToRgba(ac, 0.3)}`,
                    transition: 'background 0.15s, box-shadow 0.15s',
                }} />

                {/* Drag handle */}
                {!enlarged && (
                    <span style={{ fontSize: '9px', color: dimColor, cursor: 'grab', userSelect: 'none' }}>⠿</span>
                )}

                {/* Effect name */}
                <span style={{
                    flex: 1, fontSize: headerFontSize, fontWeight: '800',
                    color: textColor, letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {displayName}
                </span>

                {/* Enlarge / Restore button */}
                {enlarged ? (
                    <>
                        <div
                            onClick={(e) => { e.stopPropagation(); if (onRestore) onRestore(); }}
                            title={t('detailPanel.restoreToChain')}
                            style={{
                                width: 36, height: 18, borderRadius: '3px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', userSelect: 'none',
                                background: hexToRgba(ac, 0.15), color: ac,
                                fontSize: '7px', fontWeight: '800',
                                border: `1px solid ${hexToRgba(ac, 0.3)}`,
                            }}
                        >
                            {t('detailPanel.back')}
                        </div>
                        {/* Maximize / Restore panel height */}
                        {onToggleMaximize && (
                            <div
                                onClick={(e) => { e.stopPropagation(); onToggleMaximize(); }}
                                title={isMaximized ? t('detailPanel.restorePanelSize') : t('detailPanel.maximizePanel')}
                                style={{
                                    width: 36, height: 18, borderRadius: '3px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', userSelect: 'none',
                                    background: isMaximized ? hexToRgba(ac, 0.25) : hexToRgba(ac, 0.1),
                                    color: ac,
                                    fontSize: '7px', fontWeight: '800',
                                    border: `1px solid ${hexToRgba(ac, isMaximized ? 0.5 : 0.2)}`,
                                }}
                            >
                                {isMaximized ? t('detailPanel.min') : t('detailPanel.max')}
                            </div>
                        )}
                    </>
                ) : (
                    <div
                        onClick={(e) => { e.stopPropagation(); if (onEnlarge) onEnlarge(); }}
                        title={t('detailPanel.enlargeEffect')}
                        style={{
                            width: 16, height: 16, borderRadius: '3px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', userSelect: 'none',
                            color: dimColor,
                            fontSize: '10px', fontWeight: '700',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = ac}
                        onMouseLeave={(e) => e.currentTarget.style.color = dimColor}
                    >
                        ⤢
                    </div>
                )}

                {/* Bypass toggle */}
                <div
                    onClick={(e) => { e.stopPropagation(); handleBypassToggle(); }}
                    title={bypassed ? t('effects.rack.enable') : t('effects.rack.bypass')}
                    style={{
                        width: enlarged ? 28 : 18, height: enlarged ? 20 : 16, borderRadius: '3px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', userSelect: 'none',
                        background: bypassed ? (isDark ? '#2a2a36' : '#d8d8e0') : hexToRgba(ac, 0.2),
                        color: bypassed ? dimColor : ac,
                        fontSize: enlarged ? '9px' : '8px', fontWeight: '800',
                        border: `1px solid ${bypassed ? borderColor : hexToRgba(ac, 0.4)}`,
                    }}
                >
                    {bypassed ? t('common.off') : t('common.on')}
                </div>

                {/* Remove button */}
                <div
                    onClick={(e) => { e.stopPropagation(); if (onRemove) onRemove(); }}
                    title={t('effects.rack.removeEffect')}
                    style={{
                        width: 16, height: 16, borderRadius: '3px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', userSelect: 'none',
                        color: isDark ? '#666' : '#aaa',
                        fontSize: '11px', fontWeight: '700',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#666' : '#aaa'}
                >
                    ×
                </div>
            </div>

            {/* Interactive Canvas Visualizer */}
            {showCanvas && effect && (
                <div style={{
                    flex: enlarged ? 1 : 'none',
                    flexShrink: enlarged ? 1 : 0,
                    minHeight: enlarged ? 80 : undefined,
                    borderBottom: `1px solid ${borderColor}`,
                    background: isDark ? '#13131b' : '#e4e4ec',
                    boxShadow: isDark
                        ? 'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(0,0,0,0.15)'
                        : 'inset 0 1px 3px rgba(0,0,0,0.08), inset 0 -1px 2px rgba(255,255,255,0.5)',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                }}>
                    <InteractiveCanvas
                        effect={effect}
                        onUpdate={handleCanvasUpdate}
                        theme={canvasTheme}
                        accentColors={accentColors}
                        canvasStyle={enlarged ? {
                            maxHeight: '100%', maxWidth: '100%',
                            width: 'auto', height: '100%',
                            objectFit: 'contain',
                        } : undefined}
                    />
                </div>
            )}

            {/* Parameters area */}
            <div style={{
                flex: enlarged ? 'none' : 1,
                flexShrink: enlarged ? 0 : undefined,
                padding: enlarged ? '6px 12px' : '6px',
                display: 'flex', flexWrap: 'wrap', gap: enlarged ? '10px' : '6px',
                alignItems: enlarged ? 'center' : 'flex-start',
                alignContent: 'center',
                justifyContent: 'center',
                overflowY: 'auto',
                overflowX: 'hidden',
            }}>
                {paramDefs.length === 0 && (
                    <span style={{ fontSize: enlarged ? '12px' : '9px', color: dimColor, fontStyle: 'italic' }}>{t('detailPanel.noParams')}</span>
                )}
                {paramDefs.map(renderParam)}
            </div>
        </div>
    );
}
