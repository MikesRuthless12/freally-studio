/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EnergyEngine.js — Beat Energy Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Controls the intensity of beat sections by adjusting drum patterns based on
 * an energy level (0–1). Deterministic, rule-based — no AI APIs.
 *
 * API:
 *   applyEnergy(pattern, energyLevel, options?)  → modified drum pattern
 *   getEnergyProfile(energyLevel)                → { label, description, rules }
 *   generateEnergyMap(arrangement)               → array of per-section energy levels
 *   applyEnergyToArrangement(arrangement, energyMap) → arrangement with updated intensities
 *
 * Energy Levels:
 *   0.0–0.3  Low     — fewer drums, lower velocities, minimal percussion
 *   0.3–0.6  Medium  — normal groove, standard hat density
 *   0.6–1.0  High    — extra hats, percussion layers, velocity boosts, drum fills
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const DRUM_LANES = ['lane_2', 'lane_1', 'root', 'lane_neg1', 'lane_neg2'];

// Which drum elements are considered core vs auxiliary
const CORE_DRUMS = new Set(['kick', '808', 'snare', 'clap']);
const HAT_DRUMS = new Set(['closedHat', 'openHat']);
const PERC_DRUMS = new Set(['perc', 'rim', 'offSnare']);

const STEPS_PER_BAR = 32;

// ─── Energy Profiles ────────────────────────────────────────────────────────

const ENERGY_PROFILES = {
    minimal:  { label: 'Minimal',  range: [0.0, 0.15], velocityScale: 0.55, hatDensity: 0.0,  percEnabled: false, fillProb: 0.0  },
    low:      { label: 'Low',      range: [0.15, 0.3], velocityScale: 0.7,  hatDensity: 0.25, percEnabled: false, fillProb: 0.0  },
    medium:   { label: 'Medium',   range: [0.3, 0.5],  velocityScale: 0.85, hatDensity: 0.6,  percEnabled: true,  fillProb: 0.1  },
    standard: { label: 'Standard', range: [0.5, 0.7],  velocityScale: 1.0,  hatDensity: 1.0,  percEnabled: true,  fillProb: 0.2  },
    high:     { label: 'High',     range: [0.7, 0.85], velocityScale: 1.1,  hatDensity: 1.4,  percEnabled: true,  fillProb: 0.35 },
    max:      { label: 'Maximum',  range: [0.85, 1.0], velocityScale: 1.2,  hatDensity: 1.8,  percEnabled: true,  fillProb: 0.5  },
};

function getProfileForLevel(level) {
    const clamped = Math.max(0, Math.min(1, level));
    for (const key of Object.keys(ENERGY_PROFILES)) {
        const p = ENERGY_PROFILES[key];
        if (clamped >= p.range[0] && clamped < p.range[1]) return p;
    }
    return ENERGY_PROFILES.max;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clonePattern(drumStates) {
    const result = {};
    for (const drumId of Object.keys(drumStates)) {
        const drum = drumStates[drumId];
        const lanes = {};
        for (const laneId of Object.keys(drum.lanes || {})) {
            const lane = drum.lanes[laneId];
            lanes[laneId] = {
                pitch: lane.pitch,
                pattern: [...lane.pattern],
                velocity: [...lane.velocity],
                duration: [...lane.duration],
            };
        }
        result[drumId] = {
            powered: drum.powered,
            solo: drum.solo,
            mute: drum.mute,
            sample: drum.sample,
            lanes,
        };
    }
    return result;
}

function countActiveSteps(lanes) {
    let count = 0;
    for (const laneId of Object.keys(lanes)) {
        for (let i = 0; i < lanes[laneId].pattern.length; i++) {
            if (lanes[laneId].pattern[i]) count++;
        }
    }
    return count;
}

function seededRandom(seed) {
    let s = seed | 0 || (Date.now() | 0);
    return function () {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        return (s >>> 0) / 4294967296;
    };
}

// ─── Core Transforms ────────────────────────────────────────────────────────

/**
 * Scale velocities for a drum element's lanes.
 */
function scaleVelocities(lanes, scale) {
    for (const laneId of Object.keys(lanes)) {
        const lane = lanes[laneId];
        for (let i = 0; i < lane.velocity.length; i++) {
            if (lane.pattern[i]) {
                lane.velocity[i] = Math.round(Math.max(10, Math.min(100, lane.velocity[i] * scale)));
            }
        }
    }
}

/**
 * Thin out a pattern by removing steps based on a keepRatio (0–1).
 * Preserves beats on quarter notes (0, 8, 16, 24 per bar) preferentially.
 */
function thinPattern(lanes, keepRatio, rand) {
    const totalSteps = lanes.root ? lanes.root.pattern.length : 0;
    if (totalSteps === 0) return;

    for (const laneId of Object.keys(lanes)) {
        const lane = lanes[laneId];
        for (let i = 0; i < lane.pattern.length; i++) {
            if (!lane.pattern[i]) continue;

            // Quarter-note positions are more likely to be kept
            const stepInBar = i % STEPS_PER_BAR;
            const isQuarter = stepInBar % 8 === 0;
            const isEighth = stepInBar % 4 === 0;

            let threshold = keepRatio;
            if (isQuarter) threshold = Math.min(1, keepRatio + 0.4);
            else if (isEighth) threshold = Math.min(1, keepRatio + 0.15);

            if (rand() > threshold) {
                lane.pattern[i] = false;
            }
        }
    }
}

/**
 * Add extra hi-hat steps to increase hat density.
 * densityMultiplier > 1 adds 8th/16th notes between existing hits.
 */
function densifyHats(lanes, densityMultiplier, rand) {
    if (densityMultiplier <= 1.0) return;

    const rootLane = lanes.root;
    if (!rootLane) return;

    const totalSteps = rootLane.pattern.length;
    const addProb = Math.min(0.8, (densityMultiplier - 1.0) * 0.6);

    for (let i = 0; i < totalSteps; i++) {
        if (rootLane.pattern[i]) continue;

        const stepInBar = i % STEPS_PER_BAR;
        const isEighth = stepInBar % 4 === 0;
        const isSixteenth = stepInBar % 2 === 0;

        let prob = 0;
        if (isEighth) prob = addProb;
        else if (isSixteenth) prob = addProb * 0.5;
        else prob = addProb * 0.15;

        if (rand() < prob) {
            rootLane.pattern[i] = true;
            // Softer ghost notes for added hats
            rootLane.velocity[i] = Math.round(50 + rand() * 30);
            rootLane.duration[i] = 1;
        }
    }
}

/**
 * Add drum fills at the end of sections (last bar or last 2 bars).
 * Fills add rapid snare/hat hits on the final beats.
 */
function addFills(drumStates, totalSteps, fillProb, rand) {
    if (fillProb <= 0 || totalSteps < STEPS_PER_BAR) return;

    const totalBars = totalSteps / STEPS_PER_BAR;

    // Only add fills at the end of every 4-bar phrase
    for (let bar = 3; bar < totalBars; bar += 4) {
        if (rand() > fillProb) continue;

        const fillStart = bar * STEPS_PER_BAR + 24; // last 8 steps of the bar
        const fillEnd = (bar + 1) * STEPS_PER_BAR;

        // Snare fill
        const snareId = drumStates.snare ? 'snare' : (drumStates.clap ? 'clap' : null);
        if (snareId && drumStates[snareId]) {
            const snareLanes = drumStates[snareId].lanes;
            const rootLane = snareLanes.root;
            if (rootLane) {
                for (let i = fillStart; i < Math.min(fillEnd, rootLane.pattern.length); i += 2) {
                    if (!rootLane.pattern[i]) {
                        rootLane.pattern[i] = true;
                        // Crescendo velocity through the fill
                        const progress = (i - fillStart) / (fillEnd - fillStart);
                        rootLane.velocity[i] = Math.round(60 + progress * 35);
                        rootLane.duration[i] = 1;
                    }
                }
            }
        }

        // Hi-hat roll during fill
        const hatId = drumStates.closedHat ? 'closedHat' : null;
        if (hatId && drumStates[hatId]) {
            const hatLanes = drumStates[hatId].lanes;
            const rootLane = hatLanes.root;
            if (rootLane) {
                for (let i = fillStart; i < Math.min(fillEnd, rootLane.pattern.length); i++) {
                    if (!rootLane.pattern[i]) {
                        rootLane.pattern[i] = true;
                        rootLane.velocity[i] = Math.round(40 + rand() * 30);
                        rootLane.duration[i] = 1;
                    }
                }
            }
        }
    }
}

/**
 * Disable (power off) percussion elements at low energy.
 */
function togglePercPower(drumStates, percEnabled) {
    for (const drumId of Object.keys(drumStates)) {
        if (PERC_DRUMS.has(drumId)) {
            drumStates[drumId].powered = percEnabled;
        }
    }
}

// ─── Main API ───────────────────────────────────────────────────────────────

/**
 * Apply energy level to a drum pattern.
 *
 * @param {object} pattern - WavLoom drum state object (keyed by drum element ID)
 * @param {number} energyLevel - 0.0 to 1.0
 * @param {object} [options]
 * @param {number} [options.seed] - For deterministic results
 * @param {boolean} [options.preserveCore=true] - Keep kick/snare skeleton at low energy
 * @returns {object} Modified drum state (deep clone, original is untouched)
 */
export function applyEnergy(pattern, energyLevel, options = {}) {
    if (!pattern || typeof pattern !== 'object') return pattern;

    const { seed, preserveCore = true } = options;
    const rand = seededRandom(seed);
    const level = Math.max(0, Math.min(1, energyLevel));
    const profile = getProfileForLevel(level);

    const result = clonePattern(pattern);

    for (const drumId of Object.keys(result)) {
        const drum = result[drumId];
        if (!drum.lanes) continue;

        const isCore = CORE_DRUMS.has(drumId);
        const isHat = HAT_DRUMS.has(drumId);
        const isPerc = PERC_DRUMS.has(drumId);

        // 1. Velocity scaling — all elements
        scaleVelocities(drum.lanes, profile.velocityScale);

        // 2. Pattern thinning for non-core at low energy
        if (!isCore || !preserveCore) {
            if (level < 0.5) {
                const keepRatio = 0.4 + level * 1.2; // 0.4 at 0, 1.0 at 0.5
                thinPattern(drum.lanes, keepRatio, rand);
            }
        }

        // Even core drums get thinned at very low energy (unless preserveCore)
        if (isCore && !preserveCore && level < 0.2) {
            thinPattern(drum.lanes, 0.5 + level * 2.5, rand);
        }

        // 3. Hat density adjustment
        if (isHat) {
            if (level < 0.3) {
                // Thin hats at low energy
                thinPattern(drum.lanes, 0.3 + level, rand);
            } else if (profile.hatDensity > 1.0) {
                // Densify hats at high energy
                densifyHats(drum.lanes, profile.hatDensity, rand);
            }
        }

        // 4. Percussion toggle
        if (isPerc) {
            drum.powered = profile.percEnabled;
            if (!profile.percEnabled) {
                // Clear percussion patterns at low energy
                for (const laneId of Object.keys(drum.lanes)) {
                    drum.lanes[laneId].pattern = drum.lanes[laneId].pattern.map(() => false);
                }
            }
        }
    }

    // 5. Drum fills at high energy
    if (profile.fillProb > 0) {
        const totalSteps = getTotalSteps(result);
        addFills(result, totalSteps, profile.fillProb, rand);
    }

    return result;
}

/**
 * Get descriptive profile for a given energy level.
 *
 * @param {number} energyLevel - 0.0 to 1.0
 * @returns {{ label: string, description: string, velocityScale: number, hatDensity: number, percEnabled: boolean, fillProb: number }}
 */
export function getEnergyProfile(energyLevel) {
    const profile = getProfileForLevel(energyLevel);

    const descriptions = {
        Minimal:  'Stripped back — kick and snare only, very low velocity',
        Low:      'Sparse groove — subtle hats, no percussion layers',
        Medium:   'Balanced — standard hat density, light percussion',
        Standard: 'Full groove — all elements active, normal dynamics',
        High:     'Energetic — extra hat patterns, occasional fills',
        Maximum:  'Peak intensity — dense hats, percussion layers, frequent fills',
    };

    return {
        label: profile.label,
        description: descriptions[profile.label] || '',
        velocityScale: profile.velocityScale,
        hatDensity: profile.hatDensity,
        percEnabled: profile.percEnabled,
        fillProb: profile.fillProb,
    };
}

/**
 * Generate an energy map from an arrangement (array of section objects).
 * Uses each section's existing intensity as the energy level.
 *
 * @param {Array<{section: string, bars: number, intensity: number}>} arrangement
 * @returns {Array<{sectionIndex: number, section: string, bars: number, energy: number}>}
 */
export function generateEnergyMap(arrangement) {
    if (!arrangement || !arrangement.length) return [];

    return arrangement.map((sec, i) => ({
        sectionIndex: i,
        section: sec.section || sec.name || `Section ${i + 1}`,
        bars: sec.bars,
        energy: sec.intensity ?? sec._intensity ?? 0.5,
    }));
}

/**
 * Apply an energy map back to an arrangement, updating intensity values.
 *
 * @param {Array<object>} arrangement - Original arrangement sections
 * @param {Array<{sectionIndex: number, energy: number}>} energyMap
 * @returns {Array<object>} New arrangement with updated intensities
 */
export function applyEnergyToArrangement(arrangement, energyMap) {
    if (!arrangement || !energyMap) return arrangement;

    return arrangement.map((sec, i) => {
        const mapped = energyMap.find(m => m.sectionIndex === i);
        if (!mapped) return sec;

        return {
            ...sec,
            intensity: Math.round(mapped.energy * 100) / 100,
            _intensity: Math.round(mapped.energy * 100) / 100,
        };
    });
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function getTotalSteps(drumStates) {
    for (const drumId of Object.keys(drumStates)) {
        const lanes = drumStates[drumId]?.lanes;
        if (lanes?.root?.pattern) return lanes.root.pattern.length;
        for (const laneId of Object.keys(lanes || {})) {
            if (lanes[laneId]?.pattern) return lanes[laneId].pattern.length;
        }
    }
    return 0;
}
