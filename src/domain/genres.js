// Domain: Genre definitions with hierarchical categories

// Hierarchical genre categories for UI browsing
export const GENRE_CATEGORIES = {
    'Electronic': {
        subcategories: {
            'House': ['House', 'Deep House', 'Tech House', 'Progressive House', 'Afro House'],
            'Techno': ['Techno', 'Minimal Techno', 'Detroit Techno', 'Industrial Techno'],
            'Trance': ['Trance', 'Psytrance', 'Uplifting Trance', 'Progressive Trance'],
            'Bass Music': ['Dubstep', 'Drum & Bass', 'Neurofunk', 'Future Bass'],
            'Retro & Chill': ['Synthwave', 'Vaporwave', 'Ambient'],
            'Experimental': ['IDM']
        }
    },
    'Hip-Hop & Trap': {
        subcategories: {
            'Classic': ['Hip Hop', 'Boom Bap'],
            'Modern': ['Trap', 'Drill', 'Cloud Rap', 'Phonk'],
            'Chill': ['Lo-Fi']
        }
    },
    'Pop & R&B': {
        subcategories: {
            'Pop': ['Contemporary Pop', 'K-Pop', 'Indie Pop'],
            'R&B & Soul': ['R&B', 'Neo-Soul']
        }
    },
    'Rock & Metal': {
        subcategories: {
            'Rock': ['Alternative Rock', 'Progressive Rock'],
            'Metal': ['Metalcore']
        }
    },
    'Jazz & Funk': {
        subcategories: {
            'Jazz': ['Jazz', 'Bebop', 'Fusion', 'Neo-Jazz'],
            'Groove': ['Funk']
        }
    },
    'World & Latin': {
        subcategories: {
            'Caribbean': ['Reggae', 'Dancehall'],
            'African': ['Afrobeat', 'Amapiano'],
            'Latin': ['Latin', 'Reggaeton']
        }
    },
    'Cinematic & Game': {
        subcategories: {
            'Film': ['Trailer Music', 'Horror Score'],
            'Game': ['Fantasy RPG']
        }
    }
};

const BASE_SUBGENRES = ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic'];
const EXTENDED_SUBGENRES = [...BASE_SUBGENRES, 'Aggressive', 'Dreamy', 'Nostalgic', 'Uplifting', 'Tense', 'Euphoric', 'Melancholic', 'Mysterious'];

// Full genre definitions — all 32 originals preserved, plus ~20 new
export const GENRE_DEFINITIONS = {
    // ============================
    // ORIGINAL 32 GENRES (verbatim fields)
    // ============================

    // HIP HOP / RAP
    'Hip Hop': {
        category: 'Urban',
        baseTempo: [85, 95],
        baseScales: ['Minor', 'Blues', 'Pentatonic Minor'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'boom_bap',
        melodyStyle: 'syncopated',
        bassStyle: 'root-heavy',
        grooveStyle: 'laid-back',
        chordComplexity: 'simple',
        typicalProgressionType: 'hiphop'
    },
    'Trap': {
        category: 'Urban',
        baseTempo: [135, 145],
        baseScales: ['Minor', 'Harmonic Minor', 'Phrygian'],
        subGenres: EXTENDED_SUBGENRES,
        drumPattern: 'trap',
        melodyStyle: 'sparse',
        bassStyle: '808',
        grooveStyle: 'heavy',
        chordComplexity: 'simple',
        typicalProgressionType: 'trap'
    },
    'Drill': {
        category: 'Urban',
        baseTempo: [140, 150],
        baseScales: ['Minor', 'Phrygian', 'Locrian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Aggressive', 'Tense'],
        drumPattern: 'drill',
        melodyStyle: 'dark',
        bassStyle: '808_slide',
        grooveStyle: 'aggressive',
        chordComplexity: 'simple',
        typicalProgressionType: 'drill'
    },
    'Boom Bap': {
        category: 'Urban',
        baseTempo: [85, 95],
        baseScales: ['Minor', 'Blues', 'Dorian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'boom_bap',
        melodyStyle: 'jazzy',
        bassStyle: 'walking',
        grooveStyle: 'swinging',
        chordComplexity: 'simple',
        typicalProgressionType: 'boom_bap'
    },
    'Lo-Fi': {
        category: 'Urban',
        baseTempo: [70, 90],
        baseScales: ['Major', 'Dorian', 'Mixolydian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Dreamy', 'Nostalgic', 'Melancholic'],
        drumPattern: 'lofi',
        melodyStyle: 'jazzy',
        bassStyle: 'mellow',
        grooveStyle: 'relaxed',
        chordComplexity: 'complex',
        typicalProgressionType: 'lofi'
    },
    'Cloud Rap': {
        category: 'Urban',
        baseTempo: [120, 140],
        baseScales: ['Minor', 'Phrygian', 'Aeolian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Dreamy', 'Euphoric'],
        drumPattern: 'trap',
        melodyStyle: 'ethereal',
        bassStyle: 'sub-heavy',
        grooveStyle: 'floating',
        chordComplexity: 'simple',
        typicalProgressionType: 'trap'
    },

    // ELECTRONIC - HOUSE
    'House': {
        category: 'Electronic',
        baseTempo: [120, 130],
        baseScales: ['Major', 'Mixolydian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'four_on_floor',
        melodyStyle: 'uplifting',
        bassStyle: 'pumping',
        grooveStyle: 'driving',
        chordComplexity: 'simple',
        typicalProgressionType: 'house'
    },
    'Deep House': {
        category: 'Electronic',
        baseTempo: [120, 125],
        baseScales: ['Minor', 'Dorian', 'Aeolian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'four_on_floor',
        melodyStyle: 'atmospheric',
        bassStyle: 'deep',
        grooveStyle: 'smooth',
        chordComplexity: 'complex',
        typicalProgressionType: 'house'
    },
    'Tech House': {
        category: 'Electronic',
        baseTempo: [125, 130],
        baseScales: ['Minor', 'Mixolydian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'techno',
        melodyStyle: 'minimal-tech',
        bassStyle: 'rolling',
        grooveStyle: 'hypnotic',
        chordComplexity: 'simple',
        typicalProgressionType: 'techno'
    },
    'Progressive House': {
        category: 'Electronic',
        baseTempo: [125, 130],
        baseScales: ['Major', 'Lydian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Euphoric', 'Uplifting'],
        drumPattern: 'four_on_floor',
        melodyStyle: 'building',
        bassStyle: 'driving',
        grooveStyle: 'progressive',
        chordComplexity: 'complex',
        typicalProgressionType: 'house'
    },

    // ELECTRONIC - TECHNO
    'Techno': {
        category: 'Electronic',
        baseTempo: [130, 140],
        baseScales: ['Minor', 'Phrygian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'techno',
        melodyStyle: 'hypnotic',
        bassStyle: 'pounding',
        grooveStyle: 'relentless',
        chordComplexity: 'simple',
        typicalProgressionType: 'techno'
    },
    'Minimal Techno': {
        category: 'Electronic',
        baseTempo: [125, 135],
        baseScales: ['Minor', 'Locrian', 'Aeolian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'techno',
        melodyStyle: 'sparse',
        bassStyle: 'subtle',
        grooveStyle: 'minimal',
        chordComplexity: 'simple',
        typicalProgressionType: 'techno'
    },

    // ELECTRONIC - BASS MUSIC
    'Dubstep': {
        category: 'Electronic',
        baseTempo: [140, 150],
        baseScales: ['Minor', 'Phrygian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Aggressive'],
        drumPattern: 'dubstep',
        melodyStyle: 'aggressive',
        bassStyle: 'wobble',
        grooveStyle: 'halftime',
        chordComplexity: 'simple',
        typicalProgressionType: 'dubstep'
    },
    'Drum & Bass': {
        category: 'Electronic',
        baseTempo: [170, 180],
        baseScales: ['Minor', 'Harmonic Minor'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'dnb',
        melodyStyle: 'energetic',
        bassStyle: 'reese',
        grooveStyle: 'breakbeat',
        chordComplexity: 'simple',
        typicalProgressionType: 'dnb'
    },
    'Neurofunk': {
        category: 'Electronic',
        baseTempo: [175, 185],
        baseScales: ['Minor', 'Locrian', 'Phrygian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Aggressive', 'Tense'],
        drumPattern: 'dnb',
        melodyStyle: 'dark-tech',
        bassStyle: 'modulated',
        grooveStyle: 'technical',
        chordComplexity: 'complex',
        typicalProgressionType: 'dnb'
    },

    // ELECTRONIC - TRANCE
    'Trance': {
        category: 'Electronic',
        baseTempo: [135, 145],
        baseScales: ['Major', 'Minor', 'Mixolydian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'trance',
        melodyStyle: 'uplifting-lead',
        bassStyle: 'rolling-bass',
        grooveStyle: 'euphoric',
        chordComplexity: 'simple',
        typicalProgressionType: 'trance'
    },
    'Psytrance': {
        category: 'Electronic',
        baseTempo: [140, 150],
        baseScales: ['Minor', 'Phrygian', 'Locrian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Tense', 'Mysterious'],
        drumPattern: 'trance',
        melodyStyle: 'psychedelic',
        bassStyle: 'driving',
        grooveStyle: 'hypnotic',
        chordComplexity: 'complex',
        typicalProgressionType: 'trance'
    },

    // ELECTRONIC - FUTURE
    'Future Bass': {
        category: 'Electronic',
        baseTempo: [140, 170],
        baseScales: ['Major', 'Lydian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Euphoric', 'Uplifting'],
        drumPattern: 'future_bass',
        melodyStyle: 'super-saw',
        bassStyle: 'sub-808',
        grooveStyle: 'bouncy',
        chordComplexity: 'complex',
        typicalProgressionType: 'edm'
    },
    'Synthwave': {
        category: 'Electronic',
        baseTempo: [110, 130],
        baseScales: ['Minor', 'Dorian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Nostalgic'],
        drumPattern: 'retro',
        melodyStyle: 'retro-lead',
        bassStyle: 'synth-bass',
        grooveStyle: 'retro',
        chordComplexity: 'simple',
        typicalProgressionType: 'synthwave'
    },
    'Vaporwave': {
        category: 'Electronic',
        baseTempo: [80, 100],
        baseScales: ['Major', 'Lydian', 'Dorian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Dreamy', 'Nostalgic'],
        drumPattern: 'lofi',
        melodyStyle: 'chopped',
        bassStyle: 'smooth',
        grooveStyle: 'slow',
        chordComplexity: 'simple',
        typicalProgressionType: 'lofi'
    },

    // WORLD / LATIN
    'Reggae': {
        category: 'World',
        baseTempo: [80, 100],
        baseScales: ['Major', 'Mixolydian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'reggae',
        melodyStyle: 'offbeat',
        bassStyle: 'roots',
        grooveStyle: 'offbeat',
        chordComplexity: 'simple',
        typicalProgressionType: 'reggae'
    },
    'Dancehall': {
        category: 'World',
        baseTempo: [90, 110],
        baseScales: ['Minor', 'Phrygian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'reggaeton',
        melodyStyle: 'riddim',
        bassStyle: 'heavy',
        grooveStyle: 'bouncy',
        chordComplexity: 'simple',
        typicalProgressionType: 'dancehall'
    },
    'Afrobeat': {
        category: 'World',
        baseTempo: [110, 130],
        baseScales: ['Major', 'Pentatonic Major', 'Mixolydian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'afrobeat',
        melodyStyle: 'polyrhythmic',
        bassStyle: 'groovy',
        grooveStyle: 'polyrhythmic',
        chordComplexity: 'simple',
        typicalProgressionType: 'afrobeat'
    },
    'Latin': {
        category: 'World',
        baseTempo: [100, 130],
        baseScales: ['Major', 'Harmonic Minor', 'Phrygian'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'latin',
        melodyStyle: 'passionate',
        bassStyle: 'tumbao',
        grooveStyle: 'syncopated',
        chordComplexity: 'simple',
        typicalProgressionType: 'latin'
    },

    // JAZZ / FUNK / SOUL
    'Jazz': {
        category: 'Jazz',
        baseTempo: [120, 180],
        baseScales: ['Major', 'Dorian', 'Mixolydian', 'Melodic Minor'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'jazz',
        melodyStyle: 'jazzy',
        bassStyle: 'walking',
        grooveStyle: 'swinging',
        chordComplexity: 'complex',
        typicalProgressionType: 'jazz'
    },
    'Funk': {
        category: 'Groovy',
        baseTempo: [100, 120],
        baseScales: ['Mixolydian', 'Dorian', 'Minor Blues'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'funk',
        melodyStyle: 'groovy',
        bassStyle: 'slap',
        grooveStyle: 'funky',
        chordComplexity: 'simple',
        typicalProgressionType: 'funk'
    },
    'R&B': {
        category: 'Soulful',
        baseTempo: [70, 90],
        baseScales: ['Minor', 'Dorian', 'Minor Blues'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'rnb',
        melodyStyle: 'smooth',
        bassStyle: 'sub',
        grooveStyle: 'smooth',
        chordComplexity: 'complex',
        typicalProgressionType: 'soul'
    },

    // EXPERIMENTAL
    'IDM': {
        category: 'Electronic',
        baseTempo: [120, 160],
        baseScales: ['Chromatic', 'Whole Tone'],
        subGenres: BASE_SUBGENRES,
        drumPattern: 'techno',
        melodyStyle: 'experimental',
        bassStyle: 'complex',
        grooveStyle: 'glitchy',
        chordComplexity: 'complex',
        typicalProgressionType: 'edm'
    },
    'Ambient': {
        category: 'Electronic',
        baseTempo: [60, 90],
        baseScales: ['Major', 'Lydian', 'Whole Tone'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Dreamy', 'Mysterious', 'Nostalgic'],
        drumPattern: 'orchestral',
        melodyStyle: 'pad',
        bassStyle: 'drone',
        grooveStyle: 'ambient',
        chordComplexity: 'complex',
        typicalProgressionType: 'ambient'
    },
    'Phonk': {
        category: 'Urban',
        baseTempo: [120, 140],
        baseScales: ['Minor', 'Phrygian'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Energetic', 'Mystical', 'Exotic', 'Aggressive'],
        drumPattern: 'trap',
        melodyStyle: 'bell',
        bassStyle: 'cowbell',
        grooveStyle: 'heavy',
        chordComplexity: 'simple',
        typicalProgressionType: 'phonk'
    },

    // ============================
    // NEW GENRES
    // ============================

    // Pop & R&B
    'Contemporary Pop': {
        category: 'Pop',
        baseTempo: [100, 120],
        baseScales: ['Major', 'Minor', 'Mixolydian'],
        subGenres: EXTENDED_SUBGENRES,
        drumPattern: 'four_on_floor',
        melodyStyle: 'catchy',
        bassStyle: 'pumping',
        grooveStyle: 'polished',
        chordComplexity: 'simple',
        typicalProgressionType: 'pop'
    },
    'K-Pop': {
        category: 'Pop',
        baseTempo: [110, 130],
        baseScales: ['Major', 'Minor', 'Dorian'],
        subGenres: ['Happy', 'Energetic', 'Dark', 'Sad', 'Euphoric', 'Uplifting'],
        drumPattern: 'four_on_floor',
        melodyStyle: 'catchy',
        bassStyle: 'pumping',
        grooveStyle: 'tight',
        chordComplexity: 'complex',
        typicalProgressionType: 'kpop'
    },
    'Indie Pop': {
        category: 'Pop',
        baseTempo: [100, 125],
        baseScales: ['Major', 'Dorian', 'Mixolydian'],
        subGenres: ['Happy', 'Sad', 'Dreamy', 'Nostalgic', 'Melancholic', 'Uplifting'],
        drumPattern: 'four_on_floor',
        melodyStyle: 'quirky',
        bassStyle: 'mellow',
        grooveStyle: 'indie',
        chordComplexity: 'simple',
        typicalProgressionType: 'indie'
    },
    'Neo-Soul': {
        category: 'Soulful',
        baseTempo: [75, 95],
        baseScales: ['Dorian', 'Mixolydian', 'Minor', 'Melodic Minor'],
        subGenres: ['Dark', 'Happy', 'Sad', 'Dreamy', 'Nostalgic', 'Melancholic', 'Mysterious'],
        drumPattern: 'rnb',
        melodyStyle: 'smooth',
        bassStyle: 'sub',
        grooveStyle: 'neo-soul',
        chordComplexity: 'complex',
        typicalProgressionType: 'neosoul'
    },

    // Rock & Metal
    'Alternative Rock': {
        category: 'Rock',
        baseTempo: [110, 140],
        baseScales: ['Minor', 'Dorian', 'Mixolydian'],
        subGenres: ['Dark', 'Energetic', 'Sad', 'Aggressive', 'Nostalgic', 'Melancholic', 'Tense'],
        drumPattern: 'four_on_floor',
        melodyStyle: 'angular',
        bassStyle: 'driving',
        grooveStyle: 'driving',
        chordComplexity: 'simple',
        typicalProgressionType: 'rock'
    },
    'Progressive Rock': {
        category: 'Rock',
        baseTempo: [90, 140],
        baseScales: ['Major', 'Lydian', 'Mixolydian', 'Dorian'],
        subGenres: ['Dark', 'Energetic', 'Mystical', 'Dreamy', 'Euphoric', 'Tense', 'Mysterious'],
        drumPattern: 'four_on_floor',
        melodyStyle: 'progressive',
        bassStyle: 'driving',
        grooveStyle: 'progressive',
        chordComplexity: 'complex',
        typicalProgressionType: 'rock'
    },
    'Metalcore': {
        category: 'Metal',
        baseTempo: [130, 170],
        baseScales: ['Minor', 'Phrygian', 'Harmonic Minor', 'Locrian'],
        subGenres: ['Dark', 'Energetic', 'Aggressive', 'Tense'],
        drumPattern: 'techno',
        melodyStyle: 'aggressive',
        bassStyle: 'heavy',
        grooveStyle: 'breakdown',
        chordComplexity: 'simple',
        typicalProgressionType: 'metal'
    },

    // Jazz extensions
    'Bebop': {
        category: 'Jazz',
        baseTempo: [160, 280],
        baseScales: ['Major', 'Dorian', 'Mixolydian', 'Melodic Minor', 'Bebop Dominant'],
        subGenres: ['Dark', 'Happy', 'Energetic', 'Mystical'],
        drumPattern: 'jazz',
        melodyStyle: 'bebop',
        bassStyle: 'walking',
        grooveStyle: 'swinging',
        chordComplexity: 'complex',
        typicalProgressionType: 'jazz'
    },
    'Fusion': {
        category: 'Jazz',
        baseTempo: [100, 160],
        baseScales: ['Dorian', 'Lydian', 'Mixolydian', 'Melodic Minor', 'Lydian Dominant'],
        subGenres: ['Dark', 'Happy', 'Energetic', 'Exotic', 'Mystical', 'Euphoric'],
        drumPattern: 'funk',
        melodyStyle: 'fusion',
        bassStyle: 'slap',
        grooveStyle: 'funky',
        chordComplexity: 'complex',
        typicalProgressionType: 'jazz'
    },
    'Neo-Jazz': {
        category: 'Jazz',
        baseTempo: [90, 140],
        baseScales: ['Dorian', 'Lydian', 'Melodic Minor', 'Harmonic Minor'],
        subGenres: ['Dark', 'Dreamy', 'Nostalgic', 'Melancholic', 'Mysterious', 'Euphoric'],
        drumPattern: 'jazz',
        melodyStyle: 'jazzy',
        bassStyle: 'walking',
        grooveStyle: 'neo-soul',
        chordComplexity: 'complex',
        typicalProgressionType: 'jazz'
    },

    // Electronic extensions
    'Detroit Techno': {
        category: 'Electronic',
        baseTempo: [125, 135],
        baseScales: ['Minor', 'Dorian', 'Aeolian'],
        subGenres: ['Dark', 'Energetic', 'Mystical', 'Uplifting', 'Nostalgic'],
        drumPattern: 'techno',
        melodyStyle: 'hypnotic',
        bassStyle: 'pounding',
        grooveStyle: 'driving',
        chordComplexity: 'simple',
        typicalProgressionType: 'techno'
    },
    'Industrial Techno': {
        category: 'Electronic',
        baseTempo: [135, 150],
        baseScales: ['Minor', 'Phrygian', 'Locrian'],
        subGenres: ['Dark', 'Aggressive', 'Tense', 'Energetic'],
        drumPattern: 'techno',
        melodyStyle: 'industrial',
        bassStyle: 'pounding',
        grooveStyle: 'relentless',
        chordComplexity: 'simple',
        typicalProgressionType: 'techno'
    },
    'Uplifting Trance': {
        category: 'Electronic',
        baseTempo: [136, 142],
        baseScales: ['Major', 'Lydian', 'Mixolydian'],
        subGenres: ['Happy', 'Euphoric', 'Uplifting', 'Energetic'],
        drumPattern: 'trance',
        melodyStyle: 'uplifting-lead',
        bassStyle: 'rolling-bass',
        grooveStyle: 'euphoric',
        chordComplexity: 'simple',
        typicalProgressionType: 'trance'
    },
    'Progressive Trance': {
        category: 'Electronic',
        baseTempo: [128, 138],
        baseScales: ['Minor', 'Major', 'Dorian'],
        subGenres: ['Dark', 'Dreamy', 'Mystical', 'Euphoric', 'Uplifting'],
        drumPattern: 'trance',
        melodyStyle: 'building',
        bassStyle: 'rolling-bass',
        grooveStyle: 'progressive',
        chordComplexity: 'complex',
        typicalProgressionType: 'trance'
    },
    'Afro House': {
        category: 'Electronic',
        baseTempo: [118, 128],
        baseScales: ['Major', 'Dorian', 'Mixolydian'],
        subGenres: ['Happy', 'Energetic', 'Exotic', 'Uplifting', 'Euphoric'],
        drumPattern: 'afrobeat',
        melodyStyle: 'polyrhythmic',
        bassStyle: 'deep',
        grooveStyle: 'polyrhythmic',
        chordComplexity: 'simple',
        typicalProgressionType: 'afrobeat'
    },

    // World extensions
    'Reggaeton': {
        category: 'World',
        baseTempo: [90, 100],
        baseScales: ['Minor', 'Harmonic Minor', 'Phrygian'],
        subGenres: ['Dark', 'Happy', 'Energetic', 'Exotic', 'Aggressive'],
        drumPattern: 'reggaeton',
        melodyStyle: 'passionate',
        bassStyle: 'heavy',
        grooveStyle: 'dembow',
        chordComplexity: 'simple',
        typicalProgressionType: 'reggaeton'
    },
    'Amapiano': {
        category: 'World',
        baseTempo: [110, 120],
        baseScales: ['Major', 'Dorian', 'Mixolydian'],
        subGenres: ['Happy', 'Energetic', 'Exotic', 'Uplifting', 'Dreamy'],
        drumPattern: 'afrobeat',
        melodyStyle: 'log-drum',
        bassStyle: 'deep',
        grooveStyle: 'bounce',
        chordComplexity: 'simple',
        typicalProgressionType: 'house'
    },

    // Cinematic & Game
    'Trailer Music': {
        category: 'Cinematic',
        baseTempo: [90, 130],
        baseScales: ['Minor', 'Harmonic Minor', 'Phrygian', 'Lydian'],
        subGenres: ['Dark', 'Energetic', 'Euphoric', 'Tense', 'Aggressive', 'Uplifting'],
        drumPattern: 'orchestral',
        melodyStyle: 'epic',
        bassStyle: 'drone',
        grooveStyle: 'cinematic',
        chordComplexity: 'complex',
        typicalProgressionType: 'cinematic'
    },
    'Horror Score': {
        category: 'Cinematic',
        baseTempo: [60, 100],
        baseScales: ['Locrian', 'Phrygian', 'Half-whole Dim.', 'Whole-half Dim.'],
        subGenres: ['Dark', 'Tense', 'Mysterious', 'Aggressive'],
        drumPattern: 'orchestral',
        melodyStyle: 'dissonant',
        bassStyle: 'drone',
        grooveStyle: 'sparse',
        chordComplexity: 'complex',
        typicalProgressionType: 'cinematic'
    },
    'Fantasy RPG': {
        category: 'Cinematic',
        baseTempo: [80, 130],
        baseScales: ['Lydian', 'Major', 'Dorian', 'Mixolydian', 'Aeolian'],
        subGenres: ['Happy', 'Mystical', 'Dreamy', 'Dark', 'Uplifting', 'Mysterious', 'Nostalgic'],
        drumPattern: 'orchestral',
        melodyStyle: 'epic',
        bassStyle: 'drone',
        grooveStyle: 'cinematic',
        chordComplexity: 'complex',
        typicalProgressionType: 'cinematic'
    }
};

// Backward-compatible alias
export const GENRES_WITH_SUBGENRES = GENRE_DEFINITIONS;
