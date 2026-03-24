// DrumSynthEngine.js — Hidden Drum Synthesis Studio Engine
// Professional drum sound design via Web Audio API synthesis

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
        { key: 'startPitch', label: 'Click', min: 80, max: 400, default: 150 },
        { key: 'decay', label: 'Decay', min: 0.1, max: 1.5, default: 0.5 },
        { key: 'drive', label: 'Drive', min: 0, max: 1, default: 0.2 },
        { key: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5 },
        { key: 'attack', label: 'Attack', min: 0, max: 0.02, default: 0.001 },
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
        { name: 'Trap Kick', genre: 'Trap', params: { pitch: 48, pitchDecay: 0.06, startPitch: 180, decay: 0.45, drive: 0.3, tone: 0.4, attack: 0.001, volume: 0.85 } },
        { name: 'Boom Bap Kick', genre: 'Boom Bap', params: { pitch: 65, pitchDecay: 0.05, startPitch: 140, decay: 0.35, drive: 0.15, tone: 0.65, attack: 0.002, volume: 0.8 } },
        { name: 'House Kick', genre: 'House', params: { pitch: 50, pitchDecay: 0.04, startPitch: 160, decay: 0.55, drive: 0.1, tone: 0.5, attack: 0.001, volume: 0.82 } },
        { name: 'Techno Kick', genre: 'Techno', params: { pitch: 45, pitchDecay: 0.03, startPitch: 200, decay: 0.6, drive: 0.25, tone: 0.3, attack: 0.001, volume: 0.88 } },
        { name: 'DnB Kick', genre: 'DnB', params: { pitch: 55, pitchDecay: 0.04, startPitch: 170, decay: 0.3, drive: 0.2, tone: 0.55, attack: 0.001, volume: 0.83 } },
        { name: 'Lo-Fi Kick', genre: 'Lo-Fi', params: { pitch: 60, pitchDecay: 0.07, startPitch: 120, decay: 0.4, drive: 0.35, tone: 0.7, attack: 0.003, volume: 0.7 } },
        { name: 'Drill Kick', genre: 'Drill', params: { pitch: 42, pitchDecay: 0.05, startPitch: 190, decay: 0.5, drive: 0.35, tone: 0.35, attack: 0.001, volume: 0.87 } },
        { name: 'Cinematic Kick', genre: 'Cinematic', params: { pitch: 35, pitchDecay: 0.1, startPitch: 120, decay: 1.2, drive: 0.15, tone: 0.3, attack: 0.002, volume: 0.9 } },
    ],
    '808': [
        { name: 'Trap 808', genre: 'Trap', params: { pitch: 36, decay: 1.8, distortion: 0.15, pitchDecay: 0.15, startPitch: 140, sustain: 0.65, tone: 0.3, volume: 0.85 } },
        { name: 'Drill 808', genre: 'Drill', params: { pitch: 32, decay: 2.2, distortion: 0.25, pitchDecay: 0.2, startPitch: 130, sustain: 0.7, tone: 0.25, volume: 0.88 } },
        { name: 'Phonk 808', genre: 'Phonk', params: { pitch: 38, decay: 1.5, distortion: 0.65, pitchDecay: 0.12, startPitch: 150, sustain: 0.5, tone: 0.45, volume: 0.9 } },
        { name: 'Cloud 808', genre: 'Cloud Rap', params: { pitch: 34, decay: 2.5, distortion: 0.05, pitchDecay: 0.18, startPitch: 110, sustain: 0.8, tone: 0.2, volume: 0.8 } },
        { name: 'Deep Sub', genre: 'Deep House', params: { pitch: 30, decay: 1.2, distortion: 0.0, pitchDecay: 0.1, startPitch: 80, sustain: 0.5, tone: 0.15, volume: 0.82 } },
        { name: 'Lo-Fi Sub', genre: 'Lo-Fi', params: { pitch: 42, decay: 1.0, distortion: 0.2, pitchDecay: 0.12, startPitch: 100, sustain: 0.4, tone: 0.4, volume: 0.75 } },
    ],
    snare: [
        { name: 'Trap Snare', genre: 'Trap', params: { pitch: 180, noiseAmt: 0.8, decay: 0.22, noiseDecay: 0.2, tone: 0.45, snap: 0.7, body: 0.5, volume: 0.8 } },
        { name: 'Boom Bap Snare', genre: 'Boom Bap', params: { pitch: 200, noiseAmt: 0.6, decay: 0.18, noiseDecay: 0.15, tone: 0.6, snap: 0.4, body: 0.7, volume: 0.78 } },
        { name: 'House Snare', genre: 'House', params: { pitch: 220, noiseAmt: 0.65, decay: 0.15, noiseDecay: 0.12, tone: 0.55, snap: 0.6, body: 0.55, volume: 0.75 } },
        { name: 'DnB Snare', genre: 'DnB', params: { pitch: 190, noiseAmt: 0.85, decay: 0.25, noiseDecay: 0.22, tone: 0.5, snap: 0.8, body: 0.65, volume: 0.82 } },
        { name: 'Rock Snare', genre: 'Rock', params: { pitch: 170, noiseAmt: 0.5, decay: 0.3, noiseDecay: 0.25, tone: 0.7, snap: 0.5, body: 0.8, volume: 0.85 } },
        { name: 'Lo-Fi Snare', genre: 'Lo-Fi', params: { pitch: 210, noiseAmt: 0.5, decay: 0.15, noiseDecay: 0.1, tone: 0.7, snap: 0.3, body: 0.5, volume: 0.65 } },
        { name: 'Techno Snare', genre: 'Techno', params: { pitch: 240, noiseAmt: 0.75, decay: 0.12, noiseDecay: 0.1, tone: 0.4, snap: 0.65, body: 0.4, volume: 0.78 } },
    ],
    ghostSnare: [
        { name: 'Soft Ghost', genre: 'Hip Hop', params: { pitch: 250, noiseAmt: 0.3, decay: 0.06, noiseDecay: 0.05, tone: 0.6, snap: 0.2, body: 0.25, volume: 0.35 } },
        { name: 'Jazz Brush', genre: 'Jazz', params: { pitch: 350, noiseAmt: 0.5, decay: 0.08, noiseDecay: 0.07, tone: 0.7, snap: 0.15, body: 0.2, volume: 0.3 } },
        { name: 'R&B Ghost', genre: 'R&B', params: { pitch: 280, noiseAmt: 0.35, decay: 0.07, noiseDecay: 0.06, tone: 0.65, snap: 0.25, body: 0.3, volume: 0.38 } },
        { name: 'Trap Ghost', genre: 'Trap', params: { pitch: 220, noiseAmt: 0.4, decay: 0.05, noiseDecay: 0.04, tone: 0.5, snap: 0.3, body: 0.3, volume: 0.4 } },
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
        { name: 'Trap OH', genre: 'Trap', params: { pitch: 420, decay: 0.4, hpFreq: 7500, tone: 0.5, metallic: 0.65, noiseAmt: 0.55, bandpass: 10000, volume: 0.55 } },
        { name: 'House OH', genre: 'House', params: { pitch: 380, decay: 0.35, hpFreq: 7000, tone: 0.5, metallic: 0.55, noiseAmt: 0.55, bandpass: 10000, volume: 0.52 } },
        { name: 'DnB OH', genre: 'DnB', params: { pitch: 440, decay: 0.3, hpFreq: 8000, tone: 0.45, metallic: 0.7, noiseAmt: 0.5, bandpass: 11000, volume: 0.55 } },
        { name: 'Techno OH', genre: 'Techno', params: { pitch: 450, decay: 0.25, hpFreq: 9000, tone: 0.4, metallic: 0.6, noiseAmt: 0.45, bandpass: 12000, volume: 0.58 } },
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

    createDistortion(amount) {
        const n = 256;
        const curve = new Float32Array(n);
        const k = amount * 50;
        for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            curve[i] = ((3 + k) * x * 57.2958) / (180 + k * Math.abs(x));
        }
        const ws = this.ctx.createWaveShaper();
        ws.curve = curve;
        ws.oversample = '4x';
        return ws;
    }

    getWaveType(v) { return ['sine', 'triangle', 'sawtooth', 'square'][Math.round(v) % 4]; }

    /**
     * Create a synthetic cavern-like impulse response for reverb
     * @param {number} duration - Reverb tail length in seconds (0.5 - 4.0)
     * @param {number} decay - Exponential decay rate (higher = faster decay)
     * @param {number} density - Early reflection density
     */
    createReverbIR(duration = 2.5, decay = 2.0, density = 0.8) {
        const sr = this.ctx.sampleRate;
        const len = Math.ceil(sr * duration);
        const buf = this.ctx.createBuffer(2, len, sr);
        const dataL = buf.getChannelData(0);
        const dataR = buf.getChannelData(1);

        for (let i = 0; i < len; i++) {
            const t = i / sr;
            // Exponential decay envelope (cavern = slow decay)
            const env = Math.exp(-t * decay);
            // Diffuse random noise as the IR body
            const noiseL = (Math.random() * 2 - 1) * env;
            const noiseR = (Math.random() * 2 - 1) * env;

            // Early reflections: discrete echoes in first 80ms
            let earlyL = 0, earlyR = 0;
            const earlyRefTimes = [0.012, 0.024, 0.037, 0.052, 0.068];
            for (const refTime of earlyRefTimes) {
                const refSample = Math.floor(refTime * sr);
                if (i === refSample) {
                    earlyL = (0.6 + Math.random() * 0.4) * density;
                    earlyR = (0.6 + Math.random() * 0.4) * density;
                }
            }

            dataL[i] = noiseL * density + earlyL;
            dataR[i] = noiseR * density + earlyR;
        }

        return buf;
    }

    /**
     * Create a convolver reverb node.
     * Cached so we don't regenerate the IR on every call.
     */
    createReverb(wetAmount = 0.5) {
        // Cache the IR buffer for reuse
        if (!this._reverbIR) {
            this._reverbIR = this.createReverbIR(3.0, 1.5, 0.85);
        }
        const convolver = this.ctx.createConvolver();
        convolver.buffer = this._reverbIR;

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
    synthKick(dest, time, p) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.startPitch, time);
        osc.frequency.exponentialRampToValueAtTime(p.pitch, time + p.pitchDecay);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(p.volume, time + p.attack);
        gain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);
        if (p.drive > 0.05) {
            const dist = this.createDistortion(p.drive);
            osc.connect(dist); dist.connect(gain);
        } else { osc.connect(gain); }
        // Tone: LP filter
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 200 + p.tone * 4000;
        gain.connect(lp); lp.connect(dest);
        osc.start(time); osc.stop(time + p.decay + 0.05);
    }

    synth808(dest, time, p) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.startPitch, time);
        osc.frequency.exponentialRampToValueAtTime(p.pitch, time + p.pitchDecay);
        gain.gain.setValueAtTime(p.volume, time);
        gain.gain.setValueAtTime(p.volume * p.sustain, time + p.pitchDecay);
        gain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);
        if (p.distortion > 0.05) {
            const dist = this.createDistortion(p.distortion);
            osc.connect(dist); dist.connect(gain);
        } else { osc.connect(gain); }
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 120 + p.tone * 2000;
        gain.connect(lp); lp.connect(dest);
        osc.start(time); osc.stop(time + p.decay + 0.05);
    }

    synthSnare(dest, time, p) {
        // Body
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(p.pitch, time);
        oscGain.gain.setValueAtTime(p.body * p.volume, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);
        osc.connect(oscGain); oscGain.connect(dest);
        osc.start(time); osc.stop(time + p.decay + 0.05);
        // Noise snap
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.getNoiseBuffer();
        const nf = this.ctx.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.value = 1000 + p.tone * 6000;
        nf.Q.value = 0.5 + p.snap * 3;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(p.noiseAmt * p.volume, time);
        nGain.gain.exponentialRampToValueAtTime(0.001, time + p.noiseDecay);
        noise.connect(nf); nf.connect(nGain); nGain.connect(dest);
        noise.start(time); noise.stop(time + p.noiseDecay + 0.05);
    }

    synthGhostSnare(dest, time, p) { this.synthSnare(dest, time, p); }

    synthClap(dest, time, p) {
        const layers = Math.round(p.layers);
        for (let i = 0; i < layers; i++) {
            const d = i * p.spread;
            const n = this.ctx.createBufferSource();
            n.buffer = this.getNoiseBuffer();
            const f = this.ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.value = p.tone;
            f.Q.value = p.filterQ;
            const g = this.ctx.createGain();
            const amp = (i === layers - 1 ? 1 : 0.7) * p.volume;
            g.gain.setValueAtTime(amp, time + d);
            g.gain.exponentialRampToValueAtTime(0.001, time + d + p.decay + p.tail);
            n.connect(f); f.connect(g); g.connect(dest);
            n.start(time + d); n.stop(time + d + p.decay + p.tail + 0.05);
        }
    }

    synthRim(dest, time, p) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(p.pitch, time);
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = p.hpFreq; hp.Q.value = p.filterQ;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(p.click * p.volume, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + p.decay);
        osc.connect(hp); hp.connect(g); g.connect(dest);
        osc.start(time); osc.stop(time + p.decay + 0.02);
        // Body tone
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine'; osc2.frequency.value = p.pitch * 0.5;
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(p.body * p.volume * 0.5, time);
        g2.gain.exponentialRampToValueAtTime(0.001, time + p.decay * 0.8);
        osc2.connect(g2); g2.connect(dest);
        osc2.start(time); osc2.stop(time + p.decay + 0.02);
    }

    synthHat(dest, time, p) {
        // Metallic oscillators
        const fundamental = p.pitch || 400;
        const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = p.bandpass; bp.Q.value = 0.5;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = p.hpFreq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(p.metallic * p.volume, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + p.decay);
        bp.connect(hp); hp.connect(g); g.connect(dest);
        ratios.forEach(r => {
            const o = this.ctx.createOscillator();
            o.type = 'square'; o.frequency.value = fundamental * r;
            o.connect(bp); o.start(time); o.stop(time + p.decay + 0.02);
        });
        // Noise layer
        if (p.noiseAmt > 0.05) {
            const n = this.ctx.createBufferSource();
            n.buffer = this.getNoiseBuffer();
            const nHp = this.ctx.createBiquadFilter();
            nHp.type = 'highpass'; nHp.frequency.value = p.hpFreq;
            const nG = this.ctx.createGain();
            nG.gain.setValueAtTime(p.noiseAmt * p.volume, time);
            nG.gain.exponentialRampToValueAtTime(0.001, time + p.decay);
            n.connect(nHp); nHp.connect(nG); nG.connect(dest);
            n.start(time); n.stop(time + p.decay + 0.02);
        }
    }

    synthPerc(dest, time, p) {
        const osc = this.ctx.createOscillator();
        osc.type = this.getWaveType(p.waveform);
        osc.frequency.setValueAtTime(p.pitch * 1.5, time);
        osc.frequency.exponentialRampToValueAtTime(p.pitch, time + p.pitchDecay);
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = p.filterFreq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(p.volume * (1 - p.noiseAmt), time);
        g.gain.exponentialRampToValueAtTime(0.001, time + p.decay);
        osc.connect(lp); lp.connect(g); g.connect(dest);
        osc.start(time); osc.stop(time + p.decay + 0.05);
        if (p.noiseAmt > 0.05) {
            const n = this.ctx.createBufferSource();
            n.buffer = this.getNoiseBuffer();
            const nf = this.ctx.createBiquadFilter();
            nf.type = 'bandpass'; nf.frequency.value = p.filterFreq; nf.Q.value = 1;
            const nG = this.ctx.createGain();
            nG.gain.setValueAtTime(p.noiseAmt * p.volume, time);
            nG.gain.exponentialRampToValueAtTime(0.001, time + p.decay * 0.8);
            n.connect(nf); nf.connect(nG); nG.connect(dest);
            n.start(time); n.stop(time + p.decay + 0.05);
        }
    }

    // Route to correct synth — applies reverb for applicable types
    synthesize(type, dest, time, params) {
        const p = { ...getDefaults(type), ...params };

        // Types that support reverb
        const reverbTypes = ['snare', 'ghostSnare', 'clap', 'rimShot', 'percussion'];
        const useReverb = reverbTypes.includes(type) && (p.reverb || 0) > 0.01;

        let synthDest = dest;
        if (useReverb) {
            const reverb = this.createReverb(p.reverb);
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
            case 'closedHat': this.synthHat(synthDest, time, p); break;
            case 'openHat': this.synthHat(synthDest, time, p); break;
            case 'percussion': this.synthPerc(synthDest, time, p); break;
        }
    }

    // Preview: play through speakers
    preview(type, params) {
        if (this._idleSuspendTimer) clearTimeout(this._idleSuspendTimer);
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.synthesize(type, this.ctx.destination, this.ctx.currentTime, params);
        // Suspend context after preview to prevent idle static on Realtek drivers
        this._idleSuspendTimer = setTimeout(() => {
            if (this.ctx && this.ctx.state === 'running') {
                this.ctx.suspend().catch(() => {});
            }
        }, 4000);
    }

    // Render to offline buffer for export
    async renderToBuffer(type, params, duration = 2.0) {
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
        const origCtx = this.ctx;
        const origNoise = this._noiseBuffer;
        const origReverbIR = this._reverbIR;
        this.ctx = offline;
        this._noiseBuffer = this._offlineNoise || null;
        this._reverbIR = null; // Force regeneration for offline context
        this.synthesize(type, offline.destination, 0, params);
        this.ctx = origCtx;
        this._noiseBuffer = origNoise;
        this._reverbIR = origReverbIR;
        const rendered = await offline.startRendering();
        // Normalize to -6dB headroom
        const data = rendered.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
        if (peak > 0) {
            const target = 0.5012; // -6dB
            const scale = target / peak;
            for (let i = 0; i < data.length; i++) data[i] *= scale;
        }
        // Trim trailing silence
        let end = data.length - 1;
        while (end > 0 && Math.abs(data[end]) < 0.0001) end--;
        end = Math.min(data.length, end + Math.ceil(sr * 0.02)); // 20ms fade-out tail
        const trimmed = offline.createBuffer ? rendered : rendered; // keep full if short
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
