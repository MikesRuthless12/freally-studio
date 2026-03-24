// InstrumentSynthEngine.js — Hidden Instrument Synthesis Studio Engine
// Professional multi-instrument melodic sound design via Web Audio API synthesis

export const INSTRUMENT_TYPES = [
    'brass',
    'synthLead', 'synthArp', 'synthPluck', 'fmSynth',
    'electricPiano',
    'flute',
    'acousticGuitar',
    'steelGuitar',
    'electricGuitar'
];

export const INSTRUMENT_LABELS = {
    brass: 'Brass Stab',
    synthLead: 'Synth Lead', synthArp: 'Synth Arp', synthPluck: 'Synth Pluck', fmSynth: 'FM Synth',
    electricPiano: 'Electric Piano',
    flute: 'Flute',
    acousticGuitar: 'Acoustic Guitar',
    steelGuitar: 'Steel Guitar',
    electricGuitar: 'Electric Guitar'
};

// Reusable standard parameters for quick definition
const ADSR = [
    { key: 'attack', label: 'Attack', min: 0.001, max: 2.0, default: 0.05 },
    { key: 'decay', label: 'Decay', min: 0.01, max: 2.0, default: 0.3 },
    { key: 'sustain', label: 'Sustain', min: 0, max: 1, default: 0.5 },
    { key: 'release', label: 'Release', min: 0.01, max: 3.0, default: 0.4 },
];
const FILTERS = [
    { key: 'cutoff', label: 'Cutoff', min: 100, max: 10000, default: 2000 },
    { key: 'resonance', label: 'Resonance', min: 0, max: 20, default: 2 },
    { key: 'envAmount', label: 'Env Amt', min: 0, max: 5000, default: 1500 },
];
const EFFECTS = [
    { key: 'drive', label: 'Drive', min: 0, max: 1, default: 0 },
    { key: 'vibratoRate', label: 'Vib Rate', min: 1, max: 12, default: 5 },
    { key: 'vibratoDepth', label: 'Vib Depth', min: 0, max: 50, default: 10 },
    { key: 'chorus', label: 'Chorus', min: 0, max: 1, default: 0 },
    { key: 'volume', label: 'Volume', min: 0, max: 1, default: 0.8 }
];

// Combine helper
const makeParams = (...arrays) => [].concat(...arrays);

export const PARAM_DEFS = {
    brass: makeParams(ADSR, FILTERS, EFFECTS),
    frenchHorn: makeParams(ADSR, FILTERS, EFFECTS),
    violin: makeParams(ADSR, FILTERS, EFFECTS, [{ key: 'bowNoise', label: 'Bow Noise', min: 0, max: 1, default: 0.1 }]),
    cello: makeParams(ADSR, FILTERS, EFFECTS, [{ key: 'bodyRes', label: 'Body Res', min: 50, max: 500, default: 200 }]),
    uprightBass: makeParams(ADSR, FILTERS, EFFECTS, [{ key: 'pluckNoise', label: 'Pluck', min: 0, max: 1, default: 0.5 }]),

    synthLead: makeParams(ADSR, FILTERS, EFFECTS, [{ key: 'detune', label: 'Detune', min: 0, max: 100, default: 15 }]),
    synthArp: makeParams(ADSR, FILTERS, EFFECTS, [{ key: 'pulseWidth', label: 'PWM', min: 0.1, max: 0.9, default: 0.5 }]),
    fmSynth: makeParams(ADSR, EFFECTS, [
        { key: 'modIndex', label: 'Mod Idx', min: 0, max: 10, default: 2 },
        { key: 'modRatio', label: 'Mod Ratio', min: 0.5, max: 8, default: 2 },
        { key: 'fbAmount', label: 'Feedback', min: 0, max: 1, default: 0 }
    ]),
    synthPluck: makeParams(
        [
            { key: 'attack', label: 'Attack', min: 0.001, max: 2.0, default: 0.01 },
            { key: 'decay', label: 'Decay', min: 0.01, max: 2.0, default: 0.4 },
            { key: 'sustain', label: 'Sustain', min: 0, max: 1, default: 0.0 },
            { key: 'release', label: 'Release', min: 0.01, max: 3.0, default: 0.3 }
        ],
        FILTERS, EFFECTS, [
        { key: 'pitchDrop', label: 'Pitch Drop', min: 0, max: 24, default: 12 }, // Semitones to drop
        { key: 'pitchDecay', label: 'Pitch Decay', min: 0.01, max: 1.0, default: 0.1 } // Speed of the pitch drop
    ]),
    pluck: makeParams(ADSR, FILTERS, EFFECTS),

    electricGuitar: makeParams(
        [
            { key: 'attack', label: 'Attack', min: 0.001, max: 2.0, default: 0.02 },
            { key: 'decay', label: 'Decay', min: 0.01, max: 2.0, default: 0.8 },
            { key: 'sustain', label: 'Sustain', min: 0, max: 1, default: 0.1 },
            { key: 'release', label: 'Release', min: 0.01, max: 3.0, default: 0.6 }
        ],
        EFFECTS, [
        { key: 'ampTone', label: 'Amp Tone', min: 500, max: 8000, default: 3000 },
        { key: 'cabinet', label: 'Cabinet', min: 0, max: 1, default: 0.8 }
    ]),
    acousticGuitar: makeParams(
        [
            { key: 'attack', label: 'Attack', min: 0.001, max: 2.0, default: 0.01 },
            { key: 'decay', label: 'Decay', min: 0.01, max: 2.0, default: 0.5 },
            { key: 'sustain', label: 'Sustain', min: 0, max: 1, default: 0.0 }, // Guitars don't sustain by default
            { key: 'release', label: 'Release', min: 0.01, max: 3.0, default: 0.4 }
        ],
        EFFECTS, [
        { key: 'decayTime', label: 'String Dec', min: 0.1, max: 4.0, default: 1.5 }, // Faster string decay default
        { key: 'brightness', label: 'Bright', min: 1000, max: 10000, default: 5000 }
    ]),
    steelGuitar: makeParams(
        [
            { key: 'attack', label: 'Attack', min: 0.001, max: 2.0, default: 0.015 },
            { key: 'decay', label: 'Decay', min: 0.01, max: 2.0, default: 0.6 },
            { key: 'sustain', label: 'Sustain', min: 0, max: 1, default: 0.0 },
            { key: 'release', label: 'Release', min: 0.01, max: 3.0, default: 0.5 }
        ],
        EFFECTS, [
        { key: 'decayTime', label: 'String Dec', min: 0.1, max: 4.0, default: 3.0 },
        { key: 'brightness', label: 'Bright', min: 1000, max: 12000, default: 8000 }
    ]),

    flute: makeParams(ADSR, EFFECTS, [
        { key: 'breath', label: 'Breath', min: 0, max: 1, default: 0.4 },
        { key: 'overblow', label: 'Overblow', min: 0, max: 1, default: 0.1 }
    ]),
    clarinet: makeParams(ADSR, FILTERS, EFFECTS, [{ key: 'breath', label: 'Breath', min: 0, max: 1, default: 0.2 }]),
    saxophone: makeParams(ADSR, FILTERS, EFFECTS, [
        { key: 'breath', label: 'Breath', min: 0, max: 1, default: 0.3 },
        { key: 'growl', label: 'Growl', min: 0, max: 1, default: 0.2 }
    ]),

    electricPiano: makeParams(ADSR, EFFECTS, [
        { key: 'tineAmount', label: 'Tine', min: 0, max: 1, default: 0.6 },
        { key: 'bodyAmount', label: 'Body', min: 0, max: 1, default: 0.7 },
        { key: 'tremolo', label: 'Tremolo', min: 0, max: 1, default: 0.3 }
    ]),
    grandPiano: makeParams(ADSR, EFFECTS, [
        { key: 'hammer', label: 'Hammer', min: 0, max: 1, default: 0.5 },
        { key: 'stringRes', label: 'String Res', min: 0, max: 1, default: 0.4 }
    ]),
    pipeOrgan: makeParams(ADSR, EFFECTS, [
        { key: 'subOctave', label: 'Sub 16"', min: 0, max: 1, default: 0.8 },
        { key: 'highOctave', label: 'High 4"', min: 0, max: 1, default: 0.6 }
    ]),

    chiptune: makeParams(ADSR, EFFECTS, [
        { key: 'duty', label: 'Duty Cycle', min: 0.05, max: 0.5, default: 0.25 },
        { key: 'bitcrush', label: 'Bitcrush', min: 0, max: 1, default: 0.8 }
    ]),
    choir: makeParams(ADSR, EFFECTS, [
        { key: 'formant1', label: 'Formant 1', min: 200, max: 1000, default: 600 },
        { key: 'formant2', label: 'Formant 2', min: 800, max: 2500, default: 1200 },
        { key: 'vowel', label: 'Vowel (A/O/E)', min: 0, max: 1, default: 0.5 }
    ])
};

// Preset library (simplified for now but structured)
export const PRESETS = {
    brass: [
        { name: 'Cinematic Orchestral Stab', params: { attack: 0.05, decay: 0.4, sustain: 0.1, release: 0.6, cutoff: 4000, envAmount: 5000, drive: 0.15, chorus: 0.1 } },
        { name: 'Slow Swell Horns', params: { attack: 0.4, decay: 1.0, sustain: 0.8, release: 2.0, cutoff: 800, envAmount: 2000, drive: 0.05, chorus: 0.3 } },
        { name: 'Trap Heavy Brass', params: { attack: 0.02, decay: 0.5, sustain: 0.4, release: 0.6, cutoff: 1500, envAmount: 3000, drive: 0.4, chorus: 0.05 } }
    ],
    synthLead: [
        { name: 'EDM Supersaw', params: { attack: 0.02, decay: 0.4, sustain: 0.6, release: 0.5, detune: 40, cutoff: 8000, envAmount: 2000 } },
        { name: 'G-Funk Sine', params: { attack: 0.1, decay: 0.2, sustain: 0.9, release: 0.3, detune: 5, cutoff: 1200, drive: 0.2, vibratoDepth: 15 } }
    ],
    synthPluck: [
        { name: 'Laser Pluck', params: { attack: 0.01, decay: 0.3, sustain: 0.0, release: 0.2, pitchDrop: 24, pitchDecay: 0.05, cutoff: 8000, envAmount: 5000 } },
        { name: 'Deep House Donk', params: { attack: 0.02, decay: 0.4, sustain: 0.0, release: 0.3, pitchDrop: 12, pitchDecay: 0.1, cutoff: 1500, envAmount: 3000, drive: 0.2 } },
        { name: 'Soft Analog Ping', params: { attack: 0.05, decay: 0.8, sustain: 0.0, release: 0.8, pitchDrop: 5, pitchDecay: 0.2, cutoff: 3000, envAmount: 1000 } }
    ],
    acousticGuitar: [
        { name: 'Nylon Pluck', params: { attack: 0.01, decay: 0.8, sustain: 0.0, release: 0.5, decayTime: 1.5, brightness: 4000 } }
    ],
    steelGuitar: [
        { name: 'Bright Strum', params: { attack: 0.02, decay: 1.5, sustain: 0.0, release: 1.0, decayTime: 3.0, brightness: 8000, chorus: 0.1 } },
        { name: 'Country Twang', params: { attack: 0.01, decay: 0.6, sustain: 0.0, release: 0.4, decayTime: 1.0, brightness: 10000, drive: 0.1 } }
    ],
    electricGuitar: [
        { name: 'Clean Chorus', params: { attack: 0.02, decay: 0.8, sustain: 0.2, release: 0.5, ampTone: 4000, chorus: 0.4, drive: 0.0 } },
        { name: 'Overdriven Lead', params: { attack: 0.05, decay: 0.3, sustain: 0.8, release: 0.4, ampTone: 2000, chorus: 0.0, drive: 0.8 } },
        { name: 'Muted Crunch', params: { attack: 0.01, decay: 0.3, sustain: 0.0, release: 0.2, ampTone: 1500, chorus: 0.0, drive: 0.6 } }
    ]
};

export const getDefaults = (type) => {
    const defs = PARAM_DEFS[type] || [];
    const obj = {};
    defs.forEach(p => obj[p.key] = p.default);
    return obj;
};

export class InstrumentSynthEngine {
    constructor() {
        this.ctx = null;
    }

    createEffectsChain(ctx, source, params) {
        const chain = {
            input: ctx.createGain(),
            output: ctx.createGain(),
            nodes: []
        };

        let current = chain.input;

        // 1. Drive / Saturation
        if (params.drive > 0) {
            const waveshaper = ctx.createWaveShaper();
            waveshaper.curve = this.makeDistortionCurve(params.drive * 100);
            waveshaper.oversample = '4x';
            current.connect(waveshaper);
            current = waveshaper;
            chain.nodes.push(waveshaper);

            // Gain compensation for drive
            const comp = ctx.createGain();
            comp.gain.value = 1 - (params.drive * 0.4);
            current.connect(comp);
            current = comp;
            chain.nodes.push(comp);
        }

        // 2. Chorus
        if (params.chorus > 0) {
            const delay = ctx.createDelay();
            delay.delayTime.value = 0.03;

            const lfo = ctx.createOscillator();
            lfo.frequency.value = 1.5;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.01 * params.chorus;
            lfo.connect(lfoGain);
            lfoGain.connect(delay.delayTime);
            lfo.start();

            const mix = ctx.createGain();
            mix.gain.value = params.chorus;
            current.connect(delay);
            delay.connect(mix);

            // Mix dry and wet
            const sum = ctx.createGain();
            current.connect(sum);
            mix.connect(sum);
            current = sum;

            chain.nodes.push(delay, lfo, lfoGain, mix, sum);
        }

        // Master Volume
        const master = ctx.createGain();
        master.gain.value = params.volume || 0.8;
        current.connect(master);
        master.connect(chain.output);
        chain.nodes.push(master);

        source.connect(chain.input);
        return chain.output;
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    applyADSR(ctx, gainNode, params, duration) {
        const t = ctx.currentTime;
        const a = params.attack || 0.05;
        const d = params.decay || 0.3;
        const s = params.sustain ?? 0.5;
        const r = params.release || 0.4;

        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(1, t + a);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, s), t + a + d);

        // Hold sustain until release Phase
        const releaseStart = Math.max(t + a + d, t + duration - r);
        gainNode.gain.setValueAtTime(Math.max(0.001, s), releaseStart);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, releaseStart + r);
    }

    applyFilterEnv(ctx, filterNode, params, duration) {
        if (!filterNode) return;
        const t = ctx.currentTime;
        const a = params.attack || 0.05;
        const d = params.decay || 0.3;
        const base = params.cutoff || 2000;
        const amt = params.envAmount || 1500;

        filterNode.frequency.setValueAtTime(base, t);
        filterNode.frequency.exponentialRampToValueAtTime(Math.min(20000, base + amt), t + a);
        filterNode.frequency.exponentialRampToValueAtTime(base, t + a + d);
    }

    createVibrato(ctx, targetParam, params) {
        if (params.vibratoDepth > 0) {
            const lfo = ctx.createOscillator();
            lfo.frequency.value = params.vibratoRate || 5;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = params.vibratoDepth;
            lfo.connect(lfoGain);
            lfoGain.connect(targetParam);
            lfo.start();
            return { lfo, lfoGain };
        }
        return null;
    }

    async renderToBuffer(type, params, duration = 2.0, noteFrequency = 261.63) { // Default C4
        const sampleRate = 44100;
        const totalDuration = duration + (params.release || 0.0);
        const ctx = new OfflineAudioContext(1, sampleRate * totalDuration, sampleRate);
        const t = ctx.currentTime;

        const synthOutput = ctx.createGain();

        switch (type) {
            case 'brass':
            case 'frenchHorn':
                this.renderBrass(ctx, synthOutput, params, duration, noteFrequency, type === 'frenchHorn');
                break;
            case 'violin':
            case 'cello':
                this.renderString(ctx, synthOutput, params, duration, noteFrequency, type === 'cello');
                break;
            case 'synthLead':
            case 'synthArp':
                this.renderSubtractive(ctx, synthOutput, params, duration, noteFrequency);
                break;
            case 'synthPluck':
                this.renderSynthPluck(ctx, synthOutput, params, duration, noteFrequency);
                break;
            case 'fmSynth':
            case 'electricPiano': // Uses FM under the hood
                this.renderFM(ctx, synthOutput, params, duration, noteFrequency, type === 'electricPiano');
                break;
            case 'acousticGuitar':
            case 'steelGuitar':
                this.renderKarplusStrong(ctx, synthOutput, params, duration, noteFrequency, type === 'steelGuitar');
                break;
            case 'electricGuitar':
                this.renderElectricGuitar(ctx, synthOutput, params, duration, noteFrequency);
                break;
            case 'pipeOrgan':
                this.renderAdditive(ctx, synthOutput, params, duration, noteFrequency);
                break;
            case 'flute':
            case 'clarinet':
                this.renderWoodwind(ctx, synthOutput, params, duration, noteFrequency, type === 'clarinet');
                break;
            default:
                // Fallback to basic subtractive saw synth
                this.renderSubtractive(ctx, synthOutput, params, duration, noteFrequency);
                break;
        }

        const outNode = this.createEffectsChain(ctx, synthOutput, params);
        outNode.connect(ctx.destination);

        return { buffer: await ctx.startRendering(), ctx };
    }

    // --- Specific Synth Algorithms ---

    renderBrass(ctx, out, params, duration, freq, isHorn) {
        // Advanced Brass Synthesis (Hyper-realistic Section)

        // 1. Core Section (Multiple Saw Layers for Chorusing)
        const numSaws = 5;
        const detuneAmounts = [-8, -3, 0, +3, +8]; // Cents detune
        const saws = [];
        const sawMix = ctx.createGain();
        sawMix.gain.value = 0.6 / numSaws; // Prevent clipping

        for (let i = 0; i < numSaws; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            // Apply detune
            osc.frequency.value = freq * Math.pow(2, detuneAmounts[i] / 1200);

            // "Lip Tension" pitch envelope on each player (slightly randomized)
            const pitchEnvAmt = freq * (0.03 + (Math.random() * 0.02));
            osc.frequency.setValueAtTime(osc.frequency.value - pitchEnvAmt, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(osc.frequency.value, ctx.currentTime + 0.08 + (Math.random() * 0.04));

            this.createVibrato(ctx, osc.frequency, params);
            osc.connect(sawMix);
            saws.push(osc);
        }

        // Sub oscillator for chest/body resonance
        const subOsc = ctx.createOscillator();
        subOsc.type = 'square';
        subOsc.frequency.value = freq / 2;
        const subMix = ctx.createGain();
        subMix.gain.value = 0.15;
        subOsc.connect(subMix);

        // 2. FM "Blat/Spit" Layer (Harsh attack resonance)
        const fmCarrier = ctx.createOscillator();
        const fmMod = ctx.createOscillator();
        fmCarrier.type = 'sine';
        fmMod.type = 'sawtooth';
        fmCarrier.frequency.value = freq;
        fmMod.frequency.value = freq * 2; // Exact 2nd harmonic

        const fmModEnv = ctx.createGain();
        fmModEnv.gain.setValueAtTime(0, ctx.currentTime);
        fmModEnv.gain.linearRampToValueAtTime(freq * 3.5, ctx.currentTime + (params.attack || 0.05));
        fmModEnv.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

        fmMod.connect(fmModEnv);
        fmModEnv.connect(fmCarrier.frequency);
        const fmMix = ctx.createGain();
        fmMix.gain.value = 0.25;
        fmCarrier.connect(fmMix);

        // 3. Breath Noise Burst
        const noise = this.createNoise(ctx);
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = freq * 3;
        noiseFilter.Q.value = 1;

        const noiseEnv = ctx.createGain();
        noiseEnv.gain.setValueAtTime(0, ctx.currentTime);
        noiseEnv.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
        noiseEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);

        // 4. Formant / Horn Body Filter (Fixed resonance peaks)
        const formantFilter = ctx.createBiquadFilter();
        formantFilter.type = 'peaking';
        formantFilter.frequency.value = 1200; // Typical brass throat resonance
        formantFilter.Q.value = 1.5;
        formantFilter.gain.value = 8; // Boost the "honk"

        // 5. Main Dynamic Lowpass (The "Mute / Open" sweep)
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = params.resonance || 1.5;

        // Routing
        sawMix.connect(filter);
        subMix.connect(filter);
        fmMix.connect(filter);
        noiseEnv.connect(filter);

        filter.connect(formantFilter);

        // Amplitude Envelope
        const env = ctx.createGain();
        this.applyADSR(ctx, env, params, duration);
        this.applyFilterEnv(ctx, filter, params, duration);

        formantFilter.connect(env);
        env.connect(out);

        // Start / Stop all
        const stopTime = ctx.currentTime + duration + (params.release || 1.5);
        saws.forEach(osc => { osc.start(); osc.stop(stopTime); });
        subOsc.start(); subOsc.stop(stopTime);
        fmCarrier.start(); fmMod.start();
        fmCarrier.stop(stopTime); fmMod.stop(stopTime);
        noise.start(); noise.stop(stopTime);
    }

    renderString(ctx, out, params, duration, freq, isCello) {
        // Advanced Orchestral String Ensemble Synthesis

        // 1. Core Section (Multiple players for lush chorusing)
        const numPlayers = isCello ? 4 : 5; // Cellos usually slightly smaller section
        const detuneSpread = 12; // Cents total spread
        const players = [];
        const stringMix = ctx.createGain();
        stringMix.gain.value = 0.8 / numPlayers;

        for (let i = 0; i < numPlayers; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth'; // Saw is best mathematically for bowed strings

            // Spread tuning slightly
            const detune = (i / (numPlayers - 1) - 0.5) * detuneSpread;
            osc.frequency.value = freq * Math.pow(2, detune / 1200);

            // Independent Vibrato per player (crucial for ensemble realism)
            if (params.vibratoDepth > 0) {
                const lfo = ctx.createOscillator();
                // Randomize LFO rates slightly so they don't sync up perfectly
                lfo.frequency.value = (params.vibratoRate || 6) + (Math.random() * 1.0 - 0.5);
                const lfoGain = ctx.createGain();
                lfoGain.gain.value = (params.vibratoDepth || 15) * (0.8 + Math.random() * 0.4);
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                players.push({ osc, lfo });
            } else {
                players.push({ osc, lfo: null });
            }

            osc.connect(stringMix);
        }

        // 2. Wood Body Resonance Sub (Hollow warmth)
        const subOsc = ctx.createOscillator();
        subOsc.type = 'triangle'; // Smoother than square for strings
        subOsc.frequency.value = freq / 2; // Octave down for body support
        const subMix = ctx.createGain();
        subMix.gain.value = isCello ? 0.4 : 0.15; // Cellos have much more wood body
        subOsc.connect(subMix);

        // 3. Continuous Bow Friction Noise
        // Bowed strings aren't just pitched; there's constant rosin scrape
        const noise = this.createNoise(ctx);
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        // Noise center frequency follows the pitch somewhat, but higher
        noiseFilter.frequency.value = Math.min(freq * 3.5, 10000);
        noiseFilter.Q.value = 1.0;

        const noiseEnv = ctx.createGain();
        // The bow noise envelope isn't just a transient; it scales with the main envelope but slightly sharper
        noiseEnv.gain.setValueAtTime(0, ctx.currentTime);
        noiseEnv.gain.linearRampToValueAtTime((params.bowNoise || 0.25), ctx.currentTime + (params.attack || 0.1));
        noiseEnv.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);

        // 4. Formant / Body EQ Resonators
        const bodyRes = ctx.createBiquadFilter();
        bodyRes.type = 'peaking';
        bodyRes.frequency.value = isCello ? 250 : 800; // Cello boom vs Violin boxiness
        bodyRes.Q.value = 1.0;
        bodyRes.gain.value = 6;

        // Main Lowpass Filter
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = isCello ? 4000 : 7000;
        filter.Q.value = 0.5; // Very gentle cutoff

        stringMix.connect(filter);
        subMix.connect(filter);
        noiseEnv.connect(filter);

        filter.connect(bodyRes);

        // 5. Amplitude Envelope
        const env = ctx.createGain();
        this.applyADSR(ctx, env, params, duration);

        bodyRes.connect(env);
        env.connect(out);

        // Start/Stop
        const stopTime = ctx.currentTime + duration + (params.release || 1.5);
        players.forEach(p => {
            p.osc.start(); p.osc.stop(stopTime);
            if (p.lfo) { p.lfo.start(); p.lfo.stop(stopTime); }
        });
        subOsc.start(); subOsc.stop(stopTime);
        noise.start(); noise.stop(stopTime);
    }

    renderKarplusStrong(ctx, out, params, duration, freq, isSteel) {
        // Redesigned: Stable Subtractive/FM Pluck (replaces unstable physical string model)
        // This guarantees perfect ADSR envelope conformity and prevents waveform overloads

        // 1. Core String Oscillators (Detuned Sawtooths for thickness)
        const numOscs = 3;
        const detuneSpread = isSteel ? 15 : 8;
        const stringMix = ctx.createGain();
        stringMix.gain.value = 0.8 / numOscs;

        const oscs = [];
        for (let i = 0; i < numOscs; i++) {
            const osc = ctx.createOscillator();
            osc.type = isSteel ? 'sawtooth' : 'triangle';

            // Subtly spread pitches
            const detune = (i / (numOscs - 1) - 0.5) * detuneSpread;
            osc.frequency.value = freq * Math.pow(2, detune / 1200);

            // "Pluck Pitch Sweep" - slight immediate pitch drop from the pick tension
            osc.frequency.setValueAtTime(osc.frequency.value + (freq * 0.05), ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(osc.frequency.value, ctx.currentTime + 0.05);

            osc.connect(stringMix);
            oscs.push(osc);
        }

        // 2. Pick Transient (Short burst of high noise) 
        const noise = this.createNoise(ctx);
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = params.brightness || 5000;

        const noiseEnv = ctx.createGain();
        noiseEnv.gain.setValueAtTime(0, ctx.currentTime);
        noiseEnv.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.005);
        noiseEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);

        // 3. String Resonance Filter (Pluck Plunge)
        // The filter rapidly closes, creating the "Pluck" characteristic sound
        const pluckFilter = ctx.createBiquadFilter();
        pluckFilter.type = 'lowpass';
        pluckFilter.Q.value = 2.0;

        const baseCutoff = Math.min((params.brightness || 5000) * 0.5, 20000);
        const peakCutoff = Math.min((params.brightness || 5000) * 2.0, 20000);

        pluckFilter.frequency.setValueAtTime(baseCutoff, ctx.currentTime);
        pluckFilter.frequency.linearRampToValueAtTime(peakCutoff, ctx.currentTime + 0.01);
        pluckFilter.frequency.exponentialRampToValueAtTime(baseCutoff, ctx.currentTime + (params.decayTime || 1.5) * 0.5);

        stringMix.connect(pluckFilter);
        noiseEnv.connect(pluckFilter);

        // 4. Acoustic Body EQ (Wood resonance)
        const bodyEQ = ctx.createBiquadFilter();
        bodyEQ.type = 'peaking';
        bodyEQ.frequency.value = 200; // Wood boom
        bodyEQ.Q.value = 1.0;
        bodyEQ.gain.value = 6.0;

        pluckFilter.connect(bodyEQ);

        // 5. Total Amplitude Envelope (Guarantees tight fadeout)
        const masterEnv = ctx.createGain();
        this.applyADSR(ctx, masterEnv, params, duration);

        bodyEQ.connect(masterEnv);
        masterEnv.connect(out);

        // Start / Stop
        oscs.forEach(osc => {
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration + (params.release || 1.5));
        });
        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + 0.5);
    }

    renderSubtractive(ctx, out, params, duration, freq) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();

        osc1.type = params.pulseWidth ? 'square' : 'sawtooth';
        osc2.type = 'sawtooth';
        osc3.type = 'sawtooth';

        const detune = params.detune || 0;
        osc1.frequency.value = freq;
        osc2.frequency.value = freq * (1 + (detune / 1000));
        osc3.frequency.value = freq * (1 - (detune / 1000));

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = params.resonance || 1;

        const env = ctx.createGain();
        this.applyADSR(ctx, env, params, duration);
        this.applyFilterEnv(ctx, filter, params, duration);

        osc1.connect(filter);
        osc2.connect(filter);
        osc3.connect(filter);
        filter.connect(env);
        env.connect(out);

        osc1.start(); osc2.start(); osc3.start();
        osc1.stop(ctx.currentTime + duration + (params.release || 1));
        osc2.stop(ctx.currentTime + duration + (params.release || 1));
        osc3.stop(ctx.currentTime + duration + (params.release || 1));
    }

    renderFM(ctx, out, params, duration, freq, isEPiano) {
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();

        carrier.type = 'sine';
        modulator.type = 'sine';

        carrier.frequency.value = freq;
        const ratio = params.modRatio || (isEPiano ? 14 : 2);
        modulator.frequency.value = freq * ratio;

        const modIndex = params.modIndex || (isEPiano ? 1 : 2);
        const modGain = ctx.createGain();
        // Envelope for the modulator (creates the "tine" or spectral change over time)
        modGain.gain.setValueAtTime(0, ctx.currentTime);
        modGain.gain.linearRampToValueAtTime(freq * modIndex, ctx.currentTime + (params.attack || 0.01));
        modGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (params.decay || 0.5));

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);

        const env = ctx.createGain();
        this.applyADSR(ctx, env, params, duration);

        carrier.connect(env);

        if (isEPiano) {
            // Add body/warmth
            const body = ctx.createOscillator();
            body.type = 'triangle';
            body.frequency.value = freq;
            const bodyEnv = ctx.createGain();
            this.applyADSR(ctx, bodyEnv, { ...params, release: params.release * 1.5 }, duration);
            body.connect(bodyEnv);
            bodyEnv.connect(out);
            body.start();
            body.stop(ctx.currentTime + duration + (params.release * 1.5));

            // Tremolo
            const trem = ctx.createOscillator();
            trem.frequency.value = 4; // 4Hz tremolo
            const tremGain = ctx.createGain();
            tremGain.gain.value = params.tremolo || 0.3;
            trem.connect(tremGain);
            tremGain.connect(env.gain);
            trem.start();
        }

        env.connect(out);
        carrier.start(); modulator.start();
        carrier.stop(ctx.currentTime + duration + (params.release || 1));
        modulator.stop(ctx.currentTime + duration + (params.release || 1));
    }

    renderSynthPluck(ctx, out, params, duration, freq) {
        // High-energy synthetic pluck with dedicated Pitch drop envelope
        const numOscs = 3;
        const stringMix = ctx.createGain();
        stringMix.gain.value = 0.8 / numOscs;

        const oscs = [];
        for (let i = 0; i < numOscs; i++) {
            const osc = ctx.createOscillator();
            osc.type = i === 2 ? 'square' : 'sawtooth'; // Mix in some square for hollowness

            // Subtly spread pitches
            const detune = (i / (numOscs - 1) - 0.5) * 12; // Modest 12c spread
            const baseFreq = freq * Math.pow(2, detune / 1200);

            // Pitch Envelope (The "Pluck/Zap" effect)
            const dropSemitones = params.pitchDrop || 12;
            const dropRatio = Math.pow(2, dropSemitones / 12);
            const startFreq = baseFreq * dropRatio;

            osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq, ctx.currentTime + (params.pitchDecay || 0.1));

            osc.connect(stringMix);
            oscs.push(osc);
        }

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = params.resonance || 2;

        // Filter Envelope
        this.applyFilterEnv(ctx, filter, params, duration);

        const env = ctx.createGain();
        this.applyADSR(ctx, env, params, duration);

        stringMix.connect(filter);
        filter.connect(env);
        env.connect(out);

        oscs.forEach(osc => {
            osc.start(ctx.currentTime);
            // Must abide by master ADSR duration to prevent ringing/clipping artifacts
            osc.stop(ctx.currentTime + Math.max(0, duration) + (params.release || 1.5));
        });
    }

    renderElectricGuitar(ctx, out, params, duration, freq) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = params.ampTone || 4000;
        filter.Q.value = 1.5;

        // Feedback emulator
        const fbFilter = ctx.createBiquadFilter();
        fbFilter.type = 'peaking';
        fbFilter.frequency.value = freq * 3; // 3rd harmonic feedback
        fbFilter.gain.value = 10;

        const env = ctx.createGain();
        this.applyADSR(ctx, env, params, duration);

        osc.connect(fbFilter);
        fbFilter.connect(filter);
        filter.connect(env);
        env.connect(out);

        osc.start();
        osc.stop(ctx.currentTime + duration + (params.release || 1));
    }

    renderWoodwind(ctx, out, params, duration, freq, isClarinet) {
        const osc = ctx.createOscillator();
        osc.type = isClarinet ? 'square' : 'sine';
        osc.frequency.value = freq;

        this.createVibrato(ctx, osc.frequency, { vibratoDepth: 5, vibratoRate: 6 });

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = isClarinet ? 1500 : 2500;

        // Breath noise
        const noise = this.createNoise(ctx);
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = freq * 2;
        noiseFilter.Q.value = 1;

        const noiseGain = ctx.createGain();
        noiseGain.gain.value = params.breath || 0.2;

        const env = ctx.createGain();
        this.applyADSR(ctx, env, params, duration);

        osc.connect(filter);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);

        filter.connect(env);
        noiseGain.connect(env);
        env.connect(out);

        osc.start(); noise.start();
        osc.stop(ctx.currentTime + duration + (params.release || 1));
        noise.stop(ctx.currentTime + duration + (params.release || 1));
    }

    renderAdditive(ctx, out, params, duration, freq) {
        // Pipe Organ style additive synth
        const fundamentals = [
            { f: 0.5, g: params.subOctave || 0.8 }, // 16'
            { f: 1, g: 1.0 }, // 8'
            { f: 2, g: params.highOctave || 0.6 }, // 4'
            { f: 4, g: (params.highOctave || 0.6) * 0.5 } // 2'
        ];

        const env = ctx.createGain();
        this.applyADSR(ctx, env, params, duration);

        fundamentals.forEach(harm => {
            if (harm.g <= 0) return;
            const osc = ctx.createOscillator();
            osc.type = 'sine'; // Could mix in some square for vox humana
            osc.frequency.value = freq * harm.f;
            const g = ctx.createGain();
            g.gain.value = harm.g * 0.25;
            osc.connect(g);
            g.connect(env);
            osc.start();
            osc.stop(ctx.currentTime + duration + (params.release || 1));
        });

        env.connect(out);
    }

    createNoise(ctx) {
        const bufferSize = ctx.sampleRate * 2.0;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        return noise;
    }

    // --- Interactive Methods ---

    async preview(type, params, duration = 2.0, noteFrequency = 261.63) {
        if (!this.ctx) {
            // Reuse the shared AudioContext to avoid competing for audio hardware
            if (!window.sharedAnalysisCtx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
            }
            this.ctx = window.sharedAnalysisCtx;
        }
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        const t = this.ctx.currentTime;
        const outNode = this.createEffectsChain(this.ctx, this.ctx.createGain(), params);
        outNode.connect(this.ctx.destination);

        switch (type) {
            case 'brass':
            case 'frenchHorn':
                this.renderBrass(this.ctx, outNode, params, duration, noteFrequency, type === 'frenchHorn');
                break;
            case 'violin':
            case 'cello':
                this.renderString(this.ctx, outNode, params, duration, noteFrequency, type === 'cello');
                break;
            case 'synthLead':
            case 'synthArp':
                this.renderSubtractive(this.ctx, outNode, params, duration, noteFrequency);
                break;
            case 'fmSynth':
            case 'electricPiano':
                this.renderFM(this.ctx, outNode, params, duration, noteFrequency, type === 'electricPiano');
                break;
            case 'acousticGuitar':
            case 'steelGuitar':
                this.renderKarplusStrong(this.ctx, outNode, params, duration, noteFrequency, type === 'steelGuitar');
                break;
            case 'electricGuitar':
                this.renderElectricGuitar(this.ctx, outNode, params, duration, noteFrequency);
                break;
            case 'pipeOrgan':
                this.renderAdditive(this.ctx, outNode, params, duration, noteFrequency);
                break;
            case 'flute':
            case 'clarinet':
                this.renderWoodwind(this.ctx, outNode, params, duration, noteFrequency, type === 'clarinet');
                break;
            default:
                this.renderSubtractive(this.ctx, outNode, params, duration, noteFrequency);
                break;
        }
    }

    exportWAV(audioBuffer) {
        // We do not trim instruments like we trim drums (we want the full decay tail)
        const numChannels = 1;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);   // format chunk length
        view.setUint16(20, 1, true);    // sample format (1 = PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, numChannels * 2, true); // block align
        view.setUint16(34, 16, true);   // bits per sample
        writeString(view, 36, 'data');
        view.setUint32(40, length * 2, true); // data chunk length

        const channelData = audioBuffer.getChannelData(0);
        let offset = 44;
        for (let i = 0; i < length; i++) {
            let sample = Math.max(-1, Math.min(1, channelData[i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }

        return new Blob([view], { type: 'audio/wav' });
    }
}
