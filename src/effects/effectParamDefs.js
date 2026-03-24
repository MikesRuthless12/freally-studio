/**
 * effectParamDefs.js — UI parameter definitions for every effect plugin.
 *
 * Each effect type maps to an array of parameter descriptors that the
 * EffectsRack UI uses to render knobs, selects, and toggles.
 *
 * Descriptor shape:
 *   {
 *     key:       string,            // param key in effect.params
 *     label:     string,            // display label (uppercase by convention)
 *     type:      'knob'|'select'|'toggle',
 *     min?:      number,            // for knobs
 *     max?:      number,
 *     step?:     number,
 *     unit?:     string,            // 'dB', 'ms', 'Hz', '%', 's', ''
 *     display?:  (v) => string,     // custom value formatter
 *     options?:  string[],          // for select type
 *     color?:    string,            // override knob color
 *   }
 */

const pct = (v) => `${Math.round(v * 100)}%`;
const ms = (v) => `${Math.round(v * 1000)}ms`;
const sec = (v) => `${v.toFixed(2)}s`;
const hz = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}Hz`;
const db = (v) => `${v.toFixed(1)}dB`;
const ratio = (v) => `${v.toFixed(1)}:1`;
const plain = (v) => v.toFixed(1);
const deg = (v) => `${Math.round(v)}°`;

export const EFFECT_PARAM_DEFS = {
    // ──────────────────────────────── DYNAMICS ────────────────────────────────
    Compressor: [
        { key: 'threshold', label: 'THRESHOLD', type: 'knob', min: -60, max: 0, step: 0.5, unit: 'dB', display: db },
        { key: 'ratio', label: 'RATIO', type: 'knob', min: 1, max: 20, step: 0.1, display: ratio },
        { key: 'attack', label: 'ATTACK', type: 'knob', min: 0.001, max: 0.5, step: 0.001, display: ms },
        { key: 'release', label: 'RELEASE', type: 'knob', min: 0.01, max: 1.5, step: 0.01, display: ms },
        { key: 'knee', label: 'KNEE', type: 'knob', min: 0, max: 40, step: 1, unit: 'dB', display: db },
        { key: 'makeupGain', label: 'MAKEUP', type: 'knob', min: -6, max: 24, step: 0.5, unit: 'dB', display: db },
    ],

    GlueCompressor: [
        { key: 'threshold', label: 'THRESHOLD', type: 'knob', min: -40, max: 0, step: 0.5, unit: 'dB', display: db },
        { key: 'ratio', label: 'RATIO', type: 'knob', min: 1, max: 10, step: 0.1, display: ratio },
        { key: 'attack', label: 'ATTACK', type: 'knob', min: 0.005, max: 0.3, step: 0.001, display: ms },
        { key: 'release', label: 'RELEASE', type: 'knob', min: 0.05, max: 1.2, step: 0.01, display: ms },
        { key: 'makeupGain', label: 'MAKEUP', type: 'knob', min: -6, max: 18, step: 0.5, unit: 'dB', display: db },
        { key: 'softClip', label: 'SOFT CLIP', type: 'toggle' },
    ],

    Limiter: [
        { key: 'ceiling', label: 'CEILING', type: 'knob', min: -12, max: 0, step: 0.1, unit: 'dB', display: db },
        { key: 'release', label: 'RELEASE', type: 'knob', min: 0.01, max: 0.5, step: 0.01, display: ms },
        { key: 'makeupGain', label: 'MAKEUP', type: 'knob', min: -6, max: 18, step: 0.5, unit: 'dB', display: db },
    ],

    Gate: [
        { key: 'threshold', label: 'THRESHOLD', type: 'knob', min: -80, max: 0, step: 1, unit: 'dB', display: db },
        { key: 'attack', label: 'ATTACK', type: 'knob', min: 0.0001, max: 0.1, step: 0.0001, display: ms },
        { key: 'release', label: 'RELEASE', type: 'knob', min: 0.01, max: 1.0, step: 0.01, display: ms },
        { key: 'hold', label: 'HOLD', type: 'knob', min: 0, max: 0.5, step: 0.01, display: ms },
        { key: 'range', label: 'RANGE', type: 'knob', min: -80, max: 0, step: 1, unit: 'dB', display: db },
    ],

    SidechainCompressor: [
        { key: 'threshold', label: 'THRESHOLD', type: 'knob', min: -60, max: 0, step: 0.5, unit: 'dB', display: db },
        { key: 'ratio', label: 'RATIO', type: 'knob', min: 1, max: 20, step: 0.1, display: ratio },
        { key: 'attack', label: 'ATTACK', type: 'knob', min: 0.001, max: 0.2, step: 0.001, display: ms },
        { key: 'release', label: 'RELEASE', type: 'knob', min: 0.01, max: 1.0, step: 0.01, display: ms },
        { key: 'depth', label: 'DEPTH', type: 'knob', min: -40, max: 0, step: 1, unit: 'dB', display: db },
        { key: 'keySource', label: 'KEY SOURCE', type: 'select', options: ['kick', 'snare', 'clap', 'closedHat'] },
    ],

    // ──────────────────────────────── EQ & FILTER ────────────────────────────
    EQEight: [
        // EQ bands are handled specially by the EffectsRack — not simple knobs.
        // We provide a flag for the UI to render its custom band editor.
        { key: 'bands', label: 'EQ BANDS', type: 'eq-bands' },
        // Additional knob controls for DetailPanel (individual band gains)
        { key: 'eqBand0Gain', label: 'HP 30', type: 'knob', min: -12, max: 12, step: 0.5, display: db, _bandIndex: 0, _bandParam: 'gain' },
        { key: 'eqBand1Gain', label: 'LS 100', type: 'knob', min: -12, max: 12, step: 0.5, display: db, _bandIndex: 1, _bandParam: 'gain' },
        { key: 'eqBand2Gain', label: '250', type: 'knob', min: -12, max: 12, step: 0.5, display: db, _bandIndex: 2, _bandParam: 'gain' },
        { key: 'eqBand3Gain', label: '1K', type: 'knob', min: -12, max: 12, step: 0.5, display: db, _bandIndex: 3, _bandParam: 'gain' },
        { key: 'eqBand4Gain', label: '3K', type: 'knob', min: -12, max: 12, step: 0.5, display: db, _bandIndex: 4, _bandParam: 'gain' },
        { key: 'eqBand5Gain', label: '8K', type: 'knob', min: -12, max: 12, step: 0.5, display: db, _bandIndex: 5, _bandParam: 'gain' },
        { key: 'eqBand6Gain', label: 'HS 12K', type: 'knob', min: -12, max: 12, step: 0.5, display: db, _bandIndex: 6, _bandParam: 'gain' },
        { key: 'eqBand7Gain', label: 'LP 18K', type: 'knob', min: -12, max: 12, step: 0.5, display: db, _bandIndex: 7, _bandParam: 'gain' },
    ],

    // ──────────────────────────────── DISTORTION ─────────────────────────────
    Saturation: [
        { key: 'drive', label: 'DRIVE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'mode', label: 'MODE', type: 'select', options: ['tube', 'tape', 'digital'] },
        { key: 'toneFreq', label: 'TONE', type: 'knob', min: 500, max: 16000, step: 50, unit: 'Hz', display: hz },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Distortion: [
        { key: 'gain', label: 'DRIVE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'mode', label: 'MODE', type: 'select', options: ['softClip', 'hardClip', 'foldback', 'bitCrush'] },
        { key: 'toneFreq', label: 'TONE', type: 'knob', min: 200, max: 16000, step: 50, unit: 'Hz', display: hz },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    // ──────────────────────────────── TIME & SPACE ───────────────────────────
    Reverb: [
        { key: 'preDelay', label: 'PRE-DELAY', type: 'knob', min: 0, max: 0.2, step: 0.001, display: ms },
        { key: 'roomSize', label: 'ROOM SIZE', type: 'knob', min: 0.1, max: 2.0, step: 0.01, display: plain },
        { key: 'damping', label: 'DAMPING', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'decay', label: 'DECAY', type: 'knob', min: 0.1, max: 10, step: 0.1, unit: 's', display: sec },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Delay: [
        { key: 'delayTime', label: 'TIME', type: 'knob', min: 0.01, max: 2.0, step: 0.001, display: ms },
        { key: 'feedback', label: 'FEEDBACK', type: 'knob', min: 0, max: 0.95, step: 0.01, display: pct },
        { key: 'filterFreq', label: 'FILTER', type: 'knob', min: 200, max: 16000, step: 50, unit: 'Hz', display: hz },
        { key: 'pingPong', label: 'PING-PONG', type: 'toggle' },
        { key: 'sync', label: 'SYNC', type: 'toggle' },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Echo: [
        { key: 'time1', label: 'TAP 1', type: 'knob', min: 0.01, max: 2.0, step: 0.01, display: ms },
        { key: 'time2', label: 'TAP 2', type: 'knob', min: 0.01, max: 2.0, step: 0.01, display: ms },
        { key: 'time3', label: 'TAP 3', type: 'knob', min: 0.01, max: 2.0, step: 0.01, display: ms },
        { key: 'feedback', label: 'FEEDBACK', type: 'knob', min: 0, max: 0.9, step: 0.01, display: pct },
        { key: 'filterFreq', label: 'FILTER', type: 'knob', min: 200, max: 12000, step: 50, unit: 'Hz', display: hz },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Chorus: [
        { key: 'rate', label: 'RATE', type: 'knob', min: 0.1, max: 10, step: 0.1, unit: 'Hz', display: (v) => `${v.toFixed(1)}Hz` },
        { key: 'depth', label: 'DEPTH', type: 'knob', min: 0.0001, max: 0.02, step: 0.0001, display: ms },
        { key: 'delayTime', label: 'DELAY', type: 'knob', min: 0.005, max: 0.05, step: 0.001, display: ms },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Phaser: [
        { key: 'rate', label: 'RATE', type: 'knob', min: 0.05, max: 5, step: 0.05, unit: 'Hz', display: (v) => `${v.toFixed(2)}Hz` },
        { key: 'depth', label: 'DEPTH', type: 'knob', min: 100, max: 5000, step: 10, display: hz },
        { key: 'centerFreq', label: 'CENTER', type: 'knob', min: 200, max: 5000, step: 10, unit: 'Hz', display: hz },
        { key: 'feedback', label: 'FEEDBACK', type: 'knob', min: 0, max: 0.95, step: 0.01, display: pct },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    // ──────────────────────────────── STEREO & UTILITY ───────────────────────
    StereoWidener: [
        { key: 'width', label: 'WIDTH', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Utility: [
        { key: 'gain', label: 'GAIN', type: 'knob', min: 0, max: 2, step: 0.01, display: (v) => `${(20 * Math.log10(Math.max(0.001, v))).toFixed(1)}dB` },
        { key: 'pan', label: 'PAN', type: 'knob', min: -1, max: 1, step: 0.01, display: (v) => v === 0 ? 'C' : v < 0 ? `${Math.round(Math.abs(v) * 100)}L` : `${Math.round(v * 100)}R` },
        { key: 'phaseInvert', label: 'PHASE INV', type: 'toggle' },
        { key: 'mono', label: 'MONO', type: 'toggle' },
        { key: 'mute', label: 'MUTE', type: 'toggle' },
    ],

    // ──────────────────────────────── ANALYSIS ───────────────────────────────
    Tuner: [
        // Tuner has no adjustable params — display-only in UI
    ],

    // ────────────────────────────── AUTO PAN ──────────────────────────────────
    AutoPan: [
        { key: 'sync', label: 'SYNC', type: 'select', options: ['free', '2', '4', '8'] },
        { key: 'rate', label: 'RATE', type: 'knob', min: 0.01, max: 20, step: 0.01, unit: 'Hz', display: (v) => `${v.toFixed(2)}Hz` },
        { key: 'depth', label: 'DEPTH', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'shape', label: 'SHAPE', type: 'select', options: ['sine', 'triangle', 'square', 'sawtooth'] },
        { key: 'phase', label: 'PHASE', type: 'knob', min: 0, max: 360, step: 1, unit: '°', display: deg },
        { key: 'offset', label: 'OFFSET', type: 'knob', min: -1, max: 1, step: 0.01, display: (v) => v === 0 ? 'C' : v < 0 ? `L${Math.round(Math.abs(v) * 100)}` : `R${Math.round(v * 100)}` },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    // ──────────────────────────────── VOCAL ──────────────────────────────────
    LoomSauce: [
        { key: 'loomSauceUI', type: 'loom-sauce' },
        // Compact knobs for DetailPanel — key params from each section
        { key: 'compThreshold', label: 'COMP', type: 'knob', min: -40, max: 0, step: 1, display: db },
        { key: 'compRatio', label: 'RATIO', type: 'knob', min: 1, max: 20, step: 0.5, display: ratio },
        { key: 'compMakeup', label: 'MAKEUP', type: 'knob', min: 0, max: 24, step: 0.5, display: db },
        { key: 'enhAir', label: 'AIR', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'enhWarmth', label: 'WARMTH', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'enhPresence', label: 'PRESENCE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'eqLowGain', label: 'EQ LOW', type: 'knob', min: -12, max: 12, step: 0.5, display: db },
        { key: 'eqMidGain', label: 'EQ MID', type: 'knob', min: -12, max: 12, step: 0.5, display: db },
        { key: 'eqHighGain', label: 'EQ HIGH', type: 'knob', min: -12, max: 12, step: 0.5, display: db },
        { key: 'spaceMix', label: 'SPACE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'spaceSize', label: 'SIZE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'gainLevel', label: 'GAIN', type: 'knob', min: 0, max: 2, step: 0.01, display: (v) => `${(20 * Math.log10(Math.max(0.001, v))).toFixed(1)}dB` },
    ],

    Vocoder: [
        { key: 'bands', label: 'BANDS', type: 'select', options: ['8', '16', '32'] },
        { key: 'carrierFreq', label: 'CARRIER', type: 'knob', min: 40, max: 440, step: 1, unit: 'Hz', display: hz },
        { key: 'carrierType', label: 'WAVE', type: 'select', options: ['sawtooth', 'square', 'triangle'] },
        { key: 'release', label: 'RELEASE', type: 'knob', min: 0.005, max: 0.2, step: 0.001, display: ms },
        { key: 'qFactor', label: 'Q', type: 'knob', min: 1, max: 30, step: 0.5, display: plain },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    // ──────────────────────────────── DISTORTION (NEW) ─────────────────────────
    SoftClipper: [
        { key: 'drive', label: 'DRIVE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'knee', label: 'KNEE', type: 'knob', min: 0.5, max: 10, step: 0.1, display: plain },
        { key: 'ceiling', label: 'CEILING', type: 'knob', min: -12, max: 0, step: 0.1, unit: 'dB', display: db },
        { key: 'toneFreq', label: 'TONE', type: 'knob', min: 1000, max: 20000, step: 100, unit: 'Hz', display: hz },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    // ──────────────────────────────── MODULATION ───────────────────────────────
    Tremolo: [
        { key: 'rate', label: 'RATE', type: 'knob', min: 0.1, max: 20, step: 0.1, display: (v) => `${v.toFixed(1)}Hz` },
        { key: 'depth', label: 'DEPTH', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'shape', label: 'SHAPE', type: 'select', options: ['sine', 'triangle', 'square', 'sawtooth'] },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    RingModulator: [
        { key: 'carrierFreq', label: 'FREQ', type: 'knob', min: 10, max: 5000, step: 1, unit: 'Hz', display: hz },
        { key: 'carrierType', label: 'WAVE', type: 'select', options: ['sine', 'square', 'triangle', 'sawtooth'] },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Flanger: [
        { key: 'rate', label: 'RATE', type: 'knob', min: 0.05, max: 5, step: 0.05, display: (v) => `${v.toFixed(2)}Hz` },
        { key: 'depth', label: 'DEPTH', type: 'knob', min: 0.0001, max: 0.005, step: 0.0001, display: ms },
        { key: 'delayTime', label: 'DELAY', type: 'knob', min: 0.001, max: 0.01, step: 0.0001, display: ms },
        { key: 'feedback', label: 'FEEDBACK', type: 'knob', min: 0, max: 0.95, step: 0.01, display: pct },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    FrequencyShifter: [
        { key: 'shift', label: 'SHIFT', type: 'knob', min: 0, max: 2000, step: 1, display: (v) => `${Math.round(v)}Hz` },
        { key: 'direction', label: 'DIR', type: 'select', options: ['up', 'down'] },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    // ──────────────────────────────── LO-FI & CHARACTER ────────────────────────
    BitCrusher: [
        { key: 'bitDepth', label: 'BITS', type: 'knob', min: 1, max: 16, step: 1, display: (v) => `${Math.round(v)} bit` },
        { key: 'sampleRate', label: 'RATE', type: 'knob', min: 0.01, max: 1, step: 0.01, display: pct },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Tape: [
        { key: 'drive', label: 'DRIVE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'warmth', label: 'WARMTH', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'flutter', label: 'FLUTTER', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'flutterRate', label: 'FLTR RATE', type: 'knob', min: 1, max: 10, step: 0.1, display: (v) => `${v.toFixed(1)}Hz` },
        { key: 'hiss', label: 'HISS', type: 'knob', min: 0, max: 0.3, step: 0.01, display: pct },
        { key: 'rolloff', label: 'ROLLOFF', type: 'knob', min: 2000, max: 16000, step: 100, unit: 'Hz', display: hz },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Vinyl: [
        { key: 'crackle', label: 'CRACKLE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'rumble', label: 'RUMBLE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'wobble', label: 'WOBBLE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'wobbleRate', label: 'WOB RATE', type: 'knob', min: 0.1, max: 3, step: 0.1, display: (v) => `${v.toFixed(1)}Hz` },
        { key: 'rolloff', label: 'ROLLOFF', type: 'knob', min: 4000, max: 18000, step: 100, unit: 'Hz', display: hz },
        { key: 'warmth', label: 'WARMTH', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    Cabinet: [
        { key: 'cabinet', label: 'CABINET', type: 'select', options: ['1x12', '2x12', '4x12', 'combo', 'open-back', 'closed-back'] },
        { key: 'character', label: 'CHAR', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'resonance', label: 'RESO', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'size', label: 'SIZE', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    // ──────────────────────────────── DYNAMICS (NEW) ───────────────────────────
    TransientShaper: [
        { key: 'attack', label: 'ATTACK', type: 'knob', min: -1, max: 1, step: 0.01, display: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
        { key: 'sustain', label: 'SUSTAIN', type: 'knob', min: -1, max: 1, step: 0.01, display: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
        { key: 'outputGain', label: 'OUTPUT', type: 'knob', min: -12, max: 12, step: 0.5, unit: 'dB', display: db },
    ],

    DeEsser: [
        { key: 'frequency', label: 'FREQ', type: 'knob', min: 2000, max: 12000, step: 50, unit: 'Hz', display: hz },
        { key: 'threshold', label: 'THRESHOLD', type: 'knob', min: -40, max: 0, step: 1, unit: 'dB', display: db },
        { key: 'ratio', label: 'RATIO', type: 'knob', min: 1, max: 10, step: 0.1, display: ratio },
        { key: 'range', label: 'RANGE', type: 'knob', min: -24, max: 0, step: 1, unit: 'dB', display: db },
        { key: 'listen', label: 'LISTEN', type: 'toggle' },
    ],

    MultibandCompressor: [
        { key: 'crossLow', label: 'X-LOW', type: 'knob', min: 60, max: 500, step: 5, unit: 'Hz', display: hz },
        { key: 'crossHigh', label: 'X-HIGH', type: 'knob', min: 1000, max: 10000, step: 50, unit: 'Hz', display: hz },
        { key: 'lowThreshold', label: 'LOW THR', type: 'knob', min: -40, max: 0, step: 1, unit: 'dB', display: db },
        { key: 'lowRatio', label: 'LOW RAT', type: 'knob', min: 1, max: 10, step: 0.1, display: ratio },
        { key: 'lowGain', label: 'LOW GAIN', type: 'knob', min: -12, max: 12, step: 0.5, unit: 'dB', display: db },
        { key: 'midThreshold', label: 'MID THR', type: 'knob', min: -40, max: 0, step: 1, unit: 'dB', display: db },
        { key: 'midRatio', label: 'MID RAT', type: 'knob', min: 1, max: 10, step: 0.1, display: ratio },
        { key: 'midGain', label: 'MID GAIN', type: 'knob', min: -12, max: 12, step: 0.5, unit: 'dB', display: db },
        { key: 'highThreshold', label: 'HI THR', type: 'knob', min: -40, max: 0, step: 1, unit: 'dB', display: db },
        { key: 'highRatio', label: 'HI RAT', type: 'knob', min: 1, max: 10, step: 0.1, display: ratio },
        { key: 'highGain', label: 'HI GAIN', type: 'knob', min: -12, max: 12, step: 0.5, unit: 'dB', display: db },
        { key: 'attack', label: 'ATTACK', type: 'knob', min: 0.001, max: 0.1, step: 0.001, display: ms },
        { key: 'release', label: 'RELEASE', type: 'knob', min: 0.01, max: 1.0, step: 0.01, display: ms },
    ],

    // ──────────────────────────────── TIME & SPACE (NEW) ───────────────────────
    HalfTime: [
        { key: 'amount', label: 'AMOUNT', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'smoothing', label: 'SMOOTH', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'lowCut', label: 'LOW CUT', type: 'knob', min: 20, max: 2000, step: 10, unit: 'Hz', display: hz },
        { key: 'highCut', label: 'HIGH CUT', type: 'knob', min: 1000, max: 20000, step: 100, unit: 'Hz', display: hz },
        { key: 'mix', label: 'MIX', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
    ],

    // ──────────────────────────────── MASTERING ────────────────────────────────
    MasteringRack: [
        { key: 'eqHPFreq', label: 'HP FREQ', type: 'knob', min: 20, max: 300, step: 1, unit: 'Hz', display: hz },
        { key: 'eqLowGain', label: 'LOW', type: 'knob', min: -8, max: 8, step: 0.5, unit: 'dB', display: db },
        { key: 'eqMidGain', label: 'MID', type: 'knob', min: -8, max: 8, step: 0.5, unit: 'dB', display: db },
        { key: 'eqMidFreq', label: 'MID FRQ', type: 'knob', min: 200, max: 8000, step: 10, unit: 'Hz', display: hz },
        { key: 'eqHighGain', label: 'HIGH', type: 'knob', min: -8, max: 8, step: 0.5, unit: 'dB', display: db },
        { key: 'eqBypass', label: 'EQ BYP', type: 'toggle' },
        { key: 'compThreshold', label: 'COMP THR', type: 'knob', min: -40, max: 0, step: 1, unit: 'dB', display: db },
        { key: 'compRatio', label: 'COMP RAT', type: 'knob', min: 1, max: 10, step: 0.1, display: ratio },
        { key: 'compAttack', label: 'COMP ATK', type: 'knob', min: 0.001, max: 0.3, step: 0.001, display: ms },
        { key: 'compRelease', label: 'COMP REL', type: 'knob', min: 0.01, max: 1.0, step: 0.01, display: ms },
        { key: 'compMakeup', label: 'COMP MKP', type: 'knob', min: -6, max: 18, step: 0.5, unit: 'dB', display: db },
        { key: 'compBypass', label: 'CMP BYP', type: 'toggle' },
        { key: 'widthAmount', label: 'WIDTH', type: 'knob', min: 0, max: 1, step: 0.01, display: pct },
        { key: 'widthBypass', label: 'WID BYP', type: 'toggle' },
        { key: 'limCeiling', label: 'CEILING', type: 'knob', min: -6, max: 0, step: 0.1, unit: 'dB', display: db },
        { key: 'limRelease', label: 'LIM REL', type: 'knob', min: 0.01, max: 0.5, step: 0.01, display: ms },
        { key: 'limBypass', label: 'LIM BYP', type: 'toggle' },
        { key: 'outputGain', label: 'OUTPUT', type: 'knob', min: -12, max: 12, step: 0.5, unit: 'dB', display: db },
    ],
};

/**
 * Effect display name overrides for UI labels.
 */
export const EFFECT_DISPLAY_NAMES = {
    Compressor: 'Compressor',
    GlueCompressor: 'Glue Compressor',
    Limiter: 'Limiter',
    Gate: 'Gate',
    SidechainCompressor: 'Sidechain',
    TransientShaper: 'Transient Shaper',
    DeEsser: 'De-Esser',
    MultibandCompressor: 'Multiband Comp',
    EQEight: 'EQ Eight',
    Saturation: 'Saturation',
    Distortion: 'Distortion',
    SoftClipper: 'Soft Clipper',
    Reverb: 'Reverb',
    Delay: 'Delay',
    Echo: 'Echo',
    Chorus: 'Chorus',
    Phaser: 'Phaser',
    HalfTime: 'Half-Time',
    Flanger: 'Flanger',
    Tremolo: 'Tremolo',
    RingModulator: 'Ring Modulator',
    FrequencyShifter: 'Freq Shifter',
    BitCrusher: 'Bit Crusher',
    Tape: 'Tape',
    Vinyl: 'Vinyl',
    Cabinet: 'Cabinet',
    StereoWidener: 'Stereo Widener',
    Utility: 'Utility',
    Tuner: 'Tuner',
    LoomSauce: 'Loom Sauce',
    Vocoder: 'Vocoder',
    AutoPan: 'Auto Pan',
    MasteringRack: 'Mastering Rack',
};

/**
 * Category icon mapping for effect browser.
 */
export const CATEGORY_ICONS = {
    'Dynamics': '⚡',
    'EQ & Filter': '〰️',
    'Distortion': '🔥',
    'Time & Space': '🌊',
    'Modulation': '🔄',
    'Lo-Fi & Character': '📼',
    'Stereo & Utility': '↔️',
    'Analysis': '📊',
    'Vocal': '🎤',
    'Mastering': '🏆',
};
