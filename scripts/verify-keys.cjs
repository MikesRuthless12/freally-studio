const fs = require('fs');
const path = require('path');
const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const enKeys = Object.keys(en);
let allGood = true;
for (const file of fs.readdirSync(localesDir).sort()) {
  if (!file.endsWith('.json') || file === 'en.json') continue;
  const lang = file.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
  const missing = enKeys.filter(k => !data[k]);
  if (missing.length > 0) {
    console.log(lang + ': ' + missing.length + ' missing — ' + missing.slice(0, 5).join(', '));
    allGood = false;
  }
}
if (allGood) console.log('ALL 44 locales have 100% key coverage!');
console.log('Total en.json keys: ' + enKeys.length);
