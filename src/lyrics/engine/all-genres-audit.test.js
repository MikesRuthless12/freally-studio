/**
 * All Genres Lyrics Generation Audit
 *
 * Runs 100 generations per genre (no punchlines — only hip-hop has those),
 * cycling through all 4 rhyme schemes and all moods.
 * Outputs a separate .md report for each genre.
 */
import { describe, it } from 'vitest';
import { generateSong } from './LyricEngine';
import { wordsRhyme, getLastWord } from './RhymeEngine';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = join(__dirname, '..', '..', '..');

// =========================================================================
// Genre configurations
// =========================================================================
const GENRES = [
    { genre: 'pop',     structure: 'verse-chorus-verse-chorus' },
    { genre: 'rock',    structure: 'verse-chorus-verse-chorus' },
    { genre: 'country', structure: 'verse-chorus-verse-chorus' },
    { genre: 'r&b',     structure: 'verse-chorus-verse-chorus' },
    { genre: 'edm',     structure: 'verse-chorus-verse-chorus' },
    { genre: 'indie',   structure: 'intro-verse-chorus-bridge-outro' },
    { genre: 'folk',    structure: 'verse-only' },
    { genre: 'metal',   structure: 'verse-chorus-verse-chorus' },
    { genre: 'jazz',    structure: 'aaba' },
    { genre: 'k-pop',   structure: 'verse-pre-chorus-bridge' },
    { genre: 'latin',   structure: 'verse-chorus-verse-chorus' },
    { genre: 'gospel',  structure: 'intro-verse-chorus-bridge-outro' },
];

const MOODS = ['happy', 'sad', 'romantic', 'aggressive', 'dreamy', 'dark', 'epic', 'hopeful', 'melancholic'];
const RHYME_SCHEMES = ['AABB', 'ABAB', 'AAAA', 'freeform'];

// =========================================================================
// Issue-detection helpers (same as hip-hop audit)
// =========================================================================

function detectNonsenseIssues(line) {
    const issues = [];
    const cleaned = line.replace(/ - /g, ' ').toLowerCase();
    const words = cleaned.split(/\s+/).filter(Boolean);

    // 1. Repeated adjacent words
    for (let i = 0; i < words.length - 1; i++) {
        if (words[i] === words[i + 1] && !['go', 'no', 'yeah', 'oh', 'hey', 'na', 'la', 'louder', 'spinning', 'alive', 'hallelujah', 'sabor', 'vamos', 'baila', 'dale', 'encore', 'night', 'higher', 'deeper', 'faster', 'stronger', 'cha', 'knock', 'dollar', 'bang', 'boom', 'clap', 'stomp'].includes(words[i])) {
            issues.push(`REPEATED_WORD: "${words[i]} ${words[i + 1]}"`);
        }
    }

    // 2. Line too short (< 3 words)
    if (words.length < 3) {
        issues.push(`TOO_SHORT: only ${words.length} words`);
    }

    // 3. Line too long (> 20 words)
    if (words.length > 20) {
        issues.push(`TOO_LONG: ${words.length} words`);
    }

    // 4. Weak endings
    const weakEndings = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be']);
    const lastWord = words[words.length - 1];
    if (weakEndings.has(lastWord)) {
        issues.push(`WEAK_ENDING: ends with "${lastWord}"`);
    }

    // 5. Filler starts
    const fillerStarts = ['um', 'uh', 'er', 'hmm'];
    if (fillerStarts.includes(words[0])) {
        issues.push(`FILLER_START: starts with "${words[0]}"`);
    }

    // 6. Template artifacts
    if (cleaned.includes('{') || cleaned.includes('}')) {
        issues.push(`TEMPLATE_ARTIFACT: contains unfilled placeholder`);
    }

    // 7. undefined/null
    if (cleaned.includes('undefined') || cleaned === 'null') {
        issues.push(`BAD_VALUE: contains undefined/null`);
    }

    // 8. Article + verb grammar
    const articleVerbPattern = /\bthe\s+(survive|define|refine|arrive|thrive|derive|decide|provide|confide|collide|inspire|admire|retire|conspire|require|acquire|expire|contain|explain|maintain|obtain|detain|attain|complain|restrain|compose|dispose|oppose|propose|ignore|explore|restore|implore|defend|offend|pretend|attend|extend|intend|contend|depend|transcend|descend|compete|betray|convey|portray|obey|repay|replace|erase|evade|invade|persuade|compel|expel|propel|repel|excel|redeem|bestow|borrow)\b/;
    if (articleVerbPattern.test(cleaned)) {
        const match = cleaned.match(articleVerbPattern);
        issues.push(`ARTICLE_VERB: "the ${match[1]}" — verb used as noun`);
    }

    // 9. Too generic
    const genericOnly = new Set(['the', 'a', 'an', 'i', 'we', 'you', 'they', 'it', 'is', 'was', 'are', 'and', 'or', 'but', 'in', 'on', 'to', 'of', 'my', 'your', 'our']);
    const nonGenericWords = words.filter(w => !genericOnly.has(w));
    if (nonGenericWords.length <= 1 && words.length > 2) {
        issues.push(`TOO_GENERIC: almost all function words`);
    }

    return issues;
}

function checkRhymeAccuracy(lines, scheme) {
    const results = [];
    const schemeLen = scheme.length;
    const rhymeGroups = {};

    for (let i = 0; i < lines.length; i++) {
        const letter = scheme[i % schemeLen];
        const endWord = getLastWord(lines[i]);

        if (letter === 'X') {
            results.push({ line: i, letter, endWord, target: null, rhymes: true, firstOfGroup: true, freeform: true });
            continue;
        }

        if (!rhymeGroups[letter]) {
            rhymeGroups[letter] = { word: endWord, lineIdx: i };
            results.push({ line: i, letter, endWord, target: null, rhymes: true, firstOfGroup: true });
        } else {
            const target = rhymeGroups[letter].word;
            const rhymes = endWord && target ? wordsRhyme(target, endWord) : false;
            results.push({ line: i, letter, endWord, target, rhymes, firstOfGroup: false });
        }
    }
    return results;
}

// =========================================================================
// Run generations for a single genre
// =========================================================================

function runGenreAudit(genreName, structureKey, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        const mood = MOODS[i % MOODS.length];
        const rhymeScheme = RHYME_SCHEMES[i % RHYME_SCHEMES.length];
        const creativity = 50 + (i % 3) * 20;

        const song = generateSong({
            genre: genreName,
            mood,
            key: 'C',
            scale: i % 2 === 0 ? 'major' : 'minor',
            bpm: 90 + (i % 4) * 10,
            melodyPattern: [],
            structure: structureKey,
            rhymeScheme,
            creativity,
            globalBars: 8,
            usePunchlines: false,
        });

        const sectionAnalysis = song.sections.map(section => {
            const rhymeCheck = checkRhymeAccuracy(section.lines, section.rhymePattern || rhymeScheme);
            const lineIssues = section.lines.map((line, li) => ({
                lineIdx: li,
                text: line,
                nonsenseIssues: detectNonsenseIssues(line),
            }));
            const rhymeFailures = rhymeCheck.filter(r => !r.firstOfGroup && !r.rhymes);
            return {
                label: section.label,
                type: section.type,
                lines: section.lines,
                rhymePattern: section.rhymePattern,
                rhymeCheck,
                rhymeFailures,
                lineIssues,
            };
        });

        results.push({
            id: i + 1,
            mood,
            rhymeScheme,
            creativity,
            bpm: 90 + (i % 4) * 10,
            scale: i % 2 === 0 ? 'major' : 'minor',
            analysis: song.analysis,
            sectionAnalysis,
        });
    }
    return results;
}

// =========================================================================
// Report formatting
// =========================================================================

function formatGenreReport(genreName, structureKey, results) {
    let md = `# ${genreName.toUpperCase()} Lyrics Generation Audit Report\n\n`;
    md += `Generated: ${new Date().toISOString()}\n`;
    md += `Structure: ${structureKey}\n`;
    md += `Generations: ${results.length}\n`;
    md += `Rhyme schemes: ${RHYME_SCHEMES.join(', ')}\n`;
    md += `Moods: ${MOODS.join(', ')}\n\n`;
    md += '---\n\n';

    // Aggregate stats
    let totalRhymeFailures = 0;
    let totalRhymePairs = 0;
    let totalNonsenseIssues = 0;
    let totalLines = 0;
    const issueTypes = {};
    const failedRhymePairs = [];
    const weakEndingExamples = [];
    const articleVerbExamples = [];
    const tooShortExamples = [];
    const tooLongExamples = [];
    const criticalExamples = [];

    // Per-scheme stats
    const schemeStats = {};
    for (const scheme of RHYME_SCHEMES) {
        schemeStats[scheme] = { pairs: 0, failures: 0 };
    }

    // Per-mood stats
    const moodStats = {};
    for (const m of MOODS) {
        moodStats[m] = { lines: 0, issues: 0, rhymePairs: 0, rhymeFailures: 0 };
    }

    for (const gen of results) {
        for (const section of gen.sectionAnalysis) {
            totalLines += section.lines.length;
            totalRhymeFailures += section.rhymeFailures.length;
            const pairsInSection = section.rhymeCheck.filter(r => !r.firstOfGroup && !r.freeform).length;
            totalRhymePairs += pairsInSection;

            // Per-scheme
            schemeStats[gen.rhymeScheme].pairs += pairsInSection;
            schemeStats[gen.rhymeScheme].failures += section.rhymeFailures.length;

            // Per-mood
            moodStats[gen.mood].lines += section.lines.length;
            moodStats[gen.mood].rhymePairs += pairsInSection;
            moodStats[gen.mood].rhymeFailures += section.rhymeFailures.length;

            for (const rf of section.rhymeFailures) {
                failedRhymePairs.push({
                    genId: gen.id,
                    mood: gen.mood,
                    scheme: gen.rhymeScheme,
                    section: section.label,
                    endWord: rf.endWord,
                    target: rf.target,
                    line: section.lines[rf.line],
                    targetLine: section.lines[section.rhymeCheck.find(r => r.firstOfGroup && r.letter === rf.letter)?.line] || '?',
                });
            }

            for (const li of section.lineIssues) {
                for (const issue of li.nonsenseIssues) {
                    totalNonsenseIssues++;
                    const type = issue.split(':')[0];
                    issueTypes[type] = (issueTypes[type] || 0) + 1;
                    moodStats[gen.mood].issues++;

                    if (type === 'WEAK_ENDING' && weakEndingExamples.length < 25) {
                        weakEndingExamples.push({ genId: gen.id, mood: gen.mood, scheme: gen.rhymeScheme, section: section.label, line: li.text, issue });
                    }
                    if (type === 'ARTICLE_VERB' && articleVerbExamples.length < 25) {
                        articleVerbExamples.push({ genId: gen.id, mood: gen.mood, scheme: gen.rhymeScheme, section: section.label, line: li.text, issue });
                    }
                    if (type === 'TOO_SHORT' && tooShortExamples.length < 20) {
                        tooShortExamples.push({ genId: gen.id, mood: gen.mood, scheme: gen.rhymeScheme, section: section.label, line: li.text, issue });
                    }
                    if (type === 'TOO_LONG' && tooLongExamples.length < 20) {
                        tooLongExamples.push({ genId: gen.id, mood: gen.mood, scheme: gen.rhymeScheme, section: section.label, line: li.text, issue });
                    }
                    if (['TEMPLATE_ARTIFACT', 'BAD_VALUE', 'REPEATED_WORD', 'TOO_GENERIC'].includes(type)) {
                        criticalExamples.push({ genId: gen.id, mood: gen.mood, scheme: gen.rhymeScheme, section: section.label, line: li.text, issue });
                    }
                }
            }
        }
    }

    const rhymeAccuracy = totalRhymePairs > 0 ? ((1 - totalRhymeFailures / totalRhymePairs) * 100).toFixed(1) : '100.0';

    // Summary table
    md += `## Summary\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Total lines generated | ${totalLines} |\n`;
    md += `| Rhyme pairs checked | ${totalRhymePairs} |\n`;
    md += `| Rhyme failures | ${totalRhymeFailures} |\n`;
    md += `| **Rhyme accuracy** | **${rhymeAccuracy}%** |\n`;
    md += `| Total quality issues | ${totalNonsenseIssues} |\n\n`;

    // Per-scheme breakdown
    md += `## Rhyme Accuracy by Scheme\n\n`;
    md += `| Scheme | Pairs | Failures | Accuracy |\n|--------|-------|----------|----------|\n`;
    for (const scheme of RHYME_SCHEMES) {
        const s = schemeStats[scheme];
        const acc = s.pairs > 0 ? ((1 - s.failures / s.pairs) * 100).toFixed(1) : 'N/A';
        md += `| ${scheme} | ${s.pairs} | ${s.failures} | ${acc}% |\n`;
    }
    md += '\n';

    // Per-mood breakdown
    md += `## Stats by Mood\n\n`;
    md += `| Mood | Lines | Rhyme Pairs | Rhyme Failures | Accuracy | Quality Issues |\n`;
    md += `|------|-------|-------------|----------------|----------|----------------|\n`;
    for (const m of MOODS) {
        const s = moodStats[m];
        const acc = s.rhymePairs > 0 ? ((1 - s.rhymeFailures / s.rhymePairs) * 100).toFixed(1) : 'N/A';
        md += `| ${m} | ${s.lines} | ${s.rhymePairs} | ${s.rhymeFailures} | ${acc}% | ${s.issues} |\n`;
    }
    md += '\n';

    // Issue type breakdown
    if (Object.keys(issueTypes).length > 0) {
        md += `## Issue Type Breakdown\n\n`;
        md += `| Issue Type | Count |\n|-----------|-------|\n`;
        for (const [type, count] of Object.entries(issueTypes).sort((a, b) => b[1] - a[1])) {
            md += `| ${type} | ${count} |\n`;
        }
        md += '\n';
    }

    // Rhyme failures
    if (failedRhymePairs.length > 0) {
        md += `## Rhyme Failures (${failedRhymePairs.length} total, showing up to 40)\n\n`;
        md += '| Gen# | Mood | Scheme | Section | Target Word | End Word | Target Line | Failed Line |\n';
        md += '|------|------|--------|---------|-------------|----------|-------------|-------------|\n';
        for (const fp of failedRhymePairs.slice(0, 40)) {
            md += `| ${fp.genId} | ${fp.mood} | ${fp.scheme} | ${fp.section} | ${fp.target} | ${fp.endWord} | ${fp.targetLine.slice(0, 45)} | ${fp.line.slice(0, 45)} |\n`;
        }
        md += '\n';
    }

    // Weak endings
    if (weakEndingExamples.length > 0) {
        md += `## Weak Ending Examples (${issueTypes['WEAK_ENDING'] || 0} total, showing up to 25)\n\n`;
        for (const ex of weakEndingExamples) {
            md += `- Gen#${ex.genId} [${ex.mood}/${ex.scheme}] ${ex.section}: \`${ex.line}\` — ${ex.issue}\n`;
        }
        md += '\n';
    }

    // Article+Verb
    if (articleVerbExamples.length > 0) {
        md += `## Article+Verb Grammar Issues (${issueTypes['ARTICLE_VERB'] || 0} total, showing up to 25)\n\n`;
        for (const ex of articleVerbExamples) {
            md += `- Gen#${ex.genId} [${ex.mood}/${ex.scheme}] ${ex.section}: \`${ex.line}\` — ${ex.issue}\n`;
        }
        md += '\n';
    }

    // Too short
    if (tooShortExamples.length > 0) {
        md += `## Too Short Lines (${issueTypes['TOO_SHORT'] || 0} total, showing up to 20)\n\n`;
        for (const ex of tooShortExamples) {
            md += `- Gen#${ex.genId} [${ex.mood}/${ex.scheme}] ${ex.section}: \`${ex.line}\`\n`;
        }
        md += '\n';
    }

    // Too long
    if (tooLongExamples.length > 0) {
        md += `## Too Long Lines (${issueTypes['TOO_LONG'] || 0} total, showing up to 20)\n\n`;
        for (const ex of tooLongExamples) {
            md += `- Gen#${ex.genId} [${ex.mood}/${ex.scheme}] ${ex.section}: \`${ex.line}\`\n`;
        }
        md += '\n';
    }

    // Critical issues
    if (criticalExamples.length > 0) {
        md += `## Critical Issues (Template Artifacts / Bad Values / Repeated Words / Too Generic)\n\n`;
        for (const ex of criticalExamples) {
            md += `- Gen#${ex.genId} [${ex.mood}/${ex.scheme}] ${ex.section}: \`${ex.line}\` — ${ex.issue}\n`;
        }
        md += '\n';
    }

    // Full lyrics samples (first 5)
    md += '---\n\n## Full Lyrics Samples (First 5)\n\n';
    for (const gen of results.slice(0, 5)) {
        md += `### Generation #${gen.id} (mood: ${gen.mood}, rhyme: ${gen.rhymeScheme}, creativity: ${gen.creativity}, scale: ${gen.scale})\n\n`;
        for (const section of gen.sectionAnalysis) {
            md += `**[${section.label}]** (pattern: ${section.rhymePattern})\n`;
            for (let li = 0; li < section.lines.length; li++) {
                const line = section.lines[li];
                const endWord = getLastWord(line);
                const rhymeInfo = section.rhymeCheck[li];
                let marker = '';
                if (rhymeInfo && !rhymeInfo.firstOfGroup && !rhymeInfo.rhymes) marker = ' ❌ RHYME FAIL';
                const nonsense = section.lineIssues[li]?.nonsenseIssues || [];
                const nonsenseMarker = nonsense.length > 0 ? ` ⚠️ ${nonsense.join(', ')}` : '';
                md += `  ${li + 1}. ${line} [${endWord}]${marker}${nonsenseMarker}\n`;
            }
            md += '\n';
        }
        md += '---\n\n';
    }

    return md;
}

// =========================================================================
// Console summary helpers
// =========================================================================

function logGenreSummary(genreName, results) {
    let totalRhymeFailures = 0, totalRhymePairs = 0, totalIssues = 0, totalLines = 0;
    for (const gen of results) {
        for (const section of gen.sectionAnalysis) {
            totalLines += section.lines.length;
            totalRhymeFailures += section.rhymeFailures.length;
            totalRhymePairs += section.rhymeCheck.filter(r => !r.firstOfGroup && !r.freeform).length;
            for (const li of section.lineIssues) totalIssues += li.nonsenseIssues.length;
        }
    }
    const acc = totalRhymePairs > 0 ? ((1 - totalRhymeFailures / totalRhymePairs) * 100).toFixed(1) : '100.0';
    console.log(`  ${genreName.toUpperCase().padEnd(10)} | Lines: ${String(totalLines).padStart(5)} | Rhyme: ${acc}% (${totalRhymeFailures}/${totalRhymePairs} failures) | Quality issues: ${totalIssues}`);
    return { genre: genreName, totalLines, rhymeAccuracy: parseFloat(acc), totalRhymeFailures, totalRhymePairs, totalIssues };
}

// =========================================================================
// Test
// =========================================================================

describe('All Genres Lyrics Audit — 100 Generations Each', () => {
    it('should run 100 generations per genre and produce audit reports', { timeout: 300000 }, () => {
        console.log('\n=== STARTING ALL-GENRES LYRICS AUDIT ===\n');

        const allSummaries = [];

        for (const { genre, structure } of GENRES) {
            console.log(`\nRunning 100 generations for ${genre.toUpperCase()} (${structure})...`);
            const results = runGenreAudit(genre, structure, 100);

            // Write genre-specific report
            const safeName = genre.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            const reportPath = join(REPORT_DIR, `${safeName}-audit-report.md`);
            const report = formatGenreReport(genre, structure, results);
            writeFileSync(reportPath, report, 'utf-8');
            console.log(`  Report → ${reportPath}`);

            const summary = logGenreSummary(genre, results);
            allSummaries.push(summary);
        }

        // Grand summary
        console.log('\n\n=== GRAND SUMMARY ===\n');
        console.log('Genre      | Lines | Rhyme Accuracy | Failures | Quality Issues');
        console.log('-----------|-------|----------------|----------|---------------');
        let grandTotalFailures = 0, grandTotalPairs = 0, grandTotalIssues = 0;
        for (const s of allSummaries) {
            console.log(`${s.genre.toUpperCase().padEnd(10)} | ${String(s.totalLines).padStart(5)} | ${String(s.rhymeAccuracy + '%').padStart(14)} | ${String(s.totalRhymeFailures).padStart(8)} | ${s.totalIssues}`);
            grandTotalFailures += s.totalRhymeFailures;
            grandTotalPairs += s.totalRhymePairs;
            grandTotalIssues += s.totalIssues;
        }
        const grandAcc = grandTotalPairs > 0 ? ((1 - grandTotalFailures / grandTotalPairs) * 100).toFixed(1) : '100.0';
        console.log('-----------|-------|----------------|----------|---------------');
        console.log(`${'TOTAL'.padEnd(10)} |       | ${String(grandAcc + '%').padStart(14)} | ${String(grandTotalFailures).padStart(8)} | ${grandTotalIssues}`);

        console.log('\n=== AUDIT COMPLETE ===\n');
    });
});
