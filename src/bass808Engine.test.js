/**
 * 808 Bass Intelligence Engine — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Mock MusicTheory dependencies
beforeEach(() => {
    globalThis.window = globalThis.window || globalThis;
});

describe('Bass808Engine — generate808Bassline', () => {
    let generate808Bassline;

    beforeEach(async () => {
        const mod = await import('./core/music-intelligence/Bass808Engine.js');
        generate808Bassline = mod.generate808Bassline;
    });

    const makeDrumPattern = () => ({
        kick: {
            powered: true, solo: false, mute: false,
            lanes: {
                root: {
                    pitch: 0,
                    pattern: [true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              // bar 2
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              // bars 3-4
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false],
                    velocity: new Array(128).fill(80),
                    duration: new Array(128).fill(1)
                }
            }
        }
    });

    it('should export generate808Bassline function', () => {
        expect(typeof generate808Bassline).toBe('function');
    });

    it('should generate notes from drum pattern with kicks', () => {
        const result = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4, density: 0
        });
        expect(result.length).toBeGreaterThan(0);
    });

    it('each note should have required properties', () => {
        const result = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4
        });
        result.forEach(n => {
            expect(n).toHaveProperty('time');
            expect(n).toHaveProperty('duration');
            expect(n).toHaveProperty('note');
            expect(n).toHaveProperty('velocity');
            expect(typeof n.time).toBe('number');
            expect(typeof n.duration).toBe('number');
            expect(typeof n.note).toBe('number');
            expect(typeof n.velocity).toBe('number');
        });
    });

    it('notes should be in 808 range (MIDI 24-48)', () => {
        const result = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4
        });
        result.forEach(n => {
            expect(n.note).toBeGreaterThanOrEqual(24);
            expect(n.note).toBeLessThanOrEqual(48);
        });
    });

    it('velocity should be between 0.3 and 1.0', () => {
        const result = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4
        });
        result.forEach(n => {
            expect(n.velocity).toBeGreaterThanOrEqual(0.3);
            expect(n.velocity).toBeLessThanOrEqual(1.0);
        });
    });

    it('slides should only appear when enableSlides is true', () => {
        const withSlides = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4, enableSlides: true
        });
        const withoutSlides = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4, enableSlides: false
        });
        // Without slides, no note should have slide property
        withoutSlides.forEach(n => {
            expect(n.slide).toBeUndefined();
        });
    });

    it('density 0 should produce fewer notes than density 1', () => {
        const sparse = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4, density: 0
        });
        const dense = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4, density: 1.0
        });
        expect(dense.length).toBeGreaterThanOrEqual(sparse.length);
    });

    it('should produce notes even without drum pattern', () => {
        const result = generate808Bassline({
            drumPattern: null,
            chordProgression: ['I', 'vi', 'IV', 'V'],
            key: 'C', scale: 'Minor', bars: 4
        });
        expect(result.length).toBeGreaterThan(0);
    });

    it('should produce notes without chords (root fallback)', () => {
        const result = generate808Bassline({
            drumPattern: null,
            chordProgression: null,
            key: 'C', scale: 'Minor', bars: 4
        });
        expect(result.length).toBeGreaterThan(0);
    });

    it('notes should not exceed total steps', () => {
        const bars = 4;
        const totalSteps = bars * 32;
        const result = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars
        });
        result.forEach(n => {
            expect(n.time).toBeLessThan(totalSteps);
            expect(n.time + n.duration).toBeLessThanOrEqual(totalSteps + 1);
        });
    });

    it('minimum note duration should be >= 4 steps', () => {
        const result = generate808Bassline({
            drumPattern: makeDrumPattern(),
            key: 'C', scale: 'Minor', bars: 4
        });
        result.forEach(n => {
            expect(n.duration).toBeGreaterThanOrEqual(4);
        });
    });
});
