/**
 * Fast single-language audit — bypasses Vite, loads JSON directly.
 * Usage: node _fast_lang_audit.mjs fr
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const langCode = process.argv[2];
if (!langCode) { console.error('Usage: node _fast_lang_audit.mjs <langCode>'); process.exit(1); }

// Manually load locale JSON and inject into phrase cache
const localePath = join(__dirname, 'src/lyrics/engine/locales', `${langCode}.json`);
const localeData = JSON.parse(readFileSync(localePath, 'utf8'));

// Dynamic import the engine modules (ESM)
const { generateSong } = await import('./src/lyrics/engine/LyricEngine.js');
const { preloadPhraseBank, setGenerationLanguage } = await import('./src/lyrics/engine/PhraseLoader.js');

// Force-inject locale data into cache by calling preload (it will use import.meta.glob)
// Actually — we can't bypass Vite's glob. Let's just set the language and hope the cache works.
// Better approach: directly set the phrase bank cache via the module's internal API.
// Since we can't, let's try preloading normally — the slowness is in Vite transform, not JSON parse.

console.time('preload');
await preloadPhraseBank(langCode);
console.timeEnd('preload');
setGenerationLanguage(langCode);

const LANG_NAMES = { es:'Spanish', fr:'French', de:'German', it:'Italian', pt:'Portuguese', ru:'Russian', ja:'Japanese', ko:'Korean', zh:'Chinese', ar:'Arabic', hi:'Hindi', tr:'Turkish', th:'Thai', fi:'Finnish', hu:'Hungarian', et:'Estonian', az:'Azerbaijani' };
const langName = LANG_NAMES[langCode] || langCode;

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
const MOODS = ['happy','sad','romantic','aggressive','dreamy','dark','epic','hopeful','melancholic'];
const SCHEMES = ['AABB','ABAB','AAAA','freeform'];
const WHITELIST = new Set(['go','no','yeah','oh','hey','na','la','louder','spinning','alive','hallelujah','sabor','vamos','baila','dale','encore','night','higher','deeper','faster','stronger','triple','sigue','fuego','arriba','oye','mira','ven','allez','oui','non','plus','jamais','mehr','nein','los','dai','sempre','ancora','mais','vai','vem','motto','yume','nan','neo','aye','yo','woah','ooh','ah','eh']);
const WEAK = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','is','was','are','were','be']);

function checkLine(line) {
    const issues = [];
    const c = line.replace(/ - /g,' ').toLowerCase();
    const w = c.split(/\s+/).filter(Boolean);
    for (let i=0;i<w.length-1;i++) if(w[i]===w[i+1]&&!WHITELIST.has(w[i])) issues.push(`REPEATED: "${w[i]} ${w[i+1]}"`);
    if(w.length<3) issues.push(`TOO_SHORT: ${w.length} words`);
    if(w.length>20) issues.push(`TOO_LONG: ${w.length} words`);
    if(WEAK.has(w[w.length-1])) issues.push(`WEAK_END: "${w[w.length-1]}"`);
    if(c.includes('{')||c.includes('}')) issues.push(`TEMPLATE: unfilled placeholder`);
    if(c.includes('undefined')||c==='null') issues.push(`BAD_VALUE`);
    return issues;
}

console.log(`\nAuditing ${langName} (${langCode}) — 100 gens × 12 genres...\n`);
let totalLines=0, totalIssues=0;
const rows=[];
const examples=[];

console.time('generation');
for (const {genre, structure} of GENRES) {
    let lines=0, issues=0;
    for(let i=0;i<100;i++){
        const song = generateSong({
            genre, mood:MOODS[i%MOODS.length], key:'C', scale:i%2===0?'major':'minor',
            bpm:90+(i%4)*10, melodyPattern:[], structure, rhymeScheme:SCHEMES[i%SCHEMES.length],
            language:langName, creativity:50+(i%3)*20, globalBars:8, usePunchlines:false
        });
        for(const sec of song.sections) for(const line of sec.lines){
            lines++;
            const li=checkLine(line);
            issues+=li.length;
            if(li.length>0&&examples.length<30) examples.push({genre,gen:i+1,sec:sec.label,line,issues:li});
        }
    }
    totalLines+=lines; totalIssues+=issues;
    rows.push({genre,lines,issues});
    const mark = issues===0?'✓':'✗';
    console.log(`  ${mark} ${genre.padEnd(10)} | ${String(lines).padStart(5)} lines | ${issues} issues`);
}
console.timeEnd('generation');

console.log(`\n  TOTAL: ${totalLines} lines, ${totalIssues} issues\n`);

// Write report
let md=`# ${langName.toUpperCase()} (${langCode}) Audit\n\nTotal lines: ${totalLines} | Issues: **${totalIssues}**\n\n`;
md+=`| Genre | Lines | Issues |\n|-------|-------|--------|\n`;
for(const r of rows) md+=`| ${r.genre} | ${r.lines} | ${r.issues} |\n`;
if(examples.length>0){
    md+=`\n## Examples\n\n`;
    for(const e of examples) md+=`- [${e.genre}] Gen#${e.gen} ${e.sec}: \`${e.line}\` — ${e.issues.join(', ')}\n`;
}
writeFileSync(join(__dirname,`${langCode}-audit-report.md`),md);
console.log(`Report → ${langCode}-audit-report.md`);

setGenerationLanguage('en');
