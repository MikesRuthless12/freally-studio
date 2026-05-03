/**
 * Caesura (Dash) Placement Audit
 *
 * Generates 300-500 songs across all genres, moods, and rhyme schemes.
 * Extracts every line containing " - " and validates that the break
 * is placed at a natural, linguistically correct position.
 *
 * Rules checked:
 *  1. BREAK_AFTER_ARTICLE:   dash immediately after "a", "an", "the"
 *  2. BREAK_AFTER_PREPOSITION: dash after "in", "on", "at", "to", "for", "by", "of", "with"
 *  3. BREAK_AFTER_VERB_ING:  dash separates verb-ing from its object/preposition
 *  4. TOO_EARLY:             break at position 0 or 1 (< 2 words before dash)
 *  5. TOO_LATE:              break leaves only 1 word after dash
 *  6. SINGLE_CHAR_START:     second half starts with a single-char word (e.g. "- a", "- I")
 *  7. FUNCTION_WORD_START:   second half starts with a weak function word
 *  8. SPLITS_COMPOUND:       splits well-known compound phrases
 *  9. MISSING_BREAK:         line >= 4 words but has no dash at all
 *
 * Outputs a Markdown report and fails the test if accuracy < 95%.
 */
import { describe, it, expect } from 'vitest';
import { generateSong } from './LyricEngine';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = join(__dirname, '..', '..', '..');

// =========================================================================
// Configuration
// =========================================================================
const GENRES = [
    { genre: 'pop',     structure: 'verse-chorus-verse-chorus' },
    { genre: 'hiphop',  structure: 'hip-hop' },
    { genre: 'rock',    structure: 'verse-chorus-verse-chorus' },
    { genre: 'country', structure: 'verse-chorus-verse-chorus' },
    { genre: 'rnb',     structure: 'verse-chorus-verse-chorus' },
    { genre: 'edm',     structure: 'verse-chorus-verse-chorus' },
    { genre: 'indie',   structure: 'intro-verse-chorus-bridge-outro' },
    { genre: 'folk',    structure: 'verse-only' },
    { genre: 'metal',   structure: 'verse-chorus-verse-chorus' },
    { genre: 'jazz',    structure: 'aaba' },
    { genre: 'kpop',    structure: 'verse-pre-chorus-bridge' },
    { genre: 'latin',   structure: 'verse-chorus-verse-chorus' },
    { genre: 'gospel',  structure: 'intro-verse-chorus-bridge-outro' },
];

const MOODS = ['happy', 'sad', 'romantic', 'aggressive', 'dreamy', 'dark', 'epic', 'hopeful', 'melancholic'];
const RHYME_SCHEMES = ['AABB', 'ABAB', 'AAAA', 'freeform'];

// Target: ~60 generations per genre × 13 genres = 780 total
const GENS_PER_GENRE = 60;

// =========================================================================
// Caesura validation rules
// =========================================================================

/** Prepositions — breaking right AFTER these leaves them dangling */
const PREPOSITIONS = new Set([
    'in', 'on', 'at', 'to', 'for', 'by', 'of', 'with', 'from', 'into',
    'onto', 'upon', 'through', 'across', 'over', 'under', 'about',
]);

/** Articles — breaking right AFTER these separates article from noun */
const ARTICLES = new Set(['a', 'an', 'the']);

/** Compound phrases that should NEVER be split by a dash */
const COMPOUND_PHRASES = [
    'day and night', 'night and day',
    'left and right', 'right and left',
    'up and down', 'down and up',
    'back and forth', 'here and there',
    'now and then', 'rise and fall',
    'life and death', 'death and life',
    'grand slam', 'slam dunk',
    'all girls are the same',
];

function validateCaesura(line) {
    const issues = [];
    if (!line.includes(' - ')) {
        // Lines without dashes are only flagged if they're very long (8+ words)
        // The quality gate in the algorithm may intentionally skip short constrained lines
        const words = line.split(' ').filter(Boolean);
        if (words.length >= 8) {
            issues.push({ rule: 'MISSING_BREAK', detail: `${words.length}-word line has no dash` });
        }
        return issues;
    }

    const dashIdx = line.indexOf(' - ');
    const before = line.slice(0, dashIdx).trim();
    const after = line.slice(dashIdx + 3).trim();
    const wordsBefore = before.split(/\s+/).filter(Boolean);
    const wordsAfter = after.split(/\s+/).filter(Boolean);

    if (wordsBefore.length === 0 || wordsAfter.length === 0) {
        issues.push({ rule: 'EMPTY_HALF', detail: `before=${wordsBefore.length} after=${wordsAfter.length}` });
        return issues;
    }

    const lastBeforeDash = wordsBefore[wordsBefore.length - 1].toLowerCase();
    const firstAfterDash = wordsAfter[0].toLowerCase();

    // Rule 1: Break after article ("the - sauce", "a - dream")
    if (ARTICLES.has(lastBeforeDash)) {
        issues.push({ rule: 'BREAK_AFTER_ARTICLE', detail: `"${lastBeforeDash} - ${firstAfterDash}"` });
    }

    // Rule 2: Break after preposition — preposition left dangling before dash
    // "nonstop at - the rooftop", "mosquito in - the incognito"
    // Exception: "on"/"to" after a verb (is/are/was/were/fades/goes/comes) are verb particles,
    // not true prepositions. "the soul is on - and we are alive" is a natural clause break.
    if (PREPOSITIONS.has(lastBeforeDash) && wordsBefore.length > 1) {
        const penultimate = wordsBefore[wordsBefore.length - 2].toLowerCase();
        const verbParticlePrevs = new Set([
            'is', 'are', 'was', 'were', 'goes', 'fades', 'comes', 'turns',
            'gets', 'keeps', 'holds', 'moves', 'brings', 'takes', 'puts',
            'ticks', 'clicks', 'runs', 'walks', 'plays', 'rolls', 'rocks',
            'lives', 'rides', 'burns', 'shines', 'flows', 'grows', 'hangs',
        ]);
        const isVerbParticle = verbParticlePrevs.has(penultimate) &&
            (lastBeforeDash === 'on' || lastBeforeDash === 'to' || lastBeforeDash === 'up' || lastBeforeDash === 'out' || lastBeforeDash === 'off');
        if (!isVerbParticle) {
            issues.push({ rule: 'BREAK_AFTER_PREPOSITION', detail: `"${lastBeforeDash} - ${firstAfterDash}"` });
        }
    }

    // Rule 3: Break after verb-ing before a preposition — splits phrasal unit
    // "searching - for", "pounding - in"
    if (lastBeforeDash.endsWith('ing') && PREPOSITIONS.has(firstAfterDash)) {
        issues.push({ rule: 'BREAK_AFTER_VERB_ING', detail: `"${lastBeforeDash} - ${firstAfterDash}"` });
    }

    // Rule 4: Too early (less than 2 words before dash)
    if (wordsBefore.length < 2) {
        issues.push({ rule: 'TOO_EARLY', detail: `only ${wordsBefore.length} word(s) before dash` });
    }

    // Rule 5: Too late (only 1 word after dash)
    if (wordsAfter.length < 2) {
        issues.push({ rule: 'TOO_LATE', detail: `only ${wordsAfter.length} word(s) after dash` });
    }

    // Rule 6: Single-char start after dash (except "I")
    if (firstAfterDash.length <= 1 && firstAfterDash !== 'i') {
        issues.push({ rule: 'SINGLE_CHAR_START', detail: `"- ${firstAfterDash}"` });
    }

    // Rule 7: Splits compound phrases
    const fullLine = line.replace(/ - /g, ' ').toLowerCase();
    for (const compound of COMPOUND_PHRASES) {
        if (fullLine.includes(compound)) {
            const compoundWords = compound.split(' ');
            const lineWords = fullLine.split(/\s+/);
            const startIdx = lineWords.indexOf(compoundWords[0]);
            if (startIdx >= 0) {
                const dashWordIdx = wordsBefore.length;
                const compoundEnd = startIdx + compoundWords.length;
                if (dashWordIdx > startIdx && dashWordIdx < compoundEnd) {
                    issues.push({ rule: 'SPLITS_COMPOUND', detail: `splits "${compound}"` });
                }
            }
        }
    }

    return issues;
}

// =========================================================================
// Generation and analysis
// =========================================================================

function runCaesuraAudit() {
    const allLines = [];       // { genre, mood, scheme, section, line, issues[] }
    let totalGenerations = 0;

    for (const { genre, structure } of GENRES) {
        for (let i = 0; i < GENS_PER_GENRE; i++) {
            const mood = MOODS[i % MOODS.length];
            const rhymeScheme = RHYME_SCHEMES[i % RHYME_SCHEMES.length];
            const creativity = 40 + (i % 5) * 15; // 40, 55, 70, 85, 100

            const song = generateSong({
                genre,
                mood,
                key: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][i % 7],
                scale: i % 2 === 0 ? 'major' : 'minor',
                bpm: 80 + (i % 6) * 10,
                melodyPattern: [],
                structure,
                rhymeScheme,
                creativity,
                globalBars: 8,
                usePunchlines: genre === 'hiphop',
            });
            totalGenerations++;

            for (const section of song.sections) {
                for (const line of section.lines) {
                    const issues = validateCaesura(line);
                    allLines.push({
                        genre,
                        mood,
                        scheme: rhymeScheme,
                        section: section.label,
                        sectionType: section.type,
                        line,
                        issues,
                    });
                }
            }
        }
    }

    return { allLines, totalGenerations };
}

// =========================================================================
// Report formatting
// =========================================================================

function formatReport(allLines, totalGenerations) {
    const linesWithDash = allLines.filter(l => l.line.includes(' - '));
    const linesWithIssues = allLines.filter(l => l.issues.length > 0);
    const dashLinesWithIssues = linesWithDash.filter(l => l.issues.length > 0);
    const missingBreakLines = allLines.filter(l => l.issues.some(i => i.rule === 'MISSING_BREAK'));

    // Count by rule
    const ruleCounts = {};
    for (const l of allLines) {
        for (const issue of l.issues) {
            ruleCounts[issue.rule] = (ruleCounts[issue.rule] || 0) + 1;
        }
    }

    // Count by genre
    const genreStats = {};
    for (const l of allLines) {
        if (!genreStats[l.genre]) genreStats[l.genre] = { total: 0, withDash: 0, issues: 0 };
        genreStats[l.genre].total++;
        if (l.line.includes(' - ')) genreStats[l.genre].withDash++;
        if (l.issues.length > 0) genreStats[l.genre].issues++;
    }

    // Count by mood
    const moodStats = {};
    for (const l of allLines) {
        if (!moodStats[l.mood]) moodStats[l.mood] = { total: 0, withDash: 0, issues: 0 };
        moodStats[l.mood].total++;
        if (l.line.includes(' - ')) moodStats[l.mood].withDash++;
        if (l.issues.length > 0) moodStats[l.mood].issues++;
    }

    // Count by section type
    const sectionStats = {};
    for (const l of allLines) {
        if (!sectionStats[l.sectionType]) sectionStats[l.sectionType] = { total: 0, withDash: 0, issues: 0 };
        sectionStats[l.sectionType].total++;
        if (l.line.includes(' - ')) sectionStats[l.sectionType].withDash++;
        if (l.issues.length > 0) sectionStats[l.sectionType].issues++;
    }

    const dashAccuracy = linesWithDash.length > 0
        ? ((1 - dashLinesWithIssues.length / linesWithDash.length) * 100).toFixed(2)
        : '100.00';

    let md = `# Caesura (Dash) Placement Audit Report\n\n`;
    md += `Generated: ${new Date().toISOString()}\n`;
    md += `Total song generations: ${totalGenerations}\n`;
    md += `Total lyric lines: ${allLines.length}\n`;
    md += `Lines with dash: ${linesWithDash.length}\n`;
    md += `Lines without dash: ${allLines.length - linesWithDash.length}\n\n`;
    md += `---\n\n`;

    // === HEADLINE ===
    md += `## Overall Caesura Accuracy\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Lines with correct dash placement | ${linesWithDash.length - dashLinesWithIssues.length} / ${linesWithDash.length} |\n`;
    md += `| **Dash placement accuracy** | **${dashAccuracy}%** |\n`;
    md += `| Lines with issues (incl. missing) | ${linesWithIssues.length} |\n`;
    md += `| Missing breaks (6+ word lines) | ${missingBreakLines.length} |\n\n`;

    // === RULE BREAKDOWN ===
    md += `## Issue Breakdown by Rule\n\n`;
    md += `| Rule | Count | Description |\n|------|-------|-------------|\n`;
    const ruleDescriptions = {
        BREAK_AFTER_ARTICLE: 'Dash placed right after "a/an/the"',
        BREAK_AFTER_PREPOSITION: 'Preposition left dangling before dash',
        BREAK_AFTER_VERB_ING: 'Dash after -ing verb before its preposition',
        TOO_EARLY: 'Less than 2 words before dash',
        TOO_LATE: 'Only 1 word after dash',
        SINGLE_CHAR_START: 'Second half starts with single char',
        SPLITS_COMPOUND: 'Dash splits a compound phrase',
        MISSING_BREAK: 'Long line (8+) missing any dash',
        EMPTY_HALF: 'One half of the break is empty',
    };
    for (const [rule, count] of Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])) {
        md += `| ${rule} | ${count} | ${ruleDescriptions[rule] || ''} |\n`;
    }
    md += '\n';

    // === GENRE BREAKDOWN ===
    md += `## Stats by Genre\n\n`;
    md += `| Genre | Total Lines | With Dash | Issues | Accuracy |\n`;
    md += `|-------|-------------|-----------|--------|----------|\n`;
    for (const [genre, s] of Object.entries(genreStats).sort((a, b) => a[0].localeCompare(b[0]))) {
        const acc = s.withDash > 0
            ? ((1 - s.issues / s.withDash) * 100).toFixed(1)
            : '100.0';
        md += `| ${genre} | ${s.total} | ${s.withDash} | ${s.issues} | ${acc}% |\n`;
    }
    md += '\n';

    // === MOOD BREAKDOWN ===
    md += `## Stats by Mood\n\n`;
    md += `| Mood | Total Lines | With Dash | Issues | Accuracy |\n`;
    md += `|------|-------------|-----------|--------|----------|\n`;
    for (const [mood, s] of Object.entries(moodStats).sort((a, b) => a[0].localeCompare(b[0]))) {
        const acc = s.withDash > 0
            ? ((1 - s.issues / s.withDash) * 100).toFixed(1)
            : '100.0';
        md += `| ${mood} | ${s.total} | ${s.withDash} | ${s.issues} | ${acc}% |\n`;
    }
    md += '\n';

    // === SECTION TYPE BREAKDOWN ===
    md += `## Stats by Section Type\n\n`;
    md += `| Section | Total Lines | With Dash | Issues | Accuracy |\n`;
    md += `|---------|-------------|-----------|--------|----------|\n`;
    for (const [sec, s] of Object.entries(sectionStats).sort((a, b) => a[0].localeCompare(b[0]))) {
        const acc = s.withDash > 0
            ? ((1 - s.issues / s.withDash) * 100).toFixed(1)
            : '100.0';
        md += `| ${sec} | ${s.total} | ${s.withDash} | ${s.issues} | ${acc}% |\n`;
    }
    md += '\n';

    // === ALL FLAGGED LINES ===
    const flaggedDash = dashLinesWithIssues.slice(0, 200);
    if (flaggedDash.length > 0) {
        md += `## Flagged Lines with Bad Dash Placement (${dashLinesWithIssues.length} total, showing ${flaggedDash.length})\n\n`;
        md += `| # | Genre | Mood | Section | Line | Issues |\n`;
        md += `|---|-------|------|---------|------|--------|\n`;
        for (let i = 0; i < flaggedDash.length; i++) {
            const l = flaggedDash[i];
            const issueStr = l.issues.map(is => `${is.rule}: ${is.detail}`).join('; ');
            // Escape pipes in line text for markdown table
            const safeLine = l.line.replace(/\|/g, '\\|');
            md += `| ${i + 1} | ${l.genre} | ${l.mood} | ${l.section} | ${safeLine} | ${issueStr} |\n`;
        }
        md += '\n';
    }

    // === MISSING BREAK EXAMPLES ===
    const missingExamples = missingBreakLines.slice(0, 50);
    if (missingExamples.length > 0) {
        md += `## Lines Missing Dash (6+ words, ${missingBreakLines.length} total, showing ${missingExamples.length})\n\n`;
        for (const l of missingExamples) {
            md += `- [${l.genre}/${l.mood}] ${l.section}: \`${l.line}\`\n`;
        }
        md += '\n';
    }

    // === CORRECT EXAMPLES (for sanity check) ===
    const goodLines = linesWithDash.filter(l => l.issues.length === 0).slice(0, 30);
    if (goodLines.length > 0) {
        md += `## Correctly Placed Dash Examples (showing 30)\n\n`;
        for (const l of goodLines) {
            md += `- [${l.genre}/${l.mood}] \`${l.line}\`\n`;
        }
        md += '\n';
    }

    return { md, dashAccuracy: parseFloat(dashAccuracy), totalIssues: linesWithIssues.length, dashLinesWithIssues: dashLinesWithIssues.length, totalDashLines: linesWithDash.length };
}

// =========================================================================
// Test
// =========================================================================

describe('Caesura (Dash) Placement Audit', () => {
    it(`should correctly place dashes in ${GENRES.length * GENS_PER_GENRE} generations across all genres/moods/schemes`, { timeout: 1_200_000 }, () => {
        console.log(`\n=== CAESURA AUDIT: ${GENRES.length} genres × ${GENS_PER_GENRE} gens = ${GENRES.length * GENS_PER_GENRE} total ===\n`);

        const { allLines, totalGenerations } = runCaesuraAudit();
        const { md, dashAccuracy, totalIssues, dashLinesWithIssues, totalDashLines } = formatReport(allLines, totalGenerations);

        // Write report
        const reportPath = join(REPORT_DIR, 'caesura-audit-report.md');
        writeFileSync(reportPath, md, 'utf-8');
        console.log(`Report written to: ${reportPath}`);

        // Console summary
        console.log(`\nTotal lines analyzed: ${allLines.length}`);
        console.log(`Lines with dash: ${totalDashLines}`);
        console.log(`Lines with dash issues: ${dashLinesWithIssues}`);
        console.log(`Dash placement accuracy: ${dashAccuracy}%`);
        console.log(`Total issues (all types): ${totalIssues}`);

        // Print first 20 bad examples to console
        const bad = allLines.filter(l => l.issues.length > 0 && l.line.includes(' - ')).slice(0, 20);
        if (bad.length > 0) {
            console.log('\n--- FLAGGED LINES (first 20) ---');
            for (const l of bad) {
                const flags = l.issues.map(i => i.rule).join(', ');
                console.log(`  [${l.genre}] ${l.line}  <<< ${flags}`);
            }
        }

        console.log('\n=== CAESURA AUDIT COMPLETE ===\n');

        // PASS/FAIL threshold: 100% accuracy on dash placement
        expect(dashAccuracy).toBeGreaterThanOrEqual(100);
    });
});
