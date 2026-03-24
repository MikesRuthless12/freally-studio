/**
 * Propagate pianoRoll.fold/snap/scale/invert keys to all 44 non-English locales.
 */
const fs = require('fs');
const path = require('path');
const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

const translations = {
  es: { "pianoRoll.fold": "Plegar", "pianoRoll.snap": "Ajustar", "pianoRoll.scale": "Escala", "pianoRoll.invert": "Invertir" },
  fr: { "pianoRoll.fold": "Plier", "pianoRoll.snap": "Aligner", "pianoRoll.scale": "Gamme", "pianoRoll.invert": "Inverser" },
  de: { "pianoRoll.fold": "Falten", "pianoRoll.snap": "Einrasten", "pianoRoll.scale": "Tonleiter", "pianoRoll.invert": "Umkehren" },
  it: { "pianoRoll.fold": "Piega", "pianoRoll.snap": "Agganciare", "pianoRoll.scale": "Scala", "pianoRoll.invert": "Invertire" },
  pt: { "pianoRoll.fold": "Dobrar", "pianoRoll.snap": "Ajustar", "pianoRoll.scale": "Escala", "pianoRoll.invert": "Inverter" },
  ja: { "pianoRoll.fold": "折りたたみ", "pianoRoll.snap": "スナップ", "pianoRoll.scale": "スケール", "pianoRoll.invert": "反転" },
  ko: { "pianoRoll.fold": "접기", "pianoRoll.snap": "스냅", "pianoRoll.scale": "스케일", "pianoRoll.invert": "반전" },
  zh: { "pianoRoll.fold": "折叠", "pianoRoll.snap": "吸附", "pianoRoll.scale": "音阶", "pianoRoll.invert": "反转" },
  ru: { "pianoRoll.fold": "Свернуть", "pianoRoll.snap": "Привязка", "pianoRoll.scale": "Тональность", "pianoRoll.invert": "Инвертировать" },
  ar: { "pianoRoll.fold": "طي", "pianoRoll.snap": "محاذاة", "pianoRoll.scale": "سلم", "pianoRoll.invert": "عكس" },
  hi: { "pianoRoll.fold": "फोल्ड", "pianoRoll.snap": "स्नैप", "pianoRoll.scale": "स्केल", "pianoRoll.invert": "उलटें" },
  nl: { "pianoRoll.fold": "Vouwen", "pianoRoll.snap": "Snap", "pianoRoll.scale": "Toonladder", "pianoRoll.invert": "Omkeren" },
  pl: { "pianoRoll.fold": "Złóż", "pianoRoll.snap": "Przyciągnij", "pianoRoll.scale": "Skala", "pianoRoll.invert": "Odwróć" },
  tr: { "pianoRoll.fold": "Katla", "pianoRoll.snap": "Yapıştır", "pianoRoll.scale": "Skala", "pianoRoll.invert": "Ters Çevir" },
  sv: { "pianoRoll.fold": "Vik", "pianoRoll.snap": "Fäst", "pianoRoll.scale": "Skala", "pianoRoll.invert": "Invertera" },
  nb: { "pianoRoll.fold": "Brett", "pianoRoll.snap": "Fest", "pianoRoll.scale": "Skala", "pianoRoll.invert": "Inverter" },
  da: { "pianoRoll.fold": "Fold", "pianoRoll.snap": "Snap", "pianoRoll.scale": "Skala", "pianoRoll.invert": "Inverter" },
  fi: { "pianoRoll.fold": "Taita", "pianoRoll.snap": "Kohdista", "pianoRoll.scale": "Asteikko", "pianoRoll.invert": "Käännä" },
  cs: { "pianoRoll.fold": "Složit", "pianoRoll.snap": "Přichytit", "pianoRoll.scale": "Stupnice", "pianoRoll.invert": "Invertovat" },
  ro: { "pianoRoll.fold": "Pliază", "pianoRoll.snap": "Aliniază", "pianoRoll.scale": "Scară", "pianoRoll.invert": "Inversează" },
  hu: { "pianoRoll.fold": "Összecsuk", "pianoRoll.snap": "Illesztés", "pianoRoll.scale": "Skála", "pianoRoll.invert": "Fordítás" },
  th: { "pianoRoll.fold": "พับ", "pianoRoll.snap": "จับคู่", "pianoRoll.scale": "สเกล", "pianoRoll.invert": "กลับ" },
  vi: { "pianoRoll.fold": "Gấp", "pianoRoll.snap": "Bám", "pianoRoll.scale": "Thang âm", "pianoRoll.invert": "Đảo ngược" },
  id: { "pianoRoll.fold": "Lipat", "pianoRoll.snap": "Snap", "pianoRoll.scale": "Skala", "pianoRoll.invert": "Balik" },
  uk: { "pianoRoll.fold": "Згорнути", "pianoRoll.snap": "Прив'язка", "pianoRoll.scale": "Тональність", "pianoRoll.invert": "Інвертувати" },
  el: { "pianoRoll.fold": "Δίπλωση", "pianoRoll.snap": "Κούμπωμα", "pianoRoll.scale": "Κλίμακα", "pianoRoll.invert": "Αντιστροφή" },
  he: { "pianoRoll.fold": "קפל", "pianoRoll.snap": "הצמד", "pianoRoll.scale": "סולם", "pianoRoll.invert": "הפוך" },
  sk: { "pianoRoll.fold": "Zložiť", "pianoRoll.snap": "Prichytiť", "pianoRoll.scale": "Stupnica", "pianoRoll.invert": "Invertovať" },
  ms: { "pianoRoll.fold": "Lipat", "pianoRoll.snap": "Snap", "pianoRoll.scale": "Skala", "pianoRoll.invert": "Songsang" },
  hr: { "pianoRoll.fold": "Presavij", "pianoRoll.snap": "Uhvati", "pianoRoll.scale": "Ljestvica", "pianoRoll.invert": "Invertiraj" },
  ca: { "pianoRoll.fold": "Plega", "pianoRoll.snap": "Ajusta", "pianoRoll.scale": "Escala", "pianoRoll.invert": "Inverteix" },
  bg: { "pianoRoll.fold": "Сгъни", "pianoRoll.snap": "Прилепи", "pianoRoll.scale": "Гама", "pianoRoll.invert": "Обърни" },
  sr: { "pianoRoll.fold": "Савиј", "pianoRoll.snap": "Причврсти", "pianoRoll.scale": "Лествица", "pianoRoll.invert": "Обрни" },
  lt: { "pianoRoll.fold": "Sulankstyk", "pianoRoll.snap": "Pritraukti", "pianoRoll.scale": "Gama", "pianoRoll.invert": "Invertuoti" },
  lv: { "pianoRoll.fold": "Salocīt", "pianoRoll.snap": "Pievilkt", "pianoRoll.scale": "Gamma", "pianoRoll.invert": "Invertēt" },
  sl: { "pianoRoll.fold": "Zloži", "pianoRoll.snap": "Pripni", "pianoRoll.scale": "Lestvica", "pianoRoll.invert": "Obrni" },
  et: { "pianoRoll.fold": "Voldi", "pianoRoll.snap": "Haara", "pianoRoll.scale": "Heliredel", "pianoRoll.invert": "Pööra" },
  gl: { "pianoRoll.fold": "Pregar", "pianoRoll.snap": "Axustar", "pianoRoll.scale": "Escala", "pianoRoll.invert": "Invertir" },
  af: { "pianoRoll.fold": "Vou", "pianoRoll.snap": "Snap", "pianoRoll.scale": "Skaal", "pianoRoll.invert": "Omkeer" },
  az: { "pianoRoll.fold": "Qatla", "pianoRoll.snap": "Yapışdır", "pianoRoll.scale": "Qamma", "pianoRoll.invert": "Tərsinə çevir" },
  bs: { "pianoRoll.fold": "Presavij", "pianoRoll.snap": "Prikači", "pianoRoll.scale": "Ljestvica", "pianoRoll.invert": "Invertiraj" },
  mk: { "pianoRoll.fold": "Преклопи", "pianoRoll.snap": "Прилепи", "pianoRoll.scale": "Скала", "pianoRoll.invert": "Обратно" },
  tl: { "pianoRoll.fold": "Tiklupin", "pianoRoll.snap": "I-snap", "pianoRoll.scale": "Iskala", "pianoRoll.invert": "Baligtarin" },
  be: { "pianoRoll.fold": "Згарнуць", "pianoRoll.snap": "Прывязка", "pianoRoll.scale": "Гама", "pianoRoll.invert": "Інвертаваць" },
};

const keys = ["pianoRoll.fold", "pianoRoll.snap", "pianoRoll.scale", "pianoRoll.invert"];

for (const file of fs.readdirSync(localesDir)) {
  if (!file.endsWith('.json') || file === 'en.json') continue;
  const lang = file.replace('.json', '');
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let added = 0;
  for (const key of keys) {
    if (!data[key]) {
      data[key] = translations[lang]?.[key] || key.split('.')[1];
      added++;
    }
  }
  if (added > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`${lang}: added ${added} keys`);
  }
}
console.log('Done!');
