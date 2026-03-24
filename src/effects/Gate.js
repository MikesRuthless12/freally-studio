import { AudioEffect } from './AudioEffect.js';

/**
 * Gate — Noise gate that silences signal below a threshold.
 *
 * Signal chain:
 *   input -> gateGain -> _wetGain
 *   input -> analyser  (for RMS level detection)
 *
 * Uses a polling mechanism (setInterval every 10ms) to read the RMS
 * level from the analyser. When RMS drops below threshold, the gateGain
 * ramps down to `range` dB. When RMS is above threshold, gateGain
 * ramps back to unity (1.0).
 */
export class Gate extends AudioEffect {
    constructor() {
        super('Gate', {
            threshold: -40,
            attack: 0.001,
            release: 0.1,
            range: -80,
            hold: 0.01
        });
        this._gateGain = null;
        this._analyser = null;
        this._gateInterval = null;
        this._analyserData = null;
        this._holdTimer = 0;
        this._gateOpen = true;
    }

    _buildGraph(ctx) {
        // Gate gain — controls the signal level
        const gateGain = ctx.createGain();
        this._registerNode(gateGain);
        this._gateGain = gateGain;

        // Analyser for level detection
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        this._registerNode(analyser);
        this._analyser = analyser;
        this._analyserData = new Float32Array(analyser.fftSize);

        // Signal path: input -> gateGain -> _wetGain
        this.input.connect(gateGain);
        gateGain.connect(this._wetGain);

        // Detection path: input -> analyser
        this.input.connect(analyser);

        // Start polling for level detection
        this._gateOpen = true;
        this._holdTimer = 0;
        this._startPolling();
    }

    _startPolling() {
        // Clear any existing interval
        if (this._gateInterval !== null) {
            clearInterval(this._gateInterval);
        }

        this._gateInterval = setInterval(() => {
            if (!this._analyser || !this._gateGain || !this._ctx) return;

            // Read time-domain data and compute RMS
            this._analyser.getFloatTimeDomainData(this._analyserData);
            let sumSq = 0;
            for (let i = 0; i < this._analyserData.length; i++) {
                sumSq += this._analyserData[i] * this._analyserData[i];
            }
            const rms = Math.sqrt(sumSq / this._analyserData.length);

            // Convert RMS to dB
            const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
            const threshold = this.params.threshold;
            const t = this._ctx.currentTime;

            if (rmsDb >= threshold) {
                // Signal is above threshold — open the gate
                this._holdTimer = this.params.hold;
                if (!this._gateOpen) {
                    this._gateOpen = true;
                    this._gateGain.gain.setTargetAtTime(
                        1.0, t, this.params.attack
                    );
                }
            } else {
                // Signal is below threshold — apply hold then close
                if (this._gateOpen) {
                    this._holdTimer -= 0.01; // 10ms poll interval
                    if (this._holdTimer <= 0) {
                        this._gateOpen = false;
                        // Ramp down to range level
                        const rangeLinear = Math.pow(10, this.params.range / 20);
                        this._gateGain.gain.setTargetAtTime(
                            rangeLinear, t, this.params.release
                        );
                    }
                }
            }
        }, 10);
    }

    _applyParam(_key, _value) {
        // All params are read directly from this.params in the poll loop.
        // No live AudioParam updates needed beyond what the loop handles.
    }

    dispose() {
        if (this._gateInterval !== null) {
            clearInterval(this._gateInterval);
            this._gateInterval = null;
        }
        super.dispose();
    }
}

AudioEffect.register('Gate', Gate);
