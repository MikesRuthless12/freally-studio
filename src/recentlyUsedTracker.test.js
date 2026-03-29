/**
 * RecentlyUsedTracker — Comprehensive Unit Tests
 * Tests anti-repeat system for generators
 */
import { describe, it, expect, beforeEach } from 'vitest';
import RecentlyUsedTracker, { tracker } from './RecentlyUsedTracker';

describe('RecentlyUsedTracker', () => {
    let t;

    beforeEach(() => {
        t = new RecentlyUsedTracker(50);
    });

    // ── Constructor ────────────────────────────────────────────────────

    it('should create instance with default history size', () => {
        const defaultTracker = new RecentlyUsedTracker();
        expect(defaultTracker.historySize).toBe(50);
    });

    it('should create instance with custom history size', () => {
        const custom = new RecentlyUsedTracker(10);
        expect(custom.historySize).toBe(10);
    });

    // ── pick ────────────���───────────────────────��──────────────────────

    it('should return undefined for empty options', () => {
        expect(t.pick('test', [])).toBeUndefined();
        expect(t.pick('test', null)).toBeUndefined();
        expect(t.pick('test', undefined)).toBeUndefined();
    });

    it('should return the only item for single-element array', () => {
        expect(t.pick('test', ['only'])).toBe('only');
    });

    it('should return an item from the options', () => {
        const options = ['a', 'b', 'c', 'd'];
        const result = t.pick('test', options);
        expect(options).toContain(result);
    });

    it('should avoid repeating the same item', () => {
        const options = ['a', 'b', 'c', 'd', 'e'];
        const picks = [];
        for (let i = 0; i < 4; i++) {
            picks.push(t.pick('test', options));
        }
        // With 5 options and 4 picks, each pick should be different
        const unique = new Set(picks);
        expect(unique.size).toBeGreaterThanOrEqual(3); // at least 3 unique
    });

    it('should eventually repeat when all options exhausted', () => {
        const options = ['a', 'b'];
        const picks = [];
        for (let i = 0; i < 10; i++) {
            picks.push(t.pick('test', options));
        }
        // Both options should appear
        expect(picks).toContain('a');
        expect(picks).toContain('b');
    });

    it('should track different categories independently', () => {
        const opts1 = ['x', 'y'];
        const opts2 = [1, 2, 3, 4, 5];

        // Pick from category 1
        t.pick('cat1', opts1);

        // Category 2 should be unaffected
        const result2 = t.pick('cat2', opts2);
        expect(opts2).toContain(result2);
    });

    it('should handle large option arrays', () => {
        const options = Array.from({ length: 100 }, (_, i) => `item_${i}`);
        const picks = new Set();
        for (let i = 0; i < 50; i++) {
            picks.add(t.pick('large', options));
        }
        // Should have many unique picks
        expect(picks.size).toBeGreaterThan(30);
    });

    // ── reset ──────────────────────────────────────────────────────────

    it('should reset specific category', () => {
        const options = ['a', 'b', 'c'];
        // Fill up history
        for (let i = 0; i < 3; i++) t.pick('cat1', options);

        t.reset('cat1');

        // After reset, history should be empty for cat1
        expect(t.history['cat1']).toBeUndefined();
    });

    it('should reset all categories when no key given', () => {
        t.pick('cat1', ['a', 'b']);
        t.pick('cat2', ['x', 'y']);

        t.reset();

        expect(t.history).toEqual({});
    });

    it('should not affect other categories when resetting one', () => {
        t.pick('cat1', ['a', 'b']);
        t.pick('cat2', ['x', 'y']);

        t.reset('cat1');

        expect(t.history['cat1']).toBeUndefined();
        expect(t.history['cat2']).toBeDefined();
    });

    // ── Singleton ──────��───────────────────────────────────────────────

    it('should export a singleton tracker instance', () => {
        expect(tracker).toBeInstanceOf(RecentlyUsedTracker);
        expect(tracker.historySize).toBe(50);
    });

    it('singleton should function correctly', () => {
        tracker.reset();
        const result = tracker.pick('singleton_test', ['a', 'b', 'c']);
        expect(['a', 'b', 'c']).toContain(result);
        tracker.reset('singleton_test');
    });
});
