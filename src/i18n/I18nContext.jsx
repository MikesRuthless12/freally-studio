import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

// Import all locale files (18 languages — top 12 + major world languages)
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import tr from './locales/tr.json';
import fi from './locales/fi.json';
import hu from './locales/hu.json';
import th from './locales/th.json';
import et from './locales/et.json';
import az from './locales/az.json';

const translations = { en, es, fr, de, it, pt, ja, ko, zh, ru, ar, hi, tr, fi, hu, th, et, az };

// Language names — each language shows all other language names in its own script
const LANGUAGE_NAMES = {
    en: { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese (Simplified)', ru: 'Russian', ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', fi: 'Finnish', hu: 'Hungarian', th: 'Thai', et: 'Estonian', az: 'Azerbaijani' },
    es: { en: 'Inglés', es: 'Español', fr: 'Francés', de: 'Alemán', it: 'Italiano', pt: 'Portugués', ja: 'Japonés', ko: 'Coreano', zh: 'Chino (Simplificado)', ru: 'Ruso', ar: 'Árabe', hi: 'Hindi', tr: 'Turco', fi: 'Finés', hu: 'Húngaro', th: 'Tailandés', et: 'Estonio', az: 'Azerbaiyano' },
    fr: { en: 'Anglais', es: 'Espagnol', fr: 'Français', de: 'Allemand', it: 'Italien', pt: 'Portugais', ja: 'Japonais', ko: 'Coréen', zh: 'Chinois (Simplifié)', ru: 'Russe', ar: 'Arabe', hi: 'Hindi', tr: 'Turc', fi: 'Finnois', hu: 'Hongrois', th: 'Thaï', et: 'Estonien', az: 'Azerbaïdjanais' },
    de: { en: 'Englisch', es: 'Spanisch', fr: 'Französisch', de: 'Deutsch', it: 'Italienisch', pt: 'Portugiesisch', ja: 'Japanisch', ko: 'Koreanisch', zh: 'Chinesisch (Vereinfacht)', ru: 'Russisch', ar: 'Arabisch', hi: 'Hindi', tr: 'Türkisch', fi: 'Finnisch', hu: 'Ungarisch', th: 'Thailändisch', et: 'Estnisch', az: 'Aserbaidschanisch' },
    it: { en: 'Inglese', es: 'Spagnolo', fr: 'Francese', de: 'Tedesco', it: 'Italiano', pt: 'Portoghese', ja: 'Giapponese', ko: 'Coreano', zh: 'Cinese (Semplificato)', ru: 'Russo', ar: 'Arabo', hi: 'Hindi', tr: 'Turco', fi: 'Finlandese', hu: 'Ungherese', th: 'Tailandese', et: 'Estone', az: 'Azerbaigiano' },
    pt: { en: 'Inglês', es: 'Espanhol', fr: 'Francês', de: 'Alemão', it: 'Italiano', pt: 'Português', ja: 'Japonês', ko: 'Coreano', zh: 'Chinês (Simplificado)', ru: 'Russo', ar: 'Árabe', hi: 'Hindi', tr: 'Turco', fi: 'Finlandês', hu: 'Húngaro', th: 'Tailandês', et: 'Estoniano', az: 'Azerbaijano' },
    ja: { en: '英語', es: 'スペイン語', fr: 'フランス語', de: 'ドイツ語', it: 'イタリア語', pt: 'ポルトガル語', ja: '日本語', ko: '韓国語', zh: '中国語（簡体）', ru: 'ロシア語', ar: 'アラビア語', hi: 'ヒンディー語', tr: 'トルコ語', fi: 'フィンランド語', hu: 'ハンガリー語', th: 'タイ語', et: 'エストニア語', az: 'アゼルバイジャン語' },
    ko: { en: '영어', es: '스페인어', fr: '프랑스어', de: '독일어', it: '이탈리아어', pt: '포르투갈어', ja: '일본어', ko: '한국어', zh: '중국어(간체)', ru: '러시아어', ar: '아랍어', hi: '힌디어', tr: '터키어', fi: '핀란드어', hu: '헝가리어', th: '태국어', et: '에스토니아어', az: '아제르바이잔어' },
    zh: { en: '英语', es: '西班牙语', fr: '法语', de: '德语', it: '意大利语', pt: '葡萄牙语', ja: '日语', ko: '韩语', zh: '中文（简体）', ru: '俄语', ar: '阿拉伯语', hi: '印地语', tr: '土耳其语', fi: '芬兰语', hu: '匈牙利语', th: '泰语', et: '爱沙尼亚语', az: '阿塞拜疆语' },
    ru: { en: 'Английский', es: 'Испанский', fr: 'Французский', de: 'Немецкий', it: 'Итальянский', pt: 'Португальский', ja: 'Японский', ko: 'Корейский', zh: 'Китайский (упрощённый)', ru: 'Русский', ar: 'Арабский', hi: 'Хинди', tr: 'Турецкий', fi: 'Финский', hu: 'Венгерский', th: 'Тайский', et: 'Эстонский', az: 'Азербайджанский' },
    ar: { en: 'الإنجليزية', es: 'الإسبانية', fr: 'الفرنسية', de: 'الألمانية', it: 'الإيطالية', pt: 'البرتغالية', ja: 'اليابانية', ko: 'الكورية', zh: 'الصينية (المبسطة)', ru: 'الروسية', ar: 'العربية', hi: 'الهندية', tr: 'التركية', fi: 'الفنلندية', hu: 'المجرية', th: 'التايلاندية', et: 'الإستونية', az: 'الأذربيجانية' },
    hi: { en: 'अंग्रेज़ी', es: 'स्पेनिश', fr: 'फ़्रेंच', de: 'जर्मन', it: 'इतालवी', pt: 'पुर्तगाली', ja: 'जापानी', ko: 'कोरियाई', zh: 'चीनी (सरलीकृत)', ru: 'रूसी', ar: 'अरबी', hi: 'हिन्दी', tr: 'तुर्की', fi: 'फ़िनिश', hu: 'हंगेरियन', th: 'थाई', et: 'एस्टोनियाई', az: 'अज़रबैजानी' },
    tr: { en: 'İngilizce', es: 'İspanyolca', fr: 'Fransızca', de: 'Almanca', it: 'İtalyanca', pt: 'Portekizce', ja: 'Japonca', ko: 'Korece', zh: 'Çince (Basitleştirilmiş)', ru: 'Rusça', ar: 'Arapça', hi: 'Hintçe', tr: 'Türkçe', fi: 'Fince', hu: 'Macarca', th: 'Tayca', et: 'Estonca', az: 'Azerbaycanca' },
    fi: { en: 'Englanti', es: 'Espanja', fr: 'Ranska', de: 'Saksa', it: 'Italia', pt: 'Portugali', ja: 'Japani', ko: 'Korea', zh: 'Kiina (Yksinkertaistettu)', ru: 'Venäjä', ar: 'Arabia', hi: 'Hindi', tr: 'Turkki', fi: 'Suomi', hu: 'Unkari', th: 'Thai', et: 'Viro', az: 'Azerbaidžani' },
    hu: { en: 'Angol', es: 'Spanyol', fr: 'Francia', de: 'Német', it: 'Olasz', pt: 'Portugál', ja: 'Japán', ko: 'Koreai', zh: 'Kínai (Egyszerűsített)', ru: 'Orosz', ar: 'Arab', hi: 'Hindi', tr: 'Török', fi: 'Finn', hu: 'Magyar', th: 'Thai', et: 'Észt', az: 'Azerbajdzsáni' },
    th: { en: 'อังกฤษ', es: 'สเปน', fr: 'ฝรั่งเศส', de: 'เยอรมัน', it: 'อิตาลี', pt: 'โปรตุเกส', ja: 'ญี่ปุ่น', ko: 'เกาหลี', zh: 'จีน (ตัวย่อ)', ru: 'รัสเซีย', ar: 'อาหรับ', hi: 'ฮินดี', tr: 'ตุรกี', fi: 'ฟินแลนด์', hu: 'ฮังการี', th: 'ไทย', et: 'เอสโตเนีย', az: 'อาเซอร์ไบจาน' },
    et: { en: 'Inglise', es: 'Hispaania', fr: 'Prantsuse', de: 'Saksa', it: 'Itaalia', pt: 'Portugali', ja: 'Jaapani', ko: 'Korea', zh: 'Hiina (Lihtsustatud)', ru: 'Vene', ar: 'Araabia', hi: 'Hindi', tr: 'Türgi', fi: 'Soome', hu: 'Ungari', th: 'Tai', et: 'Eesti', az: 'Aserbaidžaani' },
    az: { en: 'İngiliscə', es: 'İspancа', fr: 'Fransızca', de: 'Almanca', it: 'İtalyanca', pt: 'Portuqalca', ja: 'Yaponca', ko: 'Koreyaca', zh: 'Çincə (Sadələşdirilmiş)', ru: 'Rusca', ar: 'Ərəbcə', hi: 'Hindcə', tr: 'Türkcə', fi: 'Fincə', hu: 'Macarca', th: 'Tayca', et: 'Estoncа', az: 'Azərbaycanca' },
};

// All supported language codes (18 languages)
const LANGUAGE_CODES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru', 'ar', 'hi', 'tr', 'fi', 'hu', 'th', 'et', 'az'];

const I18nContext = createContext(null);

/**
 * Get sorted language list: English first, then alphabetical in the current language.
 */
function getSortedLanguages(currentLang) {
    const names = LANGUAGE_NAMES[currentLang] || LANGUAGE_NAMES.en;
    const others = LANGUAGE_CODES
        .filter(code => code !== 'en')
        .map(code => ({ code, name: names[code] || code }))
        .sort((a, b) => a.name.localeCompare(b.name, currentLang));
    return [{ code: 'en', name: names.en }, ...others];
}

/**
 * Detect the browser/system language and return a supported language code.
 * Falls back to 'en' if the system language is not among our 45 supported languages.
 */
function detectSystemLanguage() {
    try {
        // navigator.languages is an ordered list of user-preferred languages
        const candidates = navigator.languages || [navigator.language || 'en'];
        for (const locale of candidates) {
            // Extract 2-letter code from locale (e.g. "en-US" → "en", "zh-CN" → "zh")
            const code = locale.split('-')[0].toLowerCase();
            if (LANGUAGE_CODES.includes(code)) return code;
        }
    } catch (e) { /* ignore */ }
    return 'en';
}

export function I18nProvider({ children }) {
    const [language, setLanguageState] = useState(() => {
        try {
            const settings = localStorage.getItem('wavloom_settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                // Convert old string language names to codes
                if (parsed.language && parsed.language.length === 2) return parsed.language;
                if (parsed.languageCode) return parsed.languageCode;
            }
        } catch (e) { /* ignore */ }
        // No saved language — detect from browser/system, fallback to English
        return detectSystemLanguage();
    });

    const setLanguage = useCallback((langCode) => {
        setLanguageState(langCode);
        // Also persist to settings
        try {
            const raw = localStorage.getItem('wavloom_settings');
            const settings = raw ? JSON.parse(raw) : {};
            settings.languageCode = langCode;
            localStorage.setItem('wavloom_settings', JSON.stringify(settings));
        } catch (e) { /* ignore */ }
    }, []);

    const t = useCallback((key, params) => {
        const dict = translations[language] || translations.en;
        let text = dict[key];
        if (text === undefined) text = translations.en[key];
        if (text === undefined) return key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
            });
        }
        return text;
    }, [language]);

    const getLanguageName = useCallback((langCode, inLanguage) => {
        const lang = inLanguage || language;
        return LANGUAGE_NAMES[lang]?.[langCode] || LANGUAGE_NAMES.en[langCode] || langCode;
    }, [language]);

    const sortedLanguages = useMemo(() => getSortedLanguages(language), [language]);

    const value = useMemo(() => ({
        language,
        setLanguage,
        t,
        getLanguageName,
        sortedLanguages,
        languageCodes: LANGUAGE_CODES,
    }), [language, setLanguage, t, getLanguageName, sortedLanguages]);

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) {
        return {
            language: 'en',
            setLanguage: () => {},
            t: (key) => {
                const dict = translations.en;
                return dict[key] || key;
            },
            getLanguageName: (code) => LANGUAGE_NAMES.en[code] || code,
            sortedLanguages: getSortedLanguages('en'),
            languageCodes: LANGUAGE_CODES,
        };
    }
    return context;
}

export { LANGUAGE_NAMES, LANGUAGE_CODES };
export default I18nContext;
