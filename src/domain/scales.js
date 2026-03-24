// Domain: Scale definitions with metadata and categorization

// Scale categories for UI grouping
export const SCALE_CATEGORIES = {
    'Common': [
        'Major', 'Minor', 'Harmonic Minor', 'Melodic Minor', 'Harmonic Major'
    ],
    'Modes': [
        'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'
    ],
    'Jazz & Fusion': [
        'Lydian Augmented', 'Lydian Dominant', 'Super Locrian', 'Altered',
        'Dorian #4', 'Bebop Major', 'Bebop Dominant', 'Bebop Minor', 'Bebop Dorian'
    ],
    'Pentatonic & Blues': [
        'Major Pentatonic', 'Minor Pentatonic', 'Minor Blues',
        'Major Blues', 'Blues', 'Neutral Pentatonic', 'Chromatic'
    ],
    'World & Exotic': [
        'Phrygian Dominant', 'Bhairav', 'Hungarian Minor', '8-Tone Spanish',
        'Hirajoshi', 'In-Sen', 'Iwato', 'Kumoi', 'Pelog Selisir', 'Pelog Tembung',
        'Hijaz', 'Byzantine', 'Persian', 'Arabic', 'Chinese Pentatonic',
        'Balinese', 'Egyptian'
    ],
    'Symmetrical & Synthetic': [
        'Whole Tone', 'Half-whole Dim.', 'Whole-half Dim.',
        'Augmented', 'Tritone', 'Enigmatic', 'Prometheus',
        'Double Harmonic Major', 'Neapolitan Minor', 'Neapolitan Major'
    ],
    'Messiaen': [
        'Messiaen 3', 'Messiaen 4', 'Messiaen 5', 'Messiaen 6', 'Messiaen 7'
    ]
};

// Full scale catalog with metadata
export const SCALES_CATALOG = {
    // ---- Common ----
    'Major':           { intervals: [0, 2, 4, 5, 7, 9, 11], category: 'Common',   emotion: 'bright, happy',    chordCompat: ['major', 'major7'], genreWeight: { pop: 1.0, rock: 0.8, jazz: 0.7 } },
    'Minor':           { intervals: [0, 2, 3, 5, 7, 8, 10], category: 'Common',   emotion: 'dark, emotional',  chordCompat: ['minor', 'minor7'], genreWeight: { hiphop: 1.0, trap: 0.9, edm: 0.7 } },
    'Harmonic Minor':  { intervals: [0, 2, 3, 5, 7, 8, 11], category: 'Common',   emotion: 'dramatic, tense',  chordCompat: ['minor', 'diminished'], genreWeight: { cinematic: 0.9, metal: 0.8 } },
    'Melodic Minor':   { intervals: [0, 2, 3, 5, 7, 9, 11], category: 'Common',   emotion: 'smooth, jazz',     chordCompat: ['minor', 'major7'], genreWeight: { jazz: 1.0, fusion: 0.9 } },
    'Harmonic Major':  { intervals: [0, 2, 4, 5, 7, 8, 11], category: 'Common',   emotion: 'bittersweet',      chordCompat: ['major', 'diminished'], genreWeight: { classical: 0.8, cinematic: 0.7 } },

    // ---- Modes ----
    'Ionian':          { intervals: [0, 2, 4, 5, 7, 9, 11], category: 'Modes',    emotion: 'bright, happy',    chordCompat: ['major', 'major7'], genreWeight: { pop: 0.9, rock: 0.7 } },
    'Dorian':          { intervals: [0, 2, 3, 5, 7, 9, 10], category: 'Modes',    emotion: 'cool, sophisticated', chordCompat: ['minor', 'minor7'], genreWeight: { jazz: 0.9, funk: 0.9 } },
    'Phrygian':        { intervals: [0, 1, 3, 5, 7, 8, 10], category: 'Modes',    emotion: 'exotic, dark',     chordCompat: ['minor', 'sus2'], genreWeight: { metal: 0.9, world: 0.8 } },
    'Lydian':          { intervals: [0, 2, 4, 6, 7, 9, 11], category: 'Modes',    emotion: 'dreamy, ethereal', chordCompat: ['major', 'major7'], genreWeight: { cinematic: 0.9, progressive: 0.8 } },
    'Mixolydian':      { intervals: [0, 2, 4, 5, 7, 9, 10], category: 'Modes',    emotion: 'bluesy, laid-back', chordCompat: ['major', 'dominant7'], genreWeight: { rock: 0.9, funk: 0.8 } },
    'Aeolian':         { intervals: [0, 2, 3, 5, 7, 8, 10], category: 'Modes',    emotion: 'melancholy, somber', chordCompat: ['minor', 'minor7'], genreWeight: { rock: 0.8, pop: 0.7 } },
    'Locrian':         { intervals: [0, 1, 3, 5, 6, 8, 10], category: 'Modes',    emotion: 'unstable, dissonant', chordCompat: ['diminished'], genreWeight: { metal: 0.7, experimental: 0.8 } },

    // ---- Jazz & Fusion ----
    'Lydian Augmented':  { intervals: [0, 2, 4, 6, 8, 9, 11], category: 'Jazz & Fusion', emotion: 'floating, bright',  chordCompat: ['augmented', 'major7'], genreWeight: { jazz: 0.8, fusion: 0.9 } },
    'Lydian Dominant':   { intervals: [0, 2, 4, 6, 7, 9, 10], category: 'Jazz & Fusion', emotion: 'bold, bluesy',      chordCompat: ['dominant7'], genreWeight: { jazz: 0.8, funk: 0.7 } },
    'Super Locrian':     { intervals: [0, 1, 3, 4, 6, 8, 10], category: 'Jazz & Fusion', emotion: 'angular, tense',    chordCompat: ['diminished', 'dominant7'], genreWeight: { jazz: 0.9, fusion: 0.8 } },
    'Altered':           { intervals: [0, 1, 3, 4, 6, 8, 10], category: 'Jazz & Fusion', emotion: 'chromatic, outside', chordCompat: ['dominant7'], genreWeight: { jazz: 1.0, fusion: 0.9 } },
    'Dorian #4':         { intervals: [0, 2, 3, 6, 7, 9, 10], category: 'Jazz & Fusion', emotion: 'exotic, groovy',    chordCompat: ['minor7'], genreWeight: { fusion: 0.8, world: 0.7 } },
    'Bebop Major':       { intervals: [0, 2, 4, 5, 7, 8, 9, 11], category: 'Jazz & Fusion', emotion: 'swinging, smooth',  chordCompat: ['major7'], genreWeight: { jazz: 0.9, bebop: 1.0 } },
    'Bebop Dominant':    { intervals: [0, 2, 4, 5, 7, 9, 10, 11], category: 'Jazz & Fusion', emotion: 'driving, bluesy',   chordCompat: ['dominant7'], genreWeight: { jazz: 0.9, bebop: 1.0 } },
    'Bebop Minor':       { intervals: [0, 2, 3, 5, 7, 8, 9, 10], category: 'Jazz & Fusion', emotion: 'cool, sophisticated', chordCompat: ['minor7'], genreWeight: { jazz: 0.8, bebop: 0.9 } },
    'Bebop Dorian':      { intervals: [0, 2, 3, 4, 5, 7, 9, 10], category: 'Jazz & Fusion', emotion: 'hip, funky',       chordCompat: ['minor7'], genreWeight: { jazz: 0.8, funk: 0.7 } },

    // ---- Pentatonic & Blues ----
    'Major Pentatonic':  { intervals: [0, 2, 4, 7, 9],     category: 'Pentatonic & Blues', emotion: 'open, folk',       chordCompat: ['major'], genreWeight: { pop: 0.8, country: 0.9 } },
    'Minor Pentatonic':  { intervals: [0, 3, 5, 7, 10],    category: 'Pentatonic & Blues', emotion: 'raw, bluesy',      chordCompat: ['minor'], genreWeight: { rock: 0.9, blues: 1.0 } },
    'Minor Blues':       { intervals: [0, 3, 5, 6, 7, 10], category: 'Pentatonic & Blues', emotion: 'gritty, soulful',  chordCompat: ['minor', 'dominant7'], genreWeight: { blues: 1.0, rock: 0.8 } },
    'Major Blues':       { intervals: [0, 2, 3, 4, 7, 9],  category: 'Pentatonic & Blues', emotion: 'warm, groovy',     chordCompat: ['major', 'dominant7'], genreWeight: { blues: 0.9, jazz: 0.7 } },
    'Blues':             { intervals: [0, 3, 5, 6, 7, 10], category: 'Pentatonic & Blues', emotion: 'raw, expressive',  chordCompat: ['minor', 'dominant7'], genreWeight: { blues: 1.0, rock: 0.9 } },
    'Neutral Pentatonic': { intervals: [0, 2, 5, 7, 10],   category: 'Pentatonic & Blues', emotion: 'ambiguous, open',  chordCompat: ['sus2', 'sus4'], genreWeight: { world: 0.8, ambient: 0.7 } },
    'Chromatic':         { intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], category: 'Pentatonic & Blues', emotion: 'atonal, all-encompassing', chordCompat: ['diminished', 'augmented'], genreWeight: { experimental: 1.0, idm: 0.9 } },

    // ---- World & Exotic ----
    'Phrygian Dominant': { intervals: [0, 1, 4, 5, 7, 8, 10], category: 'World & Exotic', emotion: 'Spanish, intense',   chordCompat: ['major', 'dominant7'], genreWeight: { flamenco: 1.0, metal: 0.7 } },
    'Bhairav':           { intervals: [0, 1, 4, 5, 7, 8, 11], category: 'World & Exotic', emotion: 'devotional, dawn',   chordCompat: ['major'], genreWeight: { world: 1.0, cinematic: 0.7 } },
    'Hungarian Minor':   { intervals: [0, 2, 3, 6, 7, 8, 11], category: 'World & Exotic', emotion: 'gypsy, passionate',  chordCompat: ['minor', 'augmented'], genreWeight: { world: 0.9, classical: 0.7 } },
    '8-Tone Spanish':    { intervals: [0, 1, 3, 4, 5, 6, 8, 10], category: 'World & Exotic', emotion: 'flamenco, dense',  chordCompat: ['dominant7'], genreWeight: { flamenco: 0.9, world: 0.8 } },
    'Hirajoshi':         { intervals: [0, 4, 6, 7, 11],    category: 'World & Exotic', emotion: 'Japanese, serene',   chordCompat: ['sus2', 'minor'], genreWeight: { world: 1.0, ambient: 0.8 } },
    'In-Sen':            { intervals: [0, 1, 5, 7, 10],    category: 'World & Exotic', emotion: 'Japanese, moody',    chordCompat: ['minor', 'sus4'], genreWeight: { world: 0.9, ambient: 0.7 } },
    'Iwato':             { intervals: [0, 1, 5, 6, 10],    category: 'World & Exotic', emotion: 'Japanese, stark',    chordCompat: ['diminished'], genreWeight: { world: 0.8, experimental: 0.7 } },
    'Kumoi':             { intervals: [0, 2, 3, 7, 9],     category: 'World & Exotic', emotion: 'Japanese, gentle',   chordCompat: ['minor', 'sus2'], genreWeight: { world: 0.9, ambient: 0.8 } },
    'Pelog Selisir':     { intervals: [0, 1, 3, 7, 8],     category: 'World & Exotic', emotion: 'Balinese, mystical', chordCompat: ['minor'], genreWeight: { world: 1.0, experimental: 0.7 } },
    'Pelog Tembung':     { intervals: [0, 1, 5, 7, 8],     category: 'World & Exotic', emotion: 'Balinese, haunting', chordCompat: ['sus4'], genreWeight: { world: 1.0, experimental: 0.7 } },
    'Hijaz':             { intervals: [0, 1, 4, 5, 7, 8, 10], category: 'World & Exotic', emotion: 'Arabic, yearning',   chordCompat: ['major', 'dominant7'], genreWeight: { world: 1.0, cinematic: 0.7 } },
    'Byzantine':         { intervals: [0, 1, 4, 5, 7, 8, 11], category: 'World & Exotic', emotion: 'Eastern, sacred',    chordCompat: ['major', 'augmented'], genreWeight: { world: 0.9, cinematic: 0.8 } },
    'Persian':           { intervals: [0, 1, 4, 5, 6, 8, 11], category: 'World & Exotic', emotion: 'Persian, intricate', chordCompat: ['diminished', 'major'], genreWeight: { world: 1.0, cinematic: 0.7 } },
    'Arabic':            { intervals: [0, 2, 4, 5, 6, 8, 10], category: 'World & Exotic', emotion: 'Middle Eastern, flowing', chordCompat: ['major', 'dominant7'], genreWeight: { world: 1.0, cinematic: 0.7 } },
    'Chinese Pentatonic': { intervals: [0, 2, 4, 7, 9],   category: 'World & Exotic', emotion: 'Eastern, serene',    chordCompat: ['major', 'sus2'], genreWeight: { world: 1.0, ambient: 0.7 } },
    'Balinese':          { intervals: [0, 1, 3, 7, 8],     category: 'World & Exotic', emotion: 'gamelan, mystical',  chordCompat: ['minor', 'sus4'], genreWeight: { world: 1.0, experimental: 0.7 } },
    'Egyptian':          { intervals: [0, 2, 5, 7, 10],    category: 'World & Exotic', emotion: 'ancient, solemn',    chordCompat: ['sus2', 'sus4'], genreWeight: { world: 0.9, cinematic: 0.8 } },

    // ---- Symmetrical & Synthetic ----
    'Whole Tone':        { intervals: [0, 2, 4, 6, 8, 10], category: 'Symmetrical & Synthetic', emotion: 'dreamy, floating',   chordCompat: ['augmented'], genreWeight: { impressionist: 0.9, ambient: 0.8 } },
    'Half-whole Dim.':   { intervals: [0, 1, 3, 4, 6, 7, 9, 10], category: 'Symmetrical & Synthetic', emotion: 'tense, jazzy',  chordCompat: ['diminished', 'dominant7'], genreWeight: { jazz: 0.9, fusion: 0.8 } },
    'Whole-half Dim.':   { intervals: [0, 2, 3, 5, 6, 8, 9, 11], category: 'Symmetrical & Synthetic', emotion: 'dark, unstable', chordCompat: ['diminished'], genreWeight: { jazz: 0.8, cinematic: 0.7 } },
    'Augmented':         { intervals: [0, 3, 4, 7, 8, 11], category: 'Symmetrical & Synthetic', emotion: 'symmetrical, surreal', chordCompat: ['augmented', 'major'], genreWeight: { jazz: 0.7, experimental: 0.8 } },
    'Tritone':           { intervals: [0, 1, 4, 6, 7, 10], category: 'Symmetrical & Synthetic', emotion: 'dissonant, edgy',    chordCompat: ['dominant7', 'diminished'], genreWeight: { experimental: 0.9, jazz: 0.6 } },
    'Enigmatic':         { intervals: [0, 1, 4, 6, 8, 10, 11], category: 'Symmetrical & Synthetic', emotion: 'mysterious, unresolved', chordCompat: ['augmented'], genreWeight: { cinematic: 0.8, experimental: 0.9 } },
    'Prometheus':        { intervals: [0, 2, 4, 6, 9, 10], category: 'Symmetrical & Synthetic', emotion: 'luminous, other-worldly', chordCompat: ['augmented', 'dominant7'], genreWeight: { experimental: 0.9, ambient: 0.7 } },
    'Double Harmonic Major': { intervals: [0, 1, 4, 5, 7, 8, 11], category: 'Symmetrical & Synthetic', emotion: 'exotic, majestic', chordCompat: ['major', 'augmented'], genreWeight: { world: 0.9, cinematic: 0.8 } },
    'Neapolitan Minor':  { intervals: [0, 1, 3, 5, 7, 8, 11], category: 'Symmetrical & Synthetic', emotion: 'dark, operatic',    chordCompat: ['minor', 'diminished'], genreWeight: { classical: 0.9, cinematic: 0.8 } },
    'Neapolitan Major':  { intervals: [0, 1, 3, 5, 7, 9, 11], category: 'Symmetrical & Synthetic', emotion: 'lush, romantic',    chordCompat: ['major', 'minor'], genreWeight: { classical: 0.9, cinematic: 0.7 } },

    // ---- Messiaen ----
    'Messiaen 3': { intervals: [0, 2, 3, 4, 6, 7, 8, 10, 11], category: 'Messiaen', emotion: 'complex, luminous',  chordCompat: ['augmented', 'major7'], genreWeight: { experimental: 0.9, cinematic: 0.7 } },
    'Messiaen 4': { intervals: [0, 1, 2, 5, 6, 7, 8, 11],     category: 'Messiaen', emotion: 'ritualistic, dense', chordCompat: ['diminished'], genreWeight: { experimental: 0.9, cinematic: 0.6 } },
    'Messiaen 5': { intervals: [0, 1, 5, 6, 7, 11],            category: 'Messiaen', emotion: 'sparse, bell-like',  chordCompat: ['sus4', 'major'], genreWeight: { experimental: 0.8, ambient: 0.7 } },
    'Messiaen 6': { intervals: [0, 2, 4, 5, 6, 8, 10, 11],     category: 'Messiaen', emotion: 'shimmering, whole-tone-ish', chordCompat: ['augmented', 'dominant7'], genreWeight: { experimental: 0.9, impressionist: 0.7 } },
    'Messiaen 7': { intervals: [0, 1, 2, 3, 5, 6, 7, 8, 9, 11], category: 'Messiaen', emotion: 'chromatic, saturated', chordCompat: ['diminished', 'augmented'], genreWeight: { experimental: 1.0, cinematic: 0.6 } }
};

// Backward-compatible flat SCALES object: { name: intervals[] }
export const SCALES = Object.fromEntries(
    Object.entries(SCALES_CATALOG).map(([name, data]) => [name, data.intervals])
);

// Get scales grouped by category
export const getScalesByCategory = () => {
    return { ...SCALE_CATEGORIES };
};

// Get scales that work well with a genre type
export const getScalesForGenreType = (genreType) => {
    return Object.entries(SCALES_CATALOG)
        .filter(([, data]) => data.genreWeight && data.genreWeight[genreType] >= 0.7)
        .sort((a, b) => (b[1].genreWeight[genreType] || 0) - (a[1].genreWeight[genreType] || 0))
        .map(([name]) => name);
};
