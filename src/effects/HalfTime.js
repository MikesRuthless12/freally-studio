import { AudioEffect } from './AudioEffect.js';

/**
 * HalfTime — Tempo-feel reduction effect via delay modulation + filtering.
 *
 * Signal chain:
 *   input -> inputGain -> delayNode(LFO-modulated for stretch feel)
 *   -> lowpassFilter(highCut) -> highpassFilter(lowCut) -> _wetGain
 *
 *   LFO(triangle, very slow) -> lfoGain -> delayNode.delayTime
 *
 * Note: True time-stretching is not available in Web Audio API. This effect
 * approximates the half-time feel using modulated delay and filtering to
 * create a slowed-down, smoothed character.
 */
export class HalfTime extends AudioEffect {
    constructor() {
        super('HalfTime', {
            amount: 0.5,
            smoothing: 0.5,
            lowCut: 200,
            highCut: 8000,
            mix: 0.5
        });
        this._inputGain = null;
        this._delayNode = null;
        this._lfo = null;
        this._lfoGain = null;
        this._highCutFilter = null;
        this._lowCutFilter = null;
        this._feedbackGain = null;
    }

    _buildGraph(ctx) {
        const inputGain = ctx.createGain();
        inputGain.gain.value = 1.0;
        this._registerNode(inputGain);
        this._inputGain = inputGain;

        // Modulated delay — creates the stretched/slowed feel
        const delayNode = ctx.createDelay(2.0);
        delayNode.delayTime.value = 0.05 + this.params.amount * 0.15;
        this._registerNode(delayNode);
        this._delayNode = delayNode;

        // Slow triangle LFO for delay modulation
        const lfo = ctx.createOscillator();
        lfo.type = 'triangle';
        lfo.frequency.value = 0.5 + (1 - this.params.amount) * 2;
        this._registerNode(lfo);
        this._lfo = lfo;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = this.params.amount * 0.03;
        this._registerNode(lfoGain);
        this._lfoGain = lfoGain;

        // Feedback for sustain/blur
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = this.params.smoothing * 0.4;
        this._registerNode(feedbackGain);
        this._feedbackGain = feedbackGain;

        // Filtering (smooths the result)
        const highCutFilter = ctx.createBiquadFilter();
        highCutFilter.type = 'lowpass';
        highCutFilter.frequency.value = this.params.highCut;
        highCutFilter.Q.value = 0.5;
        this._registerNode(highCutFilter);
        this._highCutFilter = highCutFilter;

        const lowCutFilter = ctx.createBiquadFilter();
        lowCutFilter.type = 'highpass';
        lowCutFilter.frequency.value = this.params.lowCut;
        lowCutFilter.Q.value = 0.5;
        this._registerNode(lowCutFilter);
        this._lowCutFilter = lowCutFilter;

        // Signal chain
        this.input.connect(inputGain);
        inputGain.connect(delayNode);
        delayNode.connect(highCutFilter);
        highCutFilter.connect(lowCutFilter);
        lowCutFilter.connect(this._wetGain);

        // Feedback loop
        lowCutFilter.connect(feedbackGain);
        feedbackGain.connect(delayNode);

        // LFO modulation
        lfo.connect(lfoGain);
        lfoGain.connect(delayNode.delayTime);
        lfo.start();
    }

    _applyParam(key, value) {
        if (!this._delayNode) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'amount':
                this._delayNode.delayTime.setValueAtTime(0.05 + value * 0.15, t);
                this._lfoGain.gain.setValueAtTime(value * 0.03, t);
                this._lfo.frequency.setValueAtTime(0.5 + (1 - value) * 2, t);
                break;
            case 'smoothing':
                this._feedbackGain.gain.setValueAtTime(value * 0.4, t);
                break;
            case 'lowCut':
                this._lowCutFilter.frequency.setValueAtTime(value, t);
                break;
            case 'highCut':
                this._highCutFilter.frequency.setValueAtTime(value, t);
                break;
        }
    }
}

AudioEffect.register('HalfTime', HalfTime);
