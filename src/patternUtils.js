/**
 * patternUtils.js — Utility functions for looping/resizing MIDI patterns.
 *
 * Used when extending or shrinking section bar counts via drag-resize
 * or the global bars dropdown. All patterns use 32 steps per bar.
 */

const STEPS_PER_BAR = 32;

/**
 * Loop a melodic pattern (chords/melody/bass) from oldBars to newBars.
 * Copies from bar 0 repeatedly when extending, truncates when shrinking.
 * @param {Array} notes - [{time, duration, note, velocity}, ...]
 * @param {number} oldBars - current bar count
 * @param {number} newBars - target bar count
 * @returns {Array} new looped pattern
 */
export function loopMelodicPattern(notes, oldBars, newBars) {
    if (!Array.isArray(notes) || notes.length === 0) return [];
    if (newBars <= 0 || oldBars <= 0) return [];
    if (oldBars === newBars) return notes.map(n => ({ ...n }));

    const oldSteps = oldBars * STEPS_PER_BAR;
    const newSteps = newBars * STEPS_PER_BAR;

    if (newBars < oldBars) {
        // Shrink: keep notes that start before newSteps, clamp duration
        return notes
            .filter(n => n.time < newSteps)
            .map(n => ({
                ...n,
                duration: Math.min(n.duration, newSteps - n.time)
            }));
    }

    // Extend: loop pattern from bar 0
    const result = [];
    const passes = Math.ceil(newBars / oldBars);
    for (let p = 0; p < passes; p++) {
        const offset = p * oldSteps;
        for (const n of notes) {
            const newTime = n.time + offset;
            if (newTime >= newSteps) continue;
            result.push({
                ...n,
                time: newTime,
                duration: Math.min(n.duration, newSteps - newTime)
            });
        }
    }
    return result;
}

/**
 * Loop drum patterns from oldBars to newBars.
 * Each drum has lanes with boolean pattern[], velocity[], duration[] arrays.
 * @param {Object} drums - { [drumId]: { powered, solo, mute, sample, lanes: { [laneId]: { pitch, pattern, velocity, duration } } } }
 * @param {number} oldBars - current bar count
 * @param {number} newBars - target bar count
 * @returns {Object} new looped drums object (deep copy)
 */
export function loopDrumPattern(drums, oldBars, newBars) {
    if (!drums || typeof drums !== 'object') return drums;
    if (newBars <= 0 || oldBars <= 0) return drums;
    if (oldBars === newBars) return JSON.parse(JSON.stringify(drums));

    const oldSteps = oldBars * STEPS_PER_BAR;
    const newSteps = newBars * STEPS_PER_BAR;
    const result = {};

    for (const [drumId, drum] of Object.entries(drums)) {
        const newDrum = { ...drum };
        if (drum.lanes && typeof drum.lanes === 'object') {
            const newLanes = {};
            for (const [laneId, lane] of Object.entries(drum.lanes)) {
                const newLane = { ...lane };

                // Loop each array type (pattern, velocity, duration)
                newLane.pattern = loopArray(lane.pattern, oldSteps, newSteps, false);
                newLane.velocity = loopArray(lane.velocity, oldSteps, newSteps, 100);
                newLane.duration = loopArray(lane.duration, oldSteps, newSteps, 1);

                newLanes[laneId] = newLane;
            }
            newDrum.lanes = newLanes;
        }
        result[drumId] = newDrum;
    }

    return result;
}

/**
 * Loop a flat array (boolean pattern, velocity, duration) from oldLen to newLen.
 * @param {Array} arr - source array
 * @param {number} oldLen - current length
 * @param {number} newLen - target length
 * @param {*} defaultVal - default value for missing entries
 * @returns {Array} new looped/truncated array
 */
function loopArray(arr, oldLen, newLen, defaultVal) {
    if (!Array.isArray(arr)) return new Array(newLen).fill(defaultVal);

    if (newLen <= oldLen) {
        // Shrink: just slice
        return arr.slice(0, newLen);
    }

    // Extend: tile the source array
    const result = new Array(newLen);
    const srcLen = Math.min(arr.length, oldLen);
    if (srcLen === 0) {
        result.fill(defaultVal);
        return result;
    }
    for (let i = 0; i < newLen; i++) {
        result[i] = arr[i % srcLen];
    }
    return result;
}

/**
 * Loop all patterns in a section's patterns object.
 * @param {Object} patterns - { drums, chords, melody, bass }
 * @param {number} oldBars - current bar count
 * @param {number} newBars - target bar count
 * @returns {Object} new patterns object with looped data
 */
export function loopAllPatterns(patterns, oldBars, newBars) {
    if (!patterns) return patterns;
    const result = {};

    if (patterns.drums) {
        result.drums = loopDrumPattern(patterns.drums, oldBars, newBars);
    }
    if (Array.isArray(patterns.chords)) {
        result.chords = loopMelodicPattern(patterns.chords, oldBars, newBars);
    }
    if (Array.isArray(patterns.melody)) {
        result.melody = loopMelodicPattern(patterns.melody, oldBars, newBars);
    }
    if (Array.isArray(patterns.bass)) {
        result.bass = loopMelodicPattern(patterns.bass, oldBars, newBars);
    }

    // Preserve any other pattern keys (e.g. future instruments)
    for (const key of Object.keys(patterns)) {
        if (!(key in result)) {
            result[key] = patterns[key];
        }
    }

    return result;
}
