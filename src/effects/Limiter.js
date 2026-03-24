import { AudioEffect } from './AudioEffect.js';

/**
 * Limiter — Brickwall-style limiter using a look-ahead delay and aggressive
 * DynamicsCompressorNode settings.
 *
 * Signal chain:
 *   input -> lookAheadDelay (0.001s) -> DynamicsCompressorNode
 *         -> makeupGain -> _wetGain
 *
 * The `ceiling` param maps to the compressor's threshold so the output
 * never exceeds that level.
 */
export class Limiter extends AudioEffect {
    constructor() {
        super('Limiter', {
            ceiling: -0.3,
            release: 0.05,
            makeupGain: 0
        });
        this._delay = null;
        this._compressor = null;
        this._makeupGain = null;
        this._inAnalyser = null;
        this._outAnalyser = null;
    }

    _buildGraph(ctx) {
        // Look-ahead delay
        const delay = ctx.createDelay(0.01);
        delay.delayTime.value = 0.001;
        this._registerNode(delay);
        this._delay = delay;

        // Aggressive compressor configured as a limiter
        const compressor = ctx.createDynamicsCompressor();
        compressor.ratio.value = 20;
        compressor.knee.value = 0;
        compressor.attack.value = 0.001;
        this._registerNode(compressor);
        this._compressor = compressor;

        // Makeup gain
        const makeupGain = ctx.createGain();
        this._registerNode(makeupGain);
        this._makeupGain = makeupGain;

        // Input/output analysers for real-time metering
        const inA = ctx.createAnalyser();
        inA.fftSize = 256;
        this._registerNode(inA);
        this._inAnalyser = inA;

        const outA = ctx.createAnalyser();
        outA.fftSize = 256;
        this._registerNode(outA);
        this._outAnalyser = outA;

        // Chain: input -> inAnalyser -> delay -> compressor -> makeupGain -> outAnalyser -> _wetGain
        this.input.connect(inA);
        inA.connect(delay);
        delay.connect(compressor);
        compressor.connect(makeupGain);
        makeupGain.connect(outA);
        outA.connect(this._wetGain);
    }

    /** Get RMS level in dB from an analyser node */
    _getLevel(analyser) {
        if (!analyser) return -100;
        if (!this._levelBuf || this._levelBuf.length !== analyser.fftSize) {
            this._levelBuf = new Float32Array(analyser.fftSize);
        }
        const data = this._levelBuf;
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        return rms > 0 ? 20 * Math.log10(rms) : -100;
    }

    /** Input level in dB */
    getInputLevel() { return this._getLevel(this._inAnalyser); }

    /** Output level in dB */
    getOutputLevel() { return this._getLevel(this._outAnalyser); }

    _applyParam(key, value) {
        if (!this._compressor) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'ceiling':
                // Ceiling maps to compressor threshold
                this._compressor.threshold.setValueAtTime(value, t);
                break;
            case 'release':
                this._compressor.release.setValueAtTime(value, t);
                break;
            case 'makeupGain':
                this._makeupGain.gain.setValueAtTime(
                    Math.pow(10, value / 20), t
                );
                break;
        }
    }
}

AudioEffect.register('Limiter', Limiter);
