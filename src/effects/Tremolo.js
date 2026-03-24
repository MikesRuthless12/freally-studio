import { AudioEffect } from './AudioEffect.js';

/**
 * Tremolo — LFO-modulated amplitude effect.
 *
 * Signal chain:
 *   input -> tremoloGain -> _wetGain
 *   LFO(oscillator) -> lfoGain(depth) -> tremoloGain.gain
 *
 * The LFO modulates the gain of the signal, creating rhythmic
 * volume fluctuation.
 */
export class Tremolo extends AudioEffect {
    constructor() {
        super('Tremolo', {
            rate: 4.0,
            depth: 0.5,
            shape: 'sine',
            mix: 1.0
        });
        this._tremoloGain = null;
        this._lfo = null;
        this._lfoGain = null;
    }

    _buildGraph(ctx) {
        const tremoloGain = ctx.createGain();
        tremoloGain.gain.value = 1.0;
        this._registerNode(tremoloGain);
        this._tremoloGain = tremoloGain;

        const lfo = ctx.createOscillator();
        lfo.type = this.params.shape;
        lfo.frequency.value = this.params.rate;
        this._registerNode(lfo);
        this._lfo = lfo;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = this.params.depth * 0.5;
        this._registerNode(lfoGain);
        this._lfoGain = lfoGain;

        // Audio path
        this.input.connect(tremoloGain);
        tremoloGain.connect(this._wetGain);

        // LFO modulation path
        lfo.connect(lfoGain);
        lfoGain.connect(tremoloGain.gain);

        lfo.start();
    }

    _applyParam(key, value) {
        if (!this._lfo) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'rate':
                this._lfo.frequency.setValueAtTime(value, t);
                break;
            case 'depth':
                this._lfoGain.gain.setValueAtTime(value * 0.5, t);
                break;
            case 'shape':
                this._lfo.type = value;
                break;
        }
    }
}

AudioEffect.register('Tremolo', Tremolo);
