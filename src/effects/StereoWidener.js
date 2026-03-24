import { AudioEffect } from './AudioEffect.js';

/**
 * StereoWidener — Mid-Side stereo width control.
 *
 * Uses mid-side processing to control stereo width:
 *   mid  = (L + R) / 2
 *   side = (L - R) / 2
 *   output L = mid * midGain + side * sideGain
 *   output R = mid * midGain - side * sideGain
 *
 * Width 0 = mono, 0.5 = normal stereo, 1.0 = sides only,
 * values > 0.5 enhance the stereo field.
 *
 * Signal chain:
 *   input -> splitter(2ch)
 *     ch0(L) -> midGainL(+0.5) ─┐
 *     ch1(R) -> midGainR(+0.5) ─┴─ midSum -> midLevel -> merger[0]+merger[1]
 *     ch0(L) -> sideGainL(+0.5) ─┐
 *     ch1(R) -> sideGainR(-0.5) ─┴─ sideDiff -> sideLevel -> merger[0]+sideInvert->merger[1]
 *   merger -> _wetGain
 */
export class StereoWidener extends AudioEffect {
    constructor() {
        super('StereoWidener', {
            width: 0.5
        });
        this._splitter = null;
        this._merger = null;
        this._midGainL = null;
        this._midGainR = null;
        this._sideGainL = null;
        this._sideGainR = null;
        this._midLevel = null;
        this._sideLevel = null;
        this._sideInvert = null;
    }

    _buildGraph(ctx) {
        // Split stereo input into L and R
        const splitter = ctx.createChannelSplitter(2);
        this._registerNode(splitter);
        this._splitter = splitter;

        // Merge back to stereo
        const merger = ctx.createChannelMerger(2);
        this._registerNode(merger);
        this._merger = merger;

        // --- Mid path: (L + R) / 2 ---
        // Sum L and R with gain 0.5 each to get mid
        const midGainL = ctx.createGain();
        midGainL.gain.value = 0.5;
        this._registerNode(midGainL);
        this._midGainL = midGainL;

        const midGainR = ctx.createGain();
        midGainR.gain.value = 0.5;
        this._registerNode(midGainR);
        this._midGainR = midGainR;

        // midSum node collects both mid contributions
        const midSum = ctx.createGain();
        midSum.gain.value = 1.0;
        this._registerNode(midSum);

        // midLevel controls how much mid goes to output
        const midLevel = ctx.createGain();
        this._registerNode(midLevel);
        this._midLevel = midLevel;

        // --- Side path: (L - R) / 2 ---
        const sideGainL = ctx.createGain();
        sideGainL.gain.value = 0.5;
        this._registerNode(sideGainL);
        this._sideGainL = sideGainL;

        const sideGainR = ctx.createGain();
        sideGainR.gain.value = -0.5; // Inverted to create L - R
        this._registerNode(sideGainR);
        this._sideGainR = sideGainR;

        // sideDiff collects side contributions
        const sideDiff = ctx.createGain();
        sideDiff.gain.value = 1.0;
        this._registerNode(sideDiff);

        // sideLevel controls how much side goes to output
        const sideLevel = ctx.createGain();
        this._registerNode(sideLevel);
        this._sideLevel = sideLevel;

        // Invert side for the right channel (R = mid - side)
        const sideInvert = ctx.createGain();
        sideInvert.gain.value = -1.0;
        this._registerNode(sideInvert);
        this._sideInvert = sideInvert;

        // --- Connections ---

        // Split input
        this.input.connect(splitter);

        // Mid: L*0.5 + R*0.5
        splitter.connect(midGainL, 0);
        splitter.connect(midGainR, 1);
        midGainL.connect(midSum);
        midGainR.connect(midSum);
        midSum.connect(midLevel);

        // Side: L*0.5 - R*0.5
        splitter.connect(sideGainL, 0);
        splitter.connect(sideGainR, 1);
        sideGainL.connect(sideDiff);
        sideGainR.connect(sideDiff);
        sideDiff.connect(sideLevel);

        // Output L = mid + side → merger channel 0
        midLevel.connect(merger, 0, 0);
        sideLevel.connect(merger, 0, 0);

        // Output R = mid - side → merger channel 1
        midLevel.connect(merger, 0, 1);
        sideLevel.connect(sideInvert);
        sideInvert.connect(merger, 0, 1);

        // Merger → wet output
        merger.connect(this._wetGain);

        // Apply initial width
        this._updateWidth(this.params.width);
    }

    /**
     * Update mid and side gain levels based on width parameter.
     *
     * width 0   → midGain=2, sideGain=0  (mono)
     * width 0.5 → midGain=1, sideGain=1  (normal stereo)
     * width 1.0 → midGain=0, sideGain=2  (sides only)
     */
    _updateWidth(width) {
        if (!this._midLevel) return;
        const t = this._ctx.currentTime;
        const midGain = 2 * (1 - width);
        const sideGain = 2 * width;
        this._midLevel.gain.setValueAtTime(midGain, t);
        this._sideLevel.gain.setValueAtTime(sideGain, t);
    }

    _applyParam(key, value) {
        switch (key) {
            case 'width':
                this._updateWidth(value);
                break;
        }
    }
}

AudioEffect.register('StereoWidener', StereoWidener);
