/**
 * patternUtils — Comprehensive Unit Tests
 * Tests loopMelodicPattern, loopDrumPattern, loopAllPatterns
 */
import { describe, it, expect } from 'vitest';
import { loopMelodicPattern, loopDrumPattern, loopAllPatterns } from './patternUtils';

// ── loopMelodicPattern ���──────────────���─────────────────────────────────────

describe('loopMelodicPattern', () => {
    const sampleNotes = [
        { time: 0, duration: 8, note: 60, velocity: 0.7 },
        { time: 16, duration: 8, note: 64, velocity: 0.8 },
        { time: 32, duration: 16, note: 67, velocity: 0.6 },
        { time: 64, duration: 32, note: 72, velocity: 0.9 },
    ];

    it('should return empty array for null input', () => {
        expect(loopMelodicPattern(null, 4, 8)).toEqual([]);
    });

    it('should return empty array for empty input', () => {
        expect(loopMelodicPattern([], 4, 8)).toEqual([]);
    });

    it('should return empty array for zero bars', () => {
        expect(loopMelodicPattern(sampleNotes, 0, 4)).toEqual([]);
        expect(loopMelodicPattern(sampleNotes, 4, 0)).toEqual([]);
    });

    it('should return copy when oldBars === newBars', () => {
        const result = loopMelodicPattern(sampleNotes, 4, 4);
        expect(result).toHaveLength(sampleNotes.length);
        expect(result).not.toBe(sampleNotes); // different reference
        expect(result[0].time).toBe(0);
        expect(result[0].note).toBe(60);
    });

    it('should truncate when shrinking (8 bars ��� 4 bars)', () => {
        const notes = [
            { time: 0, duration: 8, note: 60, velocity: 0.7 },
            { time: 64, duration: 8, note: 64, velocity: 0.7 },
            { time: 200, duration: 8, note: 67, velocity: 0.7 }, // beyond 4 bars (128 steps)
        ];
        const result = loopMelodicPattern(notes, 8, 4);
        expect(result).toHaveLength(2); // only first two fit in 128 steps
        expect(result.every(n => n.time < 128)).toBe(true);
    });

    it('should clamp duration when note extends past newSteps boundary', () => {
        const notes = [
            { time: 120, duration: 32, note: 60, velocity: 0.7 }, // extends past 128
        ];
        const result = loopMelodicPattern(notes, 8, 4);
        expect(result).toHaveLength(1);
        expect(result[0].duration).toBe(8); // clamped to 128 - 120
    });

    it('should loop when extending (4 bars → 8 bars)', () => {
        const notes = [
            { time: 0, duration: 8, note: 60, velocity: 0.7 },
            { time: 64, duration: 8, note: 64, velocity: 0.8 },
        ];
        const result = loopMelodicPattern(notes, 4, 8);
        // 4 bars = 128 steps, 8 bars = 256 steps
        // Pass 0: time 0, 64; Pass 1: time 128, 192
        expect(result).toHaveLength(4);
        expect(result[2].time).toBe(128);
        expect(result[3].time).toBe(192);
    });

    it('should loop when extending (4 bars → 16 bars)', () => {
        const notes = [
            { time: 0, duration: 8, note: 60, velocity: 0.7 },
        ];
        const result = loopMelodicPattern(notes, 4, 16);
        // 4 passes: 0, 128, 256, 384
        expect(result).toHaveLength(4);
        expect(result.map(n => n.time)).toEqual([0, 128, 256, 384]);
    });

    it('should preserve note/velocity when looping', () => {
        const notes = [
            { time: 10, duration: 5, note: 72, velocity: 0.85 },
        ];
        const result = loopMelodicPattern(notes, 4, 8);
        expect(result[1].note).toBe(72);
        expect(result[1].velocity).toBe(0.85);
    });

    it('should not mutate original array', () => {
        const notes = [{ time: 0, duration: 8, note: 60, velocity: 0.7 }];
        const original = JSON.parse(JSON.stringify(notes));
        loopMelodicPattern(notes, 4, 8);
        expect(notes).toEqual(original);
    });
});

// ── loopDrumPattern ────────────────────────────────────────────────────────

describe('loopDrumPattern', () => {
    const makeDrums = (steps = 128) => ({
        kick: {
            powered: true, solo: false, mute: false, sample: 'kick.wav',
            lanes: {
                root: {
                    pitch: 0,
                    pattern: Array.from({ length: steps }, (_, i) => i % 8 === 0),
                    velocity: new Array(steps).fill(100),
                    duration: new Array(steps).fill(1),
                }
            }
        },
        snare: {
            powered: true, solo: false, mute: false, sample: 'snare.wav',
            lanes: {
                root: {
                    pitch: 0,
                    pattern: Array.from({ length: steps }, (_, i) => i % 16 === 8),
                    velocity: new Array(steps).fill(90),
                    duration: new Array(steps).fill(1),
                }
            }
        }
    });

    it('should return input for null/undefined drums', () => {
        expect(loopDrumPattern(null, 4, 8)).toBeNull();
        expect(loopDrumPattern(undefined, 4, 8)).toBeUndefined();
    });

    it('should return deep copy when oldBars === newBars', () => {
        const drums = makeDrums();
        const result = loopDrumPattern(drums, 4, 4);
        expect(result).not.toBe(drums);
        expect(result.kick.lanes.root.pattern).toHaveLength(128);
    });

    it('should truncate patterns when shrinking', () => {
        const drums = makeDrums(256); // 8 bars
        const result = loopDrumPattern(drums, 8, 4);
        expect(result.kick.lanes.root.pattern).toHaveLength(128);
        expect(result.kick.lanes.root.velocity).toHaveLength(128);
        expect(result.kick.lanes.root.duration).toHaveLength(128);
    });

    it('should extend patterns when growing', () => {
        const drums = makeDrums(128); // 4 bars
        const result = loopDrumPattern(drums, 4, 8);
        expect(result.kick.lanes.root.pattern).toHaveLength(256);
        expect(result.snare.lanes.root.pattern).toHaveLength(256);
    });

    it('looped patterns should tile correctly', () => {
        const drums = makeDrums(128);
        const result = loopDrumPattern(drums, 4, 8);
        // The pattern from index 128-255 should mirror 0-127
        for (let i = 0; i < 128; i++) {
            expect(result.kick.lanes.root.pattern[128 + i]).toBe(
                result.kick.lanes.root.pattern[i]
            );
        }
    });

    it('should preserve drum metadata (powered, solo, mute, sample)', () => {
        const drums = makeDrums();
        const result = loopDrumPattern(drums, 4, 8);
        expect(result.kick.powered).toBe(true);
        expect(result.kick.sample).toBe('kick.wav');
        expect(result.snare.powered).toBe(true);
    });

    it('should not mutate original drums', () => {
        const drums = makeDrums();
        const origLength = drums.kick.lanes.root.pattern.length;
        loopDrumPattern(drums, 4, 8);
        expect(drums.kick.lanes.root.pattern.length).toBe(origLength);
    });
});

// ─��� loopAllPatterns ────────────���───────────────────────────────────────────

describe('loopAllPatterns', () => {
    it('should return null/undefined for null/undefined input', () => {
        expect(loopAllPatterns(null, 4, 8)).toBeNull();
        expect(loopAllPatterns(undefined, 4, 8)).toBeUndefined();
    });

    it('should loop all pattern types', () => {
        const patterns = {
            drums: {
                kick: {
                    powered: true, solo: false, mute: false,
                    lanes: {
                        root: {
                            pitch: 0,
                            pattern: new Array(128).fill(false),
                            velocity: new Array(128).fill(100),
                            duration: new Array(128).fill(1),
                        }
                    }
                }
            },
            chords: [{ time: 0, duration: 32, note: 60, velocity: 0.7 }],
            melody: [{ time: 0, duration: 8, note: 72, velocity: 0.8 }],
            bass: [{ time: 0, duration: 16, note: 36, velocity: 0.6 }],
        };

        const result = loopAllPatterns(patterns, 4, 8);
        expect(result.drums.kick.lanes.root.pattern).toHaveLength(256);
        expect(result.chords.length).toBeGreaterThanOrEqual(2);
        expect(result.melody.length).toBeGreaterThanOrEqual(2);
        expect(result.bass.length).toBeGreaterThanOrEqual(2);
    });

    it('should preserve extra pattern keys', () => {
        const patterns = {
            chords: [{ time: 0, duration: 8, note: 60, velocity: 0.7 }],
            customInstrument: 'some-data',
        };
        const result = loopAllPatterns(patterns, 4, 8);
        expect(result.customInstrument).toBe('some-data');
    });

    it('should handle partial patterns object', () => {
        const patterns = {
            melody: [{ time: 0, duration: 8, note: 72, velocity: 0.8 }],
        };
        const result = loopAllPatterns(patterns, 4, 8);
        expect(result.melody.length).toBeGreaterThanOrEqual(2);
        expect(result.drums).toBeUndefined();
    });
});
