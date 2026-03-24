/**
 * StructureGenerator — Song structure templates and section management.
 * Builds song structures according to selected templates.
 */

// Available structure templates
const STRUCTURE_TEMPLATES = {
    'verse-chorus-verse-chorus': {
        label: 'Verse / Chorus / Verse / Chorus',
        sections: [
            { type: 'verse', label: 'Verse 1', lines: 4 },
            { type: 'chorus', label: 'Chorus', lines: 4 },
            { type: 'verse', label: 'Verse 2', lines: 4 },
            { type: 'chorus', label: 'Chorus', lines: 4 },
        ],
    },
    'verse-pre-chorus-bridge': {
        label: 'Verse / Pre-Chorus / Chorus / Bridge',
        sections: [
            { type: 'verse', label: 'Verse 1', lines: 4 },
            { type: 'prechorus', label: 'Pre-Chorus', lines: 2 },
            { type: 'chorus', label: 'Chorus', lines: 4 },
            { type: 'verse', label: 'Verse 2', lines: 4 },
            { type: 'prechorus', label: 'Pre-Chorus', lines: 2 },
            { type: 'chorus', label: 'Chorus', lines: 4 },
            { type: 'bridge', label: 'Bridge', lines: 4 },
            { type: 'chorus', label: 'Final Chorus', lines: 4 },
        ],
    },
    'intro-verse-chorus-bridge-outro': {
        label: 'Intro / Verse / Chorus / Bridge / Outro',
        sections: [
            { type: 'intro', label: 'Intro', lines: 2 },
            { type: 'verse', label: 'Verse 1', lines: 4 },
            { type: 'chorus', label: 'Chorus', lines: 4 },
            { type: 'verse', label: 'Verse 2', lines: 4 },
            { type: 'chorus', label: 'Chorus', lines: 4 },
            { type: 'bridge', label: 'Bridge', lines: 4 },
            { type: 'chorus', label: 'Final Chorus', lines: 4 },
            { type: 'outro', label: 'Outro', lines: 2 },
        ],
    },
    'aaba': {
        label: 'AABA (Tin Pan Alley)',
        sections: [
            { type: 'verse', label: 'A Section 1', lines: 4 },
            { type: 'verse', label: 'A Section 2', lines: 4 },
            { type: 'bridge', label: 'B Section', lines: 4 },
            { type: 'verse', label: 'A Section 3', lines: 4 },
        ],
    },
    'verse-only': {
        label: 'Verse Only (Ballad/Folk)',
        sections: [
            { type: 'verse', label: 'Verse 1', lines: 4 },
            { type: 'verse', label: 'Verse 2', lines: 4 },
            { type: 'verse', label: 'Verse 3', lines: 4 },
            { type: 'verse', label: 'Verse 4', lines: 4 },
        ],
    },
    'hip-hop': {
        label: 'Hip-Hop (Verse/Hook)',
        sections: [
            { type: 'chorus', label: 'Hook', lines: 4 },
            { type: 'verse', label: 'Verse 1', lines: 8 },
            { type: 'chorus', label: 'Hook', lines: 4 },
            { type: 'verse', label: 'Verse 2', lines: 8 },
            { type: 'chorus', label: 'Hook', lines: 4 },
            { type: 'verse', label: 'Verse 3', lines: 8 },
            { type: 'chorus', label: 'Hook', lines: 4 },
        ],
    },
    'trap': {
        label: 'Trap (Verse/Hook)',
        sections: [
            { type: 'chorus', label: 'Hook', lines: 4 },
            { type: 'verse', label: 'Verse 1', lines: 8 },
            { type: 'chorus', label: 'Hook', lines: 4 },
            { type: 'verse', label: 'Verse 2', lines: 8 },
            { type: 'chorus', label: 'Hook', lines: 4 },
            { type: 'verse', label: 'Verse 3', lines: 8 },
            { type: 'chorus', label: 'Hook', lines: 4 },
        ],
    },
    'drill': {
        label: 'Drill (Verse/Hook)',
        sections: [
            { type: 'chorus', label: 'Hook', lines: 4 },
            { type: 'verse', label: 'Verse 1', lines: 8 },
            { type: 'chorus', label: 'Hook', lines: 4 },
            { type: 'verse', label: 'Verse 2', lines: 8 },
            { type: 'chorus', label: 'Hook', lines: 4 },
        ],
    },
};

// Section roles for generation guidance
const SECTION_ROLES = {
    intro: {
        purpose: 'Set the scene and mood',
        guidelines: 'Short, atmospheric, may be instrumental cues or minimal lyrics',
    },
    verse: {
        purpose: 'Tell the story, build narrative',
        guidelines: 'Advance the plot or emotional arc. Each verse adds new detail.',
    },
    prechorus: {
        purpose: 'Build tension toward chorus',
        guidelines: 'Create anticipation. Shorter lines, building energy.',
    },
    chorus: {
        purpose: 'Deliver the hook and central message',
        guidelines: 'Memorable, repeatable. Contains the main hook phrase.',
    },
    bridge: {
        purpose: 'Contrast and emotional peak',
        guidelines: 'Offer a new perspective or emotional shift. Different melodic feel.',
    },
    outro: {
        purpose: 'Resolve and close',
        guidelines: 'Wind down. May repeat chorus elements or introduce final thoughts.',
    },
};

/**
 * Get a structure template by key.
 * @param {string} key
 * @returns {object}
 */
export function getStructure(key) {
    return STRUCTURE_TEMPLATES[key] || STRUCTURE_TEMPLATES['verse-chorus-verse-chorus'];
}

/**
 * Get all available structure template keys and labels.
 * @returns {Array<{key: string, label: string}>}
 */
export function getAvailableStructures() {
    return Object.entries(STRUCTURE_TEMPLATES).map(([key, val]) => ({
        key,
        label: val.label,
    }));
}

/**
 * Get the role/purpose for a section type.
 * @param {string} sectionType
 * @returns {object}
 */
export function getSectionRole(sectionType) {
    return SECTION_ROLES[sectionType] || SECTION_ROLES.verse;
}

/**
 * Build the generation plan — an ordered list of sections with metadata.
 * @param {string} structureKey
 * @returns {Array<{type: string, label: string, lines: number, role: object, isRepeat: boolean}>}
 */
export function buildGenerationPlan(structureKey) {
    const structure = getStructure(structureKey);
    const seen = {};
    return structure.sections.map(section => {
        const typeKey = `${section.type}_${section.label}`;
        const isRepeat = !!seen[section.type + '_chorus']; // chorus repeats
        if (section.type === 'chorus') seen[section.type + '_chorus'] = true;
        return {
            ...section,
            role: getSectionRole(section.type),
            isRepeat: section.type === 'chorus' && isRepeat,
        };
    });
}

/**
 * Determine rhyme scheme pattern for a given section type and line count.
 * @param {string} sectionType
 * @param {number} lineCount
 * @param {string} requestedScheme - 'AABB', 'ABAB', 'AAAA', 'freeform'
 * @returns {string} - rhyme pattern string e.g. 'AABB'
 */
export function getRhymeSchemeForSection(sectionType, lineCount, requestedScheme) {
    if (requestedScheme === 'freeform' || requestedScheme === 'Freeform') {
        return 'X'.repeat(lineCount);
    }

    const base = requestedScheme.toUpperCase();

    // Repeat the scheme pattern to cover all lines
    let pattern = '';
    while (pattern.length < lineCount) {
        pattern += base;
    }
    return pattern.slice(0, lineCount);
}

export { STRUCTURE_TEMPLATES, SECTION_ROLES };
