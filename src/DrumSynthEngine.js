// DrumSynthEngine.js — Hidden Drum Synthesis Studio Engine
// Professional drum sound design via Web Audio API synthesis

import DrumVoice, { mulberry32 } from './synth/DrumVoice.js';
import { kickConfig } from './synth/recipes/kick.js';
import { oneShot808 } from './synth/recipes/808.js';
import { snareConfig } from './synth/recipes/snare.js';
import { hatsConfig } from './synth/recipes/hats.js';
import { clapConfig } from './synth/recipes/clap.js';
import { rimConfig, percConfig } from './synth/recipes/percussion.js';
import { FinishingChain, presetForDrumType, normalizeBuffer } from './synth/FinishingChain.js';

const DRUM_TYPES = ['kick', '808', 'snare', 'ghostSnare', 'clap', 'rimShot', 'closedHat', 'openHat', 'percussion'];

const DRUM_LABELS = {
    kick: 'Kick', '808': '808 / Sub', snare: 'Snare', ghostSnare: 'Ghost Snare',
    clap: 'Clap', rimShot: 'Rim Shot', closedHat: 'Closed Hat', openHat: 'Open Hat', percussion: 'Percussion'
};

// Default parameter definitions per drum type
const PARAM_DEFS = {
    kick: [
        { key: 'pitch', label: 'Pitch', min: 30, max: 200, default: 55 },
        { key: 'pitchDecay', label: 'P.Decay', min: 0.01, max: 0.5, default: 0.08 },
        { key: 'startPitch', label: 'Start Hz', min: 80, max: 400, default: 150 },
        { key: 'decay', label: 'Decay', min: 0.1, max: 1.5, default: 0.5 },
        { key: 'drive', label: 'Drive', min: 0, max: 1, default: 0.2 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5 },
        { key: 'attack', label: 'Attack', min: 0, max: 0.02, default: 0.001 },
        { key: 'click', label: 'Click', min: 0, max: 1, default: 0.6 },
        { key: 'clickType', label: 'Click Type', min: 0, max: 1, default: 0 },
        { key: 'subAmount', label: 'Sub', min: 0, max: 1, default: 0.5 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.8 },
    ],
    '808': [
        { key: 'pitch', label: 'Pitch', min: 20, max: 80, default: 40 },
        { key: 'decay', label: 'Decay', min: 0.3, max: 4.0, default: 1.5 },
        { key: 'distortion', label: 'Distort', min: 0, max: 1, default: 0.1 },
        { key: 'pitchDecay', label: 'P.Decay', min: 0.02, max: 0.8, default: 0.15 },
        { key: 'startPitch', label: 'Start Hz', min: 60, max: 300, default: 120 },
        { key: 'sustain', label: 'Sustain', min: 0, max: 1, default: 0.6 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.3 },
        { key: 'glide', label: 'Glide', min: 30, max: 120, default: 60 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.85 },
    ],
    snare: [
        { key: 'pitch', label: 'Pitch', min: 100, max: 400, default: 200 },
        { key: 'noiseAmt', label: 'Noise', min: 0, max: 1, default: 0.7 },
        { key: 'decay', label: 'Decay', min: 0.05, max: 0.8, default: 0.2 },
        { key: 'noiseDecay', label: 'N.Decay', min: 0.05, max: 0.6, default: 0.18 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5 },
        { key: 'snap', label: 'Snap', min: 0, max: 1, default: 0.5 },
        { key: 'body', label: 'Body', min: 0, max: 1, default: 0.6 },
        { key: 'mode909', label: '909 Mode', min: 0, max: 1, default: 0 },
        { key: 'reverb', label: 'Reverb', min: 0, max: 1, default: 0 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.8 },
    ],
    ghostSnare: [
        { key: 'pitch', label: 'Pitch', min: 150, max: 500, default: 250 },
        { key: 'noiseAmt', label: 'Noise', min: 0, max: 1, default: 0.4 },
        { key: 'decay', label: 'Decay', min: 0.02, max: 0.3, default: 0.08 },
        { key: 'noiseDecay', label: 'N.Decay', min: 0.02, max: 0.2, default: 0.06 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.6 },
        { key: 'snap', label: 'Snap', min: 0, max: 1, default: 0.3 },
        { key: 'body', label: 'Body', min: 0, max: 1, default: 0.3 },
        { key: 'reverb', label: 'Reverb', min: 0, max: 1, default: 0 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.45 },
    ],
    clap: [
        { key: 'tone', label: 'Tone', min: 500, max: 3000, default: 1200 },
        { key: 'decay', label: 'Decay', min: 0.05, max: 0.6, default: 0.15 },
        { key: 'spread', label: 'Spread', min: 0.01, max: 0.06, default: 0.03 },
        { key: 'layers', label: 'Layers', min: 2, max: 6, default: 3 },
        { key: 'filterQ', label: 'Reso', min: 0.5, max: 8, default: 2 },
        { key: 'noiseColor', label: 'Color', min: 0, max: 1, default: 0.5 },
        { key: 'tail', label: 'Tail', min: 0, max: 0.5, default: 0.1 },
        { key: 'reverb', label: 'Reverb', min: 0, max: 1, default: 0 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.75 },
    ],
    rimShot: [
        { key: 'pitch', label: 'Pitch', min: 300, max: 1200, default: 600 },
        { key: 'decay', label: 'Decay', min: 0.01, max: 0.15, default: 0.04 },
        { key: 'hpFreq', label: 'HP Freq', min: 500, max: 5000, default: 1500 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.7 },
        { key: 'click', label: 'Click', min: 0, max: 1, default: 0.8 },
        { key: 'body', label: 'Body', min: 0, max: 1, default: 0.4 },
        { key: 'filterQ', label: 'Reso', min: 0.5, max: 6, default: 1.5 },
        { key: 'reverb', label: 'Reverb', min: 0, max: 1, default: 0 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.7 },
    ],
    closedHat: [
        { key: 'pitch', label: 'Pitch', min: 200, max: 800, default: 400 },
        { key: 'decay', label: 'Decay', min: 0.01, max: 0.2, default: 0.05 },
        { key: 'hpFreq', label: 'HP Freq', min: 4000, max: 14000, default: 7000 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5 },
        { key: 'metallic', label: 'Metal', min: 0, max: 1, default: 0.6 },
        { key: 'noiseAmt', label: 'Noise', min: 0, max: 1, default: 0.5 },
        { key: 'bandpass', label: 'BP Freq', min: 6000, max: 16000, default: 10000 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.6 },
    ],
    openHat: [
        { key: 'pitch', label: 'Pitch', min: 200, max: 800, default: 400 },
        { key: 'decay', label: 'Decay', min: 0.1, max: 1.0, default: 0.35 },
        { key: 'hpFreq', label: 'HP Freq', min: 4000, max: 14000, default: 7000 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5 },
        { key: 'metallic', label: 'Metal', min: 0, max: 1, default: 0.6 },
        { key: 'noiseAmt', label: 'Noise', min: 0, max: 1, default: 0.5 },
        { key: 'bandpass', label: 'BP Freq', min: 6000, max: 16000, default: 10000 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.55 },
    ],
    percussion: [
        { key: 'pitch', label: 'Pitch', min: 80, max: 1000, default: 300 },
        { key: 'decay', label: 'Decay', min: 0.02, max: 0.8, default: 0.15 },
        { key: 'pitchDecay', label: 'P.Decay', min: 0.01, max: 0.3, default: 0.05 },
        { key: 'noiseAmt', label: 'Noise', min: 0, max: 1, default: 0.3 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5 },
        { key: 'waveform', label: 'Wave', min: 0, max: 3, default: 1 },
        { key: 'filterFreq', label: 'Filter', min: 200, max: 8000, default: 2000 },
        { key: 'reverb', label: 'Reverb', min: 0, max: 1, default: 0 },
        { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.65 },
    ],
};

function getDefaults(type) {
    const defs = PARAM_DEFS[type] || [];
    const out = {};
    defs.forEach(d => { out[d.key] = d.default; });
    return out;
}

// ─── Genre-aware presets ───
const PRESETS = {
    kick: [
        { name: 'Trap Kick', genre: 'Trap', params: { pitch: 48, pitchDecay: 0.06, startPitch: 180, decay: 0.45, drive: 0.3, tone: 0.4, attack: 0.001, click: 0.7, clickType: 0, subAmount: 0.6, volume: 0.85 } },
        { name: 'Boom Bap Kick', genre: 'Boom Bap', params: { pitch: 65, pitchDecay: 0.05, startPitch: 120, decay: 0.35, drive: 0.15, tone: 0.55, attack: 0.001, click: 0.55, clickType: 1, subAmount: 0.65, volume: 0.8 } },
        { name: 'House Kick', genre: 'House', params: { pitch: 50, pitchDecay: 0.04, startPitch: 160, decay: 0.55, drive: 0.1, tone: 0.5, attack: 0.001, click: 0.65, clickType: 0, subAmount: 0.45, volume: 0.82 } },
        { name: 'Techno Kick', genre: 'Techno', params: { pitch: 45, pitchDecay: 0.03, startPitch: 200, decay: 0.6, drive: 0.25, tone: 0.3, attack: 0.001, click: 0.75, clickType: 0, subAmount: 0.5, volume: 0.88 } },
        { name: 'DnB Kick', genre: 'DnB', params: { pitch: 55, pitchDecay: 0.04, startPitch: 170, decay: 0.3, drive: 0.2, tone: 0.55, attack: 0.001, click: 0.8, clickType: 0, subAmount: 0.45, volume: 0.83 } },
        { name: 'Lo-Fi Kick', genre: 'Lo-Fi', params: { pitch: 60, pitchDecay: 0.07, startPitch: 120, decay: 0.4, drive: 0.35, tone: 0.7, attack: 0.001, click: 0.35, clickType: 1, subAmount: 0.4, volume: 0.7 } },
        { name: 'Drill Kick', genre: 'Drill', params: { pitch: 42, pitchDecay: 0.05, startPitch: 190, decay: 0.5, drive: 0.35, tone: 0.35, attack: 0.001, click: 0.7, clickType: 0, subAmount: 0.65, volume: 0.87 } },
        { name: 'Cinematic Kick', genre: 'Cinematic', params: { pitch: 40, pitchDecay: 0.1, startPitch: 120, decay: 1.2, drive: 0.15, tone: 0.3, attack: 0.001, click: 0.5, clickType: 1, subAmount: 0.7, volume: 0.9 } },
    ],
    '808': [
        { name: 'Trap 808', genre: 'Trap', params: { pitch: 36, decay: 1.8, distortion: 0.15, pitchDecay: 0.15, startPitch: 140, sustain: 0.65, tone: 0.3, glide: 80, volume: 0.85 } },
        { name: 'Drill 808', genre: 'Drill', params: { pitch: 32, decay: 2.2, distortion: 0.25, pitchDecay: 0.2, startPitch: 130, sustain: 0.7, tone: 0.25, glide: 100, volume: 0.88 } },
        { name: 'Phonk 808', genre: 'Phonk', params: { pitch: 38, decay: 1.5, distortion: 0.65, pitchDecay: 0.12, startPitch: 150, sustain: 0.5, tone: 0.45, glide: 60, volume: 0.9 } },
        { name: 'Cloud 808', genre: 'Cloud Rap', params: { pitch: 34, decay: 2.5, distortion: 0.05, pitchDecay: 0.18, startPitch: 110, sustain: 0.8, tone: 0.2, glide: 120, volume: 0.8 } },
        { name: 'Deep Sub', genre: 'Deep House', params: { pitch: 30, decay: 1.2, distortion: 0.0, pitchDecay: 0.1, startPitch: 80, sustain: 0.5, tone: 0.15, glide: 40, volume: 0.82 } },
        { name: 'Lo-Fi Sub', genre: 'Lo-Fi', params: { pitch: 42, decay: 1.0, distortion: 0.2, pitchDecay: 0.12, startPitch: 100, sustain: 0.4, tone: 0.4, glide: 50, volume: 0.75 } },
    ],
    snare: [
        { name: 'Trap Snare', genre: 'Trap', params: { pitch: 180, noiseAmt: 0.8, decay: 0.22, noiseDecay: 0.2, tone: 0.45, snap: 0.7, body: 0.5, volume: 0.8 } },
        { name: 'Boom Bap Snare', genre: 'Boom Bap', params: { pitch: 200, noiseAmt: 0.6, decay: 0.18, noiseDecay: 0.15, tone: 0.6, snap: 0.4, body: 0.7, volume: 0.78 } },
        { name: 'House Snare', genre: 'House', params: { pitch: 220, noiseAmt: 0.65, decay: 0.15, noiseDecay: 0.12, tone: 0.55, snap: 0.6, body: 0.55, volume: 0.75 } },
        { name: 'DnB Snare', genre: 'DnB', params: { pitch: 190, noiseAmt: 0.85, decay: 0.25, noiseDecay: 0.22, tone: 0.5, snap: 0.8, body: 0.65, volume: 0.82 } },
        { name: 'Rock Snare', genre: 'Rock', params: { pitch: 170, noiseAmt: 0.5, decay: 0.3, noiseDecay: 0.25, tone: 0.7, snap: 0.5, body: 0.8, volume: 0.85 } },
        { name: 'Lo-Fi Snare', genre: 'Lo-Fi', params: { pitch: 210, noiseAmt: 0.5, decay: 0.15, noiseDecay: 0.1, tone: 0.45, snap: 0.4, body: 0.5, volume: 0.65 } },
        { name: 'Techno Snare', genre: 'Techno', params: { pitch: 240, noiseAmt: 0.75, decay: 0.12, noiseDecay: 0.1, tone: 0.4, snap: 0.65, body: 0.4, mode909: 1, volume: 0.78 } },
    ],
    ghostSnare: [
        // volumes ≈ 2× pre-A04 values: ghosts now trigger at velocity 0.55,
        // so preset volume × velocity lands at the old loudness
        { name: 'Soft Ghost', genre: 'Hip Hop', params: { pitch: 250, noiseAmt: 0.3, decay: 0.06, noiseDecay: 0.05, tone: 0.6, snap: 0.2, body: 0.25, volume: 0.6 } },
        { name: 'Jazz Brush', genre: 'Jazz', params: { pitch: 350, noiseAmt: 0.5, decay: 0.08, noiseDecay: 0.07, tone: 0.7, snap: 0.15, body: 0.2, volume: 0.55 } },
        { name: 'R&B Ghost', genre: 'R&B', params: { pitch: 280, noiseAmt: 0.35, decay: 0.07, noiseDecay: 0.06, tone: 0.65, snap: 0.25, body: 0.3, volume: 0.65 } },
        { name: 'Trap Ghost', genre: 'Trap', params: { pitch: 220, noiseAmt: 0.4, decay: 0.05, noiseDecay: 0.04, tone: 0.5, snap: 0.3, body: 0.3, volume: 0.7 } },
    ],
    clap: [
        { name: 'Trap Clap', genre: 'Trap', params: { tone: 1200, decay: 0.18, spread: 0.03, layers: 3, filterQ: 2, noiseColor: 0.5, tail: 0.12, volume: 0.78 } },
        { name: 'House Clap', genre: 'House', params: { tone: 1500, decay: 0.12, spread: 0.025, layers: 4, filterQ: 1.5, noiseColor: 0.45, tail: 0.08, volume: 0.75 } },
        { name: 'Techno Clap', genre: 'Techno', params: { tone: 1800, decay: 0.1, spread: 0.02, layers: 3, filterQ: 2.5, noiseColor: 0.6, tail: 0.06, volume: 0.8 } },
        { name: 'Boom Bap Clap', genre: 'Boom Bap', params: { tone: 1000, decay: 0.2, spread: 0.035, layers: 3, filterQ: 1.8, noiseColor: 0.55, tail: 0.15, volume: 0.72 } },
        { name: 'Lo-Fi Clap', genre: 'Lo-Fi', params: { tone: 900, decay: 0.15, spread: 0.04, layers: 2, filterQ: 1.2, noiseColor: 0.65, tail: 0.1, volume: 0.6 } },
    ],
    rimShot: [
        { name: 'Trap Rim', genre: 'Trap', params: { pitch: 700, decay: 0.04, hpFreq: 1800, tone: 0.7, click: 0.85, body: 0.35, filterQ: 1.5, volume: 0.72 } },
        { name: 'House Rim', genre: 'House', params: { pitch: 600, decay: 0.05, hpFreq: 1500, tone: 0.6, click: 0.7, body: 0.45, filterQ: 1.8, volume: 0.68 } },
        { name: 'Jazz Rim', genre: 'Jazz', params: { pitch: 500, decay: 0.06, hpFreq: 1200, tone: 0.75, click: 0.6, body: 0.5, filterQ: 1.2, volume: 0.6 } },
        { name: 'Latin Rim', genre: 'Latin', params: { pitch: 800, decay: 0.035, hpFreq: 2000, tone: 0.65, click: 0.9, body: 0.3, filterQ: 2, volume: 0.7 } },
    ],
    closedHat: [
        { name: 'Trap CH', genre: 'Trap', params: { pitch: 420, decay: 0.06, hpFreq: 8000, tone: 0.5, metallic: 0.7, noiseAmt: 0.5, bandpass: 11000, volume: 0.6 } },
        { name: 'House CH', genre: 'House', params: { pitch: 380, decay: 0.04, hpFreq: 7000, tone: 0.5, metallic: 0.55, noiseAmt: 0.55, bandpass: 10000, volume: 0.58 } },
        { name: 'Lo-Fi CH', genre: 'Lo-Fi', params: { pitch: 350, decay: 0.05, hpFreq: 5000, tone: 0.65, metallic: 0.4, noiseAmt: 0.6, bandpass: 8000, volume: 0.5 } },
        { name: 'Techno CH', genre: 'Techno', params: { pitch: 450, decay: 0.03, hpFreq: 9000, tone: 0.4, metallic: 0.65, noiseAmt: 0.45, bandpass: 12000, volume: 0.62 } },
        { name: 'DnB CH', genre: 'DnB', params: { pitch: 440, decay: 0.035, hpFreq: 8500, tone: 0.45, metallic: 0.7, noiseAmt: 0.5, bandpass: 11000, volume: 0.6 } },
    ],
    openHat: [
        // decays retuned to the v2 spec range (300–800 ms)
        { name: 'Trap OH', genre: 'Trap', params: { pitch: 420, decay: 0.45, hpFreq: 7500, tone: 0.5, metallic: 0.65, noiseAmt: 0.55, bandpass: 10000, volume: 0.55 } },
        { name: 'House OH', genre: 'House', params: { pitch: 380, decay: 0.4, hpFreq: 7000, tone: 0.5, metallic: 0.55, noiseAmt: 0.55, bandpass: 10000, volume: 0.52 } },
        { name: 'DnB OH', genre: 'DnB', params: { pitch: 440, decay: 0.35, hpFreq: 8000, tone: 0.45, metallic: 0.7, noiseAmt: 0.5, bandpass: 11000, volume: 0.55 } },
        { name: 'Techno OH', genre: 'Techno', params: { pitch: 450, decay: 0.3, hpFreq: 9000, tone: 0.4, metallic: 0.6, noiseAmt: 0.45, bandpass: 12000, volume: 0.58 } },
    ],
    percussion: [
        { name: 'Conga', genre: 'Latin', params: { pitch: 300, decay: 0.2, pitchDecay: 0.05, noiseAmt: 0.15, tone: 0.6, waveform: 0, filterFreq: 3000, volume: 0.7 } },
        { name: 'Bongo', genre: 'Latin', params: { pitch: 450, decay: 0.12, pitchDecay: 0.03, noiseAmt: 0.2, tone: 0.65, waveform: 0, filterFreq: 4000, volume: 0.65 } },
        { name: 'Tom', genre: 'Rock', params: { pitch: 150, decay: 0.35, pitchDecay: 0.08, noiseAmt: 0.1, tone: 0.5, waveform: 1, filterFreq: 2000, volume: 0.75 } },
        { name: 'Shaker', genre: 'House', params: { pitch: 800, decay: 0.1, pitchDecay: 0.01, noiseAmt: 0.9, tone: 0.3, waveform: 2, filterFreq: 6000, volume: 0.5 } },
        { name: 'Woodblock', genre: 'Latin', params: { pitch: 700, decay: 0.05, pitchDecay: 0.02, noiseAmt: 0.05, tone: 0.8, waveform: 1, filterFreq: 5000, volume: 0.6 } },
        { name: 'Taiko', genre: 'Cinematic', params: { pitch: 80, decay: 0.8, pitchDecay: 0.12, noiseAmt: 0.2, tone: 0.4, waveform: 0, filterFreq: 1500, volume: 0.9 } },
    ],
};

// ─── Synthesis Engine ───
class DrumSynthEngine {
    constructor() {
        // Reuse the shared AudioContext to avoid competing for audio hardware
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
        }
        this.ctx = window.sharedAnalysisCtx;
        this._noiseBuffer = null;
    }

    getNoiseBuffer() {
        if (this._noiseBuffer) return this._noiseBuffer;
        const len = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this._noiseBuffer = buf;
        return buf;
    }

    /**
     * Synthesized drum reverb IRs (TASK-A09).
     * 'room'  — 0.35 s exponential decay, dense early reflections in the
     *           first 25 ms, highpass 200 Hz.
     * 'plate' — 0.9 s, highpass 400 Hz, brighter diffuse density.
     */
    createReverbIR(kind = 'room') {
        const sr = this.ctx.sampleRate;
        const spec = kind === 'plate'
            ? { duration: 0.9, hpFreq: 400, early: false }
            : { duration: 0.35, hpFreq: 200, early: true };
        const decayRate = Math.log(1000) / spec.duration; // −60 dB at duration
        const len = Math.ceil(sr * spec.duration);
        const buf = this.ctx.createBuffer(2, len, sr);

        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / sr) * decayRate);
            }
            if (spec.early) {
                // dense early reflections in the first 25 ms
                for (let r = 0; r < 14; r++) {
                    const at = Math.floor(Math.random() * 0.025 * sr);
                    data[at] += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5);
                }
            }
            // in-place RBJ biquad highpass shapes the IR's low end
            const w0 = (2 * Math.PI * spec.hpFreq) / sr;
            const alpha = Math.sin(w0) / (2 * 0.707);
            const cosw0 = Math.cos(w0);
            const a0 = 1 + alpha;
            const b0 = (1 + cosw0) / 2 / a0, b1 = -(1 + cosw0) / a0, b2 = (1 + cosw0) / 2 / a0;
            const a1 = (-2 * cosw0) / a0, a2 = (1 - alpha) / a0;
            let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
            for (let i = 0; i < len; i++) {
                const x = data[i];
                const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
                x2 = x1; x1 = x; y2 = y1; y1 = y;
                data[i] = y;
            }
        }
        return buf;
    }

    /**
     * Create a convolver reverb node.
     * IRs are cached per kind so they aren't regenerated on every hit.
     */
    createReverb(wetAmount = 0.15, kind = 'room') {
        if (!this._reverbIRs) this._reverbIRs = {};
        if (!this._reverbIRs[kind]) {
            this._reverbIRs[kind] = this.createReverbIR(kind);
        }
        const convolver = this.ctx.createConvolver();
        convolver.buffer = this._reverbIRs[kind];

        // Wet gain
        const wetGain = this.ctx.createGain();
        wetGain.gain.value = wetAmount;

        // Dry gain
        const dryGain = this.ctx.createGain();
        dryGain.gain.value = 1.0 - wetAmount * 0.5; // Keep some dry signal

        // Input splitter node
        const input = this.ctx.createGain();
        input.gain.value = 1.0;

        // Output mixer
        const output = this.ctx.createGain();
        output.gain.value = 1.0;

        // Dry path: input -> dryGain -> output
        input.connect(dryGain);
        dryGain.connect(output);

        // Wet path: input -> convolver -> wetGain -> output
        input.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(output);

        return { input, output };
    }

    // ─── Individual synthesizers ───
    // p.seed (integer) enables the seeded round-robin jitter (TASK-A10);
    // preview() injects a fresh seed per hit for live variation.
    synthKick(dest, time, p) {
        new DrumVoice(this.ctx, kickConfig(p)).trigger(dest, time, { seed: p.seed ?? null });
    }

    // 808 runs on the v2 recipe (TASK-A03): two-stage saturation, 25 Hz
    // highpass, soft-clipped mono out. Melodic/glide path lives in
    // src/synth/recipes/808.js (Melodic808Engine).
    synth808(dest, time, p) {
        oneShot808(this.ctx, dest, time, p);
    }

    // Snare runs on the v2 layered recipe (TASK-A04): detuned body pair,
    // snap noise, comb-filtered rattle. Ghost = same recipe, low velocity.
    synthSnare(dest, time, p) {
        new DrumVoice(this.ctx, snareConfig(p)).trigger(dest, time, { seed: p.seed ?? null });
    }

    synthGhostSnare(dest, time, p) {
        new DrumVoice(this.ctx, snareConfig(p)).trigger(dest, time, { velocity: 0.55, seed: p.seed ?? null });
    }

    // Clap, rim and percussion run on the v2 recipes (TASK-A06/A07).
    synthClap(dest, time, p) {
        const random = p.seed != null ? mulberry32(p.seed) : Math.random;
        new DrumVoice(this.ctx, clapConfig(p, { random })).trigger(dest, time, { seed: p.seed ?? null });
    }

    synthRim(dest, time, p) {
        new DrumVoice(this.ctx, rimConfig(p)).trigger(dest, time, { seed: p.seed ?? null });
    }

    // Hats run on the v2 metallic-bank recipe (TASK-A05). Closed hats choke
    // open hats — the voices are tracked here in the trigger path.
    synthHat(dest, time, p, open = false) {
        const voice = new DrumVoice(this.ctx, hatsConfig(p, { open }));
        if (open) {
            this._openHats = (this._openHats || []).filter(v => v !== voice);
            this._openHats.push(voice);
        } else if (this._openHats && this._openHats.length) {
            this._openHats.forEach(v => v.choke(time));
            this._openHats = [];
        }
        voice.trigger(dest, time, { seed: p.seed ?? null });
    }

    synthPerc(dest, time, p) {
        new DrumVoice(this.ctx, percConfig(p)).trigger(dest, time, { seed: p.seed ?? null });
    }

    // Route to correct synth — applies reverb for applicable types
    synthesize(type, dest, time, params) {
        const p = { ...getDefaults(type), ...params };

        // Types that support reverb
        const reverbTypes = ['snare', 'ghostSnare', 'clap', 'rimShot', 'percussion'];
        const useReverb = reverbTypes.includes(type) && (p.reverb || 0) > 0.01;

        let synthDest = dest;
        if (useReverb) {
            // drum sends default to the room IR; wet capped at 0.15
            const reverb = this.createReverb(Math.min(p.reverb, 1) * 0.15, 'room');
            reverb.output.connect(dest);
            synthDest = reverb.input;
        }

        switch (type) {
            case 'kick': this.synthKick(synthDest, time, p); break;
            case '808': this.synth808(synthDest, time, p); break;
            case 'snare': this.synthSnare(synthDest, time, p); break;
            case 'ghostSnare': this.synthGhostSnare(synthDest, time, p); break;
            case 'clap': this.synthClap(synthDest, time, p); break;
            case 'rimShot': this.synthRim(synthDest, time, p); break;
            case 'closedHat': this.synthHat(synthDest, time, p, false); break;
            case 'openHat': this.synthHat(synthDest, time, p, true); break;
            case 'percussion': this.synthPerc(synthDest, time, p); break;
        }
    }

    // Preview: play through speakers (finished by default, like exports)
    preview(type, params, { finish = true, chainPreset = null } = {}) {
        if (this._idleSuspendTimer) clearTimeout(this._idleSuspendTimer);
        if (this.ctx.state === 'suspended') this.ctx.resume();
        let dest = this.ctx.destination;
        if (finish) {
            const chain = new FinishingChain(this.ctx, chainPreset || presetForDrumType(type));
            chain.output.connect(this.ctx.destination);
            dest = chain.input;
            setTimeout(() => chain.dispose(), 6000); // after the one-shot rings out
        }
        // fresh round-robin seed per live hit (TASK-A10)
        const seed = params?.seed ?? Math.floor(Math.random() * 0xffffffff);
        this.synthesize(type, dest, this.ctx.currentTime, { ...params, seed });
        // Suspend context after preview to prevent idle static on Realtek drivers
        // — but NOT if SamplerEngine is actively playing (shared context)
        this._idleSuspendTimer = setTimeout(() => {
            if (window.__samplerRef?._audioActive) return;
            if (this.ctx && this.ctx.state === 'running') {
                this.ctx.suspend().catch(() => {});
            }
        }, 4000);
    }

    // Render to offline buffer for export. With finish on (default), the
    // synth routes through the per-drum FinishingChain (TASK-A08) and the
    // result is normalized to −0.3 dBFS; finish off = legacy −6 dB render.
    async renderToBuffer(type, params, duration = 2.0, { finish = true, chainPreset = null } = {}) {
        const sr = 44100;
        const p = { ...getDefaults(type), ...params };
        // Extend duration for reverb tail
        const reverbTypes = ['snare', 'ghostSnare', 'clap', 'rimShot', 'percussion'];
        const hasReverb = reverbTypes.includes(type) && (p.reverb || 0) > 0.01;
        const totalDuration = hasReverb ? duration + 3.5 : duration;
        const length = Math.ceil(sr * totalDuration);
        // Use 2 channels to support stereo reverb
        const offline = new OfflineAudioContext(hasReverb ? 2 : 1, length, sr);
        // Copy the noise buffer into the offline context
        if (this._noiseBuffer) {
            const old = this._noiseBuffer;
            const nb = offline.createBuffer(1, old.length, sr);
            nb.getChannelData(0).set(old.getChannelData(0));
            this._offlineNoise = nb;
        }
        let synthDest = offline.destination;
        let chain = null;
        if (finish) {
            chain = new FinishingChain(offline, chainPreset || presetForDrumType(type));
            chain.output.connect(offline.destination);
            synthDest = chain.input;
        }
        const origCtx = this.ctx;
        const origNoise = this._noiseBuffer;
        const origReverbIRs = this._reverbIRs;
        this.ctx = offline;
        this._noiseBuffer = this._offlineNoise || null;
        this._reverbIRs = null; // Force regeneration for offline context
        this.synthesize(type, synthDest, 0, params);
        this.ctx = origCtx;
        this._noiseBuffer = origNoise;
        this._reverbIRs = origReverbIRs;
        const rendered = await offline.startRendering();
        if (finish) {
            normalizeBuffer(rendered, -0.3);
        } else {
            // Legacy normalize to -6dB headroom (first channel drives the scale)
            const data = rendered.getChannelData(0);
            let peak = 0;
            for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
            if (peak > 0) {
                const scale = 0.5012 / peak; // -6dB
                for (let i = 0; i < data.length; i++) data[i] *= scale;
            }
        }
        // Trim trailing silence
        const data = rendered.getChannelData(0);
        let end = data.length - 1;
        while (end > 0 && Math.abs(data[end]) < 0.0001) end--;
        end = Math.min(data.length, end + Math.ceil(sr * 0.02)); // 20ms fade-out tail
        return { buffer: rendered, trimEnd: end };
    }

    // Export to 24-bit WAV blob
    exportWAV(audioBuffer, trimEnd) {
        const sr = audioBuffer.sampleRate;
        const raw = audioBuffer.getChannelData(0);
        const len = trimEnd || raw.length;
        const bitDepth = 24;
        const bytesPerSample = 3;
        const numChannels = 1;
        const dataSize = len * bytesPerSample;
        const buf = new ArrayBuffer(44 + dataSize);
        const v = new DataView(buf);
        const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF');
        v.setUint32(4, 36 + dataSize, true);
        ws(8, 'WAVE'); ws(12, 'fmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); // PCM
        v.setUint16(22, numChannels, true);
        v.setUint32(24, sr, true);
        v.setUint32(28, sr * numChannels * bytesPerSample, true);
        v.setUint16(32, numChannels * bytesPerSample, true);
        v.setUint16(34, bitDepth, true);
        ws(36, 'data');
        v.setUint32(40, dataSize, true);
        for (let i = 0; i < len; i++) {
            const s = Math.max(-1, Math.min(1, raw[i]));
            const val = s < 0 ? s * 0x800000 : s * 0x7FFFFF;
            const iv = Math.round(val);
            v.setUint8(44 + i * 3, iv & 0xFF);
            v.setUint8(44 + i * 3 + 1, (iv >> 8) & 0xFF);
            v.setUint8(44 + i * 3 + 2, (iv >> 16) & 0xFF);
        }
        return new Blob([buf], { type: 'audio/wav' });
    }
}

export { DrumSynthEngine, DRUM_TYPES, DRUM_LABELS, PARAM_DEFS, PRESETS, getDefaults };
export default DrumSynthEngine;
