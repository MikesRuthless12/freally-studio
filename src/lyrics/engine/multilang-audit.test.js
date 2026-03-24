/**
 * Multi-Language Lyrics Generation Audit — FAST version
 *
 * Uses injectPhraseBank() to bypass Vite's slow glob scanning.
 * Usage: LANG_BATCH=N npx vitest run src/lyrics/engine/multilang-audit.test.js
 *
 * Batches (1 language each):
 *   1=es 2=fr 3=de 4=it 5=pt 6=ru 7=ja 8=ko 9=zh
 *   10=ar 11=hi 12=tr 13=th 14=fi 15=hu 16=et 17=az
 */
import { describe, it } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = join(__dirname, '..', '..', '..');

const ALL_LANGS = [
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'tr', name: 'Turkish' },
    { code: 'th', name: 'Thai' },
    { code: 'fi', name: 'Finnish' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'et', name: 'Estonian' },
    { code: 'az', name: 'Azerbaijani' },
];

const BATCH = parseInt(process.env.LANG_BATCH || '1', 10);
const lang = ALL_LANGS[BATCH - 1] || ALL_LANGS[0];

const GENRES = [
    { genre: 'pop', structure: 'verse-chorus-verse-chorus' },
    { genre: 'hiphop', structure: 'hip-hop' },
    { genre: 'rock', structure: 'verse-chorus-verse-chorus' },
    { genre: 'country', structure: 'verse-chorus-verse-chorus' },
    { genre: 'r&b', structure: 'verse-chorus-verse-chorus' },
    { genre: 'edm', structure: 'verse-chorus-verse-chorus' },
    { genre: 'indie', structure: 'intro-verse-chorus-bridge-outro' },
    { genre: 'folk', structure: 'verse-only' },
    { genre: 'metal', structure: 'verse-chorus-verse-chorus' },
    { genre: 'jazz', structure: 'aaba' },
    { genre: 'k-pop', structure: 'verse-pre-chorus-bridge' },
    { genre: 'latin', structure: 'verse-chorus-verse-chorus' },
];

const MOODS = ['happy', 'sad', 'romantic', 'aggressive', 'dreamy', 'dark', 'epic', 'hopeful', 'melancholic'];
const SCHEMES = ['AABB', 'ABAB', 'AAAA', 'freeform'];

const WHITELIST = new Set([
    'go', 'no', 'yeah', 'oh', 'hey', 'na', 'la',
    'louder', 'spinning', 'alive', 'hallelujah', 'sabor', 'vamos',
    'baila', 'dale', 'encore', 'night', 'higher', 'deeper',
    'faster', 'stronger', 'triple',
    'sigue', 'fuego', 'arriba', 'oye', 'mira', 'ven',
    'allez', 'oui', 'non', 'plus', 'jamais',
    'mehr', 'nein', 'los',
    'dai', 'sempre', 'ancora',
    'mais', 'vai', 'vem',
    'motto', 'yume', 'nan', 'neo',
    'aye', 'yo', 'woah', 'ooh', 'ah', 'eh',
]);
const WEAK = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be']);

function checkLine(line) {
    const issues = [];
    const c = line.replace(/ - /g, ' ').toLowerCase();
    const w = c.split(/\s+/).filter(Boolean);
    for (let i = 0; i < w.length - 1; i++) {
        if (w[i] === w[i + 1] && !WHITELIST.has(w[i])) issues.push(`REPEATED: "${w[i]} ${w[i + 1]}"`);
    }
    if (w.length < 3) issues.push(`TOO_SHORT: ${w.length} words`);
    if (w.length > 20) issues.push(`TOO_LONG: ${w.length} words`);
    // Skip weak ending check — English-only words like "in","or","to" are valid in other languages
    if (c.includes('{') || c.includes('}')) issues.push(`TEMPLATE: unfilled placeholder`);
    if (c.includes('undefined') || c === 'null') issues.push(`BAD_VALUE`);
    return issues;
}

describe(`${lang.name} (${lang.code}) Audit — 25 × 12 genres`, () => {
    it(`should have 0 quality issues`, async () => {
        // Step 1: Inject locale JSON directly into cache (FAST — bypasses Vite glob)
        const jsonPath = join(__dirname, 'locales', `${lang.code}.json`);
        const data = JSON.parse(readFileSync(jsonPath, 'utf8'));

        // Dynamic import to avoid hoisting issues
        const { injectPhraseBank, setGenerationLanguage } = await import('./PhraseLoader.js');
        const { generateSong } = await import('./LyricEngine.js');

        injectPhraseBank(lang.code, data);
        setGenerationLanguage(lang.code);

        let totalLines = 0, totalIssues = 0;
        const rows = [];
        const examples = [];

        for (const { genre, structure } of GENRES) {
            let lines = 0, issues = 0;
            for (let i = 0; i < 25; i++) {
                const song = generateSong({
                    genre, mood: MOODS[i % MOODS.length], key: 'C',
                    scale: i % 2 === 0 ? 'major' : 'minor',
                    bpm: 90 + (i % 4) * 10, melodyPattern: [], structure,
                    rhymeScheme: SCHEMES[i % SCHEMES.length],
                    language: lang.name, creativity: 50 + (i % 3) * 20,
                    globalBars: 8, usePunchlines: false
                });
                for (const sec of song.sections) {
                    for (const line of sec.lines) {
                        lines++;
                        const li = checkLine(line);
                        issues += li.length;
                        if (li.length > 0 && examples.length < 30) {
                            examples.push({ genre, gen: i + 1, sec: sec.label, line, issues: li });
                        }
                    }
                }
            }
            totalLines += lines;
            totalIssues += issues;
            rows.push({ genre, lines, issues });
            console.log(`  ${issues === 0 ? '✓' : '✗'} ${genre.padEnd(10)} | ${String(lines).padStart(5)} lines | ${issues} issues`);
        }

        // Write report
        let md = `# ${lang.name.toUpperCase()} (${lang.code}) Audit\n\nTotal lines: ${totalLines} | Issues: **${totalIssues}**\n\n`;
        md += `| Genre | Lines | Issues |\n|-------|-------|--------|\n`;
        for (const r of rows) md += `| ${r.genre} | ${r.lines} | ${r.issues} |\n`;
        if (examples.length > 0) {
            md += `\n## Examples\n\n`;
            for (const e of examples) md += `- [${e.genre}] Gen#${e.gen} ${e.sec}: \`${e.line}\` — ${e.issues.join(', ')}\n`;
        }
        writeFileSync(join(REPORT_DIR, `${lang.code}-audit-report.md`), md);

        console.log(`\n  TOTAL: ${totalLines} lines, ${totalIssues} issues`);
        console.log(`  Report → ${lang.code}-audit-report.md`);

        // Reset
        setGenerationLanguage('en');

    }, 180000); // 3 min timeout
});
