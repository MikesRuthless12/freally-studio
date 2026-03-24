import { AudioEffect } from './AudioEffect.js';

/**
 * GlueCompressor — "Glue"-style bus compressor with optional soft-clip saturation.
 *
 * Signal chain:
 *   input -> warmthFilter (lowshelf +2dB @ 200Hz)
 *         -> DynamicsCompressorNode (knee:30 fixed, min attack 0.005)
 *         -> [optional softClip waveshaper (tanh curve)]
 *         -> makeupGain -> _wetGain
 */
export class GlueCompressor extends AudioEffect {
    constructor() {
        super('GlueCompressor', {
            threshold: -15,
            ratio: 3,
            attack: 0.01,
            release: 0.3,
            makeupGain: 0,
            softClip: false
        });
        this._warmth = null;
        this._compressor = null;
        this._softClipper = null;
        this._makeupGain = null;
    }

    _buildGraph(ctx) {
        // Warmth filter — lowshelf at 200Hz, +2dB
        const warmth = ctx.createBiquadFilter();
        warmth.type = 'lowshelf';
        warmth.frequency.value = 200;
        warmth.gain.value = 2;
        this._registerNode(warmth);
        this._warmth = warmth;

        // Compressor with fixed knee of 30
        const compressor = ctx.createDynamicsCompressor();
        compressor.knee.value = 30;
        this._registerNode(compressor);
        this._compressor = compressor;

        // Soft-clip waveshaper (tanh curve)
        const softClipper = ctx.createWaveShaper();
        softClipper.oversample = '2x';
        softClipper.curve = this._createTanhCurve(8192);
        this._registerNode(softClipper);
        this._softClipper = softClipper;

        // Makeup gain
        const makeupGain = ctx.createGain();
        this._registerNode(makeupGain);
        this._makeupGain = makeupGain;

        // Build the chain — softClip bypass is handled by connecting
        // compressor either through the shaper or directly to makeupGain.
        this.input.connect(warmth);
        warmth.connect(compressor);

        // Initial routing depends on softClip param
        this._routeSoftClip(this.params.softClip);

        makeupGain.connect(this._wetGain);
    }

    /**
     * Generate a tanh saturation curve for the WaveShaperNode.
     */
    _createTanhCurve(samples) {
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = Math.tanh(x);
        }
        return curve;
    }

    /**
     * Route the compressor output through or around the soft clipper.
     */
    _routeSoftClip(enabled) {
        if (!this._compressor) return;

        // Disconnect compressor output to rewire
        try { this._compressor.disconnect(); } catch (e) { /* ok */ }
        try { this._softClipper.disconnect(); } catch (e) { /* ok */ }

        if (enabled) {
            this._compressor.connect(this._softClipper);
            this._softClipper.connect(this._makeupGain);
        } else {
            this._compressor.connect(this._makeupGain);
        }
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
                // Enforce minimum attack of 0.005s
                this._compressor.attack.setValueAtTime(
                    Math.max(0.005, value), t
                );
                break;
            case 'release':
                this._compressor.release.setValueAtTime(value, t);
                break;
            case 'makeupGain':
                this._makeupGain.gain.setValueAtTime(
                    Math.pow(10, value / 20), t
                );
                break;
            case 'softClip':
                this._routeSoftClip(value);
                break;
        }
    }
}

AudioEffect.register('GlueCompressor', GlueCompressor);
