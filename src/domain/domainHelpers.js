// Domain: Cross-domain query helpers

import { GENRE_DEFINITIONS } from './genres';
import { MOOD_MODIFIERS } from './moods';
import { KEY_METADATA } from './keys';

/**
 * Get recommended scales for a genre + mood combination.
 * Merges genre baseScales with mood scalePreference, deduplicated.
 */
export const getScalesForContext = (genre, mood = null) => {
    const genreData = GENRE_DEFINITIONS[genre];
    const genreScales = genreData ? genreData.baseScales : ['Minor'];

    if (!mood || !MOOD_MODIFIERS[mood]) {
        return [...genreScales];
    }

    const moodScales = MOOD_MODIFIERS[mood].scalePreference || [];
    const merged = [...moodScales, ...genreScales];
    return merged.filter((s, i) => merged.indexOf(s) === i);
};

/**
 * Get the typical progression type key for a genre.
 * Falls back to 'pop' if genre not found.
 */
export const getProgressionTypeForGenre = (genre) => {
    const genreData = GENRE_DEFINITIONS[genre];
    return genreData ? genreData.typicalProgressionType : 'pop';
};

/**
 * Get recommended keys for a genre based on key affinity.
 * Returns keys sorted by affinity match count.
 */
export const getRecommendedKeyForGenre = (genre) => {
    const entries = Object.entries(KEY_METADATA);
    const matched = entries
        .filter(([, meta]) => meta.genreAffinity.some(g =>
            genre.toLowerCase().includes(g.toLowerCase()) ||
            g.toLowerCase().includes(genre.toLowerCase())
        ))
        .map(([key]) => key);
    return matched.length > 0 ? matched : ['C', 'G', 'A'];
};
