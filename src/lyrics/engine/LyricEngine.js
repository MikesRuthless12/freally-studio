/**
 * LyricEngine — Main orchestrator for deterministic lyric generation.
 *
 * Architecture:
 *   LyricEngine
 *    ├── GenreBank
 *    ├── PhraseConstructor
 *    ├── RhymeEngine
 *    ├── SyllableBalancer
 *    ├── StructureGenerator
 *    ├── MelodyMatcher
 *    ├── HookGenerator
 *    └── ExportFormatter
 *
 * Plugin system allows registering extension modules (e.g. CinematicMode, DuetMode).
 */

import { getGenreBank, getMoodModifier, setLocalizedPhraseBank } from './GenreBank';
import { constructSection, createRNG, getEndingSound } from './PhraseConstructor';
import { scoreRhymeScheme, detectRhymePattern, setLocalizedRhymeFamilies } from './RhymeEngine';
import { getSyllableTargets, countLineSyllables } from './SyllableBalancer';
import { getStructure, buildGenerationPlan, getRhymeSchemeForSection, getAvailableStructures } from './StructureGenerator';
import { extractMelodyStructure, mapSectionsToMelody, getLineTiming, phraseSyllableCount } from './MelodyMatcher';
import { generateChorus, scoreHookCatchiness, setLocalizedHookBank } from './HookGenerator';
import { formatAsTXT, formatAsLRC, formatAsJSON, formatAsProject, downloadFile } from './ExportFormatter';
import { getPunchlineCount, isPunchlineLine, setLocalizedPunchlineBank } from './PunchlineBank';
import { setGenerationLanguage, getGenerationLanguage, getCurrentPhraseBank, resolveLangCode } from './PhraseLoader';

/**
 * @typedef {object} LyricEngineConfig
 * @property {string} genre
 * @property {string} mood
 * @property {string} key
 * @property {string} scale
 * @property {number} bpm
 * @property {Array} melodyPattern - MIDI melody notes
 * @property {string} structure - structure template key
 * @property {string} rhymeScheme - 'AABB', 'ABAB', 'AAAA', 'freeform'
 * @property {string} language
 * @property {number} creativity - 0-100
 * @property {number} globalBars
 */

/**
 * @typedef {object} GeneratedSong
 * @property {Array<{type: string, label: string, lines: string[], timing?: Array}>} sections
 * @property {object} metadata
 * @property {object} analysis
 */

// Plugin registry
const plugins = new Map();

/**
 * Register a plugin module.
 * @param {string} name - plugin identifier
 * @param {object} module - { onBeforeGenerate?, onAfterGenerate?, onSectionGenerate?, transform? }
 */
export function registerPlugin(name, module) {
    plugins.set(name, module);
}

/**
 * Unregister a plugin.
 * @param {string} name
 */
export function unregisterPlugin(name) {
    plugins.delete(name);
}

/**
 * Get all registered plugins.
 * @returns {string[]}
 */
export function getPlugins() {
    return Array.from(plugins.keys());
}

/**
 * Run plugin hooks of a given type.
 * @param {string} hookName
 * @param {object} data
 * @returns {object}
 */
function runPluginHook(hookName, data) {
    let result = data;
    for (const [, plugin] of plugins) {
        if (typeof plugin[hookName] === 'function') {
            const modified = plugin[hookName](result);
            if (modified) result = modified;
        }
    }
    return result;
}

/**
 * Generate a complete song.
 * @param {LyricEngineConfig} config
 * @returns {GeneratedSong}
 */
export function generateSong(config) {
    const {
        genre = 'pop',
        mood = 'happy',
        key = 'C',
        scale = 'major',
        bpm = 120,
        melodyPattern = [],
        structure = 'verse-chorus-verse-chorus',
        rhymeScheme = 'AABB',
        language = 'English',
        creativity = 50,
        globalBars = 4,
        usePunchlines = false,
    } = config;

    const startTime = performance.now();

    // Set the generation language so all sub-modules use localized phrase banks
    const langCode = resolveLangCode(language);
    setGenerationLanguage(langCode);
    // Set localized data in sub-modules
    const phraseBank = getCurrentPhraseBank();
    setLocalizedRhymeFamilies(phraseBank?.rhymeFamilies || null);
    setLocalizedPhraseBank(phraseBank);
    setLocalizedPunchlineBank(phraseBank);
    setLocalizedHookBank(phraseBank);

    // Run pre-generation plugin hooks
    const processedConfig = runPluginHook('onBeforeGenerate', {
        genre, mood, key, scale, bpm, melodyPattern, structure,
        rhymeScheme, language, creativity, globalBars, usePunchlines,
    });

    // Create seeded RNG based on config for reproducibility when creativity is low
    const seed = creativity < 30
        ? hashString(`${genre}${mood}${key}${scale}${bpm}${structure}${rhymeScheme}`)
        : Date.now() + Math.floor(Math.random() * 10000);
    const rng = createRNG(seed);

    // Add randomness based on creativity slider
    const creativityRng = () => {
        const base = rng();
        if (creativity > 70) {
            // High creativity: add more randomness
            return (base + Math.random()) / 2;
        }
        return base;
    };

    // Build generation plan
    const plan = buildGenerationPlan(processedConfig.structure || structure);

    // Extract melody structure if available
    const melodyStructure = extractMelodyStructure(
        processedConfig.melodyPattern || melodyPattern,
        processedConfig.globalBars || globalBars
    );
    const sectionMelodyMap = mapSectionsToMelody(plan, melodyStructure);

    // Generate each section
    const usedPhrases = new Set();
    const sections = [];
    let chorusLines = null; // Store chorus for repetition

    for (let i = 0; i < plan.length; i++) {
        const section = plan[i];
        const melodyMap = sectionMelodyMap[i];

        // Determine rhyme pattern for this section
        const sectionRhymePattern = getRhymeSchemeForSection(
            section.type,
            section.lines,
            processedConfig.rhymeScheme || rhymeScheme
        );

        // Get syllable targets
        const syllableTargets = [];
        if (melodyStructure.hasData && melodyMap.phraseIndices.length > 0) {
            for (const phraseIdx of melodyMap.phraseIndices) {
                const phrase = melodyStructure.phrases[phraseIdx];
                syllableTargets.push(phraseSyllableCount(phrase?.notes || []));
            }
        }
        // Fill remaining with BPM-based estimates
        while (syllableTargets.length < section.lines) {
            syllableTargets.push(
                ...getSyllableTargets(section.type, section.lines - syllableTargets.length, processedConfig.bpm || bpm)
            );
        }

        let lines;

        if (section.type === 'chorus') {
            if (section.isRepeat && chorusLines) {
                // Repeat the chorus
                lines = [...chorusLines];
            } else {
                // Generate new chorus with hook
                lines = generateChorus(
                    processedConfig.genre || genre,
                    processedConfig.mood || mood,
                    section.lines,
                    sectionRhymePattern,
                    creativityRng,
                    usedPhrases,
                    processedConfig.usePunchlines ?? usePunchlines
                );
                chorusLines = [...lines];
                // Track chorus lines in usedPhrases for variety
                for (const l of lines) usedPhrases.add(l);
            }
        } else {
            // Generate verse/bridge/etc.
            lines = constructSection(
                section.type,
                section.lines,
                processedConfig.genre || genre,
                processedConfig.mood || mood,
                syllableTargets,
                sectionRhymePattern,
                creativityRng,
                usedPhrases,
                processedConfig.usePunchlines ?? usePunchlines
            );
        }

        // Calculate timing if melody data exists
        let timing = null;
        if (melodyStructure.hasData) {
            timing = melodyMap.phraseIndices.map(phraseIdx => {
                const phrase = melodyStructure.phrases[phraseIdx];
                return getLineTiming(phrase, processedConfig.bpm || bpm);
            });
        }

        // Run section plugin hook
        const sectionResult = runPluginHook('onSectionGenerate', {
            section,
            lines,
            timing,
            index: i,
        });

        sections.push({
            type: section.type,
            label: section.label,
            lines: sectionResult.lines || lines,
            timing: sectionResult.timing || timing,
            role: section.role,
            rhymePattern: sectionRhymePattern,
        });
    }

    // Final pass: strip any unfilled template placeholders from all lines
    for (const section of sections) {
        section.lines = section.lines.map(line =>
            line.replace(/\{[a-z_0-9]+\}/gi, '').replace(/\s{2,}/g, ' ').trim()
        );
    }

    // Analyze the generated lyrics
    const analysis = analyzeSong(sections, processedConfig.rhymeScheme || rhymeScheme);

    const result = {
        sections,
        metadata: {
            genre: processedConfig.genre || genre,
            mood: processedConfig.mood || mood,
            key: processedConfig.key || key,
            scale: processedConfig.scale || scale,
            bpm: processedConfig.bpm || bpm,
            structure: processedConfig.structure || structure,
            rhymeScheme: processedConfig.rhymeScheme || rhymeScheme,
            language: processedConfig.language || language,
            creativity: processedConfig.creativity ?? creativity,
            usePunchlines: processedConfig.usePunchlines ?? usePunchlines,
            generationTimeMs: Math.round(performance.now() - startTime),
        },
        analysis,
    };

    // Run post-generation plugin hooks
    return runPluginHook('onAfterGenerate', result);
}

/**
 * Regenerate a single section while preserving the rest.
 * @param {GeneratedSong} song
 * @param {number} sectionIndex
 * @param {LyricEngineConfig} config
 * @returns {GeneratedSong}
 */
export function regenerateSection(song, sectionIndex, config) {
    if (sectionIndex < 0 || sectionIndex >= song.sections.length) return song;

    const section = song.sections[sectionIndex];
    const rng = createRNG(Date.now());

    const rhymePattern = getRhymeSchemeForSection(
        section.type,
        section.lines.length,
        config.rhymeScheme || 'AABB'
    );

    const syllableTargets = getSyllableTargets(
        section.type,
        section.lines.length,
        config.bpm || 120
    );

    // Collect existing phrases from other sections for variety
    const existingPhrases = new Set();
    song.sections.forEach((s, i) => {
        if (i !== sectionIndex) s.lines.forEach(l => existingPhrases.add(l));
    });

    let newLines;
    if (section.type === 'chorus') {
        newLines = generateChorus(
            config.genre || 'pop',
            config.mood || 'happy',
            section.lines.length,
            rhymePattern,
            rng,
            existingPhrases,
            config.usePunchlines || false
        );
    } else {
        newLines = constructSection(
            section.type,
            section.lines.length,
            config.genre || 'pop',
            config.mood || 'happy',
            syllableTargets,
            rhymePattern,
            rng,
            new Set(),
            config.usePunchlines || false
        );
    }

    const newSections = [...song.sections];
    newSections[sectionIndex] = {
        ...section,
        lines: newLines,
    };

    const analysis = analyzeSong(newSections, config.rhymeScheme || 'AABB');

    return {
        ...song,
        sections: newSections,
        analysis,
    };
}

/**
 * Score rhyme scheme adherence for non-English using ending-sound matching.
 * @param {string[]} lines
 * @param {string} scheme - e.g. 'AABB', 'ABAB'
 * @param {string} langCode
 * @returns {{ score: number }}
 */
function scoreRhymeSchemeNonEnglish(lines, scheme, langCode) {
    if (!lines || lines.length === 0) return { score: 0 };

    const schemeChars = scheme.toUpperCase().split('');
    const endingGroups = {}; // letter -> ending sound of first line in group
    let matches = 0;
    let total = 0;

    for (let i = 0; i < lines.length && i < schemeChars.length; i++) {
        const letter = schemeChars[i];
        if (letter === 'X') continue; // free line, no rhyme required

        const ending = getEndingSound(lines[i], langCode);
        if (!ending) continue;

        if (!endingGroups[letter]) {
            // First occurrence — sets the rhyme target
            endingGroups[letter] = ending;
            matches++;
        } else {
            // Check if ending matches (exact 3-char, or relaxed 2-char)
            const target = endingGroups[letter];
            const exact = ending === target;
            const relaxed = ending.length >= 2 && target.length >= 2
                && ending.slice(-2) === target.slice(-2);
            if (exact || relaxed) matches++;
        }
        total++;
    }

    return { score: total > 0 ? matches / total : 0 };
}

/**
 * Analyze generated lyrics for quality metrics.
 * @param {Array<{lines: string[], rhymePattern?: string}>} sections
 * @param {string} rhymeScheme
 * @returns {object}
 */
function analyzeSong(sections, rhymeScheme) {
    const langCode = getGenerationLanguage();
    const isNonEnglish = langCode !== 'en';

    let totalLines = 0;
    let totalSyllables = 0;
    let totalRhymeScore = 0;
    let rhymeSectionCount = 0;
    let punchlineLines = 0;
    const hookScores = [];

    for (const section of sections) {
        totalLines += section.lines.length;
        for (const line of section.lines) {
            totalSyllables += countLineSyllables(line);
            // Count punchline references
            if (isPunchlineLine(line)) punchlineLines++;
        }

        // Score rhyme adherence
        if (section.rhymePattern && section.rhymePattern !== 'X'.repeat(section.lines.length)) {
            const rhymeResult = isNonEnglish
                ? scoreRhymeSchemeNonEnglish(section.lines, section.rhymePattern, langCode)
                : scoreRhymeScheme(section.lines, section.rhymePattern);
            totalRhymeScore += rhymeResult.score;
            rhymeSectionCount++;
        }

        // Score hooks in chorus sections
        if (section.type === 'chorus' && section.lines.length > 0) {
            const hookResult = scoreHookCatchiness(section.lines[0]);
            hookScores.push(hookResult.score);
        }
    }

    const avgSyllablesPerLine = totalLines > 0 ? Math.round(totalSyllables / totalLines) : 0;
    const rhymeAccuracy = rhymeSectionCount > 0 ? Math.round((totalRhymeScore / rhymeSectionCount) * 100) : 0;
    const avgHookScore = hookScores.length > 0 ? Math.round(hookScores.reduce((a, b) => a + b, 0) / hookScores.length) : 0;
    const detectedPattern = sections.length > 0 ? detectRhymePattern(sections[0].lines) : '';
    const punchlineScore = totalLines > 0 ? Math.round((punchlineLines / totalLines) * 100) : 0;

    return {
        totalLines,
        totalSyllables,
        avgSyllablesPerLine,
        rhymeAccuracy,
        avgHookScore,
        punchlineScore,
        punchlineLines,
        detectedPattern,
        sectionCount: sections.length,
    };
}

/**
 * Export lyrics in a given format.
 * @param {GeneratedSong} song
 * @param {string} format - 'txt', 'lrc', 'json', 'project'
 * @param {object} metadata - optional metadata for export
 */
export function exportLyrics(song, format, metadata = {}) {
    switch (format) {
        case 'txt': {
            const content = formatAsTXT(song.sections);
            downloadFile(content, `lyrics-${Date.now()}.txt`, 'text/plain');
            break;
        }
        case 'lrc': {
            const content = formatAsLRC(song.sections, metadata);
            downloadFile(content, `lyrics-${Date.now()}.lrc`, 'text/plain');
            break;
        }
        case 'json': {
            const content = formatAsJSON(song.sections, song.metadata);
            downloadFile(content, `lyrics-${Date.now()}.json`, 'application/json');
            break;
        }
        case 'project': {
            const content = JSON.stringify(formatAsProject(song.sections, song.metadata), null, 2);
            downloadFile(content, `lyrics-${Date.now()}.wavloom-lyrics`, 'application/json');
            break;
        }
        default:
            break;
    }
}

/**
 * Simple string hash for seed generation.
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// Re-export utilities for external use
export { getAvailableStructures };
export { formatAsTXT, formatAsLRC, formatAsJSON };
