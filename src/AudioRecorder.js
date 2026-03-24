/**
 * AudioRecorder — Live microphone recording engine for WavLoom Studio.
 *
 * Records audio from the user's microphone using the Web Audio API.
 * Uses AudioWorkletNode (dedicated audio thread) for glitch-free recording,
 * with ScriptProcessorNode fallback for browsers that don't support worklets.
 *
 * Features:
 *   - Records at 44100 Hz (or falls back to device native rate)
 *   - Count-in metronome (configurable number of bars/beats)
 *   - Real-time waveform preview during recording (getRecentSamples / getAllRecordedSamples)
 *   - Exports as 44100 Hz WAV AudioBuffers compatible with project save/load
 *   - Input level monitoring
 *
 * Usage:
 *   const recorder = new AudioRecorder(audioContext);
 *   await recorder.init();
 *   recorder.startRecording({ tempo, countInBars, onCountBeat, onProgress });
 *   // ... later ...
 *   const { audioBuffer, duration } = await recorder.stopRecording();
 */

export class AudioRecorder {
    /**
     * @param {AudioContext|Function} audioContextOrGetter — Either an AudioContext
     *   or a getter function that returns the current AudioContext.
     *   A getter is preferred because the hot-swap workaround replaces the context
     *   every ~6 seconds, and a stale reference causes "context is closed" errors.
     */
    constructor(audioContextOrGetter) {
        this._audioCtxGetter = typeof audioContextOrGetter === 'function'
            ? audioContextOrGetter : null;
        this.audioContext = typeof audioContextOrGetter === 'function'
            ? audioContextOrGetter() : audioContextOrGetter;
        this._recordingContext = null;          // Dedicated context for recording (own audio thread)
        this.stream = null;
        this.sourceNode = null;
        this.processorNode = null;
        this.analyserNode = null;
        this.recording = false;
        this.countingIn = false;
        this.recordedChunks = [];
        this.sampleRate = 44100;
        this._onProgress = null;
        this._countInTimer = null;
        this._startTime = 0;
        this._analyserData = null;
        this._useWorklet = false;      // true if AudioWorklet is available
        this._workletReady = false;    // true after worklet module is loaded
        this._totalRecordedSamples = 0; // running total for getAllRecordedSamples
        // Pre-allocated growing buffer — avoids O(n) merge on every getAllRecordedSamples() call
        // Start with 60 seconds capacity to avoid reallocations during recording
        this._mergedBuffer = new Float32Array(60 * 48000); // ~60 sec at 48kHz
        this._mergedLength = 0;
        // Incremental peak tracking — avoids O(n) full scan in waveform renderer
        this._peaks = [];             // Pre-computed peak values (one per _peakWindow samples)
        this._peakWindow = 256;       // Samples per peak bucket
        this._peakAccMax = 0;         // Running max for current bucket
        this._peakAccCount = 0;       // Samples counted in current bucket
        // Throttle onProgress to ~30Hz to prevent excessive React re-renders
        this._lastProgressTime = 0;
        this._progressIntervalMs = 33; // ~30Hz
    }

    /**
     * Append a chunk of samples to the pre-allocated merged buffer.
     * Also incrementally computes peaks for waveform rendering.
     * Doubles capacity when needed — amortized O(1) per append.
     */
    _appendToMergedBuffer(chunk) {
        const needed = this._mergedLength + chunk.length;
        if (needed > this._mergedBuffer.length) {
            const newSize = Math.max(needed, this._mergedBuffer.length * 2);
            const bigger = new Float32Array(newSize);
            bigger.set(this._mergedBuffer.subarray(0, this._mergedLength));
            this._mergedBuffer = bigger;
        }
        this._mergedBuffer.set(chunk, this._mergedLength);
        this._mergedLength += chunk.length;

        // Incrementally compute peaks as samples arrive
        for (let i = 0; i < chunk.length; i++) {
            const abs = Math.abs(chunk[i]);
            if (abs > this._peakAccMax) this._peakAccMax = abs;
            this._peakAccCount++;
            if (this._peakAccCount >= this._peakWindow) {
                this._peaks.push(this._peakAccMax);
                this._peakAccMax = 0;
                this._peakAccCount = 0;
            }
        }
    }

    /**
     * Request microphone permission and set up the audio graph.
     * Must be called before startRecording().
     */
    async init() {
        if (this.stream) return; // Already initialized

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 44100,
                channelCount: 1,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        // Ensure main context (for count-in clicks) is running
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();

        // Create a DEDICATED AudioContext for recording.
        // Each AudioContext gets its own audio rendering thread in Chrome.
        // This isolates recording from the main context's synth/effects graph,
        // guaranteeing 100% sample capture regardless of playback complexity.
        if (!this._recordingContext || this._recordingContext.state === 'closed') {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this._recordingContext = new Ctx({ sampleRate: 44100 });
            this._workletReady = false; // Need to reload worklet on new context
        }

        const recCtx = this._recordingContext;
        if (recCtx.state === 'suspended') await recCtx.resume();

        // Create source from mic stream on the RECORDING context (not main)
        this.sourceNode = recCtx.createMediaStreamSource(this.stream);

        // Analyser for input level metering (on recording context)
        this.analyserNode = recCtx.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = 0.8;
        this._analyserData = new Float32Array(this.analyserNode.fftSize);
        this.sourceNode.connect(this.analyserNode);

        // Store the actual sample rate we'll be recording at
        this.sampleRate = recCtx.sampleRate;

        // Try to load AudioWorklet module on the RECORDING context
        if (recCtx.audioWorklet && !this._workletReady) {
            try {
                await recCtx.audioWorklet.addModule('recording-processor.js');
                this._useWorklet = true;
                this._workletReady = true;
            } catch (e) {
                // AudioWorklet not available — fall back to ScriptProcessorNode
                this._useWorklet = false;
            }
        }
    }

    /**
     * Play an Ableton-style metronome click for count-in.
     * High TICK on downbeat, lower tock on other beats.
     * Routes directly to audioContext.destination (not recorded).
     */
    _playCountInClick(accented) {
        // Always get the LIVE context — hot-swap may have replaced it since count-in started
        const ctx = this._audioCtxGetter ? this._audioCtxGetter() : this.audioContext;
        if (!ctx || ctx.state === 'closed') return;
        const now = ctx.currentTime;

        const freq = accented ? 1500 : 1000;
        const hpFreq = accented ? 1200 : 800;
        const decay = accented ? 0.05 : 0.035;
        const amp = accented ? 0.8 : 0.5;

        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = hpFreq;
        hp.Q.value = 1.0;

        const env = ctx.createGain();
        env.gain.setValueAtTime(amp, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + decay);

        osc.connect(hp);
        hp.connect(env);
        env.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + decay + 0.01);

        osc.onended = () => {
            osc.disconnect();
            hp.disconnect();
            env.disconnect();
            osc.onended = null;
        };
    }

    /**
     * Get current input level (RMS) for metering. Returns 0–1.
     */
    getInputLevel() {
        if (!this.analyserNode || !this._analyserData) return 0;
        this.analyserNode.getFloatTimeDomainData(this._analyserData);
        let sum = 0;
        for (let i = 0; i < this._analyserData.length; i++) {
            sum += this._analyserData[i] * this._analyserData[i];
        }
        return Math.sqrt(sum / this._analyserData.length);
    }

    /**
     * Start recording with optional count-in.
     *
     * @param {object} options
     * @param {number} options.tempo — BPM for count-in timing
     * @param {number} [options.countInBars=1] — Bars of count-in (0 = no count-in)
     * @param {number} [options.beatsPerBar=4] — Beats per bar for count-in
     * @param {function} [options.onCountBeat] — Called with (beatNumber, totalBeats) during count-in
     * @param {function} [options.onRecordingStart] — Called when actual recording begins (after count-in)
     * @param {function} [options.onProgress] — Called with { elapsed, samples } during recording
     * @returns {Promise} — Resolves when count-in finishes and recording actually starts
     */
    async startRecording(options = {}) {
        if (!this.stream) throw new Error('AudioRecorder not initialized. Call init() first.');
        if (this.recording || this.countingIn) return;

        const {
            tempo = 120,
            countInBars = 1,
            beatsPerBar = 4,
            onCountBeat,
            onRecordingStart,
            onProgress
        } = options;

        this._onProgress = onProgress;
        this.recordedChunks = [];
        this._mergedLength = 0;
        this._peaks = [];
        this._peakAccMax = 0;
        this._peakAccCount = 0;
        this._lastProgressTime = 0;
        // Diagnostic logging — tracks recording health
        this._diagMsgCount = 0;
        this._diagLastLogTime = 0;
        this._diagLastSampleCount = 0;
        this._diagStartTime = performance.now();
        this._diagGaps = 0;

        // --- Count-in phase with metronome clicks ---
        if (countInBars > 0) {
            this.countingIn = true;
            const totalBeats = countInBars * beatsPerBar;
            const beatDuration = 60 / tempo; // seconds per beat

            await new Promise((resolve) => {
                let beat = 0;
                const tick = () => {
                    if (beat < totalBeats) {
                        // Play metronome click sound
                        const isDownbeat = (beat % beatsPerBar === 0);
                        this._playCountInClick(isDownbeat);
                        if (onCountBeat) onCountBeat(beat + 1, totalBeats);
                        beat++;
                        this._countInTimer = setTimeout(tick, beatDuration * 1000);
                    } else {
                        this.countingIn = false;
                        resolve();
                    }
                };
                tick();
            });
        }

        // --- Start actual recording ---
        this.recording = true;
        this._startTime = this._recordingContext.currentTime;
        this._totalRecordedSamples = 0;
        // Reset diagnostic timing to exclude count-in period
        this._diagStartTime = performance.now();
        this._diagLastLogTime = performance.now();
        this._diagLastSampleCount = 0;
        this._diagMsgCount = 0;

        // Ensure recording context is running (may have been suspended by browser)
        if (this._recordingContext.state === 'suspended') {
            await this._recordingContext.resume();
        }

        const recCtx = this._recordingContext;

        if (this._useWorklet) {
            // AudioWorklet path — runs on dedicated recording context's audio thread
            // (isolated from main context's synth/effects, guaranteeing 100% capture)
            this.processorNode = new AudioWorkletNode(recCtx, 'recording-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 1
            });

            this.processorNode.port.onmessage = (e) => {
                if (e.data.type === 'samples') {
                    const chunkLen = e.data.samples.length;
                    this._appendToMergedBuffer(e.data.samples);
                    this._totalRecordedSamples = e.data.totalSamples;
                    this._diagMsgCount++;

                    // Diagnostic: log recording health every 2 seconds
                    const now = performance.now();
                    const diagElapsed = now - this._diagStartTime;
                    if (now - this._diagLastLogTime >= 2000) {
                        const expectedSamples = (diagElapsed / 1000) * this.sampleRate;
                        const actualSamples = this._mergedLength;
                        const ratio = actualSamples / Math.max(1, expectedSamples);
                        const samplesPerSec = (actualSamples - this._diagLastSampleCount) / ((now - this._diagLastLogTime) / 1000);
                        console.log(
                            `[AudioRecorder] ${(diagElapsed / 1000).toFixed(1)}s | ` +
                            `msgs: ${this._diagMsgCount} | ` +
                            `samples: ${actualSamples}/${Math.round(expectedSamples)} (${(ratio * 100).toFixed(1)}%) | ` +
                            `rate: ${Math.round(samplesPerSec)}/sec | ` +
                            `chunk: ${chunkLen} | ` +
                            `buffer: ${this._mergedBuffer.length} | ` +
                            `peaks: ${this._peaks.length}`
                        );
                        this._diagLastLogTime = now;
                        this._diagLastSampleCount = actualSamples;
                    }

                    // Throttle onProgress to ~30Hz to prevent excessive React re-renders
                    if (this._onProgress) {
                        if (now - this._lastProgressTime >= this._progressIntervalMs) {
                            this._lastProgressTime = now;
                            const elapsed = this._totalRecordedSamples / this.sampleRate;
                            this._onProgress({ elapsed, samples: this._totalRecordedSamples });
                        }
                    }
                }
            };

            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(recCtx.destination);
            this.processorNode.port.postMessage({ type: 'start' });
        } else {
            // ScriptProcessorNode fallback — runs on main thread (deprecated but broadly compatible)
            const bufferSize = 4096;
            this.processorNode = recCtx.createScriptProcessor(bufferSize, 1, 1);

            this.processorNode.onaudioprocess = (e) => {
                if (!this.recording) return;
                const inputData = e.inputBuffer.getChannelData(0);
                this._appendToMergedBuffer(new Float32Array(inputData));

                // Write silence to output — prevents mic audio from leaking to speakers
                const outputData = e.outputBuffer.getChannelData(0);
                for (let i = 0; i < outputData.length; i++) outputData[i] = 0;

                this._totalRecordedSamples += inputData.length;
                // Throttle onProgress to ~30Hz to prevent excessive React re-renders
                if (this._onProgress) {
                    const now = performance.now();
                    if (now - this._lastProgressTime >= this._progressIntervalMs) {
                        this._lastProgressTime = now;
                        const elapsed = this._totalRecordedSamples / this.sampleRate;
                        this._onProgress({ elapsed, samples: this._totalRecordedSamples });
                    }
                }
            };

            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(recCtx.destination);
        }

        if (onRecordingStart) onRecordingStart();
    }

    /**
     * Stop recording and return the recorded audio as an AudioBuffer.
     *
     * @returns {{ audioBuffer: AudioBuffer, duration: number, sampleRate: number }}
     */
    async stopRecording() {
        if (!this.recording && !this.countingIn) return null;

        // If still counting in, cancel it
        if (this.countingIn) {
            this.countingIn = false;
            if (this._countInTimer) {
                clearTimeout(this._countInTimer);
                this._countInTimer = null;
            }
        }

        this.recording = false;

        // Disconnect processor
        if (this.processorNode) {
            if (this._useWorklet) {
                // Drain ALL pending sample messages from the worklet before creating buffer.
                // The worklet sends samples via postMessage which is FIFO — the 'stopped'
                // confirmation arrives AFTER all pending 'samples' messages, guaranteeing
                // we capture every sample recorded by the audio thread.
                // The main thread may have fallen behind during recording (due to rAF tick
                // loop, React renders, generators, etc.), so there can be many queued messages.
                // We use a generous 10-second timeout as safety fallback.
                const drainStart = performance.now();
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.warn(`[AudioRecorder] Drain timeout after ${((performance.now() - drainStart) / 1000).toFixed(1)}s — ${this._mergedLength} samples captured`);
                        resolve();
                    }, 10000); // 10 second safety fallback
                    this.processorNode.port.onmessage = (e) => {
                        if (e.data.type === 'samples') {
                            this._appendToMergedBuffer(e.data.samples);
                            this._totalRecordedSamples = e.data.totalSamples;
                        } else if (e.data.type === 'stopped') {
                            clearTimeout(timeout);
                            const drainMs = performance.now() - drainStart;
                            const gapSamples = e.data.gapSamples || 0;
                            const gapCount = e.data.gapCount || 0;
                            const gapMs = (gapSamples / this.sampleRate * 1000).toFixed(0);
                            this._diagGaps = gapSamples;
                            console.log(
                                `[AudioRecorder] Drain complete in ${drainMs.toFixed(0)}ms — ` +
                                `${this._mergedLength} samples captured (worklet reported ${e.data.totalSamples}) | ` +
                                `gaps: ${gapCount} (${gapSamples} silence samples = ${gapMs}ms inserted)`
                            );
                            resolve();
                        }
                    };
                    this.processorNode.port.postMessage({ type: 'stop' });
                });
                this.processorNode.port.onmessage = null;
            } else {
                this.processorNode.onaudioprocess = null;
            }
            try { this.processorNode.disconnect(); } catch (e) {}
            try { this.sourceNode.disconnect(this.processorNode); } catch (e) {}
            this.processorNode = null;
        }

        // Suspend the recording context to free its audio thread during playback.
        // It will be resumed automatically on the next startRecording() call.
        if (this._recordingContext && this._recordingContext.state === 'running') {
            this._recordingContext.suspend().catch(() => {});
        }

        if (this._mergedLength === 0) {
            console.warn('[AudioRecorder] stopRecording: no samples recorded');
            return null;
        }

        // Use the pre-allocated merged buffer directly
        const totalLength = this._mergedLength;
        const merged = this._mergedBuffer.subarray(0, this._mergedLength);
        this.recordedChunks = [];

        // Create an AudioBuffer from the merged data (on recording context at its sample rate)
        // AudioBuffer is just a data container — plays fine on the main context regardless of
        // sample rate mismatch (Web Audio resamples automatically via AudioBufferSourceNode)
        const liveCtx = this._audioCtxGetter ? this._audioCtxGetter() : this.audioContext;
        const bufCtx = this._recordingContext || liveCtx;
        const audioBuffer = bufCtx.createBuffer(1, totalLength, this.sampleRate);
        audioBuffer.getChannelData(0).set(merged);

        // Reset merged buffer for next recording
        this._mergedLength = 0;

        const duration = totalLength / this.sampleRate;

        // Diagnostic: final recording summary
        const diagTotal = performance.now() - this._diagStartTime;
        const expectedSamples = (diagTotal / 1000) * this.sampleRate;
        const ratio = totalLength / Math.max(1, expectedSamples);
        // Check for silence gaps in the buffer
        let silentChunks = 0;
        const checkWindow = 4096;
        for (let i = 0; i < totalLength; i += checkWindow) {
            let maxAbs = 0;
            const end = Math.min(i + checkWindow, totalLength);
            for (let j = i; j < end; j++) {
                const a = Math.abs(audioBuffer.getChannelData(0)[j]);
                if (a > maxAbs) maxAbs = a;
            }
            if (maxAbs < 0.0001) silentChunks++;
        }
        console.log(
            `[AudioRecorder] FINAL | wallTime: ${(diagTotal / 1000).toFixed(2)}s | ` +
            `bufferDur: ${duration.toFixed(2)}s | ` +
            `samples: ${totalLength} (expected ~${Math.round(expectedSamples)}, ${(ratio * 100).toFixed(1)}%) | ` +
            `msgs: ${this._diagMsgCount} | ` +
            `sampleRate: ${this.sampleRate} | ` +
            `silentChunks: ${silentChunks}/${Math.ceil(totalLength / checkWindow)} | ` +
            `peaks: ${this._peaks.length} | ` +
            `gapFilled: ${this._diagGaps} samples`
        );

        return { audioBuffer, duration, sampleRate: this.sampleRate };
    }

    /**
     * Get the currently recorded data as a Float32Array (for live waveform preview).
     * Returns the last N samples for efficiency.
     */
    getRecentSamples(maxSamples = 8192) {
        if (this._mergedLength === 0) return new Float32Array(0);
        const start = Math.max(0, this._mergedLength - maxSamples);
        return this._mergedBuffer.subarray(start, this._mergedLength);
    }

    /**
     * Get ALL recorded samples as a Float32Array view (O(1), zero allocation).
     * Returns a subarray view into the pre-allocated buffer.
     */
    getAllRecordedSamples() {
        if (this._mergedLength === 0) return new Float32Array(0);
        return this._mergedBuffer.subarray(0, this._mergedLength);
    }

    /**
     * Get total recorded duration so far in seconds.
     */
    getRecordedDuration() {
        return this._mergedLength / this.sampleRate;
    }

    /**
     * Check if currently recording.
     */
    isRecording() {
        return this.recording;
    }

    /**
     * Check if in count-in phase.
     */
    isCountingIn() {
        return this.countingIn;
    }

    /**
     * Release the microphone stream and clean up.
     */
    dispose() {
        this.recording = false;
        this.countingIn = false;
        if (this._countInTimer) {
            clearTimeout(this._countInTimer);
            this._countInTimer = null;
        }
        if (this.processorNode) {
            try { this.processorNode.disconnect(); } catch (e) {}
            this.processorNode = null;
        }
        if (this.sourceNode) {
            try { this.sourceNode.disconnect(); } catch (e) {}
            this.sourceNode = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        // Close the dedicated recording context (frees its audio thread)
        if (this._recordingContext && this._recordingContext.state !== 'closed') {
            try { this._recordingContext.close(); } catch (e) {}
        }
        this._recordingContext = null;
        this._workletReady = false; // Worklet module was on the now-closed context
        this.analyserNode = null;
        this._analyserData = null;
        this.recordedChunks = [];
        this._mergedBuffer = new Float32Array(60 * 48000);
        this._mergedLength = 0;
        this._peaks = [];
        this._peakAccMax = 0;
        this._peakAccCount = 0;
    }
}

/**
 * Split an AudioBuffer into section-sized chunks based on tempo and bars per section.
 *
 * @param {AudioBuffer} audioBuffer — the full recording
 * @param {number} tempo — BPM
 * @param {number} barsPerSection — bars per arrangement section (default 8)
 * @param {AudioContext} audioContext — for creating new AudioBuffers
 * @returns {AudioBuffer[]} — array of AudioBuffers, one per section
 */
export function splitAudioIntoSections(audioBuffer, tempo, barsPerSection, audioContext) {
    const beatsPerBar = 4;
    const sampleRate = audioBuffer.sampleRate;
    const secondsPerBar = (beatsPerBar * 60) / tempo;
    const samplesPerSection = Math.round(secondsPerBar * barsPerSection * sampleRate);
    const totalSamples = audioBuffer.length;

    const sections = [];
    let offset = 0;
    while (offset < totalSamples) {
        const length = Math.min(samplesPerSection, totalSamples - offset);
        const sectionBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            length,
            sampleRate
        );
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const src = audioBuffer.getChannelData(ch);
            const dst = sectionBuffer.getChannelData(ch);
            dst.set(src.subarray(offset, offset + length));
        }
        sections.push(sectionBuffer);
        offset += samplesPerSection;
    }

    return sections;
}
