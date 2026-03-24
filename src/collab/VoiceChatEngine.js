/**
 * VoiceChatEngine — Core voice capture engine for push-to-talk.
 *
 * Audio graph:
 *   micSource -> gainNode (PTT gate) -> compressor -> analyserNode -> mediaStreamDest (sent to peers)
 *
 * Self-monitor is ON by default so users hear what others hear.
 * Can be disabled via setSelfMonitor(false) if feedback occurs on speakers.
 *
 * getUserMedia constraints optimised for voice chat:
 *   echoCancellation, noiseSuppression, autoGainControl, mono
 */
export class VoiceChatEngine {
    constructor(audioContext) {
        this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        this._ownsCtx = !audioContext;
        this.stream = null;
        this.micSource = null;
        this.gainNode = null;
        this.highpass = null;
        this.lowpass = null;
        this.compressor = null;
        this.analyser = null;
        this.mediaStreamDest = null;
        this.selfMonitorGain = null;
        this.talking = false;
        this._disposed = false;
        this._analyserBuf = null;
        this._selfMonEnabled = true;
        this._selfMonVol = 0.08;
    }

    /**
     * Initialise mic capture and build the audio graph.
     * Returns the outgoing MediaStream to send to peers.
     */
    async init() {
        if (this._disposed) throw new Error('Engine disposed');
        if (this.stream) return this.mediaStreamDest.stream; // already initialised

        // Resume context if suspended (Chrome autoplay policy)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1
            }
        });

        this.micSource = this.ctx.createMediaStreamSource(this.stream);

        // PTT gate — gain 0 = silent, 1 = talking
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0;

        // Bandpass filtering for voice — cuts rumble and hiss that cause static
        this.highpass = this.ctx.createBiquadFilter();
        this.highpass.type = 'highpass';
        this.highpass.frequency.value = 85;
        this.highpass.Q.value = 0.7;

        this.lowpass = this.ctx.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = 7500;
        this.lowpass.Q.value = 0.7;

        // Outgoing compressor to prevent clipping/crackling on the send side
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 3;
        this.compressor.attack.value = 0.005;
        this.compressor.release.value = 0.2;

        // Analyser for local level metering
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.6;
        this._analyserBuf = new Float32Array(this.analyser.fftSize);

        // Output stream that gets sent to peers via PeerJS call
        this.mediaStreamDest = this.ctx.createMediaStreamDestination();

        // Self-monitor gain — ON by default so user hears what others hear
        this.selfMonitorGain = this.ctx.createGain();
        this.selfMonitorGain.gain.value = 0; // Starts at 0; activated in startTalking() when PTT pressed

        // Wire the graph: micSource -> gainNode -> highpass -> lowpass -> compressor -> analyser -> mediaStreamDest
        this.micSource.connect(this.gainNode);
        this.gainNode.connect(this.highpass);
        this.highpass.connect(this.lowpass);
        this.lowpass.connect(this.compressor);
        this.compressor.connect(this.analyser);
        this.analyser.connect(this.mediaStreamDest);

        // Self-monitor path: analyser -> selfMonitorGain -> speakers
        this.analyser.connect(this.selfMonitorGain);
        this.selfMonitorGain.connect(this.ctx.destination);

        return this.mediaStreamDest.stream;
    }

    /** Enable mic output (PTT pressed) */
    startTalking() {
        if (!this.gainNode || this._disposed) return;
        this.talking = true;
        this.gainNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.008);
        // Enable self-monitor if user opted in
        if (this.selfMonitorGain && this._selfMonEnabled) {
            this.selfMonitorGain.gain.setTargetAtTime(this._selfMonVol, this.ctx.currentTime, 0.008);
        }
    }

    /** Mute mic output (PTT released) */
    stopTalking() {
        if (!this.gainNode || this._disposed) return;
        this.talking = false;
        this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.008);
        if (this.selfMonitorGain) {
            this.selfMonitorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.008);
        }
    }

    /**
     * Toggle self-monitoring (hear yourself). Only safe with headphones.
     */
    setSelfMonitor(enabled) {
        this._selfMonEnabled = enabled;
        if (this.selfMonitorGain) {
            if (!enabled || !this.talking) {
                this.selfMonitorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
            } else {
                this.selfMonitorGain.gain.setTargetAtTime(this._selfMonVol, this.ctx.currentTime, 0.01);
            }
        }
    }

    /**
     * Set self-monitor volume (0 = off, 1 = full).
     */
    setSelfMonitorVolume(v) {
        this._selfMonVol = Math.max(0, Math.min(1, v));
        if (this.selfMonitorGain && this.talking && this._selfMonEnabled) {
            this.selfMonitorGain.gain.setTargetAtTime(this._selfMonVol, this.ctx.currentTime, 0.01);
        }
    }

    /**
     * Get current mic RMS level (0-1).
     * Call this in a rAF loop for metering.
     */
    getLevel() {
        if (!this.analyser || this._disposed) return 0;
        this.analyser.getFloatTimeDomainData(this._analyserBuf);
        let sum = 0;
        for (let i = 0; i < this._analyserBuf.length; i++) {
            sum += this._analyserBuf[i] * this._analyserBuf[i];
        }
        return Math.sqrt(sum / this._analyserBuf.length);
    }

    /** Clean up all resources */
    dispose() {
        this._disposed = true;
        this.talking = false;
        try {
            if (this.selfMonitorGain) {
                this.selfMonitorGain.disconnect();
                this.selfMonitorGain = null;
            }
            if (this.analyser) {
                this.analyser.disconnect();
                this.analyser = null;
            }
            if (this.compressor) {
                this.compressor.disconnect();
                this.compressor = null;
            }
            if (this.lowpass) {
                this.lowpass.disconnect();
                this.lowpass = null;
            }
            if (this.highpass) {
                this.highpass.disconnect();
                this.highpass = null;
            }
            if (this.gainNode) {
                this.gainNode.disconnect();
                this.gainNode = null;
            }
            if (this.micSource) {
                this.micSource.disconnect();
                this.micSource = null;
            }
            if (this.mediaStreamDest) {
                this.mediaStreamDest.disconnect();
                this.mediaStreamDest = null;
            }
            if (this.stream) {
                this.stream.getTracks().forEach(t => t.stop());
                this.stream = null;
            }
            if (this._ownsCtx && this.ctx) {
                this.ctx.close().catch(() => {});
            }
        } catch (e) {
            console.warn('[VoiceChatEngine] dispose error:', e);
        }
    }
}

export default VoiceChatEngine;
