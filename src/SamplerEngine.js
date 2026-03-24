/**
 * Sampler Engine
 * Maps MIDI notes to audio samples for playback and rendering
 * Supports multi-sample instruments (one-shot libraries)
 */

import { applyAutoTune } from './core/music-intelligence/SampleMatchEngine.js';

export class SamplerEngine {
    constructor() {
        if (!window.sharedAnalysisCtx) {
            // 'playback' latencyHint tells the browser to use larger audio
            // buffers (~50 ms vs ~10 ms default).  This greatly reduces buffer
            // underrun risk on laptops / slower hardware at the cost of a tiny
            // increase in output latency — an acceptable trade-off for a DAW
            // that schedules notes ahead of time.
            const Ctx = window.AudioContext || window.webkitAudioContext;
            // Use explicit high latency (100ms) for maximum audio thread headroom.
            // Matches system sample rate to avoid resampling overhead.
            let ctxOptions = { latencyHint: 0.1, sampleRate: 48000 };
            try {
                const raw = localStorage.getItem('wavloom_settings');
                if (raw) {
                    const s = JSON.parse(raw);
                    if (s.latencyHint) ctxOptions.latencyHint = s.latencyHint;
                    if (s.sampleRate && typeof s.sampleRate === 'number') ctxOptions.sampleRate = s.sampleRate;
                }
            } catch (_) { /* use defaults */ }
            window.sharedAnalysisCtx = new Ctx(ctxOptions);
            // Suspend immediately — don't leave an idle context running on Realtek
            // drivers, which degrade into static after ~30-60 seconds of idle running.
            // The context will be resumed on first actual audio activity.
            window.sharedAnalysisCtx.suspend().catch(() => {});
        }
        this.audioContext = window.sharedAnalysisCtx;
        this.instruments = new Map(); // instrumentId -> sampleMap
        this.activeSources = new Map(); // noteKey -> { source, envelope, startedAt }
        this.drumChannels = new Map(); // drumId -> DrumChannel DSP Chain
        this.MAX_VOICES = 24; // Reduced to minimize audio graph load for Realtek driver compat
        this._reversedBufferCache = new Map(); // sample AudioBuffer → reversed AudioBuffer
        this._cleanupInterval = null;
        // Cleanup timer is started lazily on first audio play, not eagerly —
        // avoids a 2-second interval running when no audio is active.

        // Time-stretch state
        this.globalTempo = 120;      // Updated from app state
        this.preservePitch = false;  // Pitch-preserve mode via detune compensation

        // Auto-tune state (SampleMatchEngine integration)
        this.autoTuneEnabled = false;  // Toggle via setAutoTune()
        this.autoTuneKey = 'C';        // Updated from app when project key changes

        // Minimal master chain: masterGain → softLimiter → destination
        // Panner, compressor, and analyser are kept as lightweight stubs to avoid
        // breaking code that references them, but the actual audio path is minimal
        // to prevent Realtek audio driver errors on Windows.
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.3;

        // Soft limiter: WaveShaperNode with tanh curve prevents digital clipping
        // when multiple audio tracks (vocals, takes) sum together.
        // Zero-cost when signal is below threshold — no processing overhead.
        this._softLimiter = this._createSoftLimiter(this.audioContext);
        this.masterGain.connect(this._softLimiter);
        this._softLimiter.connect(this.audioContext.destination);

        // Stub nodes — referenced by other code but not in the hot audio path
        this.compressor = this.masterGain; // alias so .connect(this.compressor) works
        this.masterPanner = this.audioContext.createStereoPanner();
        this.masterPanner.pan.value = 0;
        // masterPanner is NOT connected to the chain — just exists for API compat

        // Analyser taps off masterGain for metering but doesn't sit in the main path
        this.masterAnalyser = this.audioContext.createAnalyser();
        this.masterAnalyser.fftSize = 256;
        this.masterAnalyser.smoothingTimeConstant = 0.3;
        this.masterGain.connect(this.masterAnalyser); // parallel tap, not serial

        /** @type {MediaStreamAudioDestinationNode|null} Mobile Link audio tap */
        this._mobileStreamDest = null;

        this._keepaliveStarted = false;

        // Proactive audio context reset: Realtek drivers on Windows silently kill
        // the audio output after ~15-20 seconds. We preemptively create a fresh
        // AudioContext before that happens. AudioBuffers are reusable across contexts.
        // Started lazily on first audio activity to avoid creating contexts when idle.
        this._resetInterval = null;
        this._resetEnabled = false;
        this._audioActive = false; // true when playback or recording is active
        this._idleSuspendTimer = null; // suspends context after one-off previews

        // VST3 instrument instances per track (trackId → VST3InstrumentNode)
        this.vst3Instruments = new Map();

        // Per-frame meter cache — avoids redundant getByteTimeDomainData() calls
        // when multiple rAF loops (ArrangementTimeline + MixerPanel) read the
        // same analyser in the same animation frame.
        this._meterCache = new Map();   // trackId → cached RMS value
        this._meterCacheTime = 0;       // timestamp of last cache fill

        // Per-track audio buses
        this.trackBuses = { drums: null, chords: null, melody: null, bass: null };
        this._initTrackBuses();
    }

    /**
     * Initialize per-track audio buses
     * Each bus: GainNode (volume) → StereoPannerNode (pan) → AnalyserNode (metering) → masterGain
     */
    _initTrackBuses() {
        const ctx = this.audioContext;
        for (const trackId of Object.keys(this.trackBuses)) {
            const gainNode = ctx.createGain();
            gainNode.gain.value = 0.30; // ~-10 dB per track — 4 tracks sum safely

            const pannerNode = ctx.createStereoPanner();
            pannerNode.pan.value = 0;

            const analyserNode = ctx.createAnalyser();
            analyserNode.fftSize = 256;
            analyserNode.smoothingTimeConstant = 0.3;

            gainNode.connect(pannerNode);
            pannerNode.connect(analyserNode);
            analyserNode.connect(this.masterGain);

            this.trackBuses[trackId] = { gainNode, pannerNode, analyserNode };
        }
    }

    /**
     * Get a track bus object
     * @param {string} trackId - 'drums' | 'chords' | 'melody' | 'bass'
     * @returns {{ gainNode: GainNode, pannerNode: StereoPannerNode, analyserNode: AnalyserNode } | null}
     */
    getTrackBus(trackId) {
        return this.trackBuses[trackId] || null;
    }

    /**
     * Set volume for a track bus
     * @param {string} trackId - 'drums' | 'chords' | 'melody' | 'bass'
     * @param {number} value - 0 to 1
     */
    setTrackVolume(trackId, value) {
        const bus = this.trackBuses[trackId];
        if (bus) {
            bus.gainNode.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.03);
        }
    }

    /**
     * Set pan for a track bus
     * @param {string} trackId - 'drums' | 'chords' | 'melody' | 'bass'
     * @param {number} value - -1 (left) to 1 (right)
     */
    setTrackPan(trackId, value) {
        const bus = this.trackBuses[trackId];
        if (bus) {
            bus.pannerNode.pan.setTargetAtTime(value, this.audioContext.currentTime, 0.03);
        }
    }

    /**
     * Set master bus pan / balance
     * @param {number} value - -1 (left) to 1 (right)
     */
    setMasterPan(value) {
        if (this.masterPanner) {
            this.masterPanner.pan.setTargetAtTime(value, this.audioContext.currentTime, 0.03);
        }
    }

    /**
     * Toggle mono monitoring on the master bus.
     * When enabled, collapses stereo to mono for mix-checking.
     * Uses a ChannelSplitter → sum → ChannelMerger chain inserted before the limiter.
     * @param {boolean} mono — true = mono, false = stereo
     */
    setMonoMonitoring(mono) {
        const ctx = this.audioContext;
        if (!ctx) return;

        if (mono && !this._monoNode) {
            // Insert mono summing: masterPanner → splitter → sum → merger → compressor
            // Brief master fade to avoid click on graph reconnect
            const ct = ctx.currentTime;
            this._safeCancelAutomation(this.masterGain.gain, ct);
            this.masterGain.gain.setTargetAtTime(0.0001, ct, 0.004);

            setTimeout(() => {
                this.masterPanner.disconnect();

                const splitter = ctx.createChannelSplitter(2);
                const merger = ctx.createChannelMerger(2);
                const halfGain = ctx.createGain();
                halfGain.gain.value = 0.5;
                const halfGain2 = ctx.createGain();
                halfGain2.gain.value = 0.5;

                this.masterPanner.connect(splitter);
                splitter.connect(halfGain, 0);
                splitter.connect(halfGain2, 1);
                halfGain.connect(merger, 0, 0);
                halfGain.connect(merger, 0, 1);
                halfGain2.connect(merger, 0, 0);
                halfGain2.connect(merger, 0, 1);
                merger.connect(this.compressor);

                this._monoNode = { splitter, merger, halfGain, halfGain2 };

                // Fade back in
                this.masterGain.gain.setTargetAtTime(0.3, ctx.currentTime, 0.008);
            }, 25);
        } else if (!mono && this._monoNode) {
            // Remove mono summing: masterPanner → compressor directly
            const ct = ctx.currentTime;
            this._safeCancelAutomation(this.masterGain.gain, ct);
            this.masterGain.gain.setTargetAtTime(0.0001, ct, 0.004);

            setTimeout(() => {
                this.masterPanner.disconnect();
                try { this._monoNode.splitter.disconnect(); } catch (e) {}
                try { this._monoNode.merger.disconnect(); } catch (e) {}
                try { this._monoNode.halfGain.disconnect(); } catch (e) {}
                try { this._monoNode.halfGain2.disconnect(); } catch (e) {}

                this.masterPanner.connect(this.compressor);
                this._monoNode = null;

                // Fade back in
                this.masterGain.gain.setTargetAtTime(0.3, ctx.currentTime, 0.008);
            }, 25);
        }

        this._isMonoMonitoring = !!mono;
    }

    /**
     * @returns {boolean} whether mono monitoring is active
     */
    get isMonoMonitoring() {
        return !!this._isMonoMonitoring;
    }

    /**
     * Read RMS level from a track bus analyser or drum channel analyser.
     * Supports 'drums', 'chords', 'melody', 'bass' (track buses) and
     * 'drum_808', 'drum_kick', etc. (individual drum channel analysers).
     * @param {string} trackId
     * @returns {number} 0-1 float representing RMS level
     */
    getTrackLevel(trackId) {
        // Master uses its own dedicated analyser
        if (trackId === 'master') {
            return this.getMasterLevel();
        }

        // --- Per-frame cache: avoid redundant FFT reads when multiple rAF
        // loops (ArrangementTimeline + MixerPanel) poll the same track in
        // the same animation frame.  We use a 4 ms window — well within a
        // single 16.6 ms frame — to decide if the cache is still fresh.
        const now = performance.now();
        if (now - this._meterCacheTime > 4) {
            // New frame — clear stale cache
            this._meterCache.clear();
            this._meterCacheTime = now;
        }
        if (this._meterCache.has(trackId)) {
            return this._meterCache.get(trackId);
        }

        let analyserNode = null;

        // Check track buses first
        const bus = this.trackBuses[trackId];
        if (bus) {
            analyserNode = bus.analyserNode;
        }

        // If no track bus, check for individual drum channel (e.g. 'drum_808' → '808')
        if (!analyserNode && trackId.startsWith('drum_')) {
            const drumId = trackId.slice(5); // 'drum_kick' → 'kick'
            const channel = this.drumChannels.get(drumId);
            if (channel) {
                analyserNode = channel.analyzer;
            }
        }

        if (!analyserNode) return 0;
        const rms = this._readRMS(analyserNode);
        this._meterCache.set(trackId, rms);
        return rms;
    }

    /**
     * Shared RMS reader — reuses a single cached Uint8Array to avoid
     * allocating garbage on every meter tick (was causing GC pauses → crackling).
     */
    _readRMS(analyserNode) {
        const len = analyserNode.frequencyBinCount;
        if (!this._meterBuf || this._meterBuf.length < len) {
            this._meterBuf = new Uint8Array(len);
        }
        analyserNode.getByteTimeDomainData(this._meterBuf);

        let sum = 0;
        for (let i = 0; i < len; i++) {
            const v = (this._meterBuf[i] - 128) / 128;
            sum += v * v;
        }
        return Math.sqrt(sum / len);
    }

    /**
     * Dynamically add a track bus (for audio tracks)
     * @param {string} trackId - unique track identifier
     */
    addTrackBus(trackId) {
        if (this.trackBuses[trackId]) return this.trackBuses[trackId];
        const ctx = this.audioContext;
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.5;
        const pannerNode = ctx.createStereoPanner();
        pannerNode.pan.value = 0;
        const analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.3;
        gainNode.connect(pannerNode);
        pannerNode.connect(analyserNode);
        analyserNode.connect(this.masterGain);
        this.trackBuses[trackId] = { gainNode, pannerNode, analyserNode };
        return this.trackBuses[trackId];
    }

    /**
     * Remove a dynamically added track bus
     * @param {string} trackId - unique track identifier
     */
    removeTrackBus(trackId) {
        const bus = this.trackBuses[trackId];
        if (!bus) return;
        try {
            bus.gainNode.disconnect();
            bus.pannerNode.disconnect();
            bus.analyserNode.disconnect();
        } catch (_) { /* already disconnected */ }
        delete this.trackBuses[trackId];
    }

    /**
     * Register a VST3 instrument node for a track. When set, playNote() for this
     * trackId will route MIDI through the VST3 instrument instead of sample playback.
     * @param {string} trackId
     * @param {{ noteOn: Function, noteOff: Function }} vst3Node
     */
    setVST3Instrument(trackId, vst3Node) {
        if (vst3Node) {
            this.vst3Instruments.set(trackId, vst3Node);
        } else {
            this.vst3Instruments.delete(trackId);
        }
    }

    /**
     * Get the VST3 instrument assigned to a track, if any.
     * @param {string} trackId
     * @returns {{ noteOn: Function, noteOff: Function } | undefined}
     */
    getVST3Instrument(trackId) {
        return this.vst3Instruments.get(trackId);
    }

    /**
     * Insert an EffectsChain into a track bus's signal path.
     * Routing becomes: pannerNode → chain.input → chain.output → analyserNode
     * If the track already has a chain wired, it is removed first.
     * @param {string} trackId
     * @param {import('./effects/EffectsChain.js').EffectsChain} chain
     */
    insertEffectsChain(trackId, chain) {
        const bus = this.trackBuses[trackId];
        if (!bus || !chain || !chain.input || !chain.output) return;

        // Remove any existing chain first
        this.removeEffectsChain(trackId);

        try { bus.pannerNode.disconnect(bus.analyserNode); } catch (_) {}
        bus.pannerNode.connect(chain.input);
        chain.output.connect(bus.analyserNode);
        bus._effectsChain = chain;
    }

    /**
     * Remove an EffectsChain from a track bus, restoring direct routing.
     * @param {string} trackId
     */
    removeEffectsChain(trackId) {
        const bus = this.trackBuses[trackId];
        if (!bus || !bus._effectsChain) return;

        const chain = bus._effectsChain;
        try { bus.pannerNode.disconnect(chain.input); } catch (_) {}
        try { chain.output.disconnect(bus.analyserNode); } catch (_) {}
        // Restore direct: pannerNode → analyserNode
        bus.pannerNode.connect(bus.analyserNode);
        delete bus._effectsChain;
    }

    /**
     * Sync all track effects chains from an EffectsManager.
     * For each track bus, if the manager has a chain with effects, wire it in.
     * If the manager has no chain (or empty chain), remove any existing wiring.
     * Also wires the master chain between masterGain and masterPanner.
     * @param {import('./effects/EffectsManager.js').EffectsManager} effectsManager
     */
    syncEffectsFromManager(effectsManager) {
        if (!effectsManager) return;

        // Sync per-track chains
        for (const trackId of Object.keys(this.trackBuses)) {
            const chain = effectsManager.getTrackChain(trackId);
            if (chain && chain.effects.length > 0 && chain.input && chain.output) {
                this.insertEffectsChain(trackId, chain);
            } else {
                this.removeEffectsChain(trackId);
            }
        }

        // Sync master chain
        const masterChain = effectsManager.masterChain;
        if (masterChain && masterChain.effects.length > 0 && masterChain.input && masterChain.output) {
            if (this._masterEffectsChain !== masterChain) {
                this._removeMasterEffectsChain();
                try { this.masterGain.disconnect(this.masterPanner); } catch (_) {}
                this.masterGain.connect(masterChain.input);
                masterChain.output.connect(this.masterPanner);
                this._masterEffectsChain = masterChain;
            }
        } else {
            this._removeMasterEffectsChain();
        }
    }

    /**
     * Remove master effects chain, restoring direct masterGain → masterPanner.
     */
    _removeMasterEffectsChain() {
        if (!this._masterEffectsChain) return;
        const chain = this._masterEffectsChain;
        try { this.masterGain.disconnect(chain.input); } catch (_) {}
        try { chain.output.disconnect(this.masterPanner); } catch (_) {}
        this.masterGain.connect(this.masterPanner);
        this._masterEffectsChain = null;
    }

    /**
     * Play an audio clip through a track bus
     * @param {AudioBuffer} buffer - decoded audio
     * @param {string} trackId - bus to route through
     * @param {number} when - AudioContext time to start
     * @param {number} playbackRate - speed/pitch (1.0 = normal)
     * @param {number} offset - start offset in seconds
     * @param {number} duration - playback duration in seconds (0 = full)
     * @returns {{ source: AudioBufferSourceNode, gainNode: GainNode }} for stop/fade control
     */
    playAudioClip(buffer, trackId, when = 0, playbackRate = 1.0, offset = 0, duration = 0, stretchOpts = null) {
        // Ensure context is running (may be suspended from idle timeout)
        if (this.audioContext.state === 'suspended') this.audioContext.resume().catch(() => {});
        let bus = this.trackBuses[trackId];
        // Auto-create bus on demand so clips never silently fail
        if (!bus) bus = this.addTrackBus(trackId);
        if (!bus || !buffer) return null;
        const ctx = this.audioContext;
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Apply time-stretch if provided
        let effectiveRate = playbackRate;
        if (stretchOpts && stretchOpts.timeStretch && stretchOpts.originalBpm && this.globalTempo) {
            const stretchRate = Math.max(0.5, Math.min(2.0, this.globalTempo / stretchOpts.originalBpm));
            effectiveRate *= stretchRate;
            // Pitch preservation via detune compensation
            if ((stretchOpts.preservePitch ?? this.preservePitch) && stretchRate !== 1.0 && 'detune' in source) {
                source.detune.value = -1200 * Math.log2(stretchRate);
            }
        }
        source.playbackRate.value = effectiveRate;
        const clipGain = ctx.createGain();
        source.connect(clipGain);
        clipGain.connect(bus.gainNode);

        const startTime = Math.max(when || ctx.currentTime, ctx.currentTime);

        // Start playback — NEVER pass duration to source.start() as it hard-cuts
        // the buffer at the sample level causing clicks. Use gain ramp for clean ending.
        source.start(startTime, offset);

        // Anti-click: 8ms fade-in ramp (wider window for smoother onset)
        clipGain.gain.setValueAtTime(0, startTime);
        clipGain.gain.linearRampToValueAtTime(1.0, startTime + 0.008);

        if (duration > 0) {
            // Anti-click fade-out: ramp gain to 0 over 25ms before the end
            const endTime = startTime + duration;
            const fadeOutStart = endTime - 0.025;
            clipGain.gain.setValueAtTime(1.0, Math.max(startTime + 0.009, fadeOutStart));
            clipGain.gain.linearRampToValueAtTime(0.0, endTime);
            // Stop source after gain is fully zero
            source.stop(endTime + 0.05);
        }

        // Cleanup: disconnect nodes when source ends to prevent bus pile-up
        source.onended = () => {
            try { source.disconnect(); } catch (_) {}
            try { clipGain.disconnect(); } catch (_) {}
            source.onended = null;
        };

        return { source, gainNode: clipGain };
    }

    /**
     * Initialize DSP chain for a drum channel
     */
    initDrumChannel(drumId) {
        if (this.drumChannels.has(drumId)) return this.drumChannels.get(drumId);

        const ctx = this.audioContext;

        // --- 1. Source Input (created per note) ---

        // --- 2. Pre-FX Gain (Volume/Envelope) ---
        const preGain = ctx.createGain();

        // --- 3. WaveShaper (Saturation/Fatten) ---
        const shaper = ctx.createWaveShaper();
        shaper.curve = new Float32Array([-1, 1]); // Identity pass-through

        // --- 4. Filter (Bass Boost/Fatten) ---
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowshelf';
        filter.frequency.value = 100;
        filter.gain.value = 0; // 0dB boost default

        // --- 5. Stereo Panner ---
        const panner = ctx.createStereoPanner();
        panner.pan.value = 0;

        // --- 6. Delay (Widen/Echo) ---
        const delay = ctx.createDelay(1.0); // Max 1 sec
        delay.delayTime.value = 0;

        const feedback = ctx.createGain();
        feedback.gain.value = 0;

        const delayMix = ctx.createGain();
        delayMix.gain.value = 0; // Dry/Wet

        // Delay Routing:
        // Input -> Dry -> Output
        // Input -> Delay -> Feedback -> Delay
        // Delay -> Wet -> Output

        // Simplifying for "Widen" vs "Echo"
        // For "Widen", we usually use a short delay on one channel or Haas effect.
        // For now, let's implement a standard Send-style delay chain or inline.
        // Inline:
        const delayInput = ctx.createGain();

        // --- 7. Analyzer (Metering) ---
        const analyzer = ctx.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.3;

        // --- 8. Post-FX Gain (Channel Volume) ---
        const postGain = ctx.createGain();
        postGain.gain.value = 1.0;

        // --- Chain Connection ---
        // preGain -> shaper -> filter -> panner -> postGain -> master
        // Inserting Delay... 
        // panner -> delayInput
        // delayInput -> postGain (Dry path?) no, postGain is final.

        // Let's do:
        // Source -> PreGain -> Shaper -> Filter -> Panner -> [Split]
        // [Split] -> PostGain (Dry)
        // [Split] -> Delay -> DelayMix -> PostGain (Wet)
        // PostGain -> Analyzer -> Master

        preGain.connect(shaper);
        shaper.connect(filter);
        filter.connect(panner);

        panner.connect(postGain); // Dry path (always on)

        panner.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(delayMix);
        delayMix.connect(postGain); // Wet path

        postGain.connect(analyzer);
        // Route through drums track bus if available, otherwise direct to master
        const drumsBus = this.trackBuses.drums;
        analyzer.connect(drumsBus ? drumsBus.gainNode : this.masterGain);

        const channel = {
            preGain,
            shaper,
            filter,
            panner,
            delay,
            feedback,
            delayMix,
            analyzer,
            postGain,
            params: {
                sampleStart: 0, // %
                attack: 0,
                decay: 0.1,
                sustain: 1.0,
                release: 0.1,
                widen: 0, // Delay time spread
                fatten: 0, // Saturation + Bass
                drive: 0, // Distortion
                bassBoost: 0, // Low shelf gain
                pan: 0,
                volume: 1.0,
                pitch: 0, // Semitones
                delayTime: 0,
                delayFeedback: 0,
                delayMix: 0,
                reverse: false
            }
        };

        this.drumChannels.set(drumId, channel);
        return channel;
    }

    /**
     * Get Meter Data for UI
     */
    getMeterData(drumId) {
        const channel = this.drumChannels.get(drumId);
        if (!channel) return { rms: 0, peak: 0 };

        const bufferLength = channel.analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        channel.analyzer.getByteTimeDomainData(dataArray);

        let sum = 0;
        let peak = 0;
        for (let i = 0; i < bufferLength; i++) {
            const value = (dataArray[i] - 128) / 128; // Normalize -1 to 1
            const abs = Math.abs(value);
            sum += value * value;
            if (abs > peak) peak = abs;
        }
        const rms = Math.sqrt(sum / bufferLength);
        return { rms, peak };
    }

    /**
     * Update Drum Parameter
     */
    setDrumParam(drumId, param, value) {
        let channel = this.drumChannels.get(drumId);
        if (!channel) channel = this.initDrumChannel(drumId);

        channel.params[param] = value;
        const ctx = this.audioContext;

        switch (param) {
            case 'volume':
                channel.postGain.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
                break;
            case 'pan':
                channel.panner.pan.setTargetAtTime(value, ctx.currentTime, 0.01);
                break;
            case 'fatten':
            case 'drive':
                // Saturation amount
                const fatten = channel.params.fatten || 0;
                const drive = channel.params.drive || 0;
                const k = (fatten + drive) * 100; // 0 to 200
                const curve = new Float32Array(4096);
                const deg = Math.PI / 180;
                for (let i = 0; i < 4096; i++) {
                    const x = i * 2 / 4096 - 1;
                    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
                }
                channel.shaper.curve = curve;
                break;
            case 'bassBoost':
                channel.filter.gain.setTargetAtTime(value * 20, ctx.currentTime, 0.01); // 0 to 20dB
                break;
            case 'widen':
                // Use delay for HAAS / Widening if simple stereo width
                // Or mapped to sidebar Delay controls?
                // Let's map 'widen' to a slight stereo delay
                break;
            case 'delayTime':
                channel.delay.delayTime.setTargetAtTime(value, ctx.currentTime, 0.01);
                break;
            case 'delayFeedback':
                channel.feedback.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
                break;
            case 'delayMix':
                channel.delayMix.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
                break;
        }
    }

    /**
     * Load instrument from one-shot samples
     * @param {string} instrumentId - Unique instrument identifier
     * @param {Array} samples - Array of {note: number, buffer: AudioBuffer, name: string}
     * @param {string} [displayName] - Optional human-readable name
     */
    loadInstrument(instrumentId, samples, displayName = null) {
        // Evict previous instrument's buffers from reversed-buffer cache
        const prev = this.instruments.get(instrumentId);
        if (prev && prev.samples) {
            for (const [, buf] of prev.samples) {
                this._reversedBufferCache.delete(buf);
            }
            prev.samples.clear();
        }

        const sampleMap = new Map();
        const nameMap = new Map();

        samples.forEach(sample => {
            if (sample.buffer && typeof sample.note === 'number') {
                sampleMap.set(sample.note, sample.buffer);
                if (sample.name) nameMap.set(sample.note, sample.name);
            }
        });

        this.instruments.set(instrumentId, {
            samples: sampleMap,
            sampleNames: nameMap,
            rootNote: samples[0]?.note || 60,
            name: displayName || instrumentId,
            originalBpm: null  // Set via setInstrumentBpm() for time-stretch
        });

        // Auto-detect BPM from first sample filename
        const firstName = samples[0]?.name || displayName || '';
        const bpmMatch = firstName.match(/(\d{2,3})\s*(?:BPM|bpm)/i);
        if (bpmMatch) {
            this.instruments.get(instrumentId).originalBpm = parseInt(bpmMatch[1]);
        }

        console.log(`Loaded instrument: ${instrumentId} with ${sampleMap.size} samples`);

        // Auto-tune if enabled — adjusts rootNote so playbackRate shifts pitch to project key
        if (this.autoTuneEnabled) {
            this.autoTuneInstrument(instrumentId);
        }
    }

    // ─── Time-Stretch Methods ────────────────────────────────────────────

    /** Update the global tempo reference (called from app when tempo changes) */
    setGlobalTempo(tempo) { this.globalTempo = tempo; }

    /** Enable/disable pitch preservation during time-stretch */
    setPreservePitch(enabled) { this.preservePitch = enabled; }

    /** Set the original BPM for an instrument (for time-stretch calculations) */
    setInstrumentBpm(instrumentId, bpm) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument) instrument.originalBpm = bpm;
    }

    /** Get the original BPM for an instrument */
    getInstrumentBpm(instrumentId) {
        return this.instruments.get(instrumentId)?.originalBpm || null;
    }

    // ─── Auto-Tune Methods (SampleMatchEngine) ────────────────────────

    /** Enable/disable automatic pitch-matching of imported samples to project key */
    setAutoTune(enabled) { this.autoTuneEnabled = !!enabled; }

    /** Update the project key for auto-tune (called from app when key changes) */
    setAutoTuneKey(key) { this.autoTuneKey = key; }

    /**
     * Auto-tune a loaded instrument to the current project key.
     * Uses SampleMatchEngine to detect pitch and adjust rootNote so
     * the existing playbackRate logic handles the shift.
     * @param {string} instrumentId
     * @returns {{ detectedPitch: object, semitoneShift: number } | null}
     */
    autoTuneInstrument(instrumentId) {
        if (!this.autoTuneEnabled) return null;
        try {
            return applyAutoTune(this, instrumentId, this.autoTuneKey);
        } catch (err) {
            console.warn('[SamplerEngine] Auto-tune failed for', instrumentId, err);
            return null;
        }
    }

    // ─── Sample Slicer ──────────────────────────────────────────────────

    /**
     * Extract a portion of an AudioBuffer between startTime and endTime.
     * @param {AudioBuffer} buffer - source audio
     * @param {number} startTime - start in seconds
     * @param {number} endTime - end in seconds
     * @returns {AudioBuffer} the sliced sub-buffer
     */
    sliceBuffer(buffer, startTime, endTime) {
        const sr = buffer.sampleRate;
        const channels = buffer.numberOfChannels;
        const startFrame = Math.max(0, Math.floor(startTime * sr));
        const endFrame = Math.min(buffer.length, Math.ceil(endTime * sr));
        const frameCount = Math.max(1, endFrame - startFrame);

        const sliced = this.audioContext.createBuffer(channels, frameCount, sr);
        for (let ch = 0; ch < channels; ch++) {
            const src = buffer.getChannelData(ch);
            const dst = sliced.getChannelData(ch);
            for (let i = 0; i < frameCount; i++) {
                dst[i] = src[startFrame + i] || 0;
            }
        }
        return sliced;
    }

    /**
     * Load a sliced instrument — splits a buffer into slices mapped to MIDI notes.
     * @param {string} instrumentId - unique instrument ID
     * @param {AudioBuffer} buffer - full audio buffer to slice
     * @param {Array<{startTime: number, endTime: number, reversed?: boolean, pitch?: number}>} slices
     * @param {string} [displayName] - human-readable name
     * @param {number} [rootNote=48] - MIDI note for first slice (C3)
     */
    loadSlicedInstrument(instrumentId, buffer, slices, displayName = null, rootNote = 48) {
        const samples = [];
        slices.forEach((slice, idx) => {
            let slicedBuf = this.sliceBuffer(buffer, slice.startTime, slice.endTime);

            // Apply per-slice reverse
            if (slice.reversed) {
                const rev = this.audioContext.createBuffer(
                    slicedBuf.numberOfChannels, slicedBuf.length, slicedBuf.sampleRate
                );
                for (let ch = 0; ch < slicedBuf.numberOfChannels; ch++) {
                    const src = slicedBuf.getChannelData(ch);
                    const dst = rev.getChannelData(ch);
                    for (let j = 0; j < slicedBuf.length; j++) {
                        dst[j] = src[slicedBuf.length - 1 - j];
                    }
                }
                slicedBuf = rev;
            }

            samples.push({
                note: rootNote + idx,
                buffer: slicedBuf,
                name: `Slice ${idx + 1}`
            });
        });

        this.loadInstrument(instrumentId, samples, displayName || `Sliced: ${instrumentId}`);
        console.log(`[SamplerEngine] Loaded sliced instrument: ${instrumentId} with ${slices.length} slices`);
    }

    /**
     * Load instrument from folder of samples
     * Automatically detects note numbers from filenames (e.g., "piano_C4.wav" -> 60)
     * @param {string} instrumentId - Unique ID
     * @param {Array} files - Audio files
     * @param {string} [displayName] - Optional human name
     */
    async loadInstrumentFromFiles(instrumentId, files, displayName = null) {
        const samples = [];

        for (const file of files) {
            if (!file.type.startsWith('audio/')) continue;

            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

                // Try to extract note from filename
                const note = this.extractNoteFromFilename(file.name);

                samples.push({
                    note: note,
                    buffer: audioBuffer,
                    name: file.name
                });
            } catch (error) {
                console.error(`Failed to load sample: ${file.name}`, error);
            }
        }

        if (samples.length > 0) {
            this.loadInstrument(instrumentId, samples, displayName);
        }

        return samples;
    }

    /**
     * Extract MIDI note number from filename
     * Supports formats: "C4", "C#4", "Db4", "piano_60", etc.
     */
    extractNoteFromFilename(filename) {
        // Try to find note name (C, C#, Db, etc.) + octave
        const noteMatch = filename.match(/([A-G][#b]?)(\d)/i);
        if (noteMatch) {
            const noteName = noteMatch[1].toUpperCase();
            const octave = parseInt(noteMatch[2]);
            return this.noteNameToMidi(noteName, octave);
        }

        // Try to find MIDI number directly
        const midiMatch = filename.match(/(\d{1,3})/);
        if (midiMatch) {
            const midi = parseInt(midiMatch[1]);
            if (midi >= 0 && midi <= 127) {
                return midi;
            }
        }

        // Default to middle C
        return 60;
    }

    /**
     * Convert note name to MIDI number
     */
    noteNameToMidi(noteName, octave) {
        const noteMap = {
            'C': 0, 'C#': 1, 'DB': 1,
            'D': 2, 'D#': 3, 'EB': 3,
            'E': 4,
            'F': 5, 'F#': 6, 'GB': 6,
            'G': 7, 'G#': 8, 'AB': 8,
            'A': 9, 'A#': 10, 'BB': 10,
            'B': 11
        };

        const noteOffset = noteMap[noteName] || 0;
        return (octave + 1) * 12 + noteOffset;
    }

    /**
     * Play a MIDI note using loaded instrument
     * @param {string} instrumentId - Instrument to use
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-1)
     * @param {number} duration - Note duration in seconds
     * @param {number} startTime - When to start (audioContext time)
     * @param {string} [trackId] - Optional track bus to route through ('chords'|'melody'|'bass')
     */
    playNote(instrumentId, note, velocity = 0.8, duration = 1.0, startTime = null, trackId = null) {
      try {
        // Ensure context is running (may be suspended from idle timeout)
        if (this.audioContext.state === 'suspended') this.audioContext.resume().catch(() => {});
        // Start cleanup timer lazily (self-stops when no active sources remain)
        this._startCleanupTimer();

        // Check for VST3 instrument on this track — if present, route MIDI through it
        if (trackId) {
            const vst3 = this.vst3Instruments.get(trackId);
            if (vst3 && vst3.noteOn) {
                vst3.noteOn(0, note, Math.round(velocity * 127));
                if (duration > 0) {
                    setTimeout(() => {
                        if (vst3.noteOff) vst3.noteOff(0, note);
                    }, duration * 1000);
                }
                return null;
            }
        }

        const instrument = this.instruments.get(instrumentId);
        if (!instrument) {
            // Silently return — unloaded instruments are expected during startup
            // and when drum slots haven't been assigned samples yet.
            return null;
        }

        // Find closest sample
        const sample = this.findClosestSample(instrument, note);
        if (!sample) {
            return null;
        }

        // --- Check for Drum Channel DSP ---
        // If this instrumentId matches a drum channel, route through it.
        // Auto-initialize a drum channel when routed through 'drums' bus
        // so individual drum lane meters work in the mixer.
        let channel = this.drumChannels.get(instrumentId);
        if (!channel && trackId === 'drums') {
            channel = this.initDrumChannel(instrumentId);
        }

        // Calculate pitch shift
        let pitchShift = 1.0;

        if (channel) {
            // Apply Transpose (Pitch) from params
            const semitones = channel.params.pitch || 0;
            // Note: Simplistic pitch shift on top of midi note
            // If it's a drum, 'note' is usually fixed, but could vary
        }

        const rootNote = this.getSampleNote(instrument, sample);
        const targetNote = (note || 60) + (channel ? (channel.params.pitch || 0) : 0);
        pitchShift = Math.pow(2, (targetNote - rootNote) / 12);

        if (!isFinite(pitchShift)) pitchShift = 1.0;

        // Create source
        const source = this.audioContext.createBufferSource();

        // Reverse Logic — use cached reversed buffer to avoid per-note allocation
        if (channel && channel.params.reverse) {
            let reversed = this._reversedBufferCache.get(sample);
            if (!reversed) {
                reversed = this.audioContext.createBuffer(sample.numberOfChannels, sample.length, sample.sampleRate);
                for (let i = 0; i < sample.numberOfChannels; i++) {
                    const origData = sample.getChannelData(i);
                    const revData = reversed.getChannelData(i);
                    for (let j = 0; j < sample.length; j++) {
                        revData[j] = origData[sample.length - 1 - j];
                    }
                }
                this._reversedBufferCache.set(sample, reversed);
            }
            source.buffer = reversed;
        } else {
            source.buffer = sample;
        }

        // Apply time-stretch if instrument has BPM metadata
        let stretchRate = 1.0;
        if (instrument.originalBpm && this.globalTempo) {
            stretchRate = Math.max(0.5, Math.min(2.0, this.globalTempo / instrument.originalBpm));
        }
        source.playbackRate.value = pitchShift * stretchRate;
        if (this.preservePitch && stretchRate !== 1.0 && 'detune' in source) {
            source.detune.value = -1200 * Math.log2(stretchRate);
        }

        // --- Sample Start Offset ---
        let offset = 0;
        if (channel) {
            // params.sampleStart is 0-100, maps to 0-1 (fraction) or seconds?
            // Usually fraction of buffer duration
            offset = (channel.params.sampleStart / 100) * sample.duration;
        }

        // --- Stop any previous instance of the same instrument+note to prevent overlap ---
        const reuseKey = `${instrumentId}_${note}`;
        this._fadeOutAndStop(reuseKey);

        // --- Voice stealing: if at max voices, kill the oldest ---
        if (this.activeSources.size >= this.MAX_VOICES) {
            this._stealOldestVoice();
        }

        // Single gain node combining velocity + ADSR envelope.
        // Previously two separate GainNodes were used (velocity + envelope),
        // but each note created 3 audio nodes. By baking velocity into the
        // envelope automation we drop to 2 nodes per note — a 33 % reduction
        // in audio-graph complexity that directly lowers audio-thread load.
        const envGain = this.audioContext.createGain();
        envGain.gain.value = 0; // silent until ADSR starts
        const vel = Math.max(0, Math.min(1, isFinite(velocity) ? velocity : 0.8));

        // Connect: source → envGain → destination (2 nodes, not 3)
        source.connect(envGain);

        if (channel) {
            envGain.connect(channel.preGain);
        } else if (trackId && this.trackBuses[trackId]) {
            envGain.connect(this.trackBuses[trackId].gainNode);
        } else {
            envGain.connect(this.masterGain);
        }

        // Schedule playback — add lookahead when no explicit startTime is given.
        // This gives the audio thread multiple render quanta to prepare the
        // buffer, preventing clicks/crackles from starting mid-quantum.
        const SCHEDULE_AHEAD = 0.050; // 50 ms lookahead — 7-8 render quanta for smooth playback
        const now = startTime || (this.audioContext.currentTime + SCHEDULE_AHEAD);

        // ADSR Logic — velocity is baked into the peak / sustain levels
        const attack = Math.max(channel ? channel.params.attack : 0.005, 0.002);
        const decay = Math.max(channel ? channel.params.decay : 0.1, 0.005);
        const sustain = channel ? channel.params.sustain : 1.0;
        const release = Math.max(channel ? channel.params.release : 0.05, 0.03);
        const sustainLevel = Math.max(sustain, 0.001) * vel;

        // Attack — ramp from silence to velocity-scaled peak
        envGain.gain.setValueAtTime(0.0001, now);
        envGain.gain.linearRampToValueAtTime(vel, now + attack);

        // Decay → Sustain (exponential approach to velocity-scaled sustain)
        envGain.gain.setTargetAtTime(sustainLevel, now + attack, decay * 0.33);

        // For drums, let the sample ring its full natural length.
        // The reuseKey in _fadeOutAndStop cuts overlapping hits automatically.
        if (channel && sample) {
            const sampleDur = sample.duration / (pitchShift || 1);
            duration = Math.max(duration, sampleDur);
        }

        // Release — smooth ramp toward silence from whatever current value
        const noteEnd = now + duration;
        envGain.gain.setTargetAtTime(0.0001, noteEnd, release * 0.33);

        source.start(now, offset);
        source.stop(noteEnd + release + 0.1);

        // Track active source for cleanup and voice stealing (only 2 nodes now)
        this.activeSources.set(reuseKey, { source, envelope: envGain, startedAt: now });

        source.onended = () => {
            try { source.disconnect(); } catch (e) {}
            try { envGain.disconnect(); } catch (e) {}

            if (this.activeSources.get(reuseKey)?.source === source) {
                this.activeSources.delete(reuseKey);
            }
            // Break circular reference so GC can collect immediately
            source.onended = null;
        };

        return reuseKey;
      } catch (err) {
        // Log but don't throw — audio errors during hot-swap are expected and transient
        if (this.audioContext.state !== 'closed') {
            console.warn('[SamplerEngine] playNote error:', err.message);
        }
        return null;
      }
    }

    /**
     * Find closest sample to target note
     */
    findClosestSample(instrument, targetNote) {
        const samples = Array.from(instrument.samples.keys());
        if (samples.length === 0) return null;

        // Find exact match
        if (instrument.samples.has(targetNote)) {
            return instrument.samples.get(targetNote);
        }

        // Find closest sample
        let closestNote = samples[0];
        let minDistance = Math.abs(targetNote - closestNote);

        for (const note of samples) {
            const distance = Math.abs(targetNote - note);
            if (distance < minDistance) {
                minDistance = distance;
                closestNote = note;
            }
        }

        return instrument.samples.get(closestNote);
    }

    /**
     * Get the note number for a sample
     */
    getSampleNote(instrument, sampleBuffer) {
        for (const [note, buffer] of instrument.samples.entries()) {
            if (buffer === sampleBuffer) {
                return note;
            }
        }
        return instrument.rootNote || 60;
    }

    /**
     * Play MIDI pattern
     * @param {string} instrumentId - Instrument to use
     * @param {Array} pattern - Array of {note, startTime, duration, velocity}
     * @param {number} tempo - BPM
     */
    playPattern(instrumentId, pattern, tempo = 120) {
        const beatDuration = 60 / tempo;
        const startTime = this.audioContext.currentTime;

        pattern.forEach(note => {
            const noteNum = typeof note.note === 'number' ? note.note : note.notes?.[0] || 60;
            const start = startTime + (note.startTime || note.time || 0) * beatDuration;
            const duration = (note.duration || 0.25) * beatDuration;
            const velocity = note.velocity || 0.8;

            this.playNote(instrumentId, noteNum, velocity, duration, start);
        });
    }

    /**
     * Cancel automation without a gain discontinuity.
     * Prefers cancelAndHoldAtTime (Chrome 57+, Firefox 100+) which freezes
     * the computed value at cancelTime.  Falls back to cancelScheduledValues
     * which can cause a brief click in rare cases.
     * @param {AudioParam} param
     * @param {number} time
     */
    _safeCancelAutomation(param, time) {
        if (typeof param.cancelAndHoldAtTime === 'function') {
            param.cancelAndHoldAtTime(time);
        } else {
            param.cancelScheduledValues(time);
        }
    }

    /**
     * Smoothly fade out and stop a voice by its reuseKey.
     * Uses cancelAndHoldAtTime + exponential fade to prevent clicks.
     * @param {string} reuseKey - The voice key to stop
     */
    _fadeOutAndStop(reuseKey) {
        const entry = this.activeSources.get(reuseKey);
        if (!entry) return;
        try {
            const ct = this.audioContext.currentTime;
            const src = entry.source || entry;
            const env = entry.envelope;
            if (env) {
                // cancelAndHoldAtTime freezes the computed gain at ct,
                // then setTargetAtTime smoothly ramps to silence — no click.
                this._safeCancelAutomation(env.gain, ct);
                env.gain.setTargetAtTime(0.0001, ct, 0.008); // ~12ms fade
            }
            src.stop(ct + 0.06); // Stop 60ms later (after fade completes)
            src.onended = () => {
                try { src.disconnect(); } catch (e) {}
                try { env?.disconnect(); } catch (e) {}
                src.onended = null;
            };
        } catch (e) {
            // Already stopped — force disconnect
            try { (entry.source || entry).disconnect(); } catch (e2) {}
            try { entry.envelope?.disconnect(); } catch (e2) {}
            try { (entry.source || entry).onended = null; } catch (e2) {}
        }
        this.activeSources.delete(reuseKey);
    }

    /**
     * Steal the oldest voice when at MAX_VOICES limit.
     * Finds the voice with the earliest startedAt and fades it out.
     */
    _stealOldestVoice() {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.activeSources) {
            const t = entry.startedAt || 0;
            if (t < oldestTime) {
                oldestTime = t;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this._fadeOutAndStop(oldestKey);
        }
    }

    /**
     * Stop all playing notes with a quick fade to avoid clicks
     */
    stopAll() {
        const ct = this.audioContext.currentTime;

        this.activeSources.forEach(entry => {
            try {
                const src = entry.source || entry;
                const env = entry.envelope;
                if (env) {
                    this._safeCancelAutomation(env.gain, ct);
                    env.gain.setTargetAtTime(0.0001, ct, 0.006);
                }
                src.stop(ct + 0.04);
                src.onended = () => {
                    try { src.disconnect(); } catch (e) {}
                    try { env?.disconnect(); } catch (e) {}
                    src.onended = null;
                };
            } catch (e) {
                try { (entry.source || entry).disconnect(); } catch (e2) {}
                try { entry.envelope?.disconnect(); } catch (e2) {}
                try { (entry.source || entry).onended = null; } catch (e2) {}
            }
        });
        this.activeSources.clear();
    }

    /**
     * Stop specific note with a quick fade
     */
    stopNote(noteId) {
        const entry = this.activeSources.get(noteId);
        if (entry) {
            try {
                const ct = this.audioContext.currentTime;
                const src = entry.source || entry;
                const env = entry.envelope;
                if (env) {
                    this._safeCancelAutomation(env.gain, ct);
                    env.gain.setTargetAtTime(0.0001, ct, 0.005);
                }
                src.stop(ct + 0.035);
                src.onended = () => {
                    try { src.disconnect(); } catch (e) {}
                    try { env?.disconnect(); } catch (e) {}
                    src.onended = null;
                };
            } catch (e) {
                try { (entry.source || entry).disconnect(); } catch (e2) {}
                try { entry.envelope?.disconnect(); } catch (e2) {}
                try { (entry.source || entry).onended = null; } catch (e2) {}
            }
            this.activeSources.delete(noteId);
        }
    }

    /**
     * Render pattern to audio buffer
     * @param {string} instrumentId - Instrument to use
     * @param {Array} pattern - MIDI pattern
     * @param {number} tempo - BPM
     * @param {number} duration - Total duration in seconds
     */
    async renderPattern(instrumentId, pattern, tempo = 120, duration = 10, exportSampleRate) {
        const instrument = this.instruments.get(instrumentId);
        if (!instrument) {
            throw new Error(`Instrument not loaded: ${instrumentId}`);
        }

        // Use the explicit export sample rate when provided so the rendered
        // buffer matches the WAV header and avoids tempo drift in DAWs.
        const sampleRate = exportSampleRate || this.audioContext.sampleRate;
        const numFrames = Math.ceil(duration * sampleRate);
        const offlineContext = new OfflineAudioContext(2, numFrames, sampleRate);

        const beatDuration = 60 / tempo;
        // Pattern steps are 32nd-note subdivisions: 32 steps/bar = 8 steps/beat
        const stepDuration = beatDuration / 8;

        // Calculate pattern duration from actual data (max step + its duration)
        let patternMaxEnd = 0;
        pattern.forEach(note => {
            const step = note.startTime || note.time || 0;
            const dur = note.duration || 2;
            patternMaxEnd = Math.max(patternMaxEnd, step + dur);
        });
        const patternDuration = patternMaxEnd > 0 ? patternMaxEnd * stepDuration : duration;

        // ADSR defaults — match playNote() behaviour so exports sound like preview
        const attack = 0.01;
        const decay = 0.1;
        const sustain = 1.0;
        const release = 0.1;

        // Loop pattern until total duration is covered
        for (let currentTime = 0; currentTime < duration; currentTime += patternDuration) {

            pattern.forEach(note => {
                const noteNum = typeof note.note === 'number' ? note.note : note.notes?.[0] || 60;

                // Original start time relative to pattern start (steps → seconds)
                const relativeStart = (note.startTime || note.time || 0) * stepDuration;

                // Absolute start time including loop offset
                const start = currentTime + relativeStart;

                // Skip if beyond total duration
                if (start >= duration) return;

                const noteDuration = (note.duration || 2) * stepDuration;
                const velocity = note.velocity || 0.8;

                // Find sample
                const sample = this.findClosestSample(instrument, noteNum);
                if (!sample) return;

                // Calculate pitch shift
                const rootNote = this.getSampleNote(instrument, sample);
                const pitchShift = Math.pow(2, (noteNum - rootNote) / 12);

                // Apply time-stretch if instrument has BPM metadata
                let stretchRate = 1.0;
                if (instrument.originalBpm && this.globalTempo) {
                    stretchRate = Math.max(0.5, Math.min(2.0, this.globalTempo / instrument.originalBpm));
                }

                // Create source in offline context
                const source = offlineContext.createBufferSource();
                source.buffer = sample;
                source.playbackRate.value = pitchShift * stretchRate;
                if (this.preservePitch && stretchRate !== 1.0 && 'detune' in source) {
                    source.detune.value = -1200 * Math.log2(stretchRate);
                }

                // Velocity gain
                const gainNode = offlineContext.createGain();
                gainNode.gain.value = velocity;

                // ADSR envelope — prevents notes from ringing forever and
                // matches the live-playback behaviour of playNote().
                const envelope = offlineContext.createGain();
                envelope.gain.setValueAtTime(0, start);
                envelope.gain.linearRampToValueAtTime(1.0, start + attack);
                envelope.gain.exponentialRampToValueAtTime(
                    Math.max(sustain, 0.01), start + attack + decay
                );

                const noteEnd = start + noteDuration;
                envelope.gain.setValueAtTime(Math.max(sustain, 0.01), noteEnd);
                envelope.gain.linearRampToValueAtTime(0.001, noteEnd + release);

                source.connect(gainNode);
                gainNode.connect(envelope);
                envelope.connect(offlineContext.destination);

                source.start(start);
                source.stop(noteEnd + release + 0.05);
            });
        }

        // Render
        const renderedBuffer = await offlineContext.startRendering();
        return renderedBuffer;
    }

    /**
     * Get instrument info
     */
    getInstrumentInfo(instrumentId) {
        const instrument = this.instruments.get(instrumentId);
        if (!instrument) return null;

        return {
            name: instrument.name,
            sampleCount: instrument.samples.size,
            originalBpm: instrument.originalBpm || null,
            noteRange: {
                min: Math.min(...instrument.samples.keys()),
                max: Math.max(...instrument.samples.keys())
            }
        };
    }

    /**
     * List all loaded instruments
     */
    listInstruments() {
        return Array.from(this.instruments.keys());
    }

    /**
     * Unload instrument
     */
    unloadInstrument(instrumentId) {
        this.instruments.delete(instrumentId);
    }

    // ─── Mobile Link Audio Tap ────────────────────

    /**
     * Create a MediaStreamDestination tapped off the compressor (parallel to speakers).
     * Returns the MediaStream for passing to a PeerJS media call.
     * Idempotent — returns existing stream if already connected.
     *
     * @returns {MediaStream}
     */
    connectMobileStreamDest() {
        if (this._mobileStreamDest) {
            return this._mobileStreamDest.stream;
        }
        this._mobileStreamDest = this.audioContext.createMediaStreamDestination();
        // Parallel tap: compressor feeds both masterAnalyser→speakers AND mobileStreamDest
        this.compressor.connect(this._mobileStreamDest);
        return this._mobileStreamDest.stream;
    }

    /**
     * Disconnect the mobile audio tap and release the MediaStreamDestination.
     */
    disconnectMobileStreamDest() {
        if (!this._mobileStreamDest) return;
        try {
            this.compressor.disconnect(this._mobileStreamDest);
        } catch (_) { /* already disconnected */ }
        this._mobileStreamDest = null;
    }

    /**
     * Mute or unmute the desktop speaker output.
     * The mobile stream (via _mobileStreamDest) is unaffected.
     * @param {boolean} muted
     */
    muteDesktopOutput(muted) {
        if (!this.masterAnalyser || !this.audioContext) return;
        if (muted && !this._desktopMuted) {
            try { this.masterAnalyser.disconnect(this.audioContext.destination); } catch (_) {}
            this._desktopMuted = true;
        } else if (!muted && this._desktopMuted) {
            this.masterAnalyser.connect(this.audioContext.destination);
            this._desktopMuted = false;
        }
    }

    /** @returns {boolean} */
    isDesktopMuted() {
        return !!this._desktopMuted;
    }

    /**
     * Read RMS level from the master analyser (post-compressor).
     * @returns {number} 0-1 float representing master RMS level
     */
    getMasterLevel() {
        if (!this.masterAnalyser) return 0;
        return this._readRMS(this.masterAnalyser);
    }

    /**
     * Route an external AudioEngine's output through this SamplerEngine's
     * master chain (compressor → analyser → destination / mobile stream).
     * This ensures file-explorer preview audio is included in Mobile Link
     * streaming and affected by muteDesktopOutput().
     *
     * @param {AudioEngine} audioEngine  The singleton preview engine (window.audioEngine)
     */
    routePreviewEngine(audioEngine) {
        if (!audioEngine || !audioEngine.masterBus) return;
        try { audioEngine.masterBus.disconnect(); } catch (_) {}
        audioEngine.masterBus.connect(this.compressor);
    }

    /**
     * Create a WaveShaperNode with a soft-clip (tanh) curve.
     * Prevents digital clipping when multiple audio tracks sum > 1.0.
     * @param {AudioContext} ctx
     * @returns {WaveShaperNode}
     */
    _createSoftLimiter(ctx) {
        const shaper = ctx.createWaveShaper();
        const n = 8192;
        const curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1; // -1 to +1
            // Soft-clip: linear below 0.8, tanh compression above
            curve[i] = Math.abs(x) < 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((Math.abs(x) - 0.8) * 5));
        }
        shaper.curve = curve;
        shaper.oversample = 'none'; // no oversampling — minimal CPU
        return shaper;
    }

    /**
     * Periodically prune stale entries from activeSources.
     * Voices whose AudioBufferSourceNode has finished but whose onended
     * callback didn't fire (e.g. due to voice stealing race conditions)
     * will leak nodes and memory.  Runs every 5 seconds.
     */
    /**
     * Proactively hot-swap the AudioContext every 11 seconds to work around
     * Realtek driver bug that kills audio output after ~15-20 seconds.
     * Seamless: old voices ring out on old context while new notes use new context.
     */
    _startProactiveReset() {
        if (this._resetInterval) return;
        // Swap every 4 seconds — Realtek driver degrades (static/silence) around
        // 10-15 seconds, so swapping at 4s prevents audible artifacts.
        // Generator notes are fire-and-forget (short duration), so in-flight notes
        // on the old context finish naturally within the 2s grace period.
        // Swap every 6 seconds to prevent Realtek driver degradation.
        // Generator polling loops detect context changes and re-trigger
        // sustaining notes (chords, melody, bass, long 808s) seamlessly.
        this._resetInterval = setInterval(() => {
            if (this._audioActive || (this.audioContext && this.audioContext.state === 'running')) {
                this._hotSwapAudioContext();
            }
        }, 6000);
    }

    /** Call when audio activity starts/stops (playback, recording, count-in clicks) */
    setAudioActive(active) {
        this._audioActive = active;
        if (active) {
            // Cancel any pending idle suspend from preview clicks
            if (this._idleSuspendTimer) {
                clearTimeout(this._idleSuspendTimer);
                this._idleSuspendTimer = null;
            }
            // Resume context if it was suspended during idle
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => {});
            }
            // Stop any hot-swap interval
            if (this._resetInterval) {
                clearInterval(this._resetInterval);
                this._resetInterval = null;
                this._resetEnabled = false;
            }
            // Soft reset: fade out over 1.5s, disconnect/reconnect destination,
            // then restore gain instantly. No new context = no click.
            if (this._softResetInterval) clearInterval(this._softResetInterval);
            this._softResetInterval = setInterval(() => {
                if (!this._audioActive || !this.audioContext || this.audioContext.state !== 'running') return;
                const savedGain = this.masterGain.gain.value;
                const ctx = this.audioContext;
                const t = ctx.currentTime;
                // Fade out over 1.5 seconds
                this.masterGain.gain.setValueAtTime(savedGain, t);
                this.masterGain.gain.linearRampToValueAtTime(0, t + 1.5);
                // After fade completes: disconnect, reconnect, restore gain
                setTimeout(() => {
                    try {
                        this._softLimiter.disconnect(ctx.destination);
                        this._softLimiter.connect(ctx.destination);
                        // Restore gain instantly at full level
                        this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
                        this.masterGain.gain.setValueAtTime(savedGain, ctx.currentTime);
                    } catch (_) {}
                }, 1600); // slightly after the 1.5s fade
            }, 15000); // every 15 seconds
            // Start silent keepalive tone for pipeline stability
            this._startKeepaliveTone();
        }
        // When audio goes idle, stop the hot-swap interval and suspend the
        // AudioContext so the Realtek driver doesn't degrade into static.
        if (!active) {
            if (this._resetInterval) {
                clearInterval(this._resetInterval);
                this._resetInterval = null;
                this._resetEnabled = false;
            }
            if (this._keepaliveInterval) {
                clearInterval(this._keepaliveInterval);
                this._keepaliveInterval = null;
            }
            if (this._reconnectInterval) {
                clearInterval(this._reconnectInterval);
                this._reconnectInterval = null;
            }
            if (this._softResetInterval) {
                clearInterval(this._softResetInterval);
                this._softResetInterval = null;
            }
            this._stopKeepaliveTone();
            // Always suspend the context when going idle — prevents Realtek
            // driver degradation that causes silent audio output after ~1-2 min.
            if (this.audioContext && this.audioContext.state === 'running') {
                this.audioContext.suspend().catch(() => {});
            }
        }
    }

    /**
     * Schedule an idle suspend after one-off audio (preview clicks, auditions).
     * Cancels any previous timer. Skipped when _audioActive is true (playback
     * manages its own suspend via setAudioActive). 6 seconds gives any preview
     * note time to ring out before the context goes silent.
     */
    _scheduleIdleSuspend() {
        if (this._idleSuspendTimer) clearTimeout(this._idleSuspendTimer);
        // Don't interfere with active playback/recording
        if (this._audioActive) return;
        this._idleSuspendTimer = setTimeout(() => {
            this._idleSuspendTimer = null;
            // Only suspend if still idle (no playback started in the meantime)
            if (!this._audioActive && this.audioContext && this.audioContext.state === 'running') {
                this.audioContext.suspend().catch(() => {});
            }
            // Also stop the hot-swap interval if it was started by a preview
            if (!this._audioActive && this._resetInterval) {
                clearInterval(this._resetInterval);
                this._resetInterval = null;
                this._resetEnabled = false;
            }
        }, 6000);
    }

    /**
     * Seamless hot-swap: create a fresh AudioContext and rebuild the chain.
     * Old context is kept alive for 2 seconds so in-flight notes ring out
     * naturally — no audible gap or click.
     */
    _hotSwapAudioContext() {
        const oldCtx = this.audioContext;
        const oldMasterGain = this.masterGain;

        // Create fresh context with user settings
        const Ctx = window.AudioContext || window.webkitAudioContext;
        let ctxOptions = { latencyHint: 0.1, sampleRate: 48000 };
        try {
            const raw = localStorage.getItem('wavloom_settings');
            if (raw) {
                const s = JSON.parse(raw);
                if (s.latencyHint) ctxOptions.latencyHint = s.latencyHint;
                if (s.sampleRate && typeof s.sampleRate === 'number') ctxOptions.sampleRate = s.sampleRate;
            }
        } catch (_) { /* use defaults */ }
        const newCtx = new Ctx(ctxOptions);

        // Capture old gain level BEFORE fading so new context starts at the same level
        const savedGain = oldMasterGain.gain.value;

        // Fade old context out over 1.5 seconds while new context starts at full volume.
        // The overlap masks the transition — no audible gap or click.
        try {
            const t = oldCtx.currentTime;
            oldMasterGain.gain.setValueAtTime(savedGain, t);
            oldMasterGain.gain.linearRampToValueAtTime(0, t + 1.5);
        } catch (_) { /* old context may already be closing */ }

        // Build new minimal master chain (with soft limiter)
        // Start at the same gain level the old context was at
        const newMasterGain = newCtx.createGain();
        newMasterGain.gain.value = savedGain;
        const newLimiter = this._createSoftLimiter(newCtx);
        newMasterGain.connect(newLimiter);
        newLimiter.connect(newCtx.destination);

        const newAnalyser = newCtx.createAnalyser();
        newAnalyser.fftSize = 256;
        newAnalyser.smoothingTimeConstant = 0.3;
        newMasterGain.connect(newAnalyser);

        const newPanner = newCtx.createStereoPanner();
        newPanner.pan.value = this.masterPanner.pan.value;

        // Rebuild track buses on new context, preserving gain/pan values
        const oldBusValues = {};
        for (const busId of Object.keys(this.trackBuses || {})) {
            const bus = this.trackBuses[busId];
            if (bus) {
                oldBusValues[busId] = {
                    gain: bus.gainNode.gain.value,
                    pan: bus.pannerNode.pan.value
                };
            }
        }

        // --- Swap references atomically ---
        this.audioContext = newCtx;
        window.sharedAnalysisCtx = newCtx;
        this.masterGain = newMasterGain;
        this.compressor = newMasterGain;
        this._softLimiter = newLimiter;
        this.masterAnalyser = newAnalyser;
        this.masterPanner = newPanner;

        // Rebuild track buses
        for (const busId of Object.keys(this.trackBuses || {})) {
            const vals = oldBusValues[busId] || { gain: 0.3, pan: 0 };
            const g = newCtx.createGain();
            g.gain.value = vals.gain;
            const p = newCtx.createStereoPanner();
            p.pan.value = vals.pan;
            const a = newCtx.createAnalyser();
            a.fftSize = 256;
            g.connect(p);
            p.connect(a);
            a.connect(newMasterGain);
            this.trackBuses[busId] = { gainNode: g, pannerNode: p, analyserNode: a };
        }

        // Rebuild drum channels on the new context, preserving all params.
        // Previously these were cleared, forcing re-init and losing DSP state.
        const oldDrumEntries = [...this.drumChannels.entries()];
        this.drumChannels.clear();
        for (const [drumId, oldChannel] of oldDrumEntries) {
            const newChannel = this.initDrumChannel(drumId);
            if (newChannel && oldChannel?.params) {
                Object.assign(newChannel.params, oldChannel.params);
                // Apply preserved gain
                if (newChannel.preGain && oldChannel.params.volume !== undefined) {
                    newChannel.preGain.gain.value = oldChannel.params.volume;
                }
            }
        }

        // Don't clear activeSources — old voices on old context will naturally
        // expire via onended callbacks. New notes use the new context.
        // The cleanup timer (_startCleanupTimer) handles stale entries.

        // Resume new context immediately at full volume
        newCtx.resume();

        // Restart keepalive tone on new context
        if (this._audioActive) this._startKeepaliveTone();

        // Close old context after fade-out (1.5s) + grace period for release tails.
        setTimeout(() => {
            if (oldCtx.state !== 'closed') {
                oldCtx.close().catch(() => {});
            }
        }, 2000);

        console.log('[SamplerEngine] Seamless audio context hot-swap complete');
    }

    _startCleanupTimer() {
        if (this._cleanupInterval) return;
        this._cleanupInterval = setInterval(() => {
            // Self-stop when nothing to clean — avoids keeping a timer running
            // while idle, which on Realtek drivers contributes to audio thread
            // degradation and blocks hard refresh after extended idle.
            if (this.activeSources.size === 0) {
                clearInterval(this._cleanupInterval);
                this._cleanupInterval = null;
                return;
            }
            const now = this.audioContext.currentTime;
            for (const [key, entry] of this.activeSources) {
                const src = entry.source || entry;
                // playbackState 3 = finished (not supported in all browsers)
                const finished = (typeof src.playbackState === 'number' && src.playbackState === 3);
                // Kill voices older than 30 seconds — generous enough for long chords,
                // sustained 808s, and full-bar notes while still preventing voice pile-up
                const stale = entry.startedAt && (now - entry.startedAt) > 30;
                if (finished || stale) {
                    try { src.stop(); } catch (_) {}
                    try { src.disconnect(); } catch (_) {}
                    try { entry.envelope?.disconnect(); } catch (_) {}
                    try { src.onended = null; } catch (_) {}
                    this.activeSources.delete(key);
                }
            }
        }, 2000);
    }

    /**
     * Unload a specific instrument and free its sample buffers.
     * Also purges any cached reversed buffers for those samples.
     * @param {string} instrumentId
     */
    unloadInstrument(instrumentId) {
        const instrument = this.instruments.get(instrumentId);
        if (!instrument) return;
        // Purge reversed buffer cache entries for this instrument's samples
        for (const [, sampleBuf] of instrument.samples) {
            this._reversedBufferCache.delete(sampleBuf);
        }
        instrument.samples.clear();
        this.instruments.delete(instrumentId);
    }

    /**
     * Clear all instruments
     */
    clearAll() {
        this.stopAll();
        this._reversedBufferCache.clear();
        this.instruments.clear();
        this.drumChannels.clear();
        this.disconnectMobileStreamDest();
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
        }
    }
    /**
     * Full teardown — clear all timers and suspend the AudioContext.
     * Called on page unload to prevent orphaned intervals from blocking
     * the main thread during navigation/refresh.
     */
    /**
     * Start a silent keepalive tone to prevent Realtek driver degradation.
     * Uses a DC offset at -100dB (0.00001 gain) — completely inaudible but
     * keeps the audio rendering pipeline continuously active.
     */
    _startKeepaliveTone() {
        this._stopKeepaliveTone(); // Clean up any existing
        try {
            const ctx = this.audioContext;
            // Use a constant source (DC offset) — lighter than an oscillator
            if (ctx.createConstantSource) {
                this._keepaliveSource = ctx.createConstantSource();
                this._keepaliveSource.offset.value = 1;
            } else {
                // Fallback for older browsers: use oscillator at 1Hz
                this._keepaliveSource = ctx.createOscillator();
                this._keepaliveSource.frequency.value = 1;
            }
            this._keepaliveGain = ctx.createGain();
            this._keepaliveGain.gain.value = 0.00001; // -100dB — completely inaudible
            this._keepaliveSource.connect(this._keepaliveGain);
            this._keepaliveGain.connect(ctx.destination);
            this._keepaliveSource.start();
        } catch (_) { /* context may be closed */ }
    }

    _stopKeepaliveTone() {
        try {
            if (this._keepaliveSource) {
                this._keepaliveSource.stop();
                this._keepaliveSource.disconnect();
            }
        } catch (_) {}
        try {
            if (this._keepaliveGain) this._keepaliveGain.disconnect();
        } catch (_) {}
        this._keepaliveSource = null;
        this._keepaliveGain = null;
    }

    dispose() {
        // Kill ALL intervals and timers immediately
        if (this._cleanupInterval) { clearInterval(this._cleanupInterval); this._cleanupInterval = null; }
        if (this._resetInterval) { clearInterval(this._resetInterval); this._resetInterval = null; this._resetEnabled = false; }
        if (this._keepaliveInterval) { clearInterval(this._keepaliveInterval); this._keepaliveInterval = null; }
        if (this._reconnectInterval) { clearInterval(this._reconnectInterval); this._reconnectInterval = null; }
        if (this._softResetInterval) { clearInterval(this._softResetInterval); this._softResetInterval = null; }
        if (this._idleSuspendTimer) { clearTimeout(this._idleSuspendTimer); this._idleSuspendTimer = null; }
        // Stop keepalive tone (oscillator/source nodes)
        this._stopKeepaliveTone();
        // Stop all active audio sources
        try {
            for (const [, entry] of this.activeSources) {
                try { (entry.source || entry).stop(); } catch (_) {}
                try { (entry.source || entry).disconnect(); } catch (_) {}
            }
            this.activeSources.clear();
        } catch (_) {}
        this._audioActive = false;
        // Close context entirely on unload — suspend isn't aggressive enough
        // for page teardown; lingering audio thread blocks the main thread
        try {
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close().catch(() => {});
            }
        } catch (_) {}
    }
}

export default SamplerEngine;
