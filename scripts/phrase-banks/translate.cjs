#!/usr/bin/env node
/**
 * Translation Assembler — Reads per-language data files and writes locale JSONs.
 *
 * Usage: node scripts/phrase-banks/translate.cjs
 *
 * Each language has a data file: translations/{lang}.cjs
 * These mirror the French structure with translated phrases.
 * The script reads them and writes to src/lyrics/engine/locales/{lang}.json
 */

const fs = require('fs');
const path = require('path');

const LANGS = ['es', 'de', 'pt', 'it', 'ja', 'ko', 'zh', 'ru', 'ar'];
const GENRES = [
  'pop', 'hiphop', 'rock', 'country', 'rnb', 'edm',
  'indie', 'folk', 'metal', 'jazz', 'kpop', 'latin', 'gospel'
];

const translationsDir = path.join(__dirname, 'translations');
const outDir = path.join(__dirname, '..', '..', 'src', 'lyrics', 'engine', 'locales');

for (const lang of LANGS) {
  const langDir = path.join(translationsDir, lang);
  if (!fs.existsSync(langDir)) {
    console.warn(`  SKIP: translations/${lang}/ not found`);
    continue;
  }

  // Load genre banks
  const genreBanks = {};
  let totalPhrases = 0;

  for (const genre of GENRES) {
    const filePath = path.join(langDir, `${genre}.cjs`);
    if (!fs.existsSync(filePath)) {
      console.warn(`  SKIP: ${lang}/${genre}.cjs not found`);
      continue;
    }
    const data = require(filePath);
    genreBanks[genre] = {
      themes: data.themes || [],
      openers: data.openers || [],
      verses: data.verses || [],
      bridges: data.bridges || [],
      choruses: data.choruses || [],
      vocabulary: data.vocabulary || { nouns: [], verbs: [], adjectives: [] }
    };
    const count = (data.openers?.length || 0)
      + (data.verses?.length || 0)
      + (data.bridges?.length || 0)
      + (data.choruses?.length || 0);
    totalPhrases += count;
  }

  // Load shared data
  const sharedPath = path.join(langDir, 'shared.cjs');
  let shared = {};
  if (fs.existsSync(sharedPath)) {
    shared = require(sharedPath);
  }

  // Assemble
  const localeData = {
    genreBanks,
    rhymeFamilies: shared.rhymeFamilies || {},
    hookTemplates: shared.hookTemplates || [],
    genreHookTemplates: shared.genreHookTemplates || {},
    punchlines: shared.punchlines || {},
    variationPatterns: shared.variationPatterns || [],
    moodModifiers: shared.moodModifiers || {},
    chorusNounTemplates: shared.chorusNounTemplates || [],
    chorusAdjTemplates: shared.chorusAdjTemplates || [],
    chorusVerbTemplates: shared.chorusVerbTemplates || []
  };

  const jsonStr = JSON.stringify(localeData, null, 2);
  const lineCount = jsonStr.split('\n').length;
  const outPath = path.join(outDir, `${lang}.json`);

  fs.writeFileSync(outPath, jsonStr, 'utf-8');
  console.log(`  ${lang}.json: ${lineCount} lines, ${totalPhrases} phrases`);
}

console.log('\n✓ Translation complete');
