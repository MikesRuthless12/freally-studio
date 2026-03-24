/**
 * DetailPanel.jsx — Ableton-style bottom detail panel.
 *
 * Shows the selected track's effects chain horizontally with:
 * - Track info strip (left)
 * - Horizontal scrolling effects chain (center)
 * - Drop zone / add-effect button (right)
 * - Clear all, group/ungroup, drag-reorder, bypass, remove per effect
 * - Shift/Ctrl+click on effect headers to select multiple, then group/ungroup
 * - Accepts drag-and-drop from Browser's Audio Effects tree
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import DetailPanelEffectCard from './DetailPanelEffectCard';
import { AudioEffect } from './effects/AudioEffect.js';
import { EFFECT_CATEGORIES } from './effects/effectRegistry.js';
import { EFFECT_DISPLAY_NAMES, CATEGORY_ICONS } from './effects/effectParamDefs.js';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

// i18n lookup maps for effect names and categories
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

const CATEGORY_NAME_I18N = {
    'Dynamics': 'effects.cat.dynamics',
    'EQ & Filter': 'effects.cat.eqFilter',
    'Distortion': 'effects.cat.distortion',
    'Time & Space': 'effects.cat.timeSpace',
    'Modulation': 'effects.cat.modulation',
    'Lo-Fi & Character': 'effects.cat.lofiCharacter',
    'Stereo & Utility': 'effects.cat.stereoUtility',
    'Analysis': 'effects.cat.analysis',
    'Vocal': 'effects.cat.vocal',
    'Mastering': 'effects.cat.mastering',
};

export default function DetailPanel({
    trackId,
    trackLabel,
    trackColor,
    trackType,
    effectsManager,
    onEffectsChanged,
    effectsVersion,
    isDark,
    accentColors,
    panelHeight = 200,
    isMaximized = false,
    onToggleMaximize,
    vst3Plugins,
    vst3TrackPlugins,
    onLoadVST3OnTrack,
    onRemoveVST3FromTrack,
    onOpenVST3Editor,
}) {
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [dragIdx, setDragIdx] = useState(null);
    const [dropHighlight, setDropHighlight] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const [selectedEffectIds, setSelectedEffectIds] = useState(new Set()); // multi-select for grouping
    const [manualGroups, setManualGroups] = useState([]); // [{id, label, effectIds:[]}]
    const [enlargedEffectId, setEnlargedEffectId] = useState(null); // Individual effect focus mode
    const [renderKey, forceUpdate] = useState(0);
    const chainRef = useRef(null);
    const groupIdCounter = useRef(1);
    const { t } = useTranslation();

    const ac = accentColors?.accent || '#ff6b6b';
    const bg = isDark ? '#141420' : '#e8e8f0';
    const textColor = isDark ? '#d0d0d0' : '#333';
    const dimColor = isDark ? '#666' : '#999';
    const borderColor = isDark ? '#2a2a36' : '#d0d0d8';

    // Get the chain for the selected track (re-read on every render triggered by forceUpdate)
    const chain = (effectsManager && trackId)
        ? (effectsManager.getTrackChain(trackId) || null)
        : null;

    const effects = chain?.effects || [];

    // Build display items: either individual effects or manual groups
    const displayItems = useMemo(() => {
        if (effects.length === 0) return [];
        const items = [];
        const grouped = new Set(); // effect IDs already in a manual group

        // Collect grouped IDs
        manualGroups.forEach(g => g.effectIds.forEach(id => grouped.add(id)));

        let i = 0;
        for (const fx of effects) {
            // Check if this effect is the first in a manual group
            const group = manualGroups.find(g => g.effectIds[0] === fx.id);
            if (group) {
                // Collect all effects in this group (in chain order)
                const groupEffects = group.effectIds
                    .map(id => effects.find(e => e.id === id))
                    .filter(Boolean);
                items.push({ type: 'group', group, effects: groupEffects, startIndex: i });
                i += groupEffects.length;
                continue;
            }
            if (grouped.has(fx.id)) {
                i++;
                continue; // already rendered as part of a group
            }
            items.push({ type: 'single', effect: fx, index: i });
            i++;
        }
        return items;
    }, [effects, manualGroups, renderKey, effectsVersion]);

    const isGroupCollapsed = useCallback((groupKey) => collapsedGroups.has(groupKey), [collapsedGroups]);

    const toggleGroup = useCallback((groupKey) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    }, []);

    // ── Effect Selection (Shift/Ctrl+click) ──
    const handleEffectSelect = useCallback((effectId, e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            // Toggle selection
            setSelectedEffectIds(prev => {
                const next = new Set(prev);
                if (next.has(effectId)) next.delete(effectId);
                else next.add(effectId);
                return next;
            });
        } else {
            // Clear selection (normal click on header just selects one)
            setSelectedEffectIds(new Set([effectId]));
        }
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedEffectIds(new Set());
    }, []);

    // ── Group Selected Effects ──
    const handleGroupSelected = useCallback(() => {
        if (selectedEffectIds.size < 2) return;
        // Get selected IDs in chain order
        const orderedIds = effects
            .filter(fx => selectedEffectIds.has(fx.id))
            .map(fx => fx.id);
        if (orderedIds.length < 2) return;

        // Remove these IDs from any existing manual groups
        setManualGroups(prev => {
            const cleaned = prev.map(g => ({
                ...g,
                effectIds: g.effectIds.filter(id => !selectedEffectIds.has(id))
            })).filter(g => g.effectIds.length > 0);

            // Add the new group
            const newGroup = {
                id: `group_${groupIdCounter.current++}`,
                label: `Group ${groupIdCounter.current - 1}`,
                effectIds: orderedIds,
            };
            return [...cleaned, newGroup];
        });
        setSelectedEffectIds(new Set());
        forceUpdate(n => n + 1);
    }, [selectedEffectIds, effects]);

    // ── Ungroup: remove a manual group ──
    const handleUngroup = useCallback((groupId) => {
        setManualGroups(prev => prev.filter(g => g.id !== groupId));
        forceUpdate(n => n + 1);
    }, []);

    // ── Ungroup All ──
    const handleUngroupAll = useCallback(() => {
        setManualGroups([]);
        forceUpdate(n => n + 1);
    }, []);

    // ── Remove selected effect from its group ──
    const handleRemoveFromGroup = useCallback((effectId) => {
        setManualGroups(prev =>
            prev.map(g => ({
                ...g,
                effectIds: g.effectIds.filter(id => id !== effectId)
            })).filter(g => g.effectIds.length > 0)
        );
        forceUpdate(n => n + 1);
    }, []);

    // ── Add Effect (max 5 of same type per track) ──
    const MAX_SAME_EFFECT = 5;
    const handleAddEffect = useCallback((effectType) => {
        if (!effectsManager || !trackId) return;
        const c = effectsManager.getOrCreateTrackChain(trackId);
        const sameCount = c.effects.filter(e => e.name === effectType).length;
        if (sameCount >= MAX_SAME_EFFECT) return;
        const fx = AudioEffect.create(effectType);
        if (!fx) return;
        c.addEffect(fx);
        if (onEffectsChanged) onEffectsChanged();
        forceUpdate(n => n + 1);
        setShowAddMenu(false);
    }, [effectsManager, trackId, onEffectsChanged]);

    // ── Remove Effect ──
    const handleRemoveEffect = useCallback((effectId) => {
        if (!chain) return;
        chain.removeEffect(effectId);
        // Also remove from any manual group
        setManualGroups(prev =>
            prev.map(g => ({ ...g, effectIds: g.effectIds.filter(id => id !== effectId) }))
                .filter(g => g.effectIds.length > 0)
        );
        setSelectedEffectIds(prev => { const n = new Set(prev); n.delete(effectId); return n; });
        if (onEffectsChanged) onEffectsChanged();
        forceUpdate(n => n + 1);
    }, [chain, onEffectsChanged]);

    // ── Clear All Effects ──
    const handleClearAll = useCallback(() => {
        if (!chain || effects.length === 0) return;
        const ids = effects.map(fx => fx.id);
        ids.forEach(id => chain.removeEffect(id));
        setManualGroups([]);
        setSelectedEffectIds(new Set());
        if (onEffectsChanged) onEffectsChanged();
        forceUpdate(n => n + 1);
    }, [chain, effects, onEffectsChanged]);

    // ── Drag-and-Drop Reorder ──
    const handleDragStart = useCallback((idx) => { setDragIdx(idx); }, []);
    const handleDragOver = useCallback((e, targetIdx) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === targetIdx || !chain) return;
        chain.reorderEffect(dragIdx, targetIdx);
        setDragIdx(targetIdx);
        if (onEffectsChanged) onEffectsChanged();
        forceUpdate(n => n + 1);
    }, [dragIdx, chain, onEffectsChanged]);
    const handleDragEnd = useCallback(() => { setDragIdx(null); }, []);

    // ── Drop from Browser ──
    const handleDropFromBrowser = useCallback((e) => {
        e.preventDefault();
        setDropHighlight(false);
        const effectType = e.dataTransfer.getData('application/x-wavloom-effect');
        if (effectType && trackId) handleAddEffect(effectType);
    }, [trackId, handleAddEffect]);

    const handleDragOverFromBrowser = useCallback((e) => {
        if (e.dataTransfer.types.includes('application/x-wavloom-effect')) {
            e.preventDefault(); setDropHighlight(true);
        }
    }, []);

    const handleDragLeaveFromBrowser = useCallback(() => { setDropHighlight(false); }, []);

    // ── Remove VST3 from track ──
    const handleRemoveVST3 = useCallback((tid) => {
        if (onRemoveVST3FromTrack) onRemoveVST3FromTrack(tid);
        forceUpdate(n => n + 1);
    }, [onRemoveVST3FromTrack]);

    // ── No track selected ──
    if (!trackId) {
        return (
            <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: bg,
            }}>
                <span style={{ fontSize: '12px', color: dimColor, fontWeight: '600', letterSpacing: '0.5px' }}>
                    {t('detailPanel.selectTrack')}
                </span>
            </div>
        );
    }

    const trackVST3 = vst3TrackPlugins?.[trackId] || null;
    const hasSelection = selectedEffectIds.size > 0;
    const canGroup = selectedEffectIds.size >= 2;

    // Clear enlargement when effect is removed or track changes
    const enlargedEffect = enlargedEffectId ? effects.find(fx => fx.id === enlargedEffectId) : null;
    if (enlargedEffectId && !enlargedEffect) {
        // Effect was removed while enlarged — reset
        // (useEffect would be better but this is a render-time cleanup)
        setTimeout(() => setEnlargedEffectId(null), 0);
    }

    // Helper to render a single effect card with selection highlight
    const renderCard = (fx, index, isEnlarged = false) => {
        const isSelected = selectedEffectIds.has(fx.id);
        return (
            <DetailPanelEffectCard
                key={fx.id}
                effect={fx}
                onRemove={() => handleRemoveEffect(fx.id)}
                onUpdate={() => { if (onEffectsChanged) onEffectsChanged(); forceUpdate(n => n + 1); }}
                isDark={isDark}
                accentColors={accentColors}
                draggable={!isEnlarged}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                isSelected={isSelected}
                onHeaderClick={(e) => handleEffectSelect(fx.id, e)}
                panelHeight={panelHeight}
                enlarged={isEnlarged}
                onEnlarge={() => setEnlargedEffectId(fx.id)}
                onRestore={() => setEnlargedEffectId(null)}
                isMaximized={isMaximized}
                onToggleMaximize={onToggleMaximize}
            />
        );
    };

    return (
        <div
            style={{
                width: '100%', height: '100%',
                display: 'flex',
                background: bg,
                overflow: 'hidden',
            }}
            onDragOver={handleDragOverFromBrowser}
            onDragLeave={handleDragLeaveFromBrowser}
            onDrop={handleDropFromBrowser}
            onClick={(e) => {
                // Click on background clears selection
                if (e.target === e.currentTarget) clearSelection();
            }}
        >
            {/* ── Track Info Strip (left) ── */}
            <div style={{
                width: 60, minWidth: 60, flexShrink: 0,
                borderRight: `1px solid ${borderColor}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '5px', padding: '6px 4px',
                background: isDark ? '#12121a' : '#e2e2ea',
            }}>
                <div style={{ width: 6, height: 30, borderRadius: '3px', background: trackColor || ac }} />
                <span style={{
                    fontSize: '9px', fontWeight: '800', color: trackColor || ac,
                    textTransform: 'uppercase', writingMode: 'vertical-rl', textOrientation: 'mixed',
                    letterSpacing: '1px', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    {trackLabel || trackId}
                </span>
                <span style={{ fontSize: '7px', fontWeight: '700', color: dimColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {trackType === 'drum' || trackType === 'drums-all' ? t('detailPanel.trackDrum') :
                     trackType === 'melodic' ? t('detailPanel.trackMelodic') : trackType === 'audio' ? t('detailPanel.trackAudio') :
                     trackType === 'midi' ? t('detailPanel.trackMidi') : '—'}
                </span>

                {/* Action buttons */}
                {effects.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                        <div onClick={handleClearAll} title={t('detailPanel.clearAll')} style={{
                            width: 30, height: 14, borderRadius: '3px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', userSelect: 'none',
                            background: isDark ? '#2a2a36' : '#d8d8e0', color: '#ff4444',
                            fontSize: '7px', fontWeight: '800',
                            border: `1px solid ${isDark ? '#3a3a46' : '#c0c0c8'}`,
                        }}>{t('detailPanel.clr')}</div>
                        {manualGroups.length > 0 && (
                            <div onClick={handleUngroupAll} title={t('detailPanel.ungroupAll')} style={{
                                width: 30, height: 14, borderRadius: '3px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', userSelect: 'none',
                                background: isDark ? '#2a2a36' : '#d8d8e0', color: '#ff9f43',
                                fontSize: '6px', fontWeight: '800',
                                border: `1px solid ${isDark ? '#3a3a46' : '#c0c0c8'}`,
                            }}>{t('detailPanel.ungroup')}</div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Effects Chain (center, horizontal scroll) ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Selection toolbar — appears when effects are selected */}
                {hasSelection && (
                    <div style={{
                        height: 24, flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '0 8px',
                        background: isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.08),
                        borderBottom: `1px solid ${hexToRgba(ac, 0.2)}`,
                    }}>
                        <span style={{ fontSize: '9px', color: ac, fontWeight: '700' }}>
                            {selectedEffectIds.size} selected
                        </span>
                        {canGroup && (
                            <div onClick={handleGroupSelected} title={t('detailPanel.groupSelected')} style={{
                                padding: '2px 8px', borderRadius: '3px', cursor: 'pointer',
                                background: hexToRgba(ac, 0.2), color: ac,
                                fontSize: '8px', fontWeight: '800', letterSpacing: '0.5px',
                                border: `1px solid ${hexToRgba(ac, 0.3)}`,
                            }}>
                                GROUP
                            </div>
                        )}
                        <div onClick={clearSelection} title={t('detailPanel.clearSelection')} style={{
                            padding: '2px 6px', borderRadius: '3px', cursor: 'pointer',
                            background: isDark ? '#2a2a36' : '#d8d8e0', color: dimColor,
                            fontSize: '8px', fontWeight: '700',
                            border: `1px solid ${borderColor}`,
                        }}>
                            ESC
                        </div>
                    </div>
                )}

                {/* Scrollable effects row (or enlarged single effect) */}
                {enlargedEffect ? (
                    <div style={{
                        flex: 1, display: 'flex', padding: '6px',
                        alignItems: 'stretch',
                    }}>
                        {renderCard(enlargedEffect, effects.indexOf(enlargedEffect), true)}
                    </div>
                ) : (
                <div
                    ref={chainRef}
                    style={{
                        flex: 1, display: 'flex',
                        overflowX: 'auto', overflowY: 'hidden',
                        gap: '6px', padding: '6px',
                        alignItems: 'stretch',
                        background: dropHighlight ? hexToRgba(ac, 0.08) : 'transparent',
                        transition: 'background 0.15s',
                    }}
                >
                    {/* VST3 plugin card */}
                    {trackVST3 && (
                        <div style={{
                            width: 200, minWidth: 200, flexShrink: 0,
                            display: 'flex', flexDirection: 'column',
                            background: isDark ? '#1e1e28' : '#f0f0f5',
                            border: `1px solid ${isDark ? '#3a2a46' : '#c0b0d8'}`,
                            borderRadius: '6px', overflow: 'hidden',
                        }}>
                            <div style={{
                                height: 26, flexShrink: 0,
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '0 6px',
                                background: isDark ? '#22162e' : '#e4d8f0',
                                borderBottom: `1px solid ${isDark ? '#3a2a46' : '#c0b0d8'}`,
                            }}>
                                <span style={{ fontSize: '9px', color: '#a855f7', fontWeight: '700' }}>VST3</span>
                                <span style={{
                                    flex: 1, fontSize: '9px', fontWeight: '800', color: textColor,
                                    letterSpacing: '0.5px', textTransform: 'uppercase',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>{trackVST3.name || 'Plugin'}</span>
                                {onOpenVST3Editor && (
                                    <div onClick={() => onOpenVST3Editor(trackId)} title={t('detailPanel.openVst3Editor')} style={{
                                        width: 24, height: 16, borderRadius: '3px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', fontSize: '7px', fontWeight: '800',
                                        background: hexToRgba('#a855f7', 0.2), color: '#a855f7',
                                        border: `1px solid ${hexToRgba('#a855f7', 0.4)}`,
                                    }}>GUI</div>
                                )}
                                <div onClick={() => handleRemoveVST3(trackId)} title={t('detailPanel.removeVst3')} style={{
                                    width: 16, height: 16, borderRadius: '3px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: isDark ? '#666' : '#aaa', fontSize: '11px', fontWeight: '700',
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff4444'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#666' : '#aaa'}
                                >×</div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                                <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: '600' }}>{trackVST3.name || 'VST3 Plugin'}</span>
                            </div>
                        </div>
                    )}

                    {/* Effect items — singles and groups */}
                    {displayItems.map((item) => {
                        if (item.type === 'single') {
                            return renderCard(item.effect, item.index);
                        }

                        // Manual group
                        const g = item.group;
                        const collapsed = isGroupCollapsed(g.id);
                        return (
                            <div key={g.id} style={{
                                display: 'flex', flexDirection: 'column',
                                border: `1px solid ${isDark ? hexToRgba(ac, 0.25) : hexToRgba(ac, 0.3)}`,
                                borderRadius: '6px', overflow: 'hidden',
                                background: isDark ? hexToRgba(ac, 0.04) : hexToRgba(ac, 0.06),
                                flexShrink: 0,
                            }}>
                                {/* Group header */}
                                <div style={{
                                    height: 22, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '0 8px', cursor: 'pointer', userSelect: 'none',
                                    background: isDark ? hexToRgba(ac, 0.08) : hexToRgba(ac, 0.1),
                                    borderBottom: collapsed ? 'none' : `1px solid ${isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.2)}`,
                                }}>
                                    <span onClick={() => toggleGroup(g.id)} style={{
                                        fontSize: '8px', color: ac,
                                        transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                                        transition: 'transform 0.15s', display: 'inline-block', cursor: 'pointer',
                                    }}>▶</span>
                                    <span onClick={() => toggleGroup(g.id)} style={{
                                        flex: 1, fontSize: '9px', fontWeight: '700', color: ac,
                                        textTransform: 'uppercase', letterSpacing: '0.5px',
                                    }}>
                                        {g.label} ({item.effects.length})
                                    </span>
                                    <div onClick={() => handleUngroup(g.id)} title={t('detailPanel.ungroupAll')} style={{
                                        padding: '1px 5px', borderRadius: '3px', cursor: 'pointer',
                                        background: hexToRgba(ac, 0.15), color: ac,
                                        fontSize: '7px', fontWeight: '800',
                                        border: `1px solid ${hexToRgba(ac, 0.25)}`,
                                    }}>UNGRP</div>
                                </div>
                                {!collapsed && (
                                    <div style={{
                                        display: 'flex', gap: '4px', padding: '4px',
                                        overflowX: 'auto', alignItems: 'stretch',
                                    }}>
                                        {item.effects.map((fx) => {
                                            const idx = effects.indexOf(fx);
                                            return renderCard(fx, idx >= 0 ? idx : item.startIndex);
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Empty chain message */}
                    {effects.length === 0 && !trackVST3 && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 200 }}>
                            <span style={{ fontSize: '11px', color: dimColor, fontWeight: '600' }}>
                                No effects — drag from browser or click + to add
                            </span>
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* ── Drop Zone / Add Button (right) ── */}
            <div style={{
                width: 120, minWidth: 120, flexShrink: 0,
                borderLeft: `1px solid ${borderColor}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '8px', padding: '8px',
                position: 'relative',
            }}>
                <div
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    style={{
                        width: 36, height: 36, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', userSelect: 'none',
                        background: isDark ? '#2a2a36' : '#d8d8e0',
                        border: `2px dashed ${isDark ? '#444' : '#bbb'}`,
                        color: isDark ? '#555' : '#aaa',
                        fontSize: '20px', fontWeight: '400',
                        transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = ac; e.currentTarget.style.color = ac; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDark ? '#444' : '#bbb'; e.currentTarget.style.color = isDark ? '#555' : '#aaa'; }}
                >+</div>
                <span style={{ fontSize: '8px', color: dimColor, textAlign: 'center', fontWeight: '600', letterSpacing: '0.3px', lineHeight: '11px' }}>
                    Drop Audio{'\n'}Effects Here
                </span>

                {/* Add Effect Dropdown */}
                {showAddMenu && (
                    <div onClick={(e) => e.stopPropagation()} style={{
                        position: 'absolute', right: 0, bottom: '100%',
                        width: 260, maxHeight: 320,
                        background: isDark ? '#1e1e2e' : '#f8f8fc',
                        border: `1px solid ${hexToRgba(ac, 0.4)}`,
                        borderRadius: '8px',
                        boxShadow: `0 4px 20px rgba(0,0,0,${isDark ? 0.6 : 0.2})`,
                        overflow: 'auto', padding: '6px', zIndex: 50,
                    }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '2px 4px 6px', borderBottom: `1px solid ${borderColor}`, marginBottom: '4px',
                        }}>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: textColor, letterSpacing: '0.5px' }}>ADD EFFECT</span>
                            <span onClick={() => setShowAddMenu(false)} style={{ fontSize: '14px', color: dimColor, cursor: 'pointer', lineHeight: '14px' }}>×</span>
                        </div>
                        {EFFECT_CATEGORIES.map(cat => (
                            <div key={cat.name} style={{ marginBottom: '4px' }}>
                                <div style={{ fontSize: '8px', fontWeight: '800', color: dimColor, textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 4px' }}>
                                    {CATEGORY_ICONS[cat.name] || ''} {cat.name}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', padding: '0 4px' }}>
                                    {cat.effects.map(fx => (
                                        <div key={fx.type} onClick={() => handleAddEffect(fx.type)} style={{
                                            padding: '3px 8px', borderRadius: '4px',
                                            fontSize: '9px', fontWeight: '600', color: textColor, cursor: 'pointer',
                                            background: isDark ? '#2a2a3a' : '#e4e4ec',
                                            border: `1px solid ${isDark ? '#3a3a4a' : '#d0d0d8'}`,
                                            transition: 'background 0.1s, border-color 0.1s',
                                        }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(ac, 0.15); e.currentTarget.style.borderColor = hexToRgba(ac, 0.4); }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? '#2a2a3a' : '#e4e4ec'; e.currentTarget.style.borderColor = isDark ? '#3a3a4a' : '#d0d0d8'; }}
                                        >{fx.label}</div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
