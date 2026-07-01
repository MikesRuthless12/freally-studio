/**
 * Source Verification — Comprehensive Tests
 * Validates critical implementation details across the codebase
 * by reading source files and asserting key patterns exist.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (relPath) => readFileSync(resolve(__dirname, relPath), 'utf-8');

// ── FreallyAppComplete ���────────────────────────────────────────────────────

describe('FreallyAppComplete — critical implementation', () => {
    let src;
    beforeAll(() => { src = read('FreallyAppComplete.jsx'); });

    // Global state
    it('should have globalKey, globalScale, globalTempo state', () => {
        expect(src).toContain('globalKey');
        expect(src).toContain('globalScale');
        expect(src).toContain('globalTempo');
    });

    it('should have globalBars state', () => {
        expect(src).toContain('globalBars');
    });

    it('should have globalIsPlaying state', () => {
        expect(src).toContain('globalIsPlaying');
    });

    it('should have humanizeParams with shuffle', () => {
        expect(src).toContain('shuffle: 0');
    });

    it('should have MAX_AUDIO_HISTORY = 50', () => {
        expect(src).toContain('const MAX_AUDIO_HISTORY = 50');
    });

    // Tab system
    it('should have tabs for drums, chords, melody', () => {
        expect(src).toContain("'drums'");
        expect(src).toContain("'chords'");
        expect(src).toContain("'melody'");
    });

    // Undo/redo
    it('should integrate useUndoRedo hook', () => {
        expect(src).toContain('useUndoRedo');
        expect(src).toContain('pushSnapshot');
    });

    it('should restore trackAutomation from undo snapshots', () => {
        expect(src).toContain('snapshot.trackAutomation');
        expect(src).toContain('setTrackAutomation');
    });

    // Keyboard shortcuts
    it('should have Shift+D duplicate shortcut', () => {
        expect(src).toContain("e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyD'");
    });

    // Audio track management
    it('should have addAudioTrack function', () => {
        expect(src).toContain('addAudioTrack');
    });

    it('should have removeAudioTrack function', () => {
        expect(src).toContain('removeAudioTrack');
    });

    // Master volume/pan
    it('should have masterVolume state', () => {
        expect(src).toContain('masterVolume');
    });

    it('should have masterVolume state', () => {
        expect(src).toContain('masterVolume');
    });

    // Theme system
    it('should support dark/light theme', () => {
        expect(src).toContain('isDark');
    });

    it('should support accent themes', () => {
        expect(src).toContain('accentTheme');
    });
});

// ── useUndoRedo Hook ───────────────────────────────────────────────────────

describe('useUndoRedo — implementation', () => {
    let src;
    beforeAll(() => { src = read('useUndoRedo.js'); });

    it('should define MAX_HISTORY as 50', () => {
        expect(src).toContain('const MAX_HISTORY = 50');
    });

    it('should track automationString for change detection', () => {
        expect(src).toContain('automationString');
        expect(src).toContain('trackAutomation');
    });

    it('should export useUndoRedo function', () => {
        expect(src).toContain('export');
        expect(src).toContain('useUndoRedo');
    });
});

// ── useArrangement Hook ─────────────���──────────────────────────────────────

describe('useArrangement — implementation', () => {
    let src;
    beforeAll(() => { src = read('useArrangement.js'); });

    it('should define MAX_ARRANGEMENT_HISTORY as 50', () => {
        expect(src).toContain('const MAX_ARRANGEMENT_HISTORY = 50');
    });

    it('should export arrangement management functions', () => {
        expect(src).toContain('addSection');
        expect(src).toContain('removeSection');
        expect(src).toContain('duplicateSection');
        expect(src).toContain('moveSection');
    });
});

// ── DrumGeneratorEnhanced ──────��───────────────────────────────────────────

describe('DrumGeneratorEnhanced — implementation', () => {
    let src;
    beforeAll(() => { src = read('DrumGeneratorEnhanced.jsx'); });

    it('should use forwardRef', () => {
        expect(src).toContain('forwardRef');
    });

    it('should use useImperativeHandle', () => {
        expect(src).toContain('useImperativeHandle');
    });

    it('should have generate method', () => {
        expect(src).toContain('generate');
    });

    it('should manage drumStates', () => {
        expect(src).toContain('drumStates');
    });

    it('should support euclidean rhythms', () => {
        expect(src).toContain('euclidean');
    });
});

// ── SamplerEngine ──────────────────────────────────────────────────────────

describe('SamplerEngine — implementation', () => {
    let src;
    beforeAll(() => { src = read('SamplerEngine.js'); });

    it('should have track buses (drums, chords, melody, bass)', () => {
        expect(src).toContain('trackBuses');
    });

    it('should have muteDesktopOutput using _softLimiter', () => {
        const muteSection = src.substring(src.indexOf('muteDesktopOutput'), src.indexOf('muteDesktopOutput') + 500);
        expect(muteSection).toContain('this._softLimiter.disconnect');
        expect(muteSection).toContain('this._softLimiter.connect');
    });

    it('should have masterPanner connected in chain', () => {
        expect(src).toContain('this.masterGain.connect(this.masterPanner)');
        expect(src).toContain('this.masterPanner.connect(this._softLimiter)');
    });

    it('should have noteOn and noteOff methods', () => {
        expect(src).toContain('noteOn');
        expect(src).toContain('noteOff');
    });
});

// ── ArrangementTimeline ────────────────────────────────────────────────────

describe('ArrangementTimeline ��� implementation', () => {
    let src;
    beforeAll(() => { src = read('ArrangementTimeline.jsx'); });

    it('should have Shift+D duplicate shortcut', () => {
        expect(src).toContain("e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === 'D'");
    });

    it('should support audio track waveforms', () => {
        expect(src).toContain('waveform');
    });

    it('should support automation editing', () => {
        expect(src).toContain('automation');
    });
});

// ── Browser ─────────────────────────────────────���──────────────────────────

describe('Browser — implementation', () => {
    let src;
    beforeAll(() => { src = read('Browser.jsx'); });

    it('should extract metadata from filenames', () => {
        expect(src).toContain('extractMetadataFromFilename');
    });

    it('should display metadata badges', () => {
        expect(src).toContain('meta.tempo');
        expect(src).toContain('meta.likelyKey');
    });

    it('should support VST3 plugins tab', () => {
        expect(src).toContain('vst3');
    });
});

// ── HumanizePanel ───────────��───────────────────────────���──────────────────

describe('HumanizePanel — implementation', () => {
    let src;
    beforeAll(() => { src = read('HumanizePanel.jsx'); });

    it('should include shuffle in slider list', () => {
        expect(src).toContain("key: 'shuffle'");
    });

    it('should include swing slider', () => {
        expect(src).toContain("key: 'swing'");
    });

    it('should include velocityVariation slider', () => {
        expect(src).toContain("key: 'velocityVariation'");
    });

    it('should include timingJitter slider', () => {
        expect(src).toContain("key: 'timingJitter'");
    });

    it('should include ghostNotes slider', () => {
        expect(src).toContain("key: 'ghostNotes'");
    });
});

// ── WaveformEditor ─────────────────────────────────────────────────────────

describe('WaveformEditor — implementation', () => {
    let src;
    beforeAll(() => { src = read('WaveformEditor.jsx'); });

    it('should have playback rate / speed control', () => {
        expect(src).toContain('clip.playbackRate');
        expect(src).toContain('setSpeed');
        expect(src).toContain('SPEED');
        expect(src).toContain('playbackRate: speed');
    });

    it('should support pitch shifting', () => {
        expect(src).toContain('pitch');
    });

    it('should support fade in/out', () => {
        expect(src).toContain('fadeIn');
        expect(src).toContain('fadeOut');
    });

    it('should support trim start/end', () => {
        expect(src).toContain('trimStart');
        expect(src).toContain('trimEnd');
    });

    it('should support gain control', () => {
        expect(src).toContain('gain');
    });

    it('should support time stretch', () => {
        expect(src).toContain('timeStretch');
    });
});

// ── LyricEngineTab RTL support ─────────────────────────────────────────────

describe('LyricEngineTab — RTL support', () => {
    let src;
    beforeAll(() => { src = read('lyrics/LyricEngineTab.jsx'); });

    it('should detect RTL languages', () => {
        expect(src).toContain('RTL_LANG_CODES');
    });

    it('should apply RTL direction', () => {
        expect(src).toContain("direction: isRtl ? 'rtl' : 'ltr'");
    });
});

// ── Teleprompter ────────────���──────────────────────────────────────────────

describe('Teleprompter — implementation', () => {
    let src;
    beforeAll(() => { src = read('lyrics/Teleprompter.jsx'); });

    it('should have auto-scroll functionality', () => {
        expect(src).toContain('scrollIntoView');
    });

    it('should have font size control', () => {
        expect(src).toContain('fontSize');
    });
});

// ── RecordModePanel ──────────��─────────────────────────────────────────────

describe('RecordModePanel — implementation', () => {
    let src;
    beforeAll(() => { src = read('lyrics/RecordModePanel.jsx'); });

    it('should support recording mode', () => {
        expect(src).toContain('recording');
    });
});

// ── i18n system ──────────���─────────────────────────────────────────────────

describe('i18n — implementation', () => {
    it('should have i18n entry point', () => {
        const src = read('i18n/index.js');
        expect(src).toBeDefined();
    });

    it('should have I18nContext provider', () => {
        const src = read('i18n/I18nContext.jsx');
        expect(src).toContain('I18nContext');
    });
});

// ── Electron Bridge ──────────────���─────────────────────────────────────────

describe('electronBridge — implementation', () => {
    let src;
    beforeAll(() => { src = read('electronBridge.js'); });

    it('should export isElectron function', () => {
        expect(src).toContain('isElectron');
    });

    it('should export file operation functions', () => {
        expect(src).toContain('showFolderPicker');
        expect(src).toContain('showOpenFilePicker');
        expect(src).toContain('showSaveFilePicker');
    });
});
