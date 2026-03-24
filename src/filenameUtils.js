/**
 * Filename utilities for DAW-standard export naming
 * Format: ProjectName_120BPM_Cmin_Mix.wav
 */

// Scale name abbreviations for filenames
const SCALE_ABBREVIATIONS = {
    // Common
    'Major': 'maj',
    'Minor': 'min',
    'Harmonic Minor': 'harm-min',
    'Melodic Minor': 'mel-min',
    'Harmonic Major': 'harm-maj',

    // Modes
    'Ionian': 'ion',
    'Dorian': 'dor',
    'Phrygian': 'phry',
    'Lydian': 'lyd',
    'Mixolydian': 'mix',
    'Aeolian': 'aeol',
    'Locrian': 'loc',

    // Jazz & Fusion
    'Lydian Augmented': 'lyd-aug',
    'Lydian Dominant': 'lyd-dom',
    'Super Locrian': 'sup-loc',
    'Altered': 'alt',
    'Dorian #4': 'dor4',
    'Bebop Major': 'bop-maj',
    'Bebop Dominant': 'bop-dom',
    'Bebop Minor': 'bop-min',
    'Bebop Dorian': 'bop-dor',

    // Pentatonic & Blues
    'Major Pentatonic': 'maj-pent',
    'Minor Pentatonic': 'min-pent',
    'Minor Blues': 'min-blues',
    'Major Blues': 'maj-blues',
    'Blues': 'blues',
    'Neutral Pentatonic': 'neut-pent',
    'Chromatic': 'chrom',

    // World & Exotic
    'Phrygian Dominant': 'phry-dom',
    'Bhairav': 'bhairav',
    'Hungarian Minor': 'hung-min',
    '8-Tone Spanish': '8t-span',
    'Hirajoshi': 'hira',
    'In-Sen': 'insen',
    'Iwato': 'iwato',
    'Kumoi': 'kumoi',
    'Pelog Selisir': 'pelog-s',
    'Pelog Tembung': 'pelog-t',
    'Hijaz': 'hijaz',
    'Byzantine': 'byzan',
    'Persian': 'persian',
    'Arabic': 'arabic',
    'Chinese Pentatonic': 'cn-pent',
    'Balinese': 'bali',
    'Egyptian': 'egypt',

    // Symmetrical & Synthetic
    'Whole Tone': 'whole',
    'Half-whole Dim.': 'hw-dim',
    'Whole-half Dim.': 'wh-dim',
    'Augmented': 'aug',
    'Tritone': 'tritone',
    'Enigmatic': 'enigm',
    'Prometheus': 'prom',
    'Double Harmonic Major': 'dbl-harm',
    'Neapolitan Minor': 'neap-min',
    'Neapolitan Major': 'neap-maj',

    // Messiaen
    'Messiaen 3': 'mess3',
    'Messiaen 4': 'mess4',
    'Messiaen 5': 'mess5',
    'Messiaen 6': 'mess6',
    'Messiaen 7': 'mess7'
};

/**
 * Remove filesystem-illegal characters, replace spaces with underscores
 */
export function sanitizeFilename(name) {
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Convert sharp notes for filenames: C# → Cs, D# → Ds, etc.
 */
export function formatKeyForFilename(key) {
    return key.replace('#', 's');
}

/**
 * Abbreviate a scale name for filenames
 */
export function abbreviateScale(scaleName) {
    if (SCALE_ABBREVIATIONS[scaleName]) {
        return SCALE_ABBREVIATIONS[scaleName];
    }
    // Fallback: lowercase, hyphens, truncate to 8 chars
    return scaleName.toLowerCase().replace(/\s+/g, '-').slice(0, 8);
}

/**
 * Format a full mix filename (no extension)
 * e.g. "MyTrack_140BPM_Csmin_Mix"
 */
export function formatMixFilename(projectName, tempo, key, scale) {
    const safeName = sanitizeFilename(projectName || 'Untitled');
    const safeKey = formatKeyForFilename(key);
    const scaleAbbr = abbreviateScale(scale);
    return `${safeName}_${tempo}BPM_${safeKey}${scaleAbbr}_Mix`;
}

/**
 * Format a stem filename (no extension)
 * e.g. "MyTrack_140BPM_Csmin_Drums"
 */
export function formatStemFilename(projectName, tempo, key, scale, trackName) {
    const safeName = sanitizeFilename(projectName || 'Untitled');
    const safeKey = formatKeyForFilename(key);
    const scaleAbbr = abbreviateScale(scale);
    const stemLabel = trackName.charAt(0).toUpperCase() + trackName.slice(1);
    return `${safeName}_${tempo}BPM_${safeKey}${scaleAbbr}_${stemLabel}`;
}

/**
 * Format an arrangement filename (no extension)
 * e.g. "MyTrack_140BPM_Csmin_Arrangement"
 */
export function formatArrangementFilename(projectName, tempo, key, scale) {
    const safeName = sanitizeFilename(projectName || 'Untitled');
    const safeKey = formatKeyForFilename(key);
    const scaleAbbr = abbreviateScale(scale);
    return `${safeName}_${tempo}BPM_${safeKey}${scaleAbbr}_Arrangement`;
}

/**
 * Format a stems zip filename (no extension)
 * e.g. "MyTrack_140BPM_Csmin_Stems"
 */
export function formatStemsZipFilename(projectName, tempo, key, scale) {
    const safeName = sanitizeFilename(projectName || 'Untitled');
    const safeKey = formatKeyForFilename(key);
    const scaleAbbr = abbreviateScale(scale);
    return `${safeName}_${tempo}BPM_${safeKey}${scaleAbbr}_Stems`;
}
