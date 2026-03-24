import { AudioEffect } from './AudioEffect.js';

/**
 * AutoPan — Ping-pong stereo auto-panner effect (similar to Ableton's Auto Pan).
 *
 * Uses an LFO to modulate stereo panning back and forth (ping-pong style).
 * The LFO controls left/right gain crossfade via two complementary gains.
 *
 * Signal chain:
 *   input → splitter → leftGain (LFO normal) → merger.left
 *                     → rightGain (LFO inverted) → merger.right
 *   merger → _wetGain
 *
 * LFO runs at the specified rate and can use multiple waveforms:
 *   sine     — smooth pan
 *   triangle — linear back-and-forth
 *   square   — hard left/right toggle
 *   sawtooth — ramp pan
 *
 * Params:
 *   rate       — LFO frequency in Hz (0.1–20 Hz)
 *   depth      — Modulation depth 0–1 (0 = no panning, 1 = full L↔R)
 *   shape      — LFO waveform: 'sine', 'triangle', 'square', 'sawtooth'
 *   phase      — Stereo phase offset in degrees (0–360). 180° = classic ping-pong
 *   offset     — Pan center offset (-1 = hard left, 0 = center, 1 = hard right)
 *   mix        — Dry/wet blend (informational, bypass handled by base)
 */
export class AutoPan extends AudioEffect {
    constructor() {
        super('AutoPan', {
            rate: 1.0,
            depth: 1.0,
            shape: 'sine',
            phase: 180,
            offset: 0,
            mix: 1.0,
            sync: 'free'
        });
        this._lfoL = null;
        this._lfoR = null;
        this._lfoGainL = null;
        this._lfoGainR = null;
        this._splitter = null;
        this._merger = null;
        this._baseGainL = null;
        this._baseGainR = null;
        this._depthGainL = null;
        this._depthGainR = null;
    }

    _buildGraph(ctx) {
        const { rate, depth, shape, phase } = this.params;

        // Create stereo splitter/merger
        // Use a channel splitter to handle mono→stereo: duplicate the mono signal to both channels
        const splitter = ctx.createChannelSplitter(2);
        this._registerNode(splitter);
        this._splitter = splitter;

        const merger = ctx.createChannelMerger(2);
        this._registerNode(merger);
        this._merger = merger;

        // Base gain (center level, reduced by depth)
        const baseGainL = ctx.createGain();
        baseGainL.gain.value = 1.0;
        this._registerNode(baseGainL);
        this._baseGainL = baseGainL;

        const baseGainR = ctx.createGain();
        baseGainR.gain.value = 1.0;
        this._registerNode(baseGainR);
        this._baseGainR = baseGainR;

        // LFO-driven depth gains (modulated by LFO)
        const depthGainL = ctx.createGain();
        depthGainL.gain.value = 0; // LFO modulates this
        this._registerNode(depthGainL);
        this._depthGainL = depthGainL;

        const depthGainR = ctx.createGain();
        depthGainR.gain.value = 0;
        this._registerNode(depthGainR);
        this._depthGainR = depthGainR;

        // Two LFOs: one for left, one for right (phase-shifted)
        const lfoL = ctx.createOscillator();
        lfoL.type = shape;
        lfoL.frequency.value = rate;
        this._registerNode(lfoL);
        this._lfoL = lfoL;

        const lfoR = ctx.createOscillator();
        lfoR.type = shape;
        lfoR.frequency.value = rate;
        this._registerNode(lfoR);
        this._lfoR = lfoR;

        // LFO gain scalers (control depth)
        const lfoGainL = ctx.createGain();
        lfoGainL.gain.value = depth * 0.5; // ±0.5 at full depth
        this._registerNode(lfoGainL);
        this._lfoGainL = lfoGainL;

        const lfoGainR = ctx.createGain();
        lfoGainR.gain.value = depth * 0.5;
        this._registerNode(lfoGainR);
        this._lfoGainR = lfoGainR;

        // Connect LFOs to their depth-gain modulators
        lfoL.connect(lfoGainL);
        lfoGainL.connect(baseGainL.gain); // Modulates L channel gain

        lfoR.connect(lfoGainR);
        lfoGainR.connect(baseGainR.gain); // Modulates R channel gain

        // Audio routing: input → splitter → per-channel gains → merger → wet output
        // First, ensure stereo by routing through splitter
        this.input.connect(splitter);

        // Left channel (splitter output 0) → baseGainL → merger input 0
        splitter.connect(baseGainL, 0);
        baseGainL.connect(merger, 0, 0);

        // Right channel (splitter output 1 — or same as 0 for mono input) → baseGainR → merger input 1
        splitter.connect(baseGainR, 1);
        baseGainR.connect(merger, 0, 1);

        // Merger → wet output
        merger.connect(this._wetGain);

        // Start both LFOs with phase offset
        const now = ctx.currentTime;
        const phaseOffsetSec = (phase / 360) / rate;
        lfoL.start(now);
        lfoR.start(now + phaseOffsetSec);
    }

    _applyParam(key, value) {
        if (!this._lfoL) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'rate':
                this._lfoL.frequency.setValueAtTime(value, t);
                this._lfoR.frequency.setValueAtTime(value, t);
                break;
            case 'depth':
                this._lfoGainL.gain.setValueAtTime(value * 0.5, t);
                this._lfoGainR.gain.setValueAtTime(value * 0.5, t);
                break;
            case 'shape':
                this._lfoL.type = value;
                this._lfoR.type = value;
                break;
            case 'offset':
                // Shift the base gains to offset the center panning
                // L channel gets louder when offset is negative (left), R when positive
                this._baseGainL.gain.setValueAtTime(0.5 + (-value * 0.5), t);
                this._baseGainR.gain.setValueAtTime(0.5 + (value * 0.5), t);
                break;
            case 'phase':
            case 'mix':
            case 'sync':
                // Phase requires rebuild (LFO start time offset), mix/sync handled by UI
                break;
        }
    }
}

AudioEffect.register('AutoPan', AutoPan);
