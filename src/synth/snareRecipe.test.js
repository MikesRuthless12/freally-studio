// snareRecipe.test.js — TASK-A04 Snare v2 golden tests
// Two spectral peaks (body + snap), rattle tail present, no clipping.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import DrumVoice from './DrumVoice.js';
import { snareConfig } from './recipes/snare.js';
import { powerSpectrum, bandEnergy } from './spectrum.js';
import { PRESETS, getDefaults } from '../DrumSynthEngine.js';

const SR = 44100;

async function render(cfg, { velocity = 1, duration = 1.0 } = {}) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duration), SR);
    new DrumVoice(ctx, cfg).trigger(ctx.destination, 0, { velocity });
    const buf = await ctx.startRendering();
    return new Float32Array(buf.getChannelData(0)); // copy out of native memory
}

function peakOf(data) {
    let p = 0;
    for (let i = 0; i < data.length; i++) p = Math.max(p, Math.abs(data[i]));
    return p;
}

function windowEnergy(data, fromS, toS) {
    const a = Math.floor(SR * fromS), b = Math.min(data.length, Math.floor(SR * toS));
    let e = 0;
    for (let i = a; i < b; i++) e += data[i] * data[i];
    return e;
}

const params = (preset, type) => ({ ...getDefaults(type), ...preset.params });

describe('Snare v2 golden tests', () => {
    for (const preset of PRESETS.snare) {
        describe(preset.name, () => {
            it('no clipping, no NaN, audible', async () => {
                const data = await render(snareConfig(params(preset, 'snare')));
                for (let i = 0; i < data.length; i++) expect(Number.isNaN(data[i])).toBe(false);
                const peak = peakOf(data);
                expect(peak).toBeGreaterThan(0.1);
                expect(peak).toBeLessThan(1.0);
            });

            it('two spectral peaks: body region and snap region beat the valley', async () => {
                const p = params(preset, 'snare');
                // measure the dual-peak structure without the rattle layer —
                // the wires legitimately shade the valley on the full render
                const cfg = snareConfig(p);
                cfg.layers.rattle.enabled = false;
                const data = await render(cfg);
                const { power, binHz } = powerSpectrum(data, SR);
                // body peak: fundamental band beats the equal-width band above it
                const body = bandEnergy(power, binHz, p.pitch * 0.6, p.pitch * 1.6);
                const aboveBody = bandEnergy(power, binHz, p.pitch * 1.8, p.pitch * 2.8);
                expect(body).toBeGreaterThan(aboveBody);
                // snap peak: 2–5 kHz beats the band above and (scaled) below it.
                // 909 mode spreads its swept noise wider than the classic
                // bandpass, so its below-band margin is proportionally lower.
                const snap = bandEnergy(power, binHz, 2000, 5000);
                const belowFactor = (p.mode909 ?? 0) >= 0.5 ? 1.5 : 3;
                expect(snap).toBeGreaterThan(bandEnergy(power, binHz, 5500, 8500));
                expect(snap).toBeGreaterThan(belowFactor * bandEnergy(power, binHz, 900, 1900));
            });
        });
    }

    it('rattle tail is present (energy after the snap dies)', async () => {
        const p = getDefaults('snare');
        const full = await render(snareConfig(p));
        const noRattle = snareConfig(p);
        noRattle.layers.rattle.enabled = false;
        const bare = await render(noRattle);
        // 200–320 ms window: body (200 ms) and snap (~180 ms) are done; wires ring
        const tailFull = windowEnergy(full, 0.2, 0.32);
        const tailBare = windowEnergy(bare, 0.2, 0.32);
        expect(tailFull).toBeGreaterThan(tailBare * 2);
    });

    it('909 mode changes the noise character', async () => {
        const p = getDefaults('snare');
        const classic = await render(snareConfig({ ...p, mode909: 0 }));
        const nine09 = await render(snareConfig({ ...p, mode909: 1 }));
        let diff = 0;
        for (let i = 0; i < classic.length; i++) diff = Math.max(diff, Math.abs(classic[i] - nine09[i]));
        expect(diff).toBeGreaterThan(0.05);
        expect(peakOf(nine09)).toBeLessThan(1.0);
    });

    describe('ghost snares (same recipe, velocity 0.55)', () => {
        for (const preset of PRESETS.ghostSnare) {
            it(`${preset.name}: quiet but audible, no clipping`, async () => {
                const data = await render(
                    snareConfig(params(preset, 'ghostSnare')), { velocity: 0.55 });
                for (let i = 0; i < data.length; i++) expect(Number.isNaN(data[i])).toBe(false);
                const peak = peakOf(data);
                expect(peak).toBeGreaterThan(0.02);
                expect(peak).toBeLessThan(0.6); // ghosts stay soft
            });
        }
    });
});
