/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WavLoom Professional Pattern Generation Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Four integrated generators for Drums, Chords, Melodies, and Basslines that
 * produce professional-quality MIDI patterns using techniques drawn from
 * industry-standard tools (Orb Producer, Playbeat, Magenta Studio, Drum Monkey,
 * Captain Chords, MIDI Agent, Scaler, etc.)
 *
 * Core Techniques Implemented:
 * ─────────────────────────────────────────────────────────────────────────────
 *  DRUMS:    Euclidean rhythm distribution · genre skeleton + refinement ·
 *            humanized velocity curves · ghost notes · accent patterns ·
 *            fill probability gates · micro-timing swing
 *
 *  CHORDS:   Voice-led progressions · close/open/drop-2/spread voicings ·
 *            smooth inversions (min semitone movement) · rhythmic styles
 *            (pad/stab/arpeggio/pulse/strum) · tension/release dynamics
 *
 *  MELODIES: Weighted interval Markov chains · motif-and-vary development ·
 *            chord-tone targeting on strong beats · contour shapes
 *            (arch/valley/ascending/descending/wave) · approach notes ·
 *            genre-specific density & register · call-and-response phrasing
 *
 *  BASS:     Root-fifth-octave framework · genre styles (808/walking/pumping/
 *            slap/tumbao/drone/reese) · chord-following · kick synchronization ·
 *            chromatic approach notes · slide/glide markers
 *
 * All generators accept: { key, scale, genre, mood, bars, complexity, tempo }
 * All generators output: Array<{ time, duration, note, velocity }>
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
    NOTE_NAMES, getKeyIndex,
    SCALES_CATALOG, SCALES,
    CHORD_TYPES, ROMAN_TO_CHORD, CHORD_PROGRESSIONS,
    MOOD_MODIFIERS, composeMood,
    GENRE_DEFINITIONS
} from './domain/index';
import { tracker } from './RecentlyUsedTracker';
import {
    CONTOURS_EXPANSION, MELODY_PROFILES_EXPANSION,
    BASS_STYLES_EXPANSION, mergePatternEngineExpansion
} from './patternEngineExpansion';

// ─── Shared Utilities ────────────────────────────────────────────────────────

const pick = (arr, categoryKey) => {
    if (categoryKey) return tracker.pick(categoryKey, arr);
    return arr[Math.floor(Math.random() * arr.length)];
};
const randRange = (lo, hi) => lo + Math.random() * (hi - lo);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const coinFlip = (p = 0.5) => Math.random() < p;
const weighted = choices => {
    const total = choices.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [val, w] of choices) { r -= w; if (r <= 0) return val; }
    return choices[choices.length - 1][0];
};

/** Resolve root MIDI note from key name + octave */
const rootMidi = (key, octave = 3) => {
    const idx = getKeyIndex(key || 'C');
    return (octave + 1) * 12 + idx;
};

/** Get scale intervals, defaulting to Minor */
const scaleIntervals = (scaleName) => {
    if (SCALES_CATALOG[scaleName]) return SCALES_CATALOG[scaleName].intervals;
    if (SCALES[scaleName]) return SCALES[scaleName];
    return [0, 2, 3, 5, 7, 8, 10]; // Minor fallback
};

/** Map a scale degree (0-based) to a chromatic offset */
const degreeToSemitone = (degree, scale) => {
    const octaveShift = Math.floor(degree / scale.length);
    const idx = ((degree % scale.length) + scale.length) % scale.length;
    return scale[idx] + octaveShift * 12;
};

/** Snap a chromatic offset to the nearest scale tone */
const snapToScale = (semitone, scale) => {
    const octave = Math.floor(semitone / 12) * 12;
    const pc = ((semitone % 12) + 12) % 12;
    let best = scale[0], bestDist = 99;
    for (const s of scale) {
        const d = Math.abs(pc - s);
        const dWrap = Math.min(d, 12 - d);
        if (dWrap < bestDist) { bestDist = dWrap; best = s; }
    }
    return octave + best;
};

/** Genre data lookup with fallback */
const genreData = (genre) => GENRE_DEFINITIONS[genre] || GENRE_DEFINITIONS['Hip Hop'];

/** Mood modifier lookup with fallback */
const moodData = (mood) => MOOD_MODIFIERS[mood] || {
    scalePreference: ['Minor'], tempoMultiplier: 1.0,
    chordComplexity: 'simple', registerShift: 0, rhythmDensity: 0.7
};

// ═══════════════════════════════════════════════════════════════════════════════
// §1  EUCLIDEAN RHYTHM ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
// Implements the Bresenham-line approach from Toussaint/Bjorklund.
// E(k, n) distributes k onsets across n steps as evenly as possible.
// Used by drum, chord-arpeggio, and hi-hat generators.

/**
 * Generate a Euclidean rhythm pattern.
 * @param {number} pulses  Number of onsets (hits)
 * @param {number} steps   Total number of steps
 * @param {number} rotation Offset rotation (default 0)
 * @returns {boolean[]} Array of length `steps` with true = hit
 */
export function euclidean(pulses, steps, rotation = 0) {
    const pattern = new Array(steps).fill(false);
    if (pulses <= 0 || steps <= 0) return pattern;
    const k = Math.min(pulses, steps);
    for (let i = 0; i < steps; i++) {
        // Bresenham: beat at i if floor(k*i/n) != floor(k*(i-1)/n)
        if (Math.floor((k * i) / steps) !== Math.floor((k * (i - 1)) / steps)) {
            pattern[i] = true;
        }
    }
    // Rotate
    if (rotation !== 0) {
        const r = ((rotation % steps) + steps) % steps;
        const rotated = [...pattern.slice(r), ...pattern.slice(0, r)];
        return rotated;
    }
    return pattern;
}


// ═══════════════════════════════════════════════════════════════════════════════
// §2  HUMANIZATION LAYER
// ═══════════════════════════════════════════════════════════════════════════════
// Adds professional-feeling velocity curves, ghost notes, and accents.

/**
 * Apply humanized velocity to a note list.
 * Uses a downbeat-accent model: beat 1 strongest, beats 2&4 medium, offbeats softer.
 * @param {Array} notes - Pattern notes with .time property
 * @param {Object} opts - { accentStrength, ghostChance, swingAmount }
 */
function humanizeVelocity(notes, opts = {}) {
    const {
        accentStrength = 0.15,    // 0–0.3 range
        ghostLevel = 0.6,         // velocity multiplier for ghost notes
        grooveCurve = 'standard'  // 'standard' | 'swung' | 'pushed'
    } = opts;

    for (const n of notes) {
        const posInBar = n.time % 32;
        const posInBeat = posInBar % 8;
        let base = n.velocity;

        // Downbeat accent (beat 1)
        if (posInBar === 0) {
            base = Math.min(1.0, base + accentStrength);
        }
        // Backbeat accent (beats 2 & 4)
        else if (posInBar === 8 || posInBar === 24) {
            base = Math.min(1.0, base + accentStrength * 0.6);
        }
        // Offbeat 16ths are ghost notes
        else if (posInBeat % 4 !== 0) {
            base *= ghostLevel;
        }

        // Add human micro-variation ±5%
        base *= 0.95 + Math.random() * 0.1;
        n.velocity = clamp(base, 0.15, 1.0);
    }
    return notes;
}


// ═══════════════════════════════════════════════════════════════════════════════
// §2b  USER-FACING HUMANIZATION & VARIATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_HUMANIZE = { swing: 30, velocityVariation: 20, timingJitter: 10, ghostNotes: 15 };

/**
 * Apply humanization (swing, velocity variation, timing jitter, ghost notes)
 * to an existing pattern WITHOUT regenerating.  Returns a new array — never
 * mutates the input.
 *
 * @param {Array} pattern   Note objects [{time, duration, note, velocity}, …]
 *                          OR for drums, the drumStates object.
 * @param {Object} params   { swing:0-100, velocityVariation:0-100, timingJitter:0-100, ghostNotes:0-100 }
 * @param {string} type     'melodic' | 'drums'
 * @returns {Array|Object}  Humanized copy
 */
export function humanizePattern(pattern, params = {}, type = 'melodic') {
    const p = { ...DEFAULT_HUMANIZE, ...params };

    if (type === 'drums') {
        return humanizeDrumPattern(pattern, p);
    }

    // --- Melodic (chords / melody / bass) ---
    if (!Array.isArray(pattern) || pattern.length === 0) return pattern;

    const out = pattern.map(n => ({ ...n })); // deep clone

    // Swing — nudge off-beat steps forward (MPC-style swing feel)
    if (p.swing > 0) {
        const swingOffset = (p.swing / 100) * 3.0; // max 3 steps (~swing 75% in DAW terms)
        for (const n of out) {
            const stepInBeat = Math.round(n.time) % 8;
            if (stepInBeat === 2 || stepInBeat === 6) {
                n.time += swingOffset;
            } else if (stepInBeat === 4) {
                n.time += swingOffset * 0.5; // lighter swing on the "&"
            }
        }
    }

    // Velocity Variation — random deviation (wider range for real feel)
    if (p.velocityVariation > 0) {
        const strength = (p.velocityVariation / 100) * 0.5; // max ±50% of velocity range
        for (const n of out) {
            n.velocity += (Math.random() - 0.5) * 2 * strength;
            n.velocity = clamp(n.velocity, 0.1, 1.0);
        }
    }

    // Timing Jitter — random time offsets (humanizes rigid quantization)
    if (p.timingJitter > 0) {
        const jitterMax = (p.timingJitter / 100) * 2.0; // max ±1 step of jitter
        for (const n of out) {
            n.time += (Math.random() - 0.5) * jitterMax;
            if (n.time < 0) n.time = 0;
        }
    }

    return out;
}

/** Internal: humanize drum patterns (boolean[] + velocity[]) */
function humanizeDrumPattern(drumStates, p) {
    if (!drumStates || typeof drumStates !== 'object') return drumStates;

    const out = {};
    for (const drumId of Object.keys(drumStates)) {
        const drum = drumStates[drumId];
        out[drumId] = {
            ...drum,
            lanes: {}
        };
        for (const laneId of Object.keys(drum.lanes)) {
            const lane = drum.lanes[laneId];
            const pat = [...lane.pattern];
            const vel = [...lane.velocity];
            const dur = lane.duration ? [...lane.duration] : [];

            // Velocity Variation on existing hits
            if (p.velocityVariation > 0) {
                const strength = (p.velocityVariation / 100) * 25; // ±25 at max
                for (let i = 0; i < vel.length; i++) {
                    if (pat[i]) {
                        vel[i] += Math.round((Math.random() - 0.5) * 2 * strength);
                        vel[i] = Math.max(10, Math.min(100, vel[i]));
                    }
                }
            }

            // Ghost Notes — add low-velocity hits on empty steps
            if (p.ghostNotes > 0) {
                const chance = (p.ghostNotes / 100) * 0.2; // max 20% chance
                for (let i = 0; i < pat.length; i++) {
                    if (!pat[i] && Math.random() < chance) {
                        pat[i] = true;
                        vel[i] = Math.round(15 + Math.random() * 25); // 15-40 velocity
                        if (dur.length > i) dur[i] = 1;
                    }
                }
            }

            out[drumId].lanes[laneId] = {
                ...lane,
                pattern: pat,
                velocity: vel,
                duration: dur.length > 0 ? dur : lane.duration
            };
        }
    }
    return out;
}

/**
 * Create a subtle variation of an existing pattern — mutates a fraction of the
 * notes so it sounds similar but not identical.
 *
 * @param {Array} pattern  Note objects (melodic) or drumStates (drums)
 * @param {number} amount  0-1 (0 = identical, 1 = very different)
 * @param {string} type    'melodic' | 'drums'
 * @returns {Array|Object} Varied copy
 */
export function createVariation(pattern, amount = 0.2, type = 'melodic') {
    if (type === 'drums') {
        return createDrumVariation(pattern, amount);
    }

    if (!Array.isArray(pattern) || pattern.length === 0) return pattern;

    const out = pattern.map(n => ({ ...n }));

    // Shift some notes by ±1-2 semitones
    const shiftChance = amount * 0.20;
    for (const n of out) {
        if (Math.random() < shiftChance) {
            const shift = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 1 : 2);
            n.note = Math.max(0, Math.min(127, n.note + shift));
        }
    }

    // Adjust some durations by ±1-2 steps
    const durChance = amount * 0.15;
    for (const n of out) {
        if (Math.random() < durChance) {
            const adj = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 1 : 2);
            n.duration = Math.max(1, n.duration + adj);
        }
    }

    // Re-randomize some velocities
    const velChance = amount * 0.10;
    for (const n of out) {
        if (Math.random() < velChance) {
            n.velocity = 0.3 + Math.random() * 0.6; // 0.3-0.9
        }
    }

    return out;
}

/** Internal: create variation for drum patterns */
function createDrumVariation(drumStates, amount) {
    if (!drumStates || typeof drumStates !== 'object') return drumStates;

    const out = {};
    for (const drumId of Object.keys(drumStates)) {
        const drum = drumStates[drumId];
        out[drumId] = {
            ...drum,
            lanes: {}
        };
        for (const laneId of Object.keys(drum.lanes)) {
            const lane = drum.lanes[laneId];
            const pat = [...lane.pattern];
            const vel = [...lane.velocity];
            const dur = lane.duration ? [...lane.duration] : [];

            // Toggle some hits
            const toggleChance = amount * 0.12;
            for (let i = 0; i < pat.length; i++) {
                if (Math.random() < toggleChance) {
                    pat[i] = !pat[i];
                    if (pat[i]) {
                        vel[i] = Math.round(50 + Math.random() * 40); // 50-90
                        if (dur.length > i) dur[i] = 1;
                    }
                }
            }

            // Shift some velocities
            const velShiftChance = amount * 0.15;
            for (let i = 0; i < vel.length; i++) {
                if (pat[i] && Math.random() < velShiftChance) {
                    vel[i] += Math.round((Math.random() - 0.5) * 30);
                    vel[i] = Math.max(10, Math.min(100, vel[i]));
                }
            }

            out[drumId].lanes[laneId] = {
                ...lane,
                pattern: pat,
                velocity: vel,
                duration: dur.length > 0 ? dur : lane.duration
            };
        }
    }
    return out;
}


// ═══════════════════════════════════════════════════════════════════════════════
// §3  CHORD PATTERN ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
//
// Professional chord generation follows these principles:
//  1. Select a genre-appropriate progression from CHORD_PROGRESSIONS
//  2. Resolve each roman numeral to actual MIDI notes via the selected scale
//  3. Apply voicing strategy (close, open, drop-2, spread)
//  4. Apply voice leading (minimize total semitone movement between chords)
//  5. Apply rhythmic style (pad, stab, arpeggio, pulse, strum)
//  6. Humanize velocities
//
// This mirrors how Captain Chords, Scaler 2, and Orb Chords work internally.

/** Voicing strategies determine note spacing */
const VOICING_STRATEGIES = {
    close: (intervals) => intervals,                                    // root position
    open: (intervals) => intervals.map((n, i) => i === 1 ? n + 12 : n), // 2nd voice up octave
    'drop-2': (intervals) => {                                           // jazz drop-2
        if (intervals.length < 3) return intervals;
        const sorted = [...intervals].sort((a, b) => a - b);
        sorted[sorted.length - 2] -= 12;
        return sorted.sort((a, b) => a - b);
    },
    spread: (intervals) => intervals.map((n, i) => n + (i % 2 === 1 ? 12 : 0)), // alternating octave
    shell: (intervals) => {                                              // root + 3rd + 7th only
        if (intervals.length < 4) return intervals;
        return [intervals[0], intervals[1], intervals[intervals.length - 1]];
    }
};

/** Rhythmic styles determine note placement within a chord segment */
const CHORD_RHYTHM_STYLES = {
    /** Sustained pad — single attack, held for full duration */
    pad: (startTime, duration, chordNotes, velocity) => {
        return chordNotes.map(note => ({
            time: startTime, duration: duration * 0.95,
            note, velocity: velocity * (0.9 + Math.random() * 0.1)
        }));
    },

    /** Short stabs — rhythmic hits on strong beats */
    stab: (startTime, duration, chordNotes, velocity) => {
        const notes = [];
        const stabLen = Math.min(4, duration * 0.25);
        // Hit on downbeat
        chordNotes.forEach(note => {
            notes.push({ time: startTime, duration: stabLen, note, velocity });
        });
        // Optional hit on beat 3 within segment
        if (duration >= 16 && coinFlip(0.7)) {
            const t2 = startTime + Math.floor(duration / 2);
            chordNotes.forEach(note => {
                notes.push({ time: t2, duration: stabLen, note, velocity: velocity * 0.85 });
            });
        }
        // Optional upbeat stab
        if (duration >= 24 && coinFlip(0.4)) {
            const t3 = startTime + Math.floor(duration * 0.75);
            chordNotes.forEach(note => {
                notes.push({ time: t3, duration: stabLen, note, velocity: velocity * 0.75 });
            });
        }
        return notes;
    },

    /** Arpeggiated — notes played sequentially in order */
    arpeggio: (startTime, duration, chordNotes, velocity) => {
        const notes = [];
        const noteCount = chordNotes.length;
        const stepSize = Math.max(2, Math.floor(8 / noteCount));
        const totalArpSteps = Math.floor(duration / stepSize);

        for (let i = 0; i < totalArpSteps; i++) {
            const noteIdx = i % noteCount;
            const dir = Math.floor(i / noteCount) % 2 === 0 ? 1 : -1;
            const actualIdx = dir === 1 ? noteIdx : (noteCount - 1 - noteIdx);
            notes.push({
                time: startTime + i * stepSize,
                duration: stepSize * 0.9,
                note: chordNotes[actualIdx],
                velocity: velocity * (i === 0 ? 1.0 : 0.75 + Math.random() * 0.15)
            });
        }
        return notes;
    },

    /** Pulse — rhythmic eighth-note pumping (EDM/house style) */
    pulse: (startTime, duration, chordNotes, velocity) => {
        const notes = [];
        const pulseSize = 4; // 16th note grid
        for (let t = 0; t < duration; t += pulseSize) {
            if (coinFlip(0.85)) {
                chordNotes.forEach(note => {
                    notes.push({
                        time: startTime + t, duration: pulseSize * 0.8,
                        note, velocity: velocity * (t % 8 === 0 ? 1.0 : 0.7)
                    });
                });
            }
        }
        return notes;
    },

    /** Strum — slight timing offset per note (guitar-like) */
    strum: (startTime, duration, chordNotes, velocity) => {
        const notes = [];
        chordNotes.forEach((note, i) => {
            notes.push({
                time: startTime + i, // 1-step offset per voice
                duration: duration * 0.9 - i,
                note, velocity: velocity * (1.0 - i * 0.03)
            });
        });
        // Optional re-strum halfway
        if (duration >= 16 && coinFlip(0.5)) {
            const t2 = startTime + Math.floor(duration / 2);
            chordNotes.forEach((note, i) => {
                notes.push({
                    time: t2 + i, duration: Math.floor(duration / 2) * 0.9 - i,
                    note, velocity: velocity * 0.8
                });
            });
        }
        return notes;
    }
};

/** Roman numeral → scale degree index mapping */
function romanToDegree(roman) {
    const map = {
        'I': 0, 'i': 0, 'II': 1, 'ii': 1, 'III': 2, 'iii': 2,
        'IV': 3, 'iv': 3, 'V': 4, 'v': 4, 'VI': 5, 'vi': 5,
        'VII': 6, 'vii': 6, 'vii°': 6,
        // Flat degrees
        'bII': 1, 'bIII': 2, 'bVI': 5, 'bVII': 6,
        // Extended
        'I7': 0, 'i7': 0, 'ii7': 1, 'iii7': 2, 'iv7': 3, 'V7': 4,
        'vi7': 5, 'viio7': 6,
        'Imaj7': 0, 'IVmaj7': 3, 'IImaj7': 1,
        'V7#9': 4, 'V7b9': 4, 'iiø7': 1,
        'I6': 0, 'IV6': 3, 'i6': 0
    };
    return map[roman] ?? 0;
}

/** Check if roman numeral implies flat degree */
function isFlat(roman) {
    return roman.startsWith('b');
}

/** Get the flat offset: bVII in minor = interval from the b7 degree */
function flatSemitoneOffset(roman, scale) {
    if (roman === 'bVII') return 10; // Always b7
    if (roman === 'bVI') return 8;  // Always b6
    if (roman === 'bIII') return 3;  // Always b3
    if (roman === 'bII') return 1;  // Always b2
    return scale[romanToDegree(roman) % scale.length] || 0;
}

/**
 * Apply voice leading: find the inversion of nextChord that minimizes total
 * semitone distance from prevChord. This is the key technique used by
 * Captain Chords, Scaler, and professional arranging.
 */
function voiceLead(prevNotes, nextNotes) {
    if (!prevNotes || prevNotes.length === 0) return nextNotes;

    // Generate all inversions of nextNotes
    const inversions = [];
    const n = nextNotes.length;
    for (let inv = 0; inv < n; inv++) {
        const inverted = nextNotes.map((note, i) => {
            const shift = i < inv ? 12 : 0;
            return note + shift;
        });
        // Also try octave below
        inversions.push(inverted);
        inversions.push(inverted.map(n => n - 12));
    }

    // Find inversion with minimum total movement
    let bestInv = nextNotes;
    let bestDist = Infinity;

    for (const inv of inversions) {
        let dist = 0;
        for (let i = 0; i < Math.min(prevNotes.length, inv.length); i++) {
            dist += Math.abs(prevNotes[i] - inv[i]);
        }
        if (dist < bestDist) {
            bestDist = dist;
            bestInv = inv;
        }
    }

    return bestInv;
}

/**
 * Generate a professional chord pattern.
 *
 * @param {Object} params
 * @param {string} params.key       - Root key (e.g. 'C', 'F#')
 * @param {string} params.scale     - Scale name (e.g. 'Minor', 'Dorian')
 * @param {string} params.genre     - Genre name
 * @param {string} params.mood      - Mood name
 * @param {number} params.bars      - Number of bars (1–8)
 * @param {string} params.complexity - 'simple' or 'complex'
 * @param {number} params.octave    - Base octave (default 3)
 * @returns {Array<{time,duration,note,velocity}>}
 */
export function generateChordPattern({
    key = 'C', scale: scaleName = 'Minor', genre = 'Hip Hop', mood = 'Standard',
    bars = 4, complexity = 'simple', octave = 3
}) {
    const root = rootMidi(key, octave);
    const scale = scaleIntervals(scaleName);
    const gd = genreData(genre);
    const md = moodData(mood);
    const totalSteps = bars * 32;

    // 1. Select genre-appropriate progression
    const progType = gd.typicalProgressionType || 'pop';
    const progKey = `${progType}_${complexity}`;
    const progSet = CHORD_PROGRESSIONS[progKey] || CHORD_PROGRESSIONS[`${progType}_simple`]
        || CHORD_PROGRESSIONS.pop_simple;
    const progression = pick(progSet);

    // 2. Determine voicing and rhythm style from genre
    const voicingName = weighted([
        ['close', gd.chordComplexity === 'simple' ? 3 : 1],
        ['open', 2],
        ['drop-2', gd.chordComplexity === 'complex' ? 3 : 0.5],
        ['spread', 1],
        ['shell', gd.chordComplexity === 'complex' ? 1.5 : 0.3]
    ]);

    const rhythmStyle = selectChordRhythm(genre, complexity);
    const voicingFn = VOICING_STRATEGIES[voicingName] || VOICING_STRATEGIES.close;
    const rhythmFn = CHORD_RHYTHM_STYLES[rhythmStyle] || CHORD_RHYTHM_STYLES.pad;

    // 3. Resolve each chord in the progression
    const stepsPerChord = Math.floor(totalSteps / progression.length);
    const notes = [];
    let prevChordNotes = null;

    for (let i = 0; i < progression.length; i++) {
        const roman = progression[i];
        const chordType = ROMAN_TO_CHORD[roman] || 'major';
        const intervals = CHORD_TYPES[chordType] || [0, 4, 7];

        // Calculate root of this chord degree
        let chordRoot;
        if (isFlat(roman)) {
            chordRoot = root + flatSemitoneOffset(roman, scale);
        } else {
            const degree = romanToDegree(roman);
            chordRoot = root + (scale[degree % scale.length] || 0);
        }

        // Apply register shift from mood
        chordRoot += md.registerShift || 0;

        // Build raw chord notes
        let rawNotes = intervals.map(interval => chordRoot + interval);

        // Apply voicing strategy
        rawNotes = voicingFn(rawNotes);

        // Apply voice leading (minimize movement from previous chord)
        rawNotes = voiceLead(prevChordNotes, rawNotes);
        prevChordNotes = rawNotes;

        // Apply rhythmic style
        const startTime = i * stepsPerChord;
        const velocity = 0.75 + Math.random() * 0.15;

        // Complex: add passing chord halfway through long segments (doubles harmonic rhythm)
        if (complexity === 'complex' && stepsPerChord >= 16) {
            const halfDur = Math.floor(stepsPerChord / 2);
            // First half: main chord
            const mainChordNotes = rhythmFn(startTime, halfDur, rawNotes, velocity);
            notes.push(...mainChordNotes);

            // Second half: passing chord (move each note up a scale step for dominant feel)
            const passingOffset = pick([scale[4] || 7, scale[2] || 3, scale[1] || 2]); // 5th, 3rd, or 2nd
            let passingRaw = rawNotes.map(n => n + passingOffset);
            passingRaw = voiceLead(rawNotes, passingRaw);
            const passingVelocity = velocity * 0.85;
            const passingNotes = rhythmFn(startTime + halfDur, halfDur, passingRaw, passingVelocity);
            notes.push(...passingNotes);
        } else {
            const chordNotes = rhythmFn(startTime, stepsPerChord, rawNotes, velocity);
            notes.push(...chordNotes);
        }
    }

    // ── Fallback: if chords are empty, place basic triads on beat 1 of each chord ──
    if (notes.length === 0) {
        const stepsPerFallback = Math.floor(totalSteps / Math.max(progression.length, 1));
        for (let i = 0; i < progression.length; i++) {
            const roman = progression[i];
            const chordType = ROMAN_TO_CHORD[roman] || 'major';
            const intervals = CHORD_TYPES[chordType] || [0, 4, 7];
            let chordRoot;
            if (isFlat(roman)) {
                chordRoot = root + flatSemitoneOffset(roman, scale);
            } else {
                const degree = romanToDegree(roman);
                chordRoot = root + (scale[degree % scale.length] || 0);
            }
            const startT = i * stepsPerFallback;
            for (const iv of intervals) {
                notes.push({ time: startT, duration: stepsPerFallback, note: chordRoot + iv, velocity: 0.75 });
            }
        }
    }

    return humanizeVelocity(notes, { accentStrength: 0.1 });
}

/** Select chord rhythm style based on genre characteristics */
function selectChordRhythm(genre, complexity) {
    if (complexity === 'simple') return 'pad';
    const gd = genreData(genre);
    const style = gd.grooveStyle || 'standard';

    // Map groove styles to rhythm types
    const mapping = {
        'driving': 'pulse', 'relentless': 'pulse', 'hypnotic': 'pulse',
        'euphoric': 'arpeggio', 'progressive': 'arpeggio', 'bouncy': 'arpeggio',
        'funky': 'stab', 'halftime': 'stab', 'aggressive': 'stab',
        'swinging': 'strum', 'neo-soul': 'strum', 'offbeat': 'strum',
        'smooth': 'pad', 'ambient': 'pad', 'relaxed': 'pad',
        'laid-back': complexity === 'complex' ? 'strum' : 'pad',
        'heavy': complexity === 'complex' ? 'stab' : 'pad',
        'polished': complexity === 'complex' ? 'pulse' : 'pad'
    };

    return mapping[style] || (complexity === 'complex' ? 'stab' : 'pad');
}

/** Compute a dynamic complexity based on genre and mood */
export function determineComplexity(genre, mood) {
    const complexGenres = [
        'Jazz', 'Neo-Soul', 'Progressive House', 'Tech House', 'Liquid DnB',
        'Riddim', 'Future Bass', 'Afrobeats', 'Boom Bap', 'Hyperpop'
    ];
    const simpleGenres = [
        'Hip Hop', 'Trap', 'Drill', 'Lo-Fi', 'Ambient', 'Synthwave',
        'Pop', 'R&B', 'Reggaeton', 'Slap House'
    ];
    const complexMoods = ['Energetic', 'Chaotic', 'Aggressive', 'Euphoric', 'Frantic', 'Epic'];
    const simpleMoods = ['Relaxed', 'Sad', 'Dark', 'Chill', 'Ethereal', 'Hypnotic', 'Romantic'];

    let score = 0;
    if (complexGenres.some(g => genre?.toLowerCase().includes(g.toLowerCase()))) score += 2;
    if (simpleGenres.some(g => genre?.toLowerCase().includes(g.toLowerCase()))) score -= 2;
    if (complexMoods.some(m => mood?.toLowerCase().includes(m.toLowerCase()))) score += 1;
    if (simpleMoods.some(m => mood?.toLowerCase().includes(m.toLowerCase()))) score -= 1;

    return score > 0 ? 'complex' : 'simple';
}



// ═══════════════════════════════════════════════════════════════════════════════
// §4  MELODY PATTERN ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
//
// Professional melody generation combines multiple techniques:
//
//  1. CONTOUR SHAPING — Define the overall pitch trajectory
//     (arch, descending, wave, static, valley) before note selection.
//     This is how tools like Orb Melody and Captain Melody work.
//
//  2. WEIGHTED INTERVAL MARKOV CHAINS — Rather than choosing random scale
//     degrees, weight transitions by musical interval. Steps (1–2 semitones)
//     are 3× more likely than leaps (5+ semitones). This mirrors the
//     approach in academic melody generation research.
//
//  3. CHORD-TONE TARGETING — Notes on strong beats (1, 2, 3, 4) should
//     land on chord tones. Passing tones go on offbeats. This is the
//     #1 rule from professional songwriting and jazz improvisation.
//
//  4. MOTIF DEVELOPMENT — Generate a 1–2 bar motif, then vary it through
//     transposition, inversion, rhythmic displacement, and ornamentation.
//     This is fundamental to how Captain Melody and Hookpad work.
//
//  5. GENRE-SPECIFIC DENSITY — Hip-hop melodies are sparse with long
//     sustains. EDM melodies are arpeggiated. Jazz melodies are chromatic.

/** Contour shapes as functions: input (0–1 normalized position) → pitch bias (-1 to 1) */
const CONTOURS = {
    arch: t => Math.sin(t * Math.PI),                    // rise then fall
    valley: t => -Math.sin(t * Math.PI),                   // fall then rise
    ascending: t => t * 2 - 1,                                // steady climb
    descending: t => 1 - t * 2,                                // steady descent
    wave: t => Math.sin(t * Math.PI * 2),                // up-down-up
    plateau: t => t < 0.3 ? t * 3.3 : (t > 0.7 ? (1 - t) * 3.3 : 1), // ramp up, hold, ramp down
    static: () => 0                                        // no contour bias
};

/** Interval weights for Markov transitions (musical plausibility) */
const INTERVAL_WEIGHTS = {
    0: 1.5,   // repeated note
    1: 3.0,   // minor 2nd (chromatic step)
    2: 4.0,   // major 2nd (whole step) — most common
    3: 2.5,   // minor 3rd
    4: 2.0,   // major 3rd
    5: 1.8,   // perfect 4th
    7: 1.5,   // perfect 5th
    12: 0.8,   // octave leap
};

/** Genre-specific melody parameters */
const MELODY_PROFILES = {
    sparse: { density: 0.35, stepGrid: 8, maxLeap: 5, restProb: 0.4, contours: ['arch', 'wave'] },
    syncopated: { density: 0.5, stepGrid: 4, maxLeap: 5, restProb: 0.3, contours: ['arch', 'descending'] },
    'uplifting': { density: 0.6, stepGrid: 4, maxLeap: 7, restProb: 0.2, contours: ['ascending', 'arch'] },
    'uplifting-lead': { density: 0.55, stepGrid: 4, maxLeap: 7, restProb: 0.2, contours: ['arch', 'ascending'] },
    atmospheric: { density: 0.3, stepGrid: 8, maxLeap: 5, restProb: 0.5, contours: ['wave', 'static'] },
    hypnotic: { density: 0.4, stepGrid: 4, maxLeap: 3, restProb: 0.3, contours: ['static', 'wave'] },
    jazzy: { density: 0.55, stepGrid: 4, maxLeap: 7, restProb: 0.25, contours: ['arch', 'wave', 'valley'] },
    aggressive: { density: 0.6, stepGrid: 4, maxLeap: 5, restProb: 0.2, contours: ['descending', 'valley'] },
    dark: { density: 0.4, stepGrid: 4, maxLeap: 4, restProb: 0.35, contours: ['descending', 'valley'] },
    energetic: { density: 0.65, stepGrid: 4, maxLeap: 7, restProb: 0.15, contours: ['arch', 'wave'] },
    smooth: { density: 0.45, stepGrid: 8, maxLeap: 5, restProb: 0.3, contours: ['arch', 'wave'] },
    groovy: { density: 0.5, stepGrid: 4, maxLeap: 5, restProb: 0.25, contours: ['wave', 'arch'] },
    pad: { density: 0.2, stepGrid: 16, maxLeap: 5, restProb: 0.5, contours: ['static', 'wave'] },
    catchy: { density: 0.55, stepGrid: 4, maxLeap: 5, restProb: 0.2, contours: ['arch', 'plateau'] },
    ethereal: { density: 0.3, stepGrid: 8, maxLeap: 7, restProb: 0.4, contours: ['wave', 'ascending'] },
    building: { density: 0.45, stepGrid: 4, maxLeap: 5, restProb: 0.3, contours: ['ascending', 'arch'] },
    epic: { density: 0.5, stepGrid: 4, maxLeap: 7, restProb: 0.2, contours: ['arch', 'ascending'] },
    bell: { density: 0.5, stepGrid: 4, maxLeap: 4, restProb: 0.2, contours: ['static', 'wave'] },
    bebop: { density: 0.7, stepGrid: 2, maxLeap: 5, restProb: 0.15, contours: ['arch', 'wave', 'descending'] },
    dissonant: { density: 0.35, stepGrid: 4, maxLeap: 7, restProb: 0.4, contours: ['valley', 'descending'] },
    quirky: { density: 0.5, stepGrid: 4, maxLeap: 7, restProb: 0.25, contours: ['wave', 'plateau'] },
    progressive: { density: 0.5, stepGrid: 4, maxLeap: 7, restProb: 0.25, contours: ['ascending', 'arch'] },
    chopped: { density: 0.55, stepGrid: 2, maxLeap: 5, restProb: 0.3, contours: ['static', 'wave'] },
    offbeat: { density: 0.45, stepGrid: 4, maxLeap: 5, restProb: 0.3, contours: ['wave', 'static'] },
    riddim: { density: 0.5, stepGrid: 4, maxLeap: 3, restProb: 0.25, contours: ['static', 'wave'] },
    passionate: { density: 0.5, stepGrid: 4, maxLeap: 7, restProb: 0.2, contours: ['arch', 'ascending'] },
    polyrhythmic: { density: 0.5, stepGrid: 4, maxLeap: 5, restProb: 0.2, contours: ['wave', 'arch'] },
    'retro-lead': { density: 0.5, stepGrid: 4, maxLeap: 5, restProb: 0.25, contours: ['arch', 'wave'] },
    'super-saw': { density: 0.45, stepGrid: 4, maxLeap: 7, restProb: 0.2, contours: ['arch', 'ascending'] },
    'dark-tech': { density: 0.5, stepGrid: 4, maxLeap: 4, restProb: 0.3, contours: ['descending', 'valley'] },
    'minimal-tech': { density: 0.35, stepGrid: 4, maxLeap: 3, restProb: 0.4, contours: ['static', 'wave'] },
    experimental: { density: 0.45, stepGrid: 2, maxLeap: 9, restProb: 0.3, contours: ['wave', 'valley'] },
    fusion: { density: 0.55, stepGrid: 4, maxLeap: 7, restProb: 0.2, contours: ['arch', 'wave'] },
    industrial: { density: 0.45, stepGrid: 4, maxLeap: 5, restProb: 0.3, contours: ['descending', 'static'] },
    angular: { density: 0.5, stepGrid: 4, maxLeap: 7, restProb: 0.25, contours: ['wave', 'valley'] },
    'log-drum': { density: 0.45, stepGrid: 4, maxLeap: 5, restProb: 0.3, contours: ['wave', 'static'] },
    'psychedelic': { density: 0.5, stepGrid: 4, maxLeap: 7, restProb: 0.25, contours: ['wave', 'ascending'] },
};

const DEFAULT_MELODY_PROFILE = { density: 0.5, stepGrid: 4, maxLeap: 5, restProb: 0.25, contours: ['arch', 'wave'] };

// Merge expansion contours and melody profiles (bass styles merged after BASS_STYLES definition below)
Object.assign(CONTOURS, CONTOURS_EXPANSION);
Object.assign(MELODY_PROFILES, MELODY_PROFILES_EXPANSION);

/**
 * Select the next scale degree using weighted intervals (Markov-style).
 * Prefers stepwise motion, allows occasional leaps, respects contour direction.
 */
function nextMelodyDegree(currentDegree, scale, contourBias, maxLeap) {
    // Build candidate list: nearby scale degrees
    const candidates = [];
    const range = Math.ceil(maxLeap / 2) + 1;

    for (let offset = -range; offset <= range; offset++) {
        const candidate = currentDegree + offset;
        const semitones = Math.abs(degreeToSemitone(candidate, scale) - degreeToSemitone(currentDegree, scale));
        const weight = INTERVAL_WEIGHTS[semitones] || (1.0 / (1 + semitones));

        // Apply contour bias: if contour says "go up", weight upward motion more
        let contourWeight = 1.0;
        if (contourBias > 0.2 && offset > 0) contourWeight = 1.5 + contourBias;
        if (contourBias < -0.2 && offset < 0) contourWeight = 1.5 + Math.abs(contourBias);
        if (contourBias > 0.2 && offset < 0) contourWeight = 0.5;
        if (contourBias < -0.2 && offset > 0) contourWeight = 0.5;

        candidates.push([candidate, weight * contourWeight]);
    }

    return weighted(candidates);
}

/**
 * Generate a professional melody pattern.
 *
 * @param {Object} params
 * @param {string} params.key
 * @param {string} params.scale
 * @param {string} params.genre
 * @param {string} params.mood
 * @param {number} params.bars
 * @param {string} params.complexity
 * @param {number} params.octave
 * @param {Array}  params.chordPattern - Optional chord pattern for chord-tone targeting
 * @returns {Array<{time,duration,note,velocity}>}
 */
export function generateMelodyPattern({
    key = 'C', scale: scaleName = 'Minor', genre = 'Hip Hop', mood = 'Standard',
    bars = 4, complexity = 'simple', octave = 4, chordPattern = null
}) {
    const root = rootMidi(key, octave);
    const scale = scaleIntervals(scaleName);
    const gd = genreData(genre);
    const md = moodData(mood);
    const totalSteps = bars * 32;

    // Get melody profile from genre's melodyStyle
    const melodyStyle = gd.melodyStyle || 'syncopated';
    const profile = MELODY_PROFILES[melodyStyle] || DEFAULT_MELODY_PROFILE;

    // Adjust density by mood
    const densityMod = md.rhythmDensity || 0.7;
    let density = clamp(profile.density * densityMod, 0.15, 0.85);

    // Boost density for complex — complex should never feel sparse
    if (complexity === 'complex') {
        density = clamp(density * 2.0, 0.55, 0.95);
    }

    // Select contour
    const contourName = pick(profile.contours);
    const contourFn = CONTOURS[contourName] || CONTOURS.arch;

    // Step grid: simple = 8ths, complex = 16ths
    const stepGrid = complexity === 'simple' ? Math.max(profile.stepGrid, 8) : profile.stepGrid;

    // Build chord-tone lookup for targeting
    const chordToneMap = buildChordToneMap(chordPattern, totalSteps);

    // ── Phase 1: Generate 2-bar motif ──
    const motifSteps = Math.min(64, totalSteps);
    const motifNotes = [];
    let currentDegree = coinFlip(0.7) ? 0 : pick([0, 2, 4]); // Start on root or chord tone

    // Complex melodies have much fewer rests
    const effectiveRestProb = complexity === 'complex'
        ? profile.restProb * 0.4
        : profile.restProb;

    for (let t = 0; t < motifSteps; t += stepGrid) {
        // Rest probability
        if (coinFlip(effectiveRestProb)) continue;

        // Density gate
        if (!coinFlip(density)) continue;

        // Contour position (0–1)
        const normalizedPos = t / motifSteps;
        const contourBias = contourFn(normalizedPos);

        // Select next degree
        currentDegree = nextMelodyDegree(currentDegree, scale, contourBias, profile.maxLeap);

        // Chord-tone targeting: on strong beats, snap to chord tones
        const isStrongBeat = (t % 8 === 0);
        let notePitch = root + degreeToSemitone(currentDegree, scale);

        if (isStrongBeat && chordToneMap[t]) {
            // Find nearest chord tone
            const chordTones = chordToneMap[t];
            let nearest = notePitch;
            let minDist = Infinity;
            for (const ct of chordTones) {
                const dist = Math.abs(ct - notePitch);
                if (dist < minDist) { minDist = dist; nearest = ct; }
            }
            // Snap to chord tone if within a 3rd
            if (minDist <= 4) {
                notePitch = nearest;
            }
        }

        // Duration variety
        let duration = stepGrid;
        if (complexity === 'complex') {
            duration = weighted([
                [stepGrid * 2, 1.5],  // longer note
                [stepGrid, 3],         // standard
                [stepGrid / 2, 1],     // shorter note
            ]);
        }
        duration = Math.max(2, Math.min(duration, motifSteps - t));

        motifNotes.push({
            time: t, duration, note: notePitch,
            velocity: 0.7 + Math.random() * 0.2
        });
    }

    // ── Fallback: if motif is empty, force-place notes on strong beats ──
    if (motifNotes.length === 0) {
        let deg = coinFlip(0.7) ? 0 : pick([0, 2, 4]);
        for (let t = 0; t < motifSteps; t += 8) {
            const pos = t / motifSteps;
            const bias = contourFn(pos);
            deg = nextMelodyDegree(deg, scale, bias, profile.maxLeap);
            let pitch = root + degreeToSemitone(deg, scale);
            if (chordToneMap[t]) {
                const chordTones = chordToneMap[t];
                let nearest = pitch, minD = Infinity;
                for (const ct of chordTones) {
                    if (Math.abs(ct - pitch) < minD) { minD = Math.abs(ct - pitch); nearest = ct; }
                }
                if (minD <= 4) pitch = nearest;
            }
            motifNotes.push({
                time: t, duration: stepGrid, note: pitch,
                velocity: 0.7 + Math.random() * 0.2
            });
        }
    }

    // ── Phase 2: Develop motif across remaining bars ──
    const notes = [...motifNotes];

    if (totalSteps > motifSteps && motifNotes.length > 0) {
        for (let barOffset = motifSteps; barOffset < totalSteps; barOffset += motifSteps) {
            // Choose variation technique
            const variation = weighted([
                ['transpose', 3],      // Shift up/down a scale degree
                ['exact', 2],          // Repeat exactly
                ['rhythmShift', 2],    // Shift timing by ±1 step
                ['invert', 1],         // Mirror intervals
                ['diminish', 1],       // Halve durations
            ]);

            const transposeDegrees = pick([-2, -1, 0, 1, 2, 3, 4]);

            for (const note of motifNotes) {
                let newTime = barOffset + note.time;
                if (newTime >= totalSteps) continue;

                let newNote = note.note;
                let newDuration = note.duration;
                let newVelocity = note.velocity;

                switch (variation) {
                    case 'transpose':
                        newNote = root + degreeToSemitone(
                            currentDegree + transposeDegrees, scale
                        );
                        // Re-snap from original pitch offset
                        const origOffset = note.note - root;
                        newNote = root + snapToScale(origOffset + scale[Math.abs(transposeDegrees) % scale.length] * Math.sign(transposeDegrees), scale);
                        break;
                    case 'rhythmShift':
                        newTime += pick([-2, -1, 1, 2]) * (stepGrid / 2);
                        newTime = clamp(Math.round(newTime), barOffset, totalSteps - 1);
                        break;
                    case 'invert': {
                        const offset = note.note - root;
                        newNote = root - offset + 12; // invert around root
                        newNote = root + snapToScale(newNote - root, scale);
                        break;
                    }
                    case 'diminish':
                        newDuration = Math.max(2, Math.floor(note.duration / 2));
                        break;
                    case 'exact':
                    default:
                        break;
                }

                // Apply slight variation even on exact repeats
                newVelocity *= 0.9 + Math.random() * 0.2;

                // Chord-tone re-targeting for varied bars
                const tInBar = newTime % 32;
                if (tInBar % 8 === 0 && chordToneMap[newTime]) {
                    const chordTones = chordToneMap[newTime];
                    let nearest = newNote;
                    let minDist = Infinity;
                    for (const ct of chordTones) {
                        if (Math.abs(ct - newNote) < minDist) {
                            minDist = Math.abs(ct - newNote);
                            nearest = ct;
                        }
                    }
                    if (minDist <= 3) newNote = nearest;
                }

                notes.push({
                    time: Math.round(newTime),
                    duration: Math.round(newDuration),
                    note: newNote,
                    velocity: clamp(newVelocity, 0.3, 1.0)
                });
            }
        }
    }

    return humanizeVelocity(notes, { accentStrength: 0.12 });
}


/**
 * Generate a counter-melody that complements an existing melody.
 *
 * Uses contrary motion, rhythmic displacement, and interval targeting (3rds/6ths)
 * to create a musically coherent second voice. Reuses generateMelodyPattern()
 * with opposing contour and sparser density.
 *
 * @param {Object} params
 * @param {Array}  params.melody       - Existing melody notes to complement
 * @param {string} params.key
 * @param {string} params.scale
 * @param {string} params.genre
 * @param {string} params.mood
 * @param {number} params.bars
 * @param {string} params.complexity
 * @param {number} params.octave
 * @param {Array}  params.chordPattern - Optional chord pattern for chord-tone targeting
 * @returns {Array<{time,duration,note,velocity}>}
 */
export function generateCounterMelody({
    melody, key = 'C', scale: scaleName = 'Minor', genre = 'Hip Hop', mood = 'Standard',
    bars = 4, complexity = 'simple', octave = 4, chordPattern = null
}) {
    if (!melody || melody.length === 0) return [];

    // Analyze the input melody
    const melodyPitches = melody.map(n => n.note);
    const avgPitch = melodyPitches.reduce((a, b) => a + b, 0) / melodyPitches.length;
    const melodyTimes = new Set(melody.map(n => n.time));

    // Determine pitch direction of original melody (overall contour)
    const firstThird = melodyPitches.slice(0, Math.ceil(melodyPitches.length / 3));
    const lastThird = melodyPitches.slice(-Math.ceil(melodyPitches.length / 3));
    const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
    const melodyRises = lastAvg > firstAvg;

    // Get genre melody profile to understand the original's contour
    const gd = genreData(genre);
    const melodyStyle = gd.melodyStyle || 'syncopated';
    const profile = MELODY_PROFILES[melodyStyle] || DEFAULT_MELODY_PROFILE;

    // Opposing contour map
    const contourOpposites = {
        arch: 'valley', valley: 'arch',
        ascending: 'descending', descending: 'ascending',
        wave: 'wave',     // wave works as its own complement (phase-shifted via different start degree)
        plateau: 'valley', static: 'arch'
    };

    // Build a counter-profile: opposite contour, sparser density, wider step grid
    const counterContours = profile.contours.map(c => contourOpposites[c] || 'valley');

    // Generate the counter-melody using the existing melody engine with modified params
    // Use a slightly different starting profile for rhythmic displacement
    let counterNotes = generateMelodyPattern({
        key, scale: scaleName, genre, mood, bars,
        complexity: complexity === 'complex' ? 'complex' : 'simple',
        octave, // same octave for interweaving
        chordPattern
    });

    // Post-process: override contour behavior by applying pitch adjustments
    // Reduce density to ~60-70% of what was generated (remove some notes)
    const keepRatio = 0.65;
    counterNotes = counterNotes.filter(() => Math.random() < keepRatio);

    // Build a time lookup for the main melody (for collision avoidance)
    const melodyLookup = {};
    for (const n of melody) {
        if (!melodyLookup[n.time]) melodyLookup[n.time] = [];
        melodyLookup[n.time].push(n.note);
    }

    const scaleArr = scaleIntervals(scaleName);
    const rootNote = rootMidi(key, octave);

    // Process each counter-melody note
    counterNotes = counterNotes.map(note => {
        let pitch = note.note;

        // Check for collisions with main melody
        const melodyNotesAtTime = melodyLookup[note.time] || [];

        // Remove exact unisons
        if (melodyNotesAtTime.includes(pitch)) {
            // Move to a 3rd or 6th above/below
            const offsets = [3, 4, -3, -4, 8, 9, -8, -9]; // minor/major 3rds and 6ths
            for (const offset of offsets) {
                const candidate = pitch + offset;
                if (!melodyNotesAtTime.includes(candidate)) {
                    pitch = candidate;
                    break;
                }
            }
        }

        // Shift notes that are within 1 semitone of a simultaneous melody note
        for (const mPitch of melodyNotesAtTime) {
            if (Math.abs(pitch - mPitch) === 1) {
                // Move by +2 or -2 to target a 3rd
                pitch += (pitch > mPitch) ? 2 : -2;
                break;
            }
        }

        // Snap to scale
        pitch = rootNote + snapToScale(pitch - rootNote, scaleArr);

        return {
            ...note,
            note: pitch,
            velocity: clamp(note.velocity * 0.75, 0.3, 0.85), // slightly quieter
            layer: 'counter' // metadata for potential multi-color rendering
        };
    });

    // Remove any remaining exact unisons after scale snapping
    counterNotes = counterNotes.filter(cn => {
        const melodyNotesAtTime = melodyLookup[cn.time] || [];
        return !melodyNotesAtTime.includes(cn.note);
    });

    return counterNotes;
}


/** Build a time→chordTones lookup from a chord pattern */
function buildChordToneMap(chordPattern, totalSteps) {
    const map = {};
    if (!chordPattern || chordPattern.length === 0) return map;

    // Group chord notes by their start time
    const groups = {};
    for (const n of chordPattern) {
        const t = n.time;
        if (!groups[t]) groups[t] = [];
        groups[t].push(n.note);
    }

    // For each step, find the active chord tones
    const sortedTimes = Object.keys(groups).map(Number).sort((a, b) => a - b);
    let currentTones = null;

    for (let t = 0; t < totalSteps; t++) {
        // Find the most recent chord start at or before t
        for (const ct of sortedTimes) {
            if (ct <= t) currentTones = groups[ct];
            else break;
        }
        if (currentTones) map[t] = currentTones;
    }

    return map;
}


// ═══════════════════════════════════════════════════════════════════════════════
// §5  BASSLINE PATTERN ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
//
// Professional bassline generation follows these principles:
//
//  1. ROOT FOUNDATION — Bass primarily plays the root of each chord.
//     This is rule #1 from every bass method book and production guide.
//
//  2. FIFTH AND OCTAVE — After roots, the 5th and octave are the most
//     important bass notes. Root-fifth alternation drives country, reggae,
//     motown. Octave shifts add energy in electronic music.
//
//  3. GENRE-SPECIFIC STYLE — Each genre has characteristic bass behavior:
//     - 808: Long sustaining notes following kick, root-heavy, glides
//     - Walking: Stepwise motion through chord tones + passing tones (jazz)
//     - Pumping: Steady 8th notes on root (house/EDM)
//     - Slap: Syncopated with ghost notes (funk)
//     - Tumbao: Anticipated bass pattern (Latin/Afro-Cuban)
//     - Drone: Sustained pedal tone (ambient/cinematic)
//
//  4. CHORD FOLLOWING — Bass follows the chord progression, playing the
//     root of each chord as it changes. More complex styles add passing
//     tones and approach notes between chord changes.
//
//  5. KICK SYNCHRONIZATION — In electronic/hip-hop, bass hits align with
//     or complement the kick drum pattern.

/** Bass style behavior definitions */
const BASS_STYLES = {
    /** 808 — long sustaining sub notes, follows kick pattern */
    '808': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        // Primary hit on downbeat with long sustain
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.85),
            note: chordRoot, velocity: 0.9
        });
        // Optional second hit (sub-divide) at halfway
        if (duration >= 16 && coinFlip(density * 0.4)) {
            const t2 = startTime + Math.floor(duration * 0.5);
            const useOctave = coinFlip(0.3);
            notes.push({
                time: t2, duration: Math.floor(duration * 0.35),
                note: chordRoot + (useOctave ? 12 : 0),
                velocity: 0.75
            });
        }
        return notes;
    },

    /** 808 with slide/glide markers */
    '808_slide': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.9),
            note: chordRoot, velocity: 0.9
        });
        // Glide note before next chord
        if (duration >= 16 && coinFlip(0.5)) {
            const glideTime = startTime + duration - 4;
            const glideTo = chordRoot + pick([2, 3, 5, 7]); // approach from scale tone
            notes.push({
                time: glideTime, duration: 4,
                note: glideTo, velocity: 0.7
            });
        }
        return notes;
    },

    /** Walking bass — stepwise through chord tones and scale (jazz) */
    walking: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8; // quarter notes
        let currentPitch = chordRoot;
        const chordTones = [0, scale[2] || 3, scale[4] || 7]; // root, 3rd, 5th

        for (let t = 0; t < duration; t += stepSize) {
            // Walking patterns: root, 3rd, 5th, approach
            const beatInChord = Math.floor(t / stepSize);
            let targetInterval;

            switch (beatInChord % 4) {
                case 0: targetInterval = 0; break;                           // root
                case 1: targetInterval = pick(chordTones.slice(1)); break;   // 3rd or 5th
                case 2: targetInterval = pick([scale[4] || 7, 12]); break;   // 5th or octave
                case 3: // Approach note: chromatic step toward next root
                    targetInterval = pick([-1, 1, -2, 2, scale[6] || 11]);
                    break;
                default: targetInterval = 0;
            }

            currentPitch = chordRoot + targetInterval;

            notes.push({
                time: startTime + t, duration: stepSize * 0.9,
                note: currentPitch,
                velocity: 0.7 + (beatInChord === 0 ? 0.15 : Math.random() * 0.1)
            });
        }
        return notes;
    },

    /** Pumping — steady 8th note pulse on root (house/EDM) */
    pumping: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 4; // 8th notes at 32ppq
        for (let t = 0; t < duration; t += stepSize) {
            if (coinFlip(0.9)) {
                const isOnBeat = (t % 8 === 0);
                notes.push({
                    time: startTime + t, duration: stepSize * 0.75,
                    note: chordRoot,
                    velocity: isOnBeat ? 0.85 : 0.65
                });
            }
        }
        return notes;
    },

    /** Driving — steady with occasional 5th and octave (rock/trance) */
    driving: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8;
        for (let t = 0; t < duration; t += stepSize) {
            const beat = Math.floor(t / stepSize) % 4;
            let pitch = chordRoot;
            if (beat === 2 && coinFlip(0.4)) pitch = chordRoot + (scale[4] || 7); // 5th
            if (beat === 3 && coinFlip(0.3)) pitch = chordRoot + 12; // octave

            notes.push({
                time: startTime + t, duration: stepSize * 0.9,
                note: pitch, velocity: 0.8 + (beat === 0 ? 0.1 : 0)
            });
        }
        return notes;
    },

    /** Slap — syncopated funk with ghost notes */
    slap: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        // Funk pattern: emphasize 1, & of 2, 4, & of 4
        const funkPositions = [0, 6, 12, 20, 24, 26]; // within 32-step bar
        const barLen = 32;

        for (let t = 0; t < duration; t += barLen) {
            for (const pos of funkPositions) {
                if (t + pos >= duration) break;
                if (!coinFlip(density * 0.8)) continue;

                const isAccent = (pos === 0 || pos === 12 || pos === 24);
                const pitch = isAccent ? chordRoot :
                    chordRoot + pick([0, 0, scale[4] || 7, 12]); // root, 5th, octave

                notes.push({
                    time: startTime + t + pos,
                    duration: isAccent ? 6 : 3,
                    note: pitch,
                    velocity: isAccent ? 0.85 : 0.55
                });
            }
        }
        return notes;
    },

    /** Roots bass — simple root + octave alternation */
    roots: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8;
        for (let t = 0; t < duration; t += stepSize) {
            const beat = Math.floor(t / stepSize) % 4;
            const pitch = (beat % 2 === 0) ? chordRoot : chordRoot + 12;
            notes.push({
                time: startTime + t, duration: stepSize * 0.9,
                note: pitch, velocity: 0.8
            });
        }
        return notes;
    },

    /** Root-heavy — sits on the root most of the time */
    'root-heavy': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.9),
            note: chordRoot, velocity: 0.85
        });
        // occasional octave accent
        if (duration >= 16 && coinFlip(0.3)) {
            notes.push({
                time: startTime + Math.floor(duration * 0.5),
                duration: Math.floor(duration * 0.4),
                note: chordRoot + 12, velocity: 0.7
            });
        }
        return notes;
    },

    /** Deep — sustained with subtle harmonic movement (deep house) */
    deep: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.9),
            note: chordRoot, velocity: 0.75
        });
        // Subtle 5th touch near end
        if (duration >= 24 && coinFlip(0.4)) {
            const fifth = chordRoot + (scale[4] || 7);
            notes.push({
                time: startTime + duration - 8, duration: 6,
                note: fifth, velocity: 0.55
            });
        }
        return notes;
    },

    /** Rolling — continuous pattern with movement (techno/trance) */
    rolling: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 4;
        const pattern = [0, 0, scale[4] || 7, 0, 12, 0, scale[4] || 7, 0];
        for (let t = 0; t < duration; t += stepSize) {
            const idx = Math.floor(t / stepSize) % pattern.length;
            if (coinFlip(0.85)) {
                notes.push({
                    time: startTime + t, duration: stepSize * 0.8,
                    note: chordRoot + pattern[idx],
                    velocity: 0.7 + (t % 8 === 0 ? 0.1 : 0)
                });
            }
        }
        return notes;
    },

    /** 'rolling-bass' alias for trance genre definition */
    'rolling-bass': (startTime, duration, chordRoot, scale, density) => {
        return BASS_STYLES.rolling(startTime, duration, chordRoot, scale, density);
    },

    /** Sub-heavy — emphasis on sub frequencies, minimal notes */
    'sub-heavy': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.95),
            note: chordRoot - 12, velocity: 0.9  // octave below for sub
        });
        return notes;
    },

    /** Sub — simple sustained sub (R&B) */
    sub: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.9),
            note: chordRoot, velocity: 0.8
        });
        if (duration >= 16 && coinFlip(0.25)) {
            notes.push({
                time: startTime + Math.floor(duration * 0.6),
                duration: Math.floor(duration * 0.3),
                note: chordRoot + (scale[2] || 3), velocity: 0.6
            });
        }
        return notes;
    },

    /** Tumbao — Cuban-style anticipated bass (Latin) */
    tumbao: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        // Classic tumbao: anticipated hit on "and of 4" leading into next bar
        const barLen = 32;
        for (let t = 0; t < duration; t += barLen) {
            // Beat 1
            notes.push({
                time: startTime + t, duration: 6,
                note: chordRoot, velocity: 0.85
            });
            // & of 2 (anticipation)
            if (t + 12 < duration && coinFlip(0.8)) {
                notes.push({
                    time: startTime + t + 12, duration: 4,
                    note: chordRoot + (scale[4] || 7), velocity: 0.7
                });
            }
            // Beat 4 (anticipation of next bar)
            if (t + 24 < duration) {
                notes.push({
                    time: startTime + t + 24, duration: 6,
                    note: chordRoot + 12, velocity: 0.75
                });
            }
            // & of 4 (pickup)
            if (t + 28 < duration && coinFlip(0.6)) {
                notes.push({
                    time: startTime + t + 28, duration: 4,
                    note: chordRoot + (scale[4] || 7), velocity: 0.65
                });
            }
        }
        return notes;
    },

    /** Mellow — gentle, sparse (Lo-Fi) */
    mellow: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 16;
        for (let t = 0; t < duration; t += stepSize) {
            const pitch = coinFlip(0.7) ? chordRoot :
                chordRoot + pick([scale[2] || 3, scale[4] || 7]);
            notes.push({
                time: startTime + t, duration: stepSize * 0.85,
                note: pitch, velocity: 0.6 + Math.random() * 0.15
            });
        }
        return notes;
    },

    /** Heavy — aggressive emphasis (dubstep/dancehall) */
    heavy: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.8),
            note: chordRoot, velocity: 0.95
        });
        // Sub-octave hit
        if (duration >= 16 && coinFlip(0.5)) {
            notes.push({
                time: startTime + Math.floor(duration * 0.5),
                duration: Math.floor(duration * 0.3),
                note: chordRoot - 12, velocity: 0.85
            });
        }
        return notes;
    },

    /** Wobble bass (dubstep) */
    wobble: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const wobbleRate = 4;
        for (let t = 0; t < duration; t += wobbleRate) {
            const variation = Math.floor(Math.sin(t * 0.3) * 2); // slight pitch wobble
            notes.push({
                time: startTime + t, duration: wobbleRate * 0.9,
                note: chordRoot + variation, velocity: 0.8
            });
        }
        return notes;
    },

    /** Reese bass (DnB) — sustained with subtle detuning implied */
    reese: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.9),
            note: chordRoot, velocity: 0.85
        });
        // Moving bass hit
        if (duration >= 16 && coinFlip(0.5)) {
            const fifth = chordRoot + (scale[4] || 7);
            notes.push({
                time: startTime + Math.floor(duration * 0.5),
                duration: Math.floor(duration * 0.4),
                note: fifth, velocity: 0.7
            });
        }
        return notes;
    },

    /** Modulated (neurofunk) */
    modulated: (startTime, duration, chordRoot, scale, density) => {
        return BASS_STYLES.reese(startTime, duration, chordRoot, scale, density);
    },

    /** Drone — long sustained pedal tone (ambient/cinematic) */
    drone: (startTime, duration, chordRoot, scale, density) => {
        return [{
            time: startTime, duration: duration,
            note: chordRoot, velocity: 0.6
        }];
    },

    /** Smooth bass (vaporwave) */
    smooth: (startTime, duration, chordRoot, scale, density) => {
        return BASS_STYLES.mellow(startTime, duration, chordRoot, scale, density);
    },

    /** Pounding (techno) — steady quarter notes with force */
    pounding: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8;
        for (let t = 0; t < duration; t += stepSize) {
            notes.push({
                time: startTime + t, duration: stepSize * 0.9,
                note: chordRoot, velocity: 0.85
            });
        }
        return notes;
    },

    /** Subtle (minimal techno) */
    subtle: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.7),
            note: chordRoot, velocity: 0.6
        });
        return notes;
    },

    /** Sub-808 (future bass) */
    'sub-808': (startTime, duration, chordRoot, scale, density) => {
        return BASS_STYLES['808'](startTime, duration, chordRoot, scale, density);
    },

    /** Synth bass (synthwave) */
    'synth-bass': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 4;
        const pattern = [0, 0, 12, 0, scale[4] || 7, 0, 12, 0];
        for (let t = 0; t < duration; t += stepSize) {
            const idx = Math.floor(t / stepSize) % pattern.length;
            if (coinFlip(0.8)) {
                notes.push({
                    time: startTime + t, duration: stepSize * 0.85,
                    note: chordRoot + pattern[idx],
                    velocity: 0.75 + (t % 8 === 0 ? 0.1 : 0)
                });
            }
        }
        return notes;
    },

    /** Groovy — funky movement (afrobeat/amapiano) */
    groovy: (startTime, duration, chordRoot, scale, density) => {
        return BASS_STYLES.slap(startTime, duration, chordRoot, scale, density);
    },

    /** Cowbell bass (phonk) — syncopated with accent */
    cowbell: (startTime, duration, chordRoot, scale, density) => {
        return BASS_STYLES['808'](startTime, duration, chordRoot, scale, density);
    },

    /** Complex bass (IDM) */
    complex: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 4;
        for (let t = 0; t < duration; t += stepSize) {
            if (coinFlip(0.5)) {
                const randomDegree = Math.floor(Math.random() * scale.length);
                notes.push({
                    time: startTime + t, duration: stepSize * weighted([[0.5, 1], [0.8, 2], [1.0, 1]]),
                    note: chordRoot + scale[randomDegree],
                    velocity: 0.6 + Math.random() * 0.3
                });
            }
        }
        return notes;
    }
};

// Merge expansion bass styles
Object.assign(BASS_STYLES, BASS_STYLES_EXPANSION);

/**
 * Generate a professional bassline pattern.
 *
 * @param {Object} params
 * @param {string} params.key
 * @param {string} params.scale
 * @param {string} params.genre
 * @param {string} params.mood
 * @param {number} params.bars
 * @param {string} params.complexity
 * @param {number} params.octave
 * @param {Array}  params.chordPattern - Chord pattern for following chord changes
 * @param {Array}  params.drumPattern  - Optional drum pattern for kick sync
 * @returns {Array<{time,duration,note,velocity}>}
 */
export function generateBassPattern({
    key = 'C', scale: scaleName = 'Minor', genre = 'Hip Hop', mood = 'Standard',
    bars = 4, complexity = 'simple', octave = 2, chordPattern = null, drumPattern = null
}) {
    const root = rootMidi(key, octave);
    const scale = scaleIntervals(scaleName);
    const gd = genreData(genre);
    const md = moodData(mood);
    const totalSteps = bars * 32;
    const density = md.rhythmDensity || 0.7;

    // Get bass style from genre and modify by complexity
    let bassStyleName = gd.bassStyle || 'root-heavy';
    if (complexity === 'simple') {
        const simpleMap = {
            'walking': 'roots', 'slap': 'roots', 'tumbao': 'roots', 'groovy': 'roots',
            'complex': 'root-heavy', 'rolling': 'pumping', 'rolling-bass': 'pumping',
            'wobble': 'heavy', 'reese': 'deep', 'modulated': 'deep', 'synth-bass': 'pumping',
            '808_slide': '808', 'cowbell': '808', 'driving': 'roots', 'pounding': 'pumping'
        };
        bassStyleName = simpleMap[bassStyleName] || bassStyleName;
        // If it's already a simple style like 'root-heavy' or 'drone', it just keeps it
    }
    const bassStyleFn = BASS_STYLES[bassStyleName] || BASS_STYLES['root-heavy'];

    // Adjust density — complex should never feel sparse
    let finalDensity = density;
    if (complexity === 'complex') {
        finalDensity = clamp(density * 2.0, 0.6, 0.98);
    } else {
        finalDensity = clamp(density * 0.7, 0.2, 0.6);
    }

    // Determine chord roots from chord pattern or progression
    const chordRoots = extractChordRoots(chordPattern, root, scaleName, genre, complexity, totalSteps);

    // Generate bass for each chord segment
    const notes = [];

    for (let i = 0; i < chordRoots.length; i++) {
        const { startTime, duration, chordRoot } = chordRoots[i];
        const bassRoot = chordRoot - (chordRoot >= root + 24 ? 24 : chordRoot >= root + 12 ? 12 : 0);
        const segmentNotes = bassStyleFn(startTime, duration, bassRoot, scale, finalDensity);
        notes.push(...segmentNotes);

        // Complex: add chromatic/scale approach note before next chord change
        if (complexity === 'complex' && i + 1 < chordRoots.length && duration >= 8) {
            const nextChordRoot = chordRoots[i + 1].chordRoot;
            const nextBassRoot = nextChordRoot - (nextChordRoot >= root + 24 ? 24 : nextChordRoot >= root + 12 ? 12 : 0);
            const approachTime = startTime + duration - 2; // 2 steps before next chord
            // Chromatic approach: one semitone below or above the next root
            const approachNote = nextBassRoot + (nextBassRoot > bassRoot ? -1 : 1);
            notes.push({
                time: approachTime,
                duration: 2,
                note: approachNote,
                velocity: 0.65
            });
        }
    }

    // ── Fallback: if bass is empty, place root notes on beat 1 of each bar ──
    if (notes.length === 0) {
        for (let bar = 0; bar < bars; bar++) {
            const t = bar * 32;
            const cr = chordRoots.length > 0
                ? chordRoots.find(c => c.startTime <= t && t < c.startTime + c.duration)
                : null;
            const bassNote = cr ? cr.chordRoot : root;
            const lowBass = bassNote - (bassNote >= root + 24 ? 24 : bassNote >= root + 12 ? 12 : 0);
            notes.push({ time: t, duration: 8, note: lowBass, velocity: 0.8 });
            if (bars >= 2) {
                notes.push({ time: t + 16, duration: 8, note: lowBass, velocity: 0.7 });
            }
        }
    }

    // Apply humanization
    return humanizeVelocity(notes, { accentStrength: 0.08, ghostLevel: 0.7 });
}

/**
 * Extract chord root changes from a chord pattern or generate from progression.
 * Groups chord notes into segments where the root changes.
 */
function extractChordRoots(chordPattern, root, scaleName, genre, complexity, totalSteps) {
    if (chordPattern && chordPattern.length > 0) {
        // Group by time, take lowest note as root
        const groups = {};
        for (const n of chordPattern) {
            const t = n.time;
            if (!groups[t]) groups[t] = { time: t, notes: [] };
            groups[t].notes.push(n.note);
        }

        const times = Object.keys(groups).map(Number).sort((a, b) => a - b);
        const segments = [];

        for (let i = 0; i < times.length; i++) {
            const t = times[i];
            const nextT = i + 1 < times.length ? times[i + 1] : totalSteps;
            const lowestNote = Math.min(...groups[t].notes);
            segments.push({
                startTime: t,
                duration: nextT - t,
                chordRoot: lowestNote
            });
        }
        return segments;
    }

    // Fallback: generate from genre progression
    const gd = genreData(genre);
    const progType = gd.typicalProgressionType || 'pop';
    const progKey = `${progType}_${complexity}`;
    const progSet = CHORD_PROGRESSIONS[progKey] || CHORD_PROGRESSIONS.pop_simple;
    const progression = pick(progSet);
    const scale = scaleIntervals(scaleName);
    const stepsPerChord = Math.floor(totalSteps / progression.length);

    return progression.map((roman, i) => {
        let chordRoot;
        if (isFlat(roman)) {
            chordRoot = root + flatSemitoneOffset(roman, scale);
        } else {
            const degree = romanToDegree(roman);
            chordRoot = root + (scale[degree % scale.length] || 0);
        }
        return {
            startTime: i * stepsPerChord,
            duration: stepsPerChord,
            chordRoot
        };
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
// §6  ENHANCED DRUM PATTERN ENGINE (Euclidean + Humanization Layer)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This supplements the existing drumPatterns.js with:
//  - Euclidean rhythm generation for any instrument
//  - Humanized velocity curves (downbeat accents, ghost notes)
//  - Groove templates (swing, push, drag)
//  - Fill probability gates
//
// The existing drumPatterns.js handles genre-specific skeleton patterns.
// This module adds the "polish" layer that makes patterns sound professional.

/**
 * Generate a Euclidean-based drum voice pattern.
 *
 * @param {Object} params
 * @param {number} params.pulses     - Number of hits
 * @param {number} params.steps      - Total steps (usually 32 per bar)
 * @param {number} params.bars       - Number of bars
 * @param {number} params.rotation   - Pattern rotation
 * @param {string} params.instrument - 'kick'|'snare'|'hat'|'perc'
 * @param {number} params.swing      - Swing amount 0–1 (0 = straight, 0.5 = moderate)
 * @returns {Array<{time,duration,note,velocity}>}
 */
export function generateEuclideanDrumVoice({
    pulses = 4, steps = 16, bars = 4, rotation = 0,
    instrument = 'kick', swing = 0, note = 36
}) {
    const totalSteps = bars * steps;
    const basePattern = euclidean(pulses, steps, rotation);
    const notes = [];

    // Velocity curves by instrument type
    const velCurves = {
        kick: (pos, step) => pos === 0 ? 0.95 : 0.8,
        snare: (pos, step) => (pos === Math.floor(steps / 2)) ? 0.95 : 0.75,
        hat: (pos, step) => (pos % Math.floor(steps / 4) === 0) ? 0.85 : 0.6,
        perc: (pos, step) => 0.65 + Math.random() * 0.2,
    };
    const velFn = velCurves[instrument] || velCurves.perc;

    for (let bar = 0; bar < bars; bar++) {
        for (let s = 0; s < steps; s++) {
            if (basePattern[s % basePattern.length]) {
                const globalStep = bar * steps + s;

                // Apply swing: delay odd-numbered 16th notes
                let time = globalStep * (32 / steps);
                if (swing > 0 && s % 2 === 1) {
                    time += swing * 2; // up to 2 steps of swing
                }

                notes.push({
                    time: Math.round(time),
                    duration: Math.max(1, Math.floor(32 / steps * 0.8)),
                    note,
                    velocity: velFn(s, globalStep) * (0.92 + Math.random() * 0.16)
                });
            }
        }
    }

    return notes;
}


// ═══════════════════════════════════════════════════════════════════════════════
// §7  UNIFIED GENERATION API
// ═══════════════════════════════════════════════════════════════════════════════
// Single entry point that generates all four parts in harmony.

/**
 * Generate a complete set of harmonically-linked patterns.
 * Chord pattern is generated first, then melody and bass are derived from it.
 *
 * @param {Object} params - Shared parameters for all generators
 * @returns {{ chords, melody, bass, drums }}
 */
export function generateAllPatterns({
    key = 'C', scale = 'Minor', genre = 'Hip Hop', mood = 'Standard',
    bars = 4, complexity = 'simple', tempo = 120, humanize
}) {
    const gd = genreData(genre);
    const octaveChords = 3;
    const octaveMelody = 4;
    const octaveBass = 2;
    const h = humanize ? { ...DEFAULT_HUMANIZE, ...humanize } : null;

    // 1. Generate chords first (foundation)
    let chords = generateChordPattern({
        key, scale, genre, mood, bars, complexity, octave: octaveChords
    });

    // 2. Generate melody aware of chord tones
    let melody = generateMelodyPattern({
        key, scale, genre, mood, bars, complexity,
        octave: octaveMelody, chordPattern: chords
    });

    // 3. Generate bass following chord roots
    let bass = generateBassPattern({
        key, scale, genre, mood, bars, complexity,
        octave: octaveBass, chordPattern: chords
    });

    // 4. Apply user humanization if provided
    if (h) {
        chords = humanizePattern(chords, h, 'melodic');
        melody = humanizePattern(melody, h, 'melodic');
        bass   = humanizePattern(bass, h, 'melodic');
    }

    return { chords, melody, bass };
}

// Default export for convenience
export default {
    generateChordPattern,
    generateMelodyPattern,
    generateBassPattern,
    generateCounterMelody,
    generateEuclideanDrumVoice,
    generateAllPatterns,
    euclidean,
    humanizePattern,
    createVariation
};
