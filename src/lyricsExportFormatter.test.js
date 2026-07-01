/**
 * Lyrics ExportFormatter — Comprehensive Unit Tests
 * Tests TXT, LRC, JSON, and project export formats
 */
import { describe, it, expect } from 'vitest';
import {
    formatAsTXT, formatAsLRC, formatAsJSON, formatAsProject
} from './lyrics/engine/ExportFormatter';

const sampleSections = [
    {
        label: 'Verse 1',
        type: 'verse',
        lines: ['Walking down the midnight road', 'Shadows dancing all around', 'Whispers in the wind unfold', 'Lost but waiting to be found'],
    },
    {
        label: 'Chorus',
        type: 'chorus',
        lines: ['Hold on tight to the light', 'Never let it fade away'],
    },
];

// ── formatAsTXT ──────────��─────────────────────────────────────────────────

describe('formatAsTXT', () => {
    it('should format sections with headers in brackets', () => {
        const result = formatAsTXT(sampleSections);
        expect(result).toContain('[Verse 1]');
        expect(result).toContain('[Chorus]');
    });

    it('should include all lyrics lines', () => {
        const result = formatAsTXT(sampleSections);
        expect(result).toContain('Walking down the midnight road');
        expect(result).toContain('Shadows dancing all around');
        expect(result).toContain('Hold on tight to the light');
    });

    it('should separate sections with double newlines', () => {
        const result = formatAsTXT(sampleSections);
        expect(result).toContain('\n\n');
    });

    it('should handle single section', () => {
        const result = formatAsTXT([sampleSections[0]]);
        expect(result).toContain('[Verse 1]');
        expect(result).not.toContain('\n\n');
    });

    it('should handle empty sections array', () => {
        expect(formatAsTXT([])).toBe('');
    });

    it('should handle section with empty lines', () => {
        const result = formatAsTXT([{ label: 'Intro', lines: [] }]);
        expect(result).toContain('[Intro]');
    });
});

// ── formatAsLRC ───────────────────────────────────��────────────────────────

describe('formatAsLRC', () => {
    it('should include Freally generator tag', () => {
        const result = formatAsLRC(sampleSections);
        expect(result).toContain('[by:Freally Lyric Engine]');
    });

    it('should include metadata when provided', () => {
        const result = formatAsLRC(sampleSections, { title: 'Test Song', artist: 'Test Artist' });
        expect(result).toContain('[ti:Test Song]');
        expect(result).toContain('[ar:Test Artist]');
    });

    it('should include timestamps in [mm:ss.xx] format', () => {
        const result = formatAsLRC(sampleSections);
        // LRC timestamps follow pattern [00:00.00]
        const timestampRegex = /\[\d{2}:\d{2}\.\d{2}\]/;
        expect(timestampRegex.test(result)).toBe(true);
    });

    it('should include section markers', () => {
        const result = formatAsLRC(sampleSections);
        expect(result).toContain('[Verse 1]');
        expect(result).toContain('[Chorus]');
    });

    it('should include all lyric lines', () => {
        const result = formatAsLRC(sampleSections);
        expect(result).toContain('Walking down the midnight road');
        expect(result).toContain('Hold on tight to the light');
    });

    it('should handle timing data', () => {
        const timedSections = [{
            label: 'Verse',
            type: 'verse',
            lines: ['Line one', 'Line two'],
            timing: [{ startMs: 5000 }, { startMs: 9000 }],
        }];
        const result = formatAsLRC(timedSections);
        expect(result).toContain('[00:05.00]');
        expect(result).toContain('[00:09.00]');
    });

    it('should handle empty metadata', () => {
        const result = formatAsLRC(sampleSections, {});
        expect(result).toContain('[by:Freally Lyric Engine]');
    });
});

// ��─ formatAsJSON ───────���───────────────────────────────────────────────────

describe('formatAsJSON', () => {
    it('should return valid JSON string', () => {
        const result = formatAsJSON(sampleSections);
        expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should include generator metadata', () => {
        const parsed = JSON.parse(formatAsJSON(sampleSections));
        expect(parsed.generator).toBe('Freally Lyric Engine');
        expect(parsed.version).toBe('1.0.0');
    });

    it('should include generatedAt timestamp', () => {
        const parsed = JSON.parse(formatAsJSON(sampleSections));
        expect(parsed.generatedAt).toBeDefined();
        expect(new Date(parsed.generatedAt).getTime()).toBeGreaterThan(0);
    });

    it('should include settings', () => {
        const settings = { genre: 'Hip Hop', mood: 'Dark', bpm: 140 };
        const parsed = JSON.parse(formatAsJSON(sampleSections, settings));
        expect(parsed.settings.genre).toBe('Hip Hop');
        expect(parsed.settings.mood).toBe('Dark');
        expect(parsed.settings.bpm).toBe(140);
    });

    it('should include all sections with correct structure', () => {
        const parsed = JSON.parse(formatAsJSON(sampleSections));
        expect(parsed.sections).toHaveLength(2);
        expect(parsed.sections[0].label).toBe('Verse 1');
        expect(parsed.sections[0].type).toBe('verse');
        expect(parsed.sections[0].lines).toHaveLength(4);
    });

    it('should default missing settings fields', () => {
        const parsed = JSON.parse(formatAsJSON(sampleSections));
        expect(parsed.settings.genre).toBe('');
        expect(parsed.settings.bpm).toBe(120);
        expect(parsed.settings.language).toBe('English');
    });
});

// ── formatAsProject ───────��────────────────────────────────────────────────

describe('formatAsProject', () => {
    it('should return object with correct type', () => {
        const result = formatAsProject(sampleSections);
        expect(result.type).toBe('freally-lyrics');
        expect(result.version).toBe(1);
    });

    it('should include settings', () => {
        const settings = { genre: 'Pop', mood: 'Happy' };
        const result = formatAsProject(sampleSections, settings);
        expect(result.settings.genre).toBe('Pop');
    });

    it('should include sections with locked=false', () => {
        const result = formatAsProject(sampleSections);
        expect(result.sections).toHaveLength(2);
        result.sections.forEach(s => {
            expect(s.locked).toBe(false);
        });
    });

    it('should include section type and label', () => {
        const result = formatAsProject(sampleSections);
        expect(result.sections[0].type).toBe('verse');
        expect(result.sections[0].label).toBe('Verse 1');
        expect(result.sections[1].type).toBe('chorus');
    });

    it('should include all lines', () => {
        const result = formatAsProject(sampleSections);
        expect(result.sections[0].lines).toHaveLength(4);
        expect(result.sections[1].lines).toHaveLength(2);
    });
});
