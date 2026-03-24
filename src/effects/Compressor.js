import { AudioEffect } from './AudioEffect.js';

/**
 * Compressor — Standard dynamics compressor effect.
 *
 * Signal chain: input -> DynamicsCompressorNode -> makeupGain -> _wetGain
 */
export class Compressor extends AudioEffect {
    constructor() {
        super('Compressor', {
            threshold: -24,
            ratio: 4,
            attack: 0.003,
            release: 0.25,
            knee: 30,
            makeupGain: 0
        });
        this._compressor = null;
        this._makeupGain = null;
    }

    _buildGraph(ctx) {
        const compressor = ctx.createDynamicsCompressor();
        this._registerNode(compressor);
        this._compressor = compressor;

        const makeupGain = ctx.createGain();
        this._registerNode(makeupGain);
        this._makeupGain = makeupGain;

        // Chain: input -> compressor -> makeupGain -> _wetGain
        this.input.connect(compressor);
        compressor.connect(makeupGain);
        makeupGain.connect(this._wetGain);
    }

    _applyParam(key, value) {
        if (!this._compressor) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'threshold':
                this._compressor.threshold.setValueAtTime(value, t);
                break;
            case 'ratio':
                this._compressor.ratio.setValueAtTime(value, t);
                break;
            case 'attack':
                this._compressor.attack.setValueAtTime(value, t);
                break;
            case 'release':
                this._compressor.release.setValueAtTime(value, t);
                break;
            case 'knee':
                this._compressor.knee.setValueAtTime(value, t);
                break;
            case 'makeupGain':
                this._makeupGain.gain.setValueAtTime(
                    Math.pow(10, value / 20), t
                );
                break;
        }
    }
}

AudioEffect.register('Compressor', Compressor);
