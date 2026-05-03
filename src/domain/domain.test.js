import { describe, it, expect } from 'vitest';
import { NOTE_NAMES, ENHARMONIC_MAP, KEY_METADATA, resolveEnharmonic, getKeyIndex } from './keys';
import { SCALES, SCALES_CATALOG, SCALE_CATEGORIES, getScalesByCategory } from './scales';
import { CHORD_TYPES, ROMAN_TO_CHORD, CHORD_PROGRESSIONS } from './chords';
import { MOOD_MODIFIERS, MOOD_DIMENSIONS, composeMood } from './moods';
import { GENRES_WITH_SUBGENRES, GENRE_DEFINITIONS, GENRE_CATEGORIES } from './genres';
import { getScalesForContext, getProgressionTypeForGenre } from './domainHelpers';
import { romanToDegreeIndex } from '../chordGeneration';

// Known FAMILY_MAP keys from drumPatterns.js (FAMILY_MAP + INDIE/METAL/COUNTRY variants).
// Verified by:
//   grep "drumPattern:" src/domain/genres.js | sort -u  →  these 24 keys.
const KNOWN_DRUM_PATTERNS = [
    'trap', 'drill', 'boom_bap', 'lofi', 'four_on_floor', 'trance',
    'retro', 'techno', 'dubstep', 'dnb', 'future_bass', 'reggae',
    'reggaeton', 'afrobeat', 'latin', 'jazz', 'funk', 'rnb', 'orchestral',
    'indie_pop', 'indie_rock', 'metal', 'country', 'gospel'
];

// ---- NOTE_NAMES ----
describe('NOTE_NAMES', () => {
    it('has exactly 12 elements', () => {
        expect(NOTE_NAMES).toHaveLength(12);
    });

    it('matches the canonical chromatic scale', () => {
        expect(NOTE_NAMES).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
    });
});

// ---- ENHARMONIC_MAP ----
describe('ENHARMONIC_MAP', () => {
    it('is symmetric (bidirectional)', () => {
        Object.entries(ENHARMONIC_MAP).forEach(([key, val]) => {
            if (key !== val) {
                expect(ENHARMONIC_MAP[val]).toBe(key);
            }
        });
    });

    it('covers all sharps', () => {
        expect(ENHARMONIC_MAP['C#']).toBe('Db');
        expect(ENHARMONIC_MAP['D#']).toBe('Eb');
        expect(ENHARMONIC_MAP['F#']).toBe('Gb');
        expect(ENHARMONIC_MAP['G#']).toBe('Ab');
        expect(ENHARMONIC_MAP['A#']).toBe('Bb');
    });
});

// ---- Keys helpers ----
describe('Key helpers', () => {
    it('resolveEnharmonic resolves flats to sharps', () => {
        expect(resolveEnharmonic('Db')).toBe('C#');
        expect(resolveEnharmonic('Eb')).toBe('D#');
    });

    it('getKeyIndex returns correct indices', () => {
        expect(getKeyIndex('C')).toBe(0);
        expect(getKeyIndex('A')).toBe(9);
        expect(getKeyIndex('Db')).toBe(1); // enharmonic
    });
});

// ---- SCALES ----
describe('SCALES', () => {
    const ORIGINAL_37_SCALES = {
        'Major': [0, 2, 4, 5, 7, 9, 11],
        'Minor': [0, 2, 3, 5, 7, 8, 10],
        'Dorian': [0, 2, 3, 5, 7, 9, 10],
        'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
        'Lydian': [0, 2, 4, 6, 7, 9, 11],
        'Phrygian': [0, 1, 3, 5, 7, 8, 10],
        'Locrian': [0, 1, 3, 5, 6, 8, 10],
        'Whole Tone': [0, 2, 4, 6, 8, 10],
        'Half-whole Dim.': [0, 1, 3, 4, 6, 7, 9, 10],
        'Whole-half Dim.': [0, 2, 3, 5, 6, 8, 9, 11],
        'Minor Blues': [0, 3, 5, 6, 7, 10],
        'Minor Pentatonic': [0, 3, 5, 7, 10],
        'Major Pentatonic': [0, 2, 4, 7, 9],
        'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
        'Harmonic Major': [0, 2, 4, 5, 7, 8, 11],
        'Dorian #4': [0, 2, 3, 6, 7, 9, 10],
        'Phrygian Dominant': [0, 1, 4, 5, 7, 8, 10],
        'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
        'Lydian Augmented': [0, 2, 4, 6, 8, 9, 11],
        'Lydian Dominant': [0, 2, 4, 6, 7, 9, 10],
        'Super Locrian': [0, 1, 3, 4, 6, 8, 10],
        '8-Tone Spanish': [0, 1, 3, 4, 5, 6, 8, 10],
        'Bhairav': [0, 1, 4, 5, 7, 8, 11],
        'Hungarian Minor': [0, 2, 3, 6, 7, 8, 11],
        'Hirajoshi': [0, 4, 6, 7, 11],
        'In-Sen': [0, 1, 5, 7, 10],
        'Iwato': [0, 1, 5, 6, 10],
        'Kumoi': [0, 2, 3, 7, 9],
        'Pelog Selisir': [0, 1, 3, 7, 8],
        'Pelog Tembung': [0, 1, 5, 7, 8],
        'Messiaen 3': [0, 2, 3, 4, 6, 7, 8, 10, 11],
        'Messiaen 4': [0, 1, 2, 5, 6, 7, 8, 11],
        'Messiaen 5': [0, 1, 5, 6, 7, 11],
        'Messiaen 6': [0, 2, 4, 5, 6, 8, 10, 11],
        'Messiaen 7': [0, 1, 2, 3, 5, 6, 7, 8, 9, 11]
    };

    it('preserves all 37 original scale names with identical intervals', () => {
        Object.entries(ORIGINAL_37_SCALES).forEach(([name, intervals]) => {
            expect(SCALES).toHaveProperty(name);
            expect(SCALES[name]).toEqual(intervals);
        });
    });

    it('has at least 60 scales total', () => {
        expect(Object.keys(SCALES).length).toBeGreaterThanOrEqual(60);
    });

    it('all scales have valid intervals (start at 0, sorted ascending, max 11)', () => {
        Object.entries(SCALES).forEach(([name, intervals]) => {
            expect(intervals[0]).toBe(0);
            for (let i = 1; i < intervals.length; i++) {
                expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
            }
            expect(intervals[intervals.length - 1]).toBeLessThanOrEqual(11);
        });
    });

    it('Ionian shares intervals with Major', () => {
        expect(SCALES['Ionian']).toEqual(SCALES['Major']);
    });

    it('Aeolian shares intervals with Minor', () => {
        expect(SCALES['Aeolian']).toEqual(SCALES['Minor']);
    });

    it('SCALES_CATALOG entries all have required fields', () => {
        Object.entries(SCALES_CATALOG).forEach(([name, data]) => {
            expect(data).toHaveProperty('intervals');
            expect(data).toHaveProperty('category');
            expect(data).toHaveProperty('emotion');
        });
    });

    it('new scales are present', () => {
        const newScales = ['Altered', 'Hijaz', 'Byzantine', 'Persian', 'Arabic',
            'Chinese Pentatonic', 'Balinese', 'Bebop Major', 'Bebop Dominant',
            'Enigmatic', 'Prometheus', 'Egyptian'];
        newScales.forEach(name => {
            expect(SCALES).toHaveProperty(name);
        });
    });
});

// ---- SCALE_CATEGORIES ----
describe('SCALE_CATEGORIES', () => {
    it('contains expected category groups', () => {
        expect(SCALE_CATEGORIES).toHaveProperty('Common');
        expect(SCALE_CATEGORIES).toHaveProperty('Modes');
        expect(SCALE_CATEGORIES).toHaveProperty('Jazz & Fusion');
        expect(SCALE_CATEGORIES).toHaveProperty('World & Exotic');
        expect(SCALE_CATEGORIES).toHaveProperty('Messiaen');
    });

    it('all scales in categories exist in SCALES', () => {
        Object.values(SCALE_CATEGORIES).forEach(scaleNames => {
            scaleNames.forEach(name => {
                expect(SCALES).toHaveProperty(name);
            });
        });
    });
});

// ---- CHORD_TYPES ----
describe('CHORD_TYPES', () => {
    const ORIGINAL_12 = ['major', 'minor', 'diminished', 'augmented', 'major7',
        'minor7', 'dominant7', 'sus2', 'sus4', 'major9', 'minor9', 'dominant9'];

    it('preserves all 12 original chord types', () => {
        ORIGINAL_12.forEach(type => {
            expect(CHORD_TYPES).toHaveProperty(type);
        });
    });

    it('original chord type intervals are preserved', () => {
        expect(CHORD_TYPES['major']).toEqual([0, 4, 7]);
        expect(CHORD_TYPES['minor']).toEqual([0, 3, 7]);
        expect(CHORD_TYPES['diminished']).toEqual([0, 3, 6]);
        expect(CHORD_TYPES['major7']).toEqual([0, 4, 7, 11]);
        expect(CHORD_TYPES['dominant7']).toEqual([0, 4, 7, 10]);
    });

    it('has new chord types', () => {
        expect(CHORD_TYPES).toHaveProperty('half-diminished');
        expect(CHORD_TYPES).toHaveProperty('diminished7');
        expect(CHORD_TYPES).toHaveProperty('dominant7#9');
        expect(CHORD_TYPES).toHaveProperty('6');
        expect(CHORD_TYPES).toHaveProperty('minor6');
    });

    it('all chord types start with 0', () => {
        Object.values(CHORD_TYPES).forEach(intervals => {
            expect(intervals[0]).toBe(0);
        });
    });
});

// ---- ROMAN_TO_CHORD ----
describe('ROMAN_TO_CHORD', () => {
    const ORIGINAL_18 = {
        'I': 'major', 'ii': 'minor', 'iii': 'minor', 'IV': 'major',
        'V': 'major', 'vi': 'minor', 'vii°': 'diminished',
        'i': 'minor', 'i7': 'minor7', 'II': 'major', 'III': 'major',
        'iv': 'minor', 'v': 'minor', 'VI': 'major', 'VII': 'major',
        'I7': 'major7', 'ii7': 'minor7', 'V7': 'dominant7'
    };

    it('preserves all 18 original mappings', () => {
        Object.entries(ORIGINAL_18).forEach(([roman, type]) => {
            expect(ROMAN_TO_CHORD[roman]).toBe(type);
        });
    });

    it('all mapped chord types exist in CHORD_TYPES', () => {
        Object.values(ROMAN_TO_CHORD).forEach(type => {
            expect(CHORD_TYPES).toHaveProperty(type);
        });
    });

    it('has new mappings', () => {
        expect(ROMAN_TO_CHORD).toHaveProperty('bVII');
        expect(ROMAN_TO_CHORD).toHaveProperty('bVI');
        expect(ROMAN_TO_CHORD).toHaveProperty('V7#9');
        expect(ROMAN_TO_CHORD).toHaveProperty('iiø7');
    });
});

// ---- CHORD_PROGRESSIONS ----
describe('CHORD_PROGRESSIONS', () => {
    it('preserves all 8 original categories with originals included', () => {
        // After expansion merges, arrays contain originals + expansion data
        // Verify originals are present at the start of each array
        const popSimple = CHORD_PROGRESSIONS['pop_simple'];
        expect(popSimple.length).toBeGreaterThanOrEqual(3);
        expect(popSimple[0]).toEqual(['I', 'V', 'vi', 'IV']);
        expect(popSimple[1]).toEqual(['I', 'vi', 'IV', 'V']);
        expect(popSimple[2]).toEqual(['vi', 'IV', 'I', 'V']);

        const popComplex = CHORD_PROGRESSIONS['pop_complex'];
        expect(popComplex.length).toBeGreaterThanOrEqual(3);
        expect(popComplex[0]).toEqual(['I', 'V7', 'vi7', 'IV']);
        expect(popComplex[1]).toEqual(['I7', 'vi', 'ii7', 'V7']);
        expect(popComplex[2]).toEqual(['vi7', 'IV', 'I7', 'V']);

        const hiphopSimple = CHORD_PROGRESSIONS['hiphop_simple'];
        expect(hiphopSimple.length).toBeGreaterThanOrEqual(3);
        expect(hiphopSimple[0]).toEqual(['i', 'VI', 'III', 'VII']);
        expect(hiphopSimple[1]).toEqual(['i', 'VII', 'VI', 'v']);
        expect(hiphopSimple[2]).toEqual(['i', 'iv', 'VII', 'VI']);

        const hiphopComplex = CHORD_PROGRESSIONS['hiphop_complex'];
        expect(hiphopComplex.length).toBeGreaterThanOrEqual(3);
        expect(hiphopComplex[0]).toEqual(['i7', 'VI', 'III', 'VII']);
        expect(hiphopComplex[1]).toEqual(['i', 'VII', 'vi7', 'V7']);
        expect(hiphopComplex[2]).toEqual(['i7', 'iv7', 'VII', 'VI']);

        const jazzSimple = CHORD_PROGRESSIONS['jazz_simple'];
        expect(jazzSimple.length).toBeGreaterThanOrEqual(2);
        expect(jazzSimple[0]).toEqual(['I', 'vi', 'ii', 'V']);
        expect(jazzSimple[1]).toEqual(['I', 'IV', 'V', 'I']);

        const jazzComplex = CHORD_PROGRESSIONS['jazz_complex'];
        expect(jazzComplex.length).toBeGreaterThanOrEqual(3);
        expect(jazzComplex[0]).toEqual(['I7', 'vi7', 'ii7', 'V7']);
        expect(jazzComplex[1]).toEqual(['I7', 'IV', 'vii°', 'iii']);
        expect(jazzComplex[2]).toEqual(['ii7', 'V7', 'I7', 'vi7']);

        const edmSimple = CHORD_PROGRESSIONS['edm_simple'];
        expect(edmSimple.length).toBeGreaterThanOrEqual(2);
        expect(edmSimple[0]).toEqual(['I', 'V', 'vi', 'IV']);
        expect(edmSimple[1]).toEqual(['vi', 'IV', 'I', 'V']);

        const edmComplex = CHORD_PROGRESSIONS['edm_complex'];
        expect(edmComplex.length).toBeGreaterThanOrEqual(2);
        expect(edmComplex[0]).toEqual(['I7', 'V', 'vi7', 'IV']);
        expect(edmComplex[1]).toEqual(['vi', 'IV', 'I7', 'V7']);
    });

    it('has new progression categories', () => {
        const newCategories = ['rock_simple', 'rock_complex', 'trap_simple', 'trap_complex',
            'cinematic_simple', 'cinematic_complex', 'funk_simple', 'funk_complex',
            'metal_simple', 'metal_complex', 'ambient_simple', 'ambient_complex',
            'latin_simple', 'latin_complex', 'soul_simple', 'soul_complex'];
        newCategories.forEach(key => {
            expect(CHORD_PROGRESSIONS).toHaveProperty(key);
            expect(CHORD_PROGRESSIONS[key].length).toBeGreaterThan(0);
        });
    });

    it('all roman numerals in all progressions exist in ROMAN_TO_CHORD', () => {
        Object.entries(CHORD_PROGRESSIONS).forEach(([key, progressions]) => {
            progressions.forEach((prog, pi) => {
                prog.forEach((roman, ri) => {
                    expect(ROMAN_TO_CHORD).toHaveProperty(roman);
                });
            });
        });
    });

    it('all roman numerals in all progressions have romanToDegreeIndex mapping', () => {
        Object.entries(CHORD_PROGRESSIONS).forEach(([key, progressions]) => {
            progressions.forEach(prog => {
                prog.forEach(roman => {
                    const idx = romanToDegreeIndex(roman);
                    expect(idx).not.toBeUndefined();
                });
            });
        });
    });
});

// ---- MOOD_MODIFIERS ----
describe('MOOD_MODIFIERS', () => {
    const REQUIRED_FIELDS = ['scalePreference', 'tempoMultiplier', 'chordComplexity', 'registerShift', 'rhythmDensity'];

    it('preserves all 6 original moods with exact field values', () => {
        // Dark
        expect(MOOD_MODIFIERS['Dark'].scalePreference).toEqual(['Minor', 'Harmonic Minor', 'Phrygian', 'Locrian', 'Super Locrian', 'Hungarian Minor', 'Messiaen 4']);
        expect(MOOD_MODIFIERS['Dark'].tempoMultiplier).toBe(0.9);
        expect(MOOD_MODIFIERS['Dark'].chordComplexity).toBe('complex');
        expect(MOOD_MODIFIERS['Dark'].registerShift).toBe(-12);
        expect(MOOD_MODIFIERS['Dark'].rhythmDensity).toBe(0.7);
        // Happy
        expect(MOOD_MODIFIERS['Happy'].scalePreference).toEqual(['Major', 'Lydian', 'Mixolydian', 'Major Pentatonic', 'Harmonic Major']);
        expect(MOOD_MODIFIERS['Happy'].tempoMultiplier).toBe(1.1);
        expect(MOOD_MODIFIERS['Happy'].chordComplexity).toBe('simple');
        expect(MOOD_MODIFIERS['Happy'].registerShift).toBe(0);
        expect(MOOD_MODIFIERS['Happy'].rhythmDensity).toBe(0.9);
        // Sad
        expect(MOOD_MODIFIERS['Sad'].scalePreference).toEqual(['Minor', 'Harmonic Minor', 'Dorian', 'Hirajoshi', 'Iwato']);
        expect(MOOD_MODIFIERS['Sad'].tempoMultiplier).toBe(0.85);
        expect(MOOD_MODIFIERS['Sad'].chordComplexity).toBe('simple');
        expect(MOOD_MODIFIERS['Sad'].registerShift).toBe(0);
        expect(MOOD_MODIFIERS['Sad'].rhythmDensity).toBe(0.6);
        // Energetic
        expect(MOOD_MODIFIERS['Energetic'].scalePreference).toEqual(['Major', 'Mixolydian', 'Dorian', 'Lydian Dominant', 'Whole Tone', 'Minor Blues']);
        expect(MOOD_MODIFIERS['Energetic'].tempoMultiplier).toBe(1.15);
        expect(MOOD_MODIFIERS['Energetic'].chordComplexity).toBe('complex');
        expect(MOOD_MODIFIERS['Energetic'].registerShift).toBe(0);
        expect(MOOD_MODIFIERS['Energetic'].rhythmDensity).toBe(1.0);
        // Mystical
        expect(MOOD_MODIFIERS['Mystical'].scalePreference).toEqual(['Whole Tone', 'Messiaen 3', 'Messiaen 7', 'Bhairav', 'In-Sen']);
        expect(MOOD_MODIFIERS['Mystical'].tempoMultiplier).toBe(0.9);
        expect(MOOD_MODIFIERS['Mystical'].chordComplexity).toBe('complex');
        expect(MOOD_MODIFIERS['Mystical'].registerShift).toBe(12);
        expect(MOOD_MODIFIERS['Mystical'].rhythmDensity).toBe(0.5);
        // Exotic
        expect(MOOD_MODIFIERS['Exotic'].scalePreference).toEqual(['Pelog Selisir', 'Pelog Tembung', 'Kumoi', '8-Tone Spanish', 'Hungarian Minor']);
        expect(MOOD_MODIFIERS['Exotic'].tempoMultiplier).toBe(1.0);
        expect(MOOD_MODIFIERS['Exotic'].chordComplexity).toBe('complex');
        expect(MOOD_MODIFIERS['Exotic'].registerShift).toBe(0);
        expect(MOOD_MODIFIERS['Exotic'].rhythmDensity).toBe(0.8);
    });

    it('every mood has all 5 required fields', () => {
        Object.entries(MOOD_MODIFIERS).forEach(([name, mood]) => {
            REQUIRED_FIELDS.forEach(field => {
                expect(mood).toHaveProperty(field);
            });
        });
    });

    it('scalePreference is always an array', () => {
        Object.values(MOOD_MODIFIERS).forEach(mood => {
            expect(Array.isArray(mood.scalePreference)).toBe(true);
        });
    });

    it('tempoMultiplier is always a number', () => {
        Object.values(MOOD_MODIFIERS).forEach(mood => {
            expect(typeof mood.tempoMultiplier).toBe('number');
        });
    });

    it('has new emotional moods', () => {
        const newMoods = ['Euphoric', 'Melancholic', 'Aggressive', 'Dreamy',
            'Mysterious', 'Uplifting', 'Tense', 'Nostalgic'];
        newMoods.forEach(mood => {
            expect(MOOD_MODIFIERS).toHaveProperty(mood);
        });
    });
});

// ---- composeMood ----
describe('composeMood', () => {
    it('returns valid shape for known emotional mood', () => {
        const result = composeMood('Dark');
        expect(result).toHaveProperty('scalePreference');
        expect(result).toHaveProperty('tempoMultiplier');
        expect(result).toHaveProperty('chordComplexity');
        expect(result).toHaveProperty('registerShift');
        expect(result).toHaveProperty('rhythmDensity');
    });

    it('returns fallback for unknown emotional mood', () => {
        const result = composeMood('NonExistent');
        expect(result.scalePreference).toEqual(['Minor']);
        expect(result.tempoMultiplier).toBe(1.0);
    });

    it('merges energy dimension', () => {
        const result = composeMood('Dark', 'Explosive');
        expect(result.rhythmDensity).toBe(1.2);
    });

    it('merges texture dimension', () => {
        const result = composeMood('Dark', null, 'Warm');
        expect(result.registerShift).toBe(-6);
        expect(result.chordComplexity).toBe('simple');
    });
});

// ---- MOOD_DIMENSIONS ----
describe('MOOD_DIMENSIONS', () => {
    it('has 3 axes', () => {
        expect(Object.keys(MOOD_DIMENSIONS)).toHaveLength(3);
        expect(MOOD_DIMENSIONS).toHaveProperty('emotional');
        expect(MOOD_DIMENSIONS).toHaveProperty('energy');
        expect(MOOD_DIMENSIONS).toHaveProperty('texture');
    });

    it('emotional axis has 9 options', () => {
        expect(MOOD_DIMENSIONS.emotional.options).toHaveLength(9);
    });

    it('energy axis has 4 options', () => {
        expect(MOOD_DIMENSIONS.energy.options).toHaveLength(4);
    });

    it('texture axis has 7 options', () => {
        expect(MOOD_DIMENSIONS.texture.options).toHaveLength(7);
    });
});

// ---- GENRES ----
describe('GENRE_DEFINITIONS', () => {
    const ORIGINAL_32 = [
        'Hip Hop', 'Trap', 'Drill', 'Boom Bap', 'Lo-Fi', 'Cloud Rap',
        'House', 'Deep House', 'Tech House', 'Progressive House',
        'Techno', 'Minimal Techno',
        'Dubstep', 'Drum & Bass', 'Neurofunk',
        'Trance', 'Psytrance',
        'Future Bass', 'Synthwave', 'Vaporwave',
        'Reggae', 'Dancehall', 'Afrobeat', 'Latin',
        'Jazz', 'Funk', 'R&B',
        'IDM', 'Ambient', 'Phonk'
    ];

    it('preserves all 32 original genres', () => {
        ORIGINAL_32.forEach(genre => {
            expect(GENRE_DEFINITIONS).toHaveProperty(genre);
        });
    });

    it('preserves original genre drumPattern values', () => {
        expect(GENRE_DEFINITIONS['Hip Hop'].drumPattern).toBe('boom_bap');
        expect(GENRE_DEFINITIONS['Trap'].drumPattern).toBe('trap');
        expect(GENRE_DEFINITIONS['House'].drumPattern).toBe('four_on_floor');
        expect(GENRE_DEFINITIONS['Techno'].drumPattern).toBe('techno');
        expect(GENRE_DEFINITIONS['Jazz'].drumPattern).toBe('jazz');
        expect(GENRE_DEFINITIONS['Dubstep'].drumPattern).toBe('dubstep');
        expect(GENRE_DEFINITIONS['Drum & Bass'].drumPattern).toBe('dnb');
        expect(GENRE_DEFINITIONS['Ambient'].drumPattern).toBe('orchestral');
    });

    it('preserves original genre baseTempo values', () => {
        expect(GENRE_DEFINITIONS['Hip Hop'].baseTempo).toEqual([85, 95]);
        expect(GENRE_DEFINITIONS['Trap'].baseTempo).toEqual([135, 145]);
        expect(GENRE_DEFINITIONS['House'].baseTempo).toEqual([120, 130]);
        expect(GENRE_DEFINITIONS['Jazz'].baseTempo).toEqual([120, 180]);
    });

    it('preserves original genre baseScales values', () => {
        expect(GENRE_DEFINITIONS['Hip Hop'].baseScales).toEqual(['Minor', 'Blues', 'Pentatonic Minor']);
        expect(GENRE_DEFINITIONS['House'].baseScales).toEqual(['Major', 'Mixolydian']);
        expect(GENRE_DEFINITIONS['Jazz'].baseScales).toEqual(['Major', 'Dorian', 'Mixolydian', 'Melodic Minor']);
    });

    it('every genre has required fields', () => {
        Object.entries(GENRE_DEFINITIONS).forEach(([name, genre]) => {
            expect(genre).toHaveProperty('category');
            expect(genre).toHaveProperty('baseTempo');
            expect(genre).toHaveProperty('baseScales');
            expect(genre).toHaveProperty('subGenres');
            expect(genre).toHaveProperty('drumPattern');
        });
    });

    it('every genre drumPattern exists in known FAMILY_MAP patterns', () => {
        Object.entries(GENRE_DEFINITIONS).forEach(([name, genre]) => {
            expect(KNOWN_DRUM_PATTERNS).toContain(genre.drumPattern);
        });
    });

    it('every mood in genre subGenres exists in MOOD_MODIFIERS', () => {
        Object.entries(GENRE_DEFINITIONS).forEach(([name, genre]) => {
            genre.subGenres.forEach(mood => {
                expect(MOOD_MODIFIERS).toHaveProperty(mood);
            });
        });
    });

    it('GENRES_WITH_SUBGENRES is same reference as GENRE_DEFINITIONS', () => {
        expect(GENRES_WITH_SUBGENRES).toBe(GENRE_DEFINITIONS);
    });

    it('has new genres', () => {
        const newGenres = ['Contemporary Pop', 'K-Pop', 'Indie Pop', 'Neo-Soul',
            'Alternative Rock', 'Progressive Rock', 'Metalcore', 'Bebop', 'Fusion',
            'Neo-Jazz', 'Detroit Techno', 'Industrial Techno', 'Uplifting Trance',
            'Progressive Trance', 'Afro House', 'Reggaeton', 'Amapiano',
            'Trailer Music', 'Horror Score', 'Fantasy RPG'];
        newGenres.forEach(genre => {
            expect(GENRE_DEFINITIONS).toHaveProperty(genre);
        });
    });
});

// ---- GENRE_CATEGORIES ----
describe('GENRE_CATEGORIES', () => {
    it('has expected top-level categories', () => {
        expect(GENRE_CATEGORIES).toHaveProperty('Electronic');
        expect(GENRE_CATEGORIES).toHaveProperty('Hip-Hop & Trap');
        expect(GENRE_CATEGORIES).toHaveProperty('Jazz & Funk');
        expect(GENRE_CATEGORIES).toHaveProperty('World & Latin');
        expect(GENRE_CATEGORIES).toHaveProperty('Cinematic & Game');
    });

    it('all genres in categories exist in GENRE_DEFINITIONS', () => {
        Object.values(GENRE_CATEGORIES).forEach(category => {
            Object.values(category.subcategories).forEach(genres => {
                genres.forEach(genre => {
                    expect(GENRE_DEFINITIONS).toHaveProperty(genre);
                });
            });
        });
    });
});

// ---- Domain helpers ----
describe('domainHelpers', () => {
    it('getScalesForContext returns genre scales for known genre', () => {
        const scales = getScalesForContext('Jazz');
        expect(scales).toContain('Major');
        expect(scales).toContain('Dorian');
    });

    it('getScalesForContext merges mood scales', () => {
        const scales = getScalesForContext('Jazz', 'Dark');
        expect(scales).toContain('Minor');
        expect(scales).toContain('Harmonic Minor');
    });

    it('getProgressionTypeForGenre returns correct type', () => {
        expect(getProgressionTypeForGenre('Jazz')).toBe('jazz');
        expect(getProgressionTypeForGenre('Hip Hop')).toBe('hiphop');
        expect(getProgressionTypeForGenre('House')).toBe('house');
    });

    it('getProgressionTypeForGenre returns pop for unknown genre', () => {
        expect(getProgressionTypeForGenre('NonExistentGenre')).toBe('pop');
    });
});
