import { AudioEffect } from './AudioEffect.js';

/**
 * Echo — Multi-Tap Delay effect.
 *
 * Signal chain:
 *   input → tap1(DelayNode, time1) → tap1Gain ─┐
 *   input → tap2(DelayNode, time2) → tap2Gain ──┼→ sumGain → _wetGain
 *   input → tap3(DelayNode, time3) → tap3Gain ─┘
 *   tap1Gain + tap2Gain + tap3Gain → feedbackGain → feedbackFilter(lowpass) → tap1
 *
 * Three parallel delay taps at different times, summed together with a
 * single feedback path routed through a lowpass filter back to tap1.
 */
export class Echo extends AudioEffect {
    constructor() {
        super('Echo', {
            time1: 0.25,
            time2: 0.5,
            time3: 0.75,
            feedback: 0.3,
            filterFreq: 3000,
            mix: 0.3
        });
        this._tap1 = null;
        this._tap2 = null;
        this._tap3 = null;
        this._tap1Gain = null;
        this._tap2Gain = null;
        this._tap3Gain = null;
        this._feedbackGain = null;
        this._feedbackFilter = null;
        this._sumGain = null;
    }

    _buildGraph(ctx) {
        // Three delay taps
        const tap1 = ctx.createDelay(5.0);
        tap1.delayTime.value = this.params.time1;
        this._registerNode(tap1);
        this._tap1 = tap1;

        const tap2 = ctx.createDelay(5.0);
        tap2.delayTime.value = this.params.time2;
        this._registerNode(tap2);
        this._tap2 = tap2;

        const tap3 = ctx.createDelay(5.0);
        tap3.delayTime.value = this.params.time3;
        this._registerNode(tap3);
        this._tap3 = tap3;

        // Tap gains (allow per-tap level; each at 1/3 for equal mix)
        const tap1Gain = ctx.createGain();
        tap1Gain.gain.value = 0.33;
        this._registerNode(tap1Gain);
        this._tap1Gain = tap1Gain;

        const tap2Gain = ctx.createGain();
        tap2Gain.gain.value = 0.33;
        this._registerNode(tap2Gain);
        this._tap2Gain = tap2Gain;

        const tap3Gain = ctx.createGain();
        tap3Gain.gain.value = 0.33;
        this._registerNode(tap3Gain);
        this._tap3Gain = tap3Gain;

        // Sum gain (collects all tap outputs)
        const sumGain = ctx.createGain();
        sumGain.gain.value = 1.0;
        this._registerNode(sumGain);
        this._sumGain = sumGain;

        // Feedback path: feedbackGain → lowpass filter → back to tap1
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = this.params.feedback;
        this._registerNode(feedbackGain);
        this._feedbackGain = feedbackGain;

        const feedbackFilter = ctx.createBiquadFilter();
        feedbackFilter.type = 'lowpass';
        feedbackFilter.frequency.value = this.params.filterFreq;
        feedbackFilter.Q.value = 0.707;
        this._registerNode(feedbackFilter);
        this._feedbackFilter = feedbackFilter;

        // --- Connections ---

        // Input → three parallel delay taps
        this.input.connect(tap1);
        this.input.connect(tap2);
        this.input.connect(tap3);

        // Each tap → its gain → sumGain
        tap1.connect(tap1Gain);
        tap2.connect(tap2Gain);
        tap3.connect(tap3Gain);
        tap1Gain.connect(sumGain);
        tap2Gain.connect(sumGain);
        tap3Gain.connect(sumGain);

        // Feedback: tap gains → feedbackGain → filter → tap1 (recirculate)
        tap1Gain.connect(feedbackGain);
        tap2Gain.connect(feedbackGain);
        tap3Gain.connect(feedbackGain);
        feedbackGain.connect(feedbackFilter);
        feedbackFilter.connect(tap1);

        // Sum output → _wetGain
        sumGain.connect(this._wetGain);
    }

    _applyParam(key, value) {
        if (!this._tap1) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'time1':
                this._tap1.delayTime.setValueAtTime(value, t);
                break;
            case 'time2':
                this._tap2.delayTime.setValueAtTime(value, t);
                break;
            case 'time3':
                this._tap3.delayTime.setValueAtTime(value, t);
                break;
            case 'feedback':
                this._feedbackGain.gain.setValueAtTime(value, t);
                break;
            case 'filterFreq':
                this._feedbackFilter.frequency.setValueAtTime(value, t);
                break;
            case 'mix':
                break;
        }
    }
}

AudioEffect.register('Echo', Echo);
