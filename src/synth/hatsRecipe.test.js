// hatsRecipe.test.js — TASK-A05 Hats v2 golden tests
// Spectral centroid > 6 kHz, sub-2 kHz energy ≥ 30 dB down, choke works.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import DrumVoice from './DrumVoice.js';
import { hatsConfig, TR808_RATIOS } from './recipes/hats.js';
import { powerSpectrum, bandEnergy, spectralCentroid } from './spectrum.js';
import { DrumSynthEngine, PRESETS, getDefaults } from '../DrumSynthEngine.js';

const SR = 44100;

async function render(cfg, duration = 1.0, play) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duration), SR);
    if (play) {
        play(ctx);
    } else {
        new DrumVoice(ctx, cfg).trigger(ctx.destination, 0);
    }
    const buf = await ctx.startRendering();
    return new Float32Array(buf.getChannelData(0)); // copy out of native memory
}

function windowEnergy(data, fromS, toS) {
    const a = Math.floor(SR * fromS), b = Math.min(data.length, Math.floor(SR * toS));
    let e = 0;
    for (let i = a; i < b; i++) e += data[i] * data[i];
    return e;
}

const hatTypes = [
    ['closedHat', { open: false }],
    ['openHat', { open: true }],
];

describe('Hats v2 golden tests', () => {
    it('uses the six classic TR-808 bank frequencies', () => {
        expect(TR808_RATIOS).toHaveLength(6);
        expect(TR808_RATIOS).toContain(205.3);
        expect(TR808_RATIOS).toContain(800);
    });

    for (const [type, opts] of hatTypes) {
        for (const preset of PRESETS[type]) {
            describe(`${preset.name}`, () => {
                const p = () => ({ ...getDefaults(type), ...preset.params });

                it('no NaN, audible, no clipping', async () => {
                    const data = await render(hatsConfig(p(), opts));
                    let peak = 0;
                    for (let i = 0; i < data.length; i++) {
                        expect(Number.isNaN(data[i])).toBe(false);
                        peak = Math.max(peak, Math.abs(data[i]));
                    }
                    expect(peak).toBeGreaterThan(0.02);
                    expect(peak).toBeLessThan(1.0);
                });

                it('spectral centroid > 6 kHz', async () => {
                    const data = await render(hatsConfig(p(), opts));
                    const { power, binHz } = powerSpectrum(data, SR);
                    expect(spectralCentroid(power, binHz)).toBeGreaterThan(6000);
                });

                it('energy below 2 kHz at least 30 dB down', async () => {
                    const data = await render(hatsConfig(p(), opts));
                    const { power, binHz } = powerSpectrum(data, SR);
                    const low = bandEnergy(power, binHz, 0, 2000);
                    const high = bandEnergy(power, binHz, 2000, SR / 2);
                    expect(low).toBeLessThan(high * 0.001); // −30 dB power
                });
            });
        }
    }

    it('metallic 0 is pure noise (bank disabled), metallic 1 is pure bank', () => {
        const noiseOnly = hatsConfig({ ...getDefaults('closedHat'), metallic: 0 });
        expect(noiseOnly.layers.bank.enabled).toBe(false);
        expect(noiseOnly.layers.noise.enabled).toBe(true);
        const bankOnly = hatsConfig({ ...getDefaults('closedHat'), metallic: 1 });
        expect(bankOnly.layers.bank.enabled).toBe(true);
        expect(bankOnly.layers.noise.enabled).toBe(false);
    });

    it('choke: closed hat silences a sounding open hat (engine trigger path)', async () => {
        const p = { ...getDefaults('openHat'), ...PRESETS.openHat[0].params };
        const pc = { ...getDefaults('closedHat'), ...PRESETS.closedHat[0].params };
        const play = (choke) => (ctx) => {
            // engine instance without the window-bound constructor
            const engine = Object.create(DrumSynthEngine.prototype);
            engine.ctx = ctx;
            engine.synthesize('openHat', ctx.destination, 0, p);
            if (choke) engine.synthesize('closedHat', ctx.destination, 0.12, pc);
        };
        const withChoke = await render(null, 1.0, play(true));
        const without = await render(null, 1.0, play(false));
        // after the closed hat's own sound dies (~60 ms), the open tail must be gone
        const tailChoked = windowEnergy(withChoke, 0.25, 0.45);
        const tailFree = windowEnergy(without, 0.25, 0.45);
        expect(tailFree).toBeGreaterThan(0);
        expect(tailChoked).toBeLessThan(tailFree * 0.02); // silenced, −17 dB+
    });
});
