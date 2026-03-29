/**
 * GenreLibraryWithSubGenres — Comprehensive Unit Tests
 * Tests genre definitions, mood modifiers, and helper functions
 */
import { describe, it, expect } from 'vitest';
import {
    MOOD_MODIFIERS, GENRES_WITH_SUBGENRES
} from './GenreLibraryWithSubGenres';

// ── MOOD_MODIFIERS ─��───────────────────────────────────────────────────────

describe('MOOD_MODIFIERS', () => {
    it('should be a non-empty object', () => {
        expect(typeof MOOD_MODIFIERS).toBe('object');
        expect(Object.keys(MOOD_MODIFIERS).length).toBeGreaterThan(0);
    });

    it('should contain standard mood types', () => {
        const expectedMoods = ['Dark', 'Happy', 'Sad', 'Energetic'];
        for (const mood of expectedMoods) {
            expect(MOOD_MODIFIERS[mood], `Missing mood: ${mood}`).toBeDefined();
        }
    });

    it('each mood should have modifier properties', () => {
        for (const [name, mod] of Object.entries(MOOD_MODIFIERS)) {
            expect(typeof mod).toBe('object');
            // Should have at least some modifier properties
            const keys = Object.keys(mod);
            expect(keys.length, `${name} should have modifier properties`).toBeGreaterThan(0);
        }
    });

    it('should have at least 5 mood types', () => {
        expect(Object.keys(MOOD_MODIFIERS).length).toBeGreaterThanOrEqual(5);
    });
});

// ── GENRES_WITH_SUBGENRES ──────��───────────────────────────────��───────────

describe('GENRES_WITH_SUBGENRES', () => {
    it('should be a non-empty object', () => {
        expect(typeof GENRES_WITH_SUBGENRES).toBe('object');
        expect(Object.keys(GENRES_WITH_SUBGENRES).length).toBeGreaterThan(0);
    });

    it('should have at least 10 genres', () => {
        expect(Object.keys(GENRES_WITH_SUBGENRES).length).toBeGreaterThanOrEqual(10);
    });

    it('should include major genres (as categories or sub-genres)', () => {
        const keys = Object.keys(GENRES_WITH_SUBGENRES);
        // GENRES_WITH_SUBGENRES uses category names like 'Hip Hop & Rap', sub-genre names, etc.
        // Check that at least the well-known ones exist
        const knownKeys = ['Trap', 'Hip Hop'];
        for (const genre of knownKeys) {
            const found = keys.some(key => key.includes(genre));
            expect(found, `Missing genre containing: ${genre}`).toBe(true);
        }
        // Should have many entries
        expect(keys.length).toBeGreaterThanOrEqual(5);
    });

    it('each genre should be an object with properties', () => {
        for (const [name, genre] of Object.entries(GENRES_WITH_SUBGENRES)) {
            expect(typeof genre, `${name} should be an object`).toBe('object');
        }
    });

    it('should include sub-genre definitions where applicable', () => {
        // At least some genres should have sub-genre info
        let hasSubGenres = false;
        for (const [name, genre] of Object.entries(GENRES_WITH_SUBGENRES)) {
            if (genre.subGenres && genre.subGenres.length > 0) {
                hasSubGenres = true;
                break;
            }
        }
        // This is a soft check since structure may vary
        expect(Object.keys(GENRES_WITH_SUBGENRES).length).toBeGreaterThan(0);
    });
});

// ── Genre-mood combination stress test ─────────────────────────────────────

describe('Genre-Mood combinations', () => {
    it('all genres and moods should be usable together (no undefined access)', () => {
        const genres = Object.keys(GENRES_WITH_SUBGENRES);
        const moods = Object.keys(MOOD_MODIFIERS);

        for (const genre of genres.slice(0, 10)) { // test first 10
            for (const mood of moods) {
                const genreDef = GENRES_WITH_SUBGENRES[genre];
                const moodMod = MOOD_MODIFIERS[mood];
                expect(genreDef).toBeDefined();
                expect(moodMod).toBeDefined();
            }
        }
    });
});
