// Pure chord generation logic extracted for testability
import { SCALES, CHORD_PROGRESSIONS, CHORD_TYPES, ROMAN_TO_CHORD } from './MusicTheory';
import { MOOD_MODIFIERS } from './GenreLibraryWithSubGenres';
import { tracker } from './RecentlyUsedTracker';

// Map Roman numeral to 0-based scale degree index
export const romanToDegreeIndex = (roman) => {
    const map = {
        'I': 0, 'i': 0, 'I7': 0, 'i7': 0,
        'II': 1, 'ii': 1, 'ii7': 1,
        'III': 2, 'iii': 2,
        'IV': 3, 'iv': 3, 'iv7': 3,
        'V': 4, 'v': 4, 'V7': 4,
        'VI': 5, 'vi': 5, 'vi7': 5,
        'VII': 6, 'vii': 6, 'vii°': 6,
        // New degree mappings
        'bVII': 6, 'bVI': 5, 'bIII': 2,
        'Imaj7': 0, 'IVmaj7': 3, 'IImaj7': 1,
        'V7#9': 4, 'V7b9': 4,
        'viio7': 6, 'iiø7': 1,
        'iii7': 2,
        'I6': 0, 'IV6': 3, 'i6': 0
    };
    return map[roman];
};

/**
 * Generate a chord pattern given global parameters.
 * Returns an array of note objects: { time, duration, note, velocity }
 */
export function generateChordPattern({
    globalKey = 'C',
    globalScale = 'Minor',
    globalBars = 4,
    globalMood = 'Standard',
    globalOctave = 3,
    complexity = 'simple',
    locked = false
}) {
    if (locked) return null;

    const keyOffset = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(globalKey || 'C');
    const rootPitch = ((globalOctave + 1) * 12) + (keyOffset >= 0 ? keyOffset : 0);

    const currentMood = globalMood || 'Standard';
    const modifier = MOOD_MODIFIERS[currentMood] || { registerShift: 0, rhythmDensity: 1.0 };
    const totalSteps = globalBars * 32;
    const newPattern = [];
    const scale = SCALES[globalScale] || SCALES['Minor'];

    // Filter progression keys by complexity
    const allKeys = Object.keys(CHORD_PROGRESSIONS);
    const filteredKeys = allKeys.filter(k => k.endsWith(`_${complexity}`));
    const availableKeys = filteredKeys.length > 0 ? filteredKeys : allKeys;

    // Pick a random progression category (anti-repeat)
    const progKey = tracker.pick(`chord_category_${complexity}`, availableKeys);
    const progressionSet = CHORD_PROGRESSIONS[progKey];

    if (!progressionSet || progressionSet.length === 0) {
        console.error('[ChordGenerator] No progressions found for key:', progKey);
        return [];
    }

    // Pick a random progression from within the category (anti-repeat)
    const progression = tracker.pick(`chord_prog_${progKey}`, progressionSet);

    if (!progression || progression.length === 0) {
        console.error('[ChordGenerator] Empty progression selected from:', progKey);
        return [];
    }

    const stepsPerChord = totalSteps / progression.length;

    progression.forEach((roman, idx) => {
        const degreeIndex = romanToDegreeIndex(roman);
        if (degreeIndex === undefined) {
            console.warn('[ChordGenerator] Unknown Roman numeral:', roman);
            return;
        }

        const scaleInterval = scale[degreeIndex % scale.length] || 0;
        const rootNote = rootPitch + modifier.registerShift + scaleInterval;

        const chordTypeName = ROMAN_TO_CHORD[roman] || 'major';
        const intervals = CHORD_TYPES[chordTypeName] || [0, 4, 7];

        const startTime = idx * stepsPerChord;
        const density = modifier.rhythmDensity || 1.0;
        const rhythmPulse = 8 / density;

        for (let t = 0; t < stepsPerChord; t += rhythmPulse) {
            if (Math.random() < 0.8 * density) {
                intervals.forEach(interval => {
                    newPattern.push({
                        time: Math.round(startTime + t),
                        duration: Math.max(2, rhythmPulse * 0.8),
                        note: rootNote + interval,
                        velocity: 0.7 + Math.random() * 0.2
                    });
                });
            }
        }
    });

    // Fallback if random rhythm density produced nothing
    if (newPattern.length === 0) {
        progression.forEach((roman, idx) => {
            const degreeIndex = romanToDegreeIndex(roman);
            if (degreeIndex === undefined) return;
            const scaleInterval = scale[degreeIndex % scale.length] || 0;
            const rootNote = rootPitch + modifier.registerShift + scaleInterval;
            const chordTypeName = ROMAN_TO_CHORD[roman] || 'major';
            const intervals = CHORD_TYPES[chordTypeName] || [0, 4, 7];
            const startTime = idx * stepsPerChord;
            intervals.forEach(interval => {
                newPattern.push({
                    time: Math.round(startTime),
                    duration: Math.max(2, stepsPerChord * 0.8),
                    note: rootNote + interval,
                    velocity: 0.8
                });
            });
        });
    }

    return newPattern;
}
