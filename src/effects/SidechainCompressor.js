import { AudioEffect } from './AudioEffect.js';

/**
 * SidechainCompressor — Ducks the main signal based on a sidechain (key) input.
 *
 * Signal chain:
 *   input -> duckGain -> _wetGain
 *
 * Sidechain path:
 *   this.keyInput (GainNode) -> keyAnalyser (reads sidechain signal level)
 *
 * External code connects the sidechain source to this.keyInput.
 * A polling mechanism reads the keyAnalyser RMS. When the key signal
 * exceeds the threshold, duckGain is ramped down according to ratio
 * and depth. Uses attack for duck-down speed and release for duck-up.
 */
export class SidechainCompressor extends AudioEffect {
    constructor() {
        super('SidechainCompressor', {
            threshold: -30,
            ratio: 4,
            attack: 0.005,
            release: 0.15,
            depth: -20,
            keySource: 'kick'
        });
        this._duckGain = null;
        this.keyInput = null;
        this._keyAnalyser = null;
        this._analyserData = null;
        this._scInterval = null;
        this._isDucking = false;
    }

    _buildGraph(ctx) {
        // Duck gain — controls the main signal volume
        const duckGain = ctx.createGain();
        this._registerNode(duckGain);
        this._duckGain = duckGain;

        // Key input — external sidechain source connects here
        const keyInput = ctx.createGain();
        this._registerNode(keyInput);
        this.keyInput = keyInput;

        // Key analyser — reads the sidechain signal level
        const keyAnalyser = ctx.createAnalyser();
        keyAnalyser.fftSize = 256;
        this._registerNode(keyAnalyser);
        this._keyAnalyser = keyAnalyser;
        this._analyserData = new Float32Array(keyAnalyser.fftSize);

        // Main signal path: input -> duckGain -> _wetGain
        this.input.connect(duckGain);
        duckGain.connect(this._wetGain);

        // Sidechain detection path: keyInput -> keyAnalyser
        keyInput.connect(keyAnalyser);

        // Start polling
        this._isDucking = false;
        this._startPolling();
    }

    _startPolling() {
        if (this._scInterval !== null) {
            clearInterval(this._scInterval);
        }

        this._scInterval = setInterval(() => {
            if (!this._keyAnalyser || !this._duckGain || !this._ctx) return;

            // Read RMS of the sidechain key signal
            this._keyAnalyser.getFloatTimeDomainData(this._analyserData);
            let sumSq = 0;
            for (let i = 0; i < this._analyserData.length; i++) {
                sumSq += this._analyserData[i] * this._analyserData[i];
            }
            const rms = Math.sqrt(sumSq / this._analyserData.length);
            const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

            const threshold = this.params.threshold;
            const ratio = this.params.ratio;
            const depth = this.params.depth;
            const t = this._ctx.currentTime;

            if (rmsDb >= threshold) {
                // Key signal exceeds threshold — duck the main signal
                if (!this._isDucking) {
                    this._isDucking = true;
                }
                // Calculate duck amount based on how far above threshold
                // and the ratio, clamped to the depth floor
                const overDb = rmsDb - threshold;
                const reductionDb = overDb - (overDb / ratio);
                const targetDb = Math.max(depth, -reductionDb);
                const targetLinear = Math.pow(10, targetDb / 20);

                this._duckGain.gain.setTargetAtTime(
                    targetLinear, t, this.params.attack
                );
            } else {
                // Key signal is below threshold — release the duck
                if (this._isDucking) {
                    this._isDucking = false;
                    this._duckGain.gain.setTargetAtTime(
                        1.0, t, this.params.release
                    );
                }
            }
        }, 10);
    }

    _applyParam(_key, _value) {
        // All params are read directly from this.params in the poll loop.
        // No live AudioParam updates needed beyond what the loop handles.
    }

    dispose() {
        if (this._scInterval !== null) {
            clearInterval(this._scInterval);
            this._scInterval = null;
        }
        this.keyInput = null;
        super.dispose();
    }
}

AudioEffect.register('SidechainCompressor', SidechainCompressor);
