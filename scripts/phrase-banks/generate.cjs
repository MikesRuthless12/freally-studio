#!/usr/bin/env node
/**
 * French Phrase Bank Generator — Freally Studio
 *
 * Assembles all per-genre data files into a single fr.json locale file.
 * Run: node scripts/phrase-banks/generate.cjs
 *
 * Each genre data file (e.g. genres/pop.cjs) exports:
 *   { themes, openers, verses, bridges, choruses, vocabulary }
 *
 * The shared data file (shared.cjs) exports:
 *   { moodModifiers, hookTemplates, genreHookTemplates, punchlines,
 *     variationPatterns, chorusNounTemplates, chorusAdjTemplates, chorusVerbTemplates,
 *     rhymeFamilies }
 */

const fs = require('fs');
const path = require('path');

const GENRES = [
  'pop', 'hiphop', 'rock', 'country', 'rnb', 'edm',
  'indie', 'folk', 'metal', 'jazz', 'kpop', 'latin', 'gospel'
];

const genresDir = path.join(__dirname, 'genres');
const sharedPath = path.join(__dirname, 'shared.cjs');
const outDir = path.join(__dirname, '..', '..', 'src', 'lyrics', 'engine', 'locales');

// ── Load genre data ──
const genreBanks = {};
let totalPhrases = 0;

for (const genre of GENRES) {
  const filePath = path.join(genresDir, `${genre}.cjs`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP: ${genre}.cjs not found`);
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
  console.log(`  ${genre}: ${count} phrases (${data.openers?.length || 0} openers, ${data.verses?.length || 0} verses, ${data.bridges?.length || 0} bridges, ${data.choruses?.length || 0} choruses)`);
}

// ── Load shared data ──
let shared = {};
if (fs.existsSync(sharedPath)) {
  shared = require(sharedPath);
  console.log(`  Shared: loaded`);
} else {
  console.warn(`  SKIP: shared.cjs not found`);
}

// ── Assemble final JSON ──
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

// ── Write fr.json ──
const jsonStr = JSON.stringify(localeData, null, 2);
const lineCount = jsonStr.split('\n').length;
const outPath = path.join(outDir, 'fr.json');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, jsonStr, 'utf-8');

console.log(`\n✓ Wrote fr.json: ${lineCount} lines, ${totalPhrases} genre phrases`);
console.log(`  Path: ${outPath}`);
