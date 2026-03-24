/**
 * automationUtils.js — Pure utility functions for track automation.
 *
 * Automation data format:
 *   points = [ { bar: 0, value: 0.5, curve: 0 }, { bar: 4.5, value: 0.8, curve: 0 }, ... ]
 *
 * - bar:   absolute bar position in the timeline (float, e.g. 4.5 = beat 3 of bar 5)
 * - value: normalized 0–1 (mapped to parameter range at playback)
 * - curve: interpolation bend between this point and next (-1=log, 0=linear, 1=exp)
 */

/**
 * Known parameter ranges for common automatable params.
 */
const PARAM_RANGES = {
    volume:    { min: 0,  max: 1,  default: 0.5,  label: 'Volume' },
    pan:       { min: -1, max: 1,  default: 0,    label: 'Pan' },
    mute:      { min: 0,  max: 1,  default: 0,    label: 'Mute' },
    // Effect params use 0–1 normalized by default
    _default:  { min: 0,  max: 1,  default: 0.5,  label: 'Parameter' }
};

/**
 * Get the parameter range definition for a given paramKey.
 */
export function getParameterRange(paramKey) {
    return PARAM_RANGES[paramKey] || PARAM_RANGES._default;
}

/**
 * Convert a raw parameter value to normalized 0–1.
 */
export function normalizeValue(paramKey, rawValue) {
    const range = getParameterRange(paramKey);
    if (range.max === range.min) return 0.5;
    return Math.max(0, Math.min(1, (rawValue - range.min) / (range.max - range.min)));
}

/**
 * Convert a normalized 0–1 value to the raw parameter value.
 */
export function denormalizeValue(paramKey, normalizedValue) {
    const range = getParameterRange(paramKey);
    return range.min + Math.max(0, Math.min(1, normalizedValue)) * (range.max - range.min);
}

/**
 * Interpolate between two values with a curve bend.
 * curve: -1 = logarithmic (fast start, slow end)
 *         0 = linear
 *        +1 = exponential (slow start, fast end)
 */
function curvedInterpolate(v0, v1, t, curve) {
    const clampT = Math.max(0, Math.min(1, t));
    if (curve === 0 || Math.abs(curve) < 0.001) {
        // Linear
        return v0 + (v1 - v0) * clampT;
    }
    // Apply power curve: t^(1+curve) for positive curve, t^(1/(1+|curve|)) for negative
    let shapedT;
    if (curve > 0) {
        shapedT = Math.pow(clampT, 1 + curve * 2);
    } else {
        shapedT = 1 - Math.pow(1 - clampT, 1 + Math.abs(curve) * 2);
    }
    return v0 + (v1 - v0) * shapedT;
}

/**
 * Evaluate the automation curve at a given bar position.
 * Returns the interpolated normalized value (0–1).
 * If no points exist, returns null (meaning: use the track's static value).
 */
export function interpolateAutomation(points, barPosition) {
    if (!points || points.length === 0) return null;

    // Before first point: hold first value
    if (barPosition <= points[0].bar) return points[0].value;

    // After last point: hold last value
    if (barPosition >= points[points.length - 1].bar) return points[points.length - 1].value;

    // Find bracketing points
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        if (barPosition >= p0.bar && barPosition <= p1.bar) {
            const t = (barPosition - p0.bar) / (p1.bar - p0.bar);
            return curvedInterpolate(p0.value, p1.value, t, p0.curve || 0);
        }
    }

    // Fallback
    return points[points.length - 1].value;
}

/**
 * Add a new automation point, keeping the array sorted by bar position.
 * Returns a new array (immutable).
 */
export function addAutomationPoint(points, newPoint) {
    const arr = points ? [...points] : [];
    const pt = { bar: newPoint.bar, value: newPoint.value, curve: newPoint.curve || 0 };

    // Find insertion index
    let idx = arr.length;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].bar > pt.bar) { idx = i; break; }
        // If same bar position, replace
        if (Math.abs(arr[i].bar - pt.bar) < 0.001) {
            const next = [...arr];
            next[i] = pt;
            return next;
        }
    }

    const next = [...arr];
    next.splice(idx, 0, pt);
    return next;
}

/**
 * Remove an automation point by index.
 * Returns a new array (immutable).
 */
export function removeAutomationPoint(points, index) {
    if (!points || index < 0 || index >= points.length) return points || [];
    return points.filter((_, i) => i !== index);
}

/**
 * Move an automation point to a new bar position and/or value.
 * Re-sorts the array by bar position.
 * Returns a new array (immutable).
 */
export function moveAutomationPoint(points, index, newBar, newValue) {
    if (!points || index < 0 || index >= points.length) return points || [];
    const updated = points.map((p, i) => {
        if (i !== index) return p;
        return {
            ...p,
            bar: newBar != null ? newBar : p.bar,
            value: newValue != null ? Math.max(0, Math.min(1, newValue)) : p.value
        };
    });
    // Re-sort by bar
    updated.sort((a, b) => a.bar - b.bar);
    return updated;
}

/**
 * Set the curve type for a specific automation point.
 * Returns a new array (immutable).
 */
export function setPointCurve(points, index, curve) {
    if (!points || index < 0 || index >= points.length) return points || [];
    return points.map((p, i) => i === index ? { ...p, curve } : p);
}

/**
 * List of automatable parameters for a given track.
 * Returns [{ key: 'volume', label: 'Volume' }, { key: 'pan', label: 'Pan' }, ...]
 * Includes any effect parameters if effectsChain is provided.
 */
export function getAutomatableParams(trackId, effectsChain) {
    const params = [
        { key: 'volume', label: 'Volume' },
        { key: 'pan', label: 'Pan' }
    ];

    // Add effect parameters
    if (effectsChain && typeof effectsChain.getEffects === 'function') {
        const effects = effectsChain.getEffects();
        for (const fx of effects) {
            if (fx.params && fx.type) {
                for (const paramKey of Object.keys(fx.params)) {
                    params.push({
                        key: `effect_${fx.id}_${paramKey}`,
                        label: `${fx.type}: ${paramKey}`,
                        effectId: fx.id,
                        paramName: paramKey
                    });
                }
            }
        }
    }

    return params;
}
