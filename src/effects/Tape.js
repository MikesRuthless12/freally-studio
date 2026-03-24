import { AudioEffect } from './AudioEffect.js';

/**
 * Tape — Analog tape emulation with saturation, flutter, hiss, and rolloff.
 *
 * Signal chain:
 *   input -> preGain -> WaveShaperNode(tanh saturation)
 *   -> lowshelf(warmth) -> highshelf(rolloff)
 *   -> delayNode(flutter via LFO) -> outputMixer -> _wetGain
 *
 *   noiseSource(white noise buffer) -> noiseGain -> outputMixer
 *   flutterLFO -> flutterLFOGain -> delayNode.delayTime
 */
export class Tape extends AudioEffect {
    constructor() {
        super('Tape', {
            drive: 0.3,
            warmth: 0.5,
            flutter: 0.2,
            flutterRate: 4.0,
            hiss: 0.05,
            rolloff: 8000,
            mix: 1.0
        });
        this._preGain = null;
        this._waveshaper = null;
        this._warmthFilter = null;
        this._rolloffFilter = null;
        this._flutterDelay = null;
        this._flutterLFO = null;
        this._flutterLFOGain = null;
        this._noiseSource = null;
        this._noiseGain = null;
        this._outputMixer = null;
    }

    _buildGraph(ctx) {
        // Saturation
        const preGain = ctx.createGain();
        preGain.gain.value = 1 + this.params.drive * 4;
        this._registerNode(preGain);
        this._preGain = preGain;

        const waveshaper = ctx.createWaveShaper();
        waveshaper.oversample = '2x';
        waveshaper.curve = this._createTanhCurve();
        this._registerNode(waveshaper);
        this._waveshaper = waveshaper;

        // EQ: warmth (low shelf boost) + rolloff (high shelf cut)
        const warmthFilter = ctx.createBiquadFilter();
        warmthFilter.type = 'lowshelf';
        warmthFilter.frequency.value = 300;
        warmthFilter.gain.value = this.params.warmth * 6;
        this._registerNode(warmthFilter);
        this._warmthFilter = warmthFilter;

        const rolloffFilter = ctx.createBiquadFilter();
        rolloffFilter.type = 'lowpass';
        rolloffFilter.frequency.value = this.params.rolloff;
        rolloffFilter.Q.value = 0.7;
        this._registerNode(rolloffFilter);
        this._rolloffFilter = rolloffFilter;

        // Flutter (pitch wobble via modulated delay)
        const flutterDelay = ctx.createDelay(0.05);
        flutterDelay.delayTime.value = 0.005;
        this._registerNode(flutterDelay);
        this._flutterDelay = flutterDelay;

        const flutterLFO = ctx.createOscillator();
        flutterLFO.type = 'sine';
        flutterLFO.frequency.value = this.params.flutterRate;
        this._registerNode(flutterLFO);
        this._flutterLFO = flutterLFO;

        const flutterLFOGain = ctx.createGain();
        flutterLFOGain.gain.value = this.params.flutter * 0.002;
        this._registerNode(flutterLFOGain);
        this._flutterLFOGain = flutterLFOGain;

        // Output mixer
        const outputMixer = ctx.createGain();
        outputMixer.gain.value = 1.0;
        this._registerNode(outputMixer);
        this._outputMixer = outputMixer;

        // Hiss (white noise)
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = this.params.hiss;
        this._registerNode(noiseGain);
        this._noiseGain = noiseGain;

        const noiseBuffer = this._createNoiseBuffer(ctx);
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        this._registerNode(noiseSource);
        this._noiseSource = noiseSource;

        // Signal chain
        this.input.connect(preGain);
        preGain.connect(waveshaper);
        waveshaper.connect(warmthFilter);
        warmthFilter.connect(rolloffFilter);
        rolloffFilter.connect(flutterDelay);
        flutterDelay.connect(outputMixer);
        outputMixer.connect(this._wetGain);

        // Flutter LFO
        flutterLFO.connect(flutterLFOGain);
        flutterLFOGain.connect(flutterDelay.delayTime);
        flutterLFO.start();

        // Hiss noise
        noiseSource.connect(noiseGain);
        noiseGain.connect(outputMixer);
        noiseSource.start();
    }

    _createTanhCurve() {
        const samples = 8192;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / (samples - 1) - 1;
            curve[i] = Math.tanh(x * 2);
        }
        return curve;
    }

    _createNoiseBuffer(ctx) {
        const length = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    _applyParam(key, value) {
        if (!this._waveshaper) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'drive':
                this._preGain.gain.setValueAtTime(1 + value * 4, t);
                break;
            case 'warmth':
                this._warmthFilter.gain.setValueAtTime(value * 6, t);
                break;
            case 'flutter':
                this._flutterLFOGain.gain.setValueAtTime(value * 0.002, t);
                break;
            case 'flutterRate':
                this._flutterLFO.frequency.setValueAtTime(value, t);
                break;
            case 'hiss':
                this._noiseGain.gain.setValueAtTime(value, t);
                break;
            case 'rolloff':
                this._rolloffFilter.frequency.setValueAtTime(value, t);
                break;
        }
    }
}

AudioEffect.register('Tape', Tape);
