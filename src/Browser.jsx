import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import WaveformCanvas from './WaveformCanvas';
import MIDIParser from './MIDIParser';
import { MidiPreviewSynth } from './MidiPreviewSynth';
import { hexToRgba } from './accentThemes';
import PresetBrowser from './PresetBrowser';
import SavePresetDialog from './SavePresetDialog';
import { EFFECT_CATEGORIES } from './effects/effectRegistry.js';
import { CATEGORY_ICONS } from './effects/effectParamDefs.js';
import { useTranslation } from './i18n/I18nContext.jsx';
import { getFileFromItem } from './getFileFromItem.js';

const MidiPreviewCanvas = ({ midiData, height, color, theme }) => {
    const canvasRef = useRef(null);
    const isDark = theme === 'dark';

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !midiData) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, width, h);

        const notes = midiData.notesInSteps || [];
        if (notes.length === 0) return;

        const minNote = Math.min(...notes.map(n => n.note));
        const maxNote = Math.max(...notes.map(n => n.note));
        const range = Math.max(12, maxNote - minNote + 2);
        const maxStep = Math.max(...notes.map(n => n.step + n.duration));

        const padding = 5;
        const usableH = h - (padding * 2);
        const usableW = width - (padding * 2);

        notes.forEach(note => {
            const x = padding + (note.step / maxStep) * usableW;
            const y = padding + (1 - (note.note - minNote) / range) * usableH;
            const w = (note.duration / maxStep) * usableW;
            const rowH = usableH / range;

            ctx.fillStyle = color || (isDark ? '#39ff14' : '#000');
            ctx.fillRect(x, y, Math.max(2, w), Math.max(2, rowH - 1));
        });
    }, [midiData, height, color, theme]);

    return <canvas ref={canvasRef} width={300} height={height} style={{ width: '100%', height: `${height}px`, display: 'block' }} />;
};

const Browser = ({ theme, tempo, bars, currentKey, currentScale, globalIsPlaying, onStopGeneratorPlayback, onFolderSelect, onFileSelect, onGenerateFromFolder, onRemoveFolder, onExtractMIDI, onPreview, onAddToFileSlot, selectedFile, accentColors, presetManager, onSavePreset, onLoadPreset, currentGenre, currentMood, vst3InitialScanDone, vst3InitialScanPlugins, onVst3PluginDoubleClick, onAddEffectToTrack}) => {
    const { t } = useTranslation();

    // Accent colors with fallback
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';


    const isDark = theme === 'dark';
    const [folders, setFolders] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState({});
    const [folderFiles, setFolderFiles] = useState({}); // Map folderName -> files[]
    // Expose folderFiles globally so arrangement bounce can search for matching MIDI
    useEffect(() => {
        window.__wavloomFolderFiles = folderFiles;
        return () => { window.__wavloomFolderFiles = null; };
    }, [folderFiles]);
    const [searchQuery, setSearchQuery] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [extractProgress, setExtractProgress] = useState(0);
    const [batchExtractState, setBatchExtractState] = useState(null); // { current, total, fileName }
    const batchExtractAbortRef = useRef(null);
    const [navActiveKey, setNavActiveKey] = useState(null); // Keyboard nav active item

    // Rapid-navigation: debounce timer + generation counter to cancel stale async chains
    const navPlayDebounceRef = useRef(null);
    const playGenRef = useRef(0);
    const pendingNavFileRef = useRef(null); // File waiting to play on keyup

    // Abort controllers for cancellable operations
    const analyzeAbortRef = useRef(null);
    const scanAbortRef = useRef(null);
    const folderInputRef = useRef(null); // Fallback <input webkitdirectory> for non-secure contexts

    // ===== Tab & Factory Samples State =====
    const [explorerTab, setExplorerTab] = useState('local');
    const [showPresetBrowser, setShowPresetBrowser] = useState(false);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [factoryFolders, setFactoryFolders] = useState([]);
    const [factoryLoading, setFactoryLoading] = useState(false);
    const [factoryLoadProgress, setFactoryLoadProgress] = useState({ loaded: 0, total: 0, currentFile: '', status: '' });
    const [factoryLoaded, setFactoryLoaded] = useState(false);
    const [factoryExpanded, setFactoryExpanded] = useState({});

    // ===== VST3 Plugin Browser State =====
    const [vst3Plugins, setVst3Plugins] = useState([]);
    const [vst3Scanning, setVst3Scanning] = useState(false);
    const [vst3ScanProgress, setVst3ScanProgress] = useState({ scanned: 0, total: 0, percent: 0, percentStr: '0.00%', currentFile: '', done: false });
    const [vst3CategoryExpanded, setVst3CategoryExpanded] = useState({});
    const [vst3CustomPaths, setVst3CustomPaths] = useState(['', '', '']);
    const [vst3SearchQuery, setVst3SearchQuery] = useState('');
    const [vst3Loaded, setVst3Loaded] = useState(false);
    const [selectedVst3PluginUid, setSelectedVst3PluginUid] = useState(null);

    // ===== Built-in Audio Effects Browser State =====
    const [builtinSections, setBuiltinSections] = useState({ audioEffects: false, midiEffects: false });
    const [builtinCatExpanded, setBuiltinCatExpanded] = useState({});

    const toggleBuiltinSection = useCallback((key) => {
        setBuiltinSections(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);
    const toggleBuiltinCat = useCallback((catName) => {
        setBuiltinCatExpanded(prev => ({ ...prev, [catName]: !prev[catName] }));
    }, []);

    // Load VST3 custom paths and cached results when plugins tab first opens
    useEffect(() => {
        if (explorerTab === 'plugins' && !vst3Loaded) {
            // If initial scan already provided plugins, use those
            if (vst3InitialScanPlugins && vst3InitialScanPlugins.length > 0) {
                setVst3Plugins(vst3InitialScanPlugins);
                setVst3Loaded(true);
            }

            if (window.electronAPI?.vst3) {
                // Load saved custom paths
                window.electronAPI.vst3.getCustomPaths().then(paths => {
                    if (Array.isArray(paths)) {
                        setVst3CustomPaths([paths[0] || '', paths[1] || '', paths[2] || '']);
                    }
                }).catch(() => {});

                // Try loading from cache if no initial scan plugins yet
                if (!vst3InitialScanPlugins || vst3InitialScanPlugins.length === 0) {
                    window.electronAPI.vst3.getCache().then(cache => {
                        if (cache && cache.plugins && cache.plugins.length > 0) {
                            setVst3Plugins(cache.plugins);
                            setVst3Loaded(true);
                        }
                    }).catch(() => {});
                }
            }
        }
    }, [explorerTab, vst3InitialScanPlugins]);

    // Global click listener to dismiss context menu
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (contextMenu) {
                setContextMenu(null);
            }
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [contextMenu]);

    // Handle global 'stopAllAudio' event
    useEffect(() => {
        const handleStopAudio = () => {
            if (window.audioEngine) window.audioEngine.stop();
            if (midiSynthRef.current) midiSynthRef.current.stop();
            if (midiProgressRef.current) { clearInterval(midiProgressRef.current); midiProgressRef.current = null; }
            setIsPlaying(false);
            setIsMidiPlaying(false);
            setMidiPreviewData(null);
        };
        window.addEventListener('stopAllAudio', handleStopAudio);
        return () => window.removeEventListener('stopAllAudio', handleStopAudio);
    }, []);

    // Stop explorer playback when generator playback starts
    useEffect(() => {
        if (globalIsPlaying) {
            if (window.audioEngine) window.audioEngine.stop();
            if (midiSynthRef.current) midiSynthRef.current.stop();
            if (midiProgressRef.current) { clearInterval(midiProgressRef.current); midiProgressRef.current = null; }
            setIsPlaying(false);
            setIsMidiPlaying(false);
        }
    }, [globalIsPlaying]);

    const extractMetadataFromFilename = (name) => {
        const metadata = {};
        if (!name) return metadata;

        // BPM: Match numbers followed by BPM, or numbers in common BPM range (60-200)
        console.log(`[MetadataExtractor V3] Parsing name: "${name}"`);
        const bpmMatch = name.match(/(\d{2,3})\s*(?:BPM|bpm)/i) || name.match(/[-\s]_?(60|7\d|8\d|9\d|1[0-9]\d|200)(?!\d)/);
        if (bpmMatch) {
            metadata.tempo = parseInt(bpmMatch[1]);
            console.log(`[MetadataExtractor] Filename BPM -> ${metadata.tempo}`);
        }

        // Key/Scale: Match common formats like "C Minor", "A# Maj", "Dmin", "E Major"
        const keyNames = 'C|C#|Db|D|D#|Eb|E|F|F#|Gb|G|G#|Ab|A|A#|Bb|B';
        const keyRegex = new RegExp(`\\b(${keyNames})\\s*(Minor|Major|Min|Maj|m|M)?\\b`, 'i');
        const keyMatch = name.match(keyRegex);

        if (keyMatch) {
            metadata.likelyKey = keyMatch[1].toUpperCase();
            const scalePart = (keyMatch[2] || '').toLowerCase();
            if (scalePart.includes('min') || scalePart === 'm') metadata.likelyScale = 'Minor';
            else if (scalePart.includes('maj')) metadata.likelyScale = 'Major';
            else metadata.likelyScale = 'Minor'; // Default for many modern genres if unspecified
        }

        // Genre/Mood hints
        if (name.toLowerCase().includes('trap')) metadata.genre = 'TRAP';
        if (name.toLowerCase().includes('dark')) metadata.mood = 'DARK';

        return metadata;
    };

    // Calculate the smallest valid bar count that fits a duration at a given tempo
    const calcRequiredBars = (durationSeconds, bpm) => {
        const barDuration = 240 / bpm; // 4 beats per bar
        const rawBars = Math.ceil(durationSeconds / barDuration);
        for (const b of [4, 8, 16, 32, 64]) {
            if (b >= rawBars) return b;
        }
        return 64;
    };

    const filterExactPattern = (pattern, type, _unused, overrideTotalSteps) => {
        const totalSteps = overrideTotalSteps || (bars || 4) * 32;

        if (type === 'melody' || type === 'bass') {
            // "Top-Line" (Highest Priority) or "Bottom-Line" (Lowest Priority) Monophony
            // This prevents long sustaining notes from being cut by lower background notes.
            const grid = Array(totalSteps).fill(null);

            (pattern || []).forEach(n => {
                const startTime = Math.round(n.time);
                const duration = Math.round(n.duration);
                const endTime = Math.min(totalSteps, startTime + duration);
                const vel = n.velocity !== undefined ? n.velocity : 0.8;

                if (vel < 0.1) return;

                for (let st = startTime; st < endTime; st++) {
                    if (st < 0 || st >= totalSteps) continue;
                    if (grid[st] === null) {
                        grid[st] = { note: n.note, velocity: vel };
                    } else {
                        if (type === 'melody') {
                            // Highest note priority
                            if (n.note > grid[st].note) grid[st] = { note: n.note, velocity: vel };
                        } else {
                            // Lowest note priority
                            if (n.note < grid[st].note) grid[st] = { note: n.note, velocity: vel };
                        }
                    }
                }
            });

            const result = [];
            let currentNote = null;
            let startT = 0;

            for (let st = 0; st <= totalSteps; st++) {
                const step = st < totalSteps ? grid[st] : null;

                if (currentNote === null) {
                    if (step) {
                        currentNote = step;
                        startT = st;
                    }
                } else {
                    if (!step || step.note !== currentNote.note) {
                        result.push({
                            time: startT,
                            duration: st - startT,
                            note: currentNote.note,
                            velocity: currentNote.velocity
                        });
                        currentNote = step;
                        startT = st;
                    }
                }
            }
            return result;
        }

        // Chords: Group by time step and keep top 4
        const timeGroups = {};
        (pattern || []).forEach(n => {
            const ts = Math.round(n.time);
            if (n.velocity < 0.1) return;
            if (!timeGroups[ts]) timeGroups[ts] = [];
            timeGroups[ts].push({ ...n, time: ts });
        });

        let finalPattern = [];
        Object.values(timeGroups).forEach(group => {
            group.sort((a, b) => a.note - b.note);
            // For chords, keep up to 4 highest starting at this time
            finalPattern.push(...group.slice(-4));
        });

        const sortedChords = finalPattern
            .filter(n => n.time < totalSteps)
            .map(n => ({
                ...n,
                velocity: n.velocity !== undefined ? n.velocity : 0.8,
                duration: Math.max(1, Math.round(n.duration))
            })).sort((a, b) => a.time - b.time || a.note - b.note);

        // MERGE PASS for Chords: Join adjacent notes on same pitch
        const mergedChords = [];
        const activeByPitch = {}; // pitch -> note

        sortedChords.forEach(next => {
            const current = activeByPitch[next.note];
            if (current && (current.time + current.duration >= next.time)) {
                // Join them
                const newDuration = Math.max(current.duration, (next.time - current.time) + next.duration);
                current.duration = newDuration;
            } else {
                const newNote = { ...next };
                mergedChords.push(newNote);
                activeByPitch[next.note] = newNote;
            }
        });

        return mergedChords;
    };

    const handleExtractMIDI = async (item, targetStr) => {
        console.log("--- WavLoom Browser V3 (FORCE_RELOAD CHECK) ---");
        if (!onExtractMIDI) return;

        setContextMenu(null);

        // Stop all playback before extraction
        if (window.audioEngine) window.audioEngine.stop();
        if (window.sequencer) window.sequencer.stop();
        if (midiSynthRef.current) midiSynthRef.current.stop();
        if (midiProgressRef.current) { clearInterval(midiProgressRef.current); midiProgressRef.current = null; }
        setIsPlaying(false);
        setIsMidiPlaying(false);

        setIsAnalyzing(true);
        setExtractProgress(0);

        try {
            const filenameMetadata = extractMetadataFromFilename(item.name);

            if (item.type === 'midi') {
                // For MIDI: Parse pattern data directly from file
                const file = await getFileFromItem(item);
                const arrayBuffer = await file.arrayBuffer();

                const { MIDIParser } = await import('./MIDIParser');
                const parser = new MIDIParser();
                const midiData = await parser.parseMIDIFile(arrayBuffer);

                // Combine all tracks into one note list
                const allNotes = [];
                midiData.tracks.forEach(track => {
                    const notes = parser.eventsToNotes(track.events);
                    allNotes.push(...notes);
                });

                const midiTempo = filenameMetadata.tempo || 120;
                const analysis = parser.analyzePattern(allNotes, midiTempo);
                const finalMetadata = { ...analysis, ...filenameMetadata };

                // Convert ticks to step format (time in 32nd steps, velocity 0-1)
                const stepNotes = parser.convertToStepFormat(allNotes);

                // Calculate required bars from MIDI duration
                const tpb = midiData.ticksPerBeat || 480;
                const maxTick = allNotes.length > 0 ? Math.max(...allNotes.map(n => n.startTick + n.duration)) : 0;
                const midiDurationSec = maxTick * (60 / midiTempo) / tpb;
                const midiRequiredBars = calcRequiredBars(midiDurationSec, midiTempo);
                const midiTotalSteps = midiRequiredBars * 32;
                finalMetadata.requiredBars = midiRequiredBars;

                if (targetStr === 'all') {
                    const extractedPatterns = parser.splitByRole(stepNotes);
                    onExtractMIDI({
                        patterns: {
                            melody: filterExactPattern(extractedPatterns.melody, 'melody', false, midiTotalSteps),
                            bass: filterExactPattern(extractedPatterns.bass, 'bass', false, midiTotalSteps),
                            chords: filterExactPattern(extractedPatterns.chords, 'chords', false, midiTotalSteps)
                        },
                        metadata: finalMetadata
                    }, 'all');
                } else {
                    const filtered = filterExactPattern(stepNotes, targetStr, false, midiTotalSteps);
                    onExtractMIDI({ patterns: filtered, metadata: finalMetadata }, targetStr);
                }
            } else if (item.type === 'audio') {
                // For Audio: Analyze directly and pass resulting pattern
                const file = await getFileFromItem(item);

                // --- EXACT MIDI MATCHING OVERRIDE ---
                const baseName = file.name.replace(/\.[^/.]+$/, "");
                let exactMidiItem = null;

                // Recursively search folder tree for a matching MIDI file
                const findMidiInTree = (items) => {
                    for (const f of (items || [])) {
                        if (f.kind === 'directory') {
                            const found = findMidiInTree(f.children);
                            if (found) return found;
                        } else if (f.type === 'midi') {
                            const fBase = f.name.replace(/\.[^/.]+$/, "");
                            if (fBase === baseName) return f;
                        }
                    }
                    return null;
                };
                for (const files of Object.values(folderFiles)) {
                    exactMidiItem = findMidiInTree(files);
                    if (exactMidiItem) break;
                }

                if (exactMidiItem) {
                    console.log(`[Extract] Found local matching MIDI (${exactMidiItem.name}) for audio (${file.name}). Bypassing audio analysis.`);
                    const midiFile = await getFileFromItem(exactMidiItem);
                    const arrayBuffer = await midiFile.arrayBuffer();

                    const { MIDIParser } = await import('./MIDIParser');
                    const parser = new MIDIParser();
                    const midiData = await parser.parseMIDIFile(arrayBuffer);

                    const allNotes = [];
                    midiData.tracks.forEach(track => {
                        const notes = parser.eventsToNotes(track.events);
                        allNotes.push(...notes);
                    });

                    const analysisTempo = filenameMetadata.tempo || tempo || 120;
                    const analysis = parser.analyzePattern(allNotes, analysisTempo);
                    const finalMetadata = { ...analysis, ...filenameMetadata };

                    // Calculate required bars from MIDI duration
                    const matchTpb = midiData.ticksPerBeat || 480;
                    const matchMaxTick = allNotes.length > 0 ? Math.max(...allNotes.map(n => n.startTick + n.duration)) : 0;
                    const matchDurSec = matchMaxTick * (60 / analysisTempo) / matchTpb;
                    const matchBars = calcRequiredBars(matchDurSec, analysisTempo);
                    const matchTotalSteps = matchBars * 32;
                    finalMetadata.requiredBars = matchBars;

                    const stepNotes = parser.convertToStepFormat(allNotes).filter(n => n.channel !== 9);

                    if (targetStr === 'all') {
                        const roles = parser.splitByRole(stepNotes);

                        // For multi-track MIDI, try track-based role detection
                        if (midiData.numTracks > 1) {
                            const melodyTrack = parser.getBestTrackForRole(midiData, 'melody');
                            const bassTrack = parser.getBestTrackForRole(midiData, 'bass');
                            const chordTrack = parser.getBestTrackForRole(midiData, 'chords');
                            if (melodyTrack) roles.melody = melodyTrack;
                            if (bassTrack) roles.bass = bassTrack;
                            if (chordTrack) roles.chords = chordTrack;
                        }

                        onExtractMIDI({
                            patterns: {
                                bass: filterExactPattern(roles.bass, 'bass', false, matchTotalSteps),
                                chords: filterExactPattern(roles.chords, 'chords', false, matchTotalSteps),
                                melody: filterExactPattern(roles.melody, 'melody', false, matchTotalSteps)
                            },
                            metadata: finalMetadata
                        }, 'all');
                    } else {
                        // For single role extraction, prioritize the best track for that role
                        const bestTrack = parser.getBestTrackForRole(midiData, targetStr);
                        let targetPattern = bestTrack;

                        if (!targetPattern) {
                            const roles = parser.splitByRole(stepNotes);
                            targetPattern = roles[targetStr] || [];
                        }

                        targetPattern = filterExactPattern(targetPattern, targetStr, false, matchTotalSteps);
                        onExtractMIDI({ patterns: targetPattern, metadata: finalMetadata }, targetStr);
                    }
                    return; // Skip audio processing completely
                }
                // --- END EXACT MIDI MATCHING OVERRIDE ---

                const buffer = await file.arrayBuffer();
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                try {
                    const audioBuffer = await audioContext.decodeAudioData(buffer);

                    // Import and instantiate analyzer
                    const { AudioAnalyzer } = await import('./AudioAnalyzer');
                    const analyzer = new AudioAnalyzer();

                    // Step 1: Detect Metadata (BPM, Key, Scale)
                    const audioAnalysis = await analyzer.analyzeAudioFile(audioBuffer);

                    // Merge and Prioritize: Filename > Analysis
                    const metadata = {
                        ...audioAnalysis,
                        ...filenameMetadata
                    };

                    const analysisTempo = metadata.tempo || tempo || 120;
                    const requiredBars = calcRequiredBars(audioBuffer.duration, analysisTempo);
                    const totalExtractSteps = requiredBars * 32;
                    metadata.requiredBars = requiredBars;

                    console.log(`[Extract] V3 SUCCESS. ${analysisTempo} BPM, ${audioBuffer.duration.toFixed(1)}s → ${requiredBars} bars (${totalExtractSteps} steps).`);

                    // DSP Audio Analysis with full-length extraction + progress
                    if (targetStr === 'all') {
                        const melodyRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'melody', (p) => setExtractProgress(Math.round(p * 0.25)));
                        const bassRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'bass', (p) => setExtractProgress(25 + Math.round(p * 0.25)));
                        const chordsRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'chords', (p) => setExtractProgress(50 + Math.round(p * 0.25)));
                        const drumsRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'drums', (p) => setExtractProgress(75 + Math.round(p * 0.25)));
                        setExtractProgress(100);
                        const extractedPatterns = {
                            melody: filterExactPattern(melodyRaw, 'melody', false, totalExtractSteps),
                            bass: filterExactPattern(bassRaw, 'bass', false, totalExtractSteps),
                            chords: filterExactPattern(chordsRaw, 'chords', false, totalExtractSteps),
                            drums: drumsRaw
                        };

                        console.log(`[PIPELINE] AFTER filterExactPattern:`);
                        onExtractMIDI({ patterns: extractedPatterns, metadata }, 'all');
                    } else {
                        let extractedPattern = await analyzer.extractMIDI(audioBuffer, analysisTempo, targetStr, (p) => setExtractProgress(p));
                        if (extractedPattern && (targetStr === 'drums' ? Object.keys(extractedPattern).length > 0 : extractedPattern.length > 0)) {
                            if (targetStr !== 'drums') {
                                extractedPattern = filterExactPattern(extractedPattern, targetStr, false, totalExtractSteps);
                            }
                            onExtractMIDI({ patterns: extractedPattern, metadata }, targetStr);
                        } else {
                            console.warn(`No pattern extracted for target: ${targetStr}`);
                        }
                    }
                } finally {
                    if (audioContext.state !== 'closed') {
                        audioContext.close();
                    }
                }
            }
        } catch (error) {
            console.error('Extraction failed:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ---- Shared: build MIDI binary from note array ----
    const TICKS_PER_QUARTER = 480;
    const buildMidiFromNotes = (notes, bpm) => {
        const ticksPerStep = TICKS_PER_QUARTER / 8;
        const events = [];
        for (const n of notes) {
            const tick = Math.round(n.time * ticksPerStep);
            const dur = Math.max(Math.round(ticksPerStep / 2), Math.round(n.duration * ticksPerStep));
            const vel = Math.round(Math.min(127, Math.max(1, (n.velocity || 0.8) * 127)));
            events.push({ tick, type: 'on', note: n.note, vel });
            events.push({ tick: tick + dur, type: 'off', note: n.note, vel: 0 });
        }
        events.sort((a, b) => a.tick - b.tick || (a.type === 'off' ? -1 : 1));
        const trackBytes = [];
        const writeVLQ = (val) => {
            const bytes = [];
            bytes.push(val & 0x7F);
            val >>= 7;
            while (val > 0) { bytes.push((val & 0x7F) | 0x80); val >>= 7; }
            bytes.reverse();
            return bytes;
        };
        const usPerBeat = Math.round(60000000 / bpm);
        trackBytes.push(...writeVLQ(0), 0xFF, 0x51, 0x03,
            (usPerBeat >> 16) & 0xFF, (usPerBeat >> 8) & 0xFF, usPerBeat & 0xFF);
        let lastTick = 0;
        for (const ev of events) {
            const delta = Math.max(0, ev.tick - lastTick);
            trackBytes.push(...writeVLQ(delta));
            if (ev.type === 'on') {
                trackBytes.push(0x90, ev.note & 0x7F, ev.vel & 0x7F);
            } else {
                trackBytes.push(0x80, ev.note & 0x7F, 0x00);
            }
            lastTick = ev.tick;
        }
        trackBytes.push(...writeVLQ(0), 0xFF, 0x2F, 0x00);
        const trackLen = trackBytes.length;
        const header = [
            0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01,
            (TICKS_PER_QUARTER >> 8) & 0xFF, TICKS_PER_QUARTER & 0xFF,
            0x4D, 0x54, 0x72, 0x6B,
            (trackLen >> 24) & 0xFF, (trackLen >> 16) & 0xFF, (trackLen >> 8) & 0xFF, trackLen & 0xFF,
        ];
        const midi = new Uint8Array(header.length + trackLen);
        midi.set(header, 0);
        midi.set(trackBytes, header.length);
        return midi;
    };

    // ---- Extract MIDI from single audio file to disk ----
    const handleExtractMIDIToFile = async (item) => {
        setContextMenu(null);
        if (item.type !== 'audio') return;

        // Default save path: same folder as the audio file, with .mid extension
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        const safeName = baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\.+$/, '').trim().slice(0, 200);
        const defaultName = (safeName || 'untitled') + '.mid';

        let savePath = null;
        if (window.electronAPI?.fs?.showSaveDialog) {
            // Pre-fill with the audio file's folder if available
            const defaultDir = item.nativePath ? item.nativePath.replace(/[\\/][^\\/]+$/, '') : undefined;
            const result = await window.electronAPI.fs.showSaveDialog({
                title: t('browser.saveMidiFile'),
                defaultPath: defaultDir ? defaultDir + '/' + defaultName : defaultName,
                filters: [{ name: 'MIDI File', extensions: ['mid'] }]
            });
            if (result.canceled || !result.filePath) return;
            savePath = result.filePath;
        } else {
            alert('Saving MIDI to file requires the desktop app.');
            return;
        }

        // Stop playback
        stopAllPreviewAudio();
        setIsPlaying(false);
        setIsMidiPlaying(false);

        setIsAnalyzing(true);
        setExtractProgress(0);

        try {
            // Check for matching MIDI file first (same as single-file Extract MIDI)
            const findMidiInTree = (items) => {
                for (const f of (items || [])) {
                    if (f.kind === 'directory') {
                        const found = findMidiInTree(f.children);
                        if (found) return found;
                    } else if (f.type === 'midi') {
                        const fBase = f.name.replace(/\.[^/.]+$/, '');
                        if (fBase === baseName) return f;
                    }
                }
                return null;
            };
            let exactMidiItem = null;
            for (const fFiles of Object.values(folderFiles)) {
                exactMidiItem = findMidiInTree(fFiles);
                if (exactMidiItem) break;
            }

            if (exactMidiItem) {
                // Copy original MIDI directly
                const midiFile = await getFileFromItem(exactMidiItem);
                const midiBuffer = await midiFile.arrayBuffer();
                await window.electronAPI.fs.writeFile(savePath, midiBuffer);
            } else {
                // Extract from audio — same pipeline as single-file Extract MIDI
                const file = await getFileFromItem(item);
                const buffer = await file.arrayBuffer();
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                try {
                    const audioBuffer = await audioContext.decodeAudioData(buffer);
                    const { AudioAnalyzer } = await import('./AudioAnalyzer');
                    const analyzer = new AudioAnalyzer();
                    const filenameMetadata = extractMetadataFromFilename(item.name);
                    const audioAnalysis = await analyzer.analyzeAudioFile(audioBuffer);
                    const metadata = { ...audioAnalysis, ...filenameMetadata };
                    const analysisTempo = metadata.tempo || tempo || 120;
                    const requiredBars = calcRequiredBars(audioBuffer.duration, analysisTempo);
                    const totalExtractSteps = requiredBars * 32;

                    const melodyRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'melody', (p) => setExtractProgress(Math.round(p * 0.33)));
                    const bassRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'bass', (p) => setExtractProgress(33 + Math.round(p * 0.33)));
                    const chordsRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'chords', (p) => setExtractProgress(66 + Math.round(p * 0.34)));
                    setExtractProgress(100);

                    const melodyFiltered = filterExactPattern(melodyRaw, 'melody', false, totalExtractSteps);
                    const bassFiltered = filterExactPattern(bassRaw, 'bass', false, totalExtractSteps);
                    const chordsFiltered = filterExactPattern(chordsRaw, 'chords', false, totalExtractSteps);

                    const allNotes = [
                        ...(Array.isArray(melodyFiltered) ? melodyFiltered : []),
                        ...(Array.isArray(bassFiltered) ? bassFiltered : []),
                        ...(Array.isArray(chordsFiltered) ? chordsFiltered : []),
                    ];

                    if (allNotes.length > 0) {
                        const midiBytes = buildMidiFromNotes(allNotes, analysisTempo);
                        await window.electronAPI.fs.writeFile(savePath, midiBytes.buffer);
                    }
                } finally {
                    if (audioContext.state !== 'closed') audioContext.close();
                }
            }

            // Show the saved file in explorer
            if (window.electronAPI?.shell?.showItemInFolder) {
                window.electronAPI.shell.showItemInFolder(savePath);
            }
        } catch (error) {
            console.error('[ExtractMIDI] Save to file failed:', error);
        } finally {
            setIsAnalyzing(false);
            setExtractProgress(0);
        }
    };

    // ---- Batch Extract MIDI from Folder ----
    const handleExtractMIDIFromFolder = async (folderItem) => {
        setContextMenu(null);

        // Gather top-level audio files from the folder
        let audioFiles = [];
        const files = folderFiles[folderItem.name] || folderItem.children || [];
        for (const f of files) {
            if (f.kind === 'file' && f.type === 'audio') audioFiles.push(f);
        }
        if (audioFiles.length === 0) {
            alert(t('browser.noAudioFilesInFolder'));
            return;
        }

        // Ask user to choose a destination folder
        let destFolderPath = null;
        if (window.electronAPI?.fs?.showOpenDialog) {
            const result = await window.electronAPI.fs.showOpenDialog({
                properties: ['openDirectory', 'createDirectory'],
                title: t('browser.chooseMidiDestination'),
            });
            if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;
            destFolderPath = result.filePaths[0];
        } else {
            alert('Batch MIDI extraction to folder requires the desktop app.');
            return;
        }

        // Stop playback
        if (window.audioEngine) window.audioEngine.stop();
        if (midiSynthRef.current) midiSynthRef.current.stop();
        if (midiProgressRef.current) { clearInterval(midiProgressRef.current); midiProgressRef.current = null; }
        setIsPlaying(false);
        setIsMidiPlaying(false);

        setIsAnalyzing(true);
        setExtractProgress(0);
        setBatchExtractState({ current: 0, total: audioFiles.length, fileName: '' });
        const abortController = new AbortController();
        batchExtractAbortRef.current = abortController;

        let completed = 0;
        try {
            for (const audioItem of audioFiles) {
                // Check for cancellation
                if (abortController.signal.aborted) break;

                const baseName = audioItem.name.replace(/\.[^/.]+$/, '');
                // Sanitize filename: remove illegal chars for Windows/macOS/Linux, truncate
                const safeName = baseName
                    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // illegal chars
                    .replace(/\.+$/, '')                      // trailing dots (Windows)
                    .replace(/\s+/g, ' ')                     // collapse whitespace
                    .trim()
                    .slice(0, 200);                           // keep path component short

                setBatchExtractState({ current: completed + 1, total: audioFiles.length, fileName: audioItem.name });

                try {
                    const midiFileName = (safeName || 'untitled') + '.mid';
                    const fullPath = destFolderPath + '/' + midiFileName;
                    const writePath = fullPath.length > 255
                        ? destFolderPath + '/' + safeName.slice(0, Math.max(10, 255 - destFolderPath.length - 5)) + '.mid'
                        : fullPath;

                    // --- EXACT MIDI MATCHING OVERRIDE (same as single-file Extract MIDI) ---
                    // If a .mid file with the same base name exists in any open folder, copy it directly
                    const findMidiInTree = (items) => {
                        for (const f of (items || [])) {
                            if (f.kind === 'directory') {
                                const found = findMidiInTree(f.children);
                                if (found) return found;
                            } else if (f.type === 'midi') {
                                const fBase = f.name.replace(/\.[^/.]+$/, '');
                                if (fBase === baseName) return f;
                            }
                        }
                        return null;
                    };
                    let exactMidiItem = null;
                    for (const fFiles of Object.values(folderFiles)) {
                        exactMidiItem = findMidiInTree(fFiles);
                        if (exactMidiItem) break;
                    }

                    if (exactMidiItem) {
                        // Copy the original MIDI file directly — no audio analysis needed
                        const midiFile = await getFileFromItem(exactMidiItem);
                        const midiBuffer = await midiFile.arrayBuffer();
                        await window.electronAPI.fs.writeFile(writePath, midiBuffer);
                    } else {
                        // No matching MIDI found — extract from audio (same pipeline as single-file Extract MIDI)
                        const file = await getFileFromItem(audioItem);
                        const buffer = await file.arrayBuffer();
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        try {
                            const audioBuffer = await audioContext.decodeAudioData(buffer);

                            const { AudioAnalyzer } = await import('./AudioAnalyzer');
                            const analyzer = new AudioAnalyzer();
                            const filenameMetadata = extractMetadataFromFilename(audioItem.name);
                            const audioAnalysis = await analyzer.analyzeAudioFile(audioBuffer);
                            const metadata = { ...audioAnalysis, ...filenameMetadata };
                            const analysisTempo = metadata.tempo || tempo || 120;
                            const requiredBars = calcRequiredBars(audioBuffer.duration, analysisTempo);
                            const totalExtractSteps = requiredBars * 32;

                            // Extract all roles — same as single-file "Extract MIDI" (targetStr='all')
                            const melodyRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'melody', () => {});
                            const bassRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'bass', () => {});
                            const chordsRaw = await analyzer.extractMIDI(audioBuffer, analysisTempo, 'chords', () => {});

                            // Apply same filterExactPattern cleanup as single-file path
                            const melodyFiltered = filterExactPattern(melodyRaw, 'melody', false, totalExtractSteps);
                            const bassFiltered = filterExactPattern(bassRaw, 'bass', false, totalExtractSteps);
                            const chordsFiltered = filterExactPattern(chordsRaw, 'chords', false, totalExtractSteps);

                            const allNotes = [
                                ...(Array.isArray(melodyFiltered) ? melodyFiltered : []),
                                ...(Array.isArray(bassFiltered) ? bassFiltered : []),
                                ...(Array.isArray(chordsFiltered) ? chordsFiltered : []),
                            ];

                            if (allNotes.length > 0) {
                                const midiBytes = buildMidiFromNotes(allNotes, analysisTempo);
                                await window.electronAPI.fs.writeFile(writePath, midiBytes.buffer);
                            }
                        } finally {
                            if (audioContext.state !== 'closed') audioContext.close();
                        }
                    }
                } catch (err) {
                    console.warn(`[BatchMIDI] Failed to extract "${audioItem.name}":`, err.message);
                }

                completed++;
                setExtractProgress(Math.round((completed / audioFiles.length) * 100));
                setBatchExtractState({ current: completed, total: audioFiles.length, fileName: audioItem.name });

                // Yield to UI thread so progress renders and cancel button is responsive
                await new Promise(r => setTimeout(r, 0));
                if (abortController.signal.aborted) break;
            }

            // Open the destination folder when done (unless cancelled)
            if (!abortController.signal.aborted && window.electronAPI?.shell?.showItemInFolder && destFolderPath) {
                window.electronAPI.shell.showItemInFolder(destFolderPath);
            }
        } catch (error) {
            if (!abortController.signal.aborted) {
                console.error('[BatchMIDI] Batch extraction failed:', error);
            }
        } finally {
            batchExtractAbortRef.current = null;
            setIsAnalyzing(false);
            setBatchExtractState(null);
            setExtractProgress(0);
        }
    };

    // Preview State
    const [previewItem, setPreviewItem] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [previewBuffer, setPreviewBuffer] = useState(null);
    const [midiPreviewData, setMidiPreviewData] = useState(null);
    const [isMidiPlaying, setIsMidiPlaying] = useState(false);

    // MIDI synth ref
    const midiSynthRef = useRef(null);
    const midiProgressRef = useRef(null);
    const getMidiSynth = () => {
        if (!midiSynthRef.current) {
            midiSynthRef.current = new MidiPreviewSynth();
        }
        return midiSynthRef.current;
    };

    // Scan/Analysis Progress State
    const [scanProgress, setScanProgress] = useState({ percent: 0, path: '', status: '' });
    const [isProcessing, setIsProcessing] = useState(false);

    // Analysis cache: folderName -> { results, timestamp }
    const analysisCacheRef = useRef({});

    useEffect(() => {
        loadFolders();
    }, []);

    // Watch folders for file changes (Electron only) — rescan when files are added/removed
    useEffect(() => {
        if (!window.electronAPI?.folders?.onChanged) return;
        window.electronAPI.folders.onChanged(({ dirPath }) => {
            // Find the folder that matches this path and rescan it silently
            const folder = folders.find(f => f.nativePath === dirPath);
            if (folder) {
                console.log(`[Browser] Folder changed: ${folder.name} — rescanning`);
                // Reset scanned flag so performScan doesn't skip it
                currentlyScanning.current.delete(folder.name);
                performScan(folder, { silent: true, autoExpand: false });
            }
        });
        return () => {
            if (window.electronAPI?.folders?.removeChangedListener) {
                window.electronAPI.folders.removeChangedListener();
            }
        };
    }, [folders]);

    // ===== Factory Samples Auto-Load =====
    useEffect(() => {
        if (factoryLoaded) return;
        loadFactorySamples();
    }, []);

    const loadFactorySamples = async () => {
        setFactoryLoading(true);
        setFactoryLoadProgress({ loaded: 0, total: 0, currentFile: '', status: t('browser.fetchingManifest') });

        try {
            const res = await fetch('/factory-manifest.json');
            if (!res.ok) {
                console.warn('[Factory] No factory-manifest.json found');
                setFactoryLoading(false);
                setFactoryLoadProgress({ loaded: 0, total: 0, currentFile: '', status: t('browser.noFactoryLibrary') });
                return;
            }
            const manifest = await res.json();

            // Count total files across all folders
            let totalFiles = 0;
            const countFiles = (folders) => {
                folders.forEach(f => {
                    totalFiles += (f.files || []).length;
                    if (f.children) countFiles(f.children);
                });
            };
            countFiles(manifest.folders || []);
            setFactoryLoadProgress({ loaded: 0, total: totalFiles, currentFile: '', status: t('browser.loadingSamples') });

            let loaded = 0;

            // Build folder tree with metadata only (audio decoded lazily on first use)
            const buildTree = (manifestFolders, basePath) => {
                const result = [];
                for (const folder of manifestFolders) {
                    const folderPath = `${basePath}/${folder.name}`;
                    const files = [];
                    for (const fileName of (folder.files || [])) {
                        const filePath = `${folderPath}/${fileName}`;
                        files.push({
                            name: fileName,
                            path: filePath,
                            kind: 'file',
                            type: 'audio',
                            audioBuffer: null, // decoded lazily on first click/use
                            _audioUrl: filePath,
                            isFactory: true
                        });
                        loaded++;
                    }
                    setFactoryLoadProgress(prev => ({ ...prev, loaded, status: t('browser.loadingSamplesProgress', { loaded, total: totalFiles }) }));

                    const children = folder.children ? buildTree(folder.children, folderPath) : [];
                    result.push({
                        name: folder.name,
                        path: folderPath,
                        kind: 'directory',
                        children: [...children, ...files.map(f => ({ ...f, kind: 'file' }))],
                        isFactory: true
                    });
                }
                return result;
            };

            const tree = buildTree(manifest.folders || [], '/Factory Library');
            setFactoryFolders(tree);
            window.factoryFolders = tree; // Expose for drum slot randomize
            setFactoryLoaded(true);
            setFactoryLoading(false);
            setFactoryLoadProgress({ loaded: totalFiles, total: totalFiles, currentFile: '', status: t('browser.complete') });
        } catch (err) {
            console.error('[Factory] Failed to load factory samples:', err);
            setFactoryLoading(false);
            setFactoryLoadProgress({ loaded: 0, total: 0, currentFile: '', status: t('browser.failedToLoad') });
        }
    };

    // Handle clicking a factory file
    const handleFactoryFileClick = async (item) => {
        if (onFileSelect) onFileSelect(item);
        if (!window.audioEngine) return;

        // Lazy-decode factory audio on first use
        if (!item.audioBuffer && item._audioUrl) {
            try {
                const audioCtx = window.audioEngine.audioContext;
                const res = await fetch(item._audioUrl);
                if (!res.ok) return;
                const arrayBuf = await res.arrayBuffer();
                item.audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
            } catch (e) {
                console.warn('[Factory] Lazy decode failed:', item._audioUrl, e);
                return;
            }
        }
        if (!item.audioBuffer) return;

        // Stop generator playback so explorer audio takes over instantly
        if (onStopGeneratorPlayback) onStopGeneratorPlayback();

        // Always kill any existing preview instantly
        if (window.audioEngine) window.audioEngine.stop();
        if (midiSynthRef.current) midiSynthRef.current.stop();
        if (midiProgressRef.current) clearInterval(midiProgressRef.current);
        midiProgressRef.current = null;
        setIsPlaying(false);
        setIsMidiPlaying(false);
        setMidiPreviewData(null);

        // Ensure AudioContext is resumed (required on first user gesture)
        await window.audioEngine.resume();
        // Schedule idle suspend so previews don't leave the context running
        if (window.__samplerRef?._scheduleIdleSuspend) window.__samplerRef._scheduleIdleSuspend();

        setPreviewBuffer(item.audioBuffer);
        setPreviewItem(item);
        setIsPlaying(true);
        setDuration(item.audioBuffer.duration);
        window.audioEngine.play(item.audioBuffer, () => {
            setIsPlaying(false);
            setCurrentTime(0);
        });
    };

    // Render factory folder tree
    const renderFactoryTree = (items, depth = 0) => {
        return items.map((item, idx) => {
            const paddingLeft = depth * 15 + 10;
            if (item.kind === 'directory') {
                const key = item.path || `factory-${depth}-${idx}`;
                const isExpanded = factoryExpanded[key];
                const isNavActive = navActiveKey === key;
                return (
                    <div key={key}>
                        <div
                            data-nav-key={key}
                            style={{
                                paddingLeft,
                                cursor: 'pointer',
                                color: (isNavActive || isExpanded) ? (theme.accent || ac) : (isDark ? '#eee' : '#555'),
                                display: 'flex',
                                alignItems: 'center',
                                padding: '6px 8px',
                                backgroundColor: isNavActive ? 'rgba(255, 140, 50, 0.2)' : (isExpanded ? 'rgba(255, 140, 50, 0.12)' : 'transparent'),
                                borderRadius: '4px',
                                fontSize: '12px',
                                transition: 'all 0.15s ease',
                                borderLeft: isNavActive ? `2px solid ${theme.accent || ac}` : (isExpanded ? `2px solid ${theme.accent || ac}` : '2px solid transparent'),
                                marginBottom: '1px'
                            }}
                            onClick={() => {
                                setFactoryExpanded(prev => ({ ...prev, [key]: !isExpanded }));
                            }}
                            onMouseEnter={(e) => {
                                if (!isExpanded && !isNavActive) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 140, 50, 0.08)' : 'rgba(255, 140, 50, 0.06)';
                            }}
                            onMouseLeave={(e) => {
                                if (!isExpanded && !isNavActive) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <span style={{
                                marginRight: '8px',
                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'inline-block',
                                fontSize: '8px',
                                opacity: 0.5
                            }}>▶</span>
                            <span style={{
                                marginRight: '10px',
                                fontSize: '14px',
                                filter: isExpanded ? 'grayscale(0)' : 'grayscale(1)',
                                opacity: isExpanded ? 1 : 0.7
                            }}>
                                {isExpanded ? '📂' : '📁'}
                            </span>
                            <span style={{
                                fontWeight: isExpanded ? '700' : '400',
                                letterSpacing: '0.3px'
                            }}>
                                {item.name.toUpperCase()}
                            </span>
                        </div>
                        {isExpanded && (
                            <div style={{ marginLeft: 0 }}>
                                {renderFactoryTree(item.children || [], depth + 1)}
                            </div>
                        )}
                    </div>
                );
            } else {
                const fileKey = item.path || item.name;
                const isCurrent = previewItem?.path === item.path || previewItem?.name === item.name;
                const isNavActive = navActiveKey === fileKey;
                const isHighlighted = isCurrent || isNavActive;
                const progress = isHighlighted && duration > 0 ? (currentTime / duration) * 100 : 0;
                return (
                    <div
                        key={item.path || idx}
                        data-file-path={fileKey}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onClick={() => handleFactoryFileClick(item)}
                        style={{
                            paddingLeft,
                            cursor: 'pointer',
                            color: isHighlighted ? (theme.accent || ac) : (theme.textDim || '#888'),
                            fontSize: '11px',
                            fontWeight: isHighlighted ? '700' : '400',
                            padding: '6px 10px 6px ' + paddingLeft + 'px',
                            display: 'flex',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: isHighlighted ? (isDark ? hexToRgba(ac, 0.08) : hexToRgba(ac, 0.15)) : 'transparent',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            borderLeft: isHighlighted ? `2px solid ${theme.accent || ac}` : '2px solid transparent'
                        }}
                    >
                        {isHighlighted && (
                            <div style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${progress}%`,
                                backgroundColor: 'rgba(0, 212, 255, 0.15)',
                                zIndex: 0, pointerEvents: 'none',
                                transition: 'width 0.1s linear'
                            }} />
                        )}
                        <span style={{
                            position: 'relative',
                            zIndex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1
                        }}>
                            {item.name}
                        </span>
                        {item.type === 'audio' && onAddToFileSlot && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Select/highlight this file so user sees which one was added
                                    setPreviewItem(item);
                                    setNavActiveKey(item.path || item.name);
                                    onAddToFileSlot(item);
                                }}
                                style={{
                                    background: isDark ? hexToRgba(ac, 0.15) : ac,
                                    border: 'none',
                                    borderRadius: '4px',
                                    width: '20px',
                                    height: '20px',
                                    cursor: 'pointer',
                                    color: isDark ? ac : '#fff',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginLeft: '8px',
                                    zIndex: 1,
                                    transition: 'all 0.2s'
                                }}
                                title={t('browser.addToDrumSlot')}
                            >
                                +
                            </button>
                        )}
                    </div>
                );
            }
        });
    };

    // Polling for playback progress
    useEffect(() => {
        let interval;
        if (isPlaying && window.audioEngine) {
            interval = setInterval(() => {
                if (!window.audioEngine.isPlaying && isPlaying) {
                    setIsPlaying(false);
                }
                setCurrentTime(window.audioEngine.getCurrentTime());
                setDuration(window.audioEngine.getDuration());
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    const currentlyScanning = useRef(new Set());
    const activeScanCount = useRef(0);
    const performScan = async (folder, { silent = false, autoExpand = false } = {}) => {
        if (currentlyScanning.current.has(folder.name)) return;
        currentlyScanning.current.add(folder.name);

        if (!silent) {
            activeScanCount.current++;
            setIsProcessing(true);
            setScanProgress({ percent: 0, path: t('browser.scanning'), status: t('browser.crawlingDirectory') });
        }

        try {
            // Electron native path — use IPC fs scan instead of handle
            if (folder.nativePath && window.electronAPI?.folders?.scan) {
                const scanResult = await window.electronAPI.folders.scan(folder.nativePath);
                if (scanResult.error) {
                    console.warn(`[Browser] Native scan failed for "${folder.name}":`, scanResult.error);
                    setFolders(prev => prev.filter(f => f.name !== folder.name));
                    return;
                }
                // Build tree structure matching libraryManager format
                const buildNativeTree = (items, parentPath) => {
                    const dirs = {};
                    const result = [];
                    for (const f of items) {
                        const parts = f.relPath.split('/');
                        if (parts.length === 1) {
                            result.push({ kind: 'file', name: f.name, path: f.path, nativePath: f.path, type: f.type });
                        } else {
                            const dirName = parts[0];
                            if (!dirs[dirName]) dirs[dirName] = [];
                            dirs[dirName].push({ ...f, relPath: parts.slice(1).join('/') });
                        }
                    }
                    for (const [dirName, dirFiles] of Object.entries(dirs).sort(([a], [b]) => a.localeCompare(b))) {
                        result.push({
                            kind: 'directory',
                            name: dirName,
                            path: parentPath + '/' + dirName,
                            nativePath: parentPath + '/' + dirName,
                            children: buildNativeTree(dirFiles, parentPath + '/' + dirName),
                        });
                    }
                    return result;
                };
                const files = buildNativeTree(scanResult.files, folder.nativePath);
                // Use same downstream logic as handle-based scan
                const flatten = (items, flat = []) => {
                    items.forEach(item => {
                        if (item.kind === 'file') flat.push(item);
                        if (item.children) flatten(item.children, flat);
                    });
                    return flat;
                };
                const allFiles = flatten(files);
                if (allFiles.length === 0) {
                    setFolders(prev => prev.filter(f => f.name !== folder.name));
                } else {
                    setFolderFiles(prev => ({ ...prev, [folder.name]: files }));
                    if (autoExpand) {
                        setExpandedFolders(prev => ({ ...prev, [folder.name]: true }));
                    }
                    if (onFolderSelect) {
                        onFolderSelect({ name: folder.name, files, samples: allFiles.filter(f => f.type === 'audio') });
                    }
                    // Start watching this folder for changes
                    if (window.electronAPI?.folders?.watch) {
                        window.electronAPI.folders.watch(folder.nativePath);
                    }
                }
                return; // Skip handle-based scan
            }

            // Validate handle is still usable (IndexedDB may deserialize stale handles)
            if (!folder.handle || typeof folder.handle.values !== 'function') {
                console.warn(`[Browser] Stale handle for "${folder.name}" — removing from library`);
                await window.libraryManager.removeFolder(folder.name);
                setFolders(prev => prev.filter(f => f.name !== folder.name));
                return;
            }

            const hasPermission = await window.libraryManager.verifyPermission(folder.handle, { allowRequest: !silent });
            if (!hasPermission) {
                return;
            }

            // Check for cancellation after permission prompt
            if (!silent && scanAbortRef.current && scanAbortRef.current.signal.aborted) return;

            const progressCb = silent ? null : (progress) => {
                setScanProgress(prev => ({
                    ...prev,
                    percent: progress.percent,
                    path: progress.path
                }));
            };

            const files = await window.libraryManager.scanFolder(folder.handle, '', progressCb);

            // Check for cancellation after scan
            if (!silent && scanAbortRef.current && scanAbortRef.current.signal.aborted) return;

            // Check if folder contains any valid sound files
            const flatten = (items, flat = []) => {
                items.forEach(item => {
                    if (item.kind === 'file') flat.push(item);
                    if (item.children) flatten(item.children, flat);
                });
                return flat;
            };
            const allFiles = flatten(files);

            if (allFiles.length === 0) {
                if (!silent) {
                    setScanProgress(prev => ({ ...prev, status: t('browser.noSamplesFound') }));
                    await new Promise(r => setTimeout(r, 1500));
                }

                await window.libraryManager.removeFolder(folder.name);
                setFolders(prev => prev.filter(f => f.name !== folder.name));
            } else {
                setFolderFiles(prev => ({ ...prev, [folder.name]: files }));

                // Auto-expand folder after successful scan
                if (autoExpand) {
                    const key = folder.path || folder.name;
                    setExpandedFolders(prev => ({ ...prev, [key]: true }));
                }

                if (onFolderSelect) {
                    onFolderSelect({
                        name: folder.name,
                        handle: folder.handle,
                        files: files,
                        samples: allFiles.filter(f => f.type === 'audio')
                    });
                }
            }
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.log('[Browser] Scan cancelled');
            } else {
                console.error("Scan failed:", error);
            }
        } finally {
            currentlyScanning.current.delete(folder.name);
            if (!silent) {
                activeScanCount.current--;
                if (activeScanCount.current <= 0) {
                    activeScanCount.current = 0;
                    setIsProcessing(false);
                }
            }
        }
    };

    const scannedFolders = useRef(new Set());
    const loadFolders = async () => {
        // In Electron, load persisted native folder paths first
        if (window.electronAPI?.isElectron && window.electronAPI?.folders?.load) {
            try {
                const result = await window.electronAPI.folders.load();
                if (result.folders && result.folders.length > 0) {
                    const nativeFolders = result.folders.map(fp => ({
                        name: fp.split(/[\\/]/).pop(),
                        nativePath: fp,
                    }));
                    setFolders(nativeFolders);
                    nativeFolders.forEach(folder => {
                        if (!scannedFolders.current.has(folder.name)) {
                            scannedFolders.current.add(folder.name);
                            performScan(folder, { silent: true, autoExpand: false });
                        }
                    });
                    return; // Skip IndexedDB if we have native folders
                }
            } catch (e) {
                console.warn("Failed to load native folders, falling back to IndexedDB", e);
            }
        }
        // Fallback: IndexedDB via libraryManager
        if (window.libraryManager) {
            try {
                const f = await window.libraryManager.getFolders();
                setFolders(f);
                // AUTOMATIC CRAWLING: Scan all folders on load silently (no blocking overlay)
                f.forEach(folder => {
                    if (!scannedFolders.current.has(folder.name)) {
                        scannedFolders.current.add(folder.name);
                        performScan(folder, { silent: true, autoExpand: false });
                    }
                });
            } catch (e) {
                console.error("Failed to load folders", e);
            }
        }
    };

    // Build a virtual FileSystemDirectoryHandle from a flat FileList (webkitdirectory fallback)
    const buildVirtualHandle = (folderName, fileList) => {
        const buildTree = (name, files, prefix) => ({
            kind: 'directory',
            name,
            async *values() {
                const children = new Map();
                for (const f of files) {
                    const rel = f.webkitRelativePath.startsWith(prefix)
                        ? f.webkitRelativePath.slice(prefix.length)
                        : f.webkitRelativePath;
                    const parts = rel.split('/').filter(Boolean);
                    if (parts.length === 1) {
                        // Direct child file
                        children.set(parts[0], {
                            kind: 'file',
                            name: parts[0],
                            getFile: () => Promise.resolve(f),
                        });
                    } else if (parts.length > 1) {
                        // Subdirectory — collect all files that belong to it
                        const dirName = parts[0];
                        if (!children.has(dirName)) {
                            const subPrefix = prefix + dirName + '/';
                            const subFiles = files.filter(sf =>
                                sf.webkitRelativePath.startsWith(subPrefix)
                            );
                            children.set(dirName, buildTree(dirName, subFiles, subPrefix));
                        }
                    }
                }
                for (const child of children.values()) yield child;
            },
            queryPermission: () => Promise.resolve('granted'),
            requestPermission: () => Promise.resolve('granted'),
        });
        const allFiles = Array.from(fileList);
        return buildTree(folderName, allFiles, folderName + '/');
    };

    const handleAddFolder = async () => {
        // In Electron, use native dialog + native fs for reliable persistence
        if (window.electronAPI?.isElectron && window.electronAPI?.folders?.scan) {
            try {
                const result = await window.electronAPI.fs.showOpenDialog({
                    properties: ['openDirectory'],
                    title: 'Select Sample Folder',
                });
                if (result.canceled || !result.filePaths?.length) return;
                const folderPath = result.filePaths[0];
                // Block root drives (e.g. "C:\", "D:\", "/") — scanning an entire drive is dangerous
                const normalized = folderPath.replace(/\\/g, '/').replace(/\/+$/, '');
                if (/^[A-Za-z]:$/.test(normalized) || normalized === '' || normalized === '/') {
                    alert(t('browser.cannotAddRootDrive'));
                    return;
                }
                const folderName = folderPath.split(/[\\/]/).pop();
                // Save path for persistence
                const loadResult = await window.electronAPI.folders.load();
                const existing = loadResult.folders || [];
                if (!existing.includes(folderPath)) {
                    await window.electronAPI.folders.save([...existing, folderPath]);
                }
                // Build a virtual handle-like object that performScan can work with
                const virtualFolder = { name: folderName, nativePath: folderPath };
                setFolders(prev => {
                    if (prev.some(f => f.nativePath === folderPath)) return prev;
                    return [...prev, virtualFolder];
                });
                scanAbortRef.current = new AbortController();
                performScan(virtualFolder);
                setExpandedFolders(prev => ({ ...prev, [folderName]: true }));
            } catch (e) {
                if (e.name !== 'AbortError') console.error("Error adding folder:", e);
            }
            return;
        }
        // Prefer native File System Access API (requires secure context: https or localhost)
        if (typeof window.showDirectoryPicker === 'function') {
            try {
                const handle = await window.showDirectoryPicker();
                if (handle) {
                    await window.libraryManager.addFolder(handle);
                    const newFolder = { name: handle.name, handle: handle };
                    setFolders(prev => [...prev, newFolder]);
                    scanAbortRef.current = new AbortController();
                    performScan(newFolder);
                    setExpandedFolders(prev => ({ ...prev, [handle.name]: true }));
                }
            } catch (e) {
                if (e.name !== 'AbortError') console.error("Error adding folder:", e);
            }
        } else {
            // Fallback: use hidden <input webkitdirectory> for plain HTTP / non-secure contexts
            folderInputRef.current?.click();
        }
    };

    const handleFolderInputChange = async (e) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;
        try {
            // Derive folder name from the first file's relative path
            const firstPath = fileList[0].webkitRelativePath || '';
            const folderName = firstPath.split('/')[0] || 'Untitled Folder';
            const handle = buildVirtualHandle(folderName, fileList);
            // Virtual handles can't be stored in IndexedDB (async generators aren't cloneable),
            // so skip persistence — these folders are session-only when using the fallback.
            const newFolder = { name: folderName, handle };
            setFolders(prev => [...prev, newFolder]);
            scanAbortRef.current = new AbortController();
            performScan(newFolder);
            setExpandedFolders(prev => ({ ...prev, [folderName]: true }));
        } catch (err) {
            console.error("Error adding folder (fallback):", err);
        }
        // Reset input so same folder can be re-selected
        e.target.value = '';
    };

    const toggleFolder = async (folder) => {
        // Kill any playing audio when clicking folders
        if (window.audioEngine) window.audioEngine.stop();
        if (midiSynthRef.current) midiSynthRef.current.stop();
        if (midiProgressRef.current) clearInterval(midiProgressRef.current);
        midiProgressRef.current = null;
        setIsPlaying(false);
        setIsMidiPlaying(false);
        setMidiPreviewData(null);

        const key = folder.path || folder.name;
        const isExpanded = expandedFolders[key];

        if (!isExpanded && !folderFiles[folder.name]) {
            await performScan(folder);
        }

        setExpandedFolders(prev => ({
            ...prev,
            [key]: !isExpanded
        }));
    };

    // Instantly stops all preview audio (used by keyboard nav and file clicks)
    const stopAllPreviewAudio = () => {
        if (window.audioEngine) window.audioEngine.stop();
        if (midiSynthRef.current) midiSynthRef.current.stop();
        if (midiProgressRef.current) clearInterval(midiProgressRef.current);
        midiProgressRef.current = null;
    };

    const handleFileClick = async (item, directClick = true) => {
        if (onFileSelect) onFileSelect(item);
        // Update nav active key to this file so keyboard nav stays in sync
        setNavActiveKey(item.path || item.name);

        // Bump generation so any in-flight async chains from previous clicks/nav are cancelled
        const gen = ++playGenRef.current;

        // Ensure AudioContext is resumed — await it so first click doesn't lag
        if (window.audioEngine) {
            const ctx = window.audioEngine.audioContext || window.audioEngine.ctx;
            if (ctx && ctx.state === 'suspended') await ctx.resume();
            window.audioEngine.resume();
        }
        // Cancel any pending idle suspend — we're about to play something
        if (window.__samplerRef?._cancelIdleSuspend) window.__samplerRef._cancelIdleSuspend();

        // --- ALWAYS CUT AUDIO INSTANTLY ON ANY FILE CLICK ---
        stopAllPreviewAudio();
        setIsPlaying(false);
        setIsMidiPlaying(false);
        setMidiPreviewData(null);

        // If this wasn't a direct click (e.g. right click), stop here. Only highlight.
        if (!directClick) {
            setPreviewItem(item); // Highlight it
            return;
        }

        if (!window.audioEngine) return;

        // Stop generator playback so explorer audio takes over instantly
        if (onStopGeneratorPlayback) onStopGeneratorPlayback();

        if (item.type === 'midi') {
            try {
                const file = await getFileFromItem(item);
                if (playGenRef.current !== gen) return; // Stale — user navigated away
                const parser = new MIDIParser();
                const midiData = await parser.loadMIDIFile(file);
                if (playGenRef.current !== gen) return; // Stale

                // Collect all notes from all tracks
                let allNotes = [];
                midiData.tracks.forEach(track => {
                    const trackNotes = parser.eventsToNotes(track.events);
                    allNotes = [...allNotes, ...trackNotes];
                });

                // Cache parsed data on the item for drag-and-drop
                item.midiNotes = allNotes;
                item.ticksPerBeat = midiData.ticksPerBeat || 480;
                item.noteCount = allNotes.length;

                const analysis = parser.analyzePattern(allNotes);
                setMidiPreviewData(analysis);
                setPreviewItem(item);
                setPreviewBuffer(null);
                setDuration(0);
                setCurrentTime(0);

                // Actually PLAY the MIDI through the synth
                if (allNotes.length > 0) {
                    const tpb = midiData.ticksPerBeat || 480;
                    // Use tempo from MIDI file, or filename metadata, or project tempo, fallback 120
                    const filenameMetadata = extractMetadataFromFilename(item.name);
                    const playbackBpm = midiData.tempo || filenameMetadata.tempo || tempo || 120;
                    item._previewBpm = playbackBpm; // Cache for replay via play button
                    const maxTick = Math.max(...allNotes.map(n => n.startTick + n.duration));
                    const totalDur = maxTick * (60 / playbackBpm) / tpb;
                    setDuration(totalDur);

                    const synth = getMidiSynth();
                    synth.playMidi(allNotes, playbackBpm, tpb, () => {
                        // Natural end — clear interval and reset state
                        if (midiProgressRef.current) {
                            clearInterval(midiProgressRef.current);
                            midiProgressRef.current = null;
                        }
                        setIsMidiPlaying(false);
                        setCurrentTime(0);
                    });
                    setIsMidiPlaying(true);

                    // Poll progress for playhead
                    if (midiProgressRef.current) clearInterval(midiProgressRef.current);
                    midiProgressRef.current = setInterval(() => {
                        if (synth.isPlaying()) {
                            setCurrentTime(synth.getProgress() * totalDur);
                        }
                    }, 50);
                }

                if (onPreview) onPreview(item);
            } catch (e) {
                console.error("MIDI Preview failed", e);
            }
            return;
        }

        // Set preview state immediately so the UI updates before audio loads
        setPreviewItem(item);
        setIsPlaying(true);

        try {
            const file = await getFileFromItem(item);
            if (playGenRef.current !== gen) return; // Stale — user navigated away
            const buffer = await window.audioEngine.loadAudio(file);
            if (playGenRef.current !== gen) return; // Stale
            setPreviewBuffer(buffer);
            setDuration(buffer.duration);
            setCurrentTime(0);
            setIsPlaying(true);
            window.audioEngine.play(buffer, () => {
                // Only reset state if this is still the active generation
                if (playGenRef.current === gen) {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }
            });
        } catch (e) {
            console.error("Preview failed", e);
            if (playGenRef.current === gen) setIsPlaying(false);
        }
    };

    const togglePlayPause = () => {
        // Handle MIDI playback toggle
        if (isMidiPlaying) {
            if (midiSynthRef.current) midiSynthRef.current.stop();
            if (midiProgressRef.current) clearInterval(midiProgressRef.current);
            midiProgressRef.current = null;
            setIsMidiPlaying(false);
            setCurrentTime(0);
            return;
        }

        if (!window.audioEngine) return;
        if (isPlaying) {
            window.audioEngine.stop();
            setIsPlaying(false);
            setCurrentTime(0);
            return;
        } else if (previewBuffer) {
            window.audioEngine.play(previewBuffer, () => {
                setIsPlaying(false);
                setCurrentTime(0);
            });
            setIsPlaying(true);
        } else if (previewItem?.type === 'midi' && previewItem?.midiNotes?.length > 0) {
            // Re-play MIDI at the same tempo used for initial preview
            const synth = getMidiSynth();
            const tpb = previewItem.ticksPerBeat || 480;
            const playbackBpm = previewItem._previewBpm || tempo || 120;
            const maxTick = Math.max(...previewItem.midiNotes.map(n => n.startTick + n.duration));
            const totalDur = maxTick * (60 / playbackBpm) / tpb;
            setDuration(totalDur);
            setCurrentTime(0);

            synth.playMidi(previewItem.midiNotes, playbackBpm, tpb, () => {
                if (midiProgressRef.current) {
                    clearInterval(midiProgressRef.current);
                    midiProgressRef.current = null;
                }
                setIsMidiPlaying(false);
                setCurrentTime(0);
            });
            setIsMidiPlaying(true);

            // Start progress polling for playhead
            if (midiProgressRef.current) clearInterval(midiProgressRef.current);
            midiProgressRef.current = setInterval(() => {
                if (synth.isPlaying()) {
                    setCurrentTime(synth.getProgress() * totalDur);
                }
            }, 50);
        }
    };

    const formatTime = (seconds) => {
        if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleDragStart = (e, item) => {
        // Stop any playing preview immediately when starting a drag
        stopAllPreviewAudio();
        setIsPlaying(false);
        setIsMidiPlaying(false);
        // Select/highlight the dragged file in the browser
        if (onFileSelect) onFileSelect(item);
        setPreviewItem(item);

        // item: { name, type, kind, handle, ... }
        e.dataTransfer.setData("application/json", JSON.stringify({
            name: item.name,
            path: item.path,
            type: item.type
        }));
        e.dataTransfer.effectAllowed = "copy";
        // Hide native drag text — use a tiny transparent element so only the timeline ghost shows
        const ghostEl = document.createElement('div');
        ghostEl.style.cssText = 'width:1px;height:1px;opacity:0;position:fixed;top:-100px;';
        document.body.appendChild(ghostEl);
        e.dataTransfer.setDragImage(ghostEl, 0, 0);
        requestAnimationFrame(() => document.body.removeChild(ghostEl));
        // Attach decoded audio/MIDI data if available (from preview playback) for ghost sizing
        const dragItem = { ...item };
        // Attach MIDI preview data if this was the previewed file
        if (item.midiNotes && item.midiNotes.length > 0 && /\.midi?$/i.test(item.name)) {
            const parser = new MIDIParser();
            const stepNotes = parser.convertToStepFormat(item.midiNotes);
            if (stepNotes.length > 0) {
                const maxStep = Math.max(...stepNotes.map(n => n.time + (n.duration || 1)));
                const bars = Math.max(1, Math.ceil(maxStep / 32));
                dragItem.midiPattern = stepNotes;
                dragItem.midiBars = bars;
                const noteMin = Math.min(...stepNotes.map(n => n.note));
                const noteMax = Math.max(...stepNotes.map(n => n.note));
                const nRange = Math.max(1, noteMax - noteMin + 1);
                const totalSteps = bars * 32;
                const rects = stepNotes.map(n => {
                    const x = (n.time / totalSteps) * 100;
                    const w = Math.max(0.3, ((n.duration || 1) / totalSteps) * 100);
                    const y = ((noteMax - n.note) / nRange) * 100;
                    const h = Math.max(1, (1 / nRange) * 100);
                    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#70a1ff" opacity="0.8" rx="0.2"/>`;
                }).join('');
                dragItem.midiGhostSvg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">${rects}</svg>`;
            }
        }
        if (previewBuffer && previewItem && previewItem.name === item.name && previewItem.path === item.path) {
            dragItem.audioBuffer = previewBuffer;
        }
        window.draggedItem = dragItem;

        // Eagerly decode audio for ghost waveform if not already decoded
        if (!dragItem.audioBuffer && /\.(wav|mp3|ogg|flac|aac|webm|m4a)$/i.test(item.name)) {
            (async () => {
                try {
                    const file = await getFileFromItem(item);
                    if (!file || window.draggedItem !== dragItem) return;
                    const ctx = window.audioEngine?.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                    const arrayBuf = await file.arrayBuffer();
                    const buf = await ctx.decodeAudioData(arrayBuf);
                    if (window.draggedItem === dragItem) {
                        dragItem.audioBuffer = buf;
                    }
                } catch (_) { /* ignore decode errors */ }
            })();
        }

        // Eagerly parse MIDI for ghost sizing and pattern SVG
        if (/\.midi?$/i.test(item.name)) {
            (async () => {
                try {
                    const file = await getFileFromItem(item);
                    if (!file || window.draggedItem !== dragItem) return;
                    const arrayBuf = await file.arrayBuffer();
                    const parser = new MIDIParser();
                    const midiData = await parser.parseMIDIFile(arrayBuf);
                    if (midiData?.tracks?.length > 0 && window.draggedItem === dragItem) {
                        const allNotes = [];
                        midiData.tracks.forEach(track => {
                            const notes = parser.eventsToNotes(track.events);
                            allNotes.push(...notes);
                        });
                        const stepNotes = parser.convertToStepFormat(allNotes);
                        if (stepNotes.length > 0) {
                            const maxStep = Math.max(...stepNotes.map(n => n.time + (n.duration || 1)));
                            const bars = Math.max(1, Math.ceil(maxStep / 32));
                            dragItem.midiPattern = stepNotes;
                            dragItem.midiBars = bars;
                            // Build pattern SVG for ghost preview
                            const noteMin = Math.min(...stepNotes.map(n => n.note));
                            const noteMax = Math.max(...stepNotes.map(n => n.note));
                            const nRange = Math.max(1, noteMax - noteMin + 1);
                            const totalSteps = bars * 32;
                            const rects = stepNotes.map(n => {
                                const x = (n.time / totalSteps) * 100;
                                const w = Math.max(0.3, ((n.duration || 1) / totalSteps) * 100);
                                const y = ((noteMax - n.note) / nRange) * 100;
                                const h = Math.max(1, (1 / nRange) * 100);
                                return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#70a1ff" opacity="0.8" rx="0.2"/>`;
                            }).join('');
                            dragItem.midiGhostSvg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">${rects}</svg>`;
                        }
                    }
                } catch (_) { /* ignore parse errors */ }
            })();
        }
    };

    // Filter Logic
    const filteredFiles = useMemo(() => {
        if (!searchQuery) return null; // If no search, show tree
        // If search, flat list of matches from ACROSS all loaded folders?
        // For now, let's search within loaded stuff.
        const matches = [];
        Object.entries(folderFiles).forEach(([folderName, files]) => {
            const search = (list) => {
                list.forEach(f => {
                    if (f.kind === 'file') {
                        if (f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (f.tags && f.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))) {
                            matches.push({ ...f, origin: folderName });
                        }
                    } else if (f.children) {
                        search(f.children);
                    }
                });
            };
            search(files);
        });
        return matches;
    }, [searchQuery, folderFiles]);

    // Total File Count
    const totalFileCount = useMemo(() => {
        let count = 0;
        const countFiles = (list) => {
            list.forEach(f => {
                if (f.kind === 'file') count++;
                else if (f.children) countFiles(f.children);
            });
        };
        Object.values(folderFiles).forEach(files => countFiles(files));
        return count;
    }, [folderFiles]);

    // Helper: collect direct audio files from a directory tree item
    const getDirectAudioFiles = (dirItem) => {
        if (!dirItem || !dirItem.children) return [];
        return dirItem.children.filter(c => c.kind === 'file' && c.type === 'audio');
    };

    // Helper: update selectedFolder to scope randomization to a specific subfolder
    const selectSubfolder = (dirItem) => {
        if (!onFolderSelect || !dirItem) return;
        const directAudio = getDirectAudioFiles(dirItem);
        onFolderSelect({
            name: dirItem.name,
            handle: dirItem.handle,
            samples: directAudio
        });
    };

    // Build a flat navigation list including folder headers and files.
    // Mirrors renderTree order exactly so arrow keys match visible layout.
    const navItems = useMemo(() => {
        if (explorerTab === 'local') {
            if (searchQuery && filteredFiles) return filteredFiles.map(f => ({ ...f, _nav: 'file', _tab: 'local' }));
            const result = [];
            const collect = (items, depth) => {
                items.forEach((item, idx) => {
                    if (item.kind === 'directory') {
                        const key = item.path || `${depth}-${idx}-${item.name}`;
                        result.push({ ...item, _nav: 'folder', _navKey: key, _tab: 'local' });
                        if (expandedFolders[key] && item.children) {
                            collect(item.children, depth + 1);
                        }
                    } else {
                        result.push({ ...item, _nav: 'file', _tab: 'local' });
                    }
                });
            };
            folders.forEach(folder => {
                result.push({ name: folder.name, kind: 'directory', _nav: 'folder', _navKey: `root/${folder.name}`, _tab: 'local' });
                if (expandedFolders[folder.name] && folderFiles[folder.name]) {
                    collect(folderFiles[folder.name], 0);
                }
            });
            return result;
        }
        if (explorerTab === 'factory') {
            const result = [];
            const collectFactory = (items, depth) => {
                items.forEach((item, idx) => {
                    if (item.kind === 'directory') {
                        const key = item.path || `factory-${depth}-${idx}`;
                        result.push({ ...item, _nav: 'folder', _navKey: key, _tab: 'factory' });
                        if (factoryExpanded[key] && item.children) {
                            collectFactory(item.children, depth + 1);
                        }
                    } else {
                        result.push({ ...item, _nav: 'file', _tab: 'factory' });
                    }
                });
            };
            collectFactory(factoryFolders, 0);
            return result;
        }
        return [];
    }, [explorerTab, searchQuery, filteredFiles, folders, folderFiles, expandedFolders, factoryFolders, factoryExpanded]);

    // (navActiveKey state moved to top of component, near other state declarations)

    // Arrow key navigation for file explorer
    const browserContainerRef = useRef(null);
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (explorerTab !== 'local' && explorerTab !== 'factory') return;
            const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'Enter'];
            if (!validKeys.includes(e.key)) return;
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
            if (document.querySelector('[data-piano-roll-modal]')) return;

            if (navItems.length === 0) return;

            // Find current index — check navActiveKey first, then previewItem
            let currentIdx = -1;
            if (navActiveKey) {
                currentIdx = navItems.findIndex(n =>
                    n._nav === 'folder' ? n._navKey === navActiveKey : (n.path || n.name) === navActiveKey
                );
            }
            if (currentIdx < 0 && previewItem) {
                currentIdx = navItems.findIndex(n =>
                    n._nav === 'file' && ((n.path && n.path === previewItem.path) || n.name === previewItem.name)
                );
            }

            const currentItem = currentIdx >= 0 ? navItems[currentIdx] : null;

            // Enter / ArrowRight: open folder or play file
            if (e.key === 'Enter' || e.key === 'ArrowRight') {
                e.preventDefault();
                if (!currentItem) return;
                if (currentItem._nav === 'folder') {
                    const fKey = currentItem._navKey;
                    if (currentItem._tab === 'factory') {
                        // Only open (not toggle) on ArrowRight; Enter toggles
                        if (e.key === 'ArrowRight' && factoryExpanded[fKey]) return;
                        setFactoryExpanded(prev => ({ ...prev, [fKey]: e.key === 'ArrowRight' ? true : !prev[fKey] }));
                    } else if (fKey.startsWith('root/')) {
                        const folderName = fKey.slice(5);
                        if (e.key === 'ArrowRight' && expandedFolders[folderName]) return;
                        const folder = folders.find(f => f.name === folderName);
                        if (folder) toggleFolder(folder);
                    } else {
                        if (e.key === 'ArrowRight' && expandedFolders[fKey]) return;
                        setExpandedFolders(prev => ({ ...prev, [fKey]: e.key === 'ArrowRight' ? true : !prev[fKey] }));
                        if (currentItem.handle) selectSubfolder(currentItem);
                    }
                    // Pre-fetch first audio file in the folder so it's cached for instant playback
                    if (currentItem.children) {
                        const firstAudio = currentItem.children.find(c => c.kind === 'file' && c.type === 'audio');
                        if (firstAudio && (firstAudio.handle || firstAudio.nativePath) && window.audioEngine) {
                            getFileFromItem(firstAudio).then(f => window.audioEngine.loadAudio(f)).catch(() => {});
                        }
                    }
                } else {
                    // File: play normally
                    if (currentItem._tab === 'factory') {
                        handleFactoryFileClick(currentItem);
                    } else {
                        handleFileClick(currentItem);
                    }
                }
                return;
            }

            // ArrowLeft: collapse folder (if on a folder) or play file in reverse (if on a file)
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (!currentItem) return;
                if (currentItem._nav === 'folder') {
                    const fKey = currentItem._navKey;
                    if (currentItem._tab === 'factory') {
                        if (factoryExpanded[fKey]) {
                            setFactoryExpanded(prev => ({ ...prev, [fKey]: false }));
                        }
                    } else if (fKey.startsWith('root/')) {
                        const folderName = fKey.slice(5);
                        if (expandedFolders[folderName]) {
                            setExpandedFolders(prev => ({ ...prev, [folderName]: false }));
                        }
                    } else if (expandedFolders[fKey]) {
                        setExpandedFolders(prev => ({ ...prev, [fKey]: false }));
                    }
                } else {
                    // On a file — play it in reverse
                    stopAllPreviewAudio();
                    setIsPlaying(false);
                    setIsMidiPlaying(false);
                    if (window.audioEngine) {
                        const playReversed = async (fileItem) => {
                            let buffer;
                            if (fileItem._tab === 'factory') {
                                buffer = fileItem.audioBuffer;
                            } else if (fileItem.handle || fileItem.nativePath) {
                                const file = await getFileFromItem(fileItem);
                                buffer = await window.audioEngine.loadAudio(file);
                            }
                            if (!buffer) return;
                            // Create a reversed copy without mutating the original or the buffer map
                            const ctx = window.audioEngine.audioContext;
                            const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
                            for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
                                const src = buffer.getChannelData(ch);
                                const dst = reversed.getChannelData(ch);
                                for (let j = 0; j < src.length; j++) {
                                    dst[j] = src[src.length - 1 - j];
                                }
                            }
                            setPreviewBuffer(reversed);
                            setPreviewItem(fileItem);
                            setDuration(reversed.duration);
                            setCurrentTime(0);
                            setIsPlaying(true);
                            window.audioEngine.play(reversed, () => {
                                setIsPlaying(false);
                                setCurrentTime(0);
                            });
                        };
                        playReversed(currentItem);
                    }
                }
                return;
            }

            // ArrowUp / ArrowDown: navigate the flat list
            e.preventDefault();
            let nextIdx;
            if (e.key === 'ArrowDown') {
                nextIdx = currentIdx < navItems.length - 1 ? currentIdx + 1 : currentIdx;
            } else {
                nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
            }

            const nextItem = navItems[nextIdx];
            if (!nextItem) return;

            // --- INSTANT: stop current audio + update visual highlight ---
            stopAllPreviewAudio();
            setIsPlaying(false);
            setIsMidiPlaying(false);

            // Cancel any pending debounced playback from a previous keypress
            if (navPlayDebounceRef.current) { clearTimeout(navPlayDebounceRef.current); navPlayDebounceRef.current = null; }

            if (nextItem._nav === 'folder') {
                pendingNavFileRef.current = null;
                setPreviewItem(null);
                setNavActiveKey(nextItem._navKey);
                const selector = `[data-nav-key="${CSS.escape(nextItem._navKey)}"]`;
                const el = document.querySelector(selector);
                if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                // Visual highlight instantly — audio plays on keyup (or after debounce fallback)
                pendingNavFileRef.current = nextItem;
                setNavActiveKey(nextItem.path || nextItem.name);
                setPreviewItem(nextItem);
                const selector = `[data-file-path="${CSS.escape(nextItem.path || nextItem.name)}"]`;
                const el = document.querySelector(selector);
                if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

                // Fallback debounce in case keyup doesn't fire (e.g. focus loss)
                navPlayDebounceRef.current = setTimeout(() => {
                    if (pendingNavFileRef.current) {
                        const pf = pendingNavFileRef.current;
                        pendingNavFileRef.current = null;
                        if (pf._tab === 'factory') {
                            handleFactoryFileClick(pf);
                        } else {
                            handleFileClick(pf);
                        }
                    }
                }, 300);
            }

            // --- LOOKAHEAD: pre-fetch the next 2 files in navigation direction ---
            const dir = e.key === 'ArrowDown' ? 1 : -1;
            for (let ahead = 1; ahead <= 2; ahead++) {
                const peekIdx = nextIdx + dir * ahead;
                if (peekIdx < 0 || peekIdx >= navItems.length) break;
                const peekItem = navItems[peekIdx];
                if (peekItem && peekItem._nav === 'file' && (peekItem.handle || peekItem.nativePath)) {
                    getFileFromItem(peekItem)
                        .then(f => window.audioEngine && window.audioEngine.loadAudio(f))
                        .catch(() => {});
                }
            }
        };

        // On keyup: immediately play the pending file (user released the arrow key)
        const handleKeyUp = (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            if (!pendingNavFileRef.current) return;
            // Cancel the fallback debounce — we're playing now
            if (navPlayDebounceRef.current) { clearTimeout(navPlayDebounceRef.current); navPlayDebounceRef.current = null; }
            const fileToPlay = pendingNavFileRef.current;
            pendingNavFileRef.current = null;
            if (fileToPlay._tab === 'factory') {
                handleFactoryFileClick(fileToPlay);
            } else {
                handleFileClick(fileToPlay);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (navPlayDebounceRef.current) { clearTimeout(navPlayDebounceRef.current); navPlayDebounceRef.current = null; }
        };
    }, [explorerTab, navItems, previewItem, navActiveKey, factoryExpanded]);

    // Recursive Tree Renderer
    const renderTree = (items, depth = 0, parentFolder = null) => {
        return items.map((item, idx) => {
            const paddingLeft = depth * 18 + 22;
            if (item.kind === 'directory') {
                const key = item.path || `${depth}-${idx}-${item.name}`;
                const isExpanded = expandedFolders[key];

                return (
                    <div key={key}>
                        <div
                            data-nav-key={key}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    item
                                });
                            }}
                            style={(() => {
                                const isNavActive = navActiveKey === key;
                                return {
                                    cursor: 'pointer',
                                    color: (isNavActive || isExpanded) ? (theme.accent || ac) : (isDark ? '#eee' : '#555'),
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: `6px 8px 6px ${paddingLeft}px`,
                                    backgroundColor: isNavActive ? 'rgba(255, 140, 50, 0.2)' : (isExpanded ? 'rgba(255, 140, 50, 0.06)' : 'transparent'),
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    transition: 'all 0.15s ease',
                                    borderLeft: isNavActive ? `2px solid ${theme.accent || ac}` : (isExpanded ? `2px solid ${(theme.accent || ac)}44` : '2px solid transparent'),
                                    marginBottom: '1px'
                                };
                            })()}
                            onClick={() => {
                                // Stop any playing audio when clicking a folder
                                if (window.audioEngine) window.audioEngine.stop();
                                if (midiSynthRef.current) midiSynthRef.current.stop();
                                if (midiProgressRef.current) { clearInterval(midiProgressRef.current); midiProgressRef.current = null; }
                                setIsPlaying(false);
                                setIsMidiPlaying(false);
                                setNavActiveKey(key);

                                setExpandedFolders(prev => ({
                                    ...prev,
                                    [key]: !isExpanded
                                }));
                                // Scope randomization to this subfolder's direct audio files
                                selectSubfolder(item);
                            }}
                            onMouseEnter={(e) => {
                                if (navActiveKey !== key && !isExpanded) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 140, 50, 0.08)' : 'rgba(255, 140, 50, 0.06)';
                            }}
                            onMouseLeave={(e) => {
                                if (navActiveKey !== key && !isExpanded) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <span style={{
                                marginRight: '8px',
                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'inline-block',
                                fontSize: '8px',
                                opacity: 0.5
                            }}>▶</span>
                            <span style={{
                                marginRight: '10px',
                                fontSize: '14px',
                                filter: isExpanded ? 'grayscale(0)' : 'grayscale(1)',
                                opacity: isExpanded ? 1 : 0.7
                            }}>
                                {isExpanded ? '📂' : '📁'}
                            </span>
                            <span style={{
                                fontWeight: isExpanded ? '700' : '400',
                                letterSpacing: '0.3px'
                            }}>
                                {item.name.toUpperCase()}
                            </span>
                        </div>
                        {isExpanded && (
                            <div style={{ marginLeft: 0 }}>
                                {renderTree(item.children || [], depth + 1, item)}
                            </div>
                        )}
                    </div>
                );
            } else {
                const isCurrent = previewItem?.path === item.path || previewItem?.name === item.name;
                const progress = isCurrent && duration > 0 ? (currentTime / duration) * 100 : 0;

                return (
                    <div
                        key={item.path || idx}
                        data-file-path={item.path || item.name}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onClick={() => {
                            handleFileClick(item);
                            // Scope randomization to the parent folder this file lives in
                            if (parentFolder) selectSubfolder(parentFolder);
                        }}
                        onContextMenu={(e) => {
                            if (item.type === 'audio' || item.type === 'midi') {
                                e.preventDefault();
                                // Just highlight without playing
                                handleFileClick(item, false);

                                setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    item,
                                    isFile: true
                                });
                            }
                        }}

                        style={{
                            paddingLeft,
                            cursor: 'pointer',
                            color: isCurrent ? (theme.accent || ac) : (theme.textDim || '#888'),
                            fontSize: '11px',
                            fontWeight: isCurrent ? '700' : '400',
                            padding: '6px 10px 6px ' + paddingLeft + 'px',
                            display: 'flex',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: isCurrent ? (isDark ? hexToRgba(ac, 0.08) : hexToRgba(ac, 0.15)) : 'transparent',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            borderLeft: isCurrent ? `2px solid ${theme.accent || ac}` : '2px solid transparent'
                        }}
                    >
                        {/* Progress Background (Bluish Overlay) */}
                        {isCurrent && (
                            <div style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${progress}%`,
                                backgroundColor: 'rgba(0, 212, 255, 0.15)',
                                zIndex: 0, pointerEvents: 'none',
                                transition: 'width 0.1s linear'
                            }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', overflow: 'hidden' }}>
                            <span style={{
                                position: 'relative',
                                zIndex: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1
                            }}>
                                {item.name}
                            </span>
                            {(item.type === 'audio' || item.type === 'midi') && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onAddToFileSlot) onAddToFileSlot(item);
                                    }}
                                    style={{
                                        background: isDark ? hexToRgba(ac, 0.15) : ac,
                                        border: 'none',
                                        borderRadius: '4px',
                                        width: '20px',
                                        height: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isDark ? ac : '#fff',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        opacity: 0.8,
                                        zIndex: 2,
                                        transition: 'opacity 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.opacity = '1'}
                                    onMouseLeave={(e) => e.target.style.opacity = '0.8'}
                                    title={item.type === 'audio' ? t('browser.addToActiveGenerator') : t('browser.addMidiToGenerator')}
                                >
                                    +
                                </button>
                            )}
                        </div>
                    </div>
                );
            }
        });
    };

    const handleGenerateClick = async (item) => {
        setContextMenu(null);
        if (!onGenerateFromFolder) return;

        // Stop all playback before analysis
        if (window.audioEngine) window.audioEngine.stop();
        if (window.sequencer) window.sequencer.stop();
        if (midiSynthRef.current) midiSynthRef.current.stop();
        if (midiProgressRef.current) { clearInterval(midiProgressRef.current); midiProgressRef.current = null; }
        setIsPlaying(false);
        setIsMidiPlaying(false);

        // Create abort controller for this analysis
        analyzeAbortRef.current = new AbortController();
        const signal = analyzeAbortRef.current.signal;

        setIsProcessing(true);
        setScanProgress({ percent: 0, path: t('browser.collectingFiles'), status: t('browser.preparingAnalysis') });

        try {
            let characteristics;

            // Check cache first (valid for 5 minutes)
            const cached = analysisCacheRef.current[item.name];
            if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
                console.log('[Browser] Using cached analysis for:', item.name);
                characteristics = cached.results;
                setScanProgress({ percent: 100, path: t('browser.usingCachedAnalysis'), status: t('browser.cacheHit') });
            } else {
                // Collect all files recursively
                const allFiles = [];
                const collect = async (handle) => {
                    if (signal.aborted) return;
                    for await (const entry of handle.values()) {
                        if (signal.aborted) return;
                        if (entry.kind === 'file') {
                            const file = await entry.getFile();
                            allFiles.push(file);
                        } else if (entry.kind === 'directory') {
                            await collect(entry);
                        }
                    }
                };

                await collect(item.handle);
                if (signal.aborted) return;

                if (allFiles.length === 0) {
                    console.warn('[Browser] Folder is empty:', item.name);
                    alert(t('browser.noFilesInFolder'));
                    return;
                }

                const midiCount = allFiles.filter(f => /\.midi?$/i.test(f.name)).length;
                const audioCount = allFiles.filter(f => /\.(wav|mp3|ogg|m4a)$/i.test(f.name)).length;
                console.log(`[Browser] Analyzing folder "${item.name}": ${midiCount} MIDI, ${audioCount} audio, ${allFiles.length} total files`);

                // Run analysis (blocks until complete, but respects abort signal)
                const { FolderAnalyzer } = await import('./FolderAnalyzer');
                const analyzer = new FolderAnalyzer();
                characteristics = await analyzer.analyzeFolder(allFiles, item.name, (progress) => {
                    setScanProgress(progress);
                }, signal);

                if (signal.aborted) return;

                if (!characteristics) {
                    console.error('[Browser] Analysis returned null for:', item.name);
                    alert(t('browser.analysisNoResults'));
                    return;
                }

                // Cache the results
                analysisCacheRef.current[item.name] = { results: characteristics, timestamp: Date.now() };
                console.log('[Browser] Analysis complete and cached for:', item.name);
            }

            if (signal.aborted) return;

            // Signal generation phase
            setScanProgress({ percent: 100, path: t('browser.generatingPatterns'), status: t('browser.generatingFromAnalysis') });

            // Pass { folder, characteristics } — matches what handleGenerateFromFolder expects
            await onGenerateFromFolder({ folder: item, characteristics });

        } catch (e) {
            if (e?.name === 'AbortError') {
                console.log('[Browser] Analysis cancelled by user');
            } else {
                console.error('[Browser] Folder analysis/generation failed:', e);
                alert(t('browser.analysisFailed', { error: e.message || '' }));
            }
        } finally {
            analyzeAbortRef.current = null;
            setIsProcessing(false);
        }
    };

    return (
        <div style={{
            width: '100%',
            backgroundColor: isDark ? 'rgba(20, 20, 25, 0.9)' : '#fff',
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
            backdropFilter: 'blur(10px)',
            boxShadow: '10px 0 30px rgba(0,0,0,0.5)'
        }}>
            {/* Hidden fallback input for adding folders when showDirectoryPicker is unavailable */}
            <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                style={{ display: 'none' }}
                onChange={handleFolderInputChange}
            />
            {isProcessing && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: theme.text, padding: '20px', textAlign: 'center'
                }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', color: theme.accent }}>
                        {scanProgress.status.toUpperCase()}
                    </div>

                    <div style={{
                        width: '100%', height: '10px', backgroundColor: '#333',
                        borderRadius: '5px', overflow: 'hidden', marginBottom: '10px'
                    }}>
                        <div style={{
                            width: `${scanProgress.percent}%`, height: '100%',
                            backgroundColor: '#28a745', // Windows-style green
                            transition: 'width 0.05s linear', // Smoother progress
                            boxShadow: '0 0 10px rgba(40, 167, 69, 0.5)'
                        }} />
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#28a745' }}>
                        {scanProgress.percent.toFixed(2)}%
                    </div>

                    <div style={{
                        fontSize: '10px', color: theme.textDim, wordBreak: 'break-all',
                        maxHeight: '40px', overflow: 'hidden', lineBreak: 'anywhere'
                    }}>
                        {scanProgress.path}
                    </div>

                    <button
                        onClick={() => {
                            // Cancel folder analysis
                            if (analyzeAbortRef.current) {
                                analyzeAbortRef.current.abort();
                                analyzeAbortRef.current = null;
                            }
                            // Cancel folder scan
                            if (scanAbortRef.current) {
                                scanAbortRef.current.abort();
                                scanAbortRef.current = null;
                            }
                            setIsProcessing(false);
                            activeScanCount.current = 0;
                        }}
                        style={{
                            marginTop: '16px',
                            padding: '8px 24px',
                            background: 'rgba(255, 75, 75, 0.15)',
                            border: '1px solid #ff4b4b',
                            borderRadius: '6px',
                            color: '#ff4b4b',
                            fontSize: '11px',
                            fontWeight: '800',
                            letterSpacing: '1px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 75, 75, 0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 75, 75, 0.15)'; }}
                    >
                        {t('browser.cancel')}
                    </button>
                </div>
            )}

            {isAnalyzing && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', padding: '20px', textAlign: 'center',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: ac, letterSpacing: '2px', marginBottom: '16px' }}>
                        {batchExtractState ? t('browser.extractingMidiFromFolder') : t('browser.analyzingMidiDna')}
                    </div>
                    {batchExtractState && (
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '10px' }}>
                            {t('browser.batchProgress', { current: batchExtractState.current, total: batchExtractState.total })}
                        </div>
                    )}
                    {batchExtractState && batchExtractState.fileName && (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {batchExtractState.fileName}
                        </div>
                    )}
                    <div style={{
                        width: '180px', height: '6px', borderRadius: '3px',
                        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        overflow: 'hidden', marginBottom: '10px'
                    }}>
                        <div style={{
                            width: `${extractProgress}%`, height: '100%', borderRadius: '3px',
                            background: ac,
                            transition: batchExtractState ? 'width 0.3s ease' : 'none'
                        }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: batchExtractState ? '12px' : 0 }}>
                        {extractProgress}%
                    </div>
                    {batchExtractState && (
                        <button
                            onClick={() => {
                                if (batchExtractAbortRef.current) {
                                    batchExtractAbortRef.current.abort();
                                }
                            }}
                            style={{
                                padding: '6px 20px',
                                background: 'rgba(255, 75, 75, 0.15)',
                                border: '1px solid rgba(255, 75, 75, 0.4)',
                                borderRadius: '6px',
                                color: '#ff4b4b',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                letterSpacing: '0.5px'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 75, 75, 0.3)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 75, 75, 0.15)'; }}
                        >
                            {t('common.cancel')}
                        </button>
                    )}
                </div>
            )}

            {/* Header */}
            <div style={{
                padding: '16px 18px',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#eee'}`,
                background: isDark ? 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, transparent 100%)' : '#f8f9fa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div data-tour-id="tour-browser" style={{
                    fontWeight: '900',
                    fontSize: '11px',
                    color: theme.accent || ac,
                    letterSpacing: '2px',
                    textShadow: `0 0 10px ${(theme.accent || ac)}44`
                }}>
                    {t('browser.title')}
                </div>
                <div style={{
                    fontSize: '10px',
                    color: theme.textDim || '#888',
                    fontWeight: '700',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                }}>
                    {totalFileCount}
                </div>
            </div>

            {/* ===== Tabs ===== */}
            <div style={{
                display: 'flex',
                borderBottom: `2px solid ${isDark ? '#333' : '#ddd'}`,
                flexShrink: 0
            }}>
                <button
                    onClick={() => setExplorerTab('local')}
                    style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: explorerTab === 'local' ? `2px solid ${theme.accent || ac}` : '2px solid transparent',
                        color: explorerTab === 'local' ? (theme.accent || ac) : (isDark ? '#888' : '#999'),
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        marginBottom: '-2px',
                        transition: 'all 0.2s ease',
                        backgroundColor: explorerTab === 'local' ? hexToRgba(ac, 0.08) : 'transparent'
                    }}
                >
                    📁 {t('browser.local')}
                </button>
                <button
                    onClick={() => setExplorerTab('factory')}
                    style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: explorerTab === 'factory' ? `2px solid ${theme.accent || ac}` : '2px solid transparent',
                        color: explorerTab === 'factory' ? (theme.accent || ac) : (isDark ? '#888' : '#999'),
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        marginBottom: '-2px',
                        transition: 'all 0.2s ease',
                        backgroundColor: explorerTab === 'factory' ? hexToRgba(ac, 0.08) : 'transparent'
                    }}
                >
                    🏭 {t('browser.factory')}
                    {factoryLoading && <span style={{ color: acSec, fontSize: '8px', marginLeft: '4px', animation: 'pulse 1s infinite' }}>●</span>}
                </button>
                <button
                    onClick={() => setExplorerTab('presets')}
                    style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: explorerTab === 'presets' ? `2px solid ${ac}` : '2px solid transparent',
                        color: explorerTab === 'presets' ? ac : (isDark ? '#888' : '#999'),
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        marginBottom: '-2px',
                        transition: 'all 0.2s ease',
                        backgroundColor: explorerTab === 'presets' ? hexToRgba(ac, 0.08) : 'transparent'
                    }}
                >
                    🎛️ {t('browser.presets')}
                </button>
                <button
                    onClick={() => setExplorerTab('plugins')}
                    style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: explorerTab === 'plugins' ? `2px solid ${acSec || ac}` : '2px solid transparent',
                        color: explorerTab === 'plugins' ? (acSec || ac) : (isDark ? '#888' : '#999'),
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        marginBottom: '-2px',
                        transition: 'all 0.2s ease',
                        backgroundColor: explorerTab === 'plugins' ? hexToRgba(acSec || ac, 0.08) : 'transparent'
                    }}
                >
                    🔌 {t('browser.plugins')}
                    {!vst3InitialScanDone && <span style={{ color: '#ffa502', fontSize: '8px', marginLeft: '4px', animation: 'pulse 1s infinite' }}>⏳</span>}
                    {vst3InitialScanDone && vst3Scanning && <span style={{ color: acSec, fontSize: '8px', marginLeft: '4px', animation: 'pulse 1s infinite' }}>●</span>}
                </button>
            </div>

            {/* Search */}
            <div style={{ padding: '10px' }}>
                <input
                    type="text"
                    placeholder={explorerTab === 'local' ? t('browser.searchLocal') : t('browser.searchFactory')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        backgroundColor: isDark ? '#111' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        color: isDark ? '#fff' : '#333',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        outline: 'none',
                        fontSize: '12px'
                    }}
                />
            </div>

            {/* Content List */}
            <div
                className="custom-scrollbar"
                style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px 10px' }}
            >
                <style>{`
                        .custom-scrollbar::-webkit-scrollbar {
                            width: 8px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: ${theme.bg || '#0a0a0a'};
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: ${theme.panelBorder || '#333'};
                            border-radius: 4px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: ${theme.accent || ac};
                        }
                        @keyframes pulse {
                            0%, 100% { opacity: 0.5; }
                            50% { opacity: 1; }
                        }
                    `}</style>

                {/* ===== FACTORY SAMPLES TAB ===== */}
                {explorerTab === 'factory' && (
                    <div>
                        {/* Factory Loading Progress */}
                        {factoryLoading && (
                            <div style={{
                                padding: '16px 8px',
                                borderBottom: `1px solid ${isDark ? '#333' : '#ddd'}`,
                                marginBottom: '10px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '14px', animation: 'spin 1.5s linear infinite' }}>⏳</span>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#e0e0e0' : '#333' }}>
                                        {factoryLoadProgress.status}
                                    </span>
                                </div>
                                <div style={{
                                    width: '100%', height: '6px',
                                    backgroundColor: isDark ? '#252525' : '#e0e0e0',
                                    borderRadius: '3px', overflow: 'hidden', marginBottom: '8px'
                                }}>
                                    <div style={{
                                        width: factoryLoadProgress.total > 0 ? `${(factoryLoadProgress.loaded / factoryLoadProgress.total) * 100}%` : '0%',
                                        height: '100%',
                                        background: acGrad,
                                        borderRadius: '3px',
                                        transition: 'width 0.15s ease-out',
                                        boxShadow: `0 0 8px ${hexToRgba(ac, 0.4)}`
                                    }} />
                                </div>
                                <div style={{ fontSize: '11px', color: ac, fontWeight: '700', marginBottom: '2px' }}>
                                    {t('browser.filesCount', { loaded: factoryLoadProgress.loaded, total: factoryLoadProgress.total })}
                                </div>
                                <div style={{
                                    fontSize: '10px', color: isDark ? '#666' : '#999',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {factoryLoadProgress.currentFile}
                                </div>
                                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                            </div>
                        )}
                        {/* Factory Folder Tree */}
                        {factoryFolders.length > 0 && renderFactoryTree(factoryFolders)}
                        {!factoryLoading && factoryFolders.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: isDark ? '#666' : '#999', fontSize: '12px' }}>
                                {t('browser.noFactorySamples')}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== LOCAL SAMPLES TAB ===== */}
                {explorerTab === 'local' && (
                    <div>
                        {/* Add Folder Button */}
                        <div
                            onClick={handleAddFolder}
                            style={{
                                padding: '8px', marginBottom: '10px',
                                border: `1.5px dashed ${isDark ? '#444' : '#ccc'}`, borderRadius: '6px',
                                textAlign: 'center', cursor: 'pointer',
                                color: isDark ? '#888' : '#666',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                letterSpacing: '0.5px'
                            }}
                        >
                            {t('browser.addLocalFolder')}
                        </div>

                        {/* Search Results */}
                        {searchQuery ? (
                            <div>
                                <div style={{ fontSize: '10px', color: theme.textDim, marginBottom: '5px' }}>{t('browser.searchResults')}</div>
                                {filteredFiles.map((f, i) => {
                                    const isCurrent = previewItem?.path === f.path || previewItem?.name === f.name;
                                    return (
                                        <div
                                            key={i}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, f)}
                                            onClick={() => handleFileClick(f)}
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                cursor: 'pointer',
                                                backgroundColor: isCurrent ? hexToRgba(ac, 0.08) : 'transparent',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                borderLeft: isCurrent ? `2px solid ${theme.accent || ac}` : '2px solid transparent'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', overflow: 'hidden' }}>
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <div style={{
                                                        color: isCurrent ? (theme.accent || ac) : (theme.text || '#eee'),
                                                        fontSize: '11px',
                                                        fontWeight: isCurrent ? '700' : '400',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {f.name}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '9px',
                                                        color: theme.textDim || '#666',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        {f.origin}
                                                    </div>
                                                </div>
                                                {f.type === 'audio' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (onAddToFileSlot) onAddToFileSlot(f);
                                                        }}
                                                        style={{
                                                            background: isDark ? hexToRgba(ac, 0.15) : ac,
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            width: '20px',
                                                            height: '20px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: isDark ? ac : '#fff',
                                                            fontSize: '14px',
                                                            fontWeight: 'bold',
                                                            cursor: 'pointer',
                                                            opacity: 0.8,
                                                            zIndex: 2,
                                                            transition: 'opacity 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.opacity = '1'}
                                                        onMouseLeave={(e) => e.target.style.opacity = '0.8'}
                                                        title={t('browser.addToActiveDrumSlot')}
                                                    >
                                                        +
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Folders List */
                            folders.map(folder => (
                                <div key={folder.name} style={{ marginBottom: '8px' }}>
                                    <div
                                        data-nav-key={`root/${folder.name}`}
                                        onClick={() => toggleFolder(folder)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenu({ x: e.clientX, y: e.clientY, item: folder });
                                        }}
                                        style={(() => {
                                            const isNavActive = navActiveKey === `root/${folder.name}`;
                                            const isExp = expandedFolders[folder.name];
                                            return {
                                                padding: '8px 12px',
                                                backgroundColor: isNavActive ? hexToRgba(ac, 0.25) : (isExp ? (isDark ? hexToRgba(ac, 0.06) : hexToRgba(ac, 0.1)) : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5')),
                                                color: (isNavActive || isExp) ? (theme.accent || ac) : (isDark ? '#fff' : '#333'),
                                                cursor: 'pointer',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                fontWeight: '800',
                                                fontSize: '12px',
                                                letterSpacing: '0.5px',
                                                transition: 'all 0.2s ease',
                                                border: isNavActive ? `1px solid ${theme.accent || ac}` : (isExp ? `1px solid ${theme.accent || ac}44` : '1px solid transparent')
                                            };
                                        })()}
                                    >
                                        <span style={{
                                            marginRight: '10px',
                                            transform: expandedFolders[folder.name] ? 'rotate(90deg)' : 'none',
                                            transition: 'transform 0.2s',
                                            fontSize: '8px',
                                            opacity: 0.5
                                        }}>▶</span>
                                        <span style={{ marginRight: '10px', fontSize: '16px' }}>📚</span>
                                        {folder.name.toUpperCase()}
                                    </div>
                                    {expandedFolders[folder.name] && folderFiles[folder.name] && (
                                        <div style={{
                                            marginLeft: '12px',
                                            marginTop: '4px',
                                            borderLeft: `1px solid ${expandedFolders[folder.name] ? (theme.accent || ac) + '33' : '#333'}`,
                                            paddingLeft: '4px'
                                        }}>
                                            {renderTree(folderFiles[folder.name])}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ===== PRESETS TAB ===== */}
                {explorerTab === 'presets' && (
                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                            onClick={() => setShowSaveDialog(true)}
                            style={{
                                padding: '12px',
                                background: acGrad,
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                letterSpacing: '0.5px',
                                transition: 'all 0.2s'
                            }}
                        >
                            💾 {t('browser.saveCurrentPreset')}
                        </button>
                        <button
                            onClick={() => setShowPresetBrowser(true)}
                            style={{
                                padding: '12px',
                                background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0',
                                border: `1px solid ${isDark ? '#333' : '#ccc'}`,
                                borderRadius: '8px',
                                color: isDark ? '#e0e0e0' : '#333',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                letterSpacing: '0.5px',
                                transition: 'all 0.2s'
                            }}
                        >
                            📂 {t('browser.browseLoadPresets')}
                        </button>
                        <div style={{ fontSize: '10px', color: isDark ? '#555' : '#999', textAlign: 'center', marginTop: '8px', lineHeight: 1.5 }}>
                            {t('browser.presetsDesc')}
                        </div>
                    </div>
                )}

                {/* ===== PLUGINS TAB ===== */}
                {explorerTab === 'plugins' && (
                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* ── Built-in Audio Effects ── */}
                        <div style={{
                            background: isDark ? 'rgba(255,255,255,0.03)' : '#f8f8fa',
                            borderRadius: '6px',
                            border: `1px solid ${isDark ? '#2a2a3e' : '#e0e0e0'}`,
                            overflow: 'hidden',
                        }}>
                            <div
                                onClick={() => toggleBuiltinSection('audioEffects')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 10px', cursor: 'pointer', userSelect: 'none',
                                    background: isDark ? 'rgba(255,255,255,0.04)' : '#f0f0f4',
                                }}
                            >
                                <span style={{
                                    fontSize: '9px', color: isDark ? '#888' : '#666',
                                    transform: builtinSections.audioEffects ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s', display: 'inline-block',
                                }}>▶</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#ccc' : '#444', letterSpacing: '0.5px' }}>
                                    🔊 {t('browser.audioEffects')}
                                </span>
                                <span style={{ fontSize: '9px', color: isDark ? '#555' : '#aaa', marginLeft: 'auto' }}>
                                    {EFFECT_CATEGORIES.reduce((n, c) => n + c.effects.length, 0)}
                                </span>
                            </div>
                            {builtinSections.audioEffects && (
                                <div style={{ padding: '2px 0' }}>
                                    {EFFECT_CATEGORIES.map(cat => (
                                        <div key={cat.name}>
                                            <div
                                                onClick={() => toggleBuiltinCat(cat.name)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '4px 10px 4px 24px',
                                                    cursor: 'pointer', userSelect: 'none',
                                                }}
                                            >
                                                <span style={{
                                                    fontSize: '8px', color: isDark ? '#777' : '#888',
                                                    transform: builtinCatExpanded[cat.name] ? 'rotate(90deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.15s', display: 'inline-block',
                                                }}>▶</span>
                                                <span style={{ fontSize: '10px' }}>{CATEGORY_ICONS[cat.name] || '🔌'}</span>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: '600',
                                                    color: isDark ? '#aaa' : '#555',
                                                }}>
                                                    {cat.name}
                                                </span>
                                                <span style={{ fontSize: '8px', color: isDark ? '#555' : '#bbb', marginLeft: 'auto' }}>
                                                    {cat.effects.length}
                                                </span>
                                            </div>
                                            {builtinCatExpanded[cat.name] && cat.effects.map(fx => (
                                                <div
                                                    key={fx.type}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('application/x-wavloom-effect', fx.type);
                                                        e.dataTransfer.effectAllowed = 'copy';
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        padding: '3px 10px 3px 48px',
                                                        cursor: 'grab', userSelect: 'none',
                                                        fontSize: '10px', fontWeight: '500',
                                                        color: isDark ? '#c0c0c0' : '#444',
                                                        transition: 'background 0.1s',
                                                        borderRadius: '2px',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = hexToRgba(ac, 0.1);
                                                        e.currentTarget.style.color = ac;
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.color = isDark ? '#c0c0c0' : '#444';
                                                    }}
                                                >
                                                    <span style={{ fontSize: '8px', color: isDark ? '#555' : '#bbb' }}>◆</span>
                                                    <span style={{ flex: 1 }}>{fx.label}</span>
                                                    {onAddEffectToTrack && (
                                                        <span
                                                            onClick={(e) => { e.stopPropagation(); onAddEffectToTrack(fx.type); }}
                                                            title={t('browser.addEffectToTrack', { name: fx.label })}
                                                            style={{
                                                                width: 14, height: 14, borderRadius: '3px',
                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                cursor: 'pointer', fontSize: '11px', fontWeight: '700',
                                                                color: isDark ? '#555' : '#bbb',
                                                                background: 'transparent',
                                                                transition: 'color 0.1s, background 0.1s',
                                                                flexShrink: 0,
                                                            }}
                                                            onMouseEnter={(e2) => {
                                                                e2.currentTarget.style.color = ac;
                                                                e2.currentTarget.style.background = hexToRgba(ac, 0.15);
                                                            }}
                                                            onMouseLeave={(e2) => {
                                                                e2.currentTarget.style.color = isDark ? '#555' : '#bbb';
                                                                e2.currentTarget.style.background = 'transparent';
                                                            }}
                                                        >+</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Built-in MIDI Effects (placeholder) ── */}
                        <div style={{
                            background: isDark ? 'rgba(255,255,255,0.03)' : '#f8f8fa',
                            borderRadius: '6px',
                            border: `1px solid ${isDark ? '#2a2a3e' : '#e0e0e0'}`,
                            overflow: 'hidden',
                        }}>
                            <div
                                onClick={() => toggleBuiltinSection('midiEffects')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 10px', cursor: 'pointer', userSelect: 'none',
                                    background: isDark ? 'rgba(255,255,255,0.04)' : '#f0f0f4',
                                }}
                            >
                                <span style={{
                                    fontSize: '9px', color: isDark ? '#888' : '#666',
                                    transform: builtinSections.midiEffects ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s', display: 'inline-block',
                                }}>▶</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#ccc' : '#444', letterSpacing: '0.5px' }}>
                                    🎹 {t('browser.midiEffects')}
                                </span>
                            </div>
                            {builtinSections.midiEffects && (
                                <div style={{ padding: '8px 10px 8px 24px', color: isDark ? '#555' : '#aaa', fontSize: '10px', fontStyle: 'italic' }}>
                                    {t('browser.midiEffectsComingSoon')}
                                </div>
                            )}
                        </div>

                        {/* ── VST3 Plugins Section ── */}
                        {/* Desktop-only check */}
                        {!window.electronAPI?.isElectron ? (
                            <div style={{
                                padding: '20px',
                                textAlign: 'center',
                                color: isDark ? '#666' : '#999',
                                fontSize: '12px',
                                lineHeight: 1.6
                            }}>
                                🔌 {t('browser.vst3DesktopOnly')}
                                <br /><br />
                                <span style={{ fontSize: '10px', color: isDark ? '#555' : '#aaa' }}>
                                    {t('browser.vst3RunCommand', { command: 'npm run electron:dev' })}
                                </span>
                            </div>
                        ) : !vst3InitialScanDone ? (
                            /* Locked state: initial scan in progress */
                            <div style={{
                                padding: '30px 20px',
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '12px',
                            }}>
                                <div style={{
                                    fontSize: '28px',
                                    animation: 'pulse 1.5s infinite',
                                }}>🔌</div>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: isDark ? '#ccc' : '#444',
                                }}>
                                    {t('browser.scanningVst3')}
                                </div>
                                <div style={{
                                    width: '80%',
                                    height: '4px',
                                    background: isDark ? 'rgba(255,255,255,0.06)' : '#eee',
                                    borderRadius: '2px',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        width: '40%',
                                        height: '100%',
                                        background: acGrad || ac,
                                        borderRadius: '2px',
                                        animation: 'shimmer 1.5s ease-in-out infinite',
                                    }} />
                                </div>
                                <div style={{
                                    fontSize: '9px',
                                    color: isDark ? '#555' : '#aaa',
                                }}>
                                    {t('browser.initialScanInProgress')}
                                </div>
                                <style>{`
                                    @keyframes shimmer {
                                        0% { transform: translateX(-100%); }
                                        100% { transform: translateX(350%); }
                                    }
                                `}</style>
                            </div>
                        ) : (
                            <>
                                {/* Custom Scan Folders */}
                                <div style={{
                                    padding: '8px',
                                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f8f8fa',
                                    borderRadius: '6px',
                                    border: `1px solid ${isDark ? '#2a2a3e' : '#e0e0e0'}`
                                }}>
                                    <div style={{
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        color: isDark ? '#888' : '#666',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        marginBottom: '6px'
                                    }}>
                                        {t('browser.customScanFolders')}
                                    </div>
                                    {[0, 1, 2].map(idx => (
                                        <div key={idx} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            marginBottom: idx < 2 ? '4px' : 0
                                        }}>
                                            <div style={{
                                                flex: 1,
                                                fontSize: '10px',
                                                color: vst3CustomPaths[idx] ? (isDark ? '#ccc' : '#333') : (isDark ? '#555' : '#aaa'),
                                                padding: '4px 6px',
                                                background: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                                                borderRadius: '3px',
                                                border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                minHeight: '22px',
                                                lineHeight: '14px'
                                            }}>
                                                {vst3CustomPaths[idx] || t('browser.slotNotSet', { slot: idx + 1 })}
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    const folder = await window.electronAPI.vst3.browseForFolder();
                                                    if (folder) {
                                                        const newPaths = [...vst3CustomPaths];
                                                        newPaths[idx] = folder;
                                                        setVst3CustomPaths(newPaths);
                                                        window.electronAPI.vst3.setCustomPaths(newPaths);
                                                    }
                                                }}
                                                style={{
                                                    padding: '3px 8px',
                                                    fontSize: '9px',
                                                    fontWeight: '700',
                                                    background: isDark ? 'rgba(255,255,255,0.08)' : '#eee',
                                                    border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                                                    borderRadius: '3px',
                                                    color: isDark ? '#ccc' : '#555',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {t('common.browse')}
                                            </button>
                                            {vst3CustomPaths[idx] && (
                                                <button
                                                    onClick={() => {
                                                        const newPaths = [...vst3CustomPaths];
                                                        newPaths[idx] = '';
                                                        setVst3CustomPaths(newPaths);
                                                        window.electronAPI.vst3.setCustomPaths(newPaths);
                                                    }}
                                                    style={{
                                                        padding: '3px 6px',
                                                        fontSize: '9px',
                                                        background: 'transparent',
                                                        border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                                                        borderRadius: '3px',
                                                        color: isDark ? '#888' : '#999',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Scan Button */}
                                <button
                                    onClick={async () => {
                                        if (vst3Scanning) return;
                                        setVst3Scanning(true);
                                        setVst3ScanProgress({ scanned: 0, total: 0, percent: 0, percentStr: '0.00%', currentFile: t('browser.startingScan'), done: false });

                                        // Listen for progress updates
                                        window.electronAPI.vst3.onScanProgress((progress) => {
                                            setVst3ScanProgress(progress);
                                        });

                                        try {
                                            const result = await window.electronAPI.vst3.scan(true);
                                            if (result.plugins) {
                                                setVst3Plugins(result.plugins);
                                                setVst3Loaded(true);
                                            }
                                        } catch (err) {
                                            console.error('VST3 scan failed:', err);
                                        } finally {
                                            setVst3Scanning(false);
                                            window.electronAPI.vst3.removeScanProgressListener();
                                        }
                                    }}
                                    disabled={vst3Scanning}
                                    style={{
                                        padding: '10px',
                                        background: vst3Scanning ? (isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0') : acGrad,
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: vst3Scanning ? (isDark ? '#888' : '#999') : '#fff',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: vst3Scanning ? 'wait' : 'pointer',
                                        letterSpacing: '0.5px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {vst3Scanning ? `⏳ ${t('browser.scanning')}` : vst3Loaded ? `🔄 ${t('browser.rescanPlugins')}` : `🔍 ${t('browser.scanVst3')}`}
                                </button>

                                {/* Progress Bar */}
                                {vst3Scanning && (
                                    <div style={{ padding: '0 2px' }}>
                                        {/* Progress bar track */}
                                        <div style={{
                                            width: '100%',
                                            height: '6px',
                                            background: isDark ? 'rgba(255,255,255,0.06)' : '#e0e0e0',
                                            borderRadius: '3px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${vst3ScanProgress.percent}%`,
                                                height: '100%',
                                                background: acGrad,
                                                borderRadius: '3px',
                                                transition: 'width 0.15s ease'
                                            }} />
                                        </div>
                                        {/* Progress text */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: '4px'
                                        }}>
                                            <span style={{
                                                fontSize: '10px',
                                                color: isDark ? '#888' : '#666',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                flex: 1,
                                                marginRight: '8px'
                                            }}>
                                                {vst3ScanProgress.currentFile}
                                            </span>
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: acSec || ac,
                                                fontFamily: 'monospace',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {vst3ScanProgress.percentStr}
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: '9px',
                                            color: isDark ? '#666' : '#999',
                                            marginTop: '2px'
                                        }}>
                                            {t('browser.pluginsScanned', { scanned: vst3ScanProgress.scanned, total: vst3ScanProgress.total })}
                                        </div>
                                    </div>
                                )}

                                {/* Search (only when plugins loaded) */}
                                {vst3Loaded && vst3Plugins.length > 0 && (
                                    <input
                                        type="text"
                                        value={vst3SearchQuery}
                                        onChange={(e) => setVst3SearchQuery(e.target.value)}
                                        placeholder={t('browser.searchPlugins')}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                                            border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                                            borderRadius: '6px',
                                            color: isDark ? '#e0e0e0' : '#333',
                                            fontSize: '11px',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                )}

                                {/* Plugin List */}
                                {vst3Loaded && vst3Plugins.length > 0 && (() => {
                                    // Group plugins by display category
                                    const query = vst3SearchQuery.toLowerCase().trim();
                                    const filtered = query
                                        ? vst3Plugins.filter(p =>
                                            p.name.toLowerCase().includes(query) ||
                                            p.vendor.toLowerCase().includes(query) ||
                                            (p.categories || []).join(' ').toLowerCase().includes(query)
                                        )
                                        : vst3Plugins;

                                    const groups = {};
                                    for (const plugin of filtered) {
                                        const cats = (plugin.categories || []).join(' ').toLowerCase();
                                        let category = 'Effects';
                                        if (cats.includes('instrument') || cats.includes('synth') || cats.includes('sampler') || cats.includes('generator') || plugin.hasMidiInput) {
                                            category = 'Instruments';
                                        } else if (cats.includes('analyzer') || cats.includes('meter') || cats.includes('tool') || cats.includes('utility')) {
                                            category = 'Utilities';
                                        }
                                        if (!groups[category]) groups[category] = [];
                                        groups[category].push(plugin);
                                    }

                                    const categoryOrder = ['Instruments', 'Effects', 'Utilities'];
                                    const categoryIcons = { Instruments: '🎹', Effects: '🎚️', Utilities: '🔧' };
                                    const categoryLabels = { Instruments: t('browser.vst3Instruments'), Effects: t('browser.vst3Effects'), Utilities: t('browser.vst3Utilities') };

                                    return (
                                        <div style={{ marginTop: '4px' }}>
                                            {categoryOrder.map(cat => {
                                                const plugins = groups[cat];
                                                if (!plugins || plugins.length === 0) return null;
                                                const isExpanded = vst3CategoryExpanded[cat] !== false; // default expanded

                                                return (
                                                    <div key={cat} style={{ marginBottom: '2px' }}>
                                                        {/* Category header */}
                                                        <div
                                                            onClick={() => setVst3CategoryExpanded(prev => ({ ...prev, [cat]: !isExpanded }))}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '8px 10px',
                                                                cursor: 'pointer',
                                                                background: isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f7',
                                                                borderRadius: '4px',
                                                                transition: 'background 0.15s'
                                                            }}
                                                        >
                                                            <span style={{
                                                                fontSize: '8px',
                                                                color: isDark ? '#666' : '#999',
                                                                transition: 'transform 0.2s',
                                                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                display: 'inline-block'
                                                            }}>▶</span>
                                                            <span style={{ fontSize: '12px' }}>{categoryIcons[cat]}</span>
                                                            <span style={{
                                                                fontSize: '11px',
                                                                fontWeight: '700',
                                                                color: isDark ? '#ccc' : '#333',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.5px',
                                                                flex: 1
                                                            }}>
                                                                {categoryLabels[cat] || cat}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                color: isDark ? '#666' : '#999',
                                                                fontWeight: '600'
                                                            }}>
                                                                {plugins.length}
                                                            </span>
                                                        </div>

                                                        {/* Plugin items */}
                                                        {isExpanded && plugins.map((plugin, pIdx) => (
                                                            <div
                                                                key={plugin.uid || `${cat}-${pIdx}`}
                                                                title={`${plugin.name}\n${plugin.vendor}\nv${plugin.version}\n${plugin.path}\n\n${t('browser.dragToLoad')}`}
                                                                draggable
                                                                onClick={() => setSelectedVst3PluginUid(plugin.uid)}
                                                                onDoubleClick={() => {
                                                                    setSelectedVst3PluginUid(plugin.uid);
                                                                    if (onVst3PluginDoubleClick) onVst3PluginDoubleClick(plugin);
                                                                }}
                                                                onDragStart={(e) => {
                                                                    setSelectedVst3PluginUid(plugin.uid);
                                                                    window.draggedItem = {
                                                                        type: 'vst3Plugin',
                                                                        pluginInfo: plugin,
                                                                    };
                                                                    e.dataTransfer.effectAllowed = 'copy';
                                                                    try {
                                                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                                                            type: 'vst3Plugin',
                                                                            name: plugin.name,
                                                                            path: plugin.path,
                                                                            uid: plugin.uid,
                                                                        }));
                                                                    } catch (_) {}
                                                                }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px',
                                                                    padding: '6px 10px 6px 28px',
                                                                    cursor: 'grab',
                                                                    borderLeft: `2px solid ${selectedVst3PluginUid === plugin.uid ? (acSec || ac) : 'transparent'}`,
                                                                    transition: 'all 0.15s',
                                                                    borderRadius: '2px',
                                                                    background: selectedVst3PluginUid === plugin.uid ? (isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.12)) : 'transparent'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (selectedVst3PluginUid !== plugin.uid) {
                                                                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                                                                        e.currentTarget.style.borderLeftColor = acSec || ac;
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (selectedVst3PluginUid !== plugin.uid) {
                                                                        e.currentTarget.style.background = 'transparent';
                                                                        e.currentTarget.style.borderLeftColor = 'transparent';
                                                                    }
                                                                }}
                                                            >
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: '600',
                                                                        color: isDark ? '#e0e0e0' : '#333',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {plugin.name}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: '9px',
                                                                        color: isDark ? '#777' : '#999',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                        marginTop: '1px'
                                                                    }}>
                                                                        {plugin.vendor}{plugin.version ? ` — v${plugin.version}` : ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}

                                            {/* Summary */}
                                            <div style={{
                                                padding: '10px',
                                                textAlign: 'center',
                                                fontSize: '10px',
                                                color: isDark ? '#555' : '#999'
                                            }}>
                                                {filtered.length !== 1 ? t('browser.pluginsFoundPlural', { count: filtered.length }) : t('browser.pluginsFound', { count: filtered.length })}
                                                {query && ` ${t('browser.pluginsFoundMatching', { query: vst3SearchQuery })}`}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Empty state */}
                                {vst3Loaded && vst3Plugins.length === 0 && !vst3Scanning && (
                                    <div style={{
                                        padding: '20px',
                                        textAlign: 'center',
                                        color: isDark ? '#666' : '#999',
                                        fontSize: '11px',
                                        lineHeight: 1.6
                                    }}>
                                        {t('browser.noVst3Found')}
                                        <br />
                                        {t('browser.noVst3FoundHint')}
                                    </div>
                                )}

                                {/* Initial state (never scanned) */}
                                {!vst3Loaded && !vst3Scanning && (
                                    <div style={{
                                        padding: '16px',
                                        textAlign: 'center',
                                        color: isDark ? '#666' : '#999',
                                        fontSize: '11px',
                                        lineHeight: 1.6
                                    }}>
                                        {t('browser.clickScanVst3')}
                                        <br />
                                        <span style={{ fontSize: '10px', color: isDark ? '#555' : '#aaa' }}>
                                            {t('browser.defaultPathsScanned')}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Preset Modals */}
                <PresetBrowser
                    isOpen={showPresetBrowser}
                    onClose={() => setShowPresetBrowser(false)}
                    presetManager={presetManager}
                    onLoadPreset={(presetData) => {
                        onLoadPreset(presetData);
                        setShowPresetBrowser(false);
                    }}
                />
                <SavePresetDialog
                    isOpen={showSaveDialog}
                    onClose={() => setShowSaveDialog(false)}
                    onSave={onSavePreset}
                    currentSettings={{
                        genre: currentGenre,
                        mood: currentMood,
                        tempo,
                        key: currentKey,
                        scale: currentScale
                    }}
                />
            </div>

            {/* Context Menu */}
            {contextMenu && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        backgroundColor: 'rgba(30, 30, 35, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        zIndex: 2147483647, // Max z-index to ensure it sits on top of everything
                        padding: '6px 0',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                        minWidth: '180px'
                    }}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    {contextMenu.isFile ? (
                        <>
                            <div
                                onClick={() => handleExtractMIDI(contextMenu.item, 'all')}
                                style={{
                                    padding: '10px 18px', cursor: 'pointer', fontSize: '11px', color: '#39ff14',
                                    fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(57, 255, 20, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                ✨ {t('browser.extractMidi')}
                            </div>
                            {contextMenu.item.type === 'audio' && (
                                <div
                                    onClick={() => handleExtractMIDIToFile(contextMenu.item)}
                                    style={{
                                        padding: '10px 18px', cursor: 'pointer', fontSize: '11px', color: '#4facfe',
                                        fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
                                        borderTop: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(79, 172, 254, 0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    💾 {t('browser.extractMidiToFile')}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div
                                onClick={() => handleGenerateClick(contextMenu.item)}

                                style={{
                                    padding: '10px 18px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                🔍 {t('browser.analyzeGenerate')}
                            </div>
                            <div
                                onClick={() => handleExtractMIDIFromFolder(contextMenu.item)}
                                style={{
                                    padding: '10px 18px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    color: '#39ff14',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'background 0.2s',
                                    borderTop: '1px solid rgba(255,255,255,0.05)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(57, 255, 20, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                ✨ {t('browser.extractMidiFromFolder')}
                            </div>
                            <div
                                onClick={async () => {
                                    if (window.libraryManager) {
                                        await window.libraryManager.removeFolder(contextMenu.item.name);
                                    }
                                    // Also remove from Electron native persistence + stop watching
                                    if (window.electronAPI?.folders?.load && contextMenu.item.nativePath) {
                                        const result = await window.electronAPI.folders.load();
                                        const updated = (result.folders || []).filter(p => p !== contextMenu.item.nativePath);
                                        await window.electronAPI.folders.save(updated);
                                        if (window.electronAPI.folders.unwatch) {
                                            window.electronAPI.folders.unwatch(contextMenu.item.nativePath);
                                        }
                                    }
                                    // Release cached audio buffers for files in the removed folder
                                    const removedFiles = folderFiles[contextMenu.item.name];
                                    if (removedFiles && window.audioEngine) {
                                        const clearBufs = (items) => {
                                            if (!items) return;
                                            (Array.isArray(items) ? items : [items]).forEach(item => {
                                                if (item.name) window.audioEngine.clearBuffer(item.name);
                                                if (item.children) clearBufs(item.children);
                                            });
                                        };
                                        clearBufs(removedFiles);
                                    }
                                    setFolders(prev => prev.filter(f => f.name !== contextMenu.item.name));
                                    setFolderFiles(prev => {
                                        const next = { ...prev };
                                        delete next[contextMenu.item.name];
                                        return next;
                                    });
                                    setContextMenu(null);
                                }}
                                style={{
                                    padding: '10px 18px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    color: '#ff4b4b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'background 0.2s',
                                    borderTop: '1px solid rgba(255,255,255,0.05)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,75,75,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                🗑 {t('browser.removeFolder')}
                            </div>
                        </>
                    )}
                </div>,
                document.body
            )}

            {/* Global Preview Footer */}
            <div style={{
                padding: '15px',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#eee'}`,
                background: isDark ? 'linear-gradient(180deg, rgba(30,30,30,0.8) 0%, rgba(20,20,20,0.95) 100%)' : '#fff',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: isDark ? '0 -10px 30px rgba(0,0,0,0.5)' : '0 -5px 15px rgba(0,0,0,0.05)',
                zIndex: 10,
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Transport Controls */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                onClick={() => {
                                    if (window.audioEngine) {
                                        const wasPlaying = isPlaying;
                                        window.audioEngine.rewind(5);
                                        setCurrentTime(window.audioEngine.getCurrentTime());
                                        if (wasPlaying) {
                                            setIsPlaying(true);
                                            setTimeout(() => {
                                                if (window.audioEngine && !window.audioEngine.isPlaying) {
                                                    setIsPlaying(false);
                                                }
                                            }, 50);
                                        } else {
                                            if (!window.audioEngine.isPlaying) setIsPlaying(false);
                                        }
                                    }
                                }}
                                style={{
                                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0',
                                    color: isDark ? '#fff' : '#333',
                                    border: `1px solid ${isDark ? 'transparent' : '#ddd'}`,
                                    borderRadius: '4px',
                                    width: '28px',
                                    height: '28px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px'
                                }}
                                title={t('browser.rewind5s')}
                            >
                                ⏪
                            </button>
                            <button
                                onClick={togglePlayPause}
                                style={{
                                    backgroundColor: (isPlaying || isMidiPlaying) ? '#ff4b4b' : (theme.accent || ac),
                                    color: (isPlaying || isMidiPlaying) ? '#fff' : '#000',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '16px',
                                    boxShadow: `0 0 15px ${(isPlaying || isMidiPlaying) ? '#ff4b4b66' : (theme.accent || ac) + '66'}`,
                                    transition: 'all 0.1s active'
                                }}
                            >
                                {(isPlaying || isMidiPlaying) ? '■' : '▶'}
                            </button>
                            <button
                                onClick={() => {
                                    if (window.audioEngine) {
                                        const wasPlaying = isPlaying;
                                        window.audioEngine.fastForward(5);
                                        setCurrentTime(window.audioEngine.getCurrentTime());
                                        if (wasPlaying) {
                                            setIsPlaying(true);
                                            setTimeout(() => {
                                                if (window.audioEngine && !window.audioEngine.isPlaying) {
                                                    setIsPlaying(false);
                                                }
                                            }, 50);
                                        } else {
                                            if (!window.audioEngine.isPlaying) setIsPlaying(false);
                                        }
                                    }
                                }}
                                style={{
                                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0',
                                    color: isDark ? '#fff' : '#333',
                                    border: `1px solid ${isDark ? 'transparent' : '#ddd'}`,
                                    borderRadius: '4px',
                                    width: '28px',
                                    height: '28px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px'
                                }}
                                title={t('browser.forward5s')}
                            >
                                ⏩
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '4px' }}>
                            <span style={{
                                fontSize: '11px',
                                color: isDark ? '#fff' : '#333',
                                fontWeight: '700',
                                maxWidth: '140px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.3px'
                            }}>
                                {previewItem ? previewItem.name : t('browser.noFileSelected')}
                            </span>
                            <span style={{
                                fontSize: '10px',
                                color: theme.accent || ac,
                                fontWeight: '600',
                                letterSpacing: '1px',
                                opacity: 0.8
                            }}>
                                {formatTime(currentTime)} <span style={{ color: '#555' }}>/</span> {formatTime(duration)}
                            </span>
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        height: '50px',
                        background: isDark ? '#000000' : '#f5f5f5',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#ddd'}`
                    }}
                    onClick={(e) => {
                        if (!previewBuffer) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const pos = (x / rect.width) * duration;
                        if (window.audioEngine) {
                            window.audioEngine.seek(pos);
                            setCurrentTime(pos);
                            if (!isPlaying) {
                                window.audioEngine.play(previewBuffer, () => setIsPlaying(false));
                                setIsPlaying(true);
                            }
                        }
                    }}
                >
                    {/* Bluish Progress Fill */}
                    {duration > 0 && (
                        <div style={{
                            position: 'absolute',
                            left: 0, top: 0, bottom: 0,
                            width: `${(currentTime / duration) * 100}%`,
                            background: 'rgba(0, 212, 255, 0.2)',
                            zIndex: 1,
                            pointerEvents: 'none'
                        }} />
                    )}

                    <div style={{ position: 'relative', zIndex: 2 }}>
                        {midiPreviewData ? (
                            <MidiPreviewCanvas
                                midiData={midiPreviewData}
                                height={50}
                                color={isDark ? ac : ac}
                                theme={theme}
                            />
                        ) : (
                            <WaveformCanvas
                                buffer={previewBuffer}
                                height={50}
                                color={isDark ? '#ffffff' : ac}
                            />
                        )}
                    </div>

                    {/* Playback Head */}
                    {duration > 0 && (
                        <div style={{
                            position: 'absolute',
                            left: `${(currentTime / duration) * 100}%`,
                            top: 0, bottom: 0,
                            width: '2px',
                            backgroundColor: ac, // Theme color
                            boxShadow: `0 0 10px ${ac}`,
                            zIndex: 3,
                            pointerEvents: 'none'
                        }} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Browser;
