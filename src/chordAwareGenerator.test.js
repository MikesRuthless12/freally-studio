/**
 * ChordAwareGenerator — Comprehensive Unit Tests
 * Tests chord-aware melody and bass generation
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Mock Web Audio globals needed by some imports
class MockStereoPanner { constructor() { this.pan = { value: 0 }; } connect() { return this; } }
class MockAudioContext { createStereoPanner() { return new MockStereoPanner(); } }

beforeEach(() => {
    globalThis.window = globalThis.window || globalThis;
    window.AudioContext = MockAudioContext;
    window.sharedAnalysisCtx = new MockAudioContext();
});

describe('ChordAwareGenerator', () => {
    let ChordAwareGenerator;

    beforeEach(async () => {
        const mod = await import('./ChordAwareGenerator.js');
        ChordAwareGenerator = mod.ChordAwareGenerator || mod.default;
    });

    it('should be importable', () => {
        expect(ChordAwareGenerator).toBeDefined();
    });

    it('should construct without error', () => {
        const gen = new ChordAwareGenerator();
        expect(gen).toBeDefined();
    });

    // ── getScaleNotes ──────────────────────────────────────────────────

    describe('getScaleNotes', () => {
        it('should return scale notes for C Major', () => {
            const gen = new ChordAwareGenerator();
            const notes = gen.getScaleNotes('C', 'Major', 4);
            expect(notes.length).toBeGreaterThanOrEqual(7);
            // Octave 4 starts at 12*4=48, so C4=48 in this system
            expect(notes).toContain(48);
        });

        it('should return notes in different octaves', () => {
            const gen = new ChordAwareGenerator();
            const notes3 = gen.getScaleNotes('C', 'Major', 3);
            const notes5 = gen.getScaleNotes('C', 'Major', 5);
            // Octave 5 notes should be 24 semitones above octave 3
            expect(notes5[0]).toBeGreaterThan(notes3[0]);
        });
    });

    // ── generateChordProgression ───────────────────────────────────────

    describe('generateChordProgression', () => {
        it('should generate a non-empty chord progression', () => {
            const gen = new ChordAwareGenerator();
            const chords = gen.generateChordProgression('C', 'Major', 4, 'simple');
            expect(Array.isArray(chords)).toBe(true);
            expect(chords.length).toBeGreaterThan(0);
        });

        it('each chord should have required properties', () => {
            const gen = new ChordAwareGenerator();
            const chords = gen.generateChordProgression('C', 'Major', 4, 'simple');
            for (const chord of chords) {
                expect(chord).toHaveProperty('time');
                expect(chord).toHaveProperty('duration');
                expect(chord).toHaveProperty('notes'); // array of MIDI notes
                expect(chord).toHaveProperty('velocity');
                expect(Number.isFinite(chord.time)).toBe(true);
                expect(Array.isArray(chord.notes)).toBe(true);
            }
        });

        it('should work with all 12 keys', () => {
            const gen = new ChordAwareGenerator();
            const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            for (const key of keys) {
                const chords = gen.generateChordProgression(key, 'Major', 4, 'simple');
                expect(chords.length, `Key ${key} should produce chords`).toBeGreaterThan(0);
            }
        });

        it('should work with different bar counts', () => {
            const gen = new ChordAwareGenerator();
            for (const bars of [4, 8, 16]) {
                const chords = gen.generateChordProgression('C', 'Minor', bars, 'simple');
                expect(chords.length, `${bars} bars should produce chords`).toBeGreaterThan(0);
                for (const chord of chords) {
                    expect(chord.time).toBeLessThan(bars * 32);
                }
            }
        });
    });

    // ── generateMelody ────────────────────────��────────────────────────

    describe('generateMelody', () => {
        it('should generate melody from chord progression', () => {
            const gen = new ChordAwareGenerator();
            const chords = gen.generateChordProgression('C', 'Minor', 4, 'simple');
            const melody = gen.generateMelody(chords, 'C', 'Minor', 'simple');
            expect(Array.isArray(melody)).toBe(true);
            expect(melody.length).toBeGreaterThan(0);
        });

        it('melody notes should have valid properties', () => {
            const gen = new ChordAwareGenerator();
            const chords = gen.generateChordProgression('C', 'Major', 4, 'simple');
            const melody = gen.generateMelody(chords, 'C', 'Major', 'simple');
            for (const note of melody) {
                expect(note).toHaveProperty('time');
                expect(note).toHaveProperty('duration');
                expect(note).toHaveProperty('note');
                expect(note).toHaveProperty('velocity');
                expect(note.note).toBeGreaterThanOrEqual(0);
                expect(note.note).toBeLessThanOrEqual(127);
                expect(note.velocity).toBeGreaterThan(0);
                expect(note.velocity).toBeLessThanOrEqual(1);
            }
        });
    });

    // ── generateBassline ────────────────────────────────────────��──────

    describe('generateBassline', () => {
        it('should generate bassline from chord progression', () => {
            const gen = new ChordAwareGenerator();
            const chords = gen.generateChordProgression('C', 'Minor', 4, 'simple');
            const bass = gen.generateBassline(chords, 'C', 'Minor', 'simple');
            expect(Array.isArray(bass)).toBe(true);
            expect(bass.length).toBeGreaterThan(0);
        });

        it('bass notes should be in low register', () => {
            const gen = new ChordAwareGenerator();
            const chords = gen.generateChordProgression('C', 'Minor', 4, 'simple');
            const bass = gen.generateBassline(chords, 'C', 'Minor', 'simple');
            for (const note of bass) {
                expect(note.note).toBeLessThanOrEqual(72);
            }
        });

        it('bass notes should have valid fields', () => {
            const gen = new ChordAwareGenerator();
            const chords = gen.generateChordProgression('C', 'Major', 4, 'simple');
            const bass = gen.generateBassline(chords, 'C', 'Major', 'simple');
            for (const note of bass) {
                expect(Number.isFinite(note.time)).toBe(true);
                expect(Number.isFinite(note.duration)).toBe(true);
                expect(Number.isFinite(note.note)).toBe(true);
                expect(Number.isFinite(note.velocity)).toBe(true);
            }
        });
    });

    // ── getChordAtTime ─────────────────────────────────────────────────

    describe('getChordAtTime', () => {
        it('should find chord at given time position', () => {
            const gen = new ChordAwareGenerator();
            const chords = [
                { time: 0, duration: 32, note: 60, velocity: 0.7 },
                { time: 32, duration: 32, note: 64, velocity: 0.7 },
            ];
            const chord = gen.getChordAtTime(chords, 10);
            expect(chord).toBeDefined();
            expect(chord.time).toBe(0);
        });

        it('should return correct chord at boundary', () => {
            const gen = new ChordAwareGenerator();
            const chords = [
                { time: 0, duration: 32, note: 60, velocity: 0.7 },
                { time: 32, duration: 32, note: 64, velocity: 0.7 },
            ];
            const chord = gen.getChordAtTime(chords, 32);
            expect(chord).toBeDefined();
            expect(chord.time).toBe(32);
        });
    });

    // ── Full pipeline test ─────────────────────────────────────────────

    describe('Full generation pipeline', () => {
        it('should generate coherent chords, melody, and bass for any key/scale', () => {
            const gen = new ChordAwareGenerator();
            const keys = ['C', 'D', 'F#', 'A'];
            const scales = ['Major', 'Minor'];

            for (const key of keys) {
                for (const scale of scales) {
                    const chords = gen.generateChordProgression(key, scale, 4, 'simple');
                    expect(chords.length, `${key} ${scale} chords`).toBeGreaterThan(0);

                    const melody = gen.generateMelody(chords, key, scale, 'simple');
                    expect(melody.length, `${key} ${scale} melody`).toBeGreaterThan(0);

                    const bass = gen.generateBassline(chords, key, scale, 'simple');
                    expect(bass.length, `${key} ${scale} bass`).toBeGreaterThan(0);

                    // Chords have 'notes' array, melody/bass have 'note' number
                    for (const c of chords) {
                        expect(Array.isArray(c.notes), `Chord missing notes array in ${key} ${scale}`).toBe(true);
                        for (const n of c.notes) {
                            expect(Number.isFinite(n), `NaN chord note in ${key} ${scale}`).toBe(true);
                        }
                    }
                    for (const n of [...melody, ...bass]) {
                        expect(Number.isFinite(n.note), `NaN note in ${key} ${scale}`).toBe(true);
                        expect(Number.isFinite(n.time), `NaN time in ${key} ${scale}`).toBe(true);
                    }
                }
            }
        });
    });
});
