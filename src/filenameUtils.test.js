/**
 * filenameUtils — Comprehensive Unit Tests
 * Tests filename sanitization, formatting, and scale abbreviation
 */
import { describe, it, expect } from 'vitest';
import {
    sanitizeFilename, formatKeyForFilename, abbreviateScale,
    formatMixFilename, formatStemFilename,
    formatArrangementFilename, formatStemsZipFilename
} from './filenameUtils';

// ── sanitizeFilename ───────────��───────────────────────���───────────────────

describe('sanitizeFilename', () => {
    it('should remove illegal characters', () => {
        expect(sanitizeFilename('file<name>.wav')).toBe('filename.wav');
        expect(sanitizeFilename('my:file/test')).toBe('myfiletest');
        expect(sanitizeFilename('test"quotes"')).toBe('testquotes');
        expect(sanitizeFilename('back\\slash')).toBe('backslash');
        expect(sanitizeFilename('pipe|char')).toBe('pipechar');
        expect(sanitizeFilename('question?mark')).toBe('questionmark');
        expect(sanitizeFilename('star*char')).toBe('starchar');
    });

    it('should replace spaces with underscores', () => {
        expect(sanitizeFilename('my file name')).toBe('my_file_name');
    });

    it('should collapse multiple underscores', () => {
        expect(sanitizeFilename('my   file')).toBe('my_file');
    });

    it('should trim leading/trailing underscores', () => {
        expect(sanitizeFilename(' leading space')).toBe('leading_space');
        expect(sanitizeFilename('trailing space ')).toBe('trailing_space');
    });

    it('should handle already-clean names', () => {
        expect(sanitizeFilename('clean_name')).toBe('clean_name');
        expect(sanitizeFilename('MyTrack01')).toBe('MyTrack01');
    });

    it('should handle empty string', () => {
        expect(sanitizeFilename('')).toBe('');
    });
});

// ── formatKeyForFilename ────────────��──────────────────────────────────────

describe('formatKeyForFilename', () => {
    it('should convert sharp to s', () => {
        expect(formatKeyForFilename('C#')).toBe('Cs');
        expect(formatKeyForFilename('F#')).toBe('Fs');
        expect(formatKeyForFilename('G#')).toBe('Gs');
    });

    it('should not change natural notes', () => {
        expect(formatKeyForFilename('C')).toBe('C');
        expect(formatKeyForFilename('D')).toBe('D');
        expect(formatKeyForFilename('A')).toBe('A');
    });

    it('should handle all chromatic notes', () => {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        for (const key of keys) {
            const formatted = formatKeyForFilename(key);
            expect(formatted).not.toContain('#');
            expect(formatted.length).toBeGreaterThan(0);
        }
    });
});

// ── abbreviateScale ────────────────��───────────────────────���───────────────

describe('abbreviateScale', () => {
    it('should abbreviate Major to maj', () => {
        expect(abbreviateScale('Major')).toBe('maj');
    });

    it('should abbreviate Minor to min', () => {
        expect(abbreviateScale('Minor')).toBe('min');
    });

    it('should abbreviate common modes', () => {
        expect(abbreviateScale('Dorian')).toBe('dor');
        expect(abbreviateScale('Phrygian')).toBe('phry');
        expect(abbreviateScale('Lydian')).toBe('lyd');
        expect(abbreviateScale('Mixolydian')).toBe('mix');
    });

    it('should abbreviate pentatonic scales', () => {
        expect(abbreviateScale('Major Pentatonic')).toBe('maj-pent');
        expect(abbreviateScale('Minor Pentatonic')).toBe('min-pent');
    });

    it('should abbreviate harmonic scales', () => {
        expect(abbreviateScale('Harmonic Minor')).toBe('harm-min');
    });

    it('should abbreviate blues scale', () => {
        expect(abbreviateScale('Blues')).toBe('blues');
    });

    it('should abbreviate world scales', () => {
        expect(abbreviateScale('Hirajoshi')).toBe('hira');
        expect(abbreviateScale('Persian')).toBe('persian');
        expect(abbreviateScale('Arabic')).toBe('arabic');
    });

    it('should fallback for unknown scales (lowercase, hyphens, truncate to 8)', () => {
        const result = abbreviateScale('Some Unknown Scale Name');
        expect(result).toBe('some-unk');
        expect(result.length).toBeLessThanOrEqual(8);
    });
});

// ── formatMixFilename ───────────────────────────────────��──────────────────

describe('formatMixFilename', () => {
    it('should format standard mix filename', () => {
        expect(formatMixFilename('MyTrack', 140, 'C', 'Minor'))
            .toBe('MyTrack_140BPM_Cmin_Mix');
    });

    it('should handle sharp keys', () => {
        expect(formatMixFilename('Song', 120, 'C#', 'Major'))
            .toBe('Song_120BPM_Csmaj_Mix');
    });

    it('should sanitize project name', () => {
        // sanitizeFilename removes <>:"/\|?* but NOT !
        expect(formatMixFilename('My Track?', 100, 'D', 'Minor'))
            .toBe('My_Track_100BPM_Dmin_Mix');
    });

    it('should use Untitled for empty project name', () => {
        expect(formatMixFilename('', 120, 'C', 'Major'))
            .toBe('Untitled_120BPM_Cmaj_Mix');
        expect(formatMixFilename(null, 120, 'C', 'Major'))
            .toBe('Untitled_120BPM_Cmaj_Mix');
    });
});

// ── formatStemFilename ───────────────────────���─────────────────────────────

describe('formatStemFilename', () => {
    it('should format stem filename with capitalized track name', () => {
        expect(formatStemFilename('MyTrack', 140, 'C', 'Minor', 'drums'))
            .toBe('MyTrack_140BPM_Cmin_Drums');
    });

    it('should capitalize first letter of track name', () => {
        expect(formatStemFilename('Song', 120, 'A', 'Major', 'melody'))
            .toBe('Song_120BPM_Amaj_Melody');
        expect(formatStemFilename('Song', 120, 'A', 'Major', 'bass'))
            .toBe('Song_120BPM_Amaj_Bass');
    });

    it('should handle chords track name', () => {
        expect(formatStemFilename('Song', 120, 'G', 'Minor', 'chords'))
            .toBe('Song_120BPM_Gmin_Chords');
    });
});

// ── formatArrangementFilename ────────────────────────────────────���─────────

describe('formatArrangementFilename', () => {
    it('should format arrangement filename', () => {
        expect(formatArrangementFilename('MyTrack', 140, 'C', 'Minor'))
            .toBe('MyTrack_140BPM_Cmin_Arrangement');
    });
});

// ── formatStemsZipFilename ────────��──────────────────────────────��─────────

describe('formatStemsZipFilename', () => {
    it('should format stems zip filename', () => {
        expect(formatStemsZipFilename('MyTrack', 140, 'C', 'Minor'))
            .toBe('MyTrack_140BPM_Cmin_Stems');
    });

    it('should handle all parameters consistently', () => {
        const result = formatStemsZipFilename('My Song', 175, 'F#', 'Dorian');
        expect(result).toBe('My_Song_175BPM_Fsdor_Stems');
    });
});
