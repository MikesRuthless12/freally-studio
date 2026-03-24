// GenreDefinitions.js - Comprehensive genre database for pro-level music generation

export const GENRES = {
    // === URBAN / HIP HOP ===
    'Trap': {
        category: 'Urban',
        tempo: [130, 160],
        scales: ['Minor', 'Harmonic Minor', 'Phrygian'],
        chordProgressions: [
            ['i', 'VI', 'III', 'VII'],
            ['i', 'iv', 'VII', 'VI'],
            ['i', 'VII', 'VI', 'VII']
        ],
        drumPattern: 'trap',
        melodyStyle: 'sparse',
        bassStyle: '808'
    },
    
    'Hip Hop': {
        category: 'Urban',
        tempo: [80, 100],
        scales: ['Minor', 'Blues', 'Pentatonic Minor'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'i', 'V'],
            ['i', 'VI', 'iv', 'V']
        ],
        drumPattern: 'boom_bap',
        melodyStyle: 'jazzy',
        bassStyle: 'sub'
    },

    'Drill': {
        category: 'Urban',
        tempo: [140, 150],
        scales: ['Minor', 'Phrygian', 'Locrian'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'v'],
            ['i', 'VI', 'VII', 'i'],
            ['i', 'iv', 'VII', 'VI']
        ],
        drumPattern: 'drill',
        melodyStyle: 'dark',
        bassStyle: '808_slide'
    },

    'Lo-Fi': {
        category: 'Urban',
        tempo: [70, 90],
        scales: ['Major', 'Dorian', 'Mixolydian'],
        chordProgressions: [
            ['I', 'V', 'vi', 'IV'],
            ['ii', 'V', 'I', 'vi'],
            ['I', 'iii', 'vi', 'IV']
        ],
        drumPattern: 'lofi',
        melodyStyle: 'jazzy',
        bassStyle: 'walking'
    },

    // === ELECTRONIC / DANCE ===
    'House': {
        category: 'Electronic',
        tempo: [120, 130],
        scales: ['Major', 'Mixolydian'],
        chordProgressions: [
            ['I', 'V', 'vi', 'IV'],
            ['I', 'IV', 'V', 'I'],
            ['vi', 'IV', 'I', 'V']
        ],
        drumPattern: 'four_on_floor',
        melodyStyle: 'uplifting',
        bassStyle: 'sub'
    },

    'Techno': {
        category: 'Electronic',
        tempo: [125, 135],
        scales: ['Minor', 'Phrygian'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'i', 'iv'],
            ['i', 'VI', 'VII', 'i']
        ],
        drumPattern: 'techno',
        melodyStyle: 'hypnotic',
        bassStyle: 'rolling'
    },

    'Drum & Bass': {
        category: 'Electronic',
        tempo: [170, 180],
        scales: ['Minor', 'Harmonic Minor'],
        chordProgressions: [
            ['i', 'VI', 'III', 'VII'],
            ['i', 'iv', 'VII', 'VI'],
            ['i', 'VII', 'VI', 'v']
        ],
        drumPattern: 'dnb',
        melodyStyle: 'atmospheric',
        bassStyle: 'reese'
    },

    'Dubstep': {
        category: 'Electronic',
        tempo: [140, 145],
        scales: ['Minor', 'Phrygian'],
        chordProgressions: [
            ['i', 'VI', 'III', 'VII'],
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'VII', 'i']
        ],
        drumPattern: 'dubstep',
        melodyStyle: 'aggressive',
        bassStyle: 'wobble'
    },

    'Trance': {
        category: 'Electronic',
        tempo: [130, 145],
        scales: ['Major', 'Minor'],
        chordProgressions: [
            ['I', 'V', 'vi', 'IV'],
            ['vi', 'IV', 'I', 'V'],
            ['I', 'vi', 'IV', 'V']
        ],
        drumPattern: 'trance',
        melodyStyle: 'euphoric',
        bassStyle: 'rolling'
    },

    'Future Bass': {
        category: 'Electronic',
        tempo: [140, 160],
        scales: ['Major', 'Lydian'],
        chordProgressions: [
            ['I', 'V', 'vi', 'IV'],
            ['I', 'iii', 'IV', 'V'],
            ['vi', 'IV', 'I', 'V']
        ],
        drumPattern: 'future_bass',
        melodyStyle: 'bright',
        bassStyle: 'sub'
    },

    'Garage': {
        category: 'Electronic',
        tempo: [130, 140],
        scales: ['Minor', 'Dorian'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'VII', 'VI'],
            ['i', 'VI', 'VII', 'i']
        ],
        drumPattern: 'garage',
        melodyStyle: 'skippy',
        bassStyle: 'sub'
    },

    // === WORLD / LATIN ===
    'Reggaeton': {
        category: 'Latin',
        tempo: [90, 100],
        scales: ['Minor', 'Harmonic Minor'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'VII', 'VI'],
            ['i', 'VI', 'VII', 'i']
        ],
        drumPattern: 'reggaeton',
        melodyStyle: 'latin',
        bassStyle: 'dembow'
    },

    'Afrobeat': {
        category: 'World',
        tempo: [100, 120],
        scales: ['Major', 'Pentatonic Major'],
        chordProgressions: [
            ['I', 'IV', 'V', 'I'],
            ['I', 'V', 'vi', 'IV'],
            ['I', 'iii', 'IV', 'V']
        ],
        drumPattern: 'afrobeat',
        melodyStyle: 'rhythmic',
        bassStyle: 'syncopated'
    },

    'Reggae': {
        category: 'World',
        tempo: [70, 90],
        scales: ['Major', 'Mixolydian'],
        chordProgressions: [
            ['I', 'V', 'vi', 'IV'],
            ['I', 'IV', 'I', 'V'],
            ['I', 'vi', 'IV', 'V']
        ],
        drumPattern: 'reggae',
        melodyStyle: 'laid_back',
        bassStyle: 'offbeat'
    },

    'Samba': {
        category: 'Latin',
        tempo: [170, 190],
        scales: ['Major', 'Harmonic Minor'],
        chordProgressions: [
            ['I', 'IV', 'V', 'I'],
            ['i', 'iv', 'V', 'i'],
            ['I', 'vi', 'ii', 'V']
        ],
        drumPattern: 'samba',
        melodyStyle: 'bright',
        bassStyle: 'syncopated'
    },

    // === JAZZ / FUNK / SOUL ===
    'Jazz': {
        category: 'Jazz',
        tempo: [120, 180],
        scales: ['Major', 'Dorian', 'Mixolydian'],
        chordProgressions: [
            ['ii', 'V', 'I', 'vi'],
            ['I', 'vi', 'ii', 'V'],
            ['iii', 'vi', 'ii', 'V']
        ],
        drumPattern: 'jazz',
        melodyStyle: 'bebop',
        bassStyle: 'walking'
    },

    'Funk': {
        category: 'Funk',
        tempo: [100, 120],
        scales: ['Mixolydian', 'Dorian', 'Blues'],
        chordProgressions: [
            ['I7', 'IV7', 'I7', 'V7'],
            ['i7', 'iv7', 'i7', 'iv7'],
            ['I7', 'bVII7', 'IV7', 'I7']
        ],
        drumPattern: 'funk',
        melodyStyle: 'syncopated',
        bassStyle: 'slap'
    },

    'Soul': {
        category: 'Soul',
        tempo: [70, 95],
        scales: ['Major', 'Minor', 'Blues'],
        chordProgressions: [
            ['I', 'vi', 'IV', 'V'],
            ['I', 'IV', 'I', 'V'],
            ['vi', 'IV', 'I', 'V']
        ],
        drumPattern: 'soul',
        melodyStyle: 'smooth',
        bassStyle: 'groove'
    },

    'Neo-Soul': {
        category: 'Soul',
        tempo: [80, 100],
        scales: ['Dorian', 'Mixolydian'],
        chordProgressions: [
            ['ii', 'V', 'I', 'IV'],
            ['I', 'iii', 'vi', 'IV'],
            ['ii', 'iii', 'IV', 'V']
        ],
        drumPattern: 'neo_soul',
        melodyStyle: 'jazzy',
        bassStyle: 'groove'
    },

    // === ROCK / METAL ===
    'Rock': {
        category: 'Rock',
        tempo: [110, 140],
        scales: ['Minor', 'Pentatonic Minor'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'VI', 'III', 'VII'],
            ['i', 'iv', 'VII', 'i']
        ],
        drumPattern: 'rock',
        melodyStyle: 'powerful',
        bassStyle: 'root'
    },

    'Metal': {
        category: 'Rock',
        tempo: [140, 180],
        scales: ['Phrygian', 'Locrian', 'Harmonic Minor'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'v'],
            ['i', 'VI', 'VII', 'i'],
            ['i', 'iv', 'VII', 'VI']
        ],
        drumPattern: 'metal',
        melodyStyle: 'aggressive',
        bassStyle: 'root'
    },

    'Punk': {
        category: 'Rock',
        tempo: [160, 190],
        scales: ['Major', 'Minor'],
        chordProgressions: [
            ['I', 'IV', 'V', 'I'],
            ['i', 'VII', 'VI', 'VII'],
            ['I', 'V', 'vi', 'IV']
        ],
        drumPattern: 'punk',
        melodyStyle: 'raw',
        bassStyle: 'root'
    },

    // === AMBIENT / EXPERIMENTAL ===
    'Ambient': {
        category: 'Ambient',
        tempo: [60, 90],
        scales: ['Major', 'Lydian', 'Whole Tone'],
        chordProgressions: [
            ['I', 'IV', 'V', 'I'],
            ['I', 'iii', 'vi', 'IV'],
            ['I', 'V', 'IV', 'I']
        ],
        drumPattern: 'ambient',
        melodyStyle: 'ethereal',
        bassStyle: 'drone'
    },

    'IDM': {
        category: 'Electronic',
        tempo: [120, 160],
        scales: ['Chromatic', 'Whole Tone'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'v'],
            ['I', 'bII', 'bVII', 'I'],
            ['i', 'iv', 'VII', 'VI']
        ],
        drumPattern: 'idm',
        melodyStyle: 'glitchy',
        bassStyle: 'experimental'
    },

    // === POP / COMMERCIAL ===
    'Pop': {
        category: 'Pop',
        tempo: [100, 130],
        scales: ['Major', 'Minor'],
        chordProgressions: [
            ['I', 'V', 'vi', 'IV'],
            ['vi', 'IV', 'I', 'V'],
            ['I', 'vi', 'IV', 'V']
        ],
        drumPattern: 'pop',
        melodyStyle: 'catchy',
        bassStyle: 'simple'
    },

    'R&B': {
        category: 'R&B',
        tempo: [70, 100],
        scales: ['Minor', 'Dorian'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'VII', 'VI'],
            ['i', 'VI', 'iv', 'V']
        ],
        drumPattern: 'rnb',
        melodyStyle: 'smooth',
        bassStyle: 'groove'
    },

    'Synthwave': {
        category: 'Electronic',
        tempo: [100, 120],
        scales: ['Minor', 'Dorian'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'VII', 'VI'],
            ['i', 'VI', 'VII', 'i']
        ],
        drumPattern: 'synthwave',
        melodyStyle: 'retro',
        bassStyle: 'synth'
    },

    'Vaporwave': {
        category: 'Electronic',
        tempo: [80, 100],
        scales: ['Major', 'Lydian'],
        chordProgressions: [
            ['I', 'iii', 'vi', 'IV'],
            ['I', 'V', 'vi', 'IV'],
            ['I', 'vi', 'IV', 'V']
        ],
        drumPattern: 'vaporwave',
        melodyStyle: 'dreamy',
        bassStyle: 'sub'
    },

    // === EXPERIMENTAL / NICHE ===
    'Breakbeat': {
        category: 'Electronic',
        tempo: [130, 150],
        scales: ['Minor', 'Blues'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'VII', 'VI'],
            ['i', 'VI', 'VII', 'i']
        ],
        drumPattern: 'breakbeat',
        melodyStyle: 'energetic',
        bassStyle: 'rolling'
    },

    'Hardstyle': {
        category: 'Electronic',
        tempo: [145, 155],
        scales: ['Minor', 'Harmonic Minor'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'VI', 'III', 'VII'],
            ['i', 'iv', 'VII', 'i']
        ],
        drumPattern: 'hardstyle',
        melodyStyle: 'epic',
        bassStyle: 'distorted'
    },

    'Footwork': {
        category: 'Electronic',
        tempo: [155, 165],
        scales: ['Minor', 'Pentatonic Minor'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['i', 'iv', 'VII', 'VI'],
            ['i', 'VI', 'VII', 'i']
        ],
        drumPattern: 'footwork',
        melodyStyle: 'chopped',
        bassStyle: 'sub'
    },

    'Grime': {
        category: 'Urban',
        tempo: [135, 145],
        scales: ['Minor', 'Phrygian'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'v'],
            ['i', 'VI', 'VII', 'i'],
            ['i', 'iv', 'VII', 'VI']
        ],
        drumPattern: 'grime',
        melodyStyle: 'dark',
        bassStyle: 'sub'
    },

    'Jersey Club': {
        category: 'Urban',
        tempo: [130, 145],
        scales: ['Minor', 'Major'],
        chordProgressions: [
            ['i', 'VII', 'VI', 'VII'],
            ['I', 'V', 'vi', 'IV'],
            ['i', 'iv', 'VII', 'VI']
        ],
        drumPattern: 'jersey_club',
        melodyStyle: 'bouncy',
        bassStyle: 'sub'
    }
};

// Helper function to get all genre names
export function getAllGenres() {
    return Object.keys(GENRES);
}

// Helper function to get genres by category
export function getGenresByCategory(category) {
    return Object.keys(GENRES).filter(genre => GENRES[genre].category === category);
}

// Helper function to get random chord progression for genre
export function getRandomChordProgression(genre) {
    const genreData = GENRES[genre];
    if (!genreData) return ['I', 'V', 'vi', 'IV'];
    
    const progressions = genreData.chordProgressions;
    return progressions[Math.floor(Math.random() * progressions.length)];
}

export default GENRES;
