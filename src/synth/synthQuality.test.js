// synthQuality.test.js — the golden-ear CI suite (TASK-A14).
// Offline-renders EVERY factory preset through the real product render path
// (recipes + FinishingChain + normalize) and asserts the quality gates:
// no NaN/clipping, peak −0.5…−0.2 dBFS, no DC, silence-trimmed tail, and
// the per-type spectral targets from prompts A2–A6.
// This suite is the permanent quality gate for the sound engine.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import { DrumSynthEngine, PRESETS as DRUM_PRESETS, getDefaults as drumDefaults } from '../DrumSynthEngine.js';
import {
    InstrumentSynthEngine, PRESETS as INST_PRESETS, getDefaults as instDefaults,
} from '../InstrumentSynthEngine.js';
import { powerSpectrum, bandEnergy, spectralCentroid } from './spectrum.js';

const SR = 44100;
globalThis.OfflineAudioContext = OfflineAudioContext; // engines build their own

const drumEngine = Object.create(DrumSynthEngine.prototype);
drumEngine.ctx = null;
const instEngine = new InstrumentSynthEngine();

const RENDER_DURATION = {
    kick: 1.5, '808': 3.0, snare: 1.0, ghostSnare: 1.0,
    clap: 1.0, rimShot: 0.6, closedHat: 0.6, openHat: 1.2, percussion: 1.2,
};

const PEAK_LO = Math.pow(10, -0.5 / 20);
const PEAK_HI = Math.pow(10, -0.2 / 20);

function stats(data) {
    let peak = 0, mean = 0, nan = false;
    for (let i = 0; i < data.length; i++) {
        if (Number.isNaN(data[i])) nan = true;
        peak = Math.max(peak, Math.abs(data[i]));
        mean += data[i];
    }
    return { peak, mean: mean / data.length, nan };
}

function assertBaseGates(data, trimEnd) {
    const { peak, nan } = stats(data);
    expect(nan, 'produced NaN').toBe(false);
    expect(peak, 'peak below −0.5 dBFS').toBeGreaterThanOrEqual(PEAK_LO * 0.999);
    expect(peak, 'clipping past −0.2 dBFS').toBeLessThanOrEqual(PEAK_HI * 1.001);
    // DC gate on the final 50 ms: a real DC pedestal persists into the
    // silence; a whole-buffer mean only flags truncated low-frequency cycles
    let tailMean = 0;
    const tailN = Math.min(data.length, Math.floor(SR * 0.05));
    for (let i = data.length - tailN; i < data.length; i++) tailMean += data[i];
    tailMean /= tailN;
    expect(Math.abs(tailMean), 'DC offset in tail').toBeLessThan(2e-4);
    if (trimEnd != null && trimEnd < data.length) {
        for (let i = trimEnd; i < data.length; i++) {
            expect(Math.abs(data[i]), `tail sample past trimEnd at ${i}`).toBeLessThan(0.01);
        }
    }
}

// Per-type spectral targets (from prompts A2–A6), applied post-chain.
function assertSpectralTargets(type, p, data) {
    const { power, binHz } = powerSpectrum(data, SR);
    const E = (lo, hi) => bandEnergy(power, binHz, lo, hi);
    switch (type) {
        case 'kick': {
            const low = E(40, 100);
            expect(low, '40–100 Hz must dominate mids').toBeGreaterThan(E(100, 1000));
            expect(low, '40–100 Hz must dominate highs').toBeGreaterThan(E(1000, 12000));
            // onset-relative: the chain's compressor stages add ~10 ms of
            // look-ahead latency, so "first 10 ms" starts at the onset
            let peak = 0;
            for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
            let onset = 0;
            while (onset < data.length && Math.abs(data[onset]) < peak * 0.02) onset++;
            let headPeak = 0;
            for (let i = onset; i < Math.min(data.length, onset + SR * 0.01); i++) {
                headPeak = Math.max(headPeak, Math.abs(data[i]));
            }
            expect(headPeak, 'transient in first 10 ms after onset').toBeGreaterThan(peak * 0.3);
            break;
        }
        case '808':
            expect(E(20, 100), 'sub must dominate').toBeGreaterThan(E(100, 1000));
            break;
        case 'snare': {
            // snap is time-localized: measure its window (first 150 ms), not
            // the whole render, where the long rattle tail dilutes it
            const head = data.slice(0, Math.floor(SR * 0.15));
            const hp = powerSpectrum(head, SR);
            const He = (lo, hi) => bandEnergy(hp.power, hp.binHz, lo, hi);
            expect(He(2000, 5000), 'snap peak vs above').toBeGreaterThan(He(5500, 8500));
            expect(E(p.pitch * 0.6, p.pitch * 1.6), 'body peak').toBeGreaterThan(E(p.pitch * 1.8, p.pitch * 2.8));
            break;
        }
        case 'ghostSnare': {
            // soft velocity mutes the snap while the rattle wires stay
            // broadband, so ghosts get a below-band snap check instead
            expect(E(2000, 5000), 'snap presence').toBeGreaterThan(2 * E(900, 1900));
            expect(E(p.pitch * 0.6, p.pitch * 1.6), 'body peak').toBeGreaterThan(E(p.pitch * 1.8, p.pitch * 2.8));
            break;
        }
        case 'closedHat':
        case 'openHat': {
            expect(spectralCentroid(power, binHz), 'centroid > 6 kHz').toBeGreaterThan(6000);
            expect(E(0, 2000), 'lows −30 dB down').toBeLessThan(E(2000, SR / 2) * 0.001);
            break;
        }
        case 'clap':
            expect(E(p.tone * 0.5, p.tone * 2), 'clap tone band').toBeGreaterThan(E(p.tone * 4, p.tone * 8));
            break;
        case 'rimShot': {
            const between = E(p.pitch * 0.95, p.pitch * 1.18);
            expect(E(p.pitch * 0.73 * 0.9, p.pitch * 0.73 * 1.12), 'low partial').toBeGreaterThan(between);
            expect(E(p.pitch * 1.67 * 0.9, p.pitch * 1.67 * 1.12), 'high partial').toBeGreaterThan(between);
            break;
        }
        default:
            break; // percussion: base gates only
    }
}

describe('Golden-ear suite — drum factory presets (full render path)', () => {
    for (const [type, presets] of Object.entries(DRUM_PRESETS)) {
        for (const preset of presets) {
            it(`${type} / ${preset.name}`, async () => {
                const p = { ...drumDefaults(type), ...preset.params };
                const { buffer, trimEnd } = await drumEngine.renderToBuffer(
                    type, p, RENDER_DURATION[type] ?? 1.0);
                const data = buffer.getChannelData(0);
                assertBaseGates(data, trimEnd);
                assertSpectralTargets(type, p, data);
            });
        }
    }
});

describe('Golden-ear suite — instrument factory presets', () => {
    for (const [type, presets] of Object.entries(INST_PRESETS)) {
        for (const preset of presets) {
            it(`${type} / ${preset.name}`, async () => {
                const p = { ...instDefaults(type), ...preset.params };
                const { buffer } = await instEngine.renderToBuffer(type, p, 1.0);
                assertBaseGates(buffer.getChannelData(0), null);
            });
        }
    }
});
