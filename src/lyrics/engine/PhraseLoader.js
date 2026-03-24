/**
 * PhraseLoader — Loads language-specific phrase banks for the Lyric Engine.
 *
 * Architecture:
 *   Each language has a JSON file in ./locales/{langCode}.json containing:
 *   - genreBanks: genre-keyed phrase pools (openers, verses, bridges, choruses, vocabulary)
 *   - rhymeFamilies: phonetic ending groups for the language
 *   - hookTemplates: universal hook templates
 *   - genreHookTemplates: genre-specific hook templates
 *   - chorusNounTemplates / chorusAdjTemplates / chorusVerbTemplates
 *   - punchlines: rhyme-family-keyed punchline phrases
 *   - variationPatterns: hook variation words
 *   - moodModifiers: mood-specific word swaps and vocabulary
 *
 * Falls back to English (null = use built-in JS data) for unsupported languages.
 */

// Cache loaded phrase banks to avoid re-importing
const phraseCache = new Map();

// All supported language codes
const SUPPORTED_LANG_CODES = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru',
    'ar', 'hi', 'nl', 'pl', 'tr', 'sv', 'nb', 'da', 'fi', 'cs',
    'ro', 'hu', 'th', 'vi', 'id', 'uk', 'el', 'he',
    'sk', 'ms', 'hr', 'ca',
    'bg', 'sr', 'lt', 'lv',
    'sl', 'et', 'gl', 'af',
    'az', 'bs', 'mk', 'tl',
    'be',
];

// Vite-compatible lazy loading — import.meta.glob discovers files at build time.
// When phraseCache is pre-populated via injectPhraseBank() (tests), the glob is skipped entirely.
const LOCALE_MODULES = import.meta.glob('./locales/*.json', { eager: false });

// Build importers map from discovered files
const LOCALE_IMPORTERS = {};
for (const [path, importFn] of Object.entries(LOCALE_MODULES)) {
    const match = path.match(/\/([a-z]{2})\.json$/);
    if (match) {
        LOCALE_IMPORTERS[match[1]] = importFn;
    }
}

/**
 * Convert language display name to code.
 */
const NAME_TO_CODE = {
    'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de',
    'Italian': 'it', 'Portuguese': 'pt', 'Japanese': 'ja', 'Korean': 'ko',
    'Chinese': 'zh', 'Russian': 'ru', 'Arabic': 'ar', 'Hindi': 'hi',
    'Dutch': 'nl', 'Polish': 'pl', 'Turkish': 'tr', 'Swedish': 'sv',
    'Norwegian': 'nb', 'Danish': 'da', 'Finnish': 'fi', 'Czech': 'cs',
    'Romanian': 'ro', 'Hungarian': 'hu', 'Thai': 'th', 'Vietnamese': 'vi',
    'Indonesian': 'id', 'Ukrainian': 'uk', 'Greek': 'el', 'Hebrew': 'he',
    'Slovak': 'sk', 'Malay': 'ms', 'Croatian': 'hr', 'Catalan': 'ca',
    'Bulgarian': 'bg', 'Serbian': 'sr', 'Lithuanian': 'lt', 'Latvian': 'lv',
    'Slovenian': 'sl', 'Estonian': 'et', 'Galician': 'gl', 'Afrikaans': 'af',
    'Azerbaijani': 'az', 'Bosnian': 'bs', 'Macedonian': 'mk', 'Filipino': 'tl',
    'Belarusian': 'be',
};

/**
 * Get the language code from a language name or code.
 * @param {string} langOrCode - e.g. 'English', 'en', 'Spanish', 'es'
 * @returns {string} language code
 */
export function resolveLangCode(langOrCode) {
    if (!langOrCode) return 'en';
    const lower = langOrCode.toLowerCase();
    if (SUPPORTED_LANG_CODES.includes(lower)) return lower;
    return NAME_TO_CODE[langOrCode] || 'en';
}

/**
 * Load phrase bank for a language (async).
 * Returns null for English (use built-in JS data).
 * @param {string} langCode
 * @returns {Promise<object|null>}
 */
export async function loadPhraseBank(langCode) {
    const code = resolveLangCode(langCode);
    if (code === 'en') return null; // English uses built-in JS data

    if (phraseCache.has(code)) return phraseCache.get(code);

    const importer = LOCALE_IMPORTERS[code];
    if (!importer) return null;

    try {
        const module = await importer();
        const data = module.default || module;
        phraseCache.set(code, data);
        return data;
    } catch (err) {
        console.warn(`[PhraseLoader] Failed to load phrases for '${code}', falling back to English:`, err.message);
        return null;
    }
}

/**
 * Load phrase bank synchronously (from cache only).
 * Must call loadPhraseBank first to populate the cache.
 * @param {string} langCode
 * @returns {object|null}
 */
export function getPhraseBank(langCode) {
    const code = resolveLangCode(langCode);
    if (code === 'en') return null;
    return phraseCache.get(code) || null;
}

/**
 * Preload a phrase bank into cache (call during generation setup).
 * @param {string} langCode
 * @returns {Promise<void>}
 */
export async function preloadPhraseBank(langCode) {
    await loadPhraseBank(langCode);
}

/**
 * Check if a language has a loaded phrase bank.
 * @param {string} langCode
 * @returns {boolean}
 */
export function hasPhraseBank(langCode) {
    const code = resolveLangCode(langCode);
    if (code === 'en') return true;
    return phraseCache.has(code);
}

/**
 * Get genre bank for a language, falling back to English built-in.
 * @param {string} genre
 * @param {string} langCode
 * @param {function} englishFallback - getGenreBank from GenreBank.js
 * @returns {object}
 */
export function getLocalizedGenreBank(genre, langCode, englishFallback) {
    const bank = getPhraseBank(langCode);
    if (bank?.genreBanks) {
        const key = genre.toLowerCase().replace(/[\s-]/g, '');
        const localBank = bank.genreBanks[key] || bank.genreBanks['pop'];
        if (localBank) return localBank;
    }
    return englishFallback(genre);
}

/**
 * Get rhyme families for a language, falling back to English built-in.
 * @param {string} langCode
 * @param {object} englishFamilies - RHYME_FAMILIES from RhymeEngine.js
 * @returns {object}
 */
export function getLocalizedRhymeFamilies(langCode, englishFamilies) {
    const bank = getPhraseBank(langCode);
    if (bank?.rhymeFamilies && Object.keys(bank.rhymeFamilies).length > 0) {
        return bank.rhymeFamilies;
    }
    return englishFamilies;
}

/**
 * Get hook templates for a language, falling back to English built-in.
 * @param {string} langCode
 * @param {string[]} englishTemplates
 * @returns {string[]}
 */
export function getLocalizedHookTemplates(langCode, englishTemplates) {
    const bank = getPhraseBank(langCode);
    if (bank?.hookTemplates?.length > 0) {
        return bank.hookTemplates;
    }
    return englishTemplates;
}

/**
 * Get punchline phrases for a language, falling back to English built-in.
 * @param {string} mood
 * @param {string} langCode
 * @param {function} englishFallback - getPunchlinePhrases from PunchlineBank.js
 * @returns {string[]}
 */
export function getLocalizedPunchlines(mood, langCode, englishFallback) {
    const bank = getPhraseBank(langCode);
    if (bank?.punchlines) {
        // Flatten all punchline families
        const allPhrases = [];
        for (const family of Object.values(bank.punchlines)) {
            if (family.all) allPhrases.push(...family.all);
            if (mood && family[mood]) allPhrases.push(...family[mood]);
        }
        if (allPhrases.length > 0) return allPhrases;
    }
    return englishFallback(mood);
}

/**
 * Get mood modifier for a language.
 * @param {string} mood
 * @param {string} langCode
 * @param {function} englishFallback - getMoodModifier from GenreBank.js
 * @returns {object|null}
 */
export function getLocalizedMoodModifier(mood, langCode, englishFallback) {
    const bank = getPhraseBank(langCode);
    if (bank?.moodModifiers) {
        const key = mood.toLowerCase().replace(/[\s-]/g, '');
        if (bank.moodModifiers[key]) return bank.moodModifiers[key];
    }
    return englishFallback(mood);
}

/**
 * Get variation patterns for a language.
 * @param {string} langCode
 * @param {Array} englishPatterns
 * @returns {Array}
 */
export function getLocalizedVariationPatterns(langCode, englishPatterns) {
    const bank = getPhraseBank(langCode);
    if (bank?.variationPatterns?.length > 0) {
        return bank.variationPatterns;
    }
    return englishPatterns;
}

// ── Current language context (set before generation, read by engine modules) ──
let _currentLangCode = 'en';

/**
 * Set the current generation language. Call this before generateSong().
 * Engine sub-modules will transparently use localized phrase banks.
 * @param {string} langOrCode
 */
export function setGenerationLanguage(langOrCode) {
    _currentLangCode = resolveLangCode(langOrCode);
}

/**
 * Get the current generation language code.
 * @returns {string}
 */
export function getGenerationLanguage() {
    return _currentLangCode;
}

/**
 * Get the currently active phrase bank (for the set generation language).
 * Returns null for English (engine uses built-in JS data).
 * @returns {object|null}
 */
export function getCurrentPhraseBank() {
    if (_currentLangCode === 'en') return null;
    return phraseCache.get(_currentLangCode) || null;
}

/**
 * Inject a pre-loaded phrase bank directly into cache (for tests).
 * Bypasses import.meta.glob for instant loading.
 */
export function injectPhraseBank(langCode, data) {
    const code = resolveLangCode(langCode);
    phraseCache.set(code, data);
}

export { SUPPORTED_LANG_CODES };
