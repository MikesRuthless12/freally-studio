import { AudioEffect } from './AudioEffect.js';

/**
 * Tuner — Pitch detection analysis tool (pass-through, no audio modification).
 *
 * Signal chain:
 *   input -> analyser -> _wetGain (audio passes through unmodified)
 *
 * The analyser provides time-domain data for the UI to perform pitch detection
 * using the YIN algorithm (autocorrelation-based).
 *
 * Exposed methods:
 *   getDetectedPitch() — reads analyser data and runs YIN, returns
 *                         { frequency, note, cents, confidence }
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class Tuner extends AudioEffect {
    constructor() {
        super('Tuner', {});
        this._analyser = null;
        this._dataBuffer = null;
    }

    _buildGraph(ctx) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0;
        this._registerNode(analyser);
        this._analyser = analyser;

        // Pre-allocate the float buffer for time-domain data
        this._dataBuffer = new Float32Array(analyser.fftSize);

        // Pass-through: input → analyser → _wetGain
        // The analyser is transparent — it does not modify audio.
        this.input.connect(analyser);
        analyser.connect(this._wetGain);
    }

    _applyParam(_key, _value) {
        // No configurable params — analysis only
    }

    /**
     * Read the analyser and run YIN pitch detection.
     * @returns {{ frequency: number, note: string, octave: number, cents: number, confidence: number } | null}
     *          Returns null if no pitch is detected or confidence is too low.
     */
    getDetectedPitch() {
        if (!this._analyser || !this._dataBuffer) return null;

        this._analyser.getFloatTimeDomainData(this._dataBuffer);

        // Check if there's any meaningful signal (avoid processing silence)
        let rms = 0;
        for (let i = 0; i < this._dataBuffer.length; i++) {
            rms += this._dataBuffer[i] * this._dataBuffer[i];
        }
        rms = Math.sqrt(rms / this._dataBuffer.length);
        if (rms < 0.005) return null; // Signal too quiet

        const sampleRate = this._ctx.sampleRate;
        const result = this._yinDetect(this._dataBuffer, sampleRate);

        if (!result) return null;

        return result;
    }

    /**
     * YIN pitch detection algorithm (simplified).
     *
     * Steps:
     * 1. Compute difference function: d(tau) = sum((x[i] - x[i+tau])^2)
     * 2. Compute cumulative mean normalized difference (CMND)
     * 3. Find first dip below threshold
     * 4. Parabolic interpolation around the dip
     * 5. Convert lag (tau) to frequency
     *
     * @param {Float32Array} buffer — time-domain audio samples
     * @param {number} sampleRate — audio context sample rate
     * @returns {{ frequency: number, note: string, octave: number, cents: number, confidence: number } | null}
     */
    _yinDetect(buffer, sampleRate) {
        const threshold = 0.1;
        const halfLen = Math.floor(buffer.length / 2);

        // Step 1 & 2: Compute difference function and CMND in one pass
        const yinBuffer = new Float32Array(halfLen);
        yinBuffer[0] = 1.0; // CMND at tau=0 is defined as 1

        let runningSum = 0;

        for (let tau = 1; tau < halfLen; tau++) {
            // Difference function
            let diff = 0;
            for (let i = 0; i < halfLen; i++) {
                const delta = buffer[i] - buffer[i + tau];
                diff += delta * delta;
            }

            runningSum += diff;

            // Cumulative mean normalized difference
            yinBuffer[tau] = diff * tau / runningSum;
        }

        // Step 3: Find first tau where CMND dips below threshold
        let tauEstimate = -1;

        for (let tau = 2; tau < halfLen; tau++) {
            if (yinBuffer[tau] < threshold) {
                // Walk to the local minimum
                while (tau + 1 < halfLen && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        if (tauEstimate === -1) return null; // No pitch detected

        // Step 4: Parabolic interpolation for sub-sample accuracy
        let betterTau = tauEstimate;
        if (tauEstimate > 0 && tauEstimate < halfLen - 1) {
            const s0 = yinBuffer[tauEstimate - 1];
            const s1 = yinBuffer[tauEstimate];
            const s2 = yinBuffer[tauEstimate + 1];
            const denom = 2 * s1 - s2 - s0;
            if (denom !== 0) {
                betterTau = tauEstimate + (s0 - s2) / (2 * denom);
            }
        }

        // Confidence is inverse of the CMND value at the detected tau
        const confidence = 1 - yinBuffer[tauEstimate];

        if (confidence < 0.5) return null; // Too low confidence

        // Step 5: Convert tau to frequency
        const frequency = sampleRate / betterTau;

        // Sanity check: audible range
        if (frequency < 20 || frequency > 20000) return null;

        // Map frequency to nearest MIDI note
        const noteNum = 12 * Math.log2(frequency / 440) + 69;
        const roundedNote = Math.round(noteNum);
        const cents = Math.round(100 * (noteNum - roundedNote));
        const octave = Math.floor(roundedNote / 12) - 1;
        const noteName = NOTE_NAMES[((roundedNote % 12) + 12) % 12];

        return {
            frequency: Math.round(frequency * 100) / 100,
            note: noteName,
            octave,
            cents,
            confidence: Math.round(confidence * 1000) / 1000
        };
    }
}

AudioEffect.register('Tuner', Tuner);
