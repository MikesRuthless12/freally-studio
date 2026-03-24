import { AudioEffect } from './AudioEffect.js';

/**
 * Distortion — Multi-mode distortion effect with hardClip, softClip, foldback,
 * and bitCrush waveshaper curves.
 *
 * Signal chain:
 *   input -> preGain -> WaveShaperNode(oversample:'4x') -> postGain
 *   -> toneFilter(lowpass) -> mixGain -> _wetGain
 */
export class Distortion extends AudioEffect {
    constructor() {
        super('Distortion', {
            gain: 0.5,
            mode: 'softClip',
            toneFreq: 6000,
            mix: 0.7
        });
        this._preGain = null;
        this._waveshaper = null;
        this._postGain = null;
        this._toneFilter = null;
        this._mixGain = null;
    }

    _buildGraph(ctx) {
        const preGain = ctx.createGain();
        this._registerNode(preGain);
        this._preGain = preGain;

        const waveshaper = ctx.createWaveShaper();
        waveshaper.oversample = '4x';
        this._registerNode(waveshaper);
        this._waveshaper = waveshaper;

        const postGain = ctx.createGain();
        this._registerNode(postGain);
        this._postGain = postGain;

        const toneFilter = ctx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = this.params.toneFreq;
        this._registerNode(toneFilter);
        this._toneFilter = toneFilter;

        const mixGain = ctx.createGain();
        mixGain.gain.value = this.params.mix;
        this._registerNode(mixGain);
        this._mixGain = mixGain;

        // Chain: input -> preGain -> waveshaper -> postGain -> toneFilter -> mixGain -> _wetGain
        this.input.connect(preGain);
        preGain.connect(waveshaper);
        waveshaper.connect(postGain);
        postGain.connect(toneFilter);
        toneFilter.connect(mixGain);
        mixGain.connect(this._wetGain);

        // Generate initial curve
        this._updateCurve(this.params.gain, this.params.mode);
    }

    /**
     * Floating-point modulo that always returns a positive result.
     */
    static _fmod(x, m) {
        return ((x % m) + m) % m;
    }

    /**
     * Generate a waveshaper curve for the given gain amount and mode.
     * @param {number} amount — 0 to 1
     * @param {string} mode — 'hardClip', 'softClip', 'foldback', or 'bitCrush'
     */
    _updateCurve(amount, mode) {
        const samples = 8192;
        const curve = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / (samples - 1) - 1; // -1 to 1

            switch (mode) {
                case 'hardClip': {
                    const g = 1 + amount * 100;
                    curve[i] = Math.max(-1, Math.min(1, x * g));
                    break;
                }
                case 'softClip':
                    curve[i] = Math.tanh(x * (1 + amount * 20));
                    break;
                case 'foldback': {
                    const g = 1 + amount * 100;
                    curve[i] = Math.abs(Math.abs(Distortion._fmod(x * g, 4)) - 2) - 1;
                    break;
                }
                case 'bitCrush': {
                    const levels = Math.pow(2, 16 - amount * 12);
                    curve[i] = Math.round(x * levels) / levels;
                    break;
                }
                default:
                    curve[i] = x;
                    break;
            }
        }

        this._waveshaper.curve = curve;
    }

    _applyParam(key, value) {
        if (!this._waveshaper) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'gain':
            case 'mode':
                this._updateCurve(this.params.gain, this.params.mode);
                break;
            case 'toneFreq':
                this._toneFilter.frequency.setValueAtTime(value, t);
                break;
            case 'mix':
                this._mixGain.gain.setValueAtTime(value, t);
                break;
        }
    }
}

AudioEffect.register('Distortion', Distortion);
