import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import { SCALES } from './MusicTheory.js';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext';

const PianoRollEditor = ({
    pattern = [],
    onPatternChange,
    bars = 4,
    globalResolution = 16,
    globalKey = 'C',
    globalScale = 'Major',
    theme = 'dark',
    height = 500,
    currentStep = 0,
    globalPlayStartTime = 0,
    globalTempo = 120,
    fixedOctave = false,
    rootPitch = 48,
    autoScroll = true,
    onDrop = null, accentColors}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const isDark = theme === 'dark';
    const canvasRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const velocityScrollRef = useRef(null);
    const velocityCanvasRef = useRef(null);
    const playheadRef = useRef(null);
    const [selectedNotes, setSelectedNotes] = useState(new Set());
    const [draggingNote, setDraggingNote] = useState(null);
    const [draggingVelocity, setDraggingVelocity] = useState(false);
    const [localCurrentStep, setLocalCurrentStep] = useState(0);
    // const [zoomX, setZoomX] = useState(1); // REMOVED: User wants auto-fit always
    const zoomX = 1; // Force 1 for calculations
    const [zoomY, setZoomY] = useState(1);
    const [isFolded, setIsFolded] = useState(false);
    const [snapToScale, setSnapToScale] = useState(false);
    const [showScaleHighlight, setShowScaleHighlight] = useState(true);
    const [dragMode, setDragMode] = useState(null); // 'add', 'delete', 'move', 'velocity', 'marquee'
    const [selectionBox, setSelectionBox] = useState(null);
    const [clipboard, setClipboard] = useState([]);
    const [dragVelocityValue, setDragVelocityValue] = useState(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [insertionPoint, setInsertionPoint] = useState(null); // { time, note }
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const hasScrolledRef = useRef(false);
    const [scrollTop, setScrollTop] = useState(0);

    // Measure container width for Fit-to-Width
    useEffect(() => {
        if (!scrollContainerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        ro.observe(scrollContainerRef.current);

        const scroller = scrollContainerRef.current;
        const handleScroll = () => {
            setScrollTop(scroller.scrollTop);
            if (velocityScrollRef.current) {
                velocityScrollRef.current.scrollLeft = scroller.scrollLeft;
            }
        };
        scroller.addEventListener('scroll', handleScroll);
        setScrollTop(scroller.scrollTop);

        return () => {
            ro.disconnect();
            scroller.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Piano roll settings
    const NOTE_HEIGHT = 16 * zoomY;
    const LABEL_WIDTH = 220;

    // Convert time (beats) to x position
    const timeToX = (time) => {
        return Math.round(LABEL_WIDTH + (time * (BEAT_WIDTH / 8)));
    };

    // Convert x position to time (beats)
    const xToTime = (x) => {
        const xOffset = x - LABEL_WIDTH;
        return Math.max(0, xOffset / (BEAT_WIDTH / 8));
    };

    // Convert MIDI note to y position
    const noteToY = (note) => {
        if (isFolded) {
            const idx = visibleNotes.indexOf(note);
            if (idx === -1) return -NOTE_HEIGHT;
            return idx * NOTE_HEIGHT;
        }
        return (MAX_NOTE - note) * NOTE_HEIGHT;
    };

    // Convert y position to MIDI note
    const yToNote = (y) => {
        const rowIdx = Math.floor(y / NOTE_HEIGHT);
        if (rowIdx < 0 || rowIdx >= visibleNotes.length) return visibleNotes[0];
        return visibleNotes[rowIdx];
    };

    // Auto-scroll logic: Trigger on pattern bounds change or significant transpose
    useEffect(() => {
        if (autoScroll && scrollContainerRef.current) {
            const patternNotes = pattern.map(n => n.note);
            if (patternNotes.length > 0) {
                // Center on the average pitch of the pattern
                const avgNote = patternNotes.reduce((sum, n) => sum + n, 0) / patternNotes.length;
                const targetY = noteToY(avgNote) - (height / 2);
                scrollContainerRef.current.scrollTop = targetY;
            } else {
                // Center on root pitch
                const targetY = noteToY(rootPitch) - (height / 2);
                scrollContainerRef.current.scrollTop = targetY;
            }
            hasScrolledRef.current = true;
        }
    }, [pattern, autoScroll, rootPitch, height, isFolded]); // Added pattern dependency for transpose following

    const scrollBarWidth = 12;
    const fitBeatWidth = containerWidth > (LABEL_WIDTH + 50)
        ? (containerWidth - LABEL_WIDTH - scrollBarWidth) / (bars * 4)
        : 200;

    const BEAT_WIDTH = fitBeatWidth * zoomX;

    const patternNotes = pattern.map(n => n.note);
    const patternMin = patternNotes.length > 0 ? Math.min(...patternNotes) : 127;
    const patternMax = patternNotes.length > 0 ? Math.max(...patternNotes) : 0;

    const baseMin = fixedOctave ? (rootPitch - 12) : 0;
    const baseMax = fixedOctave ? (rootPitch + 12) : 127;

    const MIN_NOTE = Math.min(baseMin, patternMin);
    const MAX_NOTE = Math.max(baseMax, patternMax);
    const TOTAL_NOTES = MAX_NOTE - MIN_NOTE + 1;

    const getScaleNotes = () => {
        const keyOffset = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(globalKey);
        const intervals = SCALES[globalScale] || SCALES['Major'] || [0, 2, 4, 5, 7, 9, 11];
        const scaleNotes = new Set();

        const startOctave = Math.floor(MIN_NOTE / 12) - 1;
        const endOctave = Math.floor(MAX_NOTE / 12) + 1;

        for (let octave = startOctave; octave <= endOctave; octave++) {
            intervals.forEach(interval => {
                const note = (octave * 12) + keyOffset + interval;
                if (note >= MIN_NOTE && note <= MAX_NOTE) scaleNotes.add(note);
            });
        }
        return scaleNotes;
    };

    const scaleNotes = getScaleNotes();
    const sortedScaleNotes = Array.from(scaleNotes).sort((a, b) => b - a);

    // Scale-degree highlighting info (memoized for performance)
    const scaleInfo = useMemo(() => {
        const keyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(globalKey);
        const intervals = SCALES[globalScale] || SCALES['Major'] || [0, 2, 4, 5, 7, 9, 11];

        // Pitch classes (0-11) that belong to the scale
        const scalePitchClasses = new Set(intervals.map(i => (keyIndex + i) % 12));
        const rootPitchClass = keyIndex;

        // Chord tones: root (1st), 3rd, 5th scale degrees
        const chordTonePCs = new Set(
            [intervals[0], intervals[2], intervals[4]].map(i => (keyIndex + i) % 12)
        );

        // Degree map: pitch class → degree number (1-7)
        const degreeMap = {};
        intervals.forEach((interval, idx) => {
            degreeMap[(keyIndex + interval) % 12] = idx + 1;
        });

        return { scalePitchClasses, rootPitchClass, chordTonePCs, degreeMap };
    }, [globalKey, globalScale]);

    const getVisibleNotes = () => {
        if (!isFolded) {
            const all = [];
            for (let i = MAX_NOTE; i >= MIN_NOTE; i--) all.push(i);
            return all;
        }
        // In folded mode, show scale notes within current bounds PLUS any notes in the pattern
        const set = new Set(sortedScaleNotes);
        pattern.forEach(n => set.add(n.note));
        return Array.from(set).sort((a, b) => b - a);
    };

    const visibleNotes = getVisibleNotes();
    const totalBeats = bars * 4;
    const gridWidth = totalBeats * BEAT_WIDTH;
    const gridHeight = visibleNotes.length * NOTE_HEIGHT;

    const getNoteName = (midiNote) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = ((midiNote % 12) + 12) % 12; // Handle negative indices
        const noteName = noteNames[noteIndex];
        return `${noteName}${octave} `;
    };

    // Smooth progress for playhead (DOM Ref for Performance)
    useEffect(() => {
        let frameId;
        const tick = () => {
            if (!globalPlayStartTime || !globalTempo) {
                if (playheadRef.current) playheadRef.current.style.transform = 'translateX(0px)';
                frameId = requestAnimationFrame(tick);
                return;
            }
            const now = performance.now();
            const elapsedSecs = (now - globalPlayStartTime) / 1000;
            const stepDuration = (60 / globalTempo) / 8;
            const totalWidthSteps = bars * 32;
            const currentStep = (elapsedSecs / stepDuration) % totalWidthSteps;

            const x = timeToX(currentStep); // This includes LABEL_WIDTH

            // Debugging Playhead
            // Playhead Tick debug string removed

            if (playheadRef.current) {
                playheadRef.current.style.transform = `translateX(${x}px)`;
                playheadRef.current.style.display = 'block'; // Ensure visible
                // Debug UI Update
                const debugEl = document.getElementById('debug-piano-overlay');
                if (debugEl) debugEl.innerText = `Pos: ${x.toFixed(1)}px | Time: ${elapsedSecs.toFixed(2)}s | Steps: ${currentStep.toFixed(1)} | Start: ${globalPlayStartTime}`;
            }
            frameId = requestAnimationFrame(tick);
        };
        const handleVisibilityChange = () => {
            if (document.hidden) cancelAnimationFrame(frameId);
            else frameId = requestAnimationFrame(tick);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        frameId = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frameId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [globalPlayStartTime, globalTempo, bars, zoomX, containerWidth]);

    // MAIN CANVAS DRAWING
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = LABEL_WIDTH + gridWidth;
        const height = gridHeight;

        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        ctx.fillStyle = isDark ? '#000000' : '#fff';
        ctx.fillRect(0, 0, width, height);

        // Draw note names, lanes, and scale-degree highlighting
        visibleNotes.forEach((note, i) => {
            const y = i * NOTE_HEIGHT;
            const pc = ((note % 12) + 12) % 12;
            const noteInScale = scaleNotes.has(note);
            const isBlackKey = [1, 3, 6, 8, 10].includes(pc);
            const isRoot = pc === scaleInfo.rootPitchClass;
            const isChordTone = scaleInfo.chordTonePCs.has(pc);
            const isInScale = scaleInfo.scalePitchClasses.has(pc);

            // Base row color (black/white key distinction)
            ctx.fillStyle = isDark
                ? (isBlackKey ? '#1a1a1a' : '#000000')
                : (isBlackKey ? '#e0e0e0' : '#f9f9f9');
            ctx.fillRect(0, y, width, NOTE_HEIGHT);

            // Scale-degree highlighting overlay
            if (showScaleHighlight) {
                if (isRoot) {
                    ctx.fillStyle = isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.18);
                } else if (isChordTone) {
                    ctx.fillStyle = isDark ? 'rgba(255, 159, 67, 0.10)' : 'rgba(255, 159, 67, 0.14)';
                } else if (isInScale) {
                    ctx.fillStyle = isDark ? hexToRgba(ac, 0.05) : hexToRgba(ac, 0.08);
                } else {
                    ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.20)' : 'rgba(0, 0, 0, 0.08)';
                }
                ctx.fillRect(0, y, width, NOTE_HEIGHT);
            }

            // Row divider
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
            ctx.beginPath();
            ctx.moveTo(0, y + NOTE_HEIGHT);
            ctx.lineTo(width, y + NOTE_HEIGHT);
            ctx.stroke();

            // Note name label (shift left when scale degrees shown to make room)
            ctx.fillStyle = isDark ? (noteInScale ? '#fff' : '#666') : (noteInScale ? '#000' : '#999');
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(getNoteName(note), showScaleHighlight ? LABEL_WIDTH - 28 : LABEL_WIDTH - 10, y + NOTE_HEIGHT - 4);

            // Scale degree label (right side of label area)
            if (showScaleHighlight) {
                const degree = scaleInfo.degreeMap[pc];
                if (degree !== undefined) {
                    const degreeLabels = ['R', '2', '3', '4', '5', '6', '7'];
                    const label = degreeLabels[degree - 1];
                    ctx.fillStyle = isRoot ? ac : (isChordTone ? acSec : (isDark ? '#888' : '#777'));
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(label, LABEL_WIDTH - 8, y + NOTE_HEIGHT - 4);
                }
            }
        });

        // Grid Vertical Lines — adapt visual emphasis to current resolution
        // stepsPerSnap: how many 32nd-note steps per snap unit (e.g. res=4 → 8, res=8 → 4, res=16 → 2, res=32 → 1)
        const stepsPerSnap = 32 / globalResolution;
        for (let i = 0; i <= totalBeats * 8; i++) {
            const x = LABEL_WIDTH + (i * (BEAT_WIDTH / 8));
            const isBar = i % 32 === 0;
            const isSnapLine = stepsPerSnap > 0 && i % stepsPerSnap === 0;

            if (isBar) {
                ctx.strokeStyle = ac; // Reddish/Orangish for bars
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
            } else if (isSnapLine) {
                ctx.strokeStyle = isDark ? '#333' : '#d0d0d0';
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
            } else {
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
            }

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw notes
        pattern.forEach((note, index) => {
            const y = noteToY(note.note);
            if (y < 0) return;
            const x = timeToX(note.time);
            const width = Math.max(2, (note.duration * (BEAT_WIDTH / 8)) - 2); // Add horizontal gap
            const isSelected = selectedNotes.has(index);
            // Default note color: Red/Orange theme
            const noteColor = isSelected ? '#fff' : `${hexToRgba(ac, 0.4 + (note.velocity || 0.7) * 0.6)}`;
            ctx.fillStyle = noteColor;
            ctx.fillRect(x, y, width, NOTE_HEIGHT - 2);

            // Note border
            ctx.strokeStyle = isSelected ? acSec : `rgba(0,0,0,0.5)`;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, width, NOTE_HEIGHT - 2);

            // Prominent End Marker (Vertical Line)
            ctx.beginPath();
            ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 1.5;
            ctx.moveTo(x + width, y);
            ctx.lineTo(x + width, y + NOTE_HEIGHT - 2);
            ctx.stroke();
        });

        // Playhead drawn via DOM overlay now for performance

        // Marquee
        if (dragMode === 'marquee' && selectionBox) {
            const left = Math.min(selectionBox.startX, selectionBox.currentX);
            const top = Math.min(selectionBox.startY, selectionBox.currentY);
            const width = Math.abs(selectionBox.startX - selectionBox.currentX);
            const height = Math.abs(selectionBox.startY - selectionBox.currentY);
            ctx.fillStyle = hexToRgba(ac, 0.1);
            ctx.strokeStyle = ac;
            ctx.lineWidth = 1;
            ctx.fillRect(left, top, width, height);
            ctx.strokeRect(left, top, width, height);
        }

        // Insertion Indicator (Subtle Spot)
        if (insertionPoint) {
            const ix = timeToX(insertionPoint.time);
            const iy = noteToY(insertionPoint.note);
            ctx.fillStyle = hexToRgba(ac, 0.3);
            ctx.fillRect(ix, iy, BEAT_WIDTH / 8, NOTE_HEIGHT);
            ctx.strokeStyle = ac;
            ctx.lineWidth = 1;
            ctx.strokeRect(ix, iy, BEAT_WIDTH / 8, NOTE_HEIGHT);
        }

    }, [pattern, selectedNotes, bars, globalKey, globalScale, theme, zoomX, zoomY, isFolded, globalResolution, dragMode, selectionBox, insertionPoint, BEAT_WIDTH, showScaleHighlight, ac, acSec]); // Removed smoothProgress dependency

    // VELOCITY CANVAS DRAWING
    useEffect(() => {
        const vCanvas = velocityCanvasRef.current;
        if (!vCanvas) return;
        const vCtx = vCanvas.getContext('2d');
        const vWidth = LABEL_WIDTH + gridWidth;
        const vHeight = 80;

        if (vCanvas.width !== vWidth) vCanvas.width = vWidth;
        if (vCanvas.height !== vHeight) vCanvas.height = vHeight;

        vCtx.fillStyle = isDark ? '#1a1a1f' : '#eee';
        vCtx.fillRect(0, 0, vWidth, vHeight);

        // Draw grid lines
        for (let i = 0; i <= totalBeats * 8; i++) {
            const x = Math.round(LABEL_WIDTH + (i * (BEAT_WIDTH / 8)));
            const isBeat = i % 8 === 0;
            const isBar = i % 32 === 0;

            vCtx.beginPath();
            if (isBar) {
                vCtx.strokeStyle = isDark ? hexToRgba(ac, 0.3) : hexToRgba(ac, 0.4);
                vCtx.lineWidth = 2;
                vCtx.setLineDash([5, 3]);
            } else if (isBeat) {
                vCtx.strokeStyle = isDark ? '#333' : '#d0d0d0';
                vCtx.lineWidth = 1;
                vCtx.setLineDash([]);
            } else {
                vCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                vCtx.lineWidth = 1;
                vCtx.setLineDash([]);
            }
            vCtx.moveTo(x, 0);
            vCtx.lineTo(x, vHeight);
            vCtx.stroke();
            vCtx.setLineDash([]);
        }

        // Top line
        vCtx.strokeStyle = isDark ? '#333' : '#ccc';
        vCtx.beginPath();
        vCtx.moveTo(0, 0);
        vCtx.lineTo(vWidth, 0);
        vCtx.stroke();

        // Draw velocities
        const viewportHeight = height || 500;
        const vTimeGroups = {};
        pattern.forEach((note, index) => {
            // ONLY draw velocity stems if the note is VERTICALLY visible in the note grid
            const y = noteToY(note.note);
            if (y < (scrollTop - NOTE_HEIGHT) || y > (scrollTop + (height || 500))) return;

            if (!vTimeGroups[note.time]) vTimeGroups[note.time] = [];
            vTimeGroups[note.time].push({ ...note, index });
        });

        Object.values(vTimeGroups).forEach(group => {
            group.sort((a, b) => a.note - b.note);
            group.forEach((note) => {
                const x = timeToX(note.time);
                const vel = note.velocity !== undefined ? note.velocity : 0.7;
                const h = vel * (vHeight - 20);
                const isSelected = selectedNotes.has(note.index);
                const stemX = x; // FIXED: strictly align with note start

                // Stem body
                vCtx.beginPath();
                vCtx.moveTo(stemX, vHeight);
                vCtx.lineTo(stemX, vHeight - h);
                vCtx.strokeStyle = isSelected ? 'rgba(255, 159, 67, 0.8)' : hexToRgba(ac, 0.6);
                vCtx.lineWidth = 1.5;
                vCtx.stroke();

                // Cap (Circle point)
                vCtx.beginPath();
                vCtx.arc(stemX, vHeight - h, 3, 0, Math.PI * 2);
                vCtx.fillStyle = isSelected ? acSec : ac;
                vCtx.fill();
            });
        });
    }, [pattern, selectedNotes, bars, theme, zoomX, BEAT_WIDTH, gridWidth, scrollTop, height, NOTE_HEIGHT, MAX_NOTE, ac, acSec]);

    const resolveGroupOverlaps = (notes, activeIndices) => {
        const activeNotes = activeIndices.map(idx => notes[idx]).filter(Boolean);
        return notes.map((note, idx) => {
            if (activeIndices.includes(idx)) return note;

            let resolvedNote = note;
            for (const activeNote of activeNotes) {
                if (!resolvedNote) break;
                if (resolvedNote.note !== activeNote.note) continue;

                const activeStart = activeNote.time;
                const activeEnd = activeNote.time + activeNote.duration;
                const noteStart = resolvedNote.time;
                const noteEnd = resolvedNote.time + resolvedNote.duration;

                if (activeStart <= noteStart && activeEnd >= noteEnd) {
                    resolvedNote = null;
                } else if (activeStart <= noteStart && activeEnd > noteStart && activeEnd < noteEnd) {
                    resolvedNote = { ...resolvedNote, time: activeEnd, duration: noteEnd - activeEnd };
                } else if (activeStart > noteStart && activeStart < noteEnd && activeEnd >= noteEnd) {
                    resolvedNote = { ...resolvedNote, duration: activeStart - noteStart };
                } else if (activeStart > noteStart && activeEnd < noteEnd) {
                    resolvedNote = { ...resolvedNote, duration: activeStart - noteStart };
                }
            }
            return resolvedNote;
        }).filter(n => n !== null && n.duration > 0);
    };

    const updateVelocityAt = (x, y, forcedValue = null) => {
        const h = 80;
        const newVelocity = forcedValue !== null ? forcedValue : Math.max(0, Math.min(1, (h - y) / (h - 20)));
        const time = xToTime(x);
        const noteIndex = pattern.findIndex(n => time >= n.time && time < n.time + n.duration);
        if (noteIndex !== -1) {
            const newPattern = [...pattern];
            if (newPattern[noteIndex].velocity !== newVelocity) {
                newPattern[noteIndex].velocity = newVelocity;
                onPatternChange(newPattern);
            }
        }
    };

    const handleMouseDown = (e, isVelocityArea = false) => {
        const canvas = isVelocityArea ? velocityCanvasRef.current : canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const isLeftClick = e.button === 0;
        const isRightClick = e.button === 2;

        if (isVelocityArea) {
            const h = 80;
            const newVelocity = Math.max(0, Math.min(1, (h - y) / (h - 20)));
            setDraggingVelocity(true);
            setDragVelocityValue(newVelocity);
            setDragMode('velocity');
            updateVelocityAt(x, y, newVelocity);
            return;
        }

        if (isRightClick) {
            e.preventDefault();
            setDragMode('delete');
            const timeAtX = xToTime(x);
            const noteAtY = yToNote(y);
            const deleteIdx = pattern.findIndex(n => timeAtX >= n.time && timeAtX <= n.time + n.duration && n.note === noteAtY);
            if (deleteIdx !== -1) {
                const newPattern = [...pattern];
                newPattern.splice(deleteIdx, 1);
                onPatternChange(newPattern);
            }
            return;
        }

        const clickedNoteIndex = pattern.findIndex(note => {
            const noteX = timeToX(note.time);
            const noteY = noteToY(note.note);
            const noteWidth = note.duration * (BEAT_WIDTH / 8);
            // Extend hit area by 4px on each side to match resize handle hover zones
            return x >= (noteX - 4) && x <= (noteX + noteWidth + 4) && y >= noteY && y <= noteY + NOTE_HEIGHT;
        });

        if (clickedNoteIndex !== -1 && isLeftClick) {
            const noteX = timeToX(pattern[clickedNoteIndex].time);
            const noteWidth = pattern[clickedNoteIndex].duration * (BEAT_WIDTH / 8);
            const mouseXInNote = x - noteX;
            const clickedNote = pattern[clickedNoteIndex];
            const isGroupSelected = selectedNotes.has(clickedNoteIndex);

            // Automatically capture all notes vertically stacked if not explicitly part of a manual selection group
            const affectedIndices = isGroupSelected
                ? Array.from(selectedNotes)
                : pattern.map((n, i) => (n.time === clickedNote.time && n.duration === clickedNote.duration) ? i : -1).filter(i => i !== -1);

            const handleW = Math.min(16, noteWidth / 3);
            if (mouseXInNote > noteWidth - handleW || mouseXInNote >= noteWidth) {
                setDraggingNote({
                    index: clickedNoteIndex,
                    startX: x,
                    originalPattern: [...pattern],
                    affectedIndices: affectedIndices.map(idx => ({ index: idx, originalTime: pattern[idx].time, originalDuration: pattern[idx].duration }))
                });
                setDragMode('resize-right');
                return;
            }
            if (mouseXInNote < handleW || mouseXInNote <= 0) {
                setDraggingNote({
                    index: clickedNoteIndex,
                    startX: x,
                    originalPattern: [...pattern],
                    affectedIndices: affectedIndices.map(idx => ({ index: idx, originalTime: pattern[idx].time, originalDuration: pattern[idx].duration }))
                });
                setDragMode('resize-left');
                return;
            }
            if (selectedNotes.has(clickedNoteIndex) && (e.ctrlKey || e.shiftKey)) {
                setSelectedNotes(prev => {
                    const next = new Set(prev);
                    next.delete(clickedNoteIndex);
                    return next;
                });
                return;
            }

            // Determine the new selection state
            let newSelection;
            if (!selectedNotes.has(clickedNoteIndex) && !e.shiftKey && !e.ctrlKey) {
                newSelection = new Set([clickedNoteIndex]);
            } else if ((e.shiftKey || e.ctrlKey) && !selectedNotes.has(clickedNoteIndex)) {
                newSelection = new Set([...selectedNotes, clickedNoteIndex]);
            } else {
                newSelection = selectedNotes;
            }
            setSelectedNotes(newSelection);

            setDraggingNote({
                index: clickedNoteIndex,
                startX: x,
                startY: y,
                originalTime: pattern[clickedNoteIndex].time,
                originalNote: pattern[clickedNoteIndex].note,
                _dragStarted: false,
                // Store offsets for all selected notes (using the computed newSelection)
                selectionOffsets: Array.from(newSelection).map(idx => ({
                    index: idx,
                    originalTime: pattern[idx].time,
                    originalNote: pattern[idx].note
                }))
            });
            setDragMode('move');
        } else if (isLeftClick) {
            const snapInterval = 32 / globalResolution;
            const time = Math.round(xToTime(x) / snapInterval) * snapInterval;
            const note = yToNote(y);
            // Always start marquee mode on empty area click — if user drags, it selects;
            // if user just clicks (no drag), mouseUp will set insertion point instead
            setDragMode('marquee');
            setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y, _pendingInsert: { time, note } });
            if (!e.shiftKey && !e.ctrlKey) setSelectedNotes(new Set());
        }
    };

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const overResizeHandle = pattern.some(note => {
            const noteX = timeToX(note.time);
            const noteY = noteToY(note.note);
            const noteWidth = note.duration * (BEAT_WIDTH / 8);
            const handleWidth = Math.min(16, noteWidth / 3);
            const isRight = x >= (noteX + noteWidth - handleWidth) && x <= (noteX + noteWidth + 4);
            const isLeft = x >= (noteX - 4) && x <= (noteX + handleWidth);
            return (isRight || isLeft) && y >= noteY && y <= noteY + NOTE_HEIGHT;
        });

        if (overResizeHandle && !dragMode) canvas.style.cursor = 'col-resize';
        else canvas.style.cursor = dragMode === 'move' ? 'grabbing' : (dragMode === 'delete' ? 'no-drop' : 'default');

        if (dragMode === 'velocity') {
            updateVelocityAt(x, y, dragVelocityValue);
            return;
        }

        if (dragMode === 'marquee' && selectionBox) {
            const newBox = { ...selectionBox, currentX: x, currentY: y };
            setSelectionBox(newBox);
            const left = Math.min(newBox.startX, newBox.currentX);
            const right = Math.max(newBox.startX, newBox.currentX);
            const top = Math.min(newBox.startY, newBox.currentY);
            const bottom = Math.max(newBox.startY, newBox.currentY);
            const newSelection = new Set();
            pattern.forEach((note, idx) => {
                const noteX = timeToX(note.time);
                const noteY = noteToY(note.note);
                const noteWidth = note.duration * (BEAT_WIDTH / 8);
                if (noteX < right && noteX + noteWidth > left && noteY < bottom && noteY + NOTE_HEIGHT > top) newSelection.add(idx);
            });
            setSelectedNotes(newSelection);
            return;
        }

        if (dragMode === 'delete') {
            const timeAtX = xToTime(x);
            const noteAtY = yToNote(y);
            const deleteIdx = pattern.findIndex(n => timeAtX >= n.time && timeAtX <= n.time + n.duration && n.note === noteAtY);
            if (deleteIdx !== -1) {
                const newPattern = [...pattern];
                newPattern.splice(deleteIdx, 1);
                onPatternChange(newPattern);
            }
            return;
        }

        if (dragMode === 'move' && draggingNote) {
            const deltaX = x - draggingNote.startX;
            const deltaY = y - draggingNote.startY;
            // Require a minimum drag distance before moving (prevents accidental moves on click)
            if (!draggingNote._dragStarted && Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
            draggingNote._dragStarted = true;
            // Calculate time delta
            const timeDelta = deltaX / (BEAT_WIDTH / 8);

            // Calculate note delta
            const currentNoteAtY = yToNote(y);
            const noteDelta = currentNoteAtY - draggingNote.originalNote;

            const snapInterval = 32 / globalResolution;
            const newPattern = [...pattern];

            draggingNote.selectionOffsets.forEach(offset => {
                const newTimeRaw = offset.originalTime + timeDelta;
                // Clamp time to stay within [0, totalSteps - duration]
                const maxTime = (bars * 32) - offset.originalDuration;
                const newTime = Math.max(0, Math.min(Math.round(newTimeRaw / snapInterval) * snapInterval, maxTime));

                let newNote = offset.originalNote + noteDelta;

                // Scale snapping logic if enabled OR dragging vertically in folded mode (which implies scale constraint)
                if ((snapToScale || isFolded) && !scaleNotes.has(newNote)) {
                    // Find nearest scale note
                    let nearest = newNote;
                    let minDiff = Infinity;
                    const sorted = Array.from(scaleNotes).sort((a, b) => a - b);
                    for (let sNote of sorted) {
                        const diff = Math.abs(sNote - newNote);
                        if (diff < minDiff) {
                            minDiff = diff;
                            nearest = sNote;
                        }
                    }
                    newNote = nearest;
                }

                // Update the note in the pattern
                if (newPattern[offset.index]) {
                    newPattern[offset.index] = {
                        ...newPattern[offset.index],
                        time: newTime,
                        note: newNote
                    };
                }
            });

            onPatternChange(newPattern); // Note: verify resolveNoteOverlaps compatibility with multi-move
        }

        if (dragMode === 'resize-right' && draggingNote && draggingNote.originalPattern) {
            const deltaX = x - draggingNote.startX;
            const snapInterval = 32 / globalResolution;

            let workingPattern = [...draggingNote.originalPattern];
            const activeIndices = [];

            draggingNote.affectedIndices.forEach(item => {
                const newDurationRaw = item.originalDuration + (deltaX / (BEAT_WIDTH / 8));
                const maxDuration = (bars * 32) - workingPattern[item.index].time;
                const newDuration = Math.max(snapInterval, Math.min(newDurationRaw, maxDuration));
                const snappedDuration = Math.round(newDuration / snapInterval) * snapInterval;
                workingPattern[item.index] = { ...workingPattern[item.index], duration: snappedDuration };
                activeIndices.push(item.index);
            });

            onPatternChange(resolveGroupOverlaps(workingPattern, activeIndices));
        }

        if (dragMode === 'resize-left' && draggingNote && draggingNote.originalPattern) {
            const deltaX = x - draggingNote.startX;
            const snapInterval = 32 / globalResolution;

            let workingPattern = [...draggingNote.originalPattern];
            const activeIndices = [];

            draggingNote.affectedIndices.forEach(item => {
                const newTimeRaw = item.originalTime + (deltaX / (BEAT_WIDTH / 8));
                const maxTime = item.originalTime + item.originalDuration - snapInterval;
                const newTime = Math.max(0, Math.min(newTimeRaw, maxTime));
                const snappedTime = Math.round(newTime / snapInterval) * snapInterval;
                const deltaT = snappedTime - item.originalTime;
                const newDuration = item.originalDuration - deltaT;

                if (newDuration >= snapInterval) {
                    workingPattern[item.index] = { ...workingPattern[item.index], time: snappedTime, duration: newDuration };
                    activeIndices.push(item.index);
                }
            });

            if (activeIndices.length > 0) {
                onPatternChange(resolveGroupOverlaps(workingPattern, activeIndices));
            }
        }
    };

    const handleMouseUp = () => {
        // If marquee was too small (just a click, no real drag), set insertion point instead
        if (dragMode === 'marquee' && selectionBox && selectionBox._pendingInsert) {
            const dx = Math.abs((selectionBox.currentX || selectionBox.startX) - selectionBox.startX);
            const dy = Math.abs((selectionBox.currentY || selectionBox.startY) - selectionBox.startY);
            if (dx < 5 && dy < 5) {
                setInsertionPoint(selectionBox._pendingInsert);
                setSelectedNotes(new Set());
            }
        }
        setDraggingNote(null);
        setDraggingVelocity(false);
        setDragMode(null);
        setSelectionBox(null);
    };

    // Attach window-level mousemove/mouseup during any drag so resizing/moving
    // continues even when the cursor leaves the canvas bounds.
    const handleMouseMoveRef = useRef(handleMouseMove);
    const handleMouseUpRef = useRef(handleMouseUp);
    handleMouseMoveRef.current = handleMouseMove;
    handleMouseUpRef.current = handleMouseUp;

    useEffect(() => {
        if (!dragMode) return;
        const onMove = (e) => handleMouseMoveRef.current(e);
        const onUp = () => handleMouseUpRef.current();
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [dragMode]);

    const handleDoubleClick = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // X coordinate on canvas includes LABEL_WIDTH offset natively in timeToX
        const clickedNoteIndex = pattern.findIndex(note => {
            const noteX = timeToX(note.time);
            const noteY = noteToY(note.note);
            const noteWidth = note.duration * (BEAT_WIDTH / 8);
            return x >= noteX && x <= noteX + noteWidth && y >= noteY && y <= noteY + NOTE_HEIGHT;
        });
        if (clickedNoteIndex !== -1) {
            const newPattern = [...pattern];
            newPattern.splice(clickedNoteIndex, 1);
            onPatternChange(newPattern);
            setSelectedNotes(new Set());
        } else {
            const snapInterval = 32 / globalResolution;
            const time = Math.round(xToTime(x) / snapInterval) * snapInterval;
            let noteNum = yToNote(y);
            if (snapToScale && !scaleNotes.has(noteNum)) {
                noteNum = Array.from(scaleNotes).sort((a, b) => Math.abs(a - noteNum) - Math.abs(b - noteNum))[0];
            }
            onPatternChange([...pattern, { time, duration: snapInterval, note: noteNum, velocity: 0.7 }]);
        }
    };

    const invertSelection = () => {
        if (selectedNotes.size === 0) return;
        const selectedIndices = Array.from(selectedNotes);
        const selectedNoteObjects = selectedIndices.map(i => pattern[i]);
        const avgPitch = selectedNoteObjects.reduce((sum, n) => sum + n.note, 0) / selectedNoteObjects.length;
        const centerPitch = Math.round(avgPitch);
        const newPattern = [...pattern];
        selectedIndices.forEach(index => {
            const note = newPattern[index];
            const distance = note.note - centerPitch;
            newPattern[index] = { ...note, note: Math.max(MIN_NOTE, Math.min(MAX_NOTE, centerPitch - distance)) };
        });
        onPatternChange(newPattern);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelectedNotes(new Set(pattern.keys())); return; }
            if (isCtrl && e.key.toLowerCase() === 'c') { if (selectedNotes.size === 0) return; e.preventDefault(); setClipboard(Array.from(selectedNotes).map(i => ({ ...pattern[i] }))); return; }
            if (isCtrl && e.key.toLowerCase() === 'x') { if (selectedNotes.size === 0) return; e.preventDefault(); setClipboard(Array.from(selectedNotes).map(i => ({ ...pattern[i] }))); onPatternChange(pattern.filter((_, i) => !selectedNotes.has(i))); setSelectedNotes(new Set()); return; }
            if (isCtrl && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                if (clipboard.length > 0) {
                    const minTime = Math.min(...clipboard.map(n => n.time));
                    const pasteTime = insertionPoint ? insertionPoint.time : 0;
                    const pasteNoteOffset = insertionPoint ? (insertionPoint.note - clipboard[0].note) : 0;
                    const newNotes = clipboard.map(n => ({ ...n, time: n.time - minTime + pasteTime, note: Math.max(MIN_NOTE, Math.min(MAX_NOTE, n.note + pasteNoteOffset)) })).filter(n => n.time < bars * 32);
                    onPatternChange([...pattern, ...newNotes]);
                }
                return;
            }
            if (e.shiftKey && !isCtrl && e.key === 'D') {
                if (selectedNotes.size === 0) return;
                e.preventDefault();
                const selected = Array.from(selectedNotes).map(i => pattern[i]);
                const minTime = Math.min(...selected.map(n => n.time));
                const maxTime = Math.max(...selected.map(n => n.time + n.duration));
                const offset = e.shiftKey ? (maxTime - minTime) : 0;
                // Fix: Limit duplication to total steps (bars * 32) instead of bars * 4
                const duplicated = selected.map(n => ({ ...n, time: n.time + offset })).filter(n => n.time < bars * 32);
                onPatternChange([...pattern, ...duplicated]);
                return;
            }
            // Bare digit keys (no Ctrl) split selected note AND block global tab switching
            if (!isCtrl && selectedNotes.size > 0 && /^[1-9]$/.test(e.key)) {
                e.preventDefault();
                e.stopImmediatePropagation(); // Prevent global tab-switch handler from firing
                const divisions = parseInt(e.key);
                if (divisions === 1) return; // 1 division = no-op, but we still blocked tab switch
                if (selectedNotes.size !== 1) return; // Only split a single selected note
                const selectedIdx = Array.from(selectedNotes)[0];
                const noteToSplit = pattern[selectedIdx];
                const newDuration = noteToSplit.duration / divisions;
                const newPattern = [...pattern];
                newPattern.splice(selectedIdx, 1);
                for (let i = 0; i < divisions; i++) {
                    const newTime = noteToSplit.time + (i * newDuration);
                    if (newTime < bars * 32) {
                        newPattern.push({
                            time: newTime,
                            duration: newDuration,
                            note: noteToSplit.note,
                            velocity: noteToSplit.velocity
                        });
                    }
                }
                onPatternChange(newPattern);
                setSelectedNotes(new Set());
                return;
            }
            // Ctrl+digit split (legacy — still works for Ctrl+2/4/6/8)
            if (isCtrl && ['2', '4', '6', '8'].includes(e.key)) {
                if (selectedNotes.size !== 1) {
                    console.log("Note splitting is only allowed on a single selected note.");
                    return;
                }
                e.preventDefault();
                const divisions = parseInt(e.key);
                const selectedIdx = Array.from(selectedNotes)[0];
                const noteToSplit = pattern[selectedIdx];
                const newDuration = noteToSplit.duration / divisions;

                const newPattern = [...pattern];
                newPattern.splice(selectedIdx, 1); // remove original

                for (let i = 0; i < divisions; i++) {
                    const newTime = noteToSplit.time + (i * newDuration);
                    if (newTime < bars * 32) {
                        newPattern.push({
                            time: newTime,
                            duration: newDuration,
                            note: noteToSplit.note,
                            velocity: noteToSplit.velocity
                        });
                    }
                }
                onPatternChange(newPattern);
                setSelectedNotes(new Set()); // Clear selection after split
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedNotes.size > 0) { e.preventDefault(); onPatternChange(pattern.filter((_, i) => !selectedNotes.has(i))); setSelectedNotes(new Set()); } return; }
            if (e.key === 'Escape') { setSelectedNotes(new Set()); setInsertionPoint(null); return; }
            if (isCtrl && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                if (selectedNotes.size === 0) return;
                e.preventDefault();
                const shift = e.key === 'ArrowUp' ? 12 : -12;
                const newPattern = [...pattern];
                selectedNotes.forEach(i => { newPattern[i] = { ...newPattern[i], note: Math.max(MIN_NOTE, Math.min(MAX_NOTE, newPattern[i].note + shift)) }; });
                onPatternChange(newPattern);
                return;
            }
            if (selectedNotes.size > 0) {
                const newPattern = [...pattern];
                if (e.key === 'ArrowUp') { e.preventDefault(); selectedNotes.forEach(i => { newPattern[i].note = Math.min(MAX_NOTE, newPattern[i].note + 1); }); onPatternChange(newPattern); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); selectedNotes.forEach(i => { newPattern[i].note = Math.max(MIN_NOTE, newPattern[i].note - 1); }); onPatternChange(newPattern); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); selectedNotes.forEach(i => { newPattern[i].time = Math.max(0, newPattern[i].time - 0.25); }); onPatternChange(newPattern); }
                else if (e.key === 'ArrowRight') { e.preventDefault(); selectedNotes.forEach(i => { newPattern[i].time = Math.min(bars * 4 - 0.25, newPattern[i].time + 0.25); }); onPatternChange(newPattern); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNotes, pattern, onPatternChange, bars, clipboard, MAX_NOTE, MIN_NOTE, insertionPoint]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: isDark ? '#0a0a0a' : '#f5f5f5' }}>
            <div style={{ padding: '10px', background: isDark ? '#1a1a1f' : '#fff', display: 'flex', gap: '10px', alignItems: 'center', borderBottom: `1px solid ${isDark ? '#2a2a3e' : '#ccc'} ` }}>
                <button onClick={() => setIsFolded(!isFolded)} title={t('pianoRoll.foldTooltip')} style={{ padding: '6px 12px', background: isFolded ? ac : 'transparent', border: `1px solid ${isDark ? '#444' : '#ccc'} `, borderRadius: '4px', color: isDark ? '#fff' : '#333', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>{isFolded ? '☑' : '☐'} {t('pianoRoll.fold')}</button>
                <button onClick={() => setSnapToScale(!snapToScale)} title={t('pianoRoll.snapTooltip')} style={{ padding: '6px 12px', background: snapToScale ? ac : 'transparent', border: `1px solid ${isDark ? '#444' : '#ccc'} `, borderRadius: '4px', color: snapToScale ? '#fff' : (isDark ? '#fff' : '#333'), fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>{snapToScale ? '☑' : '☐'} {t('pianoRoll.snap')}</button>
                <button onClick={() => setShowScaleHighlight(!showScaleHighlight)} title={t('pianoRoll.scaleTooltip')} style={{ padding: '6px 12px', background: showScaleHighlight ? ac : 'transparent', border: `1px solid ${isDark ? '#444' : '#ccc'} `, borderRadius: '4px', color: showScaleHighlight ? '#fff' : (isDark ? '#fff' : '#333'), fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>{showScaleHighlight ? '☑' : '☐'} {t('pianoRoll.scale')}</button>
                <button onClick={invertSelection} disabled={selectedNotes.size === 0} title={t('pianoRoll.invertTooltip')} style={{ padding: '6px 12px', background: selectedNotes.size > 0 ? acSec : 'transparent', border: `1px solid ${isDark ? '#444' : '#ccc'} `, borderRadius: '4px', color: selectedNotes.size > 0 ? '#fff' : (isDark ? '#666' : '#999'), fontSize: '12px', fontWeight: 'bold', cursor: selectedNotes.size > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s', opacity: selectedNotes.size > 0 ? 1 : 0.5 }}>⇅ {t('pianoRoll.invert')}</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', paddingRight: '10px' }}>
                    {/* Zoom Removed per user request */}
                </div>
            </div>
            <div
                ref={scrollContainerRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    position: 'relative',
                    border: isDraggingOver ? `2px dashed ${theme === 'dark' ? ac : '#ff4b4b'}` : '2px dashed transparent',
                    backgroundColor: isDraggingOver ? (theme === 'dark' ? hexToRgba(ac, 0.05) : hexToRgba(ac, 0.1)) : 'transparent',
                    transition: 'all 0.2s ease'
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (onDrop) setIsDraggingOver(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    if (onDrop) onDrop(e);
                }}
            >
                <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={dragMode ? undefined : handleMouseMove} onMouseUp={dragMode ? undefined : handleMouseUp} onDoubleClick={handleDoubleClick} onContextMenu={(e) => e.preventDefault()} style={{ display: 'block', pointerEvents: isDraggingOver ? 'none' : 'auto' }} />

                {/* DOM Playhead Overlay */}
                <div ref={playheadRef} style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0, // Ensure it stretches to bottom
                    top: 0,
                    width: '2px',
                    background: ac,
                    boxShadow: `0 0 10px ${ac}, 0 0 5px #fff`, // Add glow for visibility
                    pointerEvents: 'none',
                    zIndex: 9999, // Ensure it's on top of everything
                    willChange: 'transform'
                }} />
            </div>
            <div
                ref={velocityScrollRef}
                style={{ height: '100px', background: isDark ? '#1a1a1f' : '#eee', borderTop: `1px solid ${isDark ? '#2a2a3e' : '#ccc'} `, overflowX: 'hidden', overflowY: 'hidden' }}>
                <canvas ref={velocityCanvasRef} width={LABEL_WIDTH + gridWidth} height={80} onMouseDown={(e) => handleMouseDown(e, true)} onMouseMove={dragMode ? undefined : handleMouseMove} onMouseUp={dragMode ? undefined : handleMouseUp} style={{ display: 'block', cursor: draggingVelocity ? 'grabbing' : 'grab' }} />
            </div>
        </div>
    );
};

export default PianoRollEditor;
