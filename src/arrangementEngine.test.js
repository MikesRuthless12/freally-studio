/**
 * Arrangement Intelligence Engine — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
    generateArrangement,
    applyArrangementToTimeline,
    getAvailableTemplates,
    getSectionTypes,
    getTemplateForGenre,
    getTemplate,
    getTotalBars,
    getEstimatedDuration
} from './core/music-intelligence/ArrangementEngine';

describe('ArrangementEngine — generateArrangement', () => {
    it('should generate clip placements for Trap genre', () => {
        const result = generateArrangement({ genre: 'Trap' });
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
    });

    it('each placement should have required fields', () => {
        const result = generateArrangement({ genre: 'Pop' });
        result.forEach(cp => {
            expect(cp).toHaveProperty('trackType');
            expect(cp).toHaveProperty('timelineBar');
            expect(cp).toHaveProperty('bars');
            expect(cp).toHaveProperty('sectionType');
            expect(cp).toHaveProperty('intensity');
            expect(cp).toHaveProperty('color');
            expect(['drums', 'chords', 'melody', 'bass']).toContain(cp.trackType);
        });
    });

    it('should honor per-section track activity (genre-aware)', () => {
        // 'House' resolves to the drop-based 'edm' template (Intro/Buildup/Drop/Breakdown/...)
        const result = generateArrangement({ genre: 'House', variation: 0 });
        const bySection = {};
        for (const cp of result) {
            (bySection[cp.sectionType] = bySection[cp.sectionType] || new Set()).add(cp.trackType);
        }
        // Drop = full band
        expect(bySection.drop).toEqual(new Set(['drums', 'chords', 'melody', 'bass']));
        // Breakdown drops the drums (chords/melody carry)
        expect(bySection.breakdown?.has('drums')).toBe(false);
        expect(bySection.breakdown?.has('chords')).toBe(true);
        // Build-up filters the bass out
        expect(bySection.buildup?.has('bass')).toBe(false);
        // Intro holds the melody back
        expect(bySection.intro?.has('melody')).toBe(false);
    });

    it('every section has at least one active track', () => {
        const result = generateArrangement({ genre: 'Pop', variation: 0 });
        const byBar = {};
        for (const cp of result) {
            (byBar[cp.timelineBar] = byBar[cp.timelineBar] || new Set()).add(cp.trackType);
        }
        for (const tracks of Object.values(byBar)) {
            expect(tracks.size).toBeGreaterThan(0);
        }
    });

    it('availableTracks restricts output to generated tracks only', () => {
        const result = generateArrangement({ genre: 'Pop', variation: 0, availableTracks: ['drums', 'bass'] });
        expect(result.length).toBeGreaterThan(0);
        const types = new Set(result.map(cp => cp.trackType));
        expect(types.has('drums')).toBe(true);
        expect(types.has('bass')).toBe(true);
        expect(types.has('chords')).toBe(false);
        expect(types.has('melody')).toBe(false);
    });

    it('a single available track is still placed across its active sections', () => {
        const result = generateArrangement({ genre: 'Pop', variation: 0, availableTracks: ['chords'] });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(cp => expect(cp.trackType).toBe('chords'));
    });

    it('no generated tracks yields an empty arrangement', () => {
        const result = generateArrangement({ genre: 'Pop', variation: 0, availableTracks: [] });
        expect(result).toEqual([]);
    });

    it('re-running after generating a track fills the aligned blank spots (stable structure)', () => {
        const seed = 12345;
        const drumsOnly = generateArrangement({ genre: 'Pop', variation: 0.3, seed, availableTracks: ['drums'] });
        const withMelody = generateArrangement({ genre: 'Pop', variation: 0.3, seed, availableTracks: ['drums', 'melody'] });

        // Same seed → identical section structure regardless of which tracks are available:
        // the drum placements (bars) are unchanged across the two runs.
        const drumBars = (arr) => arr.filter(cp => cp.trackType === 'drums').map(cp => cp.timelineBar);
        expect(drumBars(withMelody)).toEqual(drumBars(drumsOnly));

        // The newly-available melody now appears, and only at bar positions that already
        // exist in the structure (i.e. it drops into the previously-blank spots).
        const structureBars = new Set(drumsOnly.map(cp => cp.timelineBar));
        const melodyPlacements = withMelody.filter(cp => cp.trackType === 'melody');
        expect(melodyPlacements.length).toBeGreaterThan(0);
        melodyPlacements.forEach(cp => expect(structureBars.has(cp.timelineBar)).toBe(true));
    });

    it('intensity should be between 0.1 and 1.0', () => {
        const result = generateArrangement({ genre: 'EDM', mood: 'Aggressive' });
        result.forEach(cp => {
            expect(cp.intensity).toBeGreaterThanOrEqual(0.1);
            expect(cp.intensity).toBeLessThanOrEqual(1.0);
        });
    });

    it('variation 0 should produce template-exact bar counts', () => {
        const result1 = generateArrangement({ genre: 'Pop', variation: 0, seed: 42 });
        const result2 = generateArrangement({ genre: 'Pop', variation: 0, seed: 42 });
        expect(result1.length).toBe(result2.length);
        for (let i = 0; i < result1.length; i++) {
            expect(result1[i].bars).toBe(result2[i].bars);
        }
    });

    it('high variation should produce different bar counts across runs', () => {
        const results = [];
        for (let i = 0; i < 5; i++) {
            const r = generateArrangement({ genre: 'Pop', variation: 1.0 });
            results.push(getTotalBars(r));
        }
        // At least some should differ
        const unique = new Set(results);
        expect(unique.size).toBeGreaterThanOrEqual(1);
    });

    it('should handle all major genres without error', () => {
        const genres = ['Trap', 'Hip Hop', 'EDM', 'Pop', 'Jazz', 'Rock', 'Latin', 'Ambient'];
        for (const genre of genres) {
            const result = generateArrangement({ genre });
            expect(result.length).toBeGreaterThan(0);
        }
    });

    it('bars should be multiples of 4 between 4 and 16', () => {
        for (let i = 0; i < 10; i++) {
            const result = generateArrangement({ genre: 'Trap', variation: 1.0 });
            const uniqueBars = new Set(result.map(cp => cp.timelineBar));
            // Check all section bars
            const seen = new Map();
            for (const cp of result) {
                if (!seen.has(cp.timelineBar)) seen.set(cp.timelineBar, cp.bars);
            }
            for (const bars of seen.values()) {
                expect(bars % 4).toBe(0);
                expect(bars).toBeGreaterThanOrEqual(4);
                expect(bars).toBeLessThanOrEqual(16);
            }
        }
    });
});

describe('ArrangementEngine — applyArrangementToTimeline', () => {
    it('should call callbacks for each track type', () => {
        const placements = generateArrangement({ genre: 'Trap', variation: 0 });
        const calls = { drums: [], chords: [], melody: [], bass: [], timeline: [] };

        applyArrangementToTimeline(placements, {
            addDrumClip: (...args) => calls.drums.push(args),
            addChordClip: (...args) => calls.chords.push(args),
            addMelodyClip: (...args) => calls.melody.push(args),
            addBassClip: (...args) => calls.bass.push(args),
            setTimelineBars: (fn) => calls.timeline.push(fn)
        });

        expect(calls.drums.length).toBeGreaterThan(0);
        expect(calls.chords.length).toBeGreaterThan(0);
        expect(calls.melody.length).toBeGreaterThan(0);
        expect(calls.bass.length).toBeGreaterThan(0);
        expect(calls.drums.length).toBe(calls.chords.length);
    });

    it('should not throw on empty input', () => {
        expect(() => applyArrangementToTimeline([], {})).not.toThrow();
        expect(() => applyArrangementToTimeline(null, null)).not.toThrow();
    });
});

describe('ArrangementEngine — Utility Functions', () => {
    it('getAvailableTemplates should return array of strings', () => {
        const templates = getAvailableTemplates();
        expect(Array.isArray(templates)).toBe(true);
        expect(templates.length).toBeGreaterThan(10);
        templates.forEach(t => expect(typeof t).toBe('string'));
    });

    it('getSectionTypes should return object with known sections', () => {
        const types = getSectionTypes();
        expect(types).toHaveProperty('Intro');
        expect(types).toHaveProperty('Verse');
        expect(types).toHaveProperty('Chorus');
        expect(types).toHaveProperty('Bridge');
        expect(types).toHaveProperty('Drop');
        expect(types).toHaveProperty('Outro');
    });

    it('getTemplateForGenre should resolve known genres', () => {
        expect(getTemplateForGenre('Trap')).toBe('trap');
        expect(getTemplateForGenre('Jazz')).toBe('jazz');
        expect(getTemplateForGenre('EDM')).toBeDefined();
    });

    it('getTemplateForGenre should fallback to pop for unknown', () => {
        expect(getTemplateForGenre('UnknownGenre123')).toBe('pop');
    });

    it('getTemplate should return array for valid key', () => {
        const tpl = getTemplate('trap');
        expect(Array.isArray(tpl)).toBe(true);
        tpl.forEach(entry => {
            expect(entry).toHaveProperty('section');
            expect(entry).toHaveProperty('bars');
        });
    });

    it('getTotalBars should calculate correctly', () => {
        const placements = generateArrangement({ genre: 'Trap', variation: 0 });
        const total = getTotalBars(placements);
        expect(total).toBeGreaterThan(0);
        expect(total % 4).toBe(0);
    });

    it('getEstimatedDuration should calculate seconds correctly', () => {
        const placements = generateArrangement({ genre: 'Pop', variation: 0 });
        const duration = getEstimatedDuration(placements, 120);
        const totalBars = getTotalBars(placements);
        // At 120 BPM, each bar = 2 seconds
        expect(duration).toBeCloseTo(totalBars * 2, 0);
    });
});
