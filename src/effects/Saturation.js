import { AudioEffect } from './AudioEffect.js';

/**
 * Saturation — Analog-style saturation effect with tube, tape, and digital modes.
 *
 * Signal chain:
 *   input -> preGain -> WaveShaperNode(oversample:'4x') -> postGain
 *   -> toneFilter(lowpass) -> _wetGain
 */
export class Saturation extends AudioEffect {
    constructor() {
        super('Saturation', {
            drive: 0.3,
            mode: 'tube',
            mix: 1.0,
            toneFreq: 8000
        });
        this._preGain = null;
        this._waveshaper = null;
        this._postGain = null;
        this._toneFilter = null;
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

        // Chain: input -> preGain -> waveshaper -> postGain -> toneFilter -> _wetGain
        this.input.connect(preGain);
        preGain.connect(waveshaper);
        waveshaper.connect(postGain);
        postGain.connect(toneFilter);
        toneFilter.connect(this._wetGain);

        // Generate initial curve
        this._updateCurve(this.params.drive, this.params.mode);
    }

    /**
     * Generate a waveshaper curve for the given drive and mode.
     * @param {number} drive — 0 to 1
     * @param {string} mode — 'tube', 'tape', or 'digital'
     */
    _updateCurve(drive, mode) {
        const samples = 8192;
        const curve = new Float32Array(samples);
        const DEG = Math.PI / 180;

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / (samples - 1) - 1; // -1 to 1

            switch (mode) {
                case 'tube': {
                    const amount = drive * 50;
                    curve[i] = ((3 + amount) * x * 20 * DEG) / (Math.PI + amount * Math.abs(x));
                    break;
                }
                case 'tape':
                    curve[i] = Math.tanh(x * (1 + drive * 10));
                    break;
                case 'digital':
                    curve[i] = Math.sign(x) * (1 - Math.pow(1 - Math.abs(x), 1 + drive * 20));
                    break;
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
            case 'drive':
            case 'mode':
                this._updateCurve(this.params.drive, this.params.mode);
                break;
            case 'toneFreq':
                this._toneFilter.frequency.setValueAtTime(value, t);
                break;
            // 'mix' is handled by the base class bypass system
        }
    }
}

AudioEffect.register('Saturation', Saturation);
