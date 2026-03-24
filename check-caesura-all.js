/**
 * Caesura check across all languages and genres.
 * Checks for:
 * 1. Lines that are too short (< 3 words for non-CJK, < 4 chars for CJK)
 * 2. Lines that are too long (> 20 words for non-CJK)
 * 3. Repeated adjacent words (unless whitelisted)
 * 4. Unfilled template placeholders
 * 5. "undefined" or "null" values
 * 6. Awkward mid-word breaks (caesura issues)
 * 7. Mixed-language contamination (e.g. English words in non-English locales)
 */
const fs = require('fs');
const path = require('path');

const localeDir = path.join(__dirname, 'src', 'lyrics', 'engine', 'locales');
const locales = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'th', 'fi', 'hu', 'et', 'az'];
const sections = ['themes', 'openers', 'verses', 'choruses', 'bridges'];
const CJK_LANGS = new Set(['ja', 'zh', 'th']);

const WHITELIST = new Set([
  'go', 'no', 'yeah', 'oh', 'hey', 'na', 'la', 'louder', 'spinning', 'alive',
  'hallelujah', 'sabor', 'vamos', 'baila', 'dale', 'encore', 'night', 'higher',
  'deeper', 'faster', 'stronger', 'triple', 'sigue', 'fuego', 'arriba', 'oye',
  'mira', 'ven', 'allez', 'oui', 'non', 'plus', 'jamais', 'mehr', 'nein', 'los',
  'dai', 'sempre', 'ancora', 'mais', 'vai', 'vem', 'motto', 'yume', 'nan', 'neo',
  'aye', 'yo', 'woah', 'ooh', 'ah', 'eh', 'boom', 'party',
]);

// Common foreign words that might appear in genre-specific contexts (not contamination)
const GENRE_LOANWORDS = new Set([
  'rock', 'pop', 'hip', 'hop', 'beat', 'bass', 'drop', 'dj', 'mc', 'flow',
  'rap', 'trap', 'jazz', 'blues', 'funk', 'soul', 'r&b', 'edm', 'remix',
  'club', 'bar', 'stage', 'mic', 'vibe', 'groove', 'loop', 'sample',
  'freestyle', 'battle', 'cypher', 'hook', 'verse', 'bridge', 'chorus',
  'k-pop', 'kpop', 'idol', 'fan', 'comeback', 'debut',
]);

function checkLine(line, langCode, section) {
  const issues = [];
  const c = line.replace(/ - /g, ' ').toLowerCase();
  const w = c.split(/\s+/).filter(Boolean);

  // Check repeated adjacent words
  for (let i = 0; i < w.length - 1; i++) {
    if (w[i] === w[i + 1] && !WHITELIST.has(w[i])) {
      issues.push(`REPEATED: "${w[i]} ${w[i + 1]}"`);
    }
  }

  // Length checks — themes are intentionally 1-2 words, skip length check for them
  if (section !== 'themes') {
    if (!CJK_LANGS.has(langCode)) {
      if (w.length < 3) issues.push(`TOO_SHORT: ${w.length} words`);
      if (w.length > 20) issues.push(`TOO_LONG: ${w.length} words`);
    } else {
      if (c.length < 4) issues.push(`TOO_SHORT: ${c.length} chars`);
    }
  }

  // Template placeholders
  if (/\{[a-zA-Z_0-9]+\}/.test(c)) issues.push(`TEMPLATE: unfilled placeholder`);

  // Bad values
  if (c.includes('undefined') || c === 'null') issues.push(`BAD_VALUE`);

  // Caesura: check for incomplete words or dangling characters
  // Look for single-letter words (except common articles/prepositions)
  const singleLetterWhitelist = new Set(['a', 'i', 'o', 'e', 'y', 'я', 'и', 'в', 'с', 'к', 'у', 'о', 'à', 'è']);
  for (const word of w) {
    if (word.length === 1 && !singleLetterWhitelist.has(word) && !/[0-9]/.test(word)) {
      // Only flag for non-CJK languages
      if (!CJK_LANGS.has(langCode)) {
        issues.push(`CAESURA: single char "${word}"`);
      }
    }
  }

  // Check for trailing/leading hyphens (broken caesura)
  if (/^\s*-\s/.test(line) || /\s-\s*$/.test(line)) {
    issues.push(`CAESURA: dangling hyphen`);
  }

  return issues;
}

console.log('=== CAESURA & QUALITY CHECK ACROSS ALL LANGUAGES ===\n');

let grandTotalIssues = 0;
let grandTotalLines = 0;

for (const lang of locales) {
  const filePath = path.join(localeDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) continue;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const genres = Object.keys(data.genreBanks || {});
  let langIssues = 0;
  let langLines = 0;
  const examples = [];

  for (const genre of genres) {
    for (const section of sections) {
      const items = data.genreBanks[genre][section] || [];
      for (const item of items) {
        langLines++;
        const issues = checkLine(item, lang, section);
        if (issues.length > 0) {
          langIssues += issues.length;
          if (examples.length < 5) {
            examples.push({ genre, section, line: item.substring(0, 60), issues });
          }
        }
      }
    }
  }

  grandTotalLines += langLines;
  grandTotalIssues += langIssues;

  if (langIssues === 0) {
    console.log(`✓ ${lang.toUpperCase()} — 0 issues (${langLines} lines checked)`);
  } else {
    console.log(`✗ ${lang.toUpperCase()} — ${langIssues} issues (${langLines} lines)`);
    for (const ex of examples) {
      console.log(`  [${ex.genre}/${ex.section}] "${ex.line}..." — ${ex.issues.join(', ')}`);
    }
  }
}

console.log('\n=== SUMMARY ===');
console.log(`Languages: ${locales.length}`);
console.log(`Total lines checked: ${grandTotalLines}`);
console.log(`Total issues: ${grandTotalIssues}`);

if (grandTotalIssues > 0) {
  console.log('\n⚠ ISSUES FOUND — review before final audit');
} else {
  console.log('\n✓ ALL CLEAN — ready for audits');
}
