// clapPercRecipe.test.js — TASK-A06/A07 Clap + Rim/Percussion v2 golden tests

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import DrumVoice from './DrumVoice.js';
import { clapConfig } from './recipes/clap.js';
import { rimConfig, percConfig } from './recipes/percussion.js';
import { powerSpectrum, bandEnergy } from './spectrum.js';
import { PRESETS, getDefaults } from '../DrumSynthEngine.js';

const SR = 44100;

async function render(cfg, duration = 1.0) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duration), SR);
    new DrumVoice(ctx, cfg).trigger(ctx.destination, 0);
    const buf = await ctx.startRendering();
    return new Float32Array(buf.getChannelData(0)); // copy out of native memory
}

function peakOf(data) {
    let p = 0;
    for (let i = 0; i < data.length; i++) p = Math.max(p, Math.abs(data[i]));
    return p;
}

function assertClean(data, { min = 0.05, max = 1.0 } = {}) {
    for (let i = 0; i < data.length; i++) expect(Number.isNaN(data[i])).toBe(false);
    const peak = peakOf(data);
    expect(peak).toBeGreaterThan(min);
    expect(peak).toBeLessThan(max);
}

// count envelope onsets: local maxima of the 1 ms-smoothed |x|
function countOnsets(data, minSepS, windowS) {
    const step = Math.floor(SR * 0.001);
    const n = Math.floor(Math.min(windowS * SR, data.length) / step);
    const env = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        for (let j = i * step; j < (i + 1) * step; j++) env[i] = Math.max(env[i], Math.abs(data[j]));
    }
    const maxEnv = Math.max(...env);
    const minSep = Math.max(1, Math.round((minSepS * 1000) * 0.6));
    let count = 0, lastPeak = -minSep;
    for (let i = 1; i < n - 1; i++) {
        if (env[i] >= env[i - 1] && env[i] > env[i + 1] && env[i] > maxEnv * 0.3 && i - lastPeak >= minSep) {
            count++;
            lastPeak = i;
        }
    }
    return count;
}

function zcRate(data, fromS, toS) {
    const a = Math.floor(SR * fromS), b = Math.floor(SR * toS);
    let n = 0;
    for (let i = a + 1; i < b; i++) {
        if ((data[i - 1] < 0) !== (data[i] < 0)) n++;
    }
    return n / (toS - fromS);
}

describe('Clap v2 golden tests', () => {
    for (const preset of PRESETS.clap) {
        it(`${preset.name}: clean render with burst structure`, async () => {
            const p = { ...getDefaults('clap'), ...preset.params };
            const data = await render(clapConfig(p));
            assertClean(data);
            const bursts = Math.round(p.layers);
            const found = countOnsets(data, p.spread, bursts * p.spread + 0.03);
            expect(found).toBeGreaterThanOrEqual(Math.min(2, bursts));
        });
    }

    it('diffusion + saturation post stage shapes the sum', async () => {
        const p = getDefaults('clap');
        const rand = () => 0.5; // fix jitter so only the post stage differs
        const withPost = await render(clapConfig(p, { random: rand }));
        const cfg = clapConfig(p, { random: rand });
        cfg.post = null;
        const withoutPost = await render(cfg);
        let diff = 0;
        for (let i = 0; i < withPost.length; i++) diff = Math.max(diff, Math.abs(withPost[i] - withoutPost[i]));
        expect(diff).toBeGreaterThan(0.02);
    });

    it('energy concentrates around the tone band', async () => {
        const p = getDefaults('clap'); // tone 1200
        const data = await render(clapConfig(p));
        const { power, binHz } = powerSpectrum(data, SR);
        const inBand = bandEnergy(power, binHz, p.tone * 0.5, p.tone * 2);
        const above = bandEnergy(power, binHz, p.tone * 4, p.tone * 8);
        expect(inBand).toBeGreaterThan(above);
    });
});

describe('Rimshot v2 golden tests', () => {
    for (const preset of PRESETS.rimShot) {
        it(`${preset.name}: clean render, two partials present`, async () => {
            const p = { ...getDefaults('rimShot'), ...preset.params };
            const data = await render(rimConfig(p), 0.5);
            assertClean(data, { min: 0.03 });
            const { power, binHz } = powerSpectrum(data, SR);
            const partial = (f) => bandEnergy(power, binHz, f * 0.9, f * 1.12);
            const between = bandEnergy(power, binHz, p.pitch * 0.95, p.pitch * 1.18); // gap between partials
            expect(partial(p.pitch * 0.73)).toBeGreaterThan(between);
            expect(partial(p.pitch * 1.67)).toBeGreaterThan(between);
        });
    }

    it('click transient is front-loaded', async () => {
        const data = await render(rimConfig(getDefaults('rimShot')), 0.3);
        let headPeak = 0, peak = 0;
        for (let i = 0; i < data.length; i++) {
            const a = Math.abs(data[i]);
            if (i < SR * 0.01) headPeak = Math.max(headPeak, a);
            peak = Math.max(peak, a);
        }
        expect(headPeak).toBeGreaterThan(peak * 0.5);
    });
});

describe('Percussion v2 golden tests', () => {
    for (const preset of PRESETS.percussion) {
        it(`${preset.name}: clean render`, async () => {
            const p = { ...getDefaults('percussion'), ...preset.params };
            const data = await render(percConfig(p), 1.2);
            assertClean(data, { min: 0.03 });
        });
    }

    it('pitch sweep falls (early rate > late rate)', async () => {
        const p = { ...getDefaults('percussion'), noiseAmt: 0, decay: 0.4, pitchDecay: 0.1 };
        const data = await render(percConfig(p), 0.6);
        expect(zcRate(data, 0.005, 0.05)).toBeGreaterThan(zcRate(data, 0.25, 0.35));
    });

    it('skin-noise layer adds broadband energy', async () => {
        const p = getDefaults('percussion');
        const withSkin = await render(percConfig({ ...p, noiseAmt: 0.6 }));
        const without = await render(percConfig({ ...p, noiseAmt: 0 }));
        const hf = (d) => {
            const { power, binHz } = powerSpectrum(d, SR);
            return bandEnergy(power, binHz, 3000, 10000);
        };
        expect(hf(withSkin)).toBeGreaterThan(hf(without) * 2);
    });

    it('key-tracking: midiNote sets the fundamental', async () => {
        const p = { ...getDefaults('percussion'), noiseAmt: 0, waveform: 0, pitchDecay: 0.02, decay: 0.5, filterFreq: 4000 };
        const data = await render(percConfig(p, { midiNote: 60 }), 0.6); // C4 ≈ 261.6 Hz
        const rate = zcRate(data, 0.1, 0.4); // past the sweep: pure fundamental
        expect(rate).toBeGreaterThan(261.6 * 2 * 0.9);
        expect(rate).toBeLessThan(261.6 * 2 * 1.1);
    });
});
