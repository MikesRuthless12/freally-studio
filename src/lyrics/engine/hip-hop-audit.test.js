/**
 * Hip Hop Lyrics Generation Audit
 *
 * Runs 50 generations WITHOUT punchlines + 50 WITH punchlines,
 * logs every line, checks rhyming, identifies issues.
 * Outputs a detailed .md report.
 */
import { describe, it } from 'vitest';
import { generateSong } from './LyricEngine';
import { wordsRhyme, getLastWord, scoreRhymeScheme } from './RhymeEngine';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// =========================================================================
// Issue-detection helpers
// =========================================================================

/** Check if a line is nonsensical / grammatically broken */
function detectNonsenseIssues(line) {
    const issues = [];
    const cleaned = line.replace(/ - /g, ' ').toLowerCase();
    const words = cleaned.split(/\s+/).filter(Boolean);

    // 1. Repeated adjacent words: "the the", "we we" (excluding intentional repetition hooks)
    for (let i = 0; i < words.length - 1; i++) {
        if (words[i] === words[i + 1] && !['go', 'no', 'yeah', 'oh', 'hey', 'na', 'la', 'night', 'louder', 'spinning', 'alive', 'hallelujah', 'sabor', 'vamos', 'baila', 'dale', 'encore', 'higher', 'deeper', 'faster', 'stronger', 'triple', 'cha', 'knock', 'dollar', 'bang', 'boom', 'clap', 'stomp'].includes(words[i])) {
            issues.push(`REPEATED_WORD: "${words[i]} ${words[i + 1]}"`);
        }
    }

    // 2. Line too short (< 3 words) — might be a fragment
    if (words.length < 3) {
        issues.push(`TOO_SHORT: only ${words.length} words`);
    }

    // 3. Line too long (> 20 words) — unwieldy for rap
    if (words.length > 20) {
        issues.push(`TOO_LONG: ${words.length} words`);
    }

    // 4. Ends with a preposition/article/conjunction (weak ending)
    const weakEndings = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be']);
    const lastWord = words[words.length - 1];
    if (weakEndings.has(lastWord)) {
        issues.push(`WEAK_ENDING: ends with "${lastWord}"`);
    }

    // 5. Starts with filler that doesn't add meaning
    const fillerStarts = ['um', 'uh', 'er', 'hmm'];
    if (fillerStarts.includes(words[0])) {
        issues.push(`FILLER_START: starts with "${words[0]}"`);
    }

    // 6. Template artifacts — unfilled placeholders
    if (cleaned.includes('{') || cleaned.includes('}')) {
        issues.push(`TEMPLATE_ARTIFACT: contains unfilled placeholder`);
    }

    // 7. "undefined" or "null" in output
    if (cleaned.includes('undefined') || cleaned === 'null') {
        issues.push(`BAD_VALUE: contains undefined/null`);
    }

    // 8. Awkward grammar patterns
    // "the [verb]" without article target: "the survive", "the combine"
    const articleVerbPattern = /\bthe\s+(survive|define|refine|arrive|thrive|derive|decide|provide|confide|collide|inspire|admire|retire|conspire|require|acquire|expire|contain|explain|maintain|obtain|detain|attain|complain|restrain|compose|dispose|oppose|propose|ignore|explore|restore|implore|defend|offend|pretend|attend|extend|intend|contend|depend|transcend|descend|compete|betray|convey|portray|obey|repay|replace|erase|evade|invade|persuade|compel|expel|propel|repel|excel|redeem|bestow|borrow)\b/;
    if (articleVerbPattern.test(cleaned)) {
        const match = cleaned.match(articleVerbPattern);
        issues.push(`ARTICLE_VERB: "the ${match[1]}" — verb used as noun`);
    }

    // 9. Same line appears to be a pure template with generic words only
    const genericOnly = new Set(['the', 'a', 'an', 'i', 'we', 'you', 'they', 'it', 'is', 'was', 'are', 'and', 'or', 'but', 'in', 'on', 'to', 'of', 'my', 'your', 'our']);
    const nonGenericWords = words.filter(w => !genericOnly.has(w));
    if (nonGenericWords.length <= 1 && words.length > 2) {
        issues.push(`TOO_GENERIC: almost all function words`);
    }

    return issues;
}

/** Check if rhyme scheme is actually followed */
function checkRhymeAccuracy(lines, scheme) {
    const results = [];
    const schemeLen = scheme.length;
    const rhymeGroups = {};

    for (let i = 0; i < lines.length; i++) {
        const letter = scheme[i % schemeLen];
        const endWord = getLastWord(lines[i]);

        // 'X' means freeform — no rhyming required
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

/** Count duplicate lines across sections */
function findDuplicates(sections) {
    const lineCount = {};
    const dupes = [];
    for (const section of sections) {
        for (const line of section.lines) {
            const key = line.replace(/ - /g, ' ').toLowerCase().trim();
            lineCount[key] = (lineCount[key] || 0) + 1;
        }
    }
    for (const [line, count] of Object.entries(lineCount)) {
        // Hooks repeat intentionally, so only flag verse duplicates
        if (count > 1) {
            dupes.push({ line, count });
        }
    }
    return dupes;
}

// =========================================================================
// Run generations
// =========================================================================

const MOODS = ['happy', 'dark', 'aggressive', 'sad', 'epic', 'hopeful'];
const RHYME_SCHEMES = ['AABB', 'ABAB', 'AAAA', 'freeform'];

function runGenerations(count, usePunchlines) {
    const results = [];
    for (let i = 0; i < count; i++) {
        const mood = MOODS[i % MOODS.length];
        const rhymeScheme = RHYME_SCHEMES[i % RHYME_SCHEMES.length];
        const creativity = 50 + (i % 3) * 20; // 50, 70, 90

        const song = generateSong({
            genre: 'hip hop',
            mood,
            key: 'C',
            scale: 'minor',
            bpm: 90 + (i % 4) * 10,
            melodyPattern: [],
            structure: 'hip-hop',
            rhymeScheme,
            creativity,
            globalBars: 8,
            usePunchlines,
        });

        // Analyze each section
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

        const duplicates = findDuplicates(song.sections);

        results.push({
            id: i + 1,
            mood,
            rhymeScheme,
            creativity,
            bpm: 90 + (i % 4) * 10,
            usePunchlines,
            analysis: song.analysis,
            sectionAnalysis,
            duplicates,
        });
    }
    return results;
}

function formatReport(noPunchResults, withPunchResults) {
    let md = '# Hip Hop Lyrics Generation Audit Report\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;
    md += `- **50 generations WITHOUT punchlines**\n`;
    md += `- **50 generations WITH punchlines**\n\n`;
    md += '---\n\n';

    // =========================================================================
    // Aggregate stats
    // =========================================================================
    function aggregateStats(results, label) {
        let totalRhymeFailures = 0;
        let totalRhymePairs = 0;
        let totalNonsenseIssues = 0;
        let totalLines = 0;
        let totalDupes = 0;
        const issueTypes = {};
        const failedRhymePairs = [];
        const nonsenseExamples = [];
        const weakEndingExamples = [];
        const articleVerbExamples = [];
        const tooShortExamples = [];
        const tooLongExamples = [];

        for (const gen of results) {
            for (const section of gen.sectionAnalysis) {
                totalLines += section.lines.length;
                totalRhymeFailures += section.rhymeFailures.length;
                totalRhymePairs += section.rhymeCheck.filter(r => !r.firstOfGroup).length;

                for (const rf of section.rhymeFailures) {
                    failedRhymePairs.push({
                        genId: gen.id,
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

                        if (type === 'WEAK_ENDING' && weakEndingExamples.length < 20) {
                            weakEndingExamples.push({ genId: gen.id, section: section.label, line: li.text, issue });
                        }
                        if (type === 'ARTICLE_VERB' && articleVerbExamples.length < 20) {
                            articleVerbExamples.push({ genId: gen.id, section: section.label, line: li.text, issue });
                        }
                        if (type === 'TOO_SHORT' && tooShortExamples.length < 15) {
                            tooShortExamples.push({ genId: gen.id, section: section.label, line: li.text, issue });
                        }
                        if (type === 'TOO_LONG' && tooLongExamples.length < 15) {
                            tooLongExamples.push({ genId: gen.id, section: section.label, line: li.text, issue });
                        }
                        if (type === 'TEMPLATE_ARTIFACT') {
                            nonsenseExamples.push({ genId: gen.id, section: section.label, line: li.text, issue });
                        }
                        if (type === 'BAD_VALUE') {
                            nonsenseExamples.push({ genId: gen.id, section: section.label, line: li.text, issue });
                        }
                        if (type === 'REPEATED_WORD') {
                            nonsenseExamples.push({ genId: gen.id, section: section.label, line: li.text, issue });
                        }
                    }
                }
            }
            totalDupes += gen.duplicates.filter(d => d.count > 2).length; // only flag 3+ repeats
        }

        const rhymeAccuracy = totalRhymePairs > 0 ? ((1 - totalRhymeFailures / totalRhymePairs) * 100).toFixed(1) : '100.0';

        md += `## ${label}\n\n`;
        md += `| Metric | Value |\n|--------|-------|\n`;
        md += `| Total lines generated | ${totalLines} |\n`;
        md += `| Rhyme pairs checked | ${totalRhymePairs} |\n`;
        md += `| Rhyme failures | ${totalRhymeFailures} |\n`;
        md += `| **Rhyme accuracy** | **${rhymeAccuracy}%** |\n`;
        md += `| Total nonsense/quality issues | ${totalNonsenseIssues} |\n`;
        md += `| Lines with 3+ duplicates (non-hook) | ${totalDupes} |\n\n`;

        if (Object.keys(issueTypes).length > 0) {
            md += `### Issue Breakdown\n\n`;
            md += `| Issue Type | Count |\n|-----------|-------|\n`;
            for (const [type, count] of Object.entries(issueTypes).sort((a, b) => b[1] - a[1])) {
                md += `| ${type} | ${count} |\n`;
            }
            md += '\n';
        }

        // Failed rhyme pairs (show up to 30)
        if (failedRhymePairs.length > 0) {
            md += `### Rhyme Failures (${failedRhymePairs.length} total, showing up to 30)\n\n`;
            md += '| Gen# | Section | Target Word | End Word | Target Line | Failed Line |\n';
            md += '|------|---------|-------------|----------|-------------|-------------|\n';
            for (const fp of failedRhymePairs.slice(0, 30)) {
                md += `| ${fp.genId} | ${fp.section} | ${fp.target} | ${fp.endWord} | ${fp.targetLine.slice(0, 50)} | ${fp.line.slice(0, 50)} |\n`;
            }
            md += '\n';
        }

        // Weak endings
        if (weakEndingExamples.length > 0) {
            md += `### Weak Ending Examples (${issueTypes['WEAK_ENDING'] || 0} total, showing up to 20)\n\n`;
            for (const ex of weakEndingExamples.slice(0, 20)) {
                md += `- Gen#${ex.genId} ${ex.section}: \`${ex.line}\` — ${ex.issue}\n`;
            }
            md += '\n';
        }

        // Article+Verb issues
        if (articleVerbExamples.length > 0) {
            md += `### Article+Verb Grammar Issues (${issueTypes['ARTICLE_VERB'] || 0} total, showing up to 20)\n\n`;
            for (const ex of articleVerbExamples.slice(0, 20)) {
                md += `- Gen#${ex.genId} ${ex.section}: \`${ex.line}\` — ${ex.issue}\n`;
            }
            md += '\n';
        }

        // Too short
        if (tooShortExamples.length > 0) {
            md += `### Too Short Lines (${issueTypes['TOO_SHORT'] || 0} total, showing up to 15)\n\n`;
            for (const ex of tooShortExamples.slice(0, 15)) {
                md += `- Gen#${ex.genId} ${ex.section}: \`${ex.line}\`\n`;
            }
            md += '\n';
        }

        // Too long
        if (tooLongExamples.length > 0) {
            md += `### Too Long Lines (${issueTypes['TOO_LONG'] || 0} total, showing up to 15)\n\n`;
            for (const ex of tooLongExamples.slice(0, 15)) {
                md += `- Gen#${ex.genId} ${ex.section}: \`${ex.line}\`\n`;
            }
            md += '\n';
        }

        // Template artifacts / bad values
        if (nonsenseExamples.length > 0) {
            md += `### Critical Issues (Template Artifacts / Bad Values / Repeated Words)\n\n`;
            for (const ex of nonsenseExamples) {
                md += `- Gen#${ex.genId} ${ex.section}: \`${ex.line}\` — ${ex.issue}\n`;
            }
            md += '\n';
        }

        md += '---\n\n';
    }

    aggregateStats(noPunchResults, 'WITHOUT Punchlines (50 Generations)');
    aggregateStats(withPunchResults, 'WITH Punchlines (50 Generations)');

    // =========================================================================
    // Full lyrics dump (first 10 of each for detailed review)
    // =========================================================================
    md += '## Full Lyrics Samples — WITHOUT Punchlines (First 10)\n\n';
    for (const gen of noPunchResults.slice(0, 10)) {
        md += `### Generation #${gen.id} (mood: ${gen.mood}, rhyme: ${gen.rhymeScheme}, creativity: ${gen.creativity}, bpm: ${gen.bpm})\n\n`;
        md += `Rhyme Accuracy: ${gen.analysis.rhymeAccuracy}% | Hook Score: ${gen.analysis.avgHookScore} | Punchline Score: ${gen.analysis.punchlineScore}\n\n`;
        for (const section of gen.sectionAnalysis) {
            md += `**[${section.label}]** (pattern: ${section.rhymePattern})\n`;
            for (let li = 0; li < section.lines.length; li++) {
                const line = section.lines[li];
                const endWord = getLastWord(line);
                const rhymeInfo = section.rhymeCheck[li];
                let marker = '';
                if (rhymeInfo && !rhymeInfo.firstOfGroup && !rhymeInfo.rhymes) {
                    marker = ' ❌ RHYME FAIL';
                }
                const nonsense = section.lineIssues[li]?.nonsenseIssues || [];
                const nonsenseMarker = nonsense.length > 0 ? ` ⚠️ ${nonsense.join(', ')}` : '';
                md += `  ${li + 1}. ${line} [${endWord}]${marker}${nonsenseMarker}\n`;
            }
            md += '\n';
        }
        md += '---\n\n';
    }

    md += '## Full Lyrics Samples — WITH Punchlines (First 10)\n\n';
    for (const gen of withPunchResults.slice(0, 10)) {
        md += `### Generation #${gen.id} (mood: ${gen.mood}, rhyme: ${gen.rhymeScheme}, creativity: ${gen.creativity}, bpm: ${gen.bpm})\n\n`;
        md += `Rhyme Accuracy: ${gen.analysis.rhymeAccuracy}% | Hook Score: ${gen.analysis.avgHookScore} | Punchline Score: ${gen.analysis.punchlineScore}\n\n`;
        for (const section of gen.sectionAnalysis) {
            md += `**[${section.label}]** (pattern: ${section.rhymePattern})\n`;
            for (let li = 0; li < section.lines.length; li++) {
                const line = section.lines[li];
                const endWord = getLastWord(line);
                const rhymeInfo = section.rhymeCheck[li];
                let marker = '';
                if (rhymeInfo && !rhymeInfo.firstOfGroup && !rhymeInfo.rhymes) {
                    marker = ' ❌ RHYME FAIL';
                }
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

describe('Hip Hop Lyrics Audit — 100 Generations', () => {
    it('should run 50 generations WITHOUT punchlines and 50 WITH, and produce audit report', { timeout: 120000 }, () => {
        console.log('\n=== STARTING HIP HOP LYRICS AUDIT ===\n');
        console.log('Running 50 generations WITHOUT punchlines...');
        const noPunchResults = runGenerations(50, false);
        console.log('Running 50 generations WITH punchlines...');
        const withPunchResults = runGenerations(50, true);

        // Generate report
        const report = formatReport(noPunchResults, withPunchResults);

        // Write to file
        const reportPath = join(__dirname, '..', '..', '..', 'hip-hop-audit-report.md');
        writeFileSync(reportPath, report, 'utf-8');
        console.log(`\n✅ Report written to: ${reportPath}`);

        // Also log summary to console
        console.log('\n=== SUMMARY ===');

        // No punchlines stats
        let noPunchRhymeFailures = 0, noPunchRhymePairs = 0, noPunchIssues = 0;
        for (const gen of noPunchResults) {
            for (const section of gen.sectionAnalysis) {
                noPunchRhymeFailures += section.rhymeFailures.length;
                noPunchRhymePairs += section.rhymeCheck.filter(r => !r.firstOfGroup).length;
                for (const li of section.lineIssues) noPunchIssues += li.nonsenseIssues.length;
            }
        }
        console.log(`\nWITHOUT Punchlines:`);
        console.log(`  Rhyme accuracy: ${noPunchRhymePairs > 0 ? ((1 - noPunchRhymeFailures / noPunchRhymePairs) * 100).toFixed(1) : '100.0'}%`);
        console.log(`  Rhyme failures: ${noPunchRhymeFailures}/${noPunchRhymePairs}`);
        console.log(`  Quality issues: ${noPunchIssues}`);

        // With punchlines stats
        let withPunchRhymeFailures = 0, withPunchRhymePairs = 0, withPunchIssues = 0;
        for (const gen of withPunchResults) {
            for (const section of gen.sectionAnalysis) {
                withPunchRhymeFailures += section.rhymeFailures.length;
                withPunchRhymePairs += section.rhymeCheck.filter(r => !r.firstOfGroup).length;
                for (const li of section.lineIssues) withPunchIssues += li.nonsenseIssues.length;
            }
        }
        console.log(`\nWITH Punchlines:`);
        console.log(`  Rhyme accuracy: ${withPunchRhymePairs > 0 ? ((1 - withPunchRhymeFailures / withPunchRhymePairs) * 100).toFixed(1) : '100.0'}%`);
        console.log(`  Rhyme failures: ${withPunchRhymeFailures}/${withPunchRhymePairs}`);
        console.log(`  Quality issues: ${withPunchIssues}`);

        // Print ALL lyrics to console for full inspection
        console.log('\n\n========== FULL LYRICS — WITHOUT PUNCHLINES ==========\n');
        for (const gen of noPunchResults) {
            console.log(`\n--- Gen #${gen.id} (${gen.mood}, ${gen.rhymeScheme}, creativity:${gen.creativity}) ---`);
            for (const section of gen.sectionAnalysis) {
                console.log(`\n[${section.label}] (${section.rhymePattern})`);
                for (let li = 0; li < section.lines.length; li++) {
                    const line = section.lines[li];
                    const endWord = getLastWord(line);
                    const rhymeInfo = section.rhymeCheck[li];
                    let marker = '';
                    if (rhymeInfo && !rhymeInfo.firstOfGroup && !rhymeInfo.rhymes) marker = ' ❌';
                    const issues = section.lineIssues[li]?.nonsenseIssues || [];
                    const issueStr = issues.length > 0 ? ` ⚠️${issues.join(',')}` : '';
                    console.log(`  ${li + 1}. ${line} [${endWord}]${marker}${issueStr}`);
                }
            }
        }

        console.log('\n\n========== FULL LYRICS — WITH PUNCHLINES ==========\n');
        for (const gen of withPunchResults) {
            console.log(`\n--- Gen #${gen.id} (${gen.mood}, ${gen.rhymeScheme}, creativity:${gen.creativity}) ---`);
            for (const section of gen.sectionAnalysis) {
                console.log(`\n[${section.label}] (${section.rhymePattern})`);
                for (let li = 0; li < section.lines.length; li++) {
                    const line = section.lines[li];
                    const endWord = getLastWord(line);
                    const rhymeInfo = section.rhymeCheck[li];
                    let marker = '';
                    if (rhymeInfo && !rhymeInfo.firstOfGroup && !rhymeInfo.rhymes) marker = ' ❌';
                    const issues = section.lineIssues[li]?.nonsenseIssues || [];
                    const issueStr = issues.length > 0 ? ` ⚠️${issues.join(',')}` : '';
                    console.log(`  ${li + 1}. ${line} [${endWord}]${marker}${issueStr}`);
                }
            }
        }

        console.log('\n=== AUDIT COMPLETE ===\n');
    });
});
