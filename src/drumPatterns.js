/**
 * Professional Drum Generation Engine
 * Two-phase pipeline: quarter-note skeleton → mood-aware refinement
 * Covers all 19 drumPattern types across 7 genre families.
 */

import { GENRES_WITH_SUBGENRES, MOOD_MODIFIERS } from './GenreLibraryWithSubGenres';
import { euclidean } from './PatternEngine';
import { tracker } from './RecentlyUsedTracker';
import {
    KICK_SKELETONS_EXPANSION, SNARE_SKELETONS_EXPANSION,
    HAT_SKELETONS_EXPANSION, OPENHAT_SKELETONS_EXPANSION,
    PERC_MOTIFS_EXPANSION, PATTERNS_808_EXPANSION,
    NEW_FAMILY_MAP_ENTRIES, mergeDrumExpansion
} from './drumPatternsExpansion';

const DRUM_LANES = [
    { id: 'lane_2', pitch: 2, label: '+2', colorScale: 1.4 },
    { id: 'lane_1', pitch: 1, label: '+1', colorScale: 1.2 },
    { id: 'root', pitch: 0, label: '0', colorScale: 1.0 },
    { id: 'lane_neg1', pitch: -1, label: '-1', colorScale: 0.8 },
    { id: 'lane_neg2', pitch: -2, label: '-2', colorScale: 0.6 }
];

const getRandomSelection = (arr, categoryKey) => {
    if (categoryKey) return tracker.pick(categoryKey, arr);
    return arr[Math.floor(Math.random() * arr.length)];
};

const createEmptyLanes = (totalSteps) => {
    return DRUM_LANES.reduce((acc, lane) => ({
        ...acc,
        [lane.id]: {
            pitch: lane.pitch,
            pattern: Array(totalSteps).fill(false),
            velocity: Array(totalSteps).fill(100),
            duration: Array(totalSteps).fill(1)
        }
    }), {});
};

// ─── Genre Resolution ───────────────────────────────────────────────────────

const FAMILY_MAP = {
    trap: { family: 'TRAP', variant: 'trap' },
    drill: { family: 'TRAP', variant: 'drill' },
    boom_bap: { family: 'BOOM_BAP', variant: 'boom_bap' },
    lofi: { family: 'BOOM_BAP', variant: 'lofi' },
    four_on_floor: { family: 'FOUR_ON_FLOOR', variant: 'four_on_floor' },
    trance: { family: 'FOUR_ON_FLOOR', variant: 'trance' },
    retro: { family: 'FOUR_ON_FLOOR', variant: 'retro' },
    techno: { family: 'TECHNO', variant: 'techno' },
    dubstep: { family: 'BASS_MUSIC', variant: 'dubstep' },
    dnb: { family: 'BASS_MUSIC', variant: 'dnb' },
    future_bass: { family: 'BASS_MUSIC', variant: 'future_bass' },
    reggae: { family: 'WORLD', variant: 'reggae' },
    reggaeton: { family: 'WORLD', variant: 'reggaeton' },
    afrobeat: { family: 'WORLD', variant: 'afrobeat' },
    latin: { family: 'WORLD', variant: 'latin' },
    jazz: { family: 'GROOVE', variant: 'jazz' },
    funk: { family: 'GROOVE', variant: 'funk' },
    rnb: { family: 'GROOVE', variant: 'rnb' },
    orchestral: { family: 'GROOVE', variant: 'orchestral' },
    gospel: { family: 'GROOVE', variant: 'gospel' },
    ...NEW_FAMILY_MAP_ENTRIES
};

function resolveFamily(genre) {
    if (!genre) return { family: 'BOOM_BAP', variant: 'boom_bap' };
    const genreData = GENRES_WITH_SUBGENRES[genre];
    const drumPatternType = genreData ? genreData.drumPattern : 'boom_bap';
    return FAMILY_MAP[drumPatternType] || { family: 'BOOM_BAP', variant: 'boom_bap' };
}

function getRhythmDensity(mood) {
    if (!mood || mood === 'Standard') return 0.8;
    const mod = MOOD_MODIFIERS[mood];
    return mod ? mod.rhythmDensity : 0.8;
}

// ─── Density → Probability Helpers ──────────────────────────────────────────

function eighthProb(density) {
    return Math.max(0, (density - 0.4) * 1.5);
}

function sixteenthProb(density) {
    return Math.max(0, (density - 0.7) * 3.0);
}

function tripletProb(density) {
    return Math.max(0, (density - 0.6) * 2.5);
}

function rollProb(density) {
    return Math.max(0, (density - 0.6) * 2.0);
}

// ─── Genre Profiles ────────────────────────────────────────────────────────
// Controls all genre-specific behavior: swing, phrase structure, coordination rules

const GENRE_PROFILES = {
    TRAP: {
        trap: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AAAB',
            snareMainBeats: [16], _808FollowsKick: true,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '8th',
            hatAllowRolls: true, hatRollResolutions: ['16th', '32nd', 'triplet'],
            ghostSnareVelocity: [30, 50], fillIntensity: 0.6, kickMaxPerBar: 3,
        },
        drill: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AABA',
            snareMainBeats: [16, 24], _808FollowsKick: true,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: 'tresillo',
            hatAllowRolls: true, hatRollResolutions: ['16th', '32nd'],
            ghostSnareVelocity: [30, 50], fillIntensity: 0.5,
        },
    },
    BOOM_BAP: {
        boom_bap: {
            swing: 0.58, swingStyle: 'mpc', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '8th',
            hatAllowRolls: false, ghostSnareVelocity: [30, 40], fillIntensity: 0.3,
        },
        lofi: {
            swing: 0.62, swingStyle: 'lazy', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '8th',
            hatAllowRolls: false, ghostSnareVelocity: [25, 40], fillIntensity: 0.2,
        },
    },
    FOUR_ON_FLOOR: {
        four_on_floor: {
            swing: 0.55, swingStyle: 'standard', phraseStructure: 'AAAB',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: 'offbeat',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.4,
        },
        trance: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AAAB',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: 'offbeat',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.3,
        },
        retro: {
            swing: 0.53, swingStyle: 'standard', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: '8th',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.3,
        },
    },
    TECHNO: {
        techno: {
            swing: 0.52, swingStyle: 'standard', phraseStructure: 'AAAB',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: '16th',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.3,
        },
    },
    BASS_MUSIC: {
        dubstep: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AAAB',
            snareMainBeats: [16], _808FollowsKick: true,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '8th',
            hatAllowRolls: true, hatRollResolutions: ['16th', '32nd'],
            ghostSnareVelocity: [35, 55], fillIntensity: 0.6,
        },
        dnb: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '16th',
            hatAllowRolls: false, ghostSnareVelocity: [35, 55], fillIntensity: 0.5,
        },
        future_bass: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AAAB',
            snareMainBeats: [16], _808FollowsKick: true,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '8th',
            hatAllowRolls: true, hatRollResolutions: ['16th'],
            ghostSnareVelocity: [35, 55], fillIntensity: 0.4,
        },
    },
    WORLD: {
        reggae: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AABA',
            snareMainBeats: [16], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: '8th',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.2,
        },
        reggaeton: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AABB',
            snareMainBeats: [12, 28], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: '8th',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.3,
        },
        afrobeat: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: '16th',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.4,
        },
        latin: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: '8th',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.3,
        },
    },
    GROOVE: {
        jazz: {
            swing: 0.67, swingStyle: 'triplet', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: 'triplet',
            hatAllowRolls: false, ghostSnareVelocity: [30, 45], fillIntensity: 0.4,
            primaryCymbal: 'ride',
        },
        funk: {
            swing: 0.55, swingStyle: 'mpc', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '16th',
            hatAllowRolls: false, ghostSnareVelocity: [30, 50], fillIntensity: 0.5,
        },
        rnb: {
            swing: 0.63, swingStyle: 'lazy', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '8th',
            hatAllowRolls: false, ghostSnareVelocity: [25, 40], fillIntensity: 0.2,
        },
        orchestral: {
            swing: 0, swingStyle: 'standard', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: false, hatBaseResolution: '8th',
            hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.3,
        },
        gospel: {
            swing: 0.60, swingStyle: 'triplet', phraseStructure: 'AABA',
            snareMainBeats: [8, 24], _808FollowsKick: false,
            hatVelocityDipOnKickSnare: true, hatBaseResolution: '16th',
            hatAllowRolls: false, ghostSnareVelocity: [25, 40], fillIntensity: 0.4,
        },
    },
    // Expansion families — defaults for families from drumPatternsExpansion
    BREAKBEAT: { breakbeat: { swing: 0, swingStyle: 'standard', phraseStructure: 'AABA', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '16th', hatAllowRolls: false, ghostSnareVelocity: [35, 55], fillIntensity: 0.5 },
                 big_beat: { swing: 0, swingStyle: 'standard', phraseStructure: 'AAAB', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.5 },
                 jungle: { swing: 0, swingStyle: 'standard', phraseStructure: 'AABA', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '16th', hatAllowRolls: true, hatRollResolutions: ['32nd'], ghostSnareVelocity: [35, 55], fillIntensity: 0.6 } },
    ELECTRO: { electro: { swing: 0, swingStyle: 'standard', phraseStructure: 'AAAB', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '16th', hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.4 },
               electro_funk: { swing: 0.55, swingStyle: 'mpc', phraseStructure: 'AABA', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '16th', hatAllowRolls: false, ghostSnareVelocity: [35, 55], fillIntensity: 0.4 } },
    METAL: { metal: { swing: 0, swingStyle: 'standard', phraseStructure: 'AABB', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [50, 70], fillIntensity: 0.7, doubleKick: true },
             thrash: { swing: 0, swingStyle: 'standard', phraseStructure: 'AAAB', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [50, 70], fillIntensity: 0.8, doubleKick: true },
             blast_beat: { swing: 0, swingStyle: 'standard', phraseStructure: 'AAAB', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [60, 80], fillIntensity: 0.9, doubleKick: true } },
    INDIE: { indie_rock: { swing: 0, swingStyle: 'standard', phraseStructure: 'AABA', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.4 },
             indie_pop: { swing: 0.52, swingStyle: 'standard', phraseStructure: 'AABA', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.3 },
             post_punk: { swing: 0, swingStyle: 'standard', phraseStructure: 'AABB', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [40, 60], fillIntensity: 0.4 } },
    COUNTRY: { country: { swing: 0.52, swingStyle: 'standard', phraseStructure: 'AABA', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [25, 40], fillIntensity: 0.3, trainBeat: true },
               bluegrass: { swing: 0.55, swingStyle: 'mpc', phraseStructure: 'AABA', snareMainBeats: [8, 24], _808FollowsKick: false, hatBaseResolution: '8th', hatAllowRolls: false, ghostSnareVelocity: [30, 45], fillIntensity: 0.3 } },
};

function getGenreProfile(family, variant) {
    return (GENRE_PROFILES[family] && GENRE_PROFILES[family][variant])
        || (GENRE_PROFILES[family] && GENRE_PROFILES[family][Object.keys(GENRE_PROFILES[family])[0]])
        || GENRE_PROFILES.BOOM_BAP.boom_bap;
}

// ─── Beat Context Cache ────────────────────────────────────────────────────
// Persists across per-drum calls within a single generation batch so drums
// can coordinate (kick↔snare↔808↔hat).

let _beatContext = null;
let _beatContextTs = 0;

export function resetBeatContext() {
    _beatContext = null;
    _beatContextTs = 0;
}

function getBeatContext(family, variant, density, complexity) {
    // Context is valid for 50ms window (covers all drums in one batch)
    const now = Date.now();
    if (_beatContext && (now - _beatContextTs) < 50) {
        return _beatContext;
    }
    _beatContext = generateBeatContext(family, variant, density, complexity);
    _beatContextTs = now;
    return _beatContext;
}

function generateBeatContext(family, variant, density, complexity) {
    const profile = getGenreProfile(family, variant);
    const totalSteps = 128; // always 4 bars
    const stepsPerBar = 32;
    const phrase = profile.phraseStructure || 'AABA';

    // Select ONE kick skeleton for "A" bars, one for "B" bars
    const kickSkels = (KICK_SKELETONS[family] && KICK_SKELETONS[family][variant])
        || KICK_SKELETONS.BOOM_BAP.boom_bap;
    const snareSkels = (SNARE_SKELETONS[family] && SNARE_SKELETONS[family][variant])
        || SNARE_SKELETONS.BOOM_BAP.boom_bap;

    const mainKickSkel = getRandomSelection(kickSkels, `ctx_kick_A_${family}_${variant}`);
    const varKickSkel = getRandomSelection(kickSkels, `ctx_kick_B_${family}_${variant}`);
    const mainSnareSkel = getRandomSelection(snareSkels, `ctx_snare_A_${family}_${variant}`);
    const varSnareSkel = getRandomSelection(snareSkels, `ctx_snare_B_${family}_${variant}`);

    // Build 4-bar patterns following phrase structure
    const kickPattern = new Array(totalSteps).fill(false);
    const snarePattern = new Array(totalSteps).fill(false);

    const barMap = {
        'AAAB': [0, 0, 0, 1], 'AABA': [0, 0, 1, 0], 'AABB': [0, 0, 1, 1],
    };
    const indices = barMap[phrase] || barMap['AABA'];
    const kickVariants = [mainKickSkel, varKickSkel];
    const snareVariants = [mainSnareSkel, varSnareSkel];

    for (let bar = 0; bar < 4; bar++) {
        const offset = bar * stepsPerBar;
        const idx = indices[bar];
        kickVariants[idx].forEach(pos => {
            if (offset + pos < totalSteps) kickPattern[offset + pos] = true;
        });
        snareVariants[idx].forEach(pos => {
            if (offset + pos < totalSteps) snarePattern[offset + pos] = true;
        });
    }

    // Determine fill bar based on phrase
    const fillBar = phrase === 'AAAB' ? 3 : (phrase === 'AABA' ? 2 : 3);

    return {
        kickPattern, snarePattern, phraseStructure: phrase, fillBar,
        swingAmount: profile.swing || 0, swingStyle: profile.swingStyle || 'standard',
        profile, family, variant, density,
    };
}

// ─── Skeleton Segment Tables ────────────────────────────────────────────────
// Quarter-note positions per bar: 0, 8, 16, 24

const KICK_SKELETONS = {
    // Trap (Metro Boomin, Wheezy, Southside): syncopated 808, always hit 1, half-time feel
    TRAP: {
        trap: [
            [0, 12, 24, 26], [0, 6, 20, 26], [0, 6, 24], [0, 4, 6, 24], [0, 10, 24],
            [0, 6, 14, 24], [0, 12, 20, 26], [0, 4, 24, 28], [0, 8, 20, 26], [0, 14, 24],
            [0, 6, 10, 24], [0, 12, 26], [0, 4, 20, 24], [0, 6, 24, 28], [0, 10, 20, 26],
            [0, 6, 12, 24], [0, 14, 20, 26], [0, 4, 10, 24], [0, 6, 26], [0, 12, 24]
        ],
        // Drill (808Melo, AXL, Ghosty): bouncy off-beat kicks
        drill: [
            [0, 8, 22, 28], [0, 22, 28], [0, 8, 22], [0, 6, 22, 28], [0, 14, 22],
            [0, 8, 14, 28], [0, 6, 16, 28], [0, 22, 26, 28], [0, 10, 22, 28], [0, 6, 22, 26],
            [0, 4, 22, 28], [0, 14, 22, 28], [0, 8, 20, 28], [0, 6, 14, 22], [0, 22, 24, 28],
            [0, 10, 22], [0, 8, 26, 28], [0, 6, 20, 28]
        ]
    },
    // Boom Bap (J Dilla, 9th Wonder, Premier): kick on 1+3, head-nod groove
    BOOM_BAP: {
        boom_bap: [
            [0, 8, 16, 24], [0, 16, 20], [0, 16, 24], [0, 8, 24], [0, 12, 16, 24],
            [0, 8, 20, 24], [0, 4, 16, 24], [0, 16, 28], [0, 8, 16, 20], [0, 16],
            [0, 12, 24], [0, 8, 16, 28], [0, 4, 16], [0, 16, 20, 24], [0, 8, 12, 24],
            [0, 20, 24], [0, 4, 16, 20], [0, 12, 16]
        ],
        // Lo-fi (Nujabes): swung, behind-the-beat, lazy feel
        lofi: [
            [0, 8, 18, 24], [0, 8, 24], [0, 18, 24], [0, 16, 24], [0, 10, 18, 24],
            [0, 8, 20], [0, 6, 18, 24], [0, 18, 28], [0, 10, 24], [0, 18],
            [0, 6, 24], [0, 8, 18], [0, 10, 18, 28], [0, 6, 18], [0, 18, 26],
            [0, 8, 20, 28]
        ]
    },
    // Four-on-floor (Disclosure, Fisher): ALWAYS [0,8,16,24] core
    FOUR_ON_FLOOR: {
        four_on_floor: [
            [0, 8, 16, 24], [0, 8, 16, 24, 28], [0, 8, 16, 24, 30], [0, 8, 16, 24, 4],
            [0, 8, 16, 24, 20], [0, 8, 16, 24, 12], [0, 8, 16, 24, 6], [0, 8, 16, 24, 22],
            [0, 8, 16, 24, 28, 30], [0, 8, 16, 24, 4, 28], [0, 8, 16, 24, 14],
            [0, 8, 16, 24, 20, 28], [0, 8, 16, 24, 6, 22], [0, 8, 16, 24, 10],
            [0, 8, 16, 24, 26]
        ],
        trance: [
            [0, 8, 16, 24], [0, 8, 16, 24, 30], [0, 8, 16, 24, 28],
            [0, 8, 16, 24, 14], [0, 8, 16, 24, 6], [0, 8, 16, 24, 22],
            [0, 8, 16, 24, 4, 30], [0, 8, 16, 24, 20], [0, 8, 16, 24, 10],
            [0, 8, 16, 24, 28, 30], [0, 8, 16, 24, 26]
        ],
        retro: [
            [0, 8, 16, 24], [0, 8, 16, 24, 28], [0, 8, 16, 24, 30], [0, 8, 16, 24, 4],
            [0, 8, 16, 24, 20], [0, 8, 16, 24, 12, 28], [0, 8, 16, 24, 6],
            [0, 8, 16, 24, 22], [0, 8, 16, 24, 28, 30], [0, 8, 16, 24, 14],
            [0, 8, 16, 24, 20, 28]
        ]
    },
    // Techno (Charlotte de Witte, Amelie Lens): industrial 4otf
    TECHNO: {
        techno: [
            [0, 8, 16, 24], [0, 8, 16, 24, 28], [0, 8, 16, 24, 30], [0, 8, 16, 24, 4],
            [0, 8, 16, 24, 20], [0, 8, 16, 24, 12], [0, 8, 16, 24, 6, 22],
            [0, 8, 16, 24, 28, 30], [0, 8, 16, 24, 4, 28], [0, 8, 16, 24, 14],
            [0, 8, 16, 24, 10, 26], [0, 8, 16, 24, 2], [0, 8, 16, 24, 20, 28],
            [0, 8, 16, 24, 6], [0, 8, 16, 24, 22]
        ]
    },
    // Bass Music: half-time & breakbeat
    BASS_MUSIC: {
        // Dubstep (Skrillex): [0] or [0,16] half-time, very sparse
        dubstep: [
            [0], [0, 16], [0, 12], [0, 8], [0, 20], [0, 4, 16],
            [0, 14], [0, 6], [0, 16, 28], [0, 12, 24], [0, 4],
            [0, 10], [0, 16, 20], [0, 6, 16], [0, 24]
        ],
        // DnB (Noisia, Andy C): breakbeat, kick on 1 and before beat 4
        dnb: [
            [0, 22], [0, 6, 22, 24], [0, 22, 24], [0, 14, 22], [0, 6, 22],
            [0, 10, 22, 28], [0, 22, 28], [0, 4, 22], [0, 22, 26], [0, 8, 22],
            [0, 6, 14, 22], [0, 22, 24, 28], [0, 10, 22], [0, 4, 22, 28],
            [0, 6, 22, 28], [0, 14, 22, 28], [0, 22, 30]
        ],
        // Future Bass: sparse, half-time vibes
        future_bass: [
            [0], [0, 16], [0, 24], [0, 8, 16], [0, 12, 24], [0, 16, 28],
            [0, 6], [0, 14, 24], [0, 4, 16], [0, 20], [0, 8, 24],
            [0, 16, 20], [0, 12], [0, 6, 24], [0, 10, 16]
        ]
    },
    // World genres
    WORLD: {
        // Reggae: one-drop = beat 3 only [16], sometimes bass drum on 1
        reggae: [
            [16], [16, 28], [16, 24], [0, 16], [16, 20], [12, 16],
            [16, 26], [0, 16, 28], [16, 22], [0, 16, 24], [16, 20, 28],
            [4, 16], [16, 30], [0, 16, 20], [12, 16, 28]
        ],
        // Reggaeton: dembow [0,12,16,28] or tresillo [0,6,16,22]
        reggaeton: [
            [0, 12, 16, 28], [0, 16, 28], [0, 6, 16, 22], [0, 12, 22, 28],
            [0, 6, 12, 28], [0, 16, 22, 28], [0, 12, 28], [0, 6, 16, 28],
            [0, 12, 16, 22], [0, 6, 22, 28], [0, 12, 22], [0, 16, 22],
            [0, 6, 12, 16, 28], [0, 6, 28], [0, 12, 16, 22, 28]
        ],
        // Afrobeat (Burna Boy, Wizkid): sparse, [0,16] or [0,8,16]
        afrobeat: [
            [0, 16], [0, 8, 16], [0, 16, 24], [0, 12, 16, 24], [0, 6, 16],
            [0, 16, 20], [0, 8, 16, 28], [0, 16, 28], [0, 4, 16], [0, 8, 16, 24],
            [0, 16, 22], [0, 12, 16], [0, 6, 16, 24], [0, 16, 20, 28],
            [0, 10, 16], [0, 16, 26]
        ],
        // Latin: clave-influenced kick patterns
        latin: [
            [0, 16], [0, 8, 16, 24], [0, 16, 24], [0, 12, 16], [0, 6, 16, 24],
            [0, 16, 20, 28], [0, 8, 16, 28], [0, 6, 16], [0, 12, 16, 24],
            [0, 16, 28], [0, 8, 24], [0, 4, 16, 24], [0, 12, 24],
            [0, 6, 16, 22], [0, 16, 20], [0, 8, 16, 20]
        ]
    },
    // Groove genres
    GROOVE: {
        // Jazz: very sparse, feathered bass drum
        jazz: [
            [0, 4], [0], [0, 16], [0, 12], [0, 20], [0, 4, 16], [0, 8],
            [0, 16, 24], [0, 4, 20], [0, 12, 24], [0, 8, 20], [0, 24],
            [0, 4, 12], [0, 16, 20], [0, 8, 16]
        ],
        // Funk (James Brown, Parliament): syncopated 16th note patterns
        funk: [
            [0, 6, 12, 20, 26], [0, 6, 12, 20], [0, 6, 20, 26], [0, 4, 12, 20],
            [0, 6, 14, 20, 28], [0, 8, 20, 26], [0, 6, 16, 26], [0, 12, 20, 28],
            [0, 4, 14, 20], [0, 6, 10, 20, 26], [0, 8, 14, 20], [0, 6, 20, 24],
            [0, 4, 12, 26], [0, 6, 12, 20, 28], [0, 10, 20, 26], [0, 4, 6, 20, 28],
            [0, 6, 14, 24], [0, 8, 12, 20, 26]
        ],
        // R&B (The Weeknd, SZA): sparse, moody
        rnb: [
            [0, 16], [0, 24], [0, 16, 24], [0, 8, 24], [0, 12, 16], [0, 20, 28],
            [0, 8, 16, 24], [0, 6, 16], [0, 14, 24], [0, 16, 28], [0, 4, 24],
            [0, 12, 24], [0, 8, 20], [0, 10, 16], [0, 6, 24]
        ],
        // Orchestral: sparse cinematic hits
        orchestral: [
            [0], [0, 16], [0, 8], [0, 24], [0, 8, 16], [0, 16, 24],
            [0, 8, 24], [0, 4], [0, 12], [0, 20], [0, 8, 16, 24],
            [0, 4, 16], [0, 12, 24]
        ],
        // Gospel: kick on 1 and 3, sometimes sparse comping
        gospel: [
            [0, 16], [0, 16, 24], [0, 8, 16], [0, 16, 20], [0, 12, 16],
            [0, 4, 16], [0, 16, 28], [0, 8, 16, 24], [0, 16, 22],
            [0, 6, 16], [0, 16, 20, 28], [0, 12, 16, 24]
        ]
    }
};

const KICK_REFINEMENTS = {
    TRAP: {
        trap: [2, 4, 8, 10, 16, 18, 22, 28, 30],
        drill: [2, 4, 6, 10, 14, 16, 18, 24, 26, 30]
    },
    BOOM_BAP: {
        boom_bap: [4, 6, 10, 12, 14, 20, 22, 28],
        lofi: [4, 6, 10, 12, 14, 20, 22, 28]
    },
    FOUR_ON_FLOOR: {
        four_on_floor: [4, 12, 20, 28, 30],
        trance: [28, 30],
        retro: [4, 12, 20, 28, 30]
    },
    TECHNO: {
        techno: [2, 4, 6, 12, 14, 20, 22, 28, 30]
    },
    BASS_MUSIC: {
        dubstep: [4, 8, 12, 20, 28],
        dnb: [2, 4, 8, 10, 14, 16, 20, 24, 28, 30],
        future_bass: [4, 8, 12, 20, 28]
    },
    WORLD: {
        reggae: [4, 8, 12, 20, 24],
        reggaeton: [2, 4, 8, 10, 18, 20, 24, 26],
        afrobeat: [4, 8, 12, 14, 20, 24, 28],
        latin: [2, 4, 10, 12, 14, 20, 22, 28]
    },
    GROOVE: {
        jazz: [4, 8, 12, 16, 20, 24, 28],
        funk: [2, 4, 8, 10, 16, 18, 22, 24, 28, 30],
        rnb: [4, 6, 10, 12, 14, 20, 22, 28],
        orchestral: [4, 8, 12, 20, 24, 28],
        gospel: [4, 6, 10, 12, 14, 20, 22, 28]
    }
};

const SNARE_SKELETONS = {
    // Trap: ALWAYS step 16 (beat 3, half-time). Optional fills at 28, 30
    TRAP: {
        trap: [
            [16], [16, 28], [16, 30], [16, 24], [8, 16],
            [16, 26], [16, 28, 30], [16, 20], [16, 12], [16, 4],
            [16, 22], [16, 14]
        ],
        // Drill: [8,24] backbeat OR [16] half-time
        drill: [
            [8, 24], [16], [8, 16, 24], [16, 24], [8, 24, 28],
            [8, 24, 30], [16, 28], [8, 20, 24], [16, 30], [8, 24, 26],
            [16, 24, 28], [8, 16]
        ]
    },
    // Boom Bap: always 2&4 backbeat [8,24]
    BOOM_BAP: {
        boom_bap: [
            [8, 24], [8, 20, 24], [8, 16, 24], [4, 8, 24], [8, 24, 28],
            [8, 12, 24], [8, 24, 30], [8, 22, 24], [8, 24, 26], [8, 20, 24, 28]
        ],
        lofi: [
            [8, 24], [8, 20, 24], [8, 16, 24], [4, 8, 24], [8, 24, 28],
            [8, 22, 24], [8, 26, 24], [10, 24], [8, 24, 30], [8, 18, 24]
        ]
    },
    // House/Disco: standard backbeat with variations
    FOUR_ON_FLOOR: {
        four_on_floor: [
            [8, 24], [8, 24, 28], [8, 16, 24], [8, 24, 30], [4, 8, 24],
            [8, 20, 24], [8, 24, 22], [8, 12, 24], [8, 24, 26]
        ],
        trance: [
            [8, 24], [8, 24, 28], [8, 16, 24], [8, 24, 30], [4, 8, 24],
            [8, 20, 24], [8, 24, 14], [8, 24, 22]
        ],
        retro: [
            [8, 24], [8, 24, 28], [8, 16, 24], [8, 24, 30], [4, 8, 24],
            [8, 20, 24], [8, 12, 24], [8, 24, 26]
        ]
    },
    // Techno: backbeat with industrial fills
    TECHNO: {
        techno: [
            [8, 24], [8, 24, 28], [8, 16, 24], [4, 8, 24], [8, 24, 30],
            [8, 20, 24], [8, 24, 26], [8, 12, 24], [8, 24, 22],
            [8, 24, 14], [8, 24, 4, 20]
        ]
    },
    // Bass Music
    BASS_MUSIC: {
        // Dubstep: ALWAYS [16] half-time
        dubstep: [
            [16], [16, 28], [16, 24], [16, 30], [16, 12],
            [16, 20], [16, 28, 30], [16, 4], [16, 22], [16, 26]
        ],
        // DnB: fast 2&4 at 170+ bpm
        dnb: [
            [8, 24], [8, 16, 24], [8, 16, 24, 28], [4, 8, 24], [8, 24, 28],
            [8, 20, 24], [8, 24, 30], [8, 12, 24], [8, 16, 24, 30],
            [8, 24, 22], [4, 8, 16, 24]
        ],
        // Future Bass: half-time like dubstep
        future_bass: [
            [16], [16, 28], [16, 24], [8, 16], [16, 30],
            [16, 20], [16, 12], [16, 4], [16, 22], [16, 28, 30]
        ]
    },
    // World genres
    WORLD: {
        // Reggae one-drop: snare on beat 3
        reggae: [
            [16], [16, 24], [8, 16], [16, 28], [16, 20],
            [16, 4], [16, 12], [0, 16], [16, 22], [16, 26]
        ],
        // Reggaeton: dembow snare [12,28]
        reggaeton: [
            [12, 28], [12, 24, 28], [4, 12, 28], [12, 28, 30], [12, 20, 28],
            [12, 28, 22], [8, 12, 28], [12, 16, 28], [12, 28, 26], [12, 28, 6]
        ],
        // Afrobeat: backbeat with cross-rhythm variations
        afrobeat: [
            [8, 24], [8, 20, 24], [8, 16, 24], [4, 8, 24], [8, 24, 28],
            [8, 12, 24], [8, 24, 30], [8, 22, 24], [8, 24, 14], [8, 20, 24, 28]
        ],
        // Latin: backbeat with syncopation
        latin: [
            [8, 24], [8, 20, 24], [4, 8, 24], [8, 16, 24], [8, 24, 28],
            [8, 12, 24], [8, 24, 30], [8, 22, 24], [8, 24, 14], [8, 24, 26]
        ]
    },
    // Groove genres
    GROOVE: {
        // Jazz: irregular comping, sparse
        jazz: [
            [8, 24], [8], [24], [4, 8, 24], [8, 16, 24], [24],
            [8, 20], [4, 24], [8, 12], [20, 24], [8, 28], [4, 8]
        ],
        // Funk: tight backbeat with ghost note setups
        funk: [
            [8, 24], [8, 24, 28], [4, 8, 24], [8, 24, 30], [8, 20, 24],
            [8, 12, 24], [8, 24, 22], [8, 24, 6], [4, 8, 24, 28],
            [8, 16, 24], [8, 24, 14]
        ],
        // R&B: moody backbeat
        rnb: [
            [8, 24], [8, 20, 24], [8, 16, 24], [4, 8, 24], [8, 24, 28],
            [8, 24, 30], [8, 22, 24], [8, 12, 24], [8, 24, 14], [8, 24, 26]
        ],
        // Orchestral: dramatic hits
        orchestral: [
            [8, 24], [16], [8, 16, 24], [16, 24], [8, 16],
            [24], [8], [16, 28], [0, 16], [8, 24, 16]
        ],
        // Gospel: accented backbeat on 2&4 with ghost setup
        gospel: [
            [8, 24], [8, 20, 24], [8, 16, 24], [4, 8, 24], [8, 24, 28],
            [8, 12, 24], [8, 24, 30], [8, 22, 24], [8, 24, 26], [8, 20, 24, 28]
        ]
    }
};

const SNARE_GHOST_POSITIONS = {
    // Trap: rolls at end of bar (26,28,30), bounces on & of 1/2 (4,12)
    TRAP: {
        trap: [4, 6, 12, 14, 18, 20, 26, 28, 30],
        drill: [6, 14, 22, 26, 28, 30]
    },
    // Boom Bap: swung ghost notes for head-nod feel
    BOOM_BAP: {
        boom_bap: [2, 4, 12, 14, 18, 20, 28, 30],
        lofi: [4, 12, 18, 20, 28]
    },
    FOUR_ON_FLOOR: {
        four_on_floor: [4, 12, 20, 28],
        trance: [4, 12, 20, 28],
        retro: [4, 12, 20, 28]
    },
    TECHNO: {
        techno: [2, 4, 6, 12, 14, 18, 20, 22, 28, 30]
    },
    // Dubstep: stutter/flam around beat 3 (14,18); DnB: ghost on 16ths between hits
    BASS_MUSIC: {
        dubstep: [4, 14, 18, 20, 28],
        dnb: [2, 4, 10, 12, 14, 18, 20, 26, 28, 30],
        future_bass: [4, 14, 18, 20, 28]
    },
    // Reggaeton: tresillo off-beats; Afrobeat: clave-based
    WORLD: {
        reggae: [4, 12, 20, 28],
        reggaeton: [6, 12, 22, 28],
        afrobeat: [0, 4, 12, 14, 18, 20, 28, 30],
        latin: [4, 6, 12, 14, 20, 22, 28, 30]
    },
    // Jazz: dense ghost comping; Funk: 16th ghost notes
    GROOVE: {
        jazz: [2, 4, 6, 10, 12, 14, 18, 20, 22, 26, 28, 30],
        funk: [2, 4, 6, 10, 12, 14, 18, 20, 22, 26, 28, 30],
        rnb: [4, 6, 12, 14, 20, 22, 28, 30],
        orchestral: [4, 12, 20, 28],
        gospel: [2, 4, 6, 10, 12, 14, 18, 20, 22, 26, 28, 30]
    }
};

const HAT_SKELETONS = {
    // Trap: quarter notes as base, generator adds triplet/roll logic
    TRAP: {
        trap: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 8, 16, 24, 28], [0, 16], [0, 8, 16, 24, 4], [0, 8, 24],
            [0, 4, 8, 16, 20, 24], [0, 12, 16, 24], [0, 8, 16, 20, 24, 28],
            [0, 4, 8, 12, 16, 24, 28]
        ],
        // Drill: dense 8th/16th base for rapid rolls
        drill: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16, 24], [0, 24], [0, 4, 8, 16, 24, 28], [0, 8, 12, 16, 24],
            [0, 4, 12, 20, 28], [0, 8, 16, 20, 24], [0, 4, 8, 16, 20, 24, 28],
            [0, 8, 24, 28]
        ]
    },
    BOOM_BAP: {
        boom_bap: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16], [0, 24], [0, 8, 24], [0, 4, 8, 16, 24],
            [0, 8, 16, 20, 24], [0, 12, 16, 24], [0, 4, 16, 24]
        ],
        lofi: [
            [0, 8, 16, 24], [0, 16], [4, 12, 20, 28], [0, 24], [0, 8, 16],
            [0, 8, 24], [0, 16, 24], [4, 12, 20], [0, 4, 16], [0, 8, 20]
        ]
    },
    // House: constant 8ths or offbeats
    FOUR_ON_FLOOR: {
        four_on_floor: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16], [0, 8, 16, 24, 28], [0, 4, 8, 16, 20, 24],
            [0, 8, 12, 16, 24, 28], [0, 4, 8, 12, 20, 24, 28],
            [0, 8, 16, 20, 24], [4, 8, 12, 20, 24, 28]
        ],
        trance: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16], [0, 4, 8, 16, 24], [0, 8, 16, 20, 24, 28],
            [0, 8, 12, 16, 24], [0, 4, 8, 16, 20, 24, 28]
        ],
        retro: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16, 24], [0, 8, 16, 24, 28], [0, 4, 16, 24],
            [0, 8, 20, 24], [0, 4, 8, 16, 24]
        ]
    },
    TECHNO: {
        techno: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16], [0, 24], [0, 4, 8, 16, 20, 24], [0, 8, 12, 24, 28],
            [0, 4, 8, 12, 16, 24], [0, 8, 16, 20, 24, 28],
            [4, 8, 12, 20, 24, 28]
        ]
    },
    BASS_MUSIC: {
        dubstep: [
            [0, 16], [0, 8, 16, 24], [4, 12, 20, 28], [0, 24], [0, 16, 24],
            [0, 4, 16, 24], [0, 8, 16], [0, 12, 16, 24], [0, 16, 20, 24],
            [4, 16, 24, 28]
        ],
        dnb: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16], [0, 4, 8, 16, 24, 28], [0, 8, 12, 16, 24],
            [0, 4, 8, 12, 20, 24, 28], [0, 8, 16, 20, 24],
            [0, 4, 12, 16, 24, 28]
        ],
        future_bass: [
            [0, 8, 16, 24], [0, 16], [4, 12, 20, 28], [0, 24], [0, 16, 24],
            [0, 8, 24], [0, 4, 16], [0, 8, 16, 28], [0, 12, 24],
            [0, 4, 8, 16, 24]
        ]
    },
    WORLD: {
        reggae: [
            [0, 8, 16, 24], [4, 12, 20, 28], [0, 4, 8, 12, 16, 20, 24, 28],
            [0, 16], [0, 8, 24], [4, 12, 20], [0, 16, 24],
            [0, 4, 8, 16, 24], [0, 8, 16, 20, 24]
        ],
        reggaeton: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16, 24], [0, 4, 8, 16, 24], [0, 8, 12, 16, 24, 28],
            [0, 4, 8, 12, 20, 24, 28], [0, 8, 16, 20, 24, 28],
            [0, 4, 12, 16, 24]
        ],
        afrobeat: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16], [0, 4, 8, 16, 24], [0, 8, 12, 24],
            [0, 4, 16, 20, 24, 28], [0, 8, 16, 24, 28],
            [0, 4, 8, 12, 20, 24]
        ],
        latin: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16, 24], [0, 4, 8, 16, 24], [0, 8, 12, 16, 24],
            [0, 4, 12, 20, 28], [0, 8, 16, 20, 24, 28],
            [0, 4, 8, 16, 20, 24]
        ]
    },
    GROOVE: {
        jazz: [
            [0, 8, 16, 24], [0, 16], [4, 12, 20, 28], [0, 24], [0, 16, 24],
            [0, 8, 24], [0, 4, 16], [0, 8, 20], [0, 12, 24],
            [4, 16, 24]
        ],
        funk: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [4, 12, 20, 28],
            [0, 16], [0, 4, 8, 16, 24, 28], [0, 8, 12, 20, 24],
            [0, 4, 8, 12, 16, 24], [0, 8, 16, 20, 24, 28],
            [0, 4, 12, 16, 24, 28]
        ],
        rnb: [
            [0, 8, 16, 24], [0, 16, 24], [4, 12, 20, 28], [0, 16], [0, 24],
            [0, 8, 24], [0, 4, 16, 24], [0, 8, 16, 28], [0, 12, 24],
            [0, 8, 20, 24]
        ],
        orchestral: [
            [0, 16], [0, 8, 16, 24], [0, 24], [4, 12, 20, 28],
            [0, 4, 16], [0, 8, 24], [0, 16, 24], [0, 12, 16]
        ],
        // Gospel: 8th or 16th notes, similar to funk feel
        gospel: [
            [0, 8, 16, 24], [0, 4, 8, 12, 16, 20, 24, 28], [0, 16, 24],
            [0, 8, 24], [0, 4, 8, 16, 24, 28], [0, 8, 16, 20, 24],
            [0, 4, 12, 16, 24], [0, 8, 12, 20, 24, 28]
        ]
    }
};

// 8th-note refinement positions within each 8-step group (offsets 2, 4, 6)
const HAT_EIGHTH_POSITIONS = [4];
const HAT_SIXTEENTH_POSITIONS = [2, 6];

const OPENHAT_SKELETONS = {
    // Trap: sparse accents
    TRAP: {
        trap: [
            [12, 28], [12], [28], [4, 28], [4], [20], [4, 12, 28],
            [4, 20], [12, 20], [4, 12], [20, 28], [4, 28]
        ],
        drill: [
            [12, 28], [4, 20], [12], [28], [4, 28], [12, 20], [8, 28],
            [4, 12], [20, 28], [4, 12, 28], [8, 20], [12, 24]
        ]
    },
    BOOM_BAP: {
        boom_bap: [
            [12, 28], [4, 20], [12], [28], [4, 28], [12, 20], [4, 8, 20, 28],
            [4, 12], [20, 28], [4, 20, 28], [8, 12, 28]
        ],
        lofi: [
            [12, 28], [12], [4, 20], [28], [4], [20], [4, 12, 28],
            [4, 12], [20, 28], [12, 20], [4, 28]
        ]
    },
    // House/Techno: [4,12,20,28] offbeats CRITICAL
    FOUR_ON_FLOOR: {
        four_on_floor: [
            [4, 12, 20, 28], [4, 20], [12, 28], [4, 28], [4, 12, 28],
            [12, 20, 28], [4, 12, 20], [4, 20, 28], [12, 20],
            [4, 12], [20, 28]
        ],
        trance: [
            [4, 12, 20, 28], [4, 20], [12, 28], [4, 28], [4, 12, 28],
            [20, 28], [4, 12, 20], [4, 20, 28], [12, 20], [4, 12]
        ],
        retro: [
            [4, 12, 20, 28], [4, 20], [12, 28], [4, 28], [12, 20],
            [4, 8, 20, 28], [4, 12, 28], [12, 20, 28], [4, 20, 28],
            [4, 12, 20]
        ]
    },
    TECHNO: {
        techno: [
            [4, 12, 20, 28], [4, 20], [12, 28], [4, 28], [12, 20],
            [4, 8, 20, 28], [4, 12, 28], [4, 12, 20], [12, 20, 28],
            [4, 20, 28], [8, 20, 28]
        ]
    },
    BASS_MUSIC: {
        dubstep: [
            [12, 28], [4, 20], [28], [4], [12, 20], [4, 28], [8, 28],
            [4, 12], [20], [12], [4, 20, 28]
        ],
        dnb: [
            [4, 12, 20, 28], [4, 20], [12, 28], [4, 28], [12, 20],
            [4, 8, 20, 28], [4, 12, 28], [12, 20, 28], [4, 12, 20],
            [4, 20, 28]
        ],
        future_bass: [
            [4, 20], [4, 12, 20, 28], [28], [12, 28], [4, 28], [12, 20],
            [4, 12], [20, 28], [4, 12, 28], [4, 20, 28]
        ]
    },
    WORLD: {
        reggae: [
            [4, 12, 20, 28], [4, 20], [12, 28], [4, 28], [12, 20],
            [4, 12, 28], [4, 12, 20], [4, 20, 28], [12, 20, 28],
            [4, 12]
        ],
        reggaeton: [
            [4, 20], [4, 12, 20, 28], [12, 28], [4, 28], [20],
            [4, 12, 28], [12, 20], [4, 12, 20], [4, 20, 28], [12, 20, 28]
        ],
        afrobeat: [
            [4, 12, 20, 28], [4, 20], [12, 28], [4, 28], [12, 20],
            [4, 8, 20, 28], [4, 12, 28], [12, 20, 28], [4, 12, 20],
            [4, 20, 28]
        ],
        latin: [
            [4, 20], [4, 12, 20, 28], [12, 28], [4, 28], [12, 20],
            [4, 12, 28], [4, 12, 20], [4, 20, 28], [12, 20, 28],
            [4, 12]
        ]
    },
    GROOVE: {
        jazz: [
            [4, 20], [12, 28], [4], [28], [4, 28], [12, 20],
            [4, 12], [20], [12], [4, 12, 28], [20, 28]
        ],
        // Funk: 16th note before each downbeat
        funk: [
            [6, 14, 22, 30], [6, 22], [14, 30], [6, 30], [6, 14, 30],
            [14, 22, 30], [6, 14, 22], [6, 22, 30], [14, 22],
            [6, 14], [22, 30]
        ],
        rnb: [
            [12, 28], [4, 20], [28], [4], [4, 28], [12, 20],
            [4, 12], [20, 28], [4, 20, 28], [12]
        ],
        orchestral: [
            [4, 20], [12], [28], [4, 28], [12, 20], [20],
            [4, 12], [4], [12, 28], [24]
        ],
        gospel: [
            [4, 20], [12, 28], [4, 28], [12, 20],
            [4, 12], [20, 28], [4, 12, 28], [4, 20, 28]
        ]
    }
};

const PERC_MOTIFS = {
    // Trap: scattered offbeats, call-and-response after snare
    TRAP: {
        trap: [[0, 4], [4], [0, 2, 4], [2, 6], [0, 3, 6], [1, 4], [0, 2, 5], [3, 5, 7]],
        drill: [[0, 4], [4, 6], [2, 6], [0, 3, 6], [1, 4], [0, 1, 4, 6], [3, 5, 7]]
    },
    // Boom Bap: ghost notes on "e" and "a" 16th positions
    BOOM_BAP: {
        boom_bap: [[0, 4], [2, 6], [0, 2], [4], [0, 3, 6], [1, 4], [2, 4, 6], [0, 2, 5]],
        lofi: [[2, 6], [0, 4], [4], [0, 3, 6], [1, 4], [0, 2, 5], [3, 5, 7]]
    },
    // House: shaker on last 16th of every beat ("a" = position 6)
    FOUR_ON_FLOOR: {
        four_on_floor: [[6], [0, 6], [2, 6], [4, 6], [0, 3, 6], [1, 3, 5, 7], [2, 4, 6]],
        trance: [[6], [0, 6], [2, 4, 6], [0, 3, 6], [1, 4], [2, 6], [0, 2, 4, 6]],
        retro: [[6], [0, 6], [0, 3, 6], [2, 6], [4, 6], [1, 4]]
    },
    // Techno: dense 16th-note feel
    TECHNO: {
        techno: [[0, 2, 4, 6], [0, 4], [2, 6], [0, 2, 4], [0, 3, 6], [1, 3, 5, 7], [2, 4, 6], [0, 2, 5]]
    },
    // DnB: ghost notes immediately following snares
    BASS_MUSIC: {
        dubstep: [[0], [0, 4], [4], [0, 3, 6], [1, 4], [0, 2, 5], [2, 6]],
        dnb: [[2], [2, 6], [0, 2, 4, 6], [0, 3, 6], [1, 3, 5, 7], [1, 4], [3, 5, 7]],
        future_bass: [[0], [0, 4], [4], [0, 3, 6], [1, 4], [0, 2, 5], [2, 4, 6]]
    },
    // World: clave-influenced, afrobeat dense shaker
    WORLD: {
        reggae: [[0, 6], [0, 4], [2, 6], [0, 3, 6], [1, 4], [0, 2, 5], [2, 4, 6]],
        reggaeton: [[0, 4], [0, 2, 4, 6], [2, 6], [0, 3, 6], [1, 3, 5, 7], [0, 1, 4, 6], [3, 5, 7]],
        afrobeat: [[0, 2, 4, 6], [0, 6], [2, 4], [0, 2, 6], [0, 3, 6], [1, 3, 5, 7], [0, 1, 4, 6], [2, 4, 6]],
        latin: [[0, 6], [0, 2, 6], [2, 4, 6], [0, 4, 6], [0, 3, 6], [1, 3, 5, 7], [0, 1, 4, 6], [0, 2, 5]]
    },
    GROOVE: {
        jazz: [[0], [0, 4], [4], [0, 2], [0, 3, 6], [1, 4], [0, 2, 5], [3, 5, 7]],
        funk: [[0, 2, 4, 6], [0, 4], [0, 2, 4], [0, 3, 6], [1, 3, 5, 7], [2, 4, 6], [0, 1, 4, 6]],
        rnb: [[0], [0, 4], [4], [0, 3, 6], [1, 4], [0, 2, 5], [2, 6]],
        orchestral: [[0], [0, 4], [0, 3, 6], [1, 4], [0, 2, 5], [2, 6]],
        gospel: [[0, 2, 4, 6], [0, 4], [0, 2, 4], [0, 3, 6], [1, 3, 5, 7], [2, 4, 6], [0, 1, 4, 6]]
    }
};

// ─── Merge Expansion Patterns ───────────────────────────────────────────────
mergeDrumExpansion(KICK_SKELETONS, KICK_SKELETONS_EXPANSION);
mergeDrumExpansion(SNARE_SKELETONS, SNARE_SKELETONS_EXPANSION);
mergeDrumExpansion(HAT_SKELETONS, HAT_SKELETONS_EXPANSION);
mergeDrumExpansion(OPENHAT_SKELETONS, OPENHAT_SKELETONS_EXPANSION);
mergeDrumExpansion(PERC_MOTIFS, PERC_MOTIFS_EXPANSION);

// ─── Module-scope PATTERNS_808 (extracted for expansion merge) ──────────────
const PATTERNS_808 = {
    TRAP: [
        [0, 12, 24, 44, 56, 76, 88, 108],
        [0, 24, 48, 72, 96, 120],
        [8, 24, 40, 56, 72, 88, 104, 120],
        [0, 12, 48, 60, 96, 108],
        [0, 6, 24, 48, 54, 72, 96, 102],
        [0, 20, 44, 64, 84, 108],
        [0, 12, 28, 48, 60, 76, 96, 108],
        [0, 24, 40, 64, 88, 104],
        [0, 6, 20, 48, 54, 68, 96, 102],
        [0, 14, 24, 46, 56, 78, 88, 110],
        [0, 10, 24, 42, 56, 74, 88, 106],
        [0, 24, 44, 68, 88, 112]
    ],
    BOOM_BAP: [
        [0, 48, 64, 96], [0, 32, 64, 96], [0, 16, 64, 80, 96],
        [0, 24, 64, 88], [0, 48, 80, 96], [0, 16, 48, 64, 96],
        [0, 32, 48, 96], [0, 16, 64, 96], [0, 48, 64, 80],
        [0, 24, 48, 96], [0, 32, 80, 96]
    ],
    FOUR_ON_FLOOR: [
        [0, 64], [0, 32, 64, 96], [], [0, 48, 96], [0, 24, 64],
        [0, 64, 96], [0, 32, 96], [0, 16, 64], [0, 48, 64],
        [0, 64, 80], [0, 32, 64]
    ],
    HALF_TIME: [
        [0, 24, 64, 88], [0, 48, 72, 96], [12, 36, 76, 100],
        [0, 20, 64, 84], [0, 44, 64, 108], [0, 28, 72, 100],
        [8, 48, 72, 88], [0, 16, 64, 80], [0, 40, 64, 104],
        [0, 24, 72, 96], [0, 36, 64, 100]
    ],
    REGGAE: [
        [0, 48, 64], [0, 32, 96], [0, 64], [0, 48, 80],
        [0, 24, 64, 96], [0, 64, 80], [0, 32, 64], [0, 48, 96],
        [0, 16, 64], [0, 64, 88], [0, 48, 64, 96]
    ],
    LATIN: [
        [0, 24, 48, 72, 96], [0, 12, 48, 60, 96, 108], [0, 24, 64, 88],
        [0, 12, 36, 64, 88, 108], [0, 24, 48, 96], [0, 16, 48, 72, 96],
        [0, 24, 60, 84, 108], [0, 12, 48, 72, 96], [0, 24, 48, 84, 108],
        [0, 16, 36, 64, 96], [0, 24, 64, 96]
    ]
};

// Merge 808 expansion
mergeDrumExpansion(PATTERNS_808, PATTERNS_808_EXPANSION);

// ─── Generator Functions ────────────────────────────────────────────────────

/**
 * 808 Sub-Bass Pattern Generator
 * Generates sparse, heavy sub-bass patterns that complement the kick.
 * Genre-aware: Trap gets sliding 808s, Boom Bap gets accent hits, etc.
 */
function generate808(lanes, family, variant, totalSteps, density, beatContext) {
    const root = lanes['root'];
    const stepsPerBar = 32;
    const numBars = Math.floor(totalSteps / stepsPerBar);
    const profile = beatContext?.profile || {};
    const dur808 = family === 'TRAP' ? 12 : 8;

    // When profile says 808 follows kick, mirror kick timing with sustained notes
    if (profile._808FollowsKick && beatContext?.kickPattern) {
        for (let s = 0; s < totalSteps; s++) {
            if (beatContext.kickPattern[s]) {
                root.pattern[s] = true;
                root.duration[s] = dur808;
                root.velocity[s] = 100 + Math.floor(Math.random() * 20);
            }
        }
    } else {
        // Independent 808: use full multi-bar skeleton patterns
        const familyPatterns = PATTERNS_808[family] || PATTERNS_808.TRAP;
        const skeleton = getRandomSelection(familyPatterns, `808_${family}`);
        skeleton.forEach(step => {
            if (step < totalSteps) {
                root.pattern[step] = true;
                root.duration[step] = dur808;
                root.velocity[step] = 100 + Math.floor(Math.random() * 20);
            }
        });
    }

    // Add occasional variation hits at higher density (per-bar)
    for (let bar = 0; bar < numBars; bar++) {
        if (density > 0.6 && Math.random() < 0.3) {
            const barOffset = bar * stepsPerBar;
            const extraStep = barOffset + [4, 8, 20, 28][Math.floor(Math.random() * 4)];
            if (extraStep < totalSteps && !root.pattern[extraStep]) {
                root.pattern[extraStep] = true;
                root.duration[extraStep] = 6;
                root.velocity[extraStep] = 80 + Math.floor(Math.random() * 15);
            }
        }
    }
}

function generateKick(lanes, family, variant, totalSteps, density, beatContext) {
    const root = lanes['root'];

    // Use coordinated kick pattern from beat context if available
    if (beatContext && beatContext.kickPattern) {
        for (let s = 0; s < totalSteps; s++) {
            if (beatContext.kickPattern[s]) {
                root.pattern[s] = true;
                root.velocity[s] = 115;
            }
        }
    } else {
        // Fallback: existing skeleton logic
        const skeletons = (KICK_SKELETONS[family] && KICK_SKELETONS[family][variant])
            || KICK_SKELETONS.BOOM_BAP.boom_bap;
        for (let b = 0; b < totalSteps; b += 32) {
            const skel = getRandomSelection(skeletons);
            skel.forEach(pos => {
                const step = b + pos;
                if (step < totalSteps) {
                    root.pattern[step] = true;
                    root.velocity[step] = 115;
                }
            });
        }
    }

    // Metal double kick: fill between main kicks with alternating velocity
    if (beatContext?.profile?.doubleKick) {
        const doubleKickVel = [84, 70, 59, 44]; // alternating foot velocity curve
        for (let b = 0; b < totalSteps; b += 32) {
            // Fill 16th note positions between existing kick hits
            for (let s = 0; s < 32; s += 2) {
                const step = b + s;
                if (step < totalSteps && !root.pattern[step]) {
                    if (Math.random() < density * 0.6) {
                        root.pattern[step] = true;
                        root.velocity[step] = doubleKickVel[Math.floor(s / 2) % doubleKickVel.length];
                    }
                }
            }
        }
    } else {
        // Phase 2: Controlled Ghost Notes (standard genres)
        const refinements = (KICK_REFINEMENTS[family] && KICK_REFINEMENTS[family][variant]) || [];
        if (density > 0.6 && refinements.length > 0) {
            for (let b = 0; b < totalSteps; b += 32) {
                refinements.forEach(pos => {
                    const step = b + pos;
                    if (step < totalSteps && !root.pattern[step]) {
                        const prev = step > 0 ? root.pattern[step - 1] : false;
                        const next = step < totalSteps - 1 ? root.pattern[step + 1] : false;
                        if (!prev && !next) {
                            const prob = (density - 0.6) * 0.75;
                            if (Math.random() < prob) {
                                root.pattern[step] = true;
                                root.velocity[step] = 85;
                            }
                        }
                    }
                });
            }
        }
    }
}

function generateSnareClap(lanes, family, variant, totalSteps, density, drumType, beatContext) {
    const root = lanes['root'];
    const laneNeg1 = lanes['lane_neg1'];
    const laneNeg2 = lanes['lane_neg2'];
    const lane1 = lanes['lane_1'];
    const lane2 = lanes['lane_2'];

    // Set pitch offsets for roll articulations
    laneNeg1.pitch = -1.5;
    laneNeg2.pitch = -3;
    lane1.pitch = 1.5;
    lane2.pitch = 3;

    const ghostPositions = (SNARE_GHOST_POSITIONS[family] && SNARE_GHOST_POSITIONS[family][variant])
        || SNARE_GHOST_POSITIONS.BOOM_BAP.boom_bap;

    // Use coordinated snare pattern from beat context if available
    if (beatContext && beatContext.snarePattern) {
        for (let s = 0; s < totalSteps; s++) {
            if (beatContext.snarePattern[s]) {
                root.pattern[s] = true;
                root.velocity[s] = 100;
                // Flam for clap
                if ((drumType === 'clap' || Math.random() < density * 0.2) && Math.random() < 0.25) {
                    if (s + 1 < totalSteps) {
                        root.pattern[s + 1] = true;
                        root.velocity[s + 1] = 100;
                    }
                }
            }
        }
    } else {
        // Fallback: existing per-bar skeleton logic
        const skeletons = (SNARE_SKELETONS[family] && SNARE_SKELETONS[family][variant])
            || SNARE_SKELETONS.BOOM_BAP.boom_bap;
        for (let b = 0; b < totalSteps; b += 32) {
            const skel = getRandomSelection(skeletons);
            skel.forEach(pos => {
                const step = b + pos;
                if (step < totalSteps) {
                    root.pattern[step] = true;
                    root.velocity[step] = 100;
                    if ((drumType === 'clap' || Math.random() < density * 0.2) && Math.random() < 0.25) {
                        if (step + 1 < totalSteps) {
                            root.pattern[step + 1] = true;
                            root.velocity[step + 1] = 100;
                        }
                    }
                }
            });
        }
    }

    // Country train beat: 16th note snare pattern with ghosts on 1&3, accents on 2&4
    if (beatContext?.profile?.trainBeat) {
        for (let b = 0; b < totalSteps; b += 32) {
            for (let s = 0; s < 32; s += 2) {
                const step = b + s;
                if (step >= totalSteps) break;
                const beat = Math.floor(s / 8); // 0-3
                if (beat === 1 || beat === 3) {
                    // Accented backbeat on 2 & 4
                    if (s % 8 === 0) {
                        root.pattern[step] = true;
                        root.velocity[step] = 110;
                    } else {
                        root.pattern[step] = true;
                        root.velocity[step] = 30 + Math.floor(Math.random() * 15);
                    }
                } else {
                    // Ghost notes on 1 & 3
                    root.pattern[step] = true;
                    root.velocity[step] = 25 + Math.floor(Math.random() * 15);
                }
            }
        }
    } else {
        // Phase 2: Ghost notes filtered by density (standard path)
        for (let b = 0; b < totalSteps; b += 32) {
            ghostPositions.forEach(pos => {
                const step = b + pos;
                if (step < totalSteps && !root.pattern[step]) {
                    const s = step % 2 === 0 ? step : step - 1;
                    if (!root.pattern[s] && Math.random() < eighthProb(density) * 0.35) {
                        root.pattern[s] = true;
                        root.velocity[s] = 100;
                    }
                }
            });
        }
    }

    // Phase 3: Snare roll at end of bar 4 ONLY (steps 120-127)
    // Uses 16th-note spacing (every 2 steps) so max consecutive is always ≤ 2
    if (totalSteps >= 128 && Math.random() < rollProb(density)) {
        // Clear the roll zone first (last 8 steps of bar 4)
        for (let s = 120; s < 128; s++) {
            Object.keys(lanes).forEach(lid => { lanes[lid].pattern[s] = false; });
        }

        // 16th-note roll: hits on even steps only (120, 122, 124, 126)
        const rollPositions = [120, 122, 124, 126];
        const rollVariants = [
            ['root', 'root', 'root', 'root'],
            ['root', 'root', 'lane_neg1', 'lane_neg2'],
            ['lane_neg2', 'lane_neg1', 'root', 'root'],
            ['root', 'lane_neg1', 'lane_neg1', 'root'],
            ['root', 'lane_neg2', 'root', 'lane_neg2'],
        ];
        const chosen = rollVariants[Math.floor(Math.random() * rollVariants.length)];
        for (let i = 0; i < rollPositions.length; i++) {
            const s = rollPositions[i];
            if (s < totalSteps && lanes[chosen[i]]) {
                lanes[chosen[i]].pattern[s] = true;
                lanes[chosen[i]].velocity[s] = 90 + i * 8; // ascending: 90→98→106→114
            }
        }
    }
}

function generateClosedHat(lanes, family, variant, totalSteps, density, beatContext) {
    const root = lanes['root'];
    const laneDown3 = lanes['lane_neg2'];
    laneDown3.pitch = -3;
    lanes['lane_neg1'].pitch = 0;
    lanes['lane_1'].pitch = 0;
    lanes['lane_2'].pitch = 0;

    const profile = beatContext?.profile || {};
    const baseRes = profile.hatBaseResolution || '8th';
    const allowRolls = profile.hatAllowRolls || false;
    const rollResolutions = profile.hatRollResolutions || ['16th'];
    const totalBeats = Math.floor(totalSteps / 8);

    // Helper to place a hat hit with proper velocity
    const placeHit = (step, vel) => {
        if (step >= 0 && step < totalSteps) {
            root.pattern[step] = true;
            root.velocity[step] = Math.max(40, Math.min(127, vel));
        }
    };

    // STEP 1: Assign resolution per beat (8 steps each)
    const beatResolutions = new Array(totalBeats);
    for (let beat = 0; beat < totalBeats; beat++) {
        beatResolutions[beat] = baseRes;

        if (allowRolls && density > 0.5) {
            // Before snare hits: upgrade to roll (classic "hat roll into snare")
            const nextBeatStart = (beat + 1) * 8;
            const nextIsSnare = beatContext?.snarePattern?.[nextBeatStart];
            if (nextIsSnare && Math.random() < 0.55) {
                beatResolutions[beat] = getRandomSelection(rollResolutions);
            }
            // Random roll sections for variety
            else if (Math.random() < density * 0.12) {
                beatResolutions[beat] = getRandomSelection(rollResolutions);
            }
        }
    }

    // STEP 2: Place hits according to resolution map with proper velocity curves
    for (let beat = 0; beat < totalBeats; beat++) {
        const bs = beat * 8;
        const res = beatResolutions[beat];

        switch (res) {
            case '8th':
                placeHit(bs, 100);
                placeHit(bs + 4, 85);
                break;
            case '16th':
                placeHit(bs, 100);
                placeHit(bs + 2, 75);
                placeHit(bs + 4, 90);
                placeHit(bs + 6, 70);
                break;
            case '32nd':
                // Ascending velocity ramp — the "building roll" before snare
                for (let i = 0; i < 8; i++) {
                    placeHit(bs + i, 50 + Math.round(i * (55 / 7)));
                }
                break;
            case 'triplet':
                // Triplet approximation: positions 0, 3, 5 within 8-step beat
                placeHit(bs, 100);
                placeHit(bs + 3, 85);
                placeHit(bs + 5, 75);
                break;
            case 'tresillo':
                // 3+3+2 drill pattern: positions 0, 3, 6
                placeHit(bs, 95);
                placeHit(bs + 3, 85);
                placeHit(bs + 6, 80);
                break;
            case 'offbeat':
                // House/techno offbeat hats: only position 4 (the "and")
                placeHit(bs + 4, 95);
                break;
            default:
                // Fallback to 8th
                placeHit(bs, 100);
                placeHit(bs + 4, 85);
                break;
        }
    }

    // STEP 3: Pitch contour — push some root hits to laneDown3 for tonal movement
    if (Math.random() < 0.4) {
        let currentLane = 'root';
        for (let s = 0; s < totalSteps; s++) {
            if (root.pattern[s] && Math.random() > 0.6) {
                currentLane = currentLane === 'root' ? 'lane_neg2' : 'root';
            }
            if (root.pattern[s] && currentLane !== 'root') {
                const vel = root.velocity[s];
                root.pattern[s] = false;
                laneDown3.pattern[s] = true;
                laneDown3.velocity[s] = vel;
            }
        }
    }

    // STEP 4: Velocity dip on kick/snare (natural drummer behavior)
    if (beatContext?.profile?.hatVelocityDipOnKickSnare) {
        const hatLanes = ['root', 'lane_neg2'];
        for (let s = 0; s < totalSteps; s++) {
            if (beatContext.kickPattern?.[s] || beatContext.snarePattern?.[s]) {
                hatLanes.forEach(lid => {
                    if (lanes[lid]?.pattern[s]) {
                        lanes[lid].velocity[s] = Math.round(lanes[lid].velocity[s] * 0.55);
                    }
                });
            }
        }
    }
}

function generateOpenHat(lanes, family, variant, totalSteps, density) {
    const root = lanes['root'];

    const skeletons = (OPENHAT_SKELETONS[family] && OPENHAT_SKELETONS[family][variant])
        || OPENHAT_SKELETONS.BOOM_BAP.boom_bap;

    for (let b = 0; b < totalSteps; b += 32) {
        // Phase 1: Skeleton on root
        const skel = getRandomSelection(skeletons);
        skel.forEach(pos => {
            const step = b + pos;
            if (step < totalSteps) {
                root.pattern[step] = true;
                root.velocity[step] = 100;

                // Flam: 1-step-separated double hit
                if (Math.random() < density * 0.15) {
                    const flamStep = step + 1;
                    if (flamStep < totalSteps) {
                        root.pattern[flamStep] = true;
                        root.velocity[flamStep] = 100;
                    }
                }
            }
        });

        // Phase 2: "Before the snare" accent (16th note before beat 3)
        // and "and of 4" lead-in to next measure
        if (Math.random() < eighthProb(density) * 0.4) {
            const extraPositions = [14, 28];
            extraPositions.forEach(pos => {
                const step = b + pos;
                if (step < totalSteps && !root.pattern[step] && Math.random() < 0.35) {
                    root.pattern[step] = true;
                    root.velocity[step] = 100;
                }
            });
        }
    }
}

function generatePerc(lanes, family, variant, totalSteps, density) {
    const root = lanes['root'];

    // For hypnotic/techno/trance genres, optionally use Euclidean distribution
    const euclideanGenres = { TECHNO: true, FOUR_ON_FLOOR: true };
    if (euclideanGenres[family] && Math.random() < 0.4) {
        // Euclidean perc: 3, 5, or 7 hits across 16 steps — classic patterns
        const pulses = getRandomSelection([3, 5, 7]);
        const rotation = Math.floor(Math.random() * 4);
        applyEuclideanToLane(root, pulses, 16, totalSteps, 85, rotation);
        return;
    }

    const motifs = (PERC_MOTIFS[family] && PERC_MOTIFS[family][variant])
        || PERC_MOTIFS.BOOM_BAP.boom_bap;

    for (let i = 0; i < totalSteps; i += 8) {
        // Base probability: scale with density
        if (Math.random() < density * 0.6) {
            const motif = getRandomSelection(motifs);
            motif.forEach(s => {
                const step = i + s;
                if (step < totalSteps) {
                    root.pattern[step] = true;
                    root.velocity[step] = 100;
                }
            });
        }
    }
}

function generateOffSnare(lanes, family, variant, totalSteps, density) {
    const root = lanes['root'];

    // Genre-specific off-snare placement
    const offPositions = {
        // Trap: end-of-bar fills (26,28,30), bounces on & of 1/2 (4,12)
        TRAP: [4, 6, 12, 14, 26, 28, 30],
        // Boom Bap: swung ghost notes between kick and snare
        BOOM_BAP: [4, 6, 12, 14, 18, 20, 28],
        FOUR_ON_FLOOR: [2, 6, 14, 18, 22, 30],
        TECHNO: [2, 4, 6, 10, 14, 18, 22, 26, 30],
        // DnB: ghost notes immediately following snares; Dubstep: stutter around beat 3
        BASS_MUSIC: [12, 14, 18, 22, 26, 28, 30],
        // Reggaeton: tresillo off-beats (6,12,22,28); Afrobeat: clave accents
        WORLD: [0, 6, 12, 22, 28],
        // Jazz: comping accents; Funk: 16th ghost fills
        GROOVE: [2, 4, 6, 10, 14, 18, 22, 26, 30]
    };

    const positions = offPositions[family] || offPositions.BOOM_BAP;

    for (let b = 0; b < totalSteps; b += 32) {
        positions.forEach(pos => {
            const step = b + pos;
            if (step < totalSteps && Math.random() < density * 0.25) {
                const s = step % 2 === 0 ? step : step - 1;
                if (!root.pattern[s]) {
                    root.pattern[s] = true;
                    root.velocity[s] = 100;
                }
            }
        });
    }
}

function generateRim(lanes, family, variant, totalSteps, density) {
    const root = lanes['root'];

    // For world/groove genres, optionally use Euclidean bell/clave patterns
    // E(3,8) = tresillo, E(5,8) = cinquillo, E(7,16) = Afrobeat bell
    const euclideanRimGenres = { WORLD: true, GROOVE: true };
    if (euclideanRimGenres[family] && Math.random() < 0.35) {
        const configs = [
            { pulses: 3, steps: 8 },   // Tresillo
            { pulses: 5, steps: 8 },   // Cinquillo
            { pulses: 7, steps: 16 },  // Afrobeat bell
            { pulses: 5, steps: 16 },  // Son clave variant
        ];
        const cfg = getRandomSelection(configs);
        const rotation = Math.floor(Math.random() * 3);
        applyEuclideanToLane(root, cfg.pulses, cfg.steps, totalSteps, 90, rotation);
        return;
    }

    // Genre-specific rim/cross-stick placement
    const rimPatterns = {
        TRAP: [
            [4, 6, 12, 20, 28], [4, 12, 20, 26], [16, 30], [4, 12, 28],
            [6, 20, 28], [4, 14, 22, 30], [4, 12, 20], [6, 14, 28],
            [4, 20, 26], [12, 20, 28]
        ],
        BOOM_BAP: [
            [4, 20], [12, 28], [4, 12, 20, 28], [4, 12, 28], [4, 20, 28],
            [12, 20], [4, 12], [20, 28], [4, 28], [12, 20, 28]
        ],
        FOUR_ON_FLOOR: [
            [4, 12, 20, 28], [2, 10, 18, 26], [4, 20], [12, 28],
            [4, 12, 28], [4, 20, 28], [12, 20, 28], [2, 18],
            [10, 26], [4, 12, 20]
        ],
        TECHNO: [
            [4, 12, 20, 28], [2, 6, 10, 14, 18, 22, 26, 30], [4, 20],
            [2, 10, 18, 26], [6, 14, 22, 30], [4, 12, 28],
            [2, 10, 26], [6, 22, 30], [4, 14, 20, 28], [2, 6, 18, 22]
        ],
        BASS_MUSIC: [
            [4, 20], [12, 28], [4, 28], [12, 20], [4, 12, 20, 28],
            [4, 12], [20, 28], [4, 20, 28], [12, 20, 28], [4, 12, 28]
        ],
        WORLD: [
            [16], [0, 12, 24], [4, 12, 20, 28], [4, 20], [12, 28],
            [0, 16, 24], [4, 16], [12, 24], [0, 8, 16, 24],
            [4, 12, 16, 28]
        ],
        GROOVE: [
            [24], [8, 24], [4, 12, 20, 28], [4, 20], [12, 28],
            [4, 24], [4, 12], [20, 28], [8, 20], [4, 12, 24]
        ]
    };

    const patterns = rimPatterns[family] || rimPatterns.BOOM_BAP;

    for (let b = 0; b < totalSteps; b += 32) {
        const pattern = getRandomSelection(patterns);
        pattern.forEach(pos => {
            const step = b + pos;
            if (step < totalSteps && Math.random() < density * 0.5) {
                root.pattern[step] = true;
                root.velocity[step] = 100;
            }
        });
    }
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateMinimumHits(lanes, totalSteps) {
    for (let bar = 0; bar < totalSteps; bar += 32) {
        let hasHit = false;
        for (const laneId of Object.keys(lanes)) {
            for (let s = bar; s < bar + 32 && s < totalSteps; s++) {
                if (lanes[laneId].pattern[s]) { hasHit = true; break; }
            }
            if (hasHit) break;
        }
        if (!hasHit) {
            lanes['root'].pattern[bar] = true;
            lanes['root'].velocity[bar] = 100;
        }
    }
}

// ─── Velocity Humanization (from PatternEngine research) ────────────────────
// Applies professional-sounding velocity curves based on beat position.
// Downbeat accents, backbeat emphasis, ghost notes on offbeats, micro-variation.
// This replaces flat velocity=100 with dynamics that match real drummer feel.

function humanizeDrumVelocity(lanes, totalSteps, drumId, beatContext) {
    const profile = beatContext?.profile || {};
    const id = (drumId || '').toLowerCase();

    Object.keys(lanes).forEach(laneId => {
        const lane = lanes[laneId];
        for (let s = 0; s < totalSteps; s++) {
            if (!lane.pattern[s]) continue;

            const posInBar = s % 32;
            const posInBeat = posInBar % 8;
            let vel = lane.velocity[s] || 100;

            if (id === 'kick' || id === '808') {
                // Kick: strong downbeat, moderate others, soft ghosts
                if (posInBar === 0) vel = 120;
                else if (posInBar === 16) vel = 112;
                else if (posInBar === 8 || posInBar === 24) vel = 108;
                else if (posInBeat === 4) vel = 95;
                else if (posInBeat === 2 || posInBeat === 6) vel = 80;
                else vel = 70;
            } else if (id === 'snare' || id === 'clap') {
                // Snare: main hits loud, ghost notes per genre profile
                const ghostRange = profile.ghostSnareVelocity || [40, 60];
                const isMainHit = posInBar === 8 || posInBar === 16 || posInBar === 24 || posInBar === 0;
                if (isMainHit) {
                    vel = posInBar === 0 ? 105 : 110;
                } else {
                    // Ghost note — use genre-specific velocity range
                    vel = ghostRange[0] + Math.floor(Math.random() * (ghostRange[1] - ghostRange[0]));
                }
            } else if (id === 'closedhat') {
                // Hi-hat: already has velocity from section-based generator, just add micro-variation
                // Don't overwrite — skip the curve, only apply micro-variation below
            } else {
                // Generic curve for perc, rim, offsnare, openhat
                if (posInBar === 0) vel = 120;
                else if (posInBar === 8 || posInBar === 24) vel = 110;
                else if (posInBar === 16) vel = 105;
                else if (posInBeat === 4) vel = 90;
                else if (posInBeat === 2 || posInBeat === 6) vel = 70;
                else vel = 60;
            }

            // Micro-variation: ±6% randomness for human feel (tighter than before)
            vel = Math.round(vel * (0.94 + Math.random() * 0.12));
            lane.velocity[s] = Math.max(30, Math.min(127, vel));
        }
    });
}

// ─── Swing Simulation ──────────────────────────────────────────────────────
// Simulates swing via velocity emphasis (grid positions are fixed, so we
// modulate velocity on swung positions to create rhythmic push/pull feel).
// swingAmount: 0.5 = straight, 0.58 = light MPC, 0.67 = triplet

const SWING_UPBEAT_POSITIONS = [2, 6, 10, 14, 18, 22, 26, 30];
const TRIPLET_GRID_POSITIONS = [0, 3, 5, 8, 11, 13, 16, 19, 21, 24, 27, 29];

function applySwing(lanes, totalSteps, swingAmount, swingStyle) {
    if (!swingAmount || swingAmount <= 0.5) return;

    const intensity = (swingAmount - 0.5) * 5; // 0 to ~0.85

    Object.keys(lanes).forEach(laneId => {
        const lane = lanes[laneId];
        for (let s = 0; s < totalSteps; s++) {
            if (!lane.pattern[s]) continue;
            const posInBar = s % 32;

            if (swingStyle === 'mpc') {
                // MPC swing: emphasize upbeats (the "ands")
                if (SWING_UPBEAT_POSITIONS.includes(posInBar)) {
                    lane.velocity[s] = Math.round(lane.velocity[s] * (1 + intensity * 0.15));
                }
            } else if (swingStyle === 'lazy') {
                // Behind-the-beat: soften non-downbeat downbeats, emphasize upbeats
                if (SWING_UPBEAT_POSITIONS.includes(posInBar)) {
                    lane.velocity[s] = Math.round(lane.velocity[s] * (1 + intensity * 0.12));
                } else if (posInBar !== 0 && posInBar % 8 === 0) {
                    lane.velocity[s] = Math.round(lane.velocity[s] * (1 - intensity * 0.08));
                }
            } else if (swingStyle === 'triplet') {
                // Jazz triplet: strong emphasis on triplet grid, de-emphasize non-triplet
                if (TRIPLET_GRID_POSITIONS.includes(posInBar)) {
                    lane.velocity[s] = Math.round(lane.velocity[s] * (1 + intensity * 0.18));
                } else {
                    lane.velocity[s] = Math.round(lane.velocity[s] * (1 - intensity * 0.15));
                }
            }

            lane.velocity[s] = Math.max(30, Math.min(127, lane.velocity[s]));
        }
    });
}

// ─── Euclidean Percussion Helper ────────────────────────────────────────────
// Uses the PatternEngine's Euclidean algorithm for mathematically even
// distribution of hits. Useful for hi-hats, rim, and percussion in
// hypnotic/techno/trance genres where evenly-spaced patterns sound best.

function applyEuclideanToLane(lane, pulses, steps, totalSteps, velocity, rotation) {
    const euc = euclidean(pulses, steps, rotation || 0);
    for (let bar = 0; bar < totalSteps; bar += steps) {
        for (let s = 0; s < steps && (bar + s) < totalSteps; s++) {
            if (euc[s]) {
                lane.pattern[bar + s] = true;
                lane.velocity[bar + s] = velocity || 100;
            }
        }
    }
}

// ─── Fill System ───────────────────────────────────────────────────────────
// Genre-specific fills placed on the designated fill bar from phrase structure.

const FILL_PATTERNS = {
    TRAP: {
        kick: [
            { steps: [24, 26, 28, 30], velocities: [85, 93, 101, 110] },
            { steps: [28, 29, 30, 31], velocities: [90, 97, 105, 115] },
        ],
        snare: [
            { steps: [20, 22, 24, 26, 28, 30], velocities: [60, 70, 80, 90, 100, 110] },
            { steps: [24, 26, 28, 30], velocities: [80, 90, 100, 115] },
        ],
        closedhat: [
            { steps: [24, 25, 26, 27, 28, 29, 30, 31], velocities: [50, 57, 64, 71, 78, 85, 92, 100] },
        ],
    },
    BOOM_BAP: {
        snare: [
            { steps: [24, 26, 28, 30], velocities: [70, 80, 90, 100] },
            { steps: [28, 30], velocities: [85, 100] },
        ],
        closedhat: [
            { steps: [24, 26, 28, 30], velocities: [75, 85, 90, 100] },
        ],
    },
    FOUR_ON_FLOOR: {
        snare: [
            { steps: [24, 26, 28, 30], velocities: [70, 80, 90, 105] },
        ],
        closedhat: [
            { steps: [24, 25, 26, 27, 28, 29, 30, 31], velocities: [60, 65, 70, 75, 80, 85, 90, 100] },
        ],
    },
    TECHNO: {
        snare: [
            { steps: [24, 26, 28, 30], velocities: [65, 75, 85, 100] },
        ],
    },
    BASS_MUSIC: {
        snare: [
            { steps: [20, 22, 24, 26, 28, 30], velocities: [55, 65, 75, 85, 95, 110] },
            { steps: [24, 26, 28, 30], velocities: [80, 90, 100, 115] },
        ],
        closedhat: [
            { steps: [24, 25, 26, 27, 28, 29, 30, 31], velocities: [45, 55, 65, 70, 80, 85, 95, 105] },
        ],
    },
    WORLD: {
        snare: [
            { steps: [24, 26, 28, 30], velocities: [65, 75, 85, 100] },
        ],
        closedhat: [
            { steps: [26, 28, 30], velocities: [80, 90, 100] },
        ],
    },
    GROOVE: {
        snare: [
            { steps: [24, 26, 28, 30], velocities: [60, 75, 85, 100] },
            { steps: [28, 30], velocities: [85, 100] },
        ],
        closedhat: [
            { steps: [24, 26, 28, 30], velocities: [75, 85, 90, 100] },
        ],
    },
    METAL: {
        kick: [
            { steps: [24, 25, 26, 27, 28, 29, 30, 31], velocities: [70, 75, 80, 84, 70, 75, 80, 84] },
        ],
        snare: [
            { steps: [24, 26, 28, 30], velocities: [80, 90, 100, 115] },
        ],
    },
    INDIE: {
        snare: [
            { steps: [24, 26, 28, 30], velocities: [70, 80, 90, 105] },
        ],
    },
    COUNTRY: {
        snare: [
            { steps: [24, 26, 28, 30], velocities: [60, 75, 85, 100] },
        ],
    },
    BREAKBEAT: {
        snare: [
            { steps: [22, 24, 26, 28, 30], velocities: [65, 75, 85, 95, 110] },
        ],
    },
    ELECTRO: {
        snare: [
            { steps: [24, 26, 28, 30], velocities: [70, 80, 90, 105] },
        ],
    },
};

function applyFill(lanes, family, drumId, fillBar, totalSteps) {
    const id = drumId.toLowerCase();
    const fillData = FILL_PATTERNS[family]?.[id];
    if (!fillData || fillData.length === 0) return;

    const barOffset = fillBar * 32;
    if (barOffset >= totalSteps) return;

    const fill = getRandomSelection(fillData);

    // Clear fill zone (from first fill step to end of bar)
    const fillStart = barOffset + fill.steps[0];
    for (let s = fillStart; s < barOffset + 32 && s < totalSteps; s++) {
        Object.keys(lanes).forEach(lid => { lanes[lid].pattern[s] = false; });
    }

    // Place fill hits on root lane
    fill.steps.forEach((step, i) => {
        const s = barOffset + step;
        if (s < totalSteps) {
            lanes['root'].pattern[s] = true;
            lanes['root'].velocity[s] = fill.velocities[i] || 100;
        }
    });
}

// ─── Consecutive-Hit Caps ─────────────────────────────────────────────────
// Kick: never more than 3 in a row (across ALL lanes)
// Snare: never more than 2 in a row UNLESS inside end-of-4-bar roll zone (steps 120-127)

function enforceKickCap(lanes, totalSteps, beatContext) {
    // Metal/double-kick genres: allow up to 16 consecutive. Others: max 3.
    const maxConsecutive = beatContext?.profile?.doubleKick ? 16 : 3;
    for (let s = 0; s < totalSteps; s++) {
        let runLen = 0;
        for (let check = s; check >= 0; check--) {
            let hasHit = false;
            for (const lid of Object.keys(lanes)) {
                if (lanes[lid].pattern[check]) { hasHit = true; break; }
            }
            if (hasHit) runLen++;
            else break;
        }
        if (runLen > maxConsecutive) {
            for (const lid of Object.keys(lanes)) {
                lanes[lid].pattern[s] = false;
            }
        }
    }
}

function enforceSnareCap(lanes, totalSteps) {
    // Max 2 consecutive snare hits normally, but allow up to 4 in roll zones
    // Roll zones = last 8 steps of every 4th bar (phrase endings)
    const stepsPerBar = 32;
    for (let s = 0; s < totalSteps; s++) {
        const barIndex = Math.floor(s / stepsPerBar);
        const posInBar = s % stepsPerBar;
        const isRollZone = (barIndex + 1) % 4 === 0 && posInBar >= 24;
        const maxConsecutive = isRollZone ? 4 : 2;

        let runLen = 0;
        for (let check = s; check >= 0; check--) {
            let hasHit = false;
            for (const lid of Object.keys(lanes)) {
                if (lanes[lid].pattern[check]) { hasHit = true; break; }
            }
            if (hasHit) runLen++;
            else break;
        }
        if (runLen > maxConsecutive) {
            for (const lid of Object.keys(lanes)) {
                lanes[lid].pattern[s] = false;
            }
        }
    }
}

// ─── Main Export ────────────────────────────────────────────────────────────

// Simple mode: cap consecutive hits per lane to maxConsecutive
function enforceSimpleCap(lanes, totalSteps, maxConsecutive = 2) {
    Object.keys(lanes).forEach(laneId => {
        const lane = lanes[laneId];
        let consecutive = 0;
        for (let s = 0; s < totalSteps; s++) {
            if (lane.pattern[s]) {
                consecutive++;
                if (consecutive > maxConsecutive) {
                    lane.pattern[s] = false;
                }
            } else {
                consecutive = 0;
            }
        }
    });
}

// Complex mode: add rolls and fills at phrase endings (every 4/8 bars, repeating for longer lengths)
function applyComplexEnhancements(lanes, family, variant, totalSteps, density, drumId) {
    const root = lanes['root'];
    const stepsPerBar = 32;
    const numBars = Math.floor(totalSteps / stepsPerBar);
    const id = drumId.toLowerCase();

    // Helper: check if this bar is a roll position (end of 4-bar or 8-bar phrase)
    const isRollBar = (bar) => (bar + 1) % 4 === 0;
    const isBigRollBar = (bar) => (bar + 1) % 8 === 0;

    if (id === '808' || id === 'kick') {
        // Kick/808 complex: rolls at end of 4/8 bars (same as snares), more ghost notes
        for (let bar = 0; bar < numBars; bar++) {
            const barOffset = bar * stepsPerBar;

            // Quadruple roll at end of every 4th bar
            if (isRollBar(bar) && Math.random() < 0.65) {
                const rollStart = barOffset + 28;
                for (let i = 0; i < 4; i++) {
                    const s = rollStart + i;
                    if (s < totalSteps) {
                        root.pattern[s] = true;
                        root.velocity[s] = 85 + i * 8; // ascending: 85→93→101→109
                    }
                }
            }

            // Longer roll at end of every 8th bar (8-step roll)
            if (isBigRollBar(bar) && Math.random() < 0.55) {
                const rollStart = barOffset + 24;
                for (let i = 0; i < 8; i++) {
                    const s = rollStart + i;
                    if (s < totalSteps) {
                        root.pattern[s] = true;
                        root.velocity[s] = 75 + i * 5; // ascending: 75→110
                        root.duration[s] = i < 4 ? 2 : 1; // shorter at end for urgency
                    }
                }
            }

            // Double-kick patterns at phrase transitions
            if (bar % 2 === 1 && Math.random() < 0.4) {
                const pos = barOffset + [3, 7, 19, 27][Math.floor(Math.random() * 4)];
                if (pos < totalSteps && pos + 1 < totalSteps) {
                    root.pattern[pos] = true;
                    root.pattern[pos + 1] = true;
                    root.velocity[pos] = 90;
                    root.velocity[pos + 1] = 100;
                }
            }

            // Extra syncopation off-grid hits
            if (Math.random() < 0.35) {
                const offGridPos = barOffset + [3, 7, 11, 19, 27][Math.floor(Math.random() * 5)];
                if (offGridPos < totalSteps && !root.pattern[offGridPos]) {
                    root.pattern[offGridPos] = true;
                    root.velocity[offGridPos] = 80;
                }
            }
        }
    }

    if (id === 'snare' || id === 'clap') {
        // Complex snare: 16th-note roll ONLY at end of bar 4 (the last bar of the 4-bar loop)
        // Bar 3 (0-indexed) = steps 96-127, roll zone = steps 120-127
        const lastBar = numBars - 1; // bar index 3 for 4-bar generation
        if (lastBar >= 0 && Math.random() < 0.8) {
            const rollZoneStart = lastBar * stepsPerBar + 24; // step 120
            // Clear roll zone
            for (let i = 0; i < 8; i++) {
                const s = rollZoneStart + i;
                if (s < totalSteps) {
                    Object.keys(lanes).forEach(lid => { lanes[lid].pattern[s] = false; });
                }
            }
            // 16th-note roll: hits on EVEN steps only (120, 122, 124, 126)
            // This ensures max 2 consecutive (hit, empty, hit, empty...)
            const rollPositions = [rollZoneStart, rollZoneStart + 2, rollZoneStart + 4, rollZoneStart + 6];
            const rollVariants = [
                ['root', 'root', 'root', 'root'],                         // flat roll
                ['root', 'root', 'lane_neg1', 'lane_neg2'],               // descending
                ['lane_neg2', 'lane_neg1', 'root', 'root'],               // ascending
                ['root', 'lane_neg1', 'root', 'lane_neg1'],               // alternating
                ['root', 'lane_neg2', 'lane_neg1', 'root'],               // V-shape
                ['lane_neg1', 'root', 'lane_neg1', 'root'],               // bounce
            ];
            const chosen = rollVariants[Math.floor(Math.random() * rollVariants.length)];
            for (let i = 0; i < rollPositions.length; i++) {
                const s = rollPositions[i];
                if (s < totalSteps && lanes[chosen[i]]) {
                    lanes[chosen[i]].pattern[s] = true;
                    lanes[chosen[i]].velocity[s] = 90 + i * 8;
                }
            }
        }
    }

    if (id === 'closedhat') {
        const laneDown1 = lanes['lane_neg1'];
        const laneDown2 = lanes['lane_neg2'];

        // Roll variants — randomly picked at each 4-bar boundary
        // 4-step rolls (all go DOWN from root or stay at a pitch, never above root)
        const shortRollVariants = [
            ['root', 'lane_neg1', 'lane_neg2', 'lane_neg2'],         // descend to -2 and stay
            ['lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg2'],   // stay at -2 (low roll)
            ['lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1'],   // stay at -1 (mid roll)
            ['root', 'root', 'root', 'root'],                       // stay at root (flat roll)
            ['root', 'lane_neg2', 'lane_neg1', 'root'],             // down to -2 and back up
            ['root', 'lane_neg1', 'lane_neg1', 'lane_neg1'],        // descend to -1 and stay
        ];
        // 8-step rolls (all go DOWN from root or stay at a pitch, never above root)
        const longRollVariants = [
            ['root', 'root', 'lane_neg1', 'lane_neg1', 'lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg2'],   // gradual descend, stay low
            ['lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg2'], // all at -2
            ['lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1'], // all at -1
            ['root', 'lane_neg1', 'lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg2', 'lane_neg1', 'root'],   // down to -2 and back up
            ['root', 'lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1', 'lane_neg1'], // descend to -1 and stay
            ['root', 'root', 'lane_neg1', 'lane_neg2', 'lane_neg2', 'lane_neg1', 'root', 'root'],             // smooth down and back
        ];

        for (let bar = 0; bar < numBars; bar++) {
            const barOffset = bar * stepsPerBar;

            // 4-step roll at end of every 4th bar — pick a random variant each time
            if (isRollBar(bar) && Math.random() < 0.6) {
                const rollStart = barOffset + 28;
                const chosen = shortRollVariants[Math.floor(Math.random() * shortRollVariants.length)];
                for (let i = 0; i < 4 && rollStart + i < totalSteps; i++) {
                    Object.keys(lanes).forEach(lid => { lanes[lid].pattern[rollStart + i] = false; });
                    const lane = lanes[chosen[i]];
                    if (lane) {
                        lane.pattern[rollStart + i] = true;
                        lane.velocity[rollStart + i] = 100 + i * 3;
                    }
                }
            }

            // 8-step roll at end of every 8th bar — pick a random variant each time
            if (isBigRollBar(bar) && Math.random() < 0.55) {
                const rollStart = barOffset + 24;
                const chosen = longRollVariants[Math.floor(Math.random() * longRollVariants.length)];
                for (let i = 0; i < 8 && rollStart + i < totalSteps; i++) {
                    Object.keys(lanes).forEach(lid => { lanes[lid].pattern[rollStart + i] = false; });
                    const lane = lanes[chosen[i]];
                    if (lane) {
                        lane.pattern[rollStart + i] = true;
                        lane.velocity[rollStart + i] = 95 + i * 2;
                    }
                }
            }

            // Triplet bursts mid-bar
            if (Math.random() < 0.4) {
                const burstStart = barOffset + [8, 16][Math.floor(Math.random() * 2)];
                for (let i = 0; i < 3 && burstStart + i < totalSteps; i++) {
                    root.pattern[burstStart + i] = true;
                    root.velocity[burstStart + i] = 100 - i * 5;
                }
            }

            // Bounce feel — more aggressive for trap/drill families
            const isBouncy = family === 'TRAP' || family === 'BASS_MUSIC';
            const bounceChance = isBouncy ? 0.75 : 0.55;
            const ghostVel = isBouncy ? 80 : 85;

            // Core bounce: off-beat ghost hits next to on-beat hits (swing/triplet feel)
            for (let s = barOffset; s < barOffset + stepsPerBar && s < totalSteps; s += 2) {
                if (root.pattern[s] && s + 1 < totalSteps && !root.pattern[s + 1]) {
                    if (Math.random() < bounceChance) {
                        root.pattern[s + 1] = true;
                        root.velocity[s + 1] = ghostVel;
                    }
                }
            }

            // Trap/drill extra bounce: rapid 3-hit groupings and 32nd-note runs
            if (isBouncy) {
                // Rapid triplet groupings at random positions (2-3 per bar)
                const tripletCount = 2 + Math.floor(Math.random() * 2);
                for (let t = 0; t < tripletCount; t++) {
                    const pos = barOffset + Math.floor(Math.random() * 28); // avoid last 4 steps (roll zone)
                    if (pos + 2 < totalSteps) {
                        for (let i = 0; i < 3; i++) {
                            if (!root.pattern[pos + i]) {
                                root.pattern[pos + i] = true;
                                root.velocity[pos + i] = 90 - i * 5;
                            }
                        }
                    }
                }

                // Occasional 32nd-note 4-hit run (not on roll bars, to avoid collision)
                if (!isRollBar(bar) && Math.random() < 0.35) {
                    const runStart = barOffset + [4, 12, 20][Math.floor(Math.random() * 3)];
                    for (let i = 0; i < 4 && runStart + i < totalSteps; i++) {
                        root.pattern[runStart + i] = true;
                        root.velocity[runStart + i] = 105 - i * 5;
                    }
                }
            }
        }

        // Pitch contour: randomly push some root hits DOWN to neg1 or neg2 (never above root)
        if (Math.random() < 0.7) {
            for (let s = 0; s < totalSteps; s++) {
                if (root.pattern[s] && Math.random() < 0.3) {
                    root.pattern[s] = false;
                    // 60% chance neg2 (low), 40% chance neg1 (mid)
                    const target = Math.random() < 0.6 ? laneDown2 : laneDown1;
                    target.pattern[s] = true;
                    target.velocity[s] = 90;
                }
            }
        }
    }

    if (id === 'openhat') {
        // Open hat complex: 16th note ghost hits, open-closed combos
        for (let bar = 0; bar < numBars; bar++) {
            const barOffset = bar * stepsPerBar;
            for (let s = barOffset; s < barOffset + stepsPerBar && s < totalSteps; s += 4) {
                if (root.pattern[s] && s + 2 < totalSteps && !root.pattern[s + 2]) {
                    if (Math.random() < 0.3) {
                        root.pattern[s + 2] = true;
                        root.velocity[s + 2] = 70;
                    }
                }
            }
            // Roll at end of 4th bar
            if (isRollBar(bar) && Math.random() < 0.4) {
                for (let i = 28; i < 32; i++) {
                    const s = barOffset + i;
                    if (s < totalSteps) {
                        root.pattern[s] = true;
                        root.velocity[s] = 80 + (i - 28) * 8;
                    }
                }
            }
        }
    }
}

export const getProPattern = (genre, drumId, bars, key, scale, mood, complexity = 'simple') => {
    const totalSteps = bars * 32;
    const genSteps = 128; // Always generate 4 bars initially
    const lanes = createEmptyLanes(genSteps);

    const { family, variant } = resolveFamily(genre);
    const density = getRhythmDensity(mood);

    // Get or create beat context for coordinated generation
    const beatContext = getBeatContext(family, variant, density, complexity);

    switch (drumId.toLowerCase()) {
        case '808':
            generate808(lanes, family, variant, genSteps, density, beatContext);
            break;
        case 'kick':
            generateKick(lanes, family, variant, genSteps, density, beatContext);
            break;
        case 'snare':
        case 'clap':
            generateSnareClap(lanes, family, variant, genSteps, density, drumId, beatContext);
            break;
        case 'closedhat':
            generateClosedHat(lanes, family, variant, genSteps, density, beatContext);
            break;
        case 'openhat':
            generateOpenHat(lanes, family, variant, genSteps, density);
            break;
        case 'offsnare':
            generateOffSnare(lanes, family, variant, genSteps, density);
            break;
        case 'rim':
            generateRim(lanes, family, variant, genSteps, density);
            break;
        case 'perc':
        default:
            generatePerc(lanes, family, variant, genSteps, density);
            break;
    }

    // Apply complexity enhancements
    if (complexity === 'complex') {
        applyComplexEnhancements(lanes, family, variant, genSteps, density, drumId);
    }

    // Apply genre-specific fill on designated fill bar (complex mode only)
    if (complexity === 'complex' && beatContext?.fillBar !== undefined) {
        applyFill(lanes, family, drumId, beatContext.fillBar, genSteps);
    }

    // Enforce consecutive-hit caps (always, both simple and complex)
    const id = drumId.toLowerCase();
    if (id === 'kick' || id === '808') {
        enforceKickCap(lanes, genSteps, beatContext);
    }
    if (id === 'snare' || id === 'clap' || id === 'offsnare') {
        enforceSnareCap(lanes, genSteps);
    }

    // Validate minimum hits per bar
    validateMinimumHits(lanes, genSteps);

    // Apply humanized velocity curves (replaces flat 100)
    humanizeDrumVelocity(lanes, genSteps, drumId, beatContext);

    // Apply genre-specific swing
    if (beatContext?.swingAmount > 0.5) {
        applySwing(lanes, genSteps, beatContext.swingAmount, beatContext.swingStyle);
    }

    // Simple mode: cap consecutive hits at 2
    if (complexity === 'simple') {
        enforceSimpleCap(lanes, genSteps, 2);
    }

    // Mirror/slice for bar counts != 4
    if (bars > 4) {
        const finalLanes = createEmptyLanes(totalSteps);
        Object.keys(lanes).forEach(laneId => {
            const sourceLane = lanes[laneId];
            const targetLane = finalLanes[laneId];
            targetLane.pitch = sourceLane.pitch;
            for (let i = 0; i < totalSteps; i++) {
                const sourceIdx = i % genSteps;
                targetLane.pattern[i] = sourceLane.pattern[sourceIdx];
                targetLane.velocity[i] = sourceLane.velocity[sourceIdx];
                targetLane.duration[i] = sourceLane.duration[sourceIdx];
            }
        });
        return finalLanes;
    } else if (bars < 4) {
        const finalLanes = createEmptyLanes(totalSteps);
        Object.keys(lanes).forEach(laneId => {
            finalLanes[laneId].pitch = lanes[laneId].pitch;
            finalLanes[laneId].pattern = lanes[laneId].pattern.slice(0, totalSteps);
            finalLanes[laneId].velocity = lanes[laneId].velocity.slice(0, totalSteps);
            finalLanes[laneId].duration = lanes[laneId].duration.slice(0, totalSteps);
        });
        return finalLanes;
    }

    return lanes;
};

export const getLanes = () => DRUM_LANES;
