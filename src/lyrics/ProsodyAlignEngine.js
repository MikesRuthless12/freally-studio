// ProsodyAlignEngine.js — Aligns lyrics to melody pitch contour, duration, and stress

/**
 * Simple syllable counter using vowel cluster heuristic.
 * Not perfect but handles common English words well.
 */
export function countSyllables(word) {
    if (!word || word.length === 0) return 0;
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length <= 2) return 1;
    let count = 0;
    let prevVowel = false;
    const vowels = 'aeiouy';
    for (let i = 0; i < w.length; i++) {
        const isVowel = vowels.includes(w[i]);
        if (isVowel && !prevVowel) count++;
        prevVowel = isVowel;
    }
    // Silent e at end
    if (w.endsWith('e') && count > 1) count--;
    // Words like "the" still need at least 1
    if (count === 0) count = 1;
    return count;
}

/**
 * Break a word into approximate syllable chunks.
 */
export function splitIntoSyllables(word) {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (clean.length <= 2) return [word];
    const syllables = [];
    let current = '';
    let prevVowel = false;
    const vowels = 'aeiouyAEIOUY';
    for (let i = 0; i < clean.length; i++) {
        const isVowel = vowels.includes(clean[i]);
        if (isVowel && !prevVowel && current.length > 0 && syllables.length < countSyllables(clean) - 1) {
            // Check if we should split before this vowel
            if (current.length >= 2) {
                syllables.push(current);
                current = clean[i];
                prevVowel = isVowel;
                continue;
            }
        }
        current += clean[i];
        prevVowel = isVowel;
    }
    if (current) syllables.push(current);
    return syllables.length > 0 ? syllables : [word];
}

/**
 * Detect which syllable in a word carries primary stress.
 * Uses simple English heuristics (not dictionary lookup).
 * Returns 0-based index of the stressed syllable.
 */
export function detectStress(word) {
    const syllCount = countSyllables(word);
    if (syllCount <= 1) return 0;
    const w = word.toLowerCase();
    // Common suffixes that pull stress to preceding syllable
    const penultStressSuffixes = ['tion', 'sion', 'cian', 'ity', 'ment', 'ness', 'ful', 'less', 'ous', 'ive', 'ing'];
    for (const suf of penultStressSuffixes) {
        if (w.endsWith(suf) && syllCount >= 2) return Math.max(0, syllCount - 2);
    }
    // Common prefixes — stress usually on root (second syllable)
    const unstressedPrefixes = ['un', 're', 'de', 'dis', 'mis', 'pre', 'over', 'under', 'out'];
    for (const pre of unstressedPrefixes) {
        if (w.startsWith(pre) && w.length > pre.length + 2) return 1;
    }
    // Default: stress first syllable (most common in English)
    return 0;
}

/**
 * Map MIDI pitch height to emotional word weight.
 * Higher pitch → more emotionally intense words.
 * Returns a weight from 0 (very soft) to 1 (very intense).
 */
export function mapPitchToWeight(midi) {
    // Typical vocal range: C3 (48) to C6 (84)
    const low = 48;
    const high = 84;
    const clamped = Math.max(low, Math.min(high, midi));
    return (clamped - low) / (high - low);
}

/**
 * Map note duration (in steps) to ideal syllable count.
 * Longer notes → words with more syllables or held vowels.
 */
export function mapDurationToSyllables(duration) {
    if (duration <= 2) return 1;
    if (duration <= 4) return 1;
    if (duration <= 8) return 2;
    if (duration <= 16) return 3;
    return Math.min(5, Math.ceil(duration / 6));
}

/**
 * Detect phrase endings in a melody — points where a rhyme anchor should be placed.
 * A phrase ending is identified by: gap after a note, descending contour, or long note.
 */
export function detectPhraseEndings(melodyNotes) {
    if (!melodyNotes || melodyNotes.length === 0) return [];
    const sorted = [...melodyNotes].sort((a, b) => (a.position || a.time || 0) - (b.position || b.time || 0));
    const endings = [];
    for (let i = 0; i < sorted.length; i++) {
        const note = sorted[i];
        const pos = note.position ?? note.time ?? 0;
        const dur = note.duration || 4;
        const noteEnd = pos + dur;
        const nextNote = sorted[i + 1];
        const nextPos = nextNote ? (nextNote.position ?? nextNote.time ?? 0) : Infinity;
        const gap = nextPos - noteEnd;
        // Phrase ending conditions: significant gap, or last note, or long note
        const isLongNote = dur >= 12;
        const hasGap = gap >= 8;
        const isLast = i === sorted.length - 1;
        const isDescending = i > 0 && (note.midi ?? note.note ?? 60) < (sorted[i - 1].midi ?? sorted[i - 1].note ?? 60);
        if (isLast || hasGap || (isLongNote && isDescending)) {
            endings.push({ index: i, position: pos, midi: note.midi ?? note.note ?? 60, duration: dur });
        }
    }
    return endings;
}

/**
 * Check if a beat position is a strong beat.
 * In 4/4 time with 32 steps/bar: steps 0, 8, 16, 24 are strong beats (quarter notes).
 * Steps 0 and 16 are strongest (downbeat, beat 3).
 */
export function isStrongBeat(position) {
    const posInBar = position % 32;
    return posInBar % 8 === 0;
}

/**
 * Get beat strength for a position (0-1 scale).
 */
export function getBeatStrength(position) {
    const posInBar = position % 32;
    if (posInBar === 0) return 1.0;   // Downbeat
    if (posInBar === 16) return 0.9;  // Beat 3
    if (posInBar === 8 || posInBar === 24) return 0.7; // Beats 2, 4
    if (posInBar % 4 === 0) return 0.4; // Eighth notes
    if (posInBar % 2 === 0) return 0.2; // Sixteenth notes
    return 0.1;
}

/**
 * Align a line of lyrics to a melody segment.
 * Returns an array of { word, syllables[], noteIndex, stress, pitchWeight, alignment } objects.
 */
export function alignLyricsToMelody(line, melodySegment) {
    if (!line || !melodySegment || melodySegment.length === 0) {
        return { aligned: [], issues: ['No melody data provided'] };
    }
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return { aligned: [], issues: ['Empty line'] };

    // Build syllable list from all words
    const allSyllables = [];
    for (const word of words) {
        const syls = splitIntoSyllables(word);
        const stressIdx = detectStress(word);
        syls.forEach((syl, i) => {
            allSyllables.push({
                syllable: syl,
                word,
                isStressed: i === stressIdx,
                syllableIndex: i,
                totalSyllables: syls.length
            });
        });
    }

    const sorted = [...melodySegment].sort((a, b) => (a.position ?? a.time ?? 0) - (b.position ?? b.time ?? 0));
    const issues = [];

    // Map syllables to notes
    const aligned = [];
    const ratio = allSyllables.length / sorted.length;

    for (let i = 0; i < sorted.length; i++) {
        const note = sorted[i];
        const pos = note.position ?? note.time ?? 0;
        const midi = note.midi ?? note.note ?? 60;
        const dur = note.duration || 4;
        const beatStr = getBeatStrength(pos);
        const pitchWeight = mapPitchToWeight(midi);

        // Determine which syllable(s) map to this note
        const sylStart = Math.floor(i * ratio);
        const sylEnd = Math.min(allSyllables.length, Math.floor((i + 1) * ratio));
        const mappedSyls = allSyllables.slice(sylStart, Math.max(sylStart + 1, sylEnd));

        const stressMatch = mappedSyls.some(s => s.isStressed) === (beatStr >= 0.7);

        aligned.push({
            noteIndex: i,
            position: pos,
            midi,
            duration: dur,
            beatStrength: beatStr,
            pitchWeight,
            syllables: mappedSyls,
            stressMatch,
            isStrongBeat: beatStr >= 0.7
        });

        // Flag mismatches
        if (beatStr >= 0.7 && mappedSyls.length > 0 && !mappedSyls.some(s => s.isStressed)) {
            issues.push(`Strong beat at step ${pos} has unstressed syllable "${mappedSyls[0].syllable}"`);
        }
    }

    return { aligned, issues, syllableCount: allSyllables.length, noteCount: sorted.length };
}

/**
 * Enforce stress pattern: reorder or flag words so stressed syllables land on strong beats.
 * Returns the line with stress annotations and a quality score.
 */
export function enforceStressPattern(line, melody) {
    const result = alignLyricsToMelody(line, melody);
    if (!result.aligned.length) return { line, score: 0, issues: result.issues };

    let matches = 0;
    let total = 0;
    const stressMap = [];

    for (const item of result.aligned) {
        if (item.isStrongBeat && item.syllables.length > 0) {
            total++;
            if (item.stressMatch) matches++;
            stressMap.push({
                position: item.position,
                syllable: item.syllables[0]?.syllable || '',
                isStressed: item.syllables[0]?.isStressed || false,
                shouldBeStressed: true,
                match: item.stressMatch
            });
        }
    }

    const score = total > 0 ? matches / total : 0;
    return {
        line,
        score,
        stressMap,
        issues: result.issues,
        suggestion: score < 0.5 ? 'Consider rearranging words so stressed syllables fall on strong beats' : null
    };
}

/**
 * Rap flow mode: optimizes for rapid syllable delivery with emphasis on rhythmic density.
 * Returns alignment with flow-specific metrics.
 */
export function rapFlowMode(line, melodySegment) {
    if (!line || !melodySegment || melodySegment.length === 0) {
        return { aligned: [], flowScore: 0, density: 0 };
    }

    const words = line.trim().split(/\s+/).filter(Boolean);
    let totalSyllables = 0;
    for (const w of words) totalSyllables += countSyllables(w);

    const sorted = [...melodySegment].sort((a, b) => (a.position ?? a.time ?? 0) - (b.position ?? b.time ?? 0));

    // In rap, we want high syllable density — more syllables per beat
    const totalDuration = sorted.length > 0
        ? (sorted[sorted.length - 1].position ?? sorted[sorted.length - 1].time ?? 0) +
          (sorted[sorted.length - 1].duration || 4) - (sorted[0].position ?? sorted[0].time ?? 0)
        : 1;
    const density = totalSyllables / Math.max(1, totalDuration / 8); // syllables per beat

    // Rap flow prefers: short words, internal rhyme, rhythmic consistency
    const avgWordLength = words.reduce((s, w) => s + w.length, 0) / Math.max(1, words.length);
    const shortWordBonus = avgWordLength < 5 ? 0.2 : 0;

    // Check for internal rhymes (last 2 chars matching between consecutive words)
    let internalRhymes = 0;
    for (let i = 0; i < words.length - 1; i++) {
        const a = words[i].toLowerCase().slice(-2);
        const b = words[i + 1].toLowerCase().slice(-2);
        if (a === b && a.length === 2) internalRhymes++;
    }
    const rhymeBonus = Math.min(0.3, internalRhymes * 0.1);

    const flowScore = Math.min(1, (density / 4) * 0.5 + shortWordBonus + rhymeBonus);

    return {
        aligned: alignLyricsToMelody(line, melodySegment).aligned,
        flowScore,
        density,
        totalSyllables,
        avgWordLength,
        internalRhymes,
        isRapReady: density >= 2.0
    };
}
