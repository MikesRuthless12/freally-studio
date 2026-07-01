/**
 * Accent Themes, Undo History Limit, and Settings — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('Accent Themes', () => {
    let ACCENT_THEMES, ACCENT_KEYS, SOLID_ACCENT_KEYS, GRADIENT_ACCENT_KEYS, getAccentTheme, hexToRgba;

    beforeEach(async () => {
        const mod = await import('./accentThemes.js');
        ACCENT_THEMES = mod.ACCENT_THEMES;
        ACCENT_KEYS = mod.ACCENT_KEYS;
        SOLID_ACCENT_KEYS = mod.SOLID_ACCENT_KEYS;
        GRADIENT_ACCENT_KEYS = mod.GRADIENT_ACCENT_KEYS;
        getAccentTheme = mod.getAccentTheme;
        hexToRgba = mod.hexToRgba;
    });

    it('should have exactly 18 accent themes', () => {
        expect(ACCENT_KEYS.length).toBe(18);
    });

    it('should have 9 solid themes', () => {
        expect(SOLID_ACCENT_KEYS.length).toBe(9);
    });

    it('should have 9 gradient themes', () => {
        expect(GRADIENT_ACCENT_KEYS.length).toBe(9);
    });

    it('each theme should have name, type, accent, secondary, gradient', () => {
        for (const key of ACCENT_KEYS) {
            const theme = ACCENT_THEMES[key];
            expect(theme).toHaveProperty('name');
            expect(theme).toHaveProperty('type');
            expect(theme).toHaveProperty('accent');
            expect(theme).toHaveProperty('secondary');
            expect(theme).toHaveProperty('gradient');
            expect(['solid', 'gradient']).toContain(theme.type);
        }
    });

    it('all accent colors should be valid hex', () => {
        const hexRegex = /^#[0-9a-fA-F]{6}$/;
        for (const key of ACCENT_KEYS) {
            expect(ACCENT_THEMES[key].accent).toMatch(hexRegex);
            expect(ACCENT_THEMES[key].secondary).toMatch(hexRegex);
        }
    });

    it('all gradient values should be valid CSS gradients', () => {
        for (const key of ACCENT_KEYS) {
            expect(ACCENT_THEMES[key].gradient).toMatch(/^linear-gradient\(/);
        }
    });

    it('should include all expected solid themes', () => {
        const expected = ['coral', 'ocean', 'purple', 'gold', 'neon', 'pink', 'arctic', 'crimson', 'forest'];
        for (const name of expected) {
            expect(ACCENT_THEMES[name]).toBeDefined();
            expect(ACCENT_THEMES[name].type).toBe('solid');
        }
    });

    it('should include all expected gradient themes', () => {
        const expected = ['sunset', 'aurora', 'nebula', 'ember', 'mint', 'twilight', 'peach', 'storm', 'sakura'];
        for (const name of expected) {
            expect(ACCENT_THEMES[name]).toBeDefined();
            expect(ACCENT_THEMES[name].type).toBe('gradient');
        }
    });

    it('getAccentTheme should return correct theme', () => {
        const coral = getAccentTheme('coral');
        expect(coral.name).toBe('Coral');
    });

    it('getAccentTheme should fallback to default for unknown key', () => {
        const fallback = getAccentTheme('nonexistent');
        expect(fallback.name).toBe('Coral');
    });

    it('hexToRgba should convert hex correctly', () => {
        expect(hexToRgba('#ff6b6b', 0.5)).toBe('rgba(255, 107, 107, 0.5)');
        expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
        expect(hexToRgba('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)');
    });

    it('all theme names should be unique', () => {
        const names = ACCENT_KEYS.map(k => ACCENT_THEMES[k].name);
        expect(new Set(names).size).toBe(names.length);
    });
});

describe('Undo History Limits', () => {
    it('useUndoRedo MAX_HISTORY should be 50', async () => {
        // Read the source to verify the constant
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'useUndoRedo.js'), 'utf-8');
        expect(src).toContain('const MAX_HISTORY = 50');
    });

    it('MAX_AUDIO_HISTORY in FreallyAppComplete should be 50', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'FreallyAppComplete.jsx'), 'utf-8');
        expect(src).toContain('const MAX_AUDIO_HISTORY = 50');
    });

    it('MAX_ARRANGEMENT_HISTORY in useArrangement should be 50', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'useArrangement.js'), 'utf-8');
        expect(src).toContain('const MAX_ARRANGEMENT_HISTORY = 50');
    });
});

describe('Undo/Redo includes trackAutomation', () => {
    it('useUndoRedo pushSnapshot should compare automation strings', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'useUndoRedo.js'), 'utf-8');
        expect(src).toContain('automationString');
        expect(src).toContain('trackAutomation');
    });

    it('handleUndo should restore trackAutomation', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'FreallyAppComplete.jsx'), 'utf-8');
        expect(src).toContain('snapshot.trackAutomation');
        expect(src).toContain('setTrackAutomation');
    });
});
