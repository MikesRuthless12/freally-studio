/**
 * VST3InstrumentNode — Wraps a VST3 instrument plugin.
 *
 * Receives MIDI events (noteOn/noteOff) and generates audio output.
 * The audio output connects to a track bus in the SamplerEngine.
 *
 * Uses scheduled AudioBufferSourceNode instances for audio output.
 * Main thread polls processBlock via IPC and schedules each block
 * as a buffer source for gapless playback.
 */

/**
 * Convert an IPC result into a usable Float32Array of interleaved audio samples.
 * Supports: base64 string (primary), plain Array, Float32Array, ArrayBuffer.
 */
function _toFloat32(outputBuf) {
    if (!outputBuf) return null;
    // Primary path: base64-encoded string from main process
    if (typeof outputBuf === 'string') {
        const binary = atob(outputBuf);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Float32Array(bytes.buffer);
    }
    if (Array.isArray(outputBuf)) return new Float32Array(outputBuf);
    if (outputBuf instanceof Float32Array) return outputBuf;
    if (outputBuf instanceof ArrayBuffer) return new Float32Array(outputBuf);
    if (ArrayBuffer.isView(outputBuf)) {
        const ab = outputBuf.buffer.slice(
            outputBuf.byteOffset,
            outputBuf.byteOffset + outputBuf.byteLength
        );
        return new Float32Array(ab);
    }
    return null;
}

export class VST3InstrumentNode {
    constructor(pluginInfo) {
        this.pluginInfo = pluginInfo;
        this.instanceId = null;
        this.outputNode = null;
        this._loaded = false;
        this._loading = false;
        this._ctx = null;
        this._vst3Params = [];
        this._fetching = false;
        this._blockSize = 1024;
        this._fetchTimer = null;
        this._nextPlayTime = 0; // scheduled time for next buffer source
        this._blocksScheduled = 0; // block counter for audio-clock gating
        this._playStartCtxTime = 0; // audioContext.currentTime at playback start
        this._scheduleImmediate = null; // function to trigger immediate fetch
        this._didDirectTest = false; // one-shot direct-to-destination test
        this._diagPeakDone = false; // one-shot decoded peak diagnostic
    }

    /**
     * Load the VST3 instrument and create audio output nodes.
     * @param {AudioContext} audioContext
     */
    async load(audioContext) {
        if (this._loaded || this._loading) return;
        if (!window.electronAPI?.vst3Host) {
            throw new Error('VST3 host not available');
        }

        this._loading = true;
        this._ctx = audioContext;

        try {
            const result = await window.electronAPI.vst3Host.loadPlugin(
                this.pluginInfo.path,
                this.pluginInfo.uid || ''
            );

            if (result.error) {
                throw new Error(result.error);
            }

            this.instanceId = result.instanceId;

            // Fetch parameter list
            this._vst3Params = await window.electronAPI.vst3Host.getParameterList(this.instanceId);

            // Create output gain node
            this.outputNode = audioContext.createGain();
            this.outputNode.gain.value = 1.0;

            // Initialize schedule time
            this._nextPlayTime = audioContext.currentTime + 0.05; // 50ms lead-in

            // Start continuous fetch loop
            this._loaded = true;
            const BLOCK_SIZE = this._blockSize;
            const self = this;
            let _fetchLogCount = 0;
            let _diagDone = false; // one-shot renderer diagnostic

            // Audio-clock gated fetch loop.
            // processBlock calls are limited to the audio clock rate (~43/s at
            // 44100Hz, 1024 block) via a block counter tied to audioContext.currentTime.
            // This ensures the C++ block-based transport advance stays perfectly
            // in sync with actual audio playback — no drift, no event overlap.
            const sampleRate = audioContext.sampleRate;
            const BLOCK_DURATION = BLOCK_SIZE / sampleRate; // ~23.2ms
            const FETCH_INTERVAL_MS = Math.round(BLOCK_DURATION * 1000);
            const MAX_BLOCKS_AHEAD = 2; // allow 2 blocks (~46ms) of buffer

            const scheduleNext = () => {
                if (!self._loaded) return;
                const ctx = self._ctx;
                if (!ctx) {
                    self._fetchTimer = setTimeout(fetchLoop, FETCH_INTERVAL_MS);
                    return;
                }
                // Compute when the next block is needed based on audio clock
                if (self._playStartCtxTime > 0) {
                    const elapsed = ctx.currentTime - self._playStartCtxTime;
                    const blocksAhead = self._blocksScheduled - Math.floor(elapsed / BLOCK_DURATION);
                    if (blocksAhead >= MAX_BLOCKS_AHEAD) {
                        // Wait until audio clock consumes a block
                        const waitSec = (self._blocksScheduled - MAX_BLOCKS_AHEAD + 1) * BLOCK_DURATION - elapsed;
                        const delay = Math.max(4, Math.min(FETCH_INTERVAL_MS * 2, waitSec * 1000));
                        self._fetchTimer = setTimeout(fetchLoop, delay);
                        return;
                    }
                }
                // Need audio now — fetch ASAP
                self._fetchTimer = setTimeout(fetchLoop, 4);
            };

            const fetchLoop = () => {
                if (!self._loaded || !self.instanceId) { return; }

                const ctx = self._ctx;

                // Block-counter gating: only call processBlock when the audio
                // clock says we need more blocks. This is the PRIMARY rate limiter.
                if (ctx && self._playStartCtxTime > 0) {
                    const elapsed = ctx.currentTime - self._playStartCtxTime;
                    const expectedBlocks = Math.floor(elapsed / BLOCK_DURATION) + MAX_BLOCKS_AHEAD;
                    if (self._blocksScheduled >= expectedBlocks) {
                        scheduleNext();
                        return;
                    }
                }

                if (self._fetching) {
                    self._fetchTimer = setTimeout(fetchLoop, 4);
                    return;
                }

                self._fetching = true;
                window.electronAPI.vst3Host.processBlock(
                    self.instanceId, null, BLOCK_SIZE, 0, 2
                ).then((outputBuf) => {
                    self._fetching = false;

                    // ONE-SHOT DIAGNOSTIC: report what the renderer received
                    if (!_diagDone) {
                        _diagDone = true;
                        const t = typeof outputBuf;
                        const len = outputBuf ? (outputBuf.length || 0) : 0;
                        const ctxState = self._ctx ? self._ctx.state : 'no-ctx';
                        const hasOut = !!self.outputNode;
                        console.log(`[VST3 DIAG-R] type=${t} len=${len} ctxState=${ctxState} hasOutput=${hasOut}`);
                        if (window.electronAPI?.debug?.log) {
                            window.electronAPI.debug.log(`[VST3 DIAG-R] type=${t} len=${len} ctxState=${ctxState} hasOutput=${hasOut}`);
                        }
                    }

                    const floats = _toFloat32(outputBuf);

                    // ONE-SHOT: report decoded peak
                    if (floats && floats.length > 0 && !self._diagPeakDone) {
                        let dp = 0;
                        for (let i = 0; i < Math.min(floats.length, 200); i++) {
                            const v = Math.abs(floats[i]);
                            if (v > dp) dp = v;
                        }
                        if (dp > 0.001) {
                            self._diagPeakDone = true;
                            console.log(`[VST3 DIAG-R] DECODED peak=${dp.toFixed(6)} samples=${floats.length}`);
                            if (window.electronAPI?.debug?.log) {
                                window.electronAPI.debug.log(`[VST3 DIAG-R] DECODED peak=${dp.toFixed(6)} samples=${floats.length}`);
                            }
                        }
                    }

                    if (floats && floats.length > 0 && self.outputNode && self._ctx) {
                        const ctx2 = self._ctx;
                        const frames = floats.length / 2;

                        // Create AudioBuffer and deinterleave
                        const buffer = ctx2.createBuffer(2, frames, ctx2.sampleRate);
                        const L = buffer.getChannelData(0);
                        const R = buffer.getChannelData(1);
                        for (let i = 0; i < frames; i++) {
                            L[i] = floats[i * 2];
                            R[i] = floats[i * 2 + 1];
                        }

                        // Schedule playback via BufferSource → outputNode
                        const source = ctx2.createBufferSource();
                        source.buffer = buffer;
                        source.connect(self.outputNode);

                        const now = ctx2.currentTime;
                        if (self._nextPlayTime < now) {
                            self._nextPlayTime = now + 0.002;
                        }
                        source.start(self._nextPlayTime);
                        self._nextPlayTime += frames / ctx2.sampleRate;
                    }

                    // Track scheduled blocks for audio-clock gating
                    self._blocksScheduled++;
                    _fetchLogCount++;

                    // Schedule next fetch
                    scheduleNext();
                }).catch((err) => {
                    self._fetching = false;
                    if (_fetchLogCount < 5) {
                        console.error('[VST3 fetch] error:', String(err));
                    }
                    _fetchLogCount++;
                    scheduleNext();
                });
            };

            // Expose immediate-trigger for prepareForPlayback
            self._scheduleImmediate = () => {
                if (self._fetchTimer) {
                    clearTimeout(self._fetchTimer);
                    self._fetchTimer = null;
                }
                self._fetchTimer = setTimeout(fetchLoop, 0);
            };

            fetchLoop();

            return result;
        } finally {
            this._loading = false;
        }
    }

    /**
     * Send a MIDI note-on to the instrument.
     */
    async noteOn(channel, note, velocity) {
        if (!this._loaded || !this.instanceId) return;
        await window.electronAPI.vst3Host.noteOn(this.instanceId, channel, note, velocity);
    }

    /**
     * Send a MIDI note-off to the instrument.
     */
    async noteOff(channel, note) {
        if (!this._loaded || !this.instanceId) return;
        await window.electronAPI.vst3Host.noteOff(this.instanceId, channel, note, 0);
    }

    /**
     * Send a MIDI CC message.
     */
    async sendCC(channel, cc, value) {
        if (!this._loaded || !this.instanceId) return;
        await window.electronAPI.vst3Host.sendCC(this.instanceId, channel, cc, value);
    }

    /**
     * Prepare for playback: reset schedule time.
     */
    async prepareForPlayback() {
        if (!this._loaded || !this.instanceId) return;
        if (this._ctx) {
            this._nextPlayTime = this._ctx.currentTime + 0.05;
            // Reset block counter so audio-clock gating starts fresh.
            this._playStartCtxTime = this._ctx.currentTime;
            this._blocksScheduled = 0;
            // Trigger immediate fetch to minimize play-start latency
            if (this._scheduleImmediate) {
                this._scheduleImmediate();
            }
        }
    }

    /**
     * Set a VST3 parameter.
     */
    async setParameter(paramId, value) {
        if (!this._loaded || !this.instanceId) return;
        await window.electronAPI.vst3Host.setParameter(this.instanceId, paramId, value);
    }

    /**
     * Get parameter list.
     */
    getParams() {
        return this._vst3Params;
    }

    /**
     * Connect the instrument output to a destination node.
     * @param {AudioNode} destination — typically a track bus gainNode
     */
    connectTo(destination) {
        if (this.outputNode) {
            this.outputNode.connect(destination);
        }
    }

    /**
     * Disconnect from all destinations.
     */
    disconnect() {
        if (this.outputNode) {
            try { this.outputNode.disconnect(); } catch (_) {}
        }
    }

    /**
     * Save plugin state.
     */
    async saveState() {
        if (!this._loaded || !this.instanceId) return null;
        return await window.electronAPI.vst3Host.getPluginState(this.instanceId);
    }

    /**
     * Load plugin state.
     */
    async loadState(stateData) {
        if (!this._loaded || !this.instanceId) return false;
        return await window.electronAPI.vst3Host.setPluginState(this.instanceId, stateData);
    }

    /**
     * Cleanup.
     */
    dispose() {
        this._loaded = false;
        if (this._fetchTimer) {
            clearTimeout(this._fetchTimer);
            this._fetchTimer = null;
        }
        if (this.outputNode) {
            try { this.outputNode.disconnect(); } catch (_) {}
            this.outputNode = null;
        }
        if (this.instanceId) {
            window.electronAPI?.vst3Host?.unloadPlugin(this.instanceId).catch(() => {});
            this.instanceId = null;
        }
        this._ctx = null;
    }

    /**
     * Serialize for project save.
     */
    serialize() {
        return {
            type: 'VST3Instrument',
            pluginPath: this.pluginInfo?.path,
            pluginUid: this.pluginInfo?.uid,
            pluginName: this.pluginInfo?.name,
        };
    }
}
