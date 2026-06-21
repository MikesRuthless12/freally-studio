/**
 * ArrangementEngine.js
 *
 * Generates full song structures (intro, verse, chorus, etc.) based on genre,
 * with intensity curves and random variation. Deterministic, rule-based — no AI APIs.
 *
 * API:
 *   generateArrangement(genreDNA)  → clip placement instructions array
 *   applyArrangementToTimeline(arrangement, callbacks) → void (creates clips on timeline)
 *   getAvailableTemplates()        → template keys
 *   getSectionTypes()              → section type definitions
 */

// ─── Section Type Definitions ────────────────────────────────────────────────

// `tracks` = per-section-type activity for each track: 1 = full / present,
// 0.5 = reduced (present but lighter), 0 = absent (no clip → blank lane).
// Grounded in cross-genre arrangement research: intros/outros are minimal with
// the melody held back; verses reduce drums for vocal space; pre-chorus/chorus/
// drop are full; breakdowns drop the drums (chords + melody carry); build-ups
// filter the bass out; bridges pull back drums + bass. Because each genre has its
// own section sequence, attaching activity to section types makes every genre
// arrange appropriately without per-genre code paths.
const SECTION_TYPES = {
    Intro:      { defaultBars: 4,  intensity: 0.3, color: '#4dabf7', tracks: { drums: 0.5, chords: 0.5, melody: 0,   bass: 0.5 } },
    Verse:      { defaultBars: 8,  intensity: 0.6, color: '#69db7c', tracks: { drums: 0.5, chords: 1,   melody: 1,   bass: 1   } },
    PreChorus:  { defaultBars: 4,  intensity: 0.75, color: '#ffd43b', tracks: { drums: 1,   chords: 1,   melody: 1,   bass: 1   } },
    Chorus:     { defaultBars: 8,  intensity: 1.0, color: '#ff6b6b', tracks: { drums: 1,   chords: 1,   melody: 1,   bass: 1   } },
    Bridge:     { defaultBars: 4,  intensity: 0.5, color: '#9775fa', tracks: { drums: 0.5, chords: 1,   melody: 1,   bass: 0.5 } },
    Breakdown:  { defaultBars: 4,  intensity: 0.35, color: '#20c997', tracks: { drums: 0,   chords: 1,   melody: 1,   bass: 0.5 } },
    Drop:       { defaultBars: 8,  intensity: 1.0, color: '#f06595', tracks: { drums: 1,   chords: 1,   melody: 1,   bass: 1   } },
    Buildup:    { defaultBars: 4,  intensity: 0.8, color: '#ffa94d', tracks: { drums: 0.5, chords: 1,   melody: 0.5, bass: 0   } },
    Outro:      { defaultBars: 4,  intensity: 0.25, color: '#74c0fc', tracks: { drums: 0.5, chords: 0.5, melody: 0,   bass: 0.5 } }
};

// ─── Genre → Template Mapping ────────────────────────────────────────────────

const ARRANGEMENT_TEMPLATES = {
    // Hip-Hop / Trap / Urban
    trap: [
        { section: 'Intro',   bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Bridge',  bars: 4 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Outro',   bars: 4 }
    ],
    hiphop: [
        { section: 'Intro',   bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Outro',   bars: 4 }
    ],
    boom_bap: [
        { section: 'Intro',     bars: 4 },
        { section: 'Verse',     bars: 16 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Verse',     bars: 16 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Outro',     bars: 4 }
    ],

    // Electronic — EDM / House / Techno
    edm: [
        { section: 'Intro',     bars: 8 },
        { section: 'Buildup',   bars: 4 },
        { section: 'Drop',      bars: 8 },
        { section: 'Breakdown', bars: 8 },
        { section: 'Buildup',   bars: 4 },
        { section: 'Drop',      bars: 8 },
        { section: 'Outro',     bars: 4 }
    ],
    trance: [
        { section: 'Intro',     bars: 8 },
        { section: 'Buildup',   bars: 8 },
        { section: 'Drop',      bars: 8 },
        { section: 'Breakdown', bars: 8 },
        { section: 'Buildup',   bars: 8 },
        { section: 'Drop',      bars: 8 },
        { section: 'Breakdown', bars: 4 },
        { section: 'Outro',     bars: 8 }
    ],
    dnb: [
        { section: 'Intro',     bars: 4 },
        { section: 'Buildup',   bars: 4 },
        { section: 'Drop',      bars: 8 },
        { section: 'Verse',     bars: 8 },
        { section: 'Drop',      bars: 8 },
        { section: 'Bridge',    bars: 4 },
        { section: 'Drop',      bars: 8 },
        { section: 'Outro',     bars: 4 }
    ],

    // Pop
    pop: [
        { section: 'Intro',     bars: 4 },
        { section: 'Verse',     bars: 8 },
        { section: 'PreChorus', bars: 4 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Verse',     bars: 8 },
        { section: 'PreChorus', bars: 4 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Bridge',    bars: 4 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Outro',     bars: 4 }
    ],

    // Rock / Metal
    rock: [
        { section: 'Intro',     bars: 4 },
        { section: 'Verse',     bars: 8 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Verse',     bars: 8 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Bridge',    bars: 4 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Outro',     bars: 4 }
    ],
    metal: [
        { section: 'Intro',     bars: 4 },
        { section: 'Verse',     bars: 8 },
        { section: 'PreChorus', bars: 4 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Verse',     bars: 8 },
        { section: 'Breakdown', bars: 4 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Outro',     bars: 4 }
    ],

    // Jazz / Funk / Soul
    jazz: [
        { section: 'Intro',   bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Verse',   bars: 8 },
        { section: 'Bridge',  bars: 8 },
        { section: 'Verse',   bars: 8 },
        { section: 'Outro',   bars: 4 }
    ],
    funk: [
        { section: 'Intro',   bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Bridge',  bars: 4 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Outro',   bars: 4 }
    ],
    soul: [
        { section: 'Intro',   bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Bridge',  bars: 4 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Outro',   bars: 4 }
    ],

    // Latin / World
    latin: [
        { section: 'Intro',   bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Bridge',  bars: 4 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Outro',   bars: 4 }
    ],
    reggae: [
        { section: 'Intro',   bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 4 },
        { section: 'Outro',   bars: 4 }
    ],

    // Cinematic
    cinematic: [
        { section: 'Intro',     bars: 8 },
        { section: 'Verse',     bars: 8 },
        { section: 'Buildup',   bars: 4 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Breakdown', bars: 8 },
        { section: 'Buildup',   bars: 8 },
        { section: 'Chorus',    bars: 8 },
        { section: 'Outro',     bars: 8 }
    ],

    // Ambient / Experimental
    ambient: [
        { section: 'Intro',     bars: 8 },
        { section: 'Verse',     bars: 16 },
        { section: 'Bridge',    bars: 8 },
        { section: 'Verse',     bars: 16 },
        { section: 'Outro',     bars: 8 }
    ],

    // Lo-Fi
    lofi: [
        { section: 'Intro',   bars: 4 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Verse',   bars: 8 },
        { section: 'Chorus',  bars: 8 },
        { section: 'Outro',   bars: 4 }
    ]
};

// ─── Genre → Template Key Resolution ─────────────────────────────────────────

const GENRE_TO_TEMPLATE = {
    // Urban / Hip-Hop
    'Hip Hop':          'hiphop',
    'Trap':             'trap',
    'Drill':            'trap',
    'Boom Bap':         'boom_bap',
    'Lo-Fi':            'lofi',
    'Cloud Rap':        'trap',
    'Phonk':            'trap',

    // Electronic — House
    'House':            'edm',
    'Deep House':       'edm',
    'Tech House':       'edm',
    'Progressive House':'edm',
    'Afro House':       'edm',

    // Electronic — Techno
    'Techno':           'edm',
    'Minimal Techno':   'edm',
    'Detroit Techno':   'edm',
    'Industrial Techno':'edm',

    // Electronic — Trance
    'Trance':           'trance',
    'Psytrance':        'trance',
    'Uplifting Trance': 'trance',
    'Progressive Trance':'trance',

    // Electronic — Bass
    'Dubstep':          'dnb',
    'Drum & Bass':      'dnb',
    'Neurofunk':        'dnb',
    'Future Bass':      'edm',

    // Electronic — Retro / Chill / Experimental
    'Synthwave':        'pop',
    'Vaporwave':        'lofi',
    'Ambient':          'ambient',
    'IDM':              'edm',

    // Pop & R&B
    'Contemporary Pop': 'pop',
    'K-Pop':            'pop',
    'Indie Pop':        'pop',
    'R&B':              'soul',
    'Neo-Soul':         'soul',

    // Rock & Metal
    'Alternative Rock': 'rock',
    'Progressive Rock': 'rock',
    'Metalcore':        'metal',

    // Jazz & Funk
    'Jazz':             'jazz',
    'Bebop':            'jazz',
    'Fusion':           'jazz',
    'Neo-Jazz':         'jazz',
    'Funk':             'funk',

    // World & Latin
    'Reggae':           'reggae',
    'Dancehall':        'reggae',
    'Afrobeat':         'latin',
    'Amapiano':         'edm',
    'Latin':            'latin',
    'Reggaeton':        'latin',

    // Cinematic & Game
    'Trailer Music':    'cinematic',
    'Horror Score':     'cinematic',
    'Fantasy RPG':      'cinematic'
};

// ─── Utility ─────────────────────────────────────────────────────────────────

function seededRandom(seed) {
    // Simple xorshift-based PRNG for deterministic variation when seed is provided
    let s = seed | 0;
    return function () {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        return ((s >>> 0) / 4294967296);
    };
}

function clampBars(bars) {
    // Keep bars as multiples of 4, min 4, max 16
    const clamped = Math.max(4, Math.min(16, bars));
    return Math.round(clamped / 4) * 4;
}

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Generate a full arrangement structure from genre DNA.
 * Returns clip placement instructions for all 4 tracks at absolute bar positions.
 *
 * @param {object} genreDNA
 * @param {string} genreDNA.genre       - Genre name
 * @param {string} [genreDNA.mood]      - Mood modifier name
 * @param {number} [genreDNA.variation] - Variation amount 0-1 (default 0.3)
 * @param {number} [genreDNA.seed]      - Optional seed for deterministic output
 * @param {string[]} [genreDNA.availableTracks] - Restrict output to these track types
 *        (e.g. only the tracks the user has generated). null/omitted = all four.
 * @returns {Array<{trackType: string, timelineBar: number, bars: number, sectionType: string, intensity: number, activity: number, color: string}>}
 */
export function generateArrangement(genreDNA) {
    const { genre = 'Trap', mood = null, variation = 0.3, seed = null, availableTracks = null } = genreDNA || {};

    const rand = seed != null ? seededRandom(seed) : Math.random.bind(Math);

    // Only emit clips for tracks the caller marks as available (i.e. generated).
    // null = no filter (all four) — preserves backward-compatible behavior.
    const trackAllowed = (t) => !availableTracks || availableTracks.includes(t);

    // 1. Resolve template
    const templateKey = GENRE_TO_TEMPLATE[genre] || 'pop';
    const template = ARRANGEMENT_TEMPLATES[templateKey];
    if (!template) {
        return ['drums', 'chords', 'melody', 'bass']
            .filter(trackAllowed)
            .map(trackType => ({ trackType, timelineBar: 0, bars: 8, sectionType: 'verse', intensity: 0.6, activity: 1, color: SECTION_TYPES.Verse.color }));
    }

    // 2. Build section layout with bar variation
    const sections = template.map(entry => {
        const sectionDef = SECTION_TYPES[entry.section] || SECTION_TYPES.Verse;
        let bars = entry.bars;

        if (variation > 0) {
            const maxDelta = Math.round(bars * variation);
            const delta = Math.round((rand() * 2 - 1) * maxDelta);
            bars = clampBars(bars + delta);
        }

        let intensity = sectionDef.intensity;
        if (mood) {
            intensity = applyMoodToIntensity(intensity, mood);
        }

        return {
            section: entry.section,
            bars,
            intensity: Math.round(intensity * 100) / 100,
            tracks: sectionDef.tracks,
            color: sectionDef.color
        };
    });

    // 3. Convert sections to clip placements for all 4 track types
    const clipPlacements = [];
    const trackTypes = ['drums', 'chords', 'melody', 'bass'];
    let barOffset = 0;

    for (const sec of sections) {
        for (const trackType of trackTypes) {
            const activity = sec.tracks ? (sec.tracks[trackType] ?? 1) : 1;
            // activity 0 → track is silent in this section type (leave the lane blank);
            // not-allowed → track hasn't been generated yet (leave it blank for now).
            if (activity <= 0) continue;
            if (!trackAllowed(trackType)) continue;
            clipPlacements.push({
                trackType,
                timelineBar: barOffset,
                bars: sec.bars,
                sectionType: sec.section.toLowerCase(),
                intensity: sec.intensity,
                activity,
                color: sec.color
            });
        }
        barOffset += sec.bars;
    }

    return clipPlacements;
}

/**
 * Adjust section intensity based on mood character.
 */
function applyMoodToIntensity(baseIntensity, mood) {
    const moodIntensityShift = {
        'Dark':        -0.05,
        'Happy':        0.05,
        'Sad':         -0.1,
        'Energetic':    0.1,
        'Mystical':    -0.05,
        'Exotic':       0.0,
        'Euphoric':     0.1,
        'Melancholic': -0.1,
        'Aggressive':   0.15,
        'Dreamy':      -0.1,
        'Mysterious':  -0.05,
        'Uplifting':    0.1,
        'Tense':        0.05,
        'Nostalgic':   -0.05
    };
    const shift = moodIntensityShift[mood] || 0;
    return Math.max(0.1, Math.min(1.0, baseIntensity + shift));
}

/**
 * Apply a generated arrangement to the DAW timeline via clip creation callbacks.
 * Creates clips at absolute bar positions instead of sections.
 *
 * @param {Array} clipPlacements - Output of generateArrangement()
 * @param {object} callbacks - { addDrumClip, addChordClip, addMelodyClip, addBassClip, setTimelineBars }
 * @param {object} [globalSettings] - Optional settings { key, scale, tempo, genre, mood }
 */
export function applyArrangementToTimeline(clipPlacements, callbacks, globalSettings = {}) {
    if (!clipPlacements || !clipPlacements.length || !callbacks) return;

    // Calculate total bars needed
    const maxBar = clipPlacements.reduce((max, cp) => Math.max(max, cp.timelineBar + cp.bars), 0);

    // Auto-extend timeline
    if (callbacks.setTimelineBars) {
        callbacks.setTimelineBars(prev => Math.max(prev, maxBar + 4));
    }

    // Group by track type
    const byTrack = { drums: [], chords: [], melody: [], bass: [] };
    for (const cp of clipPlacements) {
        if (byTrack[cp.trackType]) {
            byTrack[cp.trackType].push(cp);
        }
    }

    // Create clips for each track type
    if (callbacks.addDrumClip) {
        byTrack.drums.forEach(cp => callbacks.addDrumClip(cp.timelineBar, cp.bars, cp.sectionType, cp.intensity));
    }
    if (callbacks.addChordClip) {
        byTrack.chords.forEach(cp => callbacks.addChordClip(cp.timelineBar, cp.bars, cp.sectionType, cp.intensity));
    }
    if (callbacks.addMelodyClip) {
        byTrack.melody.forEach(cp => callbacks.addMelodyClip(cp.timelineBar, cp.bars, cp.sectionType, cp.intensity));
    }
    if (callbacks.addBassClip) {
        byTrack.bass.forEach(cp => callbacks.addBassClip(cp.timelineBar, cp.bars, cp.sectionType, cp.intensity));
    }
}

/**
 * Get list of all available template keys.
 * @returns {string[]}
 */
export function getAvailableTemplates() {
    return Object.keys(ARRANGEMENT_TEMPLATES);
}

/**
 * Get section type definitions (for UI rendering).
 * @returns {object}
 */
export function getSectionTypes() {
    return { ...SECTION_TYPES };
}

/**
 * Get the template key that a genre resolves to.
 * @param {string} genre
 * @returns {string}
 */
export function getTemplateForGenre(genre) {
    return GENRE_TO_TEMPLATE[genre] || 'pop';
}

/**
 * Get the raw template for a given template key.
 * @param {string} templateKey
 * @returns {Array<{section: string, bars: number}>|null}
 */
export function getTemplate(templateKey) {
    return ARRANGEMENT_TEMPLATES[templateKey] || null;
}

/**
 * Calculate total bars from clip placements.
 * @param {Array} clipPlacements
 * @returns {number}
 */
export function getTotalBars(clipPlacements) {
    if (!clipPlacements || clipPlacements.length === 0) return 0;
    // If old format (section array with .bars), sum them
    if (clipPlacements[0].bars !== undefined && !clipPlacements[0].trackType) {
        return clipPlacements.reduce((sum, s) => sum + s.bars, 0);
    }
    // New format: find max bar + bars
    return clipPlacements.reduce((max, cp) => Math.max(max, (cp.timelineBar || 0) + cp.bars), 0);
}

/**
 * Calculate estimated duration in seconds.
 * @param {Array} clipPlacements
 * @param {number} tempo - BPM
 * @returns {number}
 */
export function getEstimatedDuration(clipPlacements, tempo = 120) {
    const totalBars = getTotalBars(clipPlacements);
    const beatsPerBar = 4;
    return (totalBars * beatsPerBar) / (tempo / 60);
}
