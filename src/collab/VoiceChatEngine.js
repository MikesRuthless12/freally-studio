/**
 * VoiceChatEngine — Broadcast-quality voice capture engine for push-to-talk.
 *
 * Audio graph:
 *   micSource -> inputGain -> gainNode (PTT gate) -> highpass (80Hz) -> lowpass (14kHz)
 *   -> presenceBoost (3.5kHz) -> compressor (gentle) -> limiter -> analyser -> mediaStreamDest
 *
 * Self-monitor is ON by default so users hear what others hear.
 * Can be disabled via setSelfMonitor(false) if feedback occurs on speakers.
 *
 * getUserMedia captures RAW audio with all browser processing DISABLED.
 * Browser echoCancellation/noiseSuppression/autoGainControl cause static,
 * cutouts, and robotic artifacts — clean DSP filtering handles noise instead.
 */
export class VoiceChatEngine {
    constructor(audioContext) {
        this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        this._ownsCtx = !audioContext;
        this.stream = null;
        this.micSource = null;
        this.inputGain = null;
        this.gainNode = null;
        this.highpass = null;
        this.lowpass = null;
        this.presenceBoost = null;
        this.compressor = null;
        this.limiter = null;
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

        // Capture raw audio — all browser processing DISABLED.
        // echoCancellation / noiseSuppression / autoGainControl cause static,
        // cutouts, and robotic artifacts. Clean DSP handles noise instead.
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 1,
                sampleRate: { ideal: 48000 }
            }
        });

        this.micSource = this.ctx.createMediaStreamSource(this.stream);

        // Input gain — normalize mic level before processing
        this.inputGain = this.ctx.createGain();
        this.inputGain.gain.value = 1.2;

        // PTT gate — gain 0 = silent, 1 = talking
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0;

        // Highpass at 80 Hz — removes room rumble, handling noise, HVAC
        this.highpass = this.ctx.createBiquadFilter();
        this.highpass.type = 'highpass';
        this.highpass.frequency.value = 80;
        this.highpass.Q.value = 0.707;

        // Lowpass at 14 kHz — preserves full voice clarity including sibilants
        // (previous 7.5 kHz cutoff removed consonant detail causing muffled audio)
        this.lowpass = this.ctx.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = 14000;
        this.lowpass.Q.value = 0.707;

        // Presence boost at 3.5 kHz — adds vocal clarity and intelligibility
        this.presenceBoost = this.ctx.createBiquadFilter();
        this.presenceBoost.type = 'peaking';
        this.presenceBoost.frequency.value = 3500;
        this.presenceBoost.Q.value = 1.0;
        this.presenceBoost.gain.value = 3;

        // Gentle compressor — smooths levels without crushing dynamics
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 2.5;
        this.compressor.attack.value = 0.010;
        this.compressor.release.value = 0.250;

        // Safety limiter — catches peaks without audible pumping
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -2;
        this.limiter.knee.value = 0;
        this.limiter.ratio.value = 20;
        this.limiter.attack.value = 0.001;
        this.limiter.release.value = 0.050;

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

        // Wire the graph:
        // micSource -> inputGain -> gainNode (PTT) -> highpass -> lowpass
        //   -> presenceBoost -> compressor -> limiter -> analyser -> mediaStreamDest
        this.micSource.connect(this.inputGain);
        this.inputGain.connect(this.gainNode);
        this.gainNode.connect(this.highpass);
        this.highpass.connect(this.lowpass);
        this.lowpass.connect(this.presenceBoost);
        this.presenceBoost.connect(this.compressor);
        this.compressor.connect(this.limiter);
        this.limiter.connect(this.analyser);
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
            if (this.limiter) {
                this.limiter.disconnect();
                this.limiter = null;
            }
            if (this.compressor) {
                this.compressor.disconnect();
                this.compressor = null;
            }
            if (this.presenceBoost) {
                this.presenceBoost.disconnect();
                this.presenceBoost = null;
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
            if (this.inputGain) {
                this.inputGain.disconnect();
                this.inputGain = null;
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
