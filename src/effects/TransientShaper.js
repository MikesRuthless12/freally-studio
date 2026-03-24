import { AudioEffect } from './AudioEffect.js';

/**
 * TransientShaper — Attack/sustain envelope shaping.
 *
 * Signal chain:
 *   input -> fastCompressor(attack:0.0001) -> fastGain(attack shaping) ->
 *   input -> slowCompressor(attack:0.05) -> slowGain(sustain shaping) ->
 *   both merge -> outputGain -> _wetGain
 *
 * Fast compressor responds to transients, slow compressor to sustained signal.
 * Blending the two with different gains shapes the envelope.
 */
export class TransientShaper extends AudioEffect {
    constructor() {
        super('TransientShaper', {
            attack: 0,
            sustain: 0,
            outputGain: 0
        });
        this._fastComp = null;
        this._slowComp = null;
        this._fastGain = null;
        this._slowGain = null;
        this._outputGain = null;
    }

    _buildGraph(ctx) {
        // Fast compressor (responds to transients)
        const fastComp = ctx.createDynamicsCompressor();
        fastComp.threshold.value = -24;
        fastComp.ratio.value = 4;
        fastComp.attack.value = 0.0003;
        fastComp.release.value = 0.01;
        fastComp.knee.value = 0;
        this._registerNode(fastComp);
        this._fastComp = fastComp;

        const fastGain = ctx.createGain();
        fastGain.gain.value = this._attackToGain(this.params.attack);
        this._registerNode(fastGain);
        this._fastGain = fastGain;

        // Slow compressor (responds to sustain)
        const slowComp = ctx.createDynamicsCompressor();
        slowComp.threshold.value = -24;
        slowComp.ratio.value = 4;
        slowComp.attack.value = 0.05;
        slowComp.release.value = 0.3;
        slowComp.knee.value = 10;
        this._registerNode(slowComp);
        this._slowComp = slowComp;

        const slowGain = ctx.createGain();
        slowGain.gain.value = this._sustainToGain(this.params.sustain);
        this._registerNode(slowGain);
        this._slowGain = slowGain;

        // Output
        const outputGain = ctx.createGain();
        outputGain.gain.value = Math.pow(10, this.params.outputGain / 20);
        this._registerNode(outputGain);
        this._outputGain = outputGain;

        // Fast path (transient-shaped signal)
        this.input.connect(fastComp);
        fastComp.connect(fastGain);
        fastGain.connect(outputGain);

        // Slow path (sustain-shaped signal)
        this.input.connect(slowComp);
        slowComp.connect(slowGain);
        slowGain.connect(outputGain);

        outputGain.connect(this._wetGain);
    }

    _attackToGain(v) {
        // -1..+1 maps to 0.25..1.75 (reduce/boost transient component)
        return 0.5 + (v + 1) * 0.625;
    }

    _sustainToGain(v) {
        return 0.5 + (v + 1) * 0.625;
    }

    _applyParam(key, value) {
        if (!this._fastComp) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'attack':
                this._fastGain.gain.setValueAtTime(this._attackToGain(value), t);
                break;
            case 'sustain':
                this._slowGain.gain.setValueAtTime(this._sustainToGain(value), t);
                break;
            case 'outputGain':
                this._outputGain.gain.setValueAtTime(Math.pow(10, value / 20), t);
                break;
        }
    }
}

AudioEffect.register('TransientShaper', TransientShaper);
