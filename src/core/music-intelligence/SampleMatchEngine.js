/**
 * SampleMatchEngine — Detects pitch of audio samples and tunes them to
 * match the project key using WebAudio FFT analysis.
 *
 * Uses autocorrelation on time-domain data for robust fundamental-frequency
 * detection (handles harmonics better than raw FFT peak-picking).
 *
 * Pitch shifting is accomplished via WebAudio's native playbackRate on
 * AudioBufferSourceNode — no custom DSP required.  The engine adjusts the
 * rootNote stored in SamplerEngine's instrument map so the existing
 * playbackRate logic handles tuning transparently.
 *
 * Public API:
 *   detectSamplePitch(audioBuffer, audioContext)
 *       → { frequency, midiNote, noteName, octave, centsOff }
 *
 *   tuneSampleToKey(audioBuffer, projectKey, audioContext)
 *       → { detectedPitch, semitoneShift, adjustedRootNote }
 *
 *   applyAutoTune(samplerEngine, instrumentId, projectKey)
 *       → adjusts stored rootNote in-place; returns shift info
 *
 *   getPlaybackRateForShift(semitones)
 *       → number  (e.g. 1.0595 for +1 semitone)
 */

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NOTE_NAME_TO_INDEX = {};
NOTE_NAMES.forEach((n, i) => { NOTE_NAME_TO_INDEX[n] = i; });
// Enharmonic aliases
NOTE_NAME_TO_INDEX['Db'] = 1;
NOTE_NAME_TO_INDEX['Eb'] = 3;
NOTE_NAME_TO_INDEX['Gb'] = 6;
NOTE_NAME_TO_INDEX['Ab'] = 8;
NOTE_NAME_TO_INDEX['Bb'] = 10;

/** A4 = 440 Hz standard tuning */
const A4_FREQ = 440;
const A4_MIDI = 69;

/** Minimum / maximum detectable frequencies (roughly C1 – C8) */
const MIN_FREQ = 32;
const MAX_FREQ = 4200;

/** FFT size for analysis — 8192 gives ~5.4 Hz resolution at 44100 Hz */
const FFT_SIZE = 8192;

/** Duration of audio to analyse (seconds). Longer ≠ better — many
 *  samples have transient attacks that confuse pitch detection.
 *  We skip the first 50ms (attack) and analyse the next 200ms. */
const SKIP_SECONDS = 0.05;
const ANALYSE_SECONDS = 0.2;

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/** Convert frequency to MIDI note number (fractional). */
function freqToMidi(freq) {
    return A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
}

/** Convert MIDI note to frequency. */
function midiToFreq(midi) {
    return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Round a fractional MIDI note and split into note name + octave. */
function midiToNameOctave(midi) {
    const rounded = Math.round(midi);
    const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
    const octave = Math.floor(rounded / 12) - 1;
    return { name, octave, rounded };
}

/**
 * Autocorrelation-based pitch detection (YIN-lite).
 *
 * Operates on a mono Float32Array of samples.  Returns the detected
 * fundamental frequency in Hz, or null if the signal is too quiet or
 * aperiodic to determine.
 *
 * @param {Float32Array} data   — mono PCM samples
 * @param {number}       sr     — sample rate
 * @returns {number|null} frequency in Hz
 */
function detectFundamental(data, sr) {
    const len = data.length;

    // --- 1. Check if signal is loud enough ---------------------------
    let rms = 0;
    for (let i = 0; i < len; i++) rms += data[i] * data[i];
    rms = Math.sqrt(rms / len);
    if (rms < 0.005) return null; // too quiet

    // --- 2. Normalised-square-difference (YIN step 2) ----------------
    const maxLag = Math.min(Math.floor(sr / MIN_FREQ), len >> 1);
    const minLag = Math.max(2, Math.floor(sr / MAX_FREQ));

    const nsdf = new Float32Array(maxLag);
    for (let tau = minLag; tau < maxLag; tau++) {
        let num = 0;
        let denA = 0;
        let denB = 0;
        const end = len - tau;
        for (let i = 0; i < end; i++) {
            num += data[i] * data[i + tau];
            denA += data[i] * data[i];
            denB += data[i + tau] * data[i + tau];
        }
        const den = Math.sqrt(denA * denB);
        nsdf[tau] = den > 0 ? num / den : 0;
    }

    // --- 3. Pick first peak above threshold --------------------------
    const THRESHOLD = 0.5;
    let bestLag = -1;
    let bestVal = -1;
    let rising = false;

    for (let tau = minLag; tau < maxLag - 1; tau++) {
        if (nsdf[tau] > nsdf[tau - 1]) {
            rising = true;
        }
        if (rising && nsdf[tau] < nsdf[tau - 1]) {
            // We just passed a local peak at tau-1
            if (nsdf[tau - 1] > THRESHOLD && nsdf[tau - 1] > bestVal) {
                bestLag = tau - 1;
                bestVal = nsdf[tau - 1];
                break; // take the first strong peak (fundamental, not harmonic)
            }
            rising = false;
        }
    }

    if (bestLag < minLag) {
        // Fallback: highest peak overall
        for (let tau = minLag; tau < maxLag; tau++) {
            if (nsdf[tau] > bestVal) {
                bestVal = nsdf[tau];
                bestLag = tau;
            }
        }
        if (bestVal < THRESHOLD) return null;
    }

    // --- 4. Parabolic interpolation around peak ----------------------
    const a = nsdf[bestLag - 1] || 0;
    const b = nsdf[bestLag];
    const c = nsdf[bestLag + 1] || 0;
    const delta = (a - c) / (2 * (a - 2 * b + c) || 1);
    const refinedLag = bestLag + delta;

    return sr / refinedLag;
}

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Detect the pitch of an AudioBuffer.
 *
 * Analyses a short window after the attack transient and returns
 * pitch information.  Works best with tonal / pitched samples
 * (synths, pianos, basses, vocals).  Percussive or noisy samples
 * may return null.
 *
 * @param {AudioBuffer} audioBuffer  — decoded audio
 * @param {AudioContext} audioContext — (unused currently; kept for future OfflineAudioContext path)
 * @returns {{ frequency: number, midiNote: number, noteName: string, octave: number, centsOff: number } | null}
 */
export function detectSamplePitch(audioBuffer, audioContext) {
    if (!audioBuffer || audioBuffer.length === 0) return null;

    const sr = audioBuffer.sampleRate;

    // Mix down to mono
    const ch0 = audioBuffer.getChannelData(0);
    let mono;
    if (audioBuffer.numberOfChannels > 1) {
        const ch1 = audioBuffer.getChannelData(1);
        mono = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
            mono[i] = (ch0[i] + ch1[i]) * 0.5;
        }
    } else {
        mono = ch0;
    }

    // Extract analysis window (skip attack, take a stable region)
    const skipSamples = Math.min(Math.floor(SKIP_SECONDS * sr), mono.length >> 1);
    const windowSamples = Math.min(
        Math.floor(ANALYSE_SECONDS * sr),
        mono.length - skipSamples
    );
    if (windowSamples < FFT_SIZE / 2) {
        // Sample too short — use entire buffer
        return detectFromRegion(mono, sr);
    }

    const region = mono.subarray(skipSamples, skipSamples + windowSamples);
    return detectFromRegion(region, sr);
}

/** Internal: run detection on a Float32Array region. */
function detectFromRegion(data, sr) {
    const freq = detectFundamental(data, sr);
    if (!freq || freq < MIN_FREQ || freq > MAX_FREQ) return null;

    const midiFloat = freqToMidi(freq);
    const midiRounded = Math.round(midiFloat);
    const centsOff = Math.round((midiFloat - midiRounded) * 100);
    const { name, octave } = midiToNameOctave(midiFloat);

    return {
        frequency: Math.round(freq * 100) / 100,
        midiNote: midiRounded,
        noteName: name,
        octave,
        centsOff
    };
}

/**
 * Calculate how many semitones to shift a sample so its root note
 * aligns with the nearest instance of the project key.
 *
 * @param {AudioBuffer} audioBuffer — decoded audio
 * @param {string}      projectKey  — key name, e.g. "C", "F#", "Bb"
 * @param {AudioContext} audioContext
 * @returns {{ detectedPitch: object, semitoneShift: number, adjustedRootNote: number } | null}
 */
export function tuneSampleToKey(audioBuffer, projectKey, audioContext) {
    const pitch = detectSamplePitch(audioBuffer, audioContext);
    if (!pitch) return null;

    const keyIndex = NOTE_NAME_TO_INDEX[projectKey];
    if (keyIndex === undefined) return null;

    const samplePitchClass = ((pitch.midiNote % 12) + 12) % 12;

    // Signed distance in semitones from sample pitch class to project key,
    // choosing the nearest direction (max ±6 semitones).
    let diff = keyIndex - samplePitchClass;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;

    return {
        detectedPitch: pitch,
        semitoneShift: diff,
        adjustedRootNote: pitch.midiNote - diff
        // adjustedRootNote: if stored as the instrument's rootNote,
        // the sampler's playbackRate = 2^((targetNote - adjustedRootNote)/12)
        // will produce the desired shift automatically.
    };
}

/**
 * Apply auto-tune to an already-loaded instrument in SamplerEngine.
 *
 * Adjusts the instrument's rootNote so the sampler's existing
 * playbackRate pitch-shift logic tunes the sample to the project key.
 *
 * @param {object} samplerEngine — SamplerEngine instance
 * @param {string} instrumentId  — instrument to tune
 * @param {string} projectKey    — target key name
 * @returns {{ detectedPitch: object, semitoneShift: number } | null}
 */
export function applyAutoTune(samplerEngine, instrumentId, projectKey) {
    const instrument = samplerEngine.instruments.get(instrumentId);
    if (!instrument) return null;

    // Get the first (or only) sample buffer
    const firstEntry = instrument.samples.entries().next().value;
    if (!firstEntry) return null;

    const [originalNote, buffer] = firstEntry;
    const result = tuneSampleToKey(buffer, projectKey, samplerEngine.audioContext);
    if (!result || result.semitoneShift === 0) return result;

    // Adjust all sample note mappings by the semitone shift.
    // This makes the sampler's playbackRate logic pitch-shift every
    // sample toward the project key.
    const newSamples = new Map();
    const newNames = new Map();
    for (const [note, buf] of instrument.samples.entries()) {
        const shifted = note - result.semitoneShift;
        newSamples.set(shifted, buf);
        if (instrument.sampleNames.has(note)) {
            newNames.set(shifted, instrument.sampleNames.get(note));
        }
    }
    instrument.samples = newSamples;
    instrument.sampleNames = newNames;
    instrument.rootNote = instrument.rootNote - result.semitoneShift;
    instrument._autoTuned = true;
    instrument._autoTuneShift = result.semitoneShift;

    console.log(
        `[SampleMatchEngine] Auto-tuned "${instrument.name}" ` +
        `(detected ${result.detectedPitch.noteName}${result.detectedPitch.octave}, ` +
        `shifted ${result.semitoneShift > 0 ? '+' : ''}${result.semitoneShift} st → ${projectKey})`
    );

    return {
        detectedPitch: result.detectedPitch,
        semitoneShift: result.semitoneShift
    };
}

/**
 * Convenience: get the playbackRate multiplier for a given semitone shift.
 * Useful for one-off pitch adjustments outside the sampler.
 *
 * @param {number} semitones — positive = up, negative = down
 * @returns {number}
 */
export function getPlaybackRateForShift(semitones) {
    return Math.pow(2, semitones / 12);
}

export default {
    detectSamplePitch,
    tuneSampleToKey,
    applyAutoTune,
    getPlaybackRateForShift
};
