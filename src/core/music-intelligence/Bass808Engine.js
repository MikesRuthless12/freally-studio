/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Bass808Engine — 808 Bass Intelligence Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Generates modern trap/drill 808 basslines that lock to kick patterns and
 * follow chord progressions using rule-based composition:
 *
 *  1. Detect kick positions from drum pattern
 *  2. Place bass notes aligned with kicks
 *  3. Use root notes of current chords
 *  4. Add pitch slides between distant notes
 *  5. Add octave jumps for variation
 *
 * All output uses the standard WavLoom note format:
 *   { time, duration, note, velocity, slide? }
 *
 * Steps per bar: 32  |  Velocity: 0.0–1.0  |  MIDI note: 0–127
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { SCALES, getScaleNotes, getChordNotes, quantizeToScale } from '../../MusicTheory';

// ─── Constants ──────────────────────────────────────────────────────────────

const STEPS_PER_BAR = 32;
const DEFAULT_OCTAVE = 1; // 808s sit low — C1 = MIDI 24
const SLIDE_INTERVAL_THRESHOLD = 4; // semitones — slides trigger above this
const MIN_NOTE_DURATION = 4; // minimum 808 sustain in steps
const DEFAULT_VELOCITY = 0.85;

// ─── Probability tables ─────────────────────────────────────────────────────

/** Probability of placing an 808 on a non-kick step (ghost/fill notes) */
const GHOST_NOTE_PROBABILITY = 0.15;

/** Probability of an octave jump on any given 808 hit */
const OCTAVE_JUMP_PROBABILITY = 0.12;

/** Velocity variance range for humanization */
const VELOCITY_VARIANCE = 0.1;

// ─── Utilities ──────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const coinFlip = (p = 0.5) => Math.random() < p;

/**
 * Extract kick hit positions from a drum pattern.
 * Supports the WavLoom drum pattern format:
 *   drumPattern.kick.lanes.root.pattern  →  boolean[]
 *
 * @param {Object} drumPattern - WavLoom drum pattern object
 * @param {number} totalSteps  - Total steps (bars * 32)
 * @returns {boolean[]} Array where true = kick hit at that step
 */
function extractKickPositions(drumPattern, totalSteps) {
    const kicks = new Array(totalSteps).fill(false);

    if (!drumPattern) return kicks;

    // Find the kick instrument — check common key names
    const kickKey = Object.keys(drumPattern).find(k =>
        k === 'kick' || k === 'Kick' || k.toLowerCase().includes('kick')
    );

    if (!kickKey || !drumPattern[kickKey]?.lanes) return kicks;

    const kickData = drumPattern[kickKey];

    // Merge all kick lanes (root + pitched)
    for (const laneId of Object.keys(kickData.lanes)) {
        const lane = kickData.lanes[laneId];
        if (!lane?.pattern) continue;
        for (let i = 0; i < Math.min(lane.pattern.length, totalSteps); i++) {
            if (lane.pattern[i]) kicks[i] = true;
        }
    }

    return kicks;
}

/**
 * Build a chord-root lookup: for each step, return the MIDI root note
 * of the chord active at that step.
 *
 * @param {Array} chordProgression - Array of Roman numeral strings (e.g. ['I', 'vi', 'IV', 'V'])
 * @param {string} key   - Root key (e.g. 'C')
 * @param {string} scale - Scale name (e.g. 'Minor')
 * @param {number} bars  - Number of bars
 * @param {number} octave - Bass octave
 * @returns {number[]} MIDI note per step (length = bars * 32)
 */
function buildChordRootMap(chordProgression, key, scale, bars, octave) {
    const totalSteps = bars * STEPS_PER_BAR;
    const roots = new Array(totalSteps).fill(null);

    if (!chordProgression || chordProgression.length === 0) {
        // Fallback: use scale root for every step
        const scaleNotes = getScaleNotes(key, scale);
        const rootPC = scaleNotes[0]; // pitch class 0-11
        const rootMidi = (octave + 1) * 12 + rootPC;
        return new Array(totalSteps).fill(rootMidi);
    }

    const stepsPerChord = Math.floor(totalSteps / chordProgression.length);

    chordProgression.forEach((roman, idx) => {
        const chordNotes = getChordNotes(roman, key, scale, octave);
        const root = chordNotes.length > 0 ? chordNotes[0] : ((octave + 1) * 12);
        const start = idx * stepsPerChord;
        const end = Math.min(start + stepsPerChord, totalSteps);
        for (let s = start; s < end; s++) {
            roots[s] = root;
        }
    });

    // Fill any remaining steps with last chord root
    const lastRoot = roots.find(r => r !== null) ?? ((octave + 1) * 12);
    for (let i = 0; i < totalSteps; i++) {
        if (roots[i] === null) roots[i] = lastRoot;
    }

    return roots;
}

/**
 * Calculate 808 note duration: sustain until the next 808 hit or end of pattern.
 *
 * @param {number} startStep  - Current note start
 * @param {boolean[]} occupied - Steps that already have 808 hits
 * @param {number} totalSteps - Total pattern length
 * @returns {number} Duration in steps
 */
function calcDuration(startStep, occupied, totalSteps) {
    let dur = MIN_NOTE_DURATION;
    for (let s = startStep + MIN_NOTE_DURATION; s < totalSteps; s++) {
        if (occupied[s]) break;
        dur++;
    }
    return clamp(dur, MIN_NOTE_DURATION, totalSteps - startStep);
}

// ─── Main Generator ─────────────────────────────────────────────────────────

/**
 * Generate a trap/drill-style 808 bassline.
 *
 * @param {Object} options
 * @param {Object}  options.drumPattern       - WavLoom drum pattern object
 * @param {Array}   options.chordProgression  - Array of Roman numeral strings
 * @param {string}  options.key               - Musical key (e.g. 'C')
 * @param {string}  options.scale             - Scale name (e.g. 'Minor')
 * @param {number}  [options.bars=4]          - Number of bars
 * @param {number}  [options.octave=1]        - Bass octave (808s sit at octave 1-2)
 * @param {boolean} [options.enableSlides=true]      - Add pitch slides between distant notes
 * @param {boolean} [options.enableOctaveJumps=true]  - Add octave jump variations
 * @param {number}  [options.density=0.5]     - Note density 0.0–1.0 (controls ghost notes)
 *
 * @returns {Array<{time: number, duration: number, note: number, velocity: number, slide?: boolean}>}
 */
export function generate808Bassline({
    drumPattern,
    chordProgression,
    key = 'C',
    scale = 'Minor',
    bars = 4,
    octave = DEFAULT_OCTAVE,
    enableSlides = true,
    enableOctaveJumps = true,
    density = 0.5,
} = {}) {
    const totalSteps = bars * STEPS_PER_BAR;
    const kickPositions = extractKickPositions(drumPattern, totalSteps);
    const chordRoots = buildChordRootMap(chordProgression, key, scale, bars, octave);

    // Phase 1: Mark all 808 hit positions (kick-aligned + ghost notes)
    const hitSteps = [];
    for (let step = 0; step < totalSteps; step++) {
        if (kickPositions[step]) {
            hitSteps.push(step);
        } else if (coinFlip(GHOST_NOTE_PROBABILITY * density)) {
            // Ghost/fill notes on non-kick steps — weighted by density
            hitSteps.push(step);
        }
    }

    // If no kicks detected, create a basic rhythm from chord changes
    if (hitSteps.length === 0) {
        const stepsPerChord = chordProgression?.length
            ? Math.floor(totalSteps / chordProgression.length)
            : STEPS_PER_BAR;
        for (let step = 0; step < totalSteps; step += stepsPerChord) {
            hitSteps.push(step);
            // Add a hit mid-chord for movement
            const mid = step + Math.floor(stepsPerChord / 2);
            if (mid < totalSteps) hitSteps.push(mid);
        }
    }

    // Sort, deduplicate, and drop hits too close to the end to hold a
    // minimum-length 808 — keeps every note within bounds while still honoring
    // MIN_NOTE_DURATION (a hit in the final steps can satisfy neither otherwise).
    const lastViableStep = totalSteps - MIN_NOTE_DURATION;
    const uniqueHits = [...new Set(hitSteps)]
        .filter(s => s <= lastViableStep)
        .sort((a, b) => a - b);

    // Occupied map for duration calculation
    const occupied = new Array(totalSteps).fill(false);
    for (const s of uniqueHits) occupied[s] = true;

    // Phase 2: Assign pitches and build note objects
    const notes = [];
    let prevNote = null;

    for (let i = 0; i < uniqueHits.length; i++) {
        const step = uniqueHits[i];
        let pitch = chordRoots[step];

        // Octave jump variation
        if (enableOctaveJumps && coinFlip(OCTAVE_JUMP_PROBABILITY)) {
            // Jump up one octave for emphasis
            pitch += 12;
        }

        // Quantize to scale to keep things musical
        pitch = quantizeToScale(pitch, key, scale);

        // Clamp to valid 808 range (MIDI 24–48, C1–C3)
        pitch = clamp(pitch, 24, 48);

        const duration = calcDuration(step, occupied, totalSteps);

        // Velocity humanization
        const baseVel = kickPositions[step] ? DEFAULT_VELOCITY : DEFAULT_VELOCITY * 0.75;
        const velocity = clamp(
            baseVel + (Math.random() * VELOCITY_VARIANCE * 2 - VELOCITY_VARIANCE),
            0.3, 1.0
        );

        // Slide detection: mark slide if interval to previous note is large
        let slide = false;
        if (enableSlides && prevNote !== null) {
            const interval = Math.abs(pitch - prevNote);
            if (interval >= SLIDE_INTERVAL_THRESHOLD) {
                slide = true;
            }
        }

        notes.push({
            time: step,
            duration,
            note: pitch,
            velocity: Math.round(velocity * 100) / 100,
            ...(slide ? { slide: true } : {}),
        });

        prevNote = pitch;
    }

    return notes;
}

// ─── Export API ──────────────────────────────────────────────────────────────

export default {
    generate808Bassline,
};
