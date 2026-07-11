// humanize.test.js — TASK-A09..A11 golden tests
// Seeded round-robin reproducibility, velocity→timbre, DC/declick guards,
// and the room/plate reverb IRs.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import DrumVoice from './DrumVoice.js';
import { kickConfig } from './recipes/kick.js';
import { snareConfig } from './recipes/snare.js';
import { powerSpectrum, bandEnergy, spectralCentroid } from './spectrum.js';
import { DrumSynthEngine, getDefaults } from '../DrumSynthEngine.js';

const SR = 44100;

async function render(cfg, { velocity = 1, seed = null, duration = 1.0 } = {}) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duration), SR);
    new DrumVoice(ctx, cfg).trigger(ctx.destination, 0, { velocity, seed });
    const buf = await ctx.startRendering();
    return new Float32Array(buf.getChannelData(0)); // copy out of native memory
}

function maxDiff(a, b) {
    let m = 0;
    for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
    return m;
}

describe('Seeded round-robin (TASK-A10)', () => {
    it('same-seed renders are bit-identical (noise click + jitter)', async () => {
        const cfg = () => kickConfig(getDefaults('kick')); // noise transient
        const a = await render(cfg(), { seed: 42 });
        const b = await render(cfg(), { seed: 42 });
        expect(maxDiff(a, b)).toBe(0);
    });

    it('same-seed snare renders are bit-identical (multi noise layers)', async () => {
        const a = await render(snareConfig(getDefaults('snare')), { seed: 7 });
        const b = await render(snareConfig(getDefaults('snare')), { seed: 7 });
        expect(maxDiff(a, b)).toBe(0);
    });

    it('different-seed renders differ', async () => {
        const a = await render(kickConfig(getDefaults('kick')), { seed: 1 });
        const b = await render(kickConfig(getDefaults('kick')), { seed: 2 });
        expect(maxDiff(a, b)).toBeGreaterThan(0.005);
    });
});

describe('Velocity → timbre (TASK-A10)', () => {
    it('low velocity is quieter, darker, and shorter', async () => {
        const cfg = () => kickConfig({ ...getDefaults('kick'), clickType: 1 });
        const hard = await render(cfg(), { velocity: 1 });
        const soft = await render(cfg(), { velocity: 0.4 });
        // quieter
        let peakHard = 0, peakSoft = 0;
        for (let i = 0; i < hard.length; i++) {
            peakHard = Math.max(peakHard, Math.abs(hard[i]));
            peakSoft = Math.max(peakSoft, Math.abs(soft[i]));
        }
        expect(peakSoft).toBeLessThan(peakHard * 0.6);
        // darker (click fades faster + filters close)
        const centroid = (d) => {
            const { power, binHz } = powerSpectrum(d, SR);
            return spectralCentroid(power, binHz);
        };
        expect(centroid(soft)).toBeLessThan(centroid(hard));
        // shorter decay: the soft hit falls under an absolute floor earlier
        const lastAbove = (d, level) => {
            for (let i = d.length - 1; i >= 0; i--) {
                if (Math.abs(d[i]) > level) return i;
            }
            return 0;
        };
        expect(lastAbove(soft, 0.005)).toBeLessThan(lastAbove(hard, 0.005));
    });
});

describe('DC / declick guards (TASK-A11)', () => {
    it('no DC offset: post-decay silence is truly silent', async () => {
        const data = await render(
            kickConfig({ ...getDefaults('kick'), decay: 0.3, subAmount: 0.4 }),
            { duration: 1.2 });
        // 5 ms window well after the decay + fade guard + stop
        const at = Math.floor(SR * 1.0);
        let meanAbs = 0;
        const n = Math.floor(SR * 0.005);
        for (let i = at; i < at + n; i++) meanAbs += Math.abs(data[i]);
        meanAbs /= n;
        expect(meanAbs).toBeLessThan(1e-4);
    });

    it('signed mean over the hit is near zero (20 Hz DC blocker)', async () => {
        const data = await render(kickConfig(getDefaults('kick')));
        let mean = 0;
        for (let i = 0; i < data.length; i++) mean += data[i];
        mean /= data.length;
        expect(Math.abs(mean)).toBeLessThan(1e-3);
    });
});

describe('Reverb IRs (TASK-A09)', () => {
    function engineOn(ctx) {
        const engine = Object.create(DrumSynthEngine.prototype);
        engine.ctx = ctx;
        return engine;
    }

    it('room IR: 0.25–0.5 s, early reflections in first 25 ms, 200 Hz highpassed', () => {
        const ctx = new OfflineAudioContext(2, SR, SR);
        const ir = engineOn(ctx).createReverbIR('room');
        const dur = ir.length / ir.sampleRate;
        expect(dur).toBeGreaterThanOrEqual(0.25);
        expect(dur).toBeLessThanOrEqual(0.5);
        const data = ir.getChannelData(0);
        // early reflections: strong content inside the first 25 ms
        let earlyPeak = 0, latePeak = 0;
        for (let i = 0; i < data.length; i++) {
            const a = Math.abs(data[i]);
            if (i < SR * 0.025) earlyPeak = Math.max(earlyPeak, a);
            else latePeak = Math.max(latePeak, a);
        }
        expect(earlyPeak).toBeGreaterThan(latePeak);
        // highpassed: little energy below 150 Hz
        const { power, binHz } = powerSpectrum(data, SR);
        expect(bandEnergy(power, binHz, 0, 150)).toBeLessThan(bandEnergy(power, binHz, 150, SR / 2) * 0.05);
    });

    it('plate IR: 0.6–1.2 s, 400 Hz highpassed (brighter)', () => {
        const ctx = new OfflineAudioContext(2, SR * 2, SR);
        const ir = engineOn(ctx).createReverbIR('plate');
        const dur = ir.length / ir.sampleRate;
        expect(dur).toBeGreaterThanOrEqual(0.6);
        expect(dur).toBeLessThanOrEqual(1.2);
        const data = ir.getChannelData(0);
        const { power, binHz } = powerSpectrum(data, SR);
        expect(bandEnergy(power, binHz, 0, 300)).toBeLessThan(bandEnergy(power, binHz, 300, SR / 2) * 0.05);
    });

    it('createReverb caches per kind and exposes input/output', () => {
        const ctx = new OfflineAudioContext(2, SR, SR);
        const engine = engineOn(ctx);
        const r1 = engine.createReverb(0.1, 'room');
        expect(r1.input).toBeTruthy();
        expect(r1.output).toBeTruthy();
        const roomIR = engine._reverbIRs.room;
        engine.createReverb(0.1, 'room');
        expect(engine._reverbIRs.room).toBe(roomIR); // cached
        engine.createReverb(0.1, 'plate');
        expect(engine._reverbIRs.plate).toBeTruthy();
    });
});
