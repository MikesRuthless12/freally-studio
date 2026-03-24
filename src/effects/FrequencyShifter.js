import { AudioEffect } from './AudioEffect.js';

/**
 * FrequencyShifter — Shifts all frequencies by a fixed Hz amount.
 *
 * Signal chain:
 *   input -> ringGain -> lowpassFilter -> _wetGain
 *   carrierOscillator(shift Hz) -> ringGain.gain
 *
 * Uses ring modulation with filtering to approximate single-sideband
 * frequency shifting. The lowpass helps suppress unwanted artifacts.
 */
export class FrequencyShifter extends AudioEffect {
    constructor() {
        super('FrequencyShifter', {
            shift: 0,
            direction: 'up',
            mix: 0.5
        });
        this._ringGain = null;
        this._carrier = null;
        this._filter = null;
    }

    _buildGraph(ctx) {
        const ringGain = ctx.createGain();
        ringGain.gain.value = 0;
        this._registerNode(ringGain);
        this._ringGain = ringGain;

        const carrier = ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = this._getCarrierFreq();
        this._registerNode(carrier);
        this._carrier = carrier;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = Math.min(20000, (ctx.sampleRate || 44100) / 2 - 100);
        filter.Q.value = 0.5;
        this._registerNode(filter);
        this._filter = filter;

        this.input.connect(ringGain);
        ringGain.connect(filter);
        filter.connect(this._wetGain);

        carrier.connect(ringGain.gain);
        carrier.start();
    }

    _getCarrierFreq() {
        const shift = this.params.shift || 0;
        return this.params.direction === 'down' ? -shift : shift;
    }

    _applyParam(key, value) {
        if (!this._carrier) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'shift':
            case 'direction':
                this._carrier.frequency.setValueAtTime(this._getCarrierFreq(), t);
                break;
        }
    }
}

AudioEffect.register('FrequencyShifter', FrequencyShifter);
