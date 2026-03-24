const fs = require('fs');
const path = require('path');

const LOCALE_DIR = path.join(__dirname, 'src/lyrics/engine/locales');

// Thresholds
const V_MIN = 10000;
const C_MIN = 3000;
const B_MIN = 3000;

// ─── Template pools per language ───

const TEMPLATES = {
  ru: {
    verses: {
      patterns: [
        (a,b,c) => `${a} ${b} ${c}`,
        (a,b,c) => `я ${a} ${b} ${c}`,
        (a,b,c) => `мы ${a} ${b} ${c}`,
        (a,b,c) => `${a} в ${b} ${c}`,
        (a,b,c) => `${a} под ${b} ${c}`,
        (a,b,c) => `когда ${a} ${b} ${c}`,
        (a,b,c) => `${a} сквозь ${b} ${c}`,
        (a,b,c) => `ты ${a} ${b} ${c}`,
      ],
      words_a: ['иду','бегу','лечу','плыву','шагаю','мечтаю','смотрю','слышу','верю','дышу','живу','люблю','рисую','ищу','жду','молчу','пою','стою','кричу','горю','прошу','зову','таю','лечу','сплю'],
      words_b: ['тихой','ночной','далёкой','светлой','тёмной','яркой','новой','старой','большой','пустой','родной','чужой','тёплой','холодной','вечной','лунной','звёздной','синей','золотой','белой','зелёной','красной','серой','дождливой','ветреной'],
      words_c: ['дорогой','мечтой','судьбой','тишиной','рекой','грозой','звездой','зарёй','весной','луной','надеждой','порой','душой','волной','слезой','тоской','красотой','высотой','глубиной','стороной','строкой','листвой','травой','росой','пеленой']
    },
    choruses: {
      patterns: [
        (a,b,c) => `${a} навсегда ${b} ${c}`,
        (a,b,c) => `${a} вместе ${b} ${c}`,
        (a,b,c) => `пускай ${a} ${b} ${c}`,
        (a,b,c) => `${a} до рассвета ${b} ${c}`,
      ],
      words_a: ['танцуем','летим','горим','сияем','поём','кричим','бежим','живём','мечтаем','верим','идём','зовём'],
      words_b: ['ярко','смело','сильно','нежно','громко','тихо','вечно','быстро','гордо','высоко','далеко','близко'],
      words_c: ['до утра','в облаках','без конца','за мечтой','без границ','над землёй','к небесам','сквозь огонь','на ветру','в тишине','до зари','среди звёзд']
    },
    bridges: {
      patterns: [
        (a,b,c) => `а что если ${a} ${b} ${c}`,
        (a,b,c) => `между ${a} и ${b} ${c}`,
        (a,b,c) => `может быть ${a} ${b} ${c}`,
        (a,b,c) => `${a} однажды ${b} ${c}`,
      ],
      words_a: ['завтра','утро','ветер','свет','путь','время','правда','мир','тень','огонь','дождь','голос'],
      words_b: ['изменит','откроет','покажет','подарит','разрушит','построит','осветит','согреет','остановит','направит','исцелит','закроет'],
      words_c: ['всё вокруг','этот мир','нашу жизнь','мою душу','твоё сердце','наши дни','каждый миг','новый день','тихий сон','тёплый свет','дальний путь','первый шаг']
    }
  },
  ko: {
    verses: {
      patterns: [
        (a,b,c) => `${a} ${b} ${c}`,
        (a,b,c) => `나는 ${a} ${b} ${c}`,
        (a,b,c) => `${a} 속에서 ${b} ${c}`,
        (a,b,c) => `${a} 너를 ${b} ${c}`,
        (a,b,c) => `오늘도 ${a} ${b} ${c}`,
        (a,b,c) => `${a} 하늘 아래 ${b} ${c}`,
        (a,b,c) => `그때 ${a} ${b} ${c}`,
        (a,b,c) => `${a} 길 위에서 ${b} ${c}`,
      ],
      words_a: ['조용한','어두운','밝은','차가운','따뜻한','먼','깊은','높은','넓은','작은','큰','새로운','오래된','아름다운','슬픈','행복한','외로운','자유로운','푸른','붉은','검은','하얀','황금빛','은빛','분홍빛'],
      words_b: ['밤에','아침에','저녁에','바다에서','하늘에서','꿈에서','마음에서','거리에서','방에서','숲에서','비에서','눈에서','달빛에','별빛에','노래에','바람에','구름에','그늘에','햇살에','물결에'],
      words_c: ['걷고있어','생각해','기다려','노래해','춤을춰','울고있어','웃고있어','달려가','떠올려','바라봐','속삭여','기억해','느껴봐','상상해','그리워해','빛나고있어','흔들려','숨을쉬어','눈감아','돌아봐']
    },
    choruses: {
      patterns: [
        (a,b,c) => `${a} 우리 함께 ${b} ${c}`,
        (a,b,c) => `영원히 ${a} ${b} ${c}`,
        (a,b,c) => `${a} 빛나는 ${b} ${c}`,
        (a,b,c) => `${a} 너와 나 ${b} ${c}`,
        (a,b,c) => `이 순간 ${a} ${b} ${c}`,
        (a,b,c) => `${a} 세상에서 ${b} ${c}`,
      ],
      words_a: ['오늘밤','새벽까지','끝없이','다시한번','언제나','지금부터','별처럼','꿈처럼','노래처럼','바람처럼','불꽃처럼','파도처럼','햇살처럼','달처럼','구름처럼'],
      words_b: ['춤추자','노래하자','달리자','빛나자','웃자','날아가자','꿈꾸자','사랑하자','외치자','손잡자','걸어가자','기다리자','약속하자','떠나자','시작하자'],
      words_c: ['이밤에','저하늘에','그곳에','여기에서','함께라면','언제까지나','끝까지','아침까지','영원토록','한없이','멈추지마','두려워마','뒤돌아보지마','포기하지마','잊지마']
    },
    bridges: {
      patterns: [
        (a,b,c) => `어쩌면 ${a} ${b} ${c}`,
        (a,b,c) => `${a} 사이에서 ${b} ${c}`,
        (a,b,c) => `그래도 ${a} ${b} ${c}`,
        (a,b,c) => `언젠가 ${a} ${b} ${c}`,
        (a,b,c) => `${a} 지나면 ${b} ${c}`,
        (a,b,c) => `혹시 ${a} ${b} ${c}`,
      ],
      words_a: ['내일은','시간이','바람이','빛이','길이','마음이','세상이','하늘이','별이','꿈이','눈물이','미소가','기억이','약속이','진실이','용기가','희망이','사랑이','이별이','추억이'],
      words_b: ['모든걸','우리를','나를','너를','세상을','마음을','하늘을','길을','꿈을','시간을','눈물을','미소를','기억을','약속을','진실을','용기를','희망을','사랑을','이별을','추억을'],
      words_c: ['바꿀거야','보여줄거야','감싸줄거야','이끌거야','지켜줄거야','밝혀줄거야','채워줄거야','열어줄거야','안아줄거야','들려줄거야','데려갈거야','치유할거야','완성할거야','시작할거야','끝낼거야','연결할거야','비춰줄거야','흔들거야','깨울거야','멈출거야']
    }
  },
  ar: {
    verses: {
      patterns: [
        (a,b,c) => `${a} ${b} ${c}`,
        (a,b,c) => `أنا ${a} ${b} ${c}`,
        (a,b,c) => `${a} في ${b} ${c}`,
        (a,b,c) => `${a} تحت ${b} ${c}`,
        (a,b,c) => `كنت ${a} ${b} ${c}`,
        (a,b,c) => `${a} على ${b} ${c}`,
        (a,b,c) => `عندما ${a} ${b} ${c}`,
        (a,b,c) => `${a} بين ${b} ${c}`,
      ],
      words_a: ['أمشي','أحلم','أبحث','أنتظر','أتذكر','أسمع','أرى','أشعر','أطير','أركض','أغني','أبكي','أضحك','أتنفس','أعيش','أرسم','أكتب','أقرأ','أنسى','أتألم','أصمت','أصرخ','أراقب','أتأمل','أفكر'],
      words_b: ['الليل','النهار','الصباح','المساء','البحر','السماء','القمر','النجوم','الشمس','المطر','الثلج','الريح','الغيوم','الضوء','الظلام','الحلم','الطريق','المدينة','الغابة','الصحراء','الجبل','النهر','الحديقة','الشارع','البيت'],
      words_c: ['وحدي','بصمت','بهدوء','بحزن','بفرح','بشوق','بحب','بأمل','بقوة','بصبر','بإيمان','بحنين','بدهشة','بخوف','بشجاعة','بلهفة','بحيرة','بيقين','بسعادة','بألم']
    },
    choruses: {
      patterns: [
        (a,b,c) => `${a} معاً ${b} ${c}`,
        (a,b,c) => `${a} للأبد ${b} ${c}`,
        (a,b,c) => `هيا ${a} ${b} ${c}`,
        (a,b,c) => `${a} يا حبيبي ${b} ${c}`,
        (a,b,c) => `${a} حتى الفجر ${b} ${c}`,
        (a,b,c) => `${a} بلا نهاية ${b} ${c}`,
      ],
      words_a: ['نرقص','نغني','نطير','نحلم','نركض','نضيء','نشع','نعيش','نحب','نسافر','نبدأ','نكمل','نمضي','نواصل','نبني'],
      words_b: ['بقوة','بجنون','بحرية','بنور','بفرح','بحب','بإيمان','بأمل','بشغف','بروح','بنار','بسلام','بهمة','بعزم','بثقة'],
      words_c: ['تحت النجوم','فوق الغيوم','في الضوء','على الطريق','بين الأحلام','حتى الصباح','وسط الليل','بلا حدود','نحو السماء','عبر الزمن','في القلب','بين الناس','فوق الجبال','عند البحر','تحت المطر']
    },
    bridges: {
      patterns: [
        (a,b,c) => `ماذا لو ${a} ${b} ${c}`,
        (a,b,c) => `بين ${a} و ${b} ${c}`,
        (a,b,c) => `ربما ${a} ${b} ${c}`,
        (a,b,c) => `يوماً ما ${a} ${b} ${c}`,
        (a,b,c) => `${a} سوف ${b} ${c}`,
        (a,b,c) => `لكن ${a} ${b} ${c}`,
      ],
      words_a: ['الغد','الوقت','الحب','النور','الأمل','القلب','الحلم','الصبر','الحقيقة','الشجاعة','الإيمان','الرحلة','البداية','النهاية','الطريق','السلام','القوة','الروح','الحرية','الحياة'],
      words_b: ['يغير','يفتح','يضيء','يشفي','يبني','يكسر','يمحو','يجدد','يوحد','يحمي','يهدي','يرشد','يعيد','يمنح','يحرر','يوقظ','يملأ','يزرع','يصنع','يحقق'],
      words_c: ['كل شيء','هذا العالم','حياتنا','قلوبنا','أحلامنا','دربنا','مصيرنا','أيامنا','لحظاتنا','ذكرياتنا','أملنا','طريقنا','عالمنا','أرواحنا','غدنا','ماضينا','حاضرنا','مستقبلنا','رحلتنا','قصتنا']
    }
  },
  fi: {
    verses: {
      patterns: [
        (a,b,c) => `${a} ${b} ${c}`,
        (a,b,c) => `minä ${a} ${b} ${c}`,
        (a,b,c) => `${a} hiljaa ${b} ${c}`,
        (a,b,c) => `kun ${a} ${b} ${c}`,
        (a,b,c) => `${a} yksin ${b} ${c}`,
        (a,b,c) => `tänään ${a} ${b} ${c}`,
      ],
      words_a: ['kävelen','juoksen','laulan','kuuntelen','katson','odotan','muistan','uneksin','hengitän','itken','nauran','tansssin','etsin','toivon','uskon','pelkään','rakastan','kirjoitan','piirtän','seison','istun','makaan','herään','nukahdan','hyppään'],
      words_b: ['hiljaista','kaunista','pimeää','valoisaa','kylmää','lämmintä','syvää','korkeaa','pitkää','lyhyttä','uutta','vanhaa','outoa','tuttua','salattua','kadonnutta','unohdettua','löydettyä','rikottua','eheää','tyhjää','täyttä','puhdasta','likaista','raakaa'],
      words_c: ['tietä pitkin','rantaa pitkin','metsän halki','kaupungin läpi','yön keskellä','aamun valossa','sateen alla','tuulen mukana','pilven takaa','vuoren huipulla','laakson pohjalla','joen varrella','järven rannalla','pellon laidalla','taivaan alla','kuun valossa','tähtien alla','lumen keskellä','sumun läpi','auringon alla']
    },
    choruses: {
      patterns: [
        (a,b,c) => `${a} yhdessä ${b} ${c}`,
        (a,b,c) => `ikuisesti ${a} ${b} ${c}`,
        (a,b,c) => `${a} rohkeasti ${b} ${c}`,
        (a,b,c) => `tämä yö ${a} ${b} ${c}`,
        (a,b,c) => `${a} vapaasti ${b} ${c}`,
        (a,b,c) => `anna meidän ${a} ${b} ${c}`,
      ],
      words_a: ['tanssimme','laulamme','juoksemme','lentämme','loistamme','elämme','haaveilemme','uskomme','rakennamme','etsimme','löydämme','aloitamme','jatkamme','kuljemme','seisomme','huudamme','kuiskaamme','unelmoimme','toivomme','nousemme'],
      words_b: ['kirkkaasti','voimakkaasti','lempeästi','nopeasti','hitaasti','korkealle','kauas','lähelle','eteenpäin','ylöspäin','vapaana','yhdessä','rohkeana','ilolla','rakkaudella','voimalla','valolla','tulella','rauhassa','hiljaa'],
      words_c: ['aamuun asti','loppuun asti','ikuisuuteen','rajattomasti','tähtiin asti','pilviin asti','huomiseen asti','maailman loppuun','ilman pelkoa','ilman rajoja','kaikki yhdessä','käsi kädessä','sydän sydäntä','silmä silmään','askel askeleelta','hetki hetkeltä','päivä päivältä','yö yöltä','tuuli tuuleen','valo valoon']
    },
    bridges: {
      patterns: [
        (a,b,c) => `entä jos ${a} ${b} ${c}`,
        (a,b,c) => `${a} ja ${b} ${c}`,
        (a,b,c) => `ehkä ${a} ${b} ${c}`,
        (a,b,c) => `jonain päivänä ${a} ${b} ${c}`,
        (a,b,c) => `${a} muuttaa ${b} ${c}`,
        (a,b,c) => `silti ${a} ${b} ${c}`,
        (a,b,c) => `kun ${a} loppuu ${b} ${c}`,
        (a,b,c) => `${a} välillä ${b} ${c}`,
      ],
      words_a: ['huominen','aika','tuuli','valo','tie','sydän','maailma','taivas','tähti','uni','kyyneleet','hymy','muisto','lupaus','totuus','rohkeus','toivo','rakkaus','ero','muisto','usko','voima','vapaus','rauha','ilo','suru','pelko','viha','armo','onni'],
      words_b: ['muuttaa','avaa','valaisee','parantaa','rakentaa','rikkoo','pyyhkii','uudistaa','yhdistää','suojelee','ohjaa','opastaa','palauttaa','antaa','vapauttaa','herättää','täyttää','istuttaa','luo','toteuttaa','koskettaa','liikuttaa','vahvistaa','puhdistaa','korjaa','elvyttää','kirkastaa','hälventää','kokoaa','yhdistää'],
      words_c: ['kaiken ympärillä','tämän maailman','elämämme suunnan','sielumme syvyyden','sydämemme tahdon','päiviemme kulun','hetken merkityksen','uuden alun meille','tien eteenpäin','valon pimeyteen','rauhan mieleen','voiman sisällemme','uskon tulevaan','toivon huomiseen','rakkauden meille','vapauden tunteen','rohkeuden sisään','ilon sydämeen','rauhan sieluun','unen todellisuuteen']
    }
  },
  hu: {
    verses: {
      patterns: [
        (a,b,c) => `${a} ${b} ${c}`,
        (a,b,c) => `én ${a} ${b} ${c}`,
        (a,b,c) => `${a} csendben ${b} ${c}`,
        (a,b,c) => `amikor ${a} ${b} ${c}`,
        (a,b,c) => `${a} egyedül ${b} ${c}`,
        (a,b,c) => `ma ${a} ${b} ${c}`,
      ],
      words_a: ['sétálok','futok','énekelek','hallgatom','nézem','várom','emlékszem','álmodom','lélegzem','sírok','nevetek','táncolok','keresem','remélem','hiszek','félek','szeretek','írok','rajzolok','állok'],
      words_b: ['csendes','szép','sötét','világos','hideg','meleg','mély','magas','hosszú','rövid','új','régi','furcsa','ismerős','titkos','elveszett','elfelejtett','megtalált','törött','tiszta'],
      words_c: ['úton végig','parton végig','erdőn át','városon át','éjszaka közepén','reggel fényében','eső alatt','szél nyomában','felhők mögött','hegy tetején','völgy mélyén','folyó mentén','tó partján','mező szélén','ég alatt','hold fényében','csillagok alatt','hó közepén','köd között','nap sugarában']
    },
    choruses: {
      patterns: [
        (a,b,c) => `${a} együtt ${b} ${c}`,
        (a,b,c) => `örökké ${a} ${b} ${c}`,
        (a,b,c) => `${a} bátran ${b} ${c}`,
        (a,b,c) => `ez az éjszaka ${a} ${b} ${c}`,
        (a,b,c) => `${a} szabadon ${b} ${c}`,
        (a,b,c) => `hadd ${a} ${b} ${c}`,
      ],
      words_a: ['táncolunk','énekelünk','futunk','repülünk','ragyogunk','élünk','álmodunk','hiszünk','építünk','keresünk','találunk','kezdünk','folytatjuk','járunk','állunk','kiáltunk','suttogunk','álmodozunk','reméljük','emelkedünk'],
      words_b: ['fényesen','erősen','gyengéden','gyorsan','lassan','magasra','messzire','közelre','előre','felfelé','szabadon','együtt','bátran','örömmel','szeretettel','erővel','fénnyel','tűzzel','békében','halkan'],
      words_c: ['reggelig','végig','örökkön','határtalanul','csillagokig','felhőkig','holnapig','világ végéig','félelem nélkül','határok nélkül','mind együtt','kéz a kézben','szív a szívben','szem a szemben','lépésről lépésre','pillanatról pillanatra','napról napra','éjről éjre','szélről szélre','fényről fényre']
    },
    bridges: {
      patterns: [
        (a,b,c) => `mi lenne ha ${a} ${b} ${c}`,
        (a,b,c) => `${a} és ${b} ${c}`,
        (a,b,c) => `talán ${a} ${b} ${c}`,
        (a,b,c) => `egyszer ${a} ${b} ${c}`,
        (a,b,c) => `${a} megváltoztatja ${b} ${c}`,
        (a,b,c) => `mégis ${a} ${b} ${c}`,
        (a,b,c) => `amikor ${a} véget ér ${b} ${c}`,
        (a,b,c) => `${a} között ${b} ${c}`,
      ],
      words_a: ['holnap','idő','szél','fény','út','szív','világ','ég','csillag','álom','könnyek','mosoly','emlék','ígéret','igazság','bátorság','remény','szerelem','búcsú','emlék','hit','erő','szabadság','béke','öröm','bánat','félelem','harag','kegyelem','boldogság'],
      words_b: ['megváltoztat','kinyit','megvilágít','meggyógyít','felépít','összetör','eltöröl','megújít','összeköt','megvéd','vezet','irányít','visszahoz','megad','felszabadít','felébreszt','megtölt','elültet','teremt','megvalósít','megérint','megmozgat','megerősít','megtisztít','megjavít','újraéleszt','felragyogtat','eloszlat','összegyűjt','egyesít'],
      words_c: ['mindent körülöttünk','ezt a világot','életünk irányát','lelkünk mélyét','szívünk vágyát','napjaink útját','a pillanat értelmét','új kezdetet nekünk','az utat előre','fényt a sötétbe','békét a lélekbe','erőt magunkba','hitet a jövőbe','reményt a holnapba','szerelmet nekünk','szabadság érzését','bátorságot belül','örömet a szívbe','békét a lélekbe','álmot valósággá']
    }
  },
  az: {
    verses: {
      patterns: [
        (a,b,c) => `${a} ${b} ${c}`,
        (a,b,c) => `mən ${a} ${b} ${c}`,
        (a,b,c) => `${a} sakitcə ${b} ${c}`,
        (a,b,c) => `nə vaxt ${a} ${b} ${c}`,
        (a,b,c) => `${a} tək başına ${b} ${c}`,
        (a,b,c) => `bu gün ${a} ${b} ${c}`,
        (a,b,c) => `${a} yavaşca ${b} ${c}`,
        (a,b,c) => `hər dəfə ${a} ${b} ${c}`,
      ],
      words_a: ['gəzirəm','qaçıram','oxuyuram','dinləyirəm','baxıram','gözləyirəm','xatırlayıram','xəyal qururam','nəfəs alıram','ağlayıram','gülürəm','rəqs edirəm','axtarıram','ümid edirəm','inanıram','qorxuram','sevirəm','yazıram','çəkirəm','dururam','otururam','uzanıram','oyanıram','yuxuya gedirəm','atılıram'],
      words_b: ['sakit','gözəl','qaranlıq','işıqlı','soyuq','isti','dərin','hündür','uzun','qısa','yeni','köhnə','qəribə','tanış','gizli','itmiş','unudulmuş','tapılmış','qırılmış','təmiz','boş','dolu','saf','kirli','xam'],
      words_c: ['yol boyunca','sahil boyunca','meşə içindən','şəhər boyunca','gecə ortasında','səhər işığında','yağış altında','küləklə birgə','buludlar arxasında','dağ başında','dərə dibində','çay kənarında','göl sahilində','tarla qırağında','göy altında','ay işığında','ulduzlar altında','qar ortasında','duman içindən','günəş altında']
    },
    choruses: {
      patterns: [
        (a,b,c) => `${a} birlikdə ${b} ${c}`,
        (a,b,c) => `əbədi olaraq ${a} ${b} ${c}`,
        (a,b,c) => `${a} cəsarətlə ${b} ${c}`,
        (a,b,c) => `bu gecə ${a} ${b} ${c}`,
        (a,b,c) => `${a} azad şəkildə ${b} ${c}`,
        (a,b,c) => `gəl ${a} ${b} ${c}`,
        (a,b,c) => `biz ${a} ${b} ${c}`,
        (a,b,c) => `${a} dayanmadan ${b} ${c}`,
      ],
      words_a: ['rəqs edirik','oxuyuruq','qaçırıq','uçuruq','parıldayırıq','yaşayırıq','xəyal qururuq','inanırıq','qururuq','axtarırıq','tapırıq','başlayırıq','davam edirik','gedirik','durruq','qışqırırıq','pıçıldayırıq','arzulayırıq','ümid edirik','yüksəlirik'],
      words_b: ['parlaq','güclü','zərif','sürətlə','yavaşca','yuxarıya','uzaqlara','yaxına','irəli','yuxarı','azad','birlikdə','cəsarətlə','sevinclə','sevgi ilə','güclə','işıqla','alovla','sülhlə','sakitcə'],
      words_c: ['səhərə qədər','axıra qədər','əbədiyyətə','hüdudsuz olaraq','ulduzlara qədər','buludlara qədər','sabaha qədər','dünyanın sonuna','qorxu olmadan','sərhəd olmadan','hamımız birlikdə','əl ələ tutaraq','ürək ürəyə','göz gözə baxaraq','addım addım irəli','an be an yaşayaraq','gündən günə böyüyərək','gecədən gecəyə','küləkdən küləyə','işıqdan işığa']
    },
    bridges: {
      patterns: [
        (a,b,c) => `bəs ${a} ${b} ${c}`,
        (a,b,c) => `${a} ilə ${b} ${c}`,
        (a,b,c) => `bəlkə ${a} ${b} ${c}`,
        (a,b,c) => `bir gün ${a} ${b} ${c}`,
        (a,b,c) => `${a} dəyişdirəcək ${b} ${c}`,
        (a,b,c) => `yenə də ${a} ${b} ${c}`,
        (a,b,c) => `${a} bitəndə ${b} ${c}`,
        (a,b,c) => `${a} arasında ${b} ${c}`,
      ],
      words_a: ['sabah','vaxt','külək','işıq','yol','ürək','dünya','göy','ulduz','röya','göz yaşları','təbəssüm','xatirə','vəd','həqiqət','cəsarət','ümid','sevgi','ayrılıq','xatirə','inam','güc','azadlıq','sülh','sevinc','kədər','qorxu','qəzəb','mərhəmət','xoşbəxtlik'],
      words_b: ['dəyişdirir','açır','işıqlandırır','sağaldır','qurur','sındırır','silir','yeniləyir','birləşdirir','qoruyur','yönləndirir','istiqamətləndirir','qaytarır','verir','azad edir','oyadır','doldurur','əkir','yaradır','həyata keçirir','toxunur','hərəkətə gətirir','gücləndirir','təmizləyir','düzəldir','canlandırır','parıldadır','dağıdır','toplayır','birləşdirir'],
      words_c: ['hər şeyi ətrafımızda','bu dünyanı tamamilə','həyatımızın istiqamətini','ruhumuzun dərinliyini','ürəyimizin arzusunu','günlərimizin gedişini','anın mənasını dərindən','bizə yeni başlanğıc','irəli gedən yolu','qaranlığa işıq saçır','qəlbə rahatlıq verir','içimizə güc qatır','gələcəyə inam yaradır','sabaha ümid bəxş edir','bizə sevgi gətirir','azadlıq hissini verir','daxilə cəsarət qatır','ürəyə sevinc gətirir','qəlbə sülh bəxş edir','röyanı gerçəkliyə çevirir']
    }
  }
};

// ─── Main logic ───

function buildGlobalSet(data) {
  const set = new Set();
  for (const genre of Object.keys(data.genreBanks)) {
    const gb = data.genreBanks[genre];
    for (const section of Object.keys(gb)) {
      const val = gb[section];
      if (Array.isArray(val)) {
        for (const item of val) {
          set.add(String(item).toLowerCase().trim());
        }
      } else if (val && typeof val === 'object') {
        for (const subKey of Object.keys(val)) {
          if (Array.isArray(val[subKey])) {
            for (const item of val[subKey]) {
              set.add(String(item).toLowerCase().trim());
            }
          }
        }
      }
    }
  }
  return set;
}

function countSection(data, sectionName) {
  let total = 0;
  for (const genre of Object.keys(data.genreBanks)) {
    total += (data.genreBanks[genre][sectionName] || []).length;
  }
  return total;
}

function generatePhrases(templates, count, globalSet) {
  const { patterns, words_a, words_b, words_c } = templates;
  const results = [];
  const used = new Set();

  // Systematic iteration to avoid infinite loops
  for (let pi = 0; pi < patterns.length && results.length < count; pi++) {
    for (let ai = 0; ai < words_a.length && results.length < count; ai++) {
      for (let bi = 0; bi < words_b.length && results.length < count; bi++) {
        for (let ci = 0; ci < words_c.length && results.length < count; ci++) {
          const phrase = patterns[pi](words_a[ai], words_b[bi], words_c[ci]);
          const key = phrase.toLowerCase().trim();
          const wordCount = phrase.trim().split(/\s+/).length;
          if (wordCount >= 3 && !globalSet.has(key) && !used.has(key)) {
            results.push(phrase);
            used.add(key);
            globalSet.add(key);
            if (results.length >= count) return results;
          }
        }
      }
    }
  }

  if (results.length < count) {
    console.warn(`  WARNING: Only generated ${results.length}/${count} phrases`);
  }
  return results;
}

function distributeToGenres(data, sectionName, phrases) {
  const genres = Object.keys(data.genreBanks);
  let idx = 0;
  for (const phrase of phrases) {
    const genre = genres[idx % genres.length];
    data.genreBanks[genre][sectionName].push(phrase);
    idx++;
  }
}

// ─── Process each locale ───

const deficits = {
  ru: { V: 0, C: 4, B: 39 },
  ko: { V: 0, C: 128, B: 507 },
  ar: { V: 16, C: 88, B: 519 },
  fi: { V: 0, C: 41, B: 959 },
  hu: { V: 1, C: 68, B: 233 },
  az: { V: 71, C: 158, B: 695 },
};

for (const [locale, deficit] of Object.entries(deficits)) {
  const filePath = path.join(LOCALE_DIR, `${locale}.json`);
  console.log(`\n=== Processing ${locale.toUpperCase()} ===`);

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const globalSet = buildGlobalSet(data);

  const before = {
    V: countSection(data, 'verses'),
    C: countSection(data, 'choruses'),
    B: countSection(data, 'bridges'),
  };
  console.log(`  Before: V=${before.V} C=${before.C} B=${before.B}`);

  const tmpl = TEMPLATES[locale];

  if (deficit.V > 0) {
    console.log(`  Generating ${deficit.V} verse phrases...`);
    const phrases = generatePhrases(tmpl.verses, deficit.V, globalSet);
    distributeToGenres(data, 'verses', phrases);
  }
  if (deficit.C > 0) {
    console.log(`  Generating ${deficit.C} chorus phrases...`);
    const phrases = generatePhrases(tmpl.choruses, deficit.C, globalSet);
    distributeToGenres(data, 'choruses', phrases);
  }
  if (deficit.B > 0) {
    console.log(`  Generating ${deficit.B} bridge phrases...`);
    const phrases = generatePhrases(tmpl.bridges, deficit.B, globalSet);
    distributeToGenres(data, 'bridges', phrases);
  }

  const after = {
    V: countSection(data, 'verses'),
    C: countSection(data, 'choruses'),
    B: countSection(data, 'bridges'),
  };
  console.log(`  After:  V=${after.V} C=${after.C} B=${after.B}`);

  // Verify thresholds
  const vOk = after.V >= V_MIN ? 'OK' : 'FAIL';
  const cOk = after.C >= C_MIN ? 'OK' : 'FAIL';
  const bOk = after.B >= B_MIN ? 'OK' : 'FAIL';
  console.log(`  Status: V=${vOk} C=${cOk} B=${bOk}`);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 1), 'utf8');
  console.log(`  Written to ${filePath}`);
}

console.log('\nDone!');
