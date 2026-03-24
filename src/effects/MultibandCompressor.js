import { AudioEffect } from './AudioEffect.js';

/**
 * MultibandCompressor — 3-band crossover with per-band compression.
 *
 * Signal chain:
 *   input -> lowpass(xLow) -> lowComp -> lowGain ->
 *   input -> bandpass(xLow..xHigh) -> midComp -> midGain ->  merger -> _wetGain
 *   input -> highpass(xHigh) -> highComp -> highGain ->
 */
export class MultibandCompressor extends AudioEffect {
    constructor() {
        super('MultibandCompressor', {
            crossLow: 200,
            crossHigh: 4000,
            lowThreshold: -20,
            lowRatio: 3,
            lowGain: 0,
            midThreshold: -18,
            midRatio: 2.5,
            midGain: 0,
            highThreshold: -16,
            highRatio: 2,
            highGain: 0,
            attack: 0.005,
            release: 0.15
        });
        this._lpFilter = null;
        this._bpFilterLow = null;
        this._bpFilterHigh = null;
        this._hpFilter = null;
        this._lowComp = null;
        this._midComp = null;
        this._highComp = null;
        this._lowGain = null;
        this._midGain = null;
        this._highGain = null;
    }

    _buildGraph(ctx) {
        const attack = this.params.attack;
        const release = this.params.release;

        // Low band: lowpass filter
        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.value = this.params.crossLow;
        lpFilter.Q.value = 0.7;
        this._registerNode(lpFilter);
        this._lpFilter = lpFilter;

        // Mid band: bandpass (implemented as HP + LP cascade)
        const bpFilterLow = ctx.createBiquadFilter();
        bpFilterLow.type = 'highpass';
        bpFilterLow.frequency.value = this.params.crossLow;
        bpFilterLow.Q.value = 0.7;
        this._registerNode(bpFilterLow);
        this._bpFilterLow = bpFilterLow;

        const bpFilterHigh = ctx.createBiquadFilter();
        bpFilterHigh.type = 'lowpass';
        bpFilterHigh.frequency.value = this.params.crossHigh;
        bpFilterHigh.Q.value = 0.7;
        this._registerNode(bpFilterHigh);
        this._bpFilterHigh = bpFilterHigh;

        // High band: highpass filter
        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = this.params.crossHigh;
        hpFilter.Q.value = 0.7;
        this._registerNode(hpFilter);
        this._hpFilter = hpFilter;

        // Low band compressor
        const lowComp = ctx.createDynamicsCompressor();
        lowComp.threshold.value = this.params.lowThreshold;
        lowComp.ratio.value = this.params.lowRatio;
        lowComp.attack.value = attack;
        lowComp.release.value = release;
        lowComp.knee.value = 6;
        this._registerNode(lowComp);
        this._lowComp = lowComp;

        const lowGain = ctx.createGain();
        lowGain.gain.value = Math.pow(10, this.params.lowGain / 20);
        this._registerNode(lowGain);
        this._lowGain = lowGain;

        // Mid band compressor
        const midComp = ctx.createDynamicsCompressor();
        midComp.threshold.value = this.params.midThreshold;
        midComp.ratio.value = this.params.midRatio;
        midComp.attack.value = attack;
        midComp.release.value = release;
        midComp.knee.value = 6;
        this._registerNode(midComp);
        this._midComp = midComp;

        const midGain = ctx.createGain();
        midGain.gain.value = Math.pow(10, this.params.midGain / 20);
        this._registerNode(midGain);
        this._midGain = midGain;

        // High band compressor
        const highComp = ctx.createDynamicsCompressor();
        highComp.threshold.value = this.params.highThreshold;
        highComp.ratio.value = this.params.highRatio;
        highComp.attack.value = attack;
        highComp.release.value = release;
        highComp.knee.value = 6;
        this._registerNode(highComp);
        this._highComp = highComp;

        const highGain = ctx.createGain();
        highGain.gain.value = Math.pow(10, this.params.highGain / 20);
        this._registerNode(highGain);
        this._highGain = highGain;

        // Connect: Low band
        this.input.connect(lpFilter);
        lpFilter.connect(lowComp);
        lowComp.connect(lowGain);
        lowGain.connect(this._wetGain);

        // Connect: Mid band (HP then LP)
        this.input.connect(bpFilterLow);
        bpFilterLow.connect(bpFilterHigh);
        bpFilterHigh.connect(midComp);
        midComp.connect(midGain);
        midGain.connect(this._wetGain);

        // Connect: High band
        this.input.connect(hpFilter);
        hpFilter.connect(highComp);
        highComp.connect(highGain);
        highGain.connect(this._wetGain);
    }

    _applyParam(key, value) {
        if (!this._lowComp) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'crossLow':
                this._lpFilter.frequency.setValueAtTime(value, t);
                this._bpFilterLow.frequency.setValueAtTime(value, t);
                break;
            case 'crossHigh':
                this._bpFilterHigh.frequency.setValueAtTime(value, t);
                this._hpFilter.frequency.setValueAtTime(value, t);
                break;
            case 'lowThreshold':
                this._lowComp.threshold.setValueAtTime(value, t);
                break;
            case 'lowRatio':
                this._lowComp.ratio.setValueAtTime(value, t);
                break;
            case 'lowGain':
                this._lowGain.gain.setValueAtTime(Math.pow(10, value / 20), t);
                break;
            case 'midThreshold':
                this._midComp.threshold.setValueAtTime(value, t);
                break;
            case 'midRatio':
                this._midComp.ratio.setValueAtTime(value, t);
                break;
            case 'midGain':
                this._midGain.gain.setValueAtTime(Math.pow(10, value / 20), t);
                break;
            case 'highThreshold':
                this._highComp.threshold.setValueAtTime(value, t);
                break;
            case 'highRatio':
                this._highComp.ratio.setValueAtTime(value, t);
                break;
            case 'highGain':
                this._highGain.gain.setValueAtTime(Math.pow(10, value / 20), t);
                break;
            case 'attack':
                this._lowComp.attack.setValueAtTime(value, t);
                this._midComp.attack.setValueAtTime(value, t);
                this._highComp.attack.setValueAtTime(value, t);
                break;
            case 'release':
                this._lowComp.release.setValueAtTime(value, t);
                this._midComp.release.setValueAtTime(value, t);
                this._highComp.release.setValueAtTime(value, t);
                break;
        }
    }
}

AudioEffect.register('MultibandCompressor', MultibandCompressor);
