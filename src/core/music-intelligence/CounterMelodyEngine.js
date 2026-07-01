/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CounterMelodyEngine — Smart Counter Melody Generator
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Generates counter melodies that complement an existing lead melody using
 * music-theory-driven rules:
 *
 *  1. Contrary motion — when the lead rises, the counter falls (and vice versa)
 *  2. Rhythmic displacement — avoids rhythmic unisons with the lead
 *  3. Chord-tone targeting — strong beats land on chord tones
 *  4. Passing tones — weak beats use scale-passing tones between chord tones
 *  5. Interval scoring — prefers consonant intervals (3rds, 6ths, 10ths)
 *
 * All output uses the standard Freally note format:
 *   { time, duration, note, velocity, layer: 'counter' }
 *
 * Steps per bar: 32  |  Velocity: 0.0–1.0  |  MIDI note: 0–127
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { SCALES } from '../../MusicTheory';
import { SCALES_CATALOG } from '../../domain/index';

// ─── Utilities ───────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const coinFlip = (p = 0.5) => Math.random() < p;

const KEY_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** MIDI note for a given key + octave */
const rootMidi = (key, octave = 3) => (octave + 1) * 12 + (KEY_INDEX[key] ?? 0);

/** Get scale intervals array */
const scaleIntervals = (scaleName) => {
    if (SCALES_CATALOG?.[scaleName]) return SCALES_CATALOG[scaleName].intervals;
    if (SCALES?.[scaleName]) return SCALES[scaleName];
    return [0, 2, 3, 5, 7, 8, 10]; // Minor fallback
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

/** Build chord-tone lookup: step → array of MIDI pitch classes (0-11) */
function buildChordToneMap(chordPattern, totalSteps) {
    const map = {};
    if (!chordPattern || chordPattern.length === 0) return map;
    const groups = {};
    for (const n of chordPattern) {
        const t = n.time;
        if (!groups[t]) groups[t] = [];
        groups[t].push(n.note % 12);
    }
    const sortedTimes = Object.keys(groups).map(Number).sort((a, b) => a - b);
    let current = null;
    for (let t = 0; t < totalSteps; t++) {
        for (const ct of sortedTimes) {
            if (ct <= t) current = groups[ct];
            else break;
        }
        if (current) map[t] = current;
    }
    return map;
}

// ─── Interval consonance scoring ─────────────────────────────────────────────

/** Score an interval (in semitones) for consonance.  Higher = better. */
function scoreInterval(semitones) {
    const abs = Math.abs(semitones) % 12;
    // Perfect consonances
    if (abs === 0) return -2;  // unison — avoid
    if (abs === 7) return 6;   // perfect 5th
    if (abs === 5) return 6;   // perfect 4th
    // Imperfect consonances (preferred for counter-melody)
    if (abs === 3) return 10;  // minor 3rd
    if (abs === 4) return 10;  // major 3rd
    if (abs === 8) return 9;   // minor 6th
    if (abs === 9) return 9;   // major 6th
    // Compound imperfect consonances
    if (abs === 10) return 5;  // minor 7th — moderate
    if (abs === 11) return 2;  // major 7th — mild dissonance
    // Dissonances
    if (abs === 1) return -3;  // minor 2nd
    if (abs === 2) return 1;   // major 2nd
    if (abs === 6) return -1;  // tritone
    return 0;
}

// ─── Lead melody analysis ────────────────────────────────────────────────────

/**
 * Analyze the lead melody to extract:
 *  - intervals between consecutive notes
 *  - rhythm positions (which steps have notes)
 *  - pitch range
 *  - contour direction per note
 */
function analyzeMelody(melody) {
    if (!melody || melody.length === 0) return null;

    const sorted = [...melody].sort((a, b) => a.time - b.time);
    const intervals = [];
    const directions = []; // +1 ascending, -1 descending, 0 static
    const rhythmSet = new Set();
    let minPitch = 127, maxPitch = 0;

    for (let i = 0; i < sorted.length; i++) {
        const n = sorted[i];
        rhythmSet.add(n.time);
        minPitch = Math.min(minPitch, n.note);
        maxPitch = Math.max(maxPitch, n.note);
        if (i > 0) {
            const diff = n.note - sorted[i - 1].note;
            intervals.push(diff);
            directions.push(diff > 0 ? 1 : diff < 0 ? -1 : 0);
        }
    }

    return {
        sorted,
        intervals,
        directions,
        rhythmSet,
        minPitch,
        maxPitch,
        avgPitch: sorted.reduce((s, n) => s + n.note, 0) / sorted.length,
        range: maxPitch - minPitch
    };
}

// ─── Rhythm displacement ─────────────────────────────────────────────────────

/**
 * Generate rhythm positions for the counter melody that are displaced
 * from the lead melody. Prefers off-beat positions and fills gaps.
 */
function generateDisplacedRhythm(analysis, totalSteps, density = 0.5) {
    const { rhythmSet, sorted } = analysis;
    const positions = [];

    // Build a desirability score for each step
    const scores = new Float32Array(totalSteps);

    for (let t = 0; t < totalSteps; t++) {
        // Prefer steps where the lead is silent
        if (!rhythmSet.has(t)) {
            scores[t] += 3;
        } else {
            scores[t] -= 2; // penalize exact rhythmic unison
        }

        // Prefer off-beats (steps 4, 12, 20, 28 within each bar-half)
        const inBar = t % 32;
        if (inBar % 8 === 4) scores[t] += 2;       // 8th-note off-beats
        if (inBar % 16 === 8) scores[t] += 1;       // beat 3 of each half
        if (inBar % 4 === 2) scores[t] += 0.5;      // 16th-note off-beats

        // Strong beats are OK for chord tones (handled later in pitch selection)
        if (inBar % 8 === 0) scores[t] += 1;
    }

    // Select positions by score, aiming for target density
    const targetCount = Math.max(2, Math.round(sorted.length * density));
    const indexed = [];
    for (let t = 0; t < totalSteps; t++) {
        indexed.push({ time: t, score: scores[t] + Math.random() * 0.5 });
    }
    indexed.sort((a, b) => b.score - a.score);

    // Take the top N positions, then sort chronologically
    for (let i = 0; i < Math.min(targetCount, indexed.length); i++) {
        positions.push(indexed[i].time);
    }
    positions.sort((a, b) => a - b);

    // Remove positions that are too close together (< 2 steps apart)
    const filtered = [positions[0]];
    for (let i = 1; i < positions.length; i++) {
        if (positions[i] - filtered[filtered.length - 1] >= 2) {
            filtered.push(positions[i]);
        }
    }

    return filtered;
}

// ─── Pitch generation with contrary motion ───────────────────────────────────

/**
 * Generate candidate pitches for each counter-melody position.
 * Applies contrary motion relative to the lead melody's local direction.
 */
function generateCounterPitches({
    positions, analysis, root, scale, chordToneMap, totalSteps, motionBias = 'contrary'
}) {
    const { sorted, avgPitch, minPitch, maxPitch } = analysis;

    // Build a time→leadNote lookup for the nearest lead note at or before each step
    const leadAtStep = new Array(totalSteps).fill(null);
    let lastLead = sorted[0];
    let leadIdx = 0;
    for (let t = 0; t < totalSteps; t++) {
        while (leadIdx < sorted.length && sorted[leadIdx].time <= t) {
            lastLead = sorted[leadIdx];
            leadIdx++;
        }
        leadAtStep[t] = lastLead;
    }
    // Reset for next pass
    leadIdx = 0;

    // Find lead direction at each position
    function getLeadDirection(time) {
        // Find the two nearest lead notes bracketing this time
        let before = null, after = null;
        for (const n of sorted) {
            if (n.time <= time) before = n;
            if (n.time > time && !after) after = n;
        }
        if (before && after) return after.note - before.note;
        return 0;
    }

    const notes = [];
    let prevPitch = null;

    for (const time of positions) {
        const leadNote = leadAtStep[time];
        if (!leadNote) continue;

        const leadPitch = leadNote.note;
        const leadDir = getLeadDirection(time);
        const isStrongBeat = (time % 8) === 0;
        const chordTones = chordToneMap[time] || [];

        // Determine effective motion for this note: contrary, oblique, or mixed
        const effectiveMotion = motionBias === 'mixed'
            ? (coinFlip() ? 'contrary' : 'oblique')
            : motionBias;

        // Generate candidate pitches
        const candidates = [];

        if (effectiveMotion === 'oblique') {
            // Oblique motion — counter holds steady or barely moves while lead moves
            // Strongly prefer repeating the previous pitch or staying within a step
            if (prevPitch !== null) {
                candidates.push(prevPitch);          // exact repeat (hold)
                candidates.push(prevPitch + 1);      // half-step neighbor
                candidates.push(prevPitch - 1);
                candidates.push(prevPitch + 2);      // whole-step neighbor
                candidates.push(prevPitch - 2);
            }
            // Also add consonant intervals from lead as fallback (for first note or variety)
            candidates.push(leadPitch + 3, leadPitch + 4);
            candidates.push(leadPitch - 3, leadPitch - 4);
            candidates.push(leadPitch + 7, leadPitch + 8, leadPitch + 9);
            candidates.push(leadPitch - 7, leadPitch - 8, leadPitch - 9);
        } else {
            // Contrary motion — move opposite to lead
            const contraryDir = leadDir > 0 ? -1 : leadDir < 0 ? 1 : (coinFlip() ? 1 : -1);
            const contraryIntervals = [3, 4, 7, 8, 9]; // 3rd, M3, 5th, m6, M6 in semitones
            for (const interval of contraryIntervals) {
                candidates.push(leadPitch + contraryDir * interval);
                candidates.push(leadPitch - contraryDir * interval);
            }

            // Parallel 3rds/6ths (classic counterpoint)
            candidates.push(leadPitch + 3, leadPitch + 4);    // 3rds above
            candidates.push(leadPitch - 3, leadPitch - 4);    // 3rds below
            candidates.push(leadPitch + 8, leadPitch + 9);    // 6ths above
            candidates.push(leadPitch - 8, leadPitch - 9);    // 6ths below
        }

        // If chord tones available, add chord tones in range
        if (chordTones.length > 0) {
            for (let oct = 2; oct <= 6; oct++) {
                for (const pc of chordTones) {
                    const midi = oct * 12 + pc;
                    if (Math.abs(midi - leadPitch) >= 2 && Math.abs(midi - leadPitch) <= 16) {
                        candidates.push(midi);
                    }
                }
            }
        }

        // Snap all candidates to scale
        const snapped = candidates.map(c => root + snapToScale(c - root, scale));

        // Score each candidate
        let bestPitch = snapped[0] || leadPitch + 4;
        let bestScore = -Infinity;

        for (const candidate of snapped) {
            let score = 0;

            // 1. Interval consonance with lead
            score += scoreInterval(candidate - leadPitch) * 3;

            // 2. Motion-specific scoring
            if (effectiveMotion === 'oblique') {
                // Oblique: strongly reward holding the same pitch or minimal movement
                if (prevPitch !== null) {
                    const move = Math.abs(candidate - prevPitch);
                    if (move === 0) score += 12;       // exact hold — strongest reward
                    else if (move <= 2) score += 8;    // half/whole step — still good
                    else if (move <= 4) score += 3;    // small move — acceptable
                    else score -= move * 0.8;          // penalize larger motion
                }
            } else {
                // Contrary: reward moving opposite to the lead direction
                const contraryDir = leadDir > 0 ? -1 : leadDir < 0 ? 1 : (coinFlip() ? 1 : -1);
                if (contraryDir > 0 && candidate > leadPitch) score += 4;
                if (contraryDir < 0 && candidate < leadPitch) score += 4;
            }

            // 3. Strong beat = chord tone bonus
            const candidatePC = ((candidate % 12) + 12) % 12;
            if (isStrongBeat && chordTones.includes(candidatePC)) {
                score += 8;
            }
            // Weak beat = passing tone is fine (no penalty)
            if (!isStrongBeat && !chordTones.includes(candidatePC)) {
                score += 1; // slight bonus for passing tones on weak beats
            }

            // 4. Smooth voice leading (prefer small intervals from previous counter note)
            if (prevPitch !== null) {
                const leap = Math.abs(candidate - prevPitch);
                if (leap <= 2) score += 5;       // step
                else if (leap <= 4) score += 3;  // 3rd
                else if (leap <= 7) score += 1;  // up to 5th
                else score -= leap * 0.3;        // penalize large leaps
            }

            // 5. Stay in reasonable range (not too far from lead melody range)
            const rangePenalty = Math.max(0, Math.abs(candidate - avgPitch) - 12);
            score -= rangePenalty * 0.5;

            // 6. Avoid unison and minor 2nd with lead
            const dist = Math.abs(candidate - leadPitch) % 12;
            if (dist === 0) score -= 15;
            if (dist === 1) score -= 8;

            // 7. Keep within playable MIDI range
            if (candidate < 36 || candidate > 96) score -= 10;

            if (score > bestScore) {
                bestScore = score;
                bestPitch = candidate;
            }
        }

        // Determine duration — shorter on off-beats, longer on strong beats
        let duration;
        if (isStrongBeat) {
            duration = pick([4, 6, 8]);
        } else {
            duration = pick([2, 3, 4]);
        }

        // Velocity — slightly quieter than lead, with variation
        const velocity = clamp(
            (leadNote.velocity || 0.7) * 0.7 + (Math.random() * 0.15 - 0.075),
            0.25, 0.8
        );

        notes.push({
            time,
            duration,
            note: bestPitch,
            velocity,
            layer: 'counter'
        });

        prevPitch = bestPitch;
    }

    return notes;
}

// ─── Post-processing ─────────────────────────────────────────────────────────

/**
 * Remove notes that create harsh dissonances when sounding simultaneously
 * with the lead melody.
 */
function removeHarshClashes(counterNotes, melody) {
    const melodyLookup = {};
    for (const n of melody) {
        for (let t = n.time; t < n.time + n.duration; t++) {
            if (!melodyLookup[t]) melodyLookup[t] = [];
            melodyLookup[t].push(n.note);
        }
    }

    return counterNotes.filter(cn => {
        // Check all steps this counter note occupies
        for (let t = cn.time; t < cn.time + cn.duration; t++) {
            const leadNotes = melodyLookup[t];
            if (!leadNotes) continue;
            for (const lp of leadNotes) {
                const interval = Math.abs(cn.note - lp) % 12;
                // Remove exact unisons and minor 2nds
                if (interval === 0 || interval === 1 || interval === 11) {
                    return false;
                }
            }
        }
        return true;
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a counter melody that complements the given lead melody.
 *
 * @param {Object}  params
 * @param {Array}   params.melody        - Lead melody notes [{time, duration, note, velocity}]
 * @param {Array}   params.chordPattern  - Chord pattern notes (optional, for chord-tone targeting)
 * @param {string}  params.key           - Musical key (e.g. 'C', 'F#')
 * @param {string}  params.scale         - Scale name (e.g. 'Minor', 'Major')
 * @param {number}  params.bars          - Number of bars (4, 8, or 16)
 * @param {number}  params.octave        - Base octave (default 4)
 * @param {number}  params.density       - Rhythmic density relative to lead (0.3–1.0, default 0.6)
 * @param {string}  params.motionBias    - 'contrary' | 'oblique' | 'mixed' (default 'contrary')
 *
 * @returns {Array<{time, duration, note, velocity, layer: 'counter'}>}
 */
export function generateCounterMelody({
    melody,
    chordPattern = null,
    key = 'C',
    scale: scaleName = 'Minor',
    bars = 4,
    octave = 4,
    density = 0.6,
    motionBias = 'contrary'
} = {}) {
    if (!melody || melody.length === 0) return [];

    const totalSteps = bars * 32;
    const root = rootMidi(key, octave);
    const scale = scaleIntervals(scaleName);
    const chordToneMap = buildChordToneMap(chordPattern, totalSteps);

    // Step 1: Analyze the lead melody
    const analysis = analyzeMelody(melody);
    if (!analysis) return [];

    // Step 2: Generate displaced rhythm positions
    const positions = generateDisplacedRhythm(analysis, totalSteps, density);

    // Step 3: Generate pitches with motion-aware harmony scoring
    let counterNotes = generateCounterPitches({
        positions, analysis, root, scale, chordToneMap, totalSteps, motionBias
    });

    // Step 4: Remove harsh clashes
    counterNotes = removeHarshClashes(counterNotes, melody);

    // Step 5: Ensure all notes are within bounds
    counterNotes = counterNotes
        .filter(n => n.time >= 0 && n.time < totalSteps)
        .map(n => ({
            ...n,
            note: clamp(n.note, 36, 96),
            duration: Math.min(n.duration, totalSteps - n.time)
        }));

    return counterNotes;
}

/**
 * Preview-friendly version: returns both the original melody and counter melody merged,
 * suitable for direct insertion into a pattern.
 */
export function generateAndMerge({
    melody,
    chordPattern,
    key,
    scale,
    bars,
    octave,
    density,
    motionBias
} = {}) {
    const originalMelody = (melody || []).filter(n => n.layer !== 'counter');
    if (originalMelody.length === 0) return [];

    const counter = generateCounterMelody({
        melody: originalMelody, chordPattern, key, scale, bars, octave, density, motionBias
    });

    const totalSteps = (bars || 4) * 32;
    return [...originalMelody, ...counter]
        .filter(n => n.time < totalSteps)
        .sort((a, b) => a.time - b.time);
}

export default { generateCounterMelody, generateAndMerge };
