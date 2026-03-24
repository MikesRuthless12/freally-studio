import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { SamplerEngine } from './SamplerEngine';
import { AudioExporterEnhanced } from './AudioExporterEnhanced';
import Browser from './Browser';
import { AudioEffect } from './effects/AudioEffect.js';
import './AudioEngine';
import './LibraryManager';
import DrumGeneratorEnhanced from './DrumGeneratorEnhanced';
import ChordGeneratorEnhanced from './ChordGeneratorEnhanced';
import MelodyBassGeneratorEnhanced from './MelodyBassGeneratorEnhanced';
import { SCALES, NOTE_NAMES } from './MusicTheory';
import { GENRE_CATEGORIES, GENRE_DEFINITIONS } from './domain/genres';
import { MOOD_MODIFIERS } from './domain/moods';
import { generateAllPatterns, determineComplexity, humanizePattern, createVariation, generateCounterMelody } from './PatternEngine';
import { loopMelodicPattern, loopDrumPattern } from './patternUtils';
import { getProPattern } from './drumPatterns';
import HumanizePanel from './HumanizePanel';
import { useCollaboration } from './collab/useCollaboration';
import { useTimeTracker } from './collab/TimeTracker';
import CollabPanel from './collab/CollabPanel';
import TabGuard from './collab/TabGuard';
import CursorMap from './collab/CursorMap';
import GoogleAuth from './collab/GoogleAuth';
import { useToast, ToastContainer } from './collab/Toast';
import { ProjectManager } from './ProjectManager';
import { useUndoRedo } from './useUndoRedo';
import { useMetronome } from './useMetronome';
import MixerPanel from './MixerPanel';
import AdaptiveMixPanel from './components/AdaptiveMixPanel';
import EffectsRack from './EffectsRack';
import { EffectsManager } from './effects/EffectsManager';
import './effects/effectRegistry'; // Register all effect types
import { AudioRecorder, splitAudioIntoSections } from './AudioRecorder';
import { useArrangement } from './useArrangement';
import ArrangementTimeline from './ArrangementTimeline';
import { buildDefaultTrackOrder, DEFAULT_CORE_ORDER } from './trackOrderUtils';
import { interpolateAutomation, denormalizeValue } from './automationUtils';
import MIDIParser from './MIDIParser';
import { MIDIInput } from './MIDIInput';
import MIDIInputPanel from './MIDIInputPanel';
import { PresetManager } from './PresetManager';
import MobileLinkButton from './mobilelink/MobileLinkButton';
import MobileLinkModal from './mobilelink/MobileLinkModal';
import { useMobileLink } from './mobilelink/useMobileLink';
import { MOBILE_MSG } from './mobilelink/MobileLinkProtocol';
import SuggestionPanel from './SuggestionPanel';
import { OnboardingTour, shouldShowTour, resetTour } from './OnboardingTour';
import { SettingsModal, loadSettings, applyTooltipSetting } from './SettingsModal';
import { useTranslation } from './i18n/I18nContext.jsx';
import { formatMixFilename, formatStemFilename, formatArrangementFilename, formatStemsZipFilename } from './filenameUtils';
import { ACCENT_THEMES, SOLID_ACCENT_KEYS, GRADIENT_ACCENT_KEYS, DEFAULT_ACCENT_THEME, getAccentTheme, hexToRgba } from './accentThemes';
import WindowControls from './WindowControls';
import CpuMeter from './CpuMeter';
import { isElectron } from './electronBridge';
const DrumSynthStudio = lazy(() => import('./DrumSynthStudio'));
const InstrumentSynthStudio = lazy(() => import('./InstrumentSynthStudio'));
const LyricsTab = lazy(() => import('./lyrics/LyricsTab'));
const LyricEngineTab = lazy(() => import('./lyrics/LyricEngineTab'));
const RecordModePanel = lazy(() => import('./lyrics/RecordModePanel'));

import MidiTrackEditor from './MidiTrackEditor';
import './App.css';



/**
 * Compute absolute timelineBar from legacy sectionId + startBar.
 * Returns the bar offset from timeline start.
 */
function computeTimelineBar(clip, arrangement) {
    if (clip.timelineBar != null) return clip.timelineBar;
    let cumBars = 0;
    for (const section of arrangement) {
        if (section.id === clip.sectionId) {
            return cumBars + (clip.startBar || 0);
        }
        cumBars += section.bars;
    }
    return clip.startBar || 0; // fallback
}

/**
 * Batch-migrate all clips on all audio tracks to use timelineBar.
 */
function migrateClipsToTimeline(audioTracks, arrangement) {
    return audioTracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => {
            if (clip.timelineBar != null) return clip;
            return { ...clip, timelineBar: computeTimelineBar(clip, arrangement) };
        })
    }));
}

const WavLoomAppComplete = () => {
    const { t } = useTranslation();

    // Theme
    const [theme, setTheme] = useState(() => localStorage.getItem('wavloom-theme') || 'dark');
    const isDark = theme === 'dark';

    // Accent color theme
    const [accentTheme, setAccentTheme] = useState(() => localStorage.getItem('wavloom-accent') || DEFAULT_ACCENT_THEME);
    const [showAccentPicker, setShowAccentPicker] = useState(false);
    const accentPickerRef = useRef(null);
    const accent = getAccentTheme(accentTheme);
    const ac = accent.accent;
    const acSec = accent.secondary;
    const acGrad = accent.gradient;

    // Core instances
    const samplerRef = useRef(new SamplerEngine());
    window.__samplerRef = samplerRef.current; // Expose for idle diagnostics
    const exporterRef = useRef(null);
    const presetManagerRef = useRef(new PresetManager());
    const midiInputRef = useRef(new MIDIInput());
    const [midiOctaveOffset, setMidiOctaveOffset] = useState(0);

    // Initialize exporter after sampler + route preview engine through master chain
    useEffect(() => {
        exporterRef.current = new AudioExporterEnhanced(samplerRef.current);
        // Route file-explorer AudioEngine through SamplerEngine's master chain
        // so preview audio is included in Mobile Link and affected by desktop mute.
        if (window.audioEngine) {
            samplerRef.current.routePreviewEngine(window.audioEngine);
        }
    }, []);

    // Mobile Link
    const [showMobileLinkModal, setShowMobileLinkModal] = useState(false);
    const mobileLink = useMobileLink(samplerRef.current);

    // VST3 auto-scan on first load (Electron only)
    const [vst3InitialScanDone, setVst3InitialScanDone] = useState(!isElectron());
    const [vst3InitialScanPlugins, setVst3InitialScanPlugins] = useState([]);
    useEffect(() => {
        if (!isElectron() || !window.electronAPI?.vst3) return;
        // Auto-scan using cache (fast if cache exists, full scan if not)
        window.electronAPI.vst3.scan(false).then((result) => {
            if (result && result.plugins) {
                setVst3InitialScanPlugins(result.plugins);
            }
            setVst3InitialScanDone(true);
        }).catch(() => {
            setVst3InitialScanDone(true); // Don't block on error
        });
    }, []);

    // Persist theme + accent to localStorage and inject CSS custom properties
    useEffect(() => {
        localStorage.setItem('wavloom-theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('wavloom-accent', accentTheme);
        const acTheme = getAccentTheme(accentTheme);
        const root = document.documentElement;
        root.style.setProperty('--accent', acTheme.accent);
        root.style.setProperty('--accent-secondary', acTheme.secondary);
        root.style.setProperty('--accent-gradient', acTheme.gradient);
        root.style.setProperty('--accent-glow', hexToRgba(acTheme.accent, 0.35));
    }, [accentTheme]);

    // Close accent picker on outside click
    useEffect(() => {
        if (!showAccentPicker) return;
        const handler = (e) => {
            if (accentPickerRef.current && !accentPickerRef.current.contains(e.target)) {
                setShowAccentPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAccentPicker]);

    // Active tab
    const [activeTab, setActiveTab] = useState('drums');

    // Lyrics imported from Lyric Engine → Lyrics Studio (includes genre/mood/bpm)
    const [importedLyrics, setImportedLyrics] = useState('');
    const [importedLyricsGenre, setImportedLyricsGenre] = useState('');
    const [importedLyricsMood, setImportedLyricsMood] = useState('');
    const [importedLyricsBpm, setImportedLyricsBpm] = useState(0);

    // Selected folder from file explorer
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // Undo/Redo Hook
    const { undo, redo, pushSnapshot, canUndo, canRedo } = useUndoRedo();

    // Arrangement Hook
    const arr = useArrangement();
    const [arrangeMaximized, setArrangeMaximized] = useState(false);
    const [arrangeSelectedRow, setArrangeSelectedRow] = useState(null); // track row selected in arrangement
    const [arrangeEffectTrackId, setArrangeEffectTrackId] = useState(null); // resolved effectTrackId for selected row
    const [showMainMixer, setShowMainMixer] = useState(false);

    // Audio Tracks (up to 20 user audio tracks for the arrangement)
    const AUDIO_TRACK_COLORS = ['#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4', '#feca57', '#ff6348', '#7bed9f', '#70a1ff', '#dfe6e9', '#fd79a8', '#e056fd', '#18dcff', '#7d5fff', '#32ff7e', '#ffcccc', '#ff7979', '#badc58', '#f9ca24', '#6ab04c', '#c7ecee'];
    const MAX_AUDIO_TRACKS = 100;
    const [audioTracks, setAudioTracks] = useState([]);
    // Each: { id, name, color, clips: [] }
    // Each clip: { id, sectionId, buffer, name, playbackRate, trimStart, trimEnd, reversed, pitch, fadeIn, fadeOut }
    const audioTrackIdCounter = useRef(0);
    const audioClipIdCounter = useRef(0);

    /**
     * Find the lowest unused number for a track name with a given prefix.
     * E.g. if tracks are ["Vocal 1", "Vocal 3"], returns "Vocal 2".
     * If all 1..N are taken, returns "Vocal (N+1)".
     * @param {Array} existingTracks — array of track objects with .name
     * @param {string} prefix — e.g. "Vocal", "Audio", "MIDI"
     * @returns {string} next available name like "Vocal 2"
     */
    const getNextTrackName = (existingTracks, prefix) => {
        const usedNumbers = new Set();
        const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`);
        for (const t of existingTracks) {
            const m = t.name && t.name.match(pattern);
            if (m) usedNumbers.add(parseInt(m[1], 10));
        }
        for (let i = 1; i <= 100; i++) {
            if (!usedNumbers.has(i)) return `${prefix} ${i}`;
        }
        return `${prefix} ${existingTracks.length + 1}`;
    };

    const addAudioGuard = useRef(false);
    const addAudioTrack = useCallback((customName, afterTrackId, trackType = 'audio') => {
        if (addAudioGuard.current) return null;
        addAudioGuard.current = true;
        const id = `audio_${Date.now()}_${++audioTrackIdCounter.current}`;
        setAudioTracks(prev => {
            if (prev.length >= MAX_AUDIO_TRACKS) return prev;
            const name = (typeof customName === 'string' && customName) ? customName : getNextTrackName(prev, 'Audio');
            const color = AUDIO_TRACK_COLORS[prev.length % AUDIO_TRACK_COLORS.length];
            if (samplerRef.current) samplerRef.current.addTrackBus(id);
            setTrackMix(prevMix => ({ ...prevMix, [id]: { volume: 0.5, pan: 0 } }));
            const newTrack = { id, name, color, clips: [], trackType };
            if (afterTrackId) {
                const idx = prev.findIndex(t => t.id === afterTrackId);
                if (idx >= 0) {
                    const next = [...prev];
                    next.splice(idx + 1, 0, newTrack);
                    return next;
                }
            }
            return [...prev, newTrack];
        });
        requestAnimationFrame(() => { addAudioGuard.current = false; });
        return id;
    }, []);

    const removeAudioTrack = useCallback((trackId) => {
        setAudioTracks(prev => {
            if (samplerRef.current) samplerRef.current.removeTrackBus(trackId);
            if (effectsManagerRef.current) effectsManagerRef.current.removeTrackChain(trackId);
            return prev.filter(t => t.id !== trackId);
        });
    }, []);

    const renameAudioTrack = useCallback((trackId, name) => {
        setAudioTracks(prev => prev.map(t => t.id === trackId ? { ...t, name } : t));
    }, []);

    const addClipToTrack = useCallback((trackId, sectionId, buffer, name, props) => {
        const clipId = `clip_${Date.now()}_${++audioClipIdCounter.current}`;
        setAudioTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            return {
                ...t,
                clips: [...t.clips, {
                    id: clipId, sectionId, buffer, name: name || 'Audio Clip',
                    playbackRate: 1.0, trimStart: 0, trimEnd: 0,
                    reversed: false, pitch: 0, fadeIn: 0, fadeOut: 0, startBar: 0,
                    timelineBar: null, // absolute bar position from timeline start (null = legacy, compute from sectionId+startBar)
                    ...(props || {})
                }]
            };
        }));
    }, []);

    const updateClip = useCallback((trackId, clipId, updates) => {
        setAudioTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            return {
                ...t,
                clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
            };
        }));
    }, []);

    const removeClip = useCallback((trackId, clipId) => {
        setAudioTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
        }));
    }, []);

    // Ref for audioTracks so the rAF tick loop can read the latest state
    const audioTracksRef = useRef(audioTracks);
    useEffect(() => {
        audioTracksRef.current = audioTracks;
        // Dynamically update active audio sources when clip properties change during
        // playback (e.g. time stretch, pitch). This avoids stopping/restarting audio.
        if (globalIsPlayingRef.current && activeAudioClipSources.current.length > 0) {
            activeAudioClipSources.current.forEach(entry => {
                if (!entry._clipId || !entry._trackId || !entry.source) return;
                const track = audioTracks.find(t => t.id === entry._trackId);
                if (!track) return;
                const clip = track.clips.find(c => c.id === entry._clipId);
                if (!clip) return;
                const newRate = clip.playbackRate || Math.pow(2, (clip.pitch || 0) / 12);
                if (entry._playbackRate !== newRate) {
                    try { entry.source.playbackRate.value = newRate; } catch (_) {}
                    entry._playbackRate = newRate;
                }
            });
        }
    }, [audioTracks]);

    // ─── MIDI Tracks (up to 25 user-created piano-roll MIDI tracks) ───
    // Each: { id, name, color, clips: [], instrumentId: null, instrumentName: '', octave: 3 }
    const MIDI_TRACK_COLORS = ['#ff6b9d', '#c56cf0', '#7bed9f', '#70a1ff', '#ffa502', '#ff4757', '#2ed573', '#1e90ff', '#ff6348', '#5f27cd', '#01a3a4', '#feca57', '#a29bfe', '#fd79a8', '#e056fd', '#00cec9', '#fdcb6e', '#6c5ce7', '#55efc4', '#fab1a0', '#74b9ff', '#a4b0be', '#dfe6e9', '#636e72', '#b2bec3'];
    const MAX_MIDI_TRACKS = 100;
    const [midiTracks, setMidiTracks] = useState([]);
    const midiTrackIdCounter = useRef(0);
    const midiClipIdCounter = useRef(0);
    const [editingMidiTrack, setEditingMidiTrack] = useState(null); // trackId of MIDI track being edited in modal
    const [editingMidiClipId, setEditingMidiClipId] = useState(null); // clipId of MIDI clip being edited in modal
    const [focusedMidiClipTrackId, setFocusedMidiClipTrackId] = useState(null); // trackId of MIDI track focused in arrangement clip editor
    const midiTracksRef = useRef(midiTracks);
    useEffect(() => { midiTracksRef.current = midiTracks; }, [midiTracks]);

    // ─── VST3 Instrument instances per track ───
    // Maps trackId → { node: VST3InstrumentNode, pluginInfo: { name, path, uid } }
    const vst3InstrumentsRef = useRef(new Map());
    // UI state: tracks which tracks have VST3 plugins loaded (all track types)
    // Maps trackId/trackKey → { name, path, uid, isInstrument }
    const [vst3TrackPlugins, setVst3TrackPlugins] = useState({});
    // Tracks which VST3 editor GUIs are currently open
    const [vst3EditorOpenTracks, setVst3EditorOpenTracks] = useState(new Set());

    const addMidiGuard = useRef(false);
    const addMidiTrack = useCallback((customName, afterTrackId) => {
        if (addMidiGuard.current) return null;
        addMidiGuard.current = true;
        const id = `midi_${Date.now()}_${++midiTrackIdCounter.current}`;
        setMidiTracks(prev => {
            if (prev.length >= MAX_MIDI_TRACKS) return prev;
            const name = (typeof customName === 'string' && customName) ? customName : getNextTrackName(prev, 'MIDI');
            const color = MIDI_TRACK_COLORS[prev.length % MIDI_TRACK_COLORS.length];
            if (samplerRef.current) samplerRef.current.addTrackBus(id);
            setTrackMix(prevMix => ({ ...prevMix, [id]: { volume: 0.5, pan: 0 } }));
            const newTrack = { id, name, color, clips: [], instrumentId: null, instrumentName: '', octave: 3 };
            if (afterTrackId) {
                const idx = prev.findIndex(t => t.id === afterTrackId);
                if (idx >= 0) {
                    const next = [...prev];
                    next.splice(idx + 1, 0, newTrack);
                    return next;
                }
            }
            return [...prev, newTrack];
        });
        requestAnimationFrame(() => { addMidiGuard.current = false; });
        return id;
    }, []);

    const removeMidiTrack = useCallback((trackId) => {
        // Cleanup VST3 instrument if assigned
        const vst3 = vst3InstrumentsRef.current.get(trackId);
        if (vst3?.node) {
            vst3.node.dispose();
            vst3InstrumentsRef.current.delete(trackId);
            if (samplerRef.current) samplerRef.current.setVST3Instrument(trackId, null);
        }
        setMidiTracks(prev => {
            if (samplerRef.current) samplerRef.current.removeTrackBus(trackId);
            if (effectsManagerRef.current) effectsManagerRef.current.removeTrackChain(trackId);
            return prev.filter(t => t.id !== trackId);
        });
        setTrackMix(prev => { const next = { ...prev }; delete next[trackId]; return next; });
        setGlobalMutes(prev => { const next = new Set(prev); next.delete(trackId); return next; });
        setGlobalSolos(prev => { const next = new Set(prev); next.delete(trackId); return next; });
        if (editingMidiTrack === trackId) setEditingMidiTrack(null);
    }, [editingMidiTrack]);

    const renameMidiTrack = useCallback((trackId, name) => {
        setMidiTracks(prev => prev.map(t => t.id === trackId ? { ...t, name } : t));
    }, []);

    const reorderMidiTrack = useCallback((trackId, direction) => {
        setMidiTracks(prev => {
            const idx = prev.findIndex(t => t.id === trackId);
            if (idx < 0) return prev;
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
            return next;
        });
    }, []);

    const reorderAudioTrack = useCallback((trackId, direction) => {
        setAudioTracks(prev => {
            const idx = prev.findIndex(t => t.id === trackId);
            if (idx < 0) return prev;
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
            return next;
        });
    }, []);

    // Unified track ordering — drives arrangement view + mixer strip order
    const [trackOrder, setTrackOrder] = useState(null);

    // Keep trackOrder in sync with track additions/removals
    useEffect(() => {
        setTrackOrder(prev => {
            if (!prev) return buildDefaultTrackOrder(midiTracks, audioTracks);
            const midiIds = new Set(midiTracks.map(t => t.id));
            const audioIds = new Set(audioTracks.map(t => t.id));
            const coreIds = new Set(['drums', 'chords', 'melody', 'bass']);
            // Remove entries for deleted tracks
            const filtered = prev.filter(entry => {
                if (entry.type === 'core') return coreIds.has(entry.id);
                if (entry.type === 'midi') return midiIds.has(entry.id);
                if (entry.type === 'audio') return audioIds.has(entry.id);
                return false;
            });
            // Ensure all 4 core tracks are present
            const existingCoreIds = new Set(filtered.filter(e => e.type === 'core').map(e => e.id));
            const missingCores = DEFAULT_CORE_ORDER.filter(c => !existingCoreIds.has(c.id));
            // Add new tracks not yet in the order
            const existingIds = new Set(filtered.map(e => e.id));
            const newMidi = midiTracks.filter(t => !existingIds.has(t.id)).map(t => ({ type: 'midi', id: t.id }));
            const newAudio = audioTracks.filter(t => !existingIds.has(t.id)).map(t => ({ type: 'audio', id: t.id }));
            if (missingCores.length === 0 && newMidi.length === 0 && newAudio.length === 0 && filtered.length === prev.length) {
                return prev; // No changes
            }
            return [...missingCores, ...filtered, ...newMidi, ...newAudio];
        });
    }, [midiTracks, audioTracks]);

    const reorderTrack = useCallback((trackId, direction) => {
        setTrackOrder(prev => {
            if (!prev) return prev;
            const idx = prev.findIndex(e => e.id === trackId);
            if (idx < 0) return prev;
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
            return next;
        });
    }, []);

    const moveTrackToIndex = useCallback((trackId, targetIndex) => {
        setTrackOrder(prev => {
            if (!prev) return prev;
            const srcIdx = prev.findIndex(e => e.id === trackId);
            if (srcIdx < 0 || srcIdx === targetIndex) return prev;
            const next = [...prev];
            const [removed] = next.splice(srcIdx, 1);
            next.splice(targetIndex, 0, removed);
            return next;
        });
    }, []);

    // Legacy compat: update pattern by replacing/creating a single clip
    const updateMidiTrackPattern = useCallback((trackId, pattern) => {
        setMidiTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            // If track has clips, update the first clip's pattern
            if (t.clips && t.clips.length > 0) {
                const updatedClips = [...t.clips];
                updatedClips[0] = { ...updatedClips[0], pattern };
                return { ...t, clips: updatedClips };
            }
            // Otherwise create a single clip from the pattern
            if (pattern && pattern.length > 0) {
                return { ...t, clips: [{ id: `mclip_${Date.now()}_${++midiClipIdCounter.current}`, timelineBar: 0, bars: 4, pattern, name: 'MIDI Clip', color: null }] };
            }
            return { ...t, clips: [] };
        }));
    }, []);

    const addMidiClip = useCallback((trackId, clip) => {
        const clipId = clip.id || `mclip_${Date.now()}_${++midiClipIdCounter.current}`;
        setMidiTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            return { ...t, clips: [...(t.clips || []), { ...clip, id: clipId }] };
        }));
        return clipId;
    }, []);

    const updateMidiClip = useCallback((trackId, clipId, updates) => {
        setMidiTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            return { ...t, clips: (t.clips || []).map(c => c.id === clipId ? { ...c, ...updates } : c) };
        }));
    }, []);

    const removeMidiClip = useCallback((trackId, clipId) => {
        setMidiTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            return { ...t, clips: (t.clips || []).filter(c => c.id !== clipId) };
        }));
    }, []);

    const moveMidiClip = useCallback((trackId, clipId, newTimelineBar) => {
        setMidiTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            return { ...t, clips: (t.clips || []).map(c => c.id === clipId ? { ...c, timelineBar: newTimelineBar } : c) };
        }));
    }, []);

    const updateMidiTrackInstrument = useCallback((trackId, instrumentId, instrumentName) => {
        setMidiTracks(prev => prev.map(t => t.id === trackId ? { ...t, instrumentId, instrumentName } : t));
    }, []);

    const updateMidiTrackOctave = useCallback((trackId, octave) => {
        setMidiTracks(prev => prev.map(t => t.id === trackId ? { ...t, octave } : t));
    }, []);

    // ─── Drum Clips (clip-based timeline for drum track) ───
    // Each clip: { id, timelineBar, bars, drumStates (sans AudioBuffer), name, color }
    const DRUM_CLIP_COLORS = ['#ff6b6b', '#ffa502', '#7bed9f', '#70a1ff', '#c56cf0', '#ff4757', '#2ed573', '#1e90ff', '#feca57', '#5f27cd'];
    const [drumClips, setDrumClips] = useState([]);
    const drumClipIdCounter = useRef(0);
    const drumClipsRef = useRef(drumClips);
    useEffect(() => { drumClipsRef.current = drumClips; }, [drumClips]);
    const [editingDrumClipId, setEditingDrumClipId] = useState(null);

    const addDrumClip = useCallback((clip) => {
        const clipId = clip.id || `dclip_${Date.now()}_${++drumClipIdCounter.current}`;
        const color = clip.color || DRUM_CLIP_COLORS[drumClipIdCounter.current % DRUM_CLIP_COLORS.length];
        setDrumClips(prev => [...prev, { ...clip, id: clipId, color }]);
        return clipId;
    }, []);

    const updateDrumClip = useCallback((clipId, updates) => {
        setDrumClips(prev => prev.map(c => c.id === clipId ? { ...c, ...updates } : c));
    }, []);

    const removeDrumClip = useCallback((clipId) => {
        setDrumClips(prev => {
            // Prevent deleting the last drum clip — ensures arrangement always has drums
            if (prev.length <= 1) return prev;
            return prev.filter(c => c.id !== clipId);
        });
        setEditingDrumClipId(prev => prev === clipId ? null : prev);
    }, []);

    const moveDrumClip = useCallback((clipId, newTimelineBar) => {
        setDrumClips(prev => prev.map(c => c.id === clipId ? { ...c, timelineBar: newTimelineBar } : c));
    }, []);

    // ─── Drum Lane Clips (per-element: 808, kick, snare, etc.) ───
    // Each clip: { id, timelineBar, bars, drumId, laneData: { powered, lanes: { root: { pattern, velocity, duration } } }, name, color }
    const [drumLaneClips, setDrumLaneClips] = useState({});
    const drumLaneClipIdCounter = useRef(0);
    const drumLaneClipsRef = useRef(drumLaneClips);
    useEffect(() => { drumLaneClipsRef.current = drumLaneClips; }, [drumLaneClips]);

    const addDrumLaneClip = useCallback((drumId, clip) => {
        const clipId = clip.id || `dlclip_${Date.now()}_${++drumLaneClipIdCounter.current}`;
        const color = clip.color || DRUM_CLIP_COLORS[drumLaneClipIdCounter.current % DRUM_CLIP_COLORS.length];
        setDrumLaneClips(prev => ({
            ...prev,
            [drumId]: [...(prev[drumId] || []), { ...clip, id: clipId, drumId, color }]
        }));
        return clipId;
    }, []);

    const updateDrumLaneClip = useCallback((drumId, clipId, updates) => {
        setDrumLaneClips(prev => ({
            ...prev,
            [drumId]: (prev[drumId] || []).map(c => c.id === clipId ? { ...c, ...updates } : c)
        }));
    }, []);

    const removeDrumLaneClip = useCallback((drumId, clipId) => {
        setDrumLaneClips(prev => ({
            ...prev,
            [drumId]: (prev[drumId] || []).filter(c => c.id !== clipId)
        }));
    }, []);

    // Helper: split a collapsed drum clip's drumStates into individual drum lane clips
    const splitDrumStatesIntoLaneClips = useCallback((drumStates, timelineBar, bars) => {
        if (!drumStates || typeof drumStates !== 'object') return;
        const drumIds = Object.keys(drumStates);
        for (const drumId of drumIds) {
            const drumData = drumStates[drumId];
            if (!drumData || !drumData.lanes) continue;
            // Check if a lane clip already exists at this position for this drum
            const existing = (drumLaneClipsRef.current[drumId] || []).find(c => (c.timelineBar || 0) === timelineBar);
            if (existing) {
                updateDrumLaneClip(drumId, existing.id, { bars, laneData: JSON.parse(JSON.stringify(drumData)) });
            } else {
                addDrumLaneClip(drumId, {
                    timelineBar,
                    bars,
                    laneData: JSON.parse(JSON.stringify(drumData)),
                    name: drumId.charAt(0).toUpperCase() + drumId.slice(1)
                });
            }
        }
    }, [addDrumLaneClip, updateDrumLaneClip]);

    const moveDrumLaneClip = useCallback((drumId, clipId, newTimelineBar) => {
        setDrumLaneClips(prev => ({
            ...prev,
            [drumId]: (prev[drumId] || []).map(c => c.id === clipId ? { ...c, timelineBar: newTimelineBar } : c)
        }));
    }, []);

    // ─── Chord Clips (clip-based timeline for chords track) ───
    const CHORD_CLIP_COLORS = ['#c56cf0', '#7bed9f', '#70a1ff', '#ffa502', '#ff6b6b', '#2ed573', '#1e90ff', '#feca57', '#5f27cd', '#01a3a4'];
    const [chordClips, setChordClips] = useState([]);
    const chordClipIdCounter = useRef(0);
    const chordClipsRef = useRef(chordClips);
    useEffect(() => { chordClipsRef.current = chordClips; }, [chordClips]);
    const [editingChordClipId, setEditingChordClipId] = useState(null);

    const addChordClip = useCallback((clip) => {
        const clipId = clip.id || `cclip_${Date.now()}_${++chordClipIdCounter.current}`;
        const color = clip.color || CHORD_CLIP_COLORS[chordClipIdCounter.current % CHORD_CLIP_COLORS.length];
        setChordClips(prev => [...prev, { ...clip, id: clipId, color }]);
        return clipId;
    }, []);
    const updateChordClip = useCallback((clipId, updates) => {
        setChordClips(prev => prev.map(c => c.id === clipId ? { ...c, ...updates } : c));
    }, []);
    const removeChordClip = useCallback((clipId) => {
        setChordClips(prev => prev.filter(c => c.id !== clipId));
        setEditingChordClipId(prev => prev === clipId ? null : prev);
    }, []);
    const moveChordClip = useCallback((clipId, newTimelineBar) => {
        setChordClips(prev => prev.map(c => c.id === clipId ? { ...c, timelineBar: newTimelineBar } : c));
    }, []);

    // ─── Melody Clips (clip-based timeline for melody track) ───
    const MELODY_CLIP_COLORS = ['#70a1ff', '#ff6b6b', '#ffa502', '#c56cf0', '#7bed9f', '#2ed573', '#1e90ff', '#feca57', '#5f27cd', '#01a3a4'];
    const [melodyClips, setMelodyClips] = useState([]);
    const melodyClipIdCounter = useRef(0);
    const melodyClipsRef = useRef(melodyClips);
    useEffect(() => { melodyClipsRef.current = melodyClips; }, [melodyClips]);
    const [editingMelodyClipId, setEditingMelodyClipId] = useState(null);

    const addMelodyClip = useCallback((clip) => {
        const clipId = clip.id || `melclip_${Date.now()}_${++melodyClipIdCounter.current}`;
        const color = clip.color || MELODY_CLIP_COLORS[melodyClipIdCounter.current % MELODY_CLIP_COLORS.length];
        setMelodyClips(prev => [...prev, { ...clip, id: clipId, color }]);
        return clipId;
    }, []);
    const updateMelodyClip = useCallback((clipId, updates) => {
        setMelodyClips(prev => prev.map(c => c.id === clipId ? { ...c, ...updates } : c));
    }, []);
    const removeMelodyClip = useCallback((clipId) => {
        setMelodyClips(prev => prev.filter(c => c.id !== clipId));
        setEditingMelodyClipId(prev => prev === clipId ? null : prev);
    }, []);
    const moveMelodyClip = useCallback((clipId, newTimelineBar) => {
        setMelodyClips(prev => prev.map(c => c.id === clipId ? { ...c, timelineBar: newTimelineBar } : c));
    }, []);

    // ─── Bass Clips (clip-based timeline for bass track) ───
    const BASS_CLIP_COLORS = ['#2ed573', '#ffa502', '#70a1ff', '#c56cf0', '#ff6b6b', '#7bed9f', '#1e90ff', '#feca57', '#5f27cd', '#01a3a4'];
    const [bassClips, setBassClips] = useState([]);
    const bassClipIdCounter = useRef(0);
    const bassClipsRef = useRef(bassClips);
    useEffect(() => { bassClipsRef.current = bassClips; }, [bassClips]);
    const [editingBassClipId, setEditingBassClipId] = useState(null);

    const addBassClip = useCallback((clip) => {
        const clipId = clip.id || `bclip_${Date.now()}_${++bassClipIdCounter.current}`;
        const color = clip.color || BASS_CLIP_COLORS[bassClipIdCounter.current % BASS_CLIP_COLORS.length];
        setBassClips(prev => [...prev, { ...clip, id: clipId, color }]);
        return clipId;
    }, []);
    const updateBassClip = useCallback((clipId, updates) => {
        setBassClips(prev => prev.map(c => c.id === clipId ? { ...c, ...updates } : c));
    }, []);
    const removeBassClip = useCallback((clipId) => {
        setBassClips(prev => prev.filter(c => c.id !== clipId));
        setEditingBassClipId(prev => prev === clipId ? null : prev);
    }, []);
    const moveBassClip = useCallback((clipId, newTimelineBar) => {
        setBassClips(prev => prev.map(c => c.id === clipId ? { ...c, timelineBar: newTimelineBar } : c));
    }, []);

    // ── globalBars must be declared before the resize effect that depends on it ──
    const [globalBars, setGlobalBars] = useState(4);

    // ── Resize all clips when globalBars changes (loop/truncate patterns) ──
    const prevGlobalBarsRef = useRef(null);
    useEffect(() => {
        const prevBars = prevGlobalBarsRef.current;
        prevGlobalBarsRef.current = globalBars;
        if (prevBars == null || prevBars === globalBars) return;

        const newSteps = globalBars * 32;

        // Helper: loop/truncate a note pattern (chords/melody/bass)
        const resizeNotePattern = (pattern, oldBars) => {
            if (!pattern || pattern.length === 0) return pattern;
            const oldSteps = oldBars * 32;
            // Find the actual content length (max time + duration in the pattern)
            const maxTime = Math.max(...pattern.map(n => n.time + (n.duration || 1)));
            // Use the smaller of oldSteps or actual content as the base loop length
            const baseSteps = Math.min(oldSteps, maxTime > 0 ? Math.ceil(maxTime / 32) * 32 : oldSteps);
            if (baseSteps <= 0) return pattern;

            if (newSteps <= baseSteps) {
                // Truncate: keep only notes that fit
                return pattern.filter(n => n.time < newSteps).map(n => ({
                    ...n,
                    duration: Math.min(n.duration, newSteps - n.time)
                }));
            }
            // Loop: repeat the base pattern to fill newSteps
            const result = [];
            for (let offset = 0; offset < newSteps; offset += baseSteps) {
                for (const n of pattern) {
                    if (n.time >= baseSteps) continue;
                    const newTime = n.time + offset;
                    if (newTime >= newSteps) continue;
                    result.push({
                        ...n,
                        time: newTime,
                        duration: Math.min(n.duration, newSteps - newTime)
                    });
                }
            }
            return result;
        };

        // Helper: loop/truncate drum pattern arrays
        const resizeDrumStates = (drumStates, oldBars) => {
            if (!drumStates) return drumStates;
            const oldSteps = oldBars * 32;
            const newDs = {};
            for (const [drumId, drum] of Object.entries(drumStates)) {
                const newDrum = { ...drum, lanes: {} };
                for (const [laneId, lane] of Object.entries(drum.lanes || {})) {
                    const oldPattern = lane.pattern || [];
                    const oldVelocity = lane.velocity || [];
                    const oldDuration = lane.duration || [];
                    const baseLen = Math.min(oldSteps, oldPattern.length);
                    if (baseLen <= 0) {
                        newDrum.lanes[laneId] = { ...lane };
                        continue;
                    }
                    const newPattern = new Array(newSteps).fill(false);
                    const newVelocity = new Array(newSteps).fill(100);
                    const newDur = new Array(newSteps).fill(1);
                    for (let i = 0; i < newSteps; i++) {
                        const srcIdx = i % baseLen;
                        newPattern[i] = oldPattern[srcIdx] || false;
                        newVelocity[i] = oldVelocity[srcIdx] || 100;
                        newDur[i] = oldDuration[srcIdx] || 1;
                    }
                    newDrum.lanes[laneId] = { ...lane, pattern: newPattern, velocity: newVelocity, duration: newDur };
                }
                newDs[drumId] = newDrum;
            }
            return newDs;
        };

        // Update chord clips
        setChordClips(prev => prev.map(c => ({
            ...c,
            bars: globalBars,
            pattern: resizeNotePattern(c.pattern, c.bars || prevBars)
        })));

        // Update melody clips
        setMelodyClips(prev => prev.map(c => ({
            ...c,
            bars: globalBars,
            pattern: resizeNotePattern(c.pattern, c.bars || prevBars)
        })));

        // Update bass clips
        setBassClips(prev => prev.map(c => ({
            ...c,
            bars: globalBars,
            pattern: resizeNotePattern(c.pattern, c.bars || prevBars)
        })));

        // Update drum clips
        setDrumClips(prev => prev.map(c => ({
            ...c,
            bars: globalBars,
            drumStates: resizeDrumStates(c.drumStates, c.bars || prevBars)
        })));
    }, [globalBars]);

    const loadVST3OnTrack = useCallback(async (trackId, pluginInfo, isInstrument) => {
        if (!window.electronAPI?.vst3Host) {
            addToast('VST3 plugins require the desktop (Electron) version of WavLoom', 'warning');
            return;
        }

        // Auto-detect: MIDI tracks should use instrument loading by default.
        // The scanner may not detect instrument categories for all plugins,
        // so if the target is a MIDI track, prefer instrument mode.
        if (!isInstrument && (trackId.startsWith('midi_') || ['drums', 'chords', 'melody', 'bass'].includes(trackId))) {
            isInstrument = true;
            console.log(`[VST3] Auto-detected instrument mode for MIDI track ${trackId}`);
        }
        const sampler = samplerRef.current;
        if (!sampler) return;

        // Remove any existing VST3 on this track first
        const existing = vst3InstrumentsRef.current.get(trackId);
        if (existing?.node) {
            // Close editor first, then unload — must be sequential to avoid crash
            if (existing.node.instanceId && window.electronAPI?.vst3Host?.closeEditor) {
                try { await window.electronAPI.vst3Host.closeEditor(existing.node.instanceId); } catch (_) {}
            }
            if (existing.node.instanceId && window.electronAPI?.vst3Host?.unloadPlugin) {
                try { await window.electronAPI.vst3Host.unloadPlugin(existing.node.instanceId); } catch (_) {}
                existing.node.instanceId = null;
                existing.node._loaded = false;
            }
            existing.node.dispose();
            vst3InstrumentsRef.current.delete(trackId);
            // Clear editor open state for this track
            setVst3EditorOpenTracks(prev => {
                const next = new Set(prev);
                next.delete(trackId);
                return next;
            });
        }

        // Set UI state IMMEDIATELY so gear icon and plugin name show right away
        // (before the async native load which may take time or fail)
        const pluginMeta = { name: pluginInfo.name, path: pluginInfo.path, uid: pluginInfo.uid, isInstrument };
        setVst3TrackPlugins(prev => ({ ...prev, [trackId]: pluginMeta }));
        if (isInstrument) {
            setMidiTracks(prev => prev.map(t =>
                t.id === trackId ? { ...t, vst3Instrument: pluginMeta, name: pluginInfo.name || t.name } : t
            ));
        } else {
            // Update audio track name to plugin name for mixer display
            setAudioTracks(prev => prev.map(t =>
                t.id === trackId ? { ...t, name: pluginInfo.name || t.name } : t
            ));
        }

        // Ensure AudioContext is running before any VST3 audio work
        const _ctx = sampler.audioContext;
        try { window.electronAPI?.debug?.log(`[VST3 DEBUG] ctx.state=${_ctx.state} before resume`); } catch (_) {}
        if (_ctx.state !== 'running') {
            try { await _ctx.resume(); } catch (_) {}
        }
        try { window.electronAPI?.debug?.log(`[VST3 DEBUG] ctx.state=${_ctx.state} after resume`); } catch (_) {}

        // DIAGNOSTIC A: Oscillator → audioContext.destination DIRECTLY
        // If you hear a 3-second 660Hz beep, the AudioContext itself works.
        try {
            const _testOscDirect = _ctx.createOscillator();
            const _testGainDirect = _ctx.createGain();
            _testGainDirect.gain.value = 0.3;
            _testOscDirect.frequency.value = 660;
            _testOscDirect.connect(_testGainDirect);
            _testGainDirect.connect(_ctx.destination);
            _testOscDirect.start();
            window.electronAPI?.debug?.log(`[VST3 DEBUG] DIAG-A: 660Hz osc → destination DIRECTLY, ctx=${_ctx.state}`);
            setTimeout(() => { try { _testOscDirect.stop(); _testOscDirect.disconnect(); _testGainDirect.disconnect(); } catch(_){} }, 3000);
        } catch (e) {
            try { window.electronAPI?.debug?.log(`[VST3 DEBUG] DIAG-A ERROR: ${e.message}`); } catch (_) {}
        }

        if (isInstrument) {
            // Load as VST3 instrument (MIDI → audio)
            try {
                try { window.electronAPI?.debug?.log('[VST3 DEBUG] Starting instrument load...'); } catch (_) {}
                const { VST3InstrumentNode } = await import('./vst3/VST3InstrumentNode.js');
                try { window.electronAPI?.debug?.log('[VST3 DEBUG] VST3InstrumentNode imported OK'); } catch (_) {}
                const node = new VST3InstrumentNode(pluginInfo);
                await node.load(_ctx);
                try { window.electronAPI?.debug?.log('[VST3 DEBUG] node.load() completed OK'); } catch (_) {}
                // Sync native addon sample rate to match AudioContext
                try { await window.electronAPI.vst3Host.setSampleRate(_ctx.sampleRate); } catch (_) {}
                // Connect to track bus (create one if it doesn't exist yet)
                let bus = sampler.getTrackBus(trackId);
                try { window.electronAPI?.debug?.log(`[VST3 DEBUG] getTrackBus(${trackId})=${bus ? 'exists' : 'null'}`); } catch (_) {}
                if (!bus) {
                    bus = sampler.addTrackBus(trackId);
                    try { window.electronAPI?.debug?.log(`[VST3 DEBUG] addTrackBus created bus=${bus ? 'ok' : 'null'}`); } catch (_) {}
                }
                if (bus) {
                    node.connectTo(bus.gainNode);
                    try { window.electronAPI?.debug?.log('[VST3 DEBUG] node connected to bus.gainNode'); } catch (_) {}

                    // DIAGNOSTIC B: Oscillator → bus.gainNode (tests bus→master→destination)
                    const _testOsc = _ctx.createOscillator();
                    const _testGain = _ctx.createGain();
                    _testGain.gain.value = 0.3;
                    _testOsc.frequency.value = 880;
                    _testOsc.connect(_testGain);
                    _testGain.connect(bus.gainNode);
                    _testOsc.start();
                    try { window.electronAPI?.debug?.log(`[VST3 DEBUG] DIAG-B: 880Hz osc → bus ${trackId}`); } catch (_) {}
                    setTimeout(() => { try { _testOsc.stop(); _testOsc.disconnect(); _testGain.disconnect(); } catch(_){} }, 3000);
                } else {
                    try { window.electronAPI?.debug?.log('[VST3 DEBUG] BUS IS NULL after addTrackBus!'); } catch (_) {}
                }
                vst3InstrumentsRef.current.set(trackId, { node, pluginInfo });
                // Register with SamplerEngine so generators route through VST3
                sampler.setVST3Instrument(trackId, node);
                console.log(`[VST3] Loaded instrument "${pluginInfo.name}" on track ${trackId}`);
                // Auto-open editor if setting is enabled
                const settings = loadSettings();
                if (settings.autoOpenPluginWindows) {
                    setTimeout(() => openVST3Editor(trackId), 100);
                }
            } catch (err) {
                console.warn('[VST3] Failed to load instrument:', err);
                try { window.electronAPI?.debug?.log(`[VST3 DEBUG] CATCH ERROR: ${err.message || err}`); } catch (_) {}
                addToast(`Failed to load VST3 instrument: ${err.message || err}`, 'error');
            }
        } else {
            // Load as VST3 effect on the track's effects chain
            try {
                const { VST3EffectNode } = await import('./vst3/VST3EffectNode.js');
                const effectNode = new VST3EffectNode(pluginInfo);
                await effectNode.load();
                const mgr = effectsManagerRef.current;
                if (mgr) {
                    const chain = mgr.getOrCreateTrackChain(trackId);
                    if (chain) {
                        chain.addEffect(effectNode);
                        sampler.insertEffectsChain(trackId, chain);
                    }
                }
                // Store in ref map so openVST3Editor can find the instanceId
                vst3InstrumentsRef.current.set(trackId, { node: effectNode, pluginInfo });
                console.log(`[VST3] Loaded effect "${pluginInfo.name}" on track ${trackId}`);
                // Auto-open editor if setting is enabled
                const settings = loadSettings();
                if (settings.autoOpenPluginWindows) {
                    setTimeout(() => openVST3Editor(trackId), 100);
                }
            } catch (err) {
                console.warn('[VST3] Failed to load effect:', err);
                addToast(`Failed to load VST3 effect: ${err.message || err}`, 'error');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const removeVST3FromTrack = useCallback((trackId) => {
        const existing = vst3InstrumentsRef.current.get(trackId);
        if (existing?.node) {
            existing.node.dispose();
            vst3InstrumentsRef.current.delete(trackId);
        }
        // Unregister from SamplerEngine
        if (samplerRef.current) {
            samplerRef.current.setVST3Instrument(trackId, null);
        }
        setMidiTracks(prev => prev.map(t =>
            t.id === trackId ? { ...t, vst3Instrument: null } : t
        ));
        // Clear from UI tracking state
        setVst3TrackPlugins(prev => {
            const next = { ...prev };
            delete next[trackId];
            return next;
        });
        // Clear editor open state
        setVst3EditorOpenTracks(prev => {
            const next = new Set(prev);
            next.delete(trackId);
            return next;
        });
    }, []);

    const openVST3Editor = useCallback(async (trackId) => {
        // addToast is declared later in the component but accessible at call time via closure
        const toast = (msg, type) => { if (typeof addToast === 'function') addToast(msg, type); };

        const vst3 = vst3InstrumentsRef.current.get(trackId);
        if (!vst3?.node?.instanceId) {
            const hasAddon = !!(await window.electronAPI?.vst3Host?.isAvailable?.().catch(() => false));
            if (!hasAddon) {
                toast('Plugin editor unavailable — native VST3 addon not loaded', 'warning');
            } else {
                toast('Plugin failed to load natively. Try removing and re-loading the plugin.', 'warning');
            }
            console.warn('[VST3] No plugin instance on track', trackId, 'node:', vst3?.node, 'instanceId:', vst3?.node?.instanceId);
            return;
        }
        if (!window.electronAPI?.vst3Host?.openEditor) {
            toast('Plugin editor requires the desktop (Electron) version', 'warning');
            return;
        }

        // Toggle: if editor is already open, close it
        try {
            const isOpen = await window.electronAPI.vst3Host.isEditorOpen(vst3.node.instanceId);
            if (isOpen) {
                await window.electronAPI.vst3Host.closeEditor(vst3.node.instanceId);
                setVst3EditorOpenTracks(prev => {
                    const next = new Set(prev);
                    next.delete(trackId);
                    return next;
                });
                return;
            }
        } catch (_) { /* if isEditorOpen fails, proceed to open */ }

        // Open the editor
        try {
            const result = await window.electronAPI.vst3Host.openEditor(vst3.node.instanceId);
            if (result?.success) {
                setVst3EditorOpenTracks(prev => {
                    const next = new Set(prev);
                    next.add(trackId);
                    return next;
                });
            } else {
                toast(result?.error || 'This plugin does not have a GUI editor', 'warning');
            }
        } catch (err) {
            toast('Failed to open plugin editor: ' + (err.message || err), 'error');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // NOTE: handleBounceMidiTrack, MIDI playback polling, and playback reset
    // are defined later (after globalBars, globalTempo, globalSolos, etc. are declared)

    // Active audio clip source nodes — stopped on section change or playback stop
    const activeAudioClipSources = useRef([]); // [{ source, gainNode }]

    // Pattern storage for export
    const [patterns, setPatterns] = useState({ drums: [], chords: [], melody: [], bass: [] });

    // Humanization parameters — applied during generation and via the APPLY button
    const [humanizeParams, setHumanizeParams] = useState({ swing: 30, velocityVariation: 20, timingJitter: 10, ghostNotes: 15 });

    // Auto-save banner
    const [showAutosaveBanner, setShowAutosaveBanner] = useState(false);
    const [autosaveTimestamp, setAutosaveTimestamp] = useState(null);

    // Generation seed display
    const [lastSeed, setLastSeed] = useState(null);

    // Sample loading indicator
    const [isLoadingSamples, setIsLoadingSamples] = useState(false);
    const sampleLoadCountRef = useRef(0);


    // Master Volume (0 to 1)
    const [masterVolume, setMasterVolume] = useState(0.7);

    // Mixer Panel — default at 0.5 for proper gain staging
    // (4 tracks at 0.5 sum to ~0 dB, leaving headroom for the limiter)
    const [trackMix, setTrackMix] = useState({
        drums: { volume: 0.5, pan: 0 },
        chords: { volume: 0.5, pan: 0 },
        melody: { volume: 0.5, pan: 0 },
        bass: { volume: 0.5, pan: 0 }
    });
    // Track automation data: { [trackId]: { [paramKey]: [ { bar, value, curve }, ... ] } }
    const [trackAutomation, setTrackAutomation] = useState({});
    const trackAutomationRef = useRef(trackAutomation);
    useEffect(() => { trackAutomationRef.current = trackAutomation; }, [trackAutomation]);

    // ── Audio track undo/redo history ──
    // Snapshots audioTracks metadata (without buffers — those are immutable refs)
    // and trackAutomation state for Ctrl+Z / Ctrl+Shift+Z in arrange tab.
    const MAX_AUDIO_HISTORY = 20;
    const audioHistoryRef = useRef([]);
    const audioHistoryIndexRef = useRef(-1);
    const audioHistoryRestoringRef = useRef(false);
    const [canUndoAudio, setCanUndoAudio] = useState(false);
    const [canRedoAudio, setCanRedoAudio] = useState(false);

    /** Snapshot audio track clip metadata (without buffers — keep refs). */
    const snapshotAudioTracks = useCallback((tracks) => {
        return tracks.map(t => ({
            ...t,
            clips: t.clips.map(c => ({ ...c })) // shallow clone preserves buffer refs
        }));
    }, []);

    const pushAudioHistory = useCallback((tracks, automation) => {
        if (audioHistoryRestoringRef.current) return;
        const snap = { tracks: snapshotAudioTracks(tracks), automation: JSON.parse(JSON.stringify(automation)) };
        audioHistoryRef.current = audioHistoryRef.current.slice(0, audioHistoryIndexRef.current + 1);
        audioHistoryRef.current.push(snap);
        if (audioHistoryRef.current.length > MAX_AUDIO_HISTORY) audioHistoryRef.current.shift();
        audioHistoryIndexRef.current = audioHistoryRef.current.length - 1;
        setCanUndoAudio(audioHistoryIndexRef.current > 0);
        setCanRedoAudio(false);
    }, [snapshotAudioTracks]);

    const undoAudio = useCallback(() => {
        if (audioHistoryIndexRef.current <= 0) return false;
        audioHistoryRestoringRef.current = true;
        audioHistoryIndexRef.current -= 1;
        const snap = audioHistoryRef.current[audioHistoryIndexRef.current];
        setAudioTracks(snapshotAudioTracks(snap.tracks));
        setTrackAutomation(JSON.parse(JSON.stringify(snap.automation)));
        setCanUndoAudio(audioHistoryIndexRef.current > 0);
        setCanRedoAudio(audioHistoryIndexRef.current < audioHistoryRef.current.length - 1);
        setTimeout(() => { audioHistoryRestoringRef.current = false; }, 100);
        return true;
    }, [snapshotAudioTracks]);

    const redoAudio = useCallback(() => {
        if (audioHistoryIndexRef.current >= audioHistoryRef.current.length - 1) return false;
        audioHistoryRestoringRef.current = true;
        audioHistoryIndexRef.current += 1;
        const snap = audioHistoryRef.current[audioHistoryIndexRef.current];
        setAudioTracks(snapshotAudioTracks(snap.tracks));
        setTrackAutomation(JSON.parse(JSON.stringify(snap.automation)));
        setCanUndoAudio(audioHistoryIndexRef.current > 0);
        setCanRedoAudio(audioHistoryIndexRef.current < audioHistoryRef.current.length - 1);
        setTimeout(() => { audioHistoryRestoringRef.current = false; }, 100);
        return true;
    }, [snapshotAudioTracks]);

    // Auto-push audio history on audioTracks or trackAutomation changes (debounced)
    const audioHistoryTimerRef = useRef(null);
    const audioHistoryInitRef = useRef(false);
    useEffect(() => {
        if (audioHistoryRestoringRef.current) return;
        if (audioTracks.length === 0 && Object.keys(trackAutomation).length === 0) return;
        if (!audioHistoryInitRef.current) {
            audioHistoryInitRef.current = true;
            pushAudioHistory(audioTracks, trackAutomation);
            return;
        }
        clearTimeout(audioHistoryTimerRef.current);
        audioHistoryTimerRef.current = setTimeout(() => {
            pushAudioHistory(audioTracks, trackAutomation);
        }, 400);
        return () => clearTimeout(audioHistoryTimerRef.current);
    }, [audioTracks, trackAutomation, pushAudioHistory]);

    // Audio insertion bar position (lifted from ArrangementTimeline for recording integration)
    const [audioInsertionBar, setAudioInsertionBar] = useState(null);
    const audioInsertionBarRef = useRef(null);
    useEffect(() => { audioInsertionBarRef.current = audioInsertionBar; }, [audioInsertionBar]);
    // Audio loop range for loop recording (null = continuous, { startBar, endBar } = loop within range)
    const [audioLoopRange, setAudioLoopRange] = useState(null);

    // Continuous timeline: total bars in the timeline (auto-extends in chunks of 48)
    const TIMELINE_CHUNK = 64;
    const [timelineBars, setTimelineBars] = useState(TIMELINE_CHUNK);
    const timelineBarsRef = useRef(TIMELINE_CHUNK);
    useEffect(() => { timelineBarsRef.current = timelineBars; }, [timelineBars]);

    // Auto-initialize arrangement on mount (arrangement mode is always on)
    const arrangementInitialized = useRef(false);
    useEffect(() => {
        if (arrangementInitialized.current) return;
        if (arr.arrangement.length === 0) {
            arr.initFromPatterns(patterns, globalBars);
            arrangementInitialized.current = true;
        }
    }, []); // run once on mount

    // Keep timelineBars >= 48 and in sync with globalBars when needed
    useEffect(() => {
        setTimelineBars(prev => Math.max(TIMELINE_CHUNK, prev));
    }, [globalBars]);

    // Bar-range based loop — always visible, defaults to first 4 bars
    const [loopRange, setLoopRange] = useState({ startBar: 0, endBar: 4 });
    const [loopActive, setLoopActive] = useState(false); // dim when inactive, bright when active
    const loopPendingDeactivate = useRef(false); // finish current loop iteration before deactivating
    const loopRangeRef = useRef(null);
    useEffect(() => {
        if (loopActive) {
            loopPendingDeactivate.current = false;
            loopRangeRef.current = loopRange;
        } else if (loopRangeRef.current) {
            // Don't clear immediately — let the tick loop finish the current iteration
            // (globalIsPlayingRef is checked in the tick loop itself)
            loopPendingDeactivate.current = true;
        } else {
            loopRangeRef.current = null;
            loopPendingDeactivate.current = false;
        }
    }, [loopRange, loopActive]);

    // Keep the single implicit section's bars in sync with timelineBars
    useEffect(() => {
        if (arr.arrangementMode && arr.arrangement.length > 0) {
            arr.updateTimelineBars(timelineBars);
        }
    }, [timelineBars, arr.arrangementMode]);

    const [globalMutes, setGlobalMutes] = useState(new Set());
    const globalMutesRef = useRef(globalMutes);
    useEffect(() => { globalMutesRef.current = globalMutes; }, [globalMutes]);

    // Global settings (synced across all generators)
    const [globalKey, setGlobalKey] = useState('C');
    const [globalScale, setGlobalScale] = useState('Minor');
    const [globalTempo, setGlobalTempo] = useState(140);
    const tapTimesRef = useRef([]);          // Tap tempo: last 4 tap timestamps
    const tapBtnRef = useRef(null);          // Tap button DOM ref for flash effect
    const [isEditingBpm, setIsEditingBpm] = useState(false); // Inline BPM text input
    // globalBars is declared earlier (before the resize effect that depends on it)
    const [globalRepeat, setGlobalRepeat] = useState(true); // When true, generate base 4-bar pattern and loop to fill globalBars
    const [globalResolution, setGlobalResolution] = useState(4);
    const [globalGenre, setGlobalGenre] = useState('Trap');
    const [globalMood, setGlobalMood] = useState('Dark');
    const [chordsOctave, setChordsOctave] = useState(3);
    const [melodyOctave, setMelodyOctave] = useState(4);
    const [bassOctave, setBassOctave] = useState(1);

    // Advanced Filtering States
    const [allowedKeys, setAllowedKeys] = useState(NOTE_NAMES);
    const [allowedScales, setAllowedScales] = useState(Object.keys(SCALES));

    // Hidden Synth Studios
    // Synth studios are now tabs ('drumsynth', 'instrsynth') — no separate show state needed

    // Suggestion Panel
    const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);

    // Time-Stretch state
    const [globalTimeStretch, setGlobalTimeStretch] = useState(false);
    const [preservePitch, setPreservePitch] = useState(false);
    const [manualStretchClips, setManualStretchClips] = useState(new Set());

    // Effects Manager & Rack
    const effectsManagerRef = useRef(null);
    const [showEffectsRack, setShowEffectsRack] = useState(false);
    const [effectsVersion, setEffectsVersion] = useState(0);

    // Initialize EffectsManager when sampler's audioContext is ready
    useEffect(() => {
        const initFx = () => {
            const sampler = samplerRef.current;
            if (sampler?.audioContext && !effectsManagerRef.current) {
                const mgr = new EffectsManager();
                mgr.init(sampler.audioContext);
                effectsManagerRef.current = mgr;
                setEffectsVersion(v => v + 1);
            }
        };
        // Try immediately
        initFx();
        // Also retry after a short delay in case audioContext isn't ready yet
        const timer = setTimeout(initFx, 500);
        return () => clearTimeout(timer);
    }, []);

    // Sync effects chains into SamplerEngine audio routing whenever effects change
    useEffect(() => {
        const sampler = samplerRef.current;
        const mgr = effectsManagerRef.current;
        if (sampler && mgr) {
            sampler.syncEffectsFromManager(mgr);
        }
    }, [effectsVersion]);

    // Sync time-stretch settings to SamplerEngine
    useEffect(() => {
        const s = samplerRef.current;
        if (s) {
            s.setGlobalTempo(globalTempo);
            s.setPreservePitch(preservePitch);
        }
    }, [globalTempo, preservePitch]);

    // Auto-tune samples to key
    const [autoTuneSamples, setAutoTuneSamples] = useState(false);
    useEffect(() => {
        const s = samplerRef.current;
        if (s) {
            s.setAutoTune(autoTuneSamples);
            s.setAutoTuneKey(globalKey);
        }
    }, [autoTuneSamples, globalKey]);

    // Sample loading change handler (uses counter for overlapping loads)
    const handleSampleLoadingChange = useCallback((loading) => {
        if (loading) {
            sampleLoadCountRef.current++;
            setIsLoadingSamples(true);
        } else {
            sampleLoadCountRef.current = Math.max(0, sampleLoadCountRef.current - 1);
            if (sampleLoadCountRef.current === 0) setIsLoadingSamples(false);
        }
    }, []);

    // Auto-save: check for existing autosave on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem('wavloom_autosave');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.timestamp && (Date.now() - data.timestamp) < 24 * 60 * 60 * 1000) {
                    setAutosaveTimestamp(data.timestamp);
                    setShowAutosaveBanner(true);
                } else {
                    localStorage.removeItem('wavloom_autosave');
                }
            }
        } catch (e) { console.warn('[AutoSave] Failed to read autosave:', e); }
    }, []);

    // BPM extraction helper
    const extractBpmFromFilename = useCallback((filename) => {
        const match = filename?.match(/(\d{2,3})\s*(?:BPM|bpm)/i);
        return match ? parseInt(match[1]) : null;
    }, []);

    // Load sliced instrument handler
    const handleLoadSlicedInstrument = useCallback(({ buffer, slices, name, rootNote, targetTrack }) => {
        const instrumentId = `sliced_${name}_${Date.now()}`;
        const sampler = samplerRef.current;
        if (sampler) {
            sampler.loadSlicedInstrument(instrumentId, buffer, slices, name, rootNote);
        }
        return instrumentId;
    }, []);

    // ─── Audio Recording ───
    const recorderRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isCountingIn, setIsCountingIn] = useState(false);
    const [countInBeat, setCountInBeat] = useState(null); // { beat, total }
    const [recordingElapsed, setRecordingElapsed] = useState(0);
    const recordingElapsedRef = useRef(0);   // High-frequency ref — no re-renders during recording
    const isRecordingRef = useRef(false);    // Ref mirror for rAF tick loop access
    const [recordingTrackId, setRecordingTrackId] = useState(null);

    // Keep isRecordingRef in sync for rAF tick loop access (avoids stale closures)
    useEffect(() => {
        isRecordingRef.current = isRecording;
        // Activate hot-swap during recording (count-in clicks need a live context)
        if (isRecording && samplerRef.current?.setAudioActive) {
            samplerRef.current.setAudioActive(true);
        }
    }, [isRecording]);

    // Sync recordingElapsed state from ref at ~2Hz for timer display only (no re-render storm)
    useEffect(() => {
        if (!isRecording) return;
        const id = setInterval(() => {
            setRecordingElapsed(recordingElapsedRef.current);
        }, 500);
        return () => clearInterval(id);
    }, [isRecording]);

    // Section loop: set of section IDs to loop through (empty = play all)
    // NOTE: Must be declared before handleStartRecording which references it
    const [loopSectionIds, setLoopSectionIds] = useState(new Set());
    const loopSectionIdsRef = useRef(loopSectionIds);
    useEffect(() => { loopSectionIdsRef.current = loopSectionIds; }, [loopSectionIds]);

    const toggleSectionLoop = useCallback((sectionId) => {
        setLoopSectionIds(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
        });
    }, []);

    const clearSectionLoop = useCallback(() => setLoopSectionIds(new Set()), []);

    // Loop recording state: when recording inside a loop, track pass count
    const loopRecordingRef = useRef(null); // { loopDurationSecs, loopSectionIds, timerId }

    // Store which section the recording started in (for clip placement)
    const recordingStartSectionRef = useRef(null);
    // Store the absolute bar position where recording starts (for section-independent positioning)
    const recordingStartBarRef = useRef(0);

    const handleStartRecording = useCallback(async () => {
        if (isRecording || isCountingIn) return;
        const sampler = samplerRef.current;
        if (!sampler?.audioContext) { alert(t('app.audioEngineNotReady')); return; }

        // Compute the next available vocal track name with gap-filling
        // e.g. if "Vocal 1" and "Vocal 3" exist, this returns "Vocal 2"
        const nextVocalName = getNextTrackName(audioTracks, 'Vocal');

        // ── Smart track creation/selection for recording ──
        // Recording is restricted to VOCAL tracks only (named "Vocal N").
        // Priority:
        // 1. If a vocal track is selected:
        //    - Insertion before clips → overwrite (record on same track)
        //    - Insertion after clips → create new vocal track after it
        //    - No clips → use this vocal track for recording
        // 2. If a non-vocal audio track or MIDI track is selected → create new vocal track after it
        // 3. If nothing selected → create new vocal track at end
        let targetTrackId = null;
        const selectedRow = arrangeSelectedRow;
        const insertBar = audioInsertionBar;
        if (selectedRow && selectedRow.startsWith('audio-')) {
            const selectedAudioId = audioTracks.find(t => ('audio-' + t.id) === selectedRow)?.id;
            if (selectedAudioId) {
                const selectedTrack = audioTracks.find(t => t.id === selectedAudioId);
                const isVocal = selectedTrack?.trackType === 'vocal';

                if (isVocal) {
                    // Vocal track selected — record onto it or after it
                    const hasClips = selectedTrack && selectedTrack.clips && selectedTrack.clips.length > 0;
                    if (hasClips && insertBar != null) {
                        const secondsPerBar = 4 * 60 / globalTempo;
                        let lastClipEnd = 0;
                        for (const clip of selectedTrack.clips) {
                            const clipStart = clip.timelineBar || 0;
                            const clipDurBars = clip.buffer ? clip.buffer.duration / secondsPerBar : 0;
                            const clipEnd = clipStart + clipDurBars;
                            if (clipEnd > lastClipEnd) lastClipEnd = clipEnd;
                        }
                        if (insertBar < lastClipEnd) {
                            targetTrackId = selectedAudioId; // Overwrite
                        } else {
                            targetTrackId = addAudioTrack(nextVocalName, selectedAudioId, 'vocal');
                        }
                    } else if (hasClips) {
                        targetTrackId = addAudioTrack(nextVocalName, selectedAudioId, 'vocal');
                    } else {
                        targetTrackId = selectedAudioId; // Empty vocal track → record here
                    }
                } else {
                    // Non-vocal audio track selected → create new vocal track after it
                    targetTrackId = addAudioTrack(nextVocalName, selectedAudioId, 'vocal');
                }
            }
        } else if (selectedRow && (selectedRow.startsWith('midi-') || selectedRow === 'chords' || selectedRow === 'melody' || selectedRow === 'bass' || selectedRow === 'drums-all' || selectedRow.startsWith('drum-'))) {
            const afterId = audioTracks.length > 0 ? audioTracks[audioTracks.length - 1].id : null;
            targetTrackId = addAudioTrack(nextVocalName, afterId, 'vocal');
        }

        // Fallback: nothing selected → create new vocal track at end
        if (!targetTrackId) {
            const afterId = audioTracks.length > 0 ? audioTracks[audioTracks.length - 1].id : null;
            targetTrackId = addAudioTrack(nextVocalName, afterId, 'vocal');
        }
        setRecordingTrackId(targetTrackId);

        // Switch to arrangement tab so the recording track is visible
        if (activeTab !== 'arrange') {
            setActiveTab('arrange');
        }

        // Remember which section recording starts in (the active section)
        recordingStartSectionRef.current = arr.activeSection || (arr.arrangement.length > 0 ? arr.arrangement[0].id : null);

        // Compute absolute bar position for recording start
        if (audioLoopRange) {
            // Loop recording: always start at loop range start
            recordingStartBarRef.current = audioLoopRange.startBar;
        } else if (audioInsertionBar != null) {
            // Use insertion point if set
            recordingStartBarRef.current = audioInsertionBar;
        } else if (globalIsPlayingRef.current && globalCurrentStepRef.current > 0) {
            // Use current playhead position
            recordingStartBarRef.current = globalCurrentStepRef.current / 32;
        } else {
            // Default: start at bar 0 (continuous timeline, no sections)
            recordingStartBarRef.current = 0;
        }

        try {
            if (!recorderRef.current) {
                // Pass a getter so the recorder always uses the live AudioContext
                // (hot-swap replaces the context every ~6s, closing the old one)
                recorderRef.current = new AudioRecorder(() => samplerRef.current?.audioContext);
            }
            // Always call init() — it's a no-op if already initialized, but
            // handles the case where a previous init() failed (no stream)
            await recorderRef.current.init();

            setIsCountingIn(true);
            setCountInBeat(null);

            // Clear any previous loop recording timer (defensive)
            if (loopRecordingRef.current?.timerId) {
                clearTimeout(loopRecordingRef.current.timerId);
            }
            loopRecordingRef.current = null;

            await recorderRef.current.startRecording({
                tempo: globalTempo,
                countInBars: 1,
                beatsPerBar: 4,
                onCountBeat: (beat, total) => setCountInBeat({ beat, total }),
                onRecordingStart: () => {
                    setIsCountingIn(false);
                    setIsRecording(true);
                    setCountInBeat(null);

                    // Start arrangement playback simultaneously so the beat/metronome plays
                    // while recording. The user can hear the beat and record vocals over it.
                    if (!globalIsPlayingRef.current) {
                        setGlobalIsPlaying(true);
                    }

                    // If audioLoopRange is set, schedule auto-comp at loop boundary
                    if (audioLoopRange) {
                        const loopBars = audioLoopRange.endBar - audioLoopRange.startBar;
                        const loopDurationSecs = loopBars * (4 * 60 / globalTempo);
                        const timerId = setTimeout(() => {
                            // Auto-comp: save take and start new one at same position
                            handleCompNewTake();
                        }, loopDurationSecs * 1000);
                        loopRecordingRef.current = { loopDurationSecs, timerId, loopRange: audioLoopRange };
                    }
                },
                onProgress: ({ elapsed }) => { recordingElapsedRef.current = elapsed; }
            });
        } catch (err) {
            console.error('Recording failed:', err);
            setIsCountingIn(false);
            setIsRecording(false);
            alert(t('app.microphoneError', { error: err.message }));
        }
    }, [isRecording, isCountingIn, globalTempo, arr.arrangementMode, arr.arrangement, arr.activeSection, addClipToTrack, audioInsertionBar, audioLoopRange, addAudioTrack, audioTracks, activeTab, arrangeSelectedRow]);

    const handleStopRecording = useCallback(async () => {
        if (!recorderRef.current) return;
        // Clean up loop recording timer
        if (loopRecordingRef.current?.timerId) {
            clearTimeout(loopRecordingRef.current.timerId);
        }
        loopRecordingRef.current = null;

        // Update UI state immediately (don't wait for buffer drain)
        setIsRecording(false);
        setIsCountingIn(false);
        setRecordingElapsed(0);
        recordingElapsedRef.current = 0;
        setCountInBeat(null);

        // Await buffer drain — ensures all pending worklet messages are captured
        const result = await recorderRef.current.stopRecording();

        if (!result || !result.audioBuffer) return;

        const { audioBuffer, duration } = result;
        const targetTrackId = recordingTrackId;
        if (!targetTrackId) return;

        // Create ONE continuous clip (no section splitting) at the absolute timeline position
        if (arr.arrangementMode && arr.arrangement.length > 0) {
            const timelineBar = recordingStartBarRef.current || 0;
            // Find which section this bar falls in (for backward compat sectionId)
            let sectionId = arr.arrangement[0]?.id || 'default';
            let cumBars = 0;
            for (const s of arr.arrangement) {
                if (cumBars + s.bars > timelineBar) { sectionId = s.id; break; }
                cumBars += s.bars;
            }

            // Remove any existing recording clips on this track that overlap
            setAudioTracks(prev => prev.map(t => {
                if (t.id !== targetTrackId) return t;
                const kept = t.clips.filter(c => !(c.name && c.name.startsWith('Recording')));
                return { ...t, clips: kept };
            }));

            // Add ONE continuous clip at the absolute timeline position
            addClipToTrack(targetTrackId, sectionId, audioBuffer, 'Recording', {
                startBar: 0,
                timelineBar: timelineBar
            });

            // Move insertion point to the beginning of the recorded clip
            setAudioInsertionBar(timelineBar);
        } else {
            // Not in arrangement mode — remove old recordings first, then add
            setAudioTracks(prev => prev.map(t => {
                if (t.id !== targetTrackId) return t;
                const kept = t.clips.filter(c => !(c.sectionId === 'default' && c.name && c.name.startsWith('Recording')));
                return { ...t, clips: kept };
            }));
            addClipToTrack(targetTrackId, 'default', audioBuffer, 'Recording', { startBar: 0, timelineBar: 0 });
        }

        // Stop playback when recording ends
        if (globalIsPlayingRef.current) {
            setGlobalIsPlaying(false);
        }

        // Clear recordingTrackId so next recording re-evaluates track placement
        // based on current selection state and insertion point
        setRecordingTrackId(null);

    }, [recordingTrackId, arr, globalTempo, addClipToTrack, activeTab]);

    /**
     * Comping: save current take and immediately start recording on a new audio track.
     * Triggered by pressing "C" during recording.
     * The new take starts at the same timeline position so all takes align for comparison.
     */
    const handleCompNewTake = useCallback(async () => {
        console.log(`[Comp] handleCompNewTake called | isRecording=${isRecording} | recorderRef=${!!recorderRef.current} | recordingTrackId=${recordingTrackId}`);
        if (!isRecording || !recorderRef.current) {
            console.log('[Comp] Early return: isRecording or recorderRef is falsy');
            return;
        }
        const sampler = samplerRef.current;
        if (!sampler?.audioContext) {
            console.log('[Comp] Early return: no sampler audioContext');
            return;
        }

        // 1. Stop current recording and save clip
        if (loopRecordingRef.current?.timerId) {
            clearTimeout(loopRecordingRef.current.timerId);
        }
        const loopState = loopRecordingRef.current;
        loopRecordingRef.current = null;

        console.log('[Comp] Stopping current recording...');
        const result = await recorderRef.current.stopRecording();
        console.log(`[Comp] stopRecording result: buffer=${!!result?.audioBuffer} duration=${result?.duration?.toFixed(2)}s`);
        if (result?.audioBuffer) {
            const { audioBuffer } = result;
            const prevTrackId = recordingTrackId;
            if (prevTrackId && arr.arrangementMode && arr.arrangement.length > 0) {
                const timelineBar = recordingStartBarRef.current || 0;
                // Find section for backward compat
                let sectionId = arr.arrangement[0]?.id || 'default';
                let cumBars = 0;
                for (const s of arr.arrangement) {
                    if (cumBars + s.bars > timelineBar) { sectionId = s.id; break; }
                    cumBars += s.bars;
                }
                console.log(`[Comp] Saving clip to track=${prevTrackId} section=${sectionId} bar=${timelineBar}`);
                addClipToTrack(prevTrackId, sectionId, audioBuffer, 'Recording', {
                    startBar: 0,
                    timelineBar: timelineBar
                });
            } else if (prevTrackId) {
                console.log(`[Comp] Saving clip to track=${prevTrackId} (non-arrangement mode)`);
                addClipToTrack(prevTrackId, 'default', audioBuffer, 'Recording', { startBar: 0, timelineBar: 0 });
            }
        }

        // 2. Create new vocal track for next take (placed right after current track)
        const prevTrackId = recordingTrackId;
        const takeNum = audioTracks.filter(t => t.name && t.name.match(/^Take \d+$/)).length + 1;
        const newTrackId = addAudioTrack(`Take ${takeNum}`, prevTrackId, 'vocal');
        console.log(`[Comp] Created new take track: ${newTrackId} (Take ${takeNum})`);
        setRecordingTrackId(newTrackId);

        // 3. Reset playhead to the original recording start so the new take aligns
        const compStartBar = recordingStartBarRef.current || 0;
        const compStartStep = Math.floor(compStartBar * 32);
        globalCurrentStepRef.current = compStartStep;
        globalAbsoluteStepRef.current = compStartStep;
        console.log(`[Comp] Reset playhead to bar=${compStartBar} step=${compStartStep}`);

        // 4. Restart recording with count-in on the new track
        // recordingStartBarRef stays the same so the new take starts at the exact same position
        setIsCountingIn(true);
        setCountInBeat(null);
        console.log('[Comp] Starting recording on new track...');
        try {
            await recorderRef.current.startRecording({
                tempo: globalTempo,
                countInBars: 1,
                beatsPerBar: 4,
                onCountBeat: (beat, total) => setCountInBeat({ beat, total }),
                onRecordingStart: () => {
                    setIsCountingIn(false);
                    setCountInBeat(null);
                    if (loopState) {
                        // Re-schedule auto-comp at next loop boundary using saved loop range
                        const lr = loopState.loopRange;
                        if (lr && loopState.loopDurationSecs > 0) {
                            const timerId = setTimeout(() => {
                                handleCompNewTake();
                            }, loopState.loopDurationSecs * 1000);
                            loopRecordingRef.current = { ...loopState, timerId };
                        } else {
                            loopRecordingRef.current = loopState;
                        }
                    }
                },
                onProgress: ({ elapsed }) => { recordingElapsedRef.current = elapsed; }
            });
        } catch (err) {
            console.error('Comp recording restart failed:', err);
            setIsRecording(false);
        }
    }, [isRecording, recordingTrackId, audioTracks, globalTempo, arr.arrangementMode, arr.arrangement, addClipToTrack, addAudioTrack]);

    // ── Auto-extend arrangement when recording runs past the end ──
    // NOTE: Auto-extend logic has been moved into the rAF tick loop (around line 2210)
    // to avoid re-render storms from recordingElapsed state dependency.
    const autoExtendRef = useRef(false); // Prevent rapid re-triggers

    // ── Add vocal to arrangement ──
    // Browser Panel States
    const [isBrowserVisible, setIsBrowserVisible] = useState(true);
    const [browserWidth, setBrowserWidth] = useState(280);
    const [isResizing, setIsResizing] = useState(false);

    // Record Mode state
    const [isRecordMode, setIsRecordMode] = useState(false);
    const [recordModeWidth, setRecordModeWidth] = useState(560);
    const [recordModeLyrics, setRecordModeLyrics] = useState(null);
    const [isResizingRecordMode, setIsResizingRecordMode] = useState(false);

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [appSettings, setAppSettings] = useState(() => loadSettings());
    const appSettingsRef = useRef(appSettings);
    appSettingsRef.current = appSettings;
    const [showTour, setShowTour] = useState(false);

    // PWA Install Prompt
    const [installPrompt, setInstallPrompt] = useState(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [exportSettings, setExportSettings] = useState({
        format: 'wav',
        type: 'mix', // 'mix' or 'stems'
        durationBars: globalBars, // Default to current global bars, can be overridden to 8
        sampleRate: 44100,
        bitDepth: 16,
        bitrate: 192 // MP3 only (kbps)
    });
    const [isExporting, setIsExporting] = useState(false);

    // Collaboration State
    const collab = useCollaboration();
    const hasCollabPeers = Object.keys(collab.peers).length > 0;
    const { toasts, addToast, removeToast } = useToast();
    const isAuthenticated = collab.userProfile.email && collab.userProfile.email !== '';

    // Apply settings on mount
    useEffect(() => { applyTooltipSetting(appSettings.showTooltips); }, []);

    // Aggressive teardown on page unload to prevent "Page Unresponsive"
    // during hard refresh. Kill all audio contexts, intervals, and timers.
    useEffect(() => {
        const handleUnload = () => {
            // 1. Dispose SamplerEngine (clears hot-swap, cleanup, idle timers)
            if (samplerRef.current?.dispose) samplerRef.current.dispose();
            // 2. Close the shared AudioContext entirely — prevents any lingering
            //    audio processing from fighting with the page teardown
            try {
                const ctx = window.sharedAnalysisCtx;
                if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
            } catch (_) {}
            // 3. Kill AudioEngine idle timer
            try {
                if (window.audioEngine?._idleSuspendTimer) {
                    clearTimeout(window.audioEngine._idleSuspendTimer);
                }
            } catch (_) {}
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, []);

    // Wire addToast to collab for idle warnings and access responses
    useEffect(() => { collab.setAddToast(addToast); }, [addToast]);

    // Wire follow mode: when followed peer changes tab, our activeTab follows
    useEffect(() => { collab.setTabChangeHandler(setActiveTab); }, []);

    // Broadcast our tab changes to peers (for follow mode)
    useEffect(() => { collab.broadcastTabChange(activeTab); }, [activeTab]);

    // Record tab activity for auto-release idle timer
    useEffect(() => { collab.recordTabActivity(activeTab); }, [activeTab]);
    useEffect(() => {
        const handler = () => collab.recordTabActivity(activeTab);
        window.addEventListener('click', handler);
        window.addEventListener('keydown', handler);
        return () => {
            window.removeEventListener('click', handler);
            window.removeEventListener('keydown', handler);
        };
    }, [activeTab]);

    // PWA Install Prompt listener
    useEffect(() => {
        const dismissed = localStorage.getItem('wavloom_install_dismissed');
        if (dismissed) return;

        const handler = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
            setShowInstallBtn(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        const installedHandler = () => {
            setShowInstallBtn(false);
            setInstallPrompt(null);
        };
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        setInstallPrompt(null);
        setShowInstallBtn(false);
        if (outcome === 'dismissed') {
            // Don't persist dismissal — they can install later
        }
    };

    const handleInstallDismiss = () => {
        setShowInstallBtn(false);
        setInstallPrompt(null);
        localStorage.setItem('wavloom_install_dismissed', 'true');
    };

    // Auto-start onboarding tour on first visit after 1s delay
    useEffect(() => {
        if (shouldShowTour()) {
            const t = setTimeout(() => setShowTour(true), 1000);
            return () => clearTimeout(t);
        }
    }, []);

    // Browser visibility handler for tour (hide sidebar except on browser step)
    const handleTourBrowserVisibility = useCallback((visible) => {
        setIsBrowserVisible(visible);
    }, []);

    // Collaborative Audio Sync — only start audio share when peers are actually connected
    useEffect(() => {
        const peerCount = Object.keys(collab.peers).length;
        if (collab.myId && samplerRef.current && peerCount > 0) {
            collab.startAudioShare(samplerRef.current.audioContext, samplerRef.current.masterGain);
            collab.broadcastLibraryManifest();
        }
    }, [collab.myId, Object.keys(collab.peers).length]);

    // Wire auto-ducking: lower DAW volume when someone talks in voice chat
    useEffect(() => {
        if (samplerRef.current?.masterGain) {
            collab.setDuckingTarget(samplerRef.current.masterGain, masterVolume);
        }
    }, [collab.myId, masterVolume]);

    // Wire shared library: give collab access to sampler for sample sharing
    useEffect(() => {
        if (samplerRef.current) {
            collab.setSamplerRef(samplerRef.current);
        }
    }, []);

    // Auto-mute voice & broadcast mic when recording, restore when done
    useEffect(() => {
        if (isRecording) {
            const micStream = recorderRef.current?.stream;
            collab.startRecordingMonitor(micStream || null);
        } else if (collab.isRecordingActive) {
            collab.stopRecordingMonitor();
        }
    }, [isRecording]);

    // --- Arrangement ↔ Pattern Sync ---
    // When active section changes, load its patterns into the generators
    useEffect(() => {
        if (!arr.arrangementMode || !arr.activeSection) return;
        const section = arr.getActiveSection();
        if (!section) return;
        arr.isLoadingSection.current = true;
        setPatterns(section.patterns);
        setExternalPatterns({
            chords: section.patterns.chords || null,
            melody: section.patterns.melody || null,
            bass: section.patterns.bass || null
        });
        if (section.settings?.key) setGlobalKey(section.settings.key);
        if (section.settings?.scale) setGlobalScale(section.settings.scale);
        if (section.settings?.tempo) setGlobalTempo(section.settings.tempo);
        if (section.settings?.genre) setGlobalGenre(section.settings.genre);
        if (section.settings?.mood) setGlobalMood(section.settings.mood);
        if (section.bars !== globalBars) setGlobalBars(section.bars);
        // Load patterns directly into generators
        // When drum clips exist, find the clip at this section's bar offset instead
        if (drumRef.current) {
            if (drumClipsRef.current.length > 0) {
                // Find the section's bar offset
                const sIdx = arr.arrangement.indexOf(section);
                let sectionStartBar = 0;
                for (let i = 0; i < sIdx; i++) sectionStartBar += arr.arrangement[i].bars;
                // Find drum clip at or overlapping this section
                const clip = drumClipsRef.current.find(c => {
                    const cStart = c.timelineBar || 0;
                    const cEnd = cStart + (c.bars || 4);
                    return sectionStartBar >= cStart && sectionStartBar < cEnd;
                });
                if (clip?.drumStates) {
                    drumRef.current.loadState(clip.drumStates);
                }
            } else if (section.patterns.drums) {
                drumRef.current.loadState(section.patterns.drums);
            }
        }
        // Helper: find clip at section's bar offset
        const findClipAtSection = (clipsRef) => {
            if (clipsRef.current.length === 0) return null;
            const sIdx = arr.arrangement.indexOf(section);
            let sBar = 0;
            for (let i = 0; i < sIdx; i++) sBar += arr.arrangement[i].bars;
            return clipsRef.current.find(c => {
                const cStart = c.timelineBar || 0;
                return sBar >= cStart && sBar < cStart + (c.bars || 4);
            });
        };
        if (chordsRef.current) {
            const clip = findClipAtSection(chordClipsRef);
            if (clip?.pattern) { chordsRef.current.loadState(clip.pattern); }
            else if (section.patterns.chords) { chordsRef.current.loadState(section.patterns.chords); }
        }
        if (melodyRef.current) {
            const clip = findClipAtSection(melodyClipsRef);
            if (clip?.pattern) { melodyRef.current.loadState(clip.pattern); }
            else if (section.patterns.melody) { melodyRef.current.loadState(section.patterns.melody); }
        }
        if (bassRef.current) {
            const clip = findClipAtSection(bassClipsRef);
            if (clip?.pattern) { bassRef.current.loadState(clip.pattern); }
            else if (section.patterns.bass) { bassRef.current.loadState(section.patterns.bass); }
        }
        // Section mix auto-apply removed — global mix is used instead
        requestAnimationFrame(() => { arr.isLoadingSection.current = false; });
    }, [arr.activeSection, arr.arrangementMode]);

    // When patterns change from editing, sync back to active section
    useEffect(() => {
        if (!arr.arrangementMode || !arr.activeSection) return;
        arr.updateSectionPatterns(arr.activeSection, patterns);
    }, [patterns, arr.arrangementMode, arr.activeSection]);

    // --- Genre/Mood Auto-Sync Engine ---
    useEffect(() => {
        if (globalGenre === 'Custom' || globalMood === 'Custom') {
            setAllowedKeys(NOTE_NAMES);
            setAllowedScales(Object.keys(SCALES));
            if (globalKey !== 'Custom' && globalKey !== 'C') setGlobalKey('C');
            return;
        }

        const genreDef = GENRE_DEFINITIONS[globalGenre];
        const moodDef = MOOD_MODIFIERS[globalMood];

        if (!genreDef || !moodDef) return;

        // 1. Compute Tempo
        const midTempo = (genreDef.baseTempo[0] + genreDef.baseTempo[1]) / 2;
        const newTempo = Math.round(midTempo * (moodDef.tempoMultiplier || 1.0));
        setGlobalTempo(newTempo);

        // 2. Compute Allowed Scales (Intersection of Genre & Mood preferences)
        let scalesIntersection = genreDef.baseScales.filter(scale => moodDef.scalePreference.includes(scale));
        if (scalesIntersection.length === 0) {
            // Fallback: Just use Mood preferences if no direct genre overlap
            scalesIntersection = moodDef.scalePreference.filter(s => SCALES[s]);
        }

        // Ensure we only keep scales that actually exist in the engine
        scalesIntersection = scalesIntersection.filter(s => SCALES[s]);
        if (scalesIntersection.length === 0) scalesIntersection = ['Minor']; // Failsafe

        setAllowedScales(scalesIntersection);

        // 3. Auto-update Current Scale if it's outside the allowed list
        if (!scalesIntersection.includes(globalScale)) {
            setGlobalScale(scalesIntersection[0]);
        }

        // 4. Allow all keys regardless of mood
        setAllowedKeys([...NOTE_NAMES]);

    }, [globalGenre, globalMood]); // Run when genre or mood changes


    const [globalSolos, setGlobalSolos] = useState(new Set());
    const globalSolosRef = useRef(globalSolos);
    useEffect(() => { globalSolosRef.current = globalSolos; }, [globalSolos]);

    const updateGlobalSolo = useCallback((id, isSolo, isCtrl) => {
        setGlobalSolos(prev => {
            const next = new Set(prev);
            if (isCtrl) {
                if (isSolo) next.add(id);
                else next.delete(id);
            } else {
                // If clicking an already solod one without ctrl, it unsolos everything
                if (next.has(id) && next.size === 1) {
                    next.clear();
                } else {
                    next.clear();
                    if (isSolo) next.add(id);
                }
            }
            return next;
        });
    }, []);

    const isAnythingSoloed = globalSolos.size > 0;

    // Sync VST3 instrument output gain with solo/mute state.
    // VST3 plugins with internal sequencers (e.g. Drum Monkey) generate audio
    // through processBlock regardless of whether we trigger MIDI notes, so we
    // must mute their output gain node directly.
    useEffect(() => {
        const vst3Map = vst3InstrumentsRef.current;
        if (!vst3Map || vst3Map.size === 0) return;
        const anySoloed = globalSolos.size > 0;
        for (const [trackId, vst3Entry] of vst3Map.entries()) {
            const node = vst3Entry?.node;
            if (!node?.outputNode) continue;
            const isMuted = globalMutes.has(trackId);
            const isSoloed = globalSolos.has(trackId);
            const shouldPlay = anySoloed ? isSoloed : !isMuted;
            const targetGain = shouldPlay ? 1.0 : 0.0;
            const ctx = node._ctx || node.outputNode.context;
            if (ctx) {
                node.outputNode.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.015);
            } else {
                node.outputNode.gain.value = targetGain;
            }
        }
    }, [globalMutes, globalSolos]);

    // Sync solo/mute state to audio track bus gain nodes in real-time.
    // This ensures already-playing audio clips respond immediately to
    // solo/mute changes without needing to re-schedule.
    useEffect(() => {
        const sampler = samplerRef.current;
        if (!sampler) return;
        const ctx = sampler.audioContext;
        if (!ctx) return;
        const anySoloed = globalSolos.size > 0;
        for (const track of audioTracks) {
            const bus = sampler.trackBuses[track.id];
            if (!bus?.gainNode) continue;
            const isMuted = globalMutes.has(track.id);
            const isSoloed = globalSolos.has(track.id);
            const shouldPlay = anySoloed ? isSoloed : !isMuted;
            // Preserve the user's volume setting (default 0.5) or mute to 0
            const userVol = bus._userGain ?? bus.gainNode.gain.value;
            if (!bus._userGain && shouldPlay) bus._userGain = bus.gainNode.gain.value; // snapshot original
            const targetGain = shouldPlay ? (bus._userGain ?? 0.5) : 0.0;
            bus.gainNode.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.015);
        }
    }, [globalMutes, globalSolos, audioTracks]);

    // Track state for snapshots
    const currentStateRef = useRef({});
    const isProcessingUndoRedo = useRef(false);

    useEffect(() => {
        currentStateRef.current = {
            patterns, globalKey, globalScale, globalTempo, globalBars, globalGenre, globalMood, chordsOctave, melodyOctave, bassOctave
        };
    }, [patterns, globalKey, globalScale, globalTempo, globalBars, globalGenre, globalMood, chordsOctave, melodyOctave, bassOctave]);

    const handleUndo = useCallback(() => {
        if (isProcessingUndoRedo.current) return;
        const snapshot = undo();
        if (snapshot) {
            isProcessingUndoRedo.current = true;
            setPatterns(snapshot.patterns);
            setGlobalKey(snapshot.globalKey);
            setGlobalScale(snapshot.globalScale);
            setGlobalTempo(snapshot.globalTempo);
            setGlobalBars(snapshot.globalBars);
            setGlobalGenre(snapshot.globalGenre);
            setGlobalMood(snapshot.globalMood);
            setChordsOctave(snapshot.chordsOctave);
            setMelodyOctave(snapshot.melodyOctave);
            setBassOctave(snapshot.bassOctave);

            // Push to generators safely
            setTimeout(() => {
                if (drumRef.current?.loadState) drumRef.current.loadState(snapshot.patterns.drums);
                if (chordsRef.current?.loadState) chordsRef.current.loadState(snapshot.patterns.chords);
                if (melodyRef.current?.loadState) melodyRef.current.loadState(snapshot.patterns.melody);
                if (bassRef.current?.loadState) bassRef.current.loadState(snapshot.patterns.bass);

                // Release the lock after generators have likely synced
                setTimeout(() => {
                    isProcessingUndoRedo.current = false;
                }, 100);
            }, 0);
        }
    }, [undo]);

    const handleRedo = useCallback(() => {
        if (isProcessingUndoRedo.current) return;
        const snapshot = redo();
        if (snapshot) {
            isProcessingUndoRedo.current = true;
            setPatterns(snapshot.patterns);
            setGlobalKey(snapshot.globalKey);
            setGlobalScale(snapshot.globalScale);
            setGlobalTempo(snapshot.globalTempo);
            setGlobalBars(snapshot.globalBars);
            setGlobalGenre(snapshot.globalGenre);
            setGlobalMood(snapshot.globalMood);
            setChordsOctave(snapshot.chordsOctave);
            setMelodyOctave(snapshot.melodyOctave);
            setBassOctave(snapshot.bassOctave);

            // Push to generators safely
            setTimeout(() => {
                if (drumRef.current?.loadState) drumRef.current.loadState(snapshot.patterns.drums);
                if (chordsRef.current?.loadState) chordsRef.current.loadState(snapshot.patterns.chords);
                if (melodyRef.current?.loadState) melodyRef.current.loadState(snapshot.patterns.melody);
                if (bassRef.current?.loadState) bassRef.current.loadState(snapshot.patterns.bass);

                // Release the lock after generators have likely synced
                setTimeout(() => {
                    isProcessingUndoRedo.current = false;
                }, 100);
            }, 0);
        }
    }, [redo]);

    const handleGlobalTranspose = useCallback((delta) => {
        // Shift octave states if delta is multiple of 12
        if (delta % 12 === 0) {
            const octDelta = delta / 12;
            setChordsOctave(prev => Math.max(0, Math.min(6, prev + octDelta)));
            setMelodyOctave(prev => Math.max(0, Math.min(6, prev + octDelta)));
            setBassOctave(prev => Math.max(0, Math.min(6, prev + octDelta)));
        }

        setPatterns(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(track => {
                if (Array.isArray(next[track])) {
                    next[track] = next[track].map(note => ({
                        ...note,
                        note: note.note + delta
                    }));
                }
            });
            return next;
        });

        // Push to external patterns to notify generators
        setExternalPatterns(prev => {
            return {
                chords: patterns.chords.map(n => ({ ...n, note: n.note + delta })),
                melody: patterns.melody.map(n => ({ ...n, note: n.note + delta })),
                bass: patterns.bass.map(n => ({ ...n, note: n.note + delta }))
            };
        });
    }, [patterns, chordsOctave, melodyOctave, bassOctave]);
    const [trackStatus, setTrackStatus] = useState({
        drums: { hasPattern: false, hasSamples: false },
        chords: { hasPattern: false, hasSamples: false },
        melody: { hasPattern: false, hasSamples: false },
        bass: { hasPattern: false, hasSamples: false }
    });

    const [externalPatterns, setExternalPatterns] = useState({
        chords: null,
        melody: null,
        bass: null
    });

    const [isGenerated, setIsGenerated] = useState({
        drums: false,
        chords: false,
        melody: false,
        bass: false
    });

    // Deferred folder generation — tracks which generators need algorithmic generation
    // after global state (genre, key, scale, tempo) has propagated via a render cycle
    const [folderGenPending, setFolderGenPending] = useState(null);


    // Global Sync Engine State
    const [globalIsPlaying, setGlobalIsPlaying] = useState(false);
    const [globalCurrentStep, setGlobalCurrentStep] = useState(0);
    const [globalAbsoluteStep, setGlobalAbsoluteStep] = useState(0); // Absolute step across entire arrangement
    const globalCurrentStepRef = useRef(0); // Written every rAF — polled by generators for audio scheduling
    const globalAbsoluteStepRef = useRef(0); // Absolute step across entire arrangement (for playhead sync)
    const globalIsPlayingRef = useRef(false); // Mirrors state for interval-based polling
    const playCooldownRef = useRef(false); // Guard for play/stop rapid clicks
    const recordCooldownRef = useRef(false); // Guard for record rapid clicks
    const tickerRef = useRef(null);
    const bgWorkerRef = useRef(null); // Web Worker timer for background playback
    const playStartTimeRef = useRef(0);
    const [globalPlayStartTime, setGlobalPlayStartTime] = useState(0); // For sync
    const stepDurationRef = useRef((60 / 140) / 8);
    const [globalContinuousProgress, setGlobalContinuousProgress] = useState(0); // Kept for counter UI

    // Create a Web Worker for background-safe timing (worker timers aren't throttled)
    useEffect(() => {
        try {
            const blob = new Blob([
                'self.onmessage=function(){setTimeout(function(){self.postMessage(1)},16)};'
            ], { type: 'application/javascript' });
            bgWorkerRef.current = new Worker(URL.createObjectURL(blob));
        } catch (_) { /* Workers unavailable — rAF-only fallback */ }
        return () => { bgWorkerRef.current?.terminate(); bgWorkerRef.current = null; };
    }, []);

    // Update step duration when tempo changes
    useEffect(() => {
        // 32 steps per bar (32th notes)
        stepDurationRef.current = (60 / globalTempo) / 8;
    }, [globalTempo]);

    // Mobile Link: sync solo/mute/volume/transport state to mobile clients
    useEffect(() => {
        if (!mobileLink.isActive) return;
        mobileLink.broadcastState({
            solos: Array.from(globalSolos),
            mutes: Array.from(globalMutes),
            volume: masterVolume,
            isPlaying: globalIsPlaying,
            tempo: globalTempo,
            desktopMuted: mobileLink.desktopMuted,
        });
    }, [mobileLink.isActive, globalSolos, globalMutes, masterVolume, globalIsPlaying, globalTempo, mobileLink.desktopMuted]);

    // Mobile Link: handle commands from mobile clients
    useEffect(() => {
        mobileLink.setCommandHandler((cmd) => {
            switch (cmd.type) {
                case MOBILE_MSG.SOLO_TOGGLE:
                    if (cmd.trackId) updateGlobalSolo(cmd.trackId, true, false);
                    break;
                case MOBILE_MSG.MUTE_TOGGLE:
                    if (cmd.trackId) {
                        setGlobalMutes(prev => {
                            const next = new Set(prev);
                            if (next.has(cmd.trackId)) next.delete(cmd.trackId);
                            else next.add(cmd.trackId);
                            return next;
                        });
                    }
                    break;
                case MOBILE_MSG.VOLUME:
                    if (typeof cmd.value === 'number') setMasterVolume(cmd.value);
                    break;
                case MOBILE_MSG.DESKTOP_MUTE:
                    mobileLink.setDesktopMuted(!!cmd.value);
                    break;
                default:
                    break;
            }
        });
    }, [mobileLink.setCommandHandler, mobileLink.setDesktopMuted, updateGlobalSolo, setGlobalMutes, setMasterVolume]);

    // Stop marker: bar position (0-based) where playback halts and resets to beginning
    // null = no stop marker. Can be placed at any bar in the arrangement.
    const [stopMarkerBar, setStopMarkerBar] = useState(0);
    const stopMarkerBarRef = useRef(stopMarkerBar);
    useEffect(() => { stopMarkerBarRef.current = stopMarkerBar; }, [stopMarkerBar]);

    const toggleStopMarker = useCallback((sectionId) => {
        // Legacy section-based toggle: places stop at the section's start bar
        setStopMarkerBar(prev => {
            let barOffset = 0;
            for (const s of arr.arrangement) {
                if (s.id === sectionId) {
                    return prev === barOffset ? null : barOffset;
                }
                barOffset += s.bars;
            }
            return prev;
        });
    }, [arr.arrangement]);

    const setStopMarkerAtBar = useCallback((bar) => {
        setStopMarkerBar(bar);
    }, []);

    const clearStopMarker = useCallback(() => setStopMarkerBar(null), []);

    // Refs for arrangement-aware playback (readable in rAF tick)
    const arrangementRef = useRef(null); // { sections, totalSteps, sectionBoundaries, stopStep }
    const currentArrangementSectionRef = useRef(null);
    // Keep arrangementRef populated whenever clips exist (any track), regardless
    // of active tab. This ensures centralized clip pollers keep playing clips
    // even when the user switches to drums/chords/melody tabs.
    const hasAnyAudioClips = audioTracks.some(t => t.clips.length > 0);
    const hasAnyClips = drumClips.length > 0 || chordClips.length > 0 || melodyClips.length > 0 || bassClips.length > 0 || hasAnyAudioClips;
    useEffect(() => {
        if (arr.arrangementMode && arr.arrangement.length > 0 && (activeTab === 'arrange' || hasAnyClips)) {
            const loopIds = loopSectionIdsRef.current;
            const filtered = loopIds.size > 0
                ? arr.arrangement.filter(s => loopIds.has(s.id))
                : arr.arrangement;
            let cumSteps = 0;
            const boundaries = [];
            filtered.forEach(s => {
                boundaries.push({ id: s.id, startStep: cumSteps, endStep: cumSteps + s.bars * 32 });
                cumSteps += s.bars * 32;
            });
            // Convert bar-based stop marker to step position
            const stopStep = stopMarkerBarRef.current != null ? stopMarkerBarRef.current * 32 : null;
            arrangementRef.current = { totalSteps: cumSteps, boundaries, stopStep };
        } else {
            arrangementRef.current = null;
        }
    }, [arr.arrangementMode, arr.arrangement, activeTab, hasAnyClips, loopSectionIds, stopMarkerBar]);

    // Track tab changes. Previously this halted playback when leaving the
    // arrange tab, but that's no longer needed since clipPlaybackActive is
    // gated on activeTab === 'arrange' — generators seamlessly take over.
    const prevTabRef = useRef(activeTab);
    useEffect(() => {
        prevTabRef.current = activeTab;
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    // Metronome — Ableton-style TICK/tock click track
    const { metronomeEnabled, setMetronomeEnabled, metronomeVolume, setMetronomeVolume } = useMetronome(
        globalCurrentStepRef,
        globalIsPlayingRef,
        globalTempo,
        globalBars
    );

    // ─── MIDI Track Bounce + Playback (declared here after all dependencies) ───
    const handleBounceMidiTrack = useCallback(async (trackId, section, bounceTrackType = 'audio', clipId) => {
        const mt = midiTracks.find(t => t.id === trackId);
        if (!mt?.instrumentId) {
            alert(t('app.loadSampleFirst'));
            return;
        }
        // Find the clip to bounce — specific clip or merge all clips
        let pattern, bounceBars, bounceTimelineBar;
        if (clipId) {
            const clip = (mt.clips || []).find(c => c.id === clipId);
            if (!clip?.pattern?.length) {
                alert(t('app.noNotesInClip'));
                return;
            }
            pattern = clip.pattern;
            bounceBars = clip.bars || 4;
            bounceTimelineBar = clip.timelineBar || 0;
        } else {
            // Merge all clips into one pattern
            const allNotes = [];
            let minBar = Infinity, maxBar = 0;
            for (const clip of (mt.clips || [])) {
                if (!clip.pattern?.length) continue;
                const clipStart = clip.timelineBar || 0;
                for (const n of clip.pattern) {
                    allNotes.push({ ...n, time: n.time + clipStart * 32 });
                }
                minBar = Math.min(minBar, clipStart);
                maxBar = Math.max(maxBar, clipStart + (clip.bars || 4));
            }
            if (!allNotes.length) {
                alert(t('app.noNotesToBounce'));
                return;
            }
            pattern = allNotes;
            bounceBars = maxBar - minBar;
            bounceTimelineBar = minBar;
        }
        const sectionId = section?.id || arr.activeSection || 'default';
        try {
            const stepDuration = (60 / globalTempo) / 8;
            const maxEnd = Math.max(...pattern.map(n => (n.time || 0) + (n.duration || 2)));
            const patternDuration = maxEnd * stepDuration;
            const sectionDuration = bounceBars * (240 / globalTempo);
            const durationSecs = Math.min(patternDuration + 0.5, sectionDuration);
            const audioBuffer = await samplerRef.current.renderPattern(mt.instrumentId, pattern, globalTempo, durationSecs);
            const prefix = bounceTrackType === 'vocal' ? 'Vocal' : 'Audio';
            const audioName = `${mt.name || 'MIDI'} (Bounced ${prefix})`;
            const newAudioId = `audio_${Date.now()}_${++audioTrackIdCounter.current}`;
            if (samplerRef.current) samplerRef.current.addTrackBus(newAudioId);
            setTrackMix(prev => ({ ...prev, [newAudioId]: { volume: 0.5, pan: 0 } }));
            const newClipId = `clip_${Date.now()}_${++audioClipIdCounter.current}`;
            setAudioTracks(prev => [...prev, {
                id: newAudioId, name: audioName, color: mt.color || '#ff9ff3',
                trackType: bounceTrackType,
                clips: [{
                    id: newClipId, sectionId,
                    buffer: audioBuffer, name: audioName,
                    playbackRate: 1.0, trimStart: 0, trimEnd: 0,
                    reversed: false, pitch: 0, fadeIn: 0, fadeOut: 0,
                    startBar: 0, timelineBar: bounceTimelineBar
                }]
            }]);
        } catch (err) {
            console.error('[Bounce] Error:', err);
            alert(t('app.bounceFailed', { error: err.message }));
        }
    }, [globalBars, globalTempo, midiTracks, arr.activeSection, arr.arrangement]);

    // Centralized MIDI Track Playback (runs for all MIDI tracks)
    const midiLastStepsRef = useRef({});
    useEffect(() => {
        if (!globalCurrentStepRef || !globalIsPlayingRef) return;
        const poll = () => {
            if (!globalIsPlayingRef.current || !samplerRef.current) return;
            const currentStep = globalCurrentStepRef.current;
            if (currentStep < 0) return;
            // Use timeline bars for continuous timeline, or globalBars for pattern mode
            const arrData = arrangementRef.current;
            let totalSteps;
            if (arrData && arrData.totalSteps) {
                totalSteps = arrData.totalSteps;
            } else {
                totalSteps = globalBars * 32;
            }
            const tracks = midiTracksRef.current;
            const anySoloed = globalSolos.size > 0;

            // Auto-resume AudioContext if it got suspended (e.g. browser throttling)
            if (samplerRef.current.audioContext.state === 'suspended') {
                samplerRef.current.audioContext.resume();
            }

            tracks.forEach(mt => {
                const hasVst3 = vst3InstrumentsRef.current.has(mt.id);
                if ((!mt.instrumentId && !hasVst3) || !mt.clips?.length) return;
                const lastStep = midiLastStepsRef.current[mt.id] ?? -1;
                if (lastStep === -1 || currentStep < lastStep) {
                    midiLastStepsRef.current[mt.id] = currentStep - 1;
                    return;
                }
                if (currentStep === lastStep) return;
                const isMuted = globalMutes.has(mt.id);
                const isSoloed = globalSolos.has(mt.id);
                const shouldPlay = anySoloed ? isSoloed : !isMuted;
                if (shouldPlay) {
                    const vst3Inst = vst3InstrumentsRef.current.get(mt.id);
                    // Cap catch-up to 4 steps max to prevent audio thread overload
                    // when rAF stalls and the step counter jumps forward
                    const catchUpStart = Math.max(lastStep + 1, currentStep - 3);
                    for (let step = catchUpStart; step <= currentStep; step++) {
                        // Iterate over all clips in the track
                        for (const clip of mt.clips) {
                            const clipStartStep = (clip.timelineBar || 0) * 32;
                            const clipEndStep = clipStartStep + (clip.bars || 4) * 32;
                            if (step < clipStartStep || step >= clipEndStep) continue;
                            const localStep = step - clipStartStep;
                            const notes = (clip.pattern || []).filter(n => Math.round(n.time) === localStep);
                            notes.forEach(n => {
                                if (vst3Inst?.node) {
                                    vst3Inst.node.noteOn(0, n.note, Math.round(n.velocity * 127));
                                    const durSec = (n.duration / 8) * (60 / globalTempo);
                                    setTimeout(() => vst3Inst.node.noteOff(0, n.note), durSec * 1000);
                                } else {
                                    samplerRef.current.playNote(
                                        mt.instrumentId, n.note, n.velocity,
                                        (n.duration / 8) * (60 / globalTempo), null, mt.id
                                    );
                                }
                            });
                        }
                    }
                }
                midiLastStepsRef.current[mt.id] = currentStep;
            });
        };
        const id = setInterval(poll, 25);
        return () => clearInterval(id);
    }, [globalCurrentStepRef, globalIsPlayingRef, globalBars, globalTempo, globalMutes, globalSolos]);

    // Reset MIDI playback step counters when playback stops
    useEffect(() => {
        if (!globalIsPlaying) {
            midiLastStepsRef.current = {};
        }
    }, [globalIsPlaying]);

    // Centralized Drum Clip Playback (runs when drumClips exist)
    const drumClipLastStepRef = useRef(-1);
    useEffect(() => {
        if (!globalCurrentStepRef || !globalIsPlayingRef) return;
        const poll = () => {
            if (!globalIsPlayingRef.current || !samplerRef.current) return;
            const currentStep = globalCurrentStepRef.current;
            if (currentStep < 0) return;
            const clips = drumClipsRef.current;
            if (clips.length === 0) return;
            const lastStep = drumClipLastStepRef.current;
            if (lastStep === -1 || currentStep < lastStep) {
                drumClipLastStepRef.current = currentStep - 1;
                return;
            }
            if (currentStep === lastStep) return;
            const isMuted = globalMutes.has('drums');
            const anySoloed = globalSolos.size > 0;
            const isSoloed = globalSolos.has('drums');
            const shouldPlay = anySoloed ? isSoloed : !isMuted;
            if (!shouldPlay) { drumClipLastStepRef.current = currentStep; return; }
            const basePitch = 24; // octave 1: (1+1)*12
            // Cap catch-up to 4 steps max to prevent audio thread overload
            const catchUpStart = Math.max(lastStep + 1, currentStep - 3);
            for (let step = catchUpStart; step <= currentStep; step++) {
                for (const clip of clips) {
                    const clipStartStep = (clip.timelineBar || 0) * 32;
                    const clipEndStep = clipStartStep + (clip.bars || 4) * 32;
                    if (step < clipStartStep || step >= clipEndStep) continue;
                    const localStep = step - clipStartStep;
                    const ds = clip.drumStates;
                    if (!ds) continue;
                    // Find base pattern length for looping
                    let drumBaseLen = clipEndStep - clipStartStep;
                    const firstLane = Object.values(ds)[0]?.lanes?.root?.pattern;
                    if (firstLane) drumBaseLen = Math.min(drumBaseLen, firstLane.length);
                    const loopedStep = drumBaseLen > 0 ? localStep % drumBaseLen : localStep;
                    Object.keys(ds).forEach(drumId => {
                        const drum = ds[drumId];
                        if (!drum.powered || drum.mute) return;
                        Object.values(drum.lanes).forEach(lane => {
                            if (lane.pattern[loopedStep]) {
                                const velocity = (lane.velocity[loopedStep] || 100) / 100;
                                const duration = ((lane.duration?.[loopedStep] || 1) / 8) * (60 / globalTempo);
                                const pitchShift = lane.pitch || 0;
                                samplerRef.current.playNote(drumId, basePitch + pitchShift, velocity, duration);
                            }
                        });
                    });
                }
            }
            drumClipLastStepRef.current = currentStep;
        };
        const id = setInterval(poll, 25);
        return () => clearInterval(id);
    }, [globalCurrentStepRef, globalIsPlayingRef, globalTempo, globalMutes, globalSolos, drumClips.length]);

    // Reset drum clip playback step counter when playback stops
    useEffect(() => {
        if (!globalIsPlaying) drumClipLastStepRef.current = -1;
    }, [globalIsPlaying]);

    // Centralized Chord/Melody/Bass Clip Playback
    const noteClipLastStepsRef = useRef({ chords: -1, melody: -1, bass: -1 });
    useEffect(() => {
        if (!globalCurrentStepRef || !globalIsPlayingRef) return;
        const clipRefs = { chords: chordClipsRef, melody: melodyClipsRef, bass: bassClipsRef };
        const instrumentKeys = { chords: 'chords', melody: 'melody', bass: 'bass' };
        const poll = () => {
            if (!globalIsPlayingRef.current || !samplerRef.current) return;
            const currentStep = globalCurrentStepRef.current;
            if (currentStep < 0) return;
            const anySoloed = globalSolos.size > 0;

            Object.entries(clipRefs).forEach(([trackKey, clipsRef]) => {
                const clips = clipsRef.current;
                if (clips.length === 0) return;
                const lastStep = noteClipLastStepsRef.current[trackKey];
                if (lastStep === -1 || currentStep < lastStep) {
                    noteClipLastStepsRef.current[trackKey] = currentStep - 1;
                    return;
                }
                if (currentStep === lastStep) return;
                const isMuted = globalMutes.has(trackKey);
                const isSoloed = globalSolos.has(trackKey);
                const shouldPlay = anySoloed ? isSoloed : !isMuted;
                const instrumentId = loadedInstrumentsRef.current?.[trackKey];
                if (!shouldPlay || !instrumentId) {
                    noteClipLastStepsRef.current[trackKey] = currentStep;
                    return;
                }
                // Cap catch-up to 4 steps max to prevent audio thread overload
                const catchUpStart = Math.max(lastStep + 1, currentStep - 3);
                for (let step = catchUpStart; step <= currentStep; step++) {
                    for (const clip of clips) {
                        const clipStartStep = (clip.timelineBar || 0) * 32;
                        const clipEndStep = clipStartStep + (clip.bars || 4) * 32;
                        if (step < clipStartStep || step >= clipEndStep) continue;
                        const localStep = step - clipStartStep;
                        const pattern = clip.pattern || [];
                        // Find base pattern length (actual content) for looping
                        const patternMaxStep = pattern.length > 0
                            ? Math.max(...pattern.map(n => Math.round(n.time) + 1))
                            : clipEndStep - clipStartStep;
                        const baseLen = Math.min(patternMaxStep, clipEndStep - clipStartStep);
                        const loopedStep = baseLen > 0 ? localStep % baseLen : localStep;
                        const notes = pattern.filter(n => Math.round(n.time) === loopedStep);
                        notes.forEach(n => {
                            samplerRef.current.playNote(instrumentId, n.note, n.velocity, (n.duration / 8) * (60 / globalTempo), null, trackKey);
                        });
                    }
                }
                noteClipLastStepsRef.current[trackKey] = currentStep;
            });
        };
        const id = setInterval(poll, 25);
        return () => clearInterval(id);
    }, [globalCurrentStepRef, globalIsPlayingRef, globalTempo, globalMutes, globalSolos]);

    useEffect(() => {
        if (!globalIsPlaying) noteClipLastStepsRef.current = { chords: -1, melody: -1, bass: -1 };
    }, [globalIsPlaying]);

    // Tap Tempo handler — called by the TAP button and the T key shortcut
    const handleTapTempo = useCallback(() => {
        const now = performance.now();
        const taps = tapTimesRef.current;

        // Reset if more than 2 seconds since last tap
        if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
            tapTimesRef.current = [];
        }

        tapTimesRef.current.push(now);

        // Keep only the last 4 taps
        if (tapTimesRef.current.length > 4) {
            tapTimesRef.current = tapTimesRef.current.slice(-4);
        }

        // Need at least 2 taps to compute an interval
        if (tapTimesRef.current.length >= 2) {
            const t = tapTimesRef.current;
            let totalInterval = 0;
            for (let i = 1; i < t.length; i++) {
                totalInterval += t[i] - t[i - 1];
            }
            const avgInterval = totalInterval / (t.length - 1);
            const bpm = Math.round(Math.max(20, Math.min(300, 60000 / avgInterval)));
            setGlobalTempo(bpm);
        }

        // Flash the TAP button with an orange-yellow color
        if (tapBtnRef.current) {
            tapBtnRef.current.style.background = acSec;
            tapBtnRef.current.style.color = '#000';
            setTimeout(() => {
                if (tapBtnRef.current) {
                    tapBtnRef.current.style.background = 'transparent';
                    tapBtnRef.current.style.color = '';
                }
            }, 100);
        }
    }, []);

    // Deferred folder generation — fires AFTER React has committed state updates
    // (genre, key, scale, tempo) so generators see current values in their closures
    useEffect(() => {
        if (!folderGenPending) return;
        const pending = folderGenPending;
        setFolderGenPending(null);

        if (pending.drums && drumRef.current?.generate) drumRef.current.generate();
        if (pending.chords && chordsRef.current?.generate) chordsRef.current.generate();
        if (pending.melody && melodyRef.current?.generate) melodyRef.current.generate();
        if (pending.bass && bassRef.current?.generate) bassRef.current.generate();

        console.log('[FolderGen] Deferred generation fired:', pending);
    }, [folderGenPending]);

    // Optimized Master Ticker Loop (High Precision)
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Track fullscreen changes (e.g. ESC key)
    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    useEffect(() => {
        globalIsPlayingRef.current = globalIsPlaying;

        // Tell SamplerEngine whether audio is active so the hot-swap only runs when needed
        if (samplerRef.current?.setAudioActive) {
            samplerRef.current.setAudioActive(globalIsPlaying || isRecording || isCountingIn);
        }

        // Sync native transport clock (drives VST3 plugin transport state)
        console.log(`[Transport] isPlaying=${globalIsPlaying}, tempo=${globalTempo}, bars=${globalBars}`);
        // Stop is handled here for immediate response.
        // Play is handled in the tick loop useEffect below so that
        // transport.play() happens AFTER setTransportState + buffer priming.
        if (!globalIsPlaying && window.electronAPI?.transport) {
            window.electronAPI.transport.stop();
        }
    }, [globalIsPlaying, isRecording, isCountingIn]);

    // Keep native transport clock in sync when tempo or bars change mid-playback
    useEffect(() => {
        if (window.electronAPI?.transport) {
            window.electronAPI.transport.setTempo(globalTempo);
        }
        // Also update VST3 host transport state so plugins see new tempo immediately
        if (globalIsPlayingRef.current && window.electronAPI?.vst3Host?.setTransportState) {
            const positionBeats = globalCurrentStepRef.current / 8;
            window.electronAPI.vst3Host.setTransportState({
                tempo: globalTempo,
                positionBeats,
                timeSigNumerator: 4,
                timeSigDenominator: 4,
                isPlaying: true,
                isRecording: false,
                loopEnabled: true,
                loopStartBeats: 0,
                loopEndBeats: globalBars * 4,
            });
        }
    }, [globalTempo]);
    useEffect(() => {
        if (window.electronAPI?.transport) {
            window.electronAPI.transport.setBars(globalBars);
            // Keep loop end in sync with bar count
            window.electronAPI.transport.setLoop(true, 0, globalBars * 4);
        }
        // Also update VST3 host transport state so plugins see new bar count
        if (globalIsPlayingRef.current && window.electronAPI?.vst3Host?.setTransportState) {
            const positionBeats = globalCurrentStepRef.current / 8;
            window.electronAPI.vst3Host.setTransportState({
                tempo: globalTempo,
                positionBeats,
                timeSigNumerator: 4,
                timeSigDenominator: 4,
                isPlaying: true,
                isRecording: false,
                loopEnabled: true,
                loopStartBeats: 0,
                loopEndBeats: globalBars * 4,
            });
        }
    }, [globalBars]);

    // Listen for spacebar toggle from VST3 editor windows (native → IPC → renderer)
    useEffect(() => {
        if (!window.electronAPI?.vst3Host?.onTogglePlayback) return;
        const toggle = () => setGlobalIsPlaying(prev => !prev);
        window.electronAPI.vst3Host.onTogglePlayback(toggle);
        return () => {
            window.electronAPI.vst3Host.removeTogglePlaybackListener?.();
        };
    }, []);

    // Stop all active audio clip source nodes with smooth fade-out
    const stopActiveAudioClips = useCallback(() => {
        const ct = samplerRef.current?.audioContext?.currentTime || 0;
        activeAudioClipSources.current.forEach(entry => {
            try {
                if (entry.gainNode) {
                    // Use cancelAndHoldAtTime to freeze at current gain value, avoiding
                    // the jump-to-full-volume artifact caused by cancelScheduledValues
                    if (typeof entry.gainNode.gain.cancelAndHoldAtTime === 'function') {
                        entry.gainNode.gain.cancelAndHoldAtTime(ct);
                    } else {
                        entry.gainNode.gain.cancelScheduledValues(ct);
                        entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, ct);
                    }
                    entry.gainNode.gain.linearRampToValueAtTime(0, ct + 0.015);
                }
                if (entry.source) entry.source.stop(ct + 0.03);
            } catch (_) { /* already stopped */ }
        });
        activeAudioClipSources.current = [];
    }, []);

    /**
     * Schedule ALL audio clips across the full timeline at playback start.
     * Each clip is positioned by timelineBar (absolute bar position).
     * Web Audio handles mixing — no JS section-switching needed for audio tracks.
     */
    const scheduleAudioClipsForTimeline = useCallback((playbackStartTimeSecs, timelineElapsedSecs = 0) => {
        const sampler = samplerRef.current;
        if (!sampler) return;
        const tracks = audioTracksRef.current;
        if (!tracks || tracks.length === 0) return;
        const ctx = sampler.audioContext;

        // Idempotent: stop all existing audio clip sources before scheduling new ones.
        // This prevents duplicate source nodes when called multiple times per tick
        // (hot-swap detection + loop-back detection can both fire in the same frame).
        activeAudioClipSources.current.forEach(entry => {
            try { if (entry.source) entry.source.stop(0); } catch (_) {}
        });
        activeAudioClipSources.current = [];
        const tempo = globalTempo;
        const secondsPerBar = 4 * 60 / tempo;
        const arrangement = arr.arrangement || [];

        // Calculate total arrangement duration for clamping clip playback
        const totalArrangementBars = arrangement.reduce((sum, s) => sum + s.bars, 0);
        const arrangementEndSecs = totalArrangementBars * secondsPerBar;

        let scheduledCount = 0;
        const currentSolos = globalSolosRef.current;
        const anySoloed = currentSolos && currentSolos.size > 0;
        tracks.forEach(track => {
            if (globalMutesRef.current && globalMutesRef.current.has(track.id)) return;
            // Solo: if any track is soloed, skip non-soloed tracks
            if (anySoloed && !currentSolos.has(track.id)) return;

            track.clips.forEach(clip => {
                if (!clip.buffer) return;

                // Resolve absolute bar position
                const absBar = clip.timelineBar != null
                    ? clip.timelineBar
                    : computeTimelineBar(clip, arrangement);

                let buffer = clip.buffer;
                if (clip.reversed) {
                    const reversedBuf = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
                    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
                        const src = buffer.getChannelData(ch);
                        const dst = reversedBuf.getChannelData(ch);
                        for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i];
                    }
                    buffer = reversedBuf;
                }

                const playbackRate = clip.playbackRate || Math.pow(2, (clip.pitch || 0) / 12);
                const trimStart = clip.trimStart || 0;
                const trimEnd = clip.trimEnd || 0;
                const totalDuration = buffer.duration / playbackRate;
                const clipDuration = Math.max(0.01, totalDuration - trimStart - trimEnd);
                const clipStartSecs = absBar * secondsPerBar;

                // Diagnostic: log clip scheduling details
                console.log(
                    `[ClipSchedule] "${clip.name}" | bar: ${absBar} | ` +
                    `bufDur: ${buffer.duration.toFixed(2)}s | bufLen: ${buffer.length} | ` +
                    `bufRate: ${buffer.sampleRate} | clipDur: ${clipDuration.toFixed(2)}s | ` +
                    `startSecs: ${clipStartSecs.toFixed(2)}s | rate: ${playbackRate}`
                );

                // Resume compensation: how far into this clip we already are
                const clipLateBy = Math.max(0, timelineElapsedSecs - clipStartSecs);
                let remainingDur = clipDuration - clipLateBy;
                // Clamp to arrangement end — prevent audio from playing past the last section
                // Skip clamping for recording clips: they may be longer than the arrangement
                const isRecordingClip = clip.name && clip.name.startsWith('Recording');
                if (arrangementEndSecs > 0 && !isRecordingClip) {
                    const arrangementRemaining = Math.max(0, arrangementEndSecs - clipStartSecs - clipLateBy);
                    remainingDur = Math.min(remainingDur, arrangementRemaining);
                }
                if (remainingDur <= 0.01) return; // clip already finished or past arrangement end

                const LOOKAHEAD = 0.02;
                const scheduleTime = playbackStartTimeSecs + LOOKAHEAD + Math.max(0, clipStartSecs - timelineElapsedSecs);
                const bufferOffset = Math.min(
                    trimStart + clipLateBy * playbackRate,
                    Math.max(0, buffer.duration - 0.001) // Prevent exceeding buffer bounds
                );

                const result = sampler.playAudioClip(buffer, track.id, scheduleTime, playbackRate, bufferOffset, remainingDur);
                if (!result) return;

                result._clipId = clip.id;
                result._trackId = track.id;
                result._timelineBar = absBar;
                result._playbackRate = playbackRate;

                // Apply user fade in/out (only when user explicitly set fades).
                // playAudioClip() already handles anti-click fade-in (8ms) and fade-out (25ms)
                // for ALL clips — do NOT add duplicate gain automation here for the no-fade case,
                // as it conflicts with playAudioClip's ramps and causes gain jumps / crackling.
                const { gainNode } = result;
                const fadeIn = clip.fadeIn || 0;
                const fadeOut = clip.fadeOut || 0;
                if (fadeIn > 0 || fadeOut > 0) {
                    // Cancel playAudioClip's default fades and replace with user fades
                    if (typeof gainNode.gain.cancelAndHoldAtTime === 'function') {
                        gainNode.gain.cancelAndHoldAtTime(scheduleTime);
                    } else {
                        gainNode.gain.cancelScheduledValues(scheduleTime);
                    }
                    const effectiveFadeIn = clipLateBy > fadeIn ? 0.008 : Math.max(fadeIn - clipLateBy, 0.008);
                    gainNode.gain.setValueAtTime(0, scheduleTime);
                    gainNode.gain.linearRampToValueAtTime(1, scheduleTime + Math.min(effectiveFadeIn, remainingDur));
                    const effectiveFadeOut = Math.max(fadeOut, 0.025);
                    const fadeOutStart = scheduleTime + Math.max(effectiveFadeIn + 0.001, remainingDur - effectiveFadeOut);
                    gainNode.gain.setValueAtTime(1.0, fadeOutStart);
                    gainNode.gain.linearRampToValueAtTime(0, scheduleTime + remainingDur);
                }

                activeAudioClipSources.current.push(result);
            });
        });
    }, [globalTempo]);

    const prevGlobalStepRef = useRef(-1); // Track previous global step for loop-back detection

    useEffect(() => {
        let lastUIStep = -1;
        let lastReactUpdateTime = 0; // Throttle React state updates to ~8 Hz
        let lastVstSyncTime = 0; // Throttle VST transport sync to ~2 Hz
        prevGlobalStepRef.current = -1; // Reset on play state change
        let tickFn = null; // Reference to tick so visibilitychange can re-kick it
        let lastAudioCtx = samplerRef.current?.audioContext || null; // Track context for hot-swap detection

        // Schedule the next tick: use rAF when visible, Worker timer when hidden.
        // Browser throttles rAF to 0fps for hidden/minimized windows, which would
        // stall the playback loop.  A Web Worker's setInterval is NOT throttled.
        const scheduleNext = (fn) => {
            if (document.hidden && bgWorkerRef.current) {
                // Worker fires a single 'tick' then stops; we re-arm each time.
                bgWorkerRef.current.onmessage = () => fn();
                bgWorkerRef.current.postMessage('once');
            } else {
                tickerRef.current = requestAnimationFrame(fn);
            }
        };

        // When the page becomes hidden (minimized, behind another window, tab switch),
        // rAF stalls. Immediately cancel the pending rAF and re-kick via the Worker timer
        // so playback continues uninterrupted in the background.
        const onVisibilityChange = () => {
            if (document.hidden && globalIsPlayingRef.current && tickFn && bgWorkerRef.current) {
                // Cancel the stalled rAF and immediately switch to worker-driven ticks
                if (tickerRef.current) {
                    cancelAnimationFrame(tickerRef.current);
                    tickerRef.current = null;
                }
                scheduleNext(tickFn);
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        const tick = () => {
            if (!globalIsPlaying) return;

          try {
            // Auto-resume AudioContext if browser suspended it (tab switch, GC pause, etc.)
            const ctx = samplerRef.current?.audioContext;
            if (ctx && ctx.state !== 'running') {
                ctx.resume();
            }

            // Detect AudioContext hot-swap: if the context changed, the old
            // AudioBufferSourceNodes for audio clips are dead (connected to
            // the old context's graph). Re-schedule them on the new context.
            if (ctx && ctx !== lastAudioCtx) {
                // Stop old sources on the OLD context
                activeAudioClipSources.current.forEach(entry => {
                    try { if (entry.source) entry.source.stop(0); } catch (_) {}
                });
                activeAudioClipSources.current = [];
                lastAudioCtx = ctx;

                // Compute the wrapped position within the active loop or arrangement
                const rawElapsed = (performance.now() - playStartTimeRef.current) / 1000;
                const stepDur = stepDurationRef.current;
                const activeLoop = loopRangeRef.current;
                const swapNow = ctx.currentTime || 0;

                let loopDurationSecs = 0;
                let wrappedElapsed = rawElapsed;

                if (activeLoop && stepDur > 0) {
                    const loopStartSecs = activeLoop.startBar * 4 * 60 / globalTempo;
                    const loopEndSecs = activeLoop.endBar * 4 * 60 / globalTempo;
                    loopDurationSecs = loopEndSecs - loopStartSecs;
                    if (loopDurationSecs > 0 && rawElapsed >= loopStartSecs) {
                        wrappedElapsed = loopStartSecs + ((rawElapsed - loopStartSecs) % loopDurationSecs);
                    }
                } else if (arrangementRef.current && arrangementRef.current.arrangement && arrangementRef.current.arrangement.length > 0 && stepDur > 0) {
                    // Only use arrangement totalSteps when there IS an arrangement
                    const arrDur = arrangementRef.current.totalSteps * stepDur;
                    if (arrDur > 0) {
                        loopDurationSecs = arrDur;
                        wrappedElapsed = rawElapsed % arrDur;
                    }
                } else if (stepDur > 0) {
                    // Normal mode (generators only): loop within globalBars
                    loopDurationSecs = globalBars * 32 * stepDur;
                    wrappedElapsed = rawElapsed % loopDurationSecs;
                }

                console.log(`[Playback] Hot-swap — wrapped ${wrappedElapsed.toFixed(2)}s (raw ${rawElapsed.toFixed(2)}s, loop ${loopDurationSecs.toFixed(2)}s)`);

                // Schedule clips at the wrapped position
                scheduleAudioClipsForTimeline(swapNow, wrappedElapsed);

                // If clips have already finished at this position, also pre-schedule
                // them for the next loop iteration start (prevents silence gap)
                if (loopDurationSecs > 0 && activeAudioClipSources.current.length === 0) {
                    // No clips were scheduled (all finished) — schedule from loop start
                    const timeUntilLoopRestart = loopDurationSecs - (wrappedElapsed % loopDurationSecs);
                    const futureNow = swapNow + timeUntilLoopRestart;
                    const loopStart = activeLoop ? activeLoop.startBar * 4 * 60 / globalTempo : 0;
                    console.log(`[Playback] All clips finished — pre-scheduling next loop in ${timeUntilLoopRestart.toFixed(2)}s`);
                    scheduleAudioClipsForTimeline(futureNow, loopStart);
                }

                // DON'T reset prevGlobalStepRef — let the loop-back detection
                // continue working normally for subsequent loop wraps
            }

            const now = performance.now();
            const elapsedSecs = (now - playStartTimeRef.current) / 1000;
            const currentStepDuration = stepDurationRef.current;

            if (currentStepDuration <= 0) { scheduleNext(tick); return; }

            const arrData = arrangementRef.current;
            const hasArrangement = arrData && arrData.arrangement && arrData.arrangement.length > 0;
            let discreteStep, currentPos;

            if (hasArrangement) {
                // Arrangement mode: use total arrangement steps
                const totalSteps = arrData.totalSteps;
                const rawPos = elapsedSecs / currentStepDuration;

                // Bar-range loop check: if loopRange is set, wrap within range
                const activeLoopRange = loopRangeRef.current;
                const hasActiveLoop = activeLoopRange != null;
                const hasLegacyLoop = !hasActiveLoop && loopSectionIdsRef.current && loopSectionIdsRef.current.size > 0;

                // Stop marker check: ignored if loop is active
                if (!hasActiveLoop && !hasLegacyLoop && arrData.stopStep != null && arrData.stopStep > 0 && rawPos >= arrData.stopStep) {
                    setTimeout(() => {
                        setGlobalIsPlaying(false);
                    }, 0);
                    return;
                }

                // Bar-range looping: wrap playhead within loop range
                if (hasActiveLoop) {
                    const loopStartStep = activeLoopRange.startBar * 32;
                    const loopEndStep = activeLoopRange.endBar * 32;
                    const loopLength = loopEndStep - loopStartStep;
                    if (loopLength > 0 && rawPos >= loopEndStep) {
                        // Calculate wrapped position within loop
                        const wrappedPos = loopStartStep + ((rawPos - loopStartStep) % loopLength);
                        // Detect if we're about to cross the loop end (near the end of an iteration)
                        const posInLoop = (rawPos - loopStartStep) % loopLength;
                        const nearEnd = posInLoop >= loopLength - 2; // within last 2 steps of loop

                        if (loopPendingDeactivate.current && nearEnd) {
                            // Current iteration is finishing — deactivate loop and continue linearly
                            const loopEndSecs = loopEndStep * currentStepDuration;
                            playStartTimeRef.current = now - (loopEndSecs * 1000);
                            loopRangeRef.current = null;
                            loopPendingDeactivate.current = false;
                            currentPos = loopEndStep % totalSteps;
                        } else {
                            // Keep looping (wrap within range)
                            currentPos = wrappedPos;
                        }
                    } else {
                        currentPos = rawPos % totalSteps;
                    }
                } else {
                    currentPos = rawPos % totalSteps;
                }
                const globalStep = Math.floor(currentPos);

                // Detect genuine loop-back
                const loopedBack = prevGlobalStepRef.current > -1 && globalStep < prevGlobalStepRef.current;
                prevGlobalStepRef.current = globalStep;

                // Continuous timeline: no section boundaries to track
                // Just detect when arrangement loops back and reschedule audio clips
                if (loopedBack) {
                    stopActiveAudioClips();
                    const now = samplerRef.current?.audioContext?.currentTime || 0;
                    const totalElapsedSecs = globalStep * currentStepDuration;
                    scheduleAudioClipsForTimeline(now, totalElapsedSecs);
                }

                // Keep active section set (single implicit section)
                const sectionLocal = globalStep;

                // Prune dead sources from the active list
                activeAudioClipSources.current = activeAudioClipSources.current.filter(e => {
                    try {
                        // BufferSource states: 1=scheduled, 2=playing, 3=finished
                        // Some browsers don't expose playbackState — keep those entries
                        if (e.source && typeof e.source.playbackState === 'number') {
                            return e.source.playbackState !== 3;
                        }
                        return true; // keep if state unknown
                    } catch (_) { return false; }
                });

                // Generators expect section-local step (they loop within section bars)
                discreteStep = sectionLocal;
                // Store absolute step for arrangement playhead positioning
                globalAbsoluteStepRef.current = globalStep;

                // During recording, override with actual recording position from ref
                // This keeps the playhead synced to recorded audio, not wall-clock time
                if (isRecordingRef.current && recordingElapsedRef.current > 0) {
                    const secondsPerBar = 240 / globalTempo;
                    const recBars = recordingElapsedRef.current / secondsPerBar;
                    const recStartBar = recordingStartBarRef.current || 0;
                    globalAbsoluteStepRef.current = Math.floor((recStartBar + recBars) * 32);
                }

                // Auto-extend timeline during recording
                if (isRecordingRef.current && !autoExtendRef.current) {
                    const recElapsed = recordingElapsedRef.current;
                    if (recElapsed > 0) {
                        const secondsPerBarAE = 240 / globalTempo;
                        const recEndBar = (recordingStartBarRef.current || 0) + (recElapsed / secondsPerBarAE);
                        const currentTotalBars = timelineBarsRef.current;
                        if (recEndBar + TIMELINE_CHUNK > currentTotalBars) {
                            autoExtendRef.current = true;
                            setTimeout(() => {
                                setTimelineBars(Math.ceil((recEndBar + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK);
                                setTimeout(() => { autoExtendRef.current = false; }, 500);
                            }, 0);
                        }
                    }
                }
            } else {
                // Normal mode: loop within globalBars
                const totalWidthSteps = globalBars * 32;
                currentPos = (elapsedSecs / currentStepDuration) % totalWidthSteps;
                discreteStep = Math.floor(currentPos);
                globalAbsoluteStepRef.current = discreteStep;

                // Detect loop-back in normal mode and reschedule audio clips
                const loopedBackNormal = prevGlobalStepRef.current > -1 && discreteStep < prevGlobalStepRef.current;
                prevGlobalStepRef.current = discreteStep;
                if (loopedBackNormal) {
                    const ctx = samplerRef.current?.audioContext;
                    console.log(`[Loop] Normal mode loop-back detected. step=${discreteStep}, ctx.state=${ctx?.state}, _audioActive=${samplerRef.current?._audioActive}`);
                    stopActiveAudioClips();
                    const now = ctx?.currentTime || 0;
                    const totalElapsedSecs = discreteStep * currentStepDuration;
                    scheduleAudioClipsForTimeline(now, totalElapsedSecs);
                }
                // Log context state every ~2 seconds during playback
                if (discreteStep % 64 === 0) {
                    const ctx = samplerRef.current?.audioContext;
                    console.log(`[Tick] step=${discreteStep}, ctx.state=${ctx?.state}, _audioActive=${samplerRef.current?._audioActive}`);
                }
            }

            // CRITICAL: Update ref on EVERY frame so interval-based audio
            // schedulers in generators can read the latest step immediately.
            globalCurrentStepRef.current = discreteStep;

            // --- Automation playback: evaluate automation curves and apply to tracks ---
            const automationData = trackAutomationRef.current;
            if (automationData && typeof automationData === 'object') {
                // currentPos is in steps; convert to bar position (32 steps per bar)
                const currentBarPos = currentPos / 32;
                const sampler = samplerRef.current;
                if (sampler) {
                    for (const trackId of Object.keys(automationData)) {
                        const paramMap = automationData[trackId];
                        if (!paramMap) continue;
                        for (const paramKey of Object.keys(paramMap)) {
                            const points = paramMap[paramKey];
                            const normalizedVal = interpolateAutomation(points, currentBarPos);
                            if (normalizedVal === null) continue;
                            if (paramKey === 'volume') {
                                sampler.setTrackVolume(trackId, normalizedVal);
                            } else if (paramKey === 'pan') {
                                // pan: normalized 0–1 maps to -1..+1
                                sampler.setTrackPan(trackId, denormalizeValue('pan', normalizedVal));
                            }
                            // Effect params would go here: paramKey like 'effect_<id>_<name>'
                        }
                    }
                }
            }

            // Periodic VST transport position sync (~2 Hz) to prevent drift between
            // the renderer's performance.now() clock and the C++ sample-accurate clock.
            // Kept infrequent to avoid position jump-backs that cause double-triggering.
            if (window.electronAPI?.vst3Host?.setTransportState) {
                const vstNow = performance.now();
                if (vstNow - lastVstSyncTime > 500) { // ~2 Hz
                    lastVstSyncTime = vstNow;
                    const positionBeats = currentPos / 8;
                    window.electronAPI.vst3Host.setTransportState({
                        tempo: globalTempo,
                        positionBeats,
                        timeSigNumerator: 4,
                        timeSigDenominator: 4,
                        isPlaying: true,
                        isRecording: false,
                        loopEnabled: true,
                        loopStartBeats: 0,
                        loopEndBeats: globalBars * 4,
                    });
                }
            }

            // Throttle React state updates to reduce main thread load.
            // Audio scheduling uses globalCurrentStepRef (updated above on every
            // frame) and is completely unaffected.  UI updates (BAR counter,
            // playhead, step highlights) are throttled to ~8 Hz which is
            // perceptually smooth but cuts re-render overhead by ~60%.
            if (discreteStep !== lastUIStep) {
                lastUIStep = discreteStep;
                const uiNow = performance.now();
                if (uiNow - lastReactUpdateTime > 120) { // ~8 Hz cap
                    lastReactUpdateTime = uiNow;
                    setGlobalCurrentStep(discreteStep);
                    setGlobalAbsoluteStep(globalAbsoluteStepRef.current);
                    setGlobalContinuousProgress(currentPos);
                }
            }

          } catch (err) {
            console.error('[Tick] Error in playback loop (recovering):', err);
          }
            scheduleNext(tick);
        };
        tickFn = tick; // Store reference for visibilitychange handler

        if (globalIsPlaying) {
            // Async start: ensure AudioContext, transport state, and VST buffers
            // are all ready BEFORE the tick loop begins.
            const startPlayback = async () => {
                console.log('Global Playback Starting...', { globalIsPlaying, globalBars, globalTempo });

                // 1. Await AudioContext.resume() — prevents jittery ScriptProcessor callbacks
                if (samplerRef.current && samplerRef.current.audioContext.state === 'suspended') {
                    console.log('Resuming AudioContext...');
                    await samplerRef.current.audioContext.resume();
                    console.log('AudioContext resumed:', samplerRef.current.audioContext.state);
                }

                // 2. VST3-specific prep: set transport state + prime buffers.
                //    Wrapped in try/catch so playback always starts even if VST IPC fails.
                try {
                    // Set transport state DIRECTLY on native addon so VST plugins
                    // see isPlaying=true from their very first processBlock.
                    if (window.electronAPI?.vst3Host?.setTransportState) {
                        // Calculate starting beat position so VST matches playhead
                        let startBeats = 0;
                        if (globalContinuousProgress > 0) {
                            // Resuming from pause — convert step position to beats
                            startBeats = globalContinuousProgress / 8;
                        } else if (audioInsertionBarRef.current != null) {
                            // Starting from insertion point
                            startBeats = audioInsertionBarRef.current * 4;
                        }
                        await window.electronAPI.vst3Host.setTransportState({
                            tempo: globalTempo,
                            positionBeats: startBeats,
                            timeSigNumerator: 4,
                            timeSigDenominator: 4,
                            isPlaying: true,
                            isRecording: false,
                            loopEnabled: true,
                            loopStartBeats: 0,
                            loopEndBeats: globalBars * 4,
                        });
                    }

                    // Clear stuck notes and prime VST instrument buffers
                    const vst3Promises = [];
                    for (const [, vst3Entry] of vst3InstrumentsRef.current.entries()) {
                        if (vst3Entry?.node) {
                            vst3Promises.push(vst3Entry.node.sendCC(0, 123, 0).catch(() => {}));
                            if (vst3Entry.node.prepareForPlayback) {
                                vst3Promises.push(vst3Entry.node.prepareForPlayback().catch(() => {}));
                            }
                        }
                    }
                    if (vst3Promises.length > 0) {
                        await Promise.all(vst3Promises);
                    }
                } catch (err) {
                    console.warn('[Playback] VST3 prep failed (non-fatal):', err);
                }

                // 3. Start native transport clock
                if (window.electronAPI?.transport) {
                    window.electronAPI.transport.setTempo(globalTempo);
                    window.electronAPI.transport.setBars(globalBars);
                    window.electronAPI.transport.setLoop(true, 0, globalBars * 4);
                    window.electronAPI.transport.play();
                }

                // 4. Bail if playback was stopped while we were awaiting
                if (!globalIsPlayingRef.current) return;

                // 5. Set timing AFTER all awaits for accurate elapsed-time calculation
                const readyNow = performance.now();
                const newStepDuration = (60 / globalTempo) / 8;
                if (globalContinuousProgress > 0 && playStartTimeRef.current > 0) {
                    // Resuming from pause — offset start time to maintain position
                    playStartTimeRef.current = readyNow - (globalContinuousProgress * newStepDuration * 1000);
                } else if (audioInsertionBarRef.current != null) {
                    // Fresh start from insertion point — offset start time so elapsed
                    // calculation begins at the insertion bar position
                    const insertionStep = audioInsertionBarRef.current * 32;
                    playStartTimeRef.current = readyNow - (insertionStep * newStepDuration * 1000);
                } else {
                    playStartTimeRef.current = readyNow;
                }
                setGlobalPlayStartTime(playStartTimeRef.current);

                // Schedule ALL audio clips across the full timeline at playback start.
                // No section-based scheduling for audio — continuous playback, no clicks.
                if (arrangementRef.current && arrangementRef.current.boundaries.length > 0) {
                    const arrData = arrangementRef.current;
                    // Determine resume step: pause position > insertion bar > beginning
                    let resumeStep;
                    if (globalContinuousProgress > 0) {
                        resumeStep = Math.floor(globalContinuousProgress % arrData.totalSteps);
                    } else if (audioInsertionBarRef.current != null) {
                        resumeStep = Math.floor(audioInsertionBarRef.current * 32) % arrData.totalSteps;
                    } else {
                        resumeStep = 0;
                    }
                    // Continuous timeline: set active section to the single implicit section
                    if (arr.arrangement.length > 0) {
                        currentArrangementSectionRef.current = arr.arrangement[0].id;
                    }
                    const now = samplerRef.current?.audioContext?.currentTime || 0;
                    const totalElapsedSecs = resumeStep * stepDurationRef.current;
                    scheduleAudioClipsForTimeline(now, totalElapsedSecs);
                }

                scheduleNext(tick);
            };
            startPlayback().catch(err => {
                // Absolute safety net: if startPlayback throws, start the tick
                // loop anyway so the user isn't stuck with a dead play button.
                console.error('[Playback] startPlayback failed, starting tick loop anyway:', err);
                playStartTimeRef.current = performance.now();
                setGlobalPlayStartTime(playStartTimeRef.current);
                scheduleNext(tick);
            });
        } else {
            if (tickerRef.current) cancelAnimationFrame(tickerRef.current);
            // Stop worker timer if running
            if (bgWorkerRef.current) bgWorkerRef.current.onmessage = null;
            // CRITICAL: Stop all active audio nodes on playback stop.
            // Without this, every play/stop cycle leaves orphaned nodes still
            // connected to the audio graph.  After several cycles the graph
            // becomes overloaded and the audio thread crackles.
            stopActiveAudioClips();
            if (samplerRef.current) {
                samplerRef.current.stopAll();
            }

            // Send All Notes Off to VST3 instruments to prevent stuck notes
            for (const [, vst3Entry] of vst3InstrumentsRef.current.entries()) {
                if (vst3Entry?.node?.sendCC) {
                    vst3Entry.node.sendCC(0, 123, 0);
                }
            }

            // Reset transport state on native addon immediately
            if (window.electronAPI?.vst3Host?.setTransportState) {
                window.electronAPI.vst3Host.setTransportState({
                    tempo: globalTempo,
                    positionBeats: 0,
                    timeSigNumerator: 4,
                    timeSigDenominator: 4,
                    isPlaying: false,
                    isRecording: false,
                    loopEnabled: false,
                    loopStartBeats: 0,
                    loopEndBeats: globalBars * 4,
                });
            }

            globalCurrentStepRef.current = 0;
            globalAbsoluteStepRef.current = 0;
            playStartTimeRef.current = 0;
            setGlobalPlayStartTime(0);
            setGlobalCurrentStep(0);
            setGlobalAbsoluteStep(0);
            setGlobalContinuousProgress(0);
        }

        return () => {
            if (tickerRef.current) cancelAnimationFrame(tickerRef.current);
            if (bgWorkerRef.current) bgWorkerRef.current.onmessage = null;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            tickFn = null;
        };
    }, [globalIsPlaying, globalBars, globalTempo]);

    // Pre-warm the AudioContext on FIRST user interaction, then suspend after a short
    // window if no playback/recording starts. This prevents the Realtek driver from
    // degrading into static while the user browses lyrics or settings.
    useEffect(() => {
        let idleTimer;
        const warmAudio = () => {
            if (samplerRef.current && samplerRef.current.audioContext.state === 'suspended') {
                samplerRef.current.audioContext.resume().then(() => {
                    console.log("[WavLoom] Global AudioContext pre-warmed for zero-latency playback.");
                    // Auto-suspend after 3s if no audio activity started
                    // (setAudioActive(true) clears this via its own resume path)
                    idleTimer = setTimeout(() => {
                        const s = samplerRef.current;
                        if (s && !s._audioActive && s.audioContext.state === 'running') {
                            s.audioContext.suspend().catch(() => {});
                            console.log("[WavLoom] AudioContext suspended (idle after pre-warm).");
                        }
                    }, 3000);
                }).catch(e => console.error("Audio warmup skipped:", e));
            }
            window.removeEventListener('click', warmAudio);
            window.removeEventListener('keydown', warmAudio);
        };

        window.addEventListener('click', warmAudio, { once: true });
        window.addEventListener('keydown', warmAudio, { once: true });

        return () => {
            window.removeEventListener('click', warmAudio);
            window.removeEventListener('keydown', warmAudio);
            if (idleTimer) clearTimeout(idleTimer);
        };
    }, []);

    // ── Critical shortcuts: Space, R, C ──
    // Registered in CAPTURE PHASE so they fire before any child component's
    // keydown handlers (ArrangementTimeline, PianoRollEditor, etc.) which
    // could otherwise consume the event via stopImmediatePropagation or
    // simply by being registered earlier in bubble phase.
    useEffect(() => {
        const handleCriticalKeys = (e) => {
            // Space: play/stop — must always work regardless of focus or active panel
            if (e.code === 'Space') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (playCooldownRef.current) return;
                playCooldownRef.current = true;
                requestAnimationFrame(() => { playCooldownRef.current = false; });
                if (isRecording || isCountingIn) {
                    handleStopRecording();
                } else {
                    setGlobalIsPlaying(prev => !prev);
                }
                return;
            }

            // Recording: R to toggle record on/off — must work from anywhere
            if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
                const tag = document.activeElement?.tagName?.toLowerCase();
                // Allow R from inputs only when already recording (to stop)
                if ((tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) && !(isRecording || isCountingIn)) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                if (isRecording || isCountingIn) {
                    handleStopRecording();
                } else {
                    handleStartRecording();
                }
                return;
            }

            // Comping: C to start new take during recording — must work from anywhere
            if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                console.log(`[Comp] C key pressed (capture) | isRecording=${isRecording} | isCountingIn=${isCountingIn} | activeElement=${document.activeElement?.tagName}`);
                if (isRecording || isCountingIn) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    console.log('[Comp] Calling handleCompNewTake()');
                    handleCompNewTake();
                }
                // Don't stop propagation when not recording — let other handlers process 'c'
            }
        };

        window.addEventListener('keydown', handleCriticalKeys, true); // CAPTURE phase
        return () => window.removeEventListener('keydown', handleCriticalKeys, true);
    }, [isRecording, isCountingIn, handleCompNewTake, handleStartRecording, handleStopRecording]);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Undo/Redo — route to arrangement undo/redo when in arrangement mode
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyZ' || e.key === 'Z')) {
                e.preventDefault();
                if (arr.arrangementMode) { arr.redoArrangement(); redoAudio(); } else { handleRedo(); }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                if (arr.arrangementMode) { arr.redoArrangement(); redoAudio(); } else { handleRedo(); }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.key === 'z')) {
                e.preventDefault();
                if (arr.arrangementMode) { arr.undoArrangement(); undoAudio(); } else { handleUndo(); }
                return;
            }

            // Save Project
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyS' || e.key === 's')) {
                e.preventDefault();
                handleSaveProject();
                return;
            }

            // Export
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyE' || e.key === 'e')) {
                e.preventDefault();
                handleExportClick();
                return;
            }

            // New Project
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyN' || e.key === 'n')) {
                e.preventDefault();
                handleNewProject();
                return;
            }

            // Drum Synthesis Studio: Ctrl+Shift+Alt+G (quick toggle)
            if (e.ctrlKey && e.shiftKey && e.altKey && e.code === 'KeyG') {
                e.preventDefault();
                setActiveTab('drumsynth');
                return;
            }

            // Instrument Synthesis Studio: Ctrl+Shift+Alt+I (quick toggle)
            if (e.ctrlKey && e.shiftKey && e.altKey && e.code === 'KeyI') {
                e.preventDefault();
                setActiveTab('instrsynth');
                return;
            }

            // Space, R, C are handled in capture-phase listener above — skip here

            // ── Input focus guard: block remaining letter/digit shortcuts when typing ──
            const activeTag = document.activeElement.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
                return; // Normal typing overrides bare shortcuts
            }

            // Shortcuts Modal
            if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
                e.preventDefault();
                setShowShortcutsPanel(prev => !prev);
                return;
            }

            if (e.code === 'Escape') {
                if (showExportModal) { setShowExportModal(false); return; }
                setShowShortcutsPanel(false);
                return;
            }

            // Tab Switching Navigation
            if (e.code === 'Digit1') setActiveTab('drums');
            if (e.code === 'Digit2') setActiveTab('chords');
            if (e.code === 'Digit3') setActiveTab('melody');
            if (e.code === 'Digit4') setActiveTab('bass');
            if (e.code === 'Digit5') setActiveTab('lyrics');
            if (e.code === 'Digit6') setActiveTab('mixer');
            if (e.code === 'Digit7') setActiveTab('arrange');
            if (e.code === 'Digit8') setActiveTab('drumsynth');
            if (e.code === 'Digit9') setActiveTab('instrsynth');

            const tabOrder = ['drums', 'chords', 'melody', 'bass', 'lyrics', 'lyricengine', 'mixer', 'arrange', 'drumsynth', 'instrsynth'];
            if (e.code === 'BracketLeft') {
                setActiveTab(prev => {
                    const idx = tabOrder.indexOf(prev);
                    return tabOrder[(idx - 1 + tabOrder.length) % tabOrder.length];
                });
            }
            if (e.code === 'BracketRight') {
                setActiveTab(prev => {
                    const idx = tabOrder.indexOf(prev);
                    return tabOrder[(idx + 1) % tabOrder.length];
                });
            }

            // Mute / Solo logic (Operating on currently active tab)
            if (e.code === 'KeyM') {
                // For now, toggle mute by adjusting the master volume to 0 or restoring it
                setMasterVolume(prev => prev > 0 ? 0 : 0.7);
                if (samplerRef.current && samplerRef.current.masterGain) {
                    const currentVol = masterVolume > 0 ? 0 : 0.7;
                    samplerRef.current.masterGain.gain.setTargetAtTime(currentVol, samplerRef.current.audioContext.currentTime, 0.01);
                }
            }

            if (e.code === 'KeyS') {
                // Since updateGlobalSolo relies on the unique track ID, and activeTab is just 'drums'/'chords',
                // we'll pass the activeTab as the ID argument and simulate a solo click
                updateGlobalSolo(activeTab, !globalSolos.has(activeTab), false);
            }

            // Generation
            if (e.code === 'KeyG') {
                e.preventDefault();
                handleGlobalGenerate();
            }

            // Arrangement loop shortcuts (Shift+L to toggle loop on active section)
            if (e.shiftKey && e.code === 'KeyL' && activeTab === 'arrange') {
                e.preventDefault();
                const activeSec = arr.arrangement.find(s => s.id === arr.activeSection);
                if (activeSec) toggleSectionLoop(activeSec.id);
            }

            // Shift+Right/Left Arrow to extend/shrink loop range by 4 bars
            if (e.shiftKey && e.code === 'ArrowRight' && activeTab === 'arrange') {
                e.preventDefault();
                if (!loopRange) {
                    // Start loop range at playhead position for 4 bars
                    const currentBar = Math.floor((globalAbsoluteStep || 0) / 32);
                    setLoopRange({ startBar: currentBar, endBar: Math.min(currentBar + 4, timelineBars) });
                } else {
                    // Extend loop end by 4 bars
                    setLoopRange(prev => prev ? { ...prev, endBar: Math.min(prev.endBar + 4, timelineBars) } : prev);
                }
            }
            if (e.shiftKey && e.code === 'ArrowLeft' && activeTab === 'arrange') {
                e.preventDefault();
                if (loopRange) {
                    if (loopRange.endBar - loopRange.startBar <= 4) {
                        // Clear loop if it would become zero-length
                        setLoopRange(null);
                    } else {
                        // Shrink loop end by 4 bars
                        setLoopRange(prev => prev ? { ...prev, endBar: Math.max(prev.startBar + 4, prev.endBar - 4) } : prev);
                    }
                }
            }

            // Stop marker: Shift+P to toggle stop marker at active section
            if (e.shiftKey && e.code === 'KeyP' && activeTab === 'arrange') {
                e.preventDefault();
                const activeSec = arr.arrangement.find(s => s.id === arr.activeSection);
                if (activeSec) toggleStopMarker(activeSec.id);
            }

            // Tempo adjustments (permission-guarded)
            if (myPermissions.canChangeTempo && (e.key === '+' || e.key === '=')) {
                setGlobalTempo(prev => Math.min(prev + 1, 300));
            }
            if (myPermissions.canChangeTempo && e.key === '-') {
                setGlobalTempo(prev => Math.max(prev - 1, 20));
            }

            // Fullscreen toggle via 'F'
            if (e.code === 'KeyF') {
                toggleFullscreen();
            }

            // Tap Tempo via 'T'
            if (e.code === 'KeyT') {
                handleTapTempo();
            }

            // Metronome toggle via 'K'
            if (e.code === 'KeyK') {
                setMetronomeEnabled(prev => !prev);
            }

        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, masterVolume, activeTab, globalSolos, updateGlobalSolo, handleTapTempo, arr.arrangementMode, arr.undoArrangement, arr.redoArrangement, arr.arrangement, arr.activeSection, loopSectionIds, toggleSectionLoop, toggleStopMarker, isRecording, isCountingIn, handleCompNewTake, handleStartRecording, handleStopRecording]);


    // Loaded instruments for export
    const [loadedInstruments, setLoadedInstruments] = useState({
        chords: null,
        melody: null,
        bass: null
    });
    const loadedInstrumentsRef = useRef(loadedInstruments);
    useEffect(() => { loadedInstrumentsRef.current = loadedInstruments; }, [loadedInstruments]);

    /**
     * Analyze selected folder to extract Genre, BPM, Mood from filenames
     */
    const handleAnalyzeFolder = async () => {
        if (!selectedFolder) return;

        try {
            let extractedGenre = globalGenre;
            let extractedMood = globalMood;
            let extractedTempo = globalTempo;

            // Scan filenames for keywords (top-level only)
            for await (const [name, handle] of selectedFolder.handle.entries()) {
                if (handle.kind === 'file') {
                    const upper = name.toUpperCase();

                    // Tempo extraction (e.g. "snare_140bpm.wav" or "loop 120 bpm")
                    const bpmMatch = name.match(/(\d{2,3})\s?BPM/i);
                    if (bpmMatch) extractedTempo = parseInt(bpmMatch[1]);

                    // Genre extraction
                    Object.keys(genres).forEach(g => {
                        if (upper.includes(g.toUpperCase())) extractedGenre = g;
                    });
                }

                // Mood extraction
                if (genres[extractedGenre]) {
                    genres[extractedGenre].forEach(m => {
                        if (upper.includes(m.toUpperCase())) extractedMood = m;
                    });
                }
            }


            setGlobalTempo(extractedTempo);
            setGlobalGenre(extractedGenre);
            setGlobalMood(extractedMood);

            console.log('Analysis result:', { extractedGenre, extractedMood, extractedTempo });
        } catch (err) {
            console.error('Folder analysis failed:', err);
        }
    };


    const handleFolderSelect = useCallback((folder) => {
        if (!folder) return;
        let changed = false;
        setSelectedFolder(prev => {
            if (prev && prev.name === folder.name) return prev; // Same folder — no re-render
            changed = true;
            return folder;
        });
        if (changed) setSelectedFile(null);
    }, []);


    /**
     * Handle pattern generation from folder analysis.
     * Called by Browser.jsx after analysis completes.
     * Receives { folder, characteristics } where characteristics is the
     * aggregated analysis object from FolderAnalyzer.analyzeFolder().
     */
    const handleGenerateFromFolder = async (folderData) => {
        try {
            const { folder, characteristics } = folderData;

            if (!characteristics) {
                console.error('[GenerateFromFolder] No characteristics provided');
                return;
            }

            const folderType = characteristics.folderType || 'mixed';
            console.log('[GenerateFromFolder] Starting generation from folder:', folder?.name,
                'type:', folderType, characteristics);

            // Map genre group to display name and update global settings
            const { default: FolderAnalyzerClass } = await import('./FolderAnalyzer');
            const displayGenre = characteristics.genre
                ? FolderAnalyzerClass.mapGenreGroupToName(characteristics.genre)
                : globalGenre;

            if (characteristics.key) setGlobalKey(characteristics.key);
            if (characteristics.scale) setGlobalScale(characteristics.scale);
            if (characteristics.tempo) setGlobalTempo(characteristics.tempo);
            if (characteristics.mood) setGlobalMood(characteristics.mood);
            setGlobalGenre(displayGenre);

            // Generate analysis-derived patterns
            const dynamicComplexity = determineComplexity(displayGenre, characteristics.mood);
            const folderAnalyzer = new FolderAnalyzerClass();
            const newChords = folderAnalyzer.generateFromAnalysis(characteristics, 'chords', globalBars, dynamicComplexity);
            const newMelody = folderAnalyzer.generateFromAnalysis(characteristics, 'melody', globalBars, dynamicComplexity);
            const newBass = folderAnalyzer.generateFromAnalysis(characteristics, 'bass', globalBars, dynamicComplexity);
            const newDrums = folderAnalyzer.generateFromAnalysis(characteristics, 'drums', globalBars, dynamicComplexity);

            // Build pending generation flags based on folder type
            const pending = { drums: false, chords: false, melody: false, bass: false };

            if (folderType === 'drums') {
                // Drum folder: generate all tracks algorithmically using detected genre
                pending.drums = true;
                pending.chords = true;
                pending.melody = true;
                pending.bass = true;
                // No melodic motifs expected from drum folders — clear external patterns
                setExternalPatterns({ chords: null, melody: null, bass: null, drums: newDrums });
            } else if (folderType === 'melodic') {
                // Melodic folder: use motifs where available, generate drums algorithmically
                setExternalPatterns({
                    chords: newChords,
                    melody: newMelody,
                    bass: newBass,
                    drums: newDrums
                });
                pending.drums = true;
                pending.chords = true;
                pending.melody = true;
                pending.bass = true;
            } else {
                // Mixed: use motifs where available, fill gaps algorithmically
                setExternalPatterns({
                    chords: newChords,
                    melody: newMelody,
                    bass: newBass,
                    drums: newDrums
                });
                pending.drums = true;
                pending.chords = true;
                pending.melody = true;
                pending.bass = true;
            }

            // Push snapshot using the newly computed pattern changes and settings
            setTimeout(() => {
                pushSnapshot(currentStateRef.current);
            }, 100);

            // Set generated flags for anything we successfully derived from analysis
            setIsGenerated(prev => ({
                ...prev,
                chords: !!newChords,
                melody: !!newMelody,
                bass: !!newBass,
                drums: !!newDrums
            }));

            // Defer .generate() calls until after React has committed the state updates
            // (genre, key, scale, tempo) so generators see the new values
            setFolderGenPending(pending);

            console.log('[GenerateFromFolder] Queued deferred generation from folder:', folder?.name,
                'type:', folderType,
                `chords=${newChords ? newChords.length + ' notes' : 'pending'},`,
                `melody=${newMelody ? newMelody.length + ' notes' : 'pending'},`,
                `bass=${newBass ? newBass.length + ' notes' : 'pending'},`,
                `drums=pending`);
        } catch (err) {
            console.error('[GenerateFromFolder] Generation failed:', err);
        }
    };

    /**
     * Handle MIDI extraction from audio file
     */
    const handleExtractMIDI = (data, target) => {
        const { patterns, metadata } = data;

        // Auto-update Project Settings to match extracted sample DNA
        if (metadata) {
            console.log('[Extract] Syncing project to detected metadata:', metadata);
            if (metadata.tempo) {
                const clampedTempo = Math.max(40, Math.min(250, Math.round(metadata.tempo)));
                setGlobalTempo(clampedTempo);
            }
            if (metadata.likelyKey) setGlobalKey(metadata.likelyKey);
            if (metadata.likelyScale) setGlobalScale(metadata.likelyScale);
        }

        if (target === 'all') {
            setPatterns(prev => ({
                ...prev,
                melody: patterns.melody,
                bass: patterns.bass,
                chords: patterns.chords
            }));
            setTrackStatus(prev => ({
                ...prev,
                melody: { ...prev.melody, hasPattern: true },
                bass: { ...prev.bass, hasPattern: true },
                chords: { ...prev.chords, hasPattern: true }
            }));
            setExternalPatterns({
                melody: patterns.melody,
                bass: patterns.bass,
                chords: patterns.chords,
                drums: patterns.drums
            });
            setTimeout(() => pushSnapshot(currentStateRef.current), 100);
            // Update generated flags for visibility (checkmarks)
            setIsGenerated(prev => ({
                ...prev,
                melody: !!patterns.melody,
                bass: !!patterns.bass,
                chords: !!patterns.chords
            }));
            // Default to melody tab after bulk extraction
            setActiveTab('melody');
            console.log('Extracted MIDI DNA to all tracks (Synced Project Settings)');
        } else {
            const patternData = patterns || data; // Fallback for single target
            setPatterns(prev => ({ ...prev, [target]: patternData }));
            setTrackStatus(prev => ({ ...prev, [target]: { ...prev[target], hasPattern: true } }));
            setExternalPatterns(prev => ({
                ...prev,
                [target]: patternData
            }));
            setTimeout(() => pushSnapshot(currentStateRef.current), 100);
            // Update generated flag for visibility (checkmark)
            setIsGenerated(prev => ({ ...prev, [target]: true }));
            // Switch to the relevant tab
            setActiveTab(target);
            console.log(`Extracted MIDI DNA to ${target} track`);
        }

        // Auto-generate drums to match the new key/scale/tempo
        setTimeout(() => {
            if (drumRef.current && typeof drumRef.current.generate === 'function') {
                drumRef.current.generate();
                console.log('[Extract] Auto-generated drums to match new project settings');
            }
        }, 100);
    };


    /**
     * Handle folder removal
     */
    const handleRemoveFolder = (folder) => {
        if (selectedFolder?.id === folder.id) {
            setSelectedFolder(null);
        }
    };



    /**
     * Toggle theme
     */
    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            return next;
        });
    };

    /**
     * Export all tracks
     */
    /**
     * Trigger Export Modal
     */
    const handleExportClick = () => {
        if (!myPermissions.canExport) return;
        setExportSettings(prev => ({ ...prev, durationBars: globalBars })); // Reset to current bars
        setShowExportModal(true);
    };

    /**
     * Execute Export
     */
    const confirmExport = async () => {
        if (!exporterRef.current) return;
        setIsExporting(true);
        const startTime = performance.now();
        setExportStartTime(startTime);
        setExportTimeElapsed(0);
        setExportTimeEstimate(null);

        // Compute size estimate before rendering
        const sizeEst = exporterRef.current.estimateExportSizes({
            format: exportSettings.format,
            sampleRate: exportSettings.sampleRate,
            bitrate: exportSettings.bitrate,
            bitDepth: exportSettings.bitDepth,
            tempo: globalTempo,
            bars: exportSettings.durationBars,
            type: exportSettings.type,
            tracks: patterns,
            arrangement: arr.arrangementMode ? arr.arrangement : null,
            audioTracks
        });
        setExportSizeEstimate(sizeEst);

        // Progress callback with timing
        const onExportProgress = (percent, msg) => {
            const now = performance.now();
            const elapsed = (now - startTime) / 1000;
            setExportProgress(percent);
            // Support structured i18n messages from exporter
            if (typeof msg === 'object' && msg.key) {
                setExportStatusText(t(msg.key, msg.params));
            } else {
                setExportStatusText(msg);
            }
            setExportTimeElapsed(elapsed);
            if (percent > 0.5) {
                const totalEstimate = (elapsed / percent) * 100;
                setExportTimeEstimate(Math.max(0, totalEstimate - elapsed));
            }
        };

        try {
            // Build effective trackMix that reflects mutes, solos, and master volume
            const effectiveTrackMix = {};
            const trackIds = ['drums', 'chords', 'melody', 'bass'];
            trackIds.forEach(id => {
                const mix = trackMix[id] || { volume: 0.5, pan: 0 };
                let vol = mix.volume;
                if (globalMutes.has(id)) vol = 0;
                if (isAnythingSoloed && !globalSolos.has(id)) vol = 0;
                vol *= masterVolume;
                effectiveTrackMix[id] = { volume: vol, pan: mix.pan };
            });

            let exportData;

            if (exportSettings.type === 'arrangement' && arr.arrangementMode && arr.arrangement.length > 0) {
                // Arrangement export — render all sections concatenated
                const preparedSections = arr.arrangement.map(section => ({
                    ...section,
                    patterns: {
                        drums: section.patterns.drums,
                        chords: loadedInstruments.chords && section.patterns.chords?.length
                            ? { instrumentId: loadedInstruments.chords, pattern: section.patterns.chords }
                            : null,
                        melody: loadedInstruments.melody && section.patterns.melody?.length
                            ? { instrumentId: loadedInstruments.melody, pattern: section.patterns.melody }
                            : null,
                        bass: loadedInstruments.bass && section.patterns.bass?.length
                            ? { instrumentId: loadedInstruments.bass, pattern: section.patterns.bass }
                            : null
                    }
                }));

                exportData = await exporterRef.current.exportArrangement(preparedSections, {
                    format: exportSettings.format,
                    sampleRate: exportSettings.sampleRate,
                    bitDepth: exportSettings.bitDepth,
                    bitrate: exportSettings.bitrate,
                    tempo: globalTempo,
                    projectName: projectName || 'Untitled',
                    key: globalKey,
                    scale: globalScale,
                    trackMix: effectiveTrackMix,
                    audioTracks,
                    globalMutes,
                    onProgress: onExportProgress,
                    timelineBars,
                    drumClips: drumClips.length > 0 ? drumClips : undefined,
                    chordClips: chordClips.length > 0 ? chordClips : undefined,
                    melodyClips: melodyClips.length > 0 ? melodyClips : undefined,
                    bassClips: bassClips.length > 0 ? bassClips : undefined
                });
            } else {
                // Standard single-section export
                const tracks = {
                    drums: patterns.drums,
                    chords: loadedInstruments.chords && patterns.chords ? {
                        instrumentId: loadedInstruments.chords,
                        pattern: patterns.chords
                    } : null,
                    melody: loadedInstruments.melody && patterns.melody ? {
                        instrumentId: loadedInstruments.melody,
                        pattern: patterns.melody
                    } : null,
                    bass: loadedInstruments.bass && patterns.bass ? {
                        instrumentId: loadedInstruments.bass,
                        pattern: patterns.bass
                    } : null
                };

                const durationSeconds = (exportSettings.durationBars * 4) * (60 / globalTempo);

                exportData = await exporterRef.current.exportTracks(tracks, {
                    format: exportSettings.format,
                    sampleRate: exportSettings.sampleRate,
                    bitDepth: exportSettings.bitDepth,
                    bitrate: exportSettings.bitrate,
                    tempo: globalTempo,
                    duration: durationSeconds,
                    bars: exportSettings.durationBars,
                    type: exportSettings.type,
                    projectName: projectName || 'Untitled',
                    key: globalKey,
                    scale: globalScale,
                    trackMix: effectiveTrackMix,
                    onProgress: onExportProgress,
                    drumClips: drumClips.length > 0 ? drumClips : undefined,
                    chordClips: chordClips.length > 0 ? chordClips : undefined,
                    melodyClips: melodyClips.length > 0 ? melodyClips : undefined,
                    bassClips: bassClips.length > 0 ? bassClips : undefined
                });
            }

            // Download via Save As dialog when available
            if (window.showSaveFilePicker) {
                try {
                    const ext = exportSettings.format === 'mp3' ? '.mp3'
                        : exportSettings.type === 'stems' ? '.zip' : '.wav';
                    const mimeType = exportSettings.format === 'mp3' ? 'audio/mpeg'
                        : exportSettings.type === 'stems' ? 'application/zip' : 'audio/wav';
                    const handle = await window.showSaveFilePicker({
                        suggestedName: exportData.filename,
                        types: [{ description: t('exportModal.audioFileDesc'), accept: { [mimeType]: [ext] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(exportData.blob);
                    await writable.close();
                } catch (pickerErr) {
                    if (pickerErr.name !== 'AbortError') throw pickerErr;
                }
            } else {
                const url = URL.createObjectURL(exportData.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = exportData.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            setShowExportModal(false);
        } catch (error) {
            console.error('Export failed:', error);
            alert(t('exportModal.exportFailed', { error: error.message }));
        } finally {
            setIsExporting(false);
            setExportStartTime(null);
            setExportTimeElapsed(0);
            setExportTimeEstimate(null);
            setExportSizeEstimate(null);
        }
    };

    // Resize Logic
    const startResizing = (e) => {
        setIsResizing(true);
        e.preventDefault();
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    const resize = (e) => {
        if (!isResizing) return;
        const newWidth = e.clientX;
        const minWidth = isRecordMode ? 400 : 280;
        const maxWidth = window.innerWidth / 2;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setBrowserWidth(newWidth);
            // When Record Mode is active, sync both widths
            if (isRecordMode) setRecordModeWidth(newWidth);
        }
    };

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing]);

    // Record Mode Resize Logic
    const startResizingRecordMode = (e) => {
        setIsResizingRecordMode(true);
        e.preventDefault();
    };
    const stopResizingRecordMode = () => {
        setIsResizingRecordMode(false);
    };
    const resizeRecordMode = (e) => {
        if (!isResizingRecordMode) return;
        const newWidth = e.clientX;
        const minWidth = 400;
        const maxWidth = window.innerWidth / 2;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setRecordModeWidth(newWidth);
            // Keep browser width in sync so it covers fully when opened
            setBrowserWidth(newWidth);
        }
    };
    useEffect(() => {
        if (isResizingRecordMode) {
            window.addEventListener('mousemove', resizeRecordMode);
            window.addEventListener('mouseup', stopResizingRecordMode);
        } else {
            window.removeEventListener('mousemove', resizeRecordMode);
            window.removeEventListener('mouseup', stopResizingRecordMode);
        }
        return () => {
            window.removeEventListener('mousemove', resizeRecordMode);
            window.removeEventListener('mouseup', stopResizingRecordMode);
        };
    }, [isResizingRecordMode]);

    const drumRef = useRef(null);
    const chordsRef = useRef(null);
    const melodyRef = useRef(null);
    const bassRef = useRef(null);
    const mixerRef = useRef(null);

    // ─── Preset Save / Load ───
    const handleSavePreset = useCallback(async (presetName) => {
        const pm = presetManagerRef.current;
        const sampler = samplerRef.current;
        if (!pm || !sampler) return;

        // Collect drum samples from sampler
        const drumSamples = {};
        const drumIds = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];
        drumIds.forEach(drumId => {
            const inst = sampler.instruments.get(drumId);
            if (inst && inst.samples.size > 0) {
                const buf = inst.samples.values().next().value;
                if (buf) {
                    drumSamples[drumId] = { name: inst.name || drumId, buffer: buf };
                }
            }
        });

        // Collect instrument samples from sampler (multi-sample maps)
        const instrumentSamples = {};
        ['chords', 'melody', 'bass'].forEach(trackId => {
            const instId = loadedInstruments[trackId];
            if (!instId) return;
            const inst = sampler.instruments.get(instId);
            if (inst && inst.samples.size > 0) {
                instrumentSamples[trackId] = {
                    name: inst.name || trackId,
                    samples: inst.samples // Map<note, AudioBuffer>
                };
            }
        });

        try {
            await pm.savePreset({
                name: presetName,
                category: 'User',
                presetType: 'full',
                drumSamples,
                instrumentSamples,
                tempo: globalTempo,
                key: globalKey,
                scale: globalScale,
                genre: globalGenre,
                mood: globalMood,
                bars: globalBars
            });
            console.log('[Preset] Saved:', presetName);
        } catch (err) {
            console.error('[Preset] Save failed:', err);
            alert(t('app.savePresetFailed', { error: err.message }));
        }
    }, [loadedInstruments, globalTempo, globalKey, globalScale, globalGenre, globalMood, globalBars]);

    const handleLoadPreset = useCallback(async (presetId) => {
        const pm = presetManagerRef.current;
        const sampler = samplerRef.current;
        if (!pm || !sampler) return;

        try {
            const preset = await pm.loadPreset(presetId, sampler.audioContext);
            console.log('[Preset] Loading:', preset.name);

            // Load drum samples into sampler
            const drumIds = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];
            drumIds.forEach(drumId => {
                const sample = preset.drumSamples?.[drumId];
                if (sample && sample.buffer) {
                    const octave = 3; // default drum octave
                    sampler.loadInstrument(drumId, [{ note: (octave + 1) * 12, buffer: sample.buffer, name: sample.name }], sample.name);
                }
            });

            // Load instrument samples into sampler
            const newLoadedInstruments = { ...loadedInstruments };
            ['chords', 'melody', 'bass'].forEach(trackId => {
                const instData = preset.instrumentSamples?.[trackId];
                if (instData && instData.samples.size > 0) {
                    const instrumentId = `${trackId}_preset_${Date.now()}`;
                    const samplesArr = [];
                    for (const [note, buffer] of instData.samples) {
                        samplesArr.push({ note, buffer, name: instData.name });
                    }
                    sampler.loadInstrument(instrumentId, samplesArr, instData.name);
                    newLoadedInstruments[trackId] = instrumentId;
                }
            });
            setLoadedInstruments(newLoadedInstruments);

            // Restore settings
            if (preset.tempo) setGlobalTempo(preset.tempo);
            if (preset.key) setGlobalKey(preset.key);
            if (preset.scale) setGlobalScale(preset.scale);
            if (preset.genre) setGlobalGenre(preset.genre);
            if (preset.mood) setGlobalMood(preset.mood);
            if (preset.bars) setGlobalBars(preset.bars);

            // Notify drum generator to refresh its UI from sampler state
            if (drumRef.current?.loadState) {
                drumRef.current.loadState(null); // pass null = just refresh from sampler
            }

            // Notify chord/melody/bass generators of their new instruments
            // loadState(pattern, instrumentId) — pass null for pattern to keep existing
            if (newLoadedInstruments.chords && chordsRef.current?.loadState) {
                chordsRef.current.loadState(null, newLoadedInstruments.chords);
            }
            if (newLoadedInstruments.melody && melodyRef.current?.loadState) {
                melodyRef.current.loadState(null, newLoadedInstruments.melody);
            }
            if (newLoadedInstruments.bass && bassRef.current?.loadState) {
                bassRef.current.loadState(null, newLoadedInstruments.bass);
            }

            // Update trackStatus for sound icons on tabs
            const hasDrumSamples = drumIds.some(id => preset.drumSamples?.[id]?.buffer);
            setTrackStatus(prev => ({
                ...prev,
                drums: { ...prev.drums, hasSamples: hasDrumSamples || prev.drums.hasSamples },
                chords: { ...prev.chords, hasSamples: !!newLoadedInstruments.chords || prev.chords.hasSamples },
                melody: { ...prev.melody, hasSamples: !!newLoadedInstruments.melody || prev.melody.hasSamples },
                bass: { ...prev.bass, hasSamples: !!newLoadedInstruments.bass || prev.bass.hasSamples }
            }));
        } catch (err) {
            console.error('[Preset] Load failed:', err);
            alert(t('app.loadPresetFailed', { error: err.message }));
        }
    }, [loadedInstruments]);

    const handleGlobalGenerate = () => {
        // Generate and display seed for reference
        const seed = Math.floor(Math.random() * 999999);
        setLastSeed(seed);
        console.log('[GlobalGen] Seed:', seed);

        // Use PatternEngine's unified generation (chords first → chord-aware melody/bass)
        const dynamicComplexity = determineComplexity(globalGenre, globalMood);

        // When repeat mode is on, generate a 4-bar base pattern and loop it
        const baseBars = (globalRepeat && globalBars > 4) ? 4 : globalBars;

        let { chords, melody, bass } = generateAllPatterns({
            key: globalKey,
            scale: globalScale,
            genre: globalGenre,
            mood: globalMood,
            bars: baseBars,
            complexity: dynamicComplexity,
            tempo: globalTempo,
            humanize: humanizeParams
        });

        // Loop patterns to fill full bar count when in repeat mode
        if (globalRepeat && globalBars > 4) {
            chords = loopMelodicPattern(chords, baseBars, globalBars);
            melody = loopMelodicPattern(melody, baseBars, globalBars);
            bass = loopMelodicPattern(bass, baseBars, globalBars);
        }

        // Push harmonically-linked patterns to generators via external patterns
        setExternalPatterns({ chords, melody, bass });
        setPatterns(prev => ({ ...prev, chords, melody, bass }));
        // Only mark tracks as generated if they actually have notes
        setIsGenerated(prev => ({
            ...prev,
            drums: true, // drums generated separately below
            chords: Array.isArray(chords) && chords.length > 0,
            melody: Array.isArray(melody) && melody.length > 0,
            bass: Array.isArray(bass) && bass.length > 0
        }));

        setTimeout(() => pushSnapshot({ ...currentStateRef.current, patterns: { ...patterns, chords, melody, bass } }), 50);

        // Create clips for chord/melody/bass patterns
        if (chords && chords.length > 0) {
            handleChordClipGenerated({ bars: globalBars, pattern: chords.map(n => ({ ...n })), name: 'Chord Clip', color: null });
        }
        if (melody && melody.length > 0) {
            handleMelodyClipGenerated({ bars: globalBars, pattern: melody.map(n => ({ ...n })), name: 'Melody Clip', color: null });
        }
        if (bass && bass.length > 0) {
            handleBassClipGenerated({ bars: globalBars, pattern: bass.map(n => ({ ...n })), name: 'Bass Clip', color: null });
        }

        // Generate drums separately (existing drum system)
        if (drumRef.current && typeof drumRef.current.generate === 'function') drumRef.current.generate();
        else if (drumRef.current) console.warn('[GlobalGen] drumRef.current exists but generate is not a function:', drumRef.current);

        // Auto-extend timeline: always keep 64 blank bars after the generated content
        const clipEndBar = (audioInsertionBarRef.current || 0) + globalBars;
        const needed = Math.ceil((clipEndBar + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK;
        setTimelineBars(prev => Math.max(prev, needed));

        console.log('[GlobalGen] Unified PatternEngine generation complete');
    };

    // Apply a suggestion from SuggestionPanel
    const handleApplySuggestion = useCallback((suggestion) => {
        const { chords, melody, bass, drums } = suggestion;
        // Apply melodic patterns
        setExternalPatterns({ chords, melody, bass });
        setPatterns(prev => ({ ...prev, chords, melody, bass }));
        setIsGenerated(prev => ({
            ...prev,
            drums: true,
            chords: Array.isArray(chords) && chords.length > 0,
            melody: Array.isArray(melody) && melody.length > 0,
            bass: Array.isArray(bass) && bass.length > 0
        }));
        // Apply drum patterns via loadState
        if (drumRef.current && typeof drumRef.current.loadState === 'function') {
            drumRef.current.loadState(drums);
        }
        setTimeout(() => pushSnapshot({ ...currentStateRef.current, patterns: { ...patterns, chords, melody, bass } }), 50);
        console.log('[Suggest] Applied suggestion');
    }, [patterns, pushSnapshot]);

    // Apply a mixed suggestion (per-track picks from different suggestions)
    const handleApplyMixedSuggestion = useCallback((mixed) => {
        handleApplySuggestion(mixed);
        console.log('[Suggest] Applied mixed suggestion');
    }, [handleApplySuggestion]);

    // Capture current global mixer state as a section mix snapshot
    const captureCurrentMix = useCallback(() => {
        const tracks = {};
        ['drums', 'chords', 'melody', 'bass'].forEach(id => {
            tracks[id] = {
                volume: trackMix[id]?.volume ?? 0.5,
                pan: trackMix[id]?.pan ?? 0,
                muted: globalMutes.has(id),
                soloed: globalSolos.has(id)
            };
        });
        // Include audio tracks too
        audioTracks.forEach(at => {
            tracks[at.id] = {
                volume: trackMix[at.id]?.volume ?? 0.5,
                pan: trackMix[at.id]?.pan ?? 0,
                muted: globalMutes.has(at.id),
                soloed: globalSolos.has(at.id)
            };
        });
        return { master: { volume: masterVolume }, tracks };
    }, [trackMix, globalMutes, globalSolos, masterVolume, audioTracks]);

    // Add just one track's pattern to a new arrangement section
    const handleAddTrackToArrangement = useCallback((trackName) => {
        // Arrangement mode is always on
        // Place clip at bar 0 (or find first empty spot)
        const patternData = patterns[trackName] ? JSON.parse(JSON.stringify(patterns[trackName])) : [];
        if (trackName === 'drums') {
            addDrumClip({ timelineBar: 0, bars: globalBars, drumStates: patternData, name: 'Drums @1' });
            splitDrumStatesIntoLaneClips(patternData, 0, globalBars);
        } else if (trackName === 'chords') {
            addChordClip({ timelineBar: 0, bars: globalBars, pattern: patternData, name: 'Chords @1' });
        } else if (trackName === 'melody') {
            addMelodyClip({ timelineBar: 0, bars: globalBars, pattern: patternData, name: 'Melody @1' });
        } else if (trackName === 'bass') {
            addBassClip({ timelineBar: 0, bars: globalBars, pattern: patternData, name: 'Bass @1' });
        }
        setActiveTab('arrange');
    }, [arr, patterns, globalBars, addDrumClip, addChordClip, addMelodyClip, addBassClip]);

    // Helper: generate a 4-bar melodic base and loop it to fill targetBars
    const generate4BarLooped = (params) => {
        const baseBars = Math.min(4, params.bars);
        const { chords, melody, bass } = generateAllPatterns({ ...params, bars: baseBars });
        if (params.bars > 4) {
            return {
                chords: loopMelodicPattern(chords, baseBars, params.bars),
                melody: loopMelodicPattern(melody, baseBars, params.bars),
                bass: loopMelodicPattern(bass, baseBars, params.bars)
            };
        }
        return { chords, melody, bass };
    };

    // Helper: generate N unique 4-bar chunks and concatenate for mixed/varied arrangement
    const generateMixed4Bar = (params) => {
        const totalSteps = params.bars * 32;
        const chunkBars = 4;
        const chunkSteps = chunkBars * 32;
        const numChunks = Math.ceil(params.bars / chunkBars);
        let allChords = [], allMelody = [], allBass = [];
        for (let i = 0; i < numChunks; i++) {
            const { chords, melody, bass } = generateAllPatterns({ ...params, bars: chunkBars });
            const offset = i * chunkSteps;
            allChords.push(...chords.map(n => ({ ...n, time: n.time + offset })));
            allMelody.push(...melody.map(n => ({ ...n, time: n.time + offset })));
            allBass.push(...bass.map(n => ({ ...n, time: n.time + offset })));
        }
        return {
            chords: allChords.filter(n => n.time < totalSteps),
            melody: allMelody.filter(n => n.time < totalSteps),
            bass: allBass.filter(n => n.time < totalSteps)
        };
    };

    // Generate patterns for a specific arrangement section (or specific row within it)
    const handleGenerateSection = useCallback((selectedRowId) => {
        if (!arr.arrangementMode || !arr.activeSection) return;
        const section = arr.getActiveSection();
        if (!section) return;
        // Use section overrides or global settings
        const key = section.settings?.key || globalKey;
        const scale = section.settings?.scale || globalScale;
        const genre = section.settings?.genre || globalGenre;
        const mood = section.settings?.mood || globalMood;
        const tempo = section.settings?.tempo || globalTempo;
        const complexity = determineComplexity(genre, mood);

        // Update section bar count to match current globalBars if they differ
        if (section.bars !== globalBars) {
            arr.updateSection(section.id, { bars: globalBars });
            section.bars = globalBars; // Update local reference so generation uses correct bar count
        }

        // If a specific row is selected, only generate for that track
        if (selectedRowId) {
            // Individual drum row — generate only that drum element in the arrangement section
            if (selectedRowId.startsWith('drum-')) {
                const drumId = selectedRowId.replace('drum-', '');
                const standardDrums = ['808', 'kick', 'snare', 'clap', 'closedhat', 'openhat', 'offsnare', 'rim', 'perc'];
                const effectiveDrumId = standardDrums.includes(drumId.toLowerCase()) ? drumId.toLowerCase() : 'perc';
                const newPattern = getProPattern(genre, effectiveDrumId, section.bars, key, scale, mood);

                // Update only this drum element in the arrangement section
                const updatedDrums = JSON.parse(JSON.stringify(section.patterns.drums || {}));
                if (updatedDrums[drumId] && newPattern) {
                    Object.keys(updatedDrums[drumId].lanes || {}).forEach(laneId => {
                        if (newPattern[laneId]) {
                            updatedDrums[drumId].lanes[laneId].pattern = [...newPattern[laneId].pattern];
                            updatedDrums[drumId].lanes[laneId].duration = [...newPattern[laneId].duration];
                            updatedDrums[drumId].lanes[laneId].velocity = [...newPattern[laneId].velocity];
                            if (newPattern[laneId].pitch !== undefined) {
                                updatedDrums[drumId].lanes[laneId].pitch = newPattern[laneId].pitch;
                            }
                        }
                    });
                }
                arr.updateSection(section.id, {
                    patterns: { ...section.patterns, drums: updatedDrums }
                });
                // Update/create drum clip with the updated drum states
                const iBar = Math.floor(audioInsertionBarRef.current || 0);
                const existDC = drumClipsRef.current.find(c => (c.timelineBar || 0) === iBar);
                if (existDC) updateDrumClip(existDC.id, { bars: section.bars, drumStates: JSON.parse(JSON.stringify(updatedDrums)) });
                else addDrumClip({ timelineBar: iBar, bars: section.bars, drumStates: JSON.parse(JSON.stringify(updatedDrums)), name: 'Drum Clip' });
                // Create/update drum lane clip for this specific drum element
                const drumData = updatedDrums[drumId];
                if (drumData && drumData.lanes) {
                    const existLane = (drumLaneClipsRef.current[drumId] || []).find(c => (c.timelineBar || 0) === iBar);
                    if (existLane) updateDrumLaneClip(drumId, existLane.id, { bars: section.bars, laneData: JSON.parse(JSON.stringify(drumData)) });
                    else addDrumLaneClip(drumId, { timelineBar: iBar, bars: section.bars, laneData: JSON.parse(JSON.stringify(drumData)), name: drumId.charAt(0).toUpperCase() + drumId.slice(1) });
                }
                return;
            }
            // All drums collapsed — generate all drums in the arrangement section
            if (selectedRowId === 'drums-collapsed') {
                const drumElementIds = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];
                const updatedDrums = JSON.parse(JSON.stringify(section.patterns.drums || {}));
                drumElementIds.forEach(drumId => {
                    const standardDrums = ['808', 'kick', 'snare', 'clap', 'closedhat', 'openhat', 'offsnare', 'rim', 'perc'];
                    const effectiveDrumId = standardDrums.includes(drumId.toLowerCase()) ? drumId.toLowerCase() : 'perc';
                    const newPattern = getProPattern(genre, effectiveDrumId, section.bars, key, scale, mood);
                    if (updatedDrums[drumId] && newPattern) {
                        Object.keys(updatedDrums[drumId].lanes || {}).forEach(laneId => {
                            if (newPattern[laneId]) {
                                updatedDrums[drumId].lanes[laneId].pattern = [...newPattern[laneId].pattern];
                                updatedDrums[drumId].lanes[laneId].duration = [...newPattern[laneId].duration];
                                updatedDrums[drumId].lanes[laneId].velocity = [...newPattern[laneId].velocity];
                                if (newPattern[laneId].pitch !== undefined) {
                                    updatedDrums[drumId].lanes[laneId].pitch = newPattern[laneId].pitch;
                                }
                            }
                        });
                    }
                });
                arr.updateSection(section.id, {
                    patterns: { ...section.patterns, drums: updatedDrums }
                });
                setPatterns(prev => ({ ...prev, drums: updatedDrums }));
                if (drumRef.current?.generate) drumRef.current.generate();
                setIsGenerated(prev => ({ ...prev, drums: true }));
                // Create/update drum clip
                const iBar = Math.floor(audioInsertionBarRef.current || 0);
                const existDC = drumClipsRef.current.find(c => (c.timelineBar || 0) === iBar);
                if (existDC) updateDrumClip(existDC.id, { bars: section.bars, drumStates: JSON.parse(JSON.stringify(updatedDrums)) });
                else addDrumClip({ timelineBar: iBar, bars: section.bars, drumStates: JSON.parse(JSON.stringify(updatedDrums)), name: 'Drum Clip' });
                // Create/update individual drum lane clips
                const dlIds = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];
                dlIds.forEach(did => {
                    const dd = updatedDrums[did];
                    if (dd && dd.lanes) {
                        const ex = (drumLaneClipsRef.current[did] || []).find(c => (c.timelineBar || 0) === iBar);
                        if (ex) updateDrumLaneClip(did, ex.id, { bars: section.bars, laneData: JSON.parse(JSON.stringify(dd)) });
                        else addDrumLaneClip(did, { timelineBar: iBar, bars: section.bars, laneData: JSON.parse(JSON.stringify(dd)), name: did.charAt(0).toUpperCase() + did.slice(1) });
                    }
                });
                return;
            }
            // Melodic row — generate 4-bar base and loop, apply only the selected track
            const { chords, melody, bass } = generate4BarLooped({
                key, scale, genre, mood, bars: section.bars,
                complexity, tempo, humanize: humanizeParams
            });
            const iBar = Math.floor(audioInsertionBarRef.current || 0);
            if (selectedRowId === 'chords') {
                setExternalPatterns(prev => ({ ...prev, chords }));
                setPatterns(prev => ({ ...prev, chords }));
                arr.updateSection(section.id, {
                    patterns: { ...section.patterns, chords }
                });
                setIsGenerated(prev => ({ ...prev, chords: true }));
                const existing = chordClipsRef.current.find(c => (c.timelineBar || 0) === iBar);
                if (existing) updateChordClip(existing.id, { bars: section.bars, pattern: chords.map(n => ({ ...n })) });
                else addChordClip({ timelineBar: iBar, bars: section.bars, pattern: chords.map(n => ({ ...n })), name: 'Chord Clip' });
            } else if (selectedRowId === 'melody') {
                setExternalPatterns(prev => ({ ...prev, melody }));
                setPatterns(prev => ({ ...prev, melody }));
                arr.updateSection(section.id, {
                    patterns: { ...section.patterns, melody }
                });
                setIsGenerated(prev => ({ ...prev, melody: true }));
                const existing = melodyClipsRef.current.find(c => (c.timelineBar || 0) === iBar);
                if (existing) updateMelodyClip(existing.id, { bars: section.bars, pattern: melody.map(n => ({ ...n })) });
                else addMelodyClip({ timelineBar: iBar, bars: section.bars, pattern: melody.map(n => ({ ...n })), name: 'Melody Clip' });
            } else if (selectedRowId === 'bass') {
                setExternalPatterns(prev => ({ ...prev, bass }));
                setPatterns(prev => ({ ...prev, bass }));
                arr.updateSection(section.id, {
                    patterns: { ...section.patterns, bass }
                });
                setIsGenerated(prev => ({ ...prev, bass: true }));
                const existing = bassClipsRef.current.find(c => (c.timelineBar || 0) === iBar);
                if (existing) updateBassClip(existing.id, { bars: section.bars, pattern: bass.map(n => ({ ...n })) });
                else addBassClip({ timelineBar: iBar, bars: section.bars, pattern: bass.map(n => ({ ...n })), name: 'Bass Clip' });
            }
            return;
        }

        // No row selected — generate ALL patterns (drums + melodic) for the section
        const { chords, melody, bass } = generate4BarLooped({
            key, scale, genre, mood, bars: section.bars,
            complexity, tempo, humanize: humanizeParams
        });

        // Generate drum patterns for each drum element
        const drumElementIds = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];
        const updatedDrums = JSON.parse(JSON.stringify(section.patterns.drums || {}));
        drumElementIds.forEach(drumId => {
            const standardDrums = ['808', 'kick', 'snare', 'clap', 'closedhat', 'openhat', 'offsnare', 'rim', 'perc'];
            const effectiveDrumId = standardDrums.includes(drumId.toLowerCase()) ? drumId.toLowerCase() : 'perc';
            const newPattern = getProPattern(genre, effectiveDrumId, section.bars, key, scale, mood);
            if (updatedDrums[drumId] && newPattern) {
                Object.keys(updatedDrums[drumId].lanes || {}).forEach(laneId => {
                    if (newPattern[laneId]) {
                        updatedDrums[drumId].lanes[laneId].pattern = [...newPattern[laneId].pattern];
                        updatedDrums[drumId].lanes[laneId].duration = [...newPattern[laneId].duration];
                        updatedDrums[drumId].lanes[laneId].velocity = [...newPattern[laneId].velocity];
                        if (newPattern[laneId].pitch !== undefined) {
                            updatedDrums[drumId].lanes[laneId].pitch = newPattern[laneId].pitch;
                        }
                    }
                });
            }
        });

        arr.isLoadingSection.current = true;
        setExternalPatterns({ chords, melody, bass });
        setPatterns(prev => ({ ...prev, chords, melody, bass, drums: updatedDrums }));
        arr.updateSection(section.id, {
            patterns: { drums: updatedDrums, chords, melody, bass }
        });
        setIsGenerated(prev => ({
            ...prev,
            drums: true,
            chords: Array.isArray(chords) && chords.length > 0,
            melody: Array.isArray(melody) && melody.length > 0,
            bass: Array.isArray(bass) && bass.length > 0
        }));

        // Create/update clips for all tracks
        const insertBar = Math.floor(audioInsertionBarRef.current || 0);
        if (chords && chords.length > 0) {
            const existing = chordClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateChordClip(existing.id, { bars: section.bars, pattern: chords.map(n => ({ ...n })) });
            else addChordClip({ timelineBar: insertBar, bars: section.bars, pattern: chords.map(n => ({ ...n })), name: 'Chord Clip' });
        }
        if (melody && melody.length > 0) {
            const existing = melodyClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateMelodyClip(existing.id, { bars: section.bars, pattern: melody.map(n => ({ ...n })) });
            else addMelodyClip({ timelineBar: insertBar, bars: section.bars, pattern: melody.map(n => ({ ...n })), name: 'Melody Clip' });
        }
        if (bass && bass.length > 0) {
            const existing = bassClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateBassClip(existing.id, { bars: section.bars, pattern: bass.map(n => ({ ...n })) });
            else addBassClip({ timelineBar: insertBar, bars: section.bars, pattern: bass.map(n => ({ ...n })), name: 'Bass Clip' });
        }
        if (updatedDrums && Object.keys(updatedDrums).length > 0) {
            const existDC = drumClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existDC) updateDrumClip(existDC.id, { bars: section.bars, drumStates: JSON.parse(JSON.stringify(updatedDrums)) });
            else addDrumClip({ timelineBar: insertBar, bars: section.bars, drumStates: JSON.parse(JSON.stringify(updatedDrums)), name: 'Drum Clip' });
            // Create/update individual drum lane clips
            const dlIds2 = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];
            dlIds2.forEach(did => {
                const dd = updatedDrums[did];
                if (dd && dd.lanes) {
                    const ex = (drumLaneClipsRef.current[did] || []).find(c => (c.timelineBar || 0) === insertBar);
                    if (ex) updateDrumLaneClip(did, ex.id, { bars: section.bars, laneData: JSON.parse(JSON.stringify(dd)) });
                    else addDrumLaneClip(did, { timelineBar: insertBar, bars: section.bars, laneData: JSON.parse(JSON.stringify(dd)), name: did.charAt(0).toUpperCase() + did.slice(1) });
                }
            });
        }

        if (drumRef.current?.generate) drumRef.current.generate();
        requestAnimationFrame(() => { arr.isLoadingSection.current = false; });
    }, [arr.arrangementMode, arr.activeSection, arr.arrangement, globalKey, globalScale, globalGenre, globalMood, globalTempo, globalBars, humanizeParams, addChordClip, updateChordClip, addMelodyClip, updateMelodyClip, addBassClip, updateBassClip, addDrumClip, updateDrumClip, addDrumLaneClip, updateDrumLaneClip]);

    // Generate patterns for multiple selected rows in a single batch (avoids stale-state overwrites)
    const handleGenerateSelected = useCallback((rowIds) => {
        if (!arr.arrangementMode || !arr.activeSection || !rowIds || rowIds.length === 0) return;
        const section = arr.getActiveSection();
        if (!section) return;

        const key = section.settings?.key || globalKey;
        const scale = section.settings?.scale || globalScale;
        const genre = section.settings?.genre || globalGenre;
        const mood = section.settings?.mood || globalMood;
        const tempo = section.settings?.tempo || globalTempo;
        const complexity = determineComplexity(genre, mood);

        // Categorize rows
        const drumRowIds = [];
        const melodicRowIds = [];
        let drumsCollapsed = false;
        rowIds.forEach(rowId => {
            if (rowId.startsWith('drum-')) {
                drumRowIds.push(rowId);
            } else if (rowId === 'drums-collapsed') {
                drumsCollapsed = true;
            } else {
                melodicRowIds.push(rowId);
            }
        });

        // Build accumulated patterns object from current section
        const updatedPatterns = { ...section.patterns };

        // Generate drum patterns for individual drum rows
        if (drumRowIds.length > 0) {
            const updatedDrums = JSON.parse(JSON.stringify(section.patterns.drums || {}));
            drumRowIds.forEach(rowId => {
                const drumId = rowId.replace('drum-', '');
                const standardDrums = ['808', 'kick', 'snare', 'clap', 'closedhat', 'openhat', 'offsnare', 'rim', 'perc'];
                const effectiveDrumId = standardDrums.includes(drumId.toLowerCase()) ? drumId.toLowerCase() : 'perc';
                const newPattern = getProPattern(genre, effectiveDrumId, section.bars, key, scale, mood);
                if (updatedDrums[drumId] && newPattern) {
                    Object.keys(updatedDrums[drumId].lanes || {}).forEach(laneId => {
                        if (newPattern[laneId]) {
                            updatedDrums[drumId].lanes[laneId].pattern = [...newPattern[laneId].pattern];
                            updatedDrums[drumId].lanes[laneId].duration = [...newPattern[laneId].duration];
                            updatedDrums[drumId].lanes[laneId].velocity = [...newPattern[laneId].velocity];
                            if (newPattern[laneId].pitch !== undefined) {
                                updatedDrums[drumId].lanes[laneId].pitch = newPattern[laneId].pitch;
                            }
                        }
                    });
                }
            });
            updatedPatterns.drums = updatedDrums;
        }

        // Generate melodic patterns once for all melodic rows
        const externalUpdates = {};
        const patternUpdates = {};
        const generatedFlags = {};

        if (melodicRowIds.length > 0) {
            const melodicPatterns = generate4BarLooped({
                key, scale, genre, mood, bars: section.bars,
                complexity, tempo, humanize: humanizeParams
            });
            if (melodicRowIds.includes('chords')) {
                updatedPatterns.chords = melodicPatterns.chords;
                externalUpdates.chords = melodicPatterns.chords;
                patternUpdates.chords = melodicPatterns.chords;
                generatedFlags.chords = Array.isArray(melodicPatterns.chords) && melodicPatterns.chords.length > 0;
            }
            if (melodicRowIds.includes('melody')) {
                updatedPatterns.melody = melodicPatterns.melody;
                externalUpdates.melody = melodicPatterns.melody;
                patternUpdates.melody = melodicPatterns.melody;
                generatedFlags.melody = Array.isArray(melodicPatterns.melody) && melodicPatterns.melody.length > 0;
            }
            if (melodicRowIds.includes('bass')) {
                updatedPatterns.bass = melodicPatterns.bass;
                externalUpdates.bass = melodicPatterns.bass;
                patternUpdates.bass = melodicPatterns.bass;
                generatedFlags.bass = Array.isArray(melodicPatterns.bass) && melodicPatterns.bass.length > 0;
            }
        }

        if (drumRowIds.length > 0) {
            generatedFlags.drums = true;
            // Include drums in main state sync so the useEffect sync doesn't overwrite them
            patternUpdates.drums = updatedPatterns.drums;
        }

        // Prevent the patterns→arrangement sync effect from overwriting our changes
        arr.isLoadingSection.current = true;

        // Single update call — all rows written at once
        arr.updateSection(section.id, { patterns: updatedPatterns });

        // Update main state (must include drums so sync effect doesn't revert them)
        if (Object.keys(externalUpdates).length > 0) {
            setExternalPatterns(prev => ({ ...prev, ...externalUpdates }));
        }
        setPatterns(prev => ({ ...prev, ...patternUpdates }));
        if (Object.keys(generatedFlags).length > 0) {
            setIsGenerated(prev => ({ ...prev, ...generatedFlags }));
        }

        // Handle collapsed drums
        if (drumsCollapsed) {
            if (drumRef.current?.generate) drumRef.current.generate();
            setIsGenerated(prev => ({ ...prev, drums: true }));
        }

        // Re-enable sync after React has processed the state updates
        requestAnimationFrame(() => { arr.isLoadingSection.current = false; });
    }, [arr.arrangementMode, arr.activeSection, arr.arrangement, globalKey, globalScale, globalGenre, globalMood, globalTempo, humanizeParams]);

    // Generate ALL tracks (drums + melodic) and apply the SAME patterns to EVERY section
    const handleGenerateAllSections = useCallback(() => {
        if (!arr.arrangementMode || arr.arrangement.length === 0) return;

        const drumElementIds = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];

        // Use global settings for the shared generation
        const complexity = determineComplexity(globalGenre, globalMood);

        // Generate one set of 4-bar melodic patterns and loop to fill globalBars
        const { chords, melody, bass } = generate4BarLooped({
            key: globalKey, scale: globalScale, genre: globalGenre, mood: globalMood,
            bars: globalBars, complexity, tempo: globalTempo, humanize: humanizeParams
        });

        // Generate one set of drum patterns using the first section as a template for drum structure
        const templateSection = arr.arrangement[0];
        const generatedDrums = JSON.parse(JSON.stringify(templateSection.patterns.drums || {}));
        drumElementIds.forEach(drumId => {
            const standardDrums = ['808', 'kick', 'snare', 'clap', 'closedhat', 'openhat', 'offsnare', 'rim', 'perc'];
            const effectiveDrumId = standardDrums.includes(drumId.toLowerCase()) ? drumId.toLowerCase() : 'perc';
            const newPattern = getProPattern(globalGenre, effectiveDrumId, globalBars, globalKey, globalScale, globalMood);
            if (generatedDrums[drumId] && newPattern) {
                Object.keys(generatedDrums[drumId].lanes || {}).forEach(laneId => {
                    if (newPattern[laneId]) {
                        generatedDrums[drumId].lanes[laneId].pattern = [...newPattern[laneId].pattern];
                        generatedDrums[drumId].lanes[laneId].duration = [...newPattern[laneId].duration];
                        generatedDrums[drumId].lanes[laneId].velocity = [...newPattern[laneId].velocity];
                        if (newPattern[laneId].pitch !== undefined) {
                            generatedDrums[drumId].lanes[laneId].pitch = newPattern[laneId].pitch;
                        }
                    }
                });
            }
        });

        arr.isLoadingSection.current = true;

        // Apply the same patterns to every section
        arr.arrangement.forEach(section => {
            if (section.bars !== globalBars) {
                arr.updateSection(section.id, { bars: globalBars });
            }
            arr.updateSection(section.id, {
                patterns: { drums: JSON.parse(JSON.stringify(generatedDrums)), chords, melody, bass }
            });
        });

        // Apply to main state
        setPatterns(prev => ({ ...prev, chords, melody, bass, drums: generatedDrums }));
        setExternalPatterns({ chords, melody, bass });
        setIsGenerated(prev => ({
            ...prev,
            drums: true,
            chords: Array.isArray(chords) && chords.length > 0,
            melody: Array.isArray(melody) && melody.length > 0,
            bass: Array.isArray(bass) && bass.length > 0
        }));

        // Update/create clips so the arrangement view shows the generated patterns
        const insertBar = Math.floor(audioInsertionBarRef.current || 0);
        if (chords && chords.length > 0) {
            const existing = chordClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateChordClip(existing.id, { bars: globalBars, pattern: chords.map(n => ({ ...n })) });
            else addChordClip({ timelineBar: insertBar, bars: globalBars, pattern: chords.map(n => ({ ...n })), name: 'Chord Clip' });
        }
        if (melody && melody.length > 0) {
            const existing = melodyClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateMelodyClip(existing.id, { bars: globalBars, pattern: melody.map(n => ({ ...n })) });
            else addMelodyClip({ timelineBar: insertBar, bars: globalBars, pattern: melody.map(n => ({ ...n })), name: 'Melody Clip' });
        }
        if (bass && bass.length > 0) {
            const existing = bassClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateBassClip(existing.id, { bars: globalBars, pattern: bass.map(n => ({ ...n })) });
            else addBassClip({ timelineBar: insertBar, bars: globalBars, pattern: bass.map(n => ({ ...n })), name: 'Bass Clip' });
        }

        // Create/update drum clip for the arrangement view
        if (generatedDrums && Object.keys(generatedDrums).length > 0) {
            const existingDrum = drumClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existingDrum) updateDrumClip(existingDrum.id, { bars: globalBars, drumStates: JSON.parse(JSON.stringify(generatedDrums)) });
            else addDrumClip({ timelineBar: insertBar, bars: globalBars, drumStates: JSON.parse(JSON.stringify(generatedDrums)), name: 'Drum Clip' });

            // Create/update individual drum lane clips
            drumElementIds.forEach(drumId => {
                const drumData = generatedDrums[drumId];
                if (drumData && drumData.lanes) {
                    const existing = (drumLaneClipsRef.current[drumId] || []).find(c => (c.timelineBar || 0) === insertBar);
                    if (existing) updateDrumLaneClip(drumId, existing.id, { bars: globalBars, laneData: JSON.parse(JSON.stringify(drumData)) });
                    else addDrumLaneClip(drumId, { timelineBar: insertBar, bars: globalBars, laneData: JSON.parse(JSON.stringify(drumData)), name: drumId.charAt(0).toUpperCase() + drumId.slice(1) });
                }
            });
        }

        // Regenerate drums in the drum tab
        if (drumRef.current?.generate) drumRef.current.generate();

        requestAnimationFrame(() => { arr.isLoadingSection.current = false; });
    }, [arr.arrangementMode, arr.arrangement, arr.activeSection, globalKey, globalScale, globalGenre, globalMood, globalTempo, globalBars, humanizeParams, addChordClip, updateChordClip, addMelodyClip, updateMelodyClip, addBassClip, updateBassClip, addDrumClip, updateDrumClip, addDrumLaneClip, updateDrumLaneClip]);

    // Generate ALL tracks with UNIQUE patterns per section (mixed/varied arrangement)
    const handleGenerateAllMixed = useCallback(() => {
        if (!arr.arrangementMode || arr.arrangement.length === 0) return;

        const drumElementIds = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];

        arr.isLoadingSection.current = true;

        // Generate unique 4-bar chunks concatenated across the full bar range
        arr.arrangement.forEach(section => {
            const key = section.settings?.key || globalKey;
            const scale = section.settings?.scale || globalScale;
            const genre = section.settings?.genre || globalGenre;
            const mood = section.settings?.mood || globalMood;
            const tempo = section.settings?.tempo || globalTempo;
            const complexity = determineComplexity(genre, mood);

            if (section.bars !== globalBars) {
                arr.updateSection(section.id, { bars: globalBars });
                section.bars = globalBars;
            }

            // Generate N unique 4-bar melodic chunks concatenated
            const { chords, melody, bass } = generateMixed4Bar({
                key, scale, genre, mood, bars: section.bars,
                complexity, tempo, humanize: humanizeParams
            });

            // Generate unique drum patterns (getProPattern already loops 4-bar internally)
            const updatedDrums = JSON.parse(JSON.stringify(section.patterns.drums || {}));
            drumElementIds.forEach(drumId => {
                const standardDrums = ['808', 'kick', 'snare', 'clap', 'closedhat', 'openhat', 'offsnare', 'rim', 'perc'];
                const effectiveDrumId = standardDrums.includes(drumId.toLowerCase()) ? drumId.toLowerCase() : 'perc';
                const newPattern = getProPattern(genre, effectiveDrumId, section.bars, key, scale, mood);
                if (updatedDrums[drumId] && newPattern) {
                    Object.keys(updatedDrums[drumId].lanes || {}).forEach(laneId => {
                        if (newPattern[laneId]) {
                            updatedDrums[drumId].lanes[laneId].pattern = [...newPattern[laneId].pattern];
                            updatedDrums[drumId].lanes[laneId].duration = [...newPattern[laneId].duration];
                            updatedDrums[drumId].lanes[laneId].velocity = [...newPattern[laneId].velocity];
                            if (newPattern[laneId].pitch !== undefined) {
                                updatedDrums[drumId].lanes[laneId].pitch = newPattern[laneId].pitch;
                            }
                        }
                    });
                }
            });

            arr.updateSection(section.id, {
                patterns: { drums: updatedDrums, chords, melody, bass }
            });

            // Apply active section's patterns to main state
            if (section.id === arr.activeSection) {
                setPatterns(prev => ({ ...prev, chords, melody, bass, drums: updatedDrums }));
                setExternalPatterns({ chords, melody, bass });
            }
        });

        // Check active section's patterns for actual content
        const activeSec = arr.arrangement.find(s => s.id === arr.activeSection);
        const activeChords = activeSec?.patterns?.chords;
        const activeMelody = activeSec?.patterns?.melody;
        const activeBass = activeSec?.patterns?.bass;
        setIsGenerated(prev => ({
            ...prev,
            drums: true,
            chords: Array.isArray(activeChords) && activeChords.length > 0,
            melody: Array.isArray(activeMelody) && activeMelody.length > 0,
            bass: Array.isArray(activeBass) && activeBass.length > 0
        }));

        // Update/create clips so the arrangement view shows the generated patterns
        const insertBar = Math.floor(audioInsertionBarRef.current || 0);
        if (activeChords && activeChords.length > 0) {
            const existing = chordClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateChordClip(existing.id, { bars: globalBars, pattern: activeChords.map(n => ({ ...n })) });
            else addChordClip({ timelineBar: insertBar, bars: globalBars, pattern: activeChords.map(n => ({ ...n })), name: 'Chord Clip' });
        }
        if (activeMelody && activeMelody.length > 0) {
            const existing = melodyClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateMelodyClip(existing.id, { bars: globalBars, pattern: activeMelody.map(n => ({ ...n })) });
            else addMelodyClip({ timelineBar: insertBar, bars: globalBars, pattern: activeMelody.map(n => ({ ...n })), name: 'Melody Clip' });
        }
        if (activeBass && activeBass.length > 0) {
            const existing = bassClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existing) updateBassClip(existing.id, { bars: globalBars, pattern: activeBass.map(n => ({ ...n })) });
            else addBassClip({ timelineBar: insertBar, bars: globalBars, pattern: activeBass.map(n => ({ ...n })), name: 'Bass Clip' });
        }

        // Create/update drum clip for the arrangement view
        const activeDrums = activeSec?.patterns?.drums;
        if (activeDrums && typeof activeDrums === 'object' && Object.keys(activeDrums).length > 0) {
            const existingDrum = drumClipsRef.current.find(c => (c.timelineBar || 0) === insertBar);
            if (existingDrum) updateDrumClip(existingDrum.id, { bars: globalBars, drumStates: JSON.parse(JSON.stringify(activeDrums)) });
            else addDrumClip({ timelineBar: insertBar, bars: globalBars, drumStates: JSON.parse(JSON.stringify(activeDrums)), name: 'Drum Clip' });

            // Create/update individual drum lane clips
            const drumElementIds = ['808', 'kick', 'clap', 'snare', 'offSnare', 'closedHat', 'openHat', 'rim', 'perc'];
            drumElementIds.forEach(drumId => {
                const drumData = activeDrums[drumId];
                if (drumData && drumData.lanes) {
                    const existing = (drumLaneClipsRef.current[drumId] || []).find(c => (c.timelineBar || 0) === insertBar);
                    if (existing) updateDrumLaneClip(drumId, existing.id, { bars: globalBars, laneData: JSON.parse(JSON.stringify(drumData)) });
                    else addDrumLaneClip(drumId, { timelineBar: insertBar, bars: globalBars, laneData: JSON.parse(JSON.stringify(drumData)), name: drumId.charAt(0).toUpperCase() + drumId.slice(1) });
                }
            });
        }

        if (drumRef.current?.generate) drumRef.current.generate();
        requestAnimationFrame(() => { arr.isLoadingSection.current = false; });
    }, [arr.arrangementMode, arr.arrangement, arr.activeSection, globalKey, globalScale, globalGenre, globalMood, globalTempo, globalBars, humanizeParams, addChordClip, updateChordClip, addMelodyClip, updateMelodyClip, addBassClip, updateBassClip, addDrumClip, updateDrumClip, addDrumLaneClip, updateDrumLaneClip]);

    // Handle audio/MIDI drops on the arrangement timeline
    // Ctrl+Shift = split into NEW tracks (works from any row)
    // Normal drop = place on existing rows (supports multi-file)
    const handleArrangementDrop = useCallback(async ({ row, section, internalItem, jsonData, files, ctrlKey, shiftKey }) => {
        if (!row || !section) return;

        // Drop below tracks always forces split mode (creates new tracks)
        const splitMode = (ctrlKey && shiftKey) || row.type === 'new-track-drop';

        // === VST3 PLUGIN DROP ===
        if (internalItem?.type === 'vst3Plugin' || jsonData?.type === 'vst3Plugin') {
            const pluginInfo = internalItem?.pluginInfo || jsonData;
            if (!pluginInfo?.path) return;

            // Determine if plugin is an instrument (has MIDI input / is categorized as instrument)
            // Scanner returns: categories (array), hasMidiInput (boolean)
            const cats = (pluginInfo.categories || []).join(' ').toLowerCase();
            const isInstrumentPlugin = cats.includes('instrument') ||
                cats.includes('synth') ||
                cats.includes('sampler') ||
                cats.includes('generator') ||
                pluginInfo.hasMidiInput === true;

            if (splitMode) {
                // Ctrl+Shift → create a new track with the VST3 assigned
                if (isInstrumentPlugin) {
                    const trackId = addMidiTrack(pluginInfo.name || 'VST3 Instrument');
                    // Small delay to let React state settle before loading
                    setTimeout(() => loadVST3OnTrack(trackId, pluginInfo, true), 50);
                } else {
                    const trackId = addAudioTrack(pluginInfo.name || 'VST3 Effect');
                    setTimeout(() => loadVST3OnTrack(trackId, pluginInfo, false), 50);
                }
            } else {
                // Normal drop → load on the dropped row's track
                if (row.type === 'midi' && row.trackId) {
                    // MIDI tracks accept both instruments and effects
                    await loadVST3OnTrack(row.trackId, pluginInfo, isInstrumentPlugin);
                } else if (row.type === 'melodic' && row.trackKey) {
                    // Built-in melodic rows (chords/melody/bass) — accept both
                    await loadVST3OnTrack(row.trackKey, pluginInfo, isInstrumentPlugin);
                } else if (row.type === 'audio' && row.trackId) {
                    // Audio rows: effects only
                    if (isInstrumentPlugin) {
                        addToast('Instrument plugins cannot be loaded on audio tracks — use a MIDI track', 'warning');
                    } else {
                        await loadVST3OnTrack(row.trackId, pluginInfo, false);
                    }
                } else if (row.type === 'drums-all' || row.type === 'drum') {
                    // Drum rows: effects only, route to 'drums' bus
                    if (isInstrumentPlugin) {
                        addToast('Instrument plugins cannot be loaded on drum tracks — use a MIDI track', 'warning');
                    } else {
                        await loadVST3OnTrack('drums', pluginInfo, false);
                    }
                }
            }
            return;
        }

        // Helper: calculate the next startBar after existing clips in a section/track
        const getNextStartBar = (trackId, sectionId) => {
            const tracks = audioTracksRef.current;
            const track = tracks?.find(t => t.id === trackId);
            const existing = track?.clips?.filter(c => c.sectionId === sectionId) || [];
            if (existing.length === 0) return 0;
            const tempo = section.settings?.tempo || globalTempo;
            const secondsPerBar = 4 * 60 / tempo;
            let maxEnd = 0;
            for (const ec of existing) {
                const bd = ec.buffer ? ec.buffer.duration : 0;
                const ed = Math.max(0.01, (bd - (ec.trimStart || 0) - (ec.trimEnd || 0)) / (ec.playbackRate || 1));
                const endBar = (ec.startBar || 0) + ed / secondsPerBar;
                if (endBar > maxEnd) maxEnd = endBar;
            }
            return Math.round(maxEnd * 1000) / 1000;
        };

        // === RESOLVE ALL DROPPED CONTENT ===
        const resolvedItems = []; // { file?, audioBuffer?, isMidi, isAudio, name }

        if (internalItem?.audioBuffer) {
            resolvedItems.push({ audioBuffer: internalItem.audioBuffer, name: internalItem.name || 'Sample', isAudio: true, isMidi: false });
        } else if (internalItem?.handle) {
            try {
                const f = await internalItem.handle.getFile();
                if (f) resolvedItems.push({
                    file: f, name: f.name,
                    isMidi: /\.midi?$/i.test(f.name),
                    isAudio: /\.(wav|mp3|ogg|flac|aac|webm|m4a)$/i.test(f.name),
                });
            } catch (_) { /* ignore */ }
        } else if (files && files.length > 0) {
            for (const f of files) {
                resolvedItems.push({
                    file: f, name: f.name,
                    isMidi: /\.midi?$/i.test(f.name),
                    isAudio: /\.(wav|mp3|ogg|flac|aac|webm|m4a)$/i.test(f.name),
                });
            }
        }

        if (resolvedItems.length === 0) return;

        // === SPLIT MODE (Ctrl+Shift) → CREATE NEW TRACKS ===
        if (splitMode && samplerRef.current) {
            for (const item of resolvedItems) {
                const baseName = (item.name || 'Untitled').replace(/\.[^.]+$/, '');

                if (item.isAudio) {
                    try {
                        let buf = item.audioBuffer;
                        if (!buf && item.file) {
                            const arrayBuf = await item.file.arrayBuffer();
                            buf = await samplerRef.current.audioContext.decodeAudioData(arrayBuf);
                        }
                        if (!buf) continue;
                        // Each audio file → 1 new audio track
                        const trackId = addAudioTrack(baseName);
                        // Compute absolute bar from section position
                        let _tlBar = 0;
                        for (const s of arr.arrangement) {
                            if (s.id === section.id) break;
                            _tlBar += s.bars;
                        }
                        addClipToTrack(trackId, section.id, buf, baseName, { startBar: 0, timelineBar: _tlBar });
                    } catch (err) {
                        console.warn('[Arrangement] Split audio failed:', err);
                    }
                } else if (item.isMidi && item.file) {
                    try {
                        const buffer = await item.file.arrayBuffer();
                        const parser = new MIDIParser();
                        const midiData = await parser.parseMIDIFile(buffer);
                        if (midiData?.tracks?.length > 0) {
                            // Each MIDI file → 1 new MIDI track with all notes
                            const allNotes = [];
                            midiData.tracks.forEach(track => {
                                const notes = parser.eventsToNotes(track.events);
                                allNotes.push(...notes);
                            });
                            const stepNotes = parser.convertToStepFormat(allNotes);
                            if (stepNotes.length > 0) {
                                const trackId = addMidiTrack(baseName);
                                updateMidiTrackPattern(trackId, stepNotes);
                            }
                        }
                    } catch (err) {
                        console.warn('[Arrangement] Split MIDI failed:', err);
                    }
                }
            }
            return; // Split mode always returns after creating new tracks
        }

        // === NORMAL MODE → PLACE ON EXISTING ROWS ===
        // First file goes to the target row; subsequent files create new tracks.
        let isFirstAudio = true;
        let isFirstMidi = true;

        for (const item of resolvedItems) {
            const baseName = (item.name || 'Untitled').replace(/\.[^.]+$/, '');

            // Audio files
            if (item.isAudio && samplerRef.current) {
                try {
                    let buf = item.audioBuffer;
                    if (!buf && item.file) {
                        const arrayBuf = await item.file.arrayBuffer();
                        buf = await samplerRef.current.audioContext.decodeAudioData(arrayBuf);
                    }
                    if (!buf) continue;
                    // Compute absolute bar from section position
                    let _dropTlBar = 0;
                    for (const s of arr.arrangement) {
                        if (s.id === section.id) break;
                        _dropTlBar += s.bars;
                    }
                    if (isFirstAudio && row.type === 'audio' && row.trackId) {
                        // First audio file → place on target audio row
                        const startBar = getNextStartBar(row.trackId, section.id);
                        addClipToTrack(row.trackId, section.id, buf, baseName, { startBar, timelineBar: _dropTlBar + startBar });
                    } else {
                        // Subsequent files or non-audio target → create new track
                        const trackId = addAudioTrack(baseName);
                        addClipToTrack(trackId, section.id, buf, baseName, { startBar: 0, timelineBar: _dropTlBar });
                    }
                    isFirstAudio = false;
                } catch (err) {
                    console.warn('[Arrangement] Audio load failed:', err);
                }
            // MIDI files
            } else if (item.isMidi && item.file) {
                try {
                    const buffer = await item.file.arrayBuffer();
                    const parser = new MIDIParser();
                    const midiData = await parser.parseMIDIFile(buffer);
                    if (midiData?.tracks?.length > 0) {
                        const allNotes = [];
                        midiData.tracks.forEach(track => {
                            const notes = parser.eventsToNotes(track.events);
                            allNotes.push(...notes);
                        });
                        const stepNotes = parser.convertToStepFormat(allNotes);
                        if (stepNotes.length === 0) continue;
                        if (isFirstMidi && row.trackKey && ['chords', 'melody', 'bass'].includes(row.trackKey)) {
                            // First MIDI on a melodic row → update section pattern
                            arr.updateSection(section.id, {
                                patterns: { ...section.patterns, [row.trackKey]: stepNotes }
                            });
                            if (section.id === arr.activeSection) {
                                setPatterns(prev => ({ ...prev, [row.trackKey]: stepNotes }));
                                setExternalPatterns(prev => ({ ...prev, [row.trackKey]: stepNotes }));
                            }
                        } else if (isFirstMidi && row.type === 'midi' && row.trackId) {
                            // First MIDI on a MIDI row → place on that track
                            updateMidiTrackPattern(row.trackId, stepNotes);
                        } else {
                            // Subsequent files or non-MIDI target → create new track
                            const trackId = addMidiTrack(baseName);
                            updateMidiTrackPattern(trackId, stepNotes);
                        }
                        isFirstMidi = false;
                    }
                } catch (err) {
                    console.warn('[Arrangement] MIDI parse failed:', err);
                }
            }
        }
    }, [arr, samplerRef, addClipToTrack, addAudioTrack, addMidiTrack, updateMidiTrackPattern, globalTempo, loadVST3OnTrack, addToast]);

    // Apply humanization to existing patterns (without regenerating)
    const handleHumanizePatterns = useCallback(() => {
        setPatterns(prev => {
            const h = {
                chords: humanizePattern(prev.chords, humanizeParams, 'melodic'),
                melody: humanizePattern(prev.melody, humanizeParams, 'melodic'),
                bass:   humanizePattern(prev.bass, humanizeParams, 'melodic')
            };
            setExternalPatterns(ep => ({ ...ep, ...h }));
            return { ...prev, ...h };
        });
    }, [humanizeParams]);

    // Create a subtle variation of existing patterns
    const handleVariation = useCallback((amount) => {
        setPatterns(prev => {
            const v = {
                chords: createVariation(prev.chords, amount, 'melodic'),
                melody: createVariation(prev.melody, amount, 'melodic'),
                bass:   createVariation(prev.bass, amount, 'melodic')
            };
            setExternalPatterns(ep => ({ ...ep, ...v }));
            return { ...prev, ...v };
        });
    }, []);

    const handleNewProject = () => {
        if (window.confirm(t('app.newProjectConfirm'))) {
            // Reset Global States
            setProjectName('Untitled');
            setGlobalTempo(128);
            setGlobalKey('C');
            setGlobalScale('Major');
            setGlobalBars(4);
            setGlobalGenre('Trap');
            setGlobalMood('Dark');
            setIsGenerated({ drums: false, chords: false, melody: false, bass: false });
            setPatterns({ drums: {}, chords: [], melody: [], bass: [] });
            setTrackStatus({
                drums: { hasSamples: false, hasPattern: false },
                chords: { hasSamples: false, hasPattern: false },
                melody: { hasSamples: false, hasPattern: false },
                bass: { hasSamples: false, hasPattern: false }
            });
            setLoadedInstruments({ drums: null, chords: null, melody: null, bass: null });

            // Clear Sampler
            if (samplerRef.current) samplerRef.current.clearAll();

            // Clear Generator Refs
            if (drumRef.current?.clear) drumRef.current.clear();
            if (chordsRef.current?.clear) chordsRef.current.clear();
            if (melodyRef.current?.clear) melodyRef.current.clear();
            if (bassRef.current?.clear) bassRef.current.clear();

            // Clear MIDI tracks
            midiTracks.forEach(mt => {
                if (samplerRef.current) samplerRef.current.removeTrackBus(mt.id);
                if (effectsManagerRef.current) effectsManagerRef.current.removeTrackChain(mt.id);
            });
            setMidiTracks([]);
            setEditingMidiTrack(null);
            midiTrackIdCounter.current = 0;

            setTimeout(() => pushSnapshot(currentStateRef.current), 50);
            console.log("New Project Initialized");
        }
    };

    const handleDrumPatternChange = useCallback((pattern) => {
        setPatterns(prev => {
            // Deep comparison to avoid re-renders
            if (JSON.stringify(prev.drums) === JSON.stringify(pattern)) return prev;
            const newPatterns = { ...prev, drums: pattern };

            // CRITICAL: Avoid pushing snapshots during undo/redo restoration
            if (!isProcessingUndoRedo.current) {
                pushSnapshot({ ...currentStateRef.current, patterns: newPatterns });
            }

            return newPatterns;
        });
        setTrackStatus(prev => {
            const hasPattern = pattern && Object.values(pattern).some(d =>
                Object.values(d.lanes).some(l => l.pattern.some(p => p))
            );
            if (prev.drums.hasPattern === hasPattern) return prev;
            return { ...prev, drums: { ...prev.drums, hasPattern } };
        });
    }, []);

    const handleDrumClipGenerated = useCallback((clipData) => {
        // If editing a clip, update it instead of creating a new one
        if (editingDrumClipId) {
            updateDrumClip(editingDrumClipId, { drumStates: clipData.drumStates });
            // Also update individual drum lane clips
            const editClip = drumClipsRef.current.find(c => c.id === editingDrumClipId);
            if (editClip) splitDrumStatesIntoLaneClips(clipData.drumStates, editClip.timelineBar || 0, clipData.bars || editClip.bars || 4);
            return;
        }
        // If a clip already exists at bar 0, replace it; otherwise add new
        const existingAtZero = drumClipsRef.current.find(c => (c.timelineBar || 0) === 0);
        if (existingAtZero) {
            updateDrumClip(existingAtZero.id, {
                bars: clipData.bars,
                drumStates: clipData.drumStates,
            });
        } else {
            addDrumClip({
                timelineBar: 0,
                bars: clipData.bars,
                drumStates: clipData.drumStates,
                name: clipData.name || 'Drum Clip',
                color: clipData.color || null,
            });
        }
        // Split into individual drum lane clips
        splitDrumStatesIntoLaneClips(clipData.drumStates, 0, clipData.bars || 4);
        // Ensure 64 blank bars after content
        const clipEnd = (clipData.bars || 4);
        setTimelineBars(prev => Math.max(prev, Math.ceil((clipEnd + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK));
    }, [addDrumClip, updateDrumClip, editingDrumClipId, splitDrumStatesIntoLaneClips]);

    // Load drum clip into DrumGeneratorEnhanced when editing starts
    useEffect(() => {
        if (!editingDrumClipId) return;
        const clip = drumClips.find(c => c.id === editingDrumClipId);
        if (!clip || !drumRef.current?.loadState) return;
        drumRef.current.loadState(clip.drumStates);
    }, [editingDrumClipId]); // intentionally only depend on editingDrumClipId

    // When editing a drum clip, route pattern changes to updateDrumClip
    const handleDrumPatternChangeForClip = useCallback((pattern) => {
        if (!editingDrumClipId) return;
        // Deep-clone drumStates stripping AudioBuffer refs
        const clonedStates = {};
        Object.entries(pattern).forEach(([drumId, drum]) => {
            clonedStates[drumId] = {
                powered: drum.powered,
                solo: drum.solo,
                mute: drum.mute,
                lanes: {},
            };
            if (drum.sample) clonedStates[drumId].sampleName = drum.sample.name || null;
            Object.entries(drum.lanes || {}).forEach(([laneId, lane]) => {
                clonedStates[drumId].lanes[laneId] = {
                    pitch: lane.pitch,
                    pattern: [...lane.pattern],
                    velocity: [...lane.velocity],
                    duration: [...lane.duration],
                };
            });
        });
        updateDrumClip(editingDrumClipId, { drumStates: clonedStates });
        // Also update individual drum lane clips
        const editClip = drumClipsRef.current.find(c => c.id === editingDrumClipId);
        if (editClip) splitDrumStatesIntoLaneClips(clonedStates, editClip.timelineBar || 0, editClip.bars || 4);
    }, [editingDrumClipId, updateDrumClip, splitDrumStatesIntoLaneClips]);

    // Listen for drum clip edit close event
    useEffect(() => {
        const handler = () => setEditingDrumClipId(null);
        window.addEventListener('wavloom-close-drum-clip-edit', handler);
        return () => window.removeEventListener('wavloom-close-drum-clip-edit', handler);
    }, []);

    // ─── Chord Clip handlers ───
    const handleChordClipGenerated = useCallback((clipData) => {
        if (editingChordClipId) {
            updateChordClip(editingChordClipId, { pattern: clipData.pattern });
            return;
        }
        const existingAtZero = chordClipsRef.current.find(c => (c.timelineBar || 0) === 0);
        if (existingAtZero) {
            updateChordClip(existingAtZero.id, { bars: clipData.bars, pattern: clipData.pattern });
        } else {
            addChordClip({ timelineBar: 0, bars: clipData.bars, pattern: clipData.pattern, name: clipData.name || 'Chord Clip', color: clipData.color || null });
        }
        const clipEnd = (clipData.bars || 4);
        setTimelineBars(prev => Math.max(prev, Math.ceil((clipEnd + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK));
    }, [addChordClip, updateChordClip, editingChordClipId]);

    useEffect(() => {
        if (!editingChordClipId) return;
        const clip = chordClips.find(c => c.id === editingChordClipId);
        if (!clip || !chordsRef.current?.loadState) return;
        chordsRef.current.loadState(clip.pattern);
    }, [editingChordClipId]);

    useEffect(() => {
        const handler = () => setEditingChordClipId(null);
        window.addEventListener('wavloom-close-chord-clip-edit', handler);
        return () => window.removeEventListener('wavloom-close-chord-clip-edit', handler);
    }, []);

    // ─── Melody Clip handlers ───
    const handleMelodyClipGenerated = useCallback((clipData) => {
        if (editingMelodyClipId) {
            updateMelodyClip(editingMelodyClipId, { pattern: clipData.pattern });
            return;
        }
        const existingAtZero = melodyClipsRef.current.find(c => (c.timelineBar || 0) === 0);
        if (existingAtZero) {
            updateMelodyClip(existingAtZero.id, { bars: clipData.bars, pattern: clipData.pattern });
        } else {
            addMelodyClip({ timelineBar: 0, bars: clipData.bars, pattern: clipData.pattern, name: clipData.name || 'Melody Clip', color: clipData.color || null });
        }
        const clipEnd = (clipData.bars || 4);
        setTimelineBars(prev => Math.max(prev, Math.ceil((clipEnd + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK));
    }, [addMelodyClip, updateMelodyClip, editingMelodyClipId]);

    useEffect(() => {
        if (!editingMelodyClipId) return;
        const clip = melodyClips.find(c => c.id === editingMelodyClipId);
        if (!clip || !melodyRef.current?.loadState) return;
        melodyRef.current.loadState(clip.pattern);
    }, [editingMelodyClipId]);

    useEffect(() => {
        const handler = () => setEditingMelodyClipId(null);
        window.addEventListener('wavloom-close-melody-clip-edit', handler);
        return () => window.removeEventListener('wavloom-close-melody-clip-edit', handler);
    }, []);

    // ─── Bass Clip handlers ───
    const handleBassClipGenerated = useCallback((clipData) => {
        if (editingBassClipId) {
            updateBassClip(editingBassClipId, { pattern: clipData.pattern });
            return;
        }
        const existingAtZero = bassClipsRef.current.find(c => (c.timelineBar || 0) === 0);
        if (existingAtZero) {
            updateBassClip(existingAtZero.id, { bars: clipData.bars, pattern: clipData.pattern });
        } else {
            addBassClip({ timelineBar: 0, bars: clipData.bars, pattern: clipData.pattern, name: clipData.name || 'Bass Clip', color: clipData.color || null });
        }
        const clipEnd = (clipData.bars || 4);
        setTimelineBars(prev => Math.max(prev, Math.ceil((clipEnd + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK));
    }, [addBassClip, updateBassClip, editingBassClipId]);

    useEffect(() => {
        if (!editingBassClipId) return;
        const clip = bassClips.find(c => c.id === editingBassClipId);
        if (!clip || !bassRef.current?.loadState) return;
        bassRef.current.loadState(clip.pattern);
    }, [editingBassClipId]);

    useEffect(() => {
        const handler = () => setEditingBassClipId(null);
        window.addEventListener('wavloom-close-bass-clip-edit', handler);
        return () => window.removeEventListener('wavloom-close-bass-clip-edit', handler);
    }, []);

    const handleDrumSampleLoad = useCallback((has) => {
        setTrackStatus(prev => {
            if (prev.drums.hasSamples === has) return prev;
            return { ...prev, drums: { ...prev.drums, hasSamples: has } };
        });
    }, []);

    const setDrumIsGenerated = useCallback((val) => {
        setIsGenerated(prev => ({ ...prev, drums: val }));
    }, []);

    // Project Name State
    const [projectName, setProjectName] = useState('My Project');
    const timeTracker = useTimeTracker(hasCollabPeers, projectName);
    const myPermissions = collab.getMyPermissions();

    const [exportProgress, setExportProgress] = useState(0);
    const [exportStatusText, setExportStatusText] = useState('');
    const [exportStartTime, setExportStartTime] = useState(null);
    const [exportTimeElapsed, setExportTimeElapsed] = useState(0);
    const [exportTimeEstimate, setExportTimeEstimate] = useState(null);
    const [exportSizeEstimate, setExportSizeEstimate] = useState(null);

    // Auto-save: periodic save (interval from settings)
    useEffect(() => {
        if (!appSettings.autoSaveEnabled) return;
        const interval = setInterval(() => {
            try {
                const snapshot = JSON.stringify({
                    projectName,
                    globalSettings: {
                        tempo: globalTempo,
                        key: globalKey,
                        scale: globalScale,
                        bars: globalBars,
                        genre: globalGenre,
                        mood: globalMood
                    },
                    patterns,
                    activeTab,
                    mixer: {
                        trackMix,
                        globalMutes: Array.from(globalMutes),
                        masterVolume,
                        globalSolos: Array.from(globalSolos)
                    },
                    trackStatus,
                    arrangementMode: arr.arrangementMode,
                    arrangement: arr.arrangementMode ? arr.arrangement : null,
                    effects: effectsManagerRef.current ? effectsManagerRef.current.serialize() : null,
                    timestamp: Date.now()
                });
                if (snapshot.length > 5 * 1024 * 1024) {
                    console.warn('[AutoSave] Snapshot too large (>5MB), skipping');
                    return;
                }
                localStorage.setItem('wavloom_autosave', snapshot);
            } catch (e) { console.warn('[AutoSave] Save failed:', e); }
        }, appSettings.autoSaveInterval * 1000);
        return () => clearInterval(interval);
    }, [projectName, globalTempo, globalKey, globalScale, globalBars, globalGenre, globalMood, patterns, activeTab, trackMix, globalMutes, globalSolos, masterVolume, trackStatus, arr.arrangementMode, arr.arrangement, appSettings.autoSaveEnabled, appSettings.autoSaveInterval]);

    // --- Auto-Save Restore / Dismiss ---
    const handleRestoreAutosave = () => {
        try {
            const raw = localStorage.getItem('wavloom_autosave');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.globalSettings) {
                if (data.globalSettings.tempo) setGlobalTempo(data.globalSettings.tempo);
                if (data.globalSettings.key) setGlobalKey(data.globalSettings.key);
                if (data.globalSettings.scale) setGlobalScale(data.globalSettings.scale);
                if (data.globalSettings.bars) setGlobalBars(data.globalSettings.bars);
                if (data.globalSettings.genre) setGlobalGenre(data.globalSettings.genre);
                if (data.globalSettings.mood) setGlobalMood(data.globalSettings.mood);
            }
            if (data.patterns) setPatterns(data.patterns);
            if (data.projectName) setProjectName(data.projectName);
            if (data.activeTab) setActiveTab(data.activeTab);
            if (data.trackStatus) setTrackStatus(data.trackStatus);

            // Restore mixer
            if (data.mixer) {
                if (data.mixer.trackMix) setTrackMix(data.mixer.trackMix);
                if (data.mixer.globalMutes) setGlobalMutes(new Set(data.mixer.globalMutes));
                if (data.mixer.globalSolos) setGlobalSolos(new Set(data.mixer.globalSolos));
                if (data.mixer.masterVolume !== undefined) setMasterVolume(data.mixer.masterVolume);
            }

            // Restore arrangement
            if (data.arrangementMode && data.arrangement) {
                arr.setArrangementMode(true);
                arr.setArrangement(data.arrangement);
                arr.setActiveSection(data.arrangement[0]?.id || null);
            }

            // Restore effects
            if (data.effects && effectsManagerRef.current) {
                effectsManagerRef.current.loadState(data.effects);
                setEffectsVersion(v => v + 1);
            }

            // Push to generator UIs
            setTimeout(() => {
                if (drumRef.current) drumRef.current.loadState(data.patterns?.drums);
                if (chordsRef.current) chordsRef.current.loadState(data.patterns?.chords);
                if (melodyRef.current) melodyRef.current.loadState(data.patterns?.melody);
                if (bassRef.current) bassRef.current.loadState(data.patterns?.bass);

                // Restore vocal engine params (lightweight — no audio buffer)
            }, 100);
            localStorage.removeItem('wavloom_autosave');
            setShowAutosaveBanner(false);
        } catch (e) { console.error('[AutoSave] Restore failed:', e); }
    };

    const handleDismissAutosave = () => {
        localStorage.removeItem('wavloom_autosave');
        setShowAutosaveBanner(false);
    };

    // --- Project Save / Load Handlers ---
    const handleSaveProject = async () => {
        if (!projectName.trim()) {
            alert(t('app.verifyProjectName'));
            // We allow saving but warn? Or just proceed with "Untitled"?
            // User requested naming.
        }

        setIsExporting(true);
        try {
            const pm = new ProjectManager(samplerRef.current, exporterRef.current);
            const projectState = {
                projectName: projectName || "Untitled Project",
                globalSettings: {
                    tempo: globalTempo,
                    key: globalKey,
                    scale: globalScale,
                    bars: globalBars,
                    resolution: globalResolution,
                    playStartTime: globalPlayStartTime,
                    // genre/mood?
                    genre: globalGenre,
                    mood: globalMood
                },
                patterns,
                trackStatus,
                mixer: {
                    trackMix,
                    globalMutes: Array.from(globalMutes),
                    masterVolume,
                    globalSolos: Array.from(globalSolos)
                },
                // CRITICAL: Save loaded instrument names
                loadedInstrumentNames: {
                    chords: loadedInstruments.chords,
                    melody: loadedInstruments.melody,
                    bass: loadedInstruments.bass
                },
                // Arrangement data (v2.0.0 continuous timeline)
                arrangementMode: arr.arrangementMode,
                arrangement: arr.arrangementMode ? arr.arrangement : null,
                timelineBars,
                loopRange,
                // Track display order
                trackOrder,
                // Audio tracks
                audioTracks,
                // MIDI tracks (clips + instrument metadata, no audio buffers)
                midiTracks: midiTracks.map(mt => ({
                    id: mt.id, name: mt.name, color: mt.color,
                    clips: (mt.clips || []).map(c => ({
                        id: c.id, timelineBar: c.timelineBar, bars: c.bars,
                        pattern: c.pattern, name: c.name, color: c.color
                    })),
                    instrumentName: mt.instrumentName, octave: mt.octave
                })),
                // Drum clips (clip-based drum timeline)
                drumClips: drumClips.map(c => ({
                    id: c.id, timelineBar: c.timelineBar, bars: c.bars,
                    drumStates: c.drumStates, name: c.name, color: c.color
                })),
                // Chord/Melody/Bass clips (clip-based timelines)
                chordClips: chordClips.map(c => ({
                    id: c.id, timelineBar: c.timelineBar, bars: c.bars,
                    pattern: c.pattern, name: c.name, color: c.color
                })),
                melodyClips: melodyClips.map(c => ({
                    id: c.id, timelineBar: c.timelineBar, bars: c.bars,
                    pattern: c.pattern, name: c.name, color: c.color
                })),
                bassClips: bassClips.map(c => ({
                    id: c.id, timelineBar: c.timelineBar, bars: c.bars,
                    pattern: c.pattern, name: c.name, color: c.color
                })),
                // Track automation data
                trackAutomation,
                // Effects chain state
                effects: effectsManagerRef.current ? effectsManagerRef.current.serialize() : { tracks: {}, master: [] }
            };

            const { blob, filename } = await pm.saveProject(projectState, (percent, msg) => {
                setExportProgress(percent);
                setExportStatusText(msg);
            });

            // Save using File System Access API (Save As dialog) with fallback
            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'WavLoom Project',
                            accept: { 'application/zip': ['.wlz'] }
                        }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (pickerErr) {
                    // User cancelled the dialog — do nothing
                    if (pickerErr.name !== 'AbortError') throw pickerErr;
                }
            } else {
                // Fallback for browsers without File System Access API
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            // Clear autosave after successful manual save
            localStorage.removeItem('wavloom_autosave');

            // Notify collaborators that we saved
            if (collab.broadcastSaveNotification) {
                collab.broadcastSaveNotification();
            }
        } catch (error) {
            console.error("Save Project Failed:", error);
            alert(t('app.saveProjectFailed', { error: error.message }));
        } finally {
            setIsExporting(false);
            setExportProgress(0);
            setExportStatusText("");
        }
    };

    const handleLoadProjectInput = (e) => {
        const file = e.target.files[0];
        if (file) handleLoadProject(file);
    };

    const handleLoadProject = async (file) => {
        setIsExporting(true);
        setExportStatusText("Loading Project...");
        setExportProgress(10); // Start
        try {
            const pm = new ProjectManager(samplerRef.current, exporterRef.current);
            const manifest = await pm.loadProject(file);

            // Restore State
            setProjectName(manifest.projectName || "Untitled");
            if (manifest.globalSettings) {
                const s = manifest.globalSettings;
                if (s.tempo) setGlobalTempo(s.tempo);
                if (s.key) setGlobalKey(s.key);
                if (s.scale) setGlobalScale(s.scale);
                if (s.bars) setGlobalBars(s.bars);
                if (s.resolution) setGlobalResolution(s.resolution);
                if (s.genre) setGlobalGenre(s.genre);
                if (s.mood) setGlobalMood(s.mood);
            }

            if (manifest.patterns) {
                setPatterns(manifest.patterns);
            }

            if (manifest.trackStatus) {
                setTrackStatus(manifest.trackStatus);
            }

            // Restore mixer settings
            if (manifest.mixer) {
                if (manifest.mixer.trackMix) {
                    setTrackMix(manifest.mixer.trackMix);
                    // Apply to audio engine
                    Object.entries(manifest.mixer.trackMix).forEach(([id, mix]) => {
                        if (samplerRef.current?.setTrackVolume) samplerRef.current.setTrackVolume(id, mix.volume);
                        if (samplerRef.current?.setTrackPan) samplerRef.current.setTrackPan(id, mix.pan);
                    });
                }
                if (manifest.mixer.globalMutes) {
                    const mutes = new Set(manifest.mixer.globalMutes);
                    setGlobalMutes(mutes);
                    // Apply mutes to audio engine
                    mutes.forEach(id => {
                        if (samplerRef.current?.setTrackVolume) samplerRef.current.setTrackVolume(id, 0);
                    });
                }
                // Restore master volume
                if (manifest.mixer.masterVolume !== undefined) {
                    setMasterVolume(manifest.mixer.masterVolume);
                    if (samplerRef.current?.masterGain) {
                        samplerRef.current.masterGain.gain.setTargetAtTime(
                            manifest.mixer.masterVolume,
                            samplerRef.current.audioContext.currentTime,
                            0.01
                        );
                    }
                }
                // Restore solo state
                if (manifest.mixer.globalSolos) {
                    setGlobalSolos(new Set(manifest.mixer.globalSolos));
                }
            }

            // Restore Loaded Instruments Names
            const instrumentNames = manifest.loadedInstrumentNames || {};
            setLoadedInstruments({
                chords: instrumentNames.chords || null,
                melody: instrumentNames.melody || null,
                bass: instrumentNames.bass || null
            });

            // Refresh Generator UI States (Patterns & Instrument syncing)
            if (drumRef.current) drumRef.current.loadState(manifest.patterns?.drums);
            if (chordsRef.current) chordsRef.current.loadState(manifest.patterns?.chords, instrumentNames.chords);
            if (melodyRef.current) melodyRef.current.loadState(manifest.patterns?.melody, instrumentNames.melody);
            if (bassRef.current) bassRef.current.loadState(manifest.patterns?.bass, instrumentNames.bass);

            // Restore continuous timeline state
            if (manifest.timelineBars) {
                setTimelineBars(manifest.timelineBars);
            }
            if (manifest.loopRange) {
                setLoopRange(manifest.loopRange);
            }

            // Restore clips (v2.0.0 format — ProjectManager handles migration)
            if (manifest.drumClips) setDrumClips(manifest.drumClips);
            if (manifest.chordClips) setChordClips(manifest.chordClips);
            if (manifest.melodyClips) setMelodyClips(manifest.melodyClips);
            if (manifest.bassClips) setBassClips(manifest.bassClips);

            // Restore arrangement state
            if (manifest.arrangementMode && manifest.arrangement) {
                arr.setArrangementMode(true);
                arr.setArrangement(manifest.arrangement);
                arr.setActiveSection(manifest.arrangement[0]?.id || null);
                setActiveTab('arrange');

                // Ensure patterns are loaded into generators after React settles
                const firstSection = manifest.arrangement[0];
                if (firstSection?.patterns) {
                    setTimeout(() => {
                        if (drumRef.current && firstSection.patterns.drums) drumRef.current.loadState(firstSection.patterns.drums);
                        if (chordsRef.current && firstSection.patterns.chords) chordsRef.current.loadState(firstSection.patterns.chords, instrumentNames.chords);
                        if (melodyRef.current && firstSection.patterns.melody) melodyRef.current.loadState(firstSection.patterns.melody, instrumentNames.melody);
                        if (bassRef.current && firstSection.patterns.bass) bassRef.current.loadState(firstSection.patterns.bass, instrumentNames.bass);
                        setExternalPatterns({
                            chords: firstSection.patterns.chords || null,
                            melody: firstSection.patterns.melody || null,
                            bass: firstSection.patterns.bass || null
                        });
                    }, 200);
                }
            } else {
                arr.setArrangementMode(false);
                arr.setArrangement([]);
                arr.setActiveSection(null);
            }

            // Restore audio tracks
            if (manifest.audioTracks && manifest.audioTracks.length > 0) {
                // Backward compat: infer trackType from name for old projects
                setAudioTracks(manifest.audioTracks.map(t => ({
                    ...t,
                    trackType: t.trackType || (/^Vocal\s+\d+$/i.test(t.name || '') ? 'vocal' : 'audio')
                })));
                // Update counters to avoid ID collisions
                let maxTrackNum = 0;
                let maxClipNum = 0;
                manifest.audioTracks.forEach(t => {
                    const tMatch = t.id.match(/(\d+)$/);
                    if (tMatch) maxTrackNum = Math.max(maxTrackNum, parseInt(tMatch[1]));
                    t.clips.forEach(c => {
                        const cMatch = c.id.match(/(\d+)$/);
                        if (cMatch) maxClipNum = Math.max(maxClipNum, parseInt(cMatch[1]));
                    });
                });
                audioTrackIdCounter.current = maxTrackNum;
                audioClipIdCounter.current = maxClipNum;
                // Initialize mixer state for audio tracks
                const newMix = {};
                manifest.audioTracks.forEach(t => {
                    newMix[t.id] = { volume: 0.5, pan: 0 };
                });
                setTrackMix(prev => ({ ...prev, ...newMix }));
            } else {
                setAudioTracks([]);
            }

            // Restore track automation
            if (manifest.trackAutomation && typeof manifest.trackAutomation === 'object') {
                setTrackAutomation(manifest.trackAutomation);
            } else {
                setTrackAutomation({});
            }

            // Restore MIDI tracks
            // First clean up existing MIDI tracks
            midiTracks.forEach(mt => {
                if (samplerRef.current) samplerRef.current.removeTrackBus(mt.id);
                if (effectsManagerRef.current) effectsManagerRef.current.removeTrackChain(mt.id);
            });
            if (manifest.midiTracks && manifest.midiTracks.length > 0) {
                const restoredMidi = manifest.midiTracks.map(mt => {
                    // Backward compat: migrate pattern:[] → clips:[]
                    let clips = mt.clips || [];
                    if ((!clips || clips.length === 0) && mt.pattern && mt.pattern.length > 0) {
                        clips = [{
                            id: `mclip_migrated_${mt.id}`,
                            timelineBar: 0,
                            bars: manifest.globalBars || 4,
                            pattern: mt.pattern,
                            name: 'MIDI Clip',
                            color: null
                        }];
                    }
                    return {
                        id: mt.id, name: mt.name, color: mt.color,
                        clips, instrumentId: null,
                        instrumentName: mt.instrumentName || '', octave: mt.octave ?? 3
                    };
                });
                restoredMidi.forEach(mt => {
                    if (samplerRef.current) samplerRef.current.addTrackBus(mt.id);
                });
                setMidiTracks(restoredMidi);
                // Update counter
                let maxMidiNum = 0;
                restoredMidi.forEach(mt => {
                    const m = mt.id.match(/(\d+)$/);
                    if (m) maxMidiNum = Math.max(maxMidiNum, parseInt(m[1]));
                });
                midiTrackIdCounter.current = maxMidiNum;
                // Initialize mixer state for MIDI tracks
                const newMidiMix = {};
                restoredMidi.forEach(mt => { newMidiMix[mt.id] = { volume: 0.5, pan: 0 }; });
                setTrackMix(prev => ({ ...prev, ...newMidiMix }));
            } else {
                setMidiTracks([]);
            }
            setEditingMidiTrack(null);

            // Restore drum clips
            if (manifest.drumClips && manifest.drumClips.length > 0) {
                setDrumClips(manifest.drumClips);
                let maxDrumClipNum = 0;
                manifest.drumClips.forEach(c => {
                    const m = c.id?.match(/(\d+)$/);
                    if (m) maxDrumClipNum = Math.max(maxDrumClipNum, parseInt(m[1]));
                });
                drumClipIdCounter.current = maxDrumClipNum;
            } else {
                setDrumClips([]);
            }
            setEditingDrumClipId(null);

            // Restore chord clips
            if (manifest.chordClips && manifest.chordClips.length > 0) {
                setChordClips(manifest.chordClips);
                let max = 0;
                manifest.chordClips.forEach(c => { const m = c.id?.match(/(\d+)$/); if (m) max = Math.max(max, parseInt(m[1])); });
                chordClipIdCounter.current = max;
            } else { setChordClips([]); }
            setEditingChordClipId(null);

            // Restore melody clips
            if (manifest.melodyClips && manifest.melodyClips.length > 0) {
                setMelodyClips(manifest.melodyClips);
                let max = 0;
                manifest.melodyClips.forEach(c => { const m = c.id?.match(/(\d+)$/); if (m) max = Math.max(max, parseInt(m[1])); });
                melodyClipIdCounter.current = max;
            } else { setMelodyClips([]); }
            setEditingMelodyClipId(null);

            // Restore bass clips
            if (manifest.bassClips && manifest.bassClips.length > 0) {
                setBassClips(manifest.bassClips);
                let max = 0;
                manifest.bassClips.forEach(c => { const m = c.id?.match(/(\d+)$/); if (m) max = Math.max(max, parseInt(m[1])); });
                bassClipIdCounter.current = max;
            } else { setBassClips([]); }
            setEditingBassClipId(null);

            // Restore track display order
            if (manifest.trackOrder) {
                setTrackOrder(manifest.trackOrder);
            } else {
                setTrackOrder(null); // Will auto-derive from defaults via sync useEffect
            }

            // Restore effects chains
            if (manifest.effects && effectsManagerRef.current) {
                effectsManagerRef.current.loadState(manifest.effects);
                setEffectsVersion(v => v + 1);
            }

            setTimeout(() => pushSnapshot(currentStateRef.current), 100);

            setExportProgress(100);
            setExportStatusText("Done!");
            alert(t('app.projectLoadedSuccess'));

        } catch (error) {
            console.error("Load Project Failed:", error);
            alert(t('app.loadProjectFailed', { error: error.message }));
        } finally {
            setIsExporting(false);
            setExportProgress(0);
            setExportStatusText("");
        }
    };

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            background: isDark ? '#0a0a0f' : '#f5f5f7',
            color: isDark ? '#eee' : '#333',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            overflow: 'hidden'
        }}>
            {/* Left Sidebar Area — Record Mode (base layer) + File Explorer (overlay layer) */}
            <div style={{
                width: isRecordMode
                    ? `${recordModeWidth}px`
                    : (isBrowserVisible ? `${browserWidth}px` : '0px'),
                height: '100%',
                position: 'relative',
                flexShrink: 0,
                transition: (!isResizing && !isResizingRecordMode) ? 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                overflow: 'visible',
            }}>
                {/* Record Mode Panel (base layer — always visible when active) */}
                {isRecordMode && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0,
                        width: `${recordModeWidth}px`,
                        display: 'flex', flexDirection: 'column',
                        backgroundColor: isDark ? 'rgba(20, 20, 28, 0.95)' : '#f8f8fa',
                        backdropFilter: 'blur(10px)',
                        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e0e0e0'}`,
                        zIndex: 1,
                        overflow: 'hidden',
                    }}>
                        <Suspense fallback={<div style={{ padding: '20px', color: isDark ? '#888' : '#666' }}>{t('common.loading')}</div>}>
                            <RecordModePanel
                                theme={theme}
                                accentColors={accent}
                                globalKey={globalKey}
                                globalScale={globalScale}
                                globalTempo={globalTempo}
                                globalBars={globalBars}
                                globalGenre={globalGenre}
                                globalMood={globalMood}
                                melodyNotes={patterns.melody || []}
                                onClose={() => { setIsRecordMode(false); setActiveTab('lyricengine'); }}
                                initialLyrics={recordModeLyrics}
                                globalIsPlaying={globalIsPlaying}
                                globalCurrentStep={globalCurrentStep}
                                globalContinuousProgress={globalContinuousProgress}
                                isRecording={isRecording}
                                isCountingIn={isCountingIn}
                                metronomeEnabled={metronomeEnabled}
                                setMetronomeEnabled={setMetronomeEnabled}
                                metronomeVolume={metronomeVolume}
                                setMetronomeVolume={setMetronomeVolume}
                                recordingStartBar={recordingStartBarRef.current}
                            />
                        </Suspense>
                        {/* Record Mode Resize Handle */}
                        <div
                            onMouseDown={startResizingRecordMode}
                            style={{
                                position: 'absolute', right: '-3px', top: 0, bottom: 0,
                                width: '6px', cursor: 'col-resize', zIndex: 102,
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => e.target.style.background = isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239,68,68,0.15)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        />
                    </div>
                )}

                {/* File Explorer Panel (overlay layer when Record Mode active) */}
                <div style={{
                    position: isRecordMode ? 'absolute' : 'relative',
                    top: 0, left: 0, bottom: 0,
                    height: isRecordMode ? undefined : '100%',
                    width: isBrowserVisible ? `${browserWidth}px` : '0px',
                    display: 'flex', flexDirection: 'column',
                    backgroundColor: isDark ? 'rgba(20, 20, 25, 0.5)' : '#fff',
                    backdropFilter: 'blur(10px)',
                    transition: (!isResizing) ? 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                    borderRight: isBrowserVisible ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e0e0e0'}` : 'none',
                    overflow: 'hidden',
                    zIndex: isRecordMode ? 10 : 1,
                }}>
                <TabGuard tab="browser" myId={collab.myId} owners={collab.tabOwners} freeForAll={collab.freeForAll} onRequestAccess={(tab) => collab.requestAccess(tab)} permissions={collab.getMyPermissions()}>
                    <Browser
                        theme={theme}
                        accentColors={accent}
                        tempo={globalTempo}
                        bars={globalBars}
                        currentKey={globalKey}
                        currentScale={globalScale}
                        globalIsPlaying={globalIsPlaying}
                        onStopGeneratorPlayback={() => setGlobalIsPlaying(false)}
                        onFolderSelect={handleFolderSelect}
                        onFileSelect={setSelectedFile}
                        onGenerateFromFolder={handleGenerateFromFolder}
                        onRemoveFolder={handleRemoveFolder}
                        onExtractMIDI={handleExtractMIDI}
                        onPreview={(item) => console.log('Previewing MIDI:', item)}
                        onAddToFileSlot={async (file) => {
                            // If a MIDI track editor modal or arrangement clip editor is open, load the sample into it
                            const targetMidiTrack = editingMidiTrack || focusedMidiClipTrackId;
                            if (targetMidiTrack) {
                                if (file.type === 'audio' && file.handle) {
                                    try {
                                        const f = await file.handle.getFile();
                                        const instrumentId = `midi_inst_${targetMidiTrack}_${Date.now()}`;
                                        await samplerRef.current.loadInstrumentFromFiles(instrumentId, [f], f.name);
                                        updateMidiTrackInstrument(targetMidiTrack, instrumentId, f.name);
                                    } catch (err) { console.error('[Browser→MidiTrack] load error:', err); }
                                } else if (file.type === 'midi' && file.handle) {
                                    try {
                                        const f = await file.handle.getFile();
                                        const parser = new MIDIParser();
                                        const midiData = await parser.loadMIDIFile(f);
                                        let notes = [];
                                        for (const t of midiData.tracks) {
                                            const trackNotes = parser.eventsToNotes(t.events);
                                            if (trackNotes.length > 0) { notes = trackNotes; break; }
                                        }
                                        if (notes.length > 0) {
                                            const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
                                            const newPattern = notes.map(n => ({
                                                time: Math.floor(n.startTick / ticksPerStep),
                                                duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                                                note: n.note,
                                                velocity: n.velocity / 127
                                            })).filter(n => n.time < globalBars * 32);
                                            updateMidiTrackPattern(targetMidiTrack, newPattern);
                                        }
                                    } catch (err) { console.error('[Browser→MidiTrack] MIDI load error:', err); }
                                }
                                return;
                            }
                            if (activeTab === 'drums' && drumRef.current) {
                                if (file.type === 'audio') drumRef.current.loadSample(file);
                                else if (file.type === 'midi' && drumRef.current.loadMIDI) drumRef.current.loadMIDI(file);
                            } else if (activeTab === 'chords' && chordsRef.current) {
                                if (file.type === 'audio') chordsRef.current.loadSample(file);
                                else if (file.type === 'midi') chordsRef.current.loadMIDI(file);
                            } else if (activeTab === 'melody' && melodyRef.current) {
                                if (file.type === 'audio') melodyRef.current.loadSample(file);
                                else if (file.type === 'midi') melodyRef.current.loadMIDI(file);
                            } else if (activeTab === 'bass' && bassRef.current) {
                                if (file.type === 'audio') bassRef.current.loadSample(file);
                                else if (file.type === 'midi') bassRef.current.loadMIDI(file);
                            }
                        }}
                        presetManager={presetManagerRef.current}
                        onSavePreset={handleSavePreset}
                        onLoadPreset={handleLoadPreset}
                        currentGenre={globalGenre}
                        currentMood={globalMood}
                        vst3InitialScanDone={vst3InitialScanDone}
                        vst3InitialScanPlugins={vst3InitialScanPlugins}
                        onAddEffectToTrack={(effectType) => {
                            const etid = arrangeEffectTrackId || arrangeSelectedRow;
                            if (!etid || !effectsManagerRef.current) return;
                            const fx = AudioEffect.create(effectType);
                            if (!fx) return;
                            effectsManagerRef.current.getOrCreateTrackChain(etid).addEffect(fx);
                            setEffectsVersion(v => v + 1);
                        }}
                        onVst3PluginDoubleClick={(plugin) => {
                            // Auto-load plugin on a new MIDI or audio track
                            const cats = (plugin.categories || []).join(' ').toLowerCase();
                            const isInstrument = cats.includes('instrument') || cats.includes('synth') ||
                                cats.includes('sampler') || cats.includes('generator') || plugin.hasMidiInput === true;
                            if (isInstrument) {
                                const trackId = addMidiTrack(plugin.name || 'VST3 Instrument');
                                setTimeout(() => loadVST3OnTrack(trackId, plugin, true), 50);
                            } else {
                                const trackId = addAudioTrack(plugin.name || 'VST3 Effect');
                                setTimeout(() => loadVST3OnTrack(trackId, plugin, false), 50);
                            }
                        }}
                    />
                    {/* ... resize handle ... */}

                    {/* Resize Handle */}
                    {isBrowserVisible && (
                        <div
                            onMouseDown={startResizing}
                            style={{
                                position: 'absolute',
                                right: '-3px',
                                top: 0,
                                bottom: 0,
                                width: '6px',
                                cursor: 'col-resize',
                                zIndex: 100,
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => e.target.style.background = isDark ? 'rgba(57, 255, 20, 0.3)' : 'rgba(0,0,0,0.1)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        />
                    )}
                </TabGuard>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                {/* Auto-Save Restore Banner */}
                {showAutosaveBanner && (
                    <div style={{
                        padding: '8px 16px',
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#fff8e1',
                        borderBottom: `1px solid ${isDark ? '#333' : '#ffe082'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '12px',
                        color: isDark ? '#ccc' : '#333',
                        flexShrink: 0,
                        zIndex: 101
                    }}>
                        <span>{t('app.autoSaveFound', { date: autosaveTimestamp ? new Date(autosaveTimestamp).toLocaleString() : '' })}</span>
                        <button onClick={handleRestoreAutosave} title={t('common.restoreTooltip')} style={{
                            padding: '4px 12px', background: ac, color: '#fff', border: 'none',
                            borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                        }}>{t('common.restore')}</button>
                        <button onClick={handleDismissAutosave} title={t('common.dismissTooltip')} style={{
                            padding: '4px 12px', background: 'transparent', color: isDark ? '#888' : '#666',
                            border: `1px solid ${isDark ? '#444' : '#ccc'}`, borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
                        }}>{t('common.dismiss')}</button>
                    </div>
                )}
                {/* Header Row 1: Logo + Playback + Right controls */}
                <div style={{
                    padding: '8px 16px',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}`,
                    background: isDark ? 'rgba(20, 20, 25, 0.8)' : '#fff',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    flexShrink: 0,
                    ...(isElectron() ? { WebkitAppRegion: 'drag' } : {})
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, WebkitAppRegion: 'no-drag' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                                onClick={() => {
                                    const willShow = !isBrowserVisible;
                                    // When opening file explorer over Record Mode, match its width
                                    if (willShow && isRecordMode) setBrowserWidth(recordModeWidth);
                                    setIsBrowserVisible(willShow);
                                }}
                                title={isBrowserVisible ? t('ui.hideSidebar') : t('ui.showSidebar')}
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '4px',
                                    color: isDark ? '#aaa' : '#555',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    transition: 'all 0.2s',
                                    background: 'transparent'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{
                                    display: 'inline-block',
                                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    transform: isBrowserVisible ? 'rotate(0deg)' : 'rotate(-180deg)',
                                    lineHeight: 1
                                }}>
                                    ◀
                                </span>
                            </div>

                            <h1 key={accentTheme} data-tour-id="tour-welcome" style={{
                                margin: 0,
                                fontSize: '22px',
                                fontWeight: '900',
                                letterSpacing: '-0.5px',
                                backgroundImage: accent.type === 'gradient' ? acGrad : 'none',
                                WebkitBackgroundClip: accent.type === 'gradient' ? 'text' : 'unset',
                                WebkitTextFillColor: accent.type === 'gradient' ? 'transparent' : ac,
                                backgroundClip: accent.type === 'gradient' ? 'text' : 'unset',
                                color: ac
                            }}>
                                WAVLOOM STUDIO
                            </h1>

                            <div style={{ display: 'flex', gap: '8px', marginLeft: '10px' }}>
                                <button
                                    onClick={handleUndo}
                                    disabled={!canUndo}
                                    title={t('arrange.undo')}
                                    style={{
                                        background: isDark ? 'rgba(255,255,255,0.05)' : '#eee',
                                        border: 'none',
                                        borderRadius: '6px',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: canUndo ? ac : (isDark ? '#444' : '#ccc'),
                                        cursor: canUndo ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => canUndo && (e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.2))}
                                    onMouseLeave={(e) => canUndo && (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#eee')}
                                >
                                    ↶
                                </button>
                                <button
                                    onClick={handleRedo}
                                    disabled={!canRedo}
                                    title={t('arrange.redo')}
                                    style={{
                                        background: isDark ? 'rgba(255,255,255,0.05)' : '#eee',
                                        border: 'none',
                                        borderRadius: '6px',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: canRedo ? ac : (isDark ? '#444' : '#ccc'),
                                        cursor: canRedo ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => canRedo && (e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.2))}
                                    onMouseLeave={(e) => canRedo && (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#eee')}
                                >
                                    ↷
                                </button>
                            </div>
                        </div>

                        {/* Master Play Control */}
                        <div data-tour-id="tour-playback" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '8px' }}>
                            <button
                                onClick={() => {
                                    if (playCooldownRef.current) return;
                                    playCooldownRef.current = true;
                                    requestAnimationFrame(() => { playCooldownRef.current = false; });
                                    const nextState = !globalIsPlaying;
                                    // If stopping and currently recording, stop recording first
                                    // (handleStopRecording already sets globalIsPlaying(false))
                                    if (!nextState && (isRecording || isCountingIn)) {
                                        handleStopRecording();
                                        window.dispatchEvent(new Event('stopAllAudio'));
                                        return;
                                    }
                                    setGlobalIsPlaying(nextState);
                                    if (!nextState) {
                                        window.dispatchEvent(new Event('stopAllAudio'));
                                    }
                                }}
                                title={globalIsPlaying ? t('ui.stopPlayback') : t('ui.startPlayback')}
                                style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    background: globalIsPlaying ? 'rgba(255, 57, 57, 0.2)' : 'rgba(57, 255, 20, 0.2)',
                                    border: `2px solid ${globalIsPlaying ? '#ff3939' : acSec}`,
                                    color: globalIsPlaying ? '#ff3939' : acSec,
                                    fontSize: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: `0 0 20px ${globalIsPlaying ? 'rgba(255, 57, 57, 0.2)' : 'rgba(57, 255, 20, 0.2)'}`,
                                }}
                            >
                                {globalIsPlaying ? '⏹' : '▶'}
                            </button>

                            {/* Record Button — visible on vocal/arrange tabs when arrangement is enabled */}
                            {(activeTab === 'lyrics' || activeTab === 'arrange') && arr.arrangementMode && (
                                <button
                                    onClick={() => {
                                        if (recordCooldownRef.current) return;
                                        recordCooldownRef.current = true;
                                        requestAnimationFrame(() => { recordCooldownRef.current = false; });
                                        if (isRecording || isCountingIn) {
                                            handleStopRecording();
                                        } else {
                                            handleStartRecording();
                                        }
                                    }}
                                    title={isRecording ? t('ui.stopRecording') : isCountingIn ? t('ui.countingIn') : t('ui.startRecording')}
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '50%',
                                        background: (isRecording || isCountingIn) ? 'rgba(255, 57, 57, 0.2)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                        border: `2px solid ${(isRecording || isCountingIn) ? '#ff3939' : (isDark ? '#444' : '#bbb')}`,
                                        color: (isRecording || isCountingIn) ? '#ff3939' : (isDark ? '#888' : '#666'),
                                        fontSize: '18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: (isRecording || isCountingIn) ? '0 0 20px rgba(255, 57, 57, 0.3)' : 'none',
                                        animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                                    }}
                                >
                                    {isCountingIn ? '…' : '⏺'}
                                </button>
                            )}

                            <div>
                                <div style={{
                                    fontSize: '10px',
                                    fontWeight: '900',
                                    color: isDark ? ac : '#333',
                                    letterSpacing: '1px',
                                    width: '100px',
                                    fontVariantNumeric: 'tabular-nums'
                                }}>
                                    {(() => {
                                        if (!globalIsPlaying && globalCurrentStep === 0) return `BAR 1.1`;

                                        const totalSteps = globalBars * 32;
                                        const rawBar = (globalContinuousProgress / 32) + 1;

                                        // If we are at the very end of the pattern, show the "target" bar (5 or 9)
                                        if (globalIsPlaying && globalContinuousProgress > totalSteps - 0.1) {
                                            return `BAR ${globalBars + 1}`;
                                        }

                                        const bar = Math.floor(rawBar);
                                        const beat = Math.floor(((rawBar - bar) * 4) + 1);
                                        return `BAR ${bar}.${beat}`;
                                    })()}
                                </div>
                                <div style={{ fontSize: '9px', color: isDark ? '#555' : '#999', letterSpacing: '1px', fontWeight: 600 }}>
                                    {globalBars} bars · {globalBars * 32} steps
                                </div>
                                {lastSeed !== null && (
                                    <div style={{ fontSize: '9px', color: isDark ? '#555' : '#999', letterSpacing: '0.5px', fontVariantNumeric: 'tabular-nums' }}>
                                        Seed: {lastSeed}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right side controls */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0, WebkitAppRegion: 'no-drag' }}>
                        {/* Theme Toggle Button */}
                        <button
                            data-tour-id="tour-theme"
                            onClick={toggleTheme}
                            title={`${t('settings.theme')}: ${isDark ? t('settings.light') : t('settings.dark')}`}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: isDark ? '#2a2a3e' : '#fff',
                                border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                                cursor: 'pointer',
                                fontSize: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isDark ? '☀️' : '🌙'}
                        </button>

                        {/* Accent Color Picker Dropdown */}
                        <div ref={accentPickerRef} style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowAccentPicker(prev => !prev)}
                                title={t('settings.accentColor')}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: acGrad,
                                    border: `2px solid ${isDark ? '#444' : '#ccc'}`,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    boxShadow: showAccentPicker ? `0 0 12px ${hexToRgba(ac, 0.5)}` : 'none'
                                }}
                            />
                            {showAccentPicker && (
                                <div style={{
                                    position: 'absolute',
                                    top: '44px',
                                    right: 0,
                                    zIndex: 9999,
                                    background: isDark ? '#1a1a28' : '#fff',
                                    border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                                    borderRadius: '12px',
                                    padding: '12px',
                                    boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
                                    minWidth: '108px'
                                }}>
                                    <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: isDark ? '#666' : '#999', marginBottom: '8px' }}>{t('settings.solid')}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 24px)', gap: '6px', marginBottom: '12px' }}>
                                        {SOLID_ACCENT_KEYS.map(k => {
                                            const thm = ACCENT_THEMES[k];
                                            const isActive = accentTheme === k;
                                            return (
                                                <div
                                                    key={k}
                                                    onClick={() => { setAccentTheme(k); setShowAccentPicker(false); }}
                                                    title={thm.name}
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: thm.accent,
                                                        cursor: 'pointer',
                                                        border: isActive ? '2.5px solid #fff' : '2.5px solid transparent',
                                                        boxShadow: isActive ? `0 0 10px ${thm.accent}` : 'none',
                                                        transition: 'all 0.15s'
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: isDark ? '#666' : '#999', marginBottom: '8px' }}>{t('settings.gradient')}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 24px)', gap: '6px' }}>
                                        {GRADIENT_ACCENT_KEYS.map(k => {
                                            const thm = ACCENT_THEMES[k];
                                            const isActive = accentTheme === k;
                                            return (
                                                <div
                                                    key={k}
                                                    onClick={() => { setAccentTheme(k); setShowAccentPicker(false); }}
                                                    title={thm.name}
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: thm.gradient,
                                                        cursor: 'pointer',
                                                        border: isActive ? '2.5px solid #fff' : '2.5px solid transparent',
                                                        boxShadow: isActive ? `0 0 10px ${thm.accent}` : 'none',
                                                        transition: 'all 0.15s'
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* PWA Install Button */}
                        {showInstallBtn && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <button
                                    onClick={handleInstallClick}
                                    title={t('ui.installDesktopApp')}
                                    style={{
                                        padding: '6px 12px',
                                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#ddd'}`,
                                        borderRadius: '20px 0 0 20px',
                                        color: ac,
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        letterSpacing: '0.5px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                                >
                                    ⬇ INSTALL
                                </button>
                                <button
                                    onClick={handleInstallDismiss}
                                    title="Dismiss"
                                    style={{
                                        padding: '6px 8px',
                                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#ddd'}`,
                                        borderLeft: 'none',
                                        borderRadius: '0 20px 20px 0',
                                        color: isDark ? '#666' : '#999',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4b4b'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = isDark ? '#666' : '#999'; }}
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Collab Auth */}
                        <GoogleAuth
                            onLogin={(profile) => collab.loginWithGoogle(profile)}
                            isDark={isDark}
                            isHost={collab.isHost}
                            accentColor={ac}
                        />

                        {/* Host Controls Icon Button */}
                        <button
                            data-tour-id="tour-collab"
                            onClick={() => {
                                if (!isAuthenticated) {
                                    if (!toasts.some(t => t.message === 'Please sign in with Google to use collaboration features')) {
                                        addToast('Please sign in with Google to use collaboration features', 'warning');
                                    }
                                    return;
                                }
                                collab.setIsCollapsed(false);
                            }}
                            title={t('app.hostControls')}
                            style={{
                                position: 'relative',
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                background: ac,
                                border: 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                boxShadow: `0 4px 20px ${hexToRgba(ac, 0.4)}`,
                                fontWeight: 'bold'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.boxShadow = `0 6px 25px ${hexToRgba(ac, 0.5)}`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = `0 4px 20px ${hexToRgba(ac, 0.4)}`;
                            }}
                        >
                            👥
                            {collab.unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: '#ff4b4b',
                                    color: '#fff',
                                    fontSize: '9px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid #0f0f14',
                                    lineHeight: 1
                                }}>
                                    {collab.unreadCount > 9 ? '9+' : collab.unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Following indicator */}
                        {collab.followingPeer && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: hexToRgba(acSec, 0.15),
                                border: `1px solid ${acSec}`,
                                borderRadius: '8px',
                                fontSize: '10px',
                                color: acSec,
                                fontWeight: 'bold'
                            }}>
                                <span>{t('app.following')} {collab.peers[collab.followingPeer]?.profile?.name || collab.followingPeer?.slice(-4)}</span>
                                <button
                                    onClick={() => collab.stopFollowing()}
                                    style={{
                                        background: 'rgba(255,75,75,0.2)',
                                        border: '1px solid #ff4b4b',
                                        borderRadius: '4px',
                                        color: '#ff4b4b',
                                        fontSize: '9px',
                                        padding: '2px 8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {t('app.stop')}
                                </button>
                            </div>
                        )}

                        {/* Mobile Link Button */}
                        <MobileLinkButton
                            onClick={() => {
                                setShowMobileLinkModal(true);
                                if (!mobileLink.isActive) mobileLink.activate();
                            }}
                            connectedCount={mobileLink.connectedCount}
                            isDark={isDark}
                            ac={ac}
                            hexToRgba={hexToRgba}
                        />

                        {/* Shortcuts Button */}
                        <div
                            data-tour-id="tour-shortcuts"
                            onClick={() => setShowShortcutsPanel(true)}
                            title={t('app.keyboardShortcuts')}
                            style={{
                                width: '36px',
                                height: '36px',
                                color: isDark ? ac : '#333',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                transition: 'all 0.2s',
                                background: 'transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : 'rgba(0,0,0,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                ?
                            </span>
                        </div>

                        {/* Settings Button */}
                        <div
                            onClick={() => setShowSettingsModal(true)}
                            title={t('app.settings')}
                            style={{
                                width: '36px',
                                height: '36px',
                                color: isDark ? ac : '#333',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                transition: 'all 0.2s',
                                background: 'transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : 'rgba(0,0,0,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </div>

                        {/* Full Screen Button — hidden in Electron (native controls replace it) */}
                        {!isElectron() && (
                            <div
                                onClick={toggleFullscreen}
                                title={isFullscreen ? t('common.restore') : t('app.fullScreen')}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    color: isDark ? ac : '#333',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    transition: 'all 0.2s',
                                    background: 'transparent'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : 'rgba(0,0,0,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{ fontSize: '18px' }}>
                                    {isFullscreen ? '⧉' : '⛶'}
                                </span>
                            </div>
                        )}

                        {/* Electron native window controls */}
                        {isElectron() && (
                            <WindowControls theme={{
                                text: isDark ? '#ccc' : '#333',
                                bg: isDark ? '#0a0a0f' : '#fff',
                                accent: ac,
                                accentText: '#fff',
                                textMuted: isDark ? '#666' : '#999',
                                panelBorder: isDark ? '#333' : '#ddd',
                                cellInactive: isDark ? '#2a2a3e' : '#e8e8ec',
                                highlight: ac
                            }} />
                        )}
                    </div>
                </div>

                {/* Row 2: Global Settings — Genre, Mood, Key, Scale, Bars, Grid Res, BPM, MIDI */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    gap: '8px',
                    padding: '6px 16px 8px',
                    background: isDark ? 'rgba(15, 15, 20, 0.6)' : '#f5f5f8',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e0e0e0'}`,
                    flexShrink: 0,
                    flexWrap: 'wrap'
                }}>
                    {/* GENRE */}
                    <div data-tour-id="tour-genre">
                        <label style={{ display: 'block', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3px' }}>{t('app.genre')}</label>
                        <select value={globalGenre} onChange={(e) => setGlobalGenre(e.target.value)} title={t('app.selectGenre')}
                            style={{ width: '95px', padding: '5px 8px', background: isDark ? '#2a2a3e' : '#e0e0e0', border: `1px solid ${isDark ? '#444' : '#ccc'}`, borderRadius: '4px', color: isDark ? '#fff' : '#000', fontSize: '11px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                            <option value="Custom">Custom</option>
                            {Object.entries(GENRE_CATEGORIES).map(([catName, cat]) => (
                                <optgroup key={catName} label={`-- ${catName} --`}>
                                    {Object.entries(cat.subcategories).map(([subCatName, list]) => (
                                        list.map(genre => <option key={genre} value={genre}>{genre}</option>)
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    {/* MOOD */}
                    <div data-tour-id="tour-mood">
                        <label style={{ display: 'block', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3px' }}>{t('app.mood')}</label>
                        <select value={globalMood} onChange={(e) => setGlobalMood(e.target.value)} title={t('app.selectMood')}
                            style={{ width: '95px', padding: '5px 8px', background: isDark ? '#2a2a3e' : '#e0e0e0', border: `1px solid ${isDark ? '#444' : '#ccc'}`, borderRadius: '4px', color: isDark ? '#fff' : '#000', fontSize: '11px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                            <option value="Custom">Custom</option>
                            {Object.keys(MOOD_MODIFIERS).map(mood => <option key={mood} value={mood}>{mood}</option>)}
                        </select>
                    </div>
                    {/* KEY */}
                    <div data-tour-id="tour-key-scale" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3px' }}>{t('app.key')}</label>
                            <select value={globalKey} onChange={(e) => setGlobalKey(e.target.value)} title={t('app.selectKey')}
                                style={{ width: '60px', padding: '5px 8px', background: isDark ? '#2a2a3e' : '#e0e0e0', border: `1px solid ${isDark ? '#444' : '#ccc'}`, borderRadius: '4px', color: isDark ? '#fff' : '#000', fontSize: '11px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                                {globalGenre === 'Custom' && <option value="Custom">Custom</option>}
                                {allowedKeys.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3px' }}>{t('app.scale')}</label>
                            <select value={globalScale} onChange={(e) => setGlobalScale(e.target.value)} title={t('app.selectScale')}
                                style={{ width: '90px', padding: '5px 8px', background: isDark ? '#2a2a3e' : '#e0e0e0', border: `1px solid ${isDark ? '#444' : '#ccc'}`, borderRadius: '4px', color: isDark ? '#fff' : '#000', fontSize: '11px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                                {allowedScales.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* AUTO-TUNE SAMPLES TO KEY */}
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '3px' }}>AUTO-TUNE</label>
                            <button
                                onClick={() => setAutoTuneSamples(prev => !prev)}
                                title={autoTuneSamples ? 'Auto-tune ON: imported samples are pitch-matched to project key' : 'Auto-tune OFF: samples play at original pitch'}
                                style={{
                                    padding: '5px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                                    cursor: 'pointer', border: 'none', letterSpacing: '0.5px', transition: 'all 0.2s',
                                    background: autoTuneSamples ? ac : (isDark ? '#2a2a3e' : '#e0e0e0'),
                                    color: autoTuneSamples ? '#fff' : (isDark ? '#888' : '#666'),
                                }}
                            >
                                {autoTuneSamples ? `KEY ♪` : 'OFF'}
                            </button>
                        </div>
                    </div>
                    {/* BPM + TAP + MET + STRETCH */}
                    <div data-tour-id="tour-bpm" style={{ userSelect: 'none', opacity: myPermissions.canChangeTempo ? 1 : 0.4, pointerEvents: myPermissions.canChangeTempo ? 'auto' : 'none' }}>
                        <label style={{ display: 'block', fontSize: '9px', marginBottom: '3px', color: isDark ? '#888' : '#666', fontWeight: 'bold' }}>{t('app.bpm')}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isEditingBpm ? (
                                <input type="number" autoFocus defaultValue={globalTempo} min={20} max={300}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => { const v = Math.max(20, Math.min(300, Math.round(Number(e.target.value) || 140))); setGlobalTempo(v); setIsEditingBpm(false); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); else if (e.key === 'Escape') setIsEditingBpm(false); }}
                                    style={{ width: '54px', padding: '4px 6px', background: isDark ? '#1a1a2e' : '#fff', border: `1px solid ${ac}`, borderRadius: '4px', color: ac, fontSize: '13px', fontWeight: '900', textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
                                />
                            ) : (
                                <div
                                    onMouseDown={(e) => {
                                        const startY = e.clientY; const startTempo = globalTempo;
                                        const onMouseMove = (moveEvent) => { const deltaY = startY - moveEvent.clientY; setGlobalTempo(Math.max(20, Math.min(300, startTempo + Math.round(deltaY / 2)))); };
                                        const onMouseUp = () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = 'default'; };
                                        window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp); document.body.style.cursor = 'ns-resize';
                                    }}
                                    onDoubleClick={() => setIsEditingBpm(true)}
                                    style={{ padding: '5px 10px', background: isDark ? '#1a1a2e' : '#fff', border: `1px solid ${isDark ? '#2a2a3e' : '#ccc'}`, borderRadius: '4px', color: ac, fontSize: '13px', fontWeight: '900', cursor: 'ns-resize', textAlign: 'center', minWidth: '46px', transition: 'background 0.2s', display: 'inline-block' }}
                                    title={t('app.dragBpm')}
                                >{globalTempo}</div>
                            )}
                            <button ref={tapBtnRef} onClick={handleTapTempo} style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${isDark ? '#2a2a3e' : '#ccc'}`, borderRadius: '12px', color: isDark ? '#888' : '#666', fontSize: '9px', fontWeight: '800', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.1s', lineHeight: 1, whiteSpace: 'nowrap' }} title={t('app.tapTempo')}>{t('app.tap')}</button>
                            <button onClick={() => setMetronomeEnabled(prev => !prev)} style={{ padding: '5px 8px', background: metronomeEnabled ? (isDark ? hexToRgba(acSec, 0.25) : hexToRgba(acSec, 0.15)) : 'transparent', border: `1px solid ${metronomeEnabled ? acSec : (isDark ? '#2a2a3e' : '#ccc')}`, borderRadius: '12px', color: metronomeEnabled ? acSec : (isDark ? '#888' : '#666'), fontSize: '9px', fontWeight: '800', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1, whiteSpace: 'nowrap' }} title={t('app.toggleMetronome')}>{t('app.met')}</button>
                            {metronomeEnabled && (
                                <input type="range" min={0} max={1} step={0.05} value={metronomeVolume} onChange={(e) => setMetronomeVolume(parseFloat(e.target.value))} style={{ width: '50px', height: '3px', accentColor: acSec, cursor: 'pointer' }} title={t('app.metronomeVolume', { volume: Math.round(metronomeVolume * 100) })} />
                            )}
                            <button onClick={() => setGlobalTimeStretch(prev => !prev)} style={{ padding: '4px 8px', fontSize: '9px', fontWeight: '900', letterSpacing: '0.5px', background: globalTimeStretch ? (isDark ? 'rgba(0,210,210,0.12)' : 'rgba(0,180,180,0.15)') : (isDark ? 'rgba(255,255,255,0.04)' : '#eee'), border: `1px solid ${globalTimeStretch ? '#00d2d2' : (isDark ? 'rgba(255,255,255,0.08)' : '#ddd')}`, borderRadius: '4px', color: globalTimeStretch ? '#00d2d2' : (isDark ? '#666' : '#999'), cursor: 'pointer', whiteSpace: 'nowrap' }} title={t('app.toggleTimeStretch')}>{t('app.stretch')}</button>
                            {globalTimeStretch && (
                                <button onClick={() => setPreservePitch(prev => !prev)} style={{ padding: '4px 8px', fontSize: '9px', fontWeight: '900', letterSpacing: '0.5px', background: preservePitch ? (isDark ? 'rgba(190,100,230,0.12)' : 'rgba(170,80,210,0.15)') : (isDark ? 'rgba(255,255,255,0.04)' : '#eee'), border: `1px solid ${preservePitch ? '#be64e6' : (isDark ? 'rgba(255,255,255,0.08)' : '#ddd')}`, borderRadius: '4px', color: preservePitch ? '#be64e6' : (isDark ? '#666' : '#999'), cursor: 'pointer', whiteSpace: 'nowrap' }} title={t('app.preservePitch')}>{t('app.pitch')}</button>
                            )}
                        </div>
                    </div>
                    {/* MIDI */}
                    <MIDIInputPanel
                        midiInput={midiInputRef.current}
                        isDark={isDark}
                        accentColors={accent}
                        activeTab={activeTab}
                        globalIsPlaying={globalIsPlaying}
                        globalCurrentStepRef={globalCurrentStepRef}
                        globalResolution={globalResolution}
                        globalBars={globalBars}
                        globalTempo={globalTempo}
                        samplerRef={samplerRef}
                        loadedInstruments={loadedInstruments}
                        patterns={patterns}
                        setPatterns={setPatterns}
                        drumRef={drumRef}
                        octaveOffset={midiOctaveOffset}
                        setOctaveOffset={setMidiOctaveOffset}
                    />

                    {/* Separator */}
                    <div style={{ width: '1px', height: '24px', background: isDark ? '#333' : '#ccc', margin: '0 4px', alignSelf: 'center' }} />

                    {/* BARS Quick Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {[4, 8, 16, 32, 64].map(bars => (
                            <button
                                key={bars}
                                onClick={() => setGlobalBars(bars)}
                                title={t('app.setPatternBars', { bars })}
                                style={{
                                    padding: '5px 8px',
                                    minWidth: '36px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: globalBars === bars ? (isDark ? hexToRgba(ac, 0.05) : ac) : (isDark ? '#1a1a1f' : '#eee'),
                                    border: `1.5px solid ${globalBars === bars ? ac : (isDark ? '#222' : 'transparent')}`,
                                    borderRadius: '6px',
                                    color: globalBars === bars ? (isDark ? ac : '#fff') : (isDark ? '#555' : '#888'),
                                    fontSize: '11px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
                                    textShadow: globalBars === bars && isDark ? `0 0 10px ${hexToRgba(ac, 0.3)}` : 'none',
                                    boxShadow: globalBars === bars ? `0 0 15px ${isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.3)}` : 'none',
                                    lineHeight: '1.1'
                                }}
                            >
                                <span style={{ fontSize: '12px', fontWeight: '900' }}>{bars}</span>
                                <span style={{ fontSize: '8px', fontWeight: '800', opacity: 0.7, letterSpacing: '0.5px' }}>{t('app.bars')}</span>
                            </button>
                        ))}
                    </div>

                    {/* REPEAT Toggle */}
                    <button
                        onClick={() => setGlobalRepeat(prev => !prev)}
                        title={globalRepeat ? t('app.repeatOnDesc') : t('app.repeatOffDesc')}
                        style={{
                            padding: '5px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: globalRepeat ? (isDark ? hexToRgba(ac, 0.05) : ac) : (isDark ? '#1a1a1f' : '#eee'),
                            border: `1.5px solid ${globalRepeat ? ac : (isDark ? '#222' : 'transparent')}`,
                            borderRadius: '6px',
                            color: globalRepeat ? (isDark ? ac : '#fff') : (isDark ? '#555' : '#888'),
                            fontSize: '9px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
                            textShadow: globalRepeat && isDark ? `0 0 10px ${hexToRgba(ac, 0.3)}` : 'none',
                            boxShadow: globalRepeat ? `0 0 15px ${isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.3)}` : 'none',
                            lineHeight: '1.1',
                            letterSpacing: '0.5px'
                        }}
                    >
                        <span style={{ fontSize: '11px', fontWeight: '900' }}>↻</span>
                        <span style={{ fontSize: '7px', fontWeight: '800', opacity: 0.7 }}>{t('app.rpt')}</span>
                    </button>

                    {/* Separator */}
                    <div style={{ width: '1px', height: '24px', background: isDark ? '#333' : '#ccc', margin: '0 4px', alignSelf: 'center' }} />

                    {/* Grid RES Quick Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {[4, 8, 16, 32].map(res => (
                            <button
                                key={res}
                                onClick={() => setGlobalResolution(res)}
                                title={t('app.setGridRes', { res })}
                                style={{
                                    padding: '8px 10px',
                                    minWidth: '36px',
                                    background: globalResolution === res ? (isDark ? hexToRgba(ac, 0.05) : ac) : (isDark ? '#1a1a1f' : '#eee'),
                                    border: `1.5px solid ${globalResolution === res ? ac : (isDark ? '#222' : 'transparent')}`,
                                    borderRadius: '6px',
                                    color: globalResolution === res ? (isDark ? ac : '#fff') : (isDark ? '#555' : '#888'),
                                    fontSize: '11px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
                                    textShadow: globalResolution === res && isDark ? `0 0 10px ${hexToRgba(ac, 0.3)}` : 'none',
                                    boxShadow: globalResolution === res ? `0 0 15px ${isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.3)}` : 'none'
                                }}
                            >
                                1/{res}
                            </button>
                        ))}
                    </div>

                    {/* Separator */}
                    <div style={{ width: '1px', height: '24px', background: isDark ? '#333' : '#ccc', margin: '0 4px', alignSelf: 'center' }} />

                    {/* Transpose Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {[
                            { label: 'OCT', sign: '+', val: 12 },
                            { label: 'OCT', sign: '-', val: -12 },
                            { label: 'ST', sign: '+', val: 1 },
                            { label: 'ST', sign: '-', val: -1 }
                        ].map(btn => (
                            <button
                                key={btn.label + btn.sign}
                                onClick={() => handleGlobalTranspose(btn.val)}
                                style={{
                                    padding: '5px 8px',
                                    minWidth: '36px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isDark ? '#1a1a1f' : '#eee',
                                    border: `1.5px solid ${isDark ? '#222' : 'transparent'}`,
                                    borderRadius: '6px',
                                    color: ac,
                                    cursor: 'pointer',
                                    transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
                                    lineHeight: '1.1'
                                }}
                            >
                                <span style={{ fontSize: '9px', fontWeight: '900' }}>{btn.label}</span>
                                <span style={{ fontSize: '12px', fontWeight: '900' }}>{btn.sign}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tabs & Global Grid/Bar Controls */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 20px',
                    background: isDark ? 'rgba(15, 15, 20, 0.5)' : '#f0f0f2',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e0e0e0'}`,
                    justifyContent: 'flex-start'
                }}>
                    <div data-tour-id="tour-tabs" style={{ display: 'flex', gap: '4px' }}>
                        {[
                            { id: 'drums', label: t('app.drums') },
                            { id: 'chords', label: t('app.chords') },
                            { id: 'melody', label: t('app.melody') },
                            { id: 'bass', label: t('app.bass') },
                            { id: 'lyrics', label: t('app.lyrics') },
                            { id: 'lyricengine', label: t('app.lyricEngine') },
                            { id: 'mixer', label: t('app.mixer') },
                            { id: 'arrange', label: t('app.arrange') },
                            { id: 'drumsynth', label: t('app.drumSynth') },
                            { id: 'instrsynth', label: t('app.instSynth') }
                        ].map(tab => {
                            const isUtilityTab = tab.id === 'lyrics' || tab.id === 'lyricengine' || tab.id === 'mixer' || tab.id === 'arrange' || tab.id === 'drumsynth' || tab.id === 'instrsynth';
                            const isSynthTab = tab.id === 'drumsynth' || tab.id === 'instrsynth';
                            const isLocked = !isUtilityTab && collab.tabOwners[tab.id] && collab.tabOwners[tab.id] !== collab.myId;
                            const tabAccent = ac;
                            const tabAccentGlow = hexToRgba(tabAccent, 0.15);
                            const tabAccentGlowLight = hexToRgba(tabAccent, 0.1);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => !isLocked && setActiveTab(tab.id)}
                                    disabled={isLocked}
                                    style={{
                                        padding: isUtilityTab ? '10px 16px' : '10px 24px',
                                        background: isLocked ? (isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5') : (activeTab === tab.id ? (isDark ? tabAccentGlow : tabAccent) : 'transparent'),
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: isLocked ? (isDark ? '#444' : '#ccc') : (activeTab === tab.id ? (isDark ? tabAccent : '#fff') : (isDark ? '#888' : '#666')),
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        letterSpacing: '1px',
                                        cursor: isLocked ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: activeTab === tab.id && !isLocked ? `0 0 15px ${tabAccentGlowLight}` : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: isLocked ? 0.6 : 1
                                    }}
                                >
                                    {isLocked && <span>🔒</span>}
                                    {tab.label}
                                    {!isUtilityTab && (
                                        <div style={{ display: 'flex', gap: '2px', fontSize: '12px' }}>
                                            {isGenerated[tab.id] && <span title={t('app.patternGenerated')}>✅</span>}
                                            {trackStatus[tab.id]?.hasSamples && <span title={t('app.instrumentLoaded')}>🔉</span>}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                        {isLoadingSamples && (
                            <div style={{
                                fontSize: '10px',
                                color: ac,
                                animation: 'pulse 1.5s ease-in-out infinite',
                                letterSpacing: '0.5px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap'
                            }}>
                                {t('app.loadingSamples')}
                            </div>
                        )}
                    </div>

                    {/* CPU & Memory VU Meters — right of tabs */}
                    <CpuMeter isDark={isDark} ac={ac} hexToRgba={hexToRgba} />

                </div>

                {/* Humanize Panel — collapsible row between tabs and generator content */}
                <HumanizePanel
                    humanizeParams={humanizeParams}
                    setHumanizeParams={setHumanizeParams}
                    onHumanize={handleHumanizePatterns}
                    onVariation={handleVariation}
                    theme={theme}
                    accentColors={accent}
                />

                {/* Generator Content - Tab Exclusive Rendering */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ display: activeTab === 'drums' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
                        <TabGuard tab="drums" myId={collab.myId} owners={collab.tabOwners} freeForAll={collab.freeForAll} onRequestAccess={(tab) => collab.requestAccess(tab)} permissions={collab.getMyPermissions()}>
                            <DrumGeneratorEnhanced
                                ref={drumRef}
                                accentColors={accent}
                                selectedFolder={selectedFolder}
                                globalSelectedSample={selectedFile}
                                sampler={samplerRef.current}
                                theme={theme}
                                globalGenre={globalGenre}
                                setGlobalGenre={setGlobalGenre}
                                globalMood={globalMood}
                                setGlobalMood={setGlobalMood}
                                globalTempo={globalTempo}
                                globalBars={globalBars}
                                setGlobalBars={setGlobalBars}
                                globalRepeat={globalRepeat}
                                setGlobalRepeat={setGlobalRepeat}
                                globalResolution={globalResolution}
                                globalKey={globalKey}
                                globalScale={globalScale}
                                globalIsPlaying={globalIsPlaying}
                                globalCurrentStep={globalCurrentStep}
                                globalCurrentStepRef={globalCurrentStepRef}
                                globalIsPlayingRef={globalIsPlayingRef}
                                globalContinuousProgress={globalContinuousProgress}
                                globalPlayStartTime={globalPlayStartTime}
                                onPatternChange={(pattern) => {
                                    handleDrumPatternChange(pattern);
                                    if (editingDrumClipId) handleDrumPatternChangeForClip(pattern);
                                }}
                                onSampleLoad={handleDrumSampleLoad}
                                onSampleLoadingChange={handleSampleLoadingChange}
                                globalSolos={globalSolos}
                                updateGlobalSolo={updateGlobalSolo}
                                isAnythingSoloed={isAnythingSoloed}
                                onGlobalGenerate={handleGlobalGenerate}
                                onSuggest={() => setShowSuggestionPanel(true)}
                                onAddToArrangement={() => handleAddTrackToArrangement('drums')}
                                isGenerated={isGenerated.drums}
                                setIsGenerated={setDrumIsGenerated}
                                externalPattern={externalPatterns.drums}
                                confirmBeforeClear={appSettings.confirmBeforeClear}
                                onClearExternal={() => setExternalPatterns(prev => ({ ...prev, drums: null }))}
                                onNewProject={handleNewProject}
                                onExportClick={handleExportClick}
                                onLoadClick={() => document.getElementById('project-load-input').click()}
                                onDrumClipGenerated={handleDrumClipGenerated}
                                editingDrumClipId={editingDrumClipId}
                                clipPlaybackActive={drumClips.length > 0}
                            />
                        </TabGuard>
                    </div>

                    <div style={{ display: activeTab === 'chords' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
                        <TabGuard tab="chords" myId={collab.myId} owners={collab.tabOwners} freeForAll={collab.freeForAll} onRequestAccess={(tab) => collab.requestAccess(tab)} permissions={collab.getMyPermissions()}>
                            <ChordGeneratorEnhanced
                                ref={chordsRef}
                                theme={theme}
                                accentColors={accent}
                                selectedFolder={selectedFolder}
                                sampler={samplerRef.current}
                                globalIsPlaying={globalIsPlaying}
                                globalPlayStartTime={globalPlayStartTime}
                                globalCurrentStep={globalCurrentStep}
                                globalCurrentStepRef={globalCurrentStepRef}
                                globalIsPlayingRef={globalIsPlayingRef}
                                globalContinuousProgress={globalContinuousProgress}
                                globalTempo={globalTempo}
                                globalBars={globalBars}
                                setGlobalBars={setGlobalBars}
                                globalRepeat={globalRepeat}
                                setGlobalRepeat={setGlobalRepeat}
                                globalResolution={Math.min(globalResolution, 8)}
                                globalKey={globalKey}
                                globalScale={globalScale}
                                globalGenre={globalGenre}
                                globalMood={globalMood}
                                globalOctave={chordsOctave}
                                setGlobalOctave={setChordsOctave}
                                onPatternChange={(p) => {
                                    setPatterns(prev => ({ ...prev, chords: p }));
                                    if (editingChordClipId) updateChordClip(editingChordClipId, { pattern: p.map(n => ({ ...n })) });
                                }}
                                onStatusChange={(status) => setTrackStatus(prev => ({ ...prev, chords: status }))}
                                externalPattern={externalPatterns.chords}
                                onInstrumentLoad={(id) => {
                                    setLoadedInstruments(prev => ({ ...prev, chords: id }));
                                    setTrackStatus(prev => ({ ...prev, chords: { ...prev.chords, hasSamples: !!id } }));
                                }}
                                onSampleLoadingChange={handleSampleLoadingChange}
                                globalSolos={globalSolos}
                                updateGlobalSolo={updateGlobalSolo}
                                isAnythingSoloed={isAnythingSoloed}
                                globalMutes={globalMutes}
                                setGlobalMutes={setGlobalMutes}
                                onGlobalGenerate={handleGlobalGenerate}
                                onSuggest={() => setShowSuggestionPanel(true)}
                                onAddToArrangement={() => handleAddTrackToArrangement('chords')}
                                isGenerated={isGenerated.chords}
                                setIsGenerated={(val) => setIsGenerated(prev => ({ ...prev, chords: val }))}
                                onNewProject={handleNewProject}
                                onExportClick={handleExportClick}
                                onLoadClick={() => document.getElementById('project-load-input').click()}
                                onLoadSlicedInstrument={handleLoadSlicedInstrument}
                                confirmBeforeClear={appSettings.confirmBeforeClear}
                                onClipGenerated={handleChordClipGenerated}
                                editingClipId={editingChordClipId}
                                clipPlaybackActive={chordClips.length > 0}
                            />
                        </TabGuard>
                    </div>

                    <div style={{ display: activeTab === 'melody' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
                        <TabGuard tab="melody" myId={collab.myId} owners={collab.tabOwners} freeForAll={collab.freeForAll} onRequestAccess={(tab) => collab.requestAccess(tab)} permissions={collab.getMyPermissions()}>
                            <MelodyBassGeneratorEnhanced
                                ref={melodyRef}
                                theme={theme}
                                accentColors={accent}
                                selectedFolder={selectedFolder}
                                sampler={samplerRef.current}
                                globalIsPlaying={globalIsPlaying}
                                globalPlayStartTime={globalPlayStartTime}
                                globalCurrentStep={globalCurrentStep}
                                globalCurrentStepRef={globalCurrentStepRef}
                                globalIsPlayingRef={globalIsPlayingRef}
                                globalContinuousProgress={globalContinuousProgress}
                                globalTempo={globalTempo}
                                globalBars={globalBars}
                                setGlobalBars={setGlobalBars}
                                globalRepeat={globalRepeat}
                                setGlobalRepeat={setGlobalRepeat}
                                globalResolution={globalResolution}
                                globalKey={globalKey}
                                globalScale={globalScale}
                                globalGenre={globalGenre}
                                globalMood={globalMood}
                                globalOctave={melodyOctave}
                                setGlobalOctave={setMelodyOctave}
                                type="melody"
                                onPatternChange={(p) => {
                                    setPatterns(prev => ({ ...prev, melody: p }));
                                    if (editingMelodyClipId) updateMelodyClip(editingMelodyClipId, { pattern: p.map(n => ({ ...n })) });
                                }}
                                onStatusChange={(status) => setTrackStatus(prev => ({ ...prev, melody: status }))}
                                externalPattern={externalPatterns.melody}
                                chordPatternData={patterns.chords}
                                onInstrumentLoad={(id) => {
                                    setLoadedInstruments(prev => ({ ...prev, melody: id }));
                                    setTrackStatus(prev => ({ ...prev, melody: { ...prev.melody, hasSamples: !!id } }));
                                }}
                                onSampleLoadingChange={handleSampleLoadingChange}
                                globalSolos={globalSolos}
                                updateGlobalSolo={updateGlobalSolo}
                                isAnythingSoloed={isAnythingSoloed}
                                globalMutes={globalMutes}
                                setGlobalMutes={setGlobalMutes}
                                onGlobalGenerate={handleGlobalGenerate}
                                onSuggest={() => setShowSuggestionPanel(true)}
                                onAddToArrangement={() => handleAddTrackToArrangement('melody')}
                                isGenerated={isGenerated.melody}
                                setIsGenerated={(val) => setIsGenerated(prev => ({ ...prev, melody: val }))}
                                onNewProject={handleNewProject}
                                onExportClick={handleExportClick}
                                onLoadClick={() => document.getElementById('project-load-input').click()}
                                onLoadSlicedInstrument={handleLoadSlicedInstrument}
                                confirmBeforeClear={appSettings.confirmBeforeClear}
                                onClipGenerated={handleMelodyClipGenerated}
                                editingClipId={editingMelodyClipId}
                                clipPlaybackActive={melodyClips.length > 0}
                            />
                        </TabGuard>
                    </div>

                    <div style={{ display: activeTab === 'bass' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
                        <TabGuard tab="bass" myId={collab.myId} owners={collab.tabOwners} freeForAll={collab.freeForAll} onRequestAccess={(tab) => collab.requestAccess(tab)} permissions={collab.getMyPermissions()}>
                            <MelodyBassGeneratorEnhanced
                                ref={bassRef}
                                theme={theme}
                                accentColors={accent}
                                selectedFolder={selectedFolder}
                                sampler={samplerRef.current}
                                globalIsPlaying={globalIsPlaying}
                                globalPlayStartTime={globalPlayStartTime}
                                globalCurrentStep={globalCurrentStep}
                                globalCurrentStepRef={globalCurrentStepRef}
                                globalIsPlayingRef={globalIsPlayingRef}
                                globalContinuousProgress={globalContinuousProgress}
                                globalTempo={globalTempo}
                                globalBars={globalBars}
                                setGlobalBars={setGlobalBars}
                                globalRepeat={globalRepeat}
                                setGlobalRepeat={setGlobalRepeat}
                                globalResolution={globalResolution}
                                globalKey={globalKey}
                                globalScale={globalScale}
                                globalGenre={globalGenre}
                                globalMood={globalMood}
                                globalOctave={bassOctave}
                                setGlobalOctave={setBassOctave}
                                type="bass"
                                onPatternChange={(p) => {
                                    setPatterns(prev => ({ ...prev, bass: p }));
                                    if (editingBassClipId) updateBassClip(editingBassClipId, { pattern: p.map(n => ({ ...n })) });
                                }}
                                onStatusChange={(status) => setTrackStatus(prev => ({ ...prev, bass: status }))}
                                externalPattern={externalPatterns.bass}
                                chordPatternData={patterns.chords}
                                onInstrumentLoad={(id) => {
                                    setLoadedInstruments(prev => ({ ...prev, bass: id }));
                                    setTrackStatus(prev => ({ ...prev, bass: { ...prev.bass, hasSamples: !!id } }));
                                }}
                                onSampleLoadingChange={handleSampleLoadingChange}
                                globalSolos={globalSolos}
                                updateGlobalSolo={updateGlobalSolo}
                                isAnythingSoloed={isAnythingSoloed}
                                globalMutes={globalMutes}
                                setGlobalMutes={setGlobalMutes}
                                onGlobalGenerate={handleGlobalGenerate}
                                onSuggest={() => setShowSuggestionPanel(true)}
                                onAddToArrangement={() => handleAddTrackToArrangement('bass')}
                                isGenerated={isGenerated.bass}
                                setIsGenerated={(val) => setIsGenerated(prev => ({ ...prev, bass: val }))}
                                onNewProject={handleNewProject}
                                onExportClick={handleExportClick}
                                onLoadClick={() => document.getElementById('project-load-input').click()}
                                onLoadSlicedInstrument={handleLoadSlicedInstrument}
                                confirmBeforeClear={appSettings.confirmBeforeClear}
                                onClipGenerated={handleBassClipGenerated}
                                editingClipId={editingBassClipId}
                                clipPlaybackActive={bassClips.length > 0}
                            />
                        </TabGuard>
                    </div>

                    {/* Lyrics Tab */}
                    <div style={{ display: activeTab === 'lyrics' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
                        <Suspense fallback={<div style={{ padding: '20px', color: isDark ? '#888' : '#666' }}>{t('app.loadingLyrics')}</div>}>
                            <LyricsTab
                                theme={theme}
                                accentColors={accent}
                                globalKey={globalKey}
                                globalScale={globalScale}
                                globalTempo={globalTempo}
                                globalBars={globalBars}
                                melodyNotes={patterns.melody || []}
                                genre={globalGenre}
                                mood={globalMood}
                                importedLyrics={importedLyrics}
                                importedGenre={importedLyricsGenre}
                                importedMood={importedLyricsMood}
                                importedBpm={importedLyricsBpm}
                            />
                        </Suspense>
                    </div>

                    {/* Lyric Engine Tab */}
                    <div style={{ display: activeTab === 'lyricengine' ? 'block' : 'none', height: '100%', overflow: 'hidden' }}>
                        <Suspense fallback={<div style={{ padding: '20px', color: isDark ? '#888' : '#666' }}>{t('app.loadingLyricEngine')}</div>}>
                            <LyricEngineTab
                                theme={theme}
                                accentColors={accent}
                                globalKey={globalKey}
                                globalScale={globalScale}
                                globalTempo={globalTempo}
                                globalBars={globalBars}
                                melodyNotes={patterns.melody || []}
                                genre={globalGenre}
                                mood={globalMood}
                                onSendToLyrics={(text, lyricsGenre, lyricsMood, lyricsBpm) => { setImportedLyrics(text); setImportedLyricsGenre(lyricsGenre || ''); setImportedLyricsMood(lyricsMood || ''); setImportedLyricsBpm(lyricsBpm || 0); setActiveTab('lyrics'); }}
                                onEnterRecordMode={(songData) => {
                                    setRecordModeLyrics(songData);
                                    setIsRecordMode(true);
                                    setIsBrowserVisible(false);
                                    setActiveTab('arrange');
                                    // Add default audio + MIDI track if needed
                                    if (audioTracks.length === 0) addAudioTrack();
                                    if (midiTracks.length === 0) addMidiTrack();
                                }}
                            />
                        </Suspense>
                    </div>

                    {/* Mixer Tab — global mix for pattern editing tabs */}
                    <div style={{ display: activeTab === 'mixer' ? 'flex' : 'none', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>
                        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                            <MixerPanel
                                ref={mixerRef}
                                accentColors={accent}
                                sampler={samplerRef.current}
                                trackMix={trackMix}
                                setTrackMix={setTrackMix}
                                globalMutes={globalMutes}
                                setGlobalMutes={setGlobalMutes}
                                globalSolos={globalSolos}
                                updateGlobalSolo={updateGlobalSolo}
                                isAnythingSoloed={isAnythingSoloed}
                                masterVolume={masterVolume}
                                setMasterVolume={setMasterVolume}
                                isDark={isDark}
                                isVisible={activeTab === 'mixer'}
                                audioTracks={audioTracks}
                                onAddAudioTrack={addAudioTrack}
                                onRemoveAudioTrack={removeAudioTrack}
                                onRenameAudioTrack={renameAudioTrack}
                                onReorderAudioTrack={reorderAudioTrack}
                                midiTracks={midiTracks}
                                onAddMidiTrack={addMidiTrack}
                                onRemoveMidiTrack={removeMidiTrack}
                                onRenameMidiTrack={renameMidiTrack}
                                onReorderMidiTrack={reorderMidiTrack}
                                onEditMidiTrack={setEditingMidiTrack}
                                trackOrder={trackOrder}
                            />
                            {/* Adaptive Mix Engine — adds genre-aware EQ/Comp/Width effects to mixer tracks */}
                            <div style={{ width: 290, minWidth: 290, overflowY: 'auto', borderLeft: '1px solid #2a2a36', padding: 8 }}>
                                <AdaptiveMixPanel
                                    samplerEngine={samplerRef.current}
                                    genre={globalGenre}
                                    mood={globalMood}
                                    effectsManager={effectsManagerRef.current}
                                    onEffectsChanged={() => setEffectsVersion(v => v + 1)}
                                    accentColor={accent.accent || '#6bafff'}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Arrange Tab — includes mini mixer for live mixing during arrangement playback */}
                    <div style={{ display: activeTab === 'arrange' ? 'flex' : 'none', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>
                                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                                    <ArrangementTimeline
                                        arrangement={arr.arrangement}
                                        accentColors={accent}
                                        activeSection={arr.activeSection}
                                        onSelectSection={arr.setActiveSection}
                                        onAddSection={(afterId, patternsOverride, mixOverride) => {
                                            const sectionPatterns = patternsOverride || JSON.parse(JSON.stringify(patterns));
                                            arr.addSection(afterId, { patterns: sectionPatterns, bars: globalBars, mix: mixOverride || captureCurrentMix() });
                                        }}
                                        onRemoveSection={arr.removeSection}
                                        onDuplicateSection={arr.duplicateSection}
                                        onReorderSections={arr.reorderSections}
                                        onUpdateSection={arr.updateSection}
                                        onGenerateSection={handleGenerateSection}
                                        onGenerateSelected={handleGenerateSelected}
                                        onGenerateAll={handleGenerateAllSections}
                                        onGenerateAllMixed={handleGenerateAllMixed}
                                        onDropAudio={handleArrangementDrop}
                                        audioTracks={audioTracks}
                                        onAddAudioTrack={addAudioTrack}
                                        onRemoveAudioTrack={removeAudioTrack}
                                        onRenameAudioTrack={renameAudioTrack}
                                        onUndoAudio={undoAudio}
                                        onRedoAudio={redoAudio}
                                        onAddClip={addClipToTrack}
                                        onUpdateClip={updateClip}
                                        onRemoveClip={removeClip}
                                        globalIsPlaying={globalIsPlaying}
                                        globalCurrentStep={globalCurrentStep}
                                        globalAbsoluteStep={globalAbsoluteStep}
                                        globalTempo={globalTempo}
                                        globalKey={globalKey}
                                        globalScale={globalScale}
                                        globalResolution={globalResolution}
                                        isDark={isDark}
                                        isMaximized={arrangeMaximized}
                                        onToggleMaximize={() => setArrangeMaximized(prev => !prev)}
                                        loopSectionIds={loopSectionIds}
                                        onToggleSectionLoop={toggleSectionLoop}
                                        onClearSectionLoop={clearSectionLoop}
                                        stopMarkerBar={stopMarkerBar}
                                        onSetStopMarkerAtBar={setStopMarkerAtBar}
                                        onToggleStopMarker={toggleStopMarker}
                                        onClearStopMarker={clearStopMarker}
                                        onUndoArrangement={arr.undoArrangement}
                                        onRedoArrangement={arr.redoArrangement}
                                        canUndoArrangement={arr.canUndoArrangement}
                                        canRedoArrangement={arr.canRedoArrangement}
                                        globalMutes={globalMutes}
                                        setGlobalMutes={setGlobalMutes}
                                        globalSolos={globalSolos}
                                        updateGlobalSolo={updateGlobalSolo}
                                        sampler={samplerRef.current}
                                        masterVolume={masterVolume}
                                        setMasterVolume={setMasterVolume}
                                        isRecording={isRecording}
                                        isCountingIn={isCountingIn}
                                        countInBeat={countInBeat}
                                        recordingElapsed={recordingElapsed}
                                        onStartRecording={handleStartRecording}
                                        onStopRecording={handleStopRecording}
                                        recorderRef={recorderRef}
                                        recordingTrackId={recordingTrackId}
                                        recordingStartSection={recordingStartSectionRef.current}
                                        recordingStartBar={recordingStartBarRef.current}
                                        audioInsertionBar={audioInsertionBar}
                                        onSetAudioInsertionBar={setAudioInsertionBar}
                                        audioLoopRange={audioLoopRange}
                                        onSetAudioLoopRange={setAudioLoopRange}
                                        timelineBars={timelineBars}
                                        setTimelineBars={setTimelineBars}
                                        loopRange={loopRange}
                                        onSetLoopRange={setLoopRange}
                                        loopActive={loopActive}
                                        onSetLoopActive={setLoopActive}
                                        previewDrumPattern={patterns.drums}
                                        previewChordPattern={patterns.chords}
                                        previewMelodyPattern={patterns.melody}
                                        previewBassPattern={patterns.bass}
                                        onAddDrumClipFromPreview={(dropBar) => {
                                            const previewBars = globalBars;
                                            const previewSteps = previewBars * 32;
                                            const previewDrums = patterns.drums ? JSON.parse(JSON.stringify(patterns.drums)) : {};
                                            // Check if drop lands inside an existing longer drum clip
                                            const hostClip = drumClipsRef.current.find(c => {
                                                const cStart = c.timelineBar || 0;
                                                const cEnd = cStart + (c.bars || 4);
                                                return dropBar >= cStart && dropBar + previewBars <= cEnd && (c.bars || 4) > previewBars;
                                            });
                                            if (hostClip) {
                                                const offsetSteps = (dropBar - (hostClip.timelineBar || 0)) * 32;
                                                // Splice preview drum pattern into the host clip's drumStates
                                                const merged = JSON.parse(JSON.stringify(hostClip.drumStates || {}));
                                                Object.entries(previewDrums).forEach(([drumId, drum]) => {
                                                    if (!merged[drumId]) merged[drumId] = { powered: drum.powered, lanes: {} };
                                                    Object.entries(drum.lanes || {}).forEach(([laneId, lane]) => {
                                                        if (!merged[drumId].lanes[laneId]) {
                                                            const totalSteps = (hostClip.bars || 4) * 32;
                                                            merged[drumId].lanes[laneId] = {
                                                                pitch: lane.pitch,
                                                                pattern: new Array(totalSteps).fill(false),
                                                                velocity: new Array(totalSteps).fill(0.7),
                                                                duration: new Array(totalSteps).fill(1),
                                                            };
                                                        }
                                                        const target = merged[drumId].lanes[laneId];
                                                        const src = lane;
                                                        for (let i = 0; i < previewSteps && i < (src.pattern || []).length; i++) {
                                                            if (offsetSteps + i < target.pattern.length) {
                                                                target.pattern[offsetSteps + i] = src.pattern[i];
                                                                target.velocity[offsetSteps + i] = (src.velocity || [])[i] ?? 0.7;
                                                                target.duration[offsetSteps + i] = (src.duration || [])[i] ?? 1;
                                                            }
                                                        }
                                                    });
                                                });
                                                updateDrumClip(hostClip.id, { drumStates: merged, color: accent.accent || '#ff6b6b' });
                                                splitDrumStatesIntoLaneClips(merged, hostClip.timelineBar || 0, hostClip.bars || 4);
                                            } else {
                                                addDrumClip({ timelineBar: dropBar, bars: previewBars, drumStates: previewDrums, name: `Drums @${dropBar + 1}` });
                                                splitDrumStatesIntoLaneClips(previewDrums, dropBar, previewBars);
                                            }
                                            { const clipEnd = dropBar + previewBars; if (clipEnd + TIMELINE_CHUNK > timelineBars) setTimelineBars(Math.ceil((clipEnd + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK); }
                                        }}
                                        onAddChordClipFromPreview={(dropBar) => {
                                            const clipBars = 4;
                                            const clipSteps = clipBars * 32;
                                            const basePattern = patterns.chords ? JSON.parse(JSON.stringify(patterns.chords)).filter(n => n.time < clipSteps).map(n => ({ ...n, duration: Math.min(n.duration, clipSteps - n.time) })) : [];
                                            // Check if drop lands inside an existing longer clip — splice into it
                                            const hostClip = chordClipsRef.current.find(c => {
                                                const cStart = c.timelineBar || 0;
                                                const cEnd = cStart + (c.bars || 4);
                                                return dropBar >= cStart && dropBar + clipBars <= cEnd && (c.bars || 4) > clipBars;
                                            });
                                            if (hostClip) {
                                                const offsetSteps = (dropBar - (hostClip.timelineBar || 0)) * 32;
                                                const endSteps = offsetSteps + clipSteps;
                                                // Remove existing notes in the splice region, keep everything else
                                                const kept = (hostClip.pattern || []).filter(n => n.time < offsetSteps || n.time >= endSteps);
                                                // Shift preview notes to the splice offset
                                                const shifted = basePattern.map(n => ({ ...n, time: n.time + offsetSteps }));
                                                updateChordClip(hostClip.id, { pattern: [...kept, ...shifted], color: accent.accent || '#ff6b6b' });
                                            } else {
                                                // Remove fully overlapping clips
                                                setChordClips(prev => prev.filter(c => {
                                                    const cStart = c.timelineBar || 0;
                                                    const cEnd = cStart + (c.bars || 4);
                                                    return cEnd <= dropBar || cStart >= dropBar + clipBars;
                                                }));
                                                addChordClip({ timelineBar: dropBar, bars: clipBars, pattern: basePattern, name: `Chords @${dropBar + 1}` });
                                            }
                                            { const clipEnd = dropBar + clipBars; if (clipEnd + TIMELINE_CHUNK > timelineBars) setTimelineBars(Math.ceil((clipEnd + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK); }
                                        }}
                                        onAddMelodyClipFromPreview={(dropBar) => {
                                            const clipBars = 4;
                                            const clipSteps = clipBars * 32;
                                            const basePattern = patterns.melody ? JSON.parse(JSON.stringify(patterns.melody)).filter(n => n.time < clipSteps).map(n => ({ ...n, duration: Math.min(n.duration, clipSteps - n.time) })) : [];
                                            const hostClip = melodyClipsRef.current.find(c => {
                                                const cStart = c.timelineBar || 0;
                                                const cEnd = cStart + (c.bars || 4);
                                                return dropBar >= cStart && dropBar + clipBars <= cEnd && (c.bars || 4) > clipBars;
                                            });
                                            if (hostClip) {
                                                const offsetSteps = (dropBar - (hostClip.timelineBar || 0)) * 32;
                                                const endSteps = offsetSteps + clipSteps;
                                                const kept = (hostClip.pattern || []).filter(n => n.time < offsetSteps || n.time >= endSteps);
                                                const shifted = basePattern.map(n => ({ ...n, time: n.time + offsetSteps }));
                                                updateMelodyClip(hostClip.id, { pattern: [...kept, ...shifted], color: accent.accent || '#ff6b6b' });
                                            } else {
                                                setMelodyClips(prev => prev.filter(c => {
                                                    const cStart = c.timelineBar || 0;
                                                    const cEnd = cStart + (c.bars || 4);
                                                    return cEnd <= dropBar || cStart >= dropBar + clipBars;
                                                }));
                                                addMelodyClip({ timelineBar: dropBar, bars: clipBars, pattern: basePattern, name: `Melody @${dropBar + 1}` });
                                            }
                                            { const clipEnd = dropBar + clipBars; if (clipEnd + TIMELINE_CHUNK > timelineBars) setTimelineBars(Math.ceil((clipEnd + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK); }
                                        }}
                                        onAddBassClipFromPreview={(dropBar) => {
                                            const clipBars = 4;
                                            const clipSteps = clipBars * 32;
                                            const basePattern = patterns.bass ? JSON.parse(JSON.stringify(patterns.bass)).filter(n => n.time < clipSteps).map(n => ({ ...n, duration: Math.min(n.duration, clipSteps - n.time) })) : [];
                                            const hostClip = bassClipsRef.current.find(c => {
                                                const cStart = c.timelineBar || 0;
                                                const cEnd = cStart + (c.bars || 4);
                                                return dropBar >= cStart && dropBar + clipBars <= cEnd && (c.bars || 4) > clipBars;
                                            });
                                            if (hostClip) {
                                                const offsetSteps = (dropBar - (hostClip.timelineBar || 0)) * 32;
                                                const endSteps = offsetSteps + clipSteps;
                                                const kept = (hostClip.pattern || []).filter(n => n.time < offsetSteps || n.time >= endSteps);
                                                const shifted = basePattern.map(n => ({ ...n, time: n.time + offsetSteps }));
                                                updateBassClip(hostClip.id, { pattern: [...kept, ...shifted], color: accent.accent || '#ff6b6b' });
                                            } else {
                                                setBassClips(prev => prev.filter(c => {
                                                    const cStart = c.timelineBar || 0;
                                                    const cEnd = cStart + (c.bars || 4);
                                                    return cEnd <= dropBar || cStart >= dropBar + clipBars;
                                                }));
                                                addBassClip({ timelineBar: dropBar, bars: clipBars, pattern: basePattern, name: `Bass @${dropBar + 1}` });
                                            }
                                            { const clipEnd = dropBar + clipBars; if (clipEnd + TIMELINE_CHUNK > timelineBars) setTimelineBars(Math.ceil((clipEnd + TIMELINE_CHUNK) / TIMELINE_CHUNK) * TIMELINE_CHUNK); }
                                        }}
                                        onLoadSlicedInstrument={handleLoadSlicedInstrument}
                                        midiTracks={midiTracks}
                                        onAddMidiTrack={addMidiTrack}
                                        onRemoveMidiTrack={removeMidiTrack}
                                        onRenameMidiTrack={renameMidiTrack}
                                        onUpdateMidiTrackInstrument={updateMidiTrackInstrument}
                                        onReorderMidiTrack={reorderMidiTrack}
                                        onReorderAudioTrack={reorderAudioTrack}
                                        trackOrder={trackOrder}
                                        onReorderTrack={reorderTrack}
                                        onMoveTrackToIndex={moveTrackToIndex}
                                        onBounceMidiTrack={handleBounceMidiTrack}
                                        selectedFolder={selectedFolder}
                                        onFocusMidiClip={setFocusedMidiClipTrackId}
                                        vst3Plugins={vst3InitialScanPlugins}
                                        vst3TrackPlugins={vst3TrackPlugins}
                                        onLoadVST3OnTrack={loadVST3OnTrack}
                                        onRemoveVST3FromTrack={removeVST3FromTrack}
                                        onOpenVST3Editor={openVST3Editor}
                                        vst3EditorOpenTracks={vst3EditorOpenTracks}
                                        effectsManager={effectsManagerRef.current}
                                        onEffectsChanged={() => setEffectsVersion(v => v + 1)}
                                        effectsVersion={effectsVersion}
                                        onSelectRow={setArrangeSelectedRow}
                                        onSelectEffectTrackId={setArrangeEffectTrackId}
                                        onUpdateMidiTrackPattern={updateMidiTrackPattern}
                                        onAddMidiClip={addMidiClip}
                                        onUpdateMidiClip={updateMidiClip}
                                        onRemoveMidiClip={removeMidiClip}
                                        onMoveMidiClip={moveMidiClip}
                                        editingMidiClipId={editingMidiClipId}
                                        onSetEditingMidiTrack={setEditingMidiTrack}
                                        onSetEditingMidiClipId={setEditingMidiClipId}
                                        followPlayhead={appSettings.followPlayhead}
                                        trackAutomation={trackAutomation}
                                        onSetTrackAutomation={setTrackAutomation}
                                        globalBarsOptions={[4, 8, 16, 32, 64]}
                                        setGlobalBars={setGlobalBars}
                                        globalRepeat={globalRepeat}
                                        setGlobalRepeat={setGlobalRepeat}
                                        drumClips={drumClips}
                                        onAddDrumClip={addDrumClip}
                                        onUpdateDrumClip={updateDrumClip}
                                        onRemoveDrumClip={removeDrumClip}
                                        onMoveDrumClip={moveDrumClip}
                                        editingDrumClipId={editingDrumClipId}
                                        onSetEditingDrumClipId={setEditingDrumClipId}
                                        drumLaneClips={drumLaneClips}
                                        onAddDrumLaneClip={addDrumLaneClip}
                                        onUpdateDrumLaneClip={updateDrumLaneClip}
                                        onRemoveDrumLaneClip={removeDrumLaneClip}
                                        onMoveDrumLaneClip={moveDrumLaneClip}
                                        chordClips={chordClips}
                                        onAddChordClip={addChordClip}
                                        onUpdateChordClip={updateChordClip}
                                        onRemoveChordClip={removeChordClip}
                                        onMoveChordClip={moveChordClip}
                                        editingChordClipId={editingChordClipId}
                                        onSetEditingChordClipId={setEditingChordClipId}
                                        melodyClips={melodyClips}
                                        onAddMelodyClip={addMelodyClip}
                                        onUpdateMelodyClip={updateMelodyClip}
                                        onRemoveMelodyClip={removeMelodyClip}
                                        onMoveMelodyClip={moveMelodyClip}
                                        editingMelodyClipId={editingMelodyClipId}
                                        onSetEditingMelodyClipId={setEditingMelodyClipId}
                                        bassClips={bassClips}
                                        onAddBassClip={addBassClip}
                                        onUpdateBassClip={updateBassClip}
                                        onRemoveBassClip={removeBassClip}
                                        onMoveBassClip={moveBassClip}
                                        editingBassClipId={editingBassClipId}
                                        onSetEditingBassClipId={setEditingBassClipId}
                                    />
                                </div>
                                {/* Main Mixer toggle bar */}
                                <div
                                    onClick={() => setShowMainMixer(prev => !prev)}
                                    title={showMainMixer ? t('ui.hideMainMixer') : t('ui.showMainMixer')}
                                    style={{
                                        height: '18px', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        cursor: 'pointer', userSelect: 'none',
                                        background: isDark ? '#1a1a24' : '#e8e8f0',
                                        borderTop: `1px solid ${isDark ? 'rgba(30,30,42,0.8)' : 'rgba(208,208,216,0.8)'}`,
                                        color: accent.accent || '#ff6b6b', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px',
                                    }}
                                >
                                    <span style={{ fontSize: '8px' }}>{showMainMixer ? '\u25B2' : '\u25BC'}</span>
                                    <span>MAIN MIX</span>
                                    <span style={{ fontSize: '8px' }}>{showMainMixer ? '\u25B2' : '\u25BC'}</span>
                                </div>
                                {/* Main Mixer — collapsible during arrangement */}
                                {showMainMixer && (
                                    <div style={{
                                        height: '220px', flexShrink: 0,
                                        borderTop: `1px solid ${isDark ? '#1e1e2a' : '#d0d0d8'}`,
                                        display: 'flex', overflow: 'hidden'
                                    }}>
                                        <MixerPanel
                                            accentColors={accent}
                                            sampler={samplerRef.current}
                                            trackMix={trackMix}
                                            setTrackMix={setTrackMix}
                                            globalMutes={globalMutes}
                                            setGlobalMutes={setGlobalMutes}
                                            globalSolos={globalSolos}
                                            updateGlobalSolo={updateGlobalSolo}
                                            isAnythingSoloed={isAnythingSoloed}
                                            masterVolume={masterVolume}
                                            setMasterVolume={setMasterVolume}
                                            isDark={isDark}
                                            isVisible={activeTab === 'arrange'}
                                            audioTracks={audioTracks}
                                            activeSectionId={arr.activeSection}
                                            midiTracks={midiTracks}
                                            onAddMidiTrack={addMidiTrack}
                                            onRemoveMidiTrack={removeMidiTrack}
                                            onRenameMidiTrack={renameMidiTrack}
                                            onReorderMidiTrack={reorderMidiTrack}
                                            onReorderAudioTrack={reorderAudioTrack}
                                            onEditMidiTrack={setEditingMidiTrack}
                                            trackOrder={trackOrder}
                                            idPrefix="arr-"
                                        />
                                    </div>
                                )}
                    </div>

                    {/* Drum Synth Studio Tab */}
                    <div style={{ display: activeTab === 'drumsynth' ? 'flex' : 'none', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>
                        <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: acSec, fontSize: 16, fontWeight: 700, background: isDark ? '#0d0d14' : '#f7f7fa' }}>{t('common.loading')}</div>}>
                            {activeTab === 'drumsynth' && <DrumSynthStudio theme={theme} accentColors={accent} onClose={() => setActiveTab('drums')} />}
                        </Suspense>
                    </div>

                    {/* Instrument Synth Studio Tab */}
                    <div style={{ display: activeTab === 'instrsynth' ? 'flex' : 'none', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>
                        <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: acSec, fontSize: 16, fontWeight: 700, background: isDark ? '#0a0e17' : '#f7f7fa' }}>{t('common.loading')}</div>}>
                            {activeTab === 'instrsynth' && <InstrumentSynthStudio theme={theme} accentColors={accent} onClose={() => setActiveTab('melody')} />}
                        </Suspense>
                    </div>

                </div>

                {/* Footer Status */}
                <div style={{
                    padding: '10px 20px',
                    borderTop: `1px solid ${isDark ? '#2a2a3e' : '#e0e0e0'}`,
                    background: isDark ? '#1a1a1f' : '#fff',
                    fontSize: '11px',
                    color: isDark ? '#888' : '#666',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <strong>{t('app.currentSettings')}:</strong> {globalKey} {globalScale} • {globalGenre} - {globalMood} • {globalTempo} BPM • {globalBars} Bars
                    </div>
                    <div style={{ display: 'flex', gap: '0', alignItems: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        <span>{t('footer.currentSessionTime')}: {timeTracker.sessionFormatted}</span>
                        <span style={{ margin: '0 10px', color: isDark ? '#444' : '#ccc' }}>|</span>
                        <span>{t('footer.collaborationTime')}: {timeTracker.collabFormatted}</span>
                        <span style={{ margin: '0 10px', color: isDark ? '#444' : '#ccc' }}>|</span>
                        <span>{t('footer.totalProjectTime')}: {timeTracker.totalFormatted}</span>
                    </div>
                    <div>
                        {selectedFolder ? `📁 ${selectedFolder.name}` : '💡 Select a folder to load samples'}
                    </div>
                </div>
            </div>

            {/* Collaboration Overlays */}
            <CursorMap mousePositions={collab.mousePositions} showLabels={appSettings.showCursorLabels} />

            {/* Settings Modal */}
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                onSave={(settings) => setAppSettings(settings)}
                isDark={isDark}
                accentColor={ac}
                theme={theme}
                accentTheme={accentTheme}
                onThemeToggle={toggleTheme}
                onAccentChange={(key) => setAccentTheme(key)}
            />
            {
                !collab.isCollapsed && (
                    <CollabPanel
                        collab={collab}
                        theme={theme}
                        onClose={() => collab.setIsCollapsed(true)}
                        addToast={addToast}
                        accentColors={accent}
                    />
                )
            }

            {/* Access Request Notifications */}
            {collab.accessRequests.map((req, idx) => (
                <div key={req.from + req.tab + req.timestamp} style={{
                    position: 'fixed',
                    top: `${100 + idx * 80}px`,
                    right: '20px',
                    width: '300px',
                    background: 'rgba(20, 20, 25, 0.95)',
                    border: `1px solid ${acSec}`,
                    borderRadius: '10px',
                    padding: '15px',
                    zIndex: 1001,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(20px)'
                }}>
                    <div style={{ fontSize: '11px', color: '#fff', marginBottom: '10px' }}>
                        <strong style={{ color: acSec }}>{req.displayName}</strong> is requesting access to <strong style={{ color: ac }}>{req.tab.toUpperCase()}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => collab.respondToAccessRequest(idx, true)}
                            style={{
                                flex: 1, padding: '8px', background: 'rgba(57, 255, 20, 0.15)',
                                border: '1px solid #39ff14', borderRadius: '6px',
                                color: '#39ff14', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            ALLOW
                        </button>
                        <button
                            onClick={() => collab.respondToAccessRequest(idx, false)}
                            style={{
                                flex: 1, padding: '8px', background: 'rgba(255, 75, 75, 0.15)',
                                border: '1px solid #ff4b4b', borderRadius: '6px',
                                color: '#ff4b4b', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            DENY
                        </button>
                    </div>
                </div>
            ))}

            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Onboarding Tour */}
            <OnboardingTour
                isOpen={showTour}
                accentColors={accent}
                onClose={() => setShowTour(false)}
                theme={theme}
                onBrowserVisibility={handleTourBrowserVisibility}
                onTabChange={setActiveTab}
            />

            {/* Project/Export Progress Overlay */}
            {
                isExporting && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2000, backdropFilter: 'blur(8px)'
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '15px' }}>💾</div>
                        <div style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
                            {exportStatusText || t('exportProgress.rendering')}
                        </div>
                        {/* Progress bar */}
                        <div style={{ width: '400px', height: '14px', background: '#222', borderRadius: '7px', overflow: 'hidden', marginBottom: '8px', border: '1px solid #444' }}>
                            <div style={{ width: `${exportProgress}%`, height: '100%', background: acGrad, transition: 'width 0.15s', borderRadius: '7px' }} />
                        </div>
                        {/* Percentage */}
                        <div style={{ color: ac, fontSize: '22px', fontWeight: '900', fontFamily: 'monospace', marginBottom: '12px' }}>
                            {exportProgress.toFixed(2)}%
                        </div>
                        {/* Time elapsed & estimated */}
                        <div style={{ display: 'flex', gap: '30px', marginBottom: '12px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#666', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{t('exportProgress.timeElapsed')}</div>
                                <div style={{ color: '#ccc', fontSize: '16px', fontFamily: 'monospace', fontWeight: '700' }}>
                                    {(() => {
                                        const s = Math.floor(exportTimeElapsed);
                                        const m = Math.floor(s / 60);
                                        return `${m}:${String(s % 60).padStart(2, '0')}`;
                                    })()}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#666', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{t('exportProgress.timeRemaining')}</div>
                                <div style={{ color: exportTimeEstimate != null ? '#2ecc71' : '#666', fontSize: '16px', fontFamily: 'monospace', fontWeight: '700' }}>
                                    {exportTimeEstimate != null ? (() => {
                                        const s = Math.ceil(exportTimeEstimate);
                                        const m = Math.floor(s / 60);
                                        return `~${m}:${String(s % 60).padStart(2, '0')}`;
                                    })() : t('exportProgress.calculating')}
                                </div>
                            </div>
                        </div>
                        {/* Size estimation */}
                        {exportSizeEstimate && (
                            <div style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid #333', marginBottom: '10px', width: '360px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ color: '#888', fontSize: '10px', fontWeight: '700' }}>{t('exportProgress.estimatedOutputSize')}</span>
                                    <span style={{ color: acSec, fontSize: '11px', fontFamily: 'monospace', fontWeight: '700' }}>
                                        {(() => {
                                            const bytes = exportSizeEstimate.total.uncompressed;
                                            if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                                            if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                                            return `${(bytes / 1024).toFixed(0)} KB`;
                                        })()}
                                    </span>
                                </div>
                                {exportSizeEstimate.total.compressed !== exportSizeEstimate.total.uncompressed && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#666', fontSize: '9px' }}>{t('exportProgress.compressedZip')}</span>
                                        <span style={{ color: '#888', fontSize: '10px', fontFamily: 'monospace' }}>
                                            {(() => {
                                                const bytes = exportSizeEstimate.total.compressed;
                                                if (bytes > 1024 * 1024 * 1024) return `~${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                                                if (bytes > 1024 * 1024) return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                                                return `~${(bytes / 1024).toFixed(0)} KB`;
                                            })()}
                                        </span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                                    <span style={{ color: '#666', fontSize: '9px' }}>{t('exportProgress.duration')}</span>
                                    <span style={{ color: '#888', fontSize: '10px', fontFamily: 'monospace' }}>
                                        {Math.floor(exportSizeEstimate.duration / 60)}:{String(Math.floor(exportSizeEstimate.duration % 60)).padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                        )}
                        <div style={{ color: '#555', fontSize: '10px', marginTop: '5px' }}>
                            {t('exportProgress.backgroundMessage')}
                        </div>
                    </div>
                )
            }

            {/* Export Modal */}
            {
                showExportModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, backdropFilter: 'blur(5px)'
                    }} onClick={() => setShowExportModal(false)}>
                        <div style={{
                            background: '#1a1a1f', padding: '25px', borderRadius: '12px',
                            border: '1px solid #333', width: '350px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                        }} onClick={(e) => e.stopPropagation()}>
                            <h3 style={{ marginTop: 0, color: '#fff', marginBottom: '20px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>💾</span> {t('exportModal.title')}
                            </h3>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>{t('exportModal.projectName')}</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px', background: '#0f0f12', border: '1px solid #333',
                                        borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                    placeholder={t('exportModal.projectNamePlaceholder')}
                                />
                            </div>

                            {/* Audio Export Section */}
                            <div style={{ padding: '15px', background: '#222', borderRadius: '8px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '900', color: '#888', marginBottom: '10px', textTransform: 'uppercase' }}>{t('exportModal.audioMidiExport')}</div>

                                <div style={{ marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {[
                                            { key: 'mix', label: t('exportModal.fullMix') },
                                            { key: 'stems', label: t('exportModal.stems') },
                                            ...(arr.arrangementMode && arr.arrangement.length > 0
                                                ? [{ key: 'arrangement', label: t('exportModal.arrangement') }]
                                                : [])
                                        ].map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => setExportSettings({ ...exportSettings, type: opt.key })}
                                                style={{
                                                    flex: 1, padding: '8px',
                                                    background: exportSettings.type === opt.key ? acSec : '#2a2a3e',
                                                    color: exportSettings.type === opt.key ? '#000' : '#fff',
                                                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                    fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px'
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    {['wav', 'mp3'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setExportSettings({ ...exportSettings, format: f })}
                                            style={{
                                                flex: 1, padding: '8px',
                                                background: exportSettings.format === f ? acSec : '#2a2a3e',
                                                color: exportSettings.format === f ? '#000' : '#fff',
                                                border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px'
                                            }}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>

                                {exportSettings.type !== 'arrangement' && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {[4, 8, 16, 32, 64].map(b => (
                                            <button
                                                key={b}
                                                onClick={() => setExportSettings({ ...exportSettings, durationBars: b })}
                                                style={{
                                                    flex: 1, padding: '8px',
                                                    background: exportSettings.durationBars === b ? acSec : '#2a2a3e',
                                                    color: exportSettings.durationBars === b ? '#000' : '#fff',
                                                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                    fontWeight: 'bold', fontSize: '11px',
                                                    minWidth: '48px'
                                                }}
                                            >
                                                {t('exportModal.bars', { count: b })}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {exportSettings.type === 'arrangement' && arr.arrangementMode && (
                                    <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', padding: '8px', background: '#1a1a24', borderRadius: '6px' }}>
                                        {t('exportModal.fullArrangement', { bars: arr.getTotalBars(), seconds: Math.ceil(arr.getTotalBars() * 240 / globalTempo) })}
                                    </div>
                                )}

                                {/* Sample Rate */}
                                <div style={{ marginTop: '15px' }}>
                                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>{t('exportModal.sampleRate')}</div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {[22050, 44100, 48000, 96000].map(sr => (
                                            <button
                                                key={sr}
                                                onClick={() => setExportSettings({ ...exportSettings, sampleRate: sr })}
                                                style={{
                                                    flex: 1, padding: '6px 2px',
                                                    background: exportSettings.sampleRate === sr ? acSec : '#2a2a3e',
                                                    color: exportSettings.sampleRate === sr ? '#000' : '#fff',
                                                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                    fontWeight: 'bold', fontSize: '10px'
                                                }}
                                            >
                                                {sr >= 1000 ? `${sr / 1000}k` : sr}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Bit Depth — WAV only */}
                                {exportSettings.format === 'wav' && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>{t('exportModal.bitDepth')}</div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {[8, 16, 24, 32].map(bd => (
                                                <button
                                                    key={bd}
                                                    onClick={() => setExportSettings({ ...exportSettings, bitDepth: bd })}
                                                    style={{
                                                        flex: 1, padding: '6px 2px',
                                                        background: exportSettings.bitDepth === bd ? acSec : '#2a2a3e',
                                                        color: exportSettings.bitDepth === bd ? '#000' : '#fff',
                                                        border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                        fontWeight: 'bold', fontSize: '10px'
                                                    }}
                                                >
                                                    {bd === 32 ? t('exportModal.bit32Float') : t('exportModal.bitSuffix', { depth: bd })}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Bitrate — MP3 only */}
                                {exportSettings.format === 'mp3' && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>{t('exportModal.bitrateKbps')}</div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {[128, 192, 256, 320].map(br => (
                                                <button
                                                    key={br}
                                                    onClick={() => setExportSettings({ ...exportSettings, bitrate: br })}
                                                    style={{
                                                        flex: 1, padding: '6px 2px',
                                                        background: exportSettings.bitrate === br ? acSec : '#2a2a3e',
                                                        color: exportSettings.bitrate === br ? '#000' : '#fff',
                                                        border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                        fontWeight: 'bold', fontSize: '10px'
                                                    }}
                                                >
                                                    {br}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Filename Preview */}
                                <div style={{ marginTop: '12px', padding: '8px 12px', background: '#0f0f12', borderRadius: '6px', border: '1px solid #333' }}>
                                    <div style={{ fontSize: '9px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>{t('exportModal.outputFilename')}</div>
                                    <div style={{ fontSize: '11px', color: acSec, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                        {exportSettings.type === 'stems'
                                            ? formatStemsZipFilename(projectName || 'Untitled', globalTempo, globalKey, globalScale) + '.zip'
                                            : exportSettings.type === 'arrangement'
                                                ? formatArrangementFilename(projectName || 'Untitled', globalTempo, globalKey, globalScale) + (exportSettings.format === 'mp3' ? '.mp3' : '.wav')
                                                : formatMixFilename(projectName || 'Untitled', globalTempo, globalKey, globalScale) + (exportSettings.format === 'mp3' ? '.mp3' : '.wav')
                                        }
                                    </div>
                                </div>

                                {/* Estimated size preview */}
                                {exporterRef.current && (() => {
                                    const est = exporterRef.current.estimateExportSizes({
                                        format: exportSettings.format, sampleRate: exportSettings.sampleRate,
                                        bitrate: exportSettings.bitrate, bitDepth: exportSettings.bitDepth,
                                        tempo: globalTempo, bars: exportSettings.durationBars,
                                        type: exportSettings.type, tracks: patterns,
                                        arrangement: arr.arrangementMode ? arr.arrangement : null, audioTracks
                                    });
                                    const fmtSize = (b) => b > 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
                                    return (
                                        <div style={{ marginTop: '8px', padding: '8px 12px', background: '#0f0f12', borderRadius: '6px', border: '1px solid #333' }}>
                                            <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '3px' }}>{t('exportModal.estimatedOutput')}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#888', fontSize: '10px' }}>{t('exportModal.size')}</span>
                                                <span style={{ color: acSec, fontSize: '10px', fontFamily: 'monospace', fontWeight: '700' }}>{fmtSize(est.total.uncompressed)}</span>
                                            </div>
                                            {est.total.compressed !== est.total.uncompressed && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: '#666', fontSize: '9px' }}>{t('exportProgress.compressedZip')}</span>
                                                    <span style={{ color: '#888', fontSize: '10px', fontFamily: 'monospace' }}>~{fmtSize(est.total.compressed)}</span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#666', fontSize: '9px' }}>{t('exportProgress.duration')}</span>
                                                <span style={{ color: '#888', fontSize: '10px', fontFamily: 'monospace' }}>
                                                    {Math.floor(est.duration / 60)}:{String(Math.floor(est.duration % 60)).padStart(2, '0')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <button
                                    onClick={confirmExport}
                                    disabled={isExporting}
                                    style={{
                                        width: '100%', marginTop: '15px', padding: '10px',
                                        background: isExporting ? '#555' : acGrad,
                                        border: 'none', borderRadius: '6px',
                                        color: '#fff', cursor: isExporting ? 'wait' : 'pointer',
                                        fontWeight: '900', fontSize: '12px',
                                        boxShadow: `0 2px 10px ${hexToRgba(ac, 0.2)}`
                                    }}
                                >
                                    {isExporting ? t('exportModal.renderingButton') : t('exportModal.exportButton')}
                                </button>
                            </div>


                            {/* Project Save Section */}
                            <div style={{ padding: '15px', background: '#222', borderRadius: '8px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '900', color: '#888', marginBottom: '10px', textTransform: 'uppercase' }}>{t('exportModal.projectFile')}</div>
                                <button
                                    onClick={handleSaveProject}
                                    disabled={isExporting}
                                    style={{
                                        width: '100%', padding: '10px',
                                        background: isExporting ? '#555' : '#4facfe',
                                        border: 'none', borderRadius: '6px',
                                        color: '#fff', cursor: isExporting ? 'wait' : 'pointer',
                                        fontWeight: 'bold', fontSize: '12px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    <span>💾</span> {t('exportModal.saveProjectBundle')}
                                </button>
                                <div style={{ fontSize: '9px', color: '#666', marginTop: '5px', textAlign: 'center' }}>
                                    {t('exportModal.savesDescription')}
                                </div>
                            </div>

                            <button
                                onClick={() => setShowExportModal(false)}
                                style={{
                                    marginTop: '20px', width: '100%', padding: '10px', background: 'transparent',
                                    border: '1px solid #444', borderRadius: '6px',
                                    color: '#888', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px'
                                }}
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Shortcuts Overlay Modal */}
            {showShortcutsPanel && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2500, backdropFilter: 'blur(5px)'
                }} onClick={() => setShowShortcutsPanel(false)}>
                    <div style={{
                        background: isDark ? '#1a1a1f' : '#fff',
                        padding: '30px',
                        borderRadius: '12px',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        width: '780px',
                        maxWidth: '95vw',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>

                        <button
                            onClick={() => setShowShortcutsPanel(false)}
                            style={{
                                position: 'absolute', top: '15px', right: '15px',
                                background: 'transparent', border: 'none',
                                color: isDark ? '#aaa' : '#555', fontSize: '18px', cursor: 'pointer'
                            }}
                        >✕</button>

                        <h3 style={{ marginTop: 0, color: isDark ? '#fff' : '#000', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: ac }}>⌨</span> {t('shortcuts.title')}
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px 35px' }}>

                            {/* Column 1 — Navigation & UI */}
                            <div>
                                <h4 style={{ color: ac, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '5px' }}>{t('shortcuts.navigationUI')}</h4>

                                <ShortcutRow keys={['1-9']} action={t('shortcuts.switchTabs')} isDark={isDark} />
                                <ShortcutRow keys={['[', ']']} action={t('shortcuts.prevNextTab')} isDark={isDark} />
                                <ShortcutRow keys={['F']} action={t('shortcuts.toggleFullscreen')} isDark={isDark} />
                                <ShortcutRow keys={['?']} action={t('shortcuts.showShortcuts')} isDark={isDark} />
                            </div>

                            {/* Column 2 — Playback & Engine */}
                            <div>
                                <h4 style={{ color: ac, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '5px' }}>{t('shortcuts.playbackEngine')}</h4>

                                <ShortcutRow keys={['Space']} action={t('shortcuts.playStop')} isDark={isDark} />
                                <ShortcutRow keys={['G']} action={t('shortcuts.globalGenerate')} isDark={isDark} />
                                <ShortcutRow keys={['+', '-']} action={t('shortcuts.tempoAdjust')} isDark={isDark} />
                                <ShortcutRow keys={['T']} action={t('shortcuts.tapTempo')} isDark={isDark} />
                                <ShortcutRow keys={['K']} action={t('shortcuts.toggleMetronome')} isDark={isDark} />
                                <ShortcutRow keys={['R']} action={t('shortcuts.toggleRecording')} isDark={isDark} />
                                <ShortcutRow keys={['C']} action={t('shortcuts.newTake')} isDark={isDark} />
                            </div>

                            {/* Column 1 — Project Actions */}
                            <div>
                                <h4 style={{ color: ac, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '5px' }}>{t('shortcuts.projectActions')}</h4>

                                <ShortcutRow keys={['Ctrl', 'N']} action={t('shortcuts.newProject')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'S']} action={t('shortcuts.saveProject')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'E']} action={t('shortcuts.exportAudio')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'Z']} action={t('shortcuts.undoChange')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'Shift', 'Z']} action={t('shortcuts.redoChange')} isDark={isDark} />
                            </div>

                            {/* Column 2 — Editing */}
                            <div>
                                <h4 style={{ color: ac, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '5px' }}>{t('shortcuts.editing')}</h4>

                                <ShortcutRow keys={['M']} action={t('shortcuts.toggleMasterMute')} isDark={isDark} />
                                <ShortcutRow keys={['S']} action={t('shortcuts.soloActiveTab')} isDark={isDark} />
                                <ShortcutRow keys={['Del']} action={t('shortcuts.deleteSelected')} isDark={isDark} />
                                <ShortcutRow keys={['↑', '↓']} action={t('shortcuts.transposeSemitone')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', '↑/↓']} action={t('shortcuts.transposeOctave')} isDark={isDark} />
                                <ShortcutRow keys={['←', '→']} action={t('shortcuts.nudgeNotes')} isDark={isDark} />
                                <ShortcutRow keys={['Esc']} action={t('shortcuts.clearSelection')} isDark={isDark} />
                            </div>

                            {/* Column 1 — Piano Roll */}
                            <div>
                                <h4 style={{ color: ac, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '5px' }}>{t('shortcuts.pianoRoll')}</h4>

                                <ShortcutRow keys={['Ctrl', 'Click']} action={t('shortcuts.selectMultiple')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'Drag']} action={t('shortcuts.selectionBox')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'A']} action={t('shortcuts.selectAll')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'C']} action={t('shortcuts.copyNotes')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'V']} action={t('shortcuts.pasteNotes')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'X']} action={t('shortcuts.cutNotes')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', 'D']} action={t('shortcuts.duplicateNotes')} isDark={isDark} />
                                <ShortcutRow keys={['Ctrl', '2/4/6/8']} action={t('shortcuts.splitNote')} isDark={isDark} />
                            </div>

                            {/* Column 2 — Arrangement */}
                            <div>
                                <h4 style={{ color: ac, fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '5px' }}>{t('shortcuts.arrangement')}</h4>

                                <ShortcutRow keys={['Ctrl', 'Click']} action={t('shortcuts.selectParts')} isDark={isDark} />
                                <ShortcutRow keys={['Shift', 'S']} action={t('shortcuts.swapParts')} isDark={isDark} />
                                <ShortcutRow keys={['Shift', 'L']} action={t('shortcuts.toggleLoop')} isDark={isDark} />
                                <ShortcutRow keys={['Shift', '→']} action={t('shortcuts.extendLoopNext')} isDark={isDark} />
                                <ShortcutRow keys={['Shift', '←']} action={t('shortcuts.extendLoopPrev')} isDark={isDark} />
                                <ShortcutRow keys={['Shift', 'Click']} action={t('shortcuts.toggleSectionLoop')} isDark={isDark} />
                                <ShortcutRow keys={['Shift', 'P']} action={t('shortcuts.toggleStopMarker')} isDark={isDark} />
                            </div>

                            {/* Take Tour Button */}
                            <div style={{ gridColumn: '1 / -1', marginTop: '10px', paddingTop: '15px', borderTop: `1px solid ${isDark ? '#333' : '#eee'}`, textAlign: 'center' }}>
                                <button
                                    onClick={() => {
                                        setShowShortcutsPanel(false);
                                        resetTour();
                                        setTimeout(() => setShowTour(true), 300);
                                    }}
                                    style={{
                                        padding: '10px 24px',
                                        background: isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.08),
                                        border: `1px solid ${hexToRgba(ac, 0.3)}`,
                                        borderRadius: '8px',
                                        color: ac,
                                        fontSize: '11px',
                                        fontWeight: '900',
                                        cursor: 'pointer',
                                        letterSpacing: '0.5px',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(ac, 0.2); }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.08); }}
                                >
                                    🎓 {t('shortcuts.takeGuidedTour')}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Input for Project Loading */}
            <input
                type="file"
                id="project-load-input"
                accept=".wlz"
                style={{ display: 'none' }}
                onChange={handleLoadProjectInput}
            />

            {/* Effects Rack Modal */}
            {showEffectsRack && effectsManagerRef.current && (
                <EffectsRack
                    effectsManager={effectsManagerRef.current}
                    accentColors={accent}
                    sampler={samplerRef.current}
                    onClose={() => setShowEffectsRack(false)}
                    isDark={isDark}
                    onEffectsChanged={() => setEffectsVersion(v => v + 1)}
                    isPlaying={globalIsPlaying}
                    onTogglePlayback={() => setGlobalIsPlaying(prev => !prev)}
                    audioTracks={audioTracks}
                    midiTracks={midiTracks}
                    tempo={globalTempo}
                />
            )}

            {/* MIDI Track Editor Modal */}
            {editingMidiTrack && (() => {
                const mt = midiTracks.find(t => t.id === editingMidiTrack);
                if (!mt) return null;
                // Find the specific clip being edited (if any)
                const editClip = editingMidiClipId ? (mt.clips || []).find(c => c.id === editingMidiClipId) : null;
                return (
                    <MidiTrackEditor
                        track={mt}
                        clip={editClip}
                        sampler={samplerRef.current}
                        theme={theme}
                        globalKey={globalKey}
                        globalScale={globalScale}
                        globalTempo={globalTempo}
                        globalBars={editClip ? editClip.bars : globalBars}
                        globalResolution={globalResolution}
                        globalCurrentStep={globalCurrentStep}
                        globalPlayStartTime={globalPlayStartTime}
                        globalMutes={globalMutes}
                        globalSolos={globalSolos}
                        setGlobalMutes={setGlobalMutes}
                        updateGlobalSolo={updateGlobalSolo}
                        isAnythingSoloed={isAnythingSoloed}
                        selectedFolder={selectedFolder}
                        onPatternChange={(trackId, newPattern) => {
                            if (editClip) {
                                updateMidiClip(trackId, editClip.id, { pattern: newPattern });
                            } else {
                                updateMidiTrackPattern(trackId, newPattern);
                            }
                        }}
                        onInstrumentChange={updateMidiTrackInstrument}
                        onOctaveChange={updateMidiTrackOctave}
                        onRename={renameMidiTrack}
                        onRemove={removeMidiTrack}
                        onBounce={handleBounceMidiTrack}
                        onClose={() => { setEditingMidiTrack(null); setEditingMidiClipId(null); }}
                        onSampleLoadingChange={handleSampleLoadingChange}
                        accentColors={accent}
                        isDark={isDark}
                    />
                );
            })()}

            {/* Mobile Link Modal */}
            <MobileLinkModal
                isOpen={showMobileLinkModal}
                onClose={() => setShowMobileLinkModal(false)}
                sessionUrl={mobileLink.sessionUrl}
                clients={mobileLink.clients}
                isActive={mobileLink.isActive}
                onActivate={mobileLink.activate}
                onDeactivate={mobileLink.deactivate}
                onDisconnectClient={mobileLink.disconnectClient}
                desktopMuted={mobileLink.desktopMuted}
                onToggleDesktopMute={() => mobileLink.setDesktopMuted(!mobileLink.desktopMuted)}
                isDark={isDark}
                ac={ac}
                hexToRgba={hexToRgba}
            />

            {/* Suggestion Panel */}
            <SuggestionPanel
                isOpen={showSuggestionPanel}
                accentColors={accent}
                onClose={() => setShowSuggestionPanel(false)}
                isDark={isDark}
                globalKey={globalKey}
                globalScale={globalScale}
                globalGenre={globalGenre}
                globalMood={globalMood}
                globalBars={globalBars}
                globalTempo={globalTempo}
                humanizeParams={humanizeParams}
                onApply={handleApplySuggestion}
                onApplyMixed={handleApplyMixedSuggestion}
            />

            {/* Synth studios are now rendered as tabs above — legacy floating modals removed */}
        </div >
    );
};

// Helper component for Shortcut overlay
const ShortcutRow = ({ keys, action, isDark }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: isDark ? '#ccc' : '#444', fontSize: '12px' }}>{action}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
            {keys.map((k, i) => (
                <kbd key={i} style={{
                    background: isDark ? '#2a2a35' : '#f5f5f5',
                    border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                    borderBottom: `2px solid ${isDark ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    color: isDark ? '#fff' : '#000',
                    fontFamily: 'monospace'
                }}>
                    {k}
                </kbd>
            ))}
        </div>
    </div>
);

export default WavLoomAppComplete;
