import { AudioEffect } from './AudioEffect.js';

/**
 * SoftClipper — Dedicated soft clipping effect with adjustable knee curve.
 *
 * Signal chain:
 *   input -> preGain -> WaveShaperNode(oversample:'4x') -> postGain
 *   -> toneFilter(lowpass) -> _wetGain
 *
 * Uses parameterized curve: y = x / (1 + |x|^knee)^(1/knee)
 */
export class SoftClipper extends AudioEffect {
    constructor() {
        super('SoftClipper', {
            drive: 0.3,
            knee: 2.0,
            ceiling: -0.3,
            toneFreq: 12000,
            mix: 1.0
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
        this._curveKey = null; // fresh node, no curve assigned yet

        const postGain = ctx.createGain();
        this._registerNode(postGain);
        this._postGain = postGain;

        const toneFilter = ctx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = this.params.toneFreq;
        this._registerNode(toneFilter);
        this._toneFilter = toneFilter;

        this.input.connect(preGain);
        preGain.connect(waveshaper);
        waveshaper.connect(postGain);
        postGain.connect(toneFilter);
        toneFilter.connect(this._wetGain);

        this._updateCurve(this.params.drive, this.params.knee);
        this._updateCeiling(this.params.ceiling);
    }

    _updateCurve(drive, knee) {
        // Skip identical re-assignments: saves an 8192-sample rebuild on the
        // param re-apply at build time, and OfflineAudioContext back ends may
        // reject assigning a WaveShaper curve twice.
        const curveKey = `${drive}|${knee}`;
        if (this._curveKey === curveKey) return;
        this._curveKey = curveKey;
        const samples = 8192;
        const curve = new Float32Array(samples);
        const driveAmount = 1 + drive * 20;

        for (let i = 0; i < samples; i++) {
            const x = ((i * 2) / (samples - 1) - 1) * driveAmount;
            // Soft clip: y = x / (1 + |x|^knee)^(1/knee)
            const absX = Math.abs(x);
            const denom = Math.pow(1 + Math.pow(absX, knee), 1 / knee);
            curve[i] = x / denom;
        }

        this._waveshaper.curve = curve;
    }

    _updateCeiling(ceilingDb) {
        const linear = Math.pow(10, ceilingDb / 20);
        this._postGain.gain.setValueAtTime(linear, this._ctx.currentTime);
    }

    _applyParam(key, value) {
        if (!this._waveshaper) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'drive':
            case 'knee':
                this._updateCurve(this.params.drive, this.params.knee);
                break;
            case 'ceiling':
                this._updateCeiling(value);
                break;
            case 'toneFreq':
                this._toneFilter.frequency.setValueAtTime(value, t);
                break;
        }
    }
}

AudioEffect.register('SoftClipper', SoftClipper);
