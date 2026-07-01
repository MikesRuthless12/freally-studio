import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Knob from './Knob';
import InteractiveCanvas from './InteractiveCanvas';
import { AudioEffect } from './effects/AudioEffect.js';
import { EFFECT_CATEGORIES } from './effects/effectRegistry.js';
import { EFFECT_PARAM_DEFS, EFFECT_DISPLAY_NAMES, CATEGORY_ICONS } from './effects/effectParamDefs.js';
import { LOOMSAUCE_FACTORY_PRESETS } from './effects/LoomSauce.js';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

// ── i18n lookup maps for effect names and categories ──
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

const LOOM_SAUCE_SECTION_I18N = {
    'COMPRESS': 'effects.rack.loomSauce.compress',
    'ENHANCE': 'effects.rack.loomSauce.enhance',
    'EQ': 'effects.rack.loomSauce.eq',
    'MULTIPLY': 'effects.rack.loomSauce.multiply',
    'SPACE': 'effects.rack.loomSauce.space',
    'GAIN': 'effects.rack.loomSauce.gain',
};

/**
 * EffectsRack — Per-track + Master effects chain editor.
 *
 * Opens as a modal overlay matching the DrumSampleEditor theme:
 *   - Dark panels, orange accent color for labels/knobs
 *   - Round SVG knobs with arc indicators
 *   - Uppercase labels, 10px font, #aaa secondary text
 *
 * Features:
 *   - Browse & add effects by category
 *   - Reorder via drag-and-drop
 *   - Per-effect knob/toggle/select controls
 *   - Bypass per effect
 *   - Remove effect
 *   - Collapse/expand individual effects
 */

// Theme-aware color helpers
function getThemeColors(isDark, accentColors) {
    const ac = accentColors?.accent || (isDark ? '#ff6b6b' : '#e74c3c');
    const acSec = accentColors?.secondary || (isDark ? '#ff9f43' : '#d35400');
    return isDark ? {
        isDark: true,
        accentColor: ac,
        accentSecondary: acSec,
        bgColor: '#1a1a1a',
        panelColor: '#252525',
        headerBg: '#1e1e1e',
        textColor: '#e0e0e0',
        dimColor: '#aaa',
        gridColor: '#333',
        inputBg: '#1a1a1a',
        hoverBg: hexToRgba(ac, 0.1),
        hoverBgStrong: hexToRgba(ac, 0.2),
        mutedText: '#555',
        faintText: '#444',
        faintBorder: '#333',
        overlayBg: 'rgba(0,0,0,0.6)',
    } : {
        isDark: false,
        accentColor: ac,
        accentSecondary: acSec,
        bgColor: '#f5f5f8',
        panelColor: '#ffffff',
        headerBg: '#eaeaee',
        textColor: '#222',
        dimColor: '#666',
        gridColor: '#d5d5d9',
        inputBg: '#f0f0f4',
        hoverBg: hexToRgba(ac, 0.08),
        hoverBgStrong: hexToRgba(ac, 0.15),
        mutedText: '#888',
        faintText: '#aaa',
        faintBorder: '#d0d0d8',
        overlayBg: 'rgba(0,0,0,0.3)',
    };
}

// Legacy constants for sub-components that don't receive isDark
const accentColor = '#ff6b6b';
const bgColor = '#1a1a1a';
const panelColor = '#252525';
const textColor = '#e0e0e0';
const dimColor = '#aaa';
const gridColor = '#333';

const BASE_TRACKS = [
    { id: 'drums', label: 'DRUMS', color: '#ff6b6b' },
    { id: 'chords', label: 'CHORDS', color: '#6bafff' },
    { id: 'melody', label: 'MELODY', color: '#6bffb8' },
    { id: 'bass', label: 'BASS', color: '#ffb86b' },
    { id: 'master', label: 'MASTER', color: '#ff6b6b' },
];

const DRUM_LANES = [
    { id: 'drum_kick',      label: 'KICK',    color: '#ff6b6b', isDrumLane: true },
    { id: 'drum_clap',      label: 'CLAP',    color: '#ff9f43', isDrumLane: true },
    { id: 'drum_snare',     label: 'SNARE',   color: '#ffd93d', isDrumLane: true },
    { id: 'drum_offSnare',  label: 'OFF SNR', color: '#6bff6b', isDrumLane: true },
    { id: 'drum_closedHat', label: 'CL HAT',  color: '#6bffdf', isDrumLane: true },
    { id: 'drum_openHat',   label: 'OP HAT',  color: '#6bafff', isDrumLane: true },
    { id: 'drum_rim',       label: 'RIM',     color: '#b86bff', isDrumLane: true },
    { id: 'drum_perc',      label: 'PERC',    color: '#ff6bdf', isDrumLane: true },
];

// ── i18n lookup maps for track / drum-lane labels ──
const TRACK_LABEL_I18N = {
    'DRUMS':  'app.drums',
    'CHORDS': 'app.chords',
    'MELODY': 'app.melody',
    'BASS':   'app.bass',
    'MASTER': 'app.master',
};

const DRUM_LANE_I18N = {
    'KICK':    'drumLane.kick',
    'CLAP':    'drumLane.clap',
    'SNARE':   'drumLane.snare',
    'OFF SNR': 'drumLane.offSnare',
    'CL HAT':  'drumLane.closedHat',
    'OP HAT':  'drumLane.openHat',
    'RIM':     'drumLane.rim',
    'PERC':    'drumLane.perc',
};

// ─────────────────────── Toggle Button ───────────────────────
const ToggleButton = ({ label, value, onChange, theme, t: tProp }) => {
    const ac = theme?.accentColor || '#ff6b6b';
    const dc = theme?.dimColor || dimColor;
    const isDark = theme?.isDark ?? true;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
                onClick={() => onChange(!value)}
                style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: value ? ac : 'transparent',
                    border: `2px solid ${ac}`,
                    color: value ? (isDark ? '#fff' : '#fff') : ac,
                    fontWeight: 'bold', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', transition: 'all 0.15s',
                    boxShadow: value ? `0 0 8px ${ac}44` : 'none'
                }}
            >
                {value ? (tProp ? tProp('common.on') : 'ON') : (tProp ? tProp('common.off') : 'OFF')}
            </div>
            <span style={{ fontSize: '10px', color: dc, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        </div>
    );
};

// ─────────────────────── Select Dropdown ─────────────────────
const SelectControl = ({ label, value, options, onChange, theme }) => {
    const ac = theme?.accentColor || accentColor;
    const dc = theme?.dimColor || dimColor;
    const iBg = theme?.inputBg || (theme?.isDark === false ? '#f0f0f4' : '#1a1a1a');
    const acEncoded = encodeURIComponent(ac);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    background: iBg, color: ac, border: `1px solid ${ac}44`,
                    borderRadius: '4px', padding: '4px 8px', fontSize: '10px',
                    fontWeight: '600', cursor: 'pointer', outline: 'none',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    minWidth: '70px', textAlign: 'center',
                    appearance: 'none', WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='${acEncoded}' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 6px center',
                    paddingRight: '20px'
                }}
            >
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            <span style={{ fontSize: '10px', color: dc, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        </div>
    );
};

// ─────────────────────── EQ Band Editor ──────────────────────
const EQBandEditor = ({ bands, onChange, theme, t: tProp }) => {
    const ac = theme?.accentColor || accentColor;
    const iBg = theme?.inputBg || (theme?.isDark === false ? '#f0f0f4' : '#1a1a1a');
    const fb = theme?.faintBorder || (theme?.isDark === false ? '#d0d0d8' : '#333');
    const mt = theme?.mutedText || (theme?.isDark === false ? '#888' : '#555');
    const bandLabels = ['HP', 'LS', 'P1', 'P2', 'P3', 'P4', 'HS', 'LP'];
    const [selectedBand, setSelectedBand] = useState(2);

    const updateBand = useCallback((idx, key, value) => {
        const newBands = bands.map((b, i) => i === idx ? { ...b, [key]: value } : b);
        onChange(newBands);
    }, [bands, onChange]);

    const band = bands[selectedBand];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {/* Band selector tabs */}
            <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                {bandLabels.map((lbl, i) => (
                    <button
                        key={i}
                        onClick={() => setSelectedBand(i)}
                        style={{
                            padding: '3px 8px', fontSize: '9px', fontWeight: '700',
                            background: selectedBand === i ? ac : iBg,
                            color: selectedBand === i ? '#fff' : (bands[i].enabled ? ac : mt),
                            border: `1px solid ${selectedBand === i ? ac : fb}`,
                            borderRadius: '3px', cursor: 'pointer',
                            letterSpacing: '0.5px', opacity: bands[i].enabled ? 1 : 0.5
                        }}
                    >
                        {lbl}
                    </button>
                ))}
            </div>
            {/* Selected band controls */}
            {band && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <ToggleButton label={tProp ? tProp('effects.param.enabled') : 'ENABLED'} value={band.enabled} onChange={(v) => updateBand(selectedBand, 'enabled', v)} theme={theme} t={tProp} />
                    <Knob label={tProp ? tProp('effects.param.freq') : 'FREQ'} value={band.frequency} min={20} max={20000} onChange={(v) => updateBand(selectedBand, 'frequency', v)} color={ac} size={44} isDark={theme?.isDark} />
                    <Knob label={tProp ? tProp('effects.param.gain') : 'GAIN'} value={band.gain} min={-18} max={18} onChange={(v) => updateBand(selectedBand, 'gain', v)} color={ac} size={44} isDark={theme?.isDark} />
                    <Knob label={tProp ? tProp('effects.param.q') : 'Q'} value={band.Q} min={0.1} max={18} onChange={(v) => updateBand(selectedBand, 'Q', v)} color={ac} size={44} isDark={theme?.isDark} />
                </div>
            )}
        </div>
    );
};

// ─────────────────── Loom Sauce Section Header ────────────────
const LoomSauceSectionHeader = ({ label, bypassed, onToggleBypass, theme, t: tProp }) => {
    const ac = theme?.accentColor || accentColor;
    const isDark = theme?.isDark ?? true;
    const mt = theme?.mutedText || (isDark ? '#555' : '#888');
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 6px', borderBottom: `1px solid ${theme?.gridColor || (isDark ? '#333' : '#d5d5d9')}`,
            background: bypassed ? 'transparent' : `${ac}08`
        }}>
            <span style={{
                fontSize: '9px', fontWeight: '800', letterSpacing: '1.5px',
                color: bypassed ? mt : ac, textTransform: 'uppercase'
            }}>{label}</span>
            <button
                onClick={onToggleBypass}
                title={bypassed ? (tProp ? tProp('effects.rack.enableSection') : 'Enable section') : (tProp ? tProp('effects.rack.bypassSection') : 'Bypass section')}
                style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: bypassed ? 'transparent' : `${ac}22`,
                    border: `1.5px solid ${bypassed ? mt : ac}`,
                    color: bypassed ? mt : ac, fontSize: '8px', fontWeight: '900',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: 0
                }}
            >⏻</button>
        </div>
    );
};

// ─────────────────── Loom Sauce Custom UI ─────────────────────
const LOOMSAUCE_USER_PRESETS_KEY = 'freally_loomsauce_presets';

function loadUserPresets() {
    try {
        const raw = localStorage.getItem(LOOMSAUCE_USER_PRESETS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}
function saveUserPresets(list) {
    try { localStorage.setItem(LOOMSAUCE_USER_PRESETS_KEY, JSON.stringify(list)); } catch {}
}

const LoomSauceUI = ({ effect, onUpdate, theme, t: tProp }) => {
    const isDark = theme?.isDark ?? true;
    const ac = theme?.accentColor || accentColor;
    const pc = theme?.panelColor || (isDark ? panelColor : '#ffffff');
    const mt = theme?.mutedText || (isDark ? '#555' : '#888');
    const fb = theme?.faintBorder || (isDark ? '#333' : '#d0d0d8');
    const iBg = theme?.inputBg || (isDark ? '#1a1a1a' : '#f0f0f4');
    const tc = theme?.textColor || (isDark ? textColor : '#222');
    const acEncoded = encodeURIComponent(ac);

    const [userPresets, setUserPresets] = useState(() => loadUserPresets());
    const [selectedPreset, setSelectedPreset] = useState('');

    const params = effect.getParams();
    const set = useCallback((key, value) => {
        effect.setParam(key, value);
        onUpdate();
    }, [effect, onUpdate]);

    const allPresets = useMemo(() => [
        ...LOOMSAUCE_FACTORY_PRESETS.map(p => ({ ...p, isFactory: true })),
        ...userPresets.map(p => ({ ...p, isFactory: false }))
    ], [userPresets]);

    const applyPreset = useCallback((presetName) => {
        const preset = allPresets.find(p => p.name === presetName);
        if (!preset) return;
        Object.entries(preset.params).forEach(([k, v]) => effect.setParam(k, v));
        setSelectedPreset(presetName);
        onUpdate();
    }, [allPresets, effect, onUpdate]);

    const handleSavePreset = useCallback(() => {
        const name = prompt(tProp ? tProp('effects.rack.presetName') : 'Preset name:');
        if (!name || !name.trim()) return;
        const updated = [...userPresets.filter(p => p.name !== name.trim()), { name: name.trim(), params: { ...params } }];
        setUserPresets(updated);
        saveUserPresets(updated);
        setSelectedPreset(name.trim());
    }, [params, userPresets, tProp]);

    const handleDeletePreset = useCallback(() => {
        const preset = userPresets.find(p => p.name === selectedPreset);
        if (!preset) return;
        const updated = userPresets.filter(p => p.name !== selectedPreset);
        setUserPresets(updated);
        saveUserPresets(updated);
        setSelectedPreset('');
    }, [selectedPreset, userPresets]);

    // Section data definitions
    const sections = [
        {
            key: 'comp', label: tProp ? tProp('effects.rack.loomSauce.compress') : 'COMPRESS', bypassKey: 'compBypass',
            knobs: [
                { key: 'compThreshold', label: tProp ? tProp('effects.param.thresh') : 'THRESH', min: -40, max: 0, step: 0.5 },
                { key: 'compRatio', label: tProp ? tProp('effects.param.ratio') : 'RATIO', min: 1, max: 20, step: 0.1 },
                { key: 'compAttack', label: tProp ? tProp('effects.param.attack') : 'ATTACK', min: 0.001, max: 0.5, step: 0.001 },
                { key: 'compRelease', label: tProp ? tProp('effects.param.release') : 'RELEASE', min: 0.01, max: 1.5, step: 0.01 },
                { key: 'compMakeup', label: tProp ? tProp('effects.param.makeup') : 'MAKEUP', min: -6, max: 24, step: 0.5 },
            ]
        },
        {
            key: 'enh', label: tProp ? tProp('effects.rack.loomSauce.enhance') : 'ENHANCE', bypassKey: 'enhBypass',
            knobs: [
                { key: 'enhAir', label: tProp ? tProp('effects.param.air') : 'AIR', min: 0, max: 1, step: 0.01 },
                { key: 'enhWarmth', label: tProp ? tProp('effects.param.warmth') : 'WARMTH', min: 0, max: 1, step: 0.01 },
                { key: 'enhPresence', label: tProp ? tProp('effects.param.presence') : 'PRESENCE', min: 0, max: 1, step: 0.01 },
            ]
        },
        {
            key: 'eq', label: tProp ? tProp('effects.rack.loomSauce.eq') : 'EQ', bypassKey: 'eqBypass',
            knobs: [
                { key: 'eqLowGain', label: tProp ? tProp('effects.param.low') : 'LOW', min: -12, max: 12, step: 0.5 },
                { key: 'eqMidGain', label: tProp ? tProp('effects.param.mid') : 'MID', min: -12, max: 12, step: 0.5 },
                { key: 'eqMidFreq', label: tProp ? tProp('effects.param.midFreq') : 'MID FREQ', min: 200, max: 8000, step: 10 },
                { key: 'eqHighGain', label: tProp ? tProp('effects.param.high') : 'HIGH', min: -12, max: 12, step: 0.5 },
            ]
        },
        {
            key: 'mult', label: tProp ? tProp('effects.rack.loomSauce.multiply') : 'MULTIPLY', bypassKey: 'multBypass',
            knobs: [
                { key: 'multAmount', label: tProp ? tProp('effects.param.amount') : 'AMOUNT', min: 0, max: 1, step: 0.01 },
                { key: 'multWidth', label: tProp ? tProp('effects.param.width') : 'WIDTH', min: 0, max: 1, step: 0.01 },
                { key: 'multDetune', label: tProp ? tProp('effects.param.detune') : 'DETUNE', min: 0, max: 50, step: 1 },
            ]
        },
        {
            key: 'space', label: tProp ? tProp('effects.rack.loomSauce.space') : 'SPACE', bypassKey: 'spaceBypass',
            knobs: [
                { key: 'spaceSize', label: tProp ? tProp('effects.param.size') : 'SIZE', min: 0, max: 1, step: 0.01 },
                { key: 'spaceDamping', label: tProp ? tProp('effects.param.damp') : 'DAMP', min: 0, max: 1, step: 0.01 },
                { key: 'spacePreDelay', label: tProp ? tProp('effects.param.preDly') : 'PRE-DLY', min: 0, max: 0.2, step: 0.001 },
                { key: 'spaceMix', label: tProp ? tProp('effects.param.mix') : 'MIX', min: 0, max: 1, step: 0.01 },
            ]
        },
        {
            key: 'gain', label: tProp ? tProp('effects.rack.loomSauce.gain') : 'GAIN', bypassKey: 'gainBypass',
            knobs: [
                { key: 'gainLevel', label: tProp ? tProp('effects.param.level') : 'LEVEL', min: 0, max: 2, step: 0.01 },
                { key: 'gainPan', label: tProp ? tProp('effects.param.pan') : 'PAN', min: -1, max: 1, step: 0.01 },
            ],
            toggles: [
                { key: 'gainLimiter', label: tProp ? tProp('effects.param.limiter') : 'LIMITER' },
            ]
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '720px', margin: '0 auto' }}>
            {/* Preset selector bar */}
            <div style={{
                display: 'flex', gap: '6px', alignItems: 'center',
                padding: '4px 8px', background: iBg, borderRadius: '4px',
                border: `1px solid ${fb}`
            }}>
                <span style={{ fontSize: '9px', fontWeight: '700', color: mt, letterSpacing: '1px', whiteSpace: 'nowrap' }}>{tProp ? tProp('effects.rack.preset') : 'PRESET'}</span>
                <select
                    value={selectedPreset}
                    onChange={(e) => applyPreset(e.target.value)}
                    style={{
                        flex: 1, background: pc, color: tc, border: `1px solid ${fb}`,
                        borderRadius: '3px', padding: '3px 20px 3px 6px', fontSize: '10px',
                        fontWeight: '600', cursor: 'pointer', outline: 'none',
                        appearance: 'none', WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='${acEncoded}' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 6px center',
                    }}
                >
                    <option value="">{tProp ? tProp('effects.rack.selectPreset') : '-- Select Preset --'}</option>
                    <optgroup label={tProp ? tProp('effects.rack.factory') : 'Factory'}>
                        {LOOMSAUCE_FACTORY_PRESETS.map(p => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                    </optgroup>
                    {userPresets.length > 0 && (
                        <optgroup label={tProp ? tProp('effects.rack.user') : 'User'}>
                            {userPresets.map(p => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </optgroup>
                    )}
                </select>
                <button
                    onClick={handleSavePreset}
                    title={tProp ? tProp('effects.rack.savePreset') : 'Save current settings as user preset'}
                    style={{
                        padding: '3px 8px', fontSize: '9px', fontWeight: '700',
                        background: `${ac}11`, border: `1px solid ${ac}44`,
                        color: ac, borderRadius: '3px', cursor: 'pointer', letterSpacing: '0.5px'
                    }}
                >{tProp ? tProp('effects.rack.save') : 'SAVE'}</button>
                {userPresets.find(p => p.name === selectedPreset) && (
                    <button
                        onClick={handleDeletePreset}
                        title={tProp ? tProp('effects.rack.deletePreset') : 'Delete user preset'}
                        style={{
                            padding: '3px 8px', fontSize: '9px', fontWeight: '700',
                            background: 'transparent',
                            border: `1px solid ${theme?.isDark === false ? '#c6282844' : '#f4433644'}`,
                            color: theme?.isDark === false ? '#c62828' : '#f44336',
                            borderRadius: '3px', cursor: 'pointer'
                        }}
                    >{tProp ? tProp('effects.rack.del') : 'DEL'}</button>
                )}
            </div>

            {/* 6-section grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '3px',
                width: '100%'
            }}>
                {sections.map(sec => {
                    const isBypassed = !!params[sec.bypassKey];
                    return (
                        <div key={sec.key} style={{
                            border: `1px solid ${isBypassed ? fb : ac + '33'}`,
                            borderRadius: '4px', overflow: 'hidden',
                            opacity: isBypassed ? 0.45 : 1,
                            transition: 'opacity 0.15s, border-color 0.15s',
                            background: pc
                        }}>
                            <LoomSauceSectionHeader
                                label={sec.label}
                                bypassed={isBypassed}
                                onToggleBypass={() => set(sec.bypassKey, !isBypassed)}
                                theme={theme}
                                t={tProp}
                            />
                            <div style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '4px',
                                padding: '6px 2px'
                            }}>
                                {sec.knobs.map(k => (
                                    <Knob
                                        key={k.key}
                                        label={k.label}
                                        value={params[k.key] ?? k.min}
                                        min={k.min}
                                        max={k.max}
                                        onChange={(v) => set(k.key, v)}
                                        color={ac}
                                        size={30}
                                        isDark={theme?.isDark}
                                    />
                                ))}
                                {sec.toggles && sec.toggles.map(tog => (
                                    <ToggleButton
                                        key={tog.key}
                                        label={tog.label}
                                        value={!!params[tog.key]}
                                        onChange={(v) => set(tog.key, v)}
                                        theme={theme}
                                        t={tProp}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─────────────────────── Single Effect Panel ─────────────────
const EffectPanel = ({ effect, effectsManager, trackId, onRemove, onUpdate, dragHandlers, theme, tempo, collapsed, onToggleCollapse, accentColors, t: tProp }) => {
    const params = effect.getParams();
    const paramDefs = EFFECT_PARAM_DEFS[effect.name] || [];
    const rawDisplayName = EFFECT_DISPLAY_NAMES[effect.name] || effect.name;
    const displayName = tProp && EFFECT_NAME_I18N[effect.name] ? tProp(EFFECT_NAME_I18N[effect.name]) : rawDisplayName;
    const ac = theme?.accentColor || accentColor;
    const pc = theme?.panelColor || panelColor;
    const isDark = theme?.isDark ?? true;
    const hBg = theme?.headerBg || (isDark ? '#1e1e1e' : '#eaeaee');
    const gc = theme?.gridColor || (isDark ? gridColor : '#d5d5d9');
    const tc = theme?.textColor || (isDark ? textColor : '#222');
    const mt = theme?.mutedText || (isDark ? '#555' : '#888');
    const fb = theme?.faintBorder || (isDark ? '#333' : '#d0d0d8');

    const handleParamChange = useCallback((key, value) => {
        // AutoPan sync: when sync changes, auto-calculate rate from tempo
        if (effect.name === 'AutoPan' && key === 'sync') {
            effect.setParam('sync', value);
            if (value !== 'free') {
                const bars = parseFloat(value);
                if (bars > 0 && tempo > 0) {
                    // rate = 1 / (bars * 4 beats * (60/tempo) seconds)
                    const rate = tempo / (bars * 240);
                    effect.setParam('rate', Math.round(rate * 10000) / 10000);
                }
            }
            onUpdate();
            return;
        }
        // If user manually changes rate on AutoPan, reset sync to free
        if (effect.name === 'AutoPan' && key === 'rate') {
            effect.setParam('sync', 'free');
        }
        effect.setParam(key, value);
        onUpdate();
    }, [effect, onUpdate, tempo]);

    const handleBypass = useCallback(() => {
        effect.setBypassed(!effect.bypassed);
        onUpdate();
    }, [effect, onUpdate]);

    return (
        <div
            style={{
                background: pc,
                border: `1px solid ${effect.bypassed ? fb : ac + '44'}`,
                borderRadius: '6px',
                overflow: 'hidden',
                opacity: effect.bypassed ? 0.5 : 1,
                transition: 'opacity 0.15s, border-color 0.15s',
                flex: collapsed ? '0 0 auto' : '1 1 0',
                minHeight: collapsed ? 'auto' : 0,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Header bar */}
            <div
                style={{
                    display: 'flex', alignItems: 'center', padding: '8px 10px',
                    background: hBg, gap: '8px', cursor: 'grab',
                    borderBottom: collapsed ? 'none' : `1px solid ${gc}`,
                    flexShrink: 0
                }}
                {...dragHandlers}
            >
                {/* Drag handle */}
                <span style={{ fontSize: '10px', color: mt, cursor: 'grab', userSelect: 'none' }}>⠿</span>

                {/* Accent dot */}
                <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: effect.bypassed ? mt : ac,
                    boxShadow: effect.bypassed ? 'none' : `0 0 6px ${ac}66`,
                    flexShrink: 0
                }} />

                {/* Effect name */}
                <span style={{
                    fontSize: '11px', fontWeight: '700', color: effect.bypassed ? mt : tc,
                    letterSpacing: '1px', textTransform: 'uppercase', flex: 1
                }}>
                    {displayName}
                </span>

                {/* Bypass toggle */}
                <button
                    onClick={handleBypass}
                    title={effect.bypassed ? (tProp ? tProp('effects.rack.enable') : 'Enable') : (tProp ? tProp('effects.rack.bypass') : 'Bypass')}
                    style={{
                        width: '22px', height: '22px', borderRadius: '3px',
                        background: effect.bypassed ? fb : `${ac}22`,
                        border: `1px solid ${effect.bypassed ? gc : ac}`,
                        color: effect.bypassed ? mt : ac,
                        fontSize: '10px', fontWeight: '900', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0
                    }}
                >
                    ⏻
                </button>

                {/* Collapse toggle */}
                <button
                    onClick={onToggleCollapse}
                    style={{
                        width: '22px', height: '22px', borderRadius: '3px',
                        background: 'transparent', border: `1px solid ${fb}`,
                        color: mt, fontSize: '8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0
                    }}
                >
                    {collapsed ? '▼' : '▲'}
                </button>

                {/* Remove */}
                <button
                    onClick={onRemove}
                    title={tProp ? tProp('effects.rack.removeEffect') : 'Remove effect'}
                    style={{
                        width: '22px', height: '22px', borderRadius: '3px',
                        background: 'transparent', border: `1px solid ${fb}`,
                        color: mt, fontSize: '12px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0
                    }}
                    onMouseEnter={(e) => { const rc = theme?.isDark === false ? '#c62828' : '#ff4444'; e.currentTarget.style.borderColor = rc; e.currentTarget.style.color = rc; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = fb; e.currentTarget.style.color = mt; }}
                >
                    ✕
                </button>
            </div>

            {/* Visualizer — interactive for all effects */}
            {!collapsed && (
                <InteractiveCanvas effect={effect} onUpdate={onUpdate} theme={theme} accentColors={accentColors} />
            )}

            {/* Controls */}
            {!collapsed && (
                <div style={{
                    padding: '12px 10px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '14px',
                    alignItems: 'flex-end',
                    flex: 1,
                    overflow: 'auto'
                }}>
                    {paramDefs.length === 0 && (
                        <span style={{ fontSize: '11px', color: mt, fontStyle: 'italic' }}>{tProp ? tProp('effects.rack.noAdjustableParams') : 'No adjustable parameters'}</span>
                    )}
                    {paramDefs.map(def => {
                        if (def.type === 'knob') {
                            return (
                                <Knob
                                    key={def.key}
                                    label={def.label}
                                    value={params[def.key] ?? def.min}
                                    min={def.min}
                                    max={def.max}
                                    onChange={(v) => handleParamChange(def.key, v)}
                                    color={def.color || ac}
                                    size={44}
                                    isDark={theme?.isDark}
                                />
                            );
                        }
                        if (def.type === 'toggle') {
                            return (
                                <ToggleButton
                                    key={def.key}
                                    label={def.label}
                                    value={!!params[def.key]}
                                    onChange={(v) => handleParamChange(def.key, v)}
                                    theme={theme}
                                    t={tProp}
                                />
                            );
                        }
                        if (def.type === 'select') {
                            return (
                                <SelectControl
                                    key={def.key}
                                    label={def.label}
                                    value={String(params[def.key])}
                                    options={def.options}
                                    onChange={(v) => {
                                        // Attempt numeric conversion for band counts etc
                                        const num = Number(v);
                                        handleParamChange(def.key, isNaN(num) ? v : num);
                                    }}
                                    theme={theme}
                                />
                            );
                        }
                        if (def.type === 'eq-bands') {
                            return (
                                <EQBandEditor
                                    key={def.key}
                                    bands={params.bands || []}
                                    onChange={(newBands) => handleParamChange('bands', newBands)}
                                    theme={theme}
                                    t={tProp}
                                />
                            );
                        }
                        if (def.type === 'loom-sauce') {
                            return (
                                <LoomSauceUI
                                    key={def.key}
                                    effect={effect}
                                    onUpdate={onUpdate}
                                    theme={theme}
                                    t={tProp}
                                />
                            );
                        }
                        return null;
                    })}
                </div>
            )}
        </div>
    );
};

// ─────────────────────── Add Effect Browser ──────────────────
const AddEffectBrowser = ({ onAdd, onClose, theme, t: tProp }) => {
    const isDark = theme?.isDark ?? true;
    const ac = theme?.accentColor || accentColor;
    const pc = theme?.panelColor || (isDark ? panelColor : '#ffffff');
    const tc = theme?.textColor || (isDark ? textColor : '#222');
    const mt = theme?.mutedText || (isDark ? '#555' : '#888');
    const fb = theme?.faintBorder || (isDark ? '#333' : '#d0d0d8');
    const iBg = theme?.inputBg || (isDark ? '#1a1a1a' : '#f0f0f4');

    return (
        <div style={{
            background: pc, border: `1px solid ${ac}44`,
            borderRadius: '6px', padding: '10px', marginTop: '8px'
        }}>
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '10px'
            }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: ac, letterSpacing: '1px' }}>
                    {tProp ? tProp('effects.rack.addEffectShort') : 'ADD EFFECT'}
                </span>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent', border: 'none', color: mt,
                        fontSize: '14px', cursor: 'pointer', padding: '2px 6px'
                    }}
                >✕</button>
            </div>
            {EFFECT_CATEGORIES.map(cat => (
                <div key={cat.name} style={{ marginBottom: '8px' }}>
                    <div style={{
                        fontSize: '9px', fontWeight: '700', color: mt,
                        letterSpacing: '1.5px', textTransform: 'uppercase',
                        marginBottom: '4px', paddingLeft: '4px'
                    }}>
                        {CATEGORY_ICONS[cat.name] || '●'} {tProp && CATEGORY_NAME_I18N[cat.name] ? tProp(CATEGORY_NAME_I18N[cat.name]) : cat.name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '4px' }}>
                        {cat.effects.map(fx => (
                            <button
                                key={fx.type}
                                onClick={() => onAdd(fx.type)}
                                style={{
                                    padding: '4px 10px', fontSize: '10px', fontWeight: '600',
                                    background: iBg, color: tc,
                                    border: `1px solid ${fb}`, borderRadius: '4px',
                                    cursor: 'pointer', letterSpacing: '0.5px',
                                    transition: 'all 0.1s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = ac;
                                    e.currentTarget.style.color = ac;
                                    e.currentTarget.style.background = `${ac}11`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = fb;
                                    e.currentTarget.style.color = tc;
                                    e.currentTarget.style.background = iBg;
                                }}
                            >
                                {tProp && EFFECT_NAME_I18N[fx.label] ? tProp(EFFECT_NAME_I18N[fx.label]) : fx.label}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ═══════════════════════ MAIN EFFECTS RACK ════════════════════
const EffectsRack = ({ effectsManager, sampler, onClose, isDark = true, onEffectsChanged, isPlaying, onTogglePlayback, audioTracks = [], midiTracks = [], tempo = 120, accentColors}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const [selectedTrack, setSelectedTrack] = useState('drums');
    const [showBrowser, setShowBrowser] = useState(false);
    const [, forceUpdate] = useState(0);
    const [dragIdx, setDragIdx] = useState(null);
    const [monoMonitoring, setMonoMonitoring] = useState(sampler?.isMonoMonitoring || false);

    // Compute theme colors based on isDark + accentColors
    const theme = useMemo(() => getThemeColors(isDark, accentColors), [isDark, accentColors]);

    // Translate track / drum-lane labels via lookup maps
    const translateLabel = useCallback((label) => {
        const trackKey = TRACK_LABEL_I18N[label];
        if (trackKey) return t(trackKey);
        const drumKey = DRUM_LANE_I18N[label];
        if (drumKey) return t(drumKey);
        return label;
    }, [t]);

    // Build combined tracks list: base generators + drum lanes + audio tracks + master
    const TRACKS = useMemo(() => {
        const drums = BASE_TRACKS.find(tr => tr.id === 'drums');
        const otherGens = BASE_TRACKS.filter(tr => tr.id !== 'master' && tr.id !== 'drums');
        const midiEntries = midiTracks.map(mtr => ({
            id: mtr.id,
            label: (mtr.name || mtr.id).toUpperCase(),
            color: mtr.color || '#c56cf0'
        }));
        const audioEntries = audioTracks.map(at => ({
            id: at.id,
            label: (at.name || at.id).toUpperCase(),
            color: at.color || '#ff9ff3'
        }));
        const master = BASE_TRACKS.find(tr => tr.id === 'master');
        return [drums, ...DRUM_LANES, ...otherGens, ...midiEntries, ...audioEntries, master];
    }, [audioTracks, midiTracks]);

    // Get current chain for the selected track
    const getChain = useCallback(() => {
        if (!effectsManager) return null;
        if (selectedTrack === 'master') {
            return effectsManager.masterChain;
        }
        return effectsManager.getTrackChain(selectedTrack);
    }, [effectsManager, selectedTrack]);

    const chain = getChain();
    const effects = chain?.effects || [];

    // Track which effect is expanded (shown full-size). First effect by default.
    const [expandedEffectId, setExpandedEffectId] = useState(null);
    // Auto-expand first effect or the only non-collapsed one
    const activeExpandedId = expandedEffectId && effects.find(fx => fx.id === expandedEffectId)
        ? expandedEffectId
        : (effects.length > 0 ? effects[effects.length - 1].id : null);

    const triggerUpdate = useCallback(() => {
        forceUpdate(n => n + 1);
        if (onEffectsChanged) onEffectsChanged();
    }, [onEffectsChanged]);

    const handleAddEffect = useCallback((type) => {
        if (!effectsManager) return;
        try {
            const fx = AudioEffect.create(type);
            if (selectedTrack === 'master') {
                effectsManager.masterChain.addEffect(fx);
            } else {
                effectsManager.getOrCreateTrackChain(selectedTrack).addEffect(fx);
            }
            setExpandedEffectId(fx.id);
            setShowBrowser(false);
            triggerUpdate();
        } catch (err) {
            console.error('Failed to add effect:', err);
        }
    }, [effectsManager, selectedTrack, triggerUpdate]);

    const handleRemoveEffect = useCallback((effectId) => {
        const c = getChain();
        if (c) {
            c.removeEffect(effectId);
            triggerUpdate();
        }
    }, [getChain, triggerUpdate]);

    const handleDragStart = useCallback((idx) => {
        setDragIdx(idx);
    }, []);

    const handleDragOver = useCallback((e, idx) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === idx) return;
        const c = getChain();
        if (c) {
            c.reorderEffect(dragIdx, idx);
            setDragIdx(idx);
            triggerUpdate();
        }
    }, [dragIdx, getChain, triggerUpdate]);

    const handleDragEnd = useCallback(() => {
        setDragIdx(null);
    }, []);

    const trackColor = TRACKS.find(tr => tr.id === selectedTrack)?.color || theme.accentColor;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: theme.overlayBg,
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: '1200px', maxWidth: '95vw',
                height: '92vh', maxHeight: '98vh',
                background: theme.bgColor,
                border: `2px solid ${theme.accentColor}`,
                borderRadius: '8px',
                boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.6)' : '0 10px 40px rgba(0,0,0,0.15)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* ─── Header ─── */}
                <div style={{
                    display: 'flex', alignItems: 'center', padding: '12px 16px',
                    borderBottom: `1px solid ${theme.gridColor}`, gap: '10px',
                    background: theme.headerBg, flexShrink: 0
                }}>
                    {/* Accent dot */}
                    <div style={{
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: theme.accentColor,
                        boxShadow: `0 0 8px ${theme.accentColor}88`
                    }} />
                    <span style={{
                        fontSize: '16px', fontWeight: '700', color: theme.textColor,
                        letterSpacing: '1.5px', textTransform: 'uppercase'
                    }}>
                        {t('effects.rack.title')}
                    </span>
                    <span style={{ fontSize: '11px', color: theme.mutedText, marginLeft: '4px' }}>
                        {t('effects.rack.subtitle')}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent', border: 'none',
                            color: theme.mutedText, fontSize: '20px', cursor: 'pointer',
                            padding: '2px 8px', lineHeight: 1
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = theme.accentColor}
                        onMouseLeave={(e) => e.currentTarget.style.color = theme.mutedText}
                    >
                        ✕
                    </button>
                </div>

                {/* ─── Track Tabs ─── */}
                <div style={{
                    display: 'flex', borderBottom: `1px solid ${theme.gridColor}`,
                    background: theme.inputBg, flexShrink: 0,
                    overflowX: 'auto', overflowY: 'hidden'
                }}>
                    {TRACKS.map(tr => {
                        const isDrumLane = tr.isDrumLane;
                        return (
                            <button
                                key={tr.id}
                                onClick={() => { setSelectedTrack(tr.id); setShowBrowser(false); }}
                                style={{
                                    flex: 'none',
                                    minWidth: isDrumLane ? '60px' : '90px',
                                    padding: isDrumLane ? '6px 5px' : '10px 8px',
                                    background: 'transparent', border: 'none',
                                    borderBottom: selectedTrack === tr.id ? `3px solid ${tr.color}` : '3px solid transparent',
                                    color: selectedTrack === tr.id ? tr.color : theme.mutedText,
                                    fontWeight: isDrumLane ? '600' : '700',
                                    fontSize: isDrumLane ? '9px' : '11px',
                                    letterSpacing: isDrumLane ? '0.5px' : '1.5px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    textTransform: 'uppercase',
                                    whiteSpace: 'nowrap',
                                    borderLeft: isDrumLane && tr.id === 'drum_kick' ? `1px solid ${theme.gridColor}` : 'none',
                                    borderRight: isDrumLane && tr.id === 'drum_perc' ? `1px solid ${theme.gridColor}` : 'none',
                                }}
                            >
                                {translateLabel(tr.label)}
                            </button>
                        );
                    })}
                </div>

                {/* ─── Effects List ─── */}
                <div style={{
                    flex: 1, overflow: 'hidden', padding: '0',
                    display: 'flex', flexDirection: 'column',
                    position: 'relative'
                }}>
                    {effects.length === 0 && !showBrowser && (
                        <div style={{
                            flex: 1, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '12px'
                        }}>
                            <div style={{ fontSize: '36px', opacity: 0.3 }}>🎛️</div>
                            <span style={{ fontSize: '13px', color: theme.mutedText, fontWeight: '600' }}>
                                {t('effects.rack.noEffectsOn', { track: translateLabel(TRACKS.find(tr => tr.id === selectedTrack)?.label || selectedTrack) })}
                            </span>
                            <span style={{ fontSize: '11px', color: theme.faintText }}>
                                {t('effects.rack.clickToAdd')}
                            </span>
                        </div>
                    )}

                    {/* Expanded (active) effect — fills the ENTIRE area via absolute positioning */}
                    {activeExpandedId && effects.find(fx => fx.id === activeExpandedId) && (() => {
                        const fx = effects.find(f => f.id === activeExpandedId);
                        const idx = effects.indexOf(fx);
                        return (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                zIndex: 2, display: 'flex', flexDirection: 'column',
                                padding: '8px 16px', overflow: 'hidden',
                                background: theme.bgColor
                            }}>
                                {/* Switcher bar — tiny tabs to switch between effects */}
                                {effects.length > 1 && (
                                    <div style={{
                                        display: 'flex', gap: '2px', flexShrink: 0,
                                        marginBottom: '6px', flexWrap: 'wrap'
                                    }}>
                                        {effects.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setExpandedEffectId(f.id)}
                                                style={{
                                                    padding: '3px 10px', fontSize: '9px', fontWeight: '700',
                                                    letterSpacing: '0.8px', textTransform: 'uppercase',
                                                    background: f.id === activeExpandedId ? `${theme.accentColor}22` : 'transparent',
                                                    border: `1px solid ${f.id === activeExpandedId ? theme.accentColor : theme.faintBorder}`,
                                                    color: f.id === activeExpandedId ? theme.accentColor : theme.mutedText,
                                                    borderRadius: '3px', cursor: 'pointer',
                                                    opacity: f.bypassed ? 0.4 : 1,
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {EFFECT_NAME_I18N[f.name] ? t(EFFECT_NAME_I18N[f.name]) : (EFFECT_DISPLAY_NAMES[f.name] || f.name)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <EffectPanel
                                    key={fx.id}
                                    effect={fx}
                                    effectsManager={effectsManager}
                                    trackId={selectedTrack}
                                    onRemove={() => handleRemoveEffect(fx.id)}
                                    onUpdate={triggerUpdate}
                                    dragHandlers={{
                                        draggable: true,
                                        onDragStart: () => handleDragStart(idx),
                                        onDragOver: (e) => handleDragOver(e, idx),
                                        onDragEnd: handleDragEnd
                                    }}
                                    theme={theme}
                                    tempo={tempo}
                                    collapsed={false}
                                    onToggleCollapse={() => {
                                        const others = effects.filter(f => f.id !== activeExpandedId);
                                        setExpandedEffectId(others.length > 0 ? others[0].id : null);
                                    }}
                                    accentColors={accentColors}
                                    t={t}
                                />
                            </div>
                        );
                    })()}

                    {/* Add Effect Browser — above the expanded effect overlay */}
                    {showBrowser && (
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 5, overflow: 'auto', padding: '12px 16px',
                            background: theme.bgColor
                        }}>
                            <AddEffectBrowser
                                onAdd={handleAddEffect}
                                onClose={() => setShowBrowser(false)}
                                theme={theme}
                                t={t}
                            />
                        </div>
                    )}
                </div>

                {/* ─── Footer: Add button + chain info ─── */}
                <div style={{
                    display: 'flex', alignItems: 'center', padding: '10px 16px',
                    borderTop: `1px solid ${theme.gridColor}`, background: theme.headerBg,
                    flexShrink: 0, gap: '10px'
                }}>
                    <button
                        onClick={() => setShowBrowser(!showBrowser)}
                        style={{
                            padding: '6px 16px', fontSize: '11px', fontWeight: '700',
                            background: theme.hoverBg,
                            border: `1px solid ${theme.accentColor}`,
                            color: theme.accentColor, borderRadius: '4px',
                            cursor: 'pointer', letterSpacing: '1px',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = theme.hoverBgStrong; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = theme.hoverBg; }}
                    >
                        {t('effects.rack.addEffect')}
                    </button>
                    <span style={{ fontSize: '10px', color: theme.mutedText, letterSpacing: '0.5px' }}>
                        {effects.length !== 1
                            ? t('effects.rack.effectCountPlural', { count: effects.length, track: translateLabel(TRACKS.find(tr => tr.id === selectedTrack)?.label || 'track') })
                            : t('effects.rack.effectCount', { count: effects.length, track: translateLabel(TRACKS.find(tr => tr.id === selectedTrack)?.label || 'track') })}
                    </span>

                    {/* Play/Pause toggle for live tweaking */}
                    {onTogglePlayback && (
                        <button
                            onClick={onTogglePlayback}
                            title={isPlaying ? t('effects.rack.pausePlayback') : t('effects.rack.startPlayback')}
                            style={{
                                padding: '4px 10px', fontSize: '10px', fontWeight: '800',
                                background: isPlaying ? theme.accentColor : 'transparent',
                                border: `1px solid ${isPlaying ? theme.accentColor : theme.faintBorder}`,
                                color: isPlaying ? '#fff' : theme.mutedText,
                                borderRadius: '3px', cursor: 'pointer',
                                letterSpacing: '1px', transition: 'all 0.15s',
                                boxShadow: isPlaying ? `0 0 8px ${theme.accentColor}44` : 'none'
                            }}
                        >
                            {isPlaying ? `⏸ ${t('effects.rack.pause')}` : `▶ ${t('effects.rack.play')}`}
                        </button>
                    )}

                    {/* Mono monitoring toggle */}
                    {sampler && (
                        <button
                            onClick={() => {
                                const next = !monoMonitoring;
                                setMonoMonitoring(next);
                                if (sampler.setMonoMonitoring) sampler.setMonoMonitoring(next);
                            }}
                            title={monoMonitoring ? t('effects.rack.switchToStereo') : t('effects.rack.switchToMono')}
                            style={{
                                padding: '4px 10px', fontSize: '10px', fontWeight: '800',
                                background: monoMonitoring ? theme.accentColor : 'transparent',
                                border: `1px solid ${monoMonitoring ? theme.accentColor : theme.faintBorder}`,
                                color: monoMonitoring ? '#fff' : theme.mutedText,
                                borderRadius: '3px', cursor: 'pointer',
                                letterSpacing: '1px', transition: 'all 0.15s',
                                boxShadow: monoMonitoring ? `0 0 8px ${theme.accentColor}44` : 'none'
                            }}
                        >
                            {monoMonitoring ? t('effects.rack.mono') : t('effects.rack.stereo')}
                        </button>
                    )}

                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: '9px', color: theme.faintText, letterSpacing: '0.5px' }}>
                        {t('effects.rack.signal')}: {t('effects.rack.signalInput')} → {effects.filter(fx => !fx.bypassed).map(fx => (EFFECT_NAME_I18N[fx.name] ? t(EFFECT_NAME_I18N[fx.name]) : (EFFECT_DISPLAY_NAMES[fx.name] || fx.name)).toUpperCase()).join(' → ') || t('effects.rack.signalPassthrough')} → {t('effects.rack.signalOutput')}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default EffectsRack;
