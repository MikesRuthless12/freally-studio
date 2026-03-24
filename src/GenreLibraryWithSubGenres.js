// Enhanced Genre Library with Sub-Genre Variations
// Re-exports data from domain/, keeps helper functions local

export { MOOD_MODIFIERS } from './domain/moods';
export { GENRES_WITH_SUBGENRES } from './domain/genres';

// Import what helpers need
import { MOOD_MODIFIERS } from './domain/moods';
import { GENRES_WITH_SUBGENRES } from './domain/genres';

/**
 * Get genre characteristics with sub-genre modifier applied
 */
export const getGenreWithSubGenre = (genre, subGenre = null) => {
    const baseGenre = GENRES_WITH_SUBGENRES[genre];
    if (!baseGenre) return null;

    // If no sub-genre, return base genre
    if (!subGenre || subGenre === 'Standard') {
        return {
            ...baseGenre,
            tempo: baseGenre.baseTempo,
            scales: baseGenre.baseScales,
            complexity: 'simple'
        };
    }

    const modifier = MOOD_MODIFIERS[subGenre];
    if (!modifier) return baseGenre;

    // Apply modifiers
    const modifiedTempo = [
        Math.round(baseGenre.baseTempo[0] * modifier.tempoMultiplier),
        Math.round(baseGenre.baseTempo[1] * modifier.tempoMultiplier)
    ];

    // Merge scale preferences (prefer modifier scales, fallback to base)
    const modifiedScales = [...modifier.scalePreference, ...baseGenre.baseScales]
        .filter((scale, index, self) => self.indexOf(scale) === index) // Remove duplicates
        .slice(0, 4); // Keep top 4

    return {
        ...baseGenre,
        tempo: modifiedTempo,
        scales: modifiedScales,
        complexity: modifier.chordComplexity,
        registerShift: modifier.registerShift,
        rhythmDensity: modifier.rhythmDensity,
        subGenre
    };
};

/**
 * Get all available sub-genres for a genre
 */
export const getSubGenresForGenre = (genre) => {
    const genreData = GENRES_WITH_SUBGENRES[genre];
    if (!genreData || !genreData.subGenres) return ['Standard'];
    return ['Standard', ...genreData.subGenres];
};

/**
 * Get all main genres
 */
export const getAllGenres = () => {
    return Object.keys(GENRES_WITH_SUBGENRES);
};

/**
 * Get recommended scale for genre and sub-genre
 */
export const getRecommendedScale = (genre, subGenre = null) => {
    const genreData = getGenreWithSubGenre(genre, subGenre);
    if (!genreData || !genreData.scales || genreData.scales.length === 0) {
        return 'Minor';
    }
    return genreData.scales[0];
};

/**
 * Get recommended tempo for genre and sub-genre
 */
export const getRecommendedTempo = (genre, subGenre = null) => {
    const genreData = getGenreWithSubGenre(genre, subGenre);
    if (!genreData || !genreData.tempo) {
        return 120;
    }
    const [min, max] = genreData.tempo;
    return Math.round((min + max) / 2);
};

export default {
    GENRES_WITH_SUBGENRES,
    MOOD_MODIFIERS,
    getGenreWithSubGenre,
    getSubGenresForGenre,
    getAllGenres,
    getRecommendedScale,
    getRecommendedTempo
};
