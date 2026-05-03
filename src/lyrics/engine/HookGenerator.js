/**
 * HookGenerator — Creates memorable, repeating hook phrases for choruses.
 * Ensures strong rhyme, emotional impact, and repetition with variation.
 */

import { getGenreBank, getMoodModifier, pick } from './GenreBank';
import { findRhymes, wordsRhyme, getLastWord, RHYME_FAMILIES, getActiveRhymeFamilies, getActiveWordToFamily } from './RhymeEngine';
import { countLineSyllables, countSyllables } from './SyllableBalancer';
import { getPunchlinePhrases } from './PunchlineBank';
import { getLocalizedGenreBank, getGenerationLanguage } from './PhraseLoader';

function getActiveGenreBank(genre) {
    const langCode = getGenerationLanguage();
    if (langCode && langCode !== 'en') {
        return getLocalizedGenreBank(genre, langCode, getGenreBank);
    }
    return getGenreBank(genre);
}

// Build WORD_TO_FAMILY reverse lookup locally for rhyme-family checks
const WORD_TO_FAMILY_HOOK = {};
for (const [family, words] of Object.entries(RHYME_FAMILIES)) {
    for (const word of words) {
        if (!WORD_TO_FAMILY_HOOK[word]) WORD_TO_FAMILY_HOOK[word] = [];
        WORD_TO_FAMILY_HOOK[word].push(family);
    }
}

/**
 * Get the active word-to-family lookup (localized or English fallback).
 * @returns {object}
 */
function getWordToFamily() {
    return getActiveWordToFamily() || WORD_TO_FAMILY_HOOK;
}

/**
 * Get the active rhyme families (localized or English fallback).
 * @returns {object}
 */
function getRhymeFamiliesForHook() {
    return getActiveRhymeFamilies() || RHYME_FAMILIES;
}

// Localized hook templates reference — set by LyricEngine before generation
let _localizedHookBank = null;

/**
 * Set the localized hook/phrase bank for non-English hook generation.
 * @param {object|null} bank - locale phrase bank with hookTemplates, genreHookTemplates, etc.
 */
export function setLocalizedHookBank(bank) {
    _localizedHookBank = bank;
}

/**
 * Get hook templates — localized if available, otherwise English.
 * @returns {string[]}
 */
function getActiveHookTemplates() {
    if (_localizedHookBank?.hookTemplates?.length > 0) {
        return _localizedHookBank.hookTemplates;
    }
    return HOOK_TEMPLATES;
}

/**
 * Fisher-Yates shuffle (in-place) using the seeded RNG.
 */
function shuffleArray(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Words that sound nonsensical when used as nouns/verbs in hook templates
const HOOK_VOCAB_BLOCKLIST = new Set([
    'bread', 'read', 'thread', 'tread', 'spread', 'lead', 'shed', 'bed', 'fed', 'wed',
    'bark', 'lark', 'hark', 'ark', 'narc',
    'clam', 'yam', 'ham', 'ram', 'dam', 'jam', 'pram',
    'cob', 'knob', 'blob', 'slob', 'snob', 'lob',
    'dung', 'bung', 'rung', 'wrung', 'clung',
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
    'corn', 'thorn', 'horn', 'torn', 'worn', 'born',
    'deed', 'weed', 'seed', 'reed', 'feed', 'bleed',
    'foam', 'loam', 'gnome', 'dome', 'chrome',
    'soot', 'hoot', 'boot', 'root', 'loot', 'toot',
    'fudge', 'sludge', 'grudge', 'judge', 'nudge',
    // --- Words that produce awkward/nonsensical hook lines ---
    'snack', 'swap', 'cardiac', 'mousetrap', 'kidnap', 'chap',
    'roadmap', 'workshop', 'rooftop', 'laptop', 'desktop',
    'burlap', 'hubcap', 'bootstrap', 'rattrap', 'skullcap',
    'porcupine', 'concubine', 'serpentine', 'trampoline', 'figurine',
    'tangerine', 'tambourine', 'wolverine', 'quarantine', 'gasoline',
    'doorknob', 'corncob', 'cobweb', 'beanbag', 'sandbag',
]);

// Hook templates — short, punchy, memorable phrases
// Massive pool ensures different choruses across generations
const HOOK_TEMPLATES = [
    // --- Call-to-action / anthemic ---
    'I\'ll {verb} my way back to {noun}',
    '{verb} me like you mean it now',
    'we own the {noun} and the {noun2}',
    'can\'t stop this {adjective} {noun}',
    'nothing\'s gonna {verb} us now',
    'tonight we {verb} tonight we {verb2}',
    'this is our {adjective} {noun}',
    'feel the {noun} inside your {noun2}',
    'we {verb} like {adjective} {noun}s',
    'I won\'t {verb} I won\'t {verb2}',
    'take my {noun} take my {noun2}',
    'we own the {noun} we own the {noun2}',
    'let the {noun} {verb} tonight',
    '{verb} with me into the {noun}',
    'we {verb} we {verb2} we never stop',
    'set the {noun} on {noun2} tonight',
    'we don\'t {verb} we just {verb2}',
    'this is what it feels to {verb}',
    'give me all your {noun} give me all your {noun2}',
    'nothing but the {noun} tonight',
    // --- Emotional / personal ---
    'I found my {noun} in the {noun2}',
    'this {adjective} {noun} won\'t let me go',
    'can you feel the {noun} can you feel the {noun2}',
    'I gave my {noun} to the {noun2}',
    'every {noun} every {noun2}',
    'it\'s you and me against the {noun}',
    'no one can {verb} what we {verb2}',
    'I was made to {verb} was made to {verb2}',
    'I {verb} louder than the {noun}',
    'I {verb} the {noun} away',
    '{adjective} and {adjective2} that\'s what we are',
    'running through the {adjective} {noun}',
    // --- Repetition hooks ---
    '{verb} {verb} {verb} all {noun}',
    'more {noun} more {noun2} more {adjective}',
    'all I need is {noun} all I need is {noun2}',
    '{noun} on my mind {noun2} in my {noun}',
    // --- Question hooks ---
    'can you feel the {noun} tonight',
    'where did all the {noun}s go',
    'who\'s gonna {verb} the {noun}',
    'what if we could {verb} forever',
    'don\'t you want to {verb} with me',
    // --- Declaration hooks ---
    'I am {adjective} and I am {adjective2}',
    'we are {adjective} we are {adjective2}',
    'this is {adjective} this is {adjective2}',
    'I\'ll never {verb} without your {noun}',
    'we were born to {verb} and {verb2}',
    'the {noun} belongs to you and me',
    'I\'m {adjective} I\'m {adjective2} I\'m alive',
    'we got the {noun} we got the {noun2}',
    'no more {noun} no more {noun2}',
    'it\'s a {adjective} {adjective2} {noun}',
    // --- Storytelling hooks ---
    'one more {noun} before the {noun2}',
    'last {noun} of the {adjective} {noun2}',
    'somewhere in the {adjective} {noun}',
    'back to the {noun} where it all began',
    'from the {noun} to the {noun2}',
    'under {adjective} {noun}s we {verb}',
    'through the {noun} through the {noun2}',
    // --- Short punchy hooks (3+ words minimum) ---
    '{adjective} {noun} tonight',
    '{verb} the {adjective} {noun}',
    'let it {verb} tonight',
    '{noun} and {noun2} forever',
    'just {verb} the {noun}',
    // --- Multi-syllable hooks ---
    '{adjective} and {adjective2} that\'s what we are',
    'we {verb} the {adjective} {noun} tonight',
    '{adjective} {noun} is our {noun2}',
    'I {verb} every {adjective} {noun}',
    'the {adjective} {noun} of {noun2}',
    'we are {adjective} we are {adjective2}',
    'nothing but {adjective} {noun} and {noun2}',
    'every {adjective} {noun} we {verb}',
    '{adjective} {adjective2} {noun} forever',
    'I {verb} the {adjective} {noun} tonight',
    'our {adjective} {noun} will never {verb}',
    'the {noun} of {noun2} is {adjective}',
    'we {verb} with {adjective} {noun}',
    '{adjective} and {adjective2} until the end',
    'through the {adjective} {noun} we {verb} together',
];

// ---- MERGE EXPANSION DATA ----
import {
    HOOK_TEMPLATES_EXPANSION,
    GENRE_HOOK_TEMPLATES_EXPANSION,
    CHORUS_NOUN_TEMPLATES_EXPANSION,
    CHORUS_ADJ_TEMPLATES_EXPANSION,
    CHORUS_VERB_TEMPLATES_EXPANSION,
    HOOK_VOCAB_BLOCKLIST_EXPANSION,
    mergeHookTemplates,
    mergeGenreHookTemplates,
    mergeChorusTemplates,
    mergeBlocklist,
} from './HookGeneratorExpansion';

// Merge universal hook templates
mergeHookTemplates(HOOK_TEMPLATES, HOOK_TEMPLATES_EXPANSION);
// Merge blocklist
mergeBlocklist(HOOK_VOCAB_BLOCKLIST, HOOK_VOCAB_BLOCKLIST_EXPANSION);

// Genre-specific hook templates for more authentic generation
const GENRE_HOOK_TEMPLATES = {
    hiphop: [
        'I got the {noun} I got the {noun2}',
        'run it up and {verb} the {noun}',
        'we don\'t stop we {verb} the {noun}',
        'real ones {verb} the {adjective} {noun}',
        'no cap I\'m the {adjective} one',
        '{verb} it up and watch me {verb2}',
        'drip so {adjective} they can\'t {verb}',
        'from the {noun} to the top',
        'stack the {noun} and never stop',
        'I been {adjective} since the {noun}',
        'pull up with the {noun} on {noun2}',
        'we the {adjective} ones in the {noun}',
    ],
    rock: [
        'we {verb} until the walls come down',
        '{verb} it up and burn the {noun}',
        'we own the {noun} the {adjective} {noun2}',
        'tear it down and {verb} again',
        '{adjective} and {adjective2} until the end',
        'nothing left but {noun} and {noun2}',
        'we {verb} we scream we\'re still alive',
        'through the {noun} we will survive',
        'the {noun} is dead long live the {noun2}',
        'we ride the {noun} until we {verb}',
    ],
    country: [
        'raise your glass to {adjective} {noun}s',
        'down on the {noun} where the {noun2}s grow',
        '{adjective} {noun} on a Friday {noun2}',
        'that\'s the way we {verb} around here',
        'a little {noun} a little {noun2}',
        'cold {noun} and {adjective} {noun2}s',
        'back roads and {adjective} {noun}s',
        'honey you\'re my {adjective} {noun}',
        'God bless the {noun} and the {noun2}',
        'small town {noun} big time {noun2}',
    ],
    rnb: [
        'baby {verb} me through the {noun}',
        'your {noun} your {noun2} your everything',
        '{verb} me slow {verb2} me right',
        'tonight I {verb} you all {noun}',
        'the way you {verb} my {noun}',
        'all I want is your {noun}',
        'you and me it\'s {adjective}',
        'I\'m yours you\'re mine that\'s {adjective}',
        'let me {verb} you through the {noun}',
        'your {adjective} {noun} drives me crazy',
    ],
    edm: [
        'hands up {verb} the {noun}',
        'drop the {noun} feel the {noun2}',
        'feel the {noun} feel the {noun2}',
        'feel the {noun} drop',
        '{verb} all {noun} and never stop',
        'the {noun} is calling let it {verb}',
        'lose yourself in {adjective} {noun}',
        'one more {noun} before the {noun2}',
        'everybody {verb} everybody {verb2}',
        'turn it up and let the {noun} {verb}',
    ],
};

// Merge genre-specific hook templates
mergeGenreHookTemplates(GENRE_HOOK_TEMPLATES, GENRE_HOOK_TEMPLATES_EXPANSION);

// Variation patterns for repeating hooks
const VARIATION_PATTERNS = [
    { type: 'prefix', additions: ['oh', 'yeah', 'hey', 'now', 'come on'] },
    { type: 'intensifier', additions: ['always', 'never', 'forever', 'still', 'only'] },
    { type: 'repetition', additions: ['again', 'once more', 'one more time', 'all night'] },
];

/**
 * Generate a hook phrase for a chorus.
 * @param {string} genre
 * @param {string} mood
 * @param {function} rng
 * @returns {string}
 */
/**
 * Fill any remaining template placeholders in a line using the genre vocabulary.
 * Handles both English ({adjective}, {noun}, {verb}) and locale ({adj}, {adv}, {v_pp_pl}) formats.
 */
export function fillTemplatePlaceholders(line, vocab, rng) {
    if (!line || !line.includes('{')) return line;
    const nouns = vocab?.nouns || ['love'];
    const verbs = vocab?.verbs || ['shine'];
    const adjectives = vocab?.adjectives || ['beautiful'];
    return line.replace(/\{(\w+)\}/g, (match, key) => {
        // Nouns: {noun}, {noun2}
        if (key === 'noun' || key === 'noun2') return pick(nouns, rng);
        // Verbs: {verb}, {verb2}, {v}, {v_pp}, {v_pp_pl}, {v_pp_adj}, {v_inf}
        if (key === 'verb' || key === 'verb2' || key === 'v' || key === 'v_pp' || key === 'v_pp_pl' || key === 'v_pp_adj' || key === 'v_inf') return pick(verbs, rng);
        // Adjectives: {adjective}, {adjective2}, {adj}, {adj2}, {adv}
        if (key === 'adjective' || key === 'adjective2' || key === 'adj' || key === 'adj2' || key === 'adv') return pick(adjectives, rng);
        // Events/misc: {evenement}, {line} — use a noun as fallback
        if (key === 'evenement' || key === 'line') return pick(nouns, rng);
        return match;
    });
}

const _hookRetryDepth = { current: 0 };
export function generateHookPhrase(genre, mood, rng) {
    const bank = getActiveGenreBank(genre);

    // 35% prebuilt chorus, 35% genre-specific template, 30% universal template
    const roll = rng();
    if (roll < 0.35 && bank.choruses.length > 0) {
        return fillTemplatePlaceholders(pick(bank.choruses, rng), bank.vocabulary, rng);
    }

    // Pick template source — prefer genre-specific if available
    const genreKey = genre.toLowerCase().replace(/[\s-]/g, '');
    const genreTemplates = GENRE_HOOK_TEMPLATES[genreKey];
    let template;
    if (roll < 0.70 && genreTemplates && genreTemplates.length > 0) {
        template = pick(genreTemplates, rng);
    } else {
        template = pick(getActiveHookTemplates(), rng);
    }

    const vocab = bank.vocabulary;
    const usedNouns = new Set();
    const usedVerbs = new Set();
    const usedAdj = new Set();

    // Hook templates need short, punchy words — max 3 syllables for nouns/adjectives
    const MAX_HOOK_SYLLABLES = 3;

    // Extract static words from template (words that aren't placeholders)
    const staticWords = new Set(
        template.replace(/\{[^}]+\}/g, '').toLowerCase().split(/\s+/).filter(w => w.length > 0)
    );

    const line = template.replace(/\{(\w+)\}/g, (match, key) => {
        // Normalize locale-specific placeholder names to canonical forms
        const normalizedKey = key === 'adj' || key === 'adj2' ? key.replace('adj', 'adjective')
            : key === 'adv' ? 'adjective' // adverbs → use adjective pool as fallback
            : key === 'v_pp_pl' || key === 'v_pp' || key === 'v_inf' ? 'verb' // verb forms → verb pool
            : key;
        if (normalizedKey === 'noun' || normalizedKey === 'noun2') {
            // Prefer short nouns (≤3 syllables) for punchy hooks, exclude static word duplicates
            const shortNouns = vocab.nouns.filter(n =>
                !usedNouns.has(n) && !HOOK_VOCAB_BLOCKLIST.has(n.toLowerCase()) &&
                !staticWords.has(n.toLowerCase()) &&
                countSyllables(n) <= MAX_HOOK_SYLLABLES
            );
            const allAvail = vocab.nouns.filter(n => !usedNouns.has(n) && !HOOK_VOCAB_BLOCKLIST.has(n.toLowerCase()) && !staticWords.has(n.toLowerCase()));
            const chosen = pick(shortNouns.length > 0 ? shortNouns : (allAvail.length > 0 ? allAvail : vocab.nouns.filter(n => !usedNouns.has(n))), rng);
            usedNouns.add(chosen);
            return chosen;
        }
        if (normalizedKey === 'verb' || normalizedKey === 'verb2') {
            // Prefer short verbs (≤3 syllables) for punchy hooks, exclude static word duplicates
            const shortVerbs = vocab.verbs.filter(v =>
                !usedVerbs.has(v) && !HOOK_VOCAB_BLOCKLIST.has(v.toLowerCase()) &&
                !staticWords.has(v.toLowerCase()) &&
                countSyllables(v) <= MAX_HOOK_SYLLABLES
            );
            const allAvail = vocab.verbs.filter(v => !usedVerbs.has(v) && !HOOK_VOCAB_BLOCKLIST.has(v.toLowerCase()) && !staticWords.has(v.toLowerCase()));
            const chosen = pick(shortVerbs.length > 0 ? shortVerbs : (allAvail.length > 0 ? allAvail : vocab.verbs.filter(v => !usedVerbs.has(v))), rng);
            usedVerbs.add(chosen);
            return chosen;
        }
        if (normalizedKey === 'adjective' || normalizedKey === 'adjective2') {
            const shortAdj = vocab.adjectives.filter(a =>
                !usedAdj.has(a) && !HOOK_VOCAB_BLOCKLIST.has(a.toLowerCase()) &&
                !staticWords.has(a.toLowerCase()) &&
                countSyllables(a) <= MAX_HOOK_SYLLABLES
            );
            const allAvail = vocab.adjectives.filter(a => !usedAdj.has(a) && !HOOK_VOCAB_BLOCKLIST.has(a.toLowerCase()) && !staticWords.has(a.toLowerCase()));
            const chosen = pick(shortAdj.length > 0 ? shortAdj : (allAvail.length > 0 ? allAvail : vocab.adjectives.filter(a => !usedAdj.has(a))), rng);
            usedAdj.add(chosen);
            return chosen;
        }
        return match;
    });

    // Quality guard: reject lines with adjacent duplicate words or too-short (max 3 retries)
    const words = line.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    let needsRetry = false;
    for (let i = 0; i < words.length - 1; i++) {
        if (words[i] === words[i + 1] && words[i].length > 1) {
            needsRetry = true;
            break;
        }
    }
    if (!needsRetry && words.length < 4) {
        needsRetry = true;
    }
    if (needsRetry && _hookRetryDepth.current < 3) {
        _hookRetryDepth.current++;
        const retry = generateHookPhrase(genre, mood, rng);
        _hookRetryDepth.current = 0;
        return retry;
    }
    _hookRetryDepth.current = 0;

    return line;
}

/**
 * Create a variation of a hook phrase.
 * @param {string} hookPhrase
 * @param {number} variationIndex
 * @param {function} rng
 * @returns {string}
 */
export function createHookVariation(hookPhrase, variationIndex, rng) {
    const pattern = VARIATION_PATTERNS[variationIndex % VARIATION_PATTERNS.length];
    const addition = pick(pattern.additions, rng);

    switch (pattern.type) {
        case 'prefix':
            return `${addition} ${hookPhrase}`;
        case 'intensifier': {
            const words = hookPhrase.split(/\s+/);
            // Insert intensifier after first word
            if (words.length > 1) {
                words.splice(1, 0, addition);
                return words.join(' ');
            }
            return `${addition} ${hookPhrase}`;
        }
        case 'repetition':
            return `${hookPhrase} ${addition}`;
        default:
            return hookPhrase;
    }
}

/**
 * Generate a full chorus section with hook repetition and variation.
 * @param {string} genre
 * @param {string} mood
 * @param {number} lineCount
 * @param {string} rhymePattern
 * @param {function} rng
 * @param {Set} [songUsedPhrases] - phrases already used in the song (for consistency)
 * @returns {string[]}
 */
// Rhyme-ending templates for chorus lines — NOUN-appropriate
const CHORUS_NOUN_TEMPLATES = [
    'we {verb} until the {rhyme}',
    'nothing compares to the {rhyme}',
    'feel it in the {rhyme}',
    'we own the {rhyme}',
    'tonight we chase the {rhyme}',
    'running through the {rhyme}',
    'I will never lose the {rhyme}',
    'everything leads to the {rhyme}',
    'together through the {rhyme}',
    'this is more than just the {rhyme}',
    'standing tall above the {rhyme}',
    'I gave it all for the {rhyme}',
    'forever in the {rhyme}',
    'lighting up the {rhyme}',
    'we rise above the {rhyme}',
];

// Adjective-appropriate chorus templates
const CHORUS_ADJ_TEMPLATES = [
    'tonight we feeling {rhyme}',
    'the world is looking {rhyme}',
    'we stay forever {rhyme}',
    'everything we do is {rhyme}',
    'they say the vibe is {rhyme}',
    'the energy is {rhyme}',
    'we keep it all so {rhyme}',
    'this moment feels so {rhyme}',
];

// Verb-appropriate chorus templates ("to {verb}" works with most verbs)
const CHORUS_VERB_TEMPLATES = [
    'I was born to {rhyme}',
    'we came to {rhyme} and take the crown',
    'I had to {rhyme} to see the light',
    'we learned to {rhyme} and hold it down',
    'they tried to {rhyme} but we stood tall',
    'I chose to {rhyme} and face it all',
    'we gotta {rhyme} to make it through',
    'I {rhyme} and the crowd goes wild',
];

// Merge chorus template expansions
mergeChorusTemplates(CHORUS_NOUN_TEMPLATES, CHORUS_NOUN_TEMPLATES_EXPANSION);
mergeChorusTemplates(CHORUS_ADJ_TEMPLATES, CHORUS_ADJ_TEMPLATES_EXPANSION);
mergeChorusTemplates(CHORUS_VERB_TEMPLATES, CHORUS_VERB_TEMPLATES_EXPANSION);

// Merge Expansion 2 (5× hook content)
import {
    HOOK_TEMPLATES_EXPANSION2, GENRE_HOOK_TEMPLATES_EXPANSION2,
    CHORUS_NOUN_TEMPLATES_EXPANSION2, CHORUS_ADJ_TEMPLATES_EXPANSION2,
    CHORUS_VERB_TEMPLATES_EXPANSION2, HOOK_VOCAB_BLOCKLIST_EXPANSION2,
    mergeHookTemplates2, mergeGenreHookTemplates2, mergeChorusTemplates2, mergeBlocklist2
} from './HookGeneratorExpansion2';

mergeHookTemplates2(HOOK_TEMPLATES, HOOK_TEMPLATES_EXPANSION2);
mergeGenreHookTemplates2(GENRE_HOOK_TEMPLATES, GENRE_HOOK_TEMPLATES_EXPANSION2);
mergeChorusTemplates2(CHORUS_NOUN_TEMPLATES, CHORUS_NOUN_TEMPLATES_EXPANSION2);
mergeChorusTemplates2(CHORUS_ADJ_TEMPLATES, CHORUS_ADJ_TEMPLATES_EXPANSION2);
mergeChorusTemplates2(CHORUS_VERB_TEMPLATES, CHORUS_VERB_TEMPLATES_EXPANSION2);
mergeBlocklist2(HOOK_VOCAB_BLOCKLIST, HOOK_VOCAB_BLOCKLIST_EXPANSION2);

// Merge Expansion 3 (300+ more hook templates)
import {
    HOOK_TEMPLATES_EXPANSION3, GENRE_HOOK_TEMPLATES_EXPANSION3,
    CHORUS_NOUN_TEMPLATES_EXPANSION3, CHORUS_ADJ_TEMPLATES_EXPANSION3,
    CHORUS_VERB_TEMPLATES_EXPANSION3, HOOK_VOCAB_BLOCKLIST_EXPANSION3,
    mergeHookTemplates3, mergeGenreHookTemplates3, mergeChorusTemplates3, mergeBlocklist3
} from './HookGeneratorExpansion3';

mergeHookTemplates3(HOOK_TEMPLATES, HOOK_TEMPLATES_EXPANSION3);
mergeGenreHookTemplates3(GENRE_HOOK_TEMPLATES, GENRE_HOOK_TEMPLATES_EXPANSION3);
mergeChorusTemplates3(CHORUS_NOUN_TEMPLATES, CHORUS_NOUN_TEMPLATES_EXPANSION3);
mergeChorusTemplates3(CHORUS_ADJ_TEMPLATES, CHORUS_ADJ_TEMPLATES_EXPANSION3);
mergeChorusTemplates3(CHORUS_VERB_TEMPLATES, CHORUS_VERB_TEMPLATES_EXPANSION3);
mergeBlocklist3(HOOK_VOCAB_BLOCKLIST, HOOK_VOCAB_BLOCKLIST_EXPANSION3);

// ---- Part-of-speech detection for template selection ----
// Words from rhyme families that are VERBS (not usable as nouns in "the {word}" templates)
const CHORUS_KNOWN_VERBS = new Set([
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
    'behold', 'withhold', 'uphold', 'unfold',
    'defend', 'offend', 'pretend', 'attend', 'extend', 'intend', 'contend',
    'depend', 'transcend', 'descend', 'recommend', 'comprehend', 'apprehend',
    'conceal', 'appear', 'disappear', 'persevere', 'interfere', 'revere',
    'compete', 'complete', 'betray', 'convey', 'portray', 'obey', 'repay',
    'replace', 'erase', 'evade', 'invade', 'persuade',
    'compel', 'expel', 'propel', 'repel', 'dispel', 'excel',
    'redeem', 'follow', 'bestow', 'borrow', 'overflow', 'overthrow', 'outgrow',
]);

// Words from rhyme families that are ADJECTIVES (not usable as nouns)
const CHORUS_KNOWN_ADJECTIVES = new Set([
    'insane', 'mundane', 'humane', 'profane', 'arcane',
    'extreme', 'supreme', 'serene', 'sublime',
    'severe', 'sincere', 'profound',
    'polite', 'contrite',
    'surreal', 'unreal',
    'morose', 'verbose',
    'discreet', 'discrete', 'obsolete',
]);

// Suffix-based heuristic to guess likely part of speech
const CHORUS_ADJ_SUFFIXES = [
    'ory', 'ary', 'ive', 'ous', 'ful', 'less', 'able', 'ible', 'ical', 'ial', 'ular', 'etic', 'atic',
    'ated', 'ized', 'ised', 'ified', 'ened', 'ered', 'ured', 'uted', 'pted', 'nted', 'sted',
];
const CHORUS_VERB_SUFFIXES = ['ize', 'ise', 'ify', 'ate', 'laim', 'eed', 'ude', 'ete'];

function guessWordTypeChorus(word) {
    const w = word.toLowerCase();
    if (CHORUS_KNOWN_VERBS.has(w)) return 'verb';
    if (CHORUS_KNOWN_ADJECTIVES.has(w)) return 'adjective';
    if (w.length < 4) return 'noun';
    for (const s of CHORUS_ADJ_SUFFIXES) {
        if (w.endsWith(s) && w.length > s.length + 2) return 'adjective';
    }
    for (const s of CHORUS_VERB_SUFFIXES) {
        if (w.endsWith(s) && w.length > s.length + 2) return 'verb';
    }
    return 'noun';
}

function pickChorusTemplate(word, rng) {
    const type = guessWordTypeChorus(word);
    if (type === 'adjective') return CHORUS_ADJ_TEMPLATES[Math.floor(rng() * CHORUS_ADJ_TEMPLATES.length)];
    if (type === 'verb') return CHORUS_VERB_TEMPLATES[Math.floor(rng() * CHORUS_VERB_TEMPLATES.length)];
    return CHORUS_NOUN_TEMPLATES[Math.floor(rng() * CHORUS_NOUN_TEMPLATES.length)];
}

/**
 * Pick a word from a rhyme family that works well in templates.
 * Prefers words classified as nouns (which sound natural in noun templates).
 */
function pickChorusTemplateWord(familyWords, rng) {
    const simple = familyWords.filter(w => !w.includes(' ') && !w.includes('-'));
    const nouns = simple.filter(w => guessWordTypeChorus(w) === 'noun');
    if (nouns.length > 0) {
        return nouns[Math.floor(rng() * nouns.length)];
    }
    return simple.length > 0
        ? simple[Math.floor(rng() * simple.length)]
        : familyWords[Math.floor(rng() * familyWords.length)];
}

// Legacy alias
const CHORUS_RHYME_TEMPLATES = CHORUS_NOUN_TEMPLATES;

/**
 * Add a cadence break " - " at the best natural pause point in a line.
 * Simulates where a rapper would breathe/pause for rhythm.
 */
function isPreAuthoredDashBadChorus(line) {
    const dashIdx = line.indexOf(' - ');
    if (dashIdx < 0) return false;
    const before = line.slice(0, dashIdx).trim().split(/\s+/);
    const after = line.slice(dashIdx + 3).trim().split(/\s+/);
    if (before.length < 2 || after.length < 2) return true;
    const last = before[before.length - 1].toLowerCase().replace(/[^a-z']/g, '');
    const first = after[0].toLowerCase().replace(/[^a-z']/g, '');
    const ARTS = new Set(['a', 'an', 'the']);
    const PREPS = new Set(['in', 'on', 'at', 'to', 'for', 'by', 'of', 'with', 'from',
        'into', 'onto', 'upon', 'through', 'across', 'over', 'under', 'about', 'between']);
    const PARTS = new Set(['up', 'out', 'off', 'down', 'around', 'through', 'over',
        'into', 'onto', 'upon', 'across', 'under', 'on', 'in', 'for', 'with', 'to']);
    if (ARTS.has(last)) return true;
    if (PREPS.has(last)) return true;
    if (last.endsWith('ing') && PARTS.has(first)) return true;
    if (first.length <= 1 && first !== 'i') return true;
    return false;
}

function addCadenceBreakChorus(line) {
    if (line.includes(' - ')) {
        if (!isPreAuthoredDashBadChorus(line)) return line;
        line = line.replace(/ - /g, ' ');
    }
    const words = line.split(' ');
    if (words.length < 4) return line;

    const clauseStarters = new Set([
        'and', 'but', 'or', 'so', 'then', 'when', 'while', 'never', 'always',
        'every', 'still', 'yet', 'now', 'where', 'cause', 'because', 'if',
        'like', 'just', 'until', 'before', 'after', 'without', 'within',
    ]);
    const functionWords = new Set([
        'in', 'on', 'at', 'to', 'for', 'by', 'of', 'a', 'the',
        'is', 'are', 'was', 'were', 'will', 'can', 'we', 'he', 'she',
        'it', 'my', 'his', 'her', 'its', 'our', 'an', 'up', 'no',
        'from', 'with', 'into', 'onto', 'as', 'do',
    ]);
    const articles = new Set(['a', 'an', 'the']);
    const prepositions = new Set([
        'in', 'on', 'at', 'to', 'for', 'by', 'of', 'with', 'from',
        'into', 'onto', 'upon', 'through', 'across', 'over', 'under', 'about',
    ]);

    // Mirrors src/lyrics/engine/caesura-audit.test.js#COMPOUND_PHRASES.
    // Pairs are (first, second) members of an X-and-Y / X-Y compound; the
    // lookahead below detects splits even when "and"/fillers sit between.
    const compoundPairs = [
        ['grand', 'slam'], ['slam', 'dunk'],
        ['day', 'night'], ['night', 'day'],
        ['life', 'death'], ['death', 'life'],
        ['left', 'right'], ['right', 'left'],
        ['up', 'down'], ['down', 'up'],
        ['back', 'forth'], ['forth', 'back'],
        ['here', 'there'], ['there', 'here'],
        ['now', 'then'], ['then', 'now'],
        ['rise', 'fall'], ['fall', 'rise'],
    ];

    const targetPct = words.length <= 6 ? 0.45 : 0.55;
    const targetIdx = Math.max(2, Math.round(words.length * targetPct));

    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 2; i <= words.length - 2; i++) {
        const w = words[i].toLowerCase();
        const prev = words[i - 1].toLowerCase();

        let score = -Math.abs(i - targetIdx) * 2;

        // Bonuses
        if (clauseStarters.has(w)) score += 5;
        if (w.length >= 4 && !functionWords.has(w) && !prepositions.has(w)) score += 2;
        if (prev.length >= 4 && !articles.has(prev) && !prepositions.has(prev)) score += 1.5;
        if (prev.length >= 4 && (prev.endsWith('ed') || prev.endsWith('ize') || prev.endsWith('ise') || prev.endsWith('ate') || prev.endsWith('fy'))) score += 1;

        // Penalties
        if (functionWords.has(w)) score -= 4;
        if (articles.has(prev)) score -= 12;
        if (prepositions.has(prev)) score -= 16;
        if (prev.endsWith('ing') && prepositions.has(w)) score -= 20;
        if (prev.endsWith('ing') || prev.endsWith('ted') || prev.endsWith('ned') || prev.endsWith('ped')) score -= 2;
        if (i < 3 && words.length >= 7) score -= 5;
        if (clauseStarters.has(w) && i >= words.length - 2) score -= 4;
        if (w.length <= 1 && w !== 'i') score -= 15;
        if (prev.length <= 1) score -= 3;
        let compoundSplitChorus = false;
        for (const [first, second] of compoundPairs) {
            if (prev === first) {
                for (let k = i; k < Math.min(i + 3, words.length); k++) {
                    const peek = (words[k] || '').toLowerCase().replace(/[^a-z']/g, '');
                    if (peek === second) { compoundSplitChorus = true; break; }
                }
            }
            if (compoundSplitChorus) break;
            if (w === second) {
                for (let k = i - 1; k >= Math.max(0, i - 3); k--) {
                    const peek = (words[k] || '').toLowerCase().replace(/[^a-z']/g, '');
                    if (peek === first) { compoundSplitChorus = true; break; }
                }
            }
            if (compoundSplitChorus) break;
        }
        if (compoundSplitChorus) score -= 15;

        if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    // Quality gate: if no position scored well, skip the break entirely
    if (bestScore < -6) return line;

    if (bestIdx >= 2 && bestIdx <= words.length - 2) {
        return words.slice(0, bestIdx).join(' ') + ' - ' + words.slice(bestIdx).join(' ');
    }
    return line;
}

export function generateChorus(genre, mood, lineCount, rhymePattern, rng, songUsedPhrases, usePunchlines = false) {
    const hookPhrase = generateHookPhrase(genre, mood, rng);
    const lines = [];
    const bank = getActiveGenreBank(genre);
    const usedLines = new Set([hookPhrase]); // Track used phrases to avoid repeats
    // Also skip phrases already used in verses/bridges for variety
    if (songUsedPhrases) {
        for (const p of songUsedPhrases) usedLines.add(p);
    }

    // Hook appears only at position 0 — no near-identical repetition
    const hookLastWord = getLastWord(hookPhrase);
    const usedEndWords = new Set([hookLastWord]); // Track ending words to avoid same-word "rhymes"

    // Combine all phrase pools for wider selection
    let allPhrases = [
        ...(bank.choruses || []),
        ...(bank.verses || []),
        ...(bank.bridges || []),
    ];

    // Mix punchline phrases into chorus pool when enabled (50% ratio for strong presence)
    if (usePunchlines) {
        const punchlines = getPunchlinePhrases(mood.toLowerCase());
        const punchlineCount = Math.floor(allPhrases.length * 0.5);
        const shuffled = [...punchlines];
        shuffleArray(shuffled, rng);
        allPhrases = [...allPhrases, ...shuffled.slice(0, punchlineCount)];
    }
    const vocab = bank.vocabulary || {};

    // Pre-compute: for each line position, what rhyme letter and target does it have?
    // IMPORTANT: wrap pattern with modulo so 6-line choruses with AABB still rhyme lines 4-5
    const schemeLen = rhymePattern ? rhymePattern.length : 4;

    // Helper: count how many rhyming bank phrases exist for a given end word
    function countAvailableRhymes(endWord) {
        if (!endWord) return 0;
        return allPhrases.filter(p => {
            const lw = getLastWord(p);
            return lw && lw !== endWord && wordsRhyme(endWord, lw);
        }).length;
    }

    // Helper: check if position i is the FIRST occurrence of its letter
    // (meaning a later line will need to rhyme with it)
    function isFirstOfPair(i) {
        const myChar = rhymePattern[i % schemeLen] || 'A';
        for (let j = 0; j < i; j++) {
            if ((rhymePattern[j % schemeLen] || 'A') === myChar) return false;
        }
        // Check if any later line needs to rhyme with us
        for (let j = i + 1; j < lineCount; j++) {
            if ((rhymePattern[j % schemeLen] || 'A') === myChar) return true;
        }
        return false;
    }

    for (let i = 0; i < lineCount; i++) {
        if (i === 0) {
            // Line 0: the hook — REQUIRE ending word to be in a known rhyme family
            // so the partner line (for AABB, ABAB etc.) can always find a rhyme
            if (isFirstOfPair(0)) {
                let bestHook = hookPhrase;
                let bestScore = -1;
                for (let t = 0; t < 8; t++) {
                    const candidate = t === 0 ? hookPhrase : generateHookPhrase(genre, mood, rng);
                    const endW = getLastWord(candidate);
                    const endClean = endW?.toLowerCase().replace(/[^a-z]/g, '') || '';
                    const wtf = getWordToFamily();
                    const inKnownFamily = !!(wtf[endClean] && wtf[endClean].length > 0);
                    const cnt = countAvailableRhymes(endW);
                    const score = (inKnownFamily ? 1000 : 0) + cnt;
                    if (score > bestScore) {
                        bestHook = candidate;
                        bestScore = score;
                    }
                    if (inKnownFamily && cnt >= 2) break;
                }
                // If no hook ends in a known-family word, generate one from template
                if (bestScore < 1000) {
                    const activeFamilies = getRhymeFamiliesForHook();
                    const richFamilies = Object.entries(activeFamilies)
                        .filter(([, words]) => words.length >= 8)
                        .map(([fam]) => fam);
                    if (richFamilies.length > 0) {
                        const family = richFamilies[Math.floor(rng() * richFamilies.length)];
                        const familyWords = activeFamilies[family];
                        const word = pickChorusTemplateWord(familyWords, rng);
                        const template = pickChorusTemplate(word, rng);
                        let fallback = template.replace('{rhyme}', word);
                        fallback = fallback.replace(/\{verb\}/g, () =>
                            pick(vocab.verbs || ['rise', 'shine', 'move', 'burn'], rng)
                        );
                        bestHook = fallback;
                    }
                }
                bestHook = fillTemplatePlaceholders(bestHook, vocab, rng);
                lines.push(addCadenceBreakChorus(bestHook));
                usedLines.add(bestHook);
                usedEndWords.add(getLastWord(bestHook));
            } else {
                const filledHook = fillTemplatePlaceholders(hookPhrase, vocab, rng);
                lines.push(addCadenceBreakChorus(filledHook));
                usedLines.add(filledHook);
            }
        } else {
            // Determine what this line should rhyme with based on scheme (WITH wrapping)
            const patternChar = rhymePattern[i % schemeLen] || 'A';
            // Find the first line index with the same rhyme letter
            let rhymeTargetIdx = -1;
            for (let j = 0; j < i; j++) {
                if ((rhymePattern[j % schemeLen] || 'A') === patternChar) {
                    rhymeTargetIdx = j;
                    break;
                }
            }

            let chosenLine = null;
            let targetWord = null;

            if (rhymeTargetIdx >= 0) {
                // This line should rhyme with an earlier line
                targetWord = getLastWord(lines[rhymeTargetIdx]);
                if (targetWord) {
                    // Strategy 0: When punchlines ON, search punchline pool FIRST
                    // Creates proper setup → punchline payoff in AABB
                    if (usePunchlines && !chosenLine) {
                        const punchlines = getPunchlinePhrases(mood.toLowerCase());
                        const punchlineRhymes = punchlines.filter(p => {
                            if (usedLines.has(p)) return false;
                            const lw = getLastWord(p);
                            if (!lw || lw === targetWord) return false;
                            if (usedEndWords.has(lw)) return false;
                            return wordsRhyme(targetWord, lw);
                        });
                        if (punchlineRhymes.length > 0) {
                            chosenLine = pick(punchlineRhymes, rng);
                        }
                    }

                    // Strategy 1: Search phrase pools for a naturally rhyming line
                    if (!chosenLine) {
                        const rhymeCandidates = allPhrases.filter(p => {
                            if (usedLines.has(p)) return false;
                            const lw = getLastWord(p);
                            if (!lw || lw === targetWord) return false;
                            if (usedEndWords.has(lw)) return false;
                            return wordsRhyme(targetWord, lw);
                        });
                        if (rhymeCandidates.length > 0) {
                            chosenLine = pick(rhymeCandidates, rng);
                        }
                    }

                    // Strategy 2: Build a line from template + rhyming word
                    if (!chosenLine) {
                        const rhymeWords = findRhymes(targetWord, 12, rng);
                        const validRhymes = rhymeWords.filter(w =>
                            w !== targetWord && w.length >= 3 && !usedEndWords.has(w) && !HOOK_VOCAB_BLOCKLIST.has(w.toLowerCase())
                        );
                        if (validRhymes.length > 0) {
                            const rhymeWord = pickChorusTemplateWord(validRhymes, rng);
                            const template = pickChorusTemplate(rhymeWord, rng);
                            let line = template.replace('{rhyme}', rhymeWord);
                            line = line.replace(/\{verb\}/g, () =>
                                pick(vocab.verbs || ['rise', 'shine', 'move', 'burn'], rng)
                            );
                            chosenLine = line;
                        }
                    }

                    // Strategy 3: Relaxed search — drop usedEndWords constraint
                    if (!chosenLine) {
                        const relaxedRhymes = allPhrases.filter(p => {
                            if (usedLines.has(p)) return false;
                            const lw = getLastWord(p);
                            if (!lw || lw === targetWord) return false;
                            return wordsRhyme(targetWord, lw);
                        });
                        if (relaxedRhymes.length > 0) {
                            chosenLine = pick(relaxedRhymes, rng);
                        }
                    }
                }
            }

            // For "first of pair" lines (no rhyme target but future lines need us),
            // REQUIRE ending word in a known rhyme family
            if (!chosenLine && isFirstOfPair(i)) {
                const available = allPhrases.filter(p => {
                    if (usedLines.has(p)) return false;
                    const lw = getLastWord(p);
                    return lw && !usedEndWords.has(lw);
                });
                if (available.length > 0) {
                    // Score by known-family membership + rhyme availability
                    const wtf2 = getWordToFamily();
                    const scored = available.map(p => {
                        const lw = getLastWord(p);
                        const lwClean = lw?.toLowerCase().replace(/[^a-z]/g, '') || '';
                        const inFamily = !!(wtf2[lwClean] && wtf2[lwClean].length > 0);
                        return {
                            phrase: p,
                            score: (inFamily ? 1000 : 0) + countAvailableRhymes(lw)
                        };
                    }).sort((a, b) => b.score - a.score);
                    const topN = Math.max(1, Math.floor(scored.length * 0.3));
                    const topPhrases = scored.slice(0, topN).map(s => s.phrase);
                    chosenLine = pick(topPhrases, rng);

                    // If best option isn't in a known family OR has no pool rhymes,
                    // force a template line from a family with pool coverage
                    const bestEnd = getLastWord(chosenLine);
                    const bestClean = bestEnd?.toLowerCase().replace(/[^a-z]/g, '') || '';
                    const bestPoolCount = countAvailableRhymes(bestEnd);
                    if (!wtf2[bestClean] || bestPoolCount < 1) {
                        const activeFamilies2 = getRhymeFamiliesForHook();
                        const richFamilies = Object.entries(activeFamilies2)
                            .filter(([, words]) => words.length >= 8)
                            .map(([fam]) => fam);
                        if (richFamilies.length > 0) {
                            const family = richFamilies[Math.floor(rng() * richFamilies.length)];
                            const familyWords = activeFamilies2[family];
                            const word = pickChorusTemplateWord(familyWords, rng);
                            const template = pickChorusTemplate(word, rng);
                            let fallback = template.replace('{rhyme}', word);
                            fallback = fallback.replace(/\{verb\}/g, () =>
                                pick(vocab.verbs || ['rise', 'shine', 'move', 'burn'], rng)
                            );
                            chosenLine = fallback;
                        }
                    }
                }
            }

            // Last resort — pick any available phrase with a new ending word
            if (!chosenLine) {
                const available = allPhrases.filter(p => {
                    if (usedLines.has(p)) return false;
                    const lw = getLastWord(p);
                    return !usedEndWords.has(lw);
                });
                if (available.length > 0) {
                    chosenLine = pick(available, rng);
                } else {
                    const anyAvail = allPhrases.filter(p => !usedLines.has(p));
                    chosenLine = anyAvail.length > 0 ? pick(anyAvail, rng) : generateHookPhrase(genre, mood, rng);
                }
            }

            // ===== RHYME VERIFICATION =====
            // If this line was supposed to rhyme with a target, VERIFY it.
            // If it doesn't, force a rhyming line via template.
            if (targetWord) {
                const lineEnd = getLastWord(chosenLine);
                const doesRhyme = lineEnd && wordsRhyme(targetWord, lineEnd);
                if (!lineEnd || !doesRhyme) {
                    // FORCE a rhyme — guaranteed fallback
                    const rhymeWords = findRhymes(targetWord, 20, rng);
                    const validWords = rhymeWords.filter(w =>
                        w !== targetWord && !usedEndWords.has(w) && !HOOK_VOCAB_BLOCKLIST.has(w.toLowerCase())
                    );
                    const fallbackWords = validWords.length > 0 ? validWords : rhymeWords.filter(w => w !== targetWord);
                    if (fallbackWords.length > 0) {
                        const rhymeWord = pickChorusTemplateWord(fallbackWords, rng);
                        const template = pickChorusTemplate(rhymeWord, rng);
                        let forcedLine = template.replace('{rhyme}', rhymeWord);
                        forcedLine = forcedLine.replace(/\{verb\}/g, () =>
                            pick(vocab.verbs || ['rise', 'shine', 'move', 'burn'], rng)
                        );
                        chosenLine = forcedLine;
                    }
                }
            }

            chosenLine = fillTemplatePlaceholders(chosenLine, vocab, rng);
            usedLines.add(chosenLine);
            usedEndWords.add(getLastWord(chosenLine));
            lines.push(addCadenceBreakChorus(chosenLine));
        }
    }

    return lines;
}

/**
 * Score a hook phrase for catchiness.
 * @param {string} hookPhrase
 * @returns {{ score: number, factors: object }}
 */
export function scoreHookCatchiness(hookPhrase) {
    const syllables = countLineSyllables(hookPhrase);
    const words = hookPhrase.split(/\s+/).filter(Boolean);

    // Shorter hooks are catchier
    const lengthScore = syllables <= 8 ? 1.0 : syllables <= 12 ? 0.7 : 0.4;

    // Simple words are catchier
    const avgWordLength = words.reduce((s, w) => s + w.length, 0) / words.length;
    const simplicityScore = avgWordLength <= 5 ? 1.0 : avgWordLength <= 7 ? 0.6 : 0.3;

    // Repeating sounds are catchier
    const firstLetters = words.map(w => w[0]?.toLowerCase());
    const alliteration = new Set(firstLetters).size < firstLetters.length ? 1.0 : 0.5;

    // Vowel openness (open vowels = more singable)
    const openVowels = (hookPhrase.match(/[aeiou]/gi) || []).length;
    const vowelRatio = openVowels / hookPhrase.replace(/\s/g, '').length;
    const vowelScore = vowelRatio >= 0.4 ? 1.0 : vowelRatio >= 0.3 ? 0.7 : 0.4;

    const score = (lengthScore * 0.3 + simplicityScore * 0.25 + alliteration * 0.2 + vowelScore * 0.25);

    return {
        score: Math.round(score * 100),
        factors: {
            length: Math.round(lengthScore * 100),
            simplicity: Math.round(simplicityScore * 100),
            alliteration: Math.round(alliteration * 100),
            vowelOpenness: Math.round(vowelScore * 100),
        },
    };
}
