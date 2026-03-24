// HookOptimizer.js — Score and optimize chorus/hook memorability
// Uses the full Lyric Engine generation system for real optimization

import { countSyllables } from './ProsodyAlignEngine';
import { generateChorus, generateHookPhrase } from './engine/HookGenerator';
import { createRNG } from './engine/PhraseConstructor';
import { getGenreBank, pick } from './engine/GenreBank';
import { findRhymes, wordsRhyme, getLastWord } from './engine/RhymeEngine';

// Common open vowel sounds that project well in hooks
const OPEN_VOWEL_PATTERNS = [
    /ah/gi, /oh/gi, /oo/gi, /ee/gi, /ay/gi, /ow/gi,
    /[aeiou]{2,}/gi // consecutive vowels
];

// High-impact phonetic sounds for hooks
const PUNCH_CONSONANTS = /[bpdtgk]/gi;

// Emotionally charged word sets (simplified heuristic)
const EMOTIONAL_WORDS = new Set([
    'love', 'heart', 'soul', 'fire', 'dream', 'night', 'light', 'dark',
    'burn', 'fly', 'fall', 'rise', 'break', 'free', 'alive', 'forever',
    'never', 'always', 'baby', 'hold', 'feel', 'touch', 'cry', 'smile',
    'dance', 'run', 'fight', 'hope', 'fear', 'pain', 'rain', 'sun',
    'star', 'sky', 'world', 'life', 'die', 'breathe', 'believe', 'lost',
    'found', 'home', 'gone', 'stay', 'leave', 'want', 'need', 'mine',
    'yours', 'together', 'alone', 'wild', 'crazy', 'beautiful', 'strong',
    // French
    'amour', 'coeur', 'ame', 'feu', 'reve', 'nuit', 'lumiere', 'sombre',
    'bruler', 'voler', 'tomber', 'libre', 'vivant', 'toujours', 'jamais',
    'danser', 'courir', 'espoir', 'douleur', 'soleil', 'etoile', 'monde',
    'vie', 'croire', 'perdu', 'seul', 'fort', 'beau', 'passion', 'desir',
    // Spanish
    'amor', 'corazon', 'alma', 'fuego', 'sueno', 'noche', 'luz', 'oscuro',
    'quemar', 'volar', 'caer', 'libre', 'vivo', 'siempre', 'nunca',
    'bailar', 'correr', 'esperanza', 'dolor', 'sol', 'estrella', 'mundo',
    // German
    'liebe', 'herz', 'seele', 'feuer', 'traum', 'nacht', 'licht', 'dunkel',
    'brennen', 'fliegen', 'fallen', 'frei', 'lebendig', 'immer', 'nie',
    // Portuguese
    'coracao', 'fogo', 'sonho', 'noite', 'estrela', 'esperanca', 'dor',
    // Italian
    'cuore', 'anima', 'fuoco', 'sogno', 'notte', 'luce', 'amore', 'forte',
]);

/**
 * Get the last N characters of a word (for rhyme checking).
 */
function getEnding(word, n = 3) {
    const clean = word.toLowerCase().replace(/[^\p{L}]/gu, '');
    return clean.length >= n ? clean.slice(-n) : clean;
}

/**
 * Calculate repetition ratio — how much the hook repeats key phrases.
 * Higher = more memorable (up to a point).
 */
function calcRepetitionRatio(lines) {
    if (lines.length <= 1) return 0;
    const wordCounts = {};
    const allWords = [];
    for (const line of lines) {
        const words = line.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
        allWords.push(...words);
        for (const w of words) {
            wordCounts[w] = (wordCounts[w] || 0) + 1;
        }
    }
    if (allWords.length === 0) return 0;
    const repeated = Object.values(wordCounts).filter(c => c > 1).reduce((s, c) => s + c, 0);
    return Math.min(1, repeated / allWords.length);
}

/**
 * Calculate simplicity index — simpler words/lines are easier to remember.
 * Based on average syllable count and word length.
 */
function calcSimplicityIndex(lines) {
    let totalSyllables = 0;
    let totalWords = 0;
    let totalChars = 0;
    for (const line of lines) {
        const words = line.split(/\s+/).filter(Boolean);
        for (const w of words) {
            totalSyllables += countSyllables(w);
            totalChars += w.replace(/[^a-z]/gi, '').length;
            totalWords++;
        }
    }
    if (totalWords === 0) return 0;
    const avgSyl = totalSyllables / totalWords;
    const avgLen = totalChars / totalWords;
    // Simple: avg 1-2 syllables, avg 3-5 chars
    const sylScore = Math.max(0, 1 - (avgSyl - 1.5) * 0.4);
    const lenScore = Math.max(0, 1 - (avgLen - 4) * 0.15);
    return Math.min(1, (sylScore + lenScore) / 2);
}

/**
 * Calculate phonetic punch — plosive consonants and strong sounds.
 */
function calcPhoneticPunch(lines) {
    const text = lines.join(' ');
    const matches = text.match(PUNCH_CONSONANTS) || [];
    const ratio = matches.length / Math.max(1, text.replace(/\s/g, '').length);
    return Math.min(1, ratio * 5);
}

/**
 * Calculate emotional clarity — presence of emotionally resonant words.
 */
function calcEmotionalClarity(lines) {
    let emotionalCount = 0;
    let totalWords = 0;
    for (const line of lines) {
        const words = line.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
        totalWords += words.length;
        for (const w of words) {
            if (EMOTIONAL_WORDS.has(w)) emotionalCount++;
        }
    }
    if (totalWords === 0) return 0;
    return Math.min(1, (emotionalCount / totalWords) * 3);
}

/**
 * Calculate rhyme density — how many line-ending or internal rhymes exist.
 */
function calcRhymeDensity(lines) {
    if (lines.length <= 1) return 0;
    let rhymes = 0;
    let comparisons = 0;
    // End rhymes
    const endings = lines.map(l => {
        const words = l.trim().split(/\s+/).filter(Boolean);
        return words.length > 0 ? getEnding(words[words.length - 1]) : '';
    });
    for (let i = 0; i < endings.length; i++) {
        for (let j = i + 1; j < endings.length; j++) {
            comparisons++;
            if (endings[i] && endings[j] && endings[i] === endings[j]) rhymes++;
            // Also check 2-char ending match
            else if (endings[i].slice(-2) === endings[j].slice(-2) && endings[i].length >= 2) rhymes += 0.5;
        }
    }
    // Internal rhymes within each line
    for (const line of lines) {
        const words = line.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
        for (let i = 0; i < words.length - 1; i++) {
            comparisons++;
            if (getEnding(words[i], 2) === getEnding(words[i + 1], 2)) rhymes += 0.5;
        }
    }
    return comparisons > 0 ? Math.min(1, rhymes / comparisons * 3) : 0;
}

/**
 * Calculate vowel openness — presence of open vowel sounds that project well.
 */
function calcVowelOpenness(lines) {
    const text = lines.join(' ');
    let openVowels = 0;
    for (const pattern of OPEN_VOWEL_PATTERNS) {
        const matches = text.match(pattern) || [];
        openVowels += matches.length;
    }
    const ratio = openVowels / Math.max(1, text.replace(/\s/g, '').length);
    return Math.min(1, ratio * 4);
}

/**
 * Calculate rhyme scheme compliance — checks how many required rhyme pairs
 * actually rhyme using wordsRhyme(). Returns 0-1 where 1 = all pairs rhyme.
 * This is used as the PRIMARY criterion for selecting candidates — a candidate
 * where all pairs rhyme will always beat one with broken pairs.
 */
function calcRhymeSchemeCompliance(lines, rhymeScheme) {
    if (!lines || lines.length <= 1 || !rhymeScheme) return 1;

    let requiredPairs = 0;
    let matchedPairs = 0;

    for (let i = 0; i < lines.length; i++) {
        const patternChar = rhymeScheme[i % rhymeScheme.length] || 'A';
        // Find the FIRST earlier line this should rhyme with
        for (let j = 0; j < i; j++) {
            if ((rhymeScheme[j % rhymeScheme.length] || 'A') === patternChar) {
                requiredPairs++;
                const word1 = getLastWord(lines[i]);
                const word2 = getLastWord(lines[j]);
                if (word1 && word2 && wordsRhyme(word1, word2)) {
                    matchedPairs++;
                }
                break; // Only check first match for this pattern
            }
        }
    }

    return requiredPairs > 0 ? matchedPairs / requiredPairs : 1;
}

/**
 * Calculate word duplication penalty — penalize when the same significant word
 * (5+ chars, not a stop word) appears in adjacent lines. This sounds lazy/repetitive.
 */
function calcWordDuplication(lines) {
    if (lines.length <= 1) return 0;
    let dupeCount = 0;
    let totalChecks = 0;
    for (let i = 0; i < lines.length - 1; i++) {
        const wordsA = lines[i].toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/)
            .filter(w => w.length >= 5 && !STOP_WORDS.has(w));
        const wordsB = lines[i + 1].toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/)
            .filter(w => w.length >= 5 && !STOP_WORDS.has(w));
        const setA = new Set(wordsA);
        for (const w of wordsB) {
            if (setA.has(w)) dupeCount++;
        }
        totalChecks += Math.max(wordsA.length, wordsB.length, 1);
    }
    return totalChecks > 0 ? Math.min(1, dupeCount / totalChecks) : 0;
}

/**
 * Score a hook/chorus for memorability.
 * Returns individual metrics and a total score (0-1).
 */
export function scoreHook(lines) {
    if (!lines || lines.length === 0) {
        return {
            repetitionRatio: 0, simplicityIndex: 0, phoneticPunch: 0,
            emotionalClarity: 0, rhymeDensity: 0, vowelOpenness: 0, total: 0
        };
    }
    const filtered = lines.filter(l => l.trim().length > 0);
    if (filtered.length === 0) {
        return {
            repetitionRatio: 0, simplicityIndex: 0, phoneticPunch: 0,
            emotionalClarity: 0, rhymeDensity: 0, vowelOpenness: 0, total: 0
        };
    }

    const repetitionRatio = calcRepetitionRatio(filtered);
    const simplicityIndex = calcSimplicityIndex(filtered);
    const phoneticPunch = calcPhoneticPunch(filtered);
    const emotionalClarity = calcEmotionalClarity(filtered);
    const rhymeDensity = calcRhymeDensity(filtered);
    const vowelOpenness = calcVowelOpenness(filtered);
    const wordDuplication = calcWordDuplication(filtered);

    const total = (
        repetitionRatio * 0.20 +
        simplicityIndex * 0.18 +
        phoneticPunch * 0.10 +
        emotionalClarity * 0.18 +
        rhymeDensity * 0.15 +
        vowelOpenness * 0.14
    ) - wordDuplication * 0.20; // Heavy penalty for lazy word repetition

    return {
        repetitionRatio: Math.round(repetitionRatio * 10000) / 10000,
        simplicityIndex: Math.round(simplicityIndex * 10000) / 10000,
        phoneticPunch: Math.round(phoneticPunch * 10000) / 10000,
        emotionalClarity: Math.round(emotionalClarity * 10000) / 10000,
        rhymeDensity: Math.round(rhymeDensity * 10000) / 10000,
        vowelOpenness: Math.round(vowelOpenness * 10000) / 10000,
        total: Math.round(Math.max(0, total) * 10000) / 10000
    };
}

/**
 * Vowel-open replacements for common words — used as a final polish pass.
 */
const VOWEL_OPEN_SWAPS = {
    'go': 'soar', 'move': 'flow', 'think': 'know', 'see': 'glow',
    'walk': 'roam', 'talk': 'call', 'get': 'hold', 'make': 'grow',
    'take': 'show', 'give': 'pour', 'tell': 'roar', 'look': 'gaze',
    'want': 'crave', 'need': 'ache', 'like': 'adore', 'hate': 'loathe'
};

/**
 * Apply vowel-open polish to lines.
 */
function applyVowelPolish(lines) {
    return lines.map(line => {
        const words = line.split(/\s+/);
        return words.map(w => {
            const lower = w.toLowerCase().replace(/[^a-z]/g, '');
            if (VOWEL_OPEN_SWAPS[lower]) {
                const swap = VOWEL_OPEN_SWAPS[lower];
                return w[0] === w[0].toUpperCase() ? swap.charAt(0).toUpperCase() + swap.slice(1) : swap;
            }
            return w;
        }).join(' ');
    });
}

// Stop words to skip during word-swapping in refine mode
const STOP_WORDS = new Set([
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'the', 'a', 'an', 'is', 'am',
    'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'can',
    'could', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up',
    'about', 'into', 'through', 'and', 'but', 'or', 'nor', 'not', 'no', 'so',
    'if', 'then', 'than', 'too', 'very', 'just', 'don\'t', 'it', 'its', 'it\'s',
    'that', 'this', 'these', 'those', 'all', 'each', 'every', 'both', 'more',
    'most', 'other', 'some', 'such', 'only', 'own', 'same', 'like', 'when',
    'where', 'how', 'what', 'who', 'which', 'oh', 'yeah', 'hey', 'now', 'still'
]);

/**
 * Build a rhyme-pair-aware candidate from bank phrases.
 * Enforces: each rhyme pair uses different ending words, no pair is repeated.
 */
function buildRhymedCandidate(bankPhrases, lineCount, rhymeScheme, rng) {
    const lines = [];
    const usedPhrases = new Set();
    const usedEndWords = new Set();
    const usedRhymePairs = new Set(); // Track "word1-word2" pairs to prevent duplication

    for (let i = 0; i < lineCount; i++) {
        const patternChar = (rhymeScheme || 'AABB')[i % rhymeScheme.length] || 'A';
        // Find which earlier line this should rhyme with
        let rhymeTargetIdx = -1;
        for (let j = 0; j < i; j++) {
            const jChar = (rhymeScheme || 'AABB')[j % rhymeScheme.length] || 'A';
            if (jChar === patternChar) {
                rhymeTargetIdx = j;
                break;
            }
        }

        let chosenLine = null;

        if (rhymeTargetIdx >= 0 && lines[rhymeTargetIdx]) {
            // This line must rhyme with the target
            const targetWord = getLastWord(lines[rhymeTargetIdx]);
            if (targetWord) {
                const rhymeCandidates = bankPhrases.filter(p => {
                    if (usedPhrases.has(p)) return false;
                    const lw = getLastWord(p);
                    if (!lw || lw === targetWord) return false;
                    if (usedEndWords.has(lw)) return false;
                    const pairKey = [targetWord, lw].sort().join('-');
                    if (usedRhymePairs.has(pairKey)) return false;
                    return wordsRhyme(targetWord, lw);
                });
                if (rhymeCandidates.length > 0) {
                    chosenLine = pick(rhymeCandidates, rng);
                    const lw = getLastWord(chosenLine);
                    usedRhymePairs.add([targetWord, lw].sort().join('-'));
                }
            }
        }

        if (!chosenLine) {
            // Pick a fresh phrase with a new ending word
            const available = bankPhrases.filter(p => {
                if (usedPhrases.has(p)) return false;
                const lw = getLastWord(p);
                return lw && !usedEndWords.has(lw);
            });
            chosenLine = available.length > 0 ? pick(available, rng) : pick(bankPhrases, rng);
        }

        if (chosenLine) {
            usedPhrases.add(chosenLine);
            const lw = getLastWord(chosenLine);
            if (lw) usedEndWords.add(lw);
            lines.push(chosenLine);
        }
    }
    return lines;
}

/**
 * Refine an existing hook — replace lines with coherent bank phrases while
 * maintaining rhyme structure. NEVER does random word swaps (those create gibberish).
 * ALWAYS produces new output on each call.
 */
function refineHook(contentLines, genre, mood, rhymeScheme = 'AABB') {
    const effectiveGenre = genre || 'pop';
    const bank = getGenreBank(effectiveGenre);
    const bankPhrases = [...(bank.choruses || []), ...(bank.verses || []), ...(bank.bridges || [])];
    const baseSeed = Date.now() + Math.floor(Math.random() * 100000);

    // Collect all candidates — we pick the BEST among them
    const candidates = [];

    // Strategy 1: Replace lines with rhyme-aware bank phrases (keep some originals)
    for (let attempt = 0; attempt < 15; attempt++) {
        const rng = createRNG(baseSeed + attempt * 4219);
        const keepRatio = 0.15 + (attempt / 15) * 0.4; // Keep 15-55% of original lines
        const usedPhrases = new Set();
        const usedEndWords = new Set();
        const candidate = [];

        for (let i = 0; i < contentLines.length; i++) {
            const patternChar = rhymeScheme[i % rhymeScheme.length] || 'A';
            // Find rhyme target
            let rhymeTargetIdx = -1;
            for (let j = 0; j < i; j++) {
                if ((rhymeScheme[j % rhymeScheme.length] || 'A') === patternChar) {
                    rhymeTargetIdx = j;
                    break;
                }
            }

            // Decide if we keep the original or replace
            if (rng() < keepRatio && rhymeTargetIdx < 0) {
                // Keep original line (only for non-rhyming positions to preserve structure)
                candidate.push(contentLines[i]);
                const lw = getLastWord(contentLines[i]);
                if (lw) usedEndWords.add(lw);
            } else if (rhymeTargetIdx >= 0) {
                // Must rhyme with target — find a rhyming bank phrase
                const targetWord = getLastWord(candidate[rhymeTargetIdx]);
                let chosenLine = null;
                if (targetWord) {
                    const rhymeCandidates = bankPhrases.filter(p => {
                        if (usedPhrases.has(p)) return false;
                        const lw = getLastWord(p);
                        if (!lw || lw === targetWord) return false;
                        if (usedEndWords.has(lw)) return false;
                        return wordsRhyme(targetWord, lw);
                    });
                    if (rhymeCandidates.length > 0) {
                        chosenLine = pick(rhymeCandidates, rng);
                    }
                }
                if (!chosenLine) {
                    // Fallback: use original or any phrase
                    chosenLine = contentLines[i];
                }
                usedPhrases.add(chosenLine);
                const lw = getLastWord(chosenLine);
                if (lw) usedEndWords.add(lw);
                candidate.push(chosenLine);
            } else {
                // Replace with a fresh bank phrase (new ending word)
                const available = bankPhrases.filter(p => {
                    if (usedPhrases.has(p)) return false;
                    const lw = getLastWord(p);
                    return lw && !usedEndWords.has(lw);
                });
                const chosenLine = available.length > 0 ? pick(available, rng) : contentLines[i];
                usedPhrases.add(chosenLine);
                const lw = getLastWord(chosenLine);
                if (lw) usedEndWords.add(lw);
                candidate.push(chosenLine);
            }
        }
        candidates.push(candidate);
    }

    // Strategy 2: Full bank-phrase replacement with strict rhyme pairing
    for (let attempt = 0; attempt < 10; attempt++) {
        const rng = createRNG(baseSeed + 50000 + attempt * 3571);
        const candidate = buildRhymedCandidate(bankPhrases, contentLines.length, rhymeScheme, rng);
        if (candidate.length === contentLines.length) {
            candidates.push(candidate);
        }
    }

    // Strategy 3: Generate fresh choruses via the Lyric Engine
    for (let attempt = 0; attempt < 10; attempt++) {
        const rng = createRNG(baseSeed + 80000 + attempt * 7919);
        try {
            const fresh = generateChorus(effectiveGenre, mood || '', contentLines.length, rhymeScheme, rng, new Set());
            if (fresh && fresh.length > 0) {
                candidates.push(fresh);
            }
        } catch (e) { /* skip */ }
    }

    // Pick the best candidate — rhyme compliance is PRIMARY criterion
    let bestLines = candidates[0] || [...contentLines];
    let bestCompliance = calcRhymeSchemeCompliance(bestLines, rhymeScheme);
    let bestScore = scoreHook(bestLines).total;
    for (let i = 1; i < candidates.length; i++) {
        const compliance = calcRhymeSchemeCompliance(candidates[i], rhymeScheme);
        const score = scoreHook(candidates[i]).total;
        // Prefer higher compliance first, then better score
        if (compliance > bestCompliance ||
            (compliance === bestCompliance && score > bestScore)) {
            bestLines = candidates[i];
            bestCompliance = compliance;
            bestScore = score;
        }
    }
    return bestLines;
}

/**
 * Generate completely fresh choruses using the Lyric Engine.
 * ALWAYS produces new output on each call (random seed from Date.now + Math.random).
 */
function freshGenerate(contentLines, genre, mood, rhymeScheme = 'AABB') {
    const effectiveGenre = genre || 'pop';
    const targetLineCount = Math.min(Math.max(contentLines.length, 4), 6);
    const baseSeed = Date.now() + Math.floor(Math.random() * 100000);

    const candidates = [];

    // Generate many fresh choruses using the selected rhyme scheme, pick the best
    for (let attempt = 0; attempt < 30; attempt++) {
        const seed = baseSeed + attempt * 7919;
        const rng = createRNG(seed);
        const scheme = rhymeScheme; // Use the user-selected rhyme scheme

        try {
            const candidate = generateChorus(
                effectiveGenre, mood || '', targetLineCount, scheme, rng, new Set()
            );
            if (candidate && candidate.length > 0) {
                candidates.push(candidate);
            }
        } catch (e) { /* skip */ }
    }

    // Also try hook-led choruses
    for (let attempt = 0; attempt < 10; attempt++) {
        const seed = baseSeed + 100000 + attempt * 3571;
        const rng = createRNG(seed);
        try {
            const hookPhrase = generateHookPhrase(effectiveGenre, mood || '', rng);
            const chorusLines = generateChorus(
                effectiveGenre, mood || '', targetLineCount, rhymeScheme, rng, new Set([hookPhrase])
            );
            if (chorusLines && chorusLines.length > 0) {
                candidates.push(chorusLines);
            }
        } catch (e) { /* skip */ }
    }

    if (candidates.length === 0) return [...contentLines];

    // Pick the best — rhyme compliance is PRIMARY criterion
    let bestLines = candidates[0];
    let bestCompliance = calcRhymeSchemeCompliance(bestLines, rhymeScheme);
    let bestScore = scoreHook(bestLines).total;
    for (let i = 1; i < candidates.length; i++) {
        const compliance = calcRhymeSchemeCompliance(candidates[i], rhymeScheme);
        const score = scoreHook(candidates[i]).total;
        if (compliance > bestCompliance ||
            (compliance === bestCompliance && score > bestScore)) {
            bestLines = candidates[i];
            bestCompliance = compliance;
            bestScore = score;
        }
    }
    return bestLines;
}

/**
 * Optimize a hook for better memorability using the full Lyric Engine.
 * ALWAYS produces new, different output on each click.
 *
 * Two modes:
 *   'refine' — Swap words/lines with genre vocabulary, mix with bank phrases
 *   'fresh'  — Generate entirely new choruses and pick the highest-scoring one
 *
 * @param {string[]} lines - Current hook/chorus lines
 * @param {string} genre - Genre for generation (e.g. 'hip hop', 'pop')
 * @param {string} mood - Mood modifier (e.g. 'dark', 'happy')
 * @param {string} mode - 'refine' or 'fresh'
 * @param {string} rhymeScheme - Rhyme pattern e.g. 'AABB', 'ABAB', 'ABCB', 'AABA', 'ABBA'
 */
export function optimizeHook(lines, genre = '', mood = '', mode = 'refine', rhymeScheme = 'AABB') {
    if (!lines || lines.length === 0) {
        return { improvedLines: [], hookScoreBefore: 0, hookScoreAfter: 0 };
    }

    // Filter out section headers like [Chorus], [Verse], empty lines
    const filtered = lines.filter(l => l.trim().length > 0);
    const contentLines = filtered.filter(l => !/^\[.+\]$/.test(l.trim()));

    if (contentLines.length === 0) {
        return { improvedLines: [], hookScoreBefore: 0, hookScoreAfter: 0 };
    }

    const scoreBefore = scoreHook(contentLines);
    const beforeScore = Math.round(scoreBefore.total * 10000) / 100;
    const MIN_SCORE_THRESHOLD = beforeScore - 5; // Must be within 5 points

    // Retry up to MAX_RETRIES times until the score is within 5 points of original
    const MAX_RETRIES = 20;
    let bestLines = null;
    let bestAfterScore = -Infinity;
    let bestScoreObj = null;

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
        let candidateLines;
        if (mode === 'fresh') {
            candidateLines = freshGenerate(contentLines, genre, mood, rhymeScheme);
        } else {
            candidateLines = refineHook(contentLines, genre, mood, rhymeScheme);
        }

        const candidateScore = scoreHook(candidateLines);
        const afterScoreNum = Math.round(candidateScore.total * 10000) / 100;

        // Track the best result across all retries
        if (afterScoreNum > bestAfterScore) {
            bestLines = candidateLines;
            bestAfterScore = afterScoreNum;
            bestScoreObj = candidateScore;
        }

        // If within 5 points and has good rhyme compliance, accept it
        if (afterScoreNum >= MIN_SCORE_THRESHOLD) {
            const compliance = calcRhymeSchemeCompliance(candidateLines, rhymeScheme);
            if (compliance >= 0.5) break; // At least half the pairs rhyme
        }
    }

    // Use the best result we found
    if (!bestLines) bestLines = [...contentLines];
    if (!bestScoreObj) bestScoreObj = scoreBefore;

    return {
        improvedLines: bestLines,
        hookScoreBefore: beforeScore,
        hookScoreAfter: bestAfterScore > -Infinity ? bestAfterScore : beforeScore,
        detailsBefore: scoreBefore,
        detailsAfter: bestScoreObj
    };
}
