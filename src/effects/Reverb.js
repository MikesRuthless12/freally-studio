import { AudioEffect } from './AudioEffect.js';

/**
 * Reverb — Algorithmic Schroeder/Freeverb-style reverb.
 *
 * Signal chain:
 *   input → preDelay → allpass1 → allpass2 → allpass3 → allpass4 →
 *   [4 parallel comb filters with feedback] → sumGain → dampingFilter(lowpass) → decayGain → _wetGain
 *
 * Uses prime-number-based delay times to avoid metallic resonance.
 * Allpass stages use BiquadFilterNode type:'allpass'.
 * Each comb filter: DelayNode → feedbackGain → back to DelayNode, output → sumGain.
 */
export class Reverb extends AudioEffect {
    constructor() {
        super('Reverb', {
            preDelay: 0.02,
            roomSize: 0.7,
            damping: 0.5,
            decay: 2.0,
            mix: 0.3
        });
        this._preDelay = null;
        this._allpasses = [];
        this._combDelays = [];
        this._combFeedbacks = [];
        this._sumGain = null;
        this._dampingFilter = null;
        this._decayGain = null;
    }

    _buildGraph(ctx) {
        const ALLPASS_FREQS = [200, 250, 350, 500];
        const COMB_DELAYS = [0.0297, 0.0371, 0.0411, 0.0437];

        // Pre-delay
        const preDelay = ctx.createDelay(1.0);
        preDelay.delayTime.value = this.params.preDelay;
        this._registerNode(preDelay);
        this._preDelay = preDelay;

        // 4 allpass stages (BiquadFilterNode type:'allpass')
        this._allpasses = [];
        for (let i = 0; i < 4; i++) {
            const ap = ctx.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = ALLPASS_FREQS[i];
            ap.Q.value = 0.707;
            this._registerNode(ap);
            this._allpasses.push(ap);
        }

        // Sum gain for comb filter outputs
        const sumGain = ctx.createGain();
        sumGain.gain.value = 0.25; // average 4 comb outputs
        this._registerNode(sumGain);
        this._sumGain = sumGain;

        // 4 parallel comb filters
        this._combDelays = [];
        this._combFeedbacks = [];
        const roomSize = this.params.roomSize;

        for (let i = 0; i < 4; i++) {
            const delay = ctx.createDelay(2.0);
            delay.delayTime.value = COMB_DELAYS[i] * roomSize;
            this._registerNode(delay);

            const feedback = ctx.createGain();
            feedback.gain.value = this._calcFeedback(COMB_DELAYS[i] * roomSize, this.params.decay);
            this._registerNode(feedback);

            this._combDelays.push(delay);
            this._combFeedbacks.push(feedback);
        }

        // Damping filter (lowpass)
        const dampingFilter = ctx.createBiquadFilter();
        dampingFilter.type = 'lowpass';
        dampingFilter.frequency.value = this._dampingToFreq(this.params.damping);
        dampingFilter.Q.value = 0.707;
        this._registerNode(dampingFilter);
        this._dampingFilter = dampingFilter;

        // Decay gain
        const decayGain = ctx.createGain();
        decayGain.gain.value = 1.0;
        this._registerNode(decayGain);
        this._decayGain = decayGain;

        // --- Connections ---

        // input → preDelay → allpass chain
        this.input.connect(preDelay);
        preDelay.connect(this._allpasses[0]);
        for (let i = 0; i < 3; i++) {
            this._allpasses[i].connect(this._allpasses[i + 1]);
        }

        // allpass4 output → each comb filter in parallel
        const lastAllpass = this._allpasses[3];
        for (let i = 0; i < 4; i++) {
            lastAllpass.connect(this._combDelays[i]);
            // Comb feedback loop: delay → feedback → delay
            this._combDelays[i].connect(this._combFeedbacks[i]);
            this._combFeedbacks[i].connect(this._combDelays[i]);
            // Comb output → sumGain
            this._combDelays[i].connect(sumGain);
        }

        // sumGain → dampingFilter → decayGain → _wetGain
        sumGain.connect(dampingFilter);
        dampingFilter.connect(decayGain);
        decayGain.connect(this._wetGain);
    }

    /**
     * Calculate comb filter feedback gain for a given delay time and decay (in seconds).
     * feedback = 10^(-3 * delayTime / decay) — classic RT60 formula.
     */
    _calcFeedback(delayTime, decay) {
        if (decay <= 0) return 0;
        return Math.pow(10, -3 * delayTime / decay);
    }

    /**
     * Map damping parameter (0..1) to lowpass frequency.
     * 0 = very damped (dark, ~800 Hz), 1 = no damping (bright, ~20000 Hz).
     */
    _dampingToFreq(damping) {
        const minFreq = 800;
        const maxFreq = 20000;
        // Invert: higher damping = lower cutoff
        const d = 1.0 - damping;
        return minFreq * Math.pow(maxFreq / minFreq, d);
    }

    _applyParam(key, value) {
        if (!this._preDelay) return;
        const t = this._ctx.currentTime;
        const COMB_DELAYS = [0.0297, 0.0371, 0.0411, 0.0437];

        switch (key) {
            case 'preDelay':
                this._preDelay.delayTime.setValueAtTime(value, t);
                break;
            case 'roomSize':
                for (let i = 0; i < 4; i++) {
                    const newDelay = COMB_DELAYS[i] * value;
                    this._combDelays[i].delayTime.setValueAtTime(newDelay, t);
                    this._combFeedbacks[i].gain.setValueAtTime(
                        this._calcFeedback(newDelay, this.params.decay), t
                    );
                }
                break;
            case 'decay':
                for (let i = 0; i < 4; i++) {
                    const delayTime = COMB_DELAYS[i] * this.params.roomSize;
                    this._combFeedbacks[i].gain.setValueAtTime(
                        this._calcFeedback(delayTime, value), t
                    );
                }
                break;
            case 'damping':
                this._dampingFilter.frequency.setValueAtTime(
                    this._dampingToFreq(value), t
                );
                break;
            case 'mix':
                // Mix is informational — dry/wet crossfade handled by base class bypass
                break;
        }
    }
}

AudioEffect.register('Reverb', Reverb);
