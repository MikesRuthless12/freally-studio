import { AudioEffect } from './AudioEffect.js';

/**
 * BitCrusher — Bit depth reduction + sample rate simulation.
 *
 * Signal chain:
 *   input -> WaveShaperNode(quantized steps, no oversample)
 *   -> lowpassFilter(sample rate simulation) -> _wetGain
 *
 * The WaveShaper quantizes amplitude levels to simulate reduced bit depth.
 * The lowpass filter simulates reduced sample rate by cutting high frequencies.
 */
export class BitCrusher extends AudioEffect {
    constructor() {
        super('BitCrusher', {
            bitDepth: 8,
            sampleRate: 0.5,
            mix: 0.7
        });
        this._waveshaper = null;
        this._srFilter = null;
    }

    _buildGraph(ctx) {
        const waveshaper = ctx.createWaveShaper();
        waveshaper.oversample = 'none';
        this._registerNode(waveshaper);
        this._waveshaper = waveshaper;

        const srFilter = ctx.createBiquadFilter();
        srFilter.type = 'lowpass';
        srFilter.Q.value = 0.5;
        this._registerNode(srFilter);
        this._srFilter = srFilter;

        this.input.connect(waveshaper);
        waveshaper.connect(srFilter);
        srFilter.connect(this._wetGain);

        this._updateCurve(this.params.bitDepth);
        this._updateSampleRate(this.params.sampleRate);
    }

    _updateCurve(bitDepth) {
        const samples = 8192;
        const curve = new Float32Array(samples);
        const levels = Math.pow(2, Math.max(1, Math.round(bitDepth)));

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / (samples - 1) - 1;
            curve[i] = Math.round(x * levels) / levels;
        }

        this._waveshaper.curve = curve;
    }

    _updateSampleRate(rate) {
        // Map 0-1 to frequency range: 500Hz (crushed) to Nyquist
        const nyquist = (this._ctx.sampleRate || 44100) / 2;
        const freq = 500 + rate * (nyquist - 500);
        this._srFilter.frequency.setValueAtTime(freq, this._ctx.currentTime);
    }

    _applyParam(key, value) {
        if (!this._waveshaper) return;

        switch (key) {
            case 'bitDepth':
                this._updateCurve(value);
                break;
            case 'sampleRate':
                this._updateSampleRate(value);
                break;
        }
    }
}

AudioEffect.register('BitCrusher', BitCrusher);
