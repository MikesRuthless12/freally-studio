class AudioEngine {
    constructor() {
        if (AudioEngine.instance) {
            return AudioEngine.instance;
        }
        AudioEngine.instance = this;
        // Use the shared AudioContext to avoid multiple contexts competing
        // for the same system audio hardware (causes crackling/dropouts).
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            // Read user-configured audio settings (sample rate + latency hint)
            let ctxOptions = { latencyHint: 'playback' };
            try {
                const raw = localStorage.getItem('wavloom_settings');
                if (raw) {
                    const s = JSON.parse(raw);
                    if (s.latencyHint) ctxOptions.latencyHint = s.latencyHint;
                    if (s.sampleRate && typeof s.sampleRate === 'number') ctxOptions.sampleRate = s.sampleRate;
                }
            } catch (_) { /* use defaults */ }
            window.sharedAnalysisCtx = new Ctx(ctxOptions);
            // Suspend immediately — Realtek drivers degrade into static with idle running contexts
            window.sharedAnalysisCtx.suspend().catch(() => {});
        }
        this._audioContext = window.sharedAnalysisCtx;
        this._masterBusCtx = null; // tracks which context masterBus was built for
        this._ensureMasterBus();

        this.currentBuffer = null;
        this.currentSource = null;
        this.startTime = 0;
        this.pausedAt = 0;
        this.isPlaying = false;
        this.playbackRate = 1.0;
        this.onEndedCallback = null;

        this.isLooping = false;
        this.loopStart = 0;
        this.loopEnd = 0;

        this.bufferMap = {};
        this.lastVolume = 1.0;

        // Granular state
        this.granularInterval = null;
        this.granularPos = 0;
        this.isGranular = false;
    }

    /** Always return the current shared AudioContext (survives hot-swaps) */
    get audioContext() {
        return window.sharedAnalysisCtx || this._audioContext;
    }

    /** Rebuild masterBus if the AudioContext has been swapped */
    _ensureMasterBus() {
        const ctx = this.audioContext;
        if (this._masterBusCtx === ctx && this.masterBus) return;
        try {
            this.masterBus = ctx.createGain();
            this.masterBus.connect(ctx.destination);
            this._masterBusCtx = ctx;
        } catch (_) { /* context may not be ready yet */ }
    }

    async resume() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        // Auto-suspend after 10s of no audio activity to prevent Realtek static.
        // Any subsequent play/resume call will resume it again instantly.
        this._scheduleIdleSuspend();
    }

    _scheduleIdleSuspend() {
        if (this._idleSuspendTimer) clearTimeout(this._idleSuspendTimer);
        this._idleSuspendTimer = setTimeout(() => {
            // Don't suspend if SamplerEngine is actively playing (generators/arrangement)
            // — they share the same AudioContext via window.sharedAnalysisCtx.
            if (window.__samplerRef?._audioActive) return;
            if (this.audioContext.state === 'running' && !this.currentSource) {
                this.audioContext.suspend().catch(() => {});
            }
        }, 10000);
    }

    setMasterVolume(value) {
        if (this.masterBus) {
            this.masterBus.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.05);
            this.lastVolume = value;
        }
    }

    async loadAudio(file) {
        if (!file || !(file instanceof File)) {
            throw new Error("Invalid file provided. Expected a File object.");
        }

        // Return cached buffer if we already decoded this file
        if (this.bufferMap[file.name]) {
            return this.bufferMap[file.name];
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.bufferMap[file.name] = audioBuffer;
            return audioBuffer;
        } catch (error) {
            console.error("Error loading audio file:", error);
            throw error;
        }
    }

    reverseBuffer(bufferOrName) {
        let buffer = typeof bufferOrName === 'string' ? this.bufferMap[bufferOrName] : bufferOrName;
        if (!buffer) buffer = this.currentBuffer;
        if (!buffer) return;

        // Stop playback if reversing current buffer
        if (this.isPlaying && this.currentBuffer === buffer) {
            this.stop();
        }

        // Create new buffer to avoid mutation issues/constraints
        const newBuffer = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );

        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const oldData = buffer.getChannelData(i);
            const newData = newBuffer.getChannelData(i);
            // Reverse copy
            for (let j = 0; j < oldData.length; j++) {
                newData[j] = oldData[oldData.length - 1 - j];
            }
        }

        // Update references
        // If it was in the map, update the map
        // Optimization: Find key?
        for (const [key, val] of Object.entries(this.bufferMap)) {
            if (val === buffer) {
                this.bufferMap[key] = newBuffer;
            }
        }

        if (this.currentBuffer === buffer) {
            this.currentBuffer = newBuffer;
        }

        return newBuffer;
    }

    async play(bufferOrName, onEnded = null) {
        // Rebuild masterBus if context was hot-swapped
        this._ensureMasterBus();
        // Fire-and-forget resume — don't block playback if context is already running
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        // Reset idle suspend timer — active playback keeps context alive
        this._scheduleIdleSuspend();
        this.stopGranularScrape(false); // Don't full-stop (would reset pausedAt)

        if (onEnded) this.onEndedCallback = onEnded;

        let buffer;
        if (typeof bufferOrName === 'string') {
            buffer = this.bufferMap[bufferOrName];
        } else {
            buffer = bufferOrName || this.currentBuffer;
        }

        if (!buffer) {
            console.warn("No audio buffer selected.");
            return;
        }

        if (this.isPlaying) {
            this.stop();
        }

        this.currentBuffer = buffer;
        this.currentSource = this.audioContext.createBufferSource();
        this.currentSource.buffer = buffer;

        // Anti-click envelope: short fade-in to avoid discontinuity
        this._envGain = this.audioContext.createGain();
        this._envGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        this._envGain.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.005);
        this.currentSource.connect(this._envGain);
        this._envGain.connect(this.masterBus);

        // Apply settings
        this.currentSource.loop = this.isLooping;
        if (this.isLooping) {
            this.currentSource.loopStart = this.loopStart;
            this.currentSource.loopEnd = this.loopEnd > 0 ? this.loopEnd : buffer.duration;
        }

        this.currentSource.playbackRate.value = this.playbackRate;

        const offset = this.pausedAt;
        this.currentSource.start(0, offset);

        this.startTime = this.audioContext.currentTime - (offset / this.playbackRate);
        this.isPlaying = true;

        this.currentSource.onended = () => {
            if (!this.isLooping || !this.isPlaying) {
                this.isPlaying = false;
                if (this.onEndedCallback) this.onEndedCallback();
                // Schedule idle suspend after playback ends
                this._scheduleIdleSuspend();
            }
        };
    }

    pause() {
        if (!this.isPlaying || !this.currentSource) return;

        this.stopGranularScrape(false);

        // PausedAt calculation depends on PlaybackRate
        const elapsed = this.audioContext.currentTime - this.startTime;
        this.pausedAt = elapsed * this.playbackRate; // Convert real time to buffer time

        // Anti-click: fast fade-out before stopping
        if (this._envGain) {
            try {
                this._envGain.gain.cancelScheduledValues(this.audioContext.currentTime);
                this._envGain.gain.setValueAtTime(this._envGain.gain.value, this.audioContext.currentTime);
                this._envGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.005);
            } catch (e) { /* ignore */ }
        }
        const src = this.currentSource;
        const env = this._envGain;
        setTimeout(() => {
            try { src.stop(); } catch (e) { }
            try { src.disconnect(); } catch (e) { }
            try { if (env) env.disconnect(); } catch (e) { }
        }, 8);
        this.currentSource = null;
        this._envGain = null;
        this.isPlaying = false;
    }

    stop() {
        this.stopGranularScrape(false);
        if (this.currentSource) {
            this.currentSource.onended = null;
            // Anti-click: fast fade-out before stopping
            if (this._envGain) {
                try {
                    this._envGain.gain.cancelScheduledValues(this.audioContext.currentTime);
                    this._envGain.gain.setValueAtTime(this._envGain.gain.value, this.audioContext.currentTime);
                    this._envGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.005);
                } catch (e) { /* ignore */ }
            }
            const src = this.currentSource;
            const env = this._envGain;
            setTimeout(() => {
                try { src.stop(); } catch (e) { }
                try { src.disconnect(); } catch (e) { }
                try { if (env) env.disconnect(); } catch (e) { }
            }, 8);
            this.currentSource = null;
            this._envGain = null;
        }
        this.pausedAt = 0;
        this.isPlaying = false;
    }

    seek(time) {
        if (!this.currentBuffer) return;

        // If seeking past the end, stop and reset to beginning
        if (time >= this.currentBuffer.duration) {
            this.stop(); // sets pausedAt = 0, isPlaying = false
            return;
        }

        time = Math.max(0, time);

        if (this.isPlaying) {
            if (this.isGranular) {
                // Granular seek just updates the grain position
                this.granularPos = time;
            } else {
                // Stop the current source without resetting pausedAt
                if (this.currentSource) {
                    this.currentSource.onended = null;
                    try { this.currentSource.stop(); } catch (e) { }
                    try { this.currentSource.disconnect(); } catch (e) { }
                    this.currentSource = null;
                }
                this.isPlaying = false;
                // Set pausedAt right before play so stopGranularScrape can't wipe it
                this.pausedAt = time;
                // play() will read pausedAt for the offset
                this.play(this.currentBuffer, this.onEndedCallback);
            }
        } else {
            this.pausedAt = time;
        }
    }

    fastForward(seconds = 10) {
        this.seek(this.getCurrentTime() + seconds);
    }

    rewind(seconds = 10) {
        this.seek(this.getCurrentTime() - seconds);
    }

    setVolume(value) {
        this.masterBus.gain.setValueAtTime(value, this.audioContext.currentTime);
        if (value > 0) this.lastVolume = value;
    }

    mute(shouldMute) {
        if (shouldMute) {
            this.lastVolume = this.masterBus.gain.value;
            this.setVolume(0);
        } else {
            this.setVolume(this.lastVolume || 1.0);
        }
    }

    setLoop(isActive) {
        this.isLooping = isActive;
        if (this.currentSource && !this.isGranular) {
            this.currentSource.loop = isActive;
            if (isActive) {
                this.currentSource.loopStart = this.loopStart;
                this.currentSource.loopEnd = this.loopEnd > 0 ? this.loopEnd : this.currentBuffer?.duration || 0;
            }
        }
    }

    setLoopRegion(start, end) {
        if (start > end) [start, end] = [end, start];
        this.loopStart = start;
        this.loopEnd = end;
        if (start !== end && !this.isGranular) {
            this.setLoop(true);
        }
        if (this.currentSource && this.isLooping && !this.isGranular) {
            this.currentSource.loopStart = this.loopStart;
            this.currentSource.loopEnd = this.loopEnd;
        }
    }

    getLoopState() {
        return {
            isLooping: this.isLooping,
            loopStart: this.isGranular ? this.granularPos : this.loopStart, // Visualize grain as loop?
            loopEnd: this.isGranular ? (this.granularPos + this.grainSize) : this.loopEnd
        };
    }

    setPlaybackRate(rate) {
        this.playbackRate = rate;
        if (this.isPlaying && this.currentSource) {
            this.currentSource.playbackRate.setValueAtTime(rate, this.audioContext.currentTime);
            // Need to adjust startTime to keep sync?
            // T_now = startTime + (elapsed * rate)
            // If we change rate, future calculations change.
            // Syncing startTime after rate change is complex.
            // approx: 
            const currentBufferTime = this.getCurrentTime();
            this.startTime = this.audioContext.currentTime - (currentBufferTime / rate);
        }
    }

    // --- Granular Scrape ---

    startGranularScrape(grainSize = 0.05, speed = 0.5) {
        if (!this.currentBuffer) return;

        this.stop(); // Stop normal playback
        this.isGranular = true;
        this.grainSize = grainSize;
        this.granularSpeed = speed; // Speed multiplier relative to real time? 
        // Or "Move X seconds per grain"?
        // User said "timestretch texture without changing pitch".
        // Pitch = 1.0. Speed determines traversal.

        this.granularPos = this.pausedAt || 0;

        this.resume();

        this.currentSource = this.audioContext.createBufferSource();
        this.currentSource.buffer = this.currentBuffer;
        this.currentSource.connect(this.masterBus);

        this.currentSource.loop = true;
        this.currentSource.playbackRate.value = 1.0; // Grain pitch constant

        // Initial Loop
        this.currentSource.loopStart = this.granularPos;
        this.currentSource.loopEnd = this.granularPos + grainSize;

        this.currentSource.start(0, this.granularPos);
        this.isPlaying = true;

        // Schedule Loop Moves
        // Update frequency: e.g. every Grain Size duration? 
        // 50ms is 20Hz. setInterval is fine.

        this.granularInterval = setInterval(() => {
            if (!this.isPlaying) return;

            // Move position
            // We want to move 'speed' amount?
            // If speed=1, we move 50ms every 50ms.
            // If speed=0.5, we move 25ms every 50ms (stretch 2x).

            const moveAmount = grainSize * speed;
            this.granularPos += moveAmount;

            // Loop wrapper
            if (this.granularPos >= this.currentBuffer.duration) {
                this.granularPos = 0;
            }

            // Update Source Loop
            // Web Audio allows this live!
            this.currentSource.loopStart = this.granularPos;
            this.currentSource.loopEnd = this.granularPos + grainSize;

            // Note: The audio cursor 'jumps' to the new loop start only when it hits loopEnd?
            // Actually, changing loopStart/End affects the *next* loop iteration if currently playing inside?
            // Or immediate? 
            // It generally applies immediately to the check "am I past loopEnd?".

            // Verify Visualization Updates
            this.loopStart = this.granularPos;
            this.loopEnd = this.granularPos + grainSize;

        }, grainSize * 1000);
    }

    stopGranularScrape(fullStop = true) {
        if (this.granularInterval) {
            clearInterval(this.granularInterval);
            this.granularInterval = null;
        }
        this.isGranular = false;
        if (fullStop) this.stop();
    }

    getCurrentTime() {
        if (this.isGranular) {
            return this.granularPos;
        }
        if (this.isPlaying) {
            let time = (this.audioContext.currentTime - this.startTime) * this.playbackRate;
            if (this.currentBuffer) {
                const duration = this.currentBuffer.duration;
                if (this.isLooping) {
                    const end = (this.loopEnd > 0 && this.loopEnd <= duration) ? this.loopEnd : duration;
                    const start = (this.loopStart >= 0 && this.loopStart < end) ? this.loopStart : 0;
                    const range = end - start;
                    if (range > 0) {
                        if (time >= end) {
                            time = start + ((time - start) % range);
                        }
                    } else {
                        time = time % duration;
                    }
                } else {
                    time = Math.min(time, duration);
                }
            }
            return time;
        }
        return this.pausedAt;
    }

    getDuration() {
        return this.currentBuffer ? this.currentBuffer.duration : 0;
    }

    // ─────────────────────────────────────────────
    //  MEMORY MANAGEMENT
    // ─────────────────────────────────────────────

    /**
     * Remove a cached audio buffer by file name.
     * Frees the AudioBuffer reference so the browser can reclaim memory.
     * @param {string} name  File name key used during loadAudio()
     * @returns {boolean} true if a buffer was removed
     */
    clearBuffer(name) {
        if (!this.bufferMap[name]) return false;

        // If this buffer is currently playing, stop first
        if (this.currentBuffer === this.bufferMap[name]) {
            this.stop();
            this.currentBuffer = null;
        }
        delete this.bufferMap[name];
        return true;
    }

    /**
     * Clear ALL cached audio buffers.
     * Stops playback if any cached buffer is active.
     */
    clearAllBuffers() {
        this.stop();
        this.currentBuffer = null;
        this.bufferMap = {};
    }

    /**
     * Get the number of cached audio buffers and approximate memory usage.
     * @returns {{ count: number, estimatedBytes: number, names: string[] }}
     */
    getBufferCacheStats() {
        const names = Object.keys(this.bufferMap);
        let estimatedBytes = 0;
        for (const name of names) {
            const buf = this.bufferMap[name];
            if (buf) {
                // Each channel = Float32Array (4 bytes per sample)
                estimatedBytes += buf.numberOfChannels * buf.length * 4;
            }
        }
        return { count: names.length, estimatedBytes, names };
    }

    /**
     * Full engine teardown.
     * Stops all playback, clears all caches, disconnects audio nodes.
     * Safe to call multiple times (idempotent).
     * NOTE: After dispose(), the singleton is invalidated.
     */
    dispose() {
        // Stop all active playback
        this.stop();
        this.stopGranularScrape(true);

        // Disconnect master bus
        if (this.masterBus) {
            try { this.masterBus.disconnect(); } catch (_) {}
            this.masterBus = null;
        }

        // Clear buffer cache
        this.bufferMap = {};
        this.currentBuffer = null;
        this.currentSource = null;
        this.onEndedCallback = null;

        // Clear singleton reference
        AudioEngine.instance = null;
        if (window.audioEngine === this) {
            window.audioEngine = null;
        }
    }
}

const audioEngine = new AudioEngine();
window.audioEngine = audioEngine;
