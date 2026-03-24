import { AudioEffect } from './AudioEffect.js';

/**
 * Delay — Stereo Ping-Pong delay effect.
 *
 * Signal chain:
 *   input → splitter(ChannelSplitter,2) →
 *     leftDelay → leftFeedback → rightDelay  (cross-feed for ping-pong)
 *     rightDelay → rightFeedback → leftDelay  (cross-feed)
 *     leftDelay → filterL(lowpass) → merger[0]
 *     rightDelay → filterR(lowpass) → merger[1]
 *     merger → delayWetGain → _wetGain
 *
 * When pingPong is false, both channels feed back into themselves (no cross-feed).
 */
export class Delay extends AudioEffect {
    constructor() {
        super('Delay', {
            delayTime: 0.375,
            feedback: 0.4,
            filterFreq: 4000,
            pingPong: true,
            sync: false,
            mix: 0.3
        });
        this._splitter = null;
        this._merger = null;
        this._leftDelay = null;
        this._rightDelay = null;
        this._leftFeedback = null;
        this._rightFeedback = null;
        this._filterL = null;
        this._filterR = null;
        this._delayWetGain = null;
        // For reconnecting when pingPong changes
        this._isPingPong = true;
    }

    _buildGraph(ctx) {
        // Splitter and merger for stereo routing
        const splitter = ctx.createChannelSplitter(2);
        this._registerNode(splitter);
        this._splitter = splitter;

        const merger = ctx.createChannelMerger(2);
        this._registerNode(merger);
        this._merger = merger;

        // Left delay
        const leftDelay = ctx.createDelay(5.0);
        leftDelay.delayTime.value = this.params.delayTime;
        this._registerNode(leftDelay);
        this._leftDelay = leftDelay;

        // Right delay
        const rightDelay = ctx.createDelay(5.0);
        rightDelay.delayTime.value = this.params.delayTime;
        this._registerNode(rightDelay);
        this._rightDelay = rightDelay;

        // Feedback gains
        const leftFeedback = ctx.createGain();
        leftFeedback.gain.value = this.params.feedback;
        this._registerNode(leftFeedback);
        this._leftFeedback = leftFeedback;

        const rightFeedback = ctx.createGain();
        rightFeedback.gain.value = this.params.feedback;
        this._registerNode(rightFeedback);
        this._rightFeedback = rightFeedback;

        // Lowpass filters on output
        const filterL = ctx.createBiquadFilter();
        filterL.type = 'lowpass';
        filterL.frequency.value = this.params.filterFreq;
        filterL.Q.value = 0.707;
        this._registerNode(filterL);
        this._filterL = filterL;

        const filterR = ctx.createBiquadFilter();
        filterR.type = 'lowpass';
        filterR.frequency.value = this.params.filterFreq;
        filterR.Q.value = 0.707;
        this._registerNode(filterR);
        this._filterR = filterR;

        // Wet gain
        const delayWetGain = ctx.createGain();
        delayWetGain.gain.value = 1.0;
        this._registerNode(delayWetGain);
        this._delayWetGain = delayWetGain;

        // --- Connections ---

        // Input → splitter
        this.input.connect(splitter);

        // Splitter channels → delay lines
        splitter.connect(leftDelay, 0);
        splitter.connect(rightDelay, 1);

        // Delay outputs → feedback gains
        leftDelay.connect(leftFeedback);
        rightDelay.connect(rightFeedback);

        // Feedback routing (ping-pong: cross-feed; normal: self-feed)
        this._connectFeedback(this.params.pingPong);

        // Delay outputs → filters → merger
        leftDelay.connect(filterL);
        rightDelay.connect(filterR);
        filterL.connect(merger, 0, 0);
        filterR.connect(merger, 0, 1);

        // Merger → wet gain → _wetGain
        merger.connect(delayWetGain);
        delayWetGain.connect(this._wetGain);

        this._isPingPong = this.params.pingPong;
    }

    /**
     * Connect feedback paths based on ping-pong mode.
     */
    _connectFeedback(pingPong) {
        // Disconnect existing feedback connections
        try { this._leftFeedback.disconnect(); } catch (e) { /* not connected */ }
        try { this._rightFeedback.disconnect(); } catch (e) { /* not connected */ }

        if (pingPong) {
            // Cross-feed: left → right, right → left
            this._leftFeedback.connect(this._rightDelay);
            this._rightFeedback.connect(this._leftDelay);
        } else {
            // Self-feed: left → left, right → right
            this._leftFeedback.connect(this._leftDelay);
            this._rightFeedback.connect(this._rightDelay);
        }
    }

    _applyParam(key, value) {
        if (!this._leftDelay) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'delayTime':
                this._leftDelay.delayTime.setValueAtTime(value, t);
                this._rightDelay.delayTime.setValueAtTime(value, t);
                break;
            case 'feedback':
                this._leftFeedback.gain.setValueAtTime(value, t);
                this._rightFeedback.gain.setValueAtTime(value, t);
                break;
            case 'filterFreq':
                this._filterL.frequency.setValueAtTime(value, t);
                this._filterR.frequency.setValueAtTime(value, t);
                break;
            case 'pingPong':
                if (value !== this._isPingPong) {
                    this._connectFeedback(value);
                    this._isPingPong = value;
                }
                break;
            case 'sync':
                // Sync param is for UI tempo-sync logic; no direct audio graph change
                break;
            case 'mix':
                break;
        }
    }
}

AudioEffect.register('Delay', Delay);
