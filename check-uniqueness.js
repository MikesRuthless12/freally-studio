/**
 * Comprehensive uniqueness checker for all locale lyrics files.
 * Checks for duplicates within each section (verses, choruses, bridges, themes, openers)
 * both within-genre and cross-genre within the same language file.
 */
const fs = require('fs');
const path = require('path');

const localeDir = path.join(__dirname, 'src', 'lyrics', 'engine', 'locales');
const locales = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'th', 'fi', 'hu', 'et', 'az'];
const sections = ['themes', 'openers', 'verses', 'choruses', 'bridges'];

let totalIssues = 0;
let totalDupes = 0;

console.log('=== UNIQUENESS CHECK FOR ALL LOCALES ===\n');

for (const lang of locales) {
  const filePath = path.join(localeDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`⊘ ${lang.toUpperCase()} — file not found, skipping`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const genres = Object.keys(data.genreBanks || {});
  let langIssues = 0;
  let langDupes = 0;

  for (const section of sections) {
    // Check within-genre duplicates
    for (const genre of genres) {
      const items = data.genreBanks[genre][section] || [];
      const seen = new Set();
      let genreDupes = 0;
      for (const item of items) {
        if (seen.has(item)) {
          genreDupes++;
          if (genreDupes <= 3) {
            // Show first 3 examples
          }
        } else {
          seen.add(item);
        }
      }
      if (genreDupes > 0) {
        langDupes += genreDupes;
        langIssues++;
        console.log(`  ✗ ${lang.toUpperCase()} ${genre}/${section}: ${genreDupes} within-genre duplicates`);
      }
    }

    // Check cross-genre duplicates within same section
    const allItems = new Map(); // item -> [genres]
    for (const genre of genres) {
      const items = data.genreBanks[genre][section] || [];
      for (const item of items) {
        if (!allItems.has(item)) {
          allItems.set(item, [genre]);
        } else {
          allItems.get(item).push(genre);
        }
      }
    }
    let crossDupes = 0;
    for (const [item, genreList] of allItems) {
      if (genreList.length > 1) {
        crossDupes++;
      }
    }
    if (crossDupes > 0) {
      langDupes += crossDupes;
      langIssues++;
      console.log(`  ⚠ ${lang.toUpperCase()} ${section}: ${crossDupes} cross-genre duplicates`);
    }
  }

  // Count totals
  let totalPhrases = 0;
  const sectionTotals = {};
  for (const section of sections) {
    let count = 0;
    for (const genre of genres) {
      count += (data.genreBanks[genre][section] || []).length;
    }
    sectionTotals[section] = count;
    totalPhrases += count;
  }
  // Also count vocabulary if present
  for (const genre of genres) {
    const bank = data.genreBanks[genre];
    for (const key of Object.keys(bank)) {
      if (!sections.includes(key)) {
        const val = bank[key];
        if (Array.isArray(val)) totalPhrases += val.length;
      }
    }
  }

  if (langIssues === 0) {
    console.log(`✓ ${lang.toUpperCase()} — NO duplicates (${genres.length} genres, ${totalPhrases} total phrases, V:${sectionTotals.verses} C:${sectionTotals.choruses} T:${sectionTotals.themes} B:${sectionTotals.bridges})`);
  } else {
    console.log(`✗ ${lang.toUpperCase()} — ${langDupes} total duplicates found`);
  }

  totalIssues += langIssues;
  totalDupes += langDupes;
}

console.log('\n=== SUMMARY ===');
console.log(`Languages checked: ${locales.length}`);
console.log(`Total duplicate issues: ${totalIssues}`);
console.log(`Total duplicate entries: ${totalDupes}`);

if (totalDupes > 0) {
  console.log('\n⚠ DUPLICATES FOUND — need deduplication before audits');
  process.exit(1);
} else {
  console.log('\n✓ ALL UNIQUE — safe to run audits');
  process.exit(0);
}
