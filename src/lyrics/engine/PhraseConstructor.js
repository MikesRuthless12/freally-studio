/**
 * PhraseConstructor — Assembles lyric lines from genre banks, mood modifiers,
 * and template patterns. Handles rhyme constraint fulfillment.
 *
 * IMPORTANT: Never blindly replace the last word of a phrase to force a rhyme.
 * That produces nonsensical lines like "I can feel it in the air weigh".
 * Instead, use complete coherent sentences or pick from phrase pools.
 */

import { getGenreBank, getMoodModifier, applyMoodToPhrase, pick } from './GenreBank';
import { findRhymingPhrase, findRhymes, getLastWord, wordsRhyme, RHYME_FAMILIES } from './RhymeEngine';
import { countLineSyllables } from './SyllableBalancer';
import { getPunchlinePhrases, getPunchlinesByFamily } from './PunchlineBank';
import { getLocalizedGenreBank, getGenerationLanguage } from './PhraseLoader';
import { fillTemplatePlaceholders } from './HookGenerator';

/**
 * Get the genre bank, using localized version if a non-English language is active.
 */
function getActiveGenreBank(genre) {
    const langCode = getGenerationLanguage();
    if (langCode && langCode !== 'en') {
        return getLocalizedGenreBank(genre, langCode, getGenreBank);
    }
    return getGenreBank(genre);
}

/**
 * Extract the ending sound of a phrase for rhyme matching in non-English languages.
 * For alphabetic scripts: last 3 chars of the last word (captures rhymes like corazón/canción).
 * For CJK: last 1-2 characters.
 * @param {string} phrase
 * @param {string} langCode
 * @returns {string}
 */
export function getEndingSound(phrase, langCode) {
    const text = phrase.trim();
    if (!text) return '';
    const lastChar = text.charAt(text.length - 1);

    // Chinese: last character
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(lastChar)) return lastChar;
    // Japanese (hiragana/katakana): last 2 chars
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(lastChar)) return text.slice(-2);
    // Korean: last character
    if (/[\uac00-\ud7af]/.test(lastChar)) return lastChar;
    // Thai: last 2 chars
    if (/[\u0e00-\u0e7f]/.test(lastChar)) return text.slice(-2);

    // Alphabetic languages: last 3 chars of last word (normalized)
    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1].replace(/[^\p{L}]/gu, '').toLowerCase();
    if (!lastWord) return '';
    return lastWord.slice(-3);
}

/**
 * Find a phrase from the pool whose ending matches the target ending sound.
 * Tries exact match first (3 chars), then relaxed (2 chars).
 * @param {string} targetEnding - ending sound to match
 * @param {string[]} pool - phrase pool to search
 * @param {Set} usedPhrases
 * @param {string} langCode
 * @param {function} rng
 * @returns {string|null}
 */
function findRhymingByEnding(targetEnding, pool, usedPhrases, langCode, rng) {
    if (!targetEnding) return null;
    const available = pool.filter(p => !usedPhrases.has(p) && !isTailUsed(p, usedPhrases));
    // Exact ending match
    const exact = available.filter(p => getEndingSound(p, langCode) === targetEnding);
    if (exact.length > 0) return pick(exact, rng);
    // Relaxed: last 2 chars match (for alphabetic), or same char class (for CJK)
    if (targetEnding.length >= 2) {
        const suffix2 = targetEnding.slice(-2);
        const relaxed = available.filter(p => getEndingSound(p, langCode).endsWith(suffix2));
        if (relaxed.length > 0) return pick(relaxed, rng);
    }
    return null;
}

// Build WORD_TO_FAMILY reverse lookup locally for rhyme-family checks
const WORD_TO_FAMILY = {};
for (const [family, words] of Object.entries(RHYME_FAMILIES)) {
    for (const word of words) {
        if (!WORD_TO_FAMILY[word]) WORD_TO_FAMILY[word] = [];
        WORD_TO_FAMILY[word].push(family);
    }
}

/**
 * Fisher-Yates shuffle (in-place) using the seeded RNG.
 * Much more efficient than .sort(() => rng() - 0.5) and doesn't
 * consume excessive RNG state on large arrays.
 */
function shuffleArray(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Force-generate a rhyming line using templates when pool search fails.
 * This is the GUARANTEED rhyme fallback — always produces a line ending
 * with a word from the same rhyme family as targetWord.
 * @param {string} targetWord
 * @param {function} rng
 * @param {string} mood
 * @returns {string|null}
 */
function forceRhymeLine(targetWord, rng, mood) {
    const rhymeWords = findRhymes(targetWord, 20, rng);
    if (rhymeWords.length === 0) return null;
    // Filter out words that produce nonsensical template lines
    const goodRhymes = rhymeWords.filter(w => !TEMPLATE_BLOCKLIST.has(w.toLowerCase()));
    const candidates = goodRhymes.length > 0 ? goodRhymes : rhymeWords;
    const word = pickTemplateWord(candidates, rng);
    const template = pickRhymeTemplate(word, rng);
    // IMPORTANT: Apply mood swaps to the template BEFORE inserting the rhyme
    // word. This prevents mood swaps (e.g. happy: 'dark'→'bright') from
    // destroying the rhyme ending.
    const moodTemplate = applyMoodToPhrase(template.replace('{rhyme}', '__RHYME__'), mood);
    return moodTemplate.replace('__RHYME__', word);
}

// Shared blocklist for template rhyme words — words that produce nonsensical
// lines when inserted into sentence templates like "I keep searching for the {rhyme}"
const TEMPLATE_BLOCKLIST = new Set([
    'bark', 'lark', 'hark', 'ark', 'narc',
    'clam', 'yam', 'ham', 'ram', 'dam', 'jam', 'pram',
    'cob', 'knob', 'blob', 'slob', 'snob', 'throb', 'lob',
    'dung', 'bung', 'rung', 'wrung', 'gung', 'clung',
    'cod', 'plod', 'prod', 'sod', 'wad', 'clod',
    'cud', 'thud', 'spud', 'stud', 'dud',
    'bog', 'cog', 'hog', 'tog', 'slog', 'smog',
    'mop', 'chop', 'flop', 'plop', 'slop', 'prop',
    'jab', 'tab', 'cab', 'dab', 'nab', 'scab',
    'twig', 'wig', 'jig', 'rig', 'fig', 'gig', 'pig', 'dig',
    'pew', 'dew', 'hew', 'mew', 'spew',
    'gut', 'rut', 'hut', 'jut', 'mutt', 'putt', 'butt', 'strut',
    'rug', 'tug', 'jug', 'mug', 'pug', 'slug', 'thug', 'shrug',
    'bum', 'gum', 'hum', 'plum', 'slum', 'scum',
    'cot', 'dot', 'jot', 'knot', 'lot', 'pot', 'rot', 'tot',
    'cap', 'gap', 'lap', 'map', 'nap', 'rap', 'sap', 'tap', 'zap', 'clap', 'flap', 'slap', 'snap', 'trap', 'wrap',
    'bat', 'cat', 'fat', 'hat', 'mat', 'pat', 'rat', 'sat', 'vat',
    'den', 'hen', 'pen', 'yen', 'wren',
    'bin', 'din', 'fin', 'gin', 'kin', 'pin', 'tin',
    'snack', 'swap', 'cardiac', 'mousetrap', 'kidnap', 'chap',
    'roadmap', 'workshop', 'rooftop', 'laptop', 'desktop', 'ketchup',
    'teacup', 'buttercup', 'hiccup', 'pickup', 'lineup', 'checkup',
    'doorstep', 'footstep', 'misstep', 'setup', 'backup', 'markup',
    'drawback', 'playback', 'setback', 'kickback', 'throwback', 'callback',
    'flashback', 'payback', 'cutback', 'comeback', 'outback', 'feedback',
    'knapsack', 'backpack', 'flapjack', 'crackerjack', 'lumberjack',
    'almanac', 'maniac', 'zodiac', 'insomniac',
    // --- Words that produce awkward/nonsensical sentences ---
    'porcupine', 'concubine', 'serpentine', 'trampoline', 'figurine',
    'tangerine', 'tambourine', 'wolverine', 'quarantine', 'gasoline',
    'limousine', 'magazine', 'nicotine', 'caffeine', 'morphine',
    'burlap', 'hubcap', 'bootstrap', 'rattrap', 'skullcap',
    'doorknob', 'corncob', 'cobweb',
    'beanbag', 'sandbag', 'handbag', 'airbag',
    // --- Words too short/generic for template rhyme slots ---
    'be', 'do', 'go', 'no', 'so', 'me', 'he', 'we', 'ye',
]);

// Sentence templates that can be filled with vocabulary (end with a noun/verb slot)
const TEMPLATES = {
    verse: [
        '{adjective} {noun} {verb}s in the {noun2}',
        'I {verb} beneath the {adjective} {noun}',
        'the {noun} {verb}s {adjective} and {adjective2}',
        '{adjective} shadows fall across the {noun}',
        'I found a {noun} inside the {noun2}',
        'the {adjective} {noun} whispers to the {noun2}',
        'we {verb} through {adjective} {noun}s',
        'every {noun} tells a {adjective} story',
        'the {noun} breaks and {verb}s once more',
        'I carry {adjective} {noun}s inside my {noun2}',
        // --- Multi-syllable rich templates ---
        'I {verb} the {noun} with {adjective} {noun2}',
        'they {verb} the {adjective} {noun} of {noun2}',
        'the {adjective} {noun} {verb}s through every {noun2}',
        'I {verb} every {adjective} {noun} and {noun2}',
        'we {verb} the {adjective} {noun} into {noun2}',
        'the {noun} and the {noun2} were {adjective}',
        'I never {verb} the {adjective} {noun} before',
        'through {adjective} {noun} I {verb} the {noun2}',
        'from the {noun} I {verb} {adjective} and {adjective2}',
        'every {adjective} {noun} I {verb} reminds me',
        'between the {noun} and {noun2} I {verb}',
        'the {adjective} {noun2} could never {verb} the {noun}',
        'I {verb} with {adjective} {noun} and {adjective2} {noun2}',
        'my {adjective} {noun} {verb}s beyond the {noun2}',
        'the {noun} of {noun2} {verb}s {adjective} tonight',
    ],
    chorus: [
        '{verb} me to the {adjective} {noun}',
        'we are {adjective} we are {adjective2}',
        'tonight we {verb} like {adjective} {noun}s',
        'I will {verb} until the {noun} {verb2}s',
        'come {verb} with me in the {noun}',
        '{adjective} {noun}s will light our way',
        'we {verb} together through the {noun}',
        'this {adjective} {noun} will never {verb}',
        // --- Multi-syllable rich templates ---
        'we {verb} and {verb2} through the {adjective} {noun}',
        '{adjective} and {adjective2} we own the {noun}',
        'I {verb} the {adjective} {noun} tonight',
        'the {adjective} {noun} is our {noun2} tonight',
        'we {verb} every {adjective} {noun} together',
        '{adjective} {noun} and {adjective2} {noun2} forever',
        'nothing is more {adjective} than this {noun}',
        'I am {adjective} I am {adjective2} I {verb}',
        'the {noun} of {noun2} is {adjective}',
        'every {adjective} {noun} we {verb} tonight',
        'this {adjective} {adjective2} {noun} will never end',
        'we {verb} the {adjective} {noun} again and again',
    ],
    bridge: [
        'and in the {noun} I finally see',
        'between the {noun} and the {noun2}',
        'the {adjective} truth behind the {noun}',
        'I let the {noun} {verb} through me',
        // --- Multi-syllable rich templates ---
        'through the {adjective} {noun} I {verb} the {noun2}',
        'every {adjective} {noun} has led me here',
        'the {noun} of {noun2} is {adjective} and {adjective2}',
        'I {verb} beyond the {adjective} {noun} tonight',
        'from {adjective} {noun} to {adjective2} {noun2}',
        'the {adjective} {noun} inside me starts to {verb}',
    ],
    prechorus: [
        'I can feel it rising up inside',
        'the {noun} is building can you feel it too',
        'something {adjective} is about to {verb}',
        'hold your breath the {noun} is near',
        // --- Multi-syllable rich templates ---
        'the {adjective} {noun} is ready to {verb}',
        'every {adjective} {noun} builds to the {noun2}',
        'I feel the {adjective} {noun} about to {verb}',
        'something {adjective} and {adjective2} is coming',
    ],
    intro: [
        'listen to the {noun}',
        'the {adjective} {noun} begins',
        'welcome to the {adjective} {noun}',
        '{adjective} {noun} is calling',
    ],
    outro: [
        'and so the {noun} {verb}s on',
        'we fade into the {adjective} {noun}',
        'the {adjective} {noun} {verb}s away',
        'we {verb} into the {adjective} {noun} forever',
    ],
};

// Templates designed to end with a specific rhyme word naturally.
// The {rhyme} placeholder is always the LAST word of the line.
// These produce grammatically correct sentences regardless of the rhyme word.
// Templates for NOUN rhyme words ("the {rhyme}" — works naturally with nouns)
const NOUN_TEMPLATES = [
    'I keep searching for the {rhyme}',
    'we were lost inside the {rhyme}',
    'nothing left except the {rhyme}',
    'I was dreaming of the {rhyme}',
    'standing in the {rhyme}',
    'holding on through every {rhyme}',
    'drifting closer to the {rhyme}',
    'everything reminds me of the {rhyme}',
    'somewhere underneath the {rhyme}',
    'I keep coming back to the {rhyme}',
    'another story - beyond the {rhyme}',
    'I was caught inside the {rhyme}',
    'we surrendered to the {rhyme}',
    'chasing down the {rhyme}',
    'we were dancing through the {rhyme}',
    'I could never leave the {rhyme}',
    'lost and found inside the {rhyme}',
    'we made it through the {rhyme}',
    'I gave it all for the {rhyme}',
    'they could never match the {rhyme}',
    'we found it in the {rhyme}',
    'I know I got the {rhyme}',
    'it hits me with the {rhyme}',
    'I rise above the {rhyme}',
    'they cannot stop the {rhyme}',
    'we left behind the {rhyme}',
    'I finally found the {rhyme}',
    'we built it from the {rhyme}',
    'it started with the {rhyme}',
    'they brought me to the {rhyme}',
];

// Templates for ADJECTIVE rhyme words (word used as a descriptor)
const ADJ_TEMPLATES = [
    'the night was cold and {rhyme}',
    'everything we built was {rhyme}',
    'I never knew the world was {rhyme}',
    'the streets were dark and {rhyme}',
    'they told me life was {rhyme}',
    'I felt my soul grow {rhyme}',
    'the vibe was getting {rhyme}',
    'they said the path was {rhyme}',
    'this life has been so {rhyme}',
    'the future looking {rhyme}',
];

// Templates for VERB rhyme words (word used as an action — "to {verb}" works with most verbs)
const VERB_TEMPLATES = [
    'I had to {rhyme} to find the way',
    'we learned to {rhyme} and carry on',
    'I was meant to {rhyme}',
    'they tried to {rhyme} but lost the fight',
    'we came to {rhyme} and take the crown',
    'I {rhyme} until the break of dawn',
    'we {rhyme} and we never fold',
    'I chose to {rhyme} and face it all',
    'they {rhyme} and the world takes note',
    'we gotta {rhyme} to make it through',
];

// ---- Part-of-speech detection for template selection ----
// Words from rhyme families that are VERBS (not usable as nouns in "the {word}" templates)
const KNOWN_VERBS = new Set([
    'contain', 'explain', 'maintain', 'obtain', 'detain', 'attain', 'sustain',
    'complain', 'restrain', 'constrain', 'abstain', 'ordain', 'remain',
    'expound', 'confound', 'astound', 'resound', 'surround',
    'compose', 'dispose', 'oppose', 'propose', 'impose', 'suppose',
    'enclose', 'disclose',
    'explore', 'ignore', 'restore', 'implore', 'deplore',
    'define', 'combine', 'refine', 'align', 'confine', 'resign', 'assign',
    'enshrine', 'intertwine', 'undermine', 'determine', 'imagine',
    'decide', 'provide', 'confide', 'collide',
    'inspire', 'admire', 'retire', 'conspire', 'require', 'acquire', 'expire',
    'survive', 'arrive', 'revive', 'derive', 'deprive', 'forgive',
    'behold', 'withhold', 'uphold', 'unfold', 'overflow',
    'defend', 'offend', 'pretend', 'attend', 'extend', 'intend', 'contend',
    'depend', 'transcend', 'descend', 'recommend', 'comprehend', 'apprehend',
    'conceal', 'appear', 'disappear', 'persevere', 'interfere', 'revere',
    'compete', 'complete', 'betray', 'convey', 'portray', 'obey', 'repay',
    'replace', 'erase', 'evade', 'invade', 'persuade',
    'compel', 'expel', 'propel', 'repel', 'dispel', 'excel',
    'redeem', 'follow', 'bestow', 'borrow', 'overflow', 'overthrow', 'outgrow',
]);

// Words from rhyme families that are ADJECTIVES (not usable as nouns)
const KNOWN_ADJECTIVES = new Set([
    'insane', 'mundane', 'humane', 'profane', 'arcane',
    'extreme', 'supreme', 'serene', 'sublime',
    'severe', 'sincere', 'profound',
    'polite', 'contrite',
    'surreal', 'unreal',
    'morose', 'verbose',
    'discreet', 'discrete', 'obsolete',
]);

// Suffix-based heuristic to guess likely part of speech
const ADJECTIVE_SUFFIXES = [
    'ory', 'ary', 'ive', 'ous', 'ful', 'less', 'able', 'ible', 'ical', 'ial', 'ular', 'etic', 'atic',
    // Past participle forms (function as adjectives: "was dominated", "felt obliterated")
    'ated', 'ized', 'ised', 'ified', 'ened', 'ered', 'ured', 'uted', 'pted', 'nted', 'sted',
];
const VERB_SUFFIXES = ['ize', 'ise', 'ify', 'ate', 'laim', 'eed', 'ude', 'ete'];

function guessWordType(word) {
    const w = word.toLowerCase();
    // Check known word lists first (most reliable)
    if (KNOWN_VERBS.has(w)) return 'verb';
    if (KNOWN_ADJECTIVES.has(w)) return 'adjective';
    if (w.length < 4) return 'noun'; // short words default to noun
    for (const s of ADJECTIVE_SUFFIXES) {
        if (w.endsWith(s) && w.length > s.length + 2) return 'adjective';
    }
    for (const s of VERB_SUFFIXES) {
        if (w.endsWith(s) && w.length > s.length + 2) return 'verb';
    }
    return 'noun';
}

function pickRhymeTemplate(word, rng) {
    const type = guessWordType(word);
    if (type === 'adjective') return ADJ_TEMPLATES[Math.floor(rng() * ADJ_TEMPLATES.length)];
    if (type === 'verb') return VERB_TEMPLATES[Math.floor(rng() * VERB_TEMPLATES.length)];
    return NOUN_TEMPLATES[Math.floor(rng() * NOUN_TEMPLATES.length)];
}

/**
 * Pick a word from a rhyme family that works well in templates.
 * Prefers words classified as nouns (which sound natural in noun templates).
 * Falls back to any word (pickRhymeTemplate handles POS for non-nouns).
 */
function pickTemplateWord(familyWords, rng) {
    const simple = familyWords.filter(w => !w.includes(' ') && !w.includes('-'));
    const nouns = simple.filter(w => guessWordType(w) === 'noun');
    if (nouns.length > 0) {
        return nouns[Math.floor(rng() * nouns.length)];
    }
    return simple.length > 0
        ? simple[Math.floor(rng() * simple.length)]
        : familyWords[Math.floor(rng() * familyWords.length)];
}

// Legacy alias for any remaining references
const RHYME_ENDING_TEMPLATES = NOUN_TEMPLATES;

/**
 * Simple seeded PRNG.
 * @param {number} seed
 * @returns {function}
 */
export function createRNG(seed) {
    let s = seed || Date.now();
    return function () {
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

/**
 * Fill a template string with vocabulary from a genre bank.
 * @param {string} template
 * @param {object} vocab - { nouns, verbs, adjectives }
 * @param {function} rng
 * @returns {string}
 */
function fillTemplate(template, vocab, rng) {
    const usedNouns = new Set();
    const usedAdj = new Set();

    return template.replace(/\{(\w+)\}/g, (match, key) => {
        if (key === 'noun' || key === 'noun2') {
            const available = vocab.nouns.filter(n => !usedNouns.has(n));
            const chosen = pick(available.length > 0 ? available : vocab.nouns, rng);
            usedNouns.add(chosen);
            return chosen;
        }
        if (key === 'verb' || key === 'verb2') {
            return pick(vocab.verbs, rng);
        }
        if (key === 'adjective' || key === 'adjective2') {
            const available = vocab.adjectives.filter(a => !usedAdj.has(a));
            const chosen = pick(available.length > 0 ? available : vocab.adjectives, rng);
            usedAdj.add(chosen);
            return chosen;
        }
        return match;
    });
}

/**
 * Construct a single line for a section.
 * @param {string} sectionType - 'verse', 'chorus', etc.
 * @param {string} genre
 * @param {string} mood
 * @param {number} targetSyllables
 * @param {string|null} rhymeWith - word to rhyme with, or null
 * @param {function} rng
 * @param {Set} usedPhrases - set of already-used phrases to avoid repetition
 * @returns {string}
 */
/**
 * Extract a tail fingerprint from a phrase — the last 5 words (lowercased).
 * Verb-variant lines share the same tail: "i spit past the limits they tried putting down"
 * and "i conquer past the limits they tried putting down" both have tail
 * "limits they tried putting down". Tracking tails prevents repetition.
 */
function getTailFingerprint(phrase) {
    const words = phrase.toLowerCase().split(/\s+/);
    return words.slice(-5).join(' ');
}

/**
 * Check if a phrase's tail fingerprint already exists in usedPhrases.
 */
function isTailUsed(phrase, usedPhrases) {
    const tail = getTailFingerprint(phrase);
    // Short phrases (≤5 words) use exact match only — tail = whole phrase
    if (phrase.split(/\s+/).length <= 5) return false;
    for (const used of usedPhrases) {
        if (used.split(/\s+/).length <= 5) continue;
        if (getTailFingerprint(used) === tail) return true;
    }
    return false;
}

export function constructLine(sectionType, genre, mood, targetSyllables, rhymeWith, rng, usedPhrases = new Set(), usePunchlines = false) {
    const bank = getActiveGenreBank(genre);
    const langCode = getGenerationLanguage();
    const isNonEnglish = langCode && langCode !== 'en';

    // Get section-specific and all-genre phrase pools
    let phrasePool = getPhrasePool(bank, sectionType);
    let allPhrases = getAllPhrases(bank);

    // For non-English languages, skip English rhyme engine entirely.
    // Just pick from the localized phrase pool (rhyme strategies are English-only).
    if (isNonEnglish) {
        const vocab = bank.vocabulary || {};
        const available = phrasePool.filter(p => !usedPhrases.has(p) && !isTailUsed(p, usedPhrases));
        if (available.length > 0) {
            const chosen = fillTemplatePlaceholders(pick(available, rng), vocab, rng);
            usedPhrases.add(chosen);
            return applyMoodToPhrase(chosen, mood);
        }
        // Section pool exhausted — try all phrases
        const allAvailable = allPhrases.filter(p => !usedPhrases.has(p) && !isTailUsed(p, usedPhrases));
        if (allAvailable.length > 0) {
            const chosen = fillTemplatePlaceholders(pick(allAvailable, rng), vocab, rng);
            usedPhrases.add(chosen);
            return applyMoodToPhrase(chosen, mood);
        }
        // All exhausted — reuse from pool (reset used set for this pool)
        const chosen = fillTemplatePlaceholders(pick(phrasePool, rng) || '', vocab, rng);
        return applyMoodToPhrase(chosen, mood);
    }

    // Mix punchline phrases into pools when enabled (~50% of pool for strong presence)
    if (usePunchlines) {
        const punchlines = getPunchlinePhrases(mood.toLowerCase());
        const punchlineCount = Math.floor(phrasePool.length * 0.5);
        const shuffled = [...punchlines];
        shuffleArray(shuffled, rng);
        phrasePool = [...phrasePool, ...shuffled.slice(0, punchlineCount)];
        allPhrases = [...allPhrases, ...shuffled.slice(0, Math.floor(allPhrases.length * 0.5))];
    }

    if (rhymeWith) {
        // Strategy 0: When punchlines enabled, search PUNCHLINE pool FIRST for the
        // rhyming partner. This creates proper setup → punchline flow (AABB).
        if (usePunchlines) {
            const punchlines = getPunchlinePhrases(mood.toLowerCase());
            const punchlineRhyme = findRhymingPhrase(rhymeWith, punchlines.filter(p => !usedPhrases.has(p) && !isTailUsed(p, usedPhrases)), rng);
            if (punchlineRhyme) {
                usedPhrases.add(punchlineRhyme);
                return applyMoodToPhrase(punchlineRhyme, mood);
            }
        }

        // Strategy 1: Find a prebuilt phrase from the SECTION pool that naturally rhymes
        const sectionRhyme = findRhymingPhrase(rhymeWith, phrasePool.filter(p => !usedPhrases.has(p) && !isTailUsed(p, usedPhrases)), rng);
        if (sectionRhyme) {
            usedPhrases.add(sectionRhyme);
            return applyMoodToPhrase(sectionRhyme, mood);
        }

        // Strategy 2: Search ALL phrase pools (openers + verses + choruses + bridges)
        const allRhyme = findRhymingPhrase(rhymeWith, allPhrases.filter(p => !usedPhrases.has(p) && !isTailUsed(p, usedPhrases)), rng);
        if (allRhyme) {
            usedPhrases.add(allRhyme);
            return applyMoodToPhrase(allRhyme, mood);
        }

        // Strategy 3: Use a rhyme-ending template with a rhyming word.
        // This produces a grammatically complete sentence ending with a rhyme word.
        const rhymeWords = findRhymes(rhymeWith, 15, rng);
        // Filter to prefer words that make sense in sentence templates
        const goodRhymes = rhymeWords.filter(w => w.length <= 10 && !w.includes('-') && !TEMPLATE_BLOCKLIST.has(w));
        const rhymeCandidates = goodRhymes.length > 0 ? goodRhymes : rhymeWords;
        if (rhymeCandidates.length > 0) {
            const rhymeWord = pickTemplateWord(rhymeCandidates, rng);
            const template = pickRhymeTemplate(rhymeWord, rng);
            // Apply mood BEFORE inserting rhyme word to protect rhyme ending
            const moodTemplate = applyMoodToPhrase(template.replace('{rhyme}', '__RHYME__'), mood);
            return moodTemplate.replace('__RHYME__', rhymeWord);
        }

        // Strategy 4: No rhyme words found at all — just pick a coherent phrase
        // A non-rhyming line is far better than a nonsensical one
    }

    // No rhyme needed, or couldn't fulfill the rhyme — pick a good phrase
    const availablePhrases = phrasePool.filter(p => !usedPhrases.has(p) && !isTailUsed(p, usedPhrases));
    if (availablePhrases.length > 0) {
        const chosen = pick(availablePhrases, rng);
        usedPhrases.add(chosen);
        return applyMoodToPhrase(chosen, mood);
    }

    // Phrase pool exhausted — generate from template
    const templates = TEMPLATES[sectionType] || TEMPLATES.verse;
    const template = pick(templates, rng);
    const line = fillTemplate(template, bank.vocabulary, rng);
    return applyMoodToPhrase(line, mood);
}

/**
 * Get ALL phrases from a genre bank across all section types.
 * Used to widen the rhyme search beyond just the current section.
 * @param {object} bank
 * @returns {string[]}
 */
function getAllPhrases(bank) {
    return [
        ...(bank.openers || []),
        ...(bank.verses || []),
        ...(bank.choruses || []),
        ...(bank.bridges || []),
    ];
}

/**
 * Get the appropriate phrase pool from a bank for a section type.
 * @param {object} bank
 * @param {string} sectionType
 * @returns {string[]}
 */
function getPhrasePool(bank, sectionType) {
    switch (sectionType) {
        case 'chorus': return [...(bank.choruses || [])];
        case 'bridge': return [...(bank.bridges || []), ...(bank.verses || []).slice(0, 4)];
        case 'prechorus': return [...(bank.bridges || []), ...(bank.choruses || []).slice(0, 2)];
        case 'intro': return [...(bank.openers || []).slice(0, 4)];
        case 'outro': return [...(bank.bridges || []), ...(bank.choruses || []).slice(0, 2)];
        case 'verse':
        default:
            return [...(bank.openers || []), ...(bank.verses || [])];
    }
}

/**
 * Construct multiple lines for a section with rhyme scheme enforcement.
 * @param {string} sectionType
 * @param {number} lineCount
 * @param {string} genre
 * @param {string} mood
 * @param {number[]} syllableTargets
 * @param {string} rhymePattern - e.g. 'AABB'
 * @param {function} rng
 * @param {Set} usedPhrases
 * @returns {string[]}
 */
/**
 * Check if line index i is the first of a rhyme pair (i.e., the next occurrence
 * of the same pattern letter hasn't been generated yet).
 */
function isFirstOfPair(i, rhymePattern, schemeLen, rhymeGroups) {
    const patternChar = rhymePattern[i % schemeLen] || 'X';
    if (patternChar === 'X') return false;
    return !rhymeGroups[patternChar];
}

/**
 * Count how many phrases in a pool rhyme with a given ending word.
 */
function countAvailableRhymesInPool(endWord, phrasePool, usedPhrases) {
    if (!endWord) return 0;
    return phrasePool.filter(p => {
        if (usedPhrases.has(p)) return false;
        const lw = getLastWord(p);
        return lw && lw !== endWord && wordsRhyme(endWord, lw);
    }).length;
}

/**
 * Add a cadence break " - " at the best natural pause point in a line.
 * Simulates where a rapper would breathe/pause for rhythm.
 * @param {string} line
 * @returns {string}
 */
function addCadenceBreak(line) {
    if (line.includes(' - ')) return line; // already has a break
    const words = line.split(' ');
    if (words.length < 4) return line; // too short for a meaningful break

    // Clause-starting words get a bonus when they appear at the break point
    const clauseStarters = new Set([
        'and', 'but', 'or', 'so', 'then', 'when', 'while', 'never', 'always',
        'still', 'yet', 'now', 'where', 'cause', 'because', 'if',
        'like', 'just', 'until', 'before', 'after', 'without', 'within',
        'wherever', 'whenever', 'however', 'whatever', 'whoever',
        'who', 'which', 'watch', 'let',
        'i', 'it', // subject pronouns naturally introduce a new clause
        // Contractions and pronouns that start new clauses
        "that's", "it's", "there's", "here's", "what's", "who's",
        "he's", "she's", "they're", "we're", "you're", "i'm",
    ]);
    // True clause introducers (pronouns + conjunctions): exempt from early-break penalty
    // because "no delays - I got nothing" is fine; "drip - so hard they tripping" is not
    const clauseIntroducers = new Set([
        'i', 'we', 'they', 'you', 'it', 'he', 'she', 'who', 'which',
        'and', 'but', 'or', 'so', 'cause', 'because',
        'if', 'then', 'when', 'while', 'now', 'where', 'after', 'before', 'until',
    ]);
    // Weak function words that shouldn't start the second half
    // NOTE: subject pronouns (we, he, she, it, they) are NOT here — they're fine
    // as second-half openers ("we revolutionized the sound - and made it right")
    const functionWords = new Set([
        'in', 'on', 'at', 'to', 'for', 'by', 'of', 'a', 'the',
        'is', 'are', 'was', 'were', 'will', 'can',
        'my', 'his', 'her', 'its', 'our', 'an', 'no',
        'from', 'with', 'into', 'onto', 'as', 'do',
        'me', 'him', 'them', 'us', 'against',
    ]);
    // Possessives and pronouns — should NEVER be left dangling before the dash
    // e.g. "riding with my - squad" or "money on my - mind" or "we - dominated"
    const weakPrev = new Set([
        'my', 'your', 'their', 'our', 'i', 'he', 'she', 'they', 'we', 'you',
        "i'm", "i've", "i'd", "i'll", "they're", "we're", "you're", "she's", "he's",
        'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
        'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
        'has', 'have', 'had',
        'it', 'these', 'those', 'this', 'that', 'all', 'both', 'such',
        'till', 'until', 'since', 'when', 'while', 'before', 'after',
        'and', 'but', 'or', 'nor', 'yet', 'than', 'so',
        'no', 'not', 'just', 'only', 'even',
        "that's", "it's", "there's", "here's", "what's", "who's",
    ]);
    // Articles and determiners — should NEVER be left dangling before the dash
    const articles = new Set(['a', 'an', 'the', 'every', 'each', 'any', 'some', 'no', 'these', 'those', 'this', 'that', 'all', 'both', 'such', 'another', 'other', 'many', 'few', 'several', 'certain']);
    // Prepositions — never leave dangling before the dash; also penalized as second-half starters
    const prepositions = new Set([
        'in', 'on', 'at', 'to', 'for', 'by', 'of', 'with', 'from',
        'into', 'onto', 'upon', 'through', 'across', 'over', 'under', 'about', 'between',
    ]);
    // Phrasal-verb particles: the narrow set that completes a verb
    // "searching FOR", "running THROUGH" — splits these off; NOT "coming UNDER attack"
    // True phrasal verb particles — tightly bound to the verb (never break "running out", "looking up")
    const phrasalParticles = new Set([
        'up', 'out', 'off', 'down', 'around', 'through', 'over', 'into', 'onto', 'upon', 'across', 'under', 'on', 'in',
    ]);
    // Clause-introducing words — OK to break before these after a gerund or content word
    // "buzzing - with a brand new deal", "pushing - till I get my pay"
    const clausePrepositions = new Set([
        'with', 'from', 'for', 'in', 'on', 'at', 'to', 'of', 'by', 'about',
        'till', 'until', 'since', 'cause', 'because', 'when', 'while', 'before', 'after',
        'wherever', 'whenever', 'however', 'whatever', 'whoever',
        'and', 'but', 'or', 'nor', 'yet', 'than',
    ]);

    // Common compound phrases that must never be split
    const compoundPairs = [
        ['grand', 'slam'], ['slam', 'dunk'],
        ['day', 'night'], ['life', 'death'], ['left', 'right'], ['rise', 'fall'],
        ['concrete', 'jungle'], ['rat', 'race'], ['cold', 'world'],
        ['real', 'talk'], ['trap', 'house'], ['big', 'picture'],
        ['front', 'line'], ['finish', 'line'], ['bottom', 'line'],
        ['game', 'plan'], ['master', 'plan'], ['escape', 'plan'],
        ['brand', 'new'], ['old', 'school'], ['new', 'school'],
        ['hundred', 'percent'], ['non', 'stop'], ['nonstop', 'grind'],
        ['how', 'much'], ['how', 'many'], ['how', 'long'], ['how', 'far'],
        ['so', 'much'], ['so', 'many'], ['so', 'long'], ['so', 'far'],
        ['too', 'much'], ['too', 'many'], ['too', 'long'], ['too', 'far'],
        ['like', 'that'], ['like', 'this'], ['just', 'like'], ['feel', 'like'],
        ['broke', 'the'], ['break', 'the'],
        // Multi-word artist/celebrity names — never split
        ['thee', 'stallion'], ['lil', 'baby'], ['lil', 'wayne'], ['lil', 'uzi'],
        ['ice', 'cube'], ['young', 'thug'], ['kid', 'cudi'], ['big', 'sean'],
        ['cardi', 'b'], ['missy', 'elliott'], ['lauryn', 'hill'], ['andre', '3000'],
        ['tyler', 'the'], ['the', 'creator'], ['j', 'cole'],
        // Song/album title fragments
        ['hot', 'girl'], ['girl', 'summer'], ['mask', 'off'],
        ['flower', 'boy'], ['good', 'day'], ['forest', 'hills'],
    ];

    // Common adjectives that modify the next noun — never split from their noun
    const commonAdjectives = new Set([
        'heavy', 'crazy', 'lazy', 'easy', 'busy', 'dirty', 'empty', 'lucky', 'happy',
        'nasty', 'dusty', 'rusty', 'mighty', 'pretty', 'ugly', 'holy', 'deadly',
        'ready', 'steady', 'bloody', 'shady', 'greedy', 'speedy', 'needy',
        'big', 'bad', 'raw', 'real', 'true', 'pure', 'cold', 'hard', 'dark',
        'deep', 'high', 'low', 'long', 'strong', 'young', 'old', 'new', 'fresh',
        'loud', 'quiet', 'smooth', 'rough', 'tough', 'soft', 'sharp', 'flat',
        'whole', 'full', 'free', 'main', 'last', 'first', 'next', 'only',
    ]);

    // Target: true midpoint for all line lengths
    const targetIdx = Math.max(2, Math.round(words.length * 0.5));

    // Score EVERY valid break position (index 2 through length-2)
    let bestIdx = -1;
    let bestScore = -Infinity;

    // Always require at least 2 words before the dash — avoids "TOO_EARLY" breaks
    const minIdx = 2;
    for (let i = minIdx; i <= words.length - 2; i++) {
        const w = words[i].toLowerCase();
        const prev = words[i - 1].toLowerCase();

        // Base score: distance from target (closer = better)
        let score = -Math.abs(i - targetIdx) * 2;

        // === Bonuses ===
        // Clause starters make great second-half openers
        if (clauseStarters.has(w)) score += 5;
        // Primary conjunctions are the strongest natural break points
        if (w === 'and' || w === 'but' || w === 'or' || w === 'so' || w === 'then' || w === 'cause') score += 4;
        // Relative pronouns / imperative verbs introduce subordinate clauses — very strong break
        // "the comeback kid - who never left", "ambition - watch me fill another cup"
        if (w === 'who' || w === 'which' || w === 'watch' || w === 'let') score += 8;
        // Negation/emphasis words starting second half = strong clause boundary
        // "running up the bag - no looking back", "built my empire - just me and the mic"
        if (w === 'no' || w === 'not' || w === 'never' || w === 'just' || w === 'only' || w === 'even') score += 3;
        // Modal/auxiliary verbs starting second half after a content word = natural clause
        // "the ones who left - will wish they stayed", "the hustle paid off - and we made it"
        if ((w === 'will' || w === 'would' || w === 'could' || w === 'should' || w === 'can' || w === 'might' || w === 'must') &&
            prev.length >= 3 && !functionWords.has(prev) && !articles.has(prev)) score += 5;
        // Content words (4+ chars, not function words) are decent break points
        if (w.length >= 4 && !functionWords.has(w) && !prepositions.has(w)) score += 2;
        // Speech/quote verbs before break = natural clause boundary ("Cardi B said - I like it")
        if (prev === 'said' || prev === 'told' || prev === 'asked' || prev === 'yelled' || prev === 'screamed') score += 4;
        // Breaking after a long content word feels natural (end of a phrase)
        if (prev.length >= 4 && !articles.has(prev) && !prepositions.has(prev) && !weakPrev.has(prev)) score += 1.5;
        // Breaking after a verb (common verb endings) is a natural clause boundary
        if (prev.length >= 4 && (prev.endsWith('ed') || prev.endsWith('ize') || prev.endsWith('ise') || prev.endsWith('ate') || prev.endsWith('fy'))) score += 1;
        // Breaking after -tion/-sion nouns is a very strong phrase boundary
        // "retaliation - is the only way", "ambition - watch me fill another cup"
        if (prev.length >= 5 && (prev.endsWith('tion') || prev.endsWith('sion') || prev.endsWith('ness') || prev.endsWith('ment') || prev.endsWith('egy') || prev.endsWith('ogy') || prev.endsWith('ity') || prev.endsWith('ence') || prev.endsWith('ance'))) score += 5;
        // Breaking after common clause-ending words (verbs/nouns that complete a thought)
        if (prev === 'back' || prev === 'stops' || prev === 'ends' || prev === 'starts' || prev === 'falls' || prev === 'drops') score += 2;
        // Determiner/article starting second half introduces a new noun phrase — natural break
        // "reads - another classic", "built - every empire", "crossed - the finish line"
        if (articles.has(w)) score += 3;
        // Gerund before break = natural phrase end
        // "squad eating - that's a fact", "money flowing - make it rain", "buzzing - with a brand new deal"
        // Exclude non-gerund words ending in 'ing' (sing, ring, king, thing, bring, spring, string, swing, etc.)
        const notGerund = new Set([
            'sing', 'ring', 'king', 'thing', 'bring', 'spring', 'string', 'swing', 'sting',
            'fling', 'cling', 'sling', 'wring', 'wing', 'ping', 'ding', 'bling', 'ming',
            'anything', 'everything', 'nothing', 'something', 'wellspring', 'offspring',
        ]);
        const isGerund = prev.endsWith('ing') && prev.length >= 5 && !notGerund.has(prev);
        if (isGerund && !phrasalParticles.has(w) && !functionWords.has(w)) score += 3;
        // Gerund + clause preposition is a very natural break: "buzzing - with a deal"
        // Strong bonus to overcome function-word/preposition penalties on the clause word
        if (isGerund && clausePrepositions.has(w)) score += 8;
        // Content word + clause preposition/conjunction = natural phrase boundary
        // "engineered my future - in a basement", "schooled the game - and never got a degree"
        if (prev.length >= 4 && !functionWords.has(prev) && !articles.has(prev) && !prepositions.has(prev) && !weakPrev.has(prev) && clausePrepositions.has(w)) score += 6;

        // === Penalties ===
        // Function words are weak second-half starters — but exempt articles/determiners
        // since they naturally introduce new noun phrases ("don't stop - the grind evolves")
        if (functionWords.has(w) && !articles.has(w)) score -= 4;
        // Prepositions starting the second half — almost always wrong
        if (prepositions.has(w)) score -= 3;
        // Articles before the dash — NEVER break "the|noun" or "a|noun"
        if (articles.has(prev)) score -= 15;
        // Preposition before the dash — NEVER break "in|the X" or "of|the Y"
        if (prepositions.has(prev)) score -= 12;
        // Auxiliary verbs, pronouns, possessives before dash — NEVER dangle
        // "energy is -" or "everything i -" or "we -" are all wrong
        if (weakPrev.has(prev)) score -= 15;
        // Any -ing word + phrasal particle = splits phrasal unit ("searching - for", "sing - in")
        if (prev.endsWith('ing') && phrasalParticles.has(w)) score -= 12;
        // Adjective before noun — never split "golden|runway", "broken|promise", "heavy|crown"
        // Detect adjectives by common suffixes: -en, -al, -ful, -ous, -ive, -less, -ish, -ic, -ed (past participle as adj)
        // Long -ed words (8+ chars) like "surrendered", "revolutionized" are verbs, not adjectives
        const isLikelyAdjectiveEnding = (
            prev.endsWith('en') || prev.endsWith('al') || prev.endsWith('ful') || prev.endsWith('ous') ||
            prev.endsWith('ive') || prev.endsWith('less') || prev.endsWith('ish') || prev.endsWith('ic') ||
            (prev.endsWith('ed') && prev.length < 8) || prev.endsWith('ly') || prev.endsWith('nt') || prev.endsWith('id') ||
            prev.endsWith('ship') || prev.endsWith('ment') || commonAdjectives.has(prev)
        );
        if (prev.length >= 4 && !functionWords.has(prev) && !prepositions.has(prev) &&
            w.length >= 4 && !functionWords.has(w) && !clausePrepositions.has(w) &&
            isLikelyAdjectiveEnding)
            score -= 8;
        // Past-tense verb-form before break is slightly awkward ("wanted - to")
        if (prev.endsWith('ted') || prev.endsWith('ned') || prev.endsWith('ped')) score -= 2;
        // Very short words (≤2 chars) before dash are almost always wrong
        // BUT exempt phrasal particles — "stack up - and let it flow" is natural
        // AND exempt object pronouns — "doubted me - but I refused" is natural
        // Words that naturally end a clause despite being short (≤2 chars)
        const shortButValid = new Set(['me', 'us', 'em', 'it', 'up', 'go', 'do']);
        if (prev.length <= 2 && !phrasalParticles.has(prev) && !shortButValid.has(prev)) score -= 10;
        // Avoid very early breaks on longer lines — but exempt true clause introducers
        // so "no delays - I got nothing" works while "drip - so hard" doesn't
        if (i < 3 && words.length >= 6 && !clauseIntroducers.has(w)) score -= 5;
        // Avoid breaking before a conjunction near the end
        if (clauseStarters.has(w) && i >= words.length - 2) score -= 4;
        // Single-char words are poor break starters — but "I" is fine as subject
        if (w.length <= 1 && w !== 'i') score -= 10;
        // Compound phrase protection
        for (const [first, second] of compoundPairs) {
            if (prev === first && w === second) { score -= 15; break; }
        }

        // Tie-breaking: prefer position closer to target; equal distance → prefer later
        if (score > bestScore ||
            (score === bestScore && Math.abs(i - targetIdx) < Math.abs(bestIdx - targetIdx)) ||
            (score === bestScore && Math.abs(i - targetIdx) === Math.abs(bestIdx - targetIdx) && i > bestIdx)) {
            bestScore = score;
            bestIdx = i;
        }
    }

    // Quality gate: if no position scored well, skip the break entirely
    if (bestScore < -6) return line;

    if (bestIdx >= minIdx && bestIdx <= words.length - 2) {
        return words.slice(0, bestIdx).join(' ') + ' - ' + words.slice(bestIdx).join(' ');
    }
    return line;
}

export function constructSection(sectionType, lineCount, genre, mood, syllableTargets, rhymePattern, rng, usedPhrases = new Set(), usePunchlines = false) {
    const lines = [];
    const rhymeGroups = {}; // letter -> last word of first line in group
    const usedEndWords = new Set(); // Track ending words to prevent same-word "rhymes"

    const schemeLen = rhymePattern ? rhymePattern.length : 4;
    const langCode = getGenerationLanguage();
    const isNonEnglish = langCode && langCode !== 'en';

    // Pre-gather phrase pool for look-ahead scoring
    const bank = getActiveGenreBank(genre);
    let allPhrases = [
        ...(bank.openers || []),
        ...(bank.verses || []),
        ...(bank.choruses || []),
        ...(bank.bridges || []),
    ];

    // Mix punchline phrases into the look-ahead pool (50% for strong presence)
    if (usePunchlines && !isNonEnglish) {
        const punchlines = getPunchlinePhrases(mood.toLowerCase());
        const punchlineCount = Math.floor(allPhrases.length * 0.5);
        const shuffled = [...punchlines];
        shuffleArray(shuffled, rng);
        allPhrases = [...allPhrases, ...shuffled.slice(0, punchlineCount)];
    }

    for (let i = 0; i < lineCount; i++) {
        const target = syllableTargets[i] || 8;
        // IMPORTANT: wrap pattern with modulo so verses with 6+ lines still rhyme
        const patternChar = rhymePattern[i % schemeLen] || 'X';
        let rhymeWith = null;

        if (patternChar !== 'X' && rhymeGroups[patternChar]) {
            rhymeWith = rhymeGroups[patternChar];
        }

        let line;

        // For non-English languages, use ending-sound matching for rhymes
        // instead of the English phonetic rhyme engine.
        if (isNonEnglish) {
            if (rhymeWith) {
                // rhymeWith is the ending sound stored from the first line of this pair
                const sectionPool = getPhrasePool(bank, sectionType);
                const match = findRhymingByEnding(rhymeWith, sectionPool, usedPhrases, langCode, rng)
                    || findRhymingByEnding(rhymeWith, allPhrases, usedPhrases, langCode, rng);
                if (match) {
                    usedPhrases.add(match);
                    line = applyMoodToPhrase(match, mood);
                } else {
                    // No rhyme match found — pick best available
                    line = constructLine(sectionType, genre, mood, target, null, rng, usedPhrases, false);
                }
            } else {
                line = constructLine(sectionType, genre, mood, target, null, rng, usedPhrases, false);
            }
        // LOOK-AHEAD: When this is the first line of a rhyme pair, try multiple
        // candidates and REQUIRE that the ending word is in a known rhyme family.
        // This guarantees the follow-up line can find rhymes.
        } else if (isFirstOfPair(i, rhymePattern, schemeLen, rhymeGroups)) {
            const LOOK_AHEAD_TRIES = 12;
            let bestLine = null;
            let bestScore = -1;

            for (let t = 0; t < LOOK_AHEAD_TRIES; t++) {
                // First-of-pair = SETUP line (no celebrity punchlines here).
                // Punchlines go in second-of-pair for proper setup → payoff flow.
                const candidate = constructLine(sectionType, genre, mood, target, null, rng, usedPhrases, false);
                const endW = getLastWord(candidate);
                if (!endW || usedEndWords.has(endW.toLowerCase())) continue;

                // Check if ending word is in a known rhyme family
                const endClean = endW.toLowerCase().replace(/[^a-z]/g, '');
                const inKnownFamily = !!(WORD_TO_FAMILY[endClean] && WORD_TO_FAMILY[endClean].length > 0);
                const rhymeCount = countAvailableRhymesInPool(endW, allPhrases, usedPhrases);

                // Score: known family gets +1000 base, plus pool rhyme count
                const score = (inKnownFamily ? 1000 : 0) + rhymeCount;
                if (score > bestScore) {
                    bestScore = score;
                    bestLine = candidate;
                }
                // If we have a known-family word with 3+ pool matches, great
                if (inKnownFamily && rhymeCount >= 3) break;
            }

            // If no candidate has a known-family ending WITH pool matches, use a
            // template with a word from a rich rhyme family to guarantee the partner
            // line can find a pre-written pool phrase (not a generic template).
            // Require score >= 1001 = known family (1000) + at least 1 pool match (1)
            if (bestScore < 1001) {
                // Pick from families that HAVE pool phrases ending in their words.
                // This guarantees the partner line can use a pre-written phrase.
                const richFamilies = Object.entries(RHYME_FAMILIES)
                    .filter(([, words]) => words.length >= 8)
                    .map(([fam, words]) => ({ fam, words }));
                // Shuffle and find a family with actual pool coverage
                shuffleArray(richFamilies, rng);
                let picked = false;
                for (const { fam, words } of richFamilies) {
                    // Check if any pool phrase ends in a word from this family
                    const poolHasMatch = allPhrases.some(p => {
                        const lw = getLastWord(p);
                        return lw && words.includes(lw.toLowerCase());
                    });
                    if (poolHasMatch) {
                        const word = pickTemplateWord(words, rng);
                        const template = pickRhymeTemplate(word, rng);
                        const mt = applyMoodToPhrase(template.replace('{rhyme}', '__RHYME__'), mood);
                        bestLine = mt.replace('__RHYME__', word);
                        picked = true;
                        break;
                    }
                }
                // Final fallback: any rich family
                if (!picked && richFamilies.length > 0) {
                    const { words } = richFamilies[0];
                    const word = pickTemplateWord(words, rng);
                    const template = pickRhymeTemplate(word, rng);
                    const mt = applyMoodToPhrase(template.replace('{rhyme}', '__RHYME__'), mood);
                    bestLine = mt.replace('__RHYME__', word);
                }
            }

            // IMPORTANT: first-of-pair lines must NOT be punchlines — punchlines go in the
        // second-of-pair (payoff) slot. Using `false` prevents celebrity-name endings
        // that have no rhyme family and would leave the partner line unrhymeable.
        line = bestLine || constructLine(sectionType, genre, mood, target, null, rng, usedPhrases, false);
        } else {
            line = constructLine(sectionType, genre, mood, target, rhymeWith, rng, usedPhrases, usePunchlines);
        }

        if (isNonEnglish) {
            // Non-English: add cadence break, store ending sound for rhyme groups
            lines.push(addCadenceBreak(line));
            if (patternChar !== 'X' && !rhymeGroups[patternChar]) {
                rhymeGroups[patternChar] = getEndingSound(line, langCode);
            }
        } else {
            // English: full rhyme verification and dedup
            // Prevent same ending word across lines — retry if needed
            let endWord = getLastWord(line);
            if (endWord && usedEndWords.has(endWord.toLowerCase())) {
                for (let retry = 0; retry < 3; retry++) {
                    const alt = constructLine(sectionType, genre, mood, target, rhymeWith, rng, usedPhrases, usePunchlines);
                    const altEnd = getLastWord(alt);
                    if (altEnd && !usedEndWords.has(altEnd.toLowerCase())) {
                        line = alt;
                        endWord = altEnd;
                        break;
                    }
                }
            }

            // ===== RHYME VERIFICATION =====
            // If this line was supposed to rhyme with an earlier line, VERIFY it.
            // If it doesn't rhyme, force a rhyming line via template.
            if (rhymeWith) {
                const lineEnd = getLastWord(line);
                if (!lineEnd || !wordsRhyme(rhymeWith, lineEnd)) {
                    const forced = forceRhymeLine(rhymeWith, rng, mood);
                    if (forced) {
                        line = forced;
                    } else {
                        // Secondary fallback: find ANY word from a rhyme family that matches
                        const targetClean = rhymeWith.toLowerCase().replace(/[^a-z]/g, '');
                        for (const [, familyWords] of Object.entries(RHYME_FAMILIES)) {
                            if (familyWords.includes(targetClean)) {
                                const usable = familyWords.filter(w => w !== targetClean && !TEMPLATE_BLOCKLIST.has(w));
                                if (usable.length > 0) {
                                    const word = usable[Math.floor(rng() * usable.length)];
                                    const template = pickRhymeTemplate(word, rng);
                                    const mt = applyMoodToPhrase(template.replace('{rhyme}', '__RHYME__'), mood);
                                    line = mt.replace('__RHYME__', word);
                                }
                                break;
                            }
                        }
                    }
                }
            }

            // Add cadence break for natural rhythm/pause marking
            const finalEnd = getLastWord(line);
            lines.push(addCadenceBreak(line));
            if (finalEnd) usedEndWords.add(finalEnd.toLowerCase());

            // Store the last word for rhyme group (first occurrence of this letter)
            if (patternChar !== 'X' && !rhymeGroups[patternChar]) {
                rhymeGroups[patternChar] = finalEnd || getLastWord(line);
            }
        }
    }

    return lines;
}

export { TEMPLATES };
