// recipes/clap.js — Clap v2 recipe (TASK-A06)
//
// Keeps the classic 3–5 burst structure, but each burst gets its OWN
// bandpass center (±15% jitter around 'tone') and the summed bursts run
// through one allpass diffusion stage + gentle tanh saturation, so the
// layers glue into a single "crack" instead of reading as echoes.
// The final burst carries the tail (room send stays in DrumSynthEngine's
// reverb wrapper).
//
// Legacy params all work: tone, decay, spread, layers, filterQ, noiseColor,
// tail, volume (+ reverb via the engine).

import { gainToDb } from '../DrumVoice.js';

const MASTER = 0.7; // headroom: bursts overlap and the tanh stage adds density

export function clapConfig(p, { random = Math.random } = {}) {
    const volume = (p.volume ?? 0.75) * MASTER;
    const tone = p.tone ?? 1200;
    const spread = p.spread ?? 0.03;
    const count = Math.min(6, Math.max(2, Math.round(p.layers ?? 3)));
    const color = (p.noiseColor ?? 0.5) >= 0.5 ? 'pink' : 'white';
    const layers = {};

    for (let i = 0; i < count; i++) {
        const isFinal = i === count - 1;
        const jitter = 1 + (random() * 2 - 1) * 0.15; // ±15% per burst
        layers[`burst${i}`] = {
            enabled: true,
            gain: gainToDb((isFinal ? 1 : 0.7) * volume),
            startOffset: i * spread,
            env: {
                attack: 0,
                // pre-final bursts are short; the final burst carries decay + tail
                decay: isFinal ? (p.decay ?? 0.15) + (p.tail ?? 0.1) : Math.max(spread * 1.6, 0.012),
            },
            filter: { type: 'bandpass', freq: tone * jitter, Q: p.filterQ ?? 2 },
            source: { kind: 'noise', color },
        };
    }

    return {
        layers,
        // diffusion + glue on the summed bursts
        post: [
            { kind: 'allpass', freq: tone * 1.1, Q: 0.7 },
            { kind: 'tanh', k: 1.5 },
        ],
    };
}

export default clapConfig;
