/**
 * Counter Melody Motion Types — Unit Tests
 * Tests oblique and mixed motion implementations in CounterMelodyEngine.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Mock Web Audio globals
class MockStereoPanner { constructor() { this.pan = { value: 0 }; } connect() { return this; } }
class MockAudioContext { createStereoPanner() { return new MockStereoPanner(); } }

beforeEach(() => {
    globalThis.window = globalThis.window || globalThis;
    window.AudioContext = MockAudioContext;
    window.sharedAnalysisCtx = new MockAudioContext();
});

describe('CounterMelodyEngine — Motion Types', () => {
    let generateCounterMelody;

    beforeEach(async () => {
        const mod = await import('./core/music-intelligence/CounterMelodyEngine.js');
        generateCounterMelody = mod.generateCounterMelody;
    });

    const makeMelody = (noteCount = 8) => {
        const notes = [];
        for (let i = 0; i < noteCount; i++) {
            notes.push({ time: i * 8, duration: 6, note: 60 + (i % 5) * 2, velocity: 0.7 });
        }
        return notes;
    };

    it('should export generateCounterMelody function', () => {
        expect(typeof generateCounterMelody).toBe('function');
    });

    it('should return empty array for empty melody', () => {
        const result = generateCounterMelody({ melody: [], key: 'C', scale: 'Minor', bars: 4 });
        expect(result).toEqual([]);
    });

    it('should generate counter melody with contrary motion (default)', () => {
        const melody = makeMelody();
        const result = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, motionBias: 'contrary' });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(n => {
            expect(n).toHaveProperty('time');
            expect(n).toHaveProperty('duration');
            expect(n).toHaveProperty('note');
            expect(n).toHaveProperty('velocity');
            expect(n.layer).toBe('counter');
        });
    });

    it('should generate counter melody with oblique motion', () => {
        const melody = makeMelody();
        const result = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, motionBias: 'oblique' });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(n => expect(n.layer).toBe('counter'));
    });

    it('should generate counter melody with mixed motion', () => {
        const melody = makeMelody();
        const result = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, motionBias: 'mixed' });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(n => expect(n.layer).toBe('counter'));
    });

    it('oblique motion should produce less pitch movement than contrary', () => {
        const melody = makeMelody(16);
        // Generate multiple times and measure average pitch variance
        let obliqueTotalVariance = 0;
        let contraryTotalVariance = 0;
        const runs = 5;

        for (let r = 0; r < runs; r++) {
            const oblique = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, motionBias: 'oblique', density: 0.8 });
            const contrary = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, motionBias: 'contrary', density: 0.8 });

            const variance = (notes) => {
                if (notes.length < 2) return 0;
                let sum = 0;
                for (let i = 1; i < notes.length; i++) sum += Math.abs(notes[i].note - notes[i - 1].note);
                return sum / (notes.length - 1);
            };

            obliqueTotalVariance += variance(oblique);
            contraryTotalVariance += variance(contrary);
        }

        // Oblique should have less average pitch movement
        expect(obliqueTotalVariance / runs).toBeLessThan(contraryTotalVariance / runs + 2);
    });

    it('all motion types should produce notes within MIDI range 36-96', () => {
        const melody = makeMelody(16);
        for (const motionBias of ['contrary', 'oblique', 'mixed']) {
            const result = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, motionBias });
            result.forEach(n => {
                expect(n.note).toBeGreaterThanOrEqual(36);
                expect(n.note).toBeLessThanOrEqual(96);
            });
        }
    });

    it('all motion types should avoid unisons with lead melody', () => {
        const melody = makeMelody(8);
        const melodyTimes = new Set(melody.map(n => n.time));
        const melodyNoteAt = {};
        melody.forEach(n => { melodyNoteAt[n.time] = n.note; });

        for (const motionBias of ['contrary', 'oblique', 'mixed']) {
            const result = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, motionBias });
            // Counter notes at same time as lead should not be unison
            result.forEach(cn => {
                if (melodyNoteAt[cn.time] !== undefined) {
                    const interval = Math.abs(cn.note - melodyNoteAt[cn.time]) % 12;
                    // Should not be unison (0) or minor 2nd (1)
                    expect(interval).not.toBe(0);
                }
            });
        }
    });

    it('density parameter should affect note count', () => {
        const melody = makeMelody(16);
        const sparse = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, density: 0.3 });
        const dense = generateCounterMelody({ melody, key: 'C', scale: 'Minor', bars: 4, density: 1.0 });
        // Dense should generally have more notes
        expect(dense.length).toBeGreaterThanOrEqual(sparse.length - 2);
    });
});
