import { AudioEffect } from './AudioEffect.js';

/**
 * Flanger — Short delay + LFO + feedback for comb-filter sweeping.
 *
 * Signal chain:
 *   input -> delayNode(short, 1-10ms) -> flangerGain -> _wetGain
 *   flangerGain -> feedbackGain -> delayNode (feedback loop)
 *   LFO(sine) -> lfoGain(depth) -> delayNode.delayTime
 *
 * Similar to Chorus but with shorter delay and more feedback,
 * producing metallic, sweeping comb-filter effects.
 */
export class Flanger extends AudioEffect {
    constructor() {
        super('Flanger', {
            rate: 0.3,
            depth: 0.002,
            delayTime: 0.003,
            feedback: 0.5,
            mix: 0.5
        });
        this._delayNode = null;
        this._flangerGain = null;
        this._feedbackGain = null;
        this._lfo = null;
        this._lfoGain = null;
    }

    _buildGraph(ctx) {
        const delayNode = ctx.createDelay(0.02);
        delayNode.delayTime.value = this.params.delayTime;
        this._registerNode(delayNode);
        this._delayNode = delayNode;

        const flangerGain = ctx.createGain();
        flangerGain.gain.value = 1.0;
        this._registerNode(flangerGain);
        this._flangerGain = flangerGain;

        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = this.params.feedback;
        this._registerNode(feedbackGain);
        this._feedbackGain = feedbackGain;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = this.params.rate;
        this._registerNode(lfo);
        this._lfo = lfo;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = this.params.depth;
        this._registerNode(lfoGain);
        this._lfoGain = lfoGain;

        // Audio path
        this.input.connect(delayNode);
        delayNode.connect(flangerGain);
        flangerGain.connect(this._wetGain);

        // Feedback loop
        flangerGain.connect(feedbackGain);
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
            case 'rate':
                this._lfo.frequency.setValueAtTime(value, t);
                break;
            case 'depth':
                this._lfoGain.gain.setValueAtTime(value, t);
                break;
            case 'delayTime':
                this._delayNode.delayTime.setValueAtTime(value, t);
                break;
            case 'feedback':
                this._feedbackGain.gain.setValueAtTime(value, t);
                break;
        }
    }
}

AudioEffect.register('Flanger', Flanger);
