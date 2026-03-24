import { AudioEffect } from './AudioEffect.js';

/**
 * Phaser — Cascaded Allpass filters with LFO modulation.
 *
 * Signal chain:
 *   input → allpass1(BiquadFilter,'allpass') → allpass2 → allpass3 → allpass4 →
 *     feedbackGain → allpass1 (feedback loop)
 *     allpass4 → phaserWetGain → _wetGain
 *   OscillatorNode(LFO) → lfoGain → allpass1.frequency, allpass2.frequency,
 *                                     allpass3.frequency, allpass4.frequency
 *
 * 4 allpass filters whose frequency is modulated by a shared LFO.
 * Feedback from allpass4 back to allpass1 creates resonance at the notch points.
 */
export class Phaser extends AudioEffect {
    constructor() {
        super('Phaser', {
            rate: 0.5,
            depth: 1000,
            centerFreq: 1000,
            feedback: 0.4,
            mix: 0.5
        });
        this._allpasses = [];
        this._feedbackGain = null;
        this._phaserWetGain = null;
        this._lfo = null;
        this._lfoGain = null;
    }

    _buildGraph(ctx) {
        // 4 cascaded allpass filters
        this._allpasses = [];
        for (let i = 0; i < 4; i++) {
            const ap = ctx.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = this.params.centerFreq;
            ap.Q.value = 0.707;
            this._registerNode(ap);
            this._allpasses.push(ap);
        }

        // Feedback gain (controls resonance)
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = this.params.feedback;
        this._registerNode(feedbackGain);
        this._feedbackGain = feedbackGain;

        // Wet gain for phaser output
        const phaserWetGain = ctx.createGain();
        phaserWetGain.gain.value = 1.0;
        this._registerNode(phaserWetGain);
        this._phaserWetGain = phaserWetGain;

        // LFO oscillator
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = this.params.rate;
        this._registerNode(lfo);
        this._lfo = lfo;

        // LFO gain (depth of frequency modulation)
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = this.params.depth;
        this._registerNode(lfoGain);
        this._lfoGain = lfoGain;

        // --- Connections ---

        // Allpass cascade: input → ap1 → ap2 → ap3 → ap4
        this.input.connect(this._allpasses[0]);
        for (let i = 0; i < 3; i++) {
            this._allpasses[i].connect(this._allpasses[i + 1]);
        }

        // Feedback loop: ap4 → feedbackGain → ap1
        this._allpasses[3].connect(feedbackGain);
        feedbackGain.connect(this._allpasses[0]);

        // Output: ap4 → phaserWetGain → _wetGain
        this._allpasses[3].connect(phaserWetGain);
        phaserWetGain.connect(this._wetGain);

        // LFO modulation: lfo → lfoGain → all allpass frequencies
        lfo.connect(lfoGain);
        for (let i = 0; i < 4; i++) {
            lfoGain.connect(this._allpasses[i].frequency);
        }

        // Start the LFO
        lfo.start();
    }

    _applyParam(key, value) {
        if (!this._allpasses.length) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'rate':
                this._lfo.frequency.setValueAtTime(value, t);
                break;
            case 'depth':
                this._lfoGain.gain.setValueAtTime(value, t);
                break;
            case 'centerFreq':
                for (let i = 0; i < 4; i++) {
                    this._allpasses[i].frequency.setValueAtTime(value, t);
                }
                break;
            case 'feedback':
                this._feedbackGain.gain.setValueAtTime(value, t);
                break;
            case 'mix':
                break;
        }
    }
}

AudioEffect.register('Phaser', Phaser);
