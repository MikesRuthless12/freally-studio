const fs = require('fs');
const path = require('path');
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');

const translations = {
  es: "Seleccionar octava inicial",
  fr: "Sélectionner l'octave de départ",
  de: "Startoktave auswählen",
  it: "Seleziona l'ottava iniziale",
  pt: "Selecionar oitava inicial",
  ja: "開始オクターブを選択",
  ko: "시작 옥타브 선택",
  zh: "选择起始八度",
  ru: "Выбрать начальную октаву",
  ar: "اختر الأوكتاف الابتدائي",
  hi: "प्रारंभिक ऑक्टेव चुनें",
  nl: "Startoctaaf selecteren",
  pl: "Wybierz oktawę początkową",
  tr: "Başlangıç oktavını seç",
  sv: "Välj startoktav",
  nb: "Velg startoktav",
  da: "Vælg startoktav",
  fi: "Valitse aloitusoktaavi",
  cs: "Vybrat počáteční oktávu",
  ro: "Selectează octava de start",
  hu: "Induló oktáv kiválasztása",
  th: "เลือกอ็อกเทฟเริ่มต้น",
  vi: "Chọn quãng tám bắt đầu",
  id: "Pilih oktaf awal",
  uk: "Вибрати початкову октаву",
  el: "Επιλογή αρχικής οκτάβας",
  he: "בחר אוקטבה התחלתית",
  sk: "Vybrať počiatočnú oktávu",
  ms: "Pilih oktaf permulaan",
  hr: "Odaberi početnu oktavu",
  ca: "Selecciona l'octava inicial",
  bg: "Избери начална октава",
  sr: "Изабери почетну октаву",
  lt: "Pasirinkti pradinę oktavą",
  lv: "Izvēlēties sākuma oktāvu",
  sl: "Izberi začetno oktavo",
  et: "Vali algne oktaav",
  gl: "Seleccionar a oitava inicial",
  af: "Kies beginoktaaf",
  az: "Başlanğıc oktavanı seç",
  bs: "Odaberi početnu oktavu",
  mk: "Избери почетна октава",
  tl: "Piliin ang panimulang octave",
  be: "Выбраць пачатковую актаву"
};

const localeFiles = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json') && f !== 'en.json');
let updated = 0;
for (const file of localeFiles) {
  const lang = file.replace('.json', '');
  const filePath = path.join(LOCALES_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data["common.octaveTooltip"]) {
    data["common.octaveTooltip"] = translations[lang] || "Select starting octave";
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    updated++;
  }
}
console.log(`Updated ${updated} locale files with common.octaveTooltip.`);
