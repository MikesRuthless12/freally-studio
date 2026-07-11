// PackRenderer.js — batch sample-pack renderer (TASK-B01)
//
// renderPack({ items, pitchGrid, velocityLayers, variations, sampleRate,
//              bitDepth, normalizeDb, onProgress })
//   → [{ name, buffer, wavBytes, meta }]
//
// Each item is a preset reference: { kind: 'drum'|'instrument', type, name,
// params }. Pitch grids apply to key-trackable types (808, percussion, all
// instruments) via the A3/A7 key-tracking APIs; velocity layers ride the A8
// velocity→timbre mapping; variations are distinct round-robin seeds.
// Every render goes through the per-type FinishingChain, is normalized to
// normalizeDb, tail-trimmed below −60 dBFS and given a 3 ms fade-out.
//
// `buffer` is a plain { sampleRate, length, numberOfChannels, channels }
// object (channels = Float32Array per channel) so results travel between
// browser and Node without an AudioContext.

import DrumVoice, { mulberry32 } from '../synth/DrumVoice.js';
import { kickConfig } from '../synth/recipes/kick.js';
import { snareConfig } from '../synth/recipes/snare.js';
import { hatsConfig } from '../synth/recipes/hats.js';
import { clapConfig } from '../synth/recipes/clap.js';
import { rimConfig, percConfig } from '../synth/recipes/percussion.js';
import { oneShot808, Melodic808Engine, noteToHz } from '../synth/recipes/808.js';
import { FinishingChain, presetForDrumType, normalizeBuffer } from '../synth/FinishingChain.js';
import { InstrumentSynthEngine, getDefaults as instrumentDefaults } from '../InstrumentSynthEngine.js';
import { getDefaults as drumDefaults } from '../DrumSynthEngine.js';
import { encodeWAV } from '../AudioExporterEnhanced.js';

const TRIM_FLOOR = 0.001; // −60 dBFS
const FADE_S = 0.003;     // 3 ms fade-out

const DRUM_DURATION = {
    kick: 1.5, '808': 3.0, snare: 1.0, ghostSnare: 1.0,
    clap: 1.0, rimShot: 0.6, closedHat: 0.6, openHat: 1.2, percussion: 1.2,
};

const PITCH_TRACKABLE_DRUMS = new Set(['808', 'percussion']);

export function supportsPitchGrid(item) {
    return item.kind === 'instrument' || PITCH_TRACKABLE_DRUMS.has(item.type);
}

const NOTE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
export function midiToName(midi) {
    return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

async function renderDrum(item, { midiNote, velocity, seed, sampleRate }) {
    const type = item.type;
    const p = { ...drumDefaults(type), ...item.params };
    const duration = DRUM_DURATION[type] ?? 1.0;
    const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);
    const chain = new FinishingChain(ctx, presetForDrumType(type));
    chain.output.connect(ctx.destination);
    const dest = chain.input;

    switch (type) {
        case 'kick':
            new DrumVoice(ctx, kickConfig(p)).trigger(dest, 0, { velocity, seed });
            break;
        case '808':
            if (midiNote != null) {
                const engine = new Melodic808Engine(ctx, p).connect(dest);
                engine.noteOn(midiNote, 0, velocity);
            } else {
                oneShot808(ctx, dest, 0, p);
            }
            break;
        case 'snare':
            new DrumVoice(ctx, snareConfig(p)).trigger(dest, 0, { velocity, seed });
            break;
        case 'ghostSnare':
            new DrumVoice(ctx, snareConfig(p)).trigger(dest, 0, { velocity: velocity * 0.55, seed });
            break;
        case 'closedHat':
        case 'openHat':
            new DrumVoice(ctx, hatsConfig(p, { open: type === 'openHat' }))
                .trigger(dest, 0, { velocity, seed });
            break;
        case 'clap': {
            const random = seed != null ? mulberry32(seed) : Math.random;
            new DrumVoice(ctx, clapConfig(p, { random })).trigger(dest, 0, { velocity, seed });
            break;
        }
        case 'rimShot':
            new DrumVoice(ctx, rimConfig(p)).trigger(dest, 0, { velocity, seed });
            break;
        case 'percussion':
            new DrumVoice(ctx, percConfig(p, { midiNote })).trigger(dest, 0, { velocity, seed });
            break;
        default:
            throw new Error(`PackRenderer: unknown drum type "${type}"`);
    }
    return ctx.startRendering();
}

const instrumentEngine = new InstrumentSynthEngine();

async function renderInstrument(item, { midiNote, velocity }) {
    const p = { ...instrumentDefaults(item.type), ...item.params };
    // instruments have no per-hit velocity input; scale the master volume
    p.volume = (p.volume ?? 0.8) * velocity;
    const freq = noteToHz(midiNote ?? 60);
    const { buffer } = await instrumentEngine.renderToBuffer(item.type, p, 1.5, freq);
    return buffer;
}

function trimAndFade(rendered, sampleRate) {
    const numChannels = rendered.numberOfChannels;
    const raw = [];
    for (let ch = 0; ch < numChannels; ch++) raw.push(rendered.getChannelData(ch));

    // auto-trim: last sample above −60 dBFS on any channel
    let end = 0;
    for (let ch = 0; ch < numChannels; ch++) {
        for (let i = raw[ch].length - 1; i > end; i--) {
            if (Math.abs(raw[ch][i]) > TRIM_FLOOR) { end = i; break; }
        }
    }
    const fadeLen = Math.floor(sampleRate * FADE_S);
    end = Math.min(raw[0].length, end + fadeLen + 1);

    const channels = [];
    for (let ch = 0; ch < numChannels; ch++) {
        const data = new Float32Array(raw[ch].subarray(0, end));
        for (let i = 0; i < fadeLen && end - 1 - i >= 0; i++) {
            data[end - 1 - i] *= i / fadeLen; // linear fade to true zero
        }
        channels.push(data);
    }
    return { sampleRate, length: end, numberOfChannels: numChannels, channels };
}

function interleave(buffer) {
    const { channels, length, numberOfChannels } = buffer;
    if (numberOfChannels === 1) return channels[0];
    const out = new Float32Array(length * numberOfChannels);
    for (let ch = 0; ch < numberOfChannels; ch++) {
        for (let i = 0; i < length; i++) out[i * numberOfChannels + ch] = channels[ch][i];
    }
    return out;
}

/**
 * Render a whole pack. Chunked-async: yields to the event loop every few
 * renders so the UI stays alive; onProgress(done, total) after each render.
 */
export async function renderPack({
    items,
    pitchGrid = null,
    velocityLayers = [1.0],
    variations = 1,
    sampleRate = 44100,
    bitDepth = 24,
    normalizeDb = -0.3,
    onProgress = null,
} = {}) {
    const results = [];
    const jobs = [];
    for (const item of items) {
        const pitches = (pitchGrid && supportsPitchGrid(item)) ? pitchGrid : [null];
        for (const midiNote of pitches) {
            for (let v = 0; v < velocityLayers.length; v++) {
                for (let variant = 0; variant < variations; variant++) {
                    jobs.push({ item, midiNote, velocity: velocityLayers[v], velocityIndex: v, variant });
                }
            }
        }
    }

    let done = 0;
    for (const job of jobs) {
        const { item, midiNote, velocity, velocityIndex, variant } = job;
        const seed = (item.params?.seed ?? 1) * 7919 + variant * 104729 + velocityIndex * 31;
        const rendered = item.kind === 'instrument'
            ? await renderInstrument(item, { midiNote, velocity })
            : await renderDrum(item, { midiNote, velocity, seed, sampleRate });
        normalizeBuffer(rendered, normalizeDb);
        const buffer = trimAndFade(rendered, rendered.sampleRate ?? sampleRate);
        const wavBytes = encodeWAV(interleave(buffer), buffer.sampleRate, buffer.numberOfChannels, bitDepth);
        const nameParts = [item.name.replace(/[^\w-]+/g, '_')];
        if (midiNote != null) nameParts.push(midiToName(midiNote));
        if (velocityLayers.length > 1) nameParts.push(`v${velocityIndex + 1}`);
        if (variations > 1) nameParts.push(`rr${variant + 1}`);
        results.push({
            name: nameParts.join('_'),
            buffer,
            wavBytes,
            meta: {
                kind: item.kind, type: item.type, preset: item.name,
                genre: item.genre ?? null,
                midiNote, velocity, seed, variant,
                velocityIndex: velocityIndex + 1, velocityCount: velocityLayers.length,
                sampleRate: buffer.sampleRate, bitDepth,
                durationS: buffer.length / buffer.sampleRate,
            },
        });
        done++;
        if (onProgress) onProgress(done, jobs.length);
        if (done % 4 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0)); // let the UI breathe
        }
    }
    return results;
}

export default renderPack;
