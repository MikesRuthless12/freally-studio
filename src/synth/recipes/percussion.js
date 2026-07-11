// recipes/percussion.js — Rimshot + tuned percussion v2 (TASK-A07)
//
// RIMSHOT: two detuned partials (~0.73× and ~1.67× of 'pitch' ≈ 440 Hz +
// 1 kHz at the default 600), 20–50 ms decay, a click transient, and a woody
// 300–600 Hz ping mixed by 'body'. Partials sit in tight bandpasses.
//
// PERCUSSION (toms/congas/shakers): key-tracked pitch-swept sine/triangle
// (legacy 1.5× → 1× sweep) plus a skin-noise layer. Pass `midiNote` to
// key-track the fundamental for melodic/pack rendering (TASK-B01 pitch grid).
//
// Legacy params all work for both types.

import { gainToDb } from '../DrumVoice.js';
import { noteToHz } from './808.js';

export function rimConfig(p) {
    const volume = p.volume ?? 0.7;
    const pitch = p.pitch ?? 600;
    const decay = p.decay ?? 0.04;
    const partial = (ratio, gain) => ({
        enabled: true,
        gain: gainToDb(gain),
        env: { attack: 0, decay },
        filter: { type: 'bandpass', freq: pitch * ratio, Q: (p.filterQ ?? 1.5) + 2 },
        source: { kind: 'osc', type: 'triangle', freq: pitch * ratio },
    });

    return {
        layers: {
            partialLow: partial(0.73, (p.click ?? 0.8) * volume * 0.9),
            partialHigh: partial(1.67, (p.click ?? 0.8) * volume * 0.7),
            click: {
                enabled: (p.click ?? 0.8) > 0.01,
                gain: gainToDb((p.click ?? 0.8) * volume * 0.8),
                env: { attack: 0, decay: 0.002 },
                filter: { type: 'highpass', freq: p.hpFreq ?? 1500, Q: p.filterQ ?? 1.5 },
                source: { kind: 'noise', color: 'white' },
            },
            body: {
                enabled: (p.body ?? 0.4) > 0.01,
                gain: gainToDb((p.body ?? 0.4) * volume * 0.6),
                env: { attack: 0.001, decay: decay * 0.8 },
                source: { kind: 'osc', type: 'sine', freq: 300 + (p.tone ?? 0.7) * 300 },
            },
        },
    };
}

export function percConfig(p, { midiNote = null } = {}) {
    const volume = p.volume ?? 0.65;
    const pitch = midiNote != null ? noteToHz(midiNote) : (p.pitch ?? 300);
    const noiseAmt = p.noiseAmt ?? 0.3;
    const waves = ['sine', 'triangle', 'sawtooth', 'square'];

    return {
        layers: {
            body: {
                enabled: true,
                gain: gainToDb((1 - noiseAmt) * volume),
                env: { attack: 0.001, decay: p.decay ?? 0.15 },
                filter: { type: 'lowpass', freq: p.filterFreq ?? 2000 },
                source: {
                    kind: 'osc',
                    type: waves[Math.round(p.waveform ?? 1) % 4],
                    freq: pitch,
                    pitchEnv: { start: pitch * 1.5, end: pitch, time: p.pitchDecay ?? 0.05 },
                },
            },
            skin: {
                enabled: noiseAmt > 0.05,
                gain: gainToDb(noiseAmt * volume),
                env: { attack: 0, decay: (p.decay ?? 0.15) * 0.8 },
                filter: { type: 'bandpass', freq: p.filterFreq ?? 2000, Q: 1 },
                source: { kind: 'noise', color: 'white' },
            },
        },
    };
}

export default percConfig;
