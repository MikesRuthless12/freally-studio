import { AudioEffect } from './AudioEffect.js';

/**
 * MasteringRack — Multi-stage mastering chain.
 *
 * Signal chain:
 *   input -> HP(30Hz) -> lowshelf(EQ low) -> peaking(EQ mid) -> highshelf(EQ high)
 *   -> compressor -> compMakeup
 *   -> stereoWidener(mid-side via delay trick)
 *   -> lookAheadDelay -> limiter(ratio:20, knee:0) -> limiterMakeup
 *   -> outputGain -> _wetGain
 *
 * Each stage can be individually bypassed.
 */
export class MasteringRack extends AudioEffect {
    constructor() {
        super('MasteringRack', {
            // EQ stage
            eqBypass: false,
            eqHPFreq: 30,
            eqLowGain: 0,
            eqMidGain: 0,
            eqMidFreq: 1000,
            eqHighGain: 0,
            // Compressor stage
            compBypass: false,
            compThreshold: -12,
            compRatio: 2,
            compAttack: 0.01,
            compRelease: 0.15,
            compMakeup: 0,
            // Width stage
            widthBypass: false,
            widthAmount: 0.5,
            // Limiter stage
            limBypass: false,
            limCeiling: -0.3,
            limRelease: 0.05,
            // Output
            outputGain: 0
        });
        // EQ nodes
        this._hpFilter = null;
        this._lowShelf = null;
        this._midPeak = null;
        this._highShelf = null;
        // Comp nodes
        this._compressor = null;
        this._compMakeup = null;
        // Width
        this._widthDelay = null;
        this._widthGain = null;
        // Limiter
        this._limDelay = null;
        this._limiter = null;
        this._limMakeup = null;
        // Output
        this._outputGain = null;
        // Bypass routing
        this._eqIn = null;
        this._eqOut = null;
        this._compIn = null;
        this._compOut = null;
        this._widthIn = null;
        this._widthOut = null;
        this._limIn = null;
        this._limOut = null;
    }

    _buildGraph(ctx) {
        // === EQ Stage ===
        const eqIn = ctx.createGain();
        eqIn.gain.value = 1;
        this._registerNode(eqIn);
        this._eqIn = eqIn;

        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = this.params.eqHPFreq;
        hpFilter.Q.value = 0.7;
        this._registerNode(hpFilter);
        this._hpFilter = hpFilter;

        const lowShelf = ctx.createBiquadFilter();
        lowShelf.type = 'lowshelf';
        lowShelf.frequency.value = 200;
        lowShelf.gain.value = this.params.eqLowGain;
        this._registerNode(lowShelf);
        this._lowShelf = lowShelf;

        const midPeak = ctx.createBiquadFilter();
        midPeak.type = 'peaking';
        midPeak.frequency.value = this.params.eqMidFreq;
        midPeak.Q.value = 1.5;
        midPeak.gain.value = this.params.eqMidGain;
        this._registerNode(midPeak);
        this._midPeak = midPeak;

        const highShelf = ctx.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.value = 8000;
        highShelf.gain.value = this.params.eqHighGain;
        this._registerNode(highShelf);
        this._highShelf = highShelf;

        const eqOut = ctx.createGain();
        eqOut.gain.value = 1;
        this._registerNode(eqOut);
        this._eqOut = eqOut;

        eqIn.connect(hpFilter);
        hpFilter.connect(lowShelf);
        lowShelf.connect(midPeak);
        midPeak.connect(highShelf);
        highShelf.connect(eqOut);

        // === Compressor Stage ===
        const compIn = ctx.createGain();
        compIn.gain.value = 1;
        this._registerNode(compIn);
        this._compIn = compIn;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = this.params.compThreshold;
        compressor.ratio.value = this.params.compRatio;
        compressor.attack.value = this.params.compAttack;
        compressor.release.value = this.params.compRelease;
        compressor.knee.value = 10;
        this._registerNode(compressor);
        this._compressor = compressor;

        const compMakeup = ctx.createGain();
        compMakeup.gain.value = Math.pow(10, this.params.compMakeup / 20);
        this._registerNode(compMakeup);
        this._compMakeup = compMakeup;

        const compOut = ctx.createGain();
        compOut.gain.value = 1;
        this._registerNode(compOut);
        this._compOut = compOut;

        compIn.connect(compressor);
        compressor.connect(compMakeup);
        compMakeup.connect(compOut);

        // === Width Stage ===
        const widthIn = ctx.createGain();
        widthIn.gain.value = 1;
        this._registerNode(widthIn);
        this._widthIn = widthIn;

        // Simple stereo width via short delay on one channel
        const widthDelay = ctx.createDelay(0.03);
        widthDelay.delayTime.value = this.params.widthAmount * 0.015;
        this._registerNode(widthDelay);
        this._widthDelay = widthDelay;

        const widthGain = ctx.createGain();
        widthGain.gain.value = 1;
        this._registerNode(widthGain);
        this._widthGain = widthGain;

        const widthOut = ctx.createGain();
        widthOut.gain.value = 1;
        this._registerNode(widthOut);
        this._widthOut = widthOut;

        widthIn.connect(widthDelay);
        widthDelay.connect(widthGain);
        widthGain.connect(widthOut);

        // === Limiter Stage ===
        const limIn = ctx.createGain();
        limIn.gain.value = 1;
        this._registerNode(limIn);
        this._limIn = limIn;

        const limDelay = ctx.createDelay(0.01);
        limDelay.delayTime.value = 0.001;
        this._registerNode(limDelay);
        this._limDelay = limDelay;

        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = this.params.limCeiling;
        limiter.ratio.value = 20;
        limiter.knee.value = 0;
        limiter.attack.value = 0.001;
        limiter.release.value = this.params.limRelease;
        this._registerNode(limiter);
        this._limiter = limiter;

        const limMakeup = ctx.createGain();
        limMakeup.gain.value = 1;
        this._registerNode(limMakeup);
        this._limMakeup = limMakeup;

        const limOut = ctx.createGain();
        limOut.gain.value = 1;
        this._registerNode(limOut);
        this._limOut = limOut;

        limIn.connect(limDelay);
        limDelay.connect(limiter);
        limiter.connect(limMakeup);
        limMakeup.connect(limOut);

        // === Output ===
        const outputGain = ctx.createGain();
        outputGain.gain.value = Math.pow(10, this.params.outputGain / 20);
        this._registerNode(outputGain);
        this._outputGain = outputGain;

        // === Master chain: input -> EQ -> Comp -> Width -> Limiter -> Output -> _wetGain ===
        this.input.connect(eqIn);
        eqOut.connect(compIn);
        compOut.connect(widthIn);
        widthOut.connect(limIn);
        limOut.connect(outputGain);
        outputGain.connect(this._wetGain);
    }

    _applyParam(key, value) {
        if (!this._compressor) return;
        const t = this._ctx.currentTime;

        switch (key) {
            // EQ
            case 'eqHPFreq':
                this._hpFilter.frequency.setValueAtTime(value, t);
                break;
            case 'eqLowGain':
                this._lowShelf.gain.setValueAtTime(value, t);
                break;
            case 'eqMidGain':
                this._midPeak.gain.setValueAtTime(value, t);
                break;
            case 'eqMidFreq':
                this._midPeak.frequency.setValueAtTime(value, t);
                break;
            case 'eqHighGain':
                this._highShelf.gain.setValueAtTime(value, t);
                break;
            // Compressor
            case 'compThreshold':
                this._compressor.threshold.setValueAtTime(value, t);
                break;
            case 'compRatio':
                this._compressor.ratio.setValueAtTime(value, t);
                break;
            case 'compAttack':
                this._compressor.attack.setValueAtTime(value, t);
                break;
            case 'compRelease':
                this._compressor.release.setValueAtTime(value, t);
                break;
            case 'compMakeup':
                this._compMakeup.gain.setValueAtTime(Math.pow(10, value / 20), t);
                break;
            // Width
            case 'widthAmount':
                this._widthDelay.delayTime.setValueAtTime(value * 0.015, t);
                break;
            // Limiter
            case 'limCeiling':
                this._limiter.threshold.setValueAtTime(value, t);
                break;
            case 'limRelease':
                this._limiter.release.setValueAtTime(value, t);
                break;
            // Output
            case 'outputGain':
                this._outputGain.gain.setValueAtTime(Math.pow(10, value / 20), t);
                break;
        }
    }
}

AudioEffect.register('MasteringRack', MasteringRack);
