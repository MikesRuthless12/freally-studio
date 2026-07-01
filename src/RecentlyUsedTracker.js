/**
 * RecentlyUsedTracker — Anti-repeat system for Freally generators.
 * Tracks last N selections per category key so the same progression,
 * drum skeleton, motif seed, or lyric phrase is never picked twice in a row.
 *
 * Usage:
 *   import { tracker } from './RecentlyUsedTracker';
 *   const item = tracker.pick('chord_pop_simple', progressionsArray);
 */

class RecentlyUsedTracker {
    constructor(historySize = 50) {
        this.historySize = historySize;
        this.history = {};  // categoryKey → array of recently-used indices
    }

    /**
     * Pick a random item from `options` that hasn't been recently used in `categoryKey`.
     * Falls back to fully random if all options have been used recently.
     *
     * @param {string} categoryKey  Namespace for tracking (e.g. 'chord_pop_simple', 'kick_TRAP_trap')
     * @param {Array} options        Array of items to pick from
     * @returns {*}                  The selected item
     */
    pick(categoryKey, options) {
        if (!options || options.length === 0) return undefined;
        if (options.length === 1) return options[0];

        if (!this.history[categoryKey]) {
            this.history[categoryKey] = [];
        }

        const recent = this.history[categoryKey];
        const availableIndices = [];

        for (let i = 0; i < options.length; i++) {
            if (!recent.includes(i)) {
                availableIndices.push(i);
            }
        }

        // If all options exhausted, reset history and pick from all
        let idx;
        if (availableIndices.length === 0) {
            // Keep only the most recent entry to prevent immediate repeat
            this.history[categoryKey] = recent.length > 0 ? [recent[recent.length - 1]] : [];
            const freshIndices = [];
            for (let i = 0; i < options.length; i++) {
                if (!this.history[categoryKey].includes(i)) freshIndices.push(i);
            }
            idx = freshIndices.length > 0
                ? freshIndices[Math.floor(Math.random() * freshIndices.length)]
                : Math.floor(Math.random() * options.length);
        } else {
            idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        }

        // Record this pick
        recent.push(idx);
        if (recent.length > Math.min(this.historySize, Math.floor(options.length * 0.8))) {
            recent.shift();
        }

        return options[idx];
    }

    /**
     * Reset history for a specific category or all categories.
     * @param {string} [categoryKey] If omitted, resets all.
     */
    reset(categoryKey) {
        if (categoryKey) {
            delete this.history[categoryKey];
        } else {
            this.history = {};
        }
    }
}

// Singleton instance shared across all generators
export const tracker = new RecentlyUsedTracker(50);
export default RecentlyUsedTracker;
