/**
 * SyllableBalancer — Comprehensive Unit Tests
 * Tests syllable counting and line measurement
 */
import { describe, it, expect } from 'vitest';
import { countSyllables, countLineSyllables } from './lyrics/engine/SyllableBalancer';

// ── countSyllables ──────���──────────────────────────────────────────────────

describe('countSyllables', () => {
    it('should return 0 for empty string', () => {
        expect(countSyllables('')).toBe(0);
    });

    it('should return 1 for single-syllable words', () => {
        expect(countSyllables('the')).toBe(1);
        expect(countSyllables('cat')).toBe(1);
        expect(countSyllables('run')).toBe(1);
        expect(countSyllables('big')).toBe(1);
        expect(countSyllables('are')).toBe(1);
    });

    it('should return 2 for two-syllable words', () => {
        expect(countSyllables('fire')).toBe(2);
        expect(countSyllables('power')).toBe(2);
        expect(countSyllables('flower')).toBe(2);
        expect(countSyllables('over')).toBe(2);
        expect(countSyllables('being')).toBe(2);
        expect(countSyllables('going')).toBe(2);
        expect(countSyllables('heaven')).toBe(2);
        expect(countSyllables('diamond')).toBe(2);
    });

    it('should return 3 for three-syllable words', () => {
        expect(countSyllables('desire')).toBe(3);
        expect(countSyllables('every')).toBe(3);
        expect(countSyllables('different')).toBe(3);
        expect(countSyllables('chocolate')).toBe(3);
        expect(countSyllables('camera')).toBe(3);
        expect(countSyllables('family')).toBe(3);
        expect(countSyllables('realize')).toBe(3);
    });

    it('should return 4 for four-syllable words', () => {
        expect(countSyllables('beautiful')).toBe(4);
        expect(countSyllables('interesting')).toBe(4);
        expect(countSyllables('comfortable')).toBe(4);
        expect(countSyllables('generally')).toBe(4);
        expect(countSyllables('naturally')).toBe(4);
    });

    it('should return at least 1 for any non-empty word', () => {
        const words = ['a', 'I', 'go', 'hi', 'my', 'no', 'so', 'up', 'we'];
        for (const word of words) {
            expect(countSyllables(word)).toBeGreaterThanOrEqual(1);
        }
    });

    it('should handle words with hyphens/punctuation', () => {
        const result = countSyllables("don't");
        expect(result).toBeGreaterThanOrEqual(1);
    });

    it('should handle short words correctly', () => {
        expect(countSyllables('me')).toBe(1);
        expect(countSyllables('we')).toBe(1);
        expect(countSyllables('he')).toBe(1);
    });
});

// ── countLineSyllables ─────────────��───────────────────────────────────────

describe('countLineSyllables', () => {
    it('should count syllables across multiple words', () => {
        const count = countLineSyllables('the big cat');
        expect(count).toBe(3); // the(1) + big(1) + cat(1)
    });

    it('should handle empty string', () => {
        expect(countLineSyllables('')).toBe(0);
    });

    it('should handle whitespace-only string', () => {
        expect(countLineSyllables('   ')).toBe(0);
    });

    it('should handle a full lyric line', () => {
        const count = countLineSyllables('Walking down the midnight road');
        // walking(2) + down(1) + the(1) + midnight(2) + road(1) = 7
        expect(count).toBeGreaterThanOrEqual(5);
        expect(count).toBeLessThanOrEqual(9);
    });

    it('should handle multiple spaces between words', () => {
        const count = countLineSyllables('big    cat');
        expect(count).toBe(2);
    });

    it('should return consistent results across multiple calls', () => {
        const line = 'Hold on tight to the light';
        const count1 = countLineSyllables(line);
        const count2 = countLineSyllables(line);
        expect(count1).toBe(count2);
    });

    it('should handle long lines', () => {
        const line = 'she sells sea shells by the sea shore on a bright summer day';
        const count = countLineSyllables(line);
        expect(count).toBeGreaterThan(8);
    });
});
