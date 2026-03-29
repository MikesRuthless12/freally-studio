/**
 * MusicTheory — Comprehensive Unit Tests
 * Tests all exported functions and constants from MusicTheory.js
 */
import { describe, it, expect } from 'vitest';
import {
    NOTE_NAMES, SCALES, CHORD_TYPES, ROMAN_TO_CHORD, CHORD_PROGRESSIONS,
    getMIDINote, getNoteName, getOctave, getScaleNotes,
    isNoteInScale, getChordNotes, quantizeToScale,
    getChordProgressionForGenre, generateMelodyNotes, generateBassline
} from './MusicTheory';

// ── NOTE_NAMES constant ─────��──────────────────────────────────────────────

describe('NOTE_NAMES', () => {
    it('should have exactly 12 note names', () => {
        expect(NOTE_NAMES).toHaveLength(12);
    });

    it('should start with C and contain all chromatic notes', () => {
        expect(NOTE_NAMES[0]).toBe('C');
        expect(NOTE_NAMES).toContain('C');
        expect(NOTE_NAMES).toContain('D');
        expect(NOTE_NAMES).toContain('E');
        expect(NOTE_NAMES).toContain('F');
        expect(NOTE_NAMES).toContain('G');
        expect(NOTE_NAMES).toContain('A');
        expect(NOTE_NAMES).toContain('B');
    });

    it('should contain sharps (C#, D#, F#, G#, A#)', () => {
        expect(NOTE_NAMES).toContain('C#');
        expect(NOTE_NAMES).toContain('D#');
        expect(NOTE_NAMES).toContain('F#');
        expect(NOTE_NAMES).toContain('G#');
        expect(NOTE_NAMES).toContain('A#');
    });
});

// ── SCALES constant ─────��──────────────────────────────────────────────────

describe('SCALES', () => {
    it('should contain Major and Minor scales', () => {
        expect(SCALES['Major']).toBeDefined();
        expect(SCALES['Minor']).toBeDefined();
    });

    it('Major scale should have correct intervals [0,2,4,5,7,9,11]', () => {
        expect(SCALES['Major']).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('Minor scale should have correct intervals [0,2,3,5,7,8,10]', () => {
        expect(SCALES['Minor']).toEqual([0, 2, 3, 5, 7, 8, 10]);
    });

    it('every scale should be an array of numbers', () => {
        for (const [name, intervals] of Object.entries(SCALES)) {
            expect(Array.isArray(intervals), `${name} should be an array`).toBe(true);
            for (const i of intervals) {
                expect(typeof i, `${name} interval should be number`).toBe('number');
                expect(i).toBeGreaterThanOrEqual(0);
                expect(i).toBeLessThan(12);
            }
        }
    });

    it('every scale should start with 0 (root)', () => {
        for (const [name, intervals] of Object.entries(SCALES)) {
            expect(intervals[0], `${name} should start with 0`).toBe(0);
        }
    });

    it('should contain common modes', () => {
        const modes = ['Dorian', 'Phrygian', 'Lydian', 'Mixolydian'];
        for (const mode of modes) {
            expect(SCALES[mode], `Missing mode: ${mode}`).toBeDefined();
        }
    });

    it('should contain pentatonic and blues scales', () => {
        const names = ['Major Pentatonic', 'Minor Pentatonic', 'Blues'];
        for (const name of names) {
            expect(SCALES[name], `Missing scale: ${name}`).toBeDefined();
        }
    });

    it('pentatonic scales should have 5 notes', () => {
        if (SCALES['Major Pentatonic']) expect(SCALES['Major Pentatonic']).toHaveLength(5);
        if (SCALES['Minor Pentatonic']) expect(SCALES['Minor Pentatonic']).toHaveLength(5);
    });

    it('should have at least 10 scale types', () => {
        expect(Object.keys(SCALES).length).toBeGreaterThanOrEqual(10);
    });
});

// ── CHORD_TYPES constant ────────���──────────────────────────────────────────

describe('CHORD_TYPES', () => {
    it('should contain basic chord types', () => {
        expect(CHORD_TYPES['major']).toBeDefined();
        expect(CHORD_TYPES['minor']).toBeDefined();
    });

    it('major triad should be [0, 4, 7]', () => {
        expect(CHORD_TYPES['major']).toEqual([0, 4, 7]);
    });

    it('minor triad should be [0, 3, 7]', () => {
        expect(CHORD_TYPES['minor']).toEqual([0, 3, 7]);
    });

    it('every chord type should be an array of integers', () => {
        for (const [name, intervals] of Object.entries(CHORD_TYPES)) {
            expect(Array.isArray(intervals), `${name} should be array`).toBe(true);
            expect(intervals.length, `${name} should have notes`).toBeGreaterThanOrEqual(2);
            for (const i of intervals) {
                expect(typeof i).toBe('number');
                expect(Number.isInteger(i)).toBe(true);
            }
        }
    });

    it('every chord type should start with 0 (root)', () => {
        for (const [name, intervals] of Object.entries(CHORD_TYPES)) {
            expect(intervals[0], `${name} should start on root`).toBe(0);
        }
    });
});

// ── ROMAN_TO_CHORD mapping ─────────────────────────��───────────────────────

describe('ROMAN_TO_CHORD', () => {
    it('should map standard major numerals', () => {
        expect(ROMAN_TO_CHORD['I']).toBeDefined();
        expect(ROMAN_TO_CHORD['IV']).toBeDefined();
        expect(ROMAN_TO_CHORD['V']).toBeDefined();
    });

    it('should map standard minor numerals', () => {
        expect(ROMAN_TO_CHORD['ii']).toBeDefined();
        expect(ROMAN_TO_CHORD['iii']).toBeDefined();
        expect(ROMAN_TO_CHORD['vi']).toBeDefined();
    });

    it('major numerals should map to major chord type', () => {
        expect(ROMAN_TO_CHORD['I']).toBe('major');
        expect(ROMAN_TO_CHORD['IV']).toBe('major');
        expect(ROMAN_TO_CHORD['V']).toBe('major');
    });

    it('minor numerals should map to minor chord type', () => {
        expect(ROMAN_TO_CHORD['ii']).toBe('minor');
        expect(ROMAN_TO_CHORD['iii']).toBe('minor');
        expect(ROMAN_TO_CHORD['vi']).toBe('minor');
    });

    it('every mapped chord type should exist in CHORD_TYPES', () => {
        for (const [roman, chordType] of Object.entries(ROMAN_TO_CHORD)) {
            if (chordType) {
                expect(CHORD_TYPES[chordType], `Missing CHORD_TYPES["${chordType}"] for ${roman}`).toBeDefined();
            }
        }
    });
});

// ── getMIDINote ─────────────────────────────────────────────────────────────

describe('getMIDINote', () => {
    it('should return 60 for middle C (C4)', () => {
        expect(getMIDINote('C', 4)).toBe(60);
    });

    it('should return 69 for A4 (concert pitch)', () => {
        expect(getMIDINote('A', 4)).toBe(69);
    });

    it('should return 0 for C-1 (lowest MIDI)', () => {
        expect(getMIDINote('C', -1)).toBe(0);
    });

    it('should return 127 for G9 (highest MIDI)', () => {
        expect(getMIDINote('G', 9)).toBe(127);
    });

    it('sharps should be one semitone above natural', () => {
        expect(getMIDINote('C#', 4)).toBe(61);
        expect(getMIDINote('F#', 4)).toBe(66);
    });

    it('octave change should be 12 semitones', () => {
        expect(getMIDINote('C', 5) - getMIDINote('C', 4)).toBe(12);
        expect(getMIDINote('A', 3) - getMIDINote('A', 2)).toBe(12);
    });

    it('all 12 notes in octave 4 should be sequential', () => {
        for (let i = 0; i < NOTE_NAMES.length; i++) {
            expect(getMIDINote(NOTE_NAMES[i], 4)).toBe(60 + i);
        }
    });
});

// ��─ getNoteName ────────────────────��────────────────────────────────────────

describe('getNoteName', () => {
    it('should return C for MIDI 60', () => {
        expect(getNoteName(60)).toBe('C');
    });

    it('should return A for MIDI 69', () => {
        expect(getNoteName(69)).toBe('A');
    });

    it('should return C# for MIDI 61', () => {
        expect(getNoteName(61)).toBe('C#');
    });

    it('should cycle through all 12 notes', () => {
        for (let i = 0; i < 12; i++) {
            expect(getNoteName(60 + i)).toBe(NOTE_NAMES[i]);
        }
    });

    it('should handle MIDI 0', () => {
        expect(getNoteName(0)).toBe('C');
    });

    it('should handle MIDI 127', () => {
        expect(getNoteName(127)).toBe('G');
    });
});

// ── getOctave ──────────��────────────────────────────────────────────────────

describe('getOctave', () => {
    it('should return 4 for MIDI 60 (middle C)', () => {
        expect(getOctave(60)).toBe(4);
    });

    it('should return -1 for MIDI 0', () => {
        expect(getOctave(0)).toBe(-1);
    });

    it('should return 9 for MIDI 127', () => {
        expect(getOctave(127)).toBe(9);
    });

    it('should increase by 1 every 12 semitones', () => {
        expect(getOctave(48)).toBe(3);
        expect(getOctave(60)).toBe(4);
        expect(getOctave(72)).toBe(5);
    });
});

// ── getScaleNotes ────────────────────────────────────────────��──────────────

describe('getScaleNotes', () => {
    it('should return correct C Major scale notes', () => {
        const notes = getScaleNotes('C', 'Major');
        // C Major = C, D, E, F, G, A, B → semitones 0,2,4,5,7,9,11
        expect(notes).toContain(0);
        expect(notes).toContain(2);
        expect(notes).toContain(4);
        expect(notes).toContain(5);
        expect(notes).toContain(7);
        expect(notes).toContain(9);
        expect(notes).toContain(11);
    });

    it('should return 7 notes for diatonic scales', () => {
        const cMajor = getScaleNotes('C', 'Major');
        expect(cMajor.filter(n => n < 12)).toHaveLength(7);
    });

    it('should transpose for different keys', () => {
        const dMajor = getScaleNotes('D', 'Major');
        // D = 2, so D Major starts at 2: 2,4,6,7,9,11,1
        expect(dMajor).toContain(2); // D
        expect(dMajor).toContain(4); // E
        expect(dMajor).toContain(6); // F#
    });

    it('should work with all 12 keys', () => {
        for (const key of NOTE_NAMES) {
            const notes = getScaleNotes(key, 'Major');
            expect(notes.length).toBeGreaterThanOrEqual(7);
        }
    });

    it('should work with all scale types', () => {
        for (const scaleName of Object.keys(SCALES)) {
            const notes = getScaleNotes('C', scaleName);
            expect(notes.length).toBeGreaterThanOrEqual(SCALES[scaleName].length);
        }
    });
});

// ── isNoteInScale ───────────────��────────────────────────────���──────────────

describe('isNoteInScale', () => {
    it('should return true for C in C Major', () => {
        expect(isNoteInScale(60, 'C', 'Major')).toBe(true);
    });

    it('should return true for E in C Major', () => {
        expect(isNoteInScale(64, 'C', 'Major')).toBe(true);
    });

    it('should return false for C# in C Major', () => {
        expect(isNoteInScale(61, 'C', 'Major')).toBe(false);
    });

    it('should return true for all notes in C Minor', () => {
        // C Minor = C, D, Eb, F, G, Ab, Bb → 0,2,3,5,7,8,10 (mod 12)
        const cMinorNotes = [60, 62, 63, 65, 67, 68, 70];
        for (const note of cMinorNotes) {
            expect(isNoteInScale(note, 'C', 'Minor'), `MIDI ${note} should be in C Minor`).toBe(true);
        }
    });

    it('should handle different octaves of the same note', () => {
        // C in different octaves should always be in C Major
        expect(isNoteInScale(24, 'C', 'Major')).toBe(true);
        expect(isNoteInScale(36, 'C', 'Major')).toBe(true);
        expect(isNoteInScale(48, 'C', 'Major')).toBe(true);
        expect(isNoteInScale(60, 'C', 'Major')).toBe(true);
        expect(isNoteInScale(72, 'C', 'Major')).toBe(true);
    });
});

// ── quantizeToScale ───────────────────────────────────────���─────────────────

describe('quantizeToScale', () => {
    it('should not change notes already in scale', () => {
        expect(quantizeToScale(60, 'C', 'Major')).toBe(60); // C
        expect(quantizeToScale(64, 'C', 'Major')).toBe(64); // E
    });

    it('should snap out-of-scale notes to nearest scale note', () => {
        const snapped = quantizeToScale(61, 'C', 'Major'); // C# → should snap to C(60) or D(62)
        expect([60, 62]).toContain(snapped);
    });

    it('should always return a note in the scale', () => {
        for (let midi = 36; midi <= 84; midi++) {
            const snapped = quantizeToScale(midi, 'C', 'Major');
            expect(isNoteInScale(snapped, 'C', 'Major'),
                `Quantized MIDI ${midi} → ${snapped} should be in C Major`
            ).toBe(true);
        }
    });

    it('should work with all keys', () => {
        for (const key of NOTE_NAMES) {
            const snapped = quantizeToScale(61, key, 'Minor');
            expect(isNoteInScale(snapped, key, 'Minor')).toBe(true);
        }
    });
});

// ── getChordNotes ───────────────────────────────────────────────────────────

describe('getChordNotes', () => {
    it('should return at least 3 notes for a triad', () => {
        const notes = getChordNotes('I', 'C', 'Major', 4);
        expect(notes.length).toBeGreaterThanOrEqual(3);
    });

    it('should return MIDI note numbers', () => {
        const notes = getChordNotes('I', 'C', 'Major', 4);
        for (const n of notes) {
            expect(typeof n).toBe('number');
            expect(Number.isFinite(n)).toBe(true);
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(127);
        }
    });

    it('C Major I chord should contain C, E, G', () => {
        const notes = getChordNotes('I', 'C', 'Major', 4);
        // Check note names (mod 12)
        const noteNames = notes.map(n => n % 12);
        expect(noteNames).toContain(0);  // C
        expect(noteNames).toContain(4);  // E
        expect(noteNames).toContain(7);  // G
    });

    it('should work with all Roman numerals in ROMAN_TO_CHORD', () => {
        for (const roman of Object.keys(ROMAN_TO_CHORD)) {
            const notes = getChordNotes(roman, 'C', 'Major', 4);
            expect(notes.length, `${roman} should produce notes`).toBeGreaterThan(0);
            for (const n of notes) {
                expect(Number.isFinite(n), `${roman} produced NaN`).toBe(true);
            }
        }
    });
});

// ── getChordProgressionForGenre ─────────────────────────────────────────────

describe('getChordProgressionForGenre', () => {
    it('should return a non-empty array of Roman numeral strings', () => {
        const prog = getChordProgressionForGenre('Pop', 'C', 'Major', 4, 'simple');
        expect(Array.isArray(prog)).toBe(true);
        expect(prog.length).toBeGreaterThan(0);
    });

    it('each element should be a Roman numeral string', () => {
        const prog = getChordProgressionForGenre('Pop', 'C', 'Major', 4, 'simple');
        for (const roman of prog) {
            expect(typeof roman).toBe('string');
            expect(roman.length).toBeGreaterThan(0);
        }
    });

    it('should work with different genres', () => {
        const genres = ['Pop', 'Hip Hop', 'Trap', 'Jazz', 'Rock', 'EDM'];
        for (const genre of genres) {
            const prog = getChordProgressionForGenre(genre, 'C', 'Major', 4, 'simple');
            expect(prog.length, `${genre} should generate chords`).toBeGreaterThan(0);
        }
    });

    it('should return exactly as many chords as bars requested', () => {
        for (const bars of [4, 8, 16]) {
            const prog = getChordProgressionForGenre('Pop', 'C', 'Major', bars, 'simple');
            expect(prog.length).toBe(bars);
        }
    });
});

// ── generateMelodyNotes ──────��──────────────────────────────────────────────

describe('generateMelodyNotes', () => {
    it('should return a non-empty array of notes', () => {
        const chords = getChordProgressionForGenre('Pop', 'C', 'Major', 4, 'simple');
        const melody = generateMelodyNotes('C', 'Major', chords, 4, 5, 'simple');
        expect(Array.isArray(melody)).toBe(true);
        expect(melody.length).toBeGreaterThan(0);
    });

    it('should return a flat step array (MIDI values and nulls)', () => {
        const chords = getChordProgressionForGenre('Pop', 'C', 'Major', 4, 'simple');
        const melody = generateMelodyNotes('C', 'Major', chords, 4, 5, 'simple');
        // generateMelodyNotes returns flat array: [null, null, 72, null, 67, ...]
        expect(melody.length).toBe(4 * 16); // bars * 16 steps
        const nonNull = melody.filter(v => v !== null);
        expect(nonNull.length).toBeGreaterThan(0);
        for (const midiVal of nonNull) {
            expect(typeof midiVal).toBe('number');
            expect(Number.isFinite(midiVal)).toBe(true);
        }
    });

    it('non-null entries should be valid MIDI range (0-127)', () => {
        const chords = getChordProgressionForGenre('Pop', 'C', 'Major', 4, 'simple');
        const melody = generateMelodyNotes('C', 'Major', chords, 4, 5, 'simple');
        const nonNull = melody.filter(v => v !== null);
        for (const val of nonNull) {
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(127);
        }
    });
});

// ── generateBassline ────────────────────────────────────────────────────────

describe('generateBassline', () => {
    it('should return a flat step array', () => {
        const chords = getChordProgressionForGenre('Pop', 'C', 'Major', 4, 'simple');
        const bass = generateBassline('C', 'Major', chords, 4, 2, 'simple');
        expect(Array.isArray(bass)).toBe(true);
        expect(bass.length).toBe(4 * 16); // bars * 16 steps
    });

    it('should contain some non-null MIDI values', () => {
        const chords = getChordProgressionForGenre('Pop', 'C', 'Major', 4, 'simple');
        const bass = generateBassline('C', 'Major', chords, 4, 2, 'simple');
        const nonNull = bass.filter(v => v !== null);
        expect(nonNull.length).toBeGreaterThan(0);
        for (const val of nonNull) {
            expect(typeof val).toBe('number');
            expect(Number.isFinite(val)).toBe(true);
        }
    });

    it('bass notes should be in low-mid register', () => {
        const chords = getChordProgressionForGenre('Pop', 'C', 'Major', 4, 'simple');
        const bass = generateBassline('C', 'Major', chords, 4, 2, 'simple');
        const nonNull = bass.filter(v => v !== null);
        for (const val of nonNull) {
            expect(val).toBeLessThanOrEqual(84); // generous upper bound
        }
    });
});

// ── CHORD_PROGRESSIONS exhaustive ──────────────────────────────────────────

describe('CHORD_PROGRESSIONS — exhaustive coverage', () => {
    it('should have progressions for both simple and complex', () => {
        const keys = Object.keys(CHORD_PROGRESSIONS);
        const simpleKeys = keys.filter(k => k.includes('simple'));
        const complexKeys = keys.filter(k => k.includes('complex'));
        expect(simpleKeys.length).toBeGreaterThan(0);
        expect(complexKeys.length).toBeGreaterThan(0);
    });

    it('should have at least 20 progression sets', () => {
        expect(Object.keys(CHORD_PROGRESSIONS).length).toBeGreaterThanOrEqual(20);
    });

    it('no progression should contain empty arrays', () => {
        for (const [key, set] of Object.entries(CHORD_PROGRESSIONS)) {
            for (let i = 0; i < set.length; i++) {
                expect(set[i].length, `${key}[${i}] is empty`).toBeGreaterThan(0);
            }
        }
    });

    it('all Roman numerals should produce valid MIDI when passed through getChordNotes', () => {
        const tested = new Set();
        for (const [key, set] of Object.entries(CHORD_PROGRESSIONS)) {
            for (const prog of set) {
                for (const roman of prog) {
                    if (tested.has(roman)) continue;
                    tested.add(roman);
                    const notes = getChordNotes(roman, 'C', 'Major', 4);
                    expect(notes.length, `${roman} should produce notes`).toBeGreaterThan(0);
                    for (const n of notes) {
                        expect(Number.isFinite(n), `${roman} produced NaN`).toBe(true);
                    }
                }
            }
        }
    });
});
