const fs = require('fs');
const path = require('path');
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');

const translations = {
  es: "Activar/desactivar pista",
  fr: "Activer/désactiver la piste",
  de: "Spur ein/ausschalten",
  it: "Attiva/disattiva traccia",
  pt: "Ligar/desligar faixa",
  ja: "トラックのオン/オフ切替",
  ko: "트랙 켜기/끄기",
  zh: "开关音轨",
  ru: "Включить/выключить дорожку",
  ar: "تشغيل/إيقاف المسار",
  hi: "ट्रैक चालू/बंद करें",
  nl: "Track aan/uit schakelen",
  pl: "Włącz/wyłącz ścieżkę",
  tr: "Parçayı aç/kapat",
  sv: "Slå på/av spår",
  nb: "Slå spor av/på",
  da: "Tænd/sluk spor",
  fi: "Raita päälle/pois",
  cs: "Zapnout/vypnout stopu",
  ro: "Pornește/oprește pista",
  hu: "Sáv be/kikapcsolása",
  th: "เปิด/ปิดแทร็ก",
  vi: "Bật/tắt rãnh",
  id: "Nyalakan/matikan trek",
  uk: "Увімкнути/вимкнути доріжку",
  el: "Ενεργοποίηση/απενεργοποίηση κομματιού",
  he: "הפעל/כבה רצועה",
  sk: "Zapnúť/vypnúť stopu",
  ms: "Hidupkan/matikan trek",
  hr: "Uključi/isključi traku",
  ca: "Activar/desactivar pista",
  bg: "Включи/изключи пътечка",
  sr: "Укључи/искључи траку",
  lt: "Įjungti/išjungti takelį",
  lv: "Ieslēgt/izslēgt celiņu",
  sl: "Vklopi/izklopi sled",
  et: "Lülita rada sisse/välja",
  gl: "Activar/desactivar pista",
  af: "Skakel snit aan/af",
  az: "Cığırı yandır/söndür",
  bs: "Uključi/isključi traku",
  mk: "Вклучи/исклучи патека",
  tl: "I-toggle ang track on/off",
  be: "Уключыць/выключыць дарожку"
};

const localeFiles = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json') && f !== 'en.json');
let updated = 0;

for (const file of localeFiles) {
  const lang = file.replace('.json', '');
  const filePath = path.join(LOCALES_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data["common.togglePower"]) {
    data["common.togglePower"] = translations[lang] || "Toggle track on/off";
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    updated++;
  }
}

console.log(`Updated ${updated} locale files with common.togglePower.`);
