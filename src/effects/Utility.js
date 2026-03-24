import { AudioEffect } from './AudioEffect.js';

/**
 * Utility — Simple gain, pan, phase invert, mono, and mute tool.
 *
 * Signal chain:
 *   input -> phaseNode(WaveShaper, optional invert) -> gainNode -> monoSplitter/merger(optional)
 *   -> pannerNode(StereoPanner) -> _wetGain
 *
 * Params:
 *   gain         — linear gain multiplier (default 1.0)
 *   pan          — stereo pan -1 (left) to +1 (right) (default 0)
 *   phaseInvert  — if true, inverts the signal phase (default false)
 *   mono         — if true, sums stereo to mono (default false)
 *   mute         — if true, silences the output (default false)
 */
export class Utility extends AudioEffect {
    constructor() {
        super('Utility', {
            gain: 1.0,
            pan: 0,
            phaseInvert: false,
            mono: false,
            mute: false
        });
        this._gainNode = null;
        this._pannerNode = null;
        this._phaseNode = null;
        this._monoSplitter = null;
        this._monoMerger = null;
        this._monoMix = null;
        this._postMonoGain = null;
    }

    _buildGraph(ctx) {
        // Phase invert via WaveShaperNode — curve maps x to -x (invert) or x (normal)
        const phaseNode = ctx.createWaveShaper();
        phaseNode.oversample = 'none';
        this._registerNode(phaseNode);
        this._phaseNode = phaseNode;
        this._setPhaseInvertCurve(false);

        // Main gain control
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.params.gain;
        this._registerNode(gainNode);
        this._gainNode = gainNode;

        // Mono summing: split stereo → sum to mono → feed both channels
        const monoSplitter = ctx.createChannelSplitter(2);
        this._registerNode(monoSplitter);
        this._monoSplitter = monoSplitter;

        // monoMix sums L+R (each scaled by 0.5)
        const monoMix = ctx.createGain();
        monoMix.gain.value = 0.5;
        this._registerNode(monoMix);
        this._monoMix = monoMix;

        const monoMerger = ctx.createChannelMerger(2);
        this._registerNode(monoMerger);
        this._monoMerger = monoMerger;

        // Post-mono gain node — used to route either mono or stereo path
        const postMonoGain = ctx.createGain();
        postMonoGain.gain.value = 1.0;
        this._registerNode(postMonoGain);
        this._postMonoGain = postMonoGain;

        // Stereo panner
        const pannerNode = ctx.createStereoPanner();
        pannerNode.pan.value = this.params.pan;
        this._registerNode(pannerNode);
        this._pannerNode = pannerNode;

        // --- Connections ---
        // input → phaseNode → gainNode
        this.input.connect(phaseNode);
        phaseNode.connect(gainNode);

        // gainNode → monoSplitter (always split for potential mono processing)
        gainNode.connect(monoSplitter);

        // Mono sum path: L and R each at half gain into monoMix
        const monoGainL = ctx.createGain();
        monoGainL.gain.value = 1.0;
        this._registerNode(monoGainL);
        this._monoGainL = monoGainL;

        const monoGainR = ctx.createGain();
        monoGainR.gain.value = 1.0;
        this._registerNode(monoGainR);
        this._monoGainR = monoGainR;

        monoSplitter.connect(monoGainL, 0);
        monoSplitter.connect(monoGainR, 1);
        monoGainL.connect(monoMix);
        monoGainR.connect(monoMix);

        // monoMix → both channels of monoMerger
        monoMix.connect(monoMerger, 0, 0);
        monoMix.connect(monoMerger, 0, 1);

        // The stereo pass-through path: gainNode directly to postMonoGain
        // The mono path: monoMerger to postMonoGain
        // We control which is active using gain routing

        // Use two route gain nodes to toggle mono on/off
        this._stereoRoute = ctx.createGain();
        this._stereoRoute.gain.value = this.params.mono ? 0 : 1;
        this._registerNode(this._stereoRoute);

        this._monoRoute = ctx.createGain();
        this._monoRoute.gain.value = this.params.mono ? 1 : 0;
        this._registerNode(this._monoRoute);

        gainNode.connect(this._stereoRoute);
        this._stereoRoute.connect(postMonoGain);

        monoMerger.connect(this._monoRoute);
        this._monoRoute.connect(postMonoGain);

        // postMonoGain → panner → _wetGain
        postMonoGain.connect(pannerNode);
        pannerNode.connect(this._wetGain);
    }

    /**
     * Set the WaveShaper curve for phase inversion.
     * @param {boolean} invert — true to invert phase
     */
    _setPhaseInvertCurve(invert) {
        if (!this._phaseNode) return;
        const samples = 2;
        const curve = new Float32Array(samples);
        if (invert) {
            // Maps -1 to 1 and 1 to -1 (phase invert)
            curve[0] = 1;
            curve[1] = -1;
        } else {
            // Identity: maps -1 to -1 and 1 to 1
            curve[0] = -1;
            curve[1] = 1;
        }
        this._phaseNode.curve = curve;
    }

    _applyParam(key, value) {
        if (!this._gainNode) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'gain':
                if (!this.params.mute) {
                    this._gainNode.gain.setValueAtTime(value, t);
                }
                break;

            case 'pan':
                this._pannerNode.pan.setValueAtTime(value, t);
                break;

            case 'phaseInvert':
                this._setPhaseInvertCurve(value);
                break;

            case 'mono':
                if (value) {
                    this._stereoRoute.gain.setValueAtTime(0, t);
                    this._monoRoute.gain.setValueAtTime(1, t);
                } else {
                    this._stereoRoute.gain.setValueAtTime(1, t);
                    this._monoRoute.gain.setValueAtTime(0, t);
                }
                break;

            case 'mute':
                if (value) {
                    this._gainNode.gain.setValueAtTime(0, t);
                } else {
                    this._gainNode.gain.setValueAtTime(this.params.gain, t);
                }
                break;
        }
    }
}

AudioEffect.register('Utility', Utility);
