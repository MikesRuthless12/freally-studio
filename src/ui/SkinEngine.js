// SkinEngine.js — Ableton-style skin loading (TASK-C03)
//
// A skin is a COMPLETE set of the color tokens from src/ui/tokens.css:
//   { "name": "Freally Dark", "tokens": { "--surface-0": "#141414", … } }
// loadSkin() validates (all required keys present, every value parseable
// as a color) and applies the values to document.documentElement.style.
// Type-scale and spacing tokens are design-law constants and NOT skinnable.

import freallyDark from './skins/freally-dark.json';
import midDark from './skins/mid-dark.json';
import light from './skins/light.json';
import darker from './skins/darker.json';

export const REQUIRED_TOKENS = [
    '--surface-0', '--surface-1', '--surface-2', '--surface-3',
    '--border-hairline',
    '--text-1', '--text-2', '--text-disabled',
    '--accent', '--accent-muted',
    '--warn', '--danger',
    '--selection', '--playhead',
    '--meter-green', '--meter-yellow', '--meter-red',
    ...Array.from({ length: 16 }, (_, i) => `--clip-${String(i + 1).padStart(2, '0')}`),
];

export const BUILTIN_SKINS = {
    'freally-dark': freallyDark,
    'mid-dark': midDark,
    'light': light,
    'darker': darker,
};

export const DEFAULT_SKIN = 'freally-dark';

const COLOR_RE = /^(#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)|hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+\s*)?\))$/;

/**
 * Validate a skin object. Returns { ok, errors } — errors name the exact
 * missing keys / unparseable values so a hand-edited skin is debuggable.
 */
export function validateSkin(skin) {
    const errors = [];
    if (!skin || typeof skin !== 'object') {
        return { ok: false, errors: ['skin must be an object'] };
    }
    if (typeof skin.name !== 'string' || !skin.name.trim()) {
        errors.push('skin.name must be a non-empty string');
    }
    const tokens = skin.tokens;
    if (!tokens || typeof tokens !== 'object') {
        errors.push('skin.tokens must be an object');
        return { ok: false, errors };
    }
    for (const key of REQUIRED_TOKENS) {
        const value = tokens[key];
        if (value == null) {
            errors.push(`missing token ${key}`);
        } else if (!COLOR_RE.test(String(value).trim())) {
            errors.push(`token ${key} is not a parseable color: "${value}"`);
        }
    }
    for (const key of Object.keys(tokens)) {
        if (!REQUIRED_TOKENS.includes(key)) {
            errors.push(`unknown token ${key}`);
        }
    }
    return { ok: errors.length === 0, errors };
}

/**
 * Validate + apply a skin. Throws with the validation errors on a bad skin.
 * @param {object} skin
 * @param {ElementCSSInlineStyle} [root] injectable for tests; defaults to
 *   document.documentElement
 */
export function loadSkin(skin, root = typeof document !== 'undefined' ? document.documentElement : null) {
    const { ok, errors } = validateSkin(skin);
    if (!ok) {
        throw new Error(`Invalid skin${skin?.name ? ` "${skin.name}"` : ''}: ${errors.join('; ')}`);
    }
    if (root) {
        for (const key of REQUIRED_TOKENS) {
            root.style.setProperty(key, String(skin.tokens[key]).trim());
        }
    }
    return skin;
}

/** Load a built-in skin by id ('freally-dark' | 'mid-dark' | 'light' | 'darker'). */
export function loadSkinByName(name, root) {
    const skin = BUILTIN_SKINS[name];
    if (!skin) throw new Error(`Unknown skin "${name}" (built-ins: ${Object.keys(BUILTIN_SKINS).join(', ')})`);
    return loadSkin(skin, root);
}

// ── Persistence: the freally_settings pattern (same as AudioEngine) ──

export function saveSkinChoice(choice, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    if (!storage) return;
    let settings = {};
    try {
        settings = JSON.parse(storage.getItem('freally_settings') || '{}');
    } catch { /* corrupt settings: rebuild */ }
    if (typeof choice === 'string') {
        settings.skin = choice;
        delete settings.skinCustom;
    } else {
        settings.skin = 'custom';
        settings.skinCustom = choice;
    }
    storage.setItem('freally_settings', JSON.stringify(settings));
}

/** Read the persisted choice ({ name, custom? }); defaults to DEFAULT_SKIN. */
export function getSavedSkinChoice(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    if (!storage) return { name: DEFAULT_SKIN };
    try {
        const settings = JSON.parse(storage.getItem('freally_settings') || '{}');
        if (settings.skin === 'custom' && settings.skinCustom) {
            return { name: 'custom', custom: settings.skinCustom };
        }
        if (settings.skin && BUILTIN_SKINS[settings.skin]) {
            return { name: settings.skin };
        }
    } catch { /* use default */ }
    return { name: DEFAULT_SKIN };
}

/** Apply the persisted skin at startup. Silently falls back to the default. */
export function applySavedSkin(storage, root) {
    const choice = getSavedSkinChoice(storage);
    try {
        if (choice.name === 'custom') return loadSkin(choice.custom, root);
        return loadSkinByName(choice.name, root);
    } catch (err) {
        console.warn('[SkinEngine] Saved skin invalid, falling back to default:', err.message);
        return loadSkinByName(DEFAULT_SKIN, root);
    }
}

/** Serialize a skin for .json export. */
export function exportSkin(skin) {
    return JSON.stringify(skin, null, 2);
}
