// instrumentSynth.test.js — TASK-A12 Instrument synth v2 golden tests
// Unison stereo decorrelation, mono correlation, audible filter sweep,
// every factory preset still renders.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import { InstrumentSynthEngine, PRESETS, getDefaults } from '../InstrumentSynthEngine.js';
import { powerSpectrum, spectralCentroid } from './spectrum.js';

const SR = 44100;
const engine = new InstrumentSynthEngine();

// renderToBuffer builds its own OfflineAudioContext — patch the global for Node
globalThis.OfflineAudioContext = OfflineAudioContext;

async function render(type, params, duration = 1.2) {
    const { buffer } = await engine.renderToBuffer(type, params, duration);
    return {
        L: new Float32Array(buffer.getChannelData(0)),
        R: new Float32Array(buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0)),
    };
}

function correlation(a, b) {
    let ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
    ma /= a.length; mb /= b.length;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) {
        const xa = a[i] - ma, xb = b[i] - mb;
        num += xa * xb; da += xa * xa; db += xb * xb;
    }
    return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 1;
}

function centroidOf(data, fromS, toS) {
    const seg = data.slice(Math.floor(SR * fromS), Math.floor(SR * toS));
    const { power, binHz } = powerSpectrum(seg, SR);
    // magnitude spectrum: the power centroid is fundamental-dominated for
    // saws (1/n² rolloff) and barely registers the filter sweep
    const mag = power.map(p => Math.sqrt(p));
    return spectralCentroid(mag, binHz);
}

function peakOf(data) {
    let p = 0;
    for (let i = 0; i < data.length; i++) p = Math.max(p, Math.abs(data[i]));
    return p;
}

describe('Instrument synth v2 — unison & stereo (TASK-A12)', () => {
    it('unison mode is stereo-decorrelated (L/R correlation < 0.9)', async () => {
        const { L, R } = await render('synthLead',
            { ...getDefaults('synthLead'), unisonVoices: 7, detune: 40, vibratoDepth: 0 });
        expect(correlation(L, R)).toBeLessThan(0.9);
    });

    it('mono mode stays correlated', async () => {
        const { L, R } = await render('synthLead',
            { ...getDefaults('synthLead'), unisonVoices: 1, vibratoDepth: 0 });
        expect(correlation(L, R)).toBeGreaterThan(0.99);
    });

    it('filter env audibly sweeps: centroid falls over the note', async () => {
        const { L } = await render('synthLead', {
            ...getDefaults('synthLead'),
            unisonVoices: 1, vibratoDepth: 0, subLevel: 0, resonance: 0.7,
            attack: 0.005, decay: 0.8, sustain: 0.6,
            cutoff: 600, envAmount: 5000, filterAttack: 0.005, filterDecay: 0.5,
        }, 1.5);
        const early = centroidOf(L, 0.02, 0.15); // filter open
        const late = centroidOf(L, 0.9, 1.3);    // filter settled at base cutoff
        expect(early).toBeGreaterThan(late * 1.3);
    });

    it('sub oscillator adds low-end weight', async () => {
        const base = { ...getDefaults('synthLead'), unisonVoices: 1, vibratoDepth: 0 };
        const withSub = await render('synthLead', { ...base, subLevel: 1 });
        const noSub = await render('synthLead', { ...base, subLevel: 0 });
        const lowE = (d) => {
            const { power, binHz } = powerSpectrum(d, SR);
            let e = 0;
            const lo = Math.floor(80 / binHz), hi = Math.ceil(180 / binHz);
            for (let i = lo; i < hi; i++) e += power[i];
            return e;
        };
        expect(lowE(withSub.L)).toBeGreaterThan(lowE(noSub.L) * 1.5);
    });

    it('vibrato onset delay: early pitch is steady, later it wobbles', async () => {
        const base = {
            ...getDefaults('synthLead'),
            unisonVoices: 1, subLevel: 0,
            attack: 0.005, decay: 0.2, sustain: 0.9, cutoff: 4000, envAmount: 0,
        };
        const still = (await render('synthLead', { ...base, vibratoDepth: 0 }, 2.0)).L;
        const vib = (await render('synthLead',
            { ...base, vibratoDepth: 30, vibratoRate: 6, vibratoDelay: 0.8 }, 2.0)).L;
        const diffIn = (a, b, fromS, toS) => {
            let m = 0;
            for (let i = Math.floor(SR * fromS); i < Math.floor(SR * toS); i++) {
                m = Math.max(m, Math.abs(a[i] - b[i]));
            }
            return m;
        };
        // before the onset delay the two renders track closely…
        const early = diffIn(still, vib, 0.05, 0.6);
        // …after it, vibrato pulls them far apart
        const late = diffIn(still, vib, 1.3, 1.9);
        expect(late).toBeGreaterThan(early * 3);
    });
});

describe('Instrument synth v2 — factory presets still render', () => {
    for (const [type, presets] of Object.entries(PRESETS)) {
        for (const preset of presets) {
            it(`${type} / ${preset.name}`, async () => {
                const { L } = await render(type, { ...getDefaults(type), ...preset.params }, 1.0);
                for (let i = 0; i < L.length; i++) {
                    expect(Number.isNaN(L[i])).toBe(false);
                }
                // normalized to −0.3 dBFS: peak sits just under full scale
                const peak = peakOf(L);
                expect(peak).toBeGreaterThan(0.9);
                expect(peak).toBeLessThanOrEqual(1.0);
            });
        }
    }
});
