// recipe808.test.js — TASK-A03 808 v2 golden tests
// Glide continuity, sub-band dominance, saturation harmonics, one-shot aliases.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import { Melodic808Engine, oneShot808, noteToHz } from './recipes/808.js';
import { powerSpectrum, bandEnergy } from './spectrum.js';
import { PRESETS, getDefaults } from '../DrumSynthEngine.js';

const SR = 44100;

const copy = (buf) => new Float32Array(buf.getChannelData(0));

async function renderMelodic(params, play, duration = 2.0) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duration), SR);
    const engine = new Melodic808Engine(ctx, params).connect(ctx.destination);
    play(engine);
    return copy(await ctx.startRendering());
}

async function renderOneShot(p, duration = 3.0) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duration), SR);
    oneShot808(ctx, ctx.destination, 0, p);
    return copy(await ctx.startRendering());
}

function maxDelta(data, fromS, toS) {
    const a = Math.max(1, Math.floor(SR * fromS));
    const b = Math.min(data.length, Math.floor(SR * toS));
    let m = 0;
    for (let i = a; i < b; i++) m = Math.max(m, Math.abs(data[i] - data[i - 1]));
    return m;
}

function zeroCrossings(data, fromS, toS) {
    const a = Math.floor(SR * fromS), b = Math.floor(SR * toS);
    let n = 0;
    for (let i = a + 1; i < b; i++) {
        if ((data[i - 1] < 0) !== (data[i] < 0)) n++;
    }
    return n;
}

const defaults808 = () => getDefaults('808');

describe('noteToHz', () => {
    it('maps A4=69 → 440 and octaves', () => {
        expect(noteToHz(69)).toBeCloseTo(440, 6);
        expect(noteToHz(57)).toBeCloseTo(220, 6);
        expect(noteToHz(33)).toBeCloseTo(55, 6); // A1 — 808 territory
    });
});

describe('Melodic808Engine — glide', () => {
    it('slide is legato: no adjacent-sample discontinuity > 0.5 at the glide', async () => {
        const data = await renderMelodic(defaults808(), (e) => {
            e.noteOn(33, 0);      // A1 55 Hz
            e.noteOn(40, 0.5);    // E2 82.4 Hz — starts while A1 still sounds
        });
        // window around the slide start and the whole glide
        expect(maxDelta(data, 0.49, 0.65)).toBeLessThan(0.5);
    });

    it('glide actually reaches the new pitch', async () => {
        const data = await renderMelodic(defaults808(), (e) => {
            e.noteOn(33, 0);
            e.noteOn(45, 0.5);    // A2 110 Hz — one octave up
        });
        const before = zeroCrossings(data, 0.3, 0.45);
        const after = zeroCrossings(data, 0.8, 0.95);
        expect(after).toBeGreaterThan(before * 1.6); // ≈2× for an octave
        expect(after).toBeLessThan(before * 2.4);
    });

    it('fresh note after silence restarts cleanly (no NaN, has attack)', async () => {
        const data = await renderMelodic({ ...defaults808(), decay: 0.3 }, (e) => {
            e.noteOn(33, 0);
            e.noteOff(0.2);
            e.noteOn(36, 0.6);
        });
        for (let i = 0; i < data.length; i++) expect(Number.isNaN(data[i])).toBe(false);
        let tail = 0;
        for (let i = Math.floor(SR * 0.6); i < Math.floor(SR * 0.8); i++) {
            tail = Math.max(tail, Math.abs(data[i]));
        }
        expect(tail).toBeGreaterThan(0.05); // second note sounds
    });
});

describe('808 v2 — spectral targets', () => {
    it('sub energy dominates', async () => {
        const data = await renderMelodic(defaults808(), (e) => e.noteOn(31, 0)); // G1 49 Hz
        const { power, binHz } = powerSpectrum(data, SR);
        const sub = bandEnergy(power, binHz, 20, 100);
        expect(sub).toBeGreaterThan(bandEnergy(power, binHz, 100, 1000));
        expect(sub).toBeGreaterThan(bandEnergy(power, binHz, 1000, 12000));
    });

    it('2nd/3rd harmonics above −40 dB relative (saturation audible)', async () => {
        const data = await renderMelodic(defaults808(), (e) => e.noteOn(33, 0)); // 55 Hz
        const { power, binHz } = powerSpectrum(data, SR);
        const harmonicPower = (f) => bandEnergy(power, binHz, f - 6, f + 6);
        const p1 = harmonicPower(55);
        const p2 = harmonicPower(110);
        const p3 = harmonicPower(165);
        expect(p1).toBeGreaterThan(0);
        // −40 dB amplitude = 1e-4 power ratio
        expect(p2 / p1).toBeGreaterThan(1e-4);
        expect(p3 / p1).toBeGreaterThan(1e-4);
    });

    it('output has no sub-25 Hz rumble build-up (highpass guard)', async () => {
        const data = await renderMelodic(defaults808(), (e) => e.noteOn(33, 0));
        const { power, binHz } = powerSpectrum(data, SR);
        const dc = bandEnergy(power, binHz, 0, 15);
        const fundamental = bandEnergy(power, binHz, 45, 65);
        expect(dc).toBeLessThan(fundamental * 0.05);
    });
});

describe('808 v2 — one-shot pad path (legacy aliases)', () => {
    for (const preset of PRESETS['808']) {
        it(`${preset.name} renders: non-silent, no NaN, no clipping`, async () => {
            const p = { ...defaults808(), ...preset.params };
            const data = await renderOneShot(p);
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
                expect(Number.isNaN(data[i])).toBe(false);
                peak = Math.max(peak, Math.abs(data[i]));
            }
            expect(peak).toBeGreaterThan(0.1);
            expect(peak).toBeLessThan(1.0);
        });
    }

    it('sustain and decay aliases shape the envelope', async () => {
        const p = defaults808();
        const long = await renderOneShot({ ...p, decay: 3.0 });
        const short = await renderOneShot({ ...p, decay: 0.5 });
        const at = Math.floor(SR * 1.0);
        let eLong = 0, eShort = 0;
        for (let i = at; i < at + 4410; i++) {
            eLong += long[i] * long[i];
            eShort += short[i] * short[i];
        }
        expect(eShort).toBeLessThan(eLong);
    });
});
