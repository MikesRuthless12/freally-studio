/**
 * MelodyMatcher — Aligns generated lyrics to melody note patterns.
 * Extracts phrase boundaries, timing, and grouping from MIDI melody data.
 */

import { groupNotesIntoPhrases } from './SyllableBalancer';

/**
 * Extract melody structure for lyric alignment.
 * @param {Array<{time: number, duration: number, note: number, velocity?: number}>} melodyNotes
 * @param {number} barsCount
 * @returns {object}
 */
export function extractMelodyStructure(melodyNotes, barsCount = 4) {
    if (!melodyNotes || melodyNotes.length === 0) {
        return {
            phrases: [],
            phraseCount: 0,
            totalSteps: barsCount * 32,
            hasData: false,
        };
    }

    const sorted = [...melodyNotes].sort((a, b) => a.time - b.time);
    const phrases = groupNotesIntoPhrases(sorted);
    const totalSteps = barsCount * 32;

    return {
        phrases: phrases.map((notes, idx) => ({
            index: idx,
            startTime: notes[0].time,
            endTime: notes[notes.length - 1].time + notes[notes.length - 1].duration,
            noteCount: notes.length,
            notes,
            avgPitch: notes.reduce((sum, n) => sum + n.note, 0) / notes.length,
            avgVelocity: notes.reduce((sum, n) => sum + (n.velocity || 0.7), 0) / notes.length,
            totalDuration: notes.reduce((sum, n) => sum + n.duration, 0),
        })),
        phraseCount: phrases.length,
        totalSteps,
        hasData: true,
    };
}

/**
 * Determine how many syllables a phrase needs based on its notes.
 * @param {Array<{time: number, duration: number}>} notes
 * @returns {number}
 */
export function phraseSyllableCount(notes) {
    if (!notes || notes.length === 0) return 4;

    // Basic: each note gets approximately one syllable
    // Adjust for very short notes (possibly ornamental)
    let count = 0;
    for (const note of notes) {
        if (note.duration >= 2) {
            count += 1;
        } else {
            // Very short notes — group as grace notes, not full syllables
            count += 0.5;
        }
    }

    return Math.max(1, Math.round(count));
}

/**
 * Map sections to melody phrases.
 * Distributes melody phrases across song sections.
 * @param {Array<{type: string, label: string, lines: number}>} sections
 * @param {object} melodyStructure - from extractMelodyStructure
 * @returns {Array<{sectionIndex: number, phraseIndices: number[]}>}
 */
export function mapSectionsToMelody(sections, melodyStructure) {
    if (!melodyStructure.hasData) {
        return sections.map((s, i) => ({ sectionIndex: i, phraseIndices: [] }));
    }

    const totalLines = sections.reduce((sum, s) => sum + s.lines, 0);
    const phrasesPerLine = melodyStructure.phraseCount / totalLines;

    let phraseIdx = 0;
    return sections.map((section, sIdx) => {
        const indices = [];
        for (let l = 0; l < section.lines; l++) {
            if (phraseIdx < melodyStructure.phraseCount) {
                indices.push(phraseIdx % melodyStructure.phraseCount);
                phraseIdx++;
            }
        }
        return { sectionIndex: sIdx, phraseIndices: indices };
    });
}

/**
 * Get timing information for a lyric line based on its corresponding melody phrase.
 * @param {object} phrase - melody phrase object
 * @param {number} bpm
 * @returns {{ startMs: number, endMs: number, durationMs: number }}
 */
export function getLineTiming(phrase, bpm) {
    if (!phrase) {
        return { startMs: 0, endMs: 0, durationMs: 0 };
    }

    // Convert step position to milliseconds
    // 32 steps per bar, at BPM rate
    const msPerBeat = 60000 / bpm;
    const msPerStep = msPerBeat / 8; // 32 steps per 4 beats = 8 steps per beat

    const startMs = phrase.startTime * msPerStep;
    const endMs = phrase.endTime * msPerStep;

    return {
        startMs: Math.round(startMs),
        endMs: Math.round(endMs),
        durationMs: Math.round(endMs - startMs),
    };
}

/**
 * Detect whether melody has a "singable" contour (not too many jumps).
 * @param {Array<{note: number}>} notes
 * @returns {{ singable: boolean, maxInterval: number, avgInterval: number }}
 */
export function analyzeMelodyContour(notes) {
    if (!notes || notes.length < 2) {
        return { singable: true, maxInterval: 0, avgInterval: 0 };
    }

    let maxInterval = 0;
    let totalInterval = 0;

    for (let i = 1; i < notes.length; i++) {
        const interval = Math.abs(notes[i].note - notes[i - 1].note);
        maxInterval = Math.max(maxInterval, interval);
        totalInterval += interval;
    }

    const avgInterval = totalInterval / (notes.length - 1);

    return {
        singable: maxInterval <= 12 && avgInterval <= 5,
        maxInterval,
        avgInterval: Math.round(avgInterval * 10) / 10,
    };
}
