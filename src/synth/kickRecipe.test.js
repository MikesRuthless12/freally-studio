// kickRecipe.test.js — TASK-A02 Kick v2 golden tests
// Offline-renders every factory kick preset and asserts the recipe targets:
// 40–100 Hz dominance, an audible transient in the first 10 ms, no clipping.
//
// Transient detection is time-domain (max sample-to-sample delta): a click
// means large deltas up front. FFTs of 10 ms windows can't resolve this —
// rectangular-window leakage from the 40–60 Hz body swamps the HF band.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import DrumVoice from './DrumVoice.js';
import { kickConfig } from './recipes/kick.js';
import { powerSpectrum, bandEnergy } from './spectrum.js';
import { PRESETS, getDefaults } from '../DrumSynthEngine.js';

const SR = 44100;

async function render(cfg, duration = 1.5) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duration), SR);
    new DrumVoice(ctx, cfg).trigger(ctx.destination, 0);
    const buf = await ctx.startRendering();
    // Copy out of native memory — getChannelData returns a view that dies
    // with the (GC-able) context.
    return new Float32Array(buf.getChannelData(0));
}

const presetParams = (preset) => ({ ...getDefaults('kick'), ...preset.params });

// One render per preset variant, shared across the assertions below.
const cache = new Map();
async function rendered(preset, variant = 'full') {
    const key = `${preset.name}:${variant}`;
    if (!cache.has(key)) {
        const p = presetParams(preset);
        if (variant === 'noClick') {
            cache.set(key, await render(kickConfig({ ...p, click: 0 })));
        } else if (variant === 'clickSolo') {
            cache.set(key, await render({ layers: { transient: kickConfig(p).layers.transient } }, 0.1));
        } else {
            cache.set(key, await render(kickConfig(p)));
        }
    }
    return cache.get(key);
}

function peakOf(data, fromMs = 0, toMs = Infinity) {
    const a = Math.floor(SR * fromMs / 1000);
    const b = Math.min(data.length, Math.floor(SR * toMs / 1000));
    let peak = 0;
    for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(data[i]));
    return peak;
}

// Max sample-to-sample delta in a window — the transient fingerprint.
function maxDelta(data, fromMs, toMs) {
    const a = Math.max(1, Math.floor(SR * fromMs / 1000));
    const b = Math.min(data.length, Math.floor(SR * toMs / 1000));
    let m = 0;
    for (let i = a; i < b; i++) m = Math.max(m, Math.abs(data[i] - data[i - 1]));
    return m;
}

describe('Kick v2 golden tests — every factory preset', () => {
    for (const preset of PRESETS.kick) {
        describe(preset.name, () => {
            it('does not clip and produces no NaN', async () => {
                const data = await rendered(preset);
                for (let i = 0; i < data.length; i++) {
                    expect(Number.isNaN(data[i])).toBe(false);
                }
                const peak = peakOf(data);
                expect(peak).toBeGreaterThan(0.1);
                expect(peak).toBeLessThan(1.0); // no clipping
            });

            it('energy in 40–100 Hz dominates the spectrum', async () => {
                const data = await rendered(preset);
                const { power, binHz } = powerSpectrum(data, SR);
                const low = bandEnergy(power, binHz, 40, 100);
                expect(low).toBeGreaterThan(bandEnergy(power, binHz, 100, 1000));
                expect(low).toBeGreaterThan(bandEnergy(power, binHz, 1000, 12000));
            });

            it('has a transient in the first 10 ms', async () => {
                const data = await rendered(preset);
                // hit reaches most of its level inside 10 ms
                expect(peakOf(data, 0, 10)).toBeGreaterThan(peakOf(data) * 0.3);
                // sharp deltas are front-loaded (observed ≥ 18×, assert 8×)
                const front = maxDelta(data, 0, 10);
                expect(front).toBeGreaterThan(maxDelta(data, 45, 60) * 8);
                // and they come from the click layer (observed ≥ 4×, assert 2.5×)
                const noClick = await rendered(preset, 'noClick');
                expect(front).toBeGreaterThan(maxDelta(noClick, 0, 10) * 2.5);
                // the click layer alone is audible
                expect(peakOf(await rendered(preset, 'clickSolo'))).toBeGreaterThan(0.04);
            });
        });
    }
});

describe('Kick v2 param aliases', () => {
    it('legacy param names still shape the sound', async () => {
        const base = await render(kickConfig(getDefaults('kick')));
        const lowTuned = await render(kickConfig({ ...getDefaults('kick'), pitch: 35 }));
        const shorter = await render(kickConfig({ ...getDefaults('kick'), decay: 0.15 }));
        let diff = 0;
        for (let i = 0; i < base.length; i++) diff = Math.max(diff, Math.abs(base[i] - lowTuned[i]));
        expect(diff).toBeGreaterThan(0.05); // pitch alias works
        const tail = (d) => {
            let e = 0;
            const at = Math.floor(SR * 0.4);
            for (let i = at; i < at + 4410; i++) e += d[i] * d[i];
            return e;
        };
        expect(tail(shorter)).toBeLessThan(tail(base)); // decay alias works
    });

    it('subAmount adds sub-band energy', async () => {
        const p = getDefaults('kick');
        const subE = (d) => {
            const { power, binHz } = powerSpectrum(d, SR);
            return bandEnergy(power, binHz, 30, 90);
        };
        const withSub = subE(await render(kickConfig({ ...p, subAmount: 1 })));
        const noSub = subE(await render(kickConfig({ ...p, subAmount: 0 })));
        expect(withSub).toBeGreaterThan(noSub * 1.2);
    });
});
