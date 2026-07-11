// recipes/kick.js — Kick v2 recipe (TASK-A02)
//
// Three layers on the DrumVoice model:
//   TRANSIENT — the click. clickType < 0.5: 3 ms noise burst band-passed
//               2–6 kHz (tone sweeps the center); clickType ≥ 0.5: sine blip
//               1–4 kHz with ~3 ms exponential decay. 'click' 0..1 sets gain.
//   BODY      — sine with exponential pitch drop startPitch → pitch over
//               pitchDecay, fast attack, exponential amp decay. Drive keeps
//               the legacy waveshaper curve but is gain-compensated so hot
//               presets no longer peak past 0 dBFS.
//   SUB       — pure sine at the fundamental, lowpass 90 Hz, decay 1.5× body,
//               'subAmount' 0..1 sets gain.
//
// All legacy param names (pitch, pitchDecay, startPitch, decay, drive, tone,
// attack, volume) keep working; click/clickType/subAmount are the v2 params.

import { gainToDb } from '../DrumVoice.js';

// Peak output of the legacy drive curve for a full-scale input (x = 1):
// curve(1) = ((3 + k) · 57.2958) / (180 + k), k = drive · 50. Dividing the
// body gain by this keeps the drive *color* without the runaway level.
function driveGain(drive) {
    const k = drive * 50;
    return ((3 + k) * 57.2958) / (180 + k);
}

// Relative layer levels — tuned so body + coherent sub + click stay under
// 0 dBFS at volume = 1, subAmount = 1, click = 1 (verified by golden tests).
const BODY_LEVEL = 0.72;
const SUB_LEVEL = 0.42;
const CLICK_LEVEL = 0.9;

export function kickConfig(p) {
    const volume = p.volume ?? 0.8;
    const tone = p.tone ?? 0.5;
    const click = p.click ?? 0.6;
    const clickType = p.clickType ?? 0;
    const subAmount = p.subAmount ?? 0.5;
    const drive = p.drive > 0.05 ? p.drive : 0;
    const bodyGain = (BODY_LEVEL * volume) / (drive > 0 ? driveGain(drive) : 1);

    const transient = clickType < 0.5
        ? { // noise burst, band-passed 2–6 kHz
            enabled: click > 0.01,
            gain: gainToDb(CLICK_LEVEL * click * volume),
            env: { attack: 0, decay: 0.003 },
            filter: { type: 'bandpass', freq: 2000 + tone * 4000, Q: 1.5 },
            source: { kind: 'noise', color: 'white' },
        }
        : { // sine blip, 1–4 kHz, ~3 ms exponential decay
            enabled: click > 0.01,
            gain: gainToDb(CLICK_LEVEL * click * volume),
            env: { attack: 0, decay: 0.003 },
            source: { kind: 'osc', type: 'sine', freq: 1000 + tone * 3000 },
        };

    return {
        layers: {
            transient,
            body: {
                enabled: true,
                gain: gainToDb(bodyGain),
                env: { attack: Math.min(p.attack ?? 0.001, 0.02), decay: p.decay },
                drive,
                filter: { type: 'lowpass', freq: 200 + tone * 4000 },
                source: {
                    kind: 'osc',
                    type: 'sine',
                    freq: p.pitch,
                    pitchEnv: { start: p.startPitch, end: p.pitch, time: p.pitchDecay },
                },
            },
            sub: {
                enabled: subAmount > 0.01,
                gain: gainToDb(SUB_LEVEL * subAmount * volume),
                env: { attack: 0.002, decay: p.decay * 1.5 },
                filter: { type: 'lowpass', freq: 90 },
                source: { kind: 'osc', type: 'sine', freq: p.pitch },
            },
        },
    };
}

export default kickConfig;
