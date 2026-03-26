/**
 * CaptureRingReader — AudioWorklet processor that reads audio from a
 * SharedArrayBuffer ring buffer written by the native WASAPI capture thread.
 *
 * The native capture thread (C++) writes interleaved float32 samples into
 * the ring buffer. This worklet reads them in real-time during process(),
 * providing:
 *
 *   1. Live audio output for monitoring through track effects (Arm button)
 *   2. Real-time waveform display during recording
 *   3. VU meter updates (inherently available since audio flows through output)
 *   4. Recording buffer accumulation via batched postMessage (same pattern
 *      as the existing RecordingProcessor)
 *
 * Ring buffer memory layout (must match C++ RingBufferWriter):
 *
 *   State (Int32Array on SharedArrayBuffer, 8 slots):
 *     [0] writePos   — next write offset (native thread updates)
 *     [1] readPos    — next read offset  (this worklet updates)
 *     [2] capacity   — total samples in data buffer
 *     [3] channels   — audio channel count (1=mono, 2=stereo)
 *     [4] sampleRate — capture sample rate
 *     [5] overruns   — overrun count (native thread increments)
 *     [6] capturing  — 1 while active, 0 when stopped
 *     [7] reserved
 *
 *   Data (Float32Array on SharedArrayBuffer, capacity elements):
 *     Circular buffer of interleaved float32 audio samples.
 *
 * Messages (port.onmessage):
 *   - { type: 'attach', stateBuffer: SAB, dataBuffer: SAB }
 *   - { type: 'detach' }
 *   - { type: 'start-recording' }
 *   - { type: 'stop-recording' }
 *
 * Messages posted to main thread:
 *   - { type: 'samples', samples: Float32Array, totalSamples: number }
 *   - { type: 'stopped', totalSamples: number }
 */

/* global currentFrame */
/* eslint-disable no-restricted-globals */

class CaptureRingReader extends AudioWorkletProcessor {
    constructor() {
        super();

        // Ring buffer shared memory
        this._state = null;     // Int32Array on SharedArrayBuffer (8 slots)
        this._data = null;      // Float32Array on SharedArrayBuffer
        this._capacity = 0;     // Cached from state[2]
        this._channels = 1;     // Cached from state[3]

        // Recording: batch samples before posting to reduce GC pressure.
        // Same pattern as recording-processor.js (~12 msgs/sec at 48kHz).
        this._recording = false;
        this._batchSize = 4096;                           // ~85ms at 48kHz
        this._batch = new Float32Array(this._batchSize);
        this._batchOffset = 0;
        this._sampleCount = 0;

        // Gap detection
        this._lastFrame = -1;
        this._gapSamples = 0;
        this._gapCount = 0;

        this.port.onmessage = (e) => {
            switch (e.data.type) {
                case 'attach':
                    this._state = new Int32Array(e.data.stateBuffer);
                    this._data = new Float32Array(e.data.dataBuffer);
                    this._capacity = this._state[2];   // CAPACITY
                    this._channels = this._state[3];   // CHANNELS
                    break;

                case 'detach':
                    this._state = null;
                    this._data = null;
                    this._capacity = 0;
                    break;

                case 'start-recording':
                    this._recording = true;
                    this._sampleCount = 0;
                    this._batchOffset = 0;
                    this._lastFrame = -1;
                    this._gapSamples = 0;
                    this._gapCount = 0;
                    break;

                case 'stop-recording':
                    this._recording = false;
                    // Flush remaining samples in the batch
                    if (this._batchOffset > 0) {
                        const rem = new Float32Array(this._batchOffset);
                        for (let i = 0; i < this._batchOffset; i++) rem[i] = this._batch[i];
                        this.port.postMessage(
                            { type: 'samples', samples: rem, totalSamples: this._sampleCount },
                            [rem.buffer]
                        );
                        this._batchOffset = 0;
                    }
                    // Confirm stop — arrives AFTER all 'samples' messages (FIFO)
                    this.port.postMessage({
                        type: 'stopped',
                        totalSamples: this._sampleCount,
                        gapSamples: this._gapSamples,
                        gapCount: this._gapCount
                    });
                    break;
            }
        };
    }

    /**
     * Flush the batch buffer to the main thread via postMessage.
     * Uses transferable ArrayBuffer for zero-copy.
     */
    _flushBatch() {
        const toSend = new Float32Array(this._batch);
        this.port.postMessage(
            { type: 'samples', samples: toSend, totalSamples: this._sampleCount },
            [toSend.buffer]
        );
        this._batchOffset = 0;
    }

    process(inputs, outputs) {
        const state = this._state;
        const data = this._data;
        const output = outputs[0];

        // Not attached — output silence and keep alive
        if (!state || !data) {
            if (output) {
                for (let c = 0; c < output.length; c++) {
                    if (output[c]) output[c].fill(0);
                }
            }
            return true;
        }

        const cap = this._capacity;
        const ch = this._channels;
        const outLen = (output && output[0]) ? output[0].length : 128;

        // Load positions. writePos uses acquire to see data written by native thread.
        const wp = Atomics.load(state, 0);  // WRITE_POS
        const rp = Atomics.load(state, 1);  // READ_POS

        // Available samples in ring buffer
        const avail = wp >= rp ? (wp - rp) : (cap - rp + wp);
        const framesAvail = (avail / ch) | 0;  // Truncate to whole frames
        const frames = framesAvail < outLen ? framesAvail : outLen;

        if (frames === 0) {
            // No data — output silence
            if (output) {
                for (let c = 0; c < output.length; c++) {
                    if (output[c]) output[c].fill(0);
                }
            }
            return true;
        }

        // Gap detection for diagnostics (same logic as recording-processor.js)
        if (this._recording && this._lastFrame >= 0) {
            const expectedFrame = this._lastFrame + outLen;
            const gap = currentFrame - expectedFrame;
            if (gap > 0) {
                this._gapSamples += gap;
                this._gapCount++;
            }
        }
        if (this._recording) this._lastFrame = currentFrame;

        // Read frames from ring buffer
        const outL = (output && output[0]) ? output[0] : null;
        const outR = (output && output.length > 1 && output[1]) ? output[1] : null;

        for (let f = 0; f < frames; f++) {
            // Base index for this frame in the ring buffer
            let idx = rp + f * ch;
            if (idx >= cap) idx -= cap;

            // Channel 0 (mono / left)
            const s0 = data[idx];
            if (outL) outL[f] = s0;

            // Channel 1 (right) if stereo
            if (ch > 1 && outR) {
                let idx1 = idx + 1;
                if (idx1 >= cap) idx1 -= cap;
                outR[f] = data[idx1];
            }

            // Accumulate channel 0 (mono) into recording batch
            if (this._recording) {
                this._batch[this._batchOffset++] = s0;
                this._sampleCount++;
                if (this._batchOffset >= this._batchSize) {
                    this._flushBatch();
                }
            }
        }

        // Silence remaining output frames (if ring buffer had fewer frames than outLen)
        if (frames < outLen) {
            for (let f = frames; f < outLen; f++) {
                if (outL) outL[f] = 0;
                if (outR) outR[f] = 0;
            }
        }

        // Advance read position with release semantics so writer sees it
        const samplesRead = frames * ch;
        Atomics.store(state, 1, (rp + samplesRead) % cap);  // READ_POS

        return true;
    }
}

registerProcessor('capture-ring-reader', CaptureRingReader);
