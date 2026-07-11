// drumVoice.test.js — TASK-A01 layered voice model
// Renders voices through a real OfflineAudioContext (node-web-audio-api)
// and asserts on the produced samples.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import DrumVoice, { dbToGain, gainToDb, semitoneRatio, LAYER_SLOTS } from './DrumVoice.js';
import { kickConfig } from './recipes/kick.js';
import { PRESETS, getDefaults } from '../DrumSynthEngine.js';

const SR = 44100;

async function renderVoice(config, { duration = 1.0, velocity = 1 } = {}) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duration), SR);
    const voice = new DrumVoice(ctx, config);
    voice.trigger(ctx.destination, 0, { velocity });
    const buf = await ctx.startRendering();
    // Copy out of native memory — getChannelData returns a view that dies
    // with the (GC-able) context.
    return new Float32Array(buf.getChannelData(0));
}

function stats(data) {
    let peak = 0, hasNaN = false;
    for (let i = 0; i < data.length; i++) {
        const s = data[i];
        if (Number.isNaN(s)) hasNaN = true;
        const a = Math.abs(s);
        if (a > peak) peak = a;
    }
    return { peak, hasNaN };
}

describe('DrumVoice — helpers', () => {
    it('dbToGain/gainToDb round-trip', () => {
        expect(dbToGain(0)).toBeCloseTo(1, 10);
        expect(dbToGain(-6)).toBeCloseTo(0.5012, 3);
        expect(dbToGain(gainToDb(0.8))).toBeCloseTo(0.8, 10);
    });

    it('semitoneRatio maps octaves and unison', () => {
        expect(semitoneRatio(0)).toBe(1);
        expect(semitoneRatio(12)).toBeCloseTo(2, 10);
        expect(semitoneRatio(-12)).toBeCloseTo(0.5, 10);
    });

    it('exposes the 4 layer slots', () => {
        expect(LAYER_SLOTS).toEqual(['transient', 'body', 'sub', 'noise']);
    });
});

describe('DrumVoice — offline render', () => {
    it('renders a kick voice: non-silent, no NaN, peak < 0 dBFS', async () => {
        const data = await renderVoice(kickConfig(getDefaults('kick')));
        const { peak, hasNaN } = stats(data);
        expect(hasNaN).toBe(false);
        expect(peak).toBeGreaterThan(0.01); // non-silence
        expect(peak).toBeLessThan(1.0);     // peak < 0 dBFS
    });

    it('renders every factory kick preset on the layered model', async () => {
        for (const preset of PRESETS.kick) {
            const p = { ...getDefaults('kick'), ...preset.params };
            const data = await renderVoice(kickConfig(p));
            const { peak, hasNaN } = stats(data);
            expect(hasNaN, `${preset.name} produced NaN`).toBe(false);
            expect(peak, `${preset.name} is silent`).toBeGreaterThan(0.01);
            expect(Number.isFinite(peak), `${preset.name} blew up`).toBe(true);
        }
    });

    it('a disabled layer renders silence', async () => {
        const data = await renderVoice({
            layers: {
                body: {
                    enabled: false,
                    gain: 0,
                    env: { attack: 0.001, decay: 0.3 },
                    source: { kind: 'osc', type: 'sine', freq: 60 },
                },
            },
        }, { duration: 0.5 });
        expect(stats(data).peak).toBe(0);
    });

    it('velocity scales the output level', async () => {
        const config = kickConfig(getDefaults('kick'));
        const loud = stats(await renderVoice(config, { velocity: 1 })).peak;
        const quiet = stats(await renderVoice(config, { velocity: 0.25 })).peak;
        expect(quiet).toBeGreaterThan(0);
        expect(quiet).toBeLessThan(loud * 0.5);
    });

    it('noise source layer renders non-silent without NaN', async () => {
        const data = await renderVoice({
            layers: {
                noise: {
                    enabled: true,
                    gain: gainToDb(0.5),
                    env: { attack: 0.001, decay: 0.2 },
                    filter: { type: 'bandpass', freq: 2000, Q: 1 },
                    source: { kind: 'noise', color: 'white' },
                },
            },
        }, { duration: 0.5 });
        const { peak, hasNaN } = stats(data);
        expect(hasNaN).toBe(false);
        expect(peak).toBeGreaterThan(0.01);
        expect(peak).toBeLessThan(1.0);
    });

    it('oscBank source renders all partials without NaN', async () => {
        const data = await renderVoice({
            layers: {
                body: {
                    enabled: true,
                    gain: gainToDb(0.3),
                    env: { attack: 0.001, decay: 0.1 },
                    source: { kind: 'oscBank', type: 'square', freqs: [205.3, 304.4, 369.6] },
                },
            },
        }, { duration: 0.3 });
        const { peak, hasNaN } = stats(data);
        expect(hasNaN).toBe(false);
        expect(peak).toBeGreaterThan(0.01);
    });

    it('tune shifts source frequency (higher tune → higher zero-crossing rate)', async () => {
        const layer = (tune) => ({
            layers: {
                body: {
                    enabled: true,
                    tune,
                    gain: 0,
                    env: { attack: 0.001, decay: 0.5 },
                    source: { kind: 'osc', type: 'sine', freq: 110 },
                },
            },
        });
        const zc = (data) => {
            let n = 0;
            for (let i = 1; i < data.length; i++) {
                if ((data[i - 1] < 0) !== (data[i] < 0)) n++;
            }
            return n;
        };
        const base = zc(await renderVoice(layer(0), { duration: 0.4 }));
        const up = zc(await renderVoice(layer(12), { duration: 0.4 }));
        expect(up).toBeGreaterThan(base * 1.5); // one octave ≈ 2× crossings
    });

    it('multiple layers sum (two layers louder than one)', async () => {
        const one = {
            layers: {
                body: {
                    enabled: true, gain: gainToDb(0.3),
                    env: { attack: 0.001, decay: 0.3 },
                    source: { kind: 'osc', type: 'sine', freq: 60 },
                },
            },
        };
        const two = {
            layers: {
                ...one.layers,
                sub: {
                    enabled: true, gain: gainToDb(0.3),
                    env: { attack: 0.001, decay: 0.3 },
                    source: { kind: 'osc', type: 'sine', freq: 60 },
                },
            },
        };
        const p1 = stats(await renderVoice(one, { duration: 0.5 })).peak;
        const p2 = stats(await renderVoice(two, { duration: 0.5 })).peak;
        expect(p2).toBeGreaterThan(p1 * 1.5);
    });
});
