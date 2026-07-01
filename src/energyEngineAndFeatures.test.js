/**
 * Beat Energy Engine, Desktop Mute, Metadata Detection, RTL, Shuffle — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { applyEnergy, getEnergyProfile, generateEnergyMap, applyEnergyToArrangement } from './core/music-intelligence/EnergyEngine';

// ── Beat Energy Engine ──────────────────────────────────────────────────────

describe('EnergyEngine — applyEnergy', () => {
    const makeDrumPattern = () => ({
        kick: {
            powered: true, solo: false, mute: false,
            lanes: {
                root: {
                    pitch: 0,
                    pattern: [true, false, false, false, false, false, false, false,
                              false, false, false, false, false, false, false, false,
                              true, false, false, false, false, false, false, false,
                              false, false, false, false, false, false, false, false],
                    velocity: new Array(32).fill(80),
                    duration: new Array(32).fill(1)
                }
            }
        },
        closedHat: {
            powered: true, solo: false, mute: false,
            lanes: {
                root: {
                    pitch: 0,
                    pattern: [true, false, false, false, true, false, false, false,
                              true, false, false, false, true, false, false, false,
                              true, false, false, false, true, false, false, false,
                              true, false, false, false, true, false, false, false],
                    velocity: new Array(32).fill(70),
                    duration: new Array(32).fill(1)
                }
            }
        },
        perc: {
            powered: true, solo: false, mute: false,
            lanes: {
                root: {
                    pitch: 0,
                    pattern: new Array(32).fill(false),
                    velocity: new Array(32).fill(60),
                    duration: new Array(32).fill(1)
                }
            }
        }
    });

    it('should return a modified pattern (deep clone)', () => {
        const original = makeDrumPattern();
        const result = applyEnergy(original, 0.5);
        expect(result).not.toBe(original);
        expect(result.kick).toBeDefined();
        expect(result.closedHat).toBeDefined();
    });

    it('low energy should disable percussion', () => {
        const result = applyEnergy(makeDrumPattern(), 0.1);
        expect(result.perc.powered).toBe(false);
    });

    it('high energy should keep percussion enabled', () => {
        const result = applyEnergy(makeDrumPattern(), 0.9);
        expect(result.perc.powered).toBe(true);
    });

    it('should not mutate original pattern', () => {
        const original = makeDrumPattern();
        const origKickVel = [...original.kick.lanes.root.velocity];
        applyEnergy(original, 0.1);
        expect(original.kick.lanes.root.velocity).toEqual(origKickVel);
    });

    it('should handle null/empty input gracefully', () => {
        expect(applyEnergy(null, 0.5)).toBeNull();
        expect(applyEnergy({}, 0.5)).toEqual({});
    });
});

describe('EnergyEngine — getEnergyProfile', () => {
    it('should return correct profile labels at different levels', () => {
        expect(getEnergyProfile(0.05).label).toBe('Minimal');
        expect(getEnergyProfile(0.2).label).toBe('Low');
        expect(getEnergyProfile(0.4).label).toBe('Medium');
        expect(getEnergyProfile(0.6).label).toBe('Standard');
        expect(getEnergyProfile(0.75).label).toBe('High');
        expect(getEnergyProfile(0.95).label).toBe('Maximum');
    });

    it('each profile should have description, velocityScale, hatDensity, percEnabled, fillProb', () => {
        for (const level of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
            const p = getEnergyProfile(level);
            expect(p).toHaveProperty('label');
            expect(p).toHaveProperty('description');
            expect(p).toHaveProperty('velocityScale');
            expect(p).toHaveProperty('hatDensity');
            expect(p).toHaveProperty('percEnabled');
            expect(p).toHaveProperty('fillProb');
        }
    });
});

describe('EnergyEngine — generateEnergyMap & applyEnergyToArrangement', () => {
    it('should generate energy map from arrangement', () => {
        const arrangement = [
            { section: 'Intro', bars: 4, intensity: 0.3 },
            { section: 'Verse', bars: 8, intensity: 0.6 },
            { section: 'Chorus', bars: 8, intensity: 1.0 }
        ];
        const map = generateEnergyMap(arrangement);
        expect(map.length).toBe(3);
        expect(map[0].energy).toBe(0.3);
        expect(map[2].energy).toBe(1.0);
    });

    it('should apply energy map back to arrangement', () => {
        const arrangement = [
            { section: 'Intro', bars: 4 },
            { section: 'Verse', bars: 8 }
        ];
        const energyMap = [
            { sectionIndex: 0, energy: 0.2 },
            { sectionIndex: 1, energy: 0.8 }
        ];
        const result = applyEnergyToArrangement(arrangement, energyMap);
        expect(result[0].intensity).toBe(0.2);
        expect(result[1].intensity).toBe(0.8);
    });

    it('should handle empty inputs', () => {
        expect(generateEnergyMap([])).toEqual([]);
        expect(generateEnergyMap(null)).toEqual([]);
        expect(applyEnergyToArrangement(null, null)).toBeNull();
    });
});

// ── Desktop Mute Implementation ─────────────────────────────────────────────

describe('Desktop Mute — SamplerEngine source verification', () => {
    it('muteDesktopOutput should disconnect _softLimiter (not masterAnalyser)', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'SamplerEngine.js'), 'utf-8');
        // Should use _softLimiter, not masterAnalyser
        const muteSection = src.substring(src.indexOf('muteDesktopOutput'), src.indexOf('muteDesktopOutput') + 500);
        expect(muteSection).toContain('this._softLimiter.disconnect');
        expect(muteSection).toContain('this._softLimiter.connect');
        expect(muteSection).not.toContain('this.masterAnalyser.disconnect(this.audioContext.destination)');
    });
});

// ── Master Pan Implementation ───────────────────────────────────────────────

describe('Master Pan — SamplerEngine audio chain', () => {
    it('masterPanner should be connected in the audio chain (not a stub)', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'SamplerEngine.js'), 'utf-8');
        // Constructor should wire masterPanner into the chain
        expect(src).toContain('this.masterGain.connect(this.masterPanner)');
        expect(src).toContain('this.masterPanner.connect(this._softLimiter)');
        // Should NOT have the old "not connected" comment
        expect(src).not.toContain('masterPanner is NOT connected to the chain');
    });
});

// ── Metadata Detection ──────────────────────────────────────────────────────

describe('Metadata Detection — Browser source verification', () => {
    it('should render metadata badges in file tree', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'Browser.jsx'), 'utf-8');
        expect(src).toContain('extractMetadataFromFilename(item.name)');
        expect(src).toContain('meta.tempo');
        expect(src).toContain('meta.likelyKey');
    });
});

// ── RTL Support ─────────────────────────────────────────────────────────────

describe('RTL Support — LyricEngineTab source verification', () => {
    it('should have RTL language detection', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'lyrics/LyricEngineTab.jsx'), 'utf-8');
        expect(src).toContain('RTL_LANG_CODES');
        expect(src).toContain("direction: isRtl ? 'rtl' : 'ltr'");
    });
});

// ── Shuffle Slider ──────────────────────────────────────────────────────────

describe('Shuffle Slider — HumanizePanel source verification', () => {
    it('should include shuffle in slider list', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'HumanizePanel.jsx'), 'utf-8');
        expect(src).toContain("key: 'shuffle'");
    });

    it('humanizeParams default should include shuffle', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'FreallyAppComplete.jsx'), 'utf-8');
        expect(src).toContain('shuffle: 0');
    });
});

// ── Shift+D Shortcut ────────────────────────────────────────────────────────

describe('Shift+D Duplicate Shortcut', () => {
    it('should exist in global keyboard handler', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'FreallyAppComplete.jsx'), 'utf-8');
        expect(src).toContain("e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyD'");
    });

    it('should also exist in ArrangementTimeline handler', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'ArrangementTimeline.jsx'), 'utf-8');
        expect(src).toContain("e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === 'D'");
    });
});

// ── Playback Rate UI ────────────────────────────────────────────────────────

describe('Playback Rate — WaveformEditor', () => {
    it('should have speed state and SPEED knob', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.resolve(__dirname, 'WaveformEditor.jsx'), 'utf-8');
        expect(src).toContain('clip.playbackRate');
        expect(src).toContain('setSpeed');
        expect(src).toContain('SPEED');
        expect(src).toContain('playbackRate: speed');
    });
});
