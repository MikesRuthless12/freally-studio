/**
 * vst3-output-processor.js — AudioWorklet that outputs VST3 audio data.
 *
 * Receives interleaved stereo Float32Array buffers from the main thread
 * via MessagePort and copies them to the audio output in process().
 *
 * Design:
 * - Main thread fetches VST3 audio via IPC and posts to this worklet
 * - process() runs on the audio rendering thread (~344 Hz for 128-sample blocks)
 * - Double-slot buffering: one slot is being consumed, next one is queued
 * - If no data is available, outputs silence (no glitch — just a gap)
 *
 * REAL-TIME SAFETY:
 * - No allocations in process()
 * - No console.log in process()
 * - All buffers pre-allocated or received via transfer
 */

class VST3OutputProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Double-slot buffer: _current is being consumed, _next is queued
        this._current = null;   // Float32Array (interleaved stereo)
        this._currentOffset = 0; // read position within _current
        this._next = null;       // queued buffer from main thread
        this._alive = true;
        this._bufferCount = 0;   // diagnostic: total buffers received
        this._nonZeroCount = 0;  // diagnostic: buffers with non-zero audio
        this._processCount = 0;  // diagnostic: total process() calls

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'buffer') {
                this._bufferCount++;
                // Check if buffer has non-zero audio data
                const samples = msg.samples;
                if (samples && samples.length > 0) {
                    let hasData = false;
                    for (let i = 0; i < Math.min(samples.length, 100); i++) {
                        if (samples[i] !== 0) { hasData = true; break; }
                    }
                    if (hasData) this._nonZeroCount++;
                }
                // Queue the new buffer. If _current is exhausted, it becomes _current.
                // If _current still has data, overwrite _next (latest wins).
                if (!this._current || this._currentOffset >= this._current.length) {
                    this._current = msg.samples;
                    this._currentOffset = 0;
                } else {
                    this._next = msg.samples;
                }
            } else if (msg.type === 'stop') {
                this._alive = false;
            }
        };
    }

    process(inputs, outputs) {
        if (!this._alive) return false;
        this._processCount++;

        // Report diagnostics every ~2 seconds (688 process calls at ~344Hz)
        if (this._processCount % 688 === 0) {
            this.port.postMessage({
                type: 'diag',
                processCount: this._processCount,
                bufferCount: this._bufferCount,
                nonZeroCount: this._nonZeroCount,
            });
        }

        const output = outputs[0];
        if (!output || output.length < 2) return true;

        const outL = output[0];
        const outR = output[1];
        const frames = outL.length; // typically 128

        // If current buffer is exhausted, swap in the next one
        if ((!this._current || this._currentOffset >= this._current.length) && this._next) {
            this._current = this._next;
            this._next = null;
            this._currentOffset = 0;
        }

        const buf = this._current;
        let offset = this._currentOffset;

        if (buf && (offset + frames * 2) <= buf.length) {
            // Copy interleaved stereo → separate L/R channels
            for (let i = 0; i < frames; i++) {
                outL[i] = buf[offset];
                outR[i] = buf[offset + 1];
                offset += 2;
            }
            this._currentOffset = offset;
        } else if (buf && offset < buf.length) {
            // Partial buffer remaining — copy what we can, silence the rest
            let i = 0;
            while (i < frames && (offset + 1) < buf.length) {
                outL[i] = buf[offset];
                outR[i] = buf[offset + 1];
                offset += 2;
                i++;
            }
            // Zero-fill remainder
            for (; i < frames; i++) {
                outL[i] = 0;
                outR[i] = 0;
            }
            this._currentOffset = offset;
        } else {
            // No data — output silence
            for (let i = 0; i < frames; i++) {
                outL[i] = 0;
                outR[i] = 0;
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('vst3-output-processor', VST3OutputProcessor);
