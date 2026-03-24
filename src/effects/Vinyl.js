import { AudioEffect } from './AudioEffect.js';

/**
 * Vinyl — Vinyl record emulation with crackle, rumble, wobble, and warmth.
 *
 * Signal chain:
 *   input -> warmthFilter(lowshelf) -> rolloffFilter(lowpass)
 *   -> waveshaper(gentle saturation) -> wobbleDelay(LFO) -> outputMixer -> _wetGain
 *
 *   crackleSource(impulse noise) -> crackleGain -> outputMixer
 *   rumbleOsc(low sine) -> rumbleGain -> outputMixer
 *   wobbleLFO -> wobbleLFOGain -> wobbleDelay.delayTime
 */
export class Vinyl extends AudioEffect {
    constructor() {
        super('Vinyl', {
            crackle: 0.2,
            rumble: 0.1,
            wobble: 0.15,
            wobbleRate: 0.8,
            rolloff: 12000,
            warmth: 0.3,
            mix: 1.0
        });
        this._warmthFilter = null;
        this._rolloffFilter = null;
        this._waveshaper = null;
        this._wobbleDelay = null;
        this._wobbleLFO = null;
        this._wobbleLFOGain = null;
        this._crackleSource = null;
        this._crackleGain = null;
        this._rumbleOsc = null;
        this._rumbleGain = null;
        this._outputMixer = null;
    }

    _buildGraph(ctx) {
        // Warmth (low shelf boost)
        const warmthFilter = ctx.createBiquadFilter();
        warmthFilter.type = 'lowshelf';
        warmthFilter.frequency.value = 400;
        warmthFilter.gain.value = this.params.warmth * 6;
        this._registerNode(warmthFilter);
        this._warmthFilter = warmthFilter;

        // Rolloff (high frequency cut — vinyl has limited HF)
        const rolloffFilter = ctx.createBiquadFilter();
        rolloffFilter.type = 'lowpass';
        rolloffFilter.frequency.value = this.params.rolloff;
        rolloffFilter.Q.value = 0.5;
        this._registerNode(rolloffFilter);
        this._rolloffFilter = rolloffFilter;

        // Gentle saturation
        const waveshaper = ctx.createWaveShaper();
        waveshaper.oversample = '2x';
        waveshaper.curve = this._createGentleCurve();
        this._registerNode(waveshaper);
        this._waveshaper = waveshaper;

        // Wobble (pitch variation via modulated delay)
        const wobbleDelay = ctx.createDelay(0.05);
        wobbleDelay.delayTime.value = 0.005;
        this._registerNode(wobbleDelay);
        this._wobbleDelay = wobbleDelay;

        const wobbleLFO = ctx.createOscillator();
        wobbleLFO.type = 'sine';
        wobbleLFO.frequency.value = this.params.wobbleRate;
        this._registerNode(wobbleLFO);
        this._wobbleLFO = wobbleLFO;

        const wobbleLFOGain = ctx.createGain();
        wobbleLFOGain.gain.value = this.params.wobble * 0.003;
        this._registerNode(wobbleLFOGain);
        this._wobbleLFOGain = wobbleLFOGain;

        // Output mixer
        const outputMixer = ctx.createGain();
        outputMixer.gain.value = 1.0;
        this._registerNode(outputMixer);
        this._outputMixer = outputMixer;

        // Crackle noise (sparse impulse noise)
        const crackleGain = ctx.createGain();
        crackleGain.gain.value = this.params.crackle * 0.15;
        this._registerNode(crackleGain);
        this._crackleGain = crackleGain;

        const crackleBuffer = this._createCrackleBuffer(ctx);
        const crackleSource = ctx.createBufferSource();
        crackleSource.buffer = crackleBuffer;
        crackleSource.loop = true;
        this._registerNode(crackleSource);
        this._crackleSource = crackleSource;

        // Rumble (low frequency oscillator)
        const rumbleOsc = ctx.createOscillator();
        rumbleOsc.type = 'sine';
        rumbleOsc.frequency.value = 33.3; // 33 1/3 RPM fundamental
        this._registerNode(rumbleOsc);
        this._rumbleOsc = rumbleOsc;

        const rumbleGain = ctx.createGain();
        rumbleGain.gain.value = this.params.rumble * 0.05;
        this._registerNode(rumbleGain);
        this._rumbleGain = rumbleGain;

        // Signal chain
        this.input.connect(warmthFilter);
        warmthFilter.connect(rolloffFilter);
        rolloffFilter.connect(waveshaper);
        waveshaper.connect(wobbleDelay);
        wobbleDelay.connect(outputMixer);
        outputMixer.connect(this._wetGain);

        // Wobble LFO
        wobbleLFO.connect(wobbleLFOGain);
        wobbleLFOGain.connect(wobbleDelay.delayTime);
        wobbleLFO.start();

        // Crackle
        crackleSource.connect(crackleGain);
        crackleGain.connect(outputMixer);
        crackleSource.start();

        // Rumble
        rumbleOsc.connect(rumbleGain);
        rumbleGain.connect(outputMixer);
        rumbleOsc.start();
    }

    _createGentleCurve() {
        const samples = 8192;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / (samples - 1) - 1;
            curve[i] = Math.tanh(x * 1.2);
        }
        return curve;
    }

    _createCrackleBuffer(ctx) {
        const length = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        // Sparse impulse noise — mostly silence with occasional pops
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() < 0.002 ? (Math.random() * 2 - 1) : 0;
        }
        return buffer;
    }

    _applyParam(key, value) {
        if (!this._waveshaper) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'crackle':
                this._crackleGain.gain.setValueAtTime(value * 0.15, t);
                break;
            case 'rumble':
                this._rumbleGain.gain.setValueAtTime(value * 0.05, t);
                break;
            case 'wobble':
                this._wobbleLFOGain.gain.setValueAtTime(value * 0.003, t);
                break;
            case 'wobbleRate':
                this._wobbleLFO.frequency.setValueAtTime(value, t);
                break;
            case 'rolloff':
                this._rolloffFilter.frequency.setValueAtTime(value, t);
                break;
            case 'warmth':
                this._warmthFilter.gain.setValueAtTime(value * 6, t);
                break;
        }
    }
}

AudioEffect.register('Vinyl', Vinyl);
