// FinishingChain.js — per-drum finishing chain (TASK-A08)
//
// Builds, inside any AudioContext (including OfflineAudioContext):
//   EQ (EQEight) → Saturation → transient stage (fast compressor used as a
//   transient shaper) → SoftClipper → Limiter
// plus a post-render normalize-to-target step (normalizeBuffer).
//
// Per-drum default chains ship as CHAIN_PRESETS; presetForDrumType maps the
// 9 drum types onto them. Every offline render path in DrumSynthEngine goes
// through this chain when 'finish' is on.

import { EQEight } from '../effects/EQEight.js';
import { Saturation } from '../effects/Saturation.js';
import { Compressor } from '../effects/Compressor.js';
import { SoftClipper } from '../effects/SoftClipper.js';
import { Limiter } from '../effects/Limiter.js';

// Neutral 8-band template matching EQEight's default layout; presets override
// individual bands (disabled bands render as allpass pass-throughs).
function eqBands(overrides = {}) {
    const bands = [
        { frequency: 30, gain: 0, Q: 0.707, type: 'highpass', enabled: true },
        { frequency: 100, gain: 0, Q: 0.707, type: 'lowshelf', enabled: true },
        { frequency: 250, gain: 0, Q: 1.0, type: 'peaking', enabled: true },
        { frequency: 1000, gain: 0, Q: 1.0, type: 'peaking', enabled: true },
        { frequency: 3000, gain: 0, Q: 1.0, type: 'peaking', enabled: true },
        { frequency: 8000, gain: 0, Q: 1.0, type: 'peaking', enabled: true },
        { frequency: 12000, gain: 0, Q: 0.707, type: 'highshelf', enabled: true },
        { frequency: 18000, gain: 0, Q: 0.707, type: 'lowpass', enabled: true },
    ];
    for (const [idx, band] of Object.entries(overrides)) {
        bands[idx] = { ...bands[idx], ...band };
    }
    return bands;
}

// Stage spec per preset; omitted stages are not built at all.
export const CHAIN_PRESETS = {
    kick: {
        eq: eqBands({
            1: { frequency: 60, gain: 1.5, type: 'peaking', Q: 1.0 },
            2: { frequency: 300, gain: -2, Q: 1.2 },
            4: { frequency: 4000, gain: 2, Q: 1.0 },
        }),
        saturation: { drive: 0.15, mode: 'tube' },
        transient: { threshold: -18, ratio: 4, attack: 0.001, release: 0.06, knee: 6 },
        softClip: { drive: 0.1, knee: 2.0, ceiling: -0.3 },
        limiter: { ceiling: -0.3, release: 0.05 },
    },
    '808': {
        saturation: { drive: 0.2, mode: 'tape' },
        limiter: { ceiling: -0.3, release: 0.08 },
    },
    snare: {
        eq: eqBands({
            2: { frequency: 200, gain: 2, Q: 1.0 },
            5: { frequency: 5000, gain: 3, Q: 1.0 },
        }),
        saturation: { drive: 0.12, mode: 'tube' },
        transient: { threshold: -20, ratio: 3, attack: 0.001, release: 0.05, knee: 6 },
        softClip: { drive: 0.1, knee: 2.0, ceiling: -0.3 },
        limiter: { ceiling: -0.3, release: 0.05 },
    },
    hats: {
        eq: eqBands({
            0: { frequency: 300, type: 'highpass' },
            6: { frequency: 10000, gain: 2 },
        }),
        limiter: { ceiling: -0.3, release: 0.04 },
    },
    clap: {
        transient: { threshold: -22, ratio: 4, attack: 0.002, release: 0.07, knee: 10 }, // glue
        saturation: { drive: 0.18, mode: 'tube' },
        softClip: { drive: 0.1, knee: 2.0, ceiling: -0.3 },
        limiter: { ceiling: -0.3, release: 0.05 },
    },
    clean: {
        softClip: { drive: 0.05, knee: 2.0, ceiling: -0.3 },
        limiter: { ceiling: -0.3, release: 0.05 },
    },
    // lighter default for melodic instruments (TASK-A12): EQ + soft clip
    instrument: {
        eq: eqBands({}),
        softClip: { drive: 0.05, knee: 2.0, ceiling: -0.3 },
    },
};

export function presetForDrumType(type) {
    switch (type) {
        case 'kick': return 'kick';
        case '808': return '808';
        case 'snare':
        case 'ghostSnare': return 'snare';
        case 'closedHat':
        case 'openHat': return 'hats';
        case 'clap': return 'clap';
        default: return 'clean'; // rimShot, percussion
    }
}

export class FinishingChain {
    /**
     * @param {BaseAudioContext} ctx — live or offline
     * @param {string} presetName — key of CHAIN_PRESETS
     * @param {{ bypass?: boolean }} opts
     */
    constructor(ctx, presetName = 'clean', { bypass = false } = {}) {
        const spec = CHAIN_PRESETS[presetName] || CHAIN_PRESETS.clean;
        this.ctx = ctx;
        this.preset = presetName;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.effects = [];

        if (spec.eq) this._add(new EQEight(), { bands: spec.eq });
        if (spec.saturation) this._add(new Saturation(), spec.saturation);
        if (spec.transient) this._add(new Compressor(), spec.transient);
        if (spec.softClip) this._add(new SoftClipper(), spec.softClip);
        if (spec.limiter) this._add(new Limiter(), spec.limiter);

        let head = this.input;
        for (const eff of this.effects) {
            eff.createNodes(ctx);
            // Pin the dry/wet crossfade instead of letting createNodes'
            // setTargetAtTime smoothing settle: on a fresh offline graph the
            // smoothing bleeds the wrong path for ~25 ms (audible dry leak on
            // every render's attack; broken bypass comparisons).
            eff.bypassed = bypass;
            eff._dryGain.gain.cancelScheduledValues(0);
            eff._wetGain.gain.cancelScheduledValues(0);
            eff._dryGain.gain.value = bypass ? 1 : 0;
            eff._wetGain.gain.value = bypass ? 0 : 1;
            head.connect(eff.input);
            head = eff.output;
        }
        head.connect(this.output);
    }

    _add(effect, params) {
        effect.setParams(params);
        this.effects.push(effect);
        return effect;
    }

    dispose() {
        this.effects.forEach(e => e.dispose());
        try { this.input.disconnect(); } catch { /* already disconnected */ }
        try { this.output.disconnect(); } catch { /* already disconnected */ }
    }
}

/**
 * Post-render normalize: scales EVERY channel so the global peak sits at
 * targetDb (default −0.3 dBFS). Returns the applied gain.
 */
export function normalizeBuffer(audioBuffer, targetDb = -0.3) {
    let peak = 0;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    }
    if (peak === 0) return 1;
    const gain = Math.pow(10, targetDb / 20) / peak;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) data[i] *= gain;
    }
    return gain;
}

export default FinishingChain;
