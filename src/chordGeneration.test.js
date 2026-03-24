import { describe, it, expect } from 'vitest';
import { romanToDegreeIndex, generateChordPattern } from './chordGeneration';
import { SCALES, CHORD_PROGRESSIONS, CHORD_TYPES, ROMAN_TO_CHORD } from './MusicTheory';
import { MOOD_MODIFIERS } from './GenreLibraryWithSubGenres';

// Mock window.AudioContext for Node test environment (needed by FolderAnalyzer → AudioAnalyzer)
globalThis.window = globalThis.window || {};
globalThis.window.AudioContext = globalThis.window.AudioContext || class MockAudioContext {};

import { FolderAnalyzer } from './FolderAnalyzer';

// --- romanToDegreeIndex ---

describe('romanToDegreeIndex', () => {
    it('maps major Roman numerals to correct degree indices', () => {
        expect(romanToDegreeIndex('I')).toBe(0);
        expect(romanToDegreeIndex('II')).toBe(1);
        expect(romanToDegreeIndex('III')).toBe(2);
        expect(romanToDegreeIndex('IV')).toBe(3);
        expect(romanToDegreeIndex('V')).toBe(4);
        expect(romanToDegreeIndex('VI')).toBe(5);
        expect(romanToDegreeIndex('VII')).toBe(6);
    });

    it('maps minor Roman numerals to correct degree indices', () => {
        expect(romanToDegreeIndex('i')).toBe(0);
        expect(romanToDegreeIndex('ii')).toBe(1);
        expect(romanToDegreeIndex('iii')).toBe(2);
        expect(romanToDegreeIndex('iv')).toBe(3);
        expect(romanToDegreeIndex('v')).toBe(4);
        expect(romanToDegreeIndex('vi')).toBe(5);
        expect(romanToDegreeIndex('vii')).toBe(6);
        expect(romanToDegreeIndex('vii°')).toBe(6);
    });

    it('maps extended chord numerals correctly', () => {
        expect(romanToDegreeIndex('I7')).toBe(0);
        expect(romanToDegreeIndex('ii7')).toBe(1);
        expect(romanToDegreeIndex('iv7')).toBe(3);
        expect(romanToDegreeIndex('V7')).toBe(4);
        expect(romanToDegreeIndex('vi7')).toBe(5);
    });

    it('returns undefined for unknown numerals', () => {
        expect(romanToDegreeIndex('X')).toBeUndefined();
        expect(romanToDegreeIndex('VIII')).toBeUndefined();
        expect(romanToDegreeIndex('')).toBeUndefined();
    });
});

// --- CHORD_PROGRESSIONS data integrity ---

describe('CHORD_PROGRESSIONS data integrity', () => {
    it('all progression sets contain arrays of arrays', () => {
        for (const [key, set] of Object.entries(CHORD_PROGRESSIONS)) {
            expect(Array.isArray(set), `${key} should be an array`).toBe(true);
            expect(set.length, `${key} should have at least one progression`).toBeGreaterThan(0);
            for (const prog of set) {
                expect(Array.isArray(prog), `${key} sub-items should be arrays`).toBe(true);
                expect(prog.length, `${key} progressions should have chords`).toBeGreaterThan(0);
            }
        }
    });

    it('all Roman numerals in progressions are recognized', () => {
        for (const [key, set] of Object.entries(CHORD_PROGRESSIONS)) {
            for (const prog of set) {
                for (const roman of prog) {
                    expect(
                        romanToDegreeIndex(roman),
                        `Unknown Roman numeral "${roman}" in ${key}`
                    ).not.toBeUndefined();
                }
            }
        }
    });

    it('all Roman numerals in progressions have a chord type mapping', () => {
        for (const [key, set] of Object.entries(CHORD_PROGRESSIONS)) {
            for (const prog of set) {
                for (const roman of prog) {
                    const chordType = ROMAN_TO_CHORD[roman];
                    if (chordType) {
                        expect(
                            CHORD_TYPES[chordType],
                            `CHORD_TYPES missing key "${chordType}" for ${roman} in ${key}`
                        ).toBeDefined();
                    }
                }
            }
        }
    });
});

// --- generateChordPattern ---

describe('generateChordPattern', () => {
    it('returns null when locked', () => {
        const result = generateChordPattern({ locked: true });
        expect(result).toBeNull();
    });

    it('generates a non-empty pattern with default settings', () => {
        const pattern = generateChordPattern({});
        expect(Array.isArray(pattern)).toBe(true);
        expect(pattern.length).toBeGreaterThan(0);
    });

    it('every note has required fields with valid values', () => {
        const pattern = generateChordPattern({});
        for (const note of pattern) {
            expect(note).toHaveProperty('time');
            expect(note).toHaveProperty('duration');
            expect(note).toHaveProperty('note');
            expect(note).toHaveProperty('velocity');

            expect(Number.isFinite(note.time)).toBe(true);
            expect(Number.isFinite(note.duration)).toBe(true);
            expect(Number.isFinite(note.note)).toBe(true);
            expect(Number.isFinite(note.velocity)).toBe(true);

            expect(note.time).toBeGreaterThanOrEqual(0);
            expect(note.duration).toBeGreaterThan(0);
            expect(note.note).toBeGreaterThanOrEqual(0);
            expect(note.note).toBeLessThanOrEqual(127);
            expect(note.velocity).toBeGreaterThan(0);
            expect(note.velocity).toBeLessThanOrEqual(1);
        }
    });

    it('generates chords within the correct time range for 4 bars', () => {
        const bars = 4;
        const totalSteps = bars * 32;
        const pattern = generateChordPattern({ globalBars: bars });
        for (const note of pattern) {
            expect(note.time).toBeLessThan(totalSteps);
        }
    });

    it('generates chords within the correct time range for 8 bars', () => {
        const bars = 8;
        const totalSteps = bars * 32;
        const pattern = generateChordPattern({ globalBars: bars });
        for (const note of pattern) {
            expect(note.time).toBeLessThan(totalSteps);
        }
    });

    it('generates chords within the correct time range for 16 bars', () => {
        const bars = 16;
        const totalSteps = bars * 32;
        const pattern = generateChordPattern({ globalBars: bars });
        for (const note of pattern) {
            expect(note.time).toBeLessThan(totalSteps);
        }
    });

    it('works with simple complexity', () => {
        const pattern = generateChordPattern({ complexity: 'simple' });
        expect(pattern.length).toBeGreaterThan(0);
    });

    it('works with complex complexity', () => {
        const pattern = generateChordPattern({ complexity: 'complex' });
        expect(pattern.length).toBeGreaterThan(0);
    });

    it('works with all keys', () => {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        for (const key of keys) {
            const pattern = generateChordPattern({ globalKey: key });
            expect(pattern.length, `Key ${key} should produce notes`).toBeGreaterThan(0);
            for (const note of pattern) {
                expect(Number.isFinite(note.note), `Key ${key} produced NaN note`).toBe(true);
            }
        }
    });

    it('works with all standard scales', () => {
        const scaleNames = ['Major', 'Minor', 'Dorian', 'Mixolydian', 'Lydian', 'Phrygian', 'Harmonic Minor'];
        for (const scale of scaleNames) {
            const pattern = generateChordPattern({ globalScale: scale });
            expect(pattern.length, `Scale ${scale} should produce notes`).toBeGreaterThan(0);
            for (const note of pattern) {
                expect(Number.isFinite(note.note), `Scale ${scale} produced NaN note`).toBe(true);
            }
        }
    });

    it('works with all mood modifiers', () => {
        for (const mood of Object.keys(MOOD_MODIFIERS)) {
            const pattern = generateChordPattern({ globalMood: mood });
            expect(pattern.length, `Mood ${mood} should produce notes`).toBeGreaterThan(0);
            for (const note of pattern) {
                expect(Number.isFinite(note.note), `Mood ${mood} produced NaN note`).toBe(true);
            }
        }
    });

    it('works with unknown mood (falls back to default modifier)', () => {
        const pattern = generateChordPattern({ globalMood: 'NonExistentMood' });
        expect(pattern.length).toBeGreaterThan(0);
    });

    it('works with unknown scale (falls back to Minor)', () => {
        const pattern = generateChordPattern({ globalScale: 'NonExistent' });
        expect(pattern.length).toBeGreaterThan(0);
    });

    it('generates notes at integer time positions', () => {
        const pattern = generateChordPattern({});
        for (const note of pattern) {
            expect(note.time).toBe(Math.round(note.time));
        }
    });
});

// --- Global vs Regular mode consistency ---

describe('Global and Regular generation mode consistency', () => {
    it('generates valid patterns regardless of which mode triggers generation', () => {
        // Both modes call the same generateChords() logic;
        // simulate calling it multiple times (as global gen would do)
        for (let i = 0; i < 10; i++) {
            const pattern = generateChordPattern({
                globalKey: 'C',
                globalScale: 'Minor',
                globalBars: 4,
                globalMood: 'Dark',
                complexity: 'simple'
            });
            expect(pattern.length).toBeGreaterThan(0);
            for (const note of pattern) {
                expect(Number.isFinite(note.note)).toBe(true);
                expect(Number.isNaN(note.note)).toBe(false);
                expect(note.time).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('produces valid output across all bar counts used in the app', () => {
        for (const bars of [4, 8, 16]) {
            for (const comp of ['simple', 'complex']) {
                const pattern = generateChordPattern({ globalBars: bars, complexity: comp });
                expect(pattern.length, `bars=${bars}, complexity=${comp}`).toBeGreaterThan(0);
            }
        }
    });
});

// --- FolderAnalyzer.detectFolderType ---

describe('FolderAnalyzer.detectFolderType', () => {
    const analyzer = new FolderAnalyzer();

    it('detects drum folder from drum-named files', () => {
        const files = [
            { name: 'kick_808.wav' },
            { name: 'snare_tight.wav' },
            { name: 'hihat_closed.wav' },
            { name: 'clap_layer.wav' }
        ];
        expect(analyzer.detectFolderType(files, [], null)).toBe('drums');
    });

    it('detects melodic folder from melodic-named files', () => {
        const files = [
            { name: 'melody_lead.mid' },
            { name: 'chord_progression.mid' },
            { name: 'bass_riff.mid' },
            { name: 'pad_ambient.wav' }
        ];
        expect(analyzer.detectFolderType(files, [], null)).toBe('melodic');
    });

    it('detects mixed folder when both types present', () => {
        const files = [
            { name: 'kick_808.wav' },
            { name: 'snare_tight.wav' },
            { name: 'melody_lead.mid' },
            { name: 'bass_riff.mid' }
        ];
        expect(analyzer.detectFolderType(files, [], null)).toBe('mixed');
    });

    it('falls back to audio duration for unrecognized filenames', () => {
        const files = [
            { name: 'sample_01.wav' },
            { name: 'sample_02.wav' }
        ];
        const audioAnalyses = { analyses: [
            { duration: 0.5 },
            { duration: 1.0 }
        ]};
        // Average duration 0.75s < 2s → drums
        expect(analyzer.detectFolderType(files, [], audioAnalyses)).toBe('drums');
    });

    it('falls back to melodic for longer audio durations', () => {
        const files = [
            { name: 'sample_01.wav' },
            { name: 'sample_02.wav' }
        ];
        const audioAnalyses = { analyses: [
            { duration: 4.0 },
            { duration: 6.0 }
        ]};
        // Average duration 5s > 2s → melodic
        expect(analyzer.detectFolderType(files, [], audioAnalyses)).toBe('melodic');
    });

    it('returns mixed when no keywords and no audio data', () => {
        const files = [
            { name: 'track_01.mid' },
            { name: 'track_02.mid' }
        ];
        expect(analyzer.detectFolderType(files, [], null)).toBe('mixed');
    });
});

// --- FolderAnalyzer.mapGenreGroupToName ---

describe('FolderAnalyzer.mapGenreGroupToName', () => {
    it('maps known genre groups to display names', () => {
        expect(FolderAnalyzer.mapGenreGroupToName('TRAP_DRILL_LOFI')).toBe('Trap');
        expect(FolderAnalyzer.mapGenreGroupToName('ELECTRONIC')).toBe('House');
        expect(FolderAnalyzer.mapGenreGroupToName('DRUM_BASS')).toBe('Drum & Bass');
        expect(FolderAnalyzer.mapGenreGroupToName('ROCK_METAL')).toBe('Rock');
        expect(FolderAnalyzer.mapGenreGroupToName('FUNK_DISCO')).toBe('Funk');
        expect(FolderAnalyzer.mapGenreGroupToName('SOULFUL_R&B')).toBe('R&B');
    });

    it('falls back to Trap for unknown genre groups', () => {
        expect(FolderAnalyzer.mapGenreGroupToName('UNKNOWN')).toBe('Trap');
        expect(FolderAnalyzer.mapGenreGroupToName('')).toBe('Trap');
    });
});
