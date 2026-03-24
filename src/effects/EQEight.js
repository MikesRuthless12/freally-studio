import { AudioEffect } from './AudioEffect.js';

/**
 * EQEight — 8-band parametric equalizer effect.
 *
 * Signal chain:
 *   input -> band0(highpass,30Hz) -> band1(lowshelf,100Hz) -> band2(peaking,250Hz)
 *   -> band3(peaking,1000Hz) -> band4(peaking,3000Hz) -> band5(peaking,8000Hz)
 *   -> band6(highshelf,12000Hz) -> band7(lowpass,18000Hz) -> _wetGain
 */
export class EQEight extends AudioEffect {
    constructor() {
        super('EQEight', {
            bands: [
                { frequency: 30, gain: 0, Q: 0.707, type: 'highpass', enabled: true },
                { frequency: 100, gain: 0, Q: 0.707, type: 'lowshelf', enabled: true },
                { frequency: 250, gain: 0, Q: 1.0, type: 'peaking', enabled: true },
                { frequency: 1000, gain: 0, Q: 1.0, type: 'peaking', enabled: true },
                { frequency: 3000, gain: 0, Q: 1.0, type: 'peaking', enabled: true },
                { frequency: 8000, gain: 0, Q: 1.0, type: 'peaking', enabled: true },
                { frequency: 12000, gain: 0, Q: 0.707, type: 'highshelf', enabled: true },
                { frequency: 18000, gain: 0, Q: 0.707, type: 'lowpass', enabled: true }
            ]
        });
        this._filters = [];
    }

    _buildGraph(ctx) {
        const bands = this.params.bands;
        this._filters = [];

        for (let i = 0; i < 8; i++) {
            const filter = ctx.createBiquadFilter();
            this._registerNode(filter);
            filter.type = bands[i].type;
            filter.frequency.value = bands[i].frequency;
            filter.Q.value = bands[i].Q;
            filter.gain.value = bands[i].gain;
            this._filters.push(filter);
        }

        // Chain: input -> band0 -> band1 -> ... -> band7 -> _wetGain
        this.input.connect(this._filters[0]);
        for (let i = 0; i < 7; i++) {
            this._filters[i].connect(this._filters[i + 1]);
        }
        this._filters[7].connect(this._wetGain);
    }

    _applyParam(key, value) {
        if (key !== 'bands' || !this._filters.length) return;
        const t = this._ctx.currentTime;

        for (let i = 0; i < 8; i++) {
            const band = value[i];
            const filter = this._filters[i];
            if (!band || !filter) continue;

            if (band.enabled) {
                filter.type = band.type;
                filter.frequency.setValueAtTime(band.frequency, t);
                filter.Q.setValueAtTime(band.Q, t);
                filter.gain.setValueAtTime(band.gain, t);
            } else {
                // Disabled band: pass-through
                filter.type = 'allpass';
                filter.gain.setValueAtTime(0, t);
            }
        }
    }
}

AudioEffect.register('EQEight', EQEight);
