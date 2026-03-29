/**
 * Domain Module — Comprehensive Unit Tests
 * Tests keys, scales, chords, moods, genres, and domain helpers
 */
import { describe, it, expect } from 'vitest';
import {
    NOTE_NAMES, ENHARMONIC_MAP, KEY_METADATA, MODULATION_TARGETS,
    resolveEnharmonic, getKeyIndex
} from './domain/keys';
import { SCALE_CATEGORIES, SCALES_CATALOG, SCALES } from './domain/scales';
import { CHORD_TYPES, ROMAN_TO_CHORD, CHORD_PROGRESSIONS, ensureChordsExpansionsLoaded } from './domain/chords';
import { MOOD_DIMENSIONS, MOOD_MODIFIERS, composeMood } from './domain/moods';
import { GENRE_CATEGORIES, GENRE_DEFINITIONS, GENRES_WITH_SUBGENRES } from './domain/genres';

// ── Keys Module ─────────────��──────────────────────────────────────────────

describe('domain/keys', () => {
    it('NOTE_NAMES should have 12 entries', () => {
        expect(NOTE_NAMES).toHaveLength(12);
    });

    it('ENHARMONIC_MAP should map flats to sharps', () => {
        expect(ENHARMONIC_MAP).toBeDefined();
        if (ENHARMONIC_MAP['Db']) expect(ENHARMONIC_MAP['Db']).toBe('C#');
        if (ENHARMONIC_MAP['Eb']) expect(ENHARMONIC_MAP['Eb']).toBe('D#');
    });

    it('resolveEnharmonic should resolve known enharmonics', () => {
        if (ENHARMONIC_MAP['Db']) {
            expect(resolveEnharmonic('Db')).toBe('C#');
        }
        // Normal note should pass through
        expect(resolveEnharmonic('C')).toBe('C');
    });

    it('getKeyIndex should return correct index', () => {
        expect(getKeyIndex('C')).toBe(0);
        expect(getKeyIndex('D')).toBe(2);
        expect(getKeyIndex('A')).toBe(9);
    });

    it('KEY_METADATA should exist', () => {
        expect(KEY_METADATA).toBeDefined();
    });

    it('MODULATION_TARGETS should exist', () => {
        expect(MODULATION_TARGETS).toBeDefined();
    });
});

// ── Scales Module ──────────────────────────────────────────────────────────

describe('domain/scales', () => {
    it('SCALES should have Major and Minor', () => {
        expect(SCALES['Major']).toBeDefined();
        expect(SCALES['Minor']).toBeDefined();
    });

    it('SCALE_CATEGORIES should be defined', () => {
        expect(SCALE_CATEGORIES).toBeDefined();
    });

    it('SCALES_CATALOG should be defined', () => {
        expect(SCALES_CATALOG).toBeDefined();
    });

    it('every scale should start with 0 and have valid intervals', () => {
        for (const [name, intervals] of Object.entries(SCALES)) {
            expect(intervals[0], `${name} should start at 0`).toBe(0);
            for (const i of intervals) {
                expect(i).toBeGreaterThanOrEqual(0);
                expect(i).toBeLessThan(12);
            }
        }
    });
});

// ── Chords Module ──────────────────────────────────────────────────────────

describe('domain/chords', () => {
    it('CHORD_TYPES should have major and minor', () => {
        expect(CHORD_TYPES['major']).toEqual([0, 4, 7]);
        expect(CHORD_TYPES['minor']).toEqual([0, 3, 7]);
    });

    it('ROMAN_TO_CHORD should map I to major', () => {
        expect(ROMAN_TO_CHORD['I']).toBe('major');
    });

    it('CHORD_PROGRESSIONS should have multiple keys', () => {
        expect(Object.keys(CHORD_PROGRESSIONS).length).toBeGreaterThan(10);
    });

    it('ensureChordsExpansionsLoaded should be a function', () => {
        expect(typeof ensureChordsExpansionsLoaded).toBe('function');
    });

    it('calling ensureChordsExpansionsLoaded should not throw', () => {
        expect(() => ensureChordsExpansionsLoaded()).not.toThrow();
    });
});

// ── Moods Module ─────────────���─────────────────────────────────────────────

describe('domain/moods', () => {
    it('MOOD_MODIFIERS should have standard moods', () => {
        expect(MOOD_MODIFIERS['Dark']).toBeDefined();
        expect(MOOD_MODIFIERS['Happy']).toBeDefined();
    });

    it('MOOD_DIMENSIONS should be defined', () => {
        expect(MOOD_DIMENSIONS).toBeDefined();
    });

    it('composeMood should be a function', () => {
        expect(typeof composeMood).toBe('function');
    });

    it('composeMood should return an object for valid mood', () => {
        const result = composeMood('Dark');
        expect(typeof result).toBe('object');
    });
});

// ── Genres Module ────────────��─────────────────────────────────────────────

describe('domain/genres', () => {
    it('GENRE_DEFINITIONS should be defined', () => {
        expect(GENRE_DEFINITIONS).toBeDefined();
        expect(Object.keys(GENRE_DEFINITIONS).length).toBeGreaterThan(0);
    });

    it('GENRE_CATEGORIES should be defined', () => {
        expect(GENRE_CATEGORIES).toBeDefined();
    });

    it('GENRES_WITH_SUBGENRES should have entries', () => {
        expect(Object.keys(GENRES_WITH_SUBGENRES).length).toBeGreaterThan(0);
    });
});
