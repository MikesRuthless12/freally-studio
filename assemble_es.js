const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/lyrics/engine/locales/es.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Load expansion data
const part1 = JSON.parse(fs.readFileSync(path.join(__dirname, '_expand_data_part1.json'), 'utf8'));
const verses = require('./expand_verses.js');
const bc = require('./expand_bridges_choruses.js');
const vocabEtc = require('./expand_vocab_etc.js');

const genres = ['pop','hiphop','rock','country','rnb','edm','indie','folk','metal','jazz','kpop','latin','gospel'];

// 1. Expand genreBanks
for (const genre of genres) {
  const bank = data.genreBanks[genre];
  if (!bank) continue;

  // Themes
  if (part1.newThemesByGenre[genre]) {
    bank.themes = [...bank.themes, ...part1.newThemesByGenre[genre]];
  }

  // Openers
  if (part1.newOpenersByGenre[genre]) {
    bank.openers = [...bank.openers, ...part1.newOpenersByGenre[genre]];
  }

  // Verses
  if (verses[genre]) {
    bank.verses = [...bank.verses, ...verses[genre]];
  }

  // Bridges
  if (bc.bridges[genre]) {
    bank.bridges = [...bank.bridges, ...bc.bridges[genre]];
  }

  // Choruses
  if (bc.choruses[genre]) {
    bank.choruses = [...bank.choruses, ...bc.choruses[genre]];
  }

  // Vocabulary - add shared extra vocab to all genres
  if (bank.vocabulary) {
    const ev = vocabEtc.extraVocab;
    bank.vocabulary.nouns = [...bank.vocabulary.nouns, ...ev.nouns.slice(0, Math.min(ev.nouns.length, 300))];
    bank.vocabulary.verbs = [...bank.vocabulary.verbs, ...ev.verbs.slice(0, Math.min(ev.verbs.length, 300))];
    bank.vocabulary.adjectives = [...bank.vocabulary.adjectives, ...ev.adjectives.slice(0, Math.min(ev.adjectives.length, 300))];
  }
}

// 2. Expand hookTemplates
if (vocabEtc.extraHookTemplates) {
  data.hookTemplates = [...data.hookTemplates, ...vocabEtc.extraHookTemplates];
}

// 3. Expand genreHookTemplates
if (vocabEtc.extraGenreHookTemplates) {
  for (const genre of genres) {
    if (data.genreHookTemplates[genre] && vocabEtc.extraGenreHookTemplates[genre]) {
      data.genreHookTemplates[genre] = [...data.genreHookTemplates[genre], ...vocabEtc.extraGenreHookTemplates[genre]];
    }
  }
}

// 4. Expand punchlines
if (vocabEtc.extraPunchlines) {
  for (const cat of Object.keys(vocabEtc.extraPunchlines)) {
    if (data.punchlines[cat] && data.punchlines[cat].all) {
      data.punchlines[cat].all = [...data.punchlines[cat].all, ...vocabEtc.extraPunchlines[cat]];
    }
  }
}

// 5. Expand rhymeFamilies
if (vocabEtc.extraRhymeFamilies) {
  for (const fam of Object.keys(vocabEtc.extraRhymeFamilies)) {
    if (data.rhymeFamilies[fam]) {
      data.rhymeFamilies[fam] = [...data.rhymeFamilies[fam], ...vocabEtc.extraRhymeFamilies[fam]];
    }
  }
}

// 6. Expand variationPatterns
if (vocabEtc.extraVariationPatterns) {
  data.variationPatterns = [...data.variationPatterns, ...vocabEtc.extraVariationPatterns];
}

// 7. Expand chorusNounTemplates
if (vocabEtc.extraChorusNounTemplates) {
  data.chorusNounTemplates = [...data.chorusNounTemplates, ...vocabEtc.extraChorusNounTemplates];
}

// 8. Expand chorusAdjTemplates
if (vocabEtc.extraChorusAdjTemplates) {
  data.chorusAdjTemplates = [...data.chorusAdjTemplates, ...vocabEtc.extraChorusAdjTemplates];
}

// 9. Expand chorusVerbTemplates
if (vocabEtc.extraChorusVerbTemplates) {
  data.chorusVerbTemplates = [...data.chorusVerbTemplates, ...vocabEtc.extraChorusVerbTemplates];
}

// 10. Expand mood modifier vocabulary
if (vocabEtc.extraMoodVocab) {
  const moods = ['happy','sad','dark','aggressive','romantic','dreamy','epic'];
  for (const mood of moods) {
    if (data.moodModifiers[mood] && data.moodModifiers[mood].vocabulary && vocabEtc.extraMoodVocab[mood]) {
      const mv = data.moodModifiers[mood].vocabulary;
      const ev = vocabEtc.extraMoodVocab[mood];
      if (ev.nouns) mv.nouns = [...mv.nouns, ...ev.nouns];
      if (ev.verbs) mv.verbs = [...mv.verbs, ...ev.verbs];
      if (ev.adjectives) mv.adjectives = [...mv.adjectives, ...ev.adjectives];
    }
  }
}

// Deduplicate all arrays (just in case)
function dedup(arr) {
  return [...new Set(arr)];
}

function dedupAll(obj) {
  if (Array.isArray(obj)) {
    return dedup(obj);
  }
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = dedupAll(v);
    }
    return result;
  }
  return obj;
}

const finalData = dedupAll(data);

// Write
const output = JSON.stringify(finalData, null, 2);
fs.writeFileSync(filePath, output, 'utf8');

const lines = output.split('\n').length;
console.log(`Done! File written with ${lines} lines.`);

// Print summary
function countArrays(obj, prefix = '') {
  let total = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      total += v.length;
    } else if (typeof v === 'object' && v !== null) {
      total += countArrays(v, prefix + k + '.');
    }
  }
  return total;
}
console.log(`Total array entries: ${countArrays(finalData)}`);
