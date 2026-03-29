/**
 * randomFileUtils — Comprehensive Unit Tests
 * Tests shuffleArray (collectAudioFiles and collectMidiFiles need File System Access API)
 */
import { describe, it, expect } from 'vitest';
import { shuffleArray } from './randomFileUtils';

describe('shuffleArray', () => {
    it('should return a new array (not mutate original)', () => {
        const original = [1, 2, 3, 4, 5];
        const shuffled = shuffleArray(original);
        expect(shuffled).not.toBe(original);
        expect(original).toEqual([1, 2, 3, 4, 5]);
    });

    it('should contain all original elements', () => {
        const original = [1, 2, 3, 4, 5];
        const shuffled = shuffleArray(original);
        expect(shuffled.sort()).toEqual(original.sort());
    });

    it('should have same length as original', () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        expect(shuffleArray(arr)).toHaveLength(10);
    });

    it('should handle empty array', () => {
        expect(shuffleArray([])).toEqual([]);
    });

    it('should handle single element', () => {
        expect(shuffleArray([42])).toEqual([42]);
    });

    it('should handle two elements', () => {
        const result = shuffleArray([1, 2]);
        expect(result).toHaveLength(2);
        expect(result).toContain(1);
        expect(result).toContain(2);
    });

    it('should produce different orderings over many runs', () => {
        const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const results = new Set();
        for (let i = 0; i < 20; i++) {
            results.add(shuffleArray(original).join(','));
        }
        // With 10 elements, 20 shuffles should produce multiple unique orderings
        expect(results.size).toBeGreaterThan(1);
    });

    it('should handle array of objects', () => {
        const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const shuffled = shuffleArray(arr);
        expect(shuffled).toHaveLength(3);
        const ids = shuffled.map(o => o.id).sort();
        expect(ids).toEqual([1, 2, 3]);
    });

    it('should handle array of strings', () => {
        const arr = ['kick.wav', 'snare.wav', 'hat.wav'];
        const shuffled = shuffleArray(arr);
        expect(shuffled).toHaveLength(3);
        expect(shuffled.sort()).toEqual(arr.sort());
    });
});
