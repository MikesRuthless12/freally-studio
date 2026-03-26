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
        // Input monitoring — routes mic to speakers so user can hear themselves
        this._monitorSource = null;
        this._monitorGain = null;
        this._monitorTrackBus = null; // Track bus for effected monitoring
        // Native WASAPI capture (Electron only) — bypasses getUserMedia entirely,
        // capturing raw float32 via WASAPI exclusive mode through a SharedArrayBuffer
        // ring buffer. No AGC, no resampling, no Chromium audio processing.
        this._useNativeCapture = false;
        this._nativeRingState = null;  // SharedArrayBuffer for ring buffer state
        this._nativeRingData = null;   // SharedArrayBuffer for ring buffer data
        this._nativeRingCapacity = 0;
        this._nativeWorkletReady = false; // true after capture-ring-reader module is loaded
        this._nativeDeviceId = '';
        this._nativeLevelCache = 0;    // Cached RMS level from native addon (async poll)
        this._armMonitorNodes = null;  // Monitoring nodes adopted from SamplerEngine arm
    }

    /**
     * Set the track bus for input monitoring through effects.
     * Call before startRecording() to route mic through the track's effects chain.
     * @param {{ gainNode: GainNode }} trackBus — from SamplerEngine.trackBuses[trackId]
     */
    setMonitorTrackBus(trackBus) {
        this._monitorTrackBus = trackBus;
    }

    /**
     * DIAGNOSTIC: Send a constant oscillator through the full recording pipeline
     * for 30 seconds and log RMS levels every second. Isolates whether the fade
     * is in our code (oscillator will fade) or the mic hardware (oscillator stays flat).
     *
     * Call from console: window.__diagRecording()
     */
    static async runDiagnostic() {
        console.log('%c[DIAG] Starting 30s oscillator recording diagnostic...', 'color: #0f0; font-weight: bold');
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        await ctx.resume();
        console.log(`[DIAG] AudioContext: state=${ctx.state}, sampleRate=${ctx.sampleRate}`);

        // Create constant oscillator at 440Hz, gain=0.5
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 440;
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.5;
        osc.connect(oscGain);

        // Route through MediaStreamDestination → MediaStreamSource (same path as mic)
        const streamDest = ctx.createMediaStreamDestination();
        oscGain.connect(streamDest);
        const streamSource = ctx.createMediaStreamSource(streamDest.stream);

        // Analyser to measure level
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        streamSource.connect(analyser);
        const data = new Float32Array(analyser.fftSize);

        // Also test: direct oscillator through analyser (no stream round-trip)
        const directAnalyser = ctx.createAnalyser();
        directAnalyser.fftSize = 2048;
        oscGain.connect(directAnalyser);
        const directData = new Float32Array(directAnalyser.fftSize);

        osc.start();

        const results = [];
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed++;
            // Stream path RMS
            analyser.getFloatTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
            const streamRms = Math.sqrt(sum / data.length);

            // Direct path RMS
            directAnalyser.getFloatTimeDomainData(directData);
            let dSum = 0;
            for (let i = 0; i < directData.length; i++) dSum += directData[i] * directData[i];
            const directRms = Math.sqrt(dSum / directData.length);

            const entry = { sec: elapsed, streamRms: streamRms.toFixed(4), directRms: directRms.toFixed(4), ctxState: ctx.state };
            results.push(entry);
            const streamBar = '█'.repeat(Math.round(streamRms * 100));
            const directBar = '█'.repeat(Math.round(directRms * 100));
            console.log(`[DIAG ${elapsed}s] stream=${streamRms.toFixed(4)} ${streamBar} | direct=${directRms.toFixed(4)} ${directBar} | ctx=${ctx.state}`);

            if (elapsed >= 30) {
                clearInterval(interval);
                osc.stop();
                osc.disconnect();
                oscGain.disconnect();
                streamSource.disconnect();
                ctx.close().catch(() => {});
                console.log('%c[DIAG] Complete! Results:', 'color: #0f0; font-weight: bold');
                console.table(results);
                const firstRms = parseFloat(results[0].streamRms);
                const lastRms = parseFloat(results[results.length - 1].streamRms);
                const decay = ((1 - lastRms / firstRms) * 100).toFixed(1);
                console.log(`%c[DIAG] Stream decay: ${decay}% (${firstRms.toFixed(4)} → ${lastRms.toFixed(4)})`,
                    `color: ${Math.abs(parseFloat(decay)) < 5 ? '#0f0' : '#f00'}; font-weight: bold`);
                const dFirstRms = parseFloat(results[0].directRms);
                const dLastRms = parseFloat(results[results.length - 1].directRms);
                const dDecay = ((1 - dLastRms / dFirstRms) * 100).toFixed(1);
                console.log(`%c[DIAG] Direct decay: ${dDecay}% (${dFirstRms.toFixed(4)} → ${dLastRms.toFixed(4)})`,
                    `color: ${Math.abs(parseFloat(dDecay)) < 5 ? '#0f0' : '#f00'}; font-weight: bold`);
            }
        }, 1000);

        return 'Diagnostic running for 30s — watch console output';
    }

    /**
     * DIAGNOSTIC 2: Test actual microphone input for 30 seconds.
     * Measures RMS from getUserMedia to see if the mic signal fades.
     * Call from console: window.__diagMic()
     */
    static async runMicDiagnostic() {
        console.log('%c[MIC DIAG] Starting 30s mic input diagnostic...', 'color: #ff0; font-weight: bold');
        console.log('[MIC DIAG] Make a constant sound into your mic for 30 seconds');

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                googAutoGainControl: false,
                googAutoGainControl2: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
            }
        });

        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        await ctx.resume();
        console.log(`[MIC DIAG] AudioContext: sampleRate=${ctx.sampleRate}, state=${ctx.state}`);

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const data = new Float32Array(analyser.fftSize);

        const results = [];
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed++;
            analyser.getFloatTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
            const rms = Math.sqrt(sum / data.length);
            const peak = Math.max(...data.map(Math.abs));

            results.push({ sec: elapsed, rms: rms.toFixed(4), peak: peak.toFixed(4), ctxState: ctx.state });
            const bar = '█'.repeat(Math.round(rms * 200));
            console.log(`[MIC DIAG ${elapsed}s] rms=${rms.toFixed(4)} peak=${peak.toFixed(4)} ${bar}`);

            if (elapsed >= 30) {
                clearInterval(interval);
                stream.getTracks().forEach(t => t.stop());
                source.disconnect();
                ctx.close().catch(() => {});
                console.log('%c[MIC DIAG] Complete! Results:', 'color: #ff0; font-weight: bold');
                console.table(results);
                const firstRms = parseFloat(results[0].rms);
                const lastRms = parseFloat(results[results.length - 1].rms);
                const decay = firstRms > 0 ? ((1 - lastRms / firstRms) * 100).toFixed(1) : 'N/A';
                console.log(`%c[MIC DIAG] Mic decay: ${decay}% (${firstRms.toFixed(4)} → ${lastRms.toFixed(4)})`,
                    `color: ${Math.abs(parseFloat(decay)) < 10 ? '#0f0' : '#f00'}; font-weight: bold`);
            }
        }, 1000);

        return 'Mic diagnostic running for 30s — make constant sound into mic and watch console';
    }

    /**
     * DIAGNOSTIC 3: Feed a constant oscillator through the FULL AudioRecorder
     * pipeline (worklet + post-processing) for 20 seconds, then analyze the
     * output buffer segment by segment.
     *
     * Call from console: window.__diagPipeline()
     */
    static async runPipelineDiagnostic() {
        console.log('%c[PIPELINE DIAG] Starting 20s oscillator-through-recorder test...', 'color: #0ff; font-weight: bold');

        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        await ctx.resume();

        // Create oscillator → MediaStreamDestination (fake mic)
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 440;
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.4; // ~-8 dB, typical vocal level
        osc.connect(oscGain);
        const streamDest = ctx.createMediaStreamDestination();
        oscGain.connect(streamDest);
        osc.start();

        // Create AudioRecorder with a real AudioContext getter
        const recorder = new AudioRecorder(() => ctx);

        // Override the getUserMedia to use our fake stream
        recorder.stream = streamDest.stream;

        // Manually set up the recording context and nodes (same as init() but skip getUserMedia)
        const recCtx = new Ctx();
        await recCtx.resume();
        recorder._recordingContext = recCtx;
        recorder.sampleRate = recCtx.sampleRate;
        recorder.sourceNode = recCtx.createMediaStreamSource(streamDest.stream);
        recorder.analyserNode = recCtx.createAnalyser();
        recorder.analyserNode.fftSize = 2048;
        recorder.analyserNode.smoothingTimeConstant = 0.8;
        recorder._analyserData = new Float32Array(recorder.analyserNode.fftSize);
        recorder.sourceNode.connect(recorder.analyserNode);

        // Load worklet
        try {
            await recCtx.audioWorklet.addModule('recording-processor.js');
            recorder._useWorklet = true;
            recorder._workletReady = true;
        } catch (e) {
            recorder._useWorklet = false;
            console.warn('[PIPELINE DIAG] Worklet not available, using ScriptProcessor');
        }

        console.log(`[PIPELINE DIAG] Recording context: sampleRate=${recCtx.sampleRate}, state=${recCtx.state}`);
        console.log('[PIPELINE DIAG] Recording for 20 seconds...');

        // Start recording (no count-in)
        await recorder.startRecording({ tempo: 120, countInBars: 0 });

        // Log RMS every second during recording
        let elapsed = 0;
        const logInterval = setInterval(() => {
            elapsed++;
            const level = recorder.getInputLevel();
            const bar = '█'.repeat(Math.round(level * 200));
            console.log(`[PIPELINE DIAG ${elapsed}s] inputRMS=${level.toFixed(4)} ${bar}`);
        }, 1000);

        // Stop after 20 seconds
        setTimeout(async () => {
            clearInterval(logInterval);
            const result = await recorder.stopRecording();
            osc.stop();
            osc.disconnect();
            ctx.close().catch(() => {});
            recCtx.close().catch(() => {});

            if (!result || !result.audioBuffer) {
                console.log('%c[PIPELINE DIAG] FAILED — no audio buffer returned', 'color: #f00; font-weight: bold');
                return;
            }

            const buffer = result.audioBuffer;
            const data = buffer.getChannelData(0);
            const totalSamples = data.length;
            const sr = buffer.sampleRate;
            console.log(`[PIPELINE DIAG] Buffer: ${totalSamples} samples, ${(totalSamples/sr).toFixed(2)}s, ${sr}Hz`);

            // Analyze in 1-second segments
            const segSize = sr; // 1 second
            const numSegs = Math.floor(totalSamples / segSize);
            const results = [];

            for (let s = 0; s < numSegs; s++) {
                const start = s * segSize;
                const end = start + segSize;
                let sum = 0, peak = 0;
                for (let i = start; i < end; i++) {
                    sum += data[i] * data[i];
                    const abs = Math.abs(data[i]);
                    if (abs > peak) peak = abs;
                }
                const rms = Math.sqrt(sum / segSize);
                results.push({ sec: s + 1, rms: rms.toFixed(4), peak: peak.toFixed(4) });
            }

            console.log('%c[PIPELINE DIAG] Output buffer analysis (per-second segments):', 'color: #0ff; font-weight: bold');
            console.table(results);

            const firstRms = parseFloat(results[0].rms);
            const lastRms = parseFloat(results[results.length - 1].rms);
            const decay = firstRms > 0 ? ((1 - lastRms / firstRms) * 100).toFixed(1) : 'N/A';
            console.log(`%c[PIPELINE DIAG] Pipeline decay: ${decay}% (${firstRms.toFixed(4)} → ${lastRms.toFixed(4)})`,
                `color: ${Math.abs(parseFloat(decay)) < 5 ? '#0f0' : '#f00'}; font-weight: bold`);

            if (Math.abs(parseFloat(decay)) < 5) {
                console.log('%c[PIPELINE DIAG] PASS — recording pipeline is clean. Issue is mic hardware.', 'color: #0f0; font-weight: bold');
            } else {
                console.log('%c[PIPELINE DIAG] FAIL — recording pipeline is modifying levels!', 'color: #f00; font-weight: bold');
            }
        }, 20000);

        return 'Pipeline diagnostic running for 20s — watch console...';
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
     *
     * @param {object} [sampler] — SamplerEngine instance. If it has a running
     *   native arm capture, the recorder takes ownership of it (zero-latency
     *   arm-to-record transition) instead of starting a new capture.
     *
     * In Electron: uses native WASAPI capture via SharedArrayBuffer ring buffer.
     * In browser: falls back to getUserMedia + AudioWorklet / ScriptProcessorNode.
     */
    async init(sampler) {
        if (this.stream || this._useNativeCapture) return; // Already initialized

        // Read recording audio processing settings from localStorage
        let deviceId = undefined;
        let echoCancellation = false;
        let noiseSuppression = false;
        try {
            const raw = localStorage.getItem('wavloom_settings');
            if (raw) {
                const s = JSON.parse(raw);
                if (s.recordingEchoCancellation !== undefined) echoCancellation = s.recordingEchoCancellation;
                if (s.recordingNoiseSuppression !== undefined) noiseSuppression = s.recordingNoiseSuppression;
                if (s.audioInputDeviceId) deviceId = s.audioInputDeviceId;
            }
        } catch (_) {}

        // Ensure main context (for count-in clicks) is running
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();

        // ---- Try to take ownership of a running native arm capture ----
        if (sampler) {
            const armState = sampler.takeNativeArmState();
            if (armState) {
                this._adoptNativeArmState(armState);
                console.log('[AudioRecorder] Adopted running native arm capture — zero-latency transition');
                return;
            }
        }

        // ---- Try native WASAPI capture (Electron only) ----
        const api = window.electronAPI?.audioCapture;
        if (api) {
            let available = false;
            try { available = await api.isAvailable(); } catch (_) {}

            if (available) {
                try {
                    await this._initNativeCapture(api, deviceId);
                    return;
                } catch (err) {
                    console.warn('[AudioRecorder] Native capture init failed, falling back to getUserMedia:', err);
                    this._useNativeCapture = false;
                }
            }
        }

        // ---- Fallback: getUserMedia (browser / non-Electron) ----
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation,
                noiseSuppression,
                autoGainControl: false,
                googAutoGainControl: false,
                googAutoGainControl2: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
                googTypingNoiseDetection: false,
                ...(deviceId && { deviceId: { exact: deviceId } })
            }
        });

        if (!this._recordingContext || this._recordingContext.state === 'closed') {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this._recordingContext = new Ctx();
            this._workletReady = false;
        }

        const recCtx = this._recordingContext;
        if (recCtx.state === 'suspended') await recCtx.resume();

        this.sourceNode = recCtx.createMediaStreamSource(this.stream);

        this.analyserNode = recCtx.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = 0.8;
        this._analyserData = new Float32Array(this.analyserNode.fftSize);
        this.sourceNode.connect(this.analyserNode);

        this.sampleRate = recCtx.sampleRate;

        if (recCtx.audioWorklet && !this._workletReady) {
            try {
                await recCtx.audioWorklet.addModule('recording-processor.js');
                this._useWorklet = true;
                this._workletReady = true;
            } catch (e) {
                this._useWorklet = false;
            }
        }
    }

    /**
     * Adopt a running native arm state from SamplerEngine.
     * The WASAPI capture and ring buffer are already active — we just take
     * ownership of the SharedArrayBuffers and AudioContext so that
     * _startNativeRecording() can reuse the same worklet.
     *
     * @param {object} armState — from SamplerEngine.takeNativeArmState()
     */
    _adoptNativeArmState(armState) {
        this._nativeRingState = armState.stateBuffer;
        this._nativeRingData = armState.dataBuffer;
        this._nativeRingCapacity = armState.capacity;
        this._useNativeCapture = true;
        this._nativeDeviceId = '';
        this.sampleRate = armState.armCtx.sampleRate;

        // Take ownership of the arm's AudioContext and worklet.
        // The worklet is already reading from the ring buffer and outputting
        // audio for monitoring. We'll reuse it for recording.
        this._recordingContext = armState.armCtx;
        this._nativeWorkletReady = true;

        // Store the arm monitoring nodes so we can keep them alive during
        // recording and clean them up on stop.
        this._armMonitorNodes = {
            workletNode: armState.workletNode,
            streamDest: armState.streamDest,
            bridgeSource: armState.bridgeSource,
            monitorGain: armState.monitorGain
        };
    }

    /**
     * Initialize native WASAPI capture path (Electron only).
     *
     * Sets up the SharedArrayBuffer ring buffer, attaches it to the native
     * addon via IPC, and loads the capture-ring-reader AudioWorklet.
     * The native capture is NOT started here — only in startRecording().
     *
     * @param {object} api — window.electronAPI.audioCapture
     * @param {string|undefined} deviceId — selected device ID from settings
     */
    async _initNativeCapture(api, deviceId) {
        const mainCtx = this._audioCtxGetter ? this._audioCtxGetter() : this.audioContext;
        const sr = mainCtx.sampleRate;

        // Simple init — no SharedArrayBuffer ring buffer needed.
        // The native addon accumulates captured samples internally;
        // on stop it returns them as base64-encoded Float32Array.
        // This avoids the contextBridge clone limitation for SABs.
        this._useNativeCapture = true;
        this._nativeDeviceId = deviceId || '';
        this.sampleRate = sr;
        this._armMonitorNodes = null;

        console.log(`[AudioRecorder] Native WASAPI capture initialized (simple mode): sr=${sr}`);
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
     *
     * Native capture: reads the atomic RMS level computed by the C++ capture
     * thread (updated every WASAPI packet, ~5-10ms). This is synchronous in
     * the sense that the IPC call is fast, but callers should be aware it
     * returns a Promise in native mode. For compatibility, we cache the last
     * native level and return it synchronously — the async poll is kicked off
     * as a side-effect.
     */
    getInputLevel() {
        if (this._useNativeCapture) {
            // Return cached level synchronously; kick off async update
            const api = window.electronAPI?.audioCapture;
            if (api) {
                api.getLevel().then(level => { this._nativeLevelCache = level; }).catch(() => {});
            }
            return this._nativeLevelCache || 0;
        }
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
        if (!this.stream && !this._useNativeCapture) throw new Error('AudioRecorder not initialized. Call init() first.');
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
        this._totalRecordedSamples = 0;
        // Reset diagnostic timing to exclude count-in period
        this._diagStartTime = performance.now();
        this._diagLastLogTime = performance.now();
        this._diagLastSampleCount = 0;
        this._diagMsgCount = 0;

        // Ensure recording context is running (may have been suspended by browser)
        if (this._recordingContext && this._recordingContext.state === 'suspended') {
            await this._recordingContext.resume();
        }

        if (this._useNativeCapture) {
            // ---- Native WASAPI capture path ----
            await this._startNativeRecording(onRecordingStart);
        } else {
            // ---- getUserMedia path (browser fallback) ----
            this._startTime = this._recordingContext.currentTime;

            const recCtx = this._recordingContext;

            if (this._useWorklet) {
                // AudioWorklet path — runs on dedicated recording context's audio thread
                this.processorNode = new AudioWorkletNode(recCtx, 'recording-processor', {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    channelCount: 1
                });

                this.processorNode.port.onmessage = (e) => {
                    if (e.data.type === 'samples') {
                        this._handleWorkletSamples(e.data);
                    }
                };

                this.sourceNode.connect(this.processorNode);
                this.processorNode.connect(recCtx.destination);
                this.processorNode.port.postMessage({ type: 'start' });
            } else {
                // ScriptProcessorNode fallback
                const bufferSize = 4096;
                this.processorNode = recCtx.createScriptProcessor(bufferSize, 1, 1);

                this.processorNode.onaudioprocess = (e) => {
                    if (!this.recording) return;
                    const inputData = e.inputBuffer.getChannelData(0);
                    this._appendToMergedBuffer(new Float32Array(inputData));

                    const outputData = e.outputBuffer.getChannelData(0);
                    for (let i = 0; i < outputData.length; i++) outputData[i] = 0;

                    this._totalRecordedSamples += inputData.length;
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

            // Input monitoring — route mic through track effects chain (getUserMedia path)
            try {
                const raw = localStorage.getItem('wavloom_settings');
                const settings = raw ? JSON.parse(raw) : {};
                if (settings.recordingInputMonitor) {
                    const mainCtx = this._audioCtxGetter ? this._audioCtxGetter() : this.audioContext;
                    if (mainCtx && mainCtx.state !== 'closed') {
                        this._monitorSource = mainCtx.createMediaStreamSource(this.stream);
                        this._monitorGain = mainCtx.createGain();
                        this._monitorGain.gain.value = 0.8;
                        this._monitorSource.connect(this._monitorGain);
                        if (this._monitorTrackBus && this._monitorTrackBus.gainNode) {
                            this._monitorGain.connect(this._monitorTrackBus.gainNode);
                        } else {
                            this._monitorGain.connect(mainCtx.destination);
                        }
                    }
                }
            } catch (_) {}

            if (onRecordingStart) onRecordingStart();
        }
    }

    /**
     * Common handler for worklet 'samples' messages (both native and getUserMedia paths).
     */
    _handleWorkletSamples(data) {
        const chunkLen = data.samples.length;
        this._appendToMergedBuffer(data.samples);
        this._totalRecordedSamples = data.totalSamples;
        this._diagMsgCount++;

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

        if (this._onProgress) {
            if (now - this._lastProgressTime >= this._progressIntervalMs) {
                this._lastProgressTime = now;
                const elapsed = this._totalRecordedSamples / this.sampleRate;
                this._onProgress({ elapsed, samples: this._totalRecordedSamples });
            }
        }
    }

    /**
     * Start recording via native WASAPI capture.
     *
     * Two modes:
     *   1. Adopted from arm: capture is already running, worklet is already
     *      reading from the ring buffer. We just tell it to start accumulating
     *      samples for recording. Zero-latency transition.
     *   2. Fresh start: starts native capture, creates worklet, wires monitoring.
     */
    async _startNativeRecording(onRecordingStart) {
        const api = window.electronAPI.audioCapture;

        // Simple native capture: the addon accumulates samples internally.
        // No SharedArrayBuffer, no AudioWorklet ring reader needed.
        // On stop, the addon returns all captured audio as base64 Float32Array.

        const startResult = await api.start(
            this._nativeDeviceId, this.sampleRate, 1 /* mono */
        );
        if (startResult && startResult.error) {
            this.recording = false;
            throw new Error('Native capture start failed: ' + startResult.error);
        }

        // Poll getLevel() for VU meter + waveform + progress reporting.
        // Also acts as a watchdog: if the WASAPI capture thread crashes
        // (common with Realtek drivers), detect it and auto-restart.
        this._nativeRestartCount = 0;
        this._nativePollId = setInterval(async () => {
            if (!this.recording) return;
            try {
                // Watchdog: check if the capture thread is still alive
                const capturing = await api.isCapturing();
                if (!capturing && this._nativeRestartCount < 3) {
                    this._nativeRestartCount++;
                    console.warn(`[AudioRecorder] Native capture thread died — restarting (attempt ${this._nativeRestartCount}/3)`);
                    try {
                        // Drain whatever was captured so far
                        const partial = await api.stop().catch(() => ({ buffer: null, samples: 0 }));
                        if (partial.buffer && partial.samples > 0) {
                            const bytes = Uint8Array.from(atob(partial.buffer), c => c.charCodeAt(0));
                            let chunk = new Float32Array(bytes.buffer);
                            // Stereo→mono if needed
                            const chunkRatio = chunk.length / Math.max(1, this._mergedLength || 1);
                            if (chunk.length > 0 && chunkRatio > 1.5) {
                                const frameCount = Math.floor(chunk.length / 2);
                                const mono = new Float32Array(frameCount);
                                for (let i = 0; i < frameCount; i++) mono[i] = (chunk[i * 2] + chunk[i * 2 + 1]) * 0.5;
                                chunk = mono;
                            }
                            this._appendToMergedBuffer(chunk);
                            console.log(`[AudioRecorder] Salvaged ${chunk.length} samples before restart`);
                        }
                    } catch (_) {}
                    // Restart capture
                    try {
                        await api.start(this._nativeDeviceId, this.sampleRate, 1);
                        console.log('[AudioRecorder] Native capture restarted successfully');
                    } catch (err) {
                        console.error('[AudioRecorder] Native capture restart failed:', err);
                    }
                    return;
                }

                const level = await api.getLevel();
                // Synthesize peaks from the RMS level for waveform display.
                // The renderer expects 1 peak per _peakWindow (256) samples.
                // At 48kHz with 50ms poll interval: 48000*0.05/256 ≈ 9 peaks per poll.
                const peakVal = Math.min(1.0, (level || 0) * 3);
                const samplesPerPoll = this.sampleRate * 0.05;
                const peaksNeeded = Math.max(1, Math.round(samplesPerPoll / this._peakWindow));
                for (let p = 0; p < peaksNeeded; p++) this._peaks.push(peakVal);

                // Update estimated sample count so the waveform renderer
                // knows how wide to draw (it reads _totalRecordedSamples)
                const elapsed = (performance.now() - this._diagStartTime) / 1000;
                const estimatedSamples = Math.round(elapsed * this.sampleRate);
                this._totalRecordedSamples = estimatedSamples;

                if (this._onProgress) {
                    this._onProgress({ elapsed, samples: estimatedSamples });
                }

                // Diagnostic logging every 2 seconds
                const now = performance.now();
                if (now - this._diagLastLogTime >= 2000) {
                    console.log(
                        `[AudioRecorder] ${elapsed.toFixed(1)}s | ` +
                        `native capture | level: ${(level || 0).toFixed(4)} | ` +
                        `peaks: ${this._peaks.length} | capturing: ${capturing} | ` +
                        `restarts: ${this._nativeRestartCount}`
                    );
                    this._diagLastLogTime = now;
                }
            } catch (_) {}
        }, 50);

        console.log('[AudioRecorder] Native WASAPI recording started (simple capture)');
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

        // Disconnect input monitor
        if (this._monitorSource) {
            try { this._monitorSource.disconnect(); } catch (_) {}
            this._monitorSource = null;
        }
        if (this._monitorGain) {
            try { this._monitorGain.disconnect(); } catch (_) {}
            this._monitorGain = null;
        }

        // Disconnect processor — drain worklet messages before teardown
        if (this.processorNode) {
            if (this._useNativeCapture || this._useWorklet) {
                // Drain ALL pending sample messages from the worklet before creating buffer.
                // Both capture-ring-reader and recording-processor use the same FIFO message
                // protocol: 'stop'/'stop-recording' → flush → 'stopped' confirmation.
                const stopMsg = this._useNativeCapture ? 'stop-recording' : 'stop';
                const drainStart = performance.now();
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.warn(`[AudioRecorder] Drain timeout after ${((performance.now() - drainStart) / 1000).toFixed(1)}s — ${this._mergedLength} samples captured`);
                        resolve();
                    }, 10000);
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
                    this.processorNode.port.postMessage({ type: stopMsg });
                });
                this.processorNode.port.onmessage = null;
            } else {
                this.processorNode.onaudioprocess = null;
            }
            try { this.processorNode.disconnect(); } catch (e) {}
            if (this.sourceNode) {
                try { this.sourceNode.disconnect(this.processorNode); } catch (e) {}
            }
            this.processorNode = null;
        }

        // Stop native capture thread (if native path)
        if (this._useNativeCapture) {
            // Clear the polling interval
            if (this._nativePollId) {
                clearInterval(this._nativePollId);
                this._nativePollId = null;
            }

            try {
                const result = await window.electronAPI.audioCapture.stop();
                if (result.buffer && result.samples > 0) {
                    // Decode base64 → Float32Array
                    const bytes = Uint8Array.from(atob(result.buffer), c => c.charCodeAt(0));
                    let nativeSamples = new Float32Array(bytes.buffer);

                    // Detect stereo: WASAPI shared mode may capture stereo even
                    // when mono was requested. If the sample count is ~2x what
                    // wall-time suggests, downmix interleaved stereo to mono.
                    const wallTimeSec = (performance.now() - this._diagStartTime) / 1000;
                    const expectedMono = Math.round(wallTimeSec * this.sampleRate);
                    const ratio = nativeSamples.length / Math.max(1, expectedMono);

                    if (ratio > 1.7 && ratio < 2.3) {
                        // Stereo interleaved → mono downmix (average L+R)
                        const frameCount = Math.floor(nativeSamples.length / 2);
                        const mono = new Float32Array(frameCount);
                        for (let i = 0; i < frameCount; i++) {
                            mono[i] = (nativeSamples[i * 2] + nativeSamples[i * 2 + 1]) * 0.5;
                        }
                        console.log(`[AudioRecorder] Stereo→mono downmix: ${nativeSamples.length} → ${mono.length} samples (ratio was ${ratio.toFixed(2)})`);
                        nativeSamples = mono;
                    }

                    // Declick pass: smooth out single-sample spikes caused by
                    // Realtek driver micro-glitches in WASAPI shared mode.
                    let clicksFixed = 0;
                    for (let i = 1; i < nativeSamples.length - 1; i++) {
                        const prev = nativeSamples[i - 1];
                        const curr = nativeSamples[i];
                        const next = nativeSamples[i + 1];
                        const jumpIn = Math.abs(curr - prev);
                        const jumpOut = Math.abs(next - curr);
                        const neighborDelta = Math.abs(next - prev);
                        // Spike: large jump in AND out, but neighbors are close
                        if (jumpIn > 0.15 && jumpOut > 0.15 && neighborDelta < jumpIn * 0.5) {
                            nativeSamples[i] = (prev + next) * 0.5;
                            clicksFixed++;
                        }
                    }
                    if (clicksFixed > 0) {
                        console.log(`[AudioRecorder] Declick: fixed ${clicksFixed} sample spikes`);
                    }

                    this._appendToMergedBuffer(nativeSamples);
                    console.log(`[AudioRecorder] Native capture stopped: ${nativeSamples.length} samples received`);
                } else {
                    console.warn('[AudioRecorder] Native capture stopped but returned no samples');
                }
            } catch (err) {
                console.error('[AudioRecorder] Native capture stop error:', err);
            }
        }

        // Suspend the recording context to free its audio thread during playback.
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

        // Create an AudioBuffer from the merged data
        const liveCtx = this._audioCtxGetter ? this._audioCtxGetter() : this.audioContext;
        const bufCtx = this._recordingContext || liveCtx;
        const audioBuffer = bufCtx.createBuffer(1, totalLength, this.sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        channelData.set(merged);

        // Post-recording leveling: counteracts Chromium's mic AGC decay by
        // analyzing RMS in ~1s segments and applying per-segment gain to
        // maintain consistent volume.
        // SKIP for native WASAPI capture — there's no AGC to compensate for.
        // The native path delivers raw float32 PCM with no processing.
        if (!this._useNativeCapture) {
            const segmentSize = Math.floor(this.sampleRate * 1.0);
            const numSegments = Math.ceil(totalLength / segmentSize);
            if (numSegments >= 3) {
                const segRms = [];
                for (let s = 0; s < numSegments; s++) {
                    const start = s * segmentSize;
                    const end = Math.min(start + segmentSize, totalLength);
                    let sum = 0;
                    for (let i = start; i < end; i++) sum += channelData[i] * channelData[i];
                    segRms.push(Math.sqrt(sum / (end - start)));
                }

                const nonSilent = segRms.filter(r => r > 0.01).sort((a, b) => a - b);
                if (nonSilent.length >= 2) {
                    const medianIdx = Math.floor(nonSilent.length / 2);
                    const targetRms = nonSilent[medianIdx];

                    const segGains = segRms.map(rms => {
                        if (rms < 0.005) return 1.0;
                        const gain = targetRms / rms;
                        return Math.min(Math.max(gain, 0.25), 4.0);
                    });

                    const fadeLen = Math.min(4096, Math.floor(segmentSize * 0.15));
                    for (let s = 0; s < numSegments; s++) {
                        const start = s * segmentSize;
                        const end = Math.min(start + segmentSize, totalLength);
                        const gain = segGains[s];
                        const nextGain = s < numSegments - 1 ? segGains[s + 1] : gain;

                        for (let i = start; i < end; i++) {
                            let g = gain;
                            const distToEnd = end - i;
                            if (distToEnd < fadeLen && s < numSegments - 1) {
                                const t = distToEnd / fadeLen;
                                g = gain * t + nextGain * (1 - t);
                            }
                            channelData[i] *= g;
                            if (channelData[i] > 0.95) channelData[i] = 0.95;
                            else if (channelData[i] < -0.95) channelData[i] = -0.95;
                        }
                    }

                    const maxGain = Math.max(...segGains);
                    const minGain = Math.min(...segGains.filter(g => g !== 1.0));
                    console.log(`[AudioRecorder] Leveled: ${numSegments} segments, target RMS ${targetRms.toFixed(4)}, gain range ${minGain.toFixed(2)}x–${maxGain.toFixed(2)}x`);
                }
            }
        }

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
        // Stop native capture and detach ring buffer
        if (this._useNativeCapture) {
            const api = window.electronAPI?.audioCapture;
            if (api) {
                api.stop().catch(() => {});
                api.detachRingBuffer().catch(() => {});
            }
            this._nativeRingState = null;
            this._nativeRingData = null;
            this._nativeRingCapacity = 0;
            this._useNativeCapture = false;
            this._nativeWorkletReady = false;
            // Clean up arm monitoring nodes if we adopted them
            if (this._armMonitorNodes) {
                try { this._armMonitorNodes.workletNode.disconnect(); } catch (_) {}
                try { this._armMonitorNodes.bridgeSource.disconnect(); } catch (_) {}
                try { this._armMonitorNodes.monitorGain.disconnect(); } catch (_) {}
                this._armMonitorNodes = null;
            }
        }
        // Close the dedicated recording context (frees its audio thread)
        if (this._recordingContext && this._recordingContext.state !== 'closed') {
            try { this._recordingContext.close(); } catch (e) {}
        }
        this._recordingContext = null;
        this._workletReady = false;
        this._nativeWorkletReady = false;
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
