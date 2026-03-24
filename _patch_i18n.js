/**
 * Patch I18nContext.jsx to add be, sq, sw, ka to LANGUAGE_NAMES and LANGUAGE_CODES
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'i18n', 'I18nContext.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// New language names in every existing language
const newNames = {
    en: { be: 'Belarusian', sq: 'Albanian', sw: 'Swahili', ka: 'Georgian' },
    es: { be: 'Bielorruso', sq: 'Albanés', sw: 'Suajili', ka: 'Georgiano' },
    fr: { be: 'Biélorusse', sq: 'Albanais', sw: 'Swahili', ka: 'Géorgien' },
    de: { be: 'Weißrussisch', sq: 'Albanisch', sw: 'Suaheli', ka: 'Georgisch' },
    it: { be: 'Bielorusso', sq: 'Albanese', sw: 'Swahili', ka: 'Georgiano' },
    pt: { be: 'Bielorrusso', sq: 'Albanês', sw: 'Suaíli', ka: 'Georgiano' },
    ja: { be: 'ベラルーシ語', sq: 'アルバニア語', sw: 'スワヒリ語', ka: 'ジョージア語' },
    ko: { be: '벨라루스어', sq: '알바니아어', sw: '스와힐리어', ka: '조지아어' },
    zh: { be: '白俄罗斯语', sq: '阿尔巴尼亚语', sw: '斯瓦希里语', ka: '格鲁吉亚语' },
    ru: { be: 'Белорусский', sq: 'Албанский', sw: 'Суахили', ka: 'Грузинский' },
    ar: { be: 'البيلاروسية', sq: 'الألبانية', sw: 'السواحيلية', ka: 'الجورجية' },
    hi: { be: 'बेलारूसी', sq: 'अल्बानियाई', sw: 'स्वाहिली', ka: 'जॉर्जियाई' },
    nl: { be: 'Wit-Russisch', sq: 'Albanees', sw: 'Swahili', ka: 'Georgisch' },
    pl: { be: 'Białoruski', sq: 'Albański', sw: 'Suahili', ka: 'Gruziński' },
    tr: { be: 'Belarusça', sq: 'Arnavutça', sw: 'Svahilice', ka: 'Gürcüce' },
    sv: { be: 'Vitryska', sq: 'Albanska', sw: 'Swahili', ka: 'Georgiska' },
    nb: { be: 'Hviterussisk', sq: 'Albansk', sw: 'Swahili', ka: 'Georgisk' },
    da: { be: 'Hviderussisk', sq: 'Albansk', sw: 'Swahili', ka: 'Georgisk' },
    fi: { be: 'Valkovenäjä', sq: 'Albania', sw: 'Swahili', ka: 'Georgia' },
    cs: { be: 'Běloruština', sq: 'Albánština', sw: 'Svahilština', ka: 'Gruzínština' },
    ro: { be: 'Belarusă', sq: 'Albaneză', sw: 'Swahili', ka: 'Georgiană' },
    hu: { be: 'Belarusz', sq: 'Albán', sw: 'Szuahéli', ka: 'Grúz' },
    th: { be: 'เบลารุส', sq: 'แอลเบเนีย', sw: 'สวาฮีลี', ka: 'จอร์เจีย' },
    vi: { be: 'Tiếng Belarus', sq: 'Tiếng Albania', sw: 'Tiếng Swahili', ka: 'Tiếng Georgia' },
    id: { be: 'Belarus', sq: 'Albania', sw: 'Swahili', ka: 'Georgia' },
    uk: { be: 'Білоруська', sq: 'Албанська', sw: 'Суахілі', ka: 'Грузинська' },
    el: { be: 'Λευκορωσικά', sq: 'Αλβανικά', sw: 'Σουαχίλι', ka: 'Γεωργιανά' },
    he: { be: 'בלארוסית', sq: 'אלבנית', sw: 'סוואהילית', ka: 'גאורגית' },
    sk: { be: 'Bieloruština', sq: 'Albánčina', sw: 'Svahilčina', ka: 'Gruzínčina' },
    ms: { be: 'Belarus', sq: 'Albania', sw: 'Swahili', ka: 'Georgia' },
    hr: { be: 'Bjeloruski', sq: 'Albanski', sw: 'Svahili', ka: 'Gruzijski' },
    ca: { be: 'Bielorús', sq: 'Albanès', sw: 'Suahili', ka: 'Georgià' },
    bg: { be: 'Беларуски', sq: 'Албански', sw: 'Суахили', ka: 'Грузински' },
    sr: { be: 'Beloruski', sq: 'Albanski', sw: 'Svahili', ka: 'Gruzijski' },
    lt: { be: 'Baltarusių', sq: 'Albanų', sw: 'Svahilių', ka: 'Gruzinų' },
    lv: { be: 'Baltkrievu', sq: 'Albāņu', sw: 'Svahilu', ka: 'Gruzīnu' },
    sl: { be: 'Beloruščina', sq: 'Albanščina', sw: 'Svahili', ka: 'Gruzinščina' },
    et: { be: 'Valgevene', sq: 'Albaania', sw: 'Suahiili', ka: 'Gruusia' },
    gl: { be: 'Bielorruso', sq: 'Albanés', sw: 'Suahili', ka: 'Xeorxiano' },
    af: { be: 'Wit-Russies', sq: 'Albanees', sw: 'Swahili', ka: 'Georgies' },
    az: { be: 'Belarusca', sq: 'Albanca', sw: 'Svahilicə', ka: 'Gürcücə' },
    bs: { be: 'Bjeloruski', sq: 'Albanski', sw: 'Svahili', ka: 'Gruzijski' },
    mk: { be: 'Белоруски', sq: 'Албански', sw: 'Свахили', ka: 'Грузиски' },
    tl: { be: 'Belarusian', sq: 'Albanian', sw: 'Swahili', ka: 'Georgian' },
};

// New language rows
const newRows = {
    be: { en: 'Англійская', es: 'Іспанская', fr: 'Французская', de: 'Нямецкая', it: 'Італьянская', pt: 'Партугальская', ja: 'Японская', ko: 'Карэйская', zh: 'Кітайская (Спрошчаная)', ru: 'Руская', ar: 'Арабская', hi: 'Хіндзі', nl: 'Нідэрландская', pl: 'Польская', tr: 'Турэцкая', sv: 'Шведская', nb: 'Нарвежская', da: 'Дацкая', fi: 'Фінская', cs: 'Чэшская', ro: 'Румынская', hu: 'Венгерская', th: 'Тайская', vi: 'В\'етнамская', id: 'Інданезійская', uk: 'Украінская', el: 'Грэчаская', he: 'Іўрыт', sk: 'Славацкая', ms: 'Малайская', hr: 'Харвацкая', ca: 'Каталонская', bg: 'Балгарская', sr: 'Сербская', lt: 'Літоўская', lv: 'Латвійская', sl: 'Славенская', et: 'Эстонская', gl: 'Галісійская', af: 'Афрыкаанс', az: 'Азербайджанская', bs: 'Баснійская', mk: 'Македонская', tl: 'Філіпінская', be: 'Беларуская', sq: 'Албанская', sw: 'Суахілі', ka: 'Грузінская' },
    sq: { en: 'Anglisht', es: 'Spanjisht', fr: 'Frëngjisht', de: 'Gjermanisht', it: 'Italisht', pt: 'Portugalisht', ja: 'Japonisht', ko: 'Koreanisht', zh: 'Kinezisht (E thjeshtuar)', ru: 'Rusisht', ar: 'Arabisht', hi: 'Hindi', nl: 'Holandisht', pl: 'Polonisht', tr: 'Turqisht', sv: 'Suedisht', nb: 'Norvegjisht', da: 'Danisht', fi: 'Finlandisht', cs: 'Çekisht', ro: 'Rumanisht', hu: 'Hungarisht', th: 'Tajlandisht', vi: 'Vietnamisht', id: 'Indonezisht', uk: 'Ukrainisht', el: 'Greqisht', he: 'Hebraisht', sk: 'Sllovakisht', ms: 'Malajzisht', hr: 'Kroatisht', ca: 'Katalonisht', bg: 'Bullgarisht', sr: 'Serbisht', lt: 'Lituanisht', lv: 'Letonisht', sl: 'Sllovenisht', et: 'Estonisht', gl: 'Galicisht', af: 'Afrikaans', az: 'Azerbajxhanisht', bs: 'Boshnjakisht', mk: 'Maqedonisht', tl: 'Filipinisht', be: 'Bjellorusisht', sq: 'Shqip', sw: 'Suahili', ka: 'Gjeorgjisht' },
    sw: { en: 'Kiingereza', es: 'Kihispania', fr: 'Kifaransa', de: 'Kijerumani', it: 'Kiitaliano', pt: 'Kireno', ja: 'Kijapani', ko: 'Kikorea', zh: 'Kichina (Rahisi)', ru: 'Kirusi', ar: 'Kiarabu', hi: 'Kihindi', nl: 'Kiholanzi', pl: 'Kipolishi', tr: 'Kituruki', sv: 'Kiswidi', nb: 'Kinorwe', da: 'Kideni', fi: 'Kifini', cs: 'Kicheki', ro: 'Kiromania', hu: 'Kihungari', th: 'Kithai', vi: 'Kivietinamu', id: 'Kiindonesia', uk: 'Kiukrainia', el: 'Kigiriki', he: 'Kiebrania', sk: 'Kislovakia', ms: 'Kimalei', hr: 'Kikroeshia', ca: 'Kikatalani', bg: 'Kibulgaria', sr: 'Kiserbia', lt: 'Kilithuania', lv: 'Kilatvia', sl: 'Kislovenia', et: 'Kiestonia', gl: 'Kigalisia', af: 'Kiafrikaans', az: 'Kiazerbaijani', bs: 'Kibosnia', mk: 'Kimasedonia', tl: 'Kifilipino', be: 'Kibelarusi', sq: 'Kialbania', sw: 'Kiswahili', ka: 'Kijojia' },
    ka: { en: 'ინგლისური', es: 'ესპანური', fr: 'ფრანგული', de: 'გერმანული', it: 'იტალიური', pt: 'პორტუგალიური', ja: 'იაპონური', ko: 'კორეული', zh: 'ჩინური (გამარტივებული)', ru: 'რუსული', ar: 'არაბული', hi: 'ჰინდი', nl: 'ჰოლანდიური', pl: 'პოლონური', tr: 'თურქული', sv: 'შვედური', nb: 'ნორვეგიული', da: 'დანიური', fi: 'ფინური', cs: 'ჩეხური', ro: 'რუმინული', hu: 'უნგრული', th: 'ტაილანდური', vi: 'ვიეტნამური', id: 'ინდონეზიური', uk: 'უკრაინული', el: 'ბერძნული', he: 'ებრაული', sk: 'სლოვაკური', ms: 'მალაიური', hr: 'ხორვატიული', ca: 'კატალონიური', bg: 'ბულგარული', sr: 'სერბული', lt: 'ლიტვური', lv: 'ლატვიური', sl: 'სლოვენური', et: 'ესტონური', gl: 'გალისიური', af: 'აფრიკაანსი', az: 'აზერბაიჯანული', bs: 'ბოსნიური', mk: 'მაკედონური', tl: 'ფილიპინური', be: 'ბელარუსული', sq: 'ალბანური', sw: 'სუაჰილი', ka: 'ქართული' },
};

// For each existing language row, add the 4 new language name entries
for (const [langCode, names] of Object.entries(newNames)) {
    // Find the line pattern: "    langCode: { ... },"
    // We need to add be, sq, sw, ka before the closing " },"
    const regex = new RegExp(`(    ${langCode}: \\{[^}]+, tl: '[^']+')( \\},)`);
    const match = content.match(regex);
    if (match) {
        const additions = `, be: '${names.be}', sq: '${names.sq}', sw: '${names.sw}', ka: '${names.ka}'`;
        content = content.replace(regex, `$1${additions}$2`);
    } else {
        console.warn(`Could not find row for ${langCode}`);
    }
}

// Add the 4 new rows before the closing "};""
const newRowLines = [];
for (const [code, row] of Object.entries(newRows)) {
    const entries = Object.entries(row).map(([k, v]) => `${k}: '${v}'`).join(', ');
    newRowLines.push(`    ${code}: { ${entries} },`);
}

content = content.replace(
    /    tl: \{ [^}]+ \},\n\};/,
    (match) => match.replace('\n};', '\n' + newRowLines.join('\n') + '\n};')
);

// Update LANGUAGE_CODES
content = content.replace(
    /const LANGUAGE_CODES = \[([^\]]+)\];/,
    (match, codes) => {
        return match.replace(codes, codes.trimEnd() + ", 'be', 'sq', 'sw', 'ka'");
    }
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched I18nContext.jsx with be, sq, sw, ka');

// Verify
const updated = fs.readFileSync(filePath, 'utf8');
const langCodeMatch = updated.match(/LANGUAGE_CODES = \[([^\]]+)\]/);
if (langCodeMatch) {
    const codes = langCodeMatch[1].match(/'[a-z]{2}'/g);
    console.log(`Total language codes: ${codes.length}`);
}
