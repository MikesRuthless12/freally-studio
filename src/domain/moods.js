// Domain: Mood dimensions, modifiers, and composition

// Three-axis mood dimensions for UI and composition
export const MOOD_DIMENSIONS = {
    emotional: {
        label: 'Emotional',
        options: ['Dark', 'Euphoric', 'Melancholic', 'Aggressive', 'Dreamy', 'Mysterious', 'Uplifting', 'Tense', 'Nostalgic']
    },
    energy: {
        label: 'Energy',
        options: ['Chill', 'Moderate', 'Energetic', 'Explosive']
    },
    texture: {
        label: 'Texture',
        options: ['Warm', 'Cold', 'Gritty', 'Clean', 'Analog', 'Digital', 'Cinematic']
    }
};

// Internal dimension data for composeMood merging
const ENERGY_MODIFIERS = {
    'Chill':     { tempoMultiplier: 0.8,  rhythmDensity: 0.4 },
    'Moderate':  { tempoMultiplier: 1.0,  rhythmDensity: 0.7 },
    'Energetic': { tempoMultiplier: 1.15, rhythmDensity: 1.0 },
    'Explosive': { tempoMultiplier: 1.3,  rhythmDensity: 1.2 }
};

const TEXTURE_MODIFIERS = {
    'Warm':      { registerShift: -6,  chordComplexity: 'simple' },
    'Cold':      { registerShift: 6,   chordComplexity: 'complex' },
    'Gritty':    { registerShift: -12, chordComplexity: 'complex' },
    'Clean':     { registerShift: 0,   chordComplexity: 'simple' },
    'Analog':    { registerShift: -3,  chordComplexity: 'simple' },
    'Digital':   { registerShift: 3,   chordComplexity: 'complex' },
    'Cinematic': { registerShift: 0,   chordComplexity: 'complex' }
};

// Flat mood modifiers — all 6 originals preserved exactly, plus 8 new emotional moods
// Shape contract: every entry MUST have { scalePreference, tempoMultiplier, chordComplexity, registerShift, rhythmDensity }
export const MOOD_MODIFIERS = {
    // ---- Original 6 (verbatim) ----
    'Dark': {
        scalePreference: ['Minor', 'Harmonic Minor', 'Phrygian', 'Locrian', 'Super Locrian', 'Hungarian Minor', 'Messiaen 4'],
        tempoMultiplier: 0.9,
        chordComplexity: 'complex',
        registerShift: -12,
        rhythmDensity: 0.7
    },
    'Happy': {
        scalePreference: ['Major', 'Lydian', 'Mixolydian', 'Major Pentatonic', 'Harmonic Major'],
        tempoMultiplier: 1.1,
        chordComplexity: 'simple',
        registerShift: 0,
        rhythmDensity: 0.9
    },
    'Sad': {
        scalePreference: ['Minor', 'Harmonic Minor', 'Dorian', 'Hirajoshi', 'Iwato'],
        tempoMultiplier: 0.85,
        chordComplexity: 'simple',
        registerShift: 0,
        rhythmDensity: 0.6
    },
    'Energetic': {
        scalePreference: ['Major', 'Mixolydian', 'Dorian', 'Lydian Dominant', 'Whole Tone', 'Minor Blues'],
        tempoMultiplier: 1.15,
        chordComplexity: 'complex',
        registerShift: 0,
        rhythmDensity: 1.0
    },
    'Mystical': {
        scalePreference: ['Whole Tone', 'Messiaen 3', 'Messiaen 7', 'Bhairav', 'In-Sen'],
        tempoMultiplier: 0.9,
        chordComplexity: 'complex',
        registerShift: 12,
        rhythmDensity: 0.5
    },
    'Exotic': {
        scalePreference: ['Pelog Selisir', 'Pelog Tembung', 'Kumoi', '8-Tone Spanish', 'Hungarian Minor'],
        tempoMultiplier: 1.0,
        chordComplexity: 'complex',
        registerShift: 0,
        rhythmDensity: 0.8
    },

    // ---- New emotional moods ----
    'Euphoric': {
        scalePreference: ['Major', 'Lydian', 'Mixolydian', 'Major Pentatonic'],
        tempoMultiplier: 1.2,
        chordComplexity: 'complex',
        registerShift: 12,
        rhythmDensity: 1.0
    },
    'Melancholic': {
        scalePreference: ['Minor', 'Dorian', 'Aeolian', 'Melodic Minor', 'Harmonic Minor'],
        tempoMultiplier: 0.8,
        chordComplexity: 'complex',
        registerShift: -6,
        rhythmDensity: 0.5
    },
    'Aggressive': {
        scalePreference: ['Phrygian', 'Locrian', 'Minor Blues', 'Half-whole Dim.', 'Super Locrian'],
        tempoMultiplier: 1.2,
        chordComplexity: 'complex',
        registerShift: -12,
        rhythmDensity: 1.1
    },
    'Dreamy': {
        scalePreference: ['Lydian', 'Whole Tone', 'Major Pentatonic', 'Messiaen 5', 'Hirajoshi'],
        tempoMultiplier: 0.85,
        chordComplexity: 'simple',
        registerShift: 12,
        rhythmDensity: 0.4
    },
    'Mysterious': {
        scalePreference: ['Whole Tone', 'Half-whole Dim.', 'Messiaen 3', 'Phrygian Dominant', 'Bhairav'],
        tempoMultiplier: 0.9,
        chordComplexity: 'complex',
        registerShift: 0,
        rhythmDensity: 0.6
    },
    'Uplifting': {
        scalePreference: ['Major', 'Lydian', 'Ionian', 'Major Pentatonic', 'Harmonic Major'],
        tempoMultiplier: 1.1,
        chordComplexity: 'simple',
        registerShift: 6,
        rhythmDensity: 0.9
    },
    'Tense': {
        scalePreference: ['Locrian', 'Phrygian', 'Half-whole Dim.', 'Whole-half Dim.', 'Super Locrian'],
        tempoMultiplier: 1.0,
        chordComplexity: 'complex',
        registerShift: -6,
        rhythmDensity: 0.8
    },
    'Nostalgic': {
        scalePreference: ['Dorian', 'Mixolydian', 'Minor Pentatonic', 'Major Pentatonic', 'Melodic Minor'],
        tempoMultiplier: 0.9,
        chordComplexity: 'simple',
        registerShift: 0,
        rhythmDensity: 0.7
    }
};

/**
 * Compose a mood from up to 3 dimensions.
 * Returns a merged modifier object with the standard 5-field shape.
 * Emotional dimension is required; energy and texture are optional overrides.
 */
export const composeMood = (emotional, energy = null, texture = null) => {
    const base = MOOD_MODIFIERS[emotional];
    if (!base) {
        return {
            scalePreference: ['Minor'],
            tempoMultiplier: 1.0,
            chordComplexity: 'simple',
            registerShift: 0,
            rhythmDensity: 0.7
        };
    }

    const result = { ...base };

    if (energy && ENERGY_MODIFIERS[energy]) {
        const e = ENERGY_MODIFIERS[energy];
        result.tempoMultiplier = base.tempoMultiplier * e.tempoMultiplier;
        result.rhythmDensity = e.rhythmDensity;
    }

    if (texture && TEXTURE_MODIFIERS[texture]) {
        const t = TEXTURE_MODIFIERS[texture];
        result.registerShift = t.registerShift;
        result.chordComplexity = t.chordComplexity;
    }

    return result;
};
