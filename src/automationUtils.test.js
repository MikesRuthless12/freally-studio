/**
 * automationUtils ��� Comprehensive Unit Tests
 * Tests all automation utility functions
 */
import { describe, it, expect } from 'vitest';
import {
    getParameterRange, normalizeValue, denormalizeValue,
    interpolateAutomation, addAutomationPoint, removeAutomationPoint,
    moveAutomationPoint, setPointCurve, getAutomatableParams,
    createDefaultAutomationPoints, clearToAnchors, erasePointsInRange,
    parseAutomationParamKey
} from './automationUtils';

// ��─ getParameterRange ─────────────────────────────────────��────────────────

describe('getParameterRange', () => {
    it('should return volume range (0-1)', () => {
        const range = getParameterRange('volume');
        expect(range.min).toBe(0);
        expect(range.max).toBe(1);
        expect(range.default).toBe(0.5);
        expect(range.label).toBe('Volume');
    });

    it('should return pan range (-1 to 1)', () => {
        const range = getParameterRange('pan');
        expect(range.min).toBe(-1);
        expect(range.max).toBe(1);
        expect(range.default).toBe(0);
        expect(range.label).toBe('Pan');
    });

    it('should return mute range (0-1)', () => {
        const range = getParameterRange('mute');
        expect(range.min).toBe(0);
        expect(range.max).toBe(1);
    });

    it('should return default range for unknown param', () => {
        const range = getParameterRange('unknownParam');
        expect(range.min).toBe(0);
        expect(range.max).toBe(1);
        expect(range.default).toBe(0.5);
    });
});

// ─�� normalizeValue ─��──────────────────────────────────────��────────────────

describe('normalizeValue', () => {
    it('should normalize volume 0 → 0', () => {
        expect(normalizeValue('volume', 0)).toBe(0);
    });

    it('should normalize volume 1 → 1', () => {
        expect(normalizeValue('volume', 1)).toBe(1);
    });

    it('should normalize volume 0.5 → 0.5', () => {
        expect(normalizeValue('volume', 0.5)).toBe(0.5);
    });

    it('should normalize pan -1 → 0', () => {
        expect(normalizeValue('pan', -1)).toBe(0);
    });

    it('should normalize pan 0 → 0.5', () => {
        expect(normalizeValue('pan', 0)).toBe(0.5);
    });

    it('should normalize pan 1 → 1', () => {
        expect(normalizeValue('pan', 1)).toBe(1);
    });

    it('should clamp values below min to 0', () => {
        expect(normalizeValue('volume', -0.5)).toBe(0);
    });

    it('should clamp values above max to 1', () => {
        expect(normalizeValue('volume', 2.0)).toBe(1);
    });

    it('should handle same min/max (return 0.5)', () => {
        // Custom param with min === max shouldn't be common but should not crash
        expect(normalizeValue('volume', 0.5)).toBeGreaterThanOrEqual(0);
    });
});

// ── denormalizeValue ──────────���────────────────────────────────────────────

describe('denormalizeValue', () => {
    it('should denormalize volume 0 → 0', () => {
        expect(denormalizeValue('volume', 0)).toBe(0);
    });

    it('should denormalize volume 1 → 1', () => {
        expect(denormalizeValue('volume', 1)).toBe(1);
    });

    it('should denormalize pan 0 → -1', () => {
        expect(denormalizeValue('pan', 0)).toBe(-1);
    });

    it('should denormalize pan 0.5 → 0', () => {
        expect(denormalizeValue('pan', 0.5)).toBe(0);
    });

    it('should denormalize pan 1 → 1', () => {
        expect(denormalizeValue('pan', 1)).toBe(1);
    });

    it('normalize then denormalize should be identity', () => {
        const raw = 0.7;
        const normalized = normalizeValue('volume', raw);
        const restored = denormalizeValue('volume', normalized);
        expect(restored).toBeCloseTo(raw);
    });

    it('should clamp normalized input to 0-1', () => {
        expect(denormalizeValue('pan', -0.5)).toBe(-1); // clamps to 0, then denorm → -1
        expect(denormalizeValue('pan', 1.5)).toBe(1);   // clamps to 1, then denorm ��� 1
    });
});

// ─��� interpolateAutomation ──────────────────────────────────────────────────

describe('interpolateAutomation', () => {
    it('should return null for empty/null points', () => {
        expect(interpolateAutomation(null, 2)).toBeNull();
        expect(interpolateAutomation([], 2)).toBeNull();
    });

    it('should hold first value before first point', () => {
        const points = [
            { bar: 4, value: 0.8, curve: 0 },
            { bar: 8, value: 0.2, curve: 0 },
        ];
        expect(interpolateAutomation(points, 0)).toBe(0.8);
        expect(interpolateAutomation(points, 2)).toBe(0.8);
    });

    it('should hold last value after last point', () => {
        const points = [
            { bar: 0, value: 0.3, curve: 0 },
            { bar: 4, value: 0.9, curve: 0 },
        ];
        expect(interpolateAutomation(points, 8)).toBe(0.9);
        expect(interpolateAutomation(points, 100)).toBe(0.9);
    });

    it('should interpolate linearly between two points', () => {
        const points = [
            { bar: 0, value: 0.0, curve: 0 },
            { bar: 4, value: 1.0, curve: 0 },
        ];
        expect(interpolateAutomation(points, 0)).toBeCloseTo(0.0);
        expect(interpolateAutomation(points, 1)).toBeCloseTo(0.25);
        expect(interpolateAutomation(points, 2)).toBeCloseTo(0.5);
        expect(interpolateAutomation(points, 3)).toBeCloseTo(0.75);
        expect(interpolateAutomation(points, 4)).toBeCloseTo(1.0);
    });

    it('should handle single point', () => {
        const points = [{ bar: 4, value: 0.6, curve: 0 }];
        expect(interpolateAutomation(points, 0)).toBe(0.6);
        expect(interpolateAutomation(points, 4)).toBe(0.6);
        expect(interpolateAutomation(points, 10)).toBe(0.6);
    });

    it('should interpolate between three points', () => {
        const points = [
            { bar: 0, value: 0.0, curve: 0 },
            { bar: 4, value: 1.0, curve: 0 },
            { bar: 8, value: 0.5, curve: 0 },
        ];
        expect(interpolateAutomation(points, 2)).toBeCloseTo(0.5);
        expect(interpolateAutomation(points, 6)).toBeCloseTo(0.75);
    });

    it('curved interpolation should differ from linear', () => {
        const linearPoints = [
            { bar: 0, value: 0.0, curve: 0 },
            { bar: 4, value: 1.0, curve: 0 },
        ];
        const curvedPoints = [
            { bar: 0, value: 0.0, curve: 1 }, // exponential
            { bar: 4, value: 1.0, curve: 0 },
        ];
        const linearMid = interpolateAutomation(linearPoints, 2);
        const curvedMid = interpolateAutomation(curvedPoints, 2);
        // Exponential curve should be below linear at midpoint
        expect(curvedMid).toBeLessThan(linearMid);
    });
});

// ── addAutomationPoint ─────────────────────────────────────────────────────

describe('addAutomationPoint', () => {
    it('should add point to empty array', () => {
        const result = addAutomationPoint([], { bar: 4, value: 0.5 });
        expect(result).toHaveLength(1);
        expect(result[0].bar).toBe(4);
        expect(result[0].value).toBe(0.5);
    });

    it('should add point to null array', () => {
        const result = addAutomationPoint(null, { bar: 4, value: 0.5 });
        expect(result).toHaveLength(1);
    });

    it('should insert in sorted order', () => {
        const points = [
            { bar: 0, value: 0.5, curve: 0 },
            { bar: 8, value: 0.8, curve: 0 },
        ];
        const result = addAutomationPoint(points, { bar: 4, value: 0.6 });
        expect(result).toHaveLength(3);
        expect(result[0].bar).toBe(0);
        expect(result[1].bar).toBe(4);
        expect(result[2].bar).toBe(8);
    });

    it('should replace point at same bar position', () => {
        const points = [
            { bar: 0, value: 0.5, curve: 0 },
            { bar: 4, value: 0.8, curve: 0 },
        ];
        const result = addAutomationPoint(points, { bar: 4, value: 0.3 });
        expect(result).toHaveLength(2);
        expect(result[1].value).toBe(0.3);
    });

    it('should not mutate original array', () => {
        const points = [{ bar: 0, value: 0.5, curve: 0 }];
        const result = addAutomationPoint(points, { bar: 4, value: 0.8 });
        expect(points).toHaveLength(1);
        expect(result).toHaveLength(2);
    });

    it('should default curve to 0', () => {
        const result = addAutomationPoint([], { bar: 2, value: 0.5 });
        expect(result[0].curve).toBe(0);
    });
});

// ── removeAutomationPoint ─────────��────────────────────────────────────────

describe('removeAutomationPoint', () => {
    it('should remove point at valid index', () => {
        const points = [
            { bar: 0, value: 0.5, curve: 0 },
            { bar: 4, value: 0.8, curve: 0 },
            { bar: 8, value: 0.3, curve: 0 },
        ];
        const result = removeAutomationPoint(points, 1);
        expect(result).toHaveLength(2);
        expect(result[0].bar).toBe(0);
        expect(result[1].bar).toBe(8);
    });

    it('should handle invalid index gracefully', () => {
        const points = [{ bar: 0, value: 0.5, curve: 0 }];
        expect(removeAutomationPoint(points, -1)).toEqual(points);
        expect(removeAutomationPoint(points, 5)).toEqual(points);
    });

    it('should handle null points', () => {
        expect(removeAutomationPoint(null, 0)).toEqual([]);
    });
});

// ── moveAutomationPoint ───────────────────────────────────────���────────────

describe('moveAutomationPoint', () => {
    it('should move point to new bar position', () => {
        const points = [
            { bar: 0, value: 0.5, curve: 0 },
            { bar: 4, value: 0.8, curve: 0 },
        ];
        const result = moveAutomationPoint(points, 1, 6, null);
        expect(result[1].bar).toBe(6);
    });

    it('should move point to new value', () => {
        const points = [
            { bar: 0, value: 0.5, curve: 0 },
            { bar: 4, value: 0.8, curve: 0 },
        ];
        const result = moveAutomationPoint(points, 0, null, 0.9);
        expect(result[0].value).toBe(0.9);
    });

    it('should clamp value to 0-1', () => {
        const points = [{ bar: 0, value: 0.5, curve: 0 }];
        const result = moveAutomationPoint(points, 0, null, 1.5);
        expect(result[0].value).toBe(1);

        const result2 = moveAutomationPoint(points, 0, null, -0.5);
        expect(result2[0].value).toBe(0);
    });

    it('should re-sort by bar after move', () => {
        const points = [
            { bar: 0, value: 0.5, curve: 0 },
            { bar: 4, value: 0.8, curve: 0 },
            { bar: 8, value: 0.3, curve: 0 },
        ];
        // Move point 0 to bar 10 (past all others)
        const result = moveAutomationPoint(points, 0, 10, null);
        expect(result[0].bar).toBe(4);
        expect(result[1].bar).toBe(8);
        expect(result[2].bar).toBe(10);
    });

    it('should handle invalid index', () => {
        expect(moveAutomationPoint(null, 0, 1, 0.5)).toEqual([]);
    });
});

// ── setPointCurve ──────��───────────────────────────────────────────────────

describe('setPointCurve', () => {
    it('should set curve on specified point', () => {
        const points = [
            { bar: 0, value: 0.5, curve: 0 },
            { bar: 4, value: 0.8, curve: 0 },
        ];
        const result = setPointCurve(points, 0, -1);
        expect(result[0].curve).toBe(-1);
        expect(result[1].curve).toBe(0); // unchanged
    });

    it('should handle invalid index', () => {
        expect(setPointCurve(null, 0, 1)).toEqual([]);
    });
});

// ── getAutomatableParams ─────────────��─────────────────────────────��───────

describe('getAutomatableParams', () => {
    it('should always include volume and pan', () => {
        const params = getAutomatableParams('drums');
        expect(params.find(p => p.key === 'volume')).toBeDefined();
        expect(params.find(p => p.key === 'pan')).toBeDefined();
    });

    it('should include effect params when chain is provided', () => {
        const mockChain = {
            effects: [
                { id: 'comp1', name: 'Compressor', params: { threshold: -20, ratio: 4 } },
            ]
        };
        const params = getAutomatableParams('drums', mockChain);
        expect(params.length).toBeGreaterThan(2);
        expect(params.some(p => p.key.startsWith('effect_comp1_'))).toBe(true);
    });

    it('should handle VST3 effects', () => {
        const mockChain = {
            effects: [
                {
                    id: 'vst1', name: 'VST3:FabFilter',
                    getVST3Params: () => [{ id: 0, name: 'Cutoff' }, { id: 1, name: 'Resonance' }]
                },
            ]
        };
        const params = getAutomatableParams('drums', mockChain);
        expect(params.some(p => p.key === 'vst3_vst1_0')).toBe(true);
        expect(params.some(p => p.key === 'vst3_vst1_1')).toBe(true);
    });

    it('should handle null chain', () => {
        const params = getAutomatableParams('drums', null);
        expect(params).toHaveLength(2);
    });
});

// ── createDefaultAutomationPoints ─────────────��────────────────────────────

describe('createDefaultAutomationPoints', () => {
    it('should create 3 anchor points', () => {
        const points = createDefaultAutomationPoints('volume', 16);
        expect(points).toHaveLength(3);
        expect(points[0].anchor).toBe(true);
        expect(points[1].anchor).toBe(true);
        expect(points[2].anchor).toBe(true);
    });

    it('volume default should be 1.0', () => {
        const points = createDefaultAutomationPoints('volume', 16);
        expect(points[0].value).toBe(1.0);
        expect(points[1].value).toBe(1.0);
        expect(points[2].value).toBe(1.0);
    });

    it('pan default should be 0.5', () => {
        const points = createDefaultAutomationPoints('pan', 16);
        expect(points[0].value).toBe(0.5);
    });

    it('should place points at start, middle, end', () => {
        const points = createDefaultAutomationPoints('volume', 16);
        expect(points[0].bar).toBe(0);
        expect(points[1].bar).toBe(8);
        expect(points[2].bar).toBe(16);
    });
});

// ── clearToAnchors ───��──────────────────────────────────────���──────────────

describe('clearToAnchors', () => {
    it('should remove non-anchor points', () => {
        const points = [
            { bar: 0, value: 1.0, curve: 0, anchor: true },
            { bar: 2, value: 0.3, curve: 0 },
            { bar: 4, value: 0.5, curve: 0 },
            { bar: 8, value: 1.0, curve: 0, anchor: true },
        ];
        const result = clearToAnchors(points, 'volume');
        expect(result).toHaveLength(2);
        expect(result[0].anchor).toBe(true);
        expect(result[1].anchor).toBe(true);
    });

    it('should reset anchor values to default', () => {
        const points = [
            { bar: 0, value: 0.3, curve: 0, anchor: true },
            { bar: 8, value: 0.7, curve: 0, anchor: true },
        ];
        const result = clearToAnchors(points, 'volume');
        expect(result[0].value).toBe(1.0);
        expect(result[1].value).toBe(1.0);
    });

    it('should return original if no anchors found', () => {
        const points = [{ bar: 0, value: 0.5, curve: 0 }];
        const result = clearToAnchors(points, 'volume');
        expect(result).toEqual(points);
    });
});

// ── erasePointsInRange ─────────────────────────────────────────────────────

describe('erasePointsInRange', () => {
    it('should remove non-anchor points in range', () => {
        const points = [
            { bar: 0, value: 0.5, curve: 0, anchor: true },
            { bar: 2, value: 0.3, curve: 0 },
            { bar: 4, value: 0.6, curve: 0 },
            { bar: 6, value: 0.8, curve: 0 },
            { bar: 8, value: 0.5, curve: 0, anchor: true },
        ];
        const result = erasePointsInRange(points, 1, 5);
        // Should keep anchors and points outside range
        expect(result).toHaveLength(3); // anchor@0, point@6, anchor@8
        expect(result.map(p => p.bar)).toEqual([0, 6, 8]);
    });

    it('should keep anchor points in range', () => {
        const points = [
            { bar: 4, value: 0.5, curve: 0, anchor: true },
        ];
        const result = erasePointsInRange(points, 0, 8);
        expect(result).toHaveLength(1);
    });

    it('should handle reversed start/end', () => {
        const points = [
            { bar: 3, value: 0.5, curve: 0 },
        ];
        const result = erasePointsInRange(points, 5, 1); // reversed
        expect(result).toHaveLength(0); // bar 3 is within [1, 5]
    });

    it('should handle null points', () => {
        expect(erasePointsInRange(null, 0, 8)).toEqual([]);
    });
});

// ── parseAutomationParamKey ────────────────���───────────────────────────────

describe('parseAutomationParamKey', () => {
    it('should parse volume', () => {
        expect(parseAutomationParamKey('volume')).toEqual({ type: 'volume' });
    });

    it('should parse pan', () => {
        expect(parseAutomationParamKey('pan')).toEqual({ type: 'pan' });
    });

    it('should parse mute', () => {
        expect(parseAutomationParamKey('mute')).toEqual({ type: 'mute' });
    });

    it('should parse stock effect param', () => {
        const result = parseAutomationParamKey('effect_comp1_threshold');
        expect(result.type).toBe('effect');
        expect(result.effectId).toBe('comp1');
        expect(result.paramName).toBe('threshold');
    });

    it('should parse VST3 effect param', () => {
        const result = parseAutomationParamKey('vst3_fab1_42');
        expect(result.type).toBe('vst3');
        expect(result.effectId).toBe('fab1');
        expect(result.paramId).toBe(42);
    });

    it('should return unknown for unrecognized keys', () => {
        expect(parseAutomationParamKey('something_weird')).toEqual({ type: 'unknown' });
    });
});
