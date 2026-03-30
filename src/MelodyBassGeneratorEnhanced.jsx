import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { hoverProps } from './buttonHover';
import PianoRollEditor from './PianoRollEditor';
import { MOOD_MODIFIERS } from './GenreLibraryWithSubGenres';
import { SCALES } from './MusicTheory';
import { generateMelodyPattern, generateBassPattern, generateCounterMelody } from './PatternEngine';
import { collectAudioFiles, collectMidiFiles, shuffleArray } from './randomFileUtils';
import MIDIParser from './MIDIParser';
import { getFileFromItem } from './getFileFromItem.js';
import SampleSlicerEditor from './SampleSlicerEditor.jsx';
import { hexToRgba } from './accentThemes';
import { loopMelodicPattern } from './patternUtils';
import { useTranslation } from './i18n/I18nContext.jsx';
import CounterMelodyPanel from './components/CounterMelodyPanel';

const filterMidiPatternByType = (pattern, type) => {
    const stepGroups = {};
    pattern.forEach(n => {
        if (!stepGroups[n.time]) stepGroups[n.time] = [];
        stepGroups[n.time].push(n);
    });

    const filtered = [];
    Object.values(stepGroups).forEach(group => {
        group.sort((a, b) => a.note - b.note);

        // Remove exact duplicates
        const uniqueGroup = [];
        const seen = new Set();
        group.forEach(n => {
            if (!seen.has(n.note)) {
                uniqueGroup.push(n);
                seen.add(n.note);
            }
        });

        if (type === 'bass') {
            filtered.push(uniqueGroup[0]); // Lowest note only!
        } else if (type === 'melody') {
            filtered.push(uniqueGroup[uniqueGroup.length - 1]); // Highest note only!
        } else if (type === 'chords') {
            if (uniqueGroup.length >= 3) {
                filtered.push(...uniqueGroup.slice(1, uniqueGroup.length - 1)); // Middle notes
            } else {
                filtered.push(...uniqueGroup); // Keep all if it's already a small chord
            }
        } else {
            filtered.push(...uniqueGroup);
        }
    });

    // Sort final pattern by time
    return filtered.sort((a, b) => a.time - b.time);
};

const MelodyBassGeneratorEnhanced = React.forwardRef(({ selectedFolder, sampler, theme, globalKey, globalScale, globalTempo, globalBars, globalResolution, globalIsPlaying, globalCurrentStep, globalCurrentStepRef, globalIsPlayingRef, globalContinuousProgress, globalPlayStartTime, globalMood, globalGenre, globalOctave, setGlobalOctave, type, onPatternChange, onStatusChange, onInstrumentLoad, onSampleLoadingChange, externalPattern, chordPatternData, globalSolos, updateGlobalSolo, isAnythingSoloed, globalMutes, setGlobalMutes, onGlobalGenerate, onAddToArrangement, isGenerated, setIsGenerated, onExportClick, onLoadClick, onNewProject, onSuggest, onLoadSlicedInstrument, accentColors, confirmBeforeClear, setGlobalBars, globalRepeat, setGlobalRepeat,
    onClipGenerated, editingClipId, clipPlaybackActive, onMidiDrop }, ref) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';





    const isDark = theme === 'dark';
    const isMelody = type === 'melody';
    const mood = globalMood || 'Standard';
    const keyOffset = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(globalKey || 'C');
    const rootPitch = ((globalOctave + 1) * 12) + (keyOffset >= 0 ? keyOffset : 0);

    const [pattern, setPattern] = useState(externalPattern || []);
    const prevBarsRef = useRef(globalBars);
    const prevExternalPatternRef = useRef(externalPattern);

    const [loadedInstrument, setLoadedInstrument] = useState(null);
    const [instrumentName, setInstrumentName] = useState('');
    const [showSlicer, setShowSlicer] = useState(false);
    const [complexity, setComplexity] = useState('simple');
    const [lastTriggeredStep, setLastTriggeredStep] = useState(-1);
    const [dragOver, setDragOver] = useState(false);
    const [powered, setPowered] = useState(true);
    const [locked, setLocked] = useState(false);
    const trackId = type === 'melody' ? 'melody' : 'bass';
    const muted = globalMutes?.has(trackId) || false;
    const isGlobalSoloed = globalSolos?.has(trackId);

    const toggleMute = useCallback(() => {
        if (!setGlobalMutes) return;
        setGlobalMutes(prev => {
            const next = new Set(prev);
            if (next.has(trackId)) {
                next.delete(trackId);
                if (sampler?.setTrackVolume) sampler.setTrackVolume(trackId, 0.5);
            } else {
                next.add(trackId);
                if (sampler?.setTrackVolume) sampler.setTrackVolume(trackId, 0);
            }
            return next;
        });
    }, [setGlobalMutes, sampler, trackId]);

    const toggleSolo = (e) => {
        const isCtrl = e.ctrlKey;
        if (updateGlobalSolo) {
            updateGlobalSolo(trackId, !isGlobalSoloed, isCtrl);
        }
    };

    // Detect when externalPattern changes during this render (used to skip bars-loop)
    const externalPatternChanged = externalPattern !== prevExternalPatternRef.current
        && externalPattern && externalPattern.length > 0;
    prevExternalPatternRef.current = externalPattern;

    // Update pattern length when bars change
    useEffect(() => {
        const oldBars = prevBarsRef.current;
        const newBars = globalBars;
        prevBarsRef.current = newBars;
        if (oldBars === newBars) return;
        // Skip loop-resize when an external pattern arrived in the same render
        if (externalPatternChanged) return;
        const newPattern = loopMelodicPattern(pattern, oldBars, newBars);
        setPattern(newPattern);
        if (onPatternChange) onPatternChange(newPattern);
    }, [globalBars]);

    // Sync from external pattern (folder analysis / MIDI extraction)
    useEffect(() => {
        if (externalPattern && externalPattern.length > 0) {
            setPattern(externalPattern);
        }
    }, [externalPattern]);

    const handleLoadInstrument = async () => {
        if (!selectedFolder || !sampler) return alert(t('common.selectFolderFirst'));
        const audioFiles = selectedFolder.samples.filter(s => s.file && s.file.type.startsWith('audio/'));
        if (audioFiles.length === 0) return alert(t('common.noAudioFiles'));
        if (onSampleLoadingChange) onSampleLoadingChange(true);
        try {
            const instrumentId = `${type}_${Date.now()}`;
            await sampler.loadInstrumentFromFiles(instrumentId, audioFiles.map(s => s.file), audioFiles[0]?.file.name || "Loaded Instrument");
            setLoadedInstrument(instrumentId);
            setInstrumentName(selectedFolder.name);
            if (onInstrumentLoad) onInstrumentLoad(instrumentId);
        } catch (error) { console.error(error); } finally {
            if (onSampleLoadingChange) onSampleLoadingChange(false);
        }
    };

    const randomizeSound = async () => {
        if (!selectedFolder) {
            console.warn(`[${type}] No folder selected`);
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
                const instrumentId = `${type}_rand_${Date.now()}`;
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
                        const newPattern = allNotes.map(n => ({
                            time: Math.round(n.startTick / ticksPerStep),
                            duration: Math.max(1, Math.round(n.duration / ticksPerStep)),
                            note: n.note,
                            velocity: 1.0 // Force 100% velocity for consistent solid color in UI
                        }));
                        const filteredPattern = filterMidiPatternByType(newPattern, type);
                        setPattern(filteredPattern);
                        if (onPatternChange) onPatternChange(filteredPattern);
                        setInstrumentName("MIDI: " + pick.name);
                        return;
                    }
                } catch (e) { console.warn(`[${type}] Failed to parse MIDI:`, pick.name, e); }

            }

            console.warn(`[${type}] No valid audio or MIDI files in folder:`, selectedFolder.name);
        } catch (err) { console.error(`[${type}] Randomize sound error:`, err); } finally {
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

                if (!notes || notes.length === 0) {
                    const file = await getFileFromItem(draggedItem);
                    if (file) {
                        const parser = new MIDIParser();
                        const midiData = await parser.loadMIDIFile(file);
                        notes = [];
                        midiData.tracks.forEach(track => {
                            notes = [...notes, ...parser.eventsToNotes(track.events)];
                        });
                        tpb = midiData.ticksPerBeat || 480;
                        draggedItem.midiNotes = notes;
                        draggedItem.ticksPerBeat = tpb;
                    }
                }

                if (notes && notes.length > 0 && onMidiDrop) {
                    onMidiDrop(notes, tpb);
                    return;
                }
            } catch (err) { console.error(`[${type}] MIDI drop error:`, err); }
        }

        // Check for external MIDI file drag
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
                    if (allNotes.length > 0 && onMidiDrop) {
                        onMidiDrop(allNotes, midiData.ticksPerBeat || 480);
                        return;
                    }
                } catch (err) { console.error(`[${type}] External MIDI parse error:`, err); }
            }
        } else if (draggedItem && (draggedItem.handle || draggedItem.nativePath)) {
            file = await getFileFromItem(draggedItem);
        }

        if (file && file.type.startsWith('audio/') && sampler) {
            try {
                const instrumentId = `${type}_drop_${Date.now()}`;
                await sampler.loadInstrumentFromFiles(instrumentId, [file], file.name);
                setLoadedInstrument(instrumentId);
                setInstrumentName(file.name);
                if (onInstrumentLoad) onInstrumentLoad(instrumentId);
            } catch (err) { console.error(err); }
        }
    };

    const clearPattern = () => {
        if (locked || pattern.length === 0) return;
        if (confirmBeforeClear && !window.confirm(t('melodyBass.clearConfirm', { type }))) return;
        setPattern([]);
        if (setIsGenerated) setIsGenerated(false);
        if (onPatternChange) onPatternChange([]);
    };

    const handlePatternChange = (newPattern) => {
        if (locked) return;
        setPattern(newPattern);
        if (setIsGenerated) setIsGenerated(false);
        if (onPatternChange) onPatternChange(newPattern);
    };

    const generatePattern = useCallback(() => {
        if (locked) return;
        try {
            const totalSteps = globalBars * 32;
            const baseBars = globalBars > 4 ? 4 : globalBars;
            let newPattern;

            if (type === 'melody') {
                newPattern = generateMelodyPattern({
                    key: globalKey,
                    scale: globalScale,
                    genre: globalGenre || 'Hip Hop',
                    mood: globalMood || 'Standard',
                    bars: baseBars,
                    complexity,
                    octave: globalOctave,
                    chordPattern: chordPatternData || null
                });
            } else {
                newPattern = generateBassPattern({
                    key: globalKey,
                    scale: globalScale,
                    genre: globalGenre || 'Hip Hop',
                    mood: globalMood || 'Standard',
                    bars: baseBars,
                    complexity,
                    octave: globalOctave,
                    chordPattern: chordPatternData || null
                });
            }

            // Always loop 4-bar base to fill full bar count
            if (globalBars > 4) {
                newPattern = loopMelodicPattern(newPattern, baseBars, globalBars);
            }

            // Ensure notes are within bounds
            newPattern = newPattern.filter(n => n.time < totalSteps);

            console.log(`[${type}Generator] Generated ${newPattern.length} notes via PatternEngine`);
            setPattern(newPattern);
            if (setIsGenerated) setIsGenerated(newPattern.length > 0);
            if (onPatternChange) onPatternChange(newPattern);
            if (onStatusChange) onStatusChange({ hasSamples: !!loadedInstrument, hasPattern: newPattern.length > 0 });
        } catch (err) {
            console.error(`[${type}Generator] Pattern generation failed:`, err);
        }
    }, [locked, globalKey, globalScale, globalGenre, globalMood, globalBars, globalRepeat, complexity, globalOctave, type, chordPatternData, onPatternChange, onStatusChange, loadedInstrument, setIsGenerated]);

    const handleCounterMelody = useCallback(() => {
        if (locked || type !== 'melody' || pattern.length === 0) return;
        try {
            // Strip any previous counter-melody notes first (keep only the original melody)
            const originalMelody = pattern.filter(n => n.layer !== 'counter');
            if (originalMelody.length === 0) return;

            const counterNotes = generateCounterMelody({
                melody: originalMelody,
                key: globalKey,
                scale: globalScale,
                genre: globalGenre || 'Hip Hop',
                mood: globalMood || 'Standard',
                bars: globalBars,
                complexity,
                octave: globalOctave,
                chordPattern: chordPatternData || null
            });
            const totalSteps = globalBars * 32;
            const merged = [...originalMelody, ...counterNotes]
                .filter(n => n.time < totalSteps)
                .sort((a, b) => a.time - b.time);
            setPattern(merged);
            if (setIsGenerated) setIsGenerated(true);
            if (onPatternChange) onPatternChange(merged);
            console.log(`[melodyGenerator] Replaced counter-melody: ${counterNotes.length} notes (from ${originalMelody.length} original)`);
        } catch (err) {
            console.error('[melodyGenerator] Counter-melody generation failed:', err);
        }
    }, [locked, type, pattern, globalKey, globalScale, globalGenre, globalMood, globalBars, complexity, globalOctave, chordPatternData, onPatternChange, setIsGenerated]);

    const pendingClipGenRef = useRef(false);

    React.useImperativeHandle(ref, () => ({
        generate: () => {
            if (onClipGenerated) pendingClipGenRef.current = true;
            generatePattern();
        },
        getPattern: () => pattern,
        generateCounterMelody: () => handleCounterMelody(),
        loadSample: async (sampleItem) => {
            if (!sampleItem || !sampler) return;
            try {
                const file = await getFileFromItem(sampleItem);
                const instrumentId = `${type}_ext_${Date.now()}`;
                await sampler.loadInstrumentFromFiles(instrumentId, [file], file.name);
                setLoadedInstrument(instrumentId);
                setInstrumentName(file.name);
                if (onInstrumentLoad) onInstrumentLoad(instrumentId);
                if (onStatusChange) onStatusChange({ hasSamples: true, hasPattern: pattern.length > 0 });
            } catch (err) { console.error(`[${type}] loadSample error:`, err); }
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

                const filteredPattern = filterMidiPatternByType(newPattern, type);
                setPattern(filteredPattern);
                if (setIsGenerated) setIsGenerated(true);
                if (onPatternChange) onPatternChange(filteredPattern);
                if (onStatusChange) onStatusChange({ hasSamples: !!loadedInstrument, hasPattern: true });
            } catch (err) { console.error(`[${type}] loadMIDI error:`, err); }
        },
        loadState: (loadedPattern, instrumentId) => {
            setPattern(loadedPattern || []);
            if (instrumentId && sampler) {
                const info = sampler.getInstrumentInfo(instrumentId);
                if (info) {
                    setLoadedInstrument(instrumentId);
                    setInstrumentName(info.name);
                }
            }
            if (setIsGenerated) setIsGenerated(!!loadedPattern?.length);
        },
        clear: () => {
            if (locked) return;
            setPattern([]);
            setLoadedInstrument(null);
            setInstrumentName('');
            if (setIsGenerated) setIsGenerated(false);
            if (onPatternChange) onPatternChange([]);
            if (onStatusChange) onStatusChange({ hasSamples: false, hasPattern: false });
        }
    }), [sampler, type, pattern, loadedInstrument, generatePattern, locked, onClipGenerated]);

    const handleGenerateFromMIDI = async () => {
        if (locked) return;
        try {
            if (!selectedFolder) return alert(t('common.selectFolderFirst'));
            const midiFiles = await collectMidiFiles(selectedFolder);
            if (midiFiles.length === 0) return alert(t('common.noMidiFound'));

            const randomMidi = midiFiles[Math.floor(Math.random() * midiFiles.length)];
            const file = await getFileFromItem(randomMidi);

            const parser = new MIDIParser();
            const midiData = await parser.loadMIDIFile(file);

            let notes = [];
            for (const track of midiData.tracks) {
                const trackNotes = parser.eventsToNotes(track.events);
                if (trackNotes.length > 0) { notes = trackNotes; break; }
            }
            if (notes.length === 0) return alert(t('melodyBass.noNotesInMidi'));

            const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
            const newPattern = notes.map(n => ({
                time: Math.floor(n.startTick / ticksPerStep),
                duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                note: n.note,
                velocity: n.velocity / 127
            })).filter(n => n.time < globalBars * 32);

            const filteredPattern = filterMidiPatternByType(newPattern, type);
            setPattern(filteredPattern);
            if (setIsGenerated) setIsGenerated(true);
            if (onPatternChange) onPatternChange(filteredPattern);
            if (onStatusChange) onStatusChange({ hasSamples: !!loadedInstrument, hasPattern: true });
        } catch (err) { console.error(err); }
    };


    // Emit clip after generate completes
    useEffect(() => {
        if (pendingClipGenRef.current && onClipGenerated && pattern.length > 0) {
            pendingClipGenRef.current = false;
            const label = type === 'melody' ? 'Melody Clip' : 'Bass Clip';
            onClipGenerated({ bars: globalBars, pattern: pattern.map(n => ({ ...n })), name: label, color: null });
        }
    }, [pattern, onClipGenerated, globalBars, type]);

    // Playback Logic — Ref-based polling (decoupled from React renders)
    const lastProcessedStepRef = useRef(-1);
    const samplerRef2 = useRef(sampler);
    const loadedInstrumentRef = useRef(loadedInstrument);
    const patternRef = useRef(pattern);
    const globalTempoRef = useRef(globalTempo);
    const globalBarsRef = useRef(globalBars);
    const poweredRef = useRef(powered);
    const mutedRef = useRef(muted);
    const isGlobalSoloedRef = useRef(isGlobalSoloed);
    const isAnythingSoloedRef = useRef(isAnythingSoloed);

    useEffect(() => { samplerRef2.current = sampler; }, [sampler]);
    useEffect(() => { loadedInstrumentRef.current = loadedInstrument; }, [loadedInstrument]);
    const patternVersionRef = useRef(0);
    useEffect(() => { patternRef.current = pattern; patternVersionRef.current++; }, [pattern]);
    useEffect(() => { globalTempoRef.current = globalTempo; }, [globalTempo]);
    useEffect(() => { globalBarsRef.current = globalBars; }, [globalBars]);
    useEffect(() => { poweredRef.current = powered; }, [powered]);
    useEffect(() => { mutedRef.current = muted; }, [muted]);
    useEffect(() => { isGlobalSoloedRef.current = isGlobalSoloed; }, [isGlobalSoloed]);
    useEffect(() => { isAnythingSoloedRef.current = isAnythingSoloed; }, [isAnythingSoloed]);

    const clipPlaybackActiveRef = useRef(clipPlaybackActive);
    useEffect(() => { clipPlaybackActiveRef.current = clipPlaybackActive; }, [clipPlaybackActive]);

    useEffect(() => {
        if (!globalCurrentStepRef || !globalIsPlayingRef) return;

        let lastCtx = samplerRef2.current?.audioContext || null;
        let lastPatternVersion = patternVersionRef.current;

        const poll = () => {
            if (!globalIsPlayingRef.current || !samplerRef2.current || !loadedInstrumentRef.current) {
                if (lastProcessedStepRef.current !== -1) {
                    lastProcessedStepRef.current = -1;
                }
                return;
            }

            // Don't schedule notes while AudioContext is still resuming
            const ctx2 = samplerRef2.current.audioContext;
            if (!ctx2 || ctx2.state !== 'running') return;

            const currentStep = globalCurrentStepRef.current;
            if (currentStep < 0) return;

            const totalSteps = globalBarsRef.current * 32;
            const shouldPlay = poweredRef.current && (isAnythingSoloedRef.current ? isGlobalSoloedRef.current : !mutedRef.current);

            // Detect AudioContext hot-swap — re-trigger sustaining notes on new context
            const currentCtx = samplerRef2.current.audioContext;
            if (currentCtx && currentCtx !== lastCtx) {
                lastCtx = currentCtx;
                if (shouldPlay) {
                    const triggerStep = currentStep % totalSteps;
                    const sustainingNotes = patternRef.current.filter(n => {
                        const noteStart = Math.round(n.time);
                        const noteEnd = noteStart + (n.duration || 1);
                        return noteStart <= triggerStep && noteEnd > triggerStep;
                    });
                    sustainingNotes.forEach(n => {
                        const remainingSteps = (Math.round(n.time) + (n.duration || 1)) - (currentStep % totalSteps);
                        const remainingDuration = Math.max(0.05, (remainingSteps / 8) * (60 / globalTempoRef.current));
                        samplerRef2.current.playNote(loadedInstrumentRef.current, n.note, n.velocity, remainingDuration, null, type);
                    });
                }
            }

            // Detect mid-playback pattern change — runs even during clip playback
            // so regeneration stops old notes and starts new ones instantly.
            if (patternVersionRef.current !== lastPatternVersion) {
                lastPatternVersion = patternVersionRef.current;
                // Kill old pattern's sustaining notes immediately
                if (loadedInstrumentRef.current && samplerRef2.current.stopInstrument) {
                    samplerRef2.current.stopInstrument(loadedInstrumentRef.current);
                }
                if (shouldPlay) {
                    const triggerStep = currentStep % totalSteps;
                    const sustainingNotes = patternRef.current.filter(n => {
                        const noteStart = Math.round(n.time);
                        const noteEnd = noteStart + (n.duration || 1);
                        return noteStart <= triggerStep && noteEnd > triggerStep;
                    });
                    sustainingNotes.forEach(n => {
                        const remainingSteps = (Math.round(n.time) + (n.duration || 1)) - triggerStep;
                        const remainingDuration = Math.max(0.05, (remainingSteps / 8) * (60 / globalTempoRef.current));
                        samplerRef2.current.playNote(loadedInstrumentRef.current, n.note, n.velocity, remainingDuration, null, type);
                    });
                    lastProcessedStepRef.current = currentStep;
                }
            }

            // Skip normal step processing when clip playback is active —
            // clip system handles ongoing scheduling; poll only handles
            // instant transitions (pattern changes, hot-swaps) above.
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
                    const notes = patternRef.current.filter(n => Math.round(n.time) === triggerStep);
                    notes.forEach(n => samplerRef2.current.playNote(loadedInstrumentRef.current, n.note, n.velocity, (n.duration / 8) * (60 / globalTempoRef.current), null, type));
                }
            }
            lastProcessedStepRef.current = currentStep;
        };

        const id = setInterval(poll, 25);
        return () => clearInterval(id);
    }, [globalCurrentStepRef, globalIsPlayingRef, type]);


    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: isDark ? 'transparent' : '#fff', color: isDark ? '#eee' : '#333', padding: '24px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}>
            <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: `1px solid ${isDark ? '#2a2a3e' : '#e0e0e0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', textTransform: 'capitalize' }}>
                        {t(isMelody ? 'melodyBass.melodyTitle' : 'melodyBass.bassTitle')}
                        {isGenerated && <span style={{ color: ac, fontSize: '14px', marginLeft: '8px' }} title={t('common.patternGenerated')}>✅</span>}
                        {loadedInstrument && <span style={{ color: acSec, fontSize: '14px', marginLeft: '8px' }} title={t('common.instrumentLoaded')}>🔉</span>}
                    </h3>
                    <p style={{ margin: 0, fontSize: '11px', color: isDark ? '#888' : '#666' }}>{t('melodyBass.subtitle')}</p>
                    {editingClipId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: ac, background: `${ac}22`, padding: '2px 8px', borderRadius: '4px' }}>Editing Clip</span>
                            <button onClick={() => window.dispatchEvent(new CustomEvent(`wavloom-close-${type}-clip-edit`))} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: 'transparent', color: isDark ? '#ccc' : '#555', cursor: 'pointer' }}>Close</button>
                        </div>
                    )}
                </div>

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
                    <div style={{ width: '40px', height: '40px', background: isDark ? '#0f0f1a' : '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, color: ac, letterSpacing: '0.5px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>INST</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: ac, letterSpacing: '1px', textTransform: 'uppercase' }}>{t(isMelody ? 'melodyBass.melodyInstrument' : 'melodyBass.bassInstrument')}</div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: isDark ? '#fff' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{instrumentName || t('melodyBass.dropSample')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                            {...hoverProps}
                            onClick={onNewProject}
                            style={{ background: isDark ? hexToRgba(ac, 0.1) : '#fff', border: `1.5px solid ${isDark ? hexToRgba(ac, 0.3) : '#eee'}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            title={t('common.startNewProject')}
                        >
                            {t('melodyBass.new')}
                        </button>
                        <button
                            {...hoverProps}
                            onClick={onLoadClick}
                            style={{ background: isDark ? hexToRgba(ac, 0.1) : '#fff', border: `1.5px solid ${isDark ? hexToRgba(ac, 0.3) : '#eee'}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            title={t('common.loadProject')}
                        >
                            {t('melodyBass.load')}
                        </button>
                        <button
                            {...hoverProps}
                            onClick={onExportClick}
                            style={{ background: isDark ? hexToRgba(ac, 0.1) : '#fff', border: `1.5px solid ${isDark ? hexToRgba(ac, 0.3) : '#eee'}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            title={t('common.exportProject')}
                        >
                            {t('melodyBass.export')}
                        </button>
                        <button
                            onClick={(e) => updateGlobalSolo(trackId, !isGlobalSoloed, e.ctrlKey)}
                            style={{
                                width: '24px', height: '24px',
                                background: isGlobalSoloed ? acSec : (isDark ? '#1a1a1f' : '#eee'),
                                border: 'none', borderRadius: '4px',
                                color: isGlobalSoloed ? '#000' : (isDark ? '#555' : '#888'),
                                fontSize: '10px', fontWeight: '900', cursor: 'pointer',
                                boxShadow: isGlobalSoloed ? `0 0 10px ${acSec}` : 'none', transition: 'all 0.1s'
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
                            >{t('melodyBass.slice')}</button>
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
                        >{t('melodyBass.stx')}</button>
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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', rowGap: '8px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {['simple', 'complex'].map(level => (
                            <button key={level} onClick={() => setComplexity(level)} title={t(`common.${level}Tooltip`)} style={{ padding: '8px 16px', background: complexity === level ? ac : (isDark ? '#2a2a3e' : '#fff'), border: `1px solid ${isDark ? '#444' : '#ccc'}`, borderRadius: '4px', color: complexity === level ? '#fff' : (isDark ? '#fff' : '#333'), fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}>{t(`melodyBass.${level}`)}</button>
                        ))}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', marginBottom: '5px', color: isDark ? '#666' : '#888', letterSpacing: '1px' }}>{t('melodyBass.octave')}</label>
                        <select value={globalOctave} onChange={e => setGlobalOctave(parseInt(e.target.value))} title={t('common.octaveTooltip')} style={{ padding: '8px 12px', background: isDark ? '#1a1a2e' : '#fff', border: `1px solid ${isDark ? '#2a2a3e' : '#ccc'}`, borderRadius: '4px', color: isDark ? '#ddd' : '#333', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                            {[0, 1, 2, 3, 4, 5, 6].map(o => <option key={o} value={o}>{t('melodyBass.octLabel', { oct: o })}</option>)}
                        </select>
                    </div>
                    <button {...hoverProps} onClick={generatePattern} title={t('melodyBass.gen')} style={{ padding: '8px 15px', background: ac, border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>{t('melodyBass.gen')}</button>
                    <button {...hoverProps} onClick={handleGenerateFromMIDI} title={t('melodyBass.midi')} style={{ padding: '8px 15px', background: ac, border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>{t('melodyBass.midi')}</button>
                    {type === 'melody' && pattern.length > 0 && (
                        <button {...hoverProps} onClick={handleCounterMelody} style={{ padding: '8px 15px', background: ac, border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }} title={t('melodyBass.counterTooltip')}>{t('melodyBass.counter')}</button>
                    )}

                    <button
                        onClick={onGlobalGenerate}
                        title={t('melodyBass.globalGen')}
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
                        {t('melodyBass.globalGen')}
                    </button>

                    {onSuggest && <button {...hoverProps} onClick={onSuggest} title={t('melodyBass.suggest')} style={{ padding: '8px 16px', background: isDark ? hexToRgba(ac, 0.12) : `${ac}22`, border: `1px solid ${ac}`, borderRadius: '4px', color: ac, fontSize: '11px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.5px' }}>{t('melodyBass.suggest')}</button>}

                    {onAddToArrangement && <button {...hoverProps} onClick={onAddToArrangement} style={{ padding: '8px 16px', background: isDark ? hexToRgba(ac, 0.15) : ac, border: `1px solid ${ac}`, borderRadius: '4px', color: isDark ? ac : '#fff', fontSize: '10px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.5px' }} title={t('melodyBass.addToArrangement', { type })}>{t('melodyBass.addArr')}</button>}

                                        {/* Separator */}
                    <div style={{ width: '1px', height: '28px', background: isDark ? '#333' : '#ccc', margin: '0 4px', alignSelf: 'center' }} />

                    {/* Bar selector buttons */}
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                        {[4, 8, 16, 32, 64].map(bars => (
                            <button
                                key={bars}
                                onClick={() => setGlobalBars && setGlobalBars(bars)}
                                title={t('common.barsTooltip', { count: bars })}
                                style={{
                                    padding: '4px 6px',
                                    background: globalBars === bars ? ac : (isDark ? '#2a2a3e' : '#fff'),
                                    border: `1px solid ${globalBars === bars ? ac : (isDark ? '#444' : '#ccc')}`,
                                    borderRadius: '4px',
                                    color: globalBars === bars ? '#fff' : (isDark ? '#aaa' : '#555'),
                                    fontSize: '9px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    lineHeight: '1.1',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <span>{bars}</span>
                                <span style={{ fontSize: '7px', opacity: 0.7 }}>{t('melodyBass.bars')}</span>
                            </button>
                        ))}
                    </div>

                    {/* Repeat toggle */}
                    <button
                        onClick={() => setGlobalRepeat && setGlobalRepeat(prev => !prev)}
                        style={{
                            padding: '6px 10px',
                            background: globalRepeat ? ac : (isDark ? '#2a2a3e' : '#fff'),
                            border: `1px solid ${globalRepeat ? ac : (isDark ? '#444' : '#ccc')}`,
                            borderRadius: '4px',
                            color: globalRepeat ? '#fff' : (isDark ? '#aaa' : '#555'),
                            fontSize: '10px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s',
                            boxShadow: globalRepeat ? ('0 0 8px ' + hexToRgba(ac, 0.4)) : 'none'
                        }}
                        title={t('melodyBass.repeatTooltip')}
                    >
                        <span style={{ fontSize: '12px' }}>↻</span> {t('melodyBass.rpt')}
                    </button>

                    <button {...hoverProps} onClick={clearPattern} disabled={pattern.length === 0} title={t('melodyBass.clear')} style={{ padding: '8px 15px', background: pattern.length > 0 ? ac : '#555', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: pattern.length > 0 ? 'pointer' : 'not-allowed' }}>{t('melodyBass.clear')}</button>
                </div>
            </div>

            <div style={{ flex: 1, background: isDark ? '#0a0a0a' : '#f0f0f0', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px', color: isDark ? '#888' : '#666' }}>{t(isMelody ? 'melodyBass.melodyPattern' : 'melodyBass.bassPattern')}</div>
                <div style={{ flex: 1, background: isDark ? '#000' : '#fff', borderRadius: '4px', overflow: 'hidden', border: `1px solid ${isDark ? '#2a2a3e' : '#ccc'}` }}>
                    <PianoRollEditor pattern={pattern} onPatternChange={handlePatternChange} bars={globalBars} globalResolution={globalResolution} globalKey={globalKey} globalScale={globalScale} theme={theme} height={300} currentStep={globalCurrentStep} globalPlayStartTime={globalPlayStartTime} globalTempo={globalTempo} fixedOctave={true} rootPitch={rootPitch} onDrop={handleDrop} accentColors={accentColors} />
                </div>
            </div>

            {type === 'melody' && (
                <CounterMelodyPanel
                    melody={pattern}
                    chordPattern={chordPatternData}
                    globalKey={globalKey}
                    globalScale={globalScale}
                    globalBars={globalBars}
                    globalOctave={globalOctave}
                    theme={theme}
                    accentColors={accentColors}
                    sampler={sampler}
                    loadedInstrument={loadedInstrument}
                    globalTempo={globalTempo}
                    onInsert={(merged) => {
                        setPattern(merged);
                        if (setIsGenerated) setIsGenerated(true);
                        if (onPatternChange) onPatternChange(merged);
                    }}
                />
            )}

            <div style={{ marginTop: '10px', padding: '10px', background: isDark ? '#0a0a0a' : '#f0f0f0', borderRadius: '4px', fontSize: '11px', color: isDark ? '#888' : '#666' }}>
                <strong>{t('common.tip')}:</strong> {t('melodyBass.tipLoad')} {isMelody ? t('melodyBass.tipMelody') : t('melodyBass.tipBass')} {t('melodyBass.tipCommon')}
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
                            name={instrumentName || t(isMelody ? 'melodyBass.melodySample' : 'melodyBass.bassSample')}
                            isDark={isDark}
                            onClose={() => setShowSlicer(false)}
                            onLoadToGenerator={(data) => {
                                if (onLoadSlicedInstrument) {
                                    const newId = onLoadSlicedInstrument({ ...data, targetTrack: type });
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

export default MelodyBassGeneratorEnhanced;
