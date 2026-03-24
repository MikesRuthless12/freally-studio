import { AudioEffect } from './AudioEffect.js';

/**
 * DeEsser — Sibilance reduction via frequency-targeted compression.
 *
 * Signal chain:
 *   input -> splitter:
 *     Sibilance band: bandpass(freq) -> compressor -> bandGain -> merger
 *     Dry signal: input passes through directly -> merger
 *   merger -> outputGain -> _wetGain
 *
 * When 'listen' is enabled, only the sibilance band is heard (for tuning).
 */
export class DeEsser extends AudioEffect {
    constructor() {
        super('DeEsser', {
            frequency: 6000,
            threshold: -20,
            ratio: 4,
            range: -12,
            listen: false
        });
        this._bandpass = null;
        this._compressor = null;
        this._bandGain = null;
        this._dryPath = null;
        this._outputGain = null;
    }

    _buildGraph(ctx) {
        // Sibilance detection + compression band
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = this.params.frequency;
        bandpass.Q.value = 2;
        this._registerNode(bandpass);
        this._bandpass = bandpass;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = this.params.threshold;
        compressor.ratio.value = this.params.ratio;
        compressor.attack.value = 0.001;
        compressor.release.value = 0.05;
        compressor.knee.value = 0;
        this._registerNode(compressor);
        this._compressor = compressor;

        const bandGain = ctx.createGain();
        bandGain.gain.value = Math.pow(10, this.params.range / 20);
        this._registerNode(bandGain);
        this._bandGain = bandGain;

        // Dry path (passes full signal minus sibilance band)
        const dryPath = ctx.createGain();
        dryPath.gain.value = this.params.listen ? 0 : 1;
        this._registerNode(dryPath);
        this._dryPath = dryPath;

        const outputGain = ctx.createGain();
        outputGain.gain.value = 1.0;
        this._registerNode(outputGain);
        this._outputGain = outputGain;

        // Sibilance path
        this.input.connect(bandpass);
        bandpass.connect(compressor);
        compressor.connect(bandGain);
        bandGain.connect(outputGain);

        // Dry path
        this.input.connect(dryPath);
        dryPath.connect(outputGain);

        outputGain.connect(this._wetGain);
    }

    _applyParam(key, value) {
        if (!this._compressor) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'frequency':
                this._bandpass.frequency.setValueAtTime(value, t);
                break;
            case 'threshold':
                this._compressor.threshold.setValueAtTime(value, t);
                break;
            case 'ratio':
                this._compressor.ratio.setValueAtTime(value, t);
                break;
            case 'range':
                this._bandGain.gain.setValueAtTime(Math.pow(10, value / 20), t);
                break;
            case 'listen':
                this._dryPath.gain.setValueAtTime(value ? 0 : 1, t);
                break;
        }
    }
}

AudioEffect.register('DeEsser', DeEsser);
