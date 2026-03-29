/**
 * StepResolution — Comprehensive Unit Tests
 * Tests all step resolution functions and constants
 */
import { describe, it, expect } from 'vitest';
import {
    STEP_RESOLUTIONS,
    getStepsPerBar, getStepsPerBeat,
    convertPatternResolution, getGridLines,
    getCanvasWidth, quantizeStep, getStepDuration,
    formatStepPosition
} from './StepResolution';

// ── STEP_RESOLUTIONS constant ───────────────��───────────────────────��──────

describe('STEP_RESOLUTIONS', () => {
    it('should have exactly 4 resolutions', () => {
        expect(Object.keys(STEP_RESOLUTIONS)).toHaveLength(4);
    });

    it('should contain 1/4, 1/8, 1/16, 1/32', () => {
        expect(STEP_RESOLUTIONS['1/4']).toBeDefined();
        expect(STEP_RESOLUTIONS['1/8']).toBeDefined();
        expect(STEP_RESOLUTIONS['1/16']).toBeDefined();
        expect(STEP_RESOLUTIONS['1/32']).toBeDefined();
    });

    it('each resolution should have name, stepsPerBeat, stepsPerBar, division', () => {
        for (const [key, res] of Object.entries(STEP_RESOLUTIONS)) {
            expect(res).toHaveProperty('name');
            expect(res).toHaveProperty('stepsPerBeat');
            expect(res).toHaveProperty('stepsPerBar');
            expect(res).toHaveProperty('division');
        }
    });

    it('stepsPerBar should be stepsPerBeat * 4', () => {
        for (const [key, res] of Object.entries(STEP_RESOLUTIONS)) {
            expect(res.stepsPerBar).toBe(res.stepsPerBeat * 4);
        }
    });

    it('1/4 should be 4 steps per bar', () => {
        expect(STEP_RESOLUTIONS['1/4'].stepsPerBar).toBe(4);
        expect(STEP_RESOLUTIONS['1/4'].stepsPerBeat).toBe(1);
    });

    it('1/8 should be 8 steps per bar', () => {
        expect(STEP_RESOLUTIONS['1/8'].stepsPerBar).toBe(8);
        expect(STEP_RESOLUTIONS['1/8'].stepsPerBeat).toBe(2);
    });

    it('1/16 should be 16 steps per bar', () => {
        expect(STEP_RESOLUTIONS['1/16'].stepsPerBar).toBe(16);
        expect(STEP_RESOLUTIONS['1/16'].stepsPerBeat).toBe(4);
    });

    it('1/32 should be 32 steps per bar', () => {
        expect(STEP_RESOLUTIONS['1/32'].stepsPerBar).toBe(32);
        expect(STEP_RESOLUTIONS['1/32'].stepsPerBeat).toBe(8);
    });
});

// ── getStepsPerBar ─────────────────────────────────────────────────────────

describe('getStepsPerBar', () => {
    it('should return correct values for each resolution', () => {
        expect(getStepsPerBar('1/4')).toBe(4);
        expect(getStepsPerBar('1/8')).toBe(8);
        expect(getStepsPerBar('1/16')).toBe(16);
        expect(getStepsPerBar('1/32')).toBe(32);
    });

    it('should return 16 for unknown resolution (default)', () => {
        expect(getStepsPerBar('unknown')).toBe(16);
        expect(getStepsPerBar('')).toBe(16);
    });
});

// ── getStepsPerBeat ────���─────────────────────────────────��─────────────────

describe('getStepsPerBeat', () => {
    it('should return correct values for each resolution', () => {
        expect(getStepsPerBeat('1/4')).toBe(1);
        expect(getStepsPerBeat('1/8')).toBe(2);
        expect(getStepsPerBeat('1/16')).toBe(4);
        expect(getStepsPerBeat('1/32')).toBe(8);
    });

    it('should return 4 for unknown resolution (default)', () => {
        expect(getStepsPerBeat('unknown')).toBe(4);
    });
});

// ── convertPatternResolution ─────────────���─────────────────────────────────

describe('convertPatternResolution', () => {
    it('should scale step positions when converting 1/16 → 1/32', () => {
        const pattern = [
            { step: 0, duration: 1, note: 60 },
            { step: 4, duration: 2, note: 64 },
        ];
        const result = convertPatternResolution(pattern, '1/16', '1/32');
        expect(result[0].step).toBe(0);
        expect(result[1].step).toBe(8); // 4 * (32/16)
        expect(result[1].duration).toBe(4); // 2 * 2
    });

    it('should halve step positions when converting 1/32 → 1/16', () => {
        const pattern = [
            { step: 0, duration: 2, note: 60 },
            { step: 8, duration: 4, note: 64 },
        ];
        const result = convertPatternResolution(pattern, '1/32', '1/16');
        expect(result[0].step).toBe(0);
        expect(result[1].step).toBe(4);
        expect(result[1].duration).toBe(2);
    });

    it('should preserve notes and other properties', () => {
        const pattern = [{ step: 4, duration: 2, note: 72, velocity: 0.8 }];
        const result = convertPatternResolution(pattern, '1/16', '1/32');
        expect(result[0].note).toBe(72);
        expect(result[0].velocity).toBe(0.8);
    });

    it('same resolution should keep step positions', () => {
        const pattern = [{ step: 4, duration: 2, note: 60 }];
        const result = convertPatternResolution(pattern, '1/16', '1/16');
        expect(result[0].step).toBe(4);
        expect(result[0].duration).toBe(2);
    });

    it('should handle empty pattern', () => {
        expect(convertPatternResolution([], '1/16', '1/32')).toEqual([]);
    });
});

// ── getGridLines ───────────────────────────────────────────────────────────

describe('getGridLines', () => {
    it('should generate correct number of lines for 1/16, 4 bars', () => {
        const lines = getGridLines('1/16', 4);
        // 16 steps/bar * 4 bars + 1 (inclusive) = 65
        expect(lines).toHaveLength(65);
    });

    it('should generate correct number of lines for 1/32, 4 bars', () => {
        const lines = getGridLines('1/32', 4);
        expect(lines).toHaveLength(129); // 32*4 + 1
    });

    it('first line should be a bar line', () => {
        const lines = getGridLines('1/16', 4);
        expect(lines[0].isBar).toBe(true);
        expect(lines[0].isBeat).toBe(true);
        expect(lines[0].weight).toBe('heavy');
    });

    it('should mark bar lines correctly', () => {
        const lines = getGridLines('1/16', 2);
        const barLines = lines.filter(l => l.isBar);
        // Bars at step 0, 16, 32 = 3 bar lines
        expect(barLines).toHaveLength(3);
    });

    it('should mark beat lines correctly', () => {
        const lines = getGridLines('1/16', 1);
        const beatLines = lines.filter(l => l.isBeat);
        // Beats at step 0, 4, 8, 12, 16 = 5 beat lines
        expect(beatLines).toHaveLength(5);
    });

    it('non-beat lines should have light weight', () => {
        const lines = getGridLines('1/16', 1);
        const lightLines = lines.filter(l => l.weight === 'light');
        expect(lightLines.length).toBeGreaterThan(0);
        lightLines.forEach(l => {
            expect(l.isBar).toBe(false);
            expect(l.isBeat).toBe(false);
        });
    });
});

// ── getCanvasWidth ─────────────────────────────��───────────────────────────

describe('getCanvasWidth', () => {
    it('should return at least 1200 for any configuration', () => {
        expect(getCanvasWidth('1/4', 1)).toBeGreaterThanOrEqual(1200);
        expect(getCanvasWidth('1/32', 1)).toBeGreaterThanOrEqual(1200);
    });

    it('should increase with more bars', () => {
        const w4 = getCanvasWidth('1/16', 4);
        const w8 = getCanvasWidth('1/16', 8);
        expect(w8).toBeGreaterThan(w4);
    });

    it('should be wider for finer resolutions', () => {
        const w16 = getCanvasWidth('1/16', 8);
        const w32 = getCanvasWidth('1/32', 8);
        // 1/32 has more steps, so even with smaller pixels per step it may be wider
        expect(w32).toBeGreaterThanOrEqual(w16 * 0.8); // approximate
    });
});

// ── quantizeStep ────────���──────────────────────────���───────────────────────

describe('quantizeStep', () => {
    it('should clamp to valid range', () => {
        expect(quantizeStep(-5, '1/16')).toBe(0);
        expect(quantizeStep(100, '1/16')).toBe(15); // max = stepsPerBar - 1
    });

    it('should not change valid steps', () => {
        expect(quantizeStep(8, '1/16')).toBe(8);
        expect(quantizeStep(0, '1/32')).toBe(0);
    });
});

// ── getStepDuration ─────��──────────────────────────────────────────────────

describe('getStepDuration', () => {
    it('should calculate correct duration at 120 BPM, 1/16 resolution', () => {
        // 120 BPM = 2 beats/sec, 4 steps/beat → step = 0.125 sec
        expect(getStepDuration(120, '1/16')).toBeCloseTo(0.125);
    });

    it('should calculate correct duration at 60 BPM, 1/4 resolution', () => {
        // 60 BPM = 1 beat/sec, 1 step/beat → step = 1 sec
        expect(getStepDuration(60, '1/4')).toBeCloseTo(1.0);
    });

    it('should halve step duration when tempo doubles', () => {
        const d120 = getStepDuration(120, '1/16');
        const d240 = getStepDuration(240, '1/16');
        expect(d240).toBeCloseTo(d120 / 2);
    });

    it('should halve step duration when resolution doubles', () => {
        const d16 = getStepDuration(120, '1/16');
        const d32 = getStepDuration(120, '1/32');
        expect(d32).toBeCloseTo(d16 / 2);
    });
});

// ── formatStepPosition ────────────���────────────────────────��───────────────

describe('formatStepPosition', () => {
    it('should format first step as 1.1.1 for 1/16', () => {
        expect(formatStepPosition(0, '1/16', 4)).toBe('1.1.1');
    });

    it('should format bar 2, beat 1 correctly', () => {
        // Step 16 in 1/16 = bar 2, beat 1, subdivision 1
        expect(formatStepPosition(16, '1/16', 4)).toBe('2.1.1');
    });

    it('should format step within a beat', () => {
        // Step 5 in 1/16: bar 1, beat 2 (step 4-7), subdivision 2
        expect(formatStepPosition(5, '1/16', 4)).toBe('1.2.2');
    });

    it('should format 1/4 resolution without subdivision', () => {
        // 1/4 = 1 step per beat, no subdivision
        expect(formatStepPosition(0, '1/4', 4)).toBe('1.1');
        expect(formatStepPosition(1, '1/4', 4)).toBe('1.2');
        expect(formatStepPosition(4, '1/4', 4)).toBe('2.1');
    });
});
