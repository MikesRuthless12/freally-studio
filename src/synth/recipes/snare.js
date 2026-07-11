// recipes/snare.js — Snare v2 recipe (TASK-A04)
//
// Replaces the old triangle+bandpassed-noise pair with three layers:
//   BODY   — two triangle oscillators detuned ±8 cents, fast pitch drop
//            ×1.15 → ×1.0 over 30 ms, decay 100–200 ms.
//   SNAP   — noise band-passed 1.5–4 kHz ('tone' sweeps the center,
//            'snap' raises Q 1–3 and the mix), exp decay 60–120 ms.
//   RATTLE — noise high-passed 400 Hz through a 5 ms feedback comb
//            (the snare wires), decay 150–350 ms.
// Optional 909 mode ('mode909' ≥ 0.5): snap noise runs through an
// envelope-swept HP+LP pair instead of the fixed bandpass.
//
// Legacy params all work: pitch, noiseAmt, decay, noiseDecay, tone, snap,
// body, volume (reverb is applied by DrumSynthEngine around the recipe).
// Ghost snares use the same recipe triggered at low velocity.

import { gainToDb } from '../DrumVoice.js';

const DETUNE = Math.pow(2, 8 / 1200); // ±8 cents
const MASTER = 0.8;                    // headroom so body+snap sum stays < 0 dBFS

export function snareConfig(p) {
    const volume = (p.volume ?? 0.8) * MASTER;
    const pitch = p.pitch ?? 200;
    const tone = p.tone ?? 0.5;
    const snap = p.snap ?? 0.5;
    const noiseAmt = p.noiseAmt ?? 0.7;
    const bodyAmt = p.body ?? 0.6;
    const noiseDecay = p.noiseDecay ?? 0.18;
    const is909 = (p.mode909 ?? 0) >= 0.5;

    const snapCenter = 1500 + tone * 2500; // 1.5–4 kHz
    const bodyOsc = (detune) => ({
        kind: 'osc',
        type: 'triangle',
        freq: pitch * detune,
        pitchEnv: { start: pitch * detune * 1.15, end: pitch * detune, time: 0.03 },
    });

    return {
        layers: {
            body: {
                enabled: bodyAmt > 0.01,
                gain: gainToDb(bodyAmt * volume * 0.5), // two oscs sum
                env: { attack: 0.001, decay: p.decay ?? 0.2 },
                source: [bodyOsc(1 / DETUNE), bodyOsc(DETUNE)],
            },
            snap: {
                enabled: noiseAmt > 0.01,
                gain: gainToDb(noiseAmt * (0.5 + snap * 0.5) * volume),
                env: { attack: 0, decay: noiseDecay },
                filter: is909
                    ? [
                        { type: 'highpass', Q: 0.7, sweep: { start: 500, end: 1600, time: 0.05 } },
                        { type: 'lowpass', Q: 0.7, sweep: { start: 5500, end: 3000, time: Math.max(noiseDecay, 0.05) } },
                    ]
                    : { type: 'bandpass', freq: snapCenter, Q: 1 + snap * 2 },
                source: { kind: 'noise', color: 'white' },
            },
            rattle: {
                enabled: noiseAmt > 0.01,
                gain: gainToDb(noiseAmt * volume * (is909 ? 0.25 : 0.45)),
                env: { attack: 0, decay: Math.min(0.35, 0.15 + noiseDecay) },
                // wire buzz lives in the mids: flat-to-20k noise reads as air,
                // not wires, and buries the snap band
                filter: [
                    { type: 'highpass', freq: 400 },
                    { type: 'lowpass', freq: 6500, Q: 0.707 },
                ],
                comb: { delayMs: 5, feedback: 0.4 },
                source: { kind: 'noise', color: 'white' },
            },
        },
    };
}

export default snareConfig;
