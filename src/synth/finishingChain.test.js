// finishingChain.test.js — TASK-A08 FinishingChain golden tests
// Rendered peak in [−0.5, −0.2] dBFS, no inter-sample overs at 4× oversample,
// bypass really bypasses.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import DrumVoice from './DrumVoice.js';
import { kickConfig } from './recipes/kick.js';
import {
    FinishingChain, CHAIN_PRESETS, presetForDrumType, normalizeBuffer,
} from './FinishingChain.js';
import { getDefaults } from '../DrumSynthEngine.js';

const SR = 44100;

const copy = (buf) => new Float32Array(buf.getChannelData(0));

async function renderKickThrough(presetName, { bypass = false } = {}) {
    const ctx = new OfflineAudioContext(1, SR, SR);
    let dest = ctx.destination;
    if (presetName != null) {
        const chain = new FinishingChain(ctx, presetName, { bypass });
        chain.output.connect(ctx.destination);
        dest = chain.input;
    }
    // clickType 1 = deterministic sine-blip click, so renders are comparable
    // sample-for-sample (the noise click re-randomizes per render)
    new DrumVoice(ctx, kickConfig({ ...getDefaults('kick'), clickType: 1 })).trigger(dest, 0);
    return copy(await ctx.startRendering());
}

function peakOf(data) {
    let p = 0;
    for (let i = 0; i < data.length; i++) p = Math.max(p, Math.abs(data[i]));
    return p;
}

describe('FinishingChain', () => {
    it('ships the five per-drum chains and a type mapping', () => {
        for (const key of ['kick', '808', 'snare', 'hats', 'clap', 'clean']) {
            expect(CHAIN_PRESETS[key]).toBeTruthy();
        }
        expect(presetForDrumType('kick')).toBe('kick');
        expect(presetForDrumType('ghostSnare')).toBe('snare');
        expect(presetForDrumType('openHat')).toBe('hats');
        expect(presetForDrumType('percussion')).toBe('clean');
        // 808 chain is tape sat + limiter only
        expect(CHAIN_PRESETS['808'].eq).toBeUndefined();
        expect(CHAIN_PRESETS['808'].saturation.mode).toBe('tape');
        expect(CHAIN_PRESETS['808'].limiter).toBeTruthy();
    });

    it('finished + normalized render peaks in [−0.5, −0.2] dBFS', async () => {
        for (const presetName of ['kick', 'snare', 'clean']) {
            const ctx = new OfflineAudioContext(1, SR, SR);
            const chain = new FinishingChain(ctx, presetName);
            chain.output.connect(ctx.destination);
            new DrumVoice(ctx, kickConfig(getDefaults('kick'))).trigger(chain.input, 0);
            const rendered = await ctx.startRendering();
            normalizeBuffer(rendered, -0.3);
            const peak = peakOf(rendered.getChannelData(0));
            expect(peak).toBeGreaterThan(Math.pow(10, -0.5 / 20)); // > −0.5 dBFS
            expect(peak).toBeLessThan(Math.pow(10, -0.2 / 20));    // < −0.2 dBFS
        }
    });

    it('no inter-sample overs (4× oversampled peak ≤ 0 dBTP)', async () => {
        const ctx = new OfflineAudioContext(1, SR, SR);
        const chain = new FinishingChain(ctx, 'kick');
        chain.output.connect(ctx.destination);
        new DrumVoice(ctx, kickConfig(getDefaults('kick'))).trigger(chain.input, 0);
        const rendered = await ctx.startRendering();
        normalizeBuffer(rendered, -0.3);
        // play the buffer into a 4× rate context — the resampler exposes ISPs
        const hi = new OfflineAudioContext(1, SR * 4, SR * 4);
        const src = hi.createBufferSource();
        const buf = hi.createBuffer(1, rendered.length, SR);
        buf.getChannelData(0).set(rendered.getChannelData(0));
        src.buffer = buf;
        src.connect(hi.destination);
        src.start(0);
        const oversampled = copy(await hi.startRendering());
        expect(peakOf(oversampled)).toBeLessThanOrEqual(1.0);
    });

    it('bypass really bypasses (output ≈ raw synth)', async () => {
        const raw = await renderKickThrough(null);
        const bypassed = await renderKickThrough('kick', { bypass: true });
        let maxDiff = 0;
        for (let i = 0; i < raw.length; i++) {
            maxDiff = Math.max(maxDiff, Math.abs(raw[i] - bypassed[i]));
        }
        expect(maxDiff).toBeLessThan(1e-4);
    });

    it('active chain actually changes the sound', async () => {
        const raw = await renderKickThrough(null);
        const finished = await renderKickThrough('kick');
        let maxDiff = 0;
        for (let i = 0; i < raw.length; i++) {
            maxDiff = Math.max(maxDiff, Math.abs(raw[i] - finished[i]));
        }
        expect(maxDiff).toBeGreaterThan(0.01);
    });

    it('normalizeBuffer scales every channel by the global peak', () => {
        const fake = {
            numberOfChannels: 2,
            _ch: [new Float32Array([0.5, -0.25]), new Float32Array([0.1, 0.05])],
            getChannelData(i) { return this._ch[i]; },
        };
        const gain = normalizeBuffer(fake, -0.3);
        expect(fake._ch[0][0]).toBeCloseTo(Math.pow(10, -0.3 / 20), 5);
        expect(fake._ch[1][0]).toBeCloseTo(0.1 * gain, 6);
    });
});
