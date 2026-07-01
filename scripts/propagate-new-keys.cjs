/**
 * Propagate new translation keys to all 44 non-English locale files.
 *
 * Reads en.json as the master, checks each locale for missing keys,
 * and adds native-language translations for the new UI keys.
 *
 * Usage: node scripts/propagate-new-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const enKeys = Object.keys(en);

// ─── New keys and their translations for ALL 44 non-English locales ───

const newKeyTranslations = {
  // ── ui.* keys ──
  "ui.minimize": {
    es: "Minimizar", fr: "Réduire", de: "Minimieren", it: "Riduci a icona", pt: "Minimizar",
    ja: "最小化", ko: "최소화", zh: "最小化", ru: "Свернуть", ar: "تصغير", hi: "छोटा करें",
    nl: "Minimaliseren", pl: "Minimalizuj", tr: "Küçült", sv: "Minimera", nb: "Minimer",
    da: "Minimer", fi: "Pienennä", cs: "Minimalizovat", ro: "Minimizare", hu: "Kis méret",
    th: "ย่อ", vi: "Thu nhỏ", id: "Perkecil", uk: "Згорнути", el: "Ελαχιστοποίηση", he: "מזער",
    sk: "Minimalizovať", ms: "Kecilkan", hr: "Smanji", ca: "Minimitza", bg: "Минимизиране",
    sr: "Минимизуј", lt: "Sumažinti", lv: "Minimizēt", sl: "Pomanjšaj", et: "Minimeeri",
    gl: "Minimizar", af: "Minimeer", az: "Kiçilt", bs: "Minimiziraj", mk: "Минимизирај",
    tl: "Paliitin", be: "Згарнуць"
  },
  "ui.close": {
    es: "Cerrar", fr: "Fermer", de: "Schließen", it: "Chiudi", pt: "Fechar",
    ja: "閉じる", ko: "닫기", zh: "关闭", ru: "Закрыть", ar: "إغلاق", hi: "बंद करें",
    nl: "Sluiten", pl: "Zamknij", tr: "Kapat", sv: "Stäng", nb: "Lukk",
    da: "Luk", fi: "Sulje", cs: "Zavřít", ro: "Închide", hu: "Bezárás",
    th: "ปิด", vi: "Đóng", id: "Tutup", uk: "Закрити", el: "Κλείσιμο", he: "סגור",
    sk: "Zavrieť", ms: "Tutup", hr: "Zatvori", ca: "Tanca", bg: "Затвори",
    sr: "Затвори", lt: "Uždaryti", lv: "Aizvērt", sl: "Zapri", et: "Sulge",
    gl: "Pechar", af: "Sluit", az: "Bağla", bs: "Zatvori", mk: "Затвори",
    tl: "Isara", be: "Зачыніць"
  },
  "ui.openInSeparateWindow": {
    es: "Abrir en ventana separada", fr: "Ouvrir dans une fenêtre séparée", de: "In separatem Fenster öffnen",
    it: "Apri in finestra separata", pt: "Abrir em janela separada",
    ja: "別ウィンドウで開く", ko: "별도 창에서 열기", zh: "在独立窗口中打开", ru: "Открыть в отдельном окне",
    ar: "فتح في نافذة منفصلة", hi: "अलग विंडो में खोलें",
    nl: "Openen in apart venster", pl: "Otwórz w osobnym oknie", tr: "Ayrı pencerede aç",
    sv: "Öppna i separat fönster", nb: "Åpne i eget vindu", da: "Åbn i separat vindue",
    fi: "Avaa erillisessä ikkunassa", cs: "Otevřít v samostatném okně", ro: "Deschide în fereastră separată",
    hu: "Megnyitás külön ablakban", th: "เปิดในหน้าต่างแยก", vi: "Mở trong cửa sổ riêng",
    id: "Buka di jendela terpisah", uk: "Відкрити в окремому вікні", el: "Άνοιγμα σε ξεχωριστό παράθυρο",
    he: "פתח בחלון נפרד", sk: "Otvoriť v samostatnom okne", ms: "Buka dalam tetingkap berasingan",
    hr: "Otvori u zasebnom prozoru", ca: "Obre en una finestra separada", bg: "Отвори в отделен прозорец",
    sr: "Отвори у посебном прозору", lt: "Atidaryti atskirame lange", lv: "Atvērt atsevišķā logā",
    sl: "Odpri v ločenem oknu", et: "Ava eraldi aknas", gl: "Abrir en xanela separada",
    af: "Maak oop in aparte venster", az: "Ayrı pəncərədə aç", bs: "Otvori u zasebnom prozoru",
    mk: "Отвори во посебен прозорец", tl: "Buksan sa hiwalay na window", be: "Адкрыць у асобным акне"
  },
  "ui.restoreToBrowser": {
    es: "Restaurar al navegador", fr: "Restaurer dans le navigateur", de: "Im Browser wiederherstellen",
    it: "Ripristina nel browser", pt: "Restaurar no navegador",
    ja: "ブラウザに戻す", ko: "브라우저로 복원", zh: "恢复到浏览器", ru: "Восстановить в браузере",
    ar: "استعادة إلى المتصفح", hi: "ब्राउज़र में पुनर्स्थापित करें",
    nl: "Herstellen in browser", pl: "Przywróć w przeglądarce", tr: "Tarayıcıya geri yükle",
    sv: "Återställ till webbläsaren", nb: "Gjenopprett i nettleseren", da: "Gendan i browser",
    fi: "Palauta selaimeen", cs: "Obnovit v prohlížeči", ro: "Restaurare în browser",
    hu: "Visszaállítás böngészőbe", th: "คืนค่าไปยังเบราว์เซอร์", vi: "Khôi phục về trình duyệt",
    id: "Pulihkan ke browser", uk: "Відновити у браузері", el: "Επαναφορά στο πρόγραμμα περιήγησης",
    he: "שחזר לדפדפן", sk: "Obnoviť v prehliadači", ms: "Pulihkan ke pelayar",
    hr: "Vrati u preglednik", ca: "Restaura al navegador", bg: "Възстанови в браузъра",
    sr: "Врати у прегледач", lt: "Atkurti naršyklėje", lv: "Atjaunot pārlūkā",
    sl: "Obnovi v brskalniku", et: "Taasta brauseris", gl: "Restaurar no navegador",
    af: "Herstel na blaaier", az: "Brauzerdə bərpa et", bs: "Vrati u preglednik",
    mk: "Врати во прелистувач", tl: "Ibalik sa browser", be: "Аднавіць у браўзеры"
  },
  "ui.toggleTheme": {
    es: "Cambiar tema", fr: "Changer le thème", de: "Design umschalten", it: "Cambia tema",
    pt: "Alternar tema", ja: "テーマ切替", ko: "테마 전환", zh: "切换主题", ru: "Сменить тему",
    ar: "تبديل المظهر", hi: "थीम बदलें", nl: "Thema wisselen", pl: "Zmień motyw",
    tr: "Tema değiştir", sv: "Byt tema", nb: "Bytt tema", da: "Skift tema", fi: "Vaihda teema",
    cs: "Přepnout motiv", ro: "Schimbă tema", hu: "Téma váltása", th: "สลับธีม",
    vi: "Đổi giao diện", id: "Ganti tema", uk: "Змінити тему", el: "Εναλλαγή θέματος",
    he: "החלף ערכת נושא", sk: "Prepnúť motív", ms: "Tukar tema", hr: "Promijeni temu",
    ca: "Canvia el tema", bg: "Смени темата", sr: "Промени тему", lt: "Keisti temą",
    lv: "Mainīt tēmu", sl: "Zamenjaj temo", et: "Vaheta teemat", gl: "Cambiar o tema",
    af: "Wissel tema", az: "Mövzunu dəyişdir", bs: "Promijeni temu", mk: "Промени тема",
    tl: "Palitan ang tema", be: "Змяніць тэму"
  },
  "ui.toggleFullScreen": {
    es: "Pantalla completa", fr: "Plein écran", de: "Vollbild umschalten", it: "Schermo intero",
    pt: "Tela cheia", ja: "全画面切替", ko: "전체 화면 전환", zh: "全屏切换", ru: "Полный экран",
    ar: "ملء الشاشة", hi: "पूर्ण स्क्रीन", nl: "Volledig scherm", pl: "Pełny ekran",
    tr: "Tam ekran", sv: "Helskärm", nb: "Fullskjerm", da: "Fuld skærm", fi: "Koko näyttö",
    cs: "Celá obrazovka", ro: "Ecran complet", hu: "Teljes képernyő", th: "เต็มหน้าจอ",
    vi: "Toàn màn hình", id: "Layar penuh", uk: "Повний екран", el: "Πλήρης οθόνη",
    he: "מסך מלא", sk: "Celá obrazovka", ms: "Skrin penuh", hr: "Cijeli zaslon",
    ca: "Pantalla completa", bg: "Цял екран", sr: "Цео екран", lt: "Visas ekranas",
    lv: "Pilnekrāns", sl: "Celozaslonski", et: "Täisekraan", gl: "Pantalla completa",
    af: "Volskerm", az: "Tam ekran", bs: "Pun ekran", mk: "Цел екран",
    tl: "Buong screen", be: "Поўны экран"
  },
  "ui.metronome": {
    es: "Metrónomo", fr: "Métronome", de: "Metronom", it: "Metronomo", pt: "Metrônomo",
    ja: "メトロノーム", ko: "메트로놈", zh: "节拍器", ru: "Метроном", ar: "ميترونوم", hi: "मेट्रोनोम",
    nl: "Metronoom", pl: "Metronom", tr: "Metronom", sv: "Metronom", nb: "Metronom",
    da: "Metronom", fi: "Metronomi", cs: "Metronom", ro: "Metronom", hu: "Metronóm",
    th: "เครื่องจับจังหวะ", vi: "Máy nhịp", id: "Metronom", uk: "Метроном", el: "Μετρονόμος",
    he: "מטרונום", sk: "Metronóm", ms: "Metronom", hr: "Metronom", ca: "Metrònom",
    bg: "Метроном", sr: "Метроном", lt: "Metronomas", lv: "Metronoms", sl: "Metronom",
    et: "Metronoom", gl: "Metrónomo", af: "Metronoom", az: "Metronom", bs: "Metronom",
    mk: "Метроном", tl: "Metronomo", be: "Метраном"
  },
  "ui.installDesktopApp": {
    es: "Instalar Freally como app de escritorio", fr: "Installer Freally en tant qu'application de bureau",
    de: "Freally als Desktop-App installieren", it: "Installa Freally come app desktop",
    pt: "Instalar Freally como app desktop", ja: "Freallyをデスクトップアプリとしてインストール",
    ko: "Freally을 데스크톱 앱으로 설치", zh: "安装Freally为桌面应用", ru: "Установить Freally как настольное приложение",
    ar: "تثبيت Freally كتطبيق سطح مكتب", hi: "Freally को डेस्कटॉप ऐप के रूप में इंस्टॉल करें",
    nl: "Freally installeren als desktop-app", pl: "Zainstaluj Freally jako aplikację desktopową",
    tr: "Freally'u masaüstü uygulaması olarak kur", sv: "Installera Freally som skrivbordsapp",
    nb: "Installer Freally som skrivebordsapp", da: "Installer Freally som desktop-app",
    fi: "Asenna Freally työpöytäsovelluksena", cs: "Nainstalovat Freally jako desktopovou aplikaci",
    ro: "Instalează Freally ca aplicație desktop", hu: "Freally telepítése asztali alkalmazásként",
    th: "ติดตั้ง Freally เป็นแอปเดสก์ท็อป", vi: "Cài đặt Freally làm ứng dụng máy tính",
    id: "Instal Freally sebagai aplikasi desktop", uk: "Встановити Freally як настільний додаток",
    el: "Εγκατάσταση Freally ως εφαρμογή επιφάνειας εργασίας", he: "התקן את Freally כאפליקציית שולחן עבודה",
    sk: "Nainštalovať Freally ako desktopovú aplikáciu", ms: "Pasang Freally sebagai aplikasi desktop",
    hr: "Instaliraj Freally kao desktop aplikaciju", ca: "Instal·la Freally com a aplicació d'escriptori",
    bg: "Инсталирай Freally като настолно приложение", sr: "Инсталирај Freally као десктоп апликацију",
    lt: "Įdiegti Freally kaip darbalaukio programą", lv: "Instalēt Freally kā darbvirsmas lietotni",
    sl: "Namesti Freally kot namizno aplikacijo", et: "Paigalda Freally töölauarakendusena",
    gl: "Instalar Freally como aplicación de escritorio", af: "Installeer Freally as 'n lessenaar-toep",
    az: "Freally-u masaüstü tətbiqi olaraq quraşdır", bs: "Instaliraj Freally kao desktop aplikaciju",
    mk: "Инсталирај Freally како десктоп апликација", tl: "I-install ang Freally bilang desktop app",
    be: "Усталяваць Freally як настольнае прыкладанне"
  },
  "ui.emoji": {
    es: "Emoji", fr: "Emoji", de: "Emoji", it: "Emoji", pt: "Emoji",
    ja: "絵文字", ko: "이모지", zh: "表情", ru: "Эмодзи", ar: "إيموجي", hi: "इमोजी",
    nl: "Emoji", pl: "Emoji", tr: "Emoji", sv: "Emoji", nb: "Emoji",
    da: "Emoji", fi: "Emoji", cs: "Emoji", ro: "Emoji", hu: "Emoji",
    th: "อิโมจิ", vi: "Emoji", id: "Emoji", uk: "Емодзі", el: "Emoji",
    he: "אמוג'י", sk: "Emoji", ms: "Emoji", hr: "Emoji", ca: "Emoji",
    bg: "Емотикон", sr: "Емоџи", lt: "Emoji", lv: "Emoji", sl: "Emoji",
    et: "Emoji", gl: "Emoji", af: "Emoji", az: "Emoji", bs: "Emoji",
    mk: "Емоџи", tl: "Emoji", be: "Эмодзі"
  },
  "ui.holdToTalk": {
    es: "Mantén para hablar", fr: "Maintenez pour parler", de: "Zum Sprechen halten",
    it: "Tieni premuto per parlare", pt: "Segure para falar",
    ja: "長押しで話す", ko: "길게 눌러 말하기", zh: "按住说话", ru: "Удерживайте для разговора",
    ar: "اضغط مع الاستمرار للتحدث", hi: "बात करने के लिए दबाए रखें",
    nl: "Ingedrukt houden om te praten", pl: "Przytrzymaj aby mówić", tr: "Konuşmak için basılı tut",
    sv: "Håll för att tala", nb: "Hold for å snakke", da: "Hold for at tale",
    fi: "Pidä puhuaksesi", cs: "Podržte pro mluvení", ro: "Țineți apăsat pentru a vorbi",
    hu: "Tartsa lenyomva a beszédhez", th: "กดค้างเพื่อพูด", vi: "Giữ để nói",
    id: "Tahan untuk berbicara", uk: "Утримуйте для розмови", el: "Κρατήστε πατημένο για ομιλία",
    he: "החזק כדי לדבר", sk: "Podržte pre hovorenie", ms: "Tahan untuk bercakap",
    hr: "Držite za govor", ca: "Mantén per parlar", bg: "Задръжте за говорене",
    sr: "Држите за говор", lt: "Laikykite norėdami kalbėti", lv: "Turiet nospiestu, lai runātu",
    sl: "Držite za govor", et: "Hoidke rääkimiseks", gl: "Manter para falar",
    af: "Hou om te praat", az: "Danışmaq üçün basılı saxla", bs: "Držite za govor",
    mk: "Држете за зборување", tl: "Hawakan para magsalita", be: "Утрымлівайце для размовы"
  },
  "ui.typeMessage": {
    es: "Escribe un mensaje...", fr: "Tapez un message...", de: "Nachricht eingeben...",
    it: "Scrivi un messaggio...", pt: "Digite uma mensagem...",
    ja: "メッセージを入力...", ko: "메시지를 입력...", zh: "输入消息...", ru: "Введите сообщение...",
    ar: "اكتب رسالة...", hi: "एक संदेश लिखें...",
    nl: "Typ een bericht...", pl: "Wpisz wiadomość...", tr: "Mesaj yaz...",
    sv: "Skriv ett meddelande...", nb: "Skriv en melding...", da: "Skriv en besked...",
    fi: "Kirjoita viesti...", cs: "Napište zprávu...", ro: "Scrie un mesaj...",
    hu: "Írjon üzenetet...", th: "พิมพ์ข้อความ...", vi: "Nhập tin nhắn...",
    id: "Ketik pesan...", uk: "Введіть повідомлення...", el: "Πληκτρολογήστε μήνυμα...",
    he: "הקלד הודעה...", sk: "Napíšte správu...", ms: "Taip mesej...",
    hr: "Upišite poruku...", ca: "Escriu un missatge...", bg: "Въведете съобщение...",
    sr: "Унесите поруку...", lt: "Rašykite žinutę...", lv: "Ierakstiet ziņojumu...",
    sl: "Vnesite sporočilo...", et: "Sisestage sõnum...", gl: "Escriba unha mensaxe...",
    af: "Tik 'n boodskap...", az: "Mesaj yazın...", bs: "Upišite poruku...",
    mk: "Напишете порака...", tl: "Mag-type ng mensahe...", be: "Увядзіце паведамленне..."
  },
  "ui.doubleClickPianoRoll": {
    es: "Doble clic para editar piano roll", fr: "Double-cliquez pour éditer le piano roll",
    de: "Doppelklick zum Bearbeiten der Pianorolle", it: "Doppio clic per modificare il piano roll",
    pt: "Clique duplo para editar o piano roll", ja: "ダブルクリックでピアノロール編集",
    ko: "더블클릭하여 피아노 롤 편집", zh: "双击编辑钢琴卷帘", ru: "Двойной клик для редактирования",
    ar: "انقر مزدوجًا لتعديل لوحة البيانو", hi: "पियानो रोल संपादित करने के लिए डबल-क्लिक करें",
    nl: "Dubbelklik om piano roll te bewerken", pl: "Kliknij dwukrotnie aby edytować piano roll",
    tr: "Piano roll düzenlemek için çift tıkla", sv: "Dubbelklicka för att redigera piano roll",
    nb: "Dobbeltklikk for å redigere pianorulle", da: "Dobbeltklik for at redigere piano roll",
    fi: "Kaksoisnapsauta muokataksesi piano rollia", cs: "Dvojklikem upravit piano roll",
    ro: "Dublu clic pentru editare piano roll", hu: "Dupla kattintás a zongorahengerhez",
    th: "ดับเบิลคลิกเพื่อแก้ไข piano roll", vi: "Nhấp đúp để chỉnh sửa piano roll",
    id: "Klik ganda untuk mengedit piano roll", uk: "Двічі клікніть для редагування",
    el: "Διπλό κλικ για επεξεργασία piano roll", he: "לחץ פעמיים לעריכת פסנתר",
    sk: "Dvojklikom upraviť piano roll", ms: "Klik dua kali untuk edit piano roll",
    hr: "Dvaput kliknite za uređivanje", ca: "Feu doble clic per editar el piano roll",
    bg: "Щракнете два пъти за редактиране", sr: "Двоструки клик за уређивање",
    lt: "Dukart spustelėkite norėdami redaguoti", lv: "Veiciet dubultklikšķi, lai rediģētu",
    sl: "Dvokliknite za urejanje", et: "Topeltklõpsake redigeerimiseks",
    gl: "Dobre clic para editar o piano roll", af: "Dubbelklik om piano roll te redigeer",
    az: "Piano roll redaktə etmək üçün iki dəfə klik edin", bs: "Dvaput kliknite za uređivanje",
    mk: "Двоен клик за уредување", tl: "I-double click para i-edit ang piano roll",
    be: "Двайны клік для рэдагавання"
  },
  "ui.quantize": {
    es: "Cuantizar 1/16", fr: "Quantifier 1/16", de: "Quantisieren 1/16",
    it: "Quantizza 1/16", pt: "Quantizar 1/16", ja: "クオンタイズ 1/16", ko: "퀀타이즈 1/16",
    zh: "量化 1/16", ru: "Квантизация 1/16", ar: "تكميم 1/16", hi: "क्वांटाइज़ 1/16",
    nl: "Kwantiseren 1/16", pl: "Kwantyzacja 1/16", tr: "Kuantize 1/16", sv: "Kvantisera 1/16",
    nb: "Kvantiser 1/16", da: "Kvantiser 1/16", fi: "Kvantisoi 1/16", cs: "Kvantizace 1/16",
    ro: "Cuantizare 1/16", hu: "Kvantálás 1/16", th: "ควอนไทซ์ 1/16", vi: "Lượng tử hóa 1/16",
    id: "Kuantisasi 1/16", uk: "Квантизація 1/16", el: "Κβαντοποίηση 1/16", he: "קוונטיזציה 1/16",
    sk: "Kvantizácia 1/16", ms: "Kuantisasi 1/16", hr: "Kvantizacija 1/16", ca: "Quantització 1/16",
    bg: "Квантизация 1/16", sr: "Квантизација 1/16", lt: "Kvantavimas 1/16", lv: "Kvantizēšana 1/16",
    sl: "Kvantizacija 1/16", et: "Kvantiseerimine 1/16", gl: "Cuantizar 1/16",
    af: "Kwantiseer 1/16", az: "Kvantizasiya 1/16", bs: "Kvantizacija 1/16",
    mk: "Квантизација 1/16", tl: "Quantize 1/16", be: "Квантызацыя 1/16"
  },
  "ui.arpeggiate": {
    es: "Arpegio desde acordes", fr: "Arpéger les accords", de: "Arpeggio aus Akkorden",
    it: "Arpeggia dagli accordi", pt: "Arpejar dos acordes", ja: "コードからアルペジオ",
    ko: "코드에서 아르페지오", zh: "从和弦生成琶音", ru: "Арпеджио из аккордов",
    ar: "أربيجيو من الأوتار", hi: "कॉर्ड से अर्पेजिएट",
    nl: "Arpeggio vanuit akkoorden", pl: "Arpeggio z akordów", tr: "Akorlardan arpej",
    sv: "Arpeggio från ackord", nb: "Arpeggio fra akkorder", da: "Arpeggio fra akkorder",
    fi: "Arpeggion soittotiloista", cs: "Arpeggio z akordů", ro: "Arpegiare din acorduri",
    hu: "Arpeggio az akkordokból", th: "อาร์เพจจิโอจากคอร์ด", vi: "Arpeggio từ hợp âm",
    id: "Arpeggio dari akord", uk: "Арпеджіо з акордів", el: "Αρπέζ από ακορντά",
    he: "ארפג'יו מאקורדים", sk: "Arpeggio z akordov", ms: "Arpeggio daripada kord",
    hr: "Arpeggio iz akorda", ca: "Arpegi des dels acords", bg: "Арпежио от акорди",
    sr: "Арпеђо из акорда", lt: "Arpedžio iš akordų", lv: "Arpedžio no akordiem",
    sl: "Arpeggio iz akordov", et: "Arpedžo akordidest", gl: "Arpexo desde acordes",
    af: "Arpeggio van akkoorde", az: "Akkordlardan arpecio", bs: "Arpeggio iz akorda",
    mk: "Арпеџо од акорди", tl: "Arpeggiate mula sa chords", be: "Арпеджыо з акордаў"
  },
  "ui.clickToCopy": {
    es: "Haz clic para copiar", fr: "Cliquez pour copier", de: "Klicken zum Kopieren",
    it: "Clicca per copiare", pt: "Clique para copiar", ja: "クリックしてコピー",
    ko: "클릭하여 복사", zh: "点击复制", ru: "Нажмите для копирования",
    ar: "انقر للنسخ", hi: "कॉपी करने के लिए क्लिक करें",
    nl: "Klik om te kopiëren", pl: "Kliknij aby skopiować", tr: "Kopyalamak için tıkla",
    sv: "Klicka för att kopiera", nb: "Klikk for å kopiere", da: "Klik for at kopiere",
    fi: "Napsauta kopioidaksesi", cs: "Klikněte pro zkopírování", ro: "Click pentru copiere",
    hu: "Kattintson a másoláshoz", th: "คลิกเพื่อคัดลอก", vi: "Nhấp để sao chép",
    id: "Klik untuk menyalin", uk: "Натисніть для копіювання", el: "Κλικ για αντιγραφή",
    he: "לחץ להעתקה", sk: "Kliknite pre skopírovanie", ms: "Klik untuk salin",
    hr: "Kliknite za kopiranje", ca: "Feu clic per copiar", bg: "Щракнете за копиране",
    sr: "Кликните за копирање", lt: "Spustelėkite norėdami kopijuoti", lv: "Noklikšķiniet, lai kopētu",
    sl: "Kliknite za kopiranje", et: "Klõpsake kopeerimiseks", gl: "Prema para copiar",
    af: "Klik om te kopieer", az: "Kopyalamaq üçün klik edin", bs: "Kliknite za kopiranje",
    mk: "Кликнете за копирање", tl: "I-click para kopyahin", be: "Націсніце для капіявання"
  },
  // ── browser.* keys ──
  "browser.searchSamples": {
    es: "Buscar samples...", fr: "Rechercher des samples...", de: "Samples suchen...",
    it: "Cerca sample...", pt: "Buscar amostras...", ja: "サンプルを検索...", ko: "샘플 검색...",
    zh: "搜索采样...", ru: "Поиск сэмплов...", ar: "بحث عن العينات...", hi: "सैंपल खोजें...",
    nl: "Samples zoeken...", pl: "Szukaj sampli...", tr: "Sample ara...", sv: "Sök samples...",
    nb: "Søk samplinger...", da: "Søg samples...", fi: "Etsi sampleja...", cs: "Hledat samply...",
    ro: "Caută mostre...", hu: "Minták keresése...", th: "ค้นหาตัวอย่าง...", vi: "Tìm mẫu...",
    id: "Cari sampel...", uk: "Пошук семплів...", el: "Αναζήτηση δειγμάτων...", he: "חפש דגימות...",
    sk: "Hľadať samply...", ms: "Cari sampel...", hr: "Traži uzorke...", ca: "Cerca mostres...",
    bg: "Търси семпли...", sr: "Претражи семплове...", lt: "Ieškoti pavyzdžių...",
    lv: "Meklēt paraugus...", sl: "Išči vzorce...", et: "Otsi sämpleid...",
    gl: "Buscar mostras...", af: "Soek monsters...", az: "Nümunə axtar...",
    bs: "Traži uzorke...", mk: "Барај семпли...", tl: "Maghanap ng samples...",
    be: "Пошук сэмплаў..."
  },
  "browser.removeFolderConfirm": {
    es: "¿Eliminar esta carpeta y todos sus samples?", fr: "Supprimer ce dossier et tous ses samples ?",
    de: "Diesen Ordner und alle Samples entfernen?", it: "Rimuovere questa cartella e tutti i suoi sample?",
    pt: "Remover esta pasta e todas as amostras?", ja: "このフォルダとすべてのサンプルを削除しますか？",
    ko: "이 폴더와 모든 샘플을 제거하시겠습니까?", zh: "删除此文件夹及其所有采样？",
    ru: "Удалить эту папку и все сэмплы?", ar: "إزالة هذا المجلد وجميع العينات؟",
    hi: "इस फ़ोल्डर और सभी सैंपल को हटाएं?", nl: "Deze map en alle samples verwijderen?",
    pl: "Usunąć ten folder i wszystkie sample?", tr: "Bu klasör ve tüm sample'lar kaldırılsın mı?",
    sv: "Ta bort denna mapp och alla samples?", nb: "Fjerne denne mappen og alle samplinger?",
    da: "Fjern denne mappe og alle samples?", fi: "Poista tämä kansio ja kaikki samplet?",
    cs: "Odstranit tuto složku a všechny samply?", ro: "Ștergeți acest dosar și toate mostrele?",
    hu: "Eltávolítja ezt a mappát és az összes mintát?", th: "ลบโฟลเดอร์นี้และตัวอย่างทั้งหมด?",
    vi: "Xóa thư mục này và tất cả mẫu?", id: "Hapus folder ini dan semua sampel?",
    uk: "Видалити цю папку та всі семпли?", el: "Αφαίρεση αυτού του φακέλου και όλων των δειγμάτων;",
    he: "להסיר תיקייה זו ואת כל הדגימות?", sk: "Odstrániť tento priečinok a všetky samply?",
    ms: "Alih keluar folder ini dan semua sampel?", hr: "Ukloniti ovu mapu i sve uzorke?",
    ca: "Eliminar aquesta carpeta i totes les mostres?", bg: "Премахване на папката и всички семпли?",
    sr: "Уклонити овај фолдер и све семплове?", lt: "Pašalinti šį aplanką ir visus pavyzdžius?",
    lv: "Noņemt šo mapi un visus paraugus?", sl: "Odstrani to mapo in vse vzorce?",
    et: "Eemaldada see kaust ja kõik sämplid?", gl: "Eliminar este cartafol e todas as mostras?",
    af: "Verwyder hierdie gids en alle monsters?", az: "Bu qovluq və bütün nümunələr silinsin?",
    bs: "Ukloniti ovu mapu i sve uzorke?", mk: "Отстрани го фолдерот и сите семпли?",
    tl: "Alisin ang folder na ito at lahat ng samples?", be: "Выдаліць гэтую папку і ўсе сэмплы?"
  },
  "browser.removeFolderLibraryConfirm": {
    es: "¿Eliminar esta carpeta y todos sus samples de la biblioteca?",
    fr: "Supprimer ce dossier et tous ses samples de la bibliothèque ?",
    de: "Diesen Ordner und alle Samples aus der Bibliothek entfernen?",
    it: "Rimuovere questa cartella e tutti i sample dalla libreria?",
    pt: "Remover esta pasta e todas as amostras da biblioteca?",
    ja: "このフォルダとすべてのサンプルをライブラリから削除しますか？",
    ko: "이 폴더와 모든 샘플을 라이브러리에서 제거하시겠습니까?",
    zh: "从库中删除此文件夹及其所有采样？", ru: "Удалить папку и все сэмплы из библиотеки?",
    ar: "إزالة هذا المجلد وجميع عيناته من المكتبة؟",
    hi: "इस फ़ोल्डर और सभी सैंपल को लाइब्रेरी से हटाएं?",
    nl: "Map en samples uit bibliotheek verwijderen?", pl: "Usunąć folder i sample z biblioteki?",
    tr: "Bu klasör ve sample'lar kütüphaneden kaldırılsın mı?",
    sv: "Ta bort mapp och samples från biblioteket?", nb: "Fjerne mappe og samplinger fra biblioteket?",
    da: "Fjern mappe og samples fra biblioteket?", fi: "Poista kansio ja samplet kirjastosta?",
    cs: "Odstranit složku a samply z knihovny?", ro: "Ștergeți dosarul și mostrele din bibliotecă?",
    hu: "Eltávolítja a mappát és mintákat a könyvtárból?",
    th: "ลบโฟลเดอร์และตัวอย่างออกจากไลบรารี?", vi: "Xóa thư mục và mẫu khỏi thư viện?",
    id: "Hapus folder dan sampel dari perpustakaan?", uk: "Видалити папку та семпли з бібліотеки?",
    el: "Αφαίρεση φακέλου και δειγμάτων από τη βιβλιοθήκη;",
    he: "להסיר תיקייה ודגימות מהספרייה?", sk: "Odstrániť priečinok a samply z knižnice?",
    ms: "Alih keluar folder dan sampel dari pustaka?", hr: "Ukloniti mapu i uzorke iz biblioteke?",
    ca: "Eliminar carpeta i mostres de la biblioteca?", bg: "Премахване на папка и семпли от библиотеката?",
    sr: "Уклонити фолдер и семплове из библиотеке?",
    lt: "Pašalinti aplanką ir pavyzdžius iš bibliotekos?",
    lv: "Noņemt mapi un paraugus no bibliotēkas?", sl: "Odstrani mapo in vzorce iz knjižnice?",
    et: "Eemaldada kaust ja sämplid teegist?",
    gl: "Eliminar cartafol e mostras da biblioteca?",
    af: "Verwyder gids en monsters uit biblioteek?",
    az: "Qovluq və nümunələr kitabxanadan silinsin?",
    bs: "Ukloniti mapu i uzorke iz biblioteke?",
    mk: "Отстрани фолдер и семпли од библиотеката?",
    tl: "Alisin ang folder at samples mula sa library?",
    be: "Выдаліць папку і сэмплы з бібліятэкі?"
  },
  "browser.searchPresets": {
    es: "Buscar presets...", fr: "Rechercher des presets...", de: "Presets suchen...",
    it: "Cerca preset...", pt: "Buscar predefinições...", ja: "プリセット検索...",
    ko: "프리셋 검색...", zh: "搜索预设...", ru: "Поиск пресетов...", ar: "بحث عن الإعدادات المسبقة...",
    hi: "प्रीसेट खोजें...", nl: "Presets zoeken...", pl: "Szukaj presetów...",
    tr: "Preset ara...", sv: "Sök presets...", nb: "Søk forhåndsinnstillinger...",
    da: "Søg presets...", fi: "Etsi esiasetuksia...", cs: "Hledat presety...",
    ro: "Caută presetări...", hu: "Beállítások keresése...", th: "ค้นหาพรีเซ็ต...",
    vi: "Tìm preset...", id: "Cari preset...", uk: "Пошук пресетів...",
    el: "Αναζήτηση προεπιλογών...", he: "חפש הגדרות קבועות...",
    sk: "Hľadať presety...", ms: "Cari preset...", hr: "Traži predloške...",
    ca: "Cerca preconfigs...", bg: "Търси пресети...", sr: "Претражи пресете...",
    lt: "Ieškoti nustatymų...", lv: "Meklēt iepriekšnoteikumus...", sl: "Išči prednastavitve...",
    et: "Otsi eelseadeid...", gl: "Buscar preaxustes...", af: "Soek voorafinstellings...",
    az: "Əvvəlcədən ayar axtar...", bs: "Traži predloške...", mk: "Барај пресети...",
    tl: "Maghanap ng presets...", be: "Пошук прэсетаў..."
  },
  "preset.enterName": {
    es: "Ingrese nombre del preset", fr: "Entrez le nom du preset", de: "Preset-Name eingeben",
    it: "Inserisci nome preset", pt: "Digite o nome do preset", ja: "プリセット名を入力",
    ko: "프리셋 이름 입력", zh: "输入预设名称", ru: "Введите имя пресета",
    ar: "أدخل اسم الإعداد المسبق", hi: "प्रीसेट का नाम दर्ज करें",
    nl: "Preset-naam invoeren", pl: "Wpisz nazwę presetu", tr: "Preset adı girin",
    sv: "Ange presetnamn", nb: "Skriv inn presetnavn", da: "Indtast presetnavn",
    fi: "Syötä esiasetuksen nimi", cs: "Zadejte název presetu", ro: "Introduceți numele presetării",
    hu: "Adja meg a beállítás nevét", th: "ป้อนชื่อพรีเซ็ต", vi: "Nhập tên preset",
    id: "Masukkan nama preset", uk: "Введіть назву пресета", el: "Εισάγετε όνομα προεπιλογής",
    he: "הזן שם הגדרה קבועה", sk: "Zadajte názov presetu", ms: "Masukkan nama preset",
    hr: "Unesite naziv predloška", ca: "Introduïu el nom del preset", bg: "Въведете име на пресет",
    sr: "Унесите назив пресета", lt: "Įveskite nustatymo pavadinimą", lv: "Ievadiet iepriekšnoteikuma nosaukumu",
    sl: "Vnesite ime prednastavitve", et: "Sisestage eelseade nimi", gl: "Introduza o nome do preset",
    af: "Voer voorafinstelling-naam in", az: "Əvvəlcədən ayar adını daxil edin",
    bs: "Unesite naziv predloška", mk: "Внесете име на пресет",
    tl: "Ilagay ang pangalan ng preset", be: "Увядзіце назву прэсета"
  },
  "preset.optionalDesc": {
    es: "Descripción opcional", fr: "Description facultative", de: "Optionale Beschreibung",
    it: "Descrizione facoltativa", pt: "Descrição opcional", ja: "説明（任意）",
    ko: "설명 (선택사항)", zh: "可选描述", ru: "Необязательное описание",
    ar: "وصف اختياري", hi: "वैकल्पिक विवरण",
    nl: "Optionele beschrijving", pl: "Opcjonalny opis", tr: "İsteğe bağlı açıklama",
    sv: "Valfri beskrivning", nb: "Valgfri beskrivelse", da: "Valgfri beskrivelse",
    fi: "Valinnainen kuvaus", cs: "Volitelný popis", ro: "Descriere opțională",
    hu: "Opcionális leírás", th: "คำอธิบายเพิ่มเติม", vi: "Mô tả tùy chọn",
    id: "Deskripsi opsional", uk: "Необов'язковий опис", el: "Προαιρετική περιγραφή",
    he: "תיאור אופציונלי", sk: "Voliteľný popis", ms: "Penerangan pilihan",
    hr: "Neobavezan opis", ca: "Descripció opcional", bg: "По избор описание",
    sr: "Опционални опис", lt: "Neprivalomas aprašymas", lv: "Neobligāts apraksts",
    sl: "Neobvezen opis", et: "Valikuline kirjeldus", gl: "Descrición opcional",
    af: "Opsionele beskrywing", az: "İstəyə bağlı açıqlama", bs: "Opcioni opis",
    mk: "Изборен опис", tl: "Opsyonal na paglalarawan", be: "Неабавязковы апісанне"
  },
  "preset.deleteConfirm": {
    es: "¿Estás seguro de que quieres eliminar este preset?",
    fr: "Voulez-vous vraiment supprimer ce preset ?",
    de: "Sind Sie sicher, dass Sie dieses Preset löschen möchten?",
    it: "Sei sicuro di voler eliminare questo preset?",
    pt: "Tem certeza de que deseja excluir este preset?",
    ja: "このプリセットを削除してもよろしいですか？",
    ko: "이 프리셋을 삭제하시겠습니까?",
    zh: "确定要删除此预设吗？", ru: "Вы уверены, что хотите удалить этот пресет?",
    ar: "هل أنت متأكد أنك تريد حذف هذا الإعداد المسبق؟",
    hi: "क्या आप वाकई इस प्रीसेट को हटाना चाहते हैं?",
    nl: "Weet u zeker dat u deze preset wilt verwijderen?",
    pl: "Czy na pewno chcesz usunąć ten preset?",
    tr: "Bu preset'i silmek istediğinize emin misiniz?",
    sv: "Är du säker på att du vill radera denna preset?",
    nb: "Er du sikker på at du vil slette denne forhåndsinnstillingen?",
    da: "Er du sikker på at du vil slette denne preset?",
    fi: "Haluatko varmasti poistaa tämän esiasetuksen?",
    cs: "Opravdu chcete tento preset smazat?", ro: "Sigur doriți să ștergeți această presetare?",
    hu: "Biztosan törölni szeretné ezt a beállítást?",
    th: "คุณแน่ใจหรือว่าต้องการลบพรีเซ็ตนี้?",
    vi: "Bạn có chắc muốn xóa preset này?",
    id: "Yakin ingin menghapus preset ini?",
    uk: "Ви впевнені, що хочете видалити цей пресет?",
    el: "Σίγουρα θέλετε να διαγράψετε αυτή την προεπιλογή;",
    he: "האם אתה בטוח שברצונך למחוק הגדרה קבועה זו?",
    sk: "Naozaj chcete odstrániť tento preset?",
    ms: "Adakah anda pasti mahu memadamkan preset ini?",
    hr: "Jeste li sigurni da želite obrisati ovaj predložak?",
    ca: "Segur que voleu eliminar aquest preset?",
    bg: "Сигурни ли сте, че искате да изтриете този пресет?",
    sr: "Да ли сте сигурни да желите да обришете овај пресет?",
    lt: "Ar tikrai norite ištrinti šį nustatymą?",
    lv: "Vai tiešām vēlaties dzēst šo iepriekšnoteikumu?",
    sl: "Ali ste prepričani, da želite izbrisati to prednastavitev?",
    et: "Kas olete kindel, et soovite selle eelseade kustutada?",
    gl: "Seguro que quere eliminar este preset?",
    af: "Is jy seker jy wil hierdie voorafinstelling uitvee?",
    az: "Bu əvvəlcədən ayarı silmək istədiyinizə əminsiniz?",
    bs: "Jeste li sigurni da želite obrisati ovaj predložak?",
    mk: "Дали сте сигурни дека сакате да го избришете овој пресет?",
    tl: "Sigurado ka bang gusto mong burahin ang preset na ito?",
    be: "Вы ўпэўнены, што хочаце выдаліць гэты прэсет?"
  },
  "preset.loadFailed": {
    es: "Error al cargar preset", fr: "Échec du chargement du preset", de: "Preset konnte nicht geladen werden",
    it: "Caricamento preset fallito", pt: "Falha ao carregar preset", ja: "プリセットの読み込みに失敗",
    ko: "프리셋 로드 실패", zh: "加载预设失败", ru: "Не удалось загрузить пресет",
    ar: "فشل تحميل الإعداد المسبق", hi: "प्रीसेट लोड करने में विफल",
    nl: "Preset laden mislukt", pl: "Nie udało się załadować presetu", tr: "Preset yüklenemedi",
    sv: "Kunde inte ladda preset", nb: "Kunne ikke laste forhåndsinnstilling",
    da: "Kunne ikke indlæse preset", fi: "Esiasetuksen lataus epäonnistui",
    cs: "Nepodařilo se načíst preset", ro: "Încărcare presetare eșuată",
    hu: "A beállítás betöltése sikertelen", th: "โหลดพรีเซ็ตล้มเหลว", vi: "Tải preset thất bại",
    id: "Gagal memuat preset", uk: "Не вдалося завантажити пресет",
    el: "Αποτυχία φόρτωσης προεπιλογής", he: "טעינת הגדרה קבועה נכשלה",
    sk: "Nepodarilo sa načítať preset", ms: "Gagal memuatkan preset",
    hr: "Učitavanje predloška nije uspjelo", ca: "Error en carregar el preset",
    bg: "Неуспешно зареждане на пресет", sr: "Учитавање пресета није успело",
    lt: "Nepavyko įkelti nustatymo", lv: "Neizdevās ielādēt iepriekšnoteikumu",
    sl: "Nalaganje prednastavitve ni uspelo", et: "Eelseade laadimine ebaõnnestus",
    gl: "Erro ao cargar preset", af: "Kon nie voorafinstelling laai nie",
    az: "Əvvəlcədən ayar yüklənə bilmədi", bs: "Učitavanje predloška nije uspjelo",
    mk: "Неуспешно вчитување на пресет", tl: "Hindi na-load ang preset",
    be: "Не ўдалося загрузіць прэсет"
  },
  "preset.deleteFailed": {
    es: "Error al eliminar preset", fr: "Échec de la suppression du preset",
    de: "Preset konnte nicht gelöscht werden", it: "Eliminazione preset fallita",
    pt: "Falha ao excluir preset", ja: "プリセットの削除に失敗", ko: "프리셋 삭제 실패",
    zh: "删除预设失败", ru: "Не удалось удалить пресет", ar: "فشل حذف الإعداد المسبق",
    hi: "प्रीसेट हटाने में विफल", nl: "Preset verwijderen mislukt",
    pl: "Nie udało się usunąć presetu", tr: "Preset silinemedi",
    sv: "Kunde inte radera preset", nb: "Kunne ikke slette forhåndsinnstilling",
    da: "Kunne ikke slette preset", fi: "Esiasetuksen poisto epäonnistui",
    cs: "Nepodařilo se smazat preset", ro: "Ștergere presetare eșuată",
    hu: "A beállítás törlése sikertelen", th: "ลบพรีเซ็ตล้มเหลว", vi: "Xóa preset thất bại",
    id: "Gagal menghapus preset", uk: "Не вдалося видалити пресет",
    el: "Αποτυχία διαγραφής προεπιλογής", he: "מחיקת הגדרה קבועה נכשלה",
    sk: "Nepodarilo sa odstrániť preset", ms: "Gagal memadamkan preset",
    hr: "Brisanje predloška nije uspjelo", ca: "Error en eliminar el preset",
    bg: "Неуспешно изтриване на пресет", sr: "Брисање пресета није успело",
    lt: "Nepavyko ištrinti nustatymo", lv: "Neizdevās dzēst iepriekšnoteikumu",
    sl: "Brisanje prednastavitve ni uspelo", et: "Eelseade kustutamine ebaõnnestus",
    gl: "Erro ao eliminar preset", af: "Kon nie voorafinstelling uitvee nie",
    az: "Əvvəlcədən ayar silinə bilmədi", bs: "Brisanje predloška nije uspjelo",
    mk: "Неуспешно бришење на пресет", tl: "Hindi nabura ang preset",
    be: "Не ўдалося выдаліць прэсет"
  },
  "preset.exportFailed": {
    es: "Error al exportar preset", fr: "Échec de l'export du preset",
    de: "Preset-Export fehlgeschlagen", it: "Esportazione preset fallita",
    pt: "Falha ao exportar preset", ja: "プリセットのエクスポートに失敗", ko: "프리셋 내보내기 실패",
    zh: "导出预设失败", ru: "Не удалось экспортировать пресет", ar: "فشل تصدير الإعداد المسبق",
    hi: "प्रीसेट निर्यात करने में विफल", nl: "Preset exporteren mislukt",
    pl: "Nie udało się wyeksportować presetu", tr: "Preset dışa aktarılamadı",
    sv: "Kunde inte exportera preset", nb: "Kunne ikke eksportere forhåndsinnstilling",
    da: "Kunne ikke eksportere preset", fi: "Esiasetuksen vienti epäonnistui",
    cs: "Nepodařilo se exportovat preset", ro: "Export presetare eșuat",
    hu: "A beállítás exportálása sikertelen", th: "ส่งออกพรีเซ็ตล้มเหลว",
    vi: "Xuất preset thất bại", id: "Gagal mengekspor preset",
    uk: "Не вдалося експортувати пресет", el: "Αποτυχία εξαγωγής προεπιλογής",
    he: "ייצוא הגדרה קבועה נכשל", sk: "Nepodarilo sa exportovať preset",
    ms: "Gagal mengeksport preset", hr: "Izvoz predloška nije uspio",
    ca: "Error en exportar el preset", bg: "Неуспешен експорт на пресет",
    sr: "Извоз пресета није успео", lt: "Nepavyko eksportuoti nustatymo",
    lv: "Neizdevās eksportēt iepriekšnoteikumu", sl: "Izvoz prednastavitve ni uspel",
    et: "Eelseade eksport ebaõnnestus", gl: "Erro ao exportar preset",
    af: "Kon nie voorafinstelling uitvoer nie", az: "Əvvəlcədən ayar ixrac edilə bilmədi",
    bs: "Izvoz predloška nije uspio", mk: "Неуспешен извоз на пресет",
    tl: "Hindi na-export ang preset", be: "Не ўдалося экспартаваць прэсет"
  },
  "preset.importSuccess": {
    es: "¡Preset importado con éxito!", fr: "Preset importé avec succès !",
    de: "Preset erfolgreich importiert!", it: "Preset importato con successo!",
    pt: "Preset importado com sucesso!", ja: "プリセットのインポートに成功！",
    ko: "프리셋을 성공적으로 가져왔습니다!", zh: "预设导入成功！",
    ru: "Пресет успешно импортирован!", ar: "تم استيراد الإعداد المسبق بنجاح!",
    hi: "प्रीसेट सफलतापूर्वक आयात किया गया!", nl: "Preset succesvol geïmporteerd!",
    pl: "Preset zaimportowany pomyślnie!", tr: "Preset başarıyla içe aktarıldı!",
    sv: "Preset importerad!", nb: "Forhåndsinnstilling importert!",
    da: "Preset importeret!", fi: "Esiasetus tuotu onnistuneesti!",
    cs: "Preset úspěšně importován!", ro: "Presetare importată cu succes!",
    hu: "Beállítás sikeresen importálva!", th: "นำเข้าพรีเซ็ตสำเร็จ!",
    vi: "Nhập preset thành công!", id: "Preset berhasil diimpor!",
    uk: "Пресет успішно імпортовано!", el: "Η προεπιλογή εισήχθη επιτυχώς!",
    he: "הגדרה קבועה יובאה בהצלחה!", sk: "Preset úspešne importovaný!",
    ms: "Preset berjaya diimport!", hr: "Predložak uspješno uvezen!",
    ca: "Preset importat amb èxit!", bg: "Пресетът е импортиран успешно!",
    sr: "Пресет успешно увезен!", lt: "Nustatymas sėkmingai importuotas!",
    lv: "Iepriekšnoteikums veiksmīgi importēts!", sl: "Prednastavitev uspešno uvožena!",
    et: "Eelseade edukalt imporditud!", gl: "Preset importado con éxito!",
    af: "Voorafinstelling suksesvol ingevoer!", az: "Əvvəlcədən ayar uğurla idxal edildi!",
    bs: "Predložak uspješno uvezen!", mk: "Пресетот е успешно увезен!",
    tl: "Matagumpay na na-import ang preset!", be: "Прэсет паспяхова імпартаваны!"
  }
};

// ─── Apply translations to each locale file ───

const localeCodes = Object.keys(newKeyTranslations["ui.minimize"]);

for (const langCode of localeCodes) {
  const filePath = path.join(localesDir, `${langCode}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`Locale file not found: ${langCode}.json — skipping`);
    continue;
  }

  const locale = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let added = 0;

  for (const [key, translations] of Object.entries(newKeyTranslations)) {
    if (!locale[key] && translations[langCode]) {
      locale[key] = translations[langCode];
      added++;
    }
  }

  if (added > 0) {
    fs.writeFileSync(filePath, JSON.stringify(locale, null, 2) + '\n', 'utf8');
    console.log(`${langCode}: added ${added} new keys`);
  } else {
    console.log(`${langCode}: all keys present`);
  }
}

// ─── Report missing keys across all locales ───

console.log('\n--- Missing key audit ---');
for (const langCode of localeCodes) {
  const filePath = path.join(localesDir, `${langCode}.json`);
  if (!fs.existsSync(filePath)) continue;

  const locale = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const missing = enKeys.filter(k => !locale[k]);

  if (missing.length > 0) {
    console.log(`${langCode}: ${missing.length} keys missing from en.json master`);
  }
}

console.log('\nDone!');
