/**
 * RecordingProcessor — AudioWorklet processor for glitch-free audio recording.
 * Runs on the dedicated audio thread (not main thread), eliminating
 * the jank/glitches caused by the deprecated ScriptProcessorNode.
 *
 * Batches samples into ~4096-sample chunks before posting to the main thread.
 * This reduces message frequency from ~375/sec to ~12/sec (at 48kHz),
 * dramatically lowering GC pressure and main-thread overhead.
 *
 * Gap detection: Uses `currentFrame` to detect when the audio thread
 * drops process() calls (underruns). Inserts silence for missed blocks
 * to keep the recorded buffer duration synchronized with wall-clock time.
 * Without this, dropped blocks compress audio and cause playback speedup.
 */
class RecordingProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._recording = false;
        this._sampleCount = 0;
        // Batch buffer — accumulate samples before sending to main thread
        this._batchSize = 4096;             // ~85ms at 48kHz
        this._batch = new Float32Array(this._batchSize);
        this._batchOffset = 0;
        // Gap detection — track expected vs actual audio frames
        this._lastFrame = -1;               // Last seen currentFrame value
        this._gapSamples = 0;               // Total silence inserted for gaps
        this._gapCount = 0;                 // Number of gaps detected

        this.port.onmessage = (e) => {
            if (e.data.type === 'start') {
                this._recording = true;
                this._sampleCount = 0;
                this._batchOffset = 0;
                this._lastFrame = -1;
                this._gapSamples = 0;
                this._gapCount = 0;
            } else if (e.data.type === 'stop') {
                this._recording = false;
                // Flush any remaining samples in the batch buffer
                if (this._batchOffset > 0) {
                    const remaining = new Float32Array(this._batchOffset);
                    for (let i = 0; i < this._batchOffset; i++) remaining[i] = this._batch[i];
                    this.port.postMessage({
                        type: 'samples',
                        samples: remaining,
                        totalSamples: this._sampleCount
                    }, [remaining.buffer]);
                    this._batchOffset = 0;
                }
                // Confirm stop — arrives AFTER all 'samples' messages (FIFO)
                this.port.postMessage({
                    type: 'stopped',
                    totalSamples: this._sampleCount,
                    gapSamples: this._gapSamples,
                    gapCount: this._gapCount
                });
            }
        };
    }

    /**
     * Flush the current batch to the main thread via postMessage.
     * Uses transferable ArrayBuffer for zero-copy.
     */
    _flushBatch() {
        const toSend = new Float32Array(this._batch);
        this.port.postMessage({
            type: 'samples',
            samples: toSend,
            totalSamples: this._sampleCount
        }, [toSend.buffer]); // Transfer ownership for zero-copy
        this._batchOffset = 0;
    }

    /**
     * Write audio samples into the batch buffer. Flushes when full.
     */
    _writeAudio(data, srcStart, count) {
        let srcOffset = srcStart;
        const srcEnd = srcStart + count;
        while (srcOffset < srcEnd) {
            const spaceLeft = this._batchSize - this._batchOffset;
            const toCopy = Math.min(spaceLeft, srcEnd - srcOffset);
            for (let i = 0; i < toCopy; i++) {
                this._batch[this._batchOffset + i] = data[srcOffset + i];
            }
            this._batchOffset += toCopy;
            srcOffset += toCopy;
            if (this._batchOffset >= this._batchSize) {
                this._flushBatch();
            }
        }
    }

    /**
     * Write silence (zeros) into the batch buffer for gap compensation.
     * Called when the audio thread drops process() calls.
     */
    _writeSilence(count) {
        let remaining = count;
        while (remaining > 0) {
            const spaceLeft = this._batchSize - this._batchOffset;
            const toWrite = Math.min(spaceLeft, remaining);
            for (let i = 0; i < toWrite; i++) {
                this._batch[this._batchOffset + i] = 0;
            }
            this._batchOffset += toWrite;
            remaining -= toWrite;
            if (this._batchOffset >= this._batchSize) {
                this._flushBatch();
            }
        }
    }

    process(inputs, outputs) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        const inputChannel = input[0];
        if (!inputChannel) return true;

        // Always write silence to output to prevent mic feedback
        const output = outputs[0];
        if (output && output[0]) {
            output[0].fill(0);
        }

        if (this._recording && inputChannel.length > 0) {
            const blockSize = inputChannel.length; // typically 128 (render quantum)

            // Gap detection: check if the audio thread skipped process() calls.
            // `currentFrame` is a read-only property of AudioWorkletGlobalScope
            // that tracks the ever-increasing sample frame count. If it jumps by
            // more than one block size, blocks were dropped (audio thread underrun).
            if (this._lastFrame >= 0) {
                const expectedFrame = this._lastFrame + blockSize;
                const gap = currentFrame - expectedFrame;
                if (gap > 0) {
                    // Audio thread dropped blocks — insert silence to maintain
                    // wall-clock synchronization. Without this, the recording
                    // compresses and plays back too fast.
                    this._gapSamples += gap;
                    this._gapCount++;
                    this._sampleCount += gap;
                    this._writeSilence(gap);
                }
            }
            this._lastFrame = currentFrame;

            // Count real audio samples and write them to the batch
            this._sampleCount += blockSize;
            this._writeAudio(inputChannel, 0, blockSize);
        }

        return true; // Keep processor alive
    }
}

registerProcessor('recording-processor', RecordingProcessor);
