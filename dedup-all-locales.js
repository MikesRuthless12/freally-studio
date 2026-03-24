/**
 * Global deduplicator for all locale files.
 * Removes within-genre duplicates and cross-genre duplicates per section.
 * Cross-genre dupes: keeps the first occurrence (first genre alphabetically), removes from others.
 */
const fs = require('fs');
const path = require('path');

const localeDir = path.join(__dirname, 'src', 'lyrics', 'engine', 'locales');
const locales = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'th', 'fi', 'hu', 'et', 'az'];
const sections = ['themes', 'openers', 'verses', 'choruses', 'bridges'];

console.log('=== DEDUPLICATING ALL LOCALES ===\n');

let grandTotalRemoved = 0;

for (const lang of locales) {
  const filePath = path.join(localeDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) continue;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const genres = Object.keys(data.genreBanks || {});
  let langRemoved = 0;

  for (const section of sections) {
    // Step 1: Remove within-genre duplicates
    for (const genre of genres) {
      const items = data.genreBanks[genre][section] || [];
      const seen = new Set();
      const unique = [];
      for (const item of items) {
        if (!seen.has(item)) {
          seen.add(item);
          unique.push(item);
        }
      }
      const removed = items.length - unique.length;
      if (removed > 0) {
        data.genreBanks[genre][section] = unique;
        langRemoved += removed;
      }
    }

    // Step 2: Remove cross-genre duplicates (keep first occurrence)
    const globalSeen = new Set();
    for (const genre of genres) {
      const items = data.genreBanks[genre][section] || [];
      const unique = [];
      for (const item of items) {
        if (!globalSeen.has(item)) {
          globalSeen.add(item);
          unique.push(item);
        }
      }
      const removed = items.length - unique.length;
      if (removed > 0) {
        data.genreBanks[genre][section] = unique;
        langRemoved += removed;
      }
    }
  }

  if (langRemoved > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 1));
    grandTotalRemoved += langRemoved;

    // Report new totals
    const totals = {};
    let grandTotal = 0;
    for (const section of sections) {
      let count = 0;
      for (const genre of genres) {
        count += (data.genreBanks[genre][section] || []).length;
      }
      totals[section] = count;
      grandTotal += count;
    }
    // Count other arrays too
    for (const genre of genres) {
      for (const [key, val] of Object.entries(data.genreBanks[genre])) {
        if (!sections.includes(key) && Array.isArray(val)) grandTotal += val.length;
      }
    }

    console.log(`${lang.toUpperCase()}: removed ${langRemoved} dupes → V:${totals.verses} C:${totals.choruses} T:${totals.themes} B:${totals.bridges} O:${totals.openers} Total:${grandTotal}`);
  } else {
    console.log(`${lang.toUpperCase()}: no duplicates`);
  }
}

console.log(`\n=== TOTAL REMOVED: ${grandTotalRemoved} duplicates ===`);
