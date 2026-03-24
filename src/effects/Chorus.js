import { AudioEffect } from './AudioEffect.js';

/**
 * Chorus — LFO-modulated delay effect.
 *
 * Signal chain:
 *   input → delayNode (base delay ~20ms) → chorusGain → _wetGain
 *   OscillatorNode(LFO, sine) → lfoGain(depth) → delayNode.delayTime (AudioParam)
 *
 * The LFO modulates the delay time, creating pitch wobble characteristic
 * of chorus effects.
 */
export class Chorus extends AudioEffect {
    constructor() {
        super('Chorus', {
            rate: 1.0,
            depth: 0.005,
            delayTime: 0.02,
            mix: 0.5
        });
        this._delayNode = null;
        this._chorusGain = null;
        this._lfo = null;
        this._lfoGain = null;
    }

    _buildGraph(ctx) {
        // Delay node (modulated delay creates chorus)
        const delayNode = ctx.createDelay(0.1);
        delayNode.delayTime.value = this.params.delayTime;
        this._registerNode(delayNode);
        this._delayNode = delayNode;

        // Output gain for the chorus wet signal
        const chorusGain = ctx.createGain();
        chorusGain.gain.value = 1.0;
        this._registerNode(chorusGain);
        this._chorusGain = chorusGain;

        // LFO oscillator (modulates delay time)
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = this.params.rate;
        this._registerNode(lfo);
        this._lfo = lfo;

        // LFO gain (controls modulation depth)
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = this.params.depth;
        this._registerNode(lfoGain);
        this._lfoGain = lfoGain;

        // --- Connections ---

        // Audio path: input → delay → chorusGain → _wetGain
        this.input.connect(delayNode);
        delayNode.connect(chorusGain);
        chorusGain.connect(this._wetGain);

        // LFO modulation: lfo → lfoGain → delayNode.delayTime
        lfo.connect(lfoGain);
        lfoGain.connect(delayNode.delayTime);

        // Start the LFO
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
            case 'mix':
                break;
        }
    }
}

AudioEffect.register('Chorus', Chorus);
