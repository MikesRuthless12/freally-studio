// skinEngine.test.js — TASK-C03 skin engine tests
// Every built-in skin sets every token; invalid skins are rejected with a
// useful error; persistence round-trips through freally_settings.

import { describe, it, expect } from 'vitest';
import {
    REQUIRED_TOKENS, BUILTIN_SKINS, DEFAULT_SKIN,
    validateSkin, loadSkin, loadSkinByName,
    saveSkinChoice, getSavedSkinChoice, applySavedSkin, exportSkin,
    getTokenColor, resolveColor,
} from './SkinEngine.js';

function fakeRoot() {
    const props = {};
    return { style: { setProperty: (k, v) => { props[k] = v; } }, props };
}

function fakeStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
    };
}

describe('SkinEngine — built-in skins', () => {
    it('ships the four skins with complete token sets', () => {
        expect(Object.keys(BUILTIN_SKINS)).toEqual(['freally-dark', 'mid-dark', 'light', 'darker']);
        for (const [id, skin] of Object.entries(BUILTIN_SKINS)) {
            const { ok, errors } = validateSkin(skin);
            expect(ok, `${id}: ${errors.join('; ')}`).toBe(true);
            expect(Object.keys(skin.tokens)).toHaveLength(REQUIRED_TOKENS.length);
        }
    });

    it('applying each built-in skin sets every token on the root', () => {
        for (const id of Object.keys(BUILTIN_SKINS)) {
            const root = fakeRoot();
            loadSkinByName(id, root);
            for (const key of REQUIRED_TOKENS) {
                expect(root.props[key], `${id} missing ${key}`).toBeTruthy();
            }
            expect(Object.keys(root.props)).toHaveLength(REQUIRED_TOKENS.length);
        }
    });

    it('the default skin matches tokens.css values', () => {
        const t = BUILTIN_SKINS[DEFAULT_SKIN].tokens;
        expect(t['--surface-1']).toBe('#1a1a1a');
        expect(t['--surface-3']).toBe('#2a2a2a');
        expect(t['--text-1']).toBe('#d0d0d0');
        expect(t['--accent']).toBe('#37c1cf');
    });
});

describe('SkinEngine — validation', () => {
    it('rejects a skin with missing tokens, naming them', () => {
        const bad = { name: 'Broken', tokens: { '--surface-0': '#111111' } };
        const { ok, errors } = validateSkin(bad);
        expect(ok).toBe(false);
        expect(errors.some(e => e.includes('missing token --accent'))).toBe(true);
        expect(() => loadSkin(bad, fakeRoot())).toThrow(/missing token/);
    });

    it('rejects unparseable color values, naming the token', () => {
        const skin = JSON.parse(JSON.stringify(BUILTIN_SKINS[DEFAULT_SKIN]));
        skin.tokens['--accent'] = 'not-a-color';
        const { ok, errors } = validateSkin(skin);
        expect(ok).toBe(false);
        expect(errors.some(e => e.includes('--accent') && e.includes('not-a-color'))).toBe(true);
    });

    it('rejects unknown tokens (typos are caught, not silently ignored)', () => {
        const skin = JSON.parse(JSON.stringify(BUILTIN_SKINS[DEFAULT_SKIN]));
        skin.tokens['--surfance-0'] = '#123456';
        const { ok, errors } = validateSkin(skin);
        expect(ok).toBe(false);
        expect(errors.some(e => e.includes('unknown token --surfance-0'))).toBe(true);
    });

    it('rejects non-objects and missing names', () => {
        expect(validateSkin(null).ok).toBe(false);
        expect(validateSkin({ tokens: {} }).ok).toBe(false);
        expect(() => loadSkinByName('nope', fakeRoot())).toThrow(/Unknown skin/);
    });
});

describe('SkinEngine — persistence (freally_settings)', () => {
    it('built-in choice round-trips', () => {
        const storage = fakeStorage();
        saveSkinChoice('light', storage);
        expect(getSavedSkinChoice(storage)).toEqual({ name: 'light' });
        // does not clobber other settings
        const raw = JSON.parse(storage.getItem('freally_settings'));
        expect(raw.skin).toBe('light');
    });

    it('custom skin round-trips with its full token set', () => {
        const storage = fakeStorage({ freally_settings: JSON.stringify({ showTooltips: false }) });
        const custom = JSON.parse(JSON.stringify(BUILTIN_SKINS['darker']));
        custom.name = 'My Custom';
        saveSkinChoice(custom, storage);
        const choice = getSavedSkinChoice(storage);
        expect(choice.name).toBe('custom');
        expect(choice.custom.name).toBe('My Custom');
        // existing settings survive
        expect(JSON.parse(storage.getItem('freally_settings')).showTooltips).toBe(false);
        // applySavedSkin applies it
        const root = fakeRoot();
        applySavedSkin(storage, root);
        expect(root.props['--surface-0']).toBe(custom.tokens['--surface-0']);
    });

    it('falls back to the default on corrupt or missing settings', () => {
        expect(getSavedSkinChoice(fakeStorage({ freally_settings: '{{{' })).name).toBe(DEFAULT_SKIN);
        const root = fakeRoot();
        applySavedSkin(fakeStorage(), root);
        expect(root.props['--accent']).toBe(BUILTIN_SKINS[DEFAULT_SKIN].tokens['--accent']);
    });

    it('exportSkin serializes round-trippable JSON', () => {
        const skin = BUILTIN_SKINS['mid-dark'];
        const parsed = JSON.parse(exportSkin(skin));
        expect(validateSkin(parsed).ok).toBe(true);
        expect(parsed.name).toBe('Mid Dark');
    });
});

describe('SkinEngine — token resolution for canvas (getTokenColor/resolveColor)', () => {
    it('getTokenColor falls back to the default skin values without a DOM', () => {
        expect(getTokenColor('--accent')).toBe(BUILTIN_SKINS[DEFAULT_SKIN].tokens['--accent']);
        expect(getTokenColor('--clip-01')).toBe(BUILTIN_SKINS[DEFAULT_SKIN].tokens['--clip-01']);
    });

    it('resolveColor resolves var() references and passes literals through', () => {
        expect(resolveColor('var(--danger)')).toBe(BUILTIN_SKINS[DEFAULT_SKIN].tokens['--danger']);
        expect(resolveColor('var( --text-1 )')).toBe(BUILTIN_SKINS[DEFAULT_SKIN].tokens['--text-1']);
        expect(resolveColor('#123456')).toBe('#123456');
        expect(resolveColor('rgba(1,2,3,0.5)')).toBe('rgba(1,2,3,0.5)');
        expect(resolveColor(null)).toBe(null);
    });

    it('an unknown token resolves to empty string, not a crash', () => {
        expect(getTokenColor('--not-a-token')).toBe('');
    });
});
