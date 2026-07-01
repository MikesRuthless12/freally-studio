import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getProPattern, getLanes, resetBeatContext } from './drumPatterns';
import { determineComplexity } from './PatternEngine';
import { getAllGenres, getSubGenresForGenre } from './GenreLibraryWithSubGenres';
import { collectAudioFiles } from './randomFileUtils';
import { getFileFromItem } from './getFileFromItem.js';
import WaveformVisualizer from './WaveformVisualizer';
import DrumSampleEditor from './DrumSampleEditor';
import { hexToRgba } from './accentThemes';
import { loopDrumPattern } from './patternUtils';
import { useTranslation } from './i18n/I18nContext.jsx';
import EuclideanPanel, { EuclideanMiniButton } from './euclidean/EuclideanPanel';
import { euclidean } from './PatternEngine';

// WinForms-style hover: brightens on enter, restores on leave
const hoverProps = {
    onMouseEnter: (e) => { e.currentTarget.style.filter = 'brightness(1.6)'; e.currentTarget.style.outline = '2px solid rgba(255,255,255,0.4)'; e.currentTarget.style.outlineOffset = '-1px'; },
    onMouseLeave: (e) => { e.currentTarget.style.filter = ''; e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; },
    onMouseDown: (e) => { e.currentTarget.style.filter = 'brightness(0.7)'; },
    onMouseUp: (e) => { e.currentTarget.style.filter = 'brightness(1.6)'; },
};

const DrumGeneratorEnhanced = React.forwardRef(({
    selectedFolder,
    globalSelectedSample,
    sampler,
    theme,
    globalGenre,
    setGlobalGenre,
    globalMood,
    setGlobalMood,
    globalTempo,
    globalBars,
    globalResolution,
    globalKey,
    globalScale,
    globalIsPlaying,
    globalCurrentStep,
    globalContinuousProgress,
    globalPlayStartTime,
    onPatternChange,
    onSampleLoad,
    onSampleLoadingChange,
    globalSolos,
    updateGlobalSolo,
    isAnythingSoloed,
    onGlobalGenerate,
    onSuggest,
    isGenerated,
    setIsGenerated,
    externalPattern,
    onExportClick,
    onLoadClick,
    onClearExternal, onNewProject, accentColors, confirmBeforeClear, setGlobalBars, globalRepeat, setGlobalRepeat,
    onDrumClipGenerated, editingDrumClipId, clipPlaybackActive }, ref) => {
    // Accent colors with fallback
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';
    const { t } = useTranslation();


    const isDark = theme === 'dark';
    const lanesDef = getLanes();

    // Sync local bars state with global and handle resizing
    const [bars, setBars] = useState(globalBars);
    const prevBarsRef = useRef(globalBars);
    const stepsPerBar = 32;
    const totalSteps = bars * stepsPerBar;

    // Drum elements configuration
    const drumElements = useMemo(() => [
        { id: '808', name: t('drumLane.808'), color: '#6c5ce7' },
        { id: 'kick', name: t('drumLane.kick'), color: '#ff6b6b' },
        { id: 'clap', name: t('drumLane.clap'), color: '#ff9f43' },
        { id: 'snare', name: t('drumLane.snare'), color: '#ff7675' },
        { id: 'offSnare', name: t('drumLane.offSnare'), color: '#fdcb6e' },
        { id: 'closedHat', name: t('drumLane.closedHat'), color: '#e17055' },
        { id: 'openHat', name: t('drumLane.openHat'), color: '#d63031' },
        { id: 'rim', name: t('drumLane.rim'), color: '#fab1a0' },
        { id: 'perc', name: t('drumLane.perc'), color: '#e84393' }
    ], [t]);

    const drumIds = useMemo(() => drumElements.map(d => d.id), [drumElements]);

    // Initial state helper
    const createInitialDrumStates = useCallback((steps) => {
        return drumElements.reduce((acc, drum) => ({
            ...acc,
            [drum.id]: {
                powered: true,
                solo: false,
                mute: false,
                sample: { name: `${t('common.default')} ${drum.name} `, buffer: null },
                lanes: lanesDef.reduce((laneAcc, lane) => ({
                    ...laneAcc,
                    [lane.id]: {
                        pitch: lane.pitch,
                        pattern: Array(steps).fill(false),
                        velocity: Array(steps).fill(100),
                        duration: Array(steps).fill(1)
                    }
                }), {})
            }
        }), {});
    }, [drumElements, lanesDef]);

    // Deep clone drumStates preserving AudioBuffer references (not JSON-serializable)
    const cloneDrumStates = (states) => {
        const next = {};
        for (const drumId in states) {
            const drum = states[drumId];
            const lanes = {};
            for (const laneId in drum.lanes) {
                const lane = drum.lanes[laneId];
                lanes[laneId] = {
                    ...lane,
                    pattern: [...lane.pattern],
                    velocity: [...lane.velocity],
                    duration: lane.duration ? [...lane.duration] : lane.duration
                };
            }
            next[drumId] = {
                ...drum,
                sample: drum.sample ? { ...drum.sample } : drum.sample,
                lanes
            };
        }
        return next;
    };

    // State for each drum
    const [drumStates, _setDrumStatesRaw] = useState(createInitialDrumStates(totalSteps));
    // Version-tracked setter — increments counter for O(1) change detection (replaces JSON.stringify)
    const _drumVersionRef = useRef(0);
    const setDrumStates = useCallback((updater) => {
        _drumVersionRef.current++;
        _setDrumStatesRaw(updater);
    }, []);
    const [drumOrder, setDrumOrder] = useState(drumElements);
    const drumSlotRefs = useRef({}); // cached DOM refs for playback flash (avoids getElementById in hot loop)

    // Euclidean Rhythm Panel State
    const [showEuclidean, setShowEuclidean] = useState(false);
    const [openEuclideanMini, setOpenEuclideanMini] = useState(null); // "drumId:laneId" or null

    // Drum Settings Modal State
    const [activeSettingsDrumId, setActiveSettingsDrumId] = useState(null);
    const [activeDrumParams, setActiveDrumParams] = useState({});


    // Load params when opening settings
    useEffect(() => {
        if (activeSettingsDrumId && sampler) {
            const channel = sampler.drumChannels?.get(activeSettingsDrumId);
            if (channel && channel.params) {
                setActiveDrumParams(channel.params);
            } else {
                // Default params
                setActiveDrumParams({
                    pitch: 0,
                    volume: 1.0,
                    pan: 0,
                    attack: 0.01,
                    decay: 0.1,
                    sustain: 1.0,
                    release: 0.1,
                    sampleStart: 0,
                    fatten: 0,
                    delayMix: 0,
                    delayTime: 0.3,
                    delayFeedback: 0.3
                });
            }
        }
    }, [activeSettingsDrumId, sampler]);

    const handleParamChange = (param, value) => {
        setActiveDrumParams(prev => ({ ...prev, [param]: value }));
        if (sampler) {
            sampler.setDrumParam(activeSettingsDrumId, param, value);
        }
    };

    useEffect(() => {
        if (globalBars !== bars) {
            const oldBars = prevBarsRef.current;
            const newBars = globalBars;

            if (newBars !== oldBars) {
                setDrumStates(prev => {
                    const looped = loopDrumPattern(prev, oldBars, newBars);
                    return looped;
                });
                setBars(newBars);
                prevBarsRef.current = newBars;
            }
        }
    }, [globalBars]);



    // Removed local genre state as it's now global
    const [octave, setOctave] = useState(1);
    const [selectedDrumId, setSelectedDrumId] = useState('kick');

    const [zoom, setZoom] = useState(1);
    const [dragOver, setDragOver] = useState(null);

    // Multi-Step Selection State
    const [selectedSteps, setSelectedSteps] = useState(new Set()); // Strings like "drumId:laneId:step"
    const [selectionBox, setSelectionBox] = useState(null); // { startX, startY, endX, endY }
    const [selectionDrumId, setSelectionDrumId] = useState(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [insertionPoint, setInsertionPoint] = useState(null); // { drumId, laneId, step }
    const [clipboard, setClipboard] = useState(null);

    // Drum complexity override: 'auto' uses determineComplexity(), 'simple'/'complex' forces it
    const [drumComplexityOverride, setDrumComplexityOverride] = useState('auto');

    // Genres where complex mode adds meaningful rolls/fills (trap, drill, hip-hop, etc.)
    const COMPLEX_GENRES = new Set([
        'Trap', 'Drill', 'Hip Hop', 'Boom Bap', 'Cloud Rap', 'Phonk', 'Lo-Fi',
        'Drum & Bass', 'Neurofunk', 'Dubstep', 'Future Bass',
        'Funk', 'Jazz', 'Neo-Soul', 'R&B', 'Bebop', 'Fusion', 'Neo-Jazz',
        'House', 'Deep House', 'Tech House', 'Progressive House', 'Afro House',
        'Techno', 'Minimal Techno', 'Detroit Techno', 'Industrial Techno',
        'K-Pop', 'Reggaeton', 'Dancehall', 'Afrobeat', 'Latin',
        'Metalcore', 'Alternative Rock', 'Progressive Rock'
    ]);
    const showComplexityToggle = COMPLEX_GENRES.has(globalGenre);

    // Row Lock State
    const [lockedRows, setLockedRows] = useState(new Set());

    const toggleRowLock = (drumId) => {
        setLockedRows(prev => {
            const next = new Set(prev);
            if (next.has(drumId)) next.delete(drumId);
            else next.add(drumId);
            return next;
        });
    };

    // Click & Drag State (Restored)
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState(null); // 'add', 'delete', 'velocity', 'resize-right', 'resize-left'
    const [dragDrumId, setDragDrumId] = useState(null);
    const [dragLaneId, setDragLaneId] = useState(null);
    const [lastDragStep, setLastDragStep] = useState(-1);
    const [dragNoteSourceStep, setDragNoteSourceStep] = useState(null);
    const [dragStartX, setDragStartX] = useState(null);
    const [dragStartY, setDragStartY] = useState(null);
    const [dragDeltaSteps, setDragDeltaSteps] = useState(0);
    const [dragDeltaLanes, setDragDeltaLanes] = useState(0);
    const [isVelocityDragging, setIsVelocityDragging] = useState(false);
    const [dragVelocityValue, setDragVelocityValue] = useState(null);
    const [isDeleteDragging, setIsDeleteDragging] = useState(false);
    const [deleteDragDrumId, setDeleteDragDrumId] = useState(null);
    const [dragOffsets, setDragOffsets] = useState(null); // { [key]: { dId, lId, s, duration, velocity } }
    const dragOriginalDuration = useRef(null); // Stores note duration at drag start for resize
    const dragOverlappedNotes = useRef(null); // Snapshot of notes overlapped during resize
    const dragSelectedOriginals = useRef(null); // Stores original durations of all selected notes for multi-resize

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'a':
                        e.preventDefault();
                        if (selectedDrumId) {
                            const newSelection = new Set();
                            lanesDef.forEach(lane => {
                                for (let s = 0; s < totalSteps; s++) {
                                    if (drumStates[selectedDrumId].lanes[lane.id].pattern[s]) {
                                        newSelection.add(`${selectedDrumId}:${lane.id}:${s} `);
                                    }
                                }
                            });
                            setSelectedSteps(newSelection);
                        }
                        break;
                    case 'c':
                        e.preventDefault();
                        if (selectedSteps.size > 0) {
                            const copiedData = [];
                            selectedSteps.forEach(key => {
                                const [dId, lId, s] = key.split(':');
                                const stepIdx = parseInt(s);
                                const lane = drumStates[dId].lanes[lId];
                                if (lane.pattern[stepIdx]) {
                                    copiedData.push({ dId, lId, stepIdx, velocity: lane.velocity[stepIdx], duration: lane.duration[stepIdx] });
                                }
                            });
                            setClipboard(copiedData);
                        }
                        break;
                    case 'v':
                        e.preventDefault();
                        if (clipboard && clipboard.length > 0) {
                            // Determine target: insertion point > selected drum > first clipboard drum
                            const targetDrumId = insertionPoint?.drumId || selectedDrumId || clipboard[0].dId;
                            const pasteStep = insertionPoint?.step || 0;
                            if (targetDrumId) {
                                setDrumStates(prev => {
                                    const next = cloneDrumStates(prev);
                                    const minStep = Math.min(...clipboard.map(c => c.stepIdx));
                                    clipboard.forEach(note => {
                                        const targetStep = pasteStep + (note.stepIdx - minStep);
                                        if (targetStep < totalSteps && targetStep >= 0) {
                                            const lane = next[targetDrumId].lanes[note.lId];
                                            if (lane) {
                                                lane.pattern[targetStep] = true;
                                                lane.velocity[targetStep] = note.velocity;
                                                lane.duration[targetStep] = note.duration;
                                            }
                                        }
                                    });
                                    return next;
                                });
                            }
                        }
                        break;
                    // case 'd' clone moved to Shift+D handler below (outside Ctrl block)

                    case 'x':
                        e.preventDefault();
                        if (selectedSteps.size > 0) {
                            const copiedData = [];
                            setDrumStates(prev => {
                                const next = cloneDrumStates(prev);
                                selectedSteps.forEach(key => {
                                    const [dId, lId, s] = key.split(':');
                                    const stepIdx = parseInt(s);
                                    const lane = next[dId].lanes[lId];
                                    if (lane.pattern[stepIdx]) {
                                        copiedData.push({ dId, lId, stepIdx, velocity: lane.velocity[stepIdx], duration: lane.duration[stepIdx] });
                                        lane.pattern[stepIdx] = false;
                                    }
                                });
                                setClipboard(copiedData);
                                return next;
                            });
                            setSelectedSteps(new Set());
                        }
                        break;
                    case 'arrowup':
                        e.preventDefault();
                        transposeSelectedNotes(-1);
                        break;
                    case 'arrowdown':
                        e.preventDefault();
                        transposeSelectedNotes(1);
                        break;
                    case '2':
                    case '3':
                    case '4':
                        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                            subdivideSelectedNotes(parseInt(e.key));
                        }
                        break;
                    default: break;
                }
            }
            // Shift+D = Clone/duplicate selected notes (avoids Chrome Ctrl+D bookmark shortcut)
            if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === 'D' && selectedSteps.size > 0) {
                e.preventDefault();
                setDrumStates(prev => {
                    const next = cloneDrumStates(prev);
                    const newSelection = new Set();
                    const notes = [];
                    selectedSteps.forEach(key => {
                        const [dId, lId, s] = key.split(':');
                        const stepIdx = parseInt(s);
                        const lane = next[dId].lanes[lId];
                        if (lane?.pattern[stepIdx]) {
                            notes.push({ dId, lId, stepIdx, velocity: lane.velocity[stepIdx], duration: lane.duration[stepIdx] || 1 });
                        }
                    });
                    if (notes.length === 0) return prev;
                    const minStep = Math.min(...notes.map(n => n.stepIdx));
                    const maxStep = Math.max(...notes.map(n => n.stepIdx + (n.duration || 1)));
                    const span = maxStep - minStep;
                    notes.forEach(note => {
                        const targetStep = note.stepIdx + span;
                        if (targetStep < totalSteps) {
                            const lane = next[note.dId].lanes[note.lId];
                            if (lane) {
                                lane.pattern[targetStep] = true;
                                lane.velocity[targetStep] = note.velocity;
                                lane.duration[targetStep] = note.duration;
                                newSelection.add(`${note.dId}:${note.lId}:${targetStep} `);
                            }
                        }
                    });
                    setSelectedSteps(newSelection);
                    return next;
                });
            }
            // Non-ctrl shortcuts
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedSteps.size > 0) {
                    e.preventDefault();
                    setDrumStates(prev => {
                        const next = cloneDrumStates(prev);
                        selectedSteps.forEach(key => {
                            const [dId, lId, s] = key.split(':');
                            const stepIdx = parseInt(s);
                            if (next[dId]?.lanes[lId]) {
                                next[dId].lanes[lId].pattern[stepIdx] = false;
                            }
                        });
                        return next;
                    });
                    setSelectedSteps(new Set());
                }
            }
            if (e.key === 'Escape') {
                setSelectedSteps(new Set());
                setInsertionPoint(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedSteps, selectedDrumId, drumStates, clipboard, totalSteps, insertionPoint]);

    const transposeSelectedNotes = (direction) => {
        setDrumStates(prev => {
            const next = cloneDrumStates(prev);
            const newSelection = new Set();
            const lanes = lanesDef.map(l => l.id);

            selectedSteps.forEach(key => {
                const [dId, lId, s] = key.split(':');
                const stepIdx = parseInt(s);
                const currentLaneIdx = lanes.indexOf(lId);
                const targetLaneIdx = currentLaneIdx + direction;

                if (targetLaneIdx >= 0 && targetLaneIdx < lanes.length) {
                    const targetLaneId = lanes[targetLaneIdx];
                    if (next[dId].lanes[lId].pattern[stepIdx]) {
                        next[dId].lanes[targetLaneId].pattern[stepIdx] = true;
                        next[dId].lanes[targetLaneId].velocity[stepIdx] = next[dId].lanes[lId].velocity[stepIdx];
                        next[dId].lanes[targetLaneId].duration[stepIdx] = next[dId].lanes[lId].duration[stepIdx];
                        next[dId].lanes[lId].pattern[stepIdx] = false;
                        newSelection.add(`${dId}:${targetLaneId}:${stepIdx} `);
                    }
                } else {
                    newSelection.add(key);
                }
            });
            setSelectedSteps(newSelection);
            return next;
        });
    };

    const subdivideSelectedNotes = (divisions) => {
        setDrumStates(prev => {
            const next = cloneDrumStates(prev);
            const newSelection = new Set();

            selectedSteps.forEach(key => {
                const [dId, lId, s] = key.split(':');
                const stepIdx = parseInt(s);
                const lane = next[dId].lanes[lId];

                if (lane.pattern[stepIdx]) {
                    const originalDuration = lane.duration[stepIdx];
                    const newDuration = originalDuration / divisions;
                    const velocity = lane.velocity[stepIdx];

                    // Remove original
                    lane.pattern[stepIdx] = false;

                    // Add subdivided notes
                    for (let i = 0; i < divisions; i++) {
                        const targetStep = Math.round(stepIdx + (i * newDuration));
                        if (targetStep < totalSteps) {
                            lane.pattern[targetStep] = true;
                            lane.velocity[targetStep] = velocity;
                            lane.duration[targetStep] = newDuration;
                            newSelection.add(`${dId}:${lId}:${targetStep} `);
                        }
                    }
                }
            });
            setSelectedSteps(newSelection);
            return next;
        });
    };

    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            if (!isDragging || !dragMode) return;
            if (dragMode === 'move' && dragOffsets && dragStartX !== null && dragStartY !== null) {
                const currentX = e.clientX;
                const deltaX = currentX - dragStartX;
                const stepWidth = 25 * zoom;
                const deltaSteps = Math.round(deltaX / stepWidth);
                setDragDeltaSteps(deltaSteps);

                const currentY = e.clientY;
                const deltaY = currentY - dragStartY;
                const stepsY = Math.round(deltaY / 30);
                setDragDeltaLanes(stepsY);
            }

            // === RESIZE RIGHT: extend/shorten note from right edge ===
            if (dragMode === 'resize-right' && dragDrumId && dragLaneId && dragNoteSourceStep !== null && dragStartX !== null) {
                const currentX = e.clientX;
                const deltaX = currentX - dragStartX;
                const stepWidth = 25 * zoom;
                const deltaSteps = Math.round(deltaX / stepWidth);
                const snapInterval = Math.max(1, Math.round(32 / globalResolution));
                const baseDuration = dragOriginalDuration.current || 1;

                setDrumStates(prev => {
                    const next = cloneDrumStates(prev);
                    let changed = false;

                    // Resize the primary dragged note
                    const primaryLane = next[dragDrumId]?.lanes[dragLaneId];
                    if (primaryLane) {
                        const newDuration = Math.max(snapInterval, Math.round((baseDuration + deltaSteps) / snapInterval) * snapInterval);
                        const clampedDuration = Math.min(newDuration, totalSteps - dragNoteSourceStep);
                        if (clampedDuration !== primaryLane.duration[dragNoteSourceStep]) {
                            const noteEnd = dragNoteSourceStep + clampedDuration;
                            primaryLane.duration[dragNoteSourceStep] = clampedDuration;
                            // Snapshot overlapped notes on first expansion
                            if (!dragOverlappedNotes.current) dragOverlappedNotes.current = {};
                            for (let s = dragNoteSourceStep + 1; s < noteEnd; s++) {
                                if (primaryLane.pattern[s] && !dragOverlappedNotes.current[`${dragDrumId}:${dragLaneId}:${s}`]) {
                                    dragOverlappedNotes.current[`${dragDrumId}:${dragLaneId}:${s}`] = { velocity: primaryLane.velocity[s], duration: primaryLane.duration[s] || 1 };
                                }
                                if (primaryLane.pattern[s]) primaryLane.pattern[s] = false;
                            }
                            for (const [key, saved] of Object.entries(dragOverlappedNotes.current)) {
                                if (!key.startsWith(`${dragDrumId}:${dragLaneId}:`)) continue;
                                const s = parseInt(key.split(':')[2]);
                                if (s >= noteEnd && !primaryLane.pattern[s]) {
                                    primaryLane.pattern[s] = true;
                                    primaryLane.velocity[s] = saved.velocity;
                                    primaryLane.duration[s] = saved.duration;
                                }
                            }
                            changed = true;
                        }
                    }

                    // Apply same delta to all other selected notes
                    if (dragSelectedOriginals.current && changed) {
                        Object.entries(dragSelectedOriginals.current).forEach(([key, orig]) => {
                            if (orig.dId === dragDrumId && orig.lId === dragLaneId && orig.step === dragNoteSourceStep) return;
                            const lane = next[orig.dId]?.lanes[orig.lId];
                            if (!lane || !lane.pattern[orig.step]) return;
                            const newDur = Math.max(snapInterval, Math.round((orig.duration + deltaSteps) / snapInterval) * snapInterval);
                            lane.duration[orig.step] = Math.min(newDur, totalSteps - orig.step);
                        });
                    }

                    return changed ? next : prev;
                });
            }

            // === RESIZE LEFT: move start of note and adjust duration ===
            if (dragMode === 'resize-left' && dragDrumId && dragLaneId && dragNoteSourceStep !== null && dragStartX !== null) {
                const currentX = e.clientX;
                const deltaX = currentX - dragStartX;
                const stepWidth = 25 * zoom;
                const deltaSteps = Math.round(deltaX / stepWidth);
                const snapInterval = Math.max(1, Math.round(32 / globalResolution));
                const baseDuration = dragOriginalDuration.current || 1;

                setDrumStates(prev => {
                    const next = cloneDrumStates(prev);
                    const lane = next[dragDrumId]?.lanes[dragLaneId];
                    if (!lane) return prev;
                    const newStart = Math.max(0, Math.round((dragNoteSourceStep + deltaSteps) / snapInterval) * snapInterval);
                    const newDuration = Math.min(baseDuration - (newStart - dragNoteSourceStep), totalSteps - newStart);
                    if (newDuration >= snapInterval && newStart !== dragNoteSourceStep) {
                        const vel = lane.velocity[dragNoteSourceStep];
                        lane.pattern[dragNoteSourceStep] = false;
                        lane.pattern[newStart] = true;
                        lane.velocity[newStart] = vel;
                        lane.duration[newStart] = newDuration;
                        // Snapshot and delete overlapped notes to the left
                        if (!dragOverlappedNotes.current) dragOverlappedNotes.current = {};
                        const noteEnd = newStart + newDuration;
                        for (let s = newStart + 1; s < noteEnd; s++) {
                            if (lane.pattern[s] && s !== newStart && !dragOverlappedNotes.current[`${dragDrumId}:${dragLaneId}:${s}`]) {
                                dragOverlappedNotes.current[`${dragDrumId}:${dragLaneId}:${s}`] = { velocity: lane.velocity[s], duration: lane.duration[s] || 1 };
                            }
                            if (lane.pattern[s] && s !== newStart) {
                                lane.pattern[s] = false;
                            }
                        }
                        // Restore notes no longer overlapped
                        for (const [key, saved] of Object.entries(dragOverlappedNotes.current)) {
                            if (!key.startsWith(`${dragDrumId}:${dragLaneId}:`)) continue;
                            const s = parseInt(key.split(':')[2]);
                            if ((s < newStart || s >= noteEnd) && !lane.pattern[s]) {
                                lane.pattern[s] = true;
                                lane.velocity[s] = saved.velocity;
                                lane.duration[s] = saved.duration;
                            }
                        }

                        // Apply same duration delta to other selected notes
                        const durationDelta = newDuration - baseDuration;
                        if (dragSelectedOriginals.current) {
                            Object.entries(dragSelectedOriginals.current).forEach(([key, orig]) => {
                                if (orig.dId === dragDrumId && orig.lId === dragLaneId && orig.step === dragNoteSourceStep) return;
                                const oLane = next[orig.dId]?.lanes[orig.lId];
                                if (!oLane || !oLane.pattern[orig.step]) return;
                                const newDur = Math.max(snapInterval, orig.duration + durationDelta);
                                oLane.duration[orig.step] = Math.min(newDur, totalSteps - orig.step);
                            });
                        }

                        setDragNoteSourceStep(newStart);
                        setDragStartX(currentX);
                        return next;
                    }
                    return prev;
                });
            }
        };

        const handleGlobalMouseUp = () => {
            // Commit Drag Move
            if (dragMode === 'move' && dragOffsets && (dragDeltaSteps !== 0 || dragDeltaLanes !== 0)) {
                setDrumStates(prev => {
                    const next = cloneDrumStates(prev);

                    // 1. Flatten all lanes to find indices
                    const flatLanes = [];
                    // Use drumOrder to ensure correct visual order
                    drumOrder.forEach(drum => {
                        if (next[drum.id] && next[drum.id].lanes) {
                            // Assuming lanesDef order is consistent
                            const lanes = lanesDef; // from 'getLanes'
                            lanes.forEach(lane => {
                                if (next[drum.id].lanes[lane.id]) {
                                    flatLanes.push({ dId: drum.id, lId: lane.id });
                                }
                            });
                        }
                    });

                    const moves = [];
                    Object.values(dragOffsets).forEach(offset => {
                        // Find source index in flat list
                        const srcIndex = flatLanes.findIndex(l => l.dId === offset.dId && l.lId === offset.lId);
                        if (srcIndex === -1) return;

                        const targetIndex = srcIndex + dragDeltaLanes;
                        // Clamp target index
                        if (targetIndex >= 0 && targetIndex < flatLanes.length) {
                            const targetLane = flatLanes[targetIndex];
                            const duration = next[offset.dId].lanes[offset.lId].duration[offset.s] || 1;

                            // Clamp target step so the end of the note doesn't pass the total steps
                            const rawTargetStep = offset.s + dragDeltaSteps;
                            const targetStep = Math.max(0, Math.min(rawTargetStep, totalSteps - duration));

                            if (targetStep >= 0 && targetStep < totalSteps) {
                                moves.push({
                                    srcDId: offset.dId,
                                    srcLId: offset.lId,
                                    srcS: offset.s,
                                    targetDId: targetLane.dId,
                                    targetLId: targetLane.lId,
                                    targetS: targetStep,
                                    velocity: next[offset.dId].lanes[offset.lId].velocity[offset.s],
                                    duration: next[offset.dId].lanes[offset.lId].duration[offset.s]
                                });
                            }
                        }
                    });

                    if (moves.length > 0) {
                        // Clear sources first
                        moves.forEach(m => {
                            if (next[m.srcDId]?.lanes[m.srcLId]) {
                                next[m.srcDId].lanes[m.srcLId].pattern[m.srcS] = false;
                            }
                        });

                        // Write targets
                        const newSelection = new Set();
                        moves.forEach(m => {
                            if (next[m.targetDId]?.lanes[m.targetLId]) {
                                next[m.targetDId].lanes[m.targetLId].pattern[m.targetS] = true;
                                next[m.targetDId].lanes[m.targetLId].velocity[m.targetS] = m.velocity;
                                next[m.targetDId].lanes[m.targetLId].duration[m.targetS] = m.duration;
                                newSelection.add(`${m.targetDId}:${m.targetLId}:${m.targetS} `);
                            }
                        });
                        setSelectedSteps(newSelection);
                    }
                    return next;
                });
            }

            setIsDragging(false);
            setDragMode(null);
            setIsVelocityDragging(false);
            setDragVelocityValue(null);
            setLastDragStep(-1);
            setDragNoteSourceStep(null);
            setIsDeleteDragging(false);
            setDeleteDragDrumId(null);
            setDragOffsets(null);
            setDragStartX(null);
            setDragStartY(null);
            dragOverlappedNotes.current = null;
            dragSelectedOriginals.current = null;
            setDragDeltaSteps(0);
            setDragDeltaLanes(0);
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('mousemove', handleGlobalMouseMove);
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('mousemove', handleGlobalMouseMove);
        };
    }, [isDragging, dragMode, dragOffsets, dragStartX, dragStartY, dragDeltaSteps, dragDeltaLanes, dragDrumId, dragLaneId, dragNoteSourceStep, globalResolution, zoom, totalSteps, drumOrder, lanesDef]);

    const playheadRef = useRef(null);

    // High-performance local playhead animation
    useEffect(() => {
        let frameId;
        const tick = () => {
            if (!globalIsPlaying || !playheadRef.current || !globalPlayStartTime) return;

            const now = performance.now();
            const elapsedSecs = (now - globalPlayStartTime) / 1000;
            const stepDuration = (60 / globalTempo) / 8;
            const totalWidthSteps = globalBars * 32;

            const currentSmoothPos = (elapsedSecs / stepDuration) % totalWidthSteps;
            const translateX = currentSmoothPos * 25 * zoom;

            // Direct DOM update for 60fps smoothness with 0% React overhead
            playheadRef.current.style.transform = `translateX(${translateX}px)`;

            frameId = requestAnimationFrame(tick);
        };

        if (globalIsPlaying) {
            frameId = requestAnimationFrame(tick);
        } else if (playheadRef.current) {
            playheadRef.current.style.transform = 'translateX(0px)';
        }

        return () => cancelAnimationFrame(frameId);
    }, [globalIsPlaying, globalPlayStartTime, globalTempo, globalBars, zoom]);

    const lastSampleLoadState = useRef(false);
    useEffect(() => {
        if (onSampleLoad) {
            const anySample = Object.values(drumStates).some(d => !!d.sample?.buffer);
            if (anySample !== lastSampleLoadState.current) {
                lastSampleLoadState.current = anySample;
                onSampleLoad(anySample);
            }
        }
    }, [drumStates, onSampleLoad]);

    // Helper: scale generated pattern durations to match the current grid resolution
    // Hi-hats use 1/32 to preserve trap rolls and triplet detail
    const applyResolutionDuration = (lanes, drumId) => {
        const isHiHat = drumId === 'closedHat' || drumId === 'openHat';
        const resolution = isHiHat ? 32 : globalResolution;
        const stepSize = Math.max(1, Math.round(32 / resolution)); // e.g., 8 for 1/4, 4 for 1/8, 2 for 1/16
        if (stepSize <= 1) return lanes; // 1/32 = no scaling needed

        Object.keys(lanes).forEach(laneId => {
            const lane = lanes[laneId];
            const len = lane.pattern.length;
            const newPattern = Array(len).fill(false);
            const newDuration = Array(len).fill(1);
            const newVelocity = [...lane.velocity];

            for (let s = 0; s < len; s++) {
                if (!lane.pattern[s]) continue;

                // Snap to nearest grid position
                const snapped = Math.round(s / stepSize) * stepSize;
                if (snapped >= len) continue;

                // Only place if grid cell isn't already occupied
                if (!newPattern[snapped]) {
                    newPattern[snapped] = true;
                    newDuration[snapped] = stepSize;
                    newVelocity[snapped] = lane.velocity[s];
                }
            }

            lane.pattern = newPattern;
            lane.duration = newDuration;
            lane.velocity = newVelocity;
        });
        return lanes;
    };

    const generateDrums = useCallback((forceAlgorithmic = false) => {
        setDrumStates(prev => {
            const newState = { ...prev };
            const genre = globalGenre || 'TRAP';
            const mood = globalMood || 'Standard';

            resetBeatContext(); // Ensure fresh coordinated context for this batch

            Object.keys(newState).forEach(drumId => {
                if (lockedRows.has(drumId)) return;

                const drum = newState[drumId];

                // Fixed argument order: genre, drumId, bars, key, scale
                let newPattern;

                if (!forceAlgorithmic && externalPattern && externalPattern[drumId]) {
                    // Use analyzed/extracted MIDI if present
                    newPattern = externalPattern[drumId];
                } else {
                    // Fallback to algorithmic pattern in matching genre/mood
                    // Map unknown custom drum slots to 'perc' so they still get a rhythm
                    const standardDrums = ['808', 'kick', 'snare', 'clap', 'closedhat', 'openhat', 'offsnare', 'rim', 'perc'];
                    const effectiveDrumId = standardDrums.includes(drumId.toLowerCase()) ? drumId.toLowerCase() : 'perc';

                    const genBars = bars > 4 ? 4 : bars;
                    const drumComplexity = drumComplexityOverride === 'auto' ? determineComplexity(genre, mood) : drumComplexityOverride;
                    newPattern = getProPattern(genre, effectiveDrumId, genBars, globalKey, globalScale, mood, drumComplexity);
                }

                newPattern = applyResolutionDuration(newPattern, drumId);

                // Update each lane pattern
                Object.keys(drum.lanes).forEach(laneId => {
                    if (newPattern[laneId]) {
                        drum.lanes[laneId].pattern = [...newPattern[laneId].pattern];
                        drum.lanes[laneId].duration = [...newPattern[laneId].duration];
                        drum.lanes[laneId].velocity = [...newPattern[laneId].velocity];
                        drum.lanes[laneId].pitch = newPattern[laneId].pitch;
                    } else {
                        drum.lanes[laneId].pattern = Array(totalSteps).fill(false);
                        drum.lanes[laneId].duration = Array(totalSteps).fill(1);
                        drum.lanes[laneId].velocity = Array(totalSteps).fill(100);
                    }
                });
            });

            // Always loop 4-bar base to fill all bars
            if (bars > 4) {
                const baseBars = 4;
                Object.keys(newState).forEach(drumId => {
                    if (lockedRows.has(drumId)) return;
                    const singleDrum = { [drumId]: newState[drumId] };
                    const looped = loopDrumPattern(singleDrum, baseBars, bars);
                    newState[drumId] = looped[drumId];
                });
            }

            return { ...newState };
        });
        if (setIsGenerated) setIsGenerated(true);
    }, [globalGenre, globalMood, bars, totalSteps, lockedRows, globalResolution, externalPattern, globalKey, globalScale, setIsGenerated, globalRepeat]);

    // Flag: when generate() is called, capture resulting drumStates as a clip
    const pendingClipGenerationRef = useRef(false);

    // Expose methods to parent
    React.useImperativeHandle(ref, () => ({
        loadState: (loadedPatterns) => {
            if (!sampler) return;

            setDrumStates(prev => {
                const next = { ...prev };

                // 1. Reload Samples from Sampler (already loaded by ProjectManager)
                drumElements.forEach(drum => {
                    const instrument = sampler.instruments.get(drum.id);
                    if (instrument && instrument.samples.size > 0) {
                        // instrument.samples is Map<noteNumber, AudioBuffer>
                        const audioBuffer = instrument.samples.values().next().value;
                        if (audioBuffer) {
                            // Initialize if slot state missing
                            if (!next[drum.id]) next[drum.id] = { lanes: {}, powered: true };

                            next[drum.id].sample = {
                                name: instrument.name || `${drum.id.toUpperCase()} Loaded`,
                                buffer: audioBuffer  // AudioBuffer, not audioBuffer.buffer
                            };
                            next[drum.id].powered = true;
                        }
                    } else {
                        // Slot empty in sampler, ensure UI reflects it
                        if (next[drum.id]) {
                            next[drum.id].sample = null;
                        }
                    }
                });

                // 2. Restore Patterns if provided
                if (loadedPatterns) {
                    Object.entries(loadedPatterns).forEach(([drumId, drumData]) => {
                        if (next[drumId] && drumData.lanes) {
                            next[drumId].lanes = drumData.lanes;
                            if (drumData.powered !== undefined) next[drumId].powered = drumData.powered;
                            if (drumData.solo !== undefined) next[drumId].solo = drumData.solo;
                            if (drumData.mute !== undefined) next[drumId].mute = drumData.mute;
                        }
                    });
                }

                return next;
            });

            // Only mark as generated if the loaded patterns have actual hits
            if (setIsGenerated) {
                const hasHits = loadedPatterns && Object.values(loadedPatterns).some(d =>
                    d.lanes && Object.values(d.lanes).some(l =>
                        Array.isArray(l.pattern) && l.pattern.some(p => p)
                    )
                );
                setIsGenerated(!!hasHits);
            }
        },
        generate: () => {
            if (onDrumClipGenerated) pendingClipGenerationRef.current = true;
            generateDrums();
            if (setIsGenerated) setIsGenerated(true);
        },
        getDrumStates: () => drumStatesRef.current,
        loadSample: async (sampleItem) => {
            if (!sampleItem || !sampler || !selectedDrumId) return;
            if (onSampleLoadingChange) onSampleLoadingChange(true);
            try {
                let audioBuffer, name;
                if (sampleItem.audioBuffer && sampleItem.isFactory) {
                    // Factory sample: already decoded
                    audioBuffer = sampleItem.audioBuffer;
                    name = sampleItem.name;
                } else if (sampleItem.handle || sampleItem.nativePath) {
                    // Local file: decode from handle or native path
                    const file = await getFileFromItem(sampleItem);
                    const arrayBuffer = await file.arrayBuffer();
                    audioBuffer = await sampler.audioContext.decodeAudioData(arrayBuffer);
                    name = file.name;
                } else {
                    console.warn('[Drums] loadSample: unrecognized sample format', sampleItem);
                    if (onSampleLoadingChange) onSampleLoadingChange(false);
                    return;
                }
                sampler.loadInstrument(selectedDrumId, [{ note: (octave + 1) * 12, buffer: audioBuffer, name }], name);
                setDrumStates(prev => ({
                    ...prev,
                    [selectedDrumId]: { ...prev[selectedDrumId], sample: { name, buffer: audioBuffer }, powered: true }
                }));
            } catch (err) {
                console.error("External load error:", err);
            } finally {
                if (onSampleLoadingChange) onSampleLoadingChange(false);
            }
        },
        clear: () => {
            setDrumStates(createInitialDrumStates(totalSteps));
            if (setIsGenerated) setIsGenerated(false);
            if (onPatternChange) onPatternChange({});
            if (onSampleLoad) onSampleLoad(false);
        },
        loadMIDI: async (midiItem) => {
            if (!midiItem || !sampler) return;
            try {
                const file = await getFileFromItem(midiItem);
                const { MIDIParser } = await import('./MIDIParser');
                const parser = new MIDIParser();
                const midiData = await parser.loadMIDIFile(await file.arrayBuffer());

                // Collect all notes
                let allNotes = [];
                midiData.tracks.forEach(track => {
                    allNotes = [...allNotes, ...parser.eventsToNotes(track.events)];
                });

                if (allNotes.length === 0) return;

                const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
                const drumIds = drumElements.map(d => d.id);

                setDrumStates(prev => {
                    const next = { ...prev };
                    allNotes.forEach(n => {
                        const step = Math.floor(n.startTick / ticksPerStep);
                        if (step < totalSteps) {
                            // Map MIDI note to drum lane
                            // Simple mapping: 36 (C1) = kick, 38 (D1) = snare, 42 (F#1) = closed hat, etc.
                            let drumId = 'kick';
                            if (n.note === 35) drumId = '808';
                            else if (n.note === 36) drumId = 'kick';
                            else if (n.note === 38 || n.note === 40) drumId = 'snare';
                            else if (n.note === 42 || n.note === 44) drumId = 'closedHat';
                            else if (n.note === 46) drumId = 'openHat';
                            else if (n.note === 39) drumId = 'clap';
                            else {
                                // Fallback: find nearest based on some logic or just cycle
                                drumId = drumIds[n.note % drumIds.length];
                            }

                            if (next[drumId]) {
                                next[drumId].lanes['root'].pattern[step] = true;
                                next[drumId].lanes['root'].velocity[step] = Math.round((n.velocity / 127) * 100);
                            }
                        }
                    });
                    return next;
                });
                if (setIsGenerated) setIsGenerated(true);
            } catch (err) { console.error("Drum MIDI load error:", err); }
        }
    }), [sampler, drumElements, setIsGenerated, onSampleLoad, totalSteps, octave, generateDrums, createInitialDrumStates, onPatternChange, selectedDrumId, onDrumClipGenerated]);

    // CRITICAL: Ref for playback ticker to avoid restarts while playing
    const drumStatesRef = useRef(drumStates);
    const lastSentVersionRef = useRef(-1);

    useEffect(() => {
        drumStatesRef.current = drumStates;
        if (onPatternChange && _drumVersionRef.current !== lastSentVersionRef.current) {
            lastSentVersionRef.current = _drumVersionRef.current;
            onPatternChange(drumStates);
        }
        // Emit drum clip after generate() completes
        if (pendingClipGenerationRef.current && onDrumClipGenerated) {
            pendingClipGenerationRef.current = false;
            // Deep-clone drumStates, stripping AudioBuffer refs
            const clonedStates = {};
            Object.entries(drumStates).forEach(([drumId, drum]) => {
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
            onDrumClipGenerated({ bars, drumStates: clonedStates, name: `Drum Clip`, color: null });
        }
    }, [drumStates, onPatternChange, onDrumClipGenerated, bars]);

    // Update pattern length when bars change
    useEffect(() => {
        setDrumStates(prev => {
            const newState = { ...prev };
            const newLength = bars * stepsPerBar;

            Object.keys(newState).forEach(drumId => {
                const oldLanes = newState[drumId].lanes;
                const oldLength = Object.values(oldLanes)[0]?.pattern.length || 0;

                // Create new lanes object
                const newLanes = lanesDef.reduce((laneAcc, lane) => {
                    const oldLane = oldLanes[lane.id];
                    const oldPattern = oldLane ? oldLane.pattern : [];
                    const oldVelocity = oldLane ? oldLane.velocity : [];
                    const oldDuration = oldLane ? oldLane.duration : [];

                    let newPattern;
                    let newVelocity;
                    let newDuration;

                    if (bars === 8 && oldLength === 128) {
                        // 4 Bars -> 8 Bars: Duplicate the pattern
                        newPattern = [...oldPattern, ...oldPattern];
                        newVelocity = [...oldVelocity, ...oldVelocity];
                        newDuration = [...oldDuration, ...oldDuration];
                    } else if (bars === 4 && oldLength === 256) {
                        // 8 Bars -> 4 Bars: Truncate to first 4 bars
                        newPattern = oldPattern.slice(0, 128);
                        newVelocity = oldVelocity.slice(0, 128);
                        newDuration = oldDuration.slice(0, 128);
                    } else {
                        // Standard fallback resize (truncate or pad)
                        newPattern = Array(newLength).fill(false).map((_, i) =>
                            i < oldPattern.length ? oldPattern[i] : false
                        );
                        newVelocity = Array(newLength).fill(100).map((_, i) =>
                            i < oldVelocity.length ? oldVelocity[i] : 100
                        );
                        newDuration = Array(newLength).fill(1).map((_, i) =>
                            i < oldDuration.length ? oldDuration[i] : 1
                        );
                    }

                    return {
                        ...laneAcc,
                        [lane.id]: {
                            ...lane, // Keep pitch and other lane properties
                            pattern: newPattern,
                            velocity: newVelocity,
                            duration: newDuration
                        }
                    };
                }, {});

                // Update drum object with new lanes
                newState[drumId] = {
                    ...newState[drumId],
                    lanes: newLanes
                };
            });
            return newState;
        });
    }, [bars]);

    // Playback Logic (Global Sync with Step Catch-Up)
    // Gated when clip-based playback is active
    const lastProcessedStepRef = useRef(-1);
    const lastDrumCtxRef = useRef(null);
    useEffect(() => {
        if (clipPlaybackActive) {
            lastProcessedStepRef.current = -1;
            return;
        }
        if (globalIsPlaying && sampler && globalCurrentStep >= 0) {
            // Don't schedule notes while AudioContext is still resuming
            const drumCtx = sampler.audioContext;
            if (!drumCtx || drumCtx.state !== 'running') return;

            const currentStep = globalCurrentStep;

            // Detect AudioContext hot-swap — re-trigger only long sustaining drum notes (e.g. 808s)
            // that started BEFORE the current step. Notes starting AT the current step
            // are handled by normal playback below — no skip, no double-trigger.
            // Schedule re-triggers after the 500ms master crossfade completes
            // so they play on the new context at full volume, not during the fade.
            const currentCtx = sampler.audioContext;
            if (currentCtx && currentCtx !== lastDrumCtxRef.current) {
                lastDrumCtxRef.current = currentCtx;
                const triggerStep = currentStep % totalSteps;
                const crossfadeDelay = currentCtx.currentTime + 0.5; // after 500ms crossfade
                Object.keys(drumStatesRef.current).forEach(drumId => {
                    const drum = drumStatesRef.current[drumId];
                    const isGlobalSoloed = globalSolos?.has(`drums_${drumId}`);
                    const shouldPlay = drum.powered && (isAnythingSoloed ? isGlobalSoloed : !drum.mute);
                    if (!shouldPlay) return;
                    Object.values(drum.lanes).forEach(lane => {
                        // Find the most recent note start that is still sustaining at triggerStep
                        for (let s = triggerStep - 1; s >= 0; s--) {
                            if (lane.pattern[s]) {
                                const noteDurSteps = lane.duration?.[s] || 1;
                                if (s + noteDurSteps > triggerStep) {
                                    // This note started earlier and is still sustaining — re-trigger with remaining duration
                                    const remainingSteps = (s + noteDurSteps) - triggerStep;
                                    const remainingDuration = (remainingSteps / 8) * (60 / globalTempo);
                                    const velocity = lane.velocity[s] / 100;
                                    const pitchShift = lane.pitch;
                                    const basePitch = (octave + 1) * 12;
                                    sampler.playNote(drumId, basePitch + pitchShift, velocity, remainingDuration, crossfadeDelay);
                                }
                                break; // Only check the most recent note start
                            }
                        }
                    });
                });
                // Do NOT return — let normal playback handle current-step notes below
            }

            // If we just started, or jumped/looped, reset the last processed step
            const loopWrapped = lastProcessedStepRef.current !== -1 && currentStep < lastProcessedStepRef.current;
            if (lastProcessedStepRef.current === -1 || loopWrapped) {
                // On loop wrap, ensure we catch up from step 0 so the first beat is never skipped
                lastProcessedStepRef.current = -1;
            }

            // Trigger every step between last and current (handles skips/frame drops)
            // Cap catch-up to 8 steps on loop wrap (to cover beat 1), 4 normally
            const maxCatchUp = loopWrapped ? 7 : 3;
            const catchUpStart = Math.max(lastProcessedStepRef.current + 1, currentStep - maxCatchUp);
            for (let step = catchUpStart; step <= currentStep; step++) {
                const triggerStep = step % totalSteps;
                Object.keys(drumStatesRef.current).forEach(drumId => {
                    const drum = drumStatesRef.current[drumId];
                    const isGlobalSoloed = globalSolos?.has(`drums_${drumId}`);
                    const shouldPlay = drum.powered && (isAnythingSoloed ? isGlobalSoloed : !drum.mute);

                    if (shouldPlay) {
                        Object.values(drum.lanes).forEach(lane => {
                            if (lane.pattern[triggerStep]) {
                                const velocity = lane.velocity[triggerStep] / 100;
                                const duration = (lane.duration?.[triggerStep] || 1) / 8 * (60 / globalTempo);
                                const pitchShift = lane.pitch;
                                const basePitch = (octave + 1) * 12;
                                sampler.playNote(drumId, basePitch + pitchShift, velocity, duration);

                                // Visual flash effect
                                const drumSlot = drumSlotRefs.current[drumId];
                                if (drumSlot) {
                                    const origTransform = drumSlot.style.transform;
                                    const origBoxShadow = drumSlot.style.boxShadow;
                                    const origBorderColor = drumSlot.style.borderColor;

                                    drumSlot.style.transition = 'none';
                                    drumSlot.style.transform = 'scale(1.03)';
                                    drumSlot.style.boxShadow = `0 0 25px ${drumStatesRef.current[drumId]?.color || ac}, inset 0 0 10px ${drumStatesRef.current[drumId]?.color || ac}`;
                                    drumSlot.style.borderColor = drumStatesRef.current[drumId]?.color || ac;

                                    setTimeout(() => {
                                        if (drumSlot) {
                                            drumSlot.style.transition = 'all 0.15s ease-out';
                                            drumSlot.style.transform = origTransform;
                                            drumSlot.style.boxShadow = origBoxShadow;
                                            drumSlot.style.borderColor = origBorderColor;
                                        }
                                    }, 50);
                                }
                            }
                        });
                    }
                });
            }
            lastProcessedStepRef.current = currentStep;
        } else if (!globalIsPlaying) {
            lastProcessedStepRef.current = -1;
        }
    }, [globalCurrentStep, globalIsPlaying, sampler, octave, totalSteps, globalSolos, clipPlaybackActive]);

    const togglePower = useCallback((drumId) => {
        setDrumStates(prev => ({
            ...prev,
            [drumId]: { ...prev[drumId], powered: !prev[drumId].powered }
        }));
    }, []);

    const toggleMute = useCallback((drumId) => {
        setDrumStates(prev => ({
            ...prev,
            [drumId]: { ...prev[drumId], mute: !prev[drumId].mute, solo: false }
        }));
    }, []);

    const toggleSolo = useCallback((drumId, e) => {
        const isCurrentlySoloed = globalSolos?.has(`drums_${drumId}`);
        if (updateGlobalSolo) {
            updateGlobalSolo(`drums_${drumId}`, !isCurrentlySoloed, e.ctrlKey);
        }
    }, [globalSolos, updateGlobalSolo]);

    const randomizeVelocity = useCallback((drumId) => {
        setDrumStates(prev => {
            const newState = { ...prev };
            Object.keys(newState[drumId].lanes).forEach(lId => {
                const lane = newState[drumId].lanes[lId];
                lane.velocity = lane.velocity.map(() => 40 + Math.floor(Math.random() * 60));
            });
            return { ...newState };
        });
    }, []);

    const moveDrum = (drumId, direction) => {
        const index = drumOrder.findIndex(d => d.id === drumId);
        if (index === -1) return;
        const newOrder = [...drumOrder];
        if (direction === 'left' && index > 0) {
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        } else if (direction === 'right' && index < drumOrder.length - 1) {
            [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
        }
        setDrumOrder(newOrder);
    };


    const updateDuration = (drumId, laneId, sourceStep, targetStep, edge = 'right') => {
        if (!drumStates[drumId].powered) return;
        setDrumStates(prev => {
            const lane = prev[drumId].lanes[laneId];
            let newStart = sourceStep;
            let newDuration = lane.duration[sourceStep];

            if (edge === 'right') {
                newDuration = Math.max(1, targetStep - sourceStep + 1);
            } else {
                // Resize from left
                const shift = targetStep - sourceStep;
                newStart = sourceStep + shift;
                newDuration = lane.duration[sourceStep] - shift;
                if (newDuration < 1) return prev;
            }

            const newDurations = [...lane.duration];
            const newPattern = [...lane.pattern];

            // Clear old
            newPattern[sourceStep] = false;
            newDurations[sourceStep] = 1;

            // Set new
            newPattern[newStart] = true;
            newDurations[newStart] = newDuration;

            // Coverage logic
            for (let i = 1; i < newDuration; i++) {
                if (newStart + i < newPattern.length) {
                    newPattern[newStart + i] = false;
                }
            }

            return {
                ...prev,
                [drumId]: {
                    ...prev[drumId],
                    lanes: {
                        ...prev[drumId].lanes,
                        [laneId]: { ...lane, duration: newDurations, pattern: newPattern }
                    }
                }
            };
        });
    };

    const updateNote = (drumId, laneId, step, value) => {
        if (!drumStates[drumId].powered) return;
        setDrumStates(prev => {
            const lane = prev[drumId].lanes[laneId];
            const newPattern = [...lane.pattern];
            const newDuration = [...lane.duration];
            const isAdding = value !== undefined ? value : !newPattern[step];

            // Calculate resolution-aware duration (e.g., 1/4 = 8 steps)
            const defaultDuration = Math.max(1, 32 / globalResolution);

            if (isAdding) {
                newPattern[step] = true;
                newDuration[step] = defaultDuration;

                // Clear any smaller notes that might be inside this new duration
                for (let i = 1; i < defaultDuration; i++) {
                    if (step + i < newPattern.length) {
                        newPattern[step + i] = false;
                        newDuration[step + i] = 1;
                    }
                }
            } else {
                newPattern[step] = false;
                newDuration[step] = 1;
            }

            // Play sound if adding note
            if (isAdding && sampler) {
                const velocity = lane.velocity[step] / 100;
                const pitch = (octave + 1) * 12 + lane.pitch;
                sampler.playNote(drumId, pitch, velocity, 0.1);
            }

            return {
                ...prev,
                [drumId]: {
                    ...prev[drumId],
                    lanes: {
                        ...prev[drumId].lanes,
                        [laneId]: { ...lane, pattern: newPattern, duration: newDuration }
                    }
                }
            };
        });
    };

    const loadQuickSample = async (drumId) => {
        if (!globalSelectedSample || !sampler) return;
        if (onSampleLoadingChange) onSampleLoadingChange(true);
        try {
            const file = await getFileFromItem(globalSelectedSample);
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await sampler.audioContext.decodeAudioData(arrayBuffer);
            sampler.loadInstrument(drumId, [{ note: (octave + 1) * 12, buffer: audioBuffer, name: file.name }], file.name);
            setDrumStates(prev => ({
                ...prev,
                [drumId]: { ...prev[drumId], sample: { name: file.name, buffer: audioBuffer }, powered: true }
            }));
            setSelectedDrumId(drumId);
        } catch (err) {
            console.error("Plus button load error:", err);
        } finally {
            if (onSampleLoadingChange) onSampleLoadingChange(false);
        }
    };

    const randomizeSound = async (drumId) => {
        if (!sampler) {
            console.warn('[Drums] Sampler not ready');
            return;
        }
        if (onSampleLoadingChange) onSampleLoadingChange(true);
        try {
            // Collect local files if a folder is selected
            let localFiles = [];
            if (selectedFolder) {
                localFiles = await collectAudioFiles(selectedFolder);
            }

            // Collect factory files from the global factory folders
            const factoryFiles = [];
            const collectFactoryFiles = (items) => {
                if (!items) return;
                items.forEach(item => {
                    if (item.kind === 'file' && item.type === 'audio' && item.audioBuffer) {
                        factoryFiles.push(item);
                    } else if (item.kind === 'directory' && item.children) {
                        collectFactoryFiles(item.children);
                    }
                });
            };
            if (window.factoryFolders) {
                collectFactoryFiles(window.factoryFolders);
            }

            const allFiles = [...localFiles, ...factoryFiles];

            if (allFiles.length === 0) {
                console.warn('[Drums] No audio files found in local folders or factory library');
                return;
            }

            const randomFile = allFiles[Math.floor(Math.random() * allFiles.length)];

            // Factory sample: already has audioBuffer
            if (randomFile.audioBuffer && randomFile.isFactory) {
                const audioBuffer = randomFile.audioBuffer;
                sampler.loadInstrument(drumId, [{ note: (octave + 1) * 12, buffer: audioBuffer, name: randomFile.name }], randomFile.name);
                setDrumStates(prev => ({
                    ...prev,
                    [drumId]: { ...prev[drumId], sample: { name: randomFile.name, buffer: audioBuffer }, powered: true }
                }));
                return;
            }

            // Local file: decode from handle or native path
            const file = await getFileFromItem(randomFile);
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await sampler.audioContext.decodeAudioData(arrayBuffer);

            sampler.loadInstrument(drumId, [{ note: (octave + 1) * 12, buffer: audioBuffer, name: file.name }], file.name);
            setDrumStates(prev => ({
                ...prev,
                [drumId]: { ...prev[drumId], sample: { name: file.name, buffer: audioBuffer }, powered: true }
            }));
        } catch (err) {
            console.error('[Drums] Randomize sound error:', err);
        } finally {
            if (onSampleLoadingChange) onSampleLoadingChange(false);
        }
    };

    const fillEachSteps = (drumId, interval) => {
        setDrumStates(prev => {
            const newState = { ...prev };
            const nSteps = bars * stepsPerBar;
            const newPattern = Array(nSteps).fill(false);
            const newVelocity = Array(nSteps).fill(100);

            for (let i = 0; i < nSteps; i += interval) {
                newPattern[i] = true;
            }

            // Always clear existing root pattern if filling
            newState[drumId].lanes['root'].pattern = newPattern;
            newState[drumId].lanes['root'].velocity = newVelocity;
            newState[drumId].powered = true;

            return newState;
        });
    };

    const generateAllPatterns = () => {
        if (onClearExternal) onClearExternal();
        generateDrums(true);
        if (setIsGenerated) setIsGenerated(true);
    };

    // Euclidean apply handler (full modal)
    const handleEuclideanApply = useCallback(({ targetDrum, targetLane, pulses: p, steps: s, rotation: r, velocity: vel, applyPerBar, pattern: pat }) => {
        if (lockedRows.has(targetDrum)) return;
        setDrumStates(prev => {
            const next = cloneDrumStates(prev);
            if (!next[targetDrum]) return prev;
            const lane = next[targetDrum].lanes[targetLane];
            if (!lane) return prev;
            // Build the full-length boolean pattern
            // Place one hit at the START of each euclidean step, not filling the whole step
            const stepsPerBar = 32; // grid resolution per bar
            const stepWidth = Math.max(1, Math.floor(stepsPerBar / s)); // grid cells per euclidean step
            let fullPattern;
            if (applyPerBar) {
                fullPattern = new Array(totalSteps).fill(false);
                for (let eucIdx = 0; eucIdx < pat.length; eucIdx++) {
                    if (!pat[eucIdx]) continue;
                    const gridPos = eucIdx * stepWidth;
                    // Place hit at start of each bar
                    for (let bar = 0; bar < bars; bar++) {
                        const idx = bar * stepsPerBar + gridPos;
                        if (idx < totalSteps) fullPattern[idx] = true;
                    }
                }
            } else {
                const longPat = euclidean(p * bars, s * bars, r);
                const longStepWidth = Math.max(1, Math.floor(totalSteps / (s * bars)));
                fullPattern = new Array(totalSteps).fill(false);
                for (let eucIdx = 0; eucIdx < longPat.length; eucIdx++) {
                    if (!longPat[eucIdx]) continue;
                    const idx = eucIdx * longStepWidth;
                    if (idx < totalSteps) fullPattern[idx] = true;
                }
            }
            lane.pattern = fullPattern;
            lane.velocity = fullPattern.map(hit => hit ? vel : 100);
            lane.duration = fullPattern.map(() => 1);
            next[targetDrum].powered = true;
            return next;
        });
        setShowEuclidean(false);
    }, [lockedRows, totalSteps, bars]);

    // Euclidean mini-button apply handler (per-lane inline)
    const handleEuclideanMiniApply = useCallback((drumId, laneId, pat, eucSteps, barsCount) => {
        if (lockedRows.has(drumId)) return;
        setDrumStates(prev => {
            const next = cloneDrumStates(prev);
            if (!next[drumId] || !next[drumId].lanes[laneId]) return prev;
            const lane = next[drumId].lanes[laneId];
            const stepsPerBar = 32;
            const stepWidth = Math.max(1, Math.floor(stepsPerBar / eucSteps));
            const fullPattern = new Array(totalSteps).fill(false);
            const barsTotal = totalSteps / stepsPerBar;
            for (let eucIdx = 0; eucIdx < pat.length; eucIdx++) {
                if (!pat[eucIdx]) continue;
                const gridPos = eucIdx * stepWidth;
                for (let bar = 0; bar < barsTotal; bar++) {
                    const idx = bar * stepsPerBar + gridPos;
                    if (idx < totalSteps) fullPattern[idx] = true;
                }
            }
            lane.pattern = fullPattern;
            lane.velocity = fullPattern.map(hit => hit ? 80 : 100);
            lane.duration = fullPattern.map(() => 1);
            next[drumId].powered = true;
            return next;
        });
    }, [lockedRows, totalSteps]);

    const handleDrop = async (e, drumId) => {
        e.preventDefault();
        setDragOver(null);
        let item = null;
        try {
            if (window.draggedItem) item = window.draggedItem;
            else {
                const data = e.dataTransfer.getData("application/json");
                if (data) item = JSON.parse(data);
            }
        } catch (err) { /* No internal item found */ }

        // Handle MIDI file drop from file explorer (pre-parsed notes)
        if (item && item.type === 'midi' && item.midiNotes && item.midiNotes.length > 0) {
            if (drumId) {
                console.warn('[Drums] Cannot drop MIDI files onto specific drum slots. Drop them onto the global background or use audio samples.');
                return;
            }
            try {
                const ticksPerStep = (item.ticksPerBeat || 480) / 8;
                const drumIds = drumElements.map(d => d.id);

                setDrumStates(prev => {
                    const next = cloneDrumStates(prev);
                    item.midiNotes.forEach(n => {
                        const step = Math.floor(n.startTick / ticksPerStep);
                        if (step < totalSteps) {
                            // GM drum mapping
                            let targetDrumId = drumId || 'kick'; // If dropped on specific drum, use that
                            if (!drumId) {
                                if (n.note === 35) targetDrumId = '808';
                                else if (n.note === 36) targetDrumId = 'kick';
                                else if (n.note === 38 || n.note === 40) targetDrumId = 'snare';
                                else if (n.note === 42 || n.note === 44) targetDrumId = 'closedHat';
                                else if (n.note === 46) targetDrumId = 'openHat';
                                else if (n.note === 39) targetDrumId = 'clap';
                                else targetDrumId = drumIds[n.note % drumIds.length];
                            }

                            if (next[targetDrumId] && next[targetDrumId].lanes['root']) {
                                next[targetDrumId].lanes['root'].pattern[step] = true;
                                next[targetDrumId].lanes['root'].velocity[step] = Math.round((n.velocity / 127) * 100);
                            }
                        }
                    });
                    return next;
                });
                if (setIsGenerated) setIsGenerated(true);
                console.log('[Drums] Loaded MIDI pattern from drop:', item.midiNotes.length, 'notes');
                return;
            } catch (err) { console.error('Drum MIDI drop error:', err); }
        }

        // Handle external MIDI file drop
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.match(/\.midi?$/i)) {
                if (drumId) {
                    console.warn('[Drums] Cannot drop MIDI files onto specific drum slots. Drop them onto the global background or use audio samples.');
                    return;
                }
                try {
                    const { default: MIDIParser } = await import('./MIDIParser');
                    const parser = new MIDIParser();
                    const midiData = await parser.loadMIDIFile(file);
                    let allNotes = [];
                    midiData.tracks.forEach(track => {
                        allNotes = [...allNotes, ...parser.eventsToNotes(track.events)];
                    });
                    const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
                    const drumIds = drumElements.map(d => d.id);

                    setDrumStates(prev => {
                        const next = cloneDrumStates(prev);
                        allNotes.forEach(n => {
                            const step = Math.floor(n.startTick / ticksPerStep);
                            if (step < totalSteps) {
                                let targetDrumId = drumId || 'kick';
                                if (!drumId) {
                                    if (n.note === 35) targetDrumId = '808';
                                    else if (n.note === 36) targetDrumId = 'kick';
                                    else if (n.note === 38 || n.note === 40) targetDrumId = 'snare';
                                    else if (n.note === 42 || n.note === 44) targetDrumId = 'closedHat';
                                    else if (n.note === 46) targetDrumId = 'openHat';
                                    else if (n.note === 39) targetDrumId = 'clap';
                                    else targetDrumId = drumIds[n.note % drumIds.length];
                                }
                                if (next[targetDrumId] && next[targetDrumId].lanes['root']) {
                                    next[targetDrumId].lanes['root'].pattern[step] = true;
                                    next[targetDrumId].lanes['root'].velocity[step] = Math.round((n.velocity / 127) * 100);
                                }
                            }
                        });
                        return next;
                    });
                    if (setIsGenerated) setIsGenerated(true);
                    return;
                } catch (err) { console.error('External MIDI drum load error:', err); }
            }

            // Handle external audio file drop
            if (sampler && file.type.startsWith('audio/')) {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const audioBuffer = await sampler.audioContext.decodeAudioData(arrayBuffer);
                    sampler.loadInstrument(drumId, [{ note: (octave + 1) * 12, buffer: audioBuffer, name: file.name }], file.name);
                    setDrumStates(prev => ({
                        ...prev,
                        [drumId]: { ...prev[drumId], sample: { name: file.name, buffer: audioBuffer }, powered: true }
                    }));
                    return;
                } catch (error) {
                    console.error("External file drop error:", error);
                }
            }
        }

        if (!item || !sampler) return;

        try {
            if (item.handle || item.nativePath) {
                const file = await getFileFromItem(item);
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await sampler.audioContext.decodeAudioData(arrayBuffer);
                sampler.loadInstrument(drumId, [{ note: (octave + 1) * 12, buffer: audioBuffer, name: file.name }], file.name);
                setDrumStates(prev => ({
                    ...prev,
                    [drumId]: { ...prev[drumId], sample: { name: file.name, buffer: audioBuffer }, powered: true }
                }));
                setSelectedDrumId(drumId);
                if (onSampleLoad) onSampleLoad(true);
            } else if (item.audioBuffer && item.isFactory) {
                // Factory sample: audioBuffer is already decoded
                const audioBuffer = item.audioBuffer;
                sampler.loadInstrument(drumId, [{ note: (octave + 1) * 12, buffer: audioBuffer, name: item.name }], item.name);
                setDrumStates(prev => ({
                    ...prev,
                    [drumId]: { ...prev[drumId], sample: { name: item.name, buffer: audioBuffer }, powered: true }
                }));
                setSelectedDrumId(drumId);
                if (onSampleLoad) onSampleLoad(true);
            }
        } catch (error) { console.error("Load drop sample error:", error); }
    };


    const hasAnySample = Object.values(drumStates).some(d => d.sample && d.sample.buffer);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: isDark ? 'white' : '#333', background: isDark ? '#08080c' : '#fff', width: '100%', maxWidth: '100%', overflow: 'hidden', position: 'relative' }}>
            <div style={{ padding: '20px 25px', borderBottom: `1px solid ${isDark ? '#1a1a1f' : '#e0e0e0'}`, background: isDark ? '#0c0c0f' : '#f9f9f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                        {t('drums.title')}
                        {isGenerated && <span style={{ color: ac, fontSize: '14px', marginLeft: '8px' }} title={t('drums.patternGenerated')}>✅</span>}
                        {hasAnySample && <span style={{ color: ac, fontSize: '14px', marginLeft: '8px' }} title={t('drums.samplesLoaded')}>🔉</span>}
                    </h3>
                    <p style={{ margin: 0, fontSize: '11px', color: isDark ? '#888' : '#666' }}>{t('drums.subtitle')}</p>
                    {editingDrumClipId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: ac, background: `${ac}22`, padding: '2px 8px', borderRadius: '4px' }}>
                                Editing Clip
                            </span>
                            <button
                                onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('freally-close-drum-clip-edit')); }}
                                style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${isDark ? '#555' : '#ccc'}`, background: 'transparent', color: isDark ? '#ccc' : '#555', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        {...hoverProps}
                        onClick={onNewProject}
                        style={{ background: isDark ? hexToRgba(ac, 0.1) : '#fff', border: `1.5px solid ${isDark ? hexToRgba(ac, 0.3) : '#eee'}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', padding: '8px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title={t('common.startNewProject')}
                    >
                        {t('drums.newProject')}
                    </button>
                    <button
                        {...hoverProps}
                        onClick={onLoadClick}
                        style={{ background: isDark ? hexToRgba(ac, 0.1) : '#fff', border: `1.5px solid ${isDark ? hexToRgba(ac, 0.3) : '#eee'}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', padding: '8px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title={t('drums.loadProject')}
                    >
                        {t('drums.loadProject')}
                    </button>
                    <button
                        {...hoverProps}
                        data-tour-id="tour-export"
                        onClick={onExportClick}
                        style={{ background: isDark ? hexToRgba(ac, 0.1) : '#fff', border: `1.5px solid ${isDark ? hexToRgba(ac, 0.3) : '#eee'}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', padding: '8px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title={t('drums.export')}
                    >
                        {t('drums.export')}
                    </button>
                    <button
                        {...hoverProps}
                        onClick={() => {
                            const hasContent = Object.values(drumStates).some(drum =>
                                Object.values(drum.lanes).some(lane => lane.pattern.some(Boolean))
                            );
                            if (!hasContent) return;
                            if (confirmBeforeClear && !window.confirm(t('drums.clearConfirm'))) return;
                            setDrumStates(createInitialDrumStates(totalSteps));
                            if (setIsGenerated) setIsGenerated(false);
                        }}
                        style={{ background: isDark ? hexToRgba(ac, 0.1) : '#fff', border: `1.5px solid ${isDark ? hexToRgba(ac, 0.22) : '#eee'}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', padding: '8px 15px', cursor: 'pointer' }}
                        title={t('drums.clearPattern')}
                    >
                        {t('drums.clearPattern')}
                    </button>
                </div>
            </div>

            {/* Header Controls */}
            <div style={{ padding: '15px 20px', borderBottom: `1px solid ${isDark ? '#1a1a1f' : '#e0e0e0'} `, display: 'flex', gap: '20px', alignItems: 'flex-end', flexShrink: 0, flexWrap: 'wrap', background: isDark ? '#0c0c0f' : '#f9f9f9' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '9px', marginBottom: '5px', color: isDark ? '#666' : '#888', fontWeight: 'bold', letterSpacing: '1px' }}>{t('drums.octave')}</label>
                    <select value={octave} onChange={(e) => setOctave(parseInt(e.target.value))} style={{ padding: '8px 12px', background: isDark ? '#1a1a1f' : '#fff', border: `1px solid ${isDark ? '#2a2a2f' : '#ccc'} `, borderRadius: '4px', color: isDark ? '#ddd' : '#333', fontSize: '11px', fontWeight: 'bold' }}>
                        {[0, 1, 2, 3, 4].map(o => <option key={o} value={o}>C{o}</option>)}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '9px', marginBottom: '5px', color: isDark ? '#666' : '#888', fontWeight: 'bold', letterSpacing: '1px' }}>{t('drums.gridZoomPercent', { percent: Math.round(zoom * 100) })}</label>
                    <input type="range" min="0.3" max="2" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ width: '100%', height: '4px', background: ac, accentColor: ac, borderRadius: '2px', outline: 'none', cursor: 'default' }} />
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[4, 8, 16, 32, 64].map(b => (
                        <button key={b} onClick={() => setGlobalBars && setGlobalBars(b)} title={t('common.barsTooltip', { count: b })} style={{ padding: '4px 6px', background: globalBars === b ? ac : (isDark ? hexToRgba(ac, 0.08) : '#f0f0f0'), border: `1px solid ${globalBars === b ? ac : (isDark ? '#2a2a2f' : '#ccc')}`, borderRadius: '4px', color: globalBars === b ? '#fff' : (isDark ? '#999' : '#666'), fontSize: '10px', fontWeight: '900', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, minWidth: '28px' }}>
                            <span>{b}</span>
                            <span style={{ fontSize: '7px', fontWeight: '700', opacity: 0.7 }}>{t('drums.bars')}</span>
                        </button>
                    ))}
                    <button onClick={() => setGlobalRepeat && setGlobalRepeat(prev => !prev)} title={t('common.repeatTooltip')} style={{ padding: '4px 6px', background: globalRepeat ? ac : (isDark ? hexToRgba(ac, 0.08) : '#f0f0f0'), border: `1px solid ${globalRepeat ? ac : (isDark ? '#2a2a2f' : '#ccc')}`, borderRadius: '4px', color: globalRepeat ? '#fff' : (isDark ? '#999' : '#666'), fontSize: '9px', fontWeight: '900', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, minWidth: '28px' }}>
                        <span>↻</span>
                        <span style={{ fontSize: '7px', fontWeight: '700', opacity: 0.7 }}>{t('drums.rpt')}</span>
                    </button>
                    <div style={{ width: '1px', height: '20px', background: isDark ? '#333' : '#ccc', margin: '0 4px' }} />
                </div>
                {showComplexityToggle && (
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        {['simple', 'auto', 'complex'].map(mode => (
                            <button key={mode} onClick={() => setDrumComplexityOverride(mode)} style={{
                                padding: '4px 8px', fontSize: '9px', fontWeight: '900', letterSpacing: '0.5px',
                                background: drumComplexityOverride === mode ? (mode === 'complex' ? ac : (isDark ? '#2a2a2f' : '#ddd')) : (isDark ? hexToRgba(ac, 0.05) : '#f0f0f0'),
                                border: `1px solid ${drumComplexityOverride === mode ? ac : (isDark ? '#2a2a2f' : '#ccc')}`,
                                borderRadius: mode === 'simple' ? '4px 0 0 4px' : mode === 'complex' ? '0 4px 4px 0' : '0',
                                color: drumComplexityOverride === mode ? (mode === 'complex' ? '#fff' : (isDark ? '#fff' : '#333')) : (isDark ? '#888' : '#666'),
                                cursor: 'pointer', textTransform: 'uppercase'
                            }}>{mode === 'auto' ? 'AUTO' : mode === 'simple' ? 'SIMPLE' : 'COMPLEX'}</button>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <button {...hoverProps} onClick={() => setShowEuclidean(true)} title="Euclidean Rhythm Generator" style={{ padding: '10px 24px', background: isDark ? hexToRgba(ac, 0.05) : '#f0f0f0', border: `1px solid ${ac}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.5px' }}>EUCLID</button>
                    <button {...hoverProps} data-tour-id="tour-groove-gen" onClick={generateAllPatterns} title={t('drums.generateGroove')} style={{ padding: '10px 24px', background: isDark ? hexToRgba(ac, 0.05) : '#f0f0f0', border: `1px solid ${ac}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.5px' }}>{t('drums.generateGroove')}</button>
                    {onSuggest && <button {...hoverProps} onClick={onSuggest} title={t('drums.suggest')} style={{ padding: '10px 24px', background: isDark ? hexToRgba(ac, 0.05) : '#f0f0f0', border: `1px solid ${ac}`, borderRadius: '6px', color: ac, fontSize: '11px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.5px' }}>{t('drums.suggest')}</button>}
                    <button {...hoverProps} data-tour-id="tour-global-gen" onClick={onGlobalGenerate} title={t('drums.globalGen')} style={{ padding: '10px 24px', background: isDark ? hexToRgba(ac, 0.15) : ac, border: `1px solid ${ac}`, borderRadius: '6px', color: isDark ? ac : '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.5px' }}>{t('drums.globalGen')}</button>
                </div>
            </div>

            {/* Sample Cards Area */}
            <div style={{ display: 'flex', gap: '12px', padding: '15px 20px', background: isDark ? '#0c0c0f' : '#f5f5f5', overflowX: 'auto', flexShrink: 0 }}>
                {drumOrder.map((drum, index) => (
                    <div
                        key={drum.id}
                        id={`drum-slot-${drum.id}`}
                        ref={el => { drumSlotRefs.current[drum.id] = el; }}
                        onClick={() => setSelectedDrumId(drum.id)}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(drum.id); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => handleDrop(e, drum.id)}
                        style={{
                            minWidth: '160px',
                            height: '100px',
                            background: isDark ? '#141418' : '#fff',
                            border: `2px solid ${dragOver === drum.id ? ac : (selectedDrumId === drum.id ? ac : (drumStates[drum.id].powered ? drum.color + '44' : '#2a2a2f'))} `,
                            borderRadius: '10px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            opacity: drumStates[drum.id].powered ? 1 : 0.4,
                            transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            boxShadow: selectedDrumId === drum.id ? `0 0 15px ${hexToRgba(ac, 0.3)}` : (drumStates[drum.id].powered ? `0 4px 12px rgba(0, 0, 0, 0.2)` : 'none'),
                            cursor: 'pointer'
                        }}
                    >

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div onClick={() => togglePower(drum.id)} style={{ width: '12px', height: '12px', borderRadius: '50%', background: drumStates[drum.id].powered ? drum.color : '#333', cursor: 'pointer', boxShadow: drumStates[drum.id].powered ? `0 0 10px ${drum.color} ` : 'none', border: '2px solid rgba(0,0,0,0.2)' }} />
                                <div style={{ fontSize: '9px', fontWeight: '900', color: drum.color, letterSpacing: '1px' }}>{drum.name}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDrumOrder(prev => {
                                            if (index === 0) return prev;
                                            const next = [...prev];
                                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                            return next;
                                        });
                                    }}
                                    title={t('drums.moveLeft')}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px', color: isDark ? '#666' : '#888' }}
                                >
                                    ◀
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); randomizeSound(drum.id); }}
                                    title={t('drums.randomizeSample')}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px', opacity: 0.7 }}
                                >
                                    STX
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDrumOrder(prev => {
                                            if (index === prev.length - 1) return prev;
                                            const next = [...prev];
                                            [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                            return next;
                                        });
                                    }}
                                    title={t('drums.moveRight')}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px', color: isDark ? '#666' : '#888' }}
                                >
                                    ▶
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', borderRadius: '6px' }}>
                            {drumStates[drum.id].sample?.buffer ? <div style={{ width: '100%', height: '40px' }}><WaveformVisualizer audioBuffer={drumStates[drum.id].sample.buffer} color={drum.color} height={40} /></div> : <div style={{ fontSize: '8px', color: '#555', fontWeight: 'bold' }}>{t('drums.dragSample')}</div>}
                        </div>
                        <div style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '6px' }}>{drumStates[drum.id].sample?.name}</div>
                    </div>
                ))}
            </div>

            {/* Main Grid Viewport */}
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 25px 25px 25px', background: isDark ? '#08080c' : '#ffffff' }}>
                <div style={{ position: 'relative', width: 'fit-content', minWidth: '100%' }}>
                    {/* Bar Labels (Timeline) */}
                    <div style={{ display: 'flex', marginBottom: '0', marginLeft: '220px', borderBottom: `2px solid ${isDark ? ac : '#333'} `, paddingBottom: '0', position: 'sticky', top: 0, background: isDark ? '#0c0c0f' : '#f5f5f5', zIndex: 110, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                        {Array.from({ length: bars }).map((_, b) => (
                            <div key={b} style={{ width: `${800 * zoom}px`, display: 'flex', position: 'relative' }}>
                                {/* Beat Labels: 1, 1.1, 1.2, 1.3 */}
                                {Array.from({ length: 4 }).map((_, beat) => (
                                    <div key={beat} style={{
                                        width: `${200 * zoom}px`,
                                        fontSize: '11px',
                                        color: beat === 0 ? ac : (isDark ? '#666' : '#888'),
                                        fontWeight: beat === 0 ? '900' : '700',
                                        letterSpacing: '1px',
                                        borderLeft: beat === 0 ? `2px solid ${isDark ? ac : '#333'} ` : `1px solid ${isDark ? '#222' : '#eee'} `,
                                        height: '28px',
                                        lineHeight: '28px',
                                        paddingLeft: beat === 0 ? '4px' : '8px', // Tiny padding to avoid overlap with line
                                        background: beat === 0 ? (isDark ? hexToRgba(ac, 0.05) : 'rgba(0,0,0,0.05)') : 'transparent'
                                    }}>
                                        {beat === 0 ? `${b + 1} ` : `${b + 1}.${beat + 1} `}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Playhead Marker */}
                    <div
                        ref={playheadRef}
                        style={{
                            position: 'absolute',
                            left: '220px',
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: ac,
                            boxShadow: `0 0 15px ${ac}`,
                            zIndex: 100,
                            pointerEvents: 'none',
                            display: globalIsPlaying ? 'block' : 'none',
                            willChange: 'transform'
                        }}
                    />

                    {/* Multi-Lane Drums Section */}
                    {drumOrder.map(drum => (
                        drumStates[drum.id].powered && (
                            <div key={drum.id} style={{ display: 'flex', marginBottom: '20px', background: isDark ? '#0c0c0f' : '#fbfbfb', borderRadius: '8px', border: `1px solid ${isDark ? '#141418' : '#f0f0f0'} `, overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                {/* Left Control Panel */}
                                <div style={{ width: '190px', display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '10px 15px', background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', borderRight: `1px solid ${isDark ? '#1a1a1f' : '#f0f0f0'} `, position: 'sticky', left: 0, zIndex: 10, boxSizing: 'border-box' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '900', color: drum.color, letterSpacing: '1px' }}>{drum.name.toUpperCase()}</div>
                                    </div>

                                    {/* Row 1: Settings, Solo, Mute, CLR, Power */}
                                    <div style={{ display: 'flex', gap: '3px', marginBottom: '3px' }}>
                                        <button
                                            onClick={() => setActiveSettingsDrumId(activeSettingsDrumId === drum.id ? null : drum.id)}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                background: activeSettingsDrumId === drum.id ? ac : (isDark ? '#1a1a1f' : '#eee'),
                                                border: 'none',
                                                borderRadius: '4px',
                                                color: activeSettingsDrumId === drum.id ? '#fff' : (isDark ? '#555' : '#888'),
                                                fontSize: '12px',
                                                fontWeight: '900',
                                                cursor: 'pointer',
                                                boxShadow: activeSettingsDrumId === drum.id ? `0 0 10px ${ac}` : 'none',
                                                transition: 'all 0.1s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title={t('drums.drumSettings')}
                                        >
                                            CFG
                                        </button>
                                        <button
                                            onClick={(e) => toggleSolo(drum.id, e)}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                background: globalSolos?.has(`drums_${drum.id}`) ? acSec : (isDark ? '#1a1a1f' : '#eee'),
                                                border: 'none',
                                                borderRadius: '4px',
                                                color: globalSolos?.has(`drums_${drum.id}`) ? '#fff' : (isDark ? '#555' : '#888'),
                                                fontSize: '10px',
                                                fontWeight: '900',
                                                cursor: 'pointer',
                                                boxShadow: globalSolos?.has(`drums_${drum.id}`) ? `0 0 10px ${acSec}` : 'none',
                                                transition: 'all 0.1s'
                                            }}
                                            title={t('drums.soloMulti')}
                                        >S</button>
                                        <button
                                            onClick={() => toggleMute(drum.id)}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                background: drumStates[drum.id].mute ? '#ff4d4d' : (isDark ? '#1a1a1f' : '#eee'),
                                                border: 'none',
                                                borderRadius: '4px',
                                                color: drumStates[drum.id].mute ? '#fff' : (isDark ? '#555' : '#888'),
                                                fontSize: '10px',
                                                fontWeight: '900',
                                                cursor: 'pointer',
                                                boxShadow: drumStates[drum.id].mute ? '0 0 10px #ff4d4d' : 'none',
                                                transition: 'all 0.1s'
                                            }}
                                            title={t('drums.mute')}
                                        >M</button>
                                        <button onClick={() => {
                                            setDrumStates(prev => {
                                                const updated = { ...prev };
                                                Object.keys(updated[drum.id].lanes).forEach(lId => updated[drum.id].lanes[lId].pattern = Array(totalSteps).fill(false));
                                                return { ...updated };
                                            });
                                        }} style={{ background: isDark ? '#1a1a1f' : '#eee', border: 'none', borderRadius: '44px', color: isDark ? '#555' : '#888', fontSize: '9px', fontWeight: '900', cursor: 'pointer', padding: '0 6px' }}>{t('drums.clr')}</button>
                                        <div onClick={() => togglePower(drum.id)} style={{ width: '12px', height: '12px', borderRadius: '50%', background: drumStates[drum.id].powered ? drum.color : '#333', cursor: 'pointer', alignSelf: 'center', marginLeft: 'auto' }} />
                                    </div>
                                    {/* Row 2: Lock, STX, VEL */}
                                    <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
                                        <button
                                            onClick={() => toggleRowLock(drum.id)}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                background: lockedRows.has(drum.id) ? '#d4a017' : (isDark ? '#1a1a1f' : '#eee'),
                                                border: 'none',
                                                borderRadius: '4px',
                                                color: lockedRows.has(drum.id) ? '#fff' : (isDark ? '#555' : '#888'),
                                                fontSize: '10px',
                                                fontWeight: '900',
                                                cursor: 'pointer',
                                                boxShadow: lockedRows.has(drum.id) ? '0 0 10px #d4a017' : 'none',
                                                transition: 'all 0.1s'
                                            }}
                                            title={lockedRows.has(drum.id) ? t('drums.unlockRow') : t('drums.lockRow')}
                                        >🔒</button>
                                        <button
                                            onClick={() => randomizeSound(drum.id)}
                                            style={{ background: isDark ? '#1a1a1f' : '#eee', border: 'none', borderRadius: '4px', color: ac, fontSize: '9px', fontWeight: '900', cursor: 'pointer', padding: '0 6px' }}
                                            title={t('drums.randomizeSample')}
                                        >
                                            {t('drums.stx')}
                                        </button>
                                        {drum.id !== 'kick' && (
                                            <button
                                                onClick={() => randomizeVelocity(drum.id)}
                                                title={t('drums.randomizeVelocities')}
                                                style={{ background: isDark ? '#1a1a1f' : '#eee', border: 'none', borderRadius: '4px', color: ac, fontSize: '9px', fontWeight: '900', cursor: 'pointer', padding: '0 6px' }}
                                            >
                                                {t('drums.vel')}
                                            </button>
                                        )}
                                    </div>

                                    {(drum.id === 'closedHat' || drum.id === 'perc') && (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button onClick={() => fillEachSteps(drum.id, 2)} style={{ flex: 1, fontSize: '8px', background: isDark ? '#1a1a1f' : '#eee', border: 'none', padding: '3px', borderRadius: '3px', color: '#888', fontWeight: '900', cursor: 'pointer' }}>{t('drums.fill2')}</button>
                                            <button onClick={() => fillEachSteps(drum.id, 4)} style={{ flex: 1, fontSize: '8px', background: isDark ? '#1a1a1f' : '#eee', border: 'none', padding: '3px', borderRadius: '3px', color: '#888', fontWeight: '900', cursor: 'pointer' }}>{t('drums.fill4')}</button>
                                        </div>
                                    )}
                                </div>
                                {/* Lane Value Labels (+2, +1, etc) with mini Euclidean buttons */}
                                <div style={{ width: '48px', display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0, boxSizing: 'border-box' }}>
                                    {lanesDef.map(lane => (
                                        <div key={lane.id} style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '14px', position: 'relative' }}>
                                            <div style={{ fontSize: '8px', fontWeight: 'bold', color: isDark ? '#aaa' : '#666', textAlign: 'center', width: '22px', lineHeight: '14px' }}>{lane.label}</div>
                                            <EuclideanMiniButton
                                                drumId={drum.id}
                                                laneId={lane.id}
                                                totalSteps={totalSteps}
                                                barsCount={bars}
                                                lockedRows={lockedRows}
                                                onApply={handleEuclideanMiniApply}
                                                theme={theme}
                                                accentColor={ac}
                                                isOpen={openEuclideanMini === `${drum.id}:${lane.id}`}
                                                onToggle={setOpenEuclideanMini}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {/* Sequence Lanes Grid */}
                                <div
                                    onContextMenu={(e) => e.preventDefault()}
                                    onMouseDown={(e) => {
                                        // Ctrl+Left drag = marquee selection
                                        if (e.button === 0 && e.ctrlKey) {
                                            e.preventDefault();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const scrollL = e.currentTarget.scrollLeft;
                                            const scrollT = e.currentTarget.scrollTop;
                                            const startX = e.clientX - rect.left + scrollL;
                                            const startY = e.clientY - rect.top + scrollT;

                                            setSelectionBox({
                                                startX,
                                                startY,
                                                endX: startX,
                                                endY: startY
                                            });
                                            setIsSelecting(true);
                                            setSelectionDrumId(drum.id);
                                        }
                                    }}
                                    onMouseMove={(e) => {
                                        if (isSelecting && selectionBox) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const scrollL = e.currentTarget.scrollLeft;
                                            const scrollT = e.currentTarget.scrollTop;

                                            setSelectionBox(prev => prev ? ({
                                                ...prev,
                                                endX: e.clientX - rect.left + scrollL,
                                                endY: e.clientY - rect.top + scrollT
                                            }) : null);
                                        }
                                    }}
                                    onMouseUp={() => {
                                        if (isSelecting && selectionBox) {
                                            // Selection logic: calculate which notes overlap selectionBox
                                            const newSelection = new Set();
                                            const boxLeft = Math.min(selectionBox.startX, selectionBox.endX);
                                            const boxRight = Math.max(selectionBox.startX, selectionBox.endX);
                                            const boxTop = Math.min(selectionBox.startY, selectionBox.endY);
                                            const boxBottom = Math.max(selectionBox.startY, selectionBox.endY);

                                            lanesDef.forEach((lane, laneIdx) => {
                                                const laneTop = laneIdx * 15; // Each lane is 14px + 1px gap
                                                const laneBottom = laneTop + 14;

                                                if (laneBottom >= boxTop && laneTop <= boxBottom) {
                                                    for (let s = 0; s < totalSteps; s++) {
                                                        const noteLeft = s * 25 * zoom;
                                                        const duration = drumStates[drum.id].lanes[lane.id].duration?.[s] || 1;
                                                        const noteRight = noteLeft + (duration * 25 * zoom);

                                                        if (noteRight >= boxLeft && noteLeft <= boxRight && drumStates[drum.id].lanes[lane.id].pattern[s]) {
                                                            newSelection.add(`${drum.id}:${lane.id}:${s} `);
                                                        }
                                                    }
                                                }
                                            });
                                            setSelectedSteps(newSelection);
                                            setIsSelecting(false);
                                            setSelectionBox(null);
                                            setSelectionDrumId(null);
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1px',
                                        background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                                        position: 'relative',
                                        cursor: 'default',
                                        userSelect: 'none'
                                    }}
                                >
                                    {/* Sequence Pitch Lanes */}
                                    {lanesDef.map((lane, laneIdx) => (
                                        <div key={lane.id} style={{ display: 'flex', position: 'relative', height: '14px' }}>
                                            {/* Background Insertion Grid */}
                                            {(() => {
                                                const stepInterval = 32 / globalResolution;
                                                const grid = [];
                                                for (let step = 0; step < totalSteps; step += stepInterval) {
                                                    const isBarDivider = step % 32 === 0;
                                                    const isBeatDivider = step % 8 === 0;
                                                    grid.push(
                                                        <div
                                                            key={`bg - ${step} `}
                                                            onMouseDown={(e) => {
                                                                // Plain left click on empty cell = set insertion cursor
                                                                if (e.button === 0 && !e.ctrlKey) {
                                                                    e.stopPropagation();
                                                                    setInsertionPoint({ drumId: drum.id, laneId: lane.id, step });
                                                                    setSelectedDrumId(drum.id);
                                                                }
                                                                // Right click = start delete drag
                                                                if (e.button === 2) {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    setIsDeleteDragging(true);
                                                                    setDeleteDragDrumId(drum.id);
                                                                    // Delete any note at this step across all lanes of this drum
                                                                    for (let s = step; s < step + stepInterval && s < totalSteps; s++) {
                                                                        Object.keys(drumStates[drum.id].lanes).forEach(lId => {
                                                                            if (drumStates[drum.id].lanes[lId].pattern[s]) {
                                                                                updateNote(drum.id, lId, s, false);
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                            onMouseEnter={() => {
                                                                // Delete drag: erase notes when hovering cells
                                                                if (isDeleteDragging && deleteDragDrumId === drum.id) {
                                                                    for (let s = step; s < step + stepInterval && s < totalSteps; s++) {
                                                                        Object.keys(drumStates[drum.id].lanes).forEach(lId => {
                                                                            if (drumStates[drum.id].lanes[lId].pattern[s]) {
                                                                                updateNote(drum.id, lId, s, false);
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                            style={{
                                                                width: `${25 * zoom * stepInterval}px`,
                                                                height: '14px',
                                                                borderLeft: isBarDivider
                                                                    ? `2px dashed ${isDark ? ac : '#333'}`
                                                                    : (isBeatDivider
                                                                        ? `1px solid ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)'}`
                                                                        : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`),
                                                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                                                                background: (Math.floor(step / 32) % 2 === 0)
                                                                    ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                                                                    : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
                                                                boxSizing: 'border-box'
                                                            }}
                                                            onDoubleClick={(e) => {
                                                                // Double-click on empty cell = add note
                                                                if (!e.ctrlKey) {
                                                                    e.stopPropagation();
                                                                    updateNote(drum.id, lane.id, step, true);
                                                                }
                                                            }}
                                                        />
                                                    );
                                                }
                                                return grid;
                                            })()}

                                            {/* Absolute Notes Overlay */}
                                            {Object.entries(drumStates[drum.id].lanes[lane.id].pattern).map(([stepStr, active]) => {
                                                if (!active) return null;
                                                const step = parseInt(stepStr);
                                                const duration = drumStates[drum.id].lanes[lane.id].duration?.[step] || 1;
                                                const velocity = drumStates[drum.id].lanes[lane.id].velocity[step];
                                                const isSelected = selectedSteps.has(`${drum.id}:${lane.id}:${step} `);

                                                return (
                                                    <div
                                                        key={`note - ${step} `}
                                                        onMouseEnter={() => {
                                                            // Delete drag: erase this note when hovering over it
                                                            if (isDeleteDragging && deleteDragDrumId === drum.id) {
                                                                updateNote(drum.id, lane.id, step, false);
                                                            }
                                                        }}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            // Right click on note = delete + start delete drag
                                                            if (e.button === 2) {
                                                                e.preventDefault();
                                                                setIsDeleteDragging(true);
                                                                setDeleteDragDrumId(drum.id);
                                                                updateNote(drum.id, lane.id, step, false);
                                                                return;
                                                            }
                                                            // Left click only
                                                            if (e.button !== 0) return;
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const mouseX = e.clientX - rect.left;
                                                            const isRightEdge = mouseX > rect.width - 12;
                                                            const isLeftEdge = mouseX < 12;

                                                            if (isRightEdge) {
                                                                setIsDragging(true);
                                                                setDragMode('resize-right');
                                                                setDragDrumId(drum.id);
                                                                setDragLaneId(lane.id);
                                                                setDragNoteSourceStep(step);
                                                                setDragStartX(e.clientX);
                                                                setLastDragStep(step);
                                                                dragOriginalDuration.current = duration;
                                                                // Capture original durations of all selected notes for multi-resize
                                                                const originals = {};
                                                                selectedSteps.forEach(key => {
                                                                    const [dId, lId, s] = key.split(':');
                                                                    const sIdx = parseInt(s);
                                                                    originals[key] = { dId, lId, step: sIdx, duration: drumStates[dId]?.lanes[lId]?.duration?.[sIdx] || 1 };
                                                                });
                                                                dragSelectedOriginals.current = originals;
                                                                return;
                                                            }
                                                            if (isLeftEdge) {
                                                                setIsDragging(true);
                                                                setDragMode('resize-left');
                                                                setDragDrumId(drum.id);
                                                                setDragLaneId(lane.id);
                                                                setDragNoteSourceStep(step);
                                                                setDragStartX(e.clientX);
                                                                setLastDragStep(step);
                                                                dragOriginalDuration.current = duration;
                                                                // Capture original durations of all selected notes for multi-resize
                                                                const originalsL = {};
                                                                selectedSteps.forEach(key => {
                                                                    const [dId, lId, s] = key.split(':');
                                                                    const sIdx = parseInt(s);
                                                                    originalsL[key] = { dId, lId, step: sIdx, duration: drumStates[dId]?.lanes[lId]?.duration?.[sIdx] || 1 };
                                                                });
                                                                dragSelectedOriginals.current = originalsL;
                                                                return;
                                                            }

                                                            // Single click = select/deselect this note, OR start move drag if already selected (or just verify standard behavior)
                                                            // Standard: Click selects. Click+Drag moves.
                                                            // If we click a selected note, we might want to move it.

                                                            const isSelected = selectedSteps.has(`${drum.id}:${lane.id}:${step} `);

                                                            if (isSelected) {
                                                                setIsDragging(true);
                                                                setDragMode('move');
                                                                setDragStartX(e.clientX);
                                                                setDragStartY(e.clientY);
                                                                setLastDragStep(step); // Use this as pivot

                                                                // Capture offsets relative to this note
                                                                const offsets = {};
                                                                selectedSteps.forEach(key => {
                                                                    const [dId, lId, s] = key.split(':');
                                                                    const sIdx = parseInt(s);
                                                                    offsets[key] = {
                                                                        dId, lId, s: sIdx,
                                                                        deltaS: sIdx - step, // Relative step difference
                                                                        // For now, no Y-axis dragging across drums/lanes (too complex for this grid)
                                                                        // Just time shifting
                                                                    };
                                                                });
                                                                setDragOffsets(offsets);
                                                            } else {
                                                                // If not selected, select it exclusively (standard DAW behavior) or toggle?
                                                                // User asked for "click and drag selected notes".
                                                                // Let's select it and start drag?
                                                                // For now, keep selection logic simple:
                                                                setSelectedSteps(prev => {
                                                                    const next = new Set(prev);
                                                                    const key = `${drum.id}:${lane.id}:${step} `;
                                                                    if (e.ctrlKey) {
                                                                        if (next.has(key)) next.delete(key); else next.add(key);
                                                                    } else {
                                                                        next.clear(); next.add(key);
                                                                    }
                                                                    return next;
                                                                });
                                                                setSelectedDrumId(drum.id);

                                                                // Initialize drag for this single note (which is now selected)
                                                                setIsDragging(true);
                                                                setDragMode('move');
                                                                setDragStartX(e.clientX);
                                                                setDragStartY(e.clientY);
                                                                setLastDragStep(step);
                                                                setDragOffsets({
                                                                    [`${drum.id}:${lane.id}:${step} `]: { dId: drum.id, lId: lane.id, s: step, deltaS: 0 }
                                                                });
                                                            }
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${step * 25 * zoom}px`,
                                                            width: `${duration * 25 * zoom}px`,
                                                            height: '14px',
                                                            background: drum.color,
                                                            zIndex: isDragging && isSelected ? 100 : 10,
                                                            opacity: isSelected ? 0.6 : (velocity / 100),
                                                            boxShadow: isSelected ? `0 0 8px ${acSec}` : 'none',
                                                            border: isSelected ? `1px solid ${acSec}` : 'none',
                                                            boxSizing: 'border-box',
                                                            transform: isDragging && isSelected ? `translate(${dragDeltaSteps * 25 * zoom}px, ${dragDeltaLanes * 30}px)` : 'none',
                                                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                                        }}
                                                    >
                                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '10px', background: 'rgba(255,255,255,0.15)', cursor: 'col-resize', borderRadius: '2px 0 0 2px' }} />
                                                        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '10px', background: 'rgba(255,255,255,0.15)', cursor: 'col-resize', borderRadius: '0 2px 2px 0' }} />
                                                    </div>
                                                );
                                            })}

                                            {/* Insertion Cursor */}
                                            {insertionPoint && insertionPoint.drumId === drum.id && insertionPoint.laneId === lane.id && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: `${insertionPoint.step * 25 * zoom}px`,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: '2px',
                                                    background: ac,
                                                    zIndex: 20,
                                                    pointerEvents: 'none',
                                                    animation: 'blink 1s step-end infinite'
                                                }} />
                                            )}
                                        </div>
                                    ))}
                                    {/* Unified Velocity Lane for this Drum */}
                                    <div style={{ display: 'flex', position: 'relative', height: '30px' }}>
                                        {/* Background Grid for Velocity */}
                                        {(() => {
                                            const stepInterval = 32 / globalResolution;
                                            const grid = [];
                                            for (let step = 0; step < totalSteps; step += stepInterval) {
                                                const isBarDivider = step % 32 === 0;
                                                const isBeatDivider = step % 8 === 0;
                                                grid.push(
                                                    <div
                                                        key={`v-bg-${step}`}
                                                        onMouseDown={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const getYVel = (clientY) => Math.max(0, Math.min(100, Math.round(100 * (1 - (clientY - rect.top) / rect.height))));
                                                            const val = getYVel(e.clientY);

                                                            setIsVelocityDragging(true);
                                                            setDragVelocityValue(val);
                                                            setLastDragStep(step);

                                                            // Apply velocity to notes in this interval
                                                            for (let s = step; s < step + stepInterval && s < totalSteps; s++) {
                                                                Object.keys(drumStates[drum.id].lanes).forEach(lId => {
                                                                    if (drumStates[drum.id].lanes[lId].pattern[s]) {
                                                                        setDrumStates(prev => {
                                                                            const next = cloneDrumStates(prev);
                                                                            next[drum.id].lanes[lId].velocity[s] = val;
                                                                            return next;
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                        onMouseEnter={() => {
                                                            if (isVelocityDragging && step !== lastDragStep) {
                                                                setLastDragStep(step);
                                                                for (let s = step; s < step + stepInterval && s < totalSteps; s++) {
                                                                    Object.keys(drumStates[drum.id].lanes).forEach(lId => {
                                                                        if (drumStates[drum.id].lanes[lId].pattern[s]) {
                                                                            setDrumStates(prev => {
                                                                                const next = cloneDrumStates(prev);
                                                                                next[drum.id].lanes[lId].velocity[s] = dragVelocityValue;
                                                                                return next;
                                                                            });
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        }}
                                                        style={{
                                                            width: `${25 * zoom * stepInterval}px`,
                                                            height: '30px',
                                                            borderLeft: isBarDivider
                                                                ? `2px dashed ${isDark ? ac : '#333'}`
                                                                : (isBeatDivider
                                                                    ? `1px solid ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)'}`
                                                                    : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`),
                                                            background: (Math.floor(step / 32) % 2 === 0)
                                                                ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
                                                                : (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'),
                                                            boxSizing: 'border-box'
                                                        }}
                                                    />
                                                );
                                            }
                                            return grid;
                                        })()}

                                        {/* Velocity Stems with Dots — one per resolution cell, centered */}
                                        {(() => {
                                            const stepInterval = 32 / globalResolution;
                                            const cellStems = {};
                                            // Group: find highest velocity note in each resolution cell
                                            Object.keys(drumStates[drum.id].lanes).forEach(lId => {
                                                const lane = drumStates[drum.id].lanes[lId];
                                                for (let s = 0; s < totalSteps; s++) {
                                                    if (!lane.pattern[s]) continue;
                                                    const cellIdx = Math.floor(s / stepInterval);
                                                    const vel = lane.velocity[s];
                                                    if (!cellStems[cellIdx] || vel > cellStems[cellIdx]) {
                                                        cellStems[cellIdx] = vel;
                                                    }
                                                }
                                            });

                                            return Object.entries(cellStems).map(([cellIdx, vValue]) => {
                                                const centerX = (parseInt(cellIdx) + 0.5) * stepInterval * 25 * zoom;
                                                const stemHeight = Math.max(4, (vValue / 100) * 28); // 28px max stem, 4px min
                                                return (
                                                    <div key={`v-stem-${cellIdx}`} style={{
                                                        position: 'absolute',
                                                        left: `${centerX}px`,
                                                        bottom: 0,
                                                        transform: 'translateX(-1px)',
                                                        pointerEvents: 'none',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center'
                                                    }}>
                                                        {/* Dot at top — always visible */}
                                                        <div style={{
                                                            width: '6px',
                                                            height: '6px',
                                                            borderRadius: '50%',
                                                            background: drum.color,
                                                            flexShrink: 0,
                                                            marginBottom: '-1px'
                                                        }} />
                                                        {/* Stem line */}
                                                        <div style={{
                                                            width: '2px',
                                                            height: `${stemHeight}px`,
                                                            background: drum.color,
                                                            opacity: 0.6
                                                        }} />
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>

                                    {/* Selection Box (Marquee) — scoped to this drum's grid */}
                                    {selectionBox && selectionDrumId === drum.id && (
                                        <div style={{
                                            position: 'absolute',
                                            left: Math.min(selectionBox.startX, selectionBox.endX),
                                            top: Math.min(selectionBox.startY, selectionBox.endY),
                                            width: Math.abs(selectionBox.endX - selectionBox.startX),
                                            height: Math.abs(selectionBox.endY - selectionBox.startY),
                                            background: hexToRgba(ac, 0.1),
                                            border: `1px solid ${ac}`,
                                            zIndex: 1000,
                                            pointerEvents: 'none'
                                        }} />
                                    )}
                                </div>
                            </div>
                        )))}

                </div>
            </div>

            {/* Transport Feedback Bar */}
            <div style={{ padding: '10px 25px', borderTop: `1px solid ${isDark ? '#1a1a1f' : '#eee'} `, background: isDark ? '#0c0c0f' : '#f9f9f9', display: 'flex', gap: '20px', flexShrink: 0, fontSize: '10px', color: isDark ? '#444' : '#bbb', fontWeight: '900', letterSpacing: '1px' }}>
                <div>{t('drums.helpText')}</div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '30px', color: ac }}>
                    <div>{t('drums.genreDisplay', { genre: globalGenre })}</div>
                    <div>{t('drums.tempoLabel')}: {t('drums.tempoDisplay', { tempo: globalTempo })}</div>
                    <div>{t('drums.engineLabel')}</div>
                </div>
            </div>

            {/* Drum Settings Modal Overlay */}
            {activeSettingsDrumId && (
                <DrumSampleEditor
                    drumId={activeSettingsDrumId}
                    sample={drumStates[activeSettingsDrumId]?.sample}
                    params={activeDrumParams}
                    onParamChange={handleParamChange}
                    onClose={() => setActiveSettingsDrumId(null)}
                    theme={theme}
                />
            )}

            {/* Euclidean Rhythm Panel */}
            {showEuclidean && (
                <EuclideanPanel
                    drumElements={drumElements}
                    globalBars={bars}
                    onApply={handleEuclideanApply}
                    onClose={() => setShowEuclidean(false)}
                    theme={theme}
                    accentColors={accentColors}
                />
            )}
        </div >
    );
});

const DrumSettingsModal = ({ drumId, params, onChange, onClose, isDark }) => {
    const { t } = useTranslation();
    if (!drumId) return null;

    const Slider = ({ label, param, min, max, step, value, unit = '' }) => (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '10px', color: isDark ? '#888' : '#666', fontWeight: 'bold' }}>
                <span>{label}</span>
                <span>{typeof value === 'number' ? value.toFixed(2) : value}{unit}</span>
            </div>
            <input
                type="range"
                min={min} max={max} step={step}
                value={value !== undefined ? value : min}
                onChange={(e) => onChange(param, parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#a29bfe' }}
            />
        </div>
    );

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: isDark ? '#151518' : '#fff',
            border: `1px solid ${isDark ? '#333' : '#ddd'}`,
            borderRadius: '12px',
            padding: '20px',
            width: '320px',
            zIndex: 2000,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '10px' }}>
                <div style={{ fontWeight: '900', color: isDark ? '#fff' : '#000' }}>{t('drums.settings', { name: drumId.toUpperCase() })}</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: isDark ? '#888' : '#666', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                    <div style={{ fontSize: '10px', fontWeight: '900', color: isDark ? '#aaa' : '#555', marginBottom: '8px' }}>{t('drums.envelope')}</div>
                    <Slider label={t('drums.attack')} param="attack" min={0} max={2} step={0.01} value={params.attack} unit="s" />
                    <Slider label={t('drums.decay')} param="decay" min={0} max={2} step={0.01} value={params.decay} unit="s" />
                    <Slider label={t('drums.sustain')} param="sustain" min={0} max={1} step={0.01} value={params.sustain} />
                    <Slider label={t('drums.release')} param="release" min={0} max={5} step={0.01} value={params.release} unit="s" />
                </div>
                <div>
                    <div style={{ fontSize: '10px', fontWeight: '900', color: isDark ? '#aaa' : '#555', marginBottom: '8px' }}>{t('drums.sampleDsp')}</div>
                    <Slider label={t('drums.startOffset')} param="sampleStart" min={0} max={100} step={1} value={params.sampleStart} unit="%" />
                    <Slider label={t('drums.pitch')} param="pitch" min={-24} max={24} step={1} value={params.pitch} unit="st" />
                    <Slider label={t('drums.pan')} param="pan" min={-1} max={1} step={0.01} value={params.pan} />
                    <Slider label={t('drums.driveFatten')} param="fatten" min={0} max={1} step={0.01} value={params.fatten} />
                </div>
            </div>

            <div>
                <div style={{ fontSize: '10px', fontWeight: '900', color: isDark ? '#aaa' : '#555', marginBottom: '8px' }}>{t('drums.delaySend')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <Slider label={t('drums.mix')} param="delayMix" min={0} max={1} step={0.01} value={params.delayMix} />
                    <Slider label={t('drums.time')} param="delayTime" min={0} max={1} step={0.01} value={params.delayTime} unit="s" />
                    <Slider label={t('drums.fdbk')} param="delayFeedback" min={0} max={0.95} step={0.01} value={params.delayFeedback} />
                </div>
            </div>
        </div>
    );
};

export default DrumGeneratorEnhanced;
