import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SCALES, CHORD_PROGRESSIONS, CHORD_TYPES, ROMAN_TO_CHORD } from './MusicTheory';
import { generateChordPattern } from './PatternEngine';
import PianoRollEditor from './PianoRollEditor';
import { collectAudioFiles, collectMidiFiles, shuffleArray } from './randomFileUtils';
import MIDIParser from './MIDIParser';
import { getFileFromItem } from './getFileFromItem.js';
import SampleSlicerEditor from './SampleSlicerEditor.jsx';
import { hexToRgba } from './accentThemes';
import { loopMelodicPattern } from './patternUtils';
import { useTranslation } from './i18n/I18nContext.jsx';

const ChordGeneratorEnhanced = React.forwardRef(({ selectedFolder, sampler, theme, globalKey, globalScale, globalTempo, globalBars, globalResolution, globalKey_Theory, globalScale_Theory, globalIsPlaying, globalCurrentStep, globalCurrentStepRef, globalIsPlayingRef, globalContinuousProgress, globalPlayStartTime, globalMood, globalGenre, globalOctave, setGlobalOctave, onPatternChange, onStatusChange, onInstrumentLoad, onSampleLoadingChange, externalPattern, globalSolos, updateGlobalSolo, isAnythingSoloed, globalMutes, setGlobalMutes, onGlobalGenerate, onSuggest, onAddToArrangement, isGenerated, setIsGenerated, onExportClick, onLoadClick, onNewProject, onLoadSlicedInstrument, accentColors, confirmBeforeClear, setGlobalBars, globalRepeat, setGlobalRepeat,
    onClipGenerated, editingClipId, clipPlaybackActive }, ref) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';


    // Debug Prop
    useEffect(() => {
        if (globalIsPlaying) console.log('[ChordGenerator] Prop globalPlayStartTime:', globalPlayStartTime);
    }, [globalIsPlaying, globalPlayStartTime]);


    const isDark = theme === 'dark';
    const keyOffset = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(globalKey || 'C');
    const rootPitch = ((globalOctave + 1) * 12) + (keyOffset >= 0 ? keyOffset : 0);
    const [chordPattern, setChordPattern] = useState(externalPattern || []);

    const [loadedInstrument, setLoadedInstrument] = useState(null);
    const [instrumentName, setInstrumentName] = useState('');
    const [showSlicer, setShowSlicer] = useState(false);
    const [complexity, setComplexity] = useState('simple');
    const [lastTriggeredStep, setLastTriggeredStep] = useState(-1);
    const [dragOver, setDragOver] = useState(false);
    const [powered, setPowered] = useState(true);
    const muted = globalMutes?.has('chords') || false;
    const [locked, setLocked] = useState(false);
    const prevBarsRef = useRef(globalBars);
    const prevExternalPatternRef = useRef(externalPattern);

    const isSoloed = globalSolos?.has('chords') || false;

    const toggleMute = useCallback(() => {
        if (!setGlobalMutes) return;
        setGlobalMutes(prev => {
            const next = new Set(prev);
            if (next.has('chords')) {
                next.delete('chords');
                if (sampler?.setTrackVolume) sampler.setTrackVolume('chords', 0.5);
            } else {
                next.add('chords');
                if (sampler?.setTrackVolume) sampler.setTrackVolume('chords', 0);
            }
            return next;
        });
    }, [setGlobalMutes, sampler]);

    // Detect when externalPattern changes during this render (used to skip bars-loop)
    const externalPatternChanged = externalPattern !== prevExternalPatternRef.current
        && externalPattern && externalPattern.length > 0;
    prevExternalPatternRef.current = externalPattern;

    useEffect(() => {
        if (locked) return;
        const oldBars = prevBarsRef.current;
        const newBars = globalBars;
        prevBarsRef.current = newBars;
        if (oldBars === newBars) return;
        // Skip loop-resize when an external pattern arrived in the same render
        if (externalPatternChanged) return;
        const newPattern = loopMelodicPattern(chordPattern, oldBars, newBars);
        setChordPattern(newPattern);
        if (onPatternChange) onPatternChange(newPattern);
    }, [globalBars, locked]);

    // Sync from external pattern (e.g. folder analysis / MIDI extraction)
    useEffect(() => {
        if (externalPattern && externalPattern.length > 0 && !locked) {
            setChordPattern(externalPattern);
        }
    }, [externalPattern, locked]);



    const handleLoadInstrument = async () => {
        if (!selectedFolder || !sampler) {
            alert(t('common.selectFolderWithSamples'));
            return;
        }
        const audioFiles = selectedFolder.samples.filter(s => s.file && s.file.type.startsWith('audio/'));
        if (audioFiles.length === 0) {
            alert(t('common.noAudioFiles'));
            return;
        }
        if (onSampleLoadingChange) onSampleLoadingChange(true);
        try {
            const instrumentId = `chords_${Date.now()}`;
            await sampler.loadInstrumentFromFiles(instrumentId, audioFiles.map(s => s.file), audioFiles[0]?.file.name || "Loaded Chords");
            setLoadedInstrument(instrumentId);
            setInstrumentName(selectedFolder.name);
            if (onInstrumentLoad) onInstrumentLoad(instrumentId);
        } catch (error) {
            console.error('Failed to load instrument:', error);
        } finally {
            if (onSampleLoadingChange) onSampleLoadingChange(false);
        }
    };

    const randomizeSound = async () => {
        if (!selectedFolder) {
            console.warn('[Chords] No folder selected');
            return;
        }
        if (onSampleLoadingChange) onSampleLoadingChange(true);
        try {
            // 1. Try audio files first
            const audioFiles = await collectAudioFiles(selectedFolder);

            if (audioFiles.length > 0 && sampler) {
                const pick = audioFiles[Math.floor(Math.random() * audioFiles.length)];
                const file = await getFileFromItem(pick);
                const sampleName = pick.name.replace(/\.[^.]+$/, '');
                const instrumentId = `chords_rand_${Date.now()}`;
                await sampler.loadInstrumentFromFiles(instrumentId, [file], sampleName);
                setLoadedInstrument(instrumentId);
                setInstrumentName(sampleName);
                if (onInstrumentLoad) onInstrumentLoad(instrumentId);
                return;
            }

            // 2. Fallback: try MIDI files → import as pattern
            const midiFiles = await collectMidiFiles(selectedFolder);
            if (midiFiles.length > 0) {
                const pick = midiFiles[Math.floor(Math.random() * midiFiles.length)];
                try {
                    const parser = new MIDIParser();
                    const file = await getFileFromItem(pick);
                    const midiData = await parser.loadMIDIFile(file);
                    const allNotes = [];
                    midiData.tracks.forEach(track => {
                        allNotes.push(...parser.eventsToNotes(track.events));
                    });
                    if (allNotes.length > 0) {
                        const ticksPerStep = midiData.ticksPerBeat / 8; // 32 steps per bar
                        const pattern = allNotes.map(n => ({
                            time: Math.round(n.startTick / ticksPerStep),
                            duration: Math.max(1, Math.round(n.duration / ticksPerStep)),
                            note: n.note,
                            velocity: Math.min(1, n.velocity / 127)
                        }));
                        setChordPattern(pattern);
                        if (onPatternChange) onPatternChange(pattern);
                        setInstrumentName("MIDI: " + pick.name);
                        return;
                    }
                } catch (e) { console.warn('[Chords] Failed to parse MIDI:', pick.name, e); }
            }

            console.warn('[Chords] No valid audio or MIDI files in folder:', selectedFolder.name);
        } catch (err) { console.error('[Chords] Randomize sound error:', err); } finally {
            if (onSampleLoadingChange) onSampleLoadingChange(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setDragOver(false);

        // Check for MIDI file from file explorer (pre-parsed or needs on-demand parsing)
        const draggedItem = window.draggedItem;
        if (draggedItem && draggedItem.type === 'midi') {
            try {
                let notes = draggedItem.midiNotes;
                let tpb = draggedItem.ticksPerBeat || 480;

                // Parse on-demand if notes not pre-parsed (Browser.jsx path)
                if (!notes || notes.length === 0) {
                    let file;
                    file = await getFileFromItem(draggedItem);
                    if (file) {
                        const parser = new MIDIParser();
                        const midiData = await parser.loadMIDIFile(file);
                        notes = [];
                        midiData.tracks.forEach(track => {
                            notes = [...notes, ...parser.eventsToNotes(track.events)];
                        });
                        tpb = midiData.ticksPerBeat || 480;
                        // Cache for future use
                        draggedItem.midiNotes = notes;
                        draggedItem.ticksPerBeat = tpb;
                    }
                }

                if (notes && notes.length > 0) {
                    const ticksPerStep = tpb / 8;
                    const newPattern = notes.map(n => ({
                        time: Math.floor(n.startTick / ticksPerStep),
                        duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                        note: n.note,
                        velocity: n.velocity / 127
                    })).filter(n => n.time < globalBars * 32);

                    setChordPattern(newPattern);
                    if (setIsGenerated) setIsGenerated(true);
                    if (onPatternChange) onPatternChange(newPattern);
                    console.log('[Chords] Loaded MIDI pattern from drop:', newPattern.length, 'notes');
                    return;
                }
            } catch (err) { console.error('[Chords] MIDI drop error:', err); }
        }

        // Check for MIDI file from external drag (native file)
        let file = null;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            file = e.dataTransfer.files[0];
            if (file.name.match(/\.midi?$/i)) {
                try {
                    const parser = new MIDIParser();
                    const midiData = await parser.loadMIDIFile(file);
                    let allNotes = [];
                    midiData.tracks.forEach(track => {
                        allNotes = [...allNotes, ...parser.eventsToNotes(track.events)];
                    });
                    const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
                    const newPattern = allNotes.map(n => ({
                        time: Math.floor(n.startTick / ticksPerStep),
                        duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                        note: n.note,
                        velocity: n.velocity / 127
                    })).filter(n => n.time < globalBars * 32);

                    setChordPattern(newPattern);
                    if (setIsGenerated) setIsGenerated(true);
                    if (onPatternChange) onPatternChange(newPattern);
                    console.log('[Chords] Loaded external MIDI:', newPattern.length, 'notes');
                    return;
                } catch (err) { console.error('[Chords] External MIDI parse error:', err); }
            }
        } else if (draggedItem && (draggedItem.handle || draggedItem.nativePath)) {
            file = await getFileFromItem(draggedItem);
        }

        if (file && file.type.startsWith('audio/') && sampler) {
            try {
                const instrumentId = `chords_drop_${Date.now()}`;
                await sampler.loadInstrumentFromFiles(instrumentId, [file], file.name);
                setLoadedInstrument(instrumentId);
                setInstrumentName(file.name);
                if (onInstrumentLoad) onInstrumentLoad(instrumentId);
            } catch (err) { console.error(err); }
        }
    };

    // Map Roman numeral to scale degree index (0-based)
    const romanToDegreeIndex = useCallback((roman) => {
        const map = {
            'I': 0, 'i': 0, 'I7': 0, 'i7': 0,
            'II': 1, 'ii': 1, 'ii7': 1,
            'III': 2, 'iii': 2,
            'IV': 3, 'iv': 3, 'iv7': 3,
            'V': 4, 'v': 4, 'V7': 4,
            'VI': 5, 'vi': 5, 'vi7': 5,
            'VII': 6, 'vii': 6, 'vii°': 6,
            // New degree mappings
            'bVII': 6, 'bVI': 5, 'bIII': 2,
            'Imaj7': 0, 'IVmaj7': 3, 'IImaj7': 1,
            'V7#9': 4, 'V7b9': 4,
            'viio7': 6, 'iiø7': 1,
            'iii7': 2,
            'I6': 0, 'IV6': 3, 'i6': 0
        };
        return map[roman];
    }, []);

    const generateChords = useCallback(() => {
        if (locked) return;
        try {
            const baseBars = globalBars > 4 ? 4 : globalBars;
            let newPattern = generateChordPattern({
                key: globalKey,
                scale: globalScale,
                genre: globalGenre || 'Hip Hop',
                mood: globalMood || 'Standard',
                bars: baseBars,
                complexity,
                octave: globalOctave
            });

            if (newPattern.length === 0) {
                console.warn('[ChordGenerator] PatternEngine returned empty pattern');
                return;
            }

            if (globalBars > 4) {
                newPattern = loopMelodicPattern(newPattern, baseBars, globalBars);
            }

            console.log(`[ChordGenerator] Generated ${newPattern.length} notes via PatternEngine`);
            setChordPattern(newPattern);
            if (setIsGenerated) setIsGenerated(true);
            if (onPatternChange) onPatternChange(newPattern);
        } catch (err) {
            console.error('[ChordGenerator] Chord generation failed:', err);
        }
    }, [locked, globalKey, globalScale, globalGenre, globalMood, globalBars, complexity, globalOctave, globalRepeat, onPatternChange, setIsGenerated]);

    const pendingClipGenRef = useRef(false);

    React.useImperativeHandle(ref, () => ({
        generate: () => {
            if (onClipGenerated) pendingClipGenRef.current = true;
            generateChords();
        },
        getPattern: () => chordPattern,
        loadSample: async (sampleItem) => {
            if (!sampleItem || !sampler) return;
            try {
                const file = await getFileFromItem(sampleItem);
                const instrumentId = `chords_ext_${Date.now()}`;
                await sampler.loadInstrumentFromFiles(instrumentId, [file], file.name);
                setLoadedInstrument(instrumentId);
                setInstrumentName(file.name);
                if (onInstrumentLoad) onInstrumentLoad(instrumentId);
                if (onStatusChange) onStatusChange({ hasSamples: true, hasPattern: chordPattern.length > 0 });
            } catch (err) { console.error(`[chords] loadSample error:`, err); }
        },
        loadMIDI: async (midiItem) => {
            if (!midiItem) return;
            try {
                const file = await getFileFromItem(midiItem);
                const parser = new MIDIParser();
                const midiData = await parser.loadMIDIFile(file);

                let notes = [];
                for (const track of midiData.tracks) {
                    const trackNotes = parser.eventsToNotes(track.events);
                    if (trackNotes.length > 0) { notes = trackNotes; break; }
                }

                if (notes.length === 0) return;

                const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
                const newPattern = notes.map(n => ({
                    time: Math.floor(n.startTick / ticksPerStep),
                    duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                    note: n.note,
                    velocity: n.velocity / 127
                })).filter(n => n.time < globalBars * 32);

                setChordPattern(newPattern);
                if (setIsGenerated) setIsGenerated(true);
                if (onPatternChange) onPatternChange(newPattern);
                if (onStatusChange) onStatusChange({ hasSamples: !!loadedInstrument, hasPattern: true });
            } catch (err) { console.error(`[chords] loadMIDI error:`, err); }
        },
        loadState: (pattern, instrumentId) => {
            setChordPattern(pattern || []);
            if (instrumentId && sampler) {
                const info = sampler.getInstrumentInfo(instrumentId);
                if (info) {
                    setLoadedInstrument(instrumentId);
                    setInstrumentName(info.name);
                }
            }
            if (setIsGenerated) setIsGenerated(!!pattern?.length);
        },
        clear: () => {
            if (locked) return;
            setChordPattern([]);
            setLoadedInstrument(null);
            setInstrumentName('');
            if (setIsGenerated) setIsGenerated(false);
            if (onPatternChange) onPatternChange([]);
            if (onStatusChange) onStatusChange({ hasSamples: false, hasPattern: false });
        }
    }), [sampler, chordPattern, loadedInstrument, generateChords, locked, onClipGenerated]);

    const handleGenerateFromMIDI = async () => {
        if (locked) return;
        if (!selectedFolder) return alert(t('common.selectFolderFirst'));
        try {
            const midiFiles = [];
            for await (const [name, handle] of selectedFolder.handle.entries()) {
                if (handle.kind === 'file' && name.toLowerCase().endsWith('.mid')) midiFiles.push({ name, handle });
            }
            if (midiFiles.length === 0) return alert(t('common.noMidiFound'));
            const file = await getFileFromItem(midiFiles[Math.floor(Math.random() * midiFiles.length)]);
            const parser = new MIDIParser();
            const midiData = await parser.loadMIDIFile(file);
            let notes = [];
            for (const track of midiData.tracks) {
                const trackNotes = parser.eventsToNotes(track.events);
                if (trackNotes.length > 0) { notes = trackNotes; break; }
            }
            if (notes.length === 0) return alert(t('common.noNotesFound'));
            const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
            const newPattern = notes.map(n => ({
                time: Math.floor(n.startTick / ticksPerStep),
                duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                note: n.note,
                velocity: n.velocity / 127
            })).filter(n => n.time < globalBars * 32);
            setChordPattern(newPattern);
            if (onPatternChange) onPatternChange(newPattern);
            if (setIsGenerated) setIsGenerated(true);
        } catch (err) { console.error(err); }
    };
    // Emit clip after generate completes
    useEffect(() => {
        if (pendingClipGenRef.current && onClipGenerated && chordPattern.length > 0) {
            pendingClipGenRef.current = false;
            onClipGenerated({ bars: globalBars, pattern: chordPattern.map(n => ({ ...n })), name: 'Chord Clip', color: null });
        }
    }, [chordPattern, onClipGenerated, globalBars]);

    // Playback Logic — Ref-based polling (decoupled from React renders)
    const lastProcessedStepRef = useRef(-1);
    const samplerRef2 = useRef(sampler);
    const loadedInstrumentRef = useRef(loadedInstrument);
    const chordPatternRef = useRef(chordPattern);
    const globalTempoRef = useRef(globalTempo);
    const globalBarsRef = useRef(globalBars);
    const poweredRef = useRef(powered);
    const mutedRef = useRef(muted);
    const isSoloedRef = useRef(isSoloed);
    const isAnythingSoloedRef = useRef(isAnythingSoloed);

    useEffect(() => { samplerRef2.current = sampler; }, [sampler]);
    useEffect(() => { loadedInstrumentRef.current = loadedInstrument; }, [loadedInstrument]);
    const chordPatternVersionRef = useRef(0);
    useEffect(() => { chordPatternRef.current = chordPattern; chordPatternVersionRef.current++; }, [chordPattern]);
    useEffect(() => { globalTempoRef.current = globalTempo; }, [globalTempo]);
    useEffect(() => { globalBarsRef.current = globalBars; }, [globalBars]);
    useEffect(() => { poweredRef.current = powered; }, [powered]);
    useEffect(() => { mutedRef.current = muted; }, [muted]);
    useEffect(() => { isSoloedRef.current = isSoloed; }, [isSoloed]);
    useEffect(() => { isAnythingSoloedRef.current = isAnythingSoloed; }, [isAnythingSoloed]);

    const clipPlaybackActiveRef = useRef(clipPlaybackActive);
    useEffect(() => { clipPlaybackActiveRef.current = clipPlaybackActive; }, [clipPlaybackActive]);

    useEffect(() => {
        if (!globalCurrentStepRef || !globalIsPlayingRef) return;

        let lastCtx = samplerRef2.current?.audioContext || null;
        let lastPatternVersion = chordPatternVersionRef.current;

        const poll = () => {
            if (!globalIsPlayingRef.current || !samplerRef2.current || !loadedInstrumentRef.current) {
                if (lastProcessedStepRef.current !== -1) {
                    lastProcessedStepRef.current = -1;
                }
                return;
            }

            // Don't schedule notes while AudioContext is still resuming — notes
            // fired on a suspended context have all ADSR events land in the past
            // when it finally runs, causing the first chord to be inaudible.
            // Leaving lastProcessedStepRef at -1 ensures step 0 is caught once running.
            const ctx2 = samplerRef2.current.audioContext;
            if (!ctx2 || ctx2.state !== 'running') return;

            const currentStep = globalCurrentStepRef.current;
            if (currentStep < 0) return;

            const totalSteps = globalBarsRef.current * 32;
            const shouldPlay = poweredRef.current && (isAnythingSoloedRef.current ? isSoloedRef.current : !mutedRef.current);

            // Detect AudioContext hot-swap — re-trigger sustaining notes on new context
            const currentCtx = samplerRef2.current.audioContext;
            if (currentCtx && currentCtx !== lastCtx) {
                lastCtx = currentCtx;
                if (shouldPlay) {
                    const triggerStep = currentStep % totalSteps;
                    const sustainingNotes = chordPatternRef.current.filter(n => {
                        const noteStart = Math.round(n.time);
                        const noteEnd = noteStart + (n.duration || 1);
                        return noteStart <= triggerStep && noteEnd > triggerStep;
                    });
                    sustainingNotes.forEach(n => {
                        const remainingSteps = (Math.round(n.time) + (n.duration || 1)) - (currentStep % totalSteps);
                        const remainingDuration = Math.max(0.05, (remainingSteps / 8) * (60 / globalTempoRef.current));
                        samplerRef2.current.playNote(loadedInstrumentRef.current, n.note, n.velocity, remainingDuration, null, 'chords');
                    });
                }
            }

            // Detect mid-playback pattern change — stop old notes, re-trigger from new pattern.
            // Runs even when clipPlaybackActive so regeneration takes effect instantly.
            if (chordPatternVersionRef.current !== lastPatternVersion) {
                lastPatternVersion = chordPatternVersionRef.current;
                // Kill old pattern's sustaining notes immediately
                if (loadedInstrumentRef.current && samplerRef2.current.stopInstrument) {
                    samplerRef2.current.stopInstrument(loadedInstrumentRef.current);
                }
                if (shouldPlay) {
                    const triggerStep = currentStep % totalSteps;
                    const sustainingNotes = chordPatternRef.current.filter(n => {
                        const noteStart = Math.round(n.time);
                        const noteEnd = noteStart + (n.duration || 1);
                        return noteStart <= triggerStep && noteEnd > triggerStep;
                    });
                    sustainingNotes.forEach(n => {
                        const remainingSteps = (Math.round(n.time) + (n.duration || 1)) - triggerStep;
                        const remainingDuration = Math.max(0.05, (remainingSteps / 8) * (60 / globalTempoRef.current));
                        samplerRef2.current.playNote(loadedInstrumentRef.current, n.note, n.velocity, remainingDuration, null, 'chords');
                    });
                    lastProcessedStepRef.current = currentStep;
                }
            }

            // Skip normal step-by-step processing when clip playback is active —
            // the clip system handles ongoing note scheduling, the poll only
            // handles instant transitions (pattern changes, hot-swaps) above.
            if (clipPlaybackActiveRef.current) return;

            if (lastProcessedStepRef.current === -1 || currentStep < lastProcessedStepRef.current) {
                lastProcessedStepRef.current = currentStep - 1;
            }

            if (currentStep === lastProcessedStepRef.current) return;

            // Cap catch-up to 4 steps max to prevent audio thread overload on frame drops
            const catchUpStart = Math.max(lastProcessedStepRef.current + 1, currentStep - 3);
            for (let step = catchUpStart; step <= currentStep; step++) {
                const triggerStep = step % totalSteps;
                if (shouldPlay) {
                    const notes = chordPatternRef.current.filter(n => Math.round(n.time) === triggerStep);
                    notes.forEach(n => samplerRef2.current.playNote(loadedInstrumentRef.current, n.note, n.velocity, (n.duration / 8) * (60 / globalTempoRef.current), null, 'chords'));
                }
            }
            lastProcessedStepRef.current = currentStep;
        };

        const id = setInterval(poll, 25);
        return () => clearInterval(id);
    }, [globalCurrentStepRef, globalIsPlayingRef]);

    const clearPattern = () => { if (locked || chordPattern.length === 0) return; if (confirmBeforeClear && !window.confirm(t('chords.clearConfirm'))) return; setChordPattern([]); if (setIsGenerated) setIsGenerated(false); if (onPatternChange) onPatternChange([]); };
    const handlePatternChange = (p) => { if (locked) return; setChordPattern(p); if (setIsGenerated) setIsGenerated(false); if (onPatternChange) onPatternChange(p); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: isDark ? 'transparent' : '#fff', color: isDark ? '#eee' : '#333', padding: '24px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}>
            <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: `1px solid ${isDark ? '#2a2a3e' : '#e0e0e0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                        {'🎹 ' + t('chords.title')}
                        {isGenerated && <span style={{ color: ac, fontSize: '14px', marginLeft: '8px' }} title={t('common.patternGenerated')}>✅</span>}
                        {loadedInstrument && <span style={{ color: acSec, fontSize: '14px', marginLeft: '8px' }} title={t('common.instrumentLoaded')}>🔉</span>}
                    </h3>
                    <p style={{ margin: 0, fontSize: '11px', color: isDark ? '#888' : '#666' }}>{t('chords.subtitle')}</p>
                    {editingClipId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: ac, background: `${ac}22`, padding: '2px 8px', borderRadius: '4px' }}>Editing Clip</span>
                            <button onClick={() => window.dispatchEvent(new CustomEvent('wavloom-close-chord-clip-edit'))} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: 'transparent', color: isDark ? '#ccc' : '#555', cursor: 'pointer' }}>Close</button>
                        </div>
                    )}
                </div>

                {/* Instrument Slot Style Header */}
                <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    style={{
                        background: isDark ? '#111' : '#fbfbfb',
                        borderRadius: '8px',
                        border: `1px solid ${dragOver ? ac : (isDark ? '#222' : '#f0f0f0')}`,
                        padding: '10px 15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        flex: 1,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                    }}
                >
                    <div style={{ width: '40px', height: '40px', background: isDark ? '#0f0f1a' : '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>🎹</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: ac, letterSpacing: '1px', textTransform: 'uppercase' }}>{t('chords.instrument')}</div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: isDark ? '#fff' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{instrumentName || t('chords.dropSample')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                            onClick={onNewProject}
                            style={{ background: isDark ? hexToRgba(ac, 0.1) : '#fff', border: `1.5px solid ${isDark ? hexToRgba(ac, 0.3) : '#eee'}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            title={t('common.startNewProject')}
                        >
                            {'📄 ' + t('chords.new')}
                        </button>
                        <button
                            onClick={onLoadClick}
                            style={{ background: isDark ? 'rgba(79, 172, 254, 0.1)' : '#fff', border: `1.5px solid ${isDark ? '#4facfe' : '#eee'}`, borderRadius: '6px', color: '#4facfe', fontSize: '11px', fontWeight: '900', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            title={t('common.loadProject')}
                        >
                            {'📂 ' + t('chords.load')}
                        </button>
                        <button
                            onClick={onExportClick}
                            style={{ background: isDark ? 'rgba(79, 172, 254, 0.1)' : '#fff', border: `1.5px solid ${isDark ? '#4facfe' : '#eee'}`, borderRadius: '6px', color: '#4facfe', fontSize: '11px', fontWeight: '900', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            title={t('common.exportProject')}
                        >
                            {'💾 ' + t('chords.export')}
                        </button>
                        <button
                            onClick={(e) => updateGlobalSolo('chords', !isSoloed, e.ctrlKey)}
                            style={{
                                width: '24px', height: '24px',
                                background: isSoloed ? acSec : (isDark ? '#1a1a1f' : '#eee'),
                                border: 'none', borderRadius: '4px',
                                color: isSoloed ? '#fff' : (isDark ? '#555' : '#888'),
                                fontSize: '10px', fontWeight: '900', cursor: 'pointer',
                                boxShadow: isSoloed ? `0 0 10px ${acSec}` : 'none', transition: 'all 0.1s'
                            }}
                            title={t('common.soloCtrl')}
                        >S</button>
                        <button
                            onClick={toggleMute}
                            style={{
                                width: '24px', height: '24px',
                                background: muted ? '#ff4d4d' : (isDark ? '#1a1a1f' : '#eee'),
                                border: 'none', borderRadius: '4px',
                                color: muted ? '#fff' : (isDark ? '#555' : '#888'),
                                fontSize: '10px', fontWeight: '900', cursor: 'pointer',
                                boxShadow: muted ? '0 0 10px #ff4d4d' : 'none', transition: 'all 0.1s'
                            }}
                            title={t('common.mute')}
                        >M</button>
                        <button
                            onClick={() => setLocked(!locked)}
                            style={{
                                width: '24px', height: '24px',
                                background: isDark ? '#1a1a1f' : '#eee',
                                border: 'none', borderRadius: '4px',
                                color: locked ? acSec : (isDark ? '#555' : '#888'),
                                fontSize: '14px', cursor: 'pointer',
                                transition: 'all 0.1s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title={locked ? t('common.unlockPattern') : t('common.lockPattern')}
                        >{locked ? '🔒' : '🔓'}</button>

                        <div style={{ width: '1px', height: '20px', background: isDark ? '#222' : '#ddd', margin: '0 4px' }} />

                        {loadedInstrument && (
                            <button
                                onClick={() => setShowSlicer(true)}
                                style={{
                                    background: isDark ? 'rgba(255,159,67,0.08)' : '#fff4e6',
                                    border: `1px solid ${acSec}`,
                                    borderRadius: '4px',
                                    color: acSec,
                                    fontSize: '10px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    padding: '6px 10px',
                                    letterSpacing: '0.3px'
                                }}
                                title={t('common.openSlicer')}
                            >{t('chords.slice')}</button>
                        )}

                        <button
                            onClick={randomizeSound}
                            style={{
                                background: isDark ? '#1a1a1f' : '#eee',
                                border: 'none',
                                borderRadius: '4px',
                                color: ac,
                                fontSize: '10px',
                                fontWeight: '900',
                                cursor: 'pointer',
                                padding: '6px 10px'
                            }}
                            title={t('common.randomizeSample')}
                        >{'🎲 ' + t('chords.stx')}</button>
                        <div
                            onClick={() => setPowered(!powered)}
                            title={t('common.togglePower')}
                            style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: powered ? ac : '#333',
                                cursor: 'pointer',
                                border: `2px solid ${isDark ? '#000' : '#fff'}`,
                                boxShadow: powered ? `0 0 8px ${ac}` : 'none'
                            }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ background: isDark ? '#1a1a1f' : '#f0f0f0', padding: '15px', borderRadius: '8px', marginBottom: '20px', opacity: locked ? 0.6 : 1, pointerEvents: locked ? 'none' : 'auto', transition: '0.3s' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {/* Bar selector + Repeat toggle */}
                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', marginBottom: '5px', color: isDark ? '#666' : '#888', letterSpacing: '1px' }}>{t('chords.bars')}</label>
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                            {[4, 8, 16, 32, 64].map(b => (
                                <button key={b} onClick={() => setGlobalBars && setGlobalBars(b)} title={t('common.barsTooltip', { count: b })} style={{
                                    padding: '4px 6px',
                                    background: globalBars === b ? ac : (isDark ? '#2a2a3e' : '#fff'),
                                    border: `1px solid ${globalBars === b ? ac : (isDark ? '#444' : '#ccc')}`,
                                    borderRadius: '4px',
                                    color: globalBars === b ? '#fff' : (isDark ? '#aaa' : '#555'),
                                    fontSize: '9px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    lineHeight: 1.1,
                                    minWidth: '28px',
                                    transition: 'all 0.15s'
                                }}>
                                    <span>{b}</span>
                                    <span style={{ fontSize: '7px', opacity: 0.7 }}>{t('chords.bars')}</span>
                                </button>
                            ))}
                            <button onClick={() => setGlobalRepeat && setGlobalRepeat(prev => !prev)} title={t('common.repeatTooltip')} style={{
                                padding: '4px 8px',
                                background: globalRepeat ? ac : (isDark ? '#2a2a3e' : '#fff'),
                                border: `1px solid ${globalRepeat ? ac : (isDark ? '#444' : '#ccc')}`,
                                borderRadius: '4px',
                                color: globalRepeat ? '#fff' : (isDark ? '#aaa' : '#555'),
                                fontSize: '9px',
                                fontWeight: '900',
                                cursor: 'pointer',
                                marginLeft: '4px',
                                transition: 'all 0.15s'
                            }}>
                                {'↻ ' + t('chords.rpt')}
                            </button>
                        </div>
                    </div>

                    {/* Separator */}
                    <div style={{ width: '1px', height: '32px', background: isDark ? '#333' : '#ccc', alignSelf: 'flex-end', marginBottom: '4px' }} />
                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', marginBottom: '5px', color: isDark ? '#666' : '#888', letterSpacing: '1px' }}>{t('chords.complexity')}</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            {['simple', 'complex'].map(level => (
                                <button key={level} onClick={() => setComplexity(level)} title={t(`common.${level}Tooltip`)} style={{ padding: '8px 16px', background: complexity === level ? ac : (isDark ? '#2a2a3e' : '#fff'), border: `1px solid ${isDark ? '#444' : '#ccc'}`, borderRadius: '4px', color: complexity === level ? '#fff' : (isDark ? '#fff' : '#333'), fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}>{t(`chords.${level}`)}</button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', marginBottom: '5px', color: isDark ? '#666' : '#888', letterSpacing: '1px' }}>{t('chords.octave')}</label>
                        <select value={globalOctave} onChange={e => setGlobalOctave(parseInt(e.target.value))} title={t('common.octaveTooltip')} style={{ padding: '8px 12px', background: isDark ? '#1a1a2e' : '#fff', border: `1px solid ${isDark ? '#2a2a3e' : '#ccc'}`, borderRadius: '4px', color: isDark ? '#ddd' : '#333', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                            {[0, 1, 2, 3, 4, 5, 6].map(o => <option key={o} value={o}>{t('chords.octLabel', { oct: o })}</option>)}
                        </select>
                    </div>

                    <button onClick={generateChords} title={t('chords.gen')} style={{ padding: '8px 15px', background: ac, border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>{'🎲 ' + t('chords.gen')}</button>
                    <button onClick={handleGenerateFromMIDI} title={t('chords.midi')} style={{ padding: '8px 15px', background: acSec, border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>{'🎹 ' + t('chords.midi')}</button>

                    <button
                        onClick={onGlobalGenerate}
                        title={t('chords.globalGen')}
                        style={{
                            padding: '8px 20px',
                            background: isDark ? hexToRgba(ac, 0.15) : ac,
                            border: `1px solid ${ac}`,
                            borderRadius: '4px',
                            color: isDark ? ac : '#fff',
                            fontSize: '11px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            letterSpacing: '0.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>✨</span> {t('chords.globalGen')}
                    </button>

                    {onSuggest && <button onClick={onSuggest} title={t('chords.suggest')} style={{ padding: '8px 16px', background: isDark ? 'rgba(255, 159, 67, 0.12)' : `${acSec}22`, border: `1px solid ${acSec}`, borderRadius: '4px', color: acSec, fontSize: '11px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.5px' }}>{'✦ ' + t('chords.suggest')}</button>}

                    {onAddToArrangement && <button onClick={onAddToArrangement} style={{ padding: '8px 16px', background: isDark ? 'rgba(84, 160, 255, 0.15)' : '#54a0ff', border: '1px solid #54a0ff', borderRadius: '4px', color: isDark ? '#54a0ff' : '#fff', fontSize: '10px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.5px' }} title={t('chords.addToArrangement')}>{t('chords.addArr')}</button>}

                    <button onClick={clearPattern} disabled={chordPattern.length === 0} title={t('chords.clear')} style={{ padding: '8px 15px', background: chordPattern.length > 0 ? ac : '#555', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: chordPattern.length > 0 ? 'pointer' : 'not-allowed' }}>{'🗑️ ' + t('chords.clear')}</button>


                </div>
            </div>

            <div style={{ flex: 1, background: isDark ? '#0a0a0a' : '#f0f0f0', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px', color: isDark ? '#888' : '#666' }}>{t('chords.progression')} {locked && <span style={{ color: acSec, marginLeft: '10px' }}>[{t('common.locked')}]</span>}</div>
                <div style={{ flex: 1, background: isDark ? '#000' : '#fff', borderRadius: '4px', overflow: 'hidden', border: `1px solid ${isDark ? '#2a2a3e' : '#ccc'}`, position: 'relative', opacity: locked ? 0.8 : 1 }}>
                    <PianoRollEditor pattern={chordPattern} onPatternChange={handlePatternChange} bars={globalBars} globalResolution={globalResolution} globalKey={globalKey} globalScale={globalScale} theme={theme} height={300} currentStep={globalCurrentStep} globalPlayStartTime={globalPlayStartTime} globalTempo={globalTempo} fixedOctave={true} rootPitch={rootPitch} onDrop={handleDrop} accentColors={accentColors} />
                    {locked && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.1)', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '40px', opacity: 0.2 }}>🔒</div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '10px', padding: '10px', background: isDark ? '#0a0a0a' : '#f0f0f0', borderRadius: '4px', fontSize: '11px', color: isDark ? '#888' : '#666' }}>
                {'💡 '}<strong>{t('common.tip')}:</strong> {locked ? t('chords.tipLocked') : t('chords.tipUnlocked')} {t('chords.tipSuffix')}
            </div>

            {/* Sample Slicer Overlay */}
            {showSlicer && loadedInstrument && (() => {
                const inst = sampler?.instruments?.get(loadedInstrument);
                const firstBuf = inst?.samples?.values()?.next()?.value;
                if (!firstBuf) return null;
                return (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 200 }}>
                        <SampleSlicerEditor
                            buffer={firstBuf}
                            name={instrumentName || t('chords.sample')}
                            isDark={isDark}
                            onClose={() => setShowSlicer(false)}
                            onLoadToGenerator={(data) => {
                                if (onLoadSlicedInstrument) {
                                    const newId = onLoadSlicedInstrument({ ...data, targetTrack: 'chords' });
                                    if (newId) {
                                        setLoadedInstrument(newId);
                                        setInstrumentName(data.name);
                                    }
                                }
                                setShowSlicer(false);
                            }}
                            sampler={sampler}
                            globalTempo={globalTempo}
                        />
                    </div>
                );
            })()}
        </div>
    );
});

export default ChordGeneratorEnhanced;
