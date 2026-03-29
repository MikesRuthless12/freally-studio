// accentThemes.js — Visual accent color customization for WavLoom Studio

export const ACCENT_THEMES = {
    // === 6 Solid Accent Colors ===
    coral: { name: 'Coral', type: 'solid', accent: '#ff6b6b', secondary: '#ff9f43', gradient: 'linear-gradient(135deg, #ff6b6b, #ff9f43)' },
    ocean: { name: 'Ocean', type: 'solid', accent: '#4ecdc4', secondary: '#45b7d1', gradient: 'linear-gradient(135deg, #4ecdc4, #45b7d1)' },
    purple: { name: 'Purple', type: 'solid', accent: '#a855f7', secondary: '#6366f1', gradient: 'linear-gradient(135deg, #a855f7, #6366f1)' },
    gold: { name: 'Gold', type: 'solid', accent: '#f59e0b', secondary: '#ef4444', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
    neon: { name: 'Neon', type: 'solid', accent: '#22d3ee', secondary: '#a3e635', gradient: 'linear-gradient(135deg, #22d3ee, #a3e635)' },
    pink: { name: 'Pink', type: 'solid', accent: '#ec4899', secondary: '#f97316', gradient: 'linear-gradient(135deg, #ec4899, #f97316)' },

    // === 6 Gradient Accent Themes (creative Discord-style names) ===
    sunset: { name: 'Sunset', type: 'gradient', accent: '#f97316', secondary: '#ec4899', gradient: 'linear-gradient(135deg, #f97316, #ec4899)' },
    aurora: { name: 'Aurora', type: 'gradient', accent: '#22d3ee', secondary: '#a855f7', gradient: 'linear-gradient(135deg, #22d3ee, #a855f7)' },
    nebula: { name: 'Nebula', type: 'gradient', accent: '#8b5cf6', secondary: '#ec4899', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
    ember: { name: 'Ember', type: 'gradient', accent: '#ef4444', secondary: '#f59e0b', gradient: 'linear-gradient(135deg, #ef4444, #f59e0b)' },
    mint: { name: 'Mint', type: 'gradient', accent: '#10b981', secondary: '#06b6d4', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
    twilight: { name: 'Twilight', type: 'gradient', accent: '#6366f1', secondary: '#f43f5e', gradient: 'linear-gradient(135deg, #6366f1, #f43f5e)' },

    // === 6 Additional Accent Themes ===
    arctic: { name: 'Arctic', type: 'solid', accent: '#38bdf8', secondary: '#818cf8', gradient: 'linear-gradient(135deg, #38bdf8, #818cf8)' },
    crimson: { name: 'Crimson', type: 'solid', accent: '#dc2626', secondary: '#f97316', gradient: 'linear-gradient(135deg, #dc2626, #f97316)' },
    forest: { name: 'Forest', type: 'solid', accent: '#16a34a', secondary: '#84cc16', gradient: 'linear-gradient(135deg, #16a34a, #84cc16)' },
    peach: { name: 'Peach', type: 'gradient', accent: '#fb923c', secondary: '#fbbf24', gradient: 'linear-gradient(135deg, #fb923c, #fbbf24)' },
    storm: { name: 'Storm', type: 'gradient', accent: '#475569', secondary: '#7c3aed', gradient: 'linear-gradient(135deg, #475569, #7c3aed)' },
    sakura: { name: 'Sakura', type: 'gradient', accent: '#f472b6', secondary: '#c084fc', gradient: 'linear-gradient(135deg, #f472b6, #c084fc)' },
};

export const ACCENT_KEYS = Object.keys(ACCENT_THEMES);
export const SOLID_ACCENT_KEYS = ACCENT_KEYS.filter(k => ACCENT_THEMES[k].type === 'solid');
export const GRADIENT_ACCENT_KEYS = ACCENT_KEYS.filter(k => ACCENT_THEMES[k].type === 'gradient');

export const DEFAULT_ACCENT_THEME = 'coral';

/**
 * Convert hex color to rgba string
 * @param {string} hex - e.g. '#ff6b6b'
 * @param {number} opacity - 0 to 1
 * @returns {string} e.g. 'rgba(255, 107, 107, 0.3)'
 */
export function hexToRgba(hex, opacity) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Lookup an accent theme by key with fallback to default
 * @param {string} key - theme key e.g. 'coral', 'aurora'
 * @returns {object} accent theme object
 */
export function getAccentTheme(key) {
    return ACCENT_THEMES[key] || ACCENT_THEMES[DEFAULT_ACCENT_THEME];
}
