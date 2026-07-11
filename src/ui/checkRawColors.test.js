// checkRawColors.test.js — TASK-C04 raw-color scanner tests

import { describe, it, expect } from 'vitest';
import { scanSource, isAllowedFile } from '../../scripts/check-raw-colors.js';
import { sep } from 'node:path';

describe('check-raw-colors — scanSource', () => {
    it('finds hex, rgb() and hsl() literals with line numbers', () => {
        const src = [
            "const a = '#ff6b6b';",
            'const clean = va(--accent);',
            "const b = 'rgba(0, 0, 0, 0.5)';",
            "const c = 'hsl(200, 50%, 50%)';",
        ].join('\n');
        const v = scanSource(src);
        expect(v.map(x => x.line)).toEqual([1, 3, 4]);
        expect(v[0].count).toBe(1);
    });

    it('var(--token) usage is clean', () => {
        expect(scanSource('color: var(--text-1); background: var(--surface-2);')).toEqual([]);
    });

    it('honors the raw-color-ok escape hatch for canvas lines', () => {
        const src = "ctx.fillStyle = '#123456'; // raw-color-ok: canvas reads tokens via getComputedStyle";
        expect(scanSource(src)).toEqual([]);
    });

    it('counts multiple refs on one line', () => {
        const v = scanSource("background: linear-gradient(#111, #222, rgba(0,0,0,.2));");
        expect(v[0].count).toBe(3);
    });
});

describe('check-raw-colors — allowlist', () => {
    const p = (...parts) => parts.join(sep);
    it('allows tokens.css and skins/, nothing else', () => {
        expect(isAllowedFile(p('src', 'ui', 'tokens.css'))).toBe(true);
        expect(isAllowedFile(p('src', 'ui', 'skins', 'light.json'))).toBe(true);
        expect(isAllowedFile(p('src', 'ui', 'SkinEngine.js'))).toBe(false);
        expect(isAllowedFile(p('src', 'MixerPanel.jsx'))).toBe(false);
    });
});
