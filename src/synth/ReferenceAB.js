// ReferenceAB.js — reference A/B comparison analysis (TASK-A13)
//
// Pure analysis for the DrumSynthStudio Reference A/B panel: drop a
// commercial sample in, loudness-match it to the synth render, flip
// blindly between the two, and read the numbers that matter:
//   sub energy % (< 100 Hz) · spectral centroid · attack time (10→90%)
//   · peak/RMS crest factor.

import { powerSpectrum, bandEnergy, spectralCentroid } from './spectrum.js';

export function rmsOf(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / Math.max(data.length, 1));
}

export function peakOf(data) {
    let p = 0;
    for (let i = 0; i < data.length; i++) p = Math.max(p, Math.abs(data[i]));
    return p;
}

/** Gain to apply to `source` so its RMS matches `target` (equal loudness). */
export function loudnessMatchGain(target, source) {
    const t = rmsOf(target), s = rmsOf(source);
    return s > 0 ? t / s : 1;
}

/** 10% → 90% envelope rise time, in milliseconds. */
export function attackTimeMs(data, sampleRate) {
    const peak = peakOf(data);
    if (peak === 0) return 0;
    let t10 = -1, t90 = -1;
    // 1 ms peak-hold envelope follower
    const hold = Math.max(1, Math.floor(sampleRate * 0.001));
    let env = 0;
    for (let i = 0; i < data.length; i++) {
        env = Math.max(env * (1 - 1 / hold), Math.abs(data[i]));
        if (t10 < 0 && env >= peak * 0.1) t10 = i;
        if (t90 < 0 && env >= peak * 0.9) { t90 = i; break; }
    }
    if (t10 < 0 || t90 < 0) return 0;
    return ((t90 - t10) / sampleRate) * 1000;
}

/**
 * The A/B readouts for one buffer.
 * @returns {{ peak, rms, crestDb, subEnergyPct, centroidHz, attackMs }}
 */
export function analyzeBuffer(data, sampleRate) {
    const peak = peakOf(data);
    const rms = rmsOf(data);
    const { power, binHz } = powerSpectrum(data, sampleRate);
    const total = bandEnergy(power, binHz, 0, sampleRate / 2);
    const sub = bandEnergy(power, binHz, 0, 100);
    return {
        peak,
        rms,
        crestDb: rms > 0 ? 20 * Math.log10(peak / rms) : 0,
        subEnergyPct: total > 0 ? (sub / total) * 100 : 0,
        centroidHz: spectralCentroid(power, binHz),
        attackMs: attackTimeMs(data, sampleRate),
    };
}

/**
 * Log-spaced magnitude bins (dB, floored at -80) for the spectrum overlay.
 */
export function spectrumForDisplay(data, sampleRate, bins = 128, fLo = 30, fHi = 16000) {
    const { power, binHz } = powerSpectrum(data, sampleRate);
    const out = new Float32Array(bins);
    const logLo = Math.log(fLo), logHi = Math.log(fHi);
    let maxDb = -Infinity;
    for (let b = 0; b < bins; b++) {
        const f0 = Math.exp(logLo + ((logHi - logLo) * b) / bins);
        const f1 = Math.exp(logLo + ((logHi - logLo) * (b + 1)) / bins);
        const e = bandEnergy(power, binHz, f0, f1) / Math.max(f1 - f0, binHz);
        const db = 10 * Math.log10(e + 1e-12);
        out[b] = db;
        maxDb = Math.max(maxDb, db);
    }
    // normalize so the loudest bin sits at 0 dB, floor at −80
    for (let b = 0; b < bins; b++) out[b] = Math.max(out[b] - maxDb, -80);
    return out;
}
