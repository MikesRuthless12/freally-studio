import { AudioEffect } from './AudioEffect.js';

/**
 * RingModulator — Carrier oscillator amplitude modulation.
 *
 * Signal chain:
 *   input -> ringGain -> _wetGain
 *   carrierOscillator -> ringGain.gain
 *
 * Ring modulation multiplies the input by a carrier oscillator,
 * producing sum and difference frequencies.
 */
export class RingModulator extends AudioEffect {
    constructor() {
        super('RingModulator', {
            carrierFreq: 440,
            carrierType: 'sine',
            mix: 0.5
        });
        this._ringGain = null;
        this._carrier = null;
    }

    _buildGraph(ctx) {
        const ringGain = ctx.createGain();
        ringGain.gain.value = 0;
        this._registerNode(ringGain);
        this._ringGain = ringGain;

        const carrier = ctx.createOscillator();
        carrier.type = this.params.carrierType;
        carrier.frequency.value = this.params.carrierFreq;
        this._registerNode(carrier);
        this._carrier = carrier;

        // Audio path: input -> ringGain -> _wetGain
        this.input.connect(ringGain);
        ringGain.connect(this._wetGain);

        // Carrier modulates the gain (multiplication)
        carrier.connect(ringGain.gain);

        carrier.start();
    }

    _applyParam(key, value) {
        if (!this._carrier) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'carrierFreq':
                this._carrier.frequency.setValueAtTime(value, t);
                break;
            case 'carrierType':
                this._carrier.type = value;
                break;
        }
    }
}

AudioEffect.register('RingModulator', RingModulator);
