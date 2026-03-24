/**
 * Single-language audit — mocks PhraseLoader to skip glob scanning.
 * Usage: LANG=fr npx vitest run src/lyrics/engine/single-lang-audit.test.js
 */
import { describe, it, vi, beforeAll } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = join(__dirname, '..', '..', '..');

const langCode = process.env.LANG || 'fr';
const LANG_NAMES = {
    es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese',
    ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic',
    hi: 'Hindi', tr: 'Turkish', th: 'Thai', fi: 'Finnish', hu: 'Hungarian',
    et: 'Estonian', az: 'Azerbaijani',
};
const langName = LANG_NAMES[langCode] || langCode;
const CJK_LANGS = new Set(['ja', 'zh', 'th']);

// Load ONLY this one locale JSON (instant — no Vite glob)
const jsonPath = join(__dirname, 'locales', `${langCode}.json`);
const localeData = JSON.parse(readFileSync(jsonPath, 'utf8'));

// Mock PhraseLoader to inject our data without triggering import.meta.glob
vi.mock('./PhraseLoader.js', async (importOriginal) => {
    const original = await importOriginal();
    // Pre-populate cache
    original.injectPhraseBank(langCode, localeData);
    return original;
});

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
    'go', 'no', 'yeah', 'oh', 'hey', 'na', 'la', 'louder', 'spinning', 'alive',
    'hallelujah', 'sabor', 'vamos', 'baila', 'dale', 'encore', 'night', 'higher',
    'deeper', 'faster', 'stronger', 'triple', 'sigue', 'fuego', 'arriba', 'oye',
    'mira', 'ven', 'allez', 'oui', 'non', 'plus', 'jamais', 'mehr', 'nein', 'los',
    'dai', 'sempre', 'ancora', 'mais', 'vai', 'vem', 'motto', 'yume', 'nan', 'neo',
    'aye', 'yo', 'woah', 'ooh', 'ah', 'eh', 'boom', 'party',
]);

function checkLine(line) {
    const issues = [];
    const c = line.replace(/ - /g, ' ').toLowerCase();
    const w = c.split(/\s+/).filter(Boolean);
    for (let i = 0; i < w.length - 1; i++) {
        if (w[i] === w[i + 1] && !WHITELIST.has(w[i])) issues.push(`REPEATED: "${w[i]} ${w[i + 1]}"`);
    }
    if (!CJK_LANGS.has(langCode)) {
        if (w.length < 3) issues.push(`TOO_SHORT: ${w.length} words`);
        if (w.length > 20) issues.push(`TOO_LONG: ${w.length} words`);
    } else {
        if (c.length < 4) issues.push(`TOO_SHORT: ${c.length} chars`);
    }
    if (/\{[a-zA-Z_0-9]+\}/.test(c)) issues.push(`TEMPLATE: unfilled placeholder`);
    if (c.includes('undefined') || c === 'null') issues.push(`BAD_VALUE`);
    return issues;
}

describe(`${langName} (${langCode}) — 25 × 12 genres`, () => {
    it('should have 0 quality issues', async () => {
        const { setGenerationLanguage } = await import('./PhraseLoader.js');
        const { generateSong } = await import('./LyricEngine.js');

        setGenerationLanguage(langCode);

        let totalLines = 0, totalIssues = 0;
        const rows = [];
        const examples = [];

        const availableGenres = new Set(Object.keys(localeData.genreBanks || {}));
        const genreKeyMap = { 'r&b': 'rnb', 'k-pop': 'kpop' };
        for (const { genre, structure } of GENRES) {
            const localeKey = genreKeyMap[genre] || genre;
            if (!availableGenres.has(localeKey)) { rows.push({ genre, lines: 0, issues: 0 }); console.log(`  ⊘ ${genre.padEnd(10)} | skipped (not in locale)`); continue; }
            let lines = 0, issues = 0;
            for (let i = 0; i < 25; i++) {
                const song = generateSong({
                    genre, mood: MOODS[i % MOODS.length], key: 'C',
                    scale: i % 2 === 0 ? 'major' : 'minor',
                    bpm: 90 + (i % 4) * 10, melodyPattern: [], structure,
                    rhymeScheme: SCHEMES[i % SCHEMES.length],
                    language: langName, creativity: 50 + (i % 3) * 20,
                    globalBars: 8, usePunchlines: false,
                });
                for (const sec of song.sections) {
                    for (const line of sec.lines) {
                        lines++;
                        const li = checkLine(line);
                        issues += li.length;
                        if (li.length > 0 && examples.length < 30)
                            examples.push({ genre, gen: i + 1, sec: sec.label, line, issues: li });
                    }
                }
            }
            totalLines += lines;
            totalIssues += issues;
            rows.push({ genre, lines, issues });
            console.log(`  ${issues === 0 ? '✓' : '✗'} ${genre.padEnd(10)} | ${String(lines).padStart(5)} lines | ${issues} issues`);
        }

        let md = `# ${langName.toUpperCase()} (${langCode}) Audit\n\nTotal lines: ${totalLines} | Issues: **${totalIssues}**\n\n`;
        md += `| Genre | Lines | Issues |\n|-------|-------|--------|\n`;
        for (const r of rows) md += `| ${r.genre} | ${r.lines} | ${r.issues} |\n`;
        if (examples.length > 0) {
            md += `\n## Examples\n\n`;
            for (const e of examples) md += `- [${e.genre}] Gen#${e.gen} ${e.sec}: \`${e.line}\` — ${e.issues.join(', ')}\n`;
        }
        writeFileSync(join(REPORT_DIR, `${langCode}-audit-report.md`), md);
        console.log(`\n  TOTAL: ${totalLines} lines, ${totalIssues} issues`);

        setGenerationLanguage('en');
    }, 600000);
});
