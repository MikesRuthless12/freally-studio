// Domain: Keys, note names, enharmonics, and modulation helpers

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Bidirectional enharmonic map
export const ENHARMONIC_MAP = {
    'C#': 'Db', 'Db': 'C#',
    'D#': 'Eb', 'Eb': 'D#',
    'F#': 'Gb', 'Gb': 'F#',
    'G#': 'Ab', 'Ab': 'G#',
    'A#': 'Bb', 'Bb': 'A#',
    // Natural note identity mappings
    'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'A': 'A', 'B': 'B'
};

// Per-key metadata with emotional color and genre affinity
export const KEY_METADATA = {
    'C':  { emotion: 'pure, innocent',       genreAffinity: ['Pop', 'Classical', 'Ambient'] },
    'C#': { emotion: 'sparkling, tense',     genreAffinity: ['EDM', 'Trance', 'Cinematic'] },
    'D':  { emotion: 'triumphant, bright',   genreAffinity: ['Rock', 'Pop', 'Country'] },
    'D#': { emotion: 'anxious, restless',    genreAffinity: ['Metal', 'Dubstep', 'Cinematic'] },
    'E':  { emotion: 'joyful, warm',         genreAffinity: ['Rock', 'Folk', 'Blues'] },
    'F':  { emotion: 'pastoral, calm',       genreAffinity: ['Classical', 'Ambient', 'Jazz'] },
    'F#': { emotion: 'brilliant, piercing',  genreAffinity: ['Progressive', 'Fusion', 'Metal'] },
    'G':  { emotion: 'strong, heroic',       genreAffinity: ['Rock', 'Country', 'Pop'] },
    'G#': { emotion: 'mysterious, dark',     genreAffinity: ['Trap', 'Dubstep', 'Cinematic'] },
    'A':  { emotion: 'warm, mellow',         genreAffinity: ['Jazz', 'R&B', 'Folk'] },
    'A#': { emotion: 'bold, dramatic',       genreAffinity: ['Funk', 'Hip Hop', 'Soul'] },
    'B':  { emotion: 'wistful, contemplative', genreAffinity: ['Jazz', 'Progressive', 'Ambient'] }
};

// Modulation targets: offsets for related keys (in semitones)
export const MODULATION_TARGETS = {
    major: {
        relative: -3,      // Relative minor (down 3 semitones)
        parallel: 0,        // Parallel minor (same root)
        dominant: 7,        // V
        subdominant: 5      // IV
    },
    minor: {
        relative: 3,        // Relative major (up 3 semitones)
        parallel: 0,        // Parallel major (same root)
        dominant: 7,        // v or V
        subdominant: 5      // iv
    }
};

// Resolve enharmonic equivalent
export const resolveEnharmonic = (name) => {
    return ENHARMONIC_MAP[name] || name;
};

// Get semitone index (0-11) for a key name, supporting enharmonics
export const getKeyIndex = (key) => {
    let idx = NOTE_NAMES.indexOf(key);
    if (idx !== -1) return idx;
    // Try enharmonic
    const resolved = resolveEnharmonic(key);
    idx = NOTE_NAMES.indexOf(resolved);
    return idx !== -1 ? idx : 0;
};
