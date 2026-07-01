/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Freally Pattern Engine Expansion
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Extends the melody and bass generation engines in PatternEngine.js with:
 *   - 20 new contour functions
 *   - 15 genre-specific interval weight tables
 *   - 41 new melody profiles
 *   - ~500 motif seeds across 15 genre categories
 *   - 30 new bass style functions
 *   - ~200 bass motif seeds across 10 categories
 *   - A merge function to fold everything into the main engine
 *
 * Import and call mergePatternEngineExpansion() at startup to activate.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── Local Utilities ─────────────────────────────────────────────────────────
// Standalone versions so this module has no import dependency on PatternEngine.

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const coinFlip = (p = 0.5) => Math.random() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const weighted = choices => {
    const total = choices.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [val, w] of choices) { r -= w; if (r <= 0) return val; }
    return choices[choices.length - 1][0];
};


// ═══════════════════════════════════════════════════════════════════════════════
// §1  CONTOURS_EXPANSION  (20 new contour functions)
// ═══════════════════════════════════════════════════════════════════════════════
// Each function maps t ∈ [0, 1] → pitch bias ∈ [-1, 1].

export const CONTOURS_EXPANSION = {

    /** Two overlapping arches — peaks at ~0.25 and ~0.75 */
    'double-arch': t => Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI),

    /** Three full oscillations */
    'triple-wave': t => Math.sin(t * Math.PI * 3),

    /** Quick rise then sustained hold */
    'ramp-hold': t => t < 0.2 ? t * 5 : 1,

    /** Drop then gradual recovery */
    'fall-recover': t => t < 0.3 ? 1 - t * 3.33 : -1 + (t - 0.3) * (2 / 0.7),

    /** Sharp back-and-forth — 4 segments */
    'zigzag': t => {
        const seg = Math.floor(t * 4);
        const local = (t * 4) - seg;
        return seg % 2 === 0 ? local * 2 - 1 : 1 - local * 2;
    },

    /** Exponential curve — slow start, rapid end */
    'exponential-rise': t => Math.pow(t, 2.5) * 2 - 1,

    /** Inverse exponential — fast start, tapers */
    'logarithmic-fall': t => 1 - Math.pow(t, 0.4) * 2,

    /** Two full sine cycles */
    'sinusoidal-2x': t => Math.sin(t * Math.PI * 4),

    /** Three full sine cycles */
    'sinusoidal-3x': t => Math.sin(t * Math.PI * 6),

    /** Linear triangle wave — up then down, sharper than arch */
    'triangle': t => t < 0.5 ? t * 4 - 1 : 3 - t * 4,

    /** Linear rise then instant drop */
    'sawtooth': t => t * 2 - 1,

    /** Instant rise then linear fall */
    'reverse-sawtooth': t => 1 - t * 2,

    /** Three ascending plateaus */
    'step-up-3': t => t < 0.333 ? -0.66 : (t < 0.666 ? 0 : 0.66),

    /** Three descending plateaus */
    'step-down-3': t => t < 0.333 ? 0.66 : (t < 0.666 ? 0 : -0.66),

    /** Deterministic pseudo-random walk (seeded from position) */
    'random-walk-seed': t => {
        const x = Math.sin(t * 127.1 + 311.7) * 43758.5453;
        return (x - Math.floor(x)) * 2 - 1;
    },

    /** Sharp peak then sustained hold at top */
    'peak-hold': t => t < 0.15 ? t * 6.66 : (t < 0.85 ? 1 : (1 - t) * 6.66),

    /** Dip to valley then sustained hold at bottom */
    'valley-hold': t => t < 0.15 ? -t * 6.66 : (t < 0.85 ? -1 : -(1 - t) * 6.66),

    /** Smooth increase in intensity */
    'crescendo': t => -1 + t * 2,

    /** Smooth decrease in intensity */
    'decrescendo': t => 1 - t * 2,

    /** Gaussian bell shape — narrow peak at center */
    'bell-curve': t => {
        const x = (t - 0.5) * 4;
        return Math.exp(-x * x) * 2 - 1;
    }
};


// ═══════════════════════════════════════════════════════════════════════════════
// §2  GENRE_INTERVAL_WEIGHTS  (15 genre-specific tables)
// ═══════════════════════════════════════════════════════════════════════════════
// Keys = semitone interval, values = selection weight.
// Higher weight = that interval appears more often in melodies.

export const GENRE_INTERVAL_WEIGHTS = {

    blues: {
        0: 1.5, 1: 2.0, 2: 3.0, 3: 4.5, 4: 1.5,
        5: 2.0, 7: 2.5, 10: 3.0, 12: 1.0
    },

    jazz: {
        0: 1.0, 1: 3.5, 2: 4.0, 3: 3.5, 4: 3.0,
        5: 2.5, 6: 2.0, 7: 2.0, 9: 1.5, 10: 2.0,
        11: 1.5, 12: 1.0
    },

    trap: {
        0: 2.5, 1: 1.5, 2: 2.0, 3: 3.5, 4: 1.0,
        5: 2.5, 7: 3.0, 10: 2.0, 12: 1.5
    },

    metal: {
        0: 2.0, 1: 3.5, 2: 3.0, 3: 2.5, 4: 1.5,
        5: 3.0, 6: 3.5, 7: 2.5, 12: 2.0
    },

    country: {
        0: 1.5, 2: 4.5, 3: 2.0, 4: 3.5, 5: 3.0,
        7: 3.5, 9: 1.5, 12: 1.0
    },

    celtic: {
        0: 1.0, 2: 4.0, 3: 3.0, 5: 4.5, 7: 4.0,
        9: 2.0, 12: 1.5
    },

    flamenco: {
        0: 1.5, 1: 4.5, 2: 3.0, 3: 3.5, 4: 2.5,
        5: 2.0, 7: 2.5, 8: 2.0, 12: 1.0
    },

    kpop: {
        0: 1.5, 1: 2.0, 2: 4.0, 3: 3.0, 4: 3.5,
        5: 2.5, 7: 3.0, 12: 1.5
    },

    ambient: {
        0: 3.0, 2: 2.5, 3: 2.0, 4: 2.5, 5: 3.0,
        7: 4.0, 9: 2.0, 12: 3.0
    },

    classical: {
        0: 1.5, 1: 2.5, 2: 4.5, 3: 3.0, 4: 3.5,
        5: 3.0, 7: 3.5, 9: 1.5, 12: 1.5
    },

    funk: {
        0: 2.0, 1: 2.0, 2: 3.0, 3: 3.5, 4: 2.5,
        5: 3.0, 7: 3.5, 10: 2.5, 12: 1.0
    },

    reggae: {
        0: 2.5, 2: 3.0, 3: 3.5, 4: 2.0, 5: 3.0,
        7: 4.0, 10: 2.0, 12: 1.0
    },

    latin: {
        0: 1.5, 1: 2.0, 2: 3.5, 3: 3.0, 4: 3.5,
        5: 3.0, 7: 3.5, 9: 2.0, 12: 1.5
    },

    indian: {
        0: 2.0, 1: 4.0, 2: 3.5, 3: 3.0, 4: 3.5,
        5: 3.0, 6: 2.0, 7: 3.5, 8: 2.5, 11: 2.0, 12: 1.5
    },

    anime: {
        0: 1.5, 1: 2.0, 2: 4.0, 3: 3.5, 4: 4.0,
        5: 3.0, 7: 3.5, 9: 2.0, 12: 2.0
    }
};


// ═══════════════════════════════════════════════════════════════════════════════
// §3  MELODY_PROFILES_EXPANSION  (41 new profiles)
// ═══════════════════════════════════════════════════════════════════════════════

export const MELODY_PROFILES_EXPANSION = {

    country: {
        density: 0.5, stepGrid: 4, maxLeap: 5,
        restProb: 0.25, contours: ['arch', 'ascending']
    },
    blues: {
        density: 0.45, stepGrid: 4, maxLeap: 4,
        restProb: 0.3, contours: ['valley', 'arch', 'wave']
    },
    gospel: {
        density: 0.55, stepGrid: 4, maxLeap: 7,
        restProb: 0.2, contours: ['ascending', 'arch']
    },
    kpop: {
        density: 0.6, stepGrid: 4, maxLeap: 7,
        restProb: 0.15, contours: ['arch', 'double-arch', 'ascending']
    },
    anime: {
        density: 0.6, stepGrid: 4, maxLeap: 7,
        restProb: 0.15, contours: ['arch', 'ascending', 'double-arch']
    },
    celtic: {
        density: 0.55, stepGrid: 4, maxLeap: 5,
        restProb: 0.2, contours: ['arch', 'wave', 'ascending']
    },
    flamenco: {
        density: 0.6, stepGrid: 2, maxLeap: 4,
        restProb: 0.15, contours: ['descending', 'zigzag', 'valley']
    },
    bossa: {
        density: 0.4, stepGrid: 4, maxLeap: 5,
        restProb: 0.3, contours: ['wave', 'arch', 'bell-curve']
    },
    'reggaeton-lead': {
        density: 0.5, stepGrid: 4, maxLeap: 4,
        restProb: 0.25, contours: ['static', 'wave', 'plateau']
    },
    'afrobeat-lead': {
        density: 0.55, stepGrid: 4, maxLeap: 5,
        restProb: 0.2, contours: ['wave', 'arch', 'zigzag']
    },
    amapiano: {
        density: 0.45, stepGrid: 4, maxLeap: 5,
        restProb: 0.3, contours: ['wave', 'arch', 'bell-curve']
    },
    dancehall: {
        density: 0.5, stepGrid: 4, maxLeap: 4,
        restProb: 0.25, contours: ['static', 'wave', 'plateau']
    },
    shoegaze: {
        density: 0.3, stepGrid: 8, maxLeap: 5,
        restProb: 0.4, contours: ['wave', 'bell-curve', 'static']
    },
    grunge: {
        density: 0.5, stepGrid: 4, maxLeap: 5,
        restProb: 0.25, contours: ['descending', 'valley', 'zigzag']
    },
    metalcore: {
        density: 0.6, stepGrid: 2, maxLeap: 7,
        restProb: 0.15, contours: ['descending', 'zigzag', 'valley']
    },
    neosoul: {
        density: 0.45, stepGrid: 4, maxLeap: 5,
        restProb: 0.3, contours: ['arch', 'wave', 'bell-curve']
    },
    cloud: {
        density: 0.35, stepGrid: 8, maxLeap: 7,
        restProb: 0.35, contours: ['ascending', 'bell-curve', 'wave']
    },
    phonk: {
        density: 0.45, stepGrid: 4, maxLeap: 4,
        restProb: 0.3, contours: ['descending', 'static', 'valley']
    },
    'drill-lead': {
        density: 0.5, stepGrid: 4, maxLeap: 4,
        restProb: 0.25, contours: ['descending', 'valley', 'static']
    },
    'lo-fi-lead': {
        density: 0.35, stepGrid: 8, maxLeap: 5,
        restProb: 0.35, contours: ['wave', 'arch', 'bell-curve']
    },
    vaporwave: {
        density: 0.3, stepGrid: 8, maxLeap: 5,
        restProb: 0.4, contours: ['wave', 'decrescendo', 'bell-curve']
    },
    'ambient-lead': {
        density: 0.2, stepGrid: 16, maxLeap: 7,
        restProb: 0.5, contours: ['bell-curve', 'wave', 'crescendo']
    },
    psytrance: {
        density: 0.6, stepGrid: 2, maxLeap: 3,
        restProb: 0.15, contours: ['sinusoidal-2x', 'zigzag', 'wave']
    },
    neurofunk: {
        density: 0.55, stepGrid: 2, maxLeap: 5,
        restProb: 0.2, contours: ['zigzag', 'descending', 'random-walk-seed']
    },
    'deep-house': {
        density: 0.4, stepGrid: 4, maxLeap: 5,
        restProb: 0.3, contours: ['wave', 'arch', 'plateau']
    },
    'tech-house': {
        density: 0.45, stepGrid: 4, maxLeap: 3,
        restProb: 0.3, contours: ['static', 'wave', 'zigzag']
    },
    'progressive-house': {
        density: 0.45, stepGrid: 4, maxLeap: 7,
        restProb: 0.25, contours: ['ascending', 'arch', 'crescendo']
    },
    'detroit-techno': {
        density: 0.5, stepGrid: 4, maxLeap: 5,
        restProb: 0.25, contours: ['wave', 'zigzag', 'static']
    },
    idm: {
        density: 0.45, stepGrid: 2, maxLeap: 9,
        restProb: 0.25, contours: ['random-walk-seed', 'zigzag', 'wave']
    },
    trailer: {
        density: 0.4, stepGrid: 8, maxLeap: 7,
        restProb: 0.25, contours: ['crescendo', 'ascending', 'arch']
    },
    horror: {
        density: 0.3, stepGrid: 8, maxLeap: 7,
        restProb: 0.4, contours: ['descending', 'valley-hold', 'random-walk-seed']
    },
    fantasy: {
        density: 0.45, stepGrid: 4, maxLeap: 7,
        restProb: 0.25, contours: ['arch', 'ascending', 'bell-curve']
    },
    'indie-pop': {
        density: 0.5, stepGrid: 4, maxLeap: 5,
        restProb: 0.25, contours: ['arch', 'wave', 'plateau']
    },
    'indie-rock': {
        density: 0.5, stepGrid: 4, maxLeap: 5,
        restProb: 0.2, contours: ['wave', 'arch', 'zigzag']
    },
    'post-punk': {
        density: 0.45, stepGrid: 4, maxLeap: 5,
        restProb: 0.25, contours: ['descending', 'static', 'zigzag']
    },
    'alt-rock': {
        density: 0.5, stepGrid: 4, maxLeap: 5,
        restProb: 0.2, contours: ['arch', 'wave', 'valley']
    },
    'progressive-rock': {
        density: 0.55, stepGrid: 4, maxLeap: 7,
        restProb: 0.2, contours: ['ascending', 'arch', 'zigzag']
    },
    'fusion-lead': {
        density: 0.6, stepGrid: 2, maxLeap: 7,
        restProb: 0.15, contours: ['arch', 'wave', 'double-arch']
    },
    'neo-jazz': {
        density: 0.55, stepGrid: 4, maxLeap: 7,
        restProb: 0.2, contours: ['arch', 'wave', 'bell-curve']
    },
    'afro-house': {
        density: 0.5, stepGrid: 4, maxLeap: 5,
        restProb: 0.2, contours: ['wave', 'arch', 'zigzag']
    },
    breakbeat: {
        density: 0.5, stepGrid: 4, maxLeap: 5,
        restProb: 0.25, contours: ['zigzag', 'wave', 'random-walk-seed']
    }
};


// ═══════════════════════════════════════════════════════════════════════════════
// §4  MOTIF_SEEDS  (~500 seeds across 15 genre categories)
// ═══════════════════════════════════════════════════════════════════════════════
// Each seed is an array of scale-degree offsets from root (0 = root).
// The Markov engine can pick a seed as a starting melodic cell.

export const MOTIF_SEEDS = {

    pop: [
        [0, 2, 4],           [0, 4, 7],           [0, -1, 0, 2],
        [0, 2, 4, 2],        [4, 2, 0],           [0, 0, 2, 4],
        [0, 4, 2, 0],        [0, 2, 0, -1, 0],    [2, 4, 5, 4],
        [0, 2, 4, 5, 4, 2],  [0, 1, 2, 4],        [4, 5, 4, 2, 0],
        [0, -2, 0, 2, 4],    [0, 2, 4, 7],        [7, 4, 2, 0],
        [0, 0, 4, 4, 2],     [2, 0, -1, 0],       [0, 4, 5, 4],
        [0, 2, 2, 4, 4],     [5, 4, 2, 0, -1],    [0, 2, 0, 4, 2],
        [0, -1, -2, 0],      [0, 4, 7, 4],        [2, 4, 2, 0, 2],
        [0, 0, 2, 0, -1],    [4, 2, 4, 5],        [0, 2, 4, 2, 0],
        [0, 5, 4, 2],        [0, -1, 0, 4],       [0, 2, 5, 4, 2],
        [7, 5, 4, 2, 0],     [0, 2, 4, 5, 7],     [0, 0, -1, 0, 2, 4]
    ],

    rock: [
        [0, 3, 5],           [0, 5, 7],           [0, 0, 3, 5, 7],
        [0, -2, 0, 3],       [7, 5, 3, 0],        [0, 3, 5, 3, 0],
        [0, 5, 3, 0, -2],    [0, 0, 5, 5, 3],     [3, 5, 7, 5],
        [0, 7, 5, 3],        [0, -2, -4, 0],      [0, 3, 7, 3],
        [5, 3, 0, 0],        [0, 0, 3, 5],        [0, 5, 7, 5, 3],
        [0, -2, 0, 5],       [3, 0, -2, 0],       [0, 3, 0, 5, 3],
        [0, 5, 5, 3, 0],     [7, 7, 5, 3, 0],     [0, -2, 3, 5],
        [0, 3, 5, 7, 5],     [5, 7, 5, 3, 0],     [0, 0, 7, 5],
        [0, 3, 3, 5, 7],     [0, -4, -2, 0, 3],   [0, 5, 0, 3],
        [3, 5, 3, 0, -2],    [0, 3, 7, 5, 3],     [0, 0, -2, 0, 5],
        [0, 7, 0, 5],        [0, 3, 5, 0],        [5, 3, 5, 7, 5]
    ],

    jazz: [
        [0, 2, 4, 6],        [0, 3, 5, 6],        [0, -1, 1, 2, 4],
        [0, 4, 6, 4, 2],     [6, 4, 2, 0],        [0, 1, 2, 3, 4],
        [0, 2, 4, 6, 5, 4],  [0, -2, -1, 0, 2],   [4, 6, 4, 2, 0],
        [0, 6, 4, 2],        [0, 1, 3, 5],        [2, 4, 6, 4],
        [0, -1, 0, 4, 6],    [0, 2, 6, 4],        [6, 5, 4, 2, 0],
        [0, 3, 6, 3],        [0, 4, 2, 6],        [0, 1, 2, 4, 6],
        [0, -2, 0, 1, 3],    [4, 2, 0, -1, 0],    [0, 2, 3, 5, 6],
        [0, 6, 5, 3, 2],     [0, 1, 4, 6],        [3, 5, 6, 4, 2],
        [0, 2, 4, 3, 2, 0],  [0, 4, 6, 7, 6],     [0, -1, 2, 4, 6],
        [6, 4, 3, 1, 0],     [0, 3, 4, 6, 4],     [0, 2, 5, 6, 4],
        [0, 1, 3, 4, 6],     [0, 6, 4, 1, 0],     [2, 3, 5, 6, 4, 2]
    ],

    blues: [
        [0, 3, 5],           [0, -1, 0, 3],       [0, 3, 4, 5],
        [0, 5, 3, 0],        [0, 3, 5, 6, 5],     [0, -2, 0, 3, 5],
        [5, 3, 0, -2],       [0, 3, 0, 5],        [0, 0, 3, 5, 3],
        [0, 5, 6, 5, 3],     [3, 5, 3, 0],        [0, -1, 0, 5],
        [0, 3, 5, 3, 0, -2], [0, 5, 3, 5],        [0, -2, -1, 0, 3],
        [5, 6, 5, 3, 0],     [0, 3, 6, 5],        [0, 0, 5, 3],
        [0, -2, 3, 5, 3],    [3, 0, -2, 0, 3],    [0, 5, 0, 3],
        [0, 3, 5, 7],        [0, -1, 3, 5],       [5, 3, 0, 3],
        [0, 3, 3, 5, 6],     [0, -2, 0, 5, 3],    [0, 5, 6, 7, 5],
        [3, 5, 7, 5, 3],     [0, 0, -1, 0, 3, 5], [0, 6, 5, 3, 0],
        [0, 3, 5, 0, -2],    [0, -1, 3, 0],       [5, 3, 5, 3, 0]
    ],

    hiphop: [
        [0, 3, 5],           [0, 0, 3, 0],        [0, -2, 0, 5],
        [0, 5, 3, 0],        [0, 3, 0, -2, 0],    [0, 0, 5, 3],
        [3, 5, 3, 0],        [0, -2, 3, 5],       [0, 0, 0, 3, 5],
        [5, 3, 0, -2, 0],    [0, 3, 5, 7],        [0, -2, -4, 0],
        [0, 5, 0, 0],        [0, 3, 0, 5, 3],     [0, -4, -2, 0, 3],
        [0, 3, 3, 0],        [0, 5, 5, 3, 0],     [0, 0, -2, 3],
        [3, 0, 0, -2],       [0, 5, 3, 5],        [0, -2, 0, 0, 3],
        [0, 3, 7, 5],        [0, 0, 3, 5, 3],     [5, 0, -2, 0],
        [0, -2, 3, 0, -2],   [0, 3, 0, 0, 5],     [0, 5, 7, 5, 3],
        [0, 0, -4, 0, 3],    [3, 5, 0, -2],       [0, -2, 0, 5, 3],
        [0, 3, 5, 3, 0],     [0, 0, 3, -2, 0],    [0, 5, 0, 3, 0]
    ],

    trap: [
        [0, -2, 0],          [0, 3, 0, -2],       [0, 0, 5, 3, 0],
        [0, -4, -2, 0],      [0, 3, 5, 0],        [0, 0, 0, 3],
        [0, -2, -4, 0, 3],   [0, 5, 0, -2],       [3, 0, -2, -4],
        [0, 3, 0, 0],        [0, -2, 3, 0],       [0, 5, 3, -2],
        [0, 0, -2, -4, 0],   [0, 3, 5, 3],        [0, -4, 0, 3],
        [5, 3, 0, -2, -4],   [0, 0, 3, 0, -2],    [0, -2, 0, 3, 5],
        [0, 3, -2, 0],       [0, 5, 5, 0],        [0, -4, -2, 3],
        [0, 3, 0, 5],        [0, 0, -4, 0],       [3, 0, 5, 3],
        [0, -2, -4, -2, 0],  [0, 3, 3, 0, -2],    [0, 5, 0, 0, 3],
        [0, -4, 0, -2, 0],   [0, 3, 5, 7, 5],     [0, 0, 3, -4],
        [0, -2, 0, -4, 0],   [0, 5, 3, 0, -4],    [0, 0, 0, -2, 3]
    ],

    edm: [
        [0, 4, 7],           [0, 0, 4, 7],        [0, 7, 4, 0],
        [0, 4, 0, 7],        [0, 2, 4, 7],        [7, 4, 2, 0],
        [0, 0, 0, 4],        [0, 4, 7, 4, 0],     [0, 7, 0, 4],
        [0, 2, 4, 0, 7],     [4, 7, 4, 0],        [0, 0, 7, 4],
        [0, 4, 2, 0, 7],     [0, 7, 7, 4, 0],     [0, 2, 0, 4, 7],
        [0, 4, 7, 9],        [0, 9, 7, 4],        [7, 0, 4, 7],
        [0, 0, 2, 4, 7],     [0, 4, 4, 7],        [0, 7, 4, 7],
        [0, 2, 7, 4],        [0, 4, 9, 7],        [4, 0, 7, 4],
        [0, 7, 9, 7, 4],     [0, 0, 4, 0, 7],     [0, 4, 7, 0],
        [0, 2, 4, 7, 4],     [0, 7, 4, 2],        [0, 0, 7, 0, 4],
        [0, 4, 7, 7, 4],     [0, 9, 7, 4, 0],     [0, 2, 7, 4, 0]
    ],

    rnb: [
        [0, 2, 4],           [0, 4, 5, 4],        [0, -1, 0, 2, 4],
        [0, 2, 4, 6],        [0, 4, 2, 0, -1],    [0, -1, 2, 4],
        [4, 2, 0, -1, 0],    [0, 2, 0, 4],        [0, 4, 6, 4],
        [0, -2, -1, 0, 2],   [2, 4, 5, 4, 2],     [0, 0, 4, 2],
        [0, 2, 4, 2, 0],     [0, 4, 5, 6, 4],     [0, -1, 0, 4, 2],
        [4, 6, 4, 2, 0],     [0, 2, 5, 4],        [0, -1, 2, 0],
        [0, 4, 2, 4, 5],     [0, 2, 4, 5, 2],     [0, -2, 0, 4],
        [0, 2, 6, 4, 2],     [0, 4, 0, 2],        [2, 0, -1, 0, 2],
        [0, 5, 4, 2, 0],     [0, -1, 0, 2, 5],    [0, 4, 5, 4, 2],
        [0, 2, 0, -1, 2],    [0, 6, 4, 2],        [0, -1, 4, 2, 0],
        [0, 2, 4, 6, 4],     [0, 4, 2, 5, 4],     [2, 4, 6, 4, 2, 0]
    ],

    metal: [
        [0, -1, 0],          [0, 5, 6, 5],        [0, -1, -3, -1, 0],
        [0, 6, 5, 0],        [0, -3, -1, 0, 5],   [0, 5, 0, -1],
        [0, -1, 5, 6],       [0, 0, -1, 0, 5],    [5, 6, 5, 0, -1],
        [0, -3, 0, 5],       [0, 6, 0, -1],       [0, 5, 6, 0],
        [0, -1, -3, 0],      [0, 5, 5, 6, 5],     [0, -3, -1, 5],
        [6, 5, 0, -1, -3],   [0, 0, 5, 6],        [0, -1, 0, -3, 0],
        [0, 5, -1, 0],       [0, 6, 5, 6, 0],     [0, -3, -1, 0, 6],
        [0, 5, 0, 6, 5],     [0, -1, -3, -1, 5],  [5, 0, -1, 0],
        [0, 6, 6, 5, 0],     [0, -3, 0, -1, 0],   [0, 5, 6, 7, 5],
        [0, -1, 5, 0, -3],   [0, 0, -3, 0, 5, 6], [0, 7, 6, 5, 0],
        [0, -1, 0, 5, 0],    [0, 5, 6, 5, 0, -1], [0, -3, 5, 0]
    ],

    country: [
        [0, 2, 4],           [0, 4, 5, 4],        [0, 2, 4, 5],
        [0, -1, 0, 2],       [4, 2, 0, -1],       [0, 2, 4, 7],
        [0, 4, 2, 0],        [0, 5, 4, 2],        [2, 4, 5, 4, 2],
        [0, 2, 0, 4],        [0, 4, 5, 7, 5],     [0, -2, 0, 2, 4],
        [4, 5, 4, 2, 0],     [0, 2, 5, 4],        [0, 7, 5, 4, 2],
        [0, 0, 2, 4, 5],     [0, 4, 7, 4],        [2, 0, -1, 0, 2],
        [0, 2, 4, 2, 0],     [0, 5, 4, 2, 0],     [0, -1, 2, 4],
        [0, 4, 5, 4, 2],     [0, 2, 7, 5],        [4, 2, 4, 5],
        [0, -1, 0, 4, 5],    [0, 2, 0, 5, 4],     [0, 4, 2, 5, 4],
        [5, 4, 2, 0],        [0, 2, 4, 5, 7],     [0, -2, -1, 0, 2],
        [0, 7, 4, 2],        [0, 2, 5, 7, 5],     [0, 4, 0, 2, 4]
    ],

    latin: [
        [0, 2, 4, 5],        [0, 4, 5, 7],        [0, -1, 0, 2, 4],
        [0, 2, 5, 4],        [5, 4, 2, 0],        [0, 4, 2, 5],
        [0, 7, 5, 4],        [0, 2, 0, 5],        [0, -2, 0, 4, 5],
        [4, 5, 7, 5, 4],     [0, 2, 4, 7],        [0, 5, 4, 2, 0],
        [0, -1, 2, 4, 5],    [0, 4, 5, 4, 2],     [7, 5, 4, 2, 0],
        [0, 2, 5, 7],        [0, 4, 0, 5],        [0, -2, 2, 4],
        [2, 4, 5, 4],        [0, 5, 7, 5],        [0, 0, 4, 5, 7],
        [0, 2, 4, 5, 4, 2],  [0, 7, 4, 5],        [0, -1, 4, 5],
        [5, 7, 5, 4, 2],     [0, 2, 0, 4, 7],     [0, 4, 7, 5],
        [0, 5, 2, 4],        [0, -2, 0, 2, 5],    [0, 4, 5, 7, 4],
        [0, 7, 5, 2, 0],     [0, 2, 4, 0, 5],     [2, 5, 4, 2, 0]
    ],

    celtic: [
        [0, 2, 4, 7],        [0, 4, 7, 9],        [0, -3, 0, 2],
        [7, 4, 2, 0],        [0, 2, 4, 2, 0],     [0, 4, 0, 7],
        [0, 9, 7, 4],        [0, 2, 7, 4],        [4, 7, 9, 7, 4],
        [0, -3, -1, 0, 2],   [0, 4, 7, 4, 2],     [0, 7, 9, 7],
        [0, 2, 0, 4, 7],     [0, -1, 0, 4],       [9, 7, 4, 2, 0],
        [0, 2, 4, 9, 7],     [0, 4, 2, 7],        [0, 7, 4, 0],
        [0, -3, 0, 4, 7],    [2, 4, 7, 4],        [0, 4, 9, 7, 4],
        [0, 7, 2, 4],        [0, 2, 4, 7, 9],     [0, -1, 2, 4],
        [4, 2, 0, -3, 0],    [0, 7, 0, 4, 2],     [0, 9, 7, 4, 2],
        [0, 2, 7, 9],        [0, 4, 7, 0, 2],     [0, -3, 2, 4, 7],
        [7, 9, 7, 4, 0],     [0, 2, 0, 7, 4],     [0, 4, 4, 7, 9]
    ],

    ambient: [
        [0, 7, 12],          [0, 4, 7, 12],       [0, 0, 7],
        [0, 12, 7, 0],       [0, 5, 7],           [0, 7, 5, 0],
        [0, 4, 12, 7],       [12, 7, 4, 0],       [0, 0, 4, 7],
        [0, 7, 0, 12],       [0, 5, 12, 7],       [0, 12, 0, 7],
        [0, 4, 0, 7],        [7, 12, 7, 0],       [0, 0, 12, 7],
        [0, 7, 4, 0, 7],     [0, 5, 0, 7],        [0, 12, 7, 4],
        [0, 7, 12, 7, 0],    [0, 4, 7, 0],        [0, 0, 5, 7, 12],
        [0, 12, 4, 7],       [0, 7, 12, 0],       [7, 4, 0, 7],
        [0, 5, 7, 12],       [0, 7, 7, 12],       [0, 4, 12, 0],
        [0, 0, 7, 12, 7],    [0, 12, 7, 5],       [0, 7, 5, 7, 12],
        [0, 4, 5, 7],        [0, 12, 0, 4, 7],    [7, 0, 12, 7, 0]
    ],

    funk: [
        [0, 3, 5, 3],        [0, -2, 0, 3, 5],    [0, 5, 3, 0, -2],
        [0, 3, 0, 5],        [0, -2, 3, 5, 7],    [5, 3, 0, -2, 0],
        [0, 3, 5, 0],        [0, 0, 3, 5, 3],     [0, -2, 0, 5, 3],
        [3, 5, 7, 5, 3],     [0, 5, 3, 5],        [0, -2, 3, 0],
        [0, 3, 7, 5],        [0, 5, 0, 3, 0],     [0, -2, -4, 0, 3],
        [0, 3, 5, 7, 5],     [0, 0, -2, 3, 5],    [5, 7, 5, 3, 0],
        [0, 3, 0, -2, 3],    [0, 5, 7, 5],        [0, -4, -2, 0, 5],
        [0, 3, 5, 3, 0],     [0, 7, 5, 3],        [3, 0, -2, 3],
        [0, -2, 0, 3, 0],    [0, 5, 3, 7, 5],     [0, 3, -2, 0, 3],
        [0, 7, 5, 0, 3],     [0, -2, 5, 3],       [0, 3, 5, 0, -2],
        [0, 0, 5, 3, 0],     [0, 3, 7, 5, 3],     [5, 3, 0, 3, 5]
    ],

    classical: [
        [0, 2, 4, 5],        [0, 4, 5, 7],        [0, -1, 0, 2],
        [7, 5, 4, 2, 0],     [0, 2, 4, 7],        [0, 4, 2, 0, -1],
        [0, 5, 4, 2],        [0, 2, 0, 4, 5],     [0, -2, -1, 0, 2],
        [4, 5, 7, 5, 4],     [0, 2, 5, 7],        [0, 7, 5, 4, 2],
        [0, -1, 2, 4, 5],    [0, 4, 7, 5],        [0, 2, 4, 5, 7],
        [5, 4, 2, 0, -1],    [0, 4, 5, 4, 2],     [0, -1, 0, 4, 7],
        [0, 2, 4, 2, 0],     [0, 7, 4, 2],        [0, 5, 7, 5, 4],
        [0, -2, 0, 2, 4],    [2, 4, 5, 7, 5],     [0, 4, 0, 5, 7],
        [0, 2, 7, 5, 4],     [0, -1, 4, 5, 7],    [0, 5, 2, 4],
        [7, 5, 2, 0],        [0, 4, 5, 7, 5, 4],  [0, 2, 0, -1, 0, 2],
        [0, 7, 5, 0, 2],     [0, -1, 2, 0, 4],    [4, 2, 0, 2, 4, 5]
    ]
};


// ═══════════════════════════════════════════════════════════════════════════════
// §5  BASS_STYLES_EXPANSION  (30 new bass style functions)
// ═══════════════════════════════════════════════════════════════════════════════
// Each takes (startTime, duration, chordRoot, scale, density) → notes[]

export const BASS_STYLES_EXPANSION = {

    /** Reggae one-drop — emphasis on beat 3, space on beat 1 */
    'reggae-one-drop': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        for (let t = 0; t < duration; t += barLen) {
            // Skip beat 1 (the "drop"), hit beat 3 hard
            if (t + 16 < duration) {
                notes.push({
                    time: startTime + t + 16, duration: 12,
                    note: chordRoot, velocity: 0.9
                });
            }
            // Optional pickup on & of 4
            if (t + 28 < duration && coinFlip(density * 0.5)) {
                notes.push({
                    time: startTime + t + 28, duration: 4,
                    note: chordRoot + (scale[4] || 7), velocity: 0.6
                });
            }
        }
        return notes;
    },

    /** Reggae steppers — steady four-on-the-floor bass */
    'reggae-steppers': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8;
        for (let t = 0; t < duration; t += stepSize) {
            const beat = Math.floor(t / stepSize) % 4;
            let pitch = chordRoot;
            if (beat === 2 && coinFlip(0.35)) pitch = chordRoot + (scale[4] || 7);
            notes.push({
                time: startTime + t, duration: stepSize * 0.85,
                note: pitch,
                velocity: beat === 0 ? 0.85 : (beat === 2 ? 0.8 : 0.7)
            });
        }
        return notes;
    },

    /** Dancehall — syncopated with heavy bass drops */
    dancehall: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        const pattern = [0, 6, 12, 20, 28]; // syncopated hits within bar
        for (let t = 0; t < duration; t += barLen) {
            for (const pos of pattern) {
                if (t + pos >= duration) break;
                if (!coinFlip(density * 0.75)) continue;
                const isAccent = (pos === 0 || pos === 12);
                notes.push({
                    time: startTime + t + pos,
                    duration: isAccent ? 8 : 4,
                    note: chordRoot + (pos === 20 ? (scale[4] || 7) : 0),
                    velocity: isAccent ? 0.9 : 0.7
                });
            }
        }
        return notes;
    },

    /** Reggaeton dembow — the characteristic boom-ch-boom-chick pattern */
    'reggaeton-dembow': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        for (let t = 0; t < duration; t += barLen) {
            // Boom on 1
            notes.push({
                time: startTime + t, duration: 6,
                note: chordRoot, velocity: 0.9
            });
            // & of 1 (light)
            if (t + 4 < duration && coinFlip(density * 0.6)) {
                notes.push({
                    time: startTime + t + 4, duration: 3,
                    note: chordRoot, velocity: 0.5
                });
            }
            // Boom on & of 2
            if (t + 12 < duration) {
                notes.push({
                    time: startTime + t + 12, duration: 6,
                    note: chordRoot, velocity: 0.85
                });
            }
            // Beat 3 — octave up
            if (t + 16 < duration) {
                notes.push({
                    time: startTime + t + 16, duration: 6,
                    note: chordRoot + 12, velocity: 0.8
                });
            }
            // & of 4 pickup
            if (t + 28 < duration && coinFlip(density * 0.5)) {
                notes.push({
                    time: startTime + t + 28, duration: 4,
                    note: chordRoot + (scale[4] || 7), velocity: 0.65
                });
            }
        }
        return notes;
    },

    /** Afrobeat — polyrhythmic bass with call-and-response feel */
    afrobeat: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        // 12/8 feel mapped to 32 steps: groups of ~10.67, approximated
        const positions = [0, 6, 10, 16, 22, 26]; // 12/8-ish
        for (let t = 0; t < duration; t += barLen) {
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                if (t + pos >= duration) break;
                if (!coinFlip(density * 0.8)) continue;
                const isRoot = (i === 0 || i === 3);
                const pitch = isRoot ? chordRoot :
                    chordRoot + pick([0, scale[2] || 3, scale[4] || 7]);
                notes.push({
                    time: startTime + t + pos,
                    duration: isRoot ? 6 : 4,
                    note: pitch,
                    velocity: isRoot ? 0.85 : 0.65 + Math.random() * 0.1
                });
            }
        }
        return notes;
    },

    /** Amapiano — log drum-style bouncy bass */
    amapiano: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        // Characteristic bounce: syncopated with quick release
        const positions = [0, 6, 12, 14, 20, 24, 28];
        for (let t = 0; t < duration; t += barLen) {
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                if (t + pos >= duration) break;
                if (!coinFlip(density * 0.7)) continue;
                const pitch = (i === 0 || i === 4) ? chordRoot :
                    (i === 2 || i === 5) ? chordRoot + (scale[4] || 7) :
                    chordRoot + (scale[2] || 3);
                notes.push({
                    time: startTime + t + pos,
                    duration: (i === 0 || i === 4) ? 5 : 3,
                    note: pitch,
                    velocity: (i === 0) ? 0.85 : 0.65 + Math.random() * 0.15
                });
            }
        }
        return notes;
    },

    /** Blues shuffle — triplet-feel walking on root-3rd-5th */
    'blues-shuffle': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const beatLen = 8;
        // Shuffle = long-short within each beat (5+3 steps approx swing)
        for (let t = 0; t < duration; t += beatLen) {
            const beat = Math.floor(t / beatLen) % 4;
            let pitch = chordRoot;
            // Root on 1 & 3, movement on 2 & 4
            if (beat === 1) pitch = chordRoot + (scale[2] || 3);
            if (beat === 3) pitch = chordRoot + (scale[4] || 7);

            // Long note (shuffle front)
            notes.push({
                time: startTime + t, duration: 5,
                note: pitch, velocity: 0.8 + (beat === 0 ? 0.1 : 0)
            });
            // Short note (shuffle back) — chromatic approach
            if (coinFlip(density * 0.7)) {
                const approach = pitch + pick([-1, 1, 2]);
                notes.push({
                    time: startTime + t + 5, duration: 3,
                    note: approach, velocity: 0.6
                });
            }
        }
        return notes;
    },

    /** Country two-step — alternating root-fifth pattern */
    'country-two-step': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8;
        for (let t = 0; t < duration; t += stepSize) {
            const beat = Math.floor(t / stepSize) % 4;
            let pitch;
            switch (beat) {
                case 0: pitch = chordRoot; break;
                case 1: pitch = chordRoot + (scale[4] || 7); break;
                case 2: pitch = chordRoot + 12; break;
                case 3: pitch = chordRoot + (scale[4] || 7); break;
                default: pitch = chordRoot;
            }
            notes.push({
                time: startTime + t, duration: stepSize * 0.85,
                note: pitch,
                velocity: (beat === 0 || beat === 2) ? 0.85 : 0.7
            });
        }
        return notes;
    },

    /** Metal gallop — triplet-style galloping rhythm */
    'metal-gallop': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        // Gallop pattern: DA-da-da (long-short-short), repeated
        for (let t = 0; t < duration; t += barLen) {
            for (let b = 0; b < 4; b++) {
                const beatStart = b * 8;
                if (t + beatStart >= duration) break;
                // Long note
                notes.push({
                    time: startTime + t + beatStart, duration: 4,
                    note: chordRoot, velocity: 0.9
                });
                // Two quick notes
                if (t + beatStart + 4 < duration) {
                    notes.push({
                        time: startTime + t + beatStart + 4, duration: 2,
                        note: chordRoot, velocity: 0.7
                    });
                }
                if (t + beatStart + 6 < duration) {
                    notes.push({
                        time: startTime + t + beatStart + 6, duration: 2,
                        note: chordRoot + (coinFlip(0.3) ? (scale[4] || 7) : 0),
                        velocity: 0.65
                    });
                }
            }
        }
        return notes;
    },

    /** Metal chug — palm-muted rapid 16ths on root */
    'metal-chug': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 2; // 16th notes
        for (let t = 0; t < duration; t += stepSize) {
            if (!coinFlip(density * 0.9)) continue;
            const isAccent = (t % 8 === 0);
            notes.push({
                time: startTime + t, duration: 2,
                note: chordRoot + (isAccent && coinFlip(0.2) ? -12 : 0),
                velocity: isAccent ? 0.9 : 0.65 + Math.random() * 0.1
            });
        }
        return notes;
    },

    /** Punk — fast driving 8ths with root-fifth */
    punk: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 4; // fast 8ths
        for (let t = 0; t < duration; t += stepSize) {
            const beat = Math.floor(t / 8) % 4;
            let pitch = chordRoot;
            if (beat === 2) pitch = chordRoot + (scale[4] || 7);
            if (beat === 3 && coinFlip(0.4)) pitch = chordRoot + 12;
            notes.push({
                time: startTime + t, duration: stepSize * 0.85,
                note: pitch, velocity: 0.8
            });
        }
        return notes;
    },

    /** Gospel — walking with chromatic approaches and grace notes */
    gospel: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8;
        const chordTones = [0, scale[2] || 3, scale[4] || 7];
        for (let t = 0; t < duration; t += stepSize) {
            const beat = Math.floor(t / stepSize) % 4;
            let interval;
            switch (beat) {
                case 0: interval = 0; break;
                case 1: interval = pick(chordTones); break;
                case 2: interval = scale[4] || 7; break;
                case 3: // Chromatic approach to next root
                    interval = pick([-1, 1, -2, 11]);
                    break;
                default: interval = 0;
            }
            notes.push({
                time: startTime + t, duration: stepSize * 0.85,
                note: chordRoot + interval,
                velocity: 0.75 + (beat === 0 ? 0.1 : Math.random() * 0.1)
            });
            // Grace note before strong beats
            if ((beat === 3) && coinFlip(density * 0.4) && t + stepSize - 2 < duration) {
                notes.push({
                    time: startTime + t + stepSize - 2, duration: 2,
                    note: chordRoot + interval + pick([-1, 1]),
                    velocity: 0.55
                });
            }
        }
        return notes;
    },

    /** Bossa nova — characteristic syncopated two-bar pattern */
    'bossa-nova': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        // Classic bossa bass: dotted quarter feel
        const pattern2bar = [0, 10, 16, 22, 32, 38, 48, 54];
        const twoBar = barLen * 2;
        for (let t = 0; t < duration; t += twoBar) {
            for (const pos of pattern2bar) {
                if (t + pos >= duration) break;
                if (pos >= twoBar) break;
                const isRoot = (pos === 0 || pos === 32);
                const pitch = isRoot ? chordRoot :
                    chordRoot + pick([0, scale[4] || 7, scale[2] || 3]);
                notes.push({
                    time: startTime + t + pos,
                    duration: 6,
                    note: pitch,
                    velocity: isRoot ? 0.8 : 0.65
                });
            }
        }
        return notes;
    },

    /** Samba — driving, energetic syncopation */
    samba: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        const positions = [0, 4, 10, 16, 20, 26];
        for (let t = 0; t < duration; t += barLen) {
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                if (t + pos >= duration) break;
                if (!coinFlip(density * 0.85)) continue;
                const isDown = (i === 0 || i === 3);
                const pitch = isDown ? chordRoot :
                    chordRoot + pick([0, scale[4] || 7]);
                notes.push({
                    time: startTime + t + pos,
                    duration: isDown ? 4 : 3,
                    note: pitch,
                    velocity: isDown ? 0.85 : 0.65 + Math.random() * 0.1
                });
            }
        }
        return notes;
    },

    /** Flamenco — rhythmic with Phrygian tendency and fast runs */
    flamenco: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        for (let t = 0; t < duration; t += barLen) {
            // Strong attack on 1
            notes.push({
                time: startTime + t, duration: 8,
                note: chordRoot, velocity: 0.9
            });
            // Rapid scalar run at end of bar
            if (t + 24 < duration && coinFlip(density * 0.6)) {
                const runStart = t + 24;
                for (let r = 0; r < 4; r++) {
                    if (runStart + r * 2 >= duration) break;
                    const degree = r;
                    notes.push({
                        time: startTime + runStart + r * 2, duration: 2,
                        note: chordRoot + (scale[degree] || degree),
                        velocity: 0.6 + r * 0.05
                    });
                }
            }
            // Beat 3
            if (t + 16 < duration) {
                notes.push({
                    time: startTime + t + 16, duration: 6,
                    note: chordRoot + (scale[4] || 7), velocity: 0.75
                });
            }
        }
        return notes;
    },

    /** K-pop — bouncy, melodic bass with octave jumps */
    kpop: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 4;
        const bassPattern = [0, 0, 12, 0, scale[4] || 7, 0, 12, scale[2] || 3];
        for (let t = 0; t < duration; t += stepSize) {
            const idx = Math.floor(t / stepSize) % bassPattern.length;
            if (!coinFlip(density * 0.85)) continue;
            notes.push({
                time: startTime + t, duration: stepSize * 0.8,
                note: chordRoot + bassPattern[idx],
                velocity: (t % 8 === 0) ? 0.85 : 0.7
            });
        }
        return notes;
    },

    /** Drill 808 — sliding 808 with pitch bends */
    'drill-808': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        // Primary hit
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.7),
            note: chordRoot, velocity: 0.9
        });
        // Characteristic slide up
        if (duration >= 16 && coinFlip(0.6)) {
            const slideStart = startTime + Math.floor(duration * 0.3);
            notes.push({
                time: slideStart, duration: 4,
                note: chordRoot + pick([3, 5, 7]), velocity: 0.75
            });
        }
        // Late hit
        if (duration >= 24 && coinFlip(density * 0.4)) {
            notes.push({
                time: startTime + Math.floor(duration * 0.75), duration: 6,
                note: chordRoot - 12, velocity: 0.8
            });
        }
        return notes;
    },

    /** Phonk bounce — Memphis-inspired bouncy bass */
    'phonk-bounce': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        // Bounce: emphasis on beats 1 and 3 with quick off-beat stabs
        for (let t = 0; t < duration; t += barLen) {
            // Beat 1 — heavy
            notes.push({
                time: startTime + t, duration: 6,
                note: chordRoot, velocity: 0.9
            });
            // & of 1
            if (t + 4 < duration && coinFlip(density * 0.5)) {
                notes.push({
                    time: startTime + t + 4, duration: 3,
                    note: chordRoot + 12, velocity: 0.55
                });
            }
            // Beat 2 — lighter
            if (t + 8 < duration && coinFlip(density * 0.6)) {
                notes.push({
                    time: startTime + t + 8, duration: 4,
                    note: chordRoot + (scale[3] || 5), velocity: 0.65
                });
            }
            // Beat 3 — heavy
            if (t + 16 < duration) {
                notes.push({
                    time: startTime + t + 16, duration: 6,
                    note: chordRoot, velocity: 0.85
                });
            }
            // & of 3
            if (t + 20 < duration && coinFlip(density * 0.5)) {
                notes.push({
                    time: startTime + t + 20, duration: 3,
                    note: chordRoot + 12, velocity: 0.5
                });
            }
            // & of 4 pickup
            if (t + 28 < duration && coinFlip(density * 0.4)) {
                notes.push({
                    time: startTime + t + 28, duration: 4,
                    note: chordRoot + (scale[4] || 7), velocity: 0.6
                });
            }
        }
        return notes;
    },

    /** Cloud rap — dreamy, sparse bass with long sustain */
    'cloud-rap': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        notes.push({
            time: startTime, duration: Math.floor(duration * 0.9),
            note: chordRoot, velocity: 0.7
        });
        // Soft harmonic shimmer
        if (duration >= 24 && coinFlip(0.35)) {
            notes.push({
                time: startTime + Math.floor(duration * 0.6),
                duration: Math.floor(duration * 0.3),
                note: chordRoot + (scale[4] || 7), velocity: 0.45
            });
        }
        return notes;
    },

    /** Vaporwave bass — slowed down, pitched low, dreamy */
    'vaporwave-bass': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 16; // very slow movement
        for (let t = 0; t < duration; t += stepSize) {
            const pitch = coinFlip(0.6) ? chordRoot :
                chordRoot + pick([scale[2] || 3, scale[4] || 7, 0]);
            notes.push({
                time: startTime + t, duration: stepSize * 0.9,
                note: pitch, velocity: 0.55 + Math.random() * 0.1
            });
        }
        return notes;
    },

    /** Shoegaze drone — layered, sustained, washy */
    'shoegaze-drone': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        // Long root drone
        notes.push({
            time: startTime, duration: duration,
            note: chordRoot, velocity: 0.6
        });
        // Subtle 5th layer
        if (coinFlip(0.5)) {
            notes.push({
                time: startTime, duration: duration,
                note: chordRoot + (scale[4] || 7), velocity: 0.35
            });
        }
        return notes;
    },

    /** Post-punk bass — melodic, high-register, driving */
    'post-punk-bass': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 4;
        // Characteristic melodic movement in upper register
        const intervals = [0, 2, 4, 5, 4, 2, 0, -1];
        for (let t = 0; t < duration; t += stepSize) {
            const idx = Math.floor(t / stepSize) % intervals.length;
            if (!coinFlip(density * 0.85)) continue;
            const degree = intervals[idx];
            const semitones = degree >= 0 ?
                (scale[degree] || degree) :
                -(scale[Math.abs(degree)] || Math.abs(degree));
            notes.push({
                time: startTime + t, duration: stepSize * 0.9,
                note: chordRoot + 12 + semitones, // upper register
                velocity: (t % 8 === 0) ? 0.8 : 0.65
            });
        }
        return notes;
    },

    /** Progressive rock — complex patterns with odd subdivisions */
    'prog-rock': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        // Mix quarter notes and dotted quarters for asymmetric feel
        const pattern = [8, 8, 12, 8, 12, 8, 8]; // sums to ~64 (two bars)
        let t = 0;
        let patIdx = 0;
        while (t < duration) {
            const len = pattern[patIdx % pattern.length];
            const beat = patIdx % 4;
            let pitch = chordRoot;
            if (beat === 1) pitch = chordRoot + (scale[2] || 3);
            if (beat === 2) pitch = chordRoot + (scale[4] || 7);
            if (beat === 3) pitch = chordRoot + pick([0, scale[3] || 5, 12]);
            notes.push({
                time: startTime + t,
                duration: Math.min(len * 0.85, duration - t),
                note: pitch,
                velocity: 0.75 + (beat === 0 ? 0.1 : 0)
            });
            t += len;
            patIdx++;
        }
        return notes;
    },

    /** Indie — melodic with movement, mid-velocity */
    indie: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8;
        const scaleLen = scale.length;
        let degree = 0;
        for (let t = 0; t < duration; t += stepSize) {
            // Gentle stepwise movement
            degree += pick([-1, 0, 1, 1, 2]);
            degree = clamp(degree, -3, scaleLen);
            const semitones = degree >= 0 ?
                (scale[degree % scaleLen] || 0) + Math.floor(degree / scaleLen) * 12 :
                -(scale[((-degree) % scaleLen)] || Math.abs(degree));
            notes.push({
                time: startTime + t, duration: stepSize * 0.9,
                note: chordRoot + semitones,
                velocity: 0.65 + Math.random() * 0.15
            });
        }
        return notes;
    },

    /** Neo-soul — chromatic passing tones, smooth groove */
    neosoul: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8;
        const chordTones = [0, scale[2] || 3, scale[4] || 7];
        for (let t = 0; t < duration; t += stepSize) {
            const beat = Math.floor(t / stepSize) % 4;
            let interval;
            if (beat === 0) {
                interval = 0; // root
            } else if (beat === 1) {
                interval = pick(chordTones);
            } else if (beat === 2) {
                interval = scale[4] || 7;
            } else {
                // Chromatic approach — signature neo-soul
                interval = pick([-1, 1, scale[6] || 11, -2]);
            }
            notes.push({
                time: startTime + t, duration: stepSize * 0.85,
                note: chordRoot + interval,
                velocity: 0.7 + (beat === 0 ? 0.1 : Math.random() * 0.1)
            });
            // Ghost note on off-beats
            if (coinFlip(density * 0.3) && t + 4 < duration) {
                notes.push({
                    time: startTime + t + 4, duration: 3,
                    note: chordRoot + pick(chordTones), velocity: 0.4
                });
            }
        }
        return notes;
    },

    /** Trance rolling — arpeggiated 16ths building tension */
    'trance-rolling': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 4;
        const arpPattern = [0, scale[4] || 7, 12, scale[4] || 7];
        for (let t = 0; t < duration; t += stepSize) {
            const idx = Math.floor(t / stepSize) % arpPattern.length;
            if (!coinFlip(density * 0.9)) continue;
            notes.push({
                time: startTime + t, duration: stepSize * 0.8,
                note: chordRoot + arpPattern[idx],
                velocity: 0.7 + (t % 8 === 0 ? 0.1 : 0)
            });
        }
        return notes;
    },

    /** Hardstyle — distorted kick-following bass with reverse tail */
    hardstyle: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 8; // quarter notes
        for (let t = 0; t < duration; t += stepSize) {
            // Main hit
            notes.push({
                time: startTime + t, duration: 4,
                note: chordRoot, velocity: 0.95
            });
            // Reverse bass tail
            if (coinFlip(density * 0.7) && t + 4 < duration) {
                notes.push({
                    time: startTime + t + 4, duration: 4,
                    note: chordRoot + pick([0, -12]),
                    velocity: 0.6
                });
            }
        }
        return notes;
    },

    /** Breakbeat bass — syncopated, funky, groove-oriented */
    'breakbeat-bass': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        // Breakbeat: hits that follow a broken beat pattern
        const positions = [0, 6, 12, 18, 22, 28];
        for (let t = 0; t < duration; t += barLen) {
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                if (t + pos >= duration) break;
                if (!coinFlip(density * 0.75)) continue;
                const isStrong = (i === 0 || i === 2);
                notes.push({
                    time: startTime + t + pos,
                    duration: isStrong ? 6 : 4,
                    note: chordRoot + (isStrong ? 0 : pick([0, scale[4] || 7])),
                    velocity: isStrong ? 0.85 : 0.65 + Math.random() * 0.1
                });
            }
        }
        return notes;
    },

    /** Jungle — fast broken bass with sub drops */
    jungle: (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const barLen = 32;
        for (let t = 0; t < duration; t += barLen) {
            // Sub drop on 1
            notes.push({
                time: startTime + t, duration: 12,
                note: chordRoot - 12, velocity: 0.9
            });
            // Rapid stabs in second half
            if (t + 16 < duration && coinFlip(density * 0.7)) {
                for (let r = 16; r < 28; r += 4) {
                    if (t + r >= duration) break;
                    if (!coinFlip(density * 0.6)) continue;
                    notes.push({
                        time: startTime + t + r, duration: 3,
                        note: chordRoot + pick([0, scale[4] || 7, scale[2] || 3]),
                        velocity: 0.7 + Math.random() * 0.1
                    });
                }
            }
            // Pickup stab
            if (t + 28 < duration && coinFlip(density * 0.5)) {
                notes.push({
                    time: startTime + t + 28, duration: 4,
                    note: chordRoot + pick([-1, 1, scale[6] || 11]),
                    velocity: 0.65
                });
            }
        }
        return notes;
    },

    /** Neurofunk bass — aggressive, modulated, complex rhythm */
    'neurofunk-bass': (startTime, duration, chordRoot, scale, density) => {
        const notes = [];
        const stepSize = 2; // fast 32nd note resolution
        let prevPitch = chordRoot;
        for (let t = 0; t < duration; t += stepSize) {
            if (!coinFlip(density * 0.55)) continue;
            // Neurofunk: rapid pitch variation simulating modulated bass
            const variation = pick([0, 0, 1, -1, scale[2] || 3, -(scale[2] || 3), scale[4] || 7]);
            const pitch = chordRoot + variation;
            // Avoid too many repeated notes
            if (pitch === prevPitch && coinFlip(0.4)) continue;
            notes.push({
                time: startTime + t,
                duration: stepSize + (coinFlip(0.3) ? stepSize : 0),
                note: pitch,
                velocity: 0.7 + Math.random() * 0.2
            });
            prevPitch = pitch;
        }
        return notes;
    }
};


// ═══════════════════════════════════════════════════════════════════════════════
// §6  BASS_MOTIF_SEEDS  (~200 seeds across 10 categories)
// ═══════════════════════════════════════════════════════════════════════════════
// Root-relative offset patterns for basslines.
// Values are scale-degree offsets (0 = root, positive = up, negative = down).

export const BASS_MOTIF_SEEDS = {

    walking: [
        [0, 2, 4, 5],        [0, 3, 5, 7],        [0, 1, 2, 4],
        [0, 4, 5, 6],        [0, 2, 4, 7],        [0, -1, 0, 2],
        [0, 3, 4, 5],        [0, 2, 5, 7],        [0, 4, 2, 0],
        [0, 1, 3, 5],        [0, 5, 4, 2],        [0, 3, 5, 4],
        [0, 2, 0, -1],       [0, 4, 7, 5],        [0, -2, -1, 0],
        [0, 1, 4, 5],        [0, 5, 3, 2],        [0, 2, 4, 6],
        [0, 3, 2, 0],        [0, 7, 5, 4]
    ],

    groove: [
        [0, 0, 3, 0],        [0, 3, 0, 5],        [0, 0, 0, 3],
        [0, 5, 3, 0],        [0, 0, 5, 0],        [0, 3, 5, 3],
        [0, 0, 3, 5],        [0, 5, 0, 3],        [0, 3, 0, 0],
        [0, 0, 5, 3],        [0, 5, 5, 0],        [0, 3, 3, 0],
        [0, 0, 0, 5],        [0, 5, 3, 5],        [0, 3, 5, 0],
        [0, 0, 3, 3],        [0, 5, 0, 0],        [0, 3, 0, 3],
        [0, 0, 5, 5],        [0, 5, 3, 3]
    ],

    funk: [
        [0, -2, 0, 3],       [0, 3, 0, -2],       [0, 0, -2, 3],
        [0, 3, -2, 0],       [0, -2, 3, 5],       [0, 5, 3, -2],
        [0, -2, 0, 5],       [0, 3, 5, -2],       [0, -2, 3, 0],
        [0, 5, -2, 0],       [0, -2, -2, 3],      [0, 3, 0, 5],
        [0, -2, 5, 3],       [0, 5, 0, -2],       [0, 3, -2, 3],
        [0, -2, 0, 0],       [0, 5, -2, 3],       [0, 3, 5, 0],
        [0, -2, 3, -2],      [0, 5, 3, 0]
    ],

    latin: [
        [0, 4, 0, 7],        [0, 0, 4, 7],        [0, 7, 4, 0],
        [0, 4, 7, 4],        [0, 0, 7, 4],        [0, 7, 0, 4],
        [0, 4, 7, 0],        [0, 7, 4, 7],        [0, 4, 0, 4],
        [0, 0, 4, 0],        [0, 7, 7, 4],        [0, 4, 4, 7],
        [0, 7, 0, 0],        [0, 4, 7, 7],        [0, 0, 0, 7],
        [0, 7, 4, 4],        [0, 4, 0, 0],        [0, 0, 7, 0],
        [0, 7, 0, 7],        [0, 4, 4, 0]
    ],

    rock: [
        [0, 0, 4, 4],        [0, 4, 0, 0],        [0, 0, 0, 4],
        [0, 4, 4, 0],        [0, 0, 4, 0],        [0, 4, 7, 4],
        [0, 7, 4, 0],        [0, 4, 0, 7],        [0, 0, 7, 4],
        [0, 7, 0, 4],        [0, 4, 7, 0],        [0, 0, 7, 0],
        [0, 7, 7, 4],        [0, 4, 4, 7],        [0, 7, 0, 0],
        [0, 0, 4, 7],        [0, 4, 7, 7],        [0, 7, 4, 7],
        [0, 0, 0, 7],        [0, 7, 4, 4]
    ],

    electronic: [
        [0, 0, 0, 0],        [0, 7, 0, 0],        [0, 0, 7, 0],
        [0, 0, 0, 7],        [0, 7, 7, 0],        [0, 0, 7, 7],
        [0, 7, 0, 7],        [0, 12, 0, 0],       [0, 0, 12, 0],
        [0, 0, 0, 12],       [0, 12, 7, 0],       [0, 7, 12, 0],
        [0, 12, 0, 7],       [0, 7, 0, 12],       [0, 0, 12, 7],
        [0, 0, 7, 12],       [0, 12, 7, 7],       [0, 7, 12, 7],
        [0, 7, 7, 12],       [0, 12, 12, 7]
    ],

    hiphop: [
        [0, 0, 0, -5],       [0, -5, 0, 0],       [0, 0, -5, 0],
        [0, -5, 0, -5],      [0, 0, 0, -3],       [0, -3, 0, -5],
        [0, -5, -3, 0],      [0, 0, -3, -5],      [0, -3, -5, 0],
        [0, -5, 0, -3],      [0, 0, -5, -3],      [0, -3, 0, 0],
        [0, -5, -5, 0],      [0, 0, -3, 0],       [0, -3, -3, 0],
        [0, -5, 0, 7],       [0, 0, -5, 7],       [0, 7, -5, 0],
        [0, -3, 7, 0],       [0, 7, 0, -5]
    ],

    ambient: [
        [0, 7],              [0, 12],             [0, 7, 12],
        [0, 12, 7],          [0, 5, 7],           [0, 7, 5],
        [0, 4, 7],           [0, 7, 4],           [0, 5, 12],
        [0, 12, 5],          [0, 4, 12],          [0, 12, 4],
        [0, 0, 7],           [0, 7, 0],           [0, 0, 12],
        [0, 12, 0],          [0, 5, 7, 12],       [0, 12, 7, 5],
        [0, 4, 7, 12],       [0, 12, 7, 4]
    ],

    metal: [
        [0, -1, 0, -1],      [0, 5, 0, -1],       [0, -1, 5, 0],
        [0, 0, -1, 5],       [0, 5, -1, 0],       [0, -1, 0, 5],
        [0, 0, 5, -1],       [0, 6, 0, -1],       [0, -1, 6, 0],
        [0, 0, -1, 6],       [0, 6, -1, 0],       [0, -1, 0, 6],
        [0, 0, 6, -1],       [0, 5, 6, 5],        [0, 6, 5, 0],
        [0, -1, -1, 0],      [0, 5, 5, -1],       [0, 6, 0, 5],
        [0, -1, 5, 6],       [0, 6, 5, -1]
    ],

    world: [
        [0, 2, 4, 7],        [0, 3, 5, 7],        [0, 4, 5, 7],
        [0, 2, 5, 7],        [0, 3, 4, 7],        [0, 2, 3, 5],
        [0, 4, 7, 9],        [0, 3, 7, 9],        [0, 2, 7, 9],
        [0, 5, 7, 9],        [0, 4, 5, 9],        [0, 3, 5, 9],
        [0, 2, 4, 9],        [0, 2, 4, 5],        [0, 3, 4, 5],
        [0, 5, 4, 3],        [0, 7, 5, 4],        [0, 9, 7, 5],
        [0, 7, 4, 2],        [0, 9, 5, 3]
    ]
};


// ═══════════════════════════════════════════════════════════════════════════════
// §7  MERGE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Merge all expansion data into the main PatternEngine objects.
 *
 * Call once at startup:
 *   import { mergePatternEngineExpansion } from './patternEngineExpansion';
 *   mergePatternEngineExpansion(CONTOURS, MELODY_PROFILES, INTERVAL_WEIGHTS, BASS_STYLES);
 *
 * @param {Object} CONTOURS        - The main CONTOURS object from PatternEngine
 * @param {Object} MELODY_PROFILES - The main MELODY_PROFILES object from PatternEngine
 * @param {Object} INTERVAL_WEIGHTS - The main INTERVAL_WEIGHTS object (kept for reference; genre weights are separate)
 * @param {Object} BASS_STYLES     - The main BASS_STYLES object from PatternEngine
 */
export function mergePatternEngineExpansion(CONTOURS, MELODY_PROFILES, INTERVAL_WEIGHTS, BASS_STYLES) {
    Object.assign(CONTOURS, CONTOURS_EXPANSION);
    Object.assign(MELODY_PROFILES, MELODY_PROFILES_EXPANSION);
    Object.assign(BASS_STYLES, BASS_STYLES_EXPANSION);
}
