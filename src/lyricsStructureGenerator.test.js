/**
 * StructureGenerator — Comprehensive Unit Tests
 * Tests song structure templates and section management
 */
import { describe, it, expect } from 'vitest';
import {
    getStructure, getAvailableStructures, getSectionRole,
    buildGenerationPlan, getRhymeSchemeForSection,
    STRUCTURE_TEMPLATES, SECTION_ROLES
} from './lyrics/engine/StructureGenerator';

// ── STRUCTURE_TEMPLATES ──────────���─────────────────────────────────────────

describe('STRUCTURE_TEMPLATES', () => {
    it('should have at least 5 templates', () => {
        expect(Object.keys(STRUCTURE_TEMPLATES).length).toBeGreaterThanOrEqual(5);
    });

    it('each template should have label and sections array', () => {
        for (const [key, template] of Object.entries(STRUCTURE_TEMPLATES)) {
            expect(template.label, `${key} missing label`).toBeDefined();
            expect(Array.isArray(template.sections), `${key} sections should be array`).toBe(true);
            expect(template.sections.length, `${key} should have sections`).toBeGreaterThan(0);
        }
    });

    it('each section should have type, label, and lines', () => {
        for (const [key, template] of Object.entries(STRUCTURE_TEMPLATES)) {
            for (const section of template.sections) {
                expect(section).toHaveProperty('type');
                expect(section).toHaveProperty('label');
                expect(section).toHaveProperty('lines');
                expect(typeof section.type).toBe('string');
                expect(typeof section.label).toBe('string');
                expect(typeof section.lines).toBe('number');
                expect(section.lines).toBeGreaterThan(0);
            }
        }
    });

    it('should include verse-chorus-verse-chorus template', () => {
        expect(STRUCTURE_TEMPLATES['verse-chorus-verse-chorus']).toBeDefined();
    });

    it('should include hip-hop template', () => {
        expect(STRUCTURE_TEMPLATES['hip-hop']).toBeDefined();
    });

    it('should include trap template', () => {
        expect(STRUCTURE_TEMPLATES['trap']).toBeDefined();
    });

    it('should include aaba (Tin Pan Alley) template', () => {
        expect(STRUCTURE_TEMPLATES['aaba']).toBeDefined();
    });
});

// ── SECTION_ROLES ──────────────────────────────────────────────────────────

describe('SECTION_ROLES', () => {
    it('should define roles for verse, chorus, bridge', () => {
        expect(SECTION_ROLES.verse).toBeDefined();
        expect(SECTION_ROLES.chorus).toBeDefined();
        expect(SECTION_ROLES.bridge).toBeDefined();
    });

    it('each role should have purpose and guidelines', () => {
        for (const [key, role] of Object.entries(SECTION_ROLES)) {
            expect(role.purpose, `${key} missing purpose`).toBeDefined();
            expect(role.guidelines, `${key} missing guidelines`).toBeDefined();
        }
    });

    it('should include intro, prechorus, and outro roles', () => {
        expect(SECTION_ROLES.intro).toBeDefined();
        expect(SECTION_ROLES.prechorus).toBeDefined();
        expect(SECTION_ROLES.outro).toBeDefined();
    });
});

// ── getStructure ────────��──────────────────────────────────────────────────

describe('getStructure', () => {
    it('should return structure for valid key', () => {
        const structure = getStructure('verse-chorus-verse-chorus');
        expect(structure).toBeDefined();
        expect(structure.sections.length).toBeGreaterThan(0);
    });

    it('should fallback to verse-chorus-verse-chorus for unknown key', () => {
        const structure = getStructure('nonexistent');
        expect(structure).toBeDefined();
        expect(structure.label).toBe(STRUCTURE_TEMPLATES['verse-chorus-verse-chorus'].label);
    });

    it('should return hip-hop structure correctly', () => {
        const structure = getStructure('hip-hop');
        // Hip-hop has hooks and verses
        const types = structure.sections.map(s => s.type);
        expect(types).toContain('chorus');
        expect(types).toContain('verse');
    });
});

// ── getAvailableStructures ────────���────────────────────────���───────────────

describe('getAvailableStructures', () => {
    it('should return array of key/label objects', () => {
        const structures = getAvailableStructures();
        expect(Array.isArray(structures)).toBe(true);
        expect(structures.length).toBeGreaterThanOrEqual(5);
    });

    it('each entry should have key and label', () => {
        const structures = getAvailableStructures();
        for (const s of structures) {
            expect(s).toHaveProperty('key');
            expect(s).toHaveProperty('label');
            expect(typeof s.key).toBe('string');
            expect(typeof s.label).toBe('string');
        }
    });

    it('keys should match STRUCTURE_TEMPLATES keys', () => {
        const structures = getAvailableStructures();
        const keys = structures.map(s => s.key);
        for (const key of Object.keys(STRUCTURE_TEMPLATES)) {
            expect(keys).toContain(key);
        }
    });
});

// ── getSectionRole ─────────────���───────────────────────────────────────────

describe('getSectionRole', () => {
    it('should return correct role for verse', () => {
        const role = getSectionRole('verse');
        expect(role.purpose).toContain('story');
    });

    it('should return correct role for chorus', () => {
        const role = getSectionRole('chorus');
        expect(role.purpose).toContain('hook');
    });

    it('should fallback to verse for unknown type', () => {
        const role = getSectionRole('unknown');
        expect(role).toEqual(SECTION_ROLES.verse);
    });
});

// ─��� buildGenerationPlan ──────────��─────────────────────────────────────────

describe('buildGenerationPlan', () => {
    it('should return array with role metadata', () => {
        const plan = buildGenerationPlan('verse-chorus-verse-chorus');
        expect(Array.isArray(plan)).toBe(true);
        expect(plan.length).toBeGreaterThan(0);
    });

    it('each entry should have type, label, lines, role, isRepeat', () => {
        const plan = buildGenerationPlan('verse-chorus-verse-chorus');
        for (const entry of plan) {
            expect(entry).toHaveProperty('type');
            expect(entry).toHaveProperty('label');
            expect(entry).toHaveProperty('lines');
            expect(entry).toHaveProperty('role');
            expect(entry).toHaveProperty('isRepeat');
        }
    });

    it('first chorus should not be repeat, second should be', () => {
        const plan = buildGenerationPlan('verse-chorus-verse-chorus');
        const choruses = plan.filter(e => e.type === 'chorus');
        expect(choruses[0].isRepeat).toBe(false);
        if (choruses.length > 1) {
            expect(choruses[1].isRepeat).toBe(true);
        }
    });

    it('should handle unknown structure key (fallback)', () => {
        const plan = buildGenerationPlan('nonexistent');
        expect(plan.length).toBeGreaterThan(0);
    });
});

// ── getRhymeSchemeForSection ────────────���──────────────────────────────────

describe('getRhymeSchemeForSection', () => {
    it('should return AABB for 4 lines', () => {
        const result = getRhymeSchemeForSection('verse', 4, 'AABB');
        expect(result).toBe('AABB');
    });

    it('should return ABAB for 4 lines', () => {
        const result = getRhymeSchemeForSection('verse', 4, 'ABAB');
        expect(result).toBe('ABAB');
    });

    it('should repeat pattern for longer sections', () => {
        const result = getRhymeSchemeForSection('verse', 8, 'AABB');
        expect(result).toBe('AABBAABB');
        expect(result).toHaveLength(8);
    });

    it('should truncate for shorter sections', () => {
        const result = getRhymeSchemeForSection('verse', 2, 'AABB');
        expect(result).toBe('AA');
        expect(result).toHaveLength(2);
    });

    it('freeform should return all X characters', () => {
        const result = getRhymeSchemeForSection('verse', 4, 'freeform');
        expect(result).toBe('XXXX');
    });

    it('Freeform (capitalized) should also work', () => {
        const result = getRhymeSchemeForSection('verse', 3, 'Freeform');
        expect(result).toBe('XXX');
    });

    it('should handle AAAA scheme', () => {
        const result = getRhymeSchemeForSection('chorus', 4, 'AAAA');
        expect(result).toBe('AAAA');
    });
});
