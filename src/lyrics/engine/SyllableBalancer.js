/**
 * SyllableBalancer — Syllable counting and line-length matching.
 * Matches lyric lines to melody note durations or BPM-based estimates.
 */

/**
 * Count syllables in a word using heuristic rules.
 * @param {string} word
 * @returns {number}
 */
export function countSyllables(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length === 0) return 0;
    if (w.length <= 2) return 1;

    // Common exceptions
    const exceptions = {
        'the': 1, 'are': 1, 'were': 1, 'fire': 2, 'desire': 3,
        'every': 3, 'beautiful': 4, 'different': 3, 'interesting': 4,
        'comfortable': 4, 'evening': 2, 'heaven': 2, 'seven': 2,
        'being': 2, 'seeing': 2, 'doing': 2, 'going': 2,
        'create': 2, 'realize': 3, 'favorite': 3, 'separate': 3,
        'chocolate': 3, 'camera': 3, 'family': 3, 'generally': 4,
        'naturally': 4, 'actually': 4, 'average': 3, 'diamond': 2,
        'power': 2, 'flower': 2, 'tower': 2, 'shower': 2,
        'higher': 2, 'lower': 2, 'over': 2, 'under': 2,
    };
    if (exceptions[w] !== undefined) return exceptions[w];

    let count = 0;
    const vowels = 'aeiouy';
    let prevVowel = false;

    for (let i = 0; i < w.length; i++) {
        const isVowel = vowels.includes(w[i]);
        if (isVowel && !prevVowel) count++;
        prevVowel = isVowel;
    }

    // Silent e at end
    if (w.endsWith('e') && !w.endsWith('le') && count > 1) count--;
    // -ed endings that don't add syllable
    if (w.endsWith('ed') && !w.endsWith('ted') && !w.endsWith('ded') && count > 1) count--;
    // -es endings
    if (w.endsWith('es') && !w.endsWith('ses') && !w.endsWith('zes') && !w.endsWith('ces') && count > 1) count--;

    return Math.max(1, count);
}

/**
 * Count total syllables in a line of text.
 * @param {string} line
 * @returns {number}
 */
export function countLineSyllables(line) {
    const words = line.trim().split(/\s+/).filter(Boolean);
    return words.reduce((sum, word) => sum + countSyllables(word), 0);
}

/**
 * Estimate target syllable count based on BPM and section type.
 * @param {number} bpm
 * @param {string} sectionType - 'verse', 'chorus', 'bridge', etc.
 * @returns {number}
 */
export function estimateSyllablesFromBPM(bpm, sectionType = 'verse') {
    // Base syllable density per beat at 120 BPM
    const baseDensity = 2.0; // syllables per beat
    const beatsPerMeasure = 4;

    // Scale density with BPM
    const bpmFactor = bpm / 120;
    const density = baseDensity * bpmFactor;

    // Section-specific multipliers
    const sectionMultipliers = {
        verse: 1.0,
        prechorus: 0.85,
        chorus: 0.8,    // Choruses tend to have fewer, more impactful syllables
        bridge: 0.9,
        outro: 0.7,
        intro: 0.6,
    };

    const multiplier = sectionMultipliers[sectionType] || 1.0;

    // Typical line spans 1-2 measures
    const syllablesPerLine = Math.round(density * beatsPerMeasure * 1.5 * multiplier);

    return Math.max(4, Math.min(16, syllablesPerLine));
}

/**
 * Estimate syllable count from melody note durations.
 * @param {Array<{time: number, duration: number, note: number}>} notes - melody notes for one line
 * @returns {number}
 */
export function estimateSyllablesFromMelody(notes) {
    if (!notes || notes.length === 0) return 8; // default

    // Each distinct note onset typically gets one syllable
    // But long notes may accommodate melisma (multiple pitches on one syllable)
    let syllableCount = 0;
    for (const n of notes) {
        if (n.duration <= 4) {
            // Short note: 1 syllable
            syllableCount += 1;
        } else if (n.duration <= 8) {
            // Medium note: could be 1 or 2 syllables
            syllableCount += 1;
        } else {
            // Long note: held syllable
            syllableCount += 1;
        }
    }

    return Math.max(1, syllableCount);
}

/**
 * Balance a line to hit a target syllable count.
 * Returns suggestions for adjustment.
 * @param {string} line
 * @param {number} targetSyllables
 * @returns {{ line: string, currentSyllables: number, targetSyllables: number, difference: number, status: string }}
 */
export function balanceLine(line, targetSyllables) {
    const current = countLineSyllables(line);
    const diff = current - targetSyllables;

    let status;
    if (Math.abs(diff) <= 1) {
        status = 'balanced';
    } else if (diff > 0) {
        status = 'too-long';
    } else {
        status = 'too-short';
    }

    return {
        line,
        currentSyllables: current,
        targetSyllables,
        difference: diff,
        status,
    };
}

/**
 * Split words into syllable approximations for display.
 * @param {string} word
 * @returns {string[]}
 */
export function splitIntoSyllables(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length <= 2) return [w];

    const syllables = [];
    let current = '';
    const vowels = 'aeiouy';
    let inVowelGroup = false;

    for (let i = 0; i < w.length; i++) {
        const isVowel = vowels.includes(w[i]);
        current += w[i];

        if (isVowel) {
            inVowelGroup = true;
        } else if (inVowelGroup) {
            // Transitioned from vowel to consonant
            inVowelGroup = false;
            if (i < w.length - 1) {
                syllables.push(current);
                current = '';
            }
        }
    }

    if (current) {
        if (syllables.length > 0 && current.length === 1 && !vowels.includes(current)) {
            syllables[syllables.length - 1] += current;
        } else {
            syllables.push(current);
        }
    }

    // Handle silent e
    if (syllables.length > 1 && syllables[syllables.length - 1] === 'e') {
        syllables[syllables.length - 2] += syllables.pop();
    }

    return syllables.length > 0 ? syllables : [w];
}

/**
 * Get syllable count targets for each line in a section.
 * @param {string} sectionType - 'verse', 'chorus', 'bridge'
 * @param {number} lineCount - number of lines in section
 * @param {number} bpm
 * @param {Array} melodyNotes - optional melody notes
 * @returns {number[]} - target syllable count per line
 */
export function getSyllableTargets(sectionType, lineCount, bpm, melodyNotes = []) {
    const targets = [];
    const baseSyllables = estimateSyllablesFromBPM(bpm, sectionType);

    if (melodyNotes.length > 0) {
        // Group melody notes into phrases by time gaps
        const phrases = groupNotesIntoPhrases(melodyNotes);
        for (let i = 0; i < lineCount; i++) {
            const phraseIdx = i % phrases.length;
            targets.push(estimateSyllablesFromMelody(phrases[phraseIdx]));
        }
    } else {
        // Use BPM-based estimates with slight variation
        for (let i = 0; i < lineCount; i++) {
            const variation = (i % 2 === 0) ? 0 : -1;
            targets.push(baseSyllables + variation);
        }
    }

    return targets;
}

/**
 * Group melody notes into phrases based on time gaps.
 * @param {Array<{time: number, duration: number}>} notes
 * @returns {Array<Array>}
 */
function groupNotesIntoPhrases(notes) {
    if (notes.length === 0) return [[]];

    const sorted = [...notes].sort((a, b) => a.time - b.time);
    const phrases = [[]];
    let lastEnd = 0;

    for (const note of sorted) {
        const gap = note.time - lastEnd;
        if (gap > 8 && phrases[phrases.length - 1].length > 0) {
            phrases.push([]);
        }
        phrases[phrases.length - 1].push(note);
        lastEnd = note.time + note.duration;
    }

    return phrases.filter(p => p.length > 0);
}

export { groupNotesIntoPhrases };
