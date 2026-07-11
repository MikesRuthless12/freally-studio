// recipes/hats.js — Hats v2 metallic bank (TASK-A05)
//
// Metallic core: SIX square oscillators at the classic TR-808 frequencies,
// scaled by the 'pitch' knob (400 Hz = unity), summed → bandpass ≈10 kHz
// (Q ≈ 1, 'tone' shifts the center) → highpass 7–8 kHz → exponential decay.
// 'metallic' crossfades the oscillator bank against white noise; metallic 0
// is the pure-noise "modern" mode for trap rolls. Open hats get a small
// sustain shelf. The closed-cuts-open choke group lives in
// DrumSynthEngine's trigger path (DrumVoice.choke).
//
// Legacy params all work: pitch, decay, hpFreq, tone, metallic, noiseAmt,
// bandpass, volume.

import { gainToDb } from '../DrumVoice.js';

// Classic TR-808 hi-hat bank (Hz), defined at pitch = 400
export const TR808_RATIOS = [205.3, 304.4, 369.6, 522.7, 540, 800];

const BANK_LEVEL = 0.8; // six squares through BP+HP still need trimming

export function hatsConfig(p, { open = false } = {}) {
    const volume = p.volume ?? 0.6;
    const metallic = p.metallic ?? 0.6;
    const noiseAmt = p.noiseAmt ?? 0.5;
    const scale = (p.pitch ?? 400) / 400;
    const bpCenter = (p.bandpass ?? 10000) * (0.75 + (p.tone ?? 0.5) * 0.5);
    const decay = p.decay ?? (open ? 0.35 : 0.05);
    const env = open
        ? { attack: 0.001, decay, sustainLevel: 0.12, release: decay * 0.6 }
        : { attack: 0.001, decay };
    const filters = [
        { type: 'bandpass', freq: bpCenter, Q: 1 },
        { type: 'highpass', freq: p.hpFreq ?? 7500 },
    ];

    return {
        layers: {
            bank: {
                enabled: metallic > 0.01,
                gain: gainToDb(metallic * volume * BANK_LEVEL),
                env,
                filter: filters,
                source: {
                    kind: 'oscBank',
                    type: 'square',
                    freqs: TR808_RATIOS.map(f => f * scale),
                },
            },
            noise: {
                enabled: (1 - metallic) * noiseAmt > 0.005,
                gain: gainToDb((1 - metallic) * noiseAmt * volume),
                env,
                filter: filters,
                source: { kind: 'noise', color: 'white' },
            },
        },
    };
}

export default hatsConfig;
