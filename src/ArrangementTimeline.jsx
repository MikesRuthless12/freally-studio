import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import PianoRollEditor from './PianoRollEditor';
import WaveformClipCanvas from './WaveformClipCanvas';
import WaveformEditor from './WaveformEditor';
import ArrangementMixer from './ArrangementMixer';
import { buildDefaultTrackOrder } from './trackOrderUtils';
import DetailPanel from './DetailPanel';
import { AudioEffect } from './effects/AudioEffect.js';
import { hexToRgba } from './accentThemes';
import { collectAudioFiles, shuffleArray } from './randomFileUtils';
import StemSeparationModal from './StemSeparationModal';
import { StemSeparator } from './StemSeparator';
import { AudioAnalyzer } from './AudioAnalyzer';
import { interpolateAutomation, addAutomationPoint, removeAutomationPoint, moveAutomationPoint } from './automationUtils';
import { loopAllPatterns } from './patternUtils';
import { useTranslation } from './i18n/I18nContext.jsx';
import { getFileFromItem } from './getFileFromItem.js';

const SECTION_TYPES = [
    { value: 'intro', label: 'Intro', i18nKey: 'arrange.intro' },
    { value: 'verse', label: 'Verse', i18nKey: 'arrange.verse' },
    { value: 'chorus', label: 'Chorus', i18nKey: 'arrange.chorus' },
    { value: 'bridge', label: 'Bridge', i18nKey: 'arrange.bridge' },
    { value: 'drop', label: 'Drop', i18nKey: 'arrange.drop' },
    { value: 'breakdown', label: 'Breakdown', i18nKey: 'arrange.breakdown' },
    { value: 'outro', label: 'Outro', i18nKey: 'arrange.outro' },
    { value: 'custom', label: 'Custom', i18nKey: 'arrange.custom' }
];

const SECTION_COLORS = [
    '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c',
    '#4dabf7', '#9775fa', '#f06595', '#20c997',
    '#ff8787', '#74c0fc', '#b197fc', '#63e6be'
];

const DRUM_ELEMENTS = [
    { id: '808', name: '808', color: '#6c5ce7', i18nKey: 'arrange.drum808' },
    { id: 'kick', name: 'Kick', color: '#ff6b6b', i18nKey: 'arrange.drumKick' },
    { id: 'clap', name: 'Clap', color: '#ff9f43', i18nKey: 'arrange.drumClap' },
    { id: 'snare', name: 'Snare', color: '#ff7675', i18nKey: 'arrange.drumSnare' },
    { id: 'offSnare', name: 'Off Snare', color: '#fdcb6e', i18nKey: 'arrange.drumOffSnare' },
    { id: 'closedHat', name: 'Closed Hat', color: '#e17055', i18nKey: 'arrange.drumClosedHat' },
    { id: 'openHat', name: 'Open Hat', color: '#d63031', i18nKey: 'arrange.drumOpenHat' },
    { id: 'rim', name: 'Rim', color: '#fab1a0', i18nKey: 'arrange.drumRim' },
    { id: 'perc', name: 'Perc', color: '#e84393', i18nKey: 'arrange.drumPerc' }
];

const MELODIC_TRACKS = [
    { id: 'chords', label: 'Chords', trackKey: 'chords', color: '#3498db', i18nKey: 'arrange.chords' },
    { id: 'melody', label: 'Melody', trackKey: 'melody', color: '#2ecc71', i18nKey: 'arrange.melody' },
    { id: 'bass', label: 'Bass', trackKey: 'bass', color: '#9b59b6', i18nKey: 'arrange.bass' }
];

const MIN_PX_PER_BAR = 8;  // Zoom out limit: ~3 minutes visible at typical widths
const MAX_PX_PER_BAR = 250;
const DEFAULT_PX_PER_BAR = 50;
const MAX_SECTIONS = 512;  // Support up to 90+ minutes of arrangement
const TRACK_LABEL_WIDTH = 260;
const ROW_HEIGHT = 64;
const ROW_HEIGHT_COLLAPSED = 26;
const ROW_HEIGHT_ZOOMED = 220;
const DRUM_ROW_HEIGHT = 24;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimePrecise(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (s === Math.floor(s)) return `${m}:${Math.floor(s).toString().padStart(2, '0')}`;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

// ─── Pattern Preview Strip ───
// Horizontal strip with 4 mini clip cards (Drums, Chords, Melody, Bass) above the timeline.
// Supports drum sub-pattern switching via keyboard, and drag-to-timeline.
const PREVIEW_TRACK_COLORS = {
    drums: '#ff6b6b',
    chords: '#3498db',
    melody: '#2ecc71',
    bass: '#9b59b6'
};

const DRUM_SHORTCUT_MAP = {
    'a': 'all', 'b': '808', 'c': 'clap', 'k': 'kick',
    's': 'snare', 'o': 'offSnare', 'p': 'perc', 'r': 'rim'
};

const DRUM_ID_LABELS = {
    'all': 'All', '808': '808', 'clap': 'Clap', 'kick': 'Kick',
    'snare': 'Snare', 'offSnare': 'Off Snare', 'closedHat': 'Closed Hat',
    'openHat': 'Open Hat', 'rim': 'Rim', 'perc': 'Perc'
};

function PatternPreviewStrip({
    previewDrumPattern, previewChordPattern, previewMelodyPattern, previewBassPattern,
    globalBars, isDark, ac, pixelsPerBar, totalBars, scrollLeft, borderColor,
    onAddDrumClipFromPreview, onAddChordClipFromPreview, onAddMelodyClipFromPreview, onAddBassClipFromPreview,
    setTimelineBars, timelineBars
}) {
    const [selectedCard, setSelectedCard] = useState(null); // 'drums' | 'chords' | 'melody' | 'bass'
    const [drumSubPattern, setDrumSubPattern] = useState('all');
    const [pendingKey, setPendingKey] = useState(null);
    const pendingKeyTimer = useRef(null);
    const [dragState, setDragState] = useState(null); // { trackType, startX, startY, ghostX }

    // Keyboard shortcuts for drum sub-pattern switching
    useEffect(() => {
        if (selectedCard !== 'drums') return;
        const handler = (e) => {
            const key = e.key.toLowerCase();
            // Two-key combos: C then H = closedHat, O then H = openHat
            if (pendingKey) {
                clearTimeout(pendingKeyTimer.current);
                setPendingKey(null);
                if (pendingKey === 'c' && key === 'h') { setDrumSubPattern('closedHat'); return; }
                if (pendingKey === 'o' && key === 'h') { setDrumSubPattern('openHat'); return; }
                // If second key doesn't form a combo, try single-key map for the pending key
                if (DRUM_SHORTCUT_MAP[pendingKey]) setDrumSubPattern(DRUM_SHORTCUT_MAP[pendingKey]);
                return;
            }
            // Start two-key combo wait for 'c' and 'o'
            if (key === 'c' || key === 'o') {
                setPendingKey(key);
                pendingKeyTimer.current = setTimeout(() => {
                    setPendingKey(null);
                    if (DRUM_SHORTCUT_MAP[key]) setDrumSubPattern(DRUM_SHORTCUT_MAP[key]);
                }, 300);
                return;
            }
            if (DRUM_SHORTCUT_MAP[key]) setDrumSubPattern(DRUM_SHORTCUT_MAP[key]);
        };
        window.addEventListener('keydown', handler);
        return () => { window.removeEventListener('keydown', handler); clearTimeout(pendingKeyTimer.current); };
    }, [selectedCard, pendingKey]);

    // Build SVG markup for pattern preview (used in drag ghost)
    const buildPatternSvg = useCallback((trackType) => {
        const color = PREVIEW_TRACK_COLORS[trackType];
        if (trackType === 'drums') {
            const pattern = previewDrumPattern;
            if (!pattern || typeof pattern !== 'object') return '';
            const drumIds = drumSubPattern === 'all'
                ? Object.keys(pattern)
                : (pattern[drumSubPattern] ? [drumSubPattern] : []);
            const totalDrums = drumIds.length || 1;
            const totalSteps = 4 * 32; // 4 bars
            let rects = '';
            drumIds.forEach((drumId, di) => {
                const drum = pattern[drumId];
                if (!drum?.lanes?.root?.pattern) return;
                const pat = drum.lanes.root.pattern;
                const srcLen = Math.min(pat.length, totalSteps);
                for (let step = 0; step < totalSteps; step++) {
                    if (pat[step % srcLen]) {
                        const x = (step / totalSteps) * 100;
                        const y = ((di + 0.1) / totalDrums) * 100;
                        const h = Math.max(2, (0.8 / totalDrums) * 100);
                        const dc = DRUM_ELEMENTS.find(d => d.id === drumId)?.color || color;
                        rects += `<rect x="${x}%" y="${y}%" width="0.8%" height="${h}%" fill="${dc}" opacity="0.85" rx="0.3"/>`;
                    }
                }
            });
            return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none">${rects}</svg>`;
        } else {
            const patternMap = { chords: previewChordPattern, melody: previewMelodyPattern, bass: previewBassPattern };
            const notes = patternMap[trackType];
            if (!Array.isArray(notes) || notes.length === 0) return '';
            const totalSteps = 4 * 32;
            // Use only notes within 4 bars
            const clipped = notes.filter(n => n.time < totalSteps);
            if (clipped.length === 0) return '';
            const minNote = Math.min(...clipped.map(n => n.note));
            const maxNote = Math.max(...clipped.map(n => n.note));
            const range = Math.max(1, maxNote - minNote);
            let rects = '';
            clipped.forEach(n => {
                const x = (n.time / totalSteps) * 100;
                const w = Math.max(0.5, (Math.min(n.duration, totalSteps - n.time) / totalSteps) * 100);
                const y = ((maxNote - n.note) / range) * 100;
                const h = Math.max(3, 100 / range);
                rects += `<rect x="${x}%" y="${y}%" width="${w}%" height="${h}%" fill="${color}" opacity="${n.velocity || 0.7}" rx="0.5"/>`;
            });
            return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none">${rects}</svg>`;
        }
    }, [previewDrumPattern, previewChordPattern, previewMelodyPattern, previewBassPattern, drumSubPattern]);

    // Find the target row element from cursor Y position
    const findTargetRow = useCallback((timelineEl, clientY) => {
        const rowTypeMap = { drums: 'drums-all', chords: 'melodic', melody: 'melodic', bass: 'melodic' };
        const trackKeyMap = { chords: 'chords', melody: 'melody', bass: 'bass' };
        const rows = timelineEl.querySelectorAll('[data-row-id]');
        let best = null;
        let bestDist = Infinity;
        for (const el of rows) {
            const rect = el.getBoundingClientRect();
            const rowType = el.getAttribute('data-row-type');
            const rowTrackKey = el.getAttribute('data-row-trackkey');
            // Find the midpoint distance
            const mid = rect.top + rect.height / 2;
            const dist = Math.abs(clientY - mid);
            if (dist < bestDist) {
                bestDist = dist;
                best = { el, rect, rowType, rowTrackKey };
            }
        }
        return best;
    }, []);

    // Drag handlers for preview cards
    const handleCardMouseDown = useCallback((e, trackType) => {
        if (e.button !== 0) return; // Left click only for MIDI drag
        e.preventDefault();
        setSelectedCard(trackType);
        const startX = e.clientX;
        const startY = e.clientY;
        let isDragging = false;
        let ghostDiv = null;
        let timelineGhost = null;
        let patternSvg = null;

        const onMove = (moveE) => {
            const dx = moveE.clientX - startX;
            const dy = moveE.clientY - startY;
            if (!isDragging && Math.abs(dx) + Math.abs(dy) > 5) {
                isDragging = true;
                patternSvg = buildPatternSvg(trackType);
                // Create floating ghost element
                ghostDiv = document.createElement('div');
                ghostDiv.style.cssText = `position:fixed;z-index:99999;pointer-events:none;
                    background:${PREVIEW_TRACK_COLORS[trackType]}44;border:2px solid ${PREVIEW_TRACK_COLORS[trackType]};
                    border-radius:4px;padding:4px 8px;font-size:10px;font-weight:700;color:#fff;
                    font-family:sans-serif;white-space:nowrap;`;
                const label = trackType === 'drums' && drumSubPattern !== 'all'
                    ? `${trackType} (${DRUM_ID_LABELS[drumSubPattern] || drumSubPattern})`
                    : trackType.charAt(0).toUpperCase() + trackType.slice(1);
                ghostDiv.textContent = label;
                document.body.appendChild(ghostDiv);
            }
            if (ghostDiv) {
                ghostDiv.style.left = `${moveE.clientX + 10}px`;
                ghostDiv.style.top = `${moveE.clientY + 10}px`;
            }
            // Show a 4-bar ghost on the timeline snapped to bar grid and target row
            const timelineEl = document.querySelector('[data-timeline-scroll]');
            if (timelineEl && isDragging) {
                const rect = timelineEl.getBoundingClientRect();
                if (moveE.clientY >= rect.top && moveE.clientY <= rect.bottom) {
                    const relX = moveE.clientX - rect.left + timelineEl.scrollLeft;
                    const snapBar = Math.max(0, Math.floor(relX / pixelsPerBar));
                    const ghostW = 4 * pixelsPerBar;
                    const ghostX = snapBar * pixelsPerBar;

                    // Find the target row to position the ghost at
                    const targetRow = findTargetRow(timelineEl, moveE.clientY);

                    if (!timelineGhost) {
                        timelineGhost = document.createElement('div');
                        timelineGhost.style.cssText = `position:absolute;z-index:50;pointer-events:none;
                            background:${PREVIEW_TRACK_COLORS[trackType]}30;border:2px solid ${PREVIEW_TRACK_COLORS[trackType]};
                            border-radius:3px;overflow:hidden;`;
                        timelineEl.querySelector('div')?.appendChild(timelineGhost);
                    }
                    timelineGhost.style.left = `${ghostX}px`;
                    timelineGhost.style.width = `${ghostW}px`;

                    if (targetRow) {
                        // Position ghost at the target row's Y offset and height
                        const scrollTop = timelineEl.scrollTop;
                        const containerRect = timelineEl.querySelector('div')?.getBoundingClientRect();
                        if (containerRect) {
                            const rowTop = targetRow.rect.top - containerRect.top;
                            timelineGhost.style.top = `${rowTop}px`;
                            timelineGhost.style.height = `${targetRow.rect.height}px`;
                        }
                    } else {
                        timelineGhost.style.top = '0';
                        timelineGhost.style.height = '100%';
                    }

                    // Set pattern SVG content
                    if (patternSvg && timelineGhost.innerHTML !== patternSvg) {
                        timelineGhost.innerHTML = patternSvg;
                    }
                    timelineGhost.style.display = 'block';
                } else if (timelineGhost) {
                    timelineGhost.style.display = 'none';
                }
            }
        };

        const onUp = (upE) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (ghostDiv) {
                ghostDiv.remove();
            }
            if (timelineGhost) {
                timelineGhost.remove();
            }
            if (!isDragging) return;
            // Determine drop bar from mouse position relative to timeline
            // Find the scroll container to compute bar position
            const timelineEl = document.querySelector('[data-timeline-scroll]');
            if (!timelineEl) return;
            const rect = timelineEl.getBoundingClientRect();
            if (upE.clientY < rect.top || upE.clientY > rect.bottom) return; // Outside timeline
            const relX = upE.clientX - rect.left + timelineEl.scrollLeft;
            const dropBar = Math.max(0, Math.floor(relX / pixelsPerBar));

            // Auto-extend timeline if needed — always keep 64 bars of headroom
            if (dropBar + 64 > timelineBars && setTimelineBars) {
                setTimelineBars(prev => Math.max(prev, Math.ceil((dropBar + 64) / 64) * 64));
            }

            // Create clip at drop position
            if (trackType === 'drums' && onAddDrumClipFromPreview) {
                onAddDrumClipFromPreview(dropBar, drumSubPattern);
            } else if (trackType === 'chords' && onAddChordClipFromPreview) {
                onAddChordClipFromPreview(dropBar);
            } else if (trackType === 'melody' && onAddMelodyClipFromPreview) {
                onAddMelodyClipFromPreview(dropBar);
            } else if (trackType === 'bass' && onAddBassClipFromPreview) {
                onAddBassClipFromPreview(dropBar);
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [pixelsPerBar, timelineBars, setTimelineBars, drumSubPattern, buildPatternSvg, findTargetRow,
        onAddDrumClipFromPreview, onAddChordClipFromPreview, onAddMelodyClipFromPreview, onAddBassClipFromPreview]);

    // Render a mini drum pattern preview SVG
    const renderDrumPreview = (pattern, subPattern) => {
        if (!pattern || typeof pattern !== 'object') return null;
        const dots = [];
        const drumIds = subPattern === 'all'
            ? Object.keys(pattern)
            : (pattern[subPattern] ? [subPattern] : []);
        const totalDrums = drumIds.length || 1;
        drumIds.forEach((drumId, drumIdx) => {
            const drum = pattern[drumId];
            if (!drum?.lanes?.root?.pattern) return;
            const pat = drum.lanes.root.pattern;
            pat.forEach((active, step) => {
                if (active) {
                    const x = (step / pat.length) * 100;
                    const y = ((drumIdx + 0.5) / totalDrums) * 100;
                    dots.push(<circle key={`${drumId}-${step}`} cx={`${x}%`} cy={`${y}%`} r="1.5"
                        fill={DRUM_ELEMENTS.find(d => d.id === drumId)?.color || '#ff6b6b'} opacity="0.8" />);
                }
            });
        });
        return <svg width="100%" height="100%" preserveAspectRatio="none">{dots}</svg>;
    };

    // Render mini piano roll preview SVG for melodic patterns
    const renderMelodicPreview = (pattern, color) => {
        if (!Array.isArray(pattern) || pattern.length === 0) return null;
        const notes = pattern;
        const minNote = Math.min(...notes.map(n => n.note));
        const maxNote = Math.max(...notes.map(n => n.note));
        const range = Math.max(1, maxNote - minNote);
        const totalSteps = globalBars * 32;
        const rects = notes.map((n, i) => {
            const x = (n.time / totalSteps) * 100;
            const w = Math.max(0.5, (n.duration / totalSteps) * 100);
            const y = ((maxNote - n.note) / range) * 100;
            const h = Math.max(2, 100 / range);
            return <rect key={i} x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`}
                fill={color} opacity={n.velocity || 0.7} rx="0.5" />;
        });
        return <svg width="100%" height="100%" preserveAspectRatio="none">{rects}</svg>;
    };

    const cards = [
        { key: 'drums', label: selectedCard === 'drums' && drumSubPattern !== 'all' ? `Drums (${DRUM_ID_LABELS[drumSubPattern] || drumSubPattern})` : 'Drums', color: PREVIEW_TRACK_COLORS.drums },
        { key: 'chords', label: 'Chords', color: PREVIEW_TRACK_COLORS.chords },
        { key: 'melody', label: 'Melody', color: PREVIEW_TRACK_COLORS.melody },
        { key: 'bass', label: 'Bass', color: PREVIEW_TRACK_COLORS.bass }
    ];

    return (
        <div style={{
            height: '60px', minHeight: '60px',
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 8px',
            borderBottom: `1px solid ${borderColor}`,
            background: isDark ? 'rgba(15,15,22,0.95)' : '#f0f0f4',
            overflowX: 'auto', overflowY: 'hidden'
        }}>
            {cards.map(card => {
                const isSelected = selectedCard === card.key;
                return (
                    <div
                        key={card.key}
                        onClick={() => setSelectedCard(card.key)}
                        onMouseDown={(e) => handleCardMouseDown(e, card.key)}
                        style={{
                            width: '120px', minWidth: '120px', height: '50px',
                            border: `2px solid ${isSelected ? card.color : (isDark ? '#333' : '#ccc')}`,
                            borderRadius: '6px',
                            background: isSelected
                                ? (isDark ? `${card.color}15` : `${card.color}10`)
                                : (isDark ? 'rgba(20,20,30,0.8)' : '#fff'),
                            cursor: 'grab',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'border-color 0.15s, background 0.15s',
                            userSelect: 'none'
                        }}
                    >
                        {/* Label */}
                        <div style={{
                            position: 'absolute', top: '2px', left: '4px',
                            fontSize: '8px', fontWeight: '700', color: card.color,
                            letterSpacing: '0.3px', zIndex: 2,
                            textShadow: isDark ? '0 0 4px rgba(0,0,0,0.8)' : 'none'
                        }}>
                            {card.label}
                        </div>
                        {/* Preview */}
                        <div style={{ position: 'absolute', top: '14px', left: 0, right: 0, bottom: 0 }}>
                            {card.key === 'drums' && renderDrumPreview(previewDrumPattern, drumSubPattern)}
                            {card.key === 'chords' && renderMelodicPreview(previewChordPattern, card.color)}
                            {card.key === 'melody' && renderMelodicPreview(previewMelodyPattern, card.color)}
                            {card.key === 'bass' && renderMelodicPreview(previewBassPattern, card.color)}
                        </div>
                    </div>
                );
            })}
            {/* Drag hint */}
            <span style={{ fontSize: '8px', color: isDark ? '#555' : '#999', fontWeight: '600', whiteSpace: 'nowrap', marginLeft: '4px' }}>
                Drag to timeline
            </span>
        </div>
    );
}

// ─── Live Recording Waveform ───
// Renders a growing waveform that builds up from left to right as recording progresses.
// Shows the full recording so far, not just a scrolling window of recent samples.
function RecordingWaveform({ recorderRef, width, height, color, isDark, tempo, pixelsPerBar }) {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const animRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !recorderRef?.current) return;
        const h = Math.max(1, Math.floor(height));

        const DRAW_INTERVAL_MS = 67; // ~15fps — reduces GC pressure from getAllRecordedSamples
        let lastDrawTime = 0;

        const draw = () => {
            const recorder = recorderRef.current;
            if (!recorder || (!recorder.isRecording() && !recorder.isCountingIn())) {
                cancelAnimationFrame(animRef.current);
                return;
            }

            // Throttle to ~15fps — waveform doesn't need 60fps
            const now = performance.now();
            if (now - lastDrawTime < DRAW_INTERVAL_MS) {
                animRef.current = requestAnimationFrame(draw);
                return;
            }
            lastDrawTime = now;

            // Dynamically size canvas to accommodate growing recording
            // Use authoritative sample count — no getAllRecordedSamples() call needed
            const sampleRate = recorder.sampleRate || 44100;
            const totalSamples = recorder._totalRecordedSamples || recorder._mergedLength || 0;
            const durationSecs = totalSamples / sampleRate;
            const secondsPerBar = tempo > 0 ? (4 * 60 / tempo) : 2;
            const recordedBars = durationSecs / secondsPerBar;
            const effectivePpb = pixelsPerBar || (width / Math.max(1, recordedBars));
            // No cap — recording waveform extends past section boundaries with overflow:visible
            const recordedWidth = Math.ceil(recordedBars * effectivePpb);
            const w = Math.max(Math.max(1, Math.floor(width)), recordedWidth + 20);

            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, w, h);

            if (totalSamples === 0) {
                animRef.current = requestAnimationFrame(draw);
                return;
            }

            // Background tint for recorded region
            ctx.fillStyle = isDark ? 'rgba(255,68,68,0.06)' : 'rgba(255,68,68,0.05)';
            ctx.fillRect(0, 0, recordedWidth, h);

            // Draw waveform using pre-computed peaks (incremental, O(peaks.length) not O(samples))
            // _peaks is computed in AudioRecorder._appendToMergedBuffer() — one peak per 256 samples
            const peaks = recorder._peaks;
            if (peaks && peaks.length > 0) {
                const peaksPerPixel = Math.max(1, peaks.length / Math.max(1, recordedWidth));
                ctx.beginPath();
                ctx.strokeStyle = color || '#ff4444';
                ctx.lineWidth = 1;
                const midY = h / 2;
                for (let px = 0; px < recordedWidth; px++) {
                    const peakStart = Math.floor(px * peaksPerPixel);
                    const peakEnd = Math.min(Math.ceil((px + 1) * peaksPerPixel), peaks.length);
                    let maxAbs = 0;
                    for (let i = peakStart; i < peakEnd; i++) {
                        if (peaks[i] > maxAbs) maxAbs = peaks[i];
                    }
                    const barH = maxAbs * (h * 0.9);
                    ctx.moveTo(px, midY - barH / 2);
                    ctx.lineTo(px, midY + barH / 2);
                }
                ctx.stroke();
            }

            // Red playhead cursor at recording position
            if (recordedWidth > 0 && recordedWidth < w) {
                ctx.strokeStyle = '#ff2222';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(recordedWidth, 0);
                ctx.lineTo(recordedWidth, h);
                ctx.stroke();
            }

            // Recording label
            ctx.fillStyle = '#ff4444';
            ctx.globalAlpha = 0.8;
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`● ${t('arrange.rec')}`, 3, 10);
            ctx.globalAlpha = 1;

            animRef.current = requestAnimationFrame(draw);
        };

        animRef.current = requestAnimationFrame(draw);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, [recorderRef, width, height, color, isDark, tempo, pixelsPerBar, t]);

    return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }} />;
}

// Render a mini clip pattern onto a canvas
function ClipCanvas({ data, type, drumId, bars, color, width, height, isDark }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.max(1, Math.floor(width));
        canvas.height = Math.max(1, Math.floor(height));
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (!data) return;
        const totalSteps = bars * 32;

        if (type === 'drum' && drumId) {
            // Single drum lane from the drum pattern object
            const drum = data?.[drumId];
            if (!drum?.lanes) return;
            Object.values(drum.lanes).forEach(l => {
                if (!l.pattern) return;
                l.pattern.forEach((active, step) => {
                    if (active && step < totalSteps) {
                        const x = (step / totalSteps) * w;
                        ctx.fillStyle = color;
                        ctx.globalAlpha = (l.velocity?.[step] || 100) / 127;
                        ctx.fillRect(x, 0, Math.max(1, w / totalSteps * 0.8), h * 0.8);
                    }
                });
            });
            ctx.globalAlpha = 1;
        } else if (Array.isArray(data) && data.length > 0) {
            // Note array for chords/melody/bass
            const minNote = Math.min(...data.map(n => n.note));
            const maxNote = Math.max(...data.map(n => n.note));
            const noteRange = Math.max(maxNote - minNote, 1);

            data.forEach(note => {
                if (note.time >= totalSteps) return;
                const x = (note.time / totalSteps) * w;
                const noteW = Math.max(1, (note.duration / totalSteps) * w);
                const y = h - ((note.note - minNote) / noteRange) * h * 0.75 - h * 0.1;
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.5 + note.velocity * 0.5;
                ctx.fillRect(x, y, noteW, Math.max(1, h * 0.12));
            });
            ctx.globalAlpha = 1;
        }
    }, [data, type, drumId, bars, color, width, height, isDark]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
}

// Small rotary knob for per-track volume/pan control.
// Drag vertically to adjust value; double-click to reset.
function MiniKnob({ value = 0, min = 0, max = 1, size = 24, color = '#fff', onChange, isDark, label = '', defaultVal, showValue = false }) {
    const startY = React.useRef(0);
    const startVal = React.useRef(0);
    const range = max - min;
    const normalized = Math.max(0, Math.min(1, (value - min) / range));
    const angle = normalized * 270 - 135; // needle angle: -135° to +135°
    const isPan = min < 0;

    // SVG arc helpers
    const r = (size - 4) / 2;
    const cx = size / 2, cy = size / 2;
    const toRad = (deg) => (deg - 90) * Math.PI / 180;
    const pXY = (deg) => ({ x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) });
    const arcPath = (s, e) => {
        if (Math.abs(e - s) < 0.5) return '';
        const p1 = pXY(e), p2 = pXY(s);
        return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${Math.abs(e - s) > 180 ? '1' : '0'} 0 ${p2.x} ${p2.y}`;
    };

    // Arc fill: volume fills from start; pan fills from center
    let fillStart, fillEnd;
    if (isPan) {
        if (value >= 0) { fillStart = 0; fillEnd = angle; }
        else { fillStart = angle; fillEnd = 0; }
    } else {
        fillStart = -135; fillEnd = angle;
    }

    // Tooltip text
    let displayText;
    if (isPan) {
        const pct = Math.round(value * 100);
        displayText = pct === 0 ? 'C' : (pct < 0 ? `L${-pct}` : `R${pct}`);
    } else {
        displayText = `${Math.round(normalized * 100)}%`;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            <div
                onMouseDown={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    startY.current = e.clientY; startVal.current = value;
                    const handleMove = (ev) => {
                        const dy = startY.current - ev.clientY;
                        onChange?.(Math.min(max, Math.max(min, startVal.current + dy * (range / 80))));
                    };
                    const handleUp = () => {
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                    };
                    document.addEventListener('mousemove', handleMove);
                    document.addEventListener('mouseup', handleUp);
                }}
                onDoubleClick={(e) => { e.stopPropagation(); onChange?.(defaultVal != null ? defaultVal : (isPan ? 0 : 0.3)); }}
                title={`${label}: ${displayText}`}
                style={{ width: size, height: size, position: 'relative', cursor: 'ns-resize', flexShrink: 0 }}
            >
                <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
                    {/* Background arc track */}
                    <path d={arcPath(-135, 135)} fill="none"
                        stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                        strokeWidth={3} strokeLinecap="round" />
                    {/* Filled arc — gradient color */}
                    {Math.abs(fillEnd - fillStart) > 0.5 && (
                        <path d={arcPath(fillStart, fillEnd)} fill="none"
                            stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
                    )}
                    {/* Center dot */}
                    <circle cx={cx} cy={cy} r={1.5} fill={isDark ? '#555' : '#999'} />
                </svg>
                {/* Needle */}
                <div style={{
                    position: 'absolute', width: 2, height: r - 2,
                    background: isDark ? '#ddd' : '#333',
                    left: cx - 1, bottom: cy,
                    transformOrigin: 'bottom center',
                    transform: `rotate(${angle}deg)`,
                    borderRadius: '1px', opacity: 0.8
                }} />
            </div>
            {showValue && (
                <span style={{
                    fontSize: '8px', color: isDark ? '#888' : '#777',
                    lineHeight: 1, marginTop: 1, whiteSpace: 'nowrap',
                    fontWeight: '600', fontFamily: 'monospace'
                }}>{displayText}</span>
            )}
        </div>
    );
}

export default function ArrangementTimeline({
    arrangement,
    activeSection,
    onSelectSection,
    onAddSection,
    onRemoveSection,
    onDuplicateSection,
    onReorderSections,
    onUpdateSection,
    onGenerateSection,
    onGenerateSelected,
    onGenerateAll,
    onGenerateAllMixed,
    onDropAudio,
    audioTracks = [],
    onAddAudioTrack,
    onRemoveAudioTrack,
    onRenameAudioTrack,
    onAddClip,
    onUpdateClip,
    onRemoveClip,
    loopSectionIds = new Set(),
    onToggleSectionLoop,
    onClearSectionLoop,
    stopMarkerBar = null,
    onSetStopMarkerAtBar,
    onToggleStopMarker,
    onClearStopMarker,
    globalMutes = new Set(),
    setGlobalMutes,
    globalSolos = new Set(),
    updateGlobalSolo,
    globalIsPlaying,
    globalCurrentStep,
    globalAbsoluteStep = 0,
    globalTempo,
    globalKey,
    globalScale,
    globalResolution,
    isDark,
    isMaximized,
    onToggleMaximize,
    onUndoArrangement,
    onRedoArrangement,
    canUndoArrangement,
    canRedoArrangement,
    sampler,
    masterVolume,
    setMasterVolume,
    // Recording props
    isRecording = false,
    isCountingIn = false,
    countInBeat = null,
    recordingElapsed = 0,
    onStartRecording,
    onStopRecording,
    recorderRef = null,
    recordingTrackId = null,
    recordingStartSection = null,
    onLoadSlicedInstrument = null,
    midiTracks = [],
    onAddMidiTrack,
    onRemoveMidiTrack,
    onRenameMidiTrack,
    onUpdateMidiTrackInstrument,
    onFocusMidiClip,
    onReorderMidiTrack,
    onReorderAudioTrack,
    trackOrder,
    onReorderTrack,
    onMoveTrackToIndex,
    onBounceMidiTrack, onBounceToGenerators, selectedFolder, accentColors,
    onUndoAudio,
    onRedoAudio,
    vst3Plugins = [],
    vst3TrackPlugins = {},
    onLoadVST3OnTrack,
    onRemoveVST3FromTrack,
    onOpenVST3Editor,
    vst3EditorOpenTracks,
    effectsManager,
    onEffectsChanged,
    effectsVersion,
    onSelectRow,
    onSelectEffectTrackId,
    onUpdateMidiTrackPattern,
    onAddMidiClip,
    onUpdateMidiClip,
    onRemoveMidiClip,
    onMoveMidiClip,
    editingMidiClipId,
    onSetEditingMidiTrack,
    onSetEditingMidiClipId,
    drumClips = [],
    onAddDrumClip,
    onUpdateDrumClip,
    onRemoveDrumClip,
    onMoveDrumClip,
    editingDrumClipId,
    onSetEditingDrumClipId,
    drumLaneClips = {},
    onAddDrumLaneClip,
    onUpdateDrumLaneClip,
    onRemoveDrumLaneClip,
    onMoveDrumLaneClip,
    chordClips = [],
    onAddChordClip,
    onUpdateChordClip,
    onRemoveChordClip,
    onMoveChordClip,
    editingChordClipId,
    onSetEditingChordClipId,
    melodyClips = [],
    onAddMelodyClip,
    onUpdateMelodyClip,
    onRemoveMelodyClip,
    onMoveMelodyClip,
    editingMelodyClipId,
    onSetEditingMelodyClipId,
    bassClips = [],
    onAddBassClip,
    onUpdateBassClip,
    onRemoveBassClip,
    onMoveBassClip,
    editingBassClipId,
    onSetEditingBassClipId,
    followPlayhead,
    trackAutomation = {},
    onSetTrackAutomation,
    setGlobalBars,
    globalBars: globalBarsFromParent,
    setGlobalResolution,
    globalRepeat,
    setGlobalRepeat,
    globalBarsOptions = [4, 8, 16, 32, 64],
    recordingStartBar = 0,
    audioInsertionBar: audioInsertionBarProp = null,
    onSetAudioInsertionBar,
    audioLoopRange = null,
    onSetAudioLoopRange,
    timelineBars = 48,
    setTimelineBars,
    previewDrumPattern,
    previewChordPattern,
    previewMelodyPattern,
    previewBassPattern,
    onAddDrumClipFromPreview,
    onAddChordClipFromPreview,
    onAddMelodyClipFromPreview,
    onAddBassClipFromPreview,
    loopRange = null,
    onSetLoopRange,
    loopActive = false,
    onSetLoopActive}) {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const [zoom, setZoom] = useState(DEFAULT_PX_PER_BAR);
    const [showMixer, setShowMixer] = useState(false);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [detailPanelHeight, setDetailPanelHeight] = useState(200);
    const [detailPanelMaximized, setDetailPanelMaximized] = useState(false);
    const detailPanelPrevHeight = useRef(200); // remember height before maximize

    const [contextMenu, setContextMenu] = useState(null);
    const [rowContextMenu, setRowContextMenu] = useState(null);
    const [drumsExpanded, setDrumsExpanded] = useState(true);
    const [collapsedTracks, setCollapsedTracks] = useState(new Set());
    const [scrollLeft, setScrollLeft] = useState(0);
    const [selectedRow, setSelectedRow] = useState(null); // track row id
    const [selectedRows, setSelectedRows] = useState(new Set()); // Shift+click multi-select track row ids
    const [selectedCells, setSelectedCells] = useState([]); // [{rowId, sectionId}] for multi-select
    const [clipboard, setClipboard] = useState(null); // { items: [{rowId, data, type, drumId, trackKey}], sectionId }
    const [sectionClipboard, setSectionClipboard] = useState(null); // Full section snapshot for Ctrl+C/V on whole sections
    const [audioClipClipboard, setAudioClipClipboard] = useState(null); // { trackId, clip } for audio clip copy/paste
    const [focusedClip, setFocusedClip] = useState(null); // { row, section } for zoomed piano roll view
    const [focusedAudioClip, setFocusedAudioClip] = useState(null); // { clip, trackId, trackName, sectionName } for waveform editor
    const [selectedAudioClipId, setSelectedAudioClipId] = useState(null); // selected individual audio clip id
    const [selectedAudioClipTrackId, setSelectedAudioClipTrackId] = useState(null);
    const audioInsertionBar = audioInsertionBarProp; // lifted to parent; use onSetAudioInsertionBar to update
    const [selectedAudioClipIds, setSelectedAudioClipIds] = useState(new Set()); // multi-select support
    const [selectedMidiClipId, setSelectedMidiClipId] = useState(null); // selected MIDI clip id
    const [selectedMidiClipTrackId, setSelectedMidiClipTrackId] = useState(null);
    const [selectedDrumClipId, setSelectedDrumClipId] = useState(null); // selected drum clip id
    const [selectedNoteClipId, setSelectedNoteClipId] = useState(null); // selected note clip id (chords/melody/bass)
    const [selectedNoteClipTrackKey, setSelectedNoteClipTrackKey] = useState(null); // 'chords'/'melody'/'bass'
    const [selectedDrumLaneClipDrumId, setSelectedDrumLaneClipDrumId] = useState(null); // drumId for selected drum lane clip
    const [midiClipCreation, setMidiClipCreation] = useState(null); // { trackId, startBar, currentBar, rowColor }

    const [resizing, setResizing] = useState(null); // { sectionId, startX, startBars }
    const [renamingSection, setRenamingSection] = useState(null); // sectionId being renamed
    const [renamingAudioTrack, setRenamingAudioTrack] = useState(null); // audio trackId being renamed
    const [renameValue, setRenameValue] = useState('');
    const clipClickedRef = useRef(false); // flag to prevent parent clicks from clearing clip selection
    const scrollContainerRef = useRef(null);
    const headerScrollRef = useRef(null);
    const labelScrollRef = useRef(null);
    const arrangementMixerRef = useRef(null);
    const arrangementContainerRef = useRef(null);
    const pendingCloneSelect = useRef(null); // rowIds to highlight after a new section is created by clone
    const addCooldownRef = useRef(false); // synchronous guard for rapid clicks
    const [addCooldown, setAddCooldown] = useState(false); // visual disabled state for +SECTION/+VOCAL/+AUDIO/+MIDI
    const genCooldownRef = useRef(false); // guard for GEN SECTION/GEN ALL/GEN ALL MIXED
    const mixCooldownRef = useRef(false); // guard for MIX toggle
    const [isArrangementFullscreen, setIsArrangementFullscreen] = useState(false);

    // Re-enable add buttons once the section/track is actually created
    useEffect(() => {
        if (addCooldown) {
            addCooldownRef.current = false;
            setAddCooldown(false);
        }
    }, [arrangement.length, audioTracks.length, midiTracks.length]);

    // Audio clip context menu & stem separation state
    const [audioClipContextMenu, setAudioClipContextMenu] = useState(null); // { x, y, clip, trackId, sectionId, clipColor }
    const [gridContextMenu, setGridContextMenu] = useState(null); // { x, y }
    const [timelineGridRes, setTimelineGridRes] = useState('1bar'); // grid resolution for timeline
    const [stemSepModal, setStemSepModal] = useState(null); // { mode: 'audio'|'midi', clip, trackId, sectionId }
    const [stemProcessing, setStemProcessing] = useState(false);
    const [stemProgress, setStemProgress] = useState(0);
    const [hoveredAudioClipId, setHoveredAudioClipId] = useState(null);
    const [draggingClipBetweenTracks, setDraggingClipBetweenTracks] = useState(null); // { clip, sourceTrackId, sourceRowId }
    const [clipDropGhost, setClipDropGhost] = useState(null); // { targetRowId, bar, width } for ghost preview
    const [draggingFadeHandle, setDraggingFadeHandle] = useState(null); // 'fadeIn' | 'fadeOut' | 'fadeInCurve' | 'fadeOutCurve' | null

    // Automation lane state
    const [automationVisibleTracks, setAutomationVisibleTracks] = useState(new Set()); // trackIds with visible automation lane
    const [automationSelectedParam, setAutomationSelectedParam] = useState({}); // { [trackId]: paramKey }
    const [draggingAutomationPoint, setDraggingAutomationPoint] = useState(null); // { trackId, paramKey, pointIndex, startX, startY }

    // Drag reorder state for MIDI/audio track rows
    const [dragReorderRow, setDragReorderRow] = useState(null); // { rowId, type, trackId }
    const [dragReorderTarget, setDragReorderTarget] = useState(null); // rowId being hovered

    // VST3 plugin picker dropdown
    const [vst3PickerRow, setVst3PickerRow] = useState(null); // { rowId, trackId, rowType, x, y }
    const [trackTooltip, setTrackTooltip] = useState(null); // { text, x, y } — instant hover tooltip
    const vst3PickerRef = useRef(null);

    // Per-track volume/pan state and VU meter element refs
    const [trackMixState, setTrackMixState] = useState({});
    const meterElsRef = useRef(new Map());
    const labelElsRef = useRef(new Map());  // label DOM refs for note-hit flash
    const labelColorMapRef = useRef(new Map()); // meterId → row.color for flash
    const lastHitTimeRef = useRef(new Map()); // meterId → timestamp of last note hit
    const lastStepRef = useRef(-1); // track step changes for edge detection

    // Get available container height for detail panel maximization
    const getMaxDetailHeight = useCallback(() => {
        const container = arrangementContainerRef.current;
        if (!container) return 600;
        // Leave ~80px for toolbar + toggle bars
        return Math.max(200, container.clientHeight - 80);
    }, []);

    // Detail panel divider resize handler (drag to resize, double-click to maximize/restore)
    const handleDetailDividerMouseDown = useCallback((e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startH = detailPanelHeight;
        const maxH = getMaxDetailHeight();
        const onMove = (ev) => {
            const newH = Math.max(120, Math.min(maxH, startH + (startY - ev.clientY)));
            setDetailPanelHeight(newH);
            setDetailPanelMaximized(false);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'ns-resize';
    }, [detailPanelHeight, getMaxDetailHeight]);

    // Double-click divider to maximize/restore detail panel
    const handleDetailDividerDoubleClick = useCallback(() => {
        if (detailPanelMaximized) {
            // Restore to previous height
            setDetailPanelHeight(detailPanelPrevHeight.current);
            setDetailPanelMaximized(false);
        } else {
            // Save current height and maximize
            detailPanelPrevHeight.current = detailPanelHeight;
            setDetailPanelHeight(getMaxDetailHeight());
            setDetailPanelMaximized(true);
        }
    }, [detailPanelMaximized, detailPanelHeight, getMaxDetailHeight]);

    // Dedicated Escape handler for closing section mixer — capture phase ensures it runs first
    const focusedClipRef = useRef(null);
    const focusedAudioClipRef = useRef(null);
    useEffect(() => { focusedClipRef.current = focusedClip; }, [focusedClip]);
    useEffect(() => { focusedAudioClipRef.current = focusedAudioClip; }, [focusedAudioClip]);
    useEffect(() => {
        if (!showMixer) return;
        const handleEscMixer = (e) => {
            if (e.key !== 'Escape') return;
            if (focusedClipRef.current || focusedAudioClipRef.current) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            setShowMixer(false);
        };
        window.addEventListener('keydown', handleEscMixer, true);
        return () => window.removeEventListener('keydown', handleEscMixer, true);
    }, [showMixer]);

    // Close VST3 picker on outside click
    useEffect(() => {
        if (!vst3PickerRow) return;
        const close = (e) => {
            if (vst3PickerRef.current && !vst3PickerRef.current.contains(e.target)) setVst3PickerRow(null);
        };
        window.addEventListener('mousedown', close);
        return () => window.removeEventListener('mousedown', close);
    }, [vst3PickerRow]);

    // Track fullscreen changes for the arrangement container
    useEffect(() => {
        const handleFsChange = () => {
            setIsArrangementFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const toggleArrangementFullscreen = useCallback(() => {
        if (!document.fullscreenElement && arrangementContainerRef.current) {
            arrangementContainerRef.current.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }, []);

    // Initialize track mix values from sampler's current gain/pan
    useEffect(() => {
        if (!sampler) return;
        const initial = {};
        ['drums', 'chords', 'melody', 'bass'].forEach(id => {
            const bus = sampler.getTrackBus(id);
            if (bus) {
                initial[id] = { volume: bus.gainNode.gain.value, pan: bus.pannerNode.pan.value };
            }
        });
        midiTracks.forEach(mt => {
            const bus = sampler.getTrackBus(mt.id);
            if (bus) initial[mt.id] = { volume: bus.gainNode.gain.value, pan: bus.pannerNode.pan.value };
        });
        audioTracks.forEach(at => {
            const bus = sampler.getTrackBus(at.id);
            if (bus) initial[at.id] = { volume: bus.gainNode.gain.value, pan: bus.pannerNode.pan.value };
        });
        setTrackMixState(prev => ({ ...prev, ...initial }));
    }, [sampler, midiTracks.length, audioTracks.length]);

    // VU meter + note-hit flash animation loop
    // Store changing values in refs so the rAF loop reads them without re-creating
    const arrangementRef = useRef(arrangement);
    arrangementRef.current = arrangement;
    const activeSectionRef = useRef(activeSection);
    activeSectionRef.current = activeSection;
    const globalCurrentStepRef = useRef(globalCurrentStep);
    globalCurrentStepRef.current = globalCurrentStep;
    const globalIsPlayingRef2 = useRef(globalIsPlaying);
    globalIsPlayingRef2.current = globalIsPlaying;

    useEffect(() => {
        if (!sampler) return;
        let raf;
        let frameCount = 0;
        const FLASH_DURATION = 120; // ms — how long each flash pulse lasts

        const tick = () => {
            frameCount++;
            const now = performance.now();

            // --- VU Meter updates (throttled to ~15 fps) ---
            // Reading analyser FFT data is expensive on the main thread;
            // skipping 3 out of 4 frames cuts CPU load by 75 % while
            // keeping the meters visually smooth.
            if (frameCount % 4 === 0) {
                meterElsRef.current.forEach((el, id) => {
                    if (el) {
                        const level = sampler.getTrackLevel(id) || 0;
                        const pct = Math.min(100, level * 250);
                        el.style.height = `${pct}%`;
                    }
                });
            }

            // --- Note-hit flash on labels ---
            const isPlaying = globalIsPlayingRef2.current;
            const arr2 = arrangementRef.current;
            const curStep = globalCurrentStepRef.current;

            if (isPlaying && arr2.length > 0) {
                const activeSec = arr2.find(s => s.id === activeSectionRef.current);
                if (activeSec) {
                    const sectionSteps = activeSec.bars * 32;
                    const step = curStep % sectionSteps;
                    const prevStep = lastStepRef.current;
                    const stepChanged = step !== prevStep;
                    lastStepRef.current = step;

                    // Only check for new drum hits when step changes
                    if (stepChanged) {
                        labelElsRef.current.forEach((el, mid) => {
                            if (!el) return;
                            // Drums: pulse on hit
                            if (mid.startsWith('drum_')) {
                                const drumId = mid.slice(5);
                                const drumData = activeSec.patterns?.drums?.[drumId];
                                let isHit = false;
                                if (drumData?.lanes) {
                                    for (const laneId of Object.keys(drumData.lanes)) {
                                        if (drumData.lanes[laneId].pattern?.[step]) { isHit = true; break; }
                                    }
                                }
                                if (isHit) lastHitTimeRef.current.set(mid, now);
                            } else if (mid === 'drums') {
                                const allDrums = activeSec.patterns?.drums;
                                let isHit = false;
                                if (allDrums) {
                                    outer: for (const did of Object.keys(allDrums)) {
                                        if (allDrums[did]?.lanes) {
                                            for (const lid of Object.keys(allDrums[did].lanes)) {
                                                if (allDrums[did].lanes[lid].pattern?.[step]) { isHit = true; break outer; }
                                            }
                                        }
                                    }
                                }
                                if (isHit) lastHitTimeRef.current.set(mid, now);
                            }
                        });
                    }

                    // Update flash visuals
                    labelElsRef.current.forEach((el, mid) => {
                        if (!el) return;
                        const color = labelColorMapRef.current.get(mid) || '#fff';
                        const isDrum = mid.startsWith('drum_') || mid === 'drums';

                        if (isDrum) {
                            // Drums: quick 120ms pulse fade
                            const hitTime = lastHitTimeRef.current.get(mid) || 0;
                            const elapsed = now - hitTime;
                            if (elapsed < FLASH_DURATION) {
                                const fade = 1 - (elapsed / FLASH_DURATION);
                                const alpha = Math.round(fade * 60).toString(16).padStart(2, '0');
                                el.style.background = color + alpha;
                            } else if (el.style.background) {
                                el.style.background = '';
                            }
                        } else {
                            // Melodic: stay lit for full note duration
                            const notes = activeSec.patterns?.[mid];
                            let isActive = false;
                            if (Array.isArray(notes)) {
                                isActive = notes.some(n => step >= n.time && step < n.time + (n.duration || 1));
                            }
                            if (isActive) {
                                el.style.background = color + '3c'; // ~0.24 opacity
                            } else if (el.style.background) {
                                el.style.background = '';
                            }
                        }
                    });
                }
            } else {
                // Clear all flashes when not playing
                labelElsRef.current.forEach((el) => {
                    if (el && el.style.background) el.style.background = '';
                });
                lastStepRef.current = -1;
            }

            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [sampler]);

    const totalBars = timelineBars;
    const pixelsPerBar = zoom;
    const totalWidth = totalBars * pixelsPerBar;

    // Toggle collapse for a track row
    const toggleCollapse = useCallback((trackId) => {
        if (trackId === 'drums') {
            setDrumsExpanded(prev => !prev);
        }
        setCollapsedTracks(prev => {
            const next = new Set(prev);
            if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
            return next;
        });
    }, []);

    // Build track rows from unified trackOrder (or default)
    const trackRows = useMemo(() => {
        const order = trackOrder || buildDefaultTrackOrder(midiTracks, audioTracks);
        const rows = [];
        const midiMap = new Map(midiTracks.map(mt => [mt.id, mt]));
        const audioMap = new Map(audioTracks.map(at => [at.id, at]));

        for (const entry of order) {
            if (entry.type === 'core' && entry.id === 'drums') {
                const drumsCol = collapsedTracks.has('drums');
                const drumsH = drumsCol ? ROW_HEIGHT_COLLAPSED : ROW_HEIGHT;
                rows.push({
                    id: 'drums-all', label: t('arrange.drums'), group: 'DRUMS', type: 'drums-all',
                    color: ac, height: drumsH, effectTrackId: 'drums',
                    vst3Plugin: vst3TrackPlugins['drums'] || null,
                    collapsible: true, collapseId: 'drums', isCollapsed: drumsCol,
                    orderEntry: entry
                });
                if (drumsExpanded && !drumsCol) {
                    DRUM_ELEMENTS.forEach(drum => {
                        rows.push({
                            id: `drum-${drum.id}`, label: drum.i18nKey ? t(drum.i18nKey) : drum.name, group: 'DRUMS', type: 'drum',
                            drumId: drum.id, color: drum.color, height: DRUM_ROW_HEIGHT,
                            effectTrackId: `drum_${drum.id}`, vst3Plugin: vst3TrackPlugins['drums'] || null
                        });
                    });
                }
            } else if (entry.type === 'core') {
                const mt = MELODIC_TRACKS.find(m => m.id === entry.id);
                if (!mt) continue;
                const col = collapsedTracks.has(mt.id);
                rows.push({
                    id: mt.id, label: mt.i18nKey ? t(mt.i18nKey) : mt.label, group: mt.id.toUpperCase(), type: 'melodic',
                    trackKey: mt.trackKey, color: mt.color,
                    height: col ? ROW_HEIGHT_COLLAPSED : ROW_HEIGHT,
                    effectTrackId: mt.trackKey, vst3Plugin: vst3TrackPlugins[mt.trackKey] || null,
                    collapsible: true, collapseId: mt.id, isCollapsed: col,
                    orderEntry: entry
                });
            } else if (entry.type === 'midi') {
                const mt = midiMap.get(entry.id);
                if (!mt) continue;
                const col = collapsedTracks.has(mt.id);
                rows.push({
                    id: `midi-${mt.id}`, label: mt.name, group: 'MIDI', type: 'midi',
                    trackId: mt.id, trackKey: mt.id, color: mt.color,
                    height: col ? ROW_HEIGHT_COLLAPSED : ROW_HEIGHT,
                    effectTrackId: mt.id,
                    vst3Instrument: mt.vst3Instrument || null,
                    vst3Plugin: vst3TrackPlugins[mt.id] || null,
                    collapsible: true, collapseId: mt.id, isCollapsed: col,
                    orderEntry: entry
                });
            } else if (entry.type === 'audio') {
                const at = audioMap.get(entry.id);
                if (!at) continue;
                const col = collapsedTracks.has(at.id);
                rows.push({
                    id: `audio-${at.id}`, label: at.name, group: 'AUDIO', type: 'audio',
                    trackId: at.id, color: at.color,
                    isVocal: at.trackType === 'vocal',
                    height: col ? ROW_HEIGHT_COLLAPSED : ROW_HEIGHT,
                    effectTrackId: at.id, vst3Plugin: vst3TrackPlugins[at.id] || null,
                    collapsible: true, collapseId: at.id, isCollapsed: col,
                    orderEntry: entry
                });
            }
        }
        // Zoom the selected row for detail editing
        if (selectedRow) {
            for (let i = 0; i < rows.length; i++) {
                if (rows[i].id === selectedRow) {
                    rows[i] = { ...rows[i], height: ROW_HEIGHT_ZOOMED, isZoomed: true, isCollapsed: false };
                    break;
                }
            }
        }
        return rows;
    }, [drumsExpanded, collapsedTracks, audioTracks, midiTracks, vst3TrackPlugins, selectedRow, trackOrder, ac, t]);

    // Auto-scroll to center the selected (zoomed) row
    useEffect(() => {
        if (!selectedRow || !scrollContainerRef.current) return;
        let y = 0;
        let selH = ROW_HEIGHT;
        for (const row of trackRows) {
            if (row.id === selectedRow) { selH = row.height; break; }
            y += row.height;
        }
        const container = scrollContainerRef.current;
        const viewH = container.clientHeight;
        const target = y - (viewH / 2) + (selH / 2);
        const scrollTarget = Math.max(0, target);
        container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        // Label column syncs automatically via handleScroll
    }, [selectedRow, trackRows]);

    // Notify parent of selected row changes (for Browser's add-effect-to-track)
    useEffect(() => {
        if (onSelectRow) onSelectRow(selectedRow);
        if (onSelectEffectTrackId) {
            const row = trackRows.find(r => r.id === selectedRow);
            onSelectEffectTrackId(row?.effectTrackId || selectedRow);
        }
    }, [selectedRow, onSelectRow, onSelectEffectTrackId, trackRows]);

    // Auto-select and scroll to the recording track when recording starts or comp creates a new take
    useEffect(() => {
        if (isRecording && recordingTrackId) {
            // Find the row for the recording track
            const recRow = trackRows.find(r => r.type === 'audio' && r.trackId === recordingTrackId);
            if (recRow) {
                if (selectedRow !== recRow.id) setSelectedRow(recRow.id);
                // Scroll to bottom after a frame to ensure the new track is rendered
                requestAnimationFrame(() => {
                    const container = scrollContainerRef.current;
                    if (container) {
                        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                        if (labelScrollRef.current) {
                            labelScrollRef.current.scrollTop = container.scrollHeight;
                        }
                    }
                });
            } else {
                // Track not in trackRows yet — wait for next render via rAF
                requestAnimationFrame(() => {
                    const row = trackRows.find(r => r.type === 'audio' && r.trackId === recordingTrackId);
                    if (row) setSelectedRow(row.id);
                    const container = scrollContainerRef.current;
                    if (container) {
                        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                        if (labelScrollRef.current) {
                            labelScrollRef.current.scrollTop = container.scrollHeight;
                        }
                    }
                });
            }
        }
    }, [isRecording, recordingTrackId, trackRows]); // eslint-disable-line react-hooks/exhaustive-deps

    // Delete key: remove selected MIDI/audio track (capture phase to fire before inline editors)
    useEffect(() => {
        const handleDeleteTrack = (e) => {
            if (e.key !== 'Delete' && e.key !== 'Backspace') return;
            if (!selectedRow) return;
            // Don't intercept if user is typing in an input
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            const midiRow = trackRows.find(r => r.id === selectedRow && r.type === 'midi');
            const audioRow = trackRows.find(r => r.id === selectedRow && r.type === 'audio');
            if (midiRow && midiRow.trackId && onRemoveMidiTrack) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (window.confirm(`Delete "${midiRow.label}"?`)) {
                    const savedTop = scrollContainerRef.current?.scrollTop;
                    const delIdx = trackRows.findIndex(r => r.id === selectedRow);
                    onRemoveMidiTrack(midiRow.trackId);
                    const nextRow = delIdx >= 0 && delIdx + 1 < trackRows.length ? trackRows[delIdx + 1]
                        : delIdx - 1 >= 0 ? trackRows[delIdx - 1] : null;
                    setSelectedRow(nextRow ? nextRow.id : null);
                    if (savedTop != null && scrollContainerRef.current) {
                        requestAnimationFrame(() => {
                            scrollContainerRef.current.scrollTop = savedTop;
                            if (labelScrollRef.current) labelScrollRef.current.scrollTop = savedTop;
                        });
                    }
                }
                return;
            }
            if (audioRow && audioRow.trackId && onRemoveAudioTrack) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (window.confirm(`Delete "${audioRow.label}"?`)) {
                    const savedTop = scrollContainerRef.current?.scrollTop;
                    const delIdx = trackRows.findIndex(r => r.id === selectedRow);
                    onRemoveAudioTrack(audioRow.trackId);
                    const nextRow = delIdx >= 0 && delIdx + 1 < trackRows.length ? trackRows[delIdx + 1]
                        : delIdx - 1 >= 0 ? trackRows[delIdx - 1] : null;
                    setSelectedRow(nextRow ? nextRow.id : null);
                    if (savedTop != null && scrollContainerRef.current) {
                        requestAnimationFrame(() => {
                            scrollContainerRef.current.scrollTop = savedTop;
                            if (labelScrollRef.current) labelScrollRef.current.scrollTop = savedTop;
                        });
                    }
                }
                return;
            }
        };
        window.addEventListener('keydown', handleDeleteTrack, true); // capture phase
        return () => window.removeEventListener('keydown', handleDeleteTrack, true);
    }, [selectedRow, trackRows, onRemoveMidiTrack, onRemoveAudioTrack]);

    // Continuous timeline: sectionOffsets always [0] since there's one implicit section
    const sectionOffsets = useMemo(() => {
        return arrangement.map((_, i) => {
            let cum = 0;
            for (let j = 0; j < i; j++) cum += arrangement[j].bars;
            return cum;
        });
    }, [arrangement]);

    // Compute time marks for ruler — continuous timeline uses global tempo
    const timeMarks = useMemo(() => {
        const marks = [];
        if (totalBars === 0) return { marks, totalSeconds: 0 };

        const secPerBar = 240 / globalTempo;
        const barToTime = [0];
        let cumSec = 0;
        for (let b = 0; b < totalBars; b++) {
            cumSec += secPerBar;
            barToTime.push(cumSec);
        }
        const totalSeconds = cumSec;
        const secondsPerPixel = totalWidth > 0 ? totalSeconds / totalWidth : 1;

        // Adaptive tick intervals based on zoom level — more granular when zoomed in
        let tickInterval;
        let subTickInterval = null; // For even finer markers
        if (secondsPerPixel < 0.005) { tickInterval = 0.5; subTickInterval = 0.1; }
        else if (secondsPerPixel < 0.01) { tickInterval = 1; subTickInterval = 0.25; }
        else if (secondsPerPixel < 0.02) { tickInterval = 1; subTickInterval = 0.5; }
        else if (secondsPerPixel < 0.05) tickInterval = 2;
        else if (secondsPerPixel < 0.1) tickInterval = 5;
        else if (secondsPerPixel < 0.3) tickInterval = 10;
        else if (secondsPerPixel < 0.6) tickInterval = 15;
        else if (secondsPerPixel < 1.5) tickInterval = 30;
        else tickInterval = 60;

        // Helper to convert time to pixel X position
        const timeToX = (t) => {
            let bIdx = 0;
            for (let i = 0; i < barToTime.length - 1; i++) {
                if (barToTime[i + 1] >= t) {
                    const barStart = barToTime[i];
                    const barEnd = barToTime[i + 1];
                    const frac = barEnd > barStart ? (t - barStart) / (barEnd - barStart) : 0;
                    bIdx = i + frac;
                    break;
                }
                if (i === barToTime.length - 2) bIdx = i + 1;
            }
            return bIdx * pixelsPerBar;
        };

        // Sub-tick marks (shown as minor when zoomed way in)
        if (subTickInterval) {
            for (let ts = 0; ts <= totalSeconds; ts += subTickInterval) {
                // Skip if this will also be a major tick
                if (Math.abs(ts % tickInterval) < 0.001 || Math.abs(ts % tickInterval - tickInterval) < 0.001) continue;
                const x = timeToX(ts);
                marks.push({ x, time: ts, label: formatTimePrecise(ts), isMajor: false });
            }
        }

        const majorInterval = tickInterval >= 30 ? 60 : (tickInterval >= 5 ? 10 : (tickInterval >= 1 ? 5 : 2));
        for (let ts = 0; ts <= totalSeconds; ts += tickInterval) {
            const x = timeToX(ts);
            marks.push({ x, time: ts, label: tickInterval < 1 ? formatTimePrecise(ts) : formatTime(ts), isMajor: ts % majorInterval === 0 || ts === 0 });
        }
        return { marks, totalSeconds };
    }, [arrangement, globalTempo, pixelsPerBar, totalWidth]);

    // Playhead position — globalAbsoluteStep is now driven by the rAF tick loop
    // for both recording and normal playback (recording override happens in the tick).
    const playheadPx = useMemo(() => {
        if (totalBars === 0) return null;
        if (!globalIsPlaying && !isRecording) return null;
        return (globalAbsoluteStep / 32) * pixelsPerBar;
    }, [globalIsPlaying, globalAbsoluteStep, totalBars, pixelsPerBar, isRecording]);

    // Scroll to beginning when playback stops
    const prevIsPlayingRef = useRef(globalIsPlaying);
    useEffect(() => {
        const wasPlaying = prevIsPlayingRef.current;
        prevIsPlayingRef.current = globalIsPlaying;
        if (wasPlaying && !globalIsPlaying && !isRecording) {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = 0;
            }
            if (headerScrollRef.current) {
                headerScrollRef.current.scrollLeft = 0;
            }
            setScrollLeft(0);
        }
    }, [globalIsPlaying, isRecording]);

    // Insertion cursor — shown when NOT playing, at audioInsertionBar position
    const insertionCursorPx = useMemo(() => {
        if (globalIsPlaying || isRecording) return null;
        if (audioInsertionBar == null || totalBars === 0) return null;
        return audioInsertionBar * pixelsPerBar;
    }, [globalIsPlaying, isRecording, audioInsertionBar, totalBars, pixelsPerBar]);

    // Stop marker position (pixel offset) — bar-based
    const stopMarkerPx = useMemo(() => {
        if (stopMarkerBar == null || totalBars === 0) return null;
        return stopMarkerBar * pixelsPerBar;
    }, [stopMarkerBar, totalBars, pixelsPerBar]);

    // Loop range in bars (for locator strip) — { startBar, endBar } or null
    // Now driven by loopRange prop (bar-range based) instead of loopSectionIds
    const loopRangeBars = useMemo(() => {
        if (loopRange) return loopRange;
        // Legacy fallback: derive from loopSectionIds if still provided
        if (loopSectionIds.size === 0 || arrangement.length === 0) return null;
        let startBar = null;
        let endBar = null;
        let cumBars = 0;
        for (const s of arrangement) {
            if (loopSectionIds.has(s.id)) {
                if (startBar === null) startBar = cumBars;
                endBar = cumBars + s.bars;
            }
            cumBars += s.bars;
        }
        return startBar !== null ? { startBar, endBar } : null;
    }, [loopRange, loopSectionIds, arrangement]);

    // Current playback time in seconds — globalAbsoluteStep is correct for both
    // recording and normal playback (rAF tick loop overrides it during recording).
    // Continuous timeline: simple calculation using global tempo
    const currentPlaybackSeconds = useMemo(() => {
        if ((!globalIsPlaying && !isRecording) || totalBars === 0) return 0;
        const absBar = globalAbsoluteStep / 32;
        const secPerBar = 240 / globalTempo;
        return absBar * secPerBar;
    }, [globalIsPlaying, globalAbsoluteStep, totalBars, globalTempo, isRecording]);

    // Zoom
    const zoomIn = useCallback(() => setZoom(prev => Math.min(MAX_PX_PER_BAR, prev * 1.3)), []);
    const zoomOut = useCallback(() => setZoom(prev => Math.max(MIN_PX_PER_BAR, prev / 1.3)), []);
    const zoomToFit = useCallback(() => {
        if (!scrollContainerRef.current || totalBars === 0) return;
        const w = scrollContainerRef.current.clientWidth - 10;
        setZoom(Math.max(MIN_PX_PER_BAR, Math.min(MAX_PX_PER_BAR, w / totalBars)));
    }, [totalBars]);

    // Ctrl+Wheel zoom — cursor-centered: keeps the bar under cursor at the same screen position
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const rect = el.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const oldZoom = zoom;
                const barUnderCursor = (el.scrollLeft + mouseX) / oldZoom;
                const newZoom = Math.max(MIN_PX_PER_BAR, Math.min(MAX_PX_PER_BAR, oldZoom * (1 - e.deltaY * 0.003)));
                setZoom(newZoom);
                // Adjust scroll to keep bar under cursor at the same screen position
                requestAnimationFrame(() => {
                    el.scrollLeft = Math.max(0, barUnderCursor * newZoom - mouseX);
                });
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [zoom]);

    // Drag-to-zoom on the ruler (FL Studio style): vertical drag up = zoom in, down = zoom out
    const rulerDragRef = useRef(null); // { startY, startZoom, mouseX, wasDrag }
    const handleRulerMouseDown = useCallback((e) => {
        if (e.altKey) return; // Alt+Click is for stop markers
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        rulerDragRef.current = {
            startY: e.clientY,
            startZoom: zoom,
            mouseX: e.clientX - rect.left + (headerScrollRef.current?.scrollLeft || 0), // absolute X in timeline
            wasDrag: false
        };
        const handleMove = (ev) => {
            const rd = rulerDragRef.current;
            if (!rd) return;
            const dy = rd.startY - ev.clientY; // up = positive = zoom in
            if (Math.abs(dy) > 3) rd.wasDrag = true;
            const factor = Math.pow(1.008, dy); // smooth exponential zoom
            const newZoom = Math.max(MIN_PX_PER_BAR, Math.min(MAX_PX_PER_BAR, rd.startZoom * factor));
            setZoom(newZoom);
            // Keep the bar under the cursor at the same screen position
            if (scrollContainerRef.current) {
                const barUnderCursor = rd.mouseX / rd.startZoom;
                const newScrollLeft = barUnderCursor * newZoom - (ev.clientX - scrollContainerRef.current.getBoundingClientRect().left);
                scrollContainerRef.current.scrollLeft = Math.max(0, newScrollLeft);
            }
        };
        const handleUp = () => {
            rulerDragRef.current = null;
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }, [zoom]);

    // Sync horizontal scroll between header ruler and body, plus vertical sync with labels
    const handleScroll = useCallback((e) => {
        const sl = e.target.scrollLeft;
        setScrollLeft(sl);
        if (headerScrollRef.current) headerScrollRef.current.scrollLeft = sl;
        // Direct vertical sync — label is overflow:hidden so no feedback loop
        if (labelScrollRef.current) {
            labelScrollRef.current.scrollTop = e.target.scrollTop;
        }
    }, []);

    // Forward mousewheel events from label column to content scroll container
    useEffect(() => {
        const labelEl = labelScrollRef.current;
        const contentEl = scrollContainerRef.current;
        if (!labelEl || !contentEl) return;
        const onWheel = (e) => {
            if (e.ctrlKey || e.metaKey) return;
            contentEl.scrollTop += e.deltaY;
            e.preventDefault();
        };
        labelEl.addEventListener('wheel', onWheel, { passive: false });
        return () => labelEl.removeEventListener('wheel', onWheel);
    }, []);

    // Get track data from a section for a given row
    const getRowData = useCallback((sectionId, rowId) => {
        const section = arrangement.find(s => s.id === sectionId);
        if (!section) return null;
        const row = trackRows.find(r => r.id === rowId);
        if (!row) return null;
        if (row.type === 'drum' && row.drumId) {
            const drumData = section.patterns?.drums?.[row.drumId];
            return drumData ? JSON.parse(JSON.stringify(drumData)) : null;
        } else if (row.trackKey) {
            const data = section.patterns?.[row.trackKey];
            return data ? JSON.parse(JSON.stringify(data)) : null;
        }
        return null;
    }, [arrangement, trackRows]);

    // Set track data in a section for a given row
    const setRowData = useCallback((sectionId, rowId, data) => {
        const row = trackRows.find(r => r.id === rowId);
        if (!row) return;
        const section = arrangement.find(s => s.id === sectionId);
        if (!section) return;
        if (row.type === 'drum' && row.drumId) {
            const newDrums = { ...(section.patterns?.drums || {}) };
            newDrums[row.drumId] = data;
            onUpdateSection(sectionId, { patterns: { ...section.patterns, drums: newDrums } });
        } else if (row.trackKey) {
            onUpdateSection(sectionId, { patterns: { ...section.patterns, [row.trackKey]: data } });
        }
    }, [arrangement, trackRows, onUpdateSection]);

    // Copy selected row's data
    const handleCopyRow = useCallback(() => {
        if (!activeSection) return;
        // Multi-selection: copy all selected cells
        if (selectedCells.length > 0) {
            const items = selectedCells.map(cell => {
                const data = getRowData(cell.sectionId, cell.rowId);
                const row = trackRows.find(r => r.id === cell.rowId);
                return { rowId: cell.rowId, data, type: row?.type, drumId: row?.drumId, trackKey: row?.trackKey };
            }).filter(item => item.data != null);
            if (items.length > 0) {
                setClipboard({ items, sectionId: activeSection });
            }
            return;
        }
        // Single selection
        if (!selectedRow) return;
        const data = getRowData(activeSection, selectedRow);
        const row = trackRows.find(r => r.id === selectedRow);
        setClipboard({ items: [{ rowId: selectedRow, data, type: row?.type, drumId: row?.drumId, trackKey: row?.trackKey }], sectionId: activeSection });
    }, [selectedRow, selectedCells, activeSection, getRowData, trackRows]);

    // Paste clipboard data — creates a new section with only the copied rows
    const handlePasteRow = useCallback(() => {
        if (!clipboard || !clipboard.items || clipboard.items.length === 0 || !activeSection) return;
        if (arrangement.length >= MAX_SECTIONS) return;
        // Build a patterns object with only the clipboard rows populated
        const newPatterns = { drums: {}, chords: [], melody: [], bass: [] };
        clipboard.items.forEach(item => {
            if (item.type === 'drum' && item.drumId) {
                newPatterns.drums[item.drumId] = JSON.parse(JSON.stringify(item.data));
            } else if (item.trackKey) {
                newPatterns[item.trackKey] = JSON.parse(JSON.stringify(item.data));
            }
        });
        onAddSection(activeSection, newPatterns);
    }, [clipboard, activeSection, arrangement.length, onAddSection]);

    // Clone row(s) to the next section — supports multi-selection
    // Creates a new section if no next section exists. After cloning, highlights the cloned rows
    // in the target section so repeated Ctrl+D keeps cloning forward.
    const handleCloneRow = useCallback((sectionId, rowId) => {
        const si = arrangement.findIndex(s => s.id === sectionId);
        if (si < 0) return;

        // Gather the rows to clone
        const rowsToClone = [];
        if (selectedCells.length > 0) {
            selectedCells.forEach(cell => {
                const data = getRowData(cell.sectionId, cell.rowId);
                if (!data) return;
                const row = trackRows.find(r => r.id === cell.rowId);
                if (row) rowsToClone.push({ rowId: cell.rowId, data, type: row.type, drumId: row.drumId, trackKey: row.trackKey });
            });
        } else if (rowId) {
            const data = getRowData(sectionId, rowId);
            const row = trackRows.find(r => r.id === rowId);
            if (data && row) rowsToClone.push({ rowId, data, type: row.type, drumId: row.drumId, trackKey: row.trackKey });
        }
        if (rowsToClone.length === 0) return;

        const hasNextSection = si < arrangement.length - 1;

        if (hasNextSection) {
            // Clone into existing next section, overwriting those rows
            const nextSection = arrangement[si + 1];
            const nextPatterns = JSON.parse(JSON.stringify(nextSection.patterns || {}));
            rowsToClone.forEach(item => {
                if (item.type === 'drum' && item.drumId) {
                    if (!nextPatterns.drums || Array.isArray(nextPatterns.drums)) nextPatterns.drums = {};
                    nextPatterns.drums[item.drumId] = JSON.parse(JSON.stringify(item.data));
                } else if (item.trackKey) {
                    nextPatterns[item.trackKey] = JSON.parse(JSON.stringify(item.data));
                }
            });
            onUpdateSection(nextSection.id, { patterns: nextPatterns });
            // Move selection to the target section so repeated Ctrl+D keeps going
            onSelectSection(nextSection.id);
            setSelectedRow(rowsToClone.length === 1 ? rowsToClone[0].rowId : null);
            setSelectedCells(rowsToClone.map(item => ({ rowId: item.rowId, sectionId: nextSection.id })));
        } else {
            // No next section — create a new one with only the cloned rows
            if (arrangement.length >= MAX_SECTIONS) return;
            const newPatterns = { drums: {}, chords: [], melody: [], bass: [] };
            rowsToClone.forEach(item => {
                if (item.type === 'drum' && item.drumId) {
                    newPatterns.drums[item.drumId] = JSON.parse(JSON.stringify(item.data));
                } else if (item.trackKey) {
                    newPatterns[item.trackKey] = JSON.parse(JSON.stringify(item.data));
                }
            });
            // Store row IDs to highlight after the new section is created
            pendingCloneSelect.current = rowsToClone.map(item => item.rowId);
            onAddSection(sectionId, newPatterns);
        }
    }, [arrangement, selectedCells, getRowData, trackRows, onUpdateSection, onSelectSection, onAddSection]);

    // Clear row data
    const handleClearRow = useCallback((sectionId, rowId) => {
        const row = trackRows.find(r => r.id === rowId);
        if (!row) return;
        if (row.type === 'drum' && row.drumId) {
            setRowData(sectionId, rowId, { lanes: {} });
        } else {
            setRowData(sectionId, rowId, []);
        }
    }, [trackRows, setRowData]);

    // Swap two selected cells' data (Shift+S) — exactly 2 cells, same row type, different sections
    const handleSwapCells = useCallback(() => {
        if (selectedCells.length !== 2) return;
        const [a, b] = selectedCells;
        if (a.sectionId === b.sectionId) return; // Must be different sections
        if (a.rowId !== b.rowId) return; // Must be same track/row type
        const dataA = getRowData(a.sectionId, a.rowId);
        const dataB = getRowData(b.sectionId, b.rowId);
        // Swap: put A's data into B's section and vice versa
        setRowData(a.sectionId, a.rowId, dataB || (trackRows.find(r => r.id === a.rowId)?.type === 'drum' ? { lanes: {} } : []));
        setRowData(b.sectionId, b.rowId, dataA || (trackRows.find(r => r.id === b.rowId)?.type === 'drum' ? { lanes: {} } : []));
        setSelectedCells([]);
    }, [selectedCells, getRowData, setRowData, trackRows]);

    // After a clone creates a new section, highlight the cloned rows in the new section
    useEffect(() => {
        if (pendingCloneSelect.current && activeSection) {
            const rowIds = pendingCloneSelect.current;
            pendingCloneSelect.current = null;
            setSelectedRow(rowIds.length === 1 ? rowIds[0] : null);
            setSelectedCells(rowIds.map(rid => ({ rowId: rid, sectionId: activeSection })));
        }
    }, [activeSection]);

    // Auto-scroll to keep the active section in view when it changes
    // (covers: add section, paste, clone, click section)
    useEffect(() => {
        if (!activeSection || !scrollContainerRef.current) return;
        const si = arrangement.findIndex(s => s.id === activeSection);
        if (si < 0) return;
        const sectionStartPx = sectionOffsets[si] * pixelsPerBar;
        const sectionEndPx = sectionStartPx + arrangement[si].bars * pixelsPerBar;
        const container = scrollContainerRef.current;
        const viewLeft = container.scrollLeft;
        const viewRight = viewLeft + container.clientWidth;
        if (sectionEndPx > viewRight || sectionStartPx < viewLeft) {
            container.scrollLeft = Math.max(0, sectionStartPx - 40);
            if (headerScrollRef.current) {
                headerScrollRef.current.scrollLeft = container.scrollLeft;
            }
            setScrollLeft(container.scrollLeft);
        }
    }, [activeSection, sectionOffsets, pixelsPerBar, arrangement]);

    // Follow playhead during playback — auto-scroll to keep marker visible
    useEffect(() => {
        if (!followPlayhead || playheadPx === null || !scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const viewLeft = container.scrollLeft;
        const viewWidth = container.clientWidth;
        const viewRight = viewLeft + viewWidth;
        // Keep playhead within the middle 60% of viewport (20% margin on each side)
        const marginPx = viewWidth * 0.2;
        if (playheadPx < viewLeft + marginPx || playheadPx > viewRight - marginPx) {
            const targetScroll = Math.max(0, playheadPx - viewWidth * 0.3);
            container.scrollLeft = targetScroll;
            if (headerScrollRef.current) headerScrollRef.current.scrollLeft = targetScroll;
            setScrollLeft(targetScroll);
        }
    }, [followPlayhead, playheadPx]);

    // ── Refs for keyboard shortcut handler (registered once, reads current values via refs) ──
    const kbSelectedRowRef = useRef(selectedRow);
    kbSelectedRowRef.current = selectedRow;
    const kbSelectedRowsRef = useRef(selectedRows);
    kbSelectedRowsRef.current = selectedRows;
    const kbSelectedCellsRef = useRef(selectedCells);
    kbSelectedCellsRef.current = selectedCells;
    const kbActiveSectionRef = useRef(activeSection);
    kbActiveSectionRef.current = activeSection;
    const kbClipboardRef = useRef(clipboard);
    kbClipboardRef.current = clipboard;
    const kbSectionClipboardRef = useRef(sectionClipboard);
    kbSectionClipboardRef.current = sectionClipboard;
    const kbAudioClipClipboardRef = useRef(audioClipClipboard);
    kbAudioClipClipboardRef.current = audioClipClipboard;
    const kbFocusedClipRef = useRef(focusedClip);
    kbFocusedClipRef.current = focusedClip;
    const kbFocusedAudioClipRef = useRef(focusedAudioClip);
    kbFocusedAudioClipRef.current = focusedAudioClip;
    const kbShowMixerRef = useRef(showMixer);
    kbShowMixerRef.current = showMixer;
    const kbArrangementRef = useRef(arrangement);
    kbArrangementRef.current = arrangement;
    const kbAudioTracksRef = useRef(audioTracks);
    kbAudioTracksRef.current = audioTracks;
    const kbMidiTracksRef = useRef(midiTracks);
    kbMidiTracksRef.current = midiTracks;
    const kbTrackRowsRef = useRef(trackRows);
    kbTrackRowsRef.current = trackRows;
    const kbSelectedAudioClipIdRef = useRef(selectedAudioClipId);
    kbSelectedAudioClipIdRef.current = selectedAudioClipId;
    const kbSelectedAudioClipTrackIdRef = useRef(selectedAudioClipTrackId);
    kbSelectedAudioClipTrackIdRef.current = selectedAudioClipTrackId;
    const kbSelectedMidiClipIdRef = useRef(selectedMidiClipId);
    kbSelectedMidiClipIdRef.current = selectedMidiClipId;
    const kbSelectedMidiClipTrackIdRef = useRef(selectedMidiClipTrackId);
    kbSelectedMidiClipTrackIdRef.current = selectedMidiClipTrackId;
    const kbAudioInsertionBarRef = useRef(audioInsertionBar);
    kbAudioInsertionBarRef.current = audioInsertionBar;
    const kbSelectedNoteClipIdRef = useRef(selectedNoteClipId);
    kbSelectedNoteClipIdRef.current = selectedNoteClipId;
    const kbSelectedNoteClipTrackKeyRef = useRef(selectedNoteClipTrackKey);
    kbSelectedNoteClipTrackKeyRef.current = selectedNoteClipTrackKey;
    const kbSelectedDrumClipIdRef = useRef(selectedDrumClipId);
    kbSelectedDrumClipIdRef.current = selectedDrumClipId;
    const kbSelectedDrumLaneClipDrumIdRef = useRef(selectedDrumLaneClipDrumId);
    kbSelectedDrumLaneClipDrumIdRef.current = selectedDrumLaneClipDrumId;
    const kbChordClipsRef = useRef(chordClips);
    kbChordClipsRef.current = chordClips;
    const kbMelodyClipsRef = useRef(melodyClips);
    kbMelodyClipsRef.current = melodyClips;
    const kbBassClipsRef = useRef(bassClips);
    kbBassClipsRef.current = bassClips;
    const kbDrumClipsRef = useRef(drumClips);
    kbDrumClipsRef.current = drumClips;
    const kbDrumLaneClipsRef = useRef(drumLaneClips);
    kbDrumLaneClipsRef.current = drumLaneClips;
    const kbSelectedAudioClipIdsRef = useRef(selectedAudioClipIds);
    kbSelectedAudioClipIdsRef.current = selectedAudioClipIds;

    // Keyboard shortcuts for copy/paste/clone/escape — registered ONCE, reads from refs
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Read all state from refs (avoids stale closures and constant re-registration)
            const selectedRow = kbSelectedRowRef.current;
            const selectedRows = kbSelectedRowsRef.current;
            const selectedCells = kbSelectedCellsRef.current;
            const activeSection = kbActiveSectionRef.current;
            const clipboard = kbClipboardRef.current;
            const sectionClipboard = kbSectionClipboardRef.current;
            const audioClipClipboard = kbAudioClipClipboardRef.current;
            const focusedClip = kbFocusedClipRef.current;
            const focusedAudioClip = kbFocusedAudioClipRef.current;
            const showMixer = kbShowMixerRef.current;
            const arrangement = kbArrangementRef.current;
            const audioTracks = kbAudioTracksRef.current;
            const midiTracks = kbMidiTracksRef.current;
            const trackRows = kbTrackRowsRef.current;
            const selectedAudioClipId = kbSelectedAudioClipIdRef.current;
            const selectedAudioClipTrackId = kbSelectedAudioClipTrackIdRef.current;
            const selectedMidiClipId = kbSelectedMidiClipIdRef.current;
            const selectedMidiClipTrackId = kbSelectedMidiClipTrackIdRef.current;
            const audioInsertionBar = kbAudioInsertionBarRef.current;
            const selectedNoteClipId = kbSelectedNoteClipIdRef.current;
            const selectedNoteClipTrackKey = kbSelectedNoteClipTrackKeyRef.current;
            const selectedDrumClipId = kbSelectedDrumClipIdRef.current;
            const selectedDrumLaneClipDrumId = kbSelectedDrumLaneClipDrumIdRef.current;
            const chordClips = kbChordClipsRef.current;
            const melodyClips = kbMelodyClipsRef.current;
            const bassClips = kbBassClipsRef.current;
            const drumClips = kbDrumClipsRef.current;
            const drumLaneClips = kbDrumLaneClipsRef.current;
            const selectedAudioClipIds = kbSelectedAudioClipIdsRef.current;

            if (e.key === 'D' || e.key === 'd' || e.key === 'c' || e.key === 'v') {
                console.log('[ArrangementTimeline keydown] key:', e.key, 'shift:', e.shiftKey, 'ctrl:', e.ctrlKey, 'activeSection:', activeSection, 'selectedDrumClipId:', selectedDrumClipId, 'selectedDrumLaneClipDrumId:', selectedDrumLaneClipDrumId, 'selectedNoteClipId:', selectedNoteClipId);
            }
            // Escape exits focused clip / audio editor view / collapses expanded mixer / closes mixer
            if (e.key === 'Escape') {
                if (focusedAudioClip) { e.preventDefault(); setFocusedAudioClip(null); return; }
                if (focusedClip) { e.preventDefault(); setFocusedClip(null); if (onFocusMidiClip) onFocusMidiClip(null); return; }
                if (showMixer) {
                    e.preventDefault();
                    arrangementMixerRef.current?.tryCollapse?.();
                    setShowMixer(false);
                    return;
                }
            }
            // When a clip editor is open, let it handle its own Ctrl+C/V/D
            if (focusedClip || focusedAudioClip) return;

            // Delete/Backspace key: remove selected MIDI/audio track(s), audio clip, or section
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Multi-track deletion (Shift+click selection)
                if (selectedRows.size > 0) {
                    const rowsToDelete = trackRows.filter(r => selectedRows.has(r.id) && (r.type === 'audio' || r.type === 'midi'));
                    if (rowsToDelete.length > 0) {
                        e.preventDefault();
                        const names = rowsToDelete.map(r => r.label).join(', ');
                        if (window.confirm(`Delete ${rowsToDelete.length} tracks: ${names}?`)) {
                            const savedTop = scrollContainerRef.current?.scrollTop;
                            for (const row of rowsToDelete) {
                                if (row.type === 'audio' && onRemoveAudioTrack) onRemoveAudioTrack(row.trackId);
                                if (row.type === 'midi' && onRemoveMidiTrack) onRemoveMidiTrack(row.trackId);
                            }
                            setSelectedRow(null);
                            setSelectedRows(new Set());
                            if (savedTop != null && scrollContainerRef.current) {
                                requestAnimationFrame(() => {
                                    scrollContainerRef.current.scrollTop = savedTop;
                                    if (labelScrollRef.current) labelScrollRef.current.scrollTop = savedTop;
                                });
                            }
                        }
                        return;
                    }
                }

                const selectedAudioRow = selectedRow && trackRows.find(r => r.id === selectedRow && r.type === 'audio');
                const selectedMidiRow = selectedRow && trackRows.find(r => r.id === selectedRow && r.type === 'midi');

                // Delete selected MIDI clip (if one is selected)
                if (selectedMidiRow && selectedMidiClipId && onRemoveMidiClip) {
                    e.preventDefault();
                    onRemoveMidiClip(selectedMidiRow.trackId, selectedMidiClipId);
                    setSelectedMidiClipId(null);
                    return;
                }
                // MIDI track deletion (no section required)
                if (selectedMidiRow && selectedMidiRow.trackId && onRemoveMidiTrack) {
                    e.preventDefault();
                    if (window.confirm(`Delete "${selectedMidiRow.label}"?`)) {
                        const savedTop = scrollContainerRef.current?.scrollTop;
                        const delIdx = trackRows.findIndex(r => r.id === selectedRow);
                        onRemoveMidiTrack(selectedMidiRow.trackId);
                        // Select the row at the same position (or previous if it was last)
                        const nextRow = delIdx >= 0 && delIdx < trackRows.length - 1 ? trackRows[delIdx + 1]
                            : delIdx - 1 >= 0 ? trackRows[delIdx - 1] : null;
                        setSelectedRow(nextRow ? nextRow.id : null);
                        if (savedTop != null && scrollContainerRef.current) {
                            requestAnimationFrame(() => {
                                scrollContainerRef.current.scrollTop = savedTop;
                                if (labelScrollRef.current) labelScrollRef.current.scrollTop = savedTop;
                            });
                        }
                    }
                    return;
                }
                // Audio track deletion (no section required)
                if (selectedAudioRow && selectedAudioRow.trackId && onRemoveAudioTrack) {
                    e.preventDefault();
                    if (window.confirm(`Delete "${selectedAudioRow.label}"?`)) {
                        const savedTop = scrollContainerRef.current?.scrollTop;
                        const delIdx = trackRows.findIndex(r => r.id === selectedRow);
                        // Find the end of the last clip on the previous audio track for insertion bar
                        const prevAudioRow = delIdx > 0 ? trackRows.slice(0, delIdx).reverse().find(r => r.type === 'audio') : null;
                        if (prevAudioRow && onSetAudioInsertionBar) {
                            const prevTrack = audioTracks.find(t => t.id === prevAudioRow.trackId);
                            if (prevTrack && prevTrack.clips.length > 0) {
                                const tempo = globalTempo;
                                const secondsPerBar = 4 * 60 / tempo;
                                let lastEnd = 0;
                                for (const clip of prevTrack.clips) {
                                    const cBar = clip.timelineBar ?? 0;
                                    const bd = clip.buffer ? clip.buffer.duration : 0;
                                    const ed = Math.max(0.01, (bd - (clip.trimStart || 0) - (clip.trimEnd || 0)) / (clip.playbackRate || 1));
                                    const endBar = cBar + ed / secondsPerBar;
                                    if (endBar > lastEnd) lastEnd = endBar;
                                }
                                onSetAudioInsertionBar(Math.round(lastEnd * 1000) / 1000);
                            }
                        }
                        onRemoveAudioTrack(selectedAudioRow.trackId);
                        // Select the row at the same position (or previous if last)
                        const nextRow = delIdx >= 0 && delIdx < trackRows.length - 1 ? trackRows[delIdx + 1]
                            : delIdx - 1 >= 0 ? trackRows[delIdx - 1] : null;
                        setSelectedRow(nextRow ? nextRow.id : null);
                        if (savedTop != null && scrollContainerRef.current) {
                            requestAnimationFrame(() => {
                                scrollContainerRef.current.scrollTop = savedTop;
                                if (labelScrollRef.current) labelScrollRef.current.scrollTop = savedTop;
                            });
                        }
                    }
                    return;
                }
                // Delete selected note clip (chords/melody/bass)
                if (selectedNoteClipId && selectedNoteClipTrackKey) {
                    e.preventDefault();
                    const noteRemoveMap = { chords: onRemoveChordClip, melody: onRemoveMelodyClip, bass: onRemoveBassClip };
                    const removeFn = noteRemoveMap[selectedNoteClipTrackKey];
                    if (removeFn) removeFn(selectedNoteClipId);
                    setSelectedNoteClipId(null);
                    setSelectedNoteClipTrackKey(null);
                    return;
                }
                // Delete selected drum lane clip
                if (selectedDrumClipId && selectedDrumLaneClipDrumId && onRemoveDrumLaneClip) {
                    e.preventDefault();
                    onRemoveDrumLaneClip(selectedDrumLaneClipDrumId, selectedDrumClipId);
                    setSelectedDrumClipId(null);
                    setSelectedDrumLaneClipDrumId(null);
                    return;
                }
                // Delete selected collapsed drum clip
                if (selectedDrumClipId && !selectedDrumLaneClipDrumId && onRemoveDrumClip) {
                    e.preventDefault();
                    onRemoveDrumClip(selectedDrumClipId);
                    setSelectedDrumClipId(null);
                    return;
                }
                // Audio clip deletion — supports multi-select
                if (selectedAudioClipTrackId && onRemoveClip) {
                    if (selectedAudioClipIds.size > 0) {
                        e.preventDefault();
                        for (const clipId of selectedAudioClipIds) {
                            onRemoveClip(selectedAudioClipTrackId, clipId);
                        }
                        setSelectedAudioClipIds(new Set());
                        setSelectedAudioClipId(null);
                        setSelectedAudioClipTrackId(null);
                        return;
                    } else if (selectedAudioClipId) {
                        e.preventDefault();
                        onRemoveClip(selectedAudioClipTrackId, selectedAudioClipId);
                        setSelectedAudioClipId(null);
                        setSelectedAudioClipTrackId(null);
                        return;
                    }
                }
                // Section deletion (requires active section, no row selected)
                if (activeSection && !selectedRow && arrangement.length > 1) {
                    e.preventDefault();
                    onRemoveSection(activeSection);
                    return;
                }
            }

            const hasRowSelection = selectedRow || selectedCells.length > 0;
            const selectedAudioRow = (selectedRow && trackRows.find(r => r.id === selectedRow && r.type === 'audio'))
                || (selectedAudioClipTrackId && trackRows.find(r => r.trackId === selectedAudioClipTrackId && r.type === 'audio'));
            const selectedMidiRow = (selectedRow && trackRows.find(r => r.id === selectedRow && r.type === 'midi'))
                || (selectedMidiClipTrackId && trackRows.find(r => r.trackId === selectedMidiClipTrackId && r.type === 'midi'));

            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                console.log('[Ctrl+C] activeSection:', activeSection, 'selectedNoteClipId:', selectedNoteClipId, 'selectedDrumClipId:', selectedDrumClipId, 'selectedDrumLaneClipDrumId:', selectedDrumLaneClipDrumId, 'selectedMidiClipId:', selectedMidiClipId, 'selectedAudioClipId:', selectedAudioClipId);
                if (!activeSection) { console.log('[Ctrl+C] BLOCKED: no activeSection'); return; }
                e.preventDefault();
                if (selectedNoteClipId && selectedNoteClipTrackKey) {
                    // Copy selected note clip (chords/melody/bass)
                    const clipsMap = { chords: chordClips, melody: melodyClips, bass: bassClips };
                    const clipToCopy = (clipsMap[selectedNoteClipTrackKey] || []).find(c => c.id === selectedNoteClipId);
                    if (clipToCopy) {
                        setAudioClipClipboard({
                            clipType: 'noteClip',
                            trackKey: selectedNoteClipTrackKey,
                            clip: { ...clipToCopy, pattern: (clipToCopy.pattern || []).map(n => ({ ...n })) }
                        });
                    }
                } else if (selectedDrumClipId && selectedDrumLaneClipDrumId) {
                    // Copy selected drum lane clip
                    const dlClips = drumLaneClips[selectedDrumLaneClipDrumId] || [];
                    const clipToCopy = dlClips.find(c => c.id === selectedDrumClipId);
                    if (clipToCopy) {
                        setAudioClipClipboard({
                            clipType: 'drumLaneClip',
                            drumId: selectedDrumLaneClipDrumId,
                            clip: { ...clipToCopy, laneData: clipToCopy.laneData ? JSON.parse(JSON.stringify(clipToCopy.laneData)) : null }
                        });
                    }
                } else if (selectedDrumClipId && !selectedDrumLaneClipDrumId) {
                    // Copy selected collapsed drum clip
                    const clipToCopy = drumClips.find(c => c.id === selectedDrumClipId);
                    if (clipToCopy) {
                        setAudioClipClipboard({
                            clipType: 'drumClip',
                            clip: { ...clipToCopy, drumStates: clipToCopy.drumStates ? JSON.parse(JSON.stringify(clipToCopy.drumStates)) : {} }
                        });
                    }
                } else if (selectedMidiRow && selectedMidiRow.trackId) {
                    // Copy selected MIDI clip
                    const mt = midiTracks.find(t => t.id === selectedMidiRow.trackId);
                    const clipToCopy = selectedMidiClipId ? (mt?.clips || []).find(c => c.id === selectedMidiClipId) : (mt?.clips || [])[0];
                    if (clipToCopy?.pattern?.length > 0) {
                        setAudioClipClipboard({
                            trackId: selectedMidiRow.trackId,
                            clipType: 'midi',
                            clip: { ...clipToCopy, pattern: clipToCopy.pattern.map(n => ({ ...n })) }
                        });
                    }
                } else if (selectedAudioRow && selectedAudioRow.trackId) {
                    // Copy selected audio clip(s) for this audio track
                    const track = audioTracks.find(t => t.id === selectedAudioRow.trackId);
                    if (track) {
                        const clipsToCopy = selectedAudioClipIds.size > 0
                            ? track.clips.filter(c => selectedAudioClipIds.has(c.id))
                            : selectedAudioClipId
                                ? track.clips.filter(c => c.id === selectedAudioClipId)
                                : track.clips.filter(c => c.sectionId === activeSection).slice(0, 1);
                        if (clipsToCopy.length > 0) {
                            setAudioClipClipboard({
                                trackId: selectedAudioRow.trackId,
                                clipType: 'audio',
                                clip: { ...clipsToCopy[0] },
                                clips: clipsToCopy.map(c => ({ ...c })) // store all for multi-paste
                            });
                        }
                    }
                } else if (hasRowSelection) {
                    handleCopyRow();
                } else {
                    // Copy entire active section (including mix)
                    const section = arrangement.find(s => s.id === activeSection);
                    if (section) {
                        setSectionClipboard({
                            name: section.name,
                            type: section.type,
                            bars: section.bars,
                            patterns: JSON.parse(JSON.stringify(section.patterns)),
                            settings: { ...section.settings },
                            mix: section.mix ? JSON.parse(JSON.stringify(section.mix)) : undefined,
                            color: section.color
                        });
                    }
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                console.log('[Ctrl+V] activeSection:', activeSection, 'audioClipClipboard:', audioClipClipboard, 'clipboard:', clipboard, 'sectionClipboard:', sectionClipboard, 'selectedNoteClipTrackKey:', selectedNoteClipTrackKey, 'selectedDrumLaneClipDrumId:', selectedDrumLaneClipDrumId, 'selectedDrumClipId:', selectedDrumClipId, 'selectedMidiRow:', selectedMidiRow, 'selectedAudioRow:', selectedAudioRow);
                if (!activeSection) { console.log('[Ctrl+V] BLOCKED: no activeSection'); return; }
                e.preventDefault();
                if (audioClipClipboard?.clipType === 'noteClip' && (selectedNoteClipTrackKey || audioClipClipboard.trackKey)) {
                    // Paste note clip to chords/melody/bass track — use selected track or fall back to clipboard's source
                    const targetTrackKey = selectedNoteClipTrackKey || audioClipClipboard.trackKey;
                    const addMap = { chords: onAddChordClip, melody: onAddMelodyClip, bass: onAddBassClip };
                    const addFn = addMap[targetTrackKey];
                    if (addFn) {
                        const srcClip = audioClipClipboard.clip;
                        const pasteBar = audioInsertionBar != null ? Math.floor(audioInsertionBar) : 0;
                        const pasteBars = srcClip?.bars || 4;
                        // Trim/remove overlapping clips in the paste region
                        overwriteNoteClipsInRegion(targetTrackKey, pasteBar, pasteBar + pasteBars);
                        addFn({
                            timelineBar: pasteBar,
                            bars: pasteBars,
                            pattern: (srcClip?.pattern || []).map(n => ({ ...n })),
                            name: srcClip?.name || 'Clip',
                            color: srcClip?.color || null
                        });
                    }
                } else if (audioClipClipboard?.clipType === 'drumLaneClip' && (selectedDrumLaneClipDrumId || audioClipClipboard.drumId) && onAddDrumLaneClip) {
                    // Paste drum lane clip — split/trim overlapping clips (standard DAW behavior)
                    const targetDrumId = selectedDrumLaneClipDrumId || audioClipClipboard.drumId;
                    const srcClip = audioClipClipboard.clip;
                    const pasteBar = audioInsertionBar != null ? Math.floor(audioInsertionBar) : 0;
                    const pasteBars = srcClip?.bars || 4;
                    overwriteDrumLaneClipsInRegion(targetDrumId, pasteBar, pasteBar + pasteBars);
                    onAddDrumLaneClip(targetDrumId, {
                        timelineBar: pasteBar, bars: pasteBars,
                        laneData: srcClip?.laneData ? JSON.parse(JSON.stringify(srcClip.laneData)) : null,
                        name: srcClip?.name || 'Drum Clip', color: srcClip?.color || null
                    });
                } else if (audioClipClipboard?.clipType === 'drumClip' && onAddDrumClip) {
                    // Paste collapsed drum clip — split/trim overlapping clips
                    const srcClip = audioClipClipboard.clip;
                    const pasteBar = audioInsertionBar != null ? Math.floor(audioInsertionBar) : 0;
                    const pasteBars = srcClip?.bars || 4;
                    overwriteDrumClipsInRegion(pasteBar, pasteBar + pasteBars);
                    onAddDrumClip({
                        timelineBar: pasteBar,
                        bars: srcClip?.bars || 4,
                        drumStates: srcClip?.drumStates ? JSON.parse(JSON.stringify(srcClip.drumStates)) : {},
                        name: srcClip?.name || 'Drums',
                        color: srcClip?.color || null
                    });
                } else if (audioClipClipboard?.clipType === 'midi' && (selectedMidiRow?.trackId || audioClipClipboard.trackId) && onAddMidiClip) {
                    // Paste MIDI clip — use selected MIDI track or fall back to clipboard's source track
                    const targetTrackId = selectedMidiRow?.trackId || audioClipClipboard.trackId;
                    const srcClip = audioClipClipboard.clip;
                    const pasteBar = audioInsertionBar != null ? Math.floor(audioInsertionBar) : 0;
                    const pasteBars = srcClip?.bars || 4;
                    // Trim/remove overlapping clips in the paste region
                    overwriteMidiClipsInRegion(targetTrackId, pasteBar, pasteBar + pasteBars);
                    onAddMidiClip(targetTrackId, {
                        timelineBar: pasteBar,
                        bars: pasteBars,
                        pattern: (srcClip?.pattern || []).map(n => ({ ...n })),
                        name: srcClip?.name || t('arrange.midiClip'),
                        color: srcClip?.color || null
                    });
                } else if ((selectedAudioRow?.trackId || audioClipClipboard?.trackId) && audioClipClipboard?.clipType !== 'midi' && audioClipClipboard?.clipType === 'audio' && onAddClip) {
                    // Paste audio clip(s)
                    const targetAudioTrackId = selectedAudioRow?.trackId || audioClipClipboard.trackId;
                    const section = arrangement.find(s => s.id === activeSection);
                    const tempo = section?.settings?.tempo || globalTempo;
                    const secondsPerBar = 4 * 60 / tempo;
                    const existingTrack = audioTracks.find(t => t.id === targetAudioTrackId);

                    let nextTimelineBar;
                    if (audioInsertionBar != null) {
                        // Use the click insertion point
                        nextTimelineBar = audioInsertionBar;
                    } else {
                        // Find the end of the last clip on this track (in absolute bars)
                        nextTimelineBar = 0;
                        if (existingTrack) {
                            for (const ec of existingTrack.clips) {
                                const ecBar = ec.timelineBar != null ? ec.timelineBar : 0;
                                const bd = ec.buffer ? ec.buffer.duration : 0;
                                const ed = Math.max(0.01, (bd - (ec.trimStart || 0) - (ec.trimEnd || 0)) / (ec.playbackRate || 1));
                                const endBar = ecBar + ed / secondsPerBar;
                                if (endBar > nextTimelineBar) nextTimelineBar = endBar;
                            }
                        }
                        // Also use the active section's start if it's beyond existing clips
                        const sIdx = arrangement.indexOf(section);
                        const activeSectionStart = sIdx >= 0 ? arrangement.slice(0, sIdx).reduce((s, sec) => s + sec.bars, 0) : 0;
                        if (activeSectionStart > nextTimelineBar) nextTimelineBar = activeSectionStart;
                    }

                    // Paste all copied clips, maintaining relative offsets — split overlapping clips
                    const clipsToPaste = audioClipClipboard.clips || [audioClipClipboard.clip];
                    const baseBar = clipsToPaste.length > 0 ? Math.min(...clipsToPaste.map(c => c.timelineBar ?? 0)) : 0;
                    for (const srcClip of clipsToPaste) {
                        const relOffset = (srcClip.timelineBar ?? 0) - baseBar;
                        // Compute section from paste bar position (for backward compat)
                        const pasteBar = Math.round((nextTimelineBar + relOffset) * 1000) / 1000;
                        // Compute clip duration in bars for overwrite
                        const srcBufDur = srcClip.buffer ? srcClip.buffer.duration : 0;
                        const srcEffDur = Math.max(0.01, (srcBufDur - (srcClip.trimStart || 0) - (srcClip.trimEnd || 0)) / (srcClip.playbackRate || 1));
                        const srcClipBars = srcEffDur / secondsPerBar;
                        overwriteAudioClipsInRegion(targetAudioTrackId, pasteBar, pasteBar + srcClipBars);
                        let pasteSectionId = activeSection;
                        { let cum = 0; for (const s of arrangement) { if (cum + s.bars > pasteBar) { pasteSectionId = s.id; break; } cum += s.bars; } }
                        onAddClip(targetAudioTrackId, pasteSectionId, srcClip.buffer, srcClip.name, {
                            playbackRate: srcClip.playbackRate, trimStart: srcClip.trimStart,
                            trimEnd: srcClip.trimEnd, reversed: srcClip.reversed,
                            pitch: srcClip.pitch, fadeIn: srcClip.fadeIn, fadeOut: srcClip.fadeOut,
                            startBar: 0,
                            timelineBar: pasteBar
                        });
                    }
                } else if (hasRowSelection && clipboard) {
                    handlePasteRow();
                } else if (sectionClipboard && arrangement.length < MAX_SECTIONS) {
                    // Paste entire section after active section (preserving mix)
                    const pastedPatterns = {
                        drums: JSON.parse(JSON.stringify(sectionClipboard.patterns?.drums || {})),
                        chords: JSON.parse(JSON.stringify(sectionClipboard.patterns?.chords || [])),
                        melody: JSON.parse(JSON.stringify(sectionClipboard.patterns?.melody || [])),
                        bass: JSON.parse(JSON.stringify(sectionClipboard.patterns?.bass || []))
                    };
                    const pastedMix = sectionClipboard.mix ? JSON.parse(JSON.stringify(sectionClipboard.mix)) : undefined;
                    onAddSection(activeSection, pastedPatterns, pastedMix);
                }
            }
            // Shift+D: clone selected row(s) OR duplicate entire section (Shift+D avoids Chrome bookmark shortcut)
            if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === 'D') {
                console.log('[Shift+D] activeSection:', activeSection, 'selectedNoteClipId:', selectedNoteClipId, 'selectedNoteClipTrackKey:', selectedNoteClipTrackKey, 'selectedDrumClipId:', selectedDrumClipId, 'selectedDrumLaneClipDrumId:', selectedDrumLaneClipDrumId, 'selectedMidiClipId:', selectedMidiClipId, 'selectedAudioClipId:', selectedAudioClipId, 'selectedRow:', selectedRow, 'hasRowSelection:', hasRowSelection);
                if (!activeSection) { console.log('[Shift+D] BLOCKED: no activeSection'); return; }
                e.preventDefault();
                if (selectedNoteClipId && selectedNoteClipTrackKey) {
                    // Clone selected note clip (chords/melody/bass) — split overlapping clips
                    const clipsMap = { chords: chordClips, melody: melodyClips, bass: bassClips };
                    const addMap = { chords: onAddChordClip, melody: onAddMelodyClip, bass: onAddBassClip };
                    const srcClip = (clipsMap[selectedNoteClipTrackKey] || []).find(c => c.id === selectedNoteClipId);
                    const addFn = addMap[selectedNoteClipTrackKey];
                    if (srcClip && addFn) {
                        const endBar = (srcClip.timelineBar || 0) + (srcClip.bars || 4);
                        const dupBars = srcClip.bars || 4;
                        overwriteNoteClipsInRegion(selectedNoteClipTrackKey, endBar, endBar + dupBars);
                        addFn({
                            timelineBar: endBar,
                            bars: dupBars,
                            pattern: (srcClip.pattern || []).map(n => ({ ...n })),
                            name: srcClip.name || 'Clip',
                            color: srcClip.color || null
                        });
                    }
                } else if (selectedDrumClipId && selectedDrumLaneClipDrumId && onAddDrumLaneClip) {
                    // Clone selected drum lane clip — split overlapping clips
                    const dlClips = drumLaneClips[selectedDrumLaneClipDrumId] || [];
                    const srcClip = dlClips.find(c => c.id === selectedDrumClipId);
                    if (srcClip) {
                        const endBar = (srcClip.timelineBar || 0) + (srcClip.bars || 4);
                        const dupBars = srcClip.bars || 4;
                        overwriteDrumLaneClipsInRegion(selectedDrumLaneClipDrumId, endBar, endBar + dupBars);
                        onAddDrumLaneClip(selectedDrumLaneClipDrumId, {
                            timelineBar: endBar,
                            bars: dupBars,
                            laneData: srcClip.laneData ? JSON.parse(JSON.stringify(srcClip.laneData)) : null,
                            name: srcClip.name || 'Drum Clip',
                            color: srcClip.color || null
                        });
                    }
                } else if (selectedDrumClipId && !selectedDrumLaneClipDrumId && onAddDrumClip) {
                    // Clone selected collapsed drum clip — split overlapping clips
                    const srcClip = drumClips.find(c => c.id === selectedDrumClipId);
                    if (srcClip) {
                        const endBar = (srcClip.timelineBar || 0) + (srcClip.bars || 4);
                        const dupBars = srcClip.bars || 4;
                        overwriteDrumClipsInRegion(endBar, endBar + dupBars);
                        onAddDrumClip({
                            timelineBar: endBar,
                            bars: dupBars,
                            drumStates: srcClip.drumStates ? JSON.parse(JSON.stringify(srcClip.drumStates)) : {},
                            name: srcClip.name || 'Drums',
                            color: srcClip.color || null
                        });
                    }
                } else if (selectedMidiRow && selectedMidiRow.trackId && selectedMidiClipId && onAddMidiClip) {
                    // Clone selected MIDI clip — split overlapping clips
                    const mt = midiTracks.find(t => t.id === selectedMidiRow.trackId);
                    const srcClip = (mt?.clips || []).find(c => c.id === selectedMidiClipId);
                    if (srcClip) {
                        const endBar = (srcClip.timelineBar || 0) + (srcClip.bars || 4);
                        const dupBars = srcClip.bars || 4;
                        overwriteMidiClipsInRegion(selectedMidiRow.trackId, endBar, endBar + dupBars);
                        onAddMidiClip(selectedMidiRow.trackId, {
                            timelineBar: endBar,
                            bars: dupBars,
                            pattern: (srcClip.pattern || []).map(n => ({ ...n })),
                            name: srcClip.name || t('arrange.midiClip'),
                            color: srcClip.color || null
                        });
                    }
                } else if (selectedAudioRow && selectedAudioRow.trackId) {
                    // Clone selected audio clip(s) — split overlapping clips
                    const track = audioTracks.find(t => t.id === selectedAudioRow.trackId);
                    if (track && onAddClip) {
                        const clipsToClone = selectedAudioClipIds.size > 0
                            ? track.clips.filter(c => selectedAudioClipIds.has(c.id))
                            : selectedAudioClipId
                                ? track.clips.filter(c => c.id === selectedAudioClipId)
                                : track.clips.filter(c => c.sectionId === activeSection).slice(0, 1);
                        if (clipsToClone.length > 0) {
                            const section = arrangement.find(s => s.id === activeSection);
                            const tempo = section?.settings?.tempo || globalTempo;
                            const secondsPerBar = 4 * 60 / tempo;
                            // Find the end of the last clip to clone
                            let maxEndBar = 0;
                            for (const ec of clipsToClone) {
                                const ecBar = ec.timelineBar ?? 0;
                                const bd = ec.buffer ? ec.buffer.duration : 0;
                                const ed = Math.max(0.01, (bd - (ec.trimStart || 0) - (ec.trimEnd || 0)) / (ec.playbackRate || 1));
                                const endBar = ecBar + ed / secondsPerBar;
                                if (endBar > maxEndBar) maxEndBar = endBar;
                            }
                            const baseBar = Math.min(...clipsToClone.map(c => c.timelineBar ?? 0));
                            for (const clip of clipsToClone) {
                                const relOffset = (clip.timelineBar ?? 0) - baseBar;
                                const dupBar = Math.round((maxEndBar + relOffset) * 1000) / 1000;
                                const bd = clip.buffer ? clip.buffer.duration : 0;
                                const ed = Math.max(0.01, (bd - (clip.trimStart || 0) - (clip.trimEnd || 0)) / (clip.playbackRate || 1));
                                const dupEndBar = dupBar + ed / secondsPerBar;
                                overwriteAudioClipsInRegion(selectedAudioRow.trackId, dupBar, dupEndBar);
                                onAddClip(selectedAudioRow.trackId, activeSection, clip.buffer, clip.name, {
                                    playbackRate: clip.playbackRate, trimStart: clip.trimStart,
                                    trimEnd: clip.trimEnd, reversed: clip.reversed,
                                    pitch: clip.pitch, fadeIn: clip.fadeIn, fadeOut: clip.fadeOut,
                                    startBar: 0,
                                    timelineBar: dupBar
                                });
                            }
                        }
                    }
                } else if (hasRowSelection) {
                    handleCloneRow(activeSection, selectedRow);
                } else {
                    // Duplicate entire active section
                    if (arrangement.length < MAX_SECTIONS) {
                        onDuplicateSection(activeSection);
                    }
                }
            }
            // Ctrl+A: select all clips/cells on the focused track
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && selectedRow) {
                if (selectedAudioRow && selectedAudioRow.trackId) {
                    // Audio/Vocal track: select all audio clips
                    const track = audioTracks.find(t => t.id === selectedAudioRow.trackId);
                    if (track && track.clips.length > 0) {
                        e.preventDefault();
                        setSelectedAudioClipIds(new Set(track.clips.map(c => c.id)));
                        setSelectedAudioClipTrackId(selectedAudioRow.trackId);
                    }
                } else {
                    // MIDI/melodic track: select all cells across all sections for this row
                    e.preventDefault();
                    const cells = arrangement.map(s => ({ rowId: selectedRow, sectionId: s.id }));
                    setSelectedCells(cells);
                }
            }
            // Audio clip time stretch shortcuts: [ = halftime, ] = doubletime, ; = 0.75x, ' = 1.5x
            if (selectedAudioRow && activeSection && onUpdateClip && !e.ctrlKey && !e.metaKey) {
                const track = audioTracks.find(t => t.id === selectedAudioRow.trackId);
                const clips = track?.clips?.filter(c => c.sectionId === activeSection) || [];
                if (clips.length > 0) {
                    let rateMult = null;
                    let resetRate = false;
                    if (e.key === '[') { rateMult = 0.5; }   // halftime
                    if (e.key === ']') { rateMult = 2; }     // doubletime
                    if (e.key === ';') { rateMult = 0.75; }  // 0.75x
                    if (e.key === "'") { rateMult = 1.5; }   // 1.5x
                    if (e.key === '\\') { resetRate = true; } // reset to original
                    if (rateMult !== null || resetRate) {
                        e.preventDefault();
                        for (const clip of clips) {
                            const newRate = resetRate ? 1 : Math.max(0.25, Math.min(4, (clip.playbackRate || 1) * rateMult));
                            onUpdateClip(selectedAudioRow.trackId, clip.id, {
                                playbackRate: Math.round(newRate * 1000) / 1000
                            });
                        }
                    }
                }
            }
            // Shift+W: swap clip order within the same section (for audio tracks with multiple clips)
            if (e.shiftKey && e.key === 'W' && selectedAudioRow && activeSection && onUpdateClip) {
                const track = audioTracks.find(t => t.id === selectedAudioRow.trackId);
                const clips = track?.clips?.filter(c => c.sectionId === activeSection) || [];
                if (clips.length >= 2) {
                    e.preventDefault();
                    // Sort by startBar, then swap adjacent pairs' positions
                    const sorted = [...clips].sort((a, b) => (a.startBar || 0) - (b.startBar || 0));
                    const section = arrangement.find(s => s.id === activeSection);
                    const tempo = section?.settings?.tempo || globalTempo;
                    const secondsPerBar = 4 * 60 / tempo;
                    // Recalculate positions with swapped order
                    const reversed = [...sorted].reverse();
                    let bar = 0;
                    for (const clip of reversed) {
                        onUpdateClip(selectedAudioRow.trackId, clip.id, { startBar: Math.round(bar * 1000) / 1000 });
                        const bd = clip.buffer ? clip.buffer.duration : 0;
                        const ed = Math.max(0.01, (bd - (clip.trimStart || 0) - (clip.trimEnd || 0)) / (clip.playbackRate || 1));
                        bar += ed / secondsPerBar;
                    }
                }
            }
            // Shift+S: swap two selected cells from different sections
            if (e.shiftKey && e.key === 'S' && selectedCells.length === 2) {
                e.preventDefault();
                // Check if both are audio cells
                const [cellA, cellB] = selectedCells;
                const rowA = trackRows.find(r => r.id === cellA.rowId);
                const rowB = trackRows.find(r => r.id === cellB.rowId);
                if (rowA?.type === 'audio' && rowB?.type === 'audio' && cellA.rowId === cellB.rowId && cellA.sectionId !== cellB.sectionId) {
                    // Swap audio clips between sections on the same audio track
                    const trackId = rowA.trackId;
                    const track = audioTracks.find(t => t.id === trackId);
                    if (track) {
                        const clipA = track.clips.find(c => c.sectionId === cellA.sectionId);
                        const clipB = track.clips.find(c => c.sectionId === cellB.sectionId);
                        // Swap by updating sectionIds
                        if (clipA && clipB && onUpdateClip) {
                            onUpdateClip(trackId, clipA.id, { sectionId: cellB.sectionId });
                            onUpdateClip(trackId, clipB.id, { sectionId: cellA.sectionId });
                        } else if (clipA && !clipB && onUpdateClip) {
                            onUpdateClip(trackId, clipA.id, { sectionId: cellB.sectionId });
                        } else if (!clipA && clipB && onUpdateClip) {
                            onUpdateClip(trackId, clipB.id, { sectionId: cellA.sectionId });
                        }
                        setSelectedCells([]);
                    }
                } else {
                    handleSwapCells();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Drag-and-drop state
    const [dropTarget, setDropTarget] = useState(null); // { rowId, sectionId }

    const handleDragOver = useCallback((e, rowId, sectionId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropTarget({ rowId, sectionId, splitMode: (e.ctrlKey || e.metaKey) && e.shiftKey });
    }, []);

    const handleDragLeave = useCallback(() => {
        setDropTarget(null);
    }, []);

    // Helper: overwrite only the ghost-preview region on existing MIDI clips (trim/split, keep non-overlapping parts)
    const overwriteMidiClipsInRegion = useCallback((targetTrackId, dropStart, dropEnd) => {
        const stepsPerBar = 32;
        const targetMt = midiTracks.find(mt => mt.id === targetTrackId);
        if (!targetMt || !onUpdateMidiClip) return;
        for (const tc of (targetMt.clips || [])) {
            const tcBar = tc.timelineBar || 0;
            const tcBars = tc.bars || 4;
            const tcEnd = tcBar + tcBars;
            if (tcBar >= dropEnd || tcEnd <= dropStart) continue;
            if (tcBar >= dropStart && tcEnd <= dropEnd) {
                if (onRemoveMidiClip) onRemoveMidiClip(targetTrackId, tc.id);
                continue;
            }
            if (tcBar < dropStart && tcEnd > dropEnd) {
                const beforeBars = dropStart - tcBar;
                const beforeSteps = beforeBars * stepsPerBar;
                const beforePattern = (tc.pattern || []).filter(n => n.time < beforeSteps);
                onUpdateMidiClip(targetTrackId, tc.id, { bars: beforeBars, pattern: beforePattern });
                const afterBars = tcEnd - dropEnd;
                const afterStepOffset = (dropEnd - tcBar) * stepsPerBar;
                const afterPattern = (tc.pattern || []).filter(n => n.time >= afterStepOffset).map(n => ({ ...n, time: n.time - afterStepOffset }));
                if (onAddMidiClip) onAddMidiClip(targetTrackId, {
                    timelineBar: dropEnd, bars: afterBars, pattern: afterPattern,
                    name: tc.name || 'MIDI Clip', color: tc.color || null
                });
            } else if (tcBar < dropStart) {
                const keepBars = dropStart - tcBar;
                const keepSteps = keepBars * stepsPerBar;
                const trimmedPattern = (tc.pattern || []).filter(n => n.time < keepSteps);
                onUpdateMidiClip(targetTrackId, tc.id, { bars: keepBars, pattern: trimmedPattern });
            } else {
                const chopBars = dropEnd - tcBar;
                const chopSteps = chopBars * stepsPerBar;
                const remainBars = tcEnd - dropEnd;
                const shiftedPattern = (tc.pattern || []).filter(n => n.time >= chopSteps).map(n => ({ ...n, time: n.time - chopSteps }));
                onUpdateMidiClip(targetTrackId, tc.id, { timelineBar: dropEnd, bars: remainBars, pattern: shiftedPattern });
            }
        }
    }, [midiTracks, onUpdateMidiClip, onRemoveMidiClip, onAddMidiClip]);

    // Helper: overwrite only the ghost-preview region on existing drum lane clips
    const overwriteDrumLaneClipsInRegion = useCallback((drumId, dropStart, dropEnd) => {
        const stepsPerBar = 32;
        const clips = drumLaneClips[drumId] || [];
        for (const tc of clips) {
            const tcBar = tc.timelineBar || 0;
            const tcBars = tc.bars || 4;
            const tcEnd = tcBar + tcBars;
            if (tcBar >= dropEnd || tcEnd <= dropStart) continue;
            if (tcBar >= dropStart && tcEnd <= dropEnd) {
                if (onRemoveDrumLaneClip) onRemoveDrumLaneClip(drumId, tc.id);
                continue;
            }
            if (onUpdateDrumLaneClip) {
                if (tcBar < dropStart && tcEnd > dropEnd) {
                    const beforeBars = dropStart - tcBar;
                    const beforeSteps = beforeBars * stepsPerBar;
                    const beforeLaneData = tc.laneData ? JSON.parse(JSON.stringify(tc.laneData)) : null;
                    if (beforeLaneData?.lanes) {
                        for (const lane of Object.values(beforeLaneData.lanes)) {
                            if (lane.pattern) lane.pattern = lane.pattern.slice(0, beforeSteps);
                            if (lane.velocity) lane.velocity = lane.velocity.slice(0, beforeSteps);
                            if (lane.duration) lane.duration = lane.duration.slice(0, beforeSteps);
                        }
                    }
                    onUpdateDrumLaneClip(drumId, tc.id, { bars: beforeBars, laneData: beforeLaneData });
                    const afterBars = tcEnd - dropEnd;
                    const afterStepOffset = (dropEnd - tcBar) * stepsPerBar;
                    const afterLaneData = tc.laneData ? JSON.parse(JSON.stringify(tc.laneData)) : null;
                    if (afterLaneData?.lanes) {
                        for (const lane of Object.values(afterLaneData.lanes)) {
                            if (lane.pattern) lane.pattern = lane.pattern.slice(afterStepOffset);
                            if (lane.velocity) lane.velocity = lane.velocity.slice(afterStepOffset);
                            if (lane.duration) lane.duration = lane.duration.slice(afterStepOffset);
                        }
                    }
                    if (onAddDrumLaneClip) onAddDrumLaneClip(drumId, {
                        timelineBar: dropEnd, bars: afterBars, laneData: afterLaneData,
                        name: tc.name || drumId, color: tc.color || null
                    });
                } else if (tcBar < dropStart) {
                    const keepBars = dropStart - tcBar;
                    const keepSteps = keepBars * stepsPerBar;
                    const trimmedLaneData = tc.laneData ? JSON.parse(JSON.stringify(tc.laneData)) : null;
                    if (trimmedLaneData?.lanes) {
                        for (const lane of Object.values(trimmedLaneData.lanes)) {
                            if (lane.pattern) lane.pattern = lane.pattern.slice(0, keepSteps);
                            if (lane.velocity) lane.velocity = lane.velocity.slice(0, keepSteps);
                            if (lane.duration) lane.duration = lane.duration.slice(0, keepSteps);
                        }
                    }
                    onUpdateDrumLaneClip(drumId, tc.id, { bars: keepBars, laneData: trimmedLaneData });
                } else {
                    const chopBars = dropEnd - tcBar;
                    const chopSteps = chopBars * stepsPerBar;
                    const remainBars = tcEnd - dropEnd;
                    const shiftedLaneData = tc.laneData ? JSON.parse(JSON.stringify(tc.laneData)) : null;
                    if (shiftedLaneData?.lanes) {
                        for (const lane of Object.values(shiftedLaneData.lanes)) {
                            if (lane.pattern) lane.pattern = lane.pattern.slice(chopSteps);
                            if (lane.velocity) lane.velocity = lane.velocity.slice(chopSteps);
                            if (lane.duration) lane.duration = lane.duration.slice(chopSteps);
                        }
                    }
                    onUpdateDrumLaneClip(drumId, tc.id, { timelineBar: dropEnd, bars: remainBars, laneData: shiftedLaneData });
                }
            }
        }
    }, [drumLaneClips, onUpdateDrumLaneClip, onRemoveDrumLaneClip, onAddDrumLaneClip]);

    // Helper: overwrite note clips (chords/melody/bass) in a region
    const overwriteNoteClipsInRegion = useCallback((trackKey, dropStart, dropEnd) => {
        const stepsPerBar = 32;
        const clipMap = { chords: chordClips, melody: melodyClips, bass: bassClips };
        const updateMap = { chords: onUpdateChordClip, melody: onUpdateMelodyClip, bass: onUpdateBassClip };
        const removeMap = { chords: onRemoveChordClip, melody: onRemoveMelodyClip, bass: onRemoveBassClip };
        const addMap = { chords: onAddChordClip, melody: onAddMelodyClip, bass: onAddBassClip };
        const clips = clipMap[trackKey] || [];
        const updateFn = updateMap[trackKey];
        const removeFn = removeMap[trackKey];
        const addFn = addMap[trackKey];
        if (!updateFn) return;
        for (const tc of clips) {
            const tcBar = tc.timelineBar || 0;
            const tcBars = tc.bars || 4;
            const tcEnd = tcBar + tcBars;
            if (tcBar >= dropEnd || tcEnd <= dropStart) continue;
            if (tcBar >= dropStart && tcEnd <= dropEnd) {
                if (removeFn) removeFn(tc.id);
                continue;
            }
            if (tcBar < dropStart && tcEnd > dropEnd) {
                const beforeBars = dropStart - tcBar;
                const beforeSteps = beforeBars * stepsPerBar;
                const beforePattern = (tc.pattern || []).filter(n => n.time < beforeSteps);
                updateFn(tc.id, { bars: beforeBars, pattern: beforePattern });
                const afterBars = tcEnd - dropEnd;
                const afterStepOffset = (dropEnd - tcBar) * stepsPerBar;
                const afterPattern = (tc.pattern || []).filter(n => n.time >= afterStepOffset).map(n => ({ ...n, time: n.time - afterStepOffset }));
                if (addFn) addFn({ timelineBar: dropEnd, bars: afterBars, pattern: afterPattern, name: tc.name || `${trackKey} Clip`, color: tc.color || null });
            } else if (tcBar < dropStart) {
                const keepBars = dropStart - tcBar;
                const keepSteps = keepBars * stepsPerBar;
                const trimmedPattern = (tc.pattern || []).filter(n => n.time < keepSteps);
                updateFn(tc.id, { bars: keepBars, pattern: trimmedPattern });
            } else {
                const chopBars = dropEnd - tcBar;
                const chopSteps = chopBars * stepsPerBar;
                const remainBars = tcEnd - dropEnd;
                const shiftedPattern = (tc.pattern || []).filter(n => n.time >= chopSteps).map(n => ({ ...n, time: n.time - chopSteps }));
                updateFn(tc.id, { timelineBar: dropEnd, bars: remainBars, pattern: shiftedPattern });
            }
        }
    }, [chordClips, melodyClips, bassClips, onUpdateChordClip, onUpdateMelodyClip, onUpdateBassClip, onRemoveChordClip, onRemoveMelodyClip, onRemoveBassClip, onAddChordClip, onAddMelodyClip, onAddBassClip]);

    // Helper: overwrite collapsed drum clips in a region (split/trim, keep non-overlapping parts)
    const overwriteDrumClipsInRegion = useCallback((dropStart, dropEnd) => {
        for (const tc of drumClips) {
            const tcBar = tc.timelineBar || 0;
            const tcBars = tc.bars || 4;
            const tcEnd = tcBar + tcBars;
            if (tcBar >= dropEnd || tcEnd <= dropStart) continue;
            if (tcBar >= dropStart && tcEnd <= dropEnd) {
                if (onRemoveDrumClip) onRemoveDrumClip(tc.id);
                continue;
            }
            if (onUpdateDrumClip) {
                if (tcBar < dropStart && tcEnd > dropEnd) {
                    // Straddles — trim to before, create tail after
                    const beforeBars = dropStart - tcBar;
                    onUpdateDrumClip(tc.id, { bars: beforeBars });
                    const afterBars = tcEnd - dropEnd;
                    if (onAddDrumClip) onAddDrumClip({
                        timelineBar: dropEnd, bars: afterBars,
                        drumStates: tc.drumStates ? JSON.parse(JSON.stringify(tc.drumStates)) : {},
                        name: tc.name || 'Drums', color: tc.color || null
                    });
                } else if (tcBar < dropStart) {
                    onUpdateDrumClip(tc.id, { bars: dropStart - tcBar });
                } else {
                    const chopBars = dropEnd - tcBar;
                    onUpdateDrumClip(tc.id, { timelineBar: dropEnd, bars: tcEnd - dropEnd });
                }
            }
        }
    }, [drumClips, onUpdateDrumClip, onRemoveDrumClip, onAddDrumClip]);

    // Helper: overwrite audio clips in a region on a specific track (split/trim, keep non-overlapping parts)
    const overwriteAudioClipsInRegion = useCallback((targetTrackId, dropStart, dropEnd) => {
        const targetTrack = audioTracks.find(t => t.id === targetTrackId);
        if (!targetTrack || !onUpdateClip) return;
        const tempo = globalTempo;
        const secondsPerBar = 4 * 60 / tempo;
        for (const tc of (targetTrack.clips || [])) {
            const tcBar = tc.timelineBar ?? 0;
            const tcBufDur = tc.buffer ? tc.buffer.duration : 0;
            const tcRate = tc.playbackRate || 1;
            const tcTrimS = tc.trimStart || 0;
            const tcTrimE = tc.trimEnd || 0;
            const tcEffDur = Math.max(0.01, (tcBufDur - tcTrimS - tcTrimE) / tcRate);
            const tcEndBar = tcBar + tcEffDur / secondsPerBar;
            if (tcBar >= dropEnd || tcEndBar <= dropStart) continue;
            if (tcBar >= dropStart && tcEndBar <= dropEnd) {
                if (onRemoveClip) onRemoveClip(targetTrackId, tc.id);
                continue;
            }
            if (tcBar < dropStart && tcEndBar > dropEnd) {
                // Straddles — trim end to dropStart, create tail after dropEnd
                const beforeEndSec = (dropStart - tcBar) * secondsPerBar;
                const newTrimEnd = tcBufDur - tcTrimS - beforeEndSec * tcRate;
                onUpdateClip(targetTrackId, tc.id, { trimEnd: Math.max(0, newTrimEnd) });
                const afterStartSec = (dropEnd - tcBar) * secondsPerBar;
                const newTailTrimStart = tcTrimS + afterStartSec * tcRate;
                if (onAddClip) {
                    const dropSec = arrangement[0]?.id;
                    onAddClip(targetTrackId, dropSec, tc.buffer, tc.name, {
                        playbackRate: tcRate, trimStart: newTailTrimStart, trimEnd: tcTrimE,
                        reversed: tc.reversed, pitch: tc.pitch, fadeIn: 0, fadeOut: tc.fadeOut,
                        startBar: 0, timelineBar: dropEnd
                    });
                }
            } else if (tcBar < dropStart) {
                const keepDurSec = (dropStart - tcBar) * secondsPerBar;
                const newTrimEnd = tcBufDur - tcTrimS - keepDurSec * tcRate;
                onUpdateClip(targetTrackId, tc.id, { trimEnd: Math.max(0, newTrimEnd) });
            } else {
                const chopSec = (dropEnd - tcBar) * secondsPerBar;
                const newTrimStart = tcTrimS + chopSec * tcRate;
                onUpdateClip(targetTrackId, tc.id, { trimStart: newTrimStart, timelineBar: dropEnd });
            }
        }
    }, [audioTracks, onUpdateClip, onRemoveClip, onAddClip, arrangement, globalTempo]);

    const handleDrop = useCallback((e, row, section, dropBarOverride) => {
        e.preventDefault();
        setDropTarget(null);
        setClipDropGhost(null);

        // ── Internal clip drag between tracks ──
        const clipData = e.dataTransfer.getData('application/x-wavloom-clip');
        if (clipData && row.type === 'audio' && onAddClip && onRemoveClip) {
            try {
                const { clipId, trackId: srcTrackId } = JSON.parse(clipData);
                const targetTrackId = row.trackId;
                // Find the source clip
                const srcTrack = audioTracks.find(t => t.id === srcTrackId);
                const srcClip = srcTrack?.clips?.find(c => c.id === clipId);
                if (!srcClip) return;

                // Compute drop bar from mouse position
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                const dropBar = dropBarOverride != null ? dropBarOverride : Math.max(0, relX / (zoom || DEFAULT_PX_PER_BAR));
                const roundedBar = Math.round(dropBar * 100) / 100;

                // Compute clip duration in bars for overwrite check
                const tempo = section?.settings?.tempo || globalTempo;
                const secondsPerBar = 4 * 60 / tempo;
                const bufDur = srcClip.buffer ? srcClip.buffer.duration : 0;
                const effectiveDur = Math.max(0.01, (bufDur - (srcClip.trimStart || 0) - (srcClip.trimEnd || 0)) / (srcClip.playbackRate || 1));
                const clipBars = effectiveDur / secondsPerBar;

                // Overwrite only the ghost-preview region: trim/split existing clips, keep non-overlapping parts
                const dropStart = roundedBar;
                const dropEnd = roundedBar + clipBars;
                const targetTrack = audioTracks.find(t => t.id === targetTrackId);
                if (targetTrack && onUpdateClip) {
                    for (const tc of targetTrack.clips) {
                        const tcBar = tc.timelineBar ?? 0;
                        const tcBufDur = tc.buffer ? tc.buffer.duration : 0;
                        const tcRate = tc.playbackRate || 1;
                        const tcTrimS = tc.trimStart || 0;
                        const tcTrimE = tc.trimEnd || 0;
                        const tcEffDur = Math.max(0.01, (tcBufDur - tcTrimS - tcTrimE) / tcRate);
                        const tcEndBar = tcBar + tcEffDur / secondsPerBar;
                        // No overlap — skip
                        if (tcBar >= dropEnd || tcEndBar <= dropStart) continue;
                        // Fully covered — remove entirely
                        if (tcBar >= dropStart && tcEndBar <= dropEnd) {
                            onRemoveClip(targetTrackId, tc.id);
                            continue;
                        }
                        // Partial overlap — trim the existing clip
                        if (tcBar < dropStart && tcEndBar > dropEnd) {
                            // Existing clip straddles the drop zone — trim end to dropStart, add tail after dropEnd
                            const beforeEndSec = (dropStart - tcBar) * secondsPerBar;
                            const newTrimEnd = tcBufDur - tcTrimS - beforeEndSec * tcRate;
                            onUpdateClip(targetTrackId, tc.id, { trimEnd: Math.max(0, newTrimEnd) });
                            // Create a tail clip for the part after the drop zone
                            const afterStartSec = (dropEnd - tcBar) * secondsPerBar;
                            const newTailTrimStart = tcTrimS + afterStartSec * tcRate;
                            const dropSec = section?.id || arrangement[0]?.id;
                            onAddClip(targetTrackId, dropSec, tc.buffer, tc.name, {
                                playbackRate: tcRate, trimStart: newTailTrimStart, trimEnd: tcTrimE,
                                reversed: tc.reversed, pitch: tc.pitch, fadeIn: 0, fadeOut: tc.fadeOut,
                                startBar: 0, timelineBar: dropEnd
                            });
                        } else if (tcBar < dropStart) {
                            // Existing clip overlaps on the right — trim its end
                            const keepDurSec = (dropStart - tcBar) * secondsPerBar;
                            const newTrimEnd = tcBufDur - tcTrimS - keepDurSec * tcRate;
                            onUpdateClip(targetTrackId, tc.id, { trimEnd: Math.max(0, newTrimEnd) });
                        } else {
                            // Existing clip overlaps on the left — trim its start, shift position
                            const chopSec = (dropEnd - tcBar) * secondsPerBar;
                            const newTrimStart = tcTrimS + chopSec * tcRate;
                            onUpdateClip(targetTrackId, tc.id, { trimStart: newTrimStart, timelineBar: dropEnd });
                        }
                    }
                }

                // Add the dropped clip to the target track
                const dropSectionId = section?.id || arrangement[0]?.id;
                onAddClip(targetTrackId, dropSectionId, srcClip.buffer, srcClip.name, {
                    playbackRate: srcClip.playbackRate, trimStart: srcClip.trimStart,
                    trimEnd: srcClip.trimEnd, reversed: srcClip.reversed,
                    pitch: srcClip.pitch, fadeIn: srcClip.fadeIn, fadeOut: srcClip.fadeOut,
                    startBar: 0, timelineBar: roundedBar,
                    color: srcClip.color || null
                });

                // Remove from source track (move, not copy) unless Ctrl held
                if (!(e.ctrlKey || e.metaKey) && srcTrackId !== targetTrackId) {
                    onRemoveClip(srcTrackId, clipId);
                }
            } catch (err) {
                console.warn('[ArrangementTimeline] Clip drop error:', err);
            }
            return;
        }

        // ── MIDI clip drag between MIDI tracks ──
        const midiClipData = e.dataTransfer.getData('application/x-wavloom-midi-clip');
        if (midiClipData && row.type === 'midi' && onAddMidiClip) {
            try {
                const { trackId: srcTrackId, clipId: srcClipId, clip: srcClip } = JSON.parse(midiClipData);
                const targetTrackId = row.trackId;
                if (targetTrackId && srcClip) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relX = e.clientX - rect.left;
                    const midiDropBar = dropBarOverride != null ? dropBarOverride : Math.max(0, relX / (zoom || DEFAULT_PX_PER_BAR));
                    const roundedBar = Math.max(0, Math.round(midiDropBar));
                    const srcBars = srcClip.bars || 4;

                    // Overwrite only the ghost-preview region on existing MIDI clips
                    overwriteMidiClipsInRegion(targetTrackId, roundedBar, roundedBar + srcBars);

                    // Add the dropped clip
                    onAddMidiClip(targetTrackId, {
                        timelineBar: roundedBar,
                        bars: srcBars,
                        pattern: (srcClip.pattern || []).map(n => ({ ...n })),
                        name: srcClip.name || t('arrange.midiClip'),
                        color: srcClip.color || null
                    });
                    // If move (no Ctrl), remove from source
                    if (!(e.ctrlKey || e.metaKey) && srcTrackId && srcClipId && onRemoveMidiClip) {
                        onRemoveMidiClip(srcTrackId, srcClipId);
                    }
                }
            } catch (err) {
                console.warn('[ArrangementTimeline] MIDI clip drop error:', err);
            }
            return;
        }

        // Check for internal browser drag (window.draggedItem)
        const internalItem = window.draggedItem;
        // Check for external file drop
        const files = e.dataTransfer.files;
        // Check for JSON data from internal browser
        let jsonData = null;
        try {
            const raw = e.dataTransfer.getData('application/json');
            if (raw) jsonData = JSON.parse(raw);
        } catch (_) { /* ignore */ }

        if (onDropAudio) {
            onDropAudio({
                row,
                section,
                internalItem,
                jsonData,
                files: files?.length > 0 ? Array.from(files) : null,
                ctrlKey: e.ctrlKey || e.metaKey,
                shiftKey: e.shiftKey,
            });
        }
        // Clean up internal drag reference
        window.draggedItem = null;
    }, [onDropAudio, audioTracks, onAddClip, onRemoveClip, onUpdateClip, onUpdateMidiTrackPattern, onAddMidiClip, onRemoveMidiClip, onUpdateMidiClip, overwriteMidiClipsInRegion, arrangement, globalTempo, zoom]);

    // Close context menus
    useEffect(() => {
        if (!contextMenu && !rowContextMenu && !audioClipContextMenu) return;
        const close = () => { setContextMenu(null); setRowContextMenu(null); setAudioClipContextMenu(null); };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [contextMenu, rowContextMenu, audioClipContextMenu]);

    // Section resize via drag handle
    const handleResizeStart = useCallback((e, sectionId, bars) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing({ sectionId, startX: e.clientX, startBars: bars });
    }, []);

    // Handle MIDI section cell resize via right-edge drag
    const handleResizeSection = useCallback((sectionId, newBars) => {
        const section = arrangement.find(s => s.id === sectionId);
        if (!section) return;
        const oldBars = section.bars;
        if (newBars === oldBars || newBars < 1 || newBars > 64) return;
        const newPatterns = loopAllPatterns(section.patterns, oldBars, newBars);
        onUpdateSection(sectionId, { bars: newBars, patterns: newPatterns });
    }, [arrangement, onUpdateSection]);

    // Tile/extend pattern data when section bars increase
    const tilePatterns = useCallback((section, oldBars, newBars) => {
        if (newBars <= oldBars || !section.patterns) return null;
        const oldSteps = oldBars * 32;
        const newSteps = newBars * 32;
        const tiledPatterns = JSON.parse(JSON.stringify(section.patterns));

        // Tile melodic patterns (arrays of {time, duration, note, velocity})
        ['chords', 'melody', 'bass'].forEach(key => {
            const pat = tiledPatterns[key];
            if (!Array.isArray(pat) || pat.length === 0) return;
            const original = pat.filter(n => n.time < oldSteps);
            const tiled = [...original];
            for (let offset = oldSteps; offset < newSteps; offset += oldSteps) {
                original.forEach(n => {
                    const newTime = n.time + offset;
                    if (newTime < newSteps) {
                        tiled.push({ ...n, time: newTime });
                    }
                });
            }
            tiledPatterns[key] = tiled;
        });

        // Tile drum patterns (object with lanes containing boolean arrays)
        if (tiledPatterns.drums && typeof tiledPatterns.drums === 'object') {
            Object.keys(tiledPatterns.drums).forEach(drumId => {
                const drum = tiledPatterns.drums[drumId];
                if (!drum?.lanes) return;
                Object.keys(drum.lanes).forEach(laneId => {
                    const lane = drum.lanes[laneId];
                    if (!lane?.pattern) return;
                    const origPattern = lane.pattern.slice(0, oldSteps);
                    const origVelocity = (lane.velocity || []).slice(0, oldSteps);
                    const origDuration = (lane.duration || []).slice(0, oldSteps);
                    // Extend arrays by tiling
                    lane.pattern = new Array(newSteps).fill(false);
                    lane.velocity = new Array(newSteps).fill(0);
                    lane.duration = new Array(newSteps).fill(0);
                    for (let i = 0; i < newSteps; i++) {
                        const srcIdx = i % oldSteps;
                        lane.pattern[i] = origPattern[srcIdx] || false;
                        lane.velocity[i] = origVelocity[srcIdx] || 0;
                        lane.duration[i] = origDuration[srcIdx] || 0;
                    }
                });
            });
        }
        return tiledPatterns;
    }, []);

    useEffect(() => {
        if (!resizing) return;
        const onMove = (e) => {
            const dx = e.clientX - resizing.startX;
            const barDelta = Math.round(dx / pixelsPerBar);
            const newBars = Math.max(1, Math.min(64, resizing.startBars + barDelta));
            if (newBars !== resizing.currentBars) {
                setResizing(prev => ({ ...prev, currentBars: newBars }));
                // When extending, tile patterns to fill new bars
                const section = arrangement.find(s => s.id === resizing.sectionId);
                if (section && newBars > section.bars) {
                    const tiledPatterns = tilePatterns(section, section.bars, newBars);
                    if (tiledPatterns) {
                        onUpdateSection(resizing.sectionId, { bars: newBars, patterns: tiledPatterns });
                    } else {
                        onUpdateSection(resizing.sectionId, { bars: newBars });
                    }
                } else {
                    onUpdateSection(resizing.sectionId, { bars: newBars });
                }
            }
        };
        const onUp = () => setResizing(null);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [resizing, pixelsPerBar, onUpdateSection, arrangement, tilePatterns]);

    const handleContextMenu = useCallback((e, section) => {
        e.preventDefault();
        e.stopPropagation();
        setRowContextMenu(null);
        setContextMenu({ x: e.clientX, y: e.clientY, section });
    }, []);

    // Right-click on a clip cell (row + section)
    const handleRowContextMenu = useCallback((e, row, section) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu(null);
        setSelectedRow(row.id);
        onSelectSection(section.id);
        setRowContextMenu({ x: e.clientX, y: e.clientY, row, section });
    }, [onSelectSection]);

    const zoomPercent = Math.round((zoom / DEFAULT_PX_PER_BAR) * 100);

    // Stem separation handler (audio and MIDI modes)
    const handleStemSeparation = useCallback(async ({ stems, quality }) => {
        if (!stemSepModal) return;
        const { mode, clip, trackId, sectionId } = stemSepModal;
        setStemProcessing(true);
        setStemProgress(0);

        try {
            if (mode === 'audio') {
                const separator = new StemSeparator();
                const results = await separator.separateStems(
                    clip.buffer, stems, quality,
                    (p) => setStemProgress(p)
                );
                for (const [stemName, stemBuffer] of Object.entries(results)) {
                    if (onAddAudioTrack && onAddClip) {
                        const newTrackId = onAddAudioTrack(`${clip.name || 'Clip'} - ${stemName}`);
                        // Small delay to let React state settle before adding clip
                        await new Promise(r => setTimeout(r, 60));
                        onAddClip(newTrackId, sectionId, stemBuffer, stemName, {
                            startBar: clip.startBar || 0
                        });
                    }
                }
            } else if (mode === 'midi') {
                const analyzer = new AudioAnalyzer();
                const tempo = globalTempo;
                let idx = 0;
                for (const stemType of stems) {
                    const pattern = await analyzer.extractMIDI(clip.buffer, tempo, stemType);
                    const hasData = pattern && (Array.isArray(pattern) ? pattern.length > 0 : Object.keys(pattern).length > 0);
                    if (hasData && onAddMidiTrack) {
                        const newTrackId = onAddMidiTrack(`${clip.name || 'Clip'} - ${stemType}`);
                        await new Promise(r => setTimeout(r, 60));
                        if (onUpdateMidiTrackPattern) {
                            onUpdateMidiTrackPattern(newTrackId, pattern);
                        }
                    }
                    idx++;
                    setStemProgress(idx / stems.length);
                }
            }
        } catch (err) {
            console.error('Stem separation error:', err);
        }

        setStemProcessing(false);
        setStemProgress(0);
        setStemSepModal(null);
    }, [stemSepModal, onAddAudioTrack, onAddClip, onAddMidiTrack, onUpdateMidiTrackPattern, globalTempo]);

    if (arrangement.length === 0) return null;

    const totalTrackHeight = trackRows.reduce((sum, r) => sum + r.height, 0);

    // Style helpers
    const bg = isDark ? '#0c0c11' : '#f7f7fa';
    const bgAlt = isDark ? '#0f0f16' : '#f2f2f6';
    const borderColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    const textMuted = isDark ? '#555' : '#aaa';
    const textLight = isDark ? '#888' : '#777';

    return (
        <div ref={arrangementContainerRef} style={{
            flex: 1,
            height: (isMaximized || isArrangementFullscreen) ? '100%' : undefined,
            display: 'flex',
            flexDirection: 'column',
            background: bg,
            borderTop: `1px solid ${borderColor}`,
            overflow: 'hidden',
            minHeight: 0
        }}>
            {/* Toolbar */}
            <div style={{
                height: '34px',
                minHeight: '34px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                gap: '8px',
                background: isDark ? 'rgba(18,18,24,0.95)' : '#eeeef2',
                borderBottom: `1px solid ${borderColor}`,
                fontSize: '11px',
                fontWeight: '700',
                color: textLight,
                letterSpacing: '0.3px'
            }}>
                <span style={{ color: isDark ? ac : '#e74c3c', fontWeight: '800' }}>{t('arrange.arrangement')}</span>
                <span style={{ opacity: 0.5, fontSize: '10px' }}>
                    {t('arrange.sectionsCount', { count: arrangement.length, max: MAX_SECTIONS, bars: totalBars })}
                </span>
                <span style={{ color: '#ffa94d', fontSize: '10px', fontWeight: '800' }}>
                    {globalIsPlaying ? formatTime(currentPlaybackSeconds) : '0:00'} / {formatTime(timeMarks.totalSeconds)}
                </span>
                {loopSectionIds.size > 0 && (
                    <span
                        onClick={onClearSectionLoop}
                        title={t('arrange.clearLoop')}
                        style={{ color: '#64c8ff', fontSize: '9px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.5px' }}
                    >
                        ⟳ {t('arrange.loopCount', { count: loopSectionIds.size })}
                    </span>
                )}
                {stopMarkerBar != null && (
                    <span
                        onClick={onClearStopMarker}
                        title={t('arrange.clearStopMarker')}
                        style={{ color: ac, fontSize: '9px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.5px' }}
                    >
                        ⏹ {t('arrange.stopAt', { bar: stopMarkerBar + 1 })}
                    </span>
                )}

                {/* Zoom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '8px' }}>
                    <ZoomBtn label="-" title={t('arrange.zoomOut')} onClick={zoomOut} isDark={isDark} />
                    <span
                        onClick={zoomToFit}
                        title={t('arrange.zoomToFit')}
                        style={{ fontSize: '9px', fontWeight: '700', color: textMuted, minWidth: '34px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                    >
                        {zoomPercent}%
                    </span>
                    <ZoomBtn label="+" title={t('arrange.zoomIn')} onClick={zoomIn} isDark={isDark} />
                </div>

                {/* Recording controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
                    {isRecording ? (
                        <>
                            <button
                                onClick={onStopRecording}
                                title={t('arrange.stopRecording')}
                                style={{
                                    width: '22px', height: '22px', borderRadius: '4px',
                                    background: '#ff4444', border: '2px solid #ff6666',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', padding: 0,
                                    animation: 'none', boxShadow: '0 0 8px rgba(255,68,68,0.6)'
                                }}
                            >
                                <span style={{ display: 'block', width: '8px', height: '8px', background: '#fff', borderRadius: '1px' }} />
                            </button>
                            <span style={{
                                fontSize: '10px', fontWeight: '800', color: '#ff4444',
                                fontFamily: 'monospace', letterSpacing: '1px', minWidth: '48px'
                            }}>
                                ● {Math.floor(recordingElapsed / 60)}:{String(Math.floor(recordingElapsed % 60)).padStart(2, '0')}
                            </span>
                        </>
                    ) : isCountingIn ? (
                        <>
                            <div style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: '#ffa94d', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', boxShadow: '0 0 8px rgba(255,169,77,0.5)'
                            }}>
                                <span style={{ fontSize: '12px', fontWeight: '900', color: '#fff' }}>
                                    {countInBeat?.beat || ''}
                                </span>
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: '#ffa94d', letterSpacing: '0.5px' }}>
                                {countInBeat ? t('arrange.countInProgress', { beat: countInBeat.beat, total: countInBeat.total }) : `${t('arrange.countIn')}...`}
                            </span>
                        </>
                    ) : (
                        <button
                            onClick={onStartRecording}
                            title={t('arrange.recordAudio')}
                            style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: 'transparent', border: `2px solid ${isDark ? '#ff4444' : '#cc3333'}`,
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', padding: 0, transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,68,68,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <span style={{
                                display: 'block', width: '10px', height: '10px',
                                borderRadius: '50%', background: isDark ? '#ff4444' : '#cc3333'
                            }} />
                        </button>
                    )}
                </div>

                {/* Selection info */}
                {selectedCells.length > 0 ? (
                    <span style={{ fontSize: '9px', color: '#69db7c', fontWeight: '700' }}>
                        ● {t('arrange.selectedCount', { count: selectedCells.length })}
                    </span>
                ) : selectedRow ? (
                    <span style={{ fontSize: '9px', color: trackRows.find(r => r.id === selectedRow)?.color || textMuted, fontWeight: '700' }}>
                        ● {trackRows.find(r => r.id === selectedRow)?.label}
                    </span>
                ) : null}

                {/* Actions */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <button onClick={() => { onUndoArrangement(); if (onUndoAudio) onUndoAudio(); }} disabled={!canUndoArrangement} title={t('arrange.undo')} style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#e8e8ec',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#d5d5d9'}`,
                        borderRadius: '3px', color: isDark ? '#888' : '#666',
                        fontSize: '13px', fontWeight: '800', width: '24px', height: '20px',
                        cursor: canUndoArrangement ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                        opacity: canUndoArrangement ? 1 : 0.3
                    }}>↶</button>
                    <button onClick={() => { onRedoArrangement(); if (onRedoAudio) onRedoAudio(); }} disabled={!canRedoArrangement} title={t('arrange.redo')} style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#e8e8ec',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#d5d5d9'}`,
                        borderRadius: '3px', color: isDark ? '#888' : '#666',
                        fontSize: '13px', fontWeight: '800', width: '24px', height: '20px',
                        cursor: canRedoArrangement ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                        opacity: canRedoArrangement ? 1 : 0.3
                    }}>↷</button>
                    {/* + SECTION button removed — continuous timeline */}
                    {onAddAudioTrack && (
                        <ActionBtn label={t('arrange.addAudio')} color="#ff9ff3" isDark={isDark} disabled={addCooldown || audioTracks.length >= 100}
                            onClick={() => {
                                if (addCooldownRef.current || audioTracks.length >= 100) return;
                                addCooldownRef.current = true;
                                setAddCooldown(true);
                                const newId = onAddAudioTrack();
                                if (newId) setSelectedRow(`audio-${newId}`);
                            }} />
                    )}
                    {onAddMidiTrack && (
                        <ActionBtn label={t('arrange.addMidi')} color="#c56cf0" isDark={isDark} disabled={addCooldown || midiTracks.length >= 100}
                            onClick={() => {
                                if (addCooldownRef.current || midiTracks.length >= 100) return;
                                addCooldownRef.current = true;
                                setAddCooldown(true);
                                const newId = onAddMidiTrack();
                                if (newId) setSelectedRow(`midi-${newId}`);
                            }} />
                    )}
                    <span style={{ fontSize: '9px', fontWeight: 600, opacity: 0.7, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#c56cf0' }}>{t('arrange.midiTracksCount', { count: midiTracks.length, max: 100 })}</span>
                        <span style={{ color: isDark ? '#555' : '#aaa', margin: '0 4px' }}>|</span>
                        <span style={{ color: '#ff9ff3' }}>{t('arrange.audioTracksCount', { count: audioTracks.length, max: 100 })}</span>
                    </span>
                    {selectedRow && (
                        <ActionBtn
                            label={t('arrange.genRow', { label: (trackRows.find(r => r.id === selectedRow)?.label || 'ROW').toUpperCase() })}
                            color={trackRows.find(r => r.id === selectedRow)?.color || acSec}
                            isDark={isDark}
                            disabled={genCooldownRef.current}
                            onClick={() => {
                                if (genCooldownRef.current) return;
                                genCooldownRef.current = true;
                                requestAnimationFrame(() => { genCooldownRef.current = false; });
                                onGenerateSection(selectedRow);
                            }}
                        />
                    )}
                    <ActionBtn
                        label={selectedCells.length > 0 ? t('arrange.genSelected', { count: selectedCells.length }) : t('arrange.genAll')}
                        color="#69db7c" isDark={isDark}
                        disabled={genCooldownRef.current}
                        onClick={() => {
                            if (genCooldownRef.current) return;
                            genCooldownRef.current = true;
                            requestAnimationFrame(() => { genCooldownRef.current = false; });
                            if (selectedCells.length > 0) {
                                if (onGenerateSelected) {
                                    onGenerateSelected(selectedCells.map(cell => cell.rowId));
                                } else {
                                    selectedCells.forEach(cell => onGenerateSection(cell.rowId));
                                }
                            } else {
                                onGenerateAll();
                            }
                        }}
                    />
                    {onGenerateAllMixed && (
                        <ActionBtn
                            label={t('arrange.genAllMixed')}
                            color="#ffd43b" isDark={isDark}
                            disabled={genCooldownRef.current}
                            onClick={() => {
                                if (genCooldownRef.current) return;
                                genCooldownRef.current = true;
                                requestAnimationFrame(() => { genCooldownRef.current = false; });
                                onGenerateAllMixed();
                            }}
                        />
                    )}
                    <ActionBtn label={showMixer ? t('arrange.hideMix') : t('arrange.mix')} color="#9775fa" isDark={isDark} onClick={() => {
                        if (mixCooldownRef.current) return;
                        mixCooldownRef.current = true;
                        requestAnimationFrame(() => { mixCooldownRef.current = false; });
                        setShowMixer(prev => !prev);
                    }} />
                    <div
                        onClick={toggleArrangementFullscreen}
                        title={isArrangementFullscreen ? t('arrange.restore') : t('arrange.fullScreen')}
                        style={{
                            width: '28px',
                            height: '28px',
                            color: isDark ? ac : '#333',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            transition: 'all 0.2s',
                            background: 'transparent',
                            flexShrink: 0
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : 'rgba(0,0,0,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <span style={{ fontSize: '15px' }}>
                            {isArrangementFullscreen ? '⧉' : '⛶'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main area: Labels + Timeline + Mixer */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                {/* Track labels (fixed left column) */}
                <div style={{
                    width: `${TRACK_LABEL_WIDTH}px`,
                    minWidth: `${TRACK_LABEL_WIDTH}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: `1px solid ${borderColor}`,
                    background: isDark ? '#0a0a0f' : '#f0f0f4',
                    overflow: 'hidden'
                }}>
                    {/* Ruler spacer */}
                    <div style={{ height: '36px', minHeight: '36px', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '8px', fontWeight: '700', color: textMuted, letterSpacing: '0.5px' }}>{t('arrange.barTime')}</span>
                    </div>

                    {/* Locator label spacer */}
                    <div style={{
                        height: '14px', minHeight: '14px',
                        display: 'flex', alignItems: 'center', padding: '0 6px',
                        borderBottom: `1px solid ${borderColor}`,
                        fontSize: '7px', fontWeight: '700', color: textMuted, letterSpacing: '0.5px',
                        background: isDark ? 'rgba(10,10,15,0.9)' : '#e8e8ec'
                    }}>
                        {loopRangeBars ? '⟳' : ''}{stopMarkerBar != null ? ' ⏹' : ''}
                    </div>

                    {/* Preview strip spacer — matches PatternPreviewStrip height on right */}
                    <div style={{
                        height: '60px', minHeight: '60px',
                        display: 'flex', alignItems: 'center', padding: '0 8px',
                        borderBottom: `1px solid ${borderColor}`,
                        fontSize: '8px', fontWeight: '800', color: textMuted, letterSpacing: '1px'
                    }}>
                        {t('arrange.sections')}
                    </div>

                    {/* Track label rows — overflow:hidden, synced from content scroll */}
                    <div ref={labelScrollRef} style={{ flex: 1, overflowY: 'hidden', overflowX: 'hidden' }}>
                        {trackRows.map((row, ri) => {
                            const isFirstDrum = row.id === 'drums-all';
                            const isSelected = selectedRow === row.id;
                            return (
                                <React.Fragment key={row.id}>
                                    {/* Group headers removed — collapse arrows now built into each row */}
                                    <div
                                        onClick={(e) => {
                                            if (e.shiftKey && selectedRow) {
                                                // Shift+click: range select between selectedRow and this row
                                                const startIdx = trackRows.findIndex(r => r.id === selectedRow);
                                                const endIdx = trackRows.findIndex(r => r.id === row.id);
                                                if (startIdx >= 0 && endIdx >= 0) {
                                                    const lo = Math.min(startIdx, endIdx);
                                                    const hi = Math.max(startIdx, endIdx);
                                                    const newSet = new Set(selectedRows);
                                                    for (let i = lo; i <= hi; i++) {
                                                        if (trackRows[i].type === 'audio' || trackRows[i].type === 'midi') {
                                                            newSet.add(trackRows[i].id);
                                                        }
                                                    }
                                                    setSelectedRows(newSet);
                                                }
                                            } else if (e.ctrlKey || e.metaKey) {
                                                // Ctrl+click: toggle individual in multi-select
                                                const newSet = new Set(selectedRows);
                                                if (newSet.has(row.id)) newSet.delete(row.id);
                                                else newSet.add(row.id);
                                                setSelectedRows(newSet);
                                                setSelectedRow(row.id);
                                            } else {
                                                setSelectedRow(isSelected ? null : row.id);
                                                setSelectedRows(new Set());
                                            }
                                        }}
                                        onDoubleClick={(row.type === 'audio' && onRenameAudioTrack) || (row.type === 'midi' && onRenameMidiTrack) ? (e) => {
                                            e.stopPropagation();
                                            setRenamingAudioTrack(row.trackId);
                                            setRenameValue(row.label);
                                        } : undefined}
                                        draggable={row.type !== 'drum' && !renamingAudioTrack}
                                        onDragStart={row.type !== 'drum' ? (e) => {
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData('text/plain', row.id);
                                            setSelectedRow(row.id); // Select the track being dragged
                                            setDragReorderRow({ rowId: row.id, type: row.type, trackId: row.trackId || row.id, orderId: row.orderEntry?.id || row.id });
                                        } : undefined}
                                        onDragOver={(e) => {
                                            // Case 1: Row reorder — any non-drum-lane row can be a target
                                            if (dragReorderRow && row.type !== 'drum') {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                                if (dragReorderTarget !== row.id) setDragReorderTarget(row.id);
                                                return;
                                            }
                                            // Case 2: Effect drag from Browser
                                            if (e.dataTransfer.types.includes('application/x-wavloom-effect')) {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'copy';
                                                return;
                                            }
                                            // Case 3: External item drag (VST3 plugin, audio/MIDI file from Browser)
                                            if (!dragReorderRow && (window.draggedItem || (e.dataTransfer.types && (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('Files'))))) {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'copy';
                                            }
                                        }}
                                        onDragLeave={() => { if (dragReorderTarget === row.id) setDragReorderTarget(null); }}
                                        onDrop={(e) => {
                                            // Case 1: Unified row reorder
                                            if (dragReorderRow && row.type !== 'drum') {
                                                e.preventDefault();
                                                const srcOrderId = dragReorderRow.orderId;
                                                const targetOrderId = row.orderEntry?.id || row.id;
                                                if (srcOrderId !== targetOrderId && onMoveTrackToIndex) {
                                                    const order = trackOrder || [];
                                                    const targetIdx = order.findIndex(en => en.id === targetOrderId);
                                                    if (targetIdx >= 0) {
                                                        onMoveTrackToIndex(srcOrderId, targetIdx);
                                                    }
                                                }
                                                setSelectedRow(dragReorderRow.rowId); // Keep dragged track selected after drop
                                                setDragReorderRow(null);
                                                setDragReorderTarget(null);
                                                return;
                                            }
                                            // Case 2: Effect drop from Browser → add effect to this row's track (max 5 of same type)
                                            const effectType = e.dataTransfer.getData('application/x-wavloom-effect');
                                            if (effectType && effectsManager) {
                                                e.preventDefault();
                                                const c = effectsManager.getOrCreateTrackChain(row.effectTrackId || row.id);
                                                if (c.effects.filter(ef => ef.name === effectType).length >= 5) return;
                                                const fx = AudioEffect.create(effectType);
                                                if (fx) {
                                                    c.addEffect(fx);
                                                    if (onEffectsChanged) onEffectsChanged();
                                                    setSelectedRow(row.id);
                                                    setShowDetailPanel(true);
                                                }
                                                return;
                                            }
                                            // Case 3: External drop (VST3 plugin, audio file, MIDI file from Browser)
                                            if (!dragReorderRow) {
                                                e.preventDefault();
                                                const internalItem = window.draggedItem;
                                                let jsonData = null;
                                                try {
                                                    const raw = e.dataTransfer.getData('application/json');
                                                    if (raw) jsonData = JSON.parse(raw);
                                                } catch (_) { /* ignore */ }
                                                const files = e.dataTransfer.files;
                                                // Track labels have no section — use activeSection, fallback to first
                                                const targetSection = arrangement.find(s => s.id === activeSection) || arrangement[0];
                                                if (targetSection && onDropAudio) {
                                                    onDropAudio({
                                                        row,
                                                        section: targetSection,
                                                        internalItem,
                                                        jsonData,
                                                        files: files?.length > 0 ? Array.from(files) : null,
                                                        ctrlKey: e.ctrlKey || e.metaKey,
                                                        shiftKey: e.shiftKey,
                                                    });
                                                }
                                                window.draggedItem = null;
                                            }
                                        }}
                                        onDragEnd={() => { setDragReorderRow(null); setDragReorderTarget(null); }}
                                        style={(() => {
                                            let lblMuteId = null;
                                            if (row.type === 'drum' || row.type === 'drums-all') lblMuteId = 'drums';
                                            else if (row.type === 'melodic') lblMuteId = row.trackKey || row.id;
                                            else if (row.type === 'audio' || row.type === 'midi') lblMuteId = row.trackId;
                                            const lblMuted = lblMuteId && globalMutes.has(lblMuteId);
                                            const lblSoloed = lblMuteId && globalSolos.has(lblMuteId);
                                            const lblAnyS = globalSolos.size > 0;
                                            const lblDim = lblMuted || (lblAnyS && !lblSoloed);
                                            const isDragTarget = dragReorderTarget === row.id && dragReorderRow?.rowId !== row.id;
                                            return {
                                                height: `${row.height}px`,
                                                boxSizing: 'border-box',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0 4px 0 8px',
                                                gap: '4px',
                                                borderBottom: `1px solid ${borderColor}`,
                                                cursor: (row.type === 'midi' || row.type === 'audio') ? 'grab' : 'default',
                                                userSelect: 'none',
                                                borderLeft: (isSelected || selectedRows.has(row.id)) ? `3px solid ${row.color}` : '3px solid transparent',
                                                background: isDragTarget
                                                    ? (isDark ? `${row.color}30` : `${row.color}25`)
                                                    : selectedRows.has(row.id)
                                                        ? (isDark ? `${row.color}22` : `${row.color}20`)
                                                        : isSelected
                                                            ? (isDark ? `${row.color}22` : `${row.color}28`)
                                                            : ri % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.015)'),
                                                borderTop: isDragTarget ? `2px solid ${row.color}` : undefined,
                                                transition: 'background 0.1s, border-left 0.1s, opacity 0.15s',
                                                opacity: lblDim ? 0.5 : (dragReorderRow?.rowId === row.id ? 0.4 : 1)
                                            };
                                        })()}>
                                        {/* Collapse arrow (for collapsible rows) */}
                                        {row.collapsible ? (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); toggleCollapse(row.collapseId); }}
                                                style={{
                                                    width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '8px', color: isDark ? '#888' : '#777', cursor: 'pointer', flexShrink: 0,
                                                    transition: 'transform 0.15s',
                                                    transform: row.isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'
                                                }}
                                            >▶</div>
                                        ) : <div style={{ width: 14, flexShrink: 0 }} />}
                                        {/* VU Meter bar */}
                                        {(() => {
                                            const mid = row.type === 'drum' ? `drum_${row.drumId}`
                                                : row.type === 'drums-all' ? 'drums'
                                                : row.type === 'melodic' ? (row.trackKey || row.id)
                                                : (row.trackId || row.id);
                                            // Store color mapping for the flash animation loop
                                            labelColorMapRef.current.set(mid, row.color);
                                            return (
                                                <div style={{
                                                    width: 6, height: row.height - 6,
                                                    position: 'relative', flexShrink: 0,
                                                    borderRadius: 3, overflow: 'hidden',
                                                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                                }}>
                                                    <div
                                                        ref={el => { if (el) meterElsRef.current.set(mid, el); else meterElsRef.current.delete(mid); }}
                                                        style={{
                                                            position: 'absolute', bottom: 0, width: '100%',
                                                            height: '0%',
                                                            background: `linear-gradient(to top, ${row.color}, ${row.color}cc)`,
                                                            borderRadius: 3,
                                                            transition: 'height 0.06s linear'
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })()}
                                        {renamingAudioTrack === row.trackId ? (
                                            <input
                                                autoFocus
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value.slice(0, 30))}
                                                onBlur={() => {
                                                    if (renameValue.trim()) {
                                                        if (row.type === 'midi' && onRenameMidiTrack) onRenameMidiTrack(row.trackId, renameValue.trim());
                                                        else if (onRenameAudioTrack) onRenameAudioTrack(row.trackId, renameValue.trim());
                                                    }
                                                    setRenamingAudioTrack(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        if (renameValue.trim()) {
                                                            if (row.type === 'midi' && onRenameMidiTrack) onRenameMidiTrack(row.trackId, renameValue.trim());
                                                            else if (onRenameAudioTrack) onRenameAudioTrack(row.trackId, renameValue.trim());
                                                        }
                                                        setRenamingAudioTrack(null);
                                                    }
                                                    if (e.key === 'Escape') setRenamingAudioTrack(null);
                                                    e.stopPropagation();
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                maxLength={30}
                                                style={{
                                                    fontSize: '9px', fontWeight: '700', background: isDark ? '#1a1a22' : '#fff',
                                                    color: row.color, border: `1px solid ${row.color}`,
                                                    borderRadius: '2px', outline: 'none', padding: '0 3px',
                                                    width: '100%', height: '16px', fontFamily: 'inherit'
                                                }}
                                            />
                                        ) : (() => {
                                            const pluginInfo = row.vst3Plugin || row.vst3Instrument;
                                            const pluginName = pluginInfo?.name;
                                            // Only show plugin badge if name differs from track label
                                            const showPluginBadge = pluginInfo && pluginName && pluginName !== row.label;
                                            const tooltipText = pluginName && pluginName !== row.label
                                                ? `${row.label} — ${pluginName}` : row.label;
                                            const labelMid = row.type === 'drum' ? `drum_${row.drumId}`
                                                : row.type === 'drums-all' ? 'drums'
                                                : row.type === 'melodic' ? (row.trackKey || row.id)
                                                : (row.trackId || row.id);
                                            return (
                                            <span
                                                ref={el => { if (el) labelElsRef.current.set(labelMid, el); else labelElsRef.current.delete(labelMid); }}
                                                onMouseEnter={(e) => {
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    setTrackTooltip({ text: tooltipText, x: r.left, y: r.top - 22 });
                                                }}
                                                onMouseLeave={() => setTrackTooltip(null)}
                                                style={{
                                                    fontSize: row.type === 'drum' ? '9px' : (row.isCollapsed ? '10px' : '12px'),
                                                    fontWeight: isSelected ? '800' : '700',
                                                    color: isSelected ? row.color : (isDark ? '#ccc' : '#444'),
                                                    overflow: 'hidden',
                                                    display: 'flex', alignItems: 'center', gap: '3px',
                                                    whiteSpace: 'nowrap',
                                                    lineHeight: 1.2,
                                                    minWidth: 0,
                                                    flex: 1,
                                                    borderRadius: '3px',
                                                    padding: '2px 4px',
                                                    transition: 'background 0.05s'
                                                }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                                                {showPluginBadge && (
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); onOpenVST3Editor?.(row.effectTrackId); }}
                                                        style={{
                                                            fontSize: '8px', fontWeight: '700',
                                                            color: ac, opacity: 0.85,
                                                            padding: '1px 4px', borderRadius: '3px',
                                                            background: hexToRgba(ac, 0.12),
                                                            cursor: 'pointer',
                                                            flexShrink: 0, whiteSpace: 'nowrap'
                                                        }}>
                                                        {pluginName}
                                                    </span>
                                                )}
                                            </span>
                                            );
                                        })()}
                                        {isSelected && clipboard && (
                                            <span style={{ fontSize: '7px', color: textMuted, flexShrink: 0 }}>
                                                {clipboard ? '📋' : ''}
                                            </span>
                                        )}
                                        {/* Mute / Solo buttons */}
                                        {(() => {
                                            // Map row to global mute/solo track ID
                                            let muteId = null;
                                            if (row.type === 'drum' || row.type === 'drums-all') muteId = 'drums';
                                            else if (row.type === 'melodic') muteId = row.trackKey || row.id;
                                            else if (row.type === 'audio' || row.type === 'midi') muteId = row.trackId;
                                            if (!muteId) return null;
                                            const isMuted = globalMutes.has(muteId);
                                            const isSoloed = globalSolos.has(muteId);
                                            return (
                                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                                    {/* Volume & Pan knobs (not on individual drum rows, hidden when collapsed) */}
                                                    {row.type !== 'drum' && !row.isCollapsed && (() => {
                                                        const mix = trackMixState[muteId] || { volume: 0.3, pan: 0 };
                                                        return (<>
                                                            <MiniKnob
                                                                value={mix.volume} min={0} max={1} size={24}
                                                                color={row.color} isDark={isDark} label={t('arrange.vol')} defaultVal={0.3}
                                                                showValue
                                                                onChange={v => {
                                                                    setTrackMixState(p => ({ ...p, [muteId]: { ...(p[muteId] || { pan: 0 }), volume: v } }));
                                                                    sampler?.setTrackVolume?.(muteId, v);
                                                                }}
                                                            />
                                                            <MiniKnob
                                                                value={mix.pan} min={-1} max={1} size={24}
                                                                color={row.color} isDark={isDark} label={t('arrange.pan')} defaultVal={0}
                                                                showValue
                                                                onChange={v => {
                                                                    setTrackMixState(p => ({ ...p, [muteId]: { ...(p[muteId] || { volume: 0.3 }), pan: v } }));
                                                                    sampler?.setTrackPan?.(muteId, v);
                                                                }}
                                                            />
                                                        </>);
                                                    })()}
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); if (setGlobalMutes) { setGlobalMutes(prev => { const next = new Set(prev); if (next.has(muteId)) next.delete(muteId); else next.add(muteId); return next; }); } }}
                                                        title={isMuted ? t('arrange.unmute') : t('common.mute')}
                                                        style={{
                                                            width: row.type === 'drum' ? '14px' : (row.isCollapsed ? '16px' : '20px'),
                                                            height: row.type === 'drum' ? '14px' : (row.isCollapsed ? '16px' : '20px'),
                                                            borderRadius: '3px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: row.type === 'drum' ? '7px' : (row.isCollapsed ? '8px' : '9px'),
                                                            fontWeight: '800',
                                                            cursor: 'pointer',
                                                            background: isMuted
                                                                ? (isDark ? ac : '#e74c3c')
                                                                : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                                                            color: isMuted ? '#fff' : (isDark ? '#888' : '#999'),
                                                            border: isMuted ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                                            lineHeight: 1
                                                        }}
                                                    >M</div>
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); if (updateGlobalSolo) updateGlobalSolo(muteId, !isSoloed, e.ctrlKey || e.metaKey); }}
                                                        title={isSoloed ? t('arrange.unsolo') : t('common.soloCtrl')}
                                                        style={{
                                                            width: row.type === 'drum' ? '14px' : (row.isCollapsed ? '16px' : '20px'),
                                                            height: row.type === 'drum' ? '14px' : (row.isCollapsed ? '16px' : '20px'),
                                                            borderRadius: '3px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: row.type === 'drum' ? '7px' : (row.isCollapsed ? '8px' : '9px'),
                                                            fontWeight: '800',
                                                            cursor: 'pointer',
                                                            background: isSoloed
                                                                ? (isDark ? '#feca57' : '#f39c12')
                                                                : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                                                            color: isSoloed ? '#000' : (isDark ? '#888' : '#999'),
                                                            border: isSoloed ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                                            lineHeight: 1
                                                        }}
                                                    >S</div>
                                                    {/* Automation toggle button — audio and MIDI tracks */}
                                                    {(row.type === 'audio' || row.type === 'midi' || row.type === 'melodic' || row.type === 'drums-all') && !row.isCollapsed && (() => {
                                                        const autoTrackId = muteId;
                                                        const isAutoVisible = automationVisibleTracks.has(autoTrackId);
                                                        return (
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setAutomationVisibleTracks(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(autoTrackId)) next.delete(autoTrackId);
                                                                        else next.add(autoTrackId);
                                                                        return next;
                                                                    });
                                                                    // Default to 'volume' if no param selected yet
                                                                    if (!automationSelectedParam[autoTrackId]) {
                                                                        setAutomationSelectedParam(prev => ({ ...prev, [autoTrackId]: 'volume' }));
                                                                    }
                                                                }}
                                                                title={isAutoVisible ? t('arrange.hideAutomation') : t('arrange.showAutomation')}
                                                                style={{
                                                                    width: '20px', height: '20px',
                                                                    borderRadius: '3px',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '9px', fontWeight: '800', cursor: 'pointer',
                                                                    background: isAutoVisible
                                                                        ? (isDark ? '#2ecc71' : '#27ae60')
                                                                        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                                                                    color: isAutoVisible ? '#fff' : (isDark ? '#888' : '#999'),
                                                                    border: isAutoVisible ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                                                    lineHeight: 1
                                                                }}
                                                            >A</div>
                                                        );
                                                    })()}
                                                    {/* Automation parameter selector — visible when automation lane is open */}
                                                    {(row.type === 'audio' || row.type === 'midi' || row.type === 'melodic' || row.type === 'drums-all') && !row.isCollapsed && (() => {
                                                        const autoTrackId = muteId;
                                                        if (!automationVisibleTracks.has(autoTrackId)) return null;
                                                        const currentParam = automationSelectedParam[autoTrackId] || 'volume';
                                                        return (
                                                            <select
                                                                value={currentParam}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    setAutomationSelectedParam(prev => ({ ...prev, [autoTrackId]: e.target.value }));
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{
                                                                    fontSize: '8px', padding: '1px 2px',
                                                                    background: isDark ? '#2a2a35' : '#f0f0f5',
                                                                    color: isDark ? '#ccc' : '#333',
                                                                    border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                                                                    borderRadius: '3px', outline: 'none',
                                                                    cursor: 'pointer', maxWidth: '60px',
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                <option value="volume">{t('arrange.vol')}</option>
                                                                <option value="pan">{t('arrange.pan')}</option>
                                                            </select>
                                                        );
                                                    })()}
                                                    {/* VST3 editor gear button — shows on any track with a loaded plugin */}
                                                    {(row.vst3Plugin || row.vst3Instrument) && row.effectTrackId && (() => {
                                                        const editorIsOpen = vst3EditorOpenTracks?.has?.(row.effectTrackId);
                                                        const pName = (row.vst3Plugin || row.vst3Instrument).name;
                                                        return (
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onOpenVST3Editor?.(row.effectTrackId);
                                                            }}
                                                            title={editorIsOpen ? t('arrange.closePluginEditor', { name: pName }) : t('arrange.openPluginEditor', { name: pName })}
                                                            style={{
                                                                width: row.type === 'drum' ? '14px' : (row.isCollapsed ? '16px' : '20px'),
                                                                height: row.type === 'drum' ? '14px' : (row.isCollapsed ? '16px' : '20px'),
                                                                borderRadius: '3px',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: row.type === 'drum' ? '8px' : (row.isCollapsed ? '10px' : '11px'),
                                                                fontWeight: '800', cursor: 'pointer',
                                                                background: editorIsOpen
                                                                    ? ac
                                                                    : (isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.12)),
                                                                color: editorIsOpen ? '#fff' : ac,
                                                                border: editorIsOpen
                                                                    ? `1px solid ${ac}`
                                                                    : `1px solid ${hexToRgba(ac, 0.3)}`,
                                                                lineHeight: 1,
                                                                transition: 'background 0.15s, color 0.15s'
                                                            }}
                                                        >⚙</div>
                                                        );
                                                    })()}
                                                    {/* VST3 "+" button — available on all track types */}
                                                    {vst3Plugins.length > 0 && row.effectTrackId && (
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropdownHeight = 300; // maxHeight of the picker
                                                                const spaceBelow = window.innerHeight - rect.bottom;
                                                                const openAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow;
                                                                setVst3PickerRow({
                                                                    rowId: row.id,
                                                                    trackId: row.effectTrackId,
                                                                    rowType: row.type,
                                                                    x: rect.left,
                                                                    y: openAbove ? rect.top : rect.bottom + 2,
                                                                    openAbove,
                                                                });
                                                            }}
                                                            title={t('arrange.addVst3Plugin')}
                                                            style={{
                                                                width: row.type === 'drum' ? '14px' : (row.isCollapsed ? '16px' : '20px'),
                                                                height: row.type === 'drum' ? '14px' : (row.isCollapsed ? '16px' : '20px'),
                                                                borderRadius: '3px',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: row.type === 'drum' ? '7px' : (row.isCollapsed ? '10px' : '12px'),
                                                                fontWeight: '800', cursor: 'pointer',
                                                                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                                                color: ac,
                                                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                                                lineHeight: 1
                                                            }}
                                                        >+</div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        {/* Spacer to match content-side drop zone height so scroll ranges stay aligned */}
                        <div style={{ minHeight: '80px', flexShrink: 0 }} />
                    </div>
                </div>

                {/* Timeline area (scrollable) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    {/* Time ruler (synced scroll) */}
                    <div
                        ref={headerScrollRef}
                        style={{
                            height: '36px', minHeight: '36px',
                            overflowX: 'hidden', overflowY: 'hidden',
                            position: 'relative',
                            borderBottom: `1px solid ${borderColor}`,
                            background: isDark ? 'rgba(15,15,20,0.8)' : '#eaeaee'
                        }}
                    >
                        <div
                            style={{ width: `${totalWidth}px`, height: '100%', position: 'relative', cursor: 'ns-resize' }}
                            onMouseDown={handleRulerMouseDown}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setGridContextMenu({ x: e.clientX, y: e.clientY });
                            }}
                            onClick={(e) => {
                                // Only process click if it wasn't a drag
                                if (rulerDragRef.current?.wasDrag) return;
                                // Alt+Click: place stop marker at clicked bar
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const clickedBar = Math.floor(clickX / pixelsPerBar);
                                if (clickedBar < 0 || clickedBar >= totalBars) return;
                                if (e.altKey && onSetStopMarkerAtBar) {
                                    e.stopPropagation();
                                    onSetStopMarkerAtBar(clickedBar);
                                }
                            }}
                        >
                            {/* Bar.beat markers (top half) — continuous absolute bar numbers */}
                            {(() => {
                                const barMarkers = [];
                                const showBeats = pixelsPerBar >= 40;
                                for (let b = 0; b < totalBars; b++) {
                                    const barNum = b + 1;
                                    const x = b * pixelsPerBar;
                                    const isEvery4 = b % 4 === 0;
                                    const showLabel = pixelsPerBar > 18 || barNum % 4 === 1;
                                    barMarkers.push(
                                        <React.Fragment key={`bar-${barNum}`}>
                                            {/* Bar tick line */}
                                            <div style={{
                                                position: 'absolute', left: `${x}px`, top: 0,
                                                width: '1px', height: isEvery4 ? '16px' : '10px',
                                                background: isDark
                                                    ? (isEvery4 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)')
                                                    : (isEvery4 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)')
                                            }} />
                                            {showLabel && (
                                                <span style={{
                                                    position: 'absolute', left: `${x + 3}px`, top: '1px',
                                                    fontSize: '9px', fontWeight: '700',
                                                    color: isDark
                                                        ? (isEvery4 ? '#888' : '#555')
                                                        : (isEvery4 ? '#666' : '#aaa'),
                                                    whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none'
                                                }}>
                                                    {barNum}.1
                                                </span>
                                            )}
                                            {/* Beat subdivisions (1.2, 1.3, 1.4) when zoomed in */}
                                            {showBeats && [2, 3, 4].map(beat => {
                                                const beatX = x + (beat - 1) * (pixelsPerBar / 4);
                                                return (
                                                    <React.Fragment key={`bar-${barNum}-beat-${beat}`}>
                                                        <div style={{
                                                            position: 'absolute', left: `${beatX}px`, top: 0,
                                                            width: '1px', height: '6px',
                                                            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
                                                        }} />
                                                        {pixelsPerBar >= 80 && (
                                                            <span style={{
                                                                position: 'absolute', left: `${beatX + 2}px`, top: '1px',
                                                                fontSize: '7px', fontWeight: '600',
                                                                color: isDark ? '#3a3a48' : '#c0c0c8',
                                                                whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none'
                                                            }}>
                                                                {barNum}.{beat}
                                                            </span>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                }
                                return barMarkers;
                            })()}
                            {/* Time markers (bottom half) — more prominent */}
                            {timeMarks.marks.map((mark, i) => (
                                <React.Fragment key={`time-${i}`}>
                                    <div style={{
                                        position: 'absolute', left: `${mark.x}px`, bottom: 0,
                                        width: '1px', height: mark.isMajor ? '14px' : '6px',
                                        background: isDark
                                            ? (mark.isMajor ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)')
                                            : (mark.isMajor ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.06)')
                                    }} />
                                    {mark.isMajor && (
                                        <span style={{
                                            position: 'absolute', left: `${mark.x + 3}px`, bottom: '2px',
                                            fontSize: '9px', fontWeight: '600',
                                            color: isDark ? '#777' : '#666',
                                            whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none'
                                        }}>
                                            {mark.label}
                                        </span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Locator strip — loop range (baby blue) + stop marker (red) handles */}
                    <div style={{
                        height: '14px', minHeight: '14px',
                        overflowX: 'hidden', overflowY: 'hidden',
                        borderBottom: `1px solid ${borderColor}`,
                        position: 'relative',
                        background: isDark ? 'rgba(10,10,15,0.9)' : '#e8e8ec',
                        cursor: 'crosshair'
                    }}
                    onMouseDown={(e) => {
                        // Drag on locator strip to set loop range
                        if (e.button !== 0 || !onSetLoopRange) return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const startX = e.clientX - rect.left + scrollLeft;
                        const startBar = Math.max(0, Math.floor(startX / pixelsPerBar));
                        let currentEndBar = startBar + 1;

                        const onMove = (moveE) => {
                            const moveX = moveE.clientX - rect.left + scrollLeft;
                            const moveBar = Math.max(0, Math.min(totalBars, Math.round(moveX / pixelsPerBar)));
                            const loopStart = Math.min(startBar, moveBar);
                            const loopEnd = Math.max(startBar, moveBar);
                            if (loopEnd > loopStart) {
                                onSetLoopRange({ startBar: loopStart, endBar: loopEnd });
                            }
                            currentEndBar = moveBar;
                        };
                        const onUp = () => {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                            // If no drag movement, don't set a loop
                            if (Math.abs(currentEndBar - startBar) < 1) return;
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                    }}
                    onDoubleClick={(e) => {
                        // Double-click on locator strip to toggle loop active/inactive
                        e.stopPropagation();
                        if (onSetLoopActive) onSetLoopActive(!loopActive);
                    }}
                    >
                        <div style={{ width: `${totalWidth}px`, height: '100%', position: 'relative', marginLeft: -scrollLeft }}>
                            {/* Loop range band — always visible, bright when active, dim when inactive */}
                            {loopRangeBars && (() => {
                                const lx = loopRangeBars.startBar * pixelsPerBar;
                                const lw = (loopRangeBars.endBar - loopRangeBars.startBar) * pixelsPerBar;
                                const activeOpacity = loopActive ? 1.0 : 0.35;
                                const bandBg = loopActive
                                    ? (isDark ? 'rgba(100,200,255,0.35)' : 'rgba(60,160,255,0.4)')
                                    : (isDark ? 'rgba(100,200,255,0.10)' : 'rgba(60,160,255,0.12)');
                                const handleColor = loopActive ? '#64c8ff' : (isDark ? '#3a6a80' : '#8ab8d0');
                                return (
                                    <>
                                        {/* Loop band fill — click to toggle active */}
                                        <div
                                            style={{
                                                position: 'absolute', left: `${lx}px`, top: 0, bottom: 0,
                                                width: `${lw}px`,
                                                background: bandBg,
                                                borderRadius: '2px',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s',
                                                zIndex: 15
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onSetLoopActive) onSetLoopActive(!loopActive);
                                            }}
                                        />
                                        {/* Loop start handle — draggable */}
                                        <div
                                            style={{
                                                position: 'absolute', left: `${lx - 3}px`, top: 0, bottom: 0,
                                                width: '8px', cursor: 'ew-resize',
                                                background: handleColor, borderRadius: '2px 0 0 2px',
                                                transition: 'background 0.2s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                zIndex: 20
                                            }}
                                            title={t('arrange.loopStart')}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                const origEnd = loopRangeBars.endBar;
                                                const parentRect = e.currentTarget.parentElement.getBoundingClientRect();
                                                const onMove = (moveE) => {
                                                    const moveX = moveE.clientX - parentRect.left;
                                                    const newStart = Math.max(0, Math.min(origEnd - 1, Math.round(moveX / pixelsPerBar)));
                                                    if (onSetLoopRange) onSetLoopRange({ startBar: newStart, endBar: origEnd });
                                                };
                                                const onUp = () => {
                                                    document.removeEventListener('mousemove', onMove);
                                                    document.removeEventListener('mouseup', onUp);
                                                    document.body.style.cursor = '';
                                                };
                                                document.body.style.cursor = 'ew-resize';
                                                document.addEventListener('mousemove', onMove);
                                                document.addEventListener('mouseup', onUp);
                                            }}
                                        >
                                            <div style={{ width: '1px', height: '8px', background: 'rgba(255,255,255,0.6)' }} />
                                        </div>
                                        {/* Loop end handle — draggable */}
                                        <div
                                            style={{
                                                position: 'absolute', left: `${lx + lw - 5}px`, top: 0, bottom: 0,
                                                width: '8px', cursor: 'ew-resize',
                                                background: handleColor, borderRadius: '0 2px 2px 0',
                                                transition: 'background 0.2s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                zIndex: 20
                                            }}
                                            title={t('arrange.loopEnd')}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                const origStart = loopRangeBars.startBar;
                                                const parentRect = e.currentTarget.parentElement.getBoundingClientRect();
                                                const onMove = (moveE) => {
                                                    const moveX = moveE.clientX - parentRect.left;
                                                    const newEnd = Math.max(origStart + 1, Math.min(totalBars, Math.round(moveX / pixelsPerBar)));
                                                    if (onSetLoopRange) onSetLoopRange({ startBar: origStart, endBar: newEnd });
                                                };
                                                const onUp = () => {
                                                    document.removeEventListener('mousemove', onMove);
                                                    document.removeEventListener('mouseup', onUp);
                                                    document.body.style.cursor = '';
                                                };
                                                document.body.style.cursor = 'ew-resize';
                                                document.addEventListener('mousemove', onMove);
                                                document.addEventListener('mouseup', onUp);
                                            }}
                                        >
                                            <div style={{ width: '1px', height: '8px', background: 'rgba(255,255,255,0.6)' }} />
                                        </div>
                                        {/* Loop label centered */}
                                        {lw > 40 && (
                                            <span style={{
                                                position: 'absolute',
                                                left: `${lx + lw / 2}px`,
                                                top: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                fontSize: '8px',
                                                fontWeight: '800',
                                                color: handleColor,
                                                letterSpacing: '0.5px',
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                                transition: 'color 0.2s',
                                                textShadow: isDark ? '0 0 4px rgba(0,0,0,0.8)' : '0 0 4px rgba(255,255,255,0.8)'
                                            }}>{loopActive ? '⟳ ' : ''}{t('arrange.loop')}</span>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Stop marker handle — always visible, draggable */}
                            {stopMarkerPx != null && (
                                <div
                                    style={{
                                        position: 'absolute', left: `${stopMarkerPx - 6}px`, top: 0, bottom: 0,
                                        width: '12px', cursor: 'ew-resize',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        zIndex: 25
                                    }}
                                    title={t('arrange.stopMarkerAtBar', { bar: stopMarkerBar + 1 })}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        const startX = e.clientX;
                                        const startBar = stopMarkerBar;
                                        const onMove = (moveE) => {
                                            const dx = moveE.clientX - startX;
                                            const dBars = dx / pixelsPerBar;
                                            const newBar = Math.max(0, Math.min(totalBars, Math.round(startBar + dBars)));
                                            if (onSetStopMarkerAtBar) onSetStopMarkerAtBar(newBar);
                                        };
                                        const onUp = () => {
                                            document.removeEventListener('mousemove', onMove);
                                            document.removeEventListener('mouseup', onUp);
                                        };
                                        document.addEventListener('mousemove', onMove);
                                        document.addEventListener('mouseup', onUp);
                                    }}
                                >
                                    <div style={{
                                        width: '2px', height: '100%',
                                        background: '#ff4757'
                                    }} />
                                    {/* Red flag/triangle */}
                                    <div style={{
                                        position: 'absolute', top: '0px', left: '0px',
                                        width: 0, height: 0,
                                        borderTop: '7px solid #ff4757',
                                        borderRight: '8px solid #ff4757',
                                        borderBottom: '7px solid transparent',
                                        borderLeft: '0px solid transparent',
                                        filter: 'drop-shadow(0 0 2px rgba(255,71,87,0.5))'
                                    }} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pattern Preview Strip — replaces section labels row */}
                    <PatternPreviewStrip
                        previewDrumPattern={previewDrumPattern}
                        previewChordPattern={previewChordPattern}
                        previewMelodyPattern={previewMelodyPattern}
                        previewBassPattern={previewBassPattern}
                        globalBars={globalBarsOptions?.[0] || 4}
                        isDark={isDark}
                        ac={ac}
                        pixelsPerBar={pixelsPerBar}
                        totalBars={totalBars}
                        scrollLeft={scrollLeft}
                        borderColor={borderColor}
                        onAddDrumClipFromPreview={onAddDrumClipFromPreview}
                        onAddChordClipFromPreview={onAddChordClipFromPreview}
                        onAddMelodyClipFromPreview={onAddMelodyClipFromPreview}
                        onAddBassClipFromPreview={onAddBassClipFromPreview}
                        setTimelineBars={setTimelineBars}
                        timelineBars={totalBars}
                    />

                    {/* Track rows with clips */}
                    <div
                        ref={scrollContainerRef}
                        data-timeline-scroll="true"
                        onScroll={handleScroll}
                        style={{
                            flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative', cursor: 'default'
                        }}
                    >
                        <div style={{ width: `${totalWidth}px`, minHeight: `${totalTrackHeight + 60}px`, position: 'relative' }}
                            onClick={(e) => {
                                // Skip if a clip was clicked (clip handler already ran)
                                if (clipClickedRef.current) { clipClickedRef.current = false; return; }
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickedBar = Math.floor((e.clientX - rect.left) / pixelsPerBar);
                                if (onSetAudioInsertionBar) onSetAudioInsertionBar(clickedBar);
                                // Determine which row was clicked based on y-coordinate (for insertion cursor)
                                const clickY = e.clientY - rect.top;
                                let cumY = 0;
                                for (const r of trackRows) {
                                    if (clickY >= cumY && clickY < cumY + r.height) {
                                        setSelectedRow(r.id);
                                        break;
                                    }
                                    cumY += r.height;
                                }
                                // Clear clip selections (clicking empty space deselects clips)
                                setSelectedNoteClipId(null);
                                setSelectedNoteClipTrackKey(null);
                                setSelectedDrumClipId(null);
                                setSelectedDrumLaneClipDrumId(null);
                                setSelectedMidiClipId(null);
                                setSelectedAudioClipId(null);
                                setSelectedAudioClipIds(new Set());
                                // Set active section
                                const sec = (() => { let cum = 0; for (const s of arrangement) { if (cum + s.bars > clickedBar) return s; cum += s.bars; } return arrangement[arrangement.length - 1]; })();
                                if (sec) onSelectSection(sec.id);
                            }}
                        >
                            {/* Playhead — spans the full track height so it covers Audio/MIDI rows too */}
                            {playheadPx !== null && (
                                <div style={{
                                    position: 'absolute', left: `${playheadPx}px`, top: 0,
                                    height: `${totalTrackHeight}px`,
                                    width: '1.5px', background: ac, zIndex: 20,
                                    pointerEvents: 'none', boxShadow: `0 0 8px ${hexToRgba(ac, 0.4)}`
                                }} />
                            )}

                            {/* Insertion cursor removed from full-height overlay —
                               shown only on the selected row (per-row indicator below) */}

                            {/* Stop Marker line */}
                            {stopMarkerPx !== null && (
                                <div style={{
                                    position: 'absolute', left: `${stopMarkerPx - 1}px`, top: 0,
                                    height: `${totalTrackHeight}px`,
                                    width: '2px', background: '#ff4757', zIndex: 19,
                                    pointerEvents: 'none',
                                    backgroundImage: 'repeating-linear-gradient(180deg, #ff4757 0px, #ff4757 4px, transparent 4px, transparent 8px)'
                                }}>
                                    {/* Stop marker triangle at top */}
                                    <div style={{
                                        position: 'absolute', top: '-2px', left: '-5px',
                                        width: 0, height: 0,
                                        borderLeft: '6px solid transparent',
                                        borderRight: '6px solid transparent',
                                        borderTop: '8px solid #ff4757',
                                        filter: 'drop-shadow(0 1px 3px rgba(255,71,87,0.5))'
                                    }} />
                                </div>
                            )}

                            {/* Bar gridlines + subdivision lines based on grid resolution */}
                            {(() => {
                                const lines = [];
                                // Subdivision count per bar based on grid resolution
                                // globalResolution: 4=quarter, 8=eighth, 16=sixteenth, 32=thirty-second
                                const subsPerBar = globalResolution || 4;
                                for (let b = 0; b < totalBars; b++) {
                                    const x = b * pixelsPerBar;
                                    const isEvery4 = b % 4 === 0;
                                    lines.push(
                                        <div key={`grid-${b}`} style={{
                                            position: 'absolute', left: `${x}px`, top: 0, bottom: 0,
                                            width: '1px',
                                            background: isDark
                                                ? (isEvery4 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)')
                                                : (isEvery4 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.04)'),
                                            zIndex: 5, pointerEvents: 'none'
                                        }} />
                                    );
                                    // Subdivision lines within bar (show if >= 2px spacing)
                                    if (subsPerBar > 1 && pixelsPerBar / subsPerBar >= 2) {
                                        for (let s = 1; s < subsPerBar; s++) {
                                            const sx = x + (s / subsPerBar) * pixelsPerBar;
                                            const isBeat = subsPerBar >= 4 && s % (subsPerBar / 4) === 0;
                                            lines.push(
                                                <div key={`sub-${b}-${s}`} style={{
                                                    position: 'absolute', left: `${sx}px`, top: 0, bottom: 0,
                                                    width: '1px',
                                                    background: isDark
                                                        ? (isBeat ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)')
                                                        : (isBeat ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.025)'),
                                                    zIndex: 5, pointerEvents: 'none'
                                                }} />
                                            );
                                        }
                                    }
                                }
                                return lines;
                            })()}

                            {/* Drum group header line removed — integrated into drums-all row */}

                            {/* Drop zone below all tracks — creates new tracks on drop */}
                            {(() => {
                                const dzTop = (0) + totalTrackHeight;
                                const isDzActive = dropTarget?.rowId === '__new-track-drop__';
                                return (
                                    <div
                                        style={{
                                            position: 'absolute', left: 0, right: 0,
                                            top: `${dzTop}px`, minHeight: '60px', bottom: 0,
                                            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                                            paddingTop: '16px',
                                            background: isDzActive
                                                ? (isDark ? 'rgba(151,117,250,0.08)' : 'rgba(151,117,250,0.06)')
                                                : 'transparent',
                                            borderTop: isDzActive ? `2px dashed ${ac}66` : `1px dashed ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                                            transition: 'background 0.15s, border-color 0.15s',
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'copy';
                                            setDropTarget({ rowId: '__new-track-drop__', sectionId: null, splitMode: true });
                                        }}
                                        onDragLeave={() => {
                                            if (dropTarget?.rowId === '__new-track-drop__') setDropTarget(null);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setDropTarget(null);
                                            const internalItem = window.draggedItem;
                                            const files = e.dataTransfer.files;
                                            let jsonData = null;
                                            try {
                                                const raw = e.dataTransfer.getData('application/json');
                                                if (raw) jsonData = JSON.parse(raw);
                                            } catch (_) { /* ignore */ }
                                            const targetSection = arrangement.find(s => s.id === activeSection) || arrangement[0];
                                            if (targetSection && onDropAudio) {
                                                onDropAudio({
                                                    row: { id: '__new-track-drop__', type: 'new-track-drop' },
                                                    section: targetSection,
                                                    internalItem,
                                                    jsonData,
                                                    files: files?.length > 0 ? Array.from(files) : null,
                                                    ctrlKey: true,
                                                    shiftKey: true,
                                                });
                                            }
                                            window.draggedItem = null;
                                        }}
                                    >
                                        {isDzActive && (
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', color: ac,
                                                letterSpacing: '0.5px', opacity: 0.8, pointerEvents: 'none'
                                            }}>
                                                {t('arrange.dropToCreateTracks')}
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Track rows */}
                            {(() => {
                                let yOffset = 0; // account for drums group header
                                return trackRows.map((row, ri) => {
                                    const rowY = yOffset;
                                    yOffset += row.height;
                                    const isRowSelected = selectedRow === row.id;

                                    // Determine mute/solo state for this row
                                    let rowMuteId = null;
                                    if (row.type === 'drum' || row.type === 'drums-all') rowMuteId = 'drums';
                                    else if (row.type === 'melodic') rowMuteId = row.trackKey || row.id;
                                    else if (row.type === 'audio') rowMuteId = row.trackId;
                                    const isRowMuted = rowMuteId && globalMutes.has(rowMuteId);
                                    const isRowSoloed = rowMuteId && globalSolos.has(rowMuteId);
                                    const isAnythingSoloed = globalSolos.size > 0;
                                    const isRowDimmed = isRowMuted || (isAnythingSoloed && !isRowSoloed);

                                    return (
                                        <div key={row.id} data-row-id={row.id} data-row-type={row.type} data-row-trackkey={row.trackKey || ''} style={{
                                            position: 'absolute', left: 0, right: 0,
                                            top: `${rowY}px`, height: `${row.height}px`,
                                            borderBottom: `1px solid ${borderColor}`,
                                            background: isRowSelected
                                                ? (isDark ? `${row.color}22` : `${row.color}28`)
                                                : ri % 2 === 0
                                                    ? 'transparent'
                                                    : (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.012)'),
                                            opacity: isRowDimmed ? 0.3 : 1,
                                            transition: 'opacity 0.15s'
                                        }}>
                                            {/* ── Insertion cursor — rendered on every row, visible only on selected row when not playing ── */}
                                            {audioInsertionBar != null && isRowSelected && !globalIsPlaying && !isRecording && (
                                                <div key="insertion-cursor" style={{
                                                    position: 'absolute', left: `${audioInsertionBar * pixelsPerBar}px`, top: 0,
                                                    width: '2px', height: '100%',
                                                    background: '#ffa94d', zIndex: 30,
                                                    pointerEvents: 'none',
                                                    boxShadow: '0 0 6px #ffa94d',
                                                    animation: 'blink 1s step-end infinite'
                                                }}>
                                                    <div style={{
                                                        position: 'absolute', top: '-4px', left: '-4px',
                                                        width: 0, height: 0,
                                                        borderLeft: '5px solid transparent',
                                                        borderRight: '5px solid transparent',
                                                        borderTop: '6px solid #ffa94d'
                                                    }} />
                                                </div>
                                            )}
                                            {/* ── Continuous Audio Lane (no section cells) ── */}
                                            {row.type === 'audio' && row.trackId && (() => {
                                                const track = audioTracks.find(t => t.id === row.trackId);
                                                const clipColor = row.color;
                                                // Gather ALL clips for this track with absolute bar positions
                                                const allAudioClips = track ? track.clips.map(c => {
                                                    const absBar = c.timelineBar != null ? c.timelineBar : (() => {
                                                        let cum = 0;
                                                        for (const s of arrangement) {
                                                            if (s.id === c.sectionId) return cum + (c.startBar || 0);
                                                            cum += s.bars;
                                                        }
                                                        return c.startBar || 0;
                                                    })();
                                                    return { ...c, _absBar: absBar };
                                                }) : [];
                                                const laneSecondsPerBar = 4 * 60 / globalTempo;
                                                // Helper: find section at a given bar position
                                                const sectionAtBar = (bar) => {
                                                    let cumBars = 0;
                                                    for (const s of arrangement) {
                                                        if (cumBars + s.bars > bar) return s;
                                                        cumBars += s.bars;
                                                    }
                                                    return arrangement[arrangement.length - 1] || arrangement[0];
                                                };
                                                return (
                                                    <div
                                                        style={{
                                                            position: 'absolute', left: 0, top: '1px',
                                                            width: `${totalWidth}px`, height: `${row.height - 2}px`,
                                                            cursor: 'default', zIndex: 1
                                                        }}
                                                        onClick={(e) => {
                                                            if (clipClickedRef.current) return;
                                                            if (e.ctrlKey || e.metaKey) return;
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const relX = e.clientX - rect.left;
                                                            const clickedBar = Math.floor(relX / pixelsPerBar);
                                                            const sec = sectionAtBar(clickedBar);
                                                            if (sec) onSelectSection(sec.id);
                                                            setSelectedRow(row.id);
                                                            setSelectedCells([]);
                                                            setSelectedAudioClipId(null);
                                                            setSelectedAudioClipTrackId(null);
                                                            // Shift+Click: set loop range
                                                            if (e.shiftKey && onSetAudioLoopRange) {
                                                                if (!audioLoopRange) {
                                                                    // First Shift+Click: set loop start
                                                                    onSetAudioLoopRange({ startBar: clickedBar, endBar: clickedBar + 4 });
                                                                } else {
                                                                    // Second Shift+Click: set loop end (reorder if needed)
                                                                    const start = Math.min(audioLoopRange.startBar, clickedBar);
                                                                    const end = Math.max(audioLoopRange.startBar, clickedBar);
                                                                    if (end > start) {
                                                                        onSetAudioLoopRange({ startBar: start, endBar: end });
                                                                    }
                                                                }
                                                            } else {
                                                                if (onSetAudioInsertionBar) onSetAudioInsertionBar(clickedBar);
                                                            }
                                                        }}
                                                        onDoubleClick={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const relX = e.clientX - rect.left;
                                                            const clickedBar = relX / pixelsPerBar;
                                                            // Find nearest clip to open in editor
                                                            if (allAudioClips.length > 0) {
                                                                let nearest = allAudioClips[0];
                                                                let minDist = Math.abs(allAudioClips[0]._absBar - clickedBar);
                                                                for (const cl of allAudioClips) {
                                                                    const d = Math.abs(cl._absBar - clickedBar);
                                                                    if (d < minDist) { minDist = d; nearest = cl; }
                                                                }
                                                                const sec = sectionAtBar(nearest._absBar);
                                                                if (sec) onSelectSection(sec.id);
                                                                setFocusedAudioClip({
                                                                    clip: nearest, trackId: row.trackId,
                                                                    trackName: row.label, sectionName: sec?.name || ''
                                                                });
                                                            }
                                                        }}
                                                        onContextMenu={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const relX = e.clientX - rect.left;
                                                            const clickedBar = relX / pixelsPerBar;
                                                            const sec = sectionAtBar(clickedBar) || arrangement[0];
                                                            handleRowContextMenu(e, row, sec);
                                                        }}
                                                        onDragOver={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const relX = e.clientX - rect.left;
                                                            const dropBar = relX / pixelsPerBar;
                                                            const sec = sectionAtBar(dropBar) || arrangement[0];
                                                            // Audio clip drag → only audio rows (block MIDI rows)
                                                            if (draggingClipBetweenTracks && draggingClipBetweenTracks.clipType === 'audio' && row.type === 'audio') {
                                                                e.preventDefault();
                                                                e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move';
                                                                const dc = draggingClipBetweenTracks.clip;
                                                                const dcBufDur = dc.buffer ? dc.buffer.duration : 0;
                                                                const dcEffDur = Math.max(0.01, (dcBufDur - (dc.trimStart || 0) - (dc.trimEnd || 0)) / (dc.playbackRate || 1));
                                                                const tempo = sec?.settings?.tempo || globalTempo;
                                                                const dcBars = dcEffDur / (4 * 60 / tempo);
                                                                setClipDropGhost({ targetRowId: row.id, bar: Math.max(0, dropBar), widthBars: dcBars, patternSvg: draggingClipBetweenTracks.patternSvg || null });
                                                                return;
                                                            }
                                                            // MIDI clip drag → only MIDI rows (block audio rows)
                                                            if (draggingClipBetweenTracks && draggingClipBetweenTracks.clipType === 'midi' && row.type === 'midi') {
                                                                e.preventDefault();
                                                                e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move';
                                                                const tempo = sec?.settings?.tempo || globalTempo;
                                                                const midiDurBars = draggingClipBetweenTracks.durationBars || globalBars;
                                                                setClipDropGhost({ targetRowId: row.id, bar: Math.max(0, dropBar), widthBars: midiDurBars, patternSvg: draggingClipBetweenTracks.patternSvg || null });
                                                                return;
                                                            }
                                                            // Block cross-type drags (audio→midi, midi→audio, noteClip→audio)
                                                            if (draggingClipBetweenTracks) return;
                                                            handleDragOver(e, row.id, sec.id);
                                                        }}
                                                        onDragLeave={(e) => {
                                                            handleDragLeave(e);
                                                            if (clipDropGhost?.targetRowId === row.id) setClipDropGhost(null);
                                                        }}
                                                        onDrop={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const relX = e.clientX - rect.left;
                                                            const dropBar = relX / pixelsPerBar;
                                                            const sec = sectionAtBar(dropBar) || arrangement[0];
                                                            handleDrop(e, row, sec, dropBar);
                                                        }}
                                                    >
                                                        {/* Faint section boundary lines */}
                                                        {arrangement.map((section, si) => {
                                                            if (si === 0) return null;
                                                            const bx = sectionOffsets[si] * pixelsPerBar;
                                                            return (
                                                                <div key={`sb-${si}`} style={{
                                                                    position: 'absolute', left: `${bx}px`, top: 0,
                                                                    width: '1px', height: '100%',
                                                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                                                    pointerEvents: 'none', zIndex: 0,
                                                                    borderLeft: '1px dashed',
                                                                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                                                                }} />
                                                            );
                                                        })}
                                                        {/* All audio clips at absolute positions */}
                                                        {allAudioClips.map((clip) => {
                                                            const bufDur = clip.buffer ? clip.buffer.duration : 0;
                                                            const effectiveDur = Math.max(0.01, (bufDur - (clip.trimStart || 0) - (clip.trimEnd || 0)) / (clip.playbackRate || 1));
                                                            const clipBars = effectiveDur / laneSecondsPerBar;
                                                            const absBar = clip._absBar;
                                                            const clipStartPx = absBar * pixelsPerBar;
                                                            const clipW = Math.max(8, clipBars * pixelsPerBar);
                                                            return (
                                                                <div
                                                                    key={clip.id}
                                                                    style={{
                                                                        position: 'absolute', left: `${clipStartPx}px`, top: 0,
                                                                        width: `${clipW}px`, height: '100%',
                                                                        background: (selectedAudioClipId === clip.id || selectedAudioClipIds.has(clip.id))
                                                                            ? `${clipColor}${isDark ? '70' : '60'}`
                                                                            : `${clipColor}${isDark ? '22' : '28'}`,
                                                                        borderRight: `2px solid ${clipColor}88`,
                                                                        border: (selectedAudioClipId === clip.id || selectedAudioClipIds.has(clip.id)) ? `2px solid ${clipColor}` : undefined,
                                                                        borderRadius: '2px', overflow: 'hidden'
                                                                    }}
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.stopPropagation();
                                                                        e.dataTransfer.effectAllowed = 'copyMove';
                                                                        e.dataTransfer.setData('application/x-wavloom-clip', JSON.stringify({ clipId: clip.id, trackId: row.trackId }));
                                                                        // Center ghost preview under cursor
                                                                        const elRect = e.currentTarget.getBoundingClientRect();
                                                                        e.dataTransfer.setDragImage(e.currentTarget, e.clientX - elRect.left, e.clientY - elRect.top);
                                                                        // Build waveform SVG for ghost preview
                                                                        let waveSvg = null;
                                                                        if (clip.buffer) {
                                                                            try {
                                                                                const ch = clip.buffer.getChannelData(0);
                                                                                const sr = clip.buffer.sampleRate;
                                                                                const ts = clip.trimStart || 0;
                                                                                const te = clip.trimEnd || 0;
                                                                                const ss = Math.floor(ts * sr);
                                                                                const se = Math.max(ss + 1, ch.length - Math.floor(te * sr));
                                                                                const numBars = 80;
                                                                                const spp = (se - ss) / numBars;
                                                                                const pts = [];
                                                                                for (let i = 0; i < numBars; i++) {
                                                                                    const s0 = ss + Math.floor(i * spp);
                                                                                    const s1 = Math.min(ss + Math.floor((i + 1) * spp), se);
                                                                                    let mx = 0;
                                                                                    for (let j = s0; j < s1; j += Math.max(1, Math.floor((s1 - s0) / 20))) {
                                                                                        const idx = clip.reversed ? (se - 1 - (j - ss) + ss) : j;
                                                                                        const a = Math.abs(ch[idx] || 0);
                                                                                        if (a > mx) mx = a;
                                                                                    }
                                                                                    pts.push(mx);
                                                                                }
                                                                                const rects = pts.map((p, i) => {
                                                                                    const bh = Math.max(0.5, p * 45);
                                                                                    return `<rect x="${i * (100 / numBars)}" y="${50 - bh}" width="${Math.max(0.8, 100 / numBars - 0.3)}" height="${bh * 2}" fill="${clipColor}" opacity="0.7" rx="0.3"/>`;
                                                                                }).join('');
                                                                                waveSvg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">${rects}</svg>`;
                                                                            } catch (ex) { /* ignore */ }
                                                                        }
                                                                        setDraggingClipBetweenTracks({ clip, sourceTrackId: row.trackId, sourceRowId: row.id, clipType: 'audio', patternSvg: waveSvg });
                                                                    }}
                                                                    onDragEnd={() => {
                                                                        setDraggingClipBetweenTracks(null);
                                                                        setClipDropGhost(null);
                                                                    }}
                                                                    onMouseEnter={() => setHoveredAudioClipId(clip.id)}
                                                                    onMouseLeave={() => setHoveredAudioClipId(null)}
                                                                    onContextMenu={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setContextMenu(null);
                                                                        setRowContextMenu(null);
                                                                        setSelectedAudioClipId(clip.id);
                                                                        setSelectedAudioClipTrackId(row.trackId);
                                                                        const sec = sectionAtBar(absBar);
                                                                        if (sec) onSelectSection(sec.id);
                                                                        setAudioClipContextMenu({
                                                                            x: e.clientX, y: e.clientY,
                                                                            clip: clip, trackId: row.trackId,
                                                                            sectionId: sec?.id || arrangement[0]?.id,
                                                                            clipColor: clipColor
                                                                        });
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        clipClickedRef.current = true;
                                                                        setSelectedRow(row.id);
                                                                        const sec = sectionAtBar(absBar);
                                                                        if (sec) onSelectSection(sec.id);
                                                                        setSelectedAudioClipTrackId(row.trackId);
                                                                        if (e.ctrlKey || e.metaKey) {
                                                                            setSelectedAudioClipIds(prev => {
                                                                                const next = new Set(prev);
                                                                                if (next.has(clip.id)) next.delete(clip.id);
                                                                                else next.add(clip.id);
                                                                                return next;
                                                                            });
                                                                            setSelectedAudioClipId(clip.id);
                                                                        } else {
                                                                            setSelectedAudioClipId(clip.id);
                                                                            setSelectedAudioClipIds(new Set([clip.id]));
                                                                            setSelectedMidiClipId(null);
                                                                            setSelectedDrumClipId(null);
                                                                            setSelectedNoteClipId(null);
                                                                            setSelectedNoteClipTrackKey(null);
                                                                            setSelectedDrumLaneClipDrumId(null);
                                                                        }
                                                                    }}
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const sec = sectionAtBar(absBar);
                                                                        if (sec) onSelectSection(sec.id);
                                                                        setFocusedAudioClip({
                                                                            clip: clip, trackId: row.trackId,
                                                                            trackName: row.label, sectionName: sec?.name || ''
                                                                        });
                                                                    }}
                                                                    onMouseDown={(e) => {
                                                                        // Right-edge drag for time stretch
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const edgeZone = 8;
                                                                        if (e.clientX >= rect.right - edgeZone && onUpdateClip && row.trackId) {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const startClipW = clipW;
                                                                            const startClipBars = clipBars;
                                                                            const clipStartBar = clip.startBar || 0;
                                                                            const trackClips = track ? track.clips : [];
                                                                            const laterClips = trackClips.filter(c => c.id !== clip.id && (c.startBar || 0) >= clipStartBar + clipBars - 0.001);
                                                                            const laterStartBars = laterClips.map(c => ({ id: c.id, startBar: c.startBar || 0 }));
                                                                            const onMove = (ev) => {
                                                                                const dx = ev.clientX - startX;
                                                                                const newClipW = Math.max(8, startClipW + dx);
                                                                                const newBars = newClipW / pixelsPerBar;
                                                                                const newDur = newBars * laneSecondsPerBar;
                                                                                const rawDur = bufDur - (clip.trimStart || 0) - (clip.trimEnd || 0);
                                                                                const newRate = Math.max(0.25, Math.min(4, rawDur / newDur));
                                                                                onUpdateClip(row.trackId, clip.id, {
                                                                                    playbackRate: Math.round(newRate * 1000) / 1000
                                                                                });
                                                                                const actualNewBars = rawDur / (newRate * laneSecondsPerBar);
                                                                                const barDelta = actualNewBars - startClipBars;
                                                                                for (const lc of laterStartBars) {
                                                                                    onUpdateClip(row.trackId, lc.id, {
                                                                                        startBar: Math.max(0, Math.round((lc.startBar + barDelta) * 1000) / 1000)
                                                                                    });
                                                                                }
                                                                            };
                                                                            const onUp = () => {
                                                                                window.removeEventListener('mousemove', onMove);
                                                                                window.removeEventListener('mouseup', onUp);
                                                                            };
                                                                            window.addEventListener('mousemove', onMove);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        }
                                                                    }}
                                                                >
                                                                    <WaveformClipCanvas
                                                                        audioBuffer={clip.buffer}
                                                                        width={Math.max(1, clipW - 2)}
                                                                        height={row.height - 4}
                                                                        color={clipColor}
                                                                        trimStart={clip.trimStart || 0}
                                                                        trimEnd={clip.trimEnd || 0}
                                                                        reversed={clip.reversed || false}
                                                                        fadeIn={clip.fadeIn || 0}
                                                                        fadeOut={clip.fadeOut || 0}
                                                                        fadeInCurve={clip.fadeInCurve || 0}
                                                                        fadeOutCurve={clip.fadeOutCurve || 0}
                                                                        isDark={isDark}
                                                                    />
                                                                    {/* Drag handle on right edge */}
                                                                    <div style={{
                                                                        position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px',
                                                                        cursor: 'ew-resize', background: 'transparent'
                                                                    }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${clipColor}44`; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                    />
                                                                    {/* Fade handles — visible on hover or selection */}
                                                                    {(selectedAudioClipId === clip.id || hoveredAudioClipId === clip.id) && clipW > 30 && onUpdateClip && (() => {
                                                                        const fadeDur = effectiveDur || bufDur || 1;
                                                                        const pxPerSec = clipW / fadeDur;
                                                                        const minGapSec = 10 / pxPerSec;
                                                                        const fadeInVal = clip.fadeIn || 0;
                                                                        const fadeOutVal = clip.fadeOut || 0;
                                                                        const fadeInPx = (fadeInVal / fadeDur) * clipW;
                                                                        const fadeOutPx = (fadeOutVal / fadeDur) * clipW;
                                                                        const clipH = row.height - 4;
                                                                        const orangeColor = isDark ? 'rgba(255,159,67,0.9)' : 'rgba(230,150,40,0.9)';
                                                                        const handleStyle = (handleKey) => ({
                                                                            position: 'absolute', top: 0,
                                                                            width: '8px', height: '8px',
                                                                            background: draggingFadeHandle === handleKey ? '#fff' : orangeColor,
                                                                            borderRadius: '50%', cursor: 'ew-resize', zIndex: 6,
                                                                            boxShadow: draggingFadeHandle === handleKey ? '0 0 6px rgba(255,255,255,0.8)' : '0 0 4px rgba(255,159,67,0.5)',
                                                                            transform: 'translate(-50%, 0)'
                                                                        });
                                                                        const midDotStyle = (handleKey) => ({
                                                                            position: 'absolute',
                                                                            width: '6px', height: '6px',
                                                                            background: draggingFadeHandle === handleKey ? '#fff' : orangeColor,
                                                                            borderRadius: '50%', cursor: 'ns-resize', zIndex: 6,
                                                                            boxShadow: draggingFadeHandle === handleKey ? '0 0 6px rgba(255,255,255,0.8)' : '0 0 3px rgba(255,159,67,0.4)',
                                                                            transform: 'translate(-50%, -50%)'
                                                                        });
                                                                        const startFadeDrag = (e, isFadeIn) => {
                                                                            e.stopPropagation(); e.preventDefault();
                                                                            const key = isFadeIn ? 'fadeIn' : 'fadeOut';
                                                                            setDraggingFadeHandle(key);
                                                                            const startX = e.clientX;
                                                                            const startVal = isFadeIn ? fadeInVal : fadeOutVal;
                                                                            const otherVal = isFadeIn ? fadeOutVal : fadeInVal;
                                                                            const maxFade = Math.max(0, fadeDur - otherVal - minGapSec);
                                                                            const onMove = (ev) => {
                                                                                const dx = isFadeIn ? (ev.clientX - startX) : (startX - ev.clientX);
                                                                                const dSec = dx / pxPerSec;
                                                                                const newVal = Math.max(0, Math.min(maxFade, startVal + dSec));
                                                                                const rounded = Math.round(newVal * 1000) / 1000;
                                                                                onUpdateClip(row.trackId, clip.id, isFadeIn ? { fadeIn: rounded } : { fadeOut: rounded });
                                                                            };
                                                                            const onUp = () => {
                                                                                setDraggingFadeHandle(null);
                                                                                window.removeEventListener('mousemove', onMove);
                                                                                window.removeEventListener('mouseup', onUp);
                                                                            };
                                                                            window.addEventListener('mousemove', onMove);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        };
                                                                        const startCurveDrag = (e, isFadeIn) => {
                                                                            e.stopPropagation(); e.preventDefault();
                                                                            const key = isFadeIn ? 'fadeInCurve' : 'fadeOutCurve';
                                                                            setDraggingFadeHandle(key);
                                                                            const startY = e.clientY;
                                                                            const startVal = isFadeIn ? (clip.fadeInCurve || 0) : (clip.fadeOutCurve || 0);
                                                                            const onMove = (ev) => {
                                                                                const dy = startY - ev.clientY;
                                                                                const dCurve = dy / (clipH * 0.5);
                                                                                const newVal = Math.max(-1, Math.min(1, startVal + dCurve));
                                                                                const rounded = Math.round(newVal * 100) / 100;
                                                                                onUpdateClip(row.trackId, clip.id, isFadeIn ? { fadeInCurve: rounded } : { fadeOutCurve: rounded });
                                                                            };
                                                                            const onUp = () => {
                                                                                setDraggingFadeHandle(null);
                                                                                window.removeEventListener('mousemove', onMove);
                                                                                window.removeEventListener('mouseup', onUp);
                                                                            };
                                                                            window.addEventListener('mousemove', onMove);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        };
                                                                        const fadeInCurveVal = clip.fadeInCurve || 0;
                                                                        const fadeOutCurveVal = clip.fadeOutCurve || 0;
                                                                        const fiMidX = fadeInPx * 0.5;
                                                                        const fiCpY = clipH * (0.5 - fadeInCurveVal * 0.5);
                                                                        const fiMidY = 0.25 * clipH + 0.5 * fiCpY + 0.25 * 0;
                                                                        const foMidX = clipW - fadeOutPx * 0.5;
                                                                        const foCpY = clipH * (0.5 - fadeOutCurveVal * 0.5);
                                                                        const foMidY = 0.25 * 0 + 0.5 * foCpY + 0.25 * clipH;
                                                                        return (
                                                                            <>
                                                                                <div style={{ ...handleStyle('fadeIn'), left: `${fadeInPx}px` }}
                                                                                    onMouseDown={(e) => startFadeDrag(e, true)}
                                                                                    title={`Fade In: ${fadeInVal.toFixed(2)}s`}
                                                                                />
                                                                                <div style={{ ...handleStyle('fadeOut'), left: 'auto', right: `${fadeOutPx}px`, transform: 'translate(50%, 0)' }}
                                                                                    onMouseDown={(e) => startFadeDrag(e, false)}
                                                                                    title={`Fade Out: ${fadeOutVal.toFixed(2)}s`}
                                                                                />
                                                                                {fadeInVal > 0 && fadeInPx > 14 && (
                                                                                    <div style={{ ...midDotStyle('fadeInCurve'), left: `${fiMidX}px`, top: `${fiMidY}px` }}
                                                                                        onMouseDown={(e) => startCurveDrag(e, true)}
                                                                                        title={`Curve: ${fadeInCurveVal.toFixed(2)}`}
                                                                                    />
                                                                                )}
                                                                                {fadeOutVal > 0 && fadeOutPx > 14 && (
                                                                                    <div style={{ ...midDotStyle('fadeOutCurve'), left: `${foMidX}px`, top: `${foMidY}px` }}
                                                                                        onMouseDown={(e) => startCurveDrag(e, false)}
                                                                                        title={`Curve: ${fadeOutCurveVal.toFixed(2)}`}
                                                                                    />
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            );
                                                        })}
                                                        {/* Live recording waveform at absolute position */}
                                                        {isRecording && recordingTrackId === row.trackId && recorderRef && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                left: `${recordingStartBar * pixelsPerBar}px`,
                                                                top: 0, width: `${totalWidth - recordingStartBar * pixelsPerBar}px`,
                                                                height: '100%',
                                                                pointerEvents: 'none', zIndex: 3,
                                                                overflow: 'visible'
                                                            }}>
                                                                <RecordingWaveform
                                                                    recorderRef={recorderRef}
                                                                    width={totalWidth - recordingStartBar * pixelsPerBar}
                                                                    height={row.height - 4}
                                                                    color="#ff4444"
                                                                    isDark={isDark}
                                                                    tempo={globalTempo}
                                                                    pixelsPerBar={pixelsPerBar}
                                                                />
                                                            </div>
                                                        )}
                                                        {/* Clip drop ghost preview */}
                                                        {clipDropGhost && clipDropGhost.targetRowId === row.id && (() => {
                                                            const gX = clipDropGhost.bar * pixelsPerBar;
                                                            const gW = Math.max(8, clipDropGhost.widthBars * pixelsPerBar);
                                                            return (
                                                                <div style={{
                                                                    position: 'absolute', left: `${gX}px`, top: 0,
                                                                    width: `${gW}px`, height: '100%',
                                                                    background: isDark ? 'rgba(84,160,255,0.25)' : 'rgba(84,160,255,0.2)',
                                                                    border: '2px dashed rgba(84,160,255,0.7)',
                                                                    borderRadius: '3px', zIndex: 7,
                                                                    pointerEvents: 'none',
                                                                    transition: 'left 0.05s ease-out',
                                                                    overflow: 'hidden'
                                                                }}>
                                                                    {clipDropGhost.patternSvg && (
                                                                        <div style={{ width: '100%', height: '100%', opacity: 0.6 }}
                                                                            dangerouslySetInnerHTML={{ __html: clipDropGhost.patternSvg }} />
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        {/* Audio insertion cursor now rendered at row wrapper level above */}
                                                        {/* Audio loop range indicator */}
                                                        {audioLoopRange && (() => {
                                                            const lrStartPx = audioLoopRange.startBar * pixelsPerBar;
                                                            const lrEndPx = audioLoopRange.endBar * pixelsPerBar;
                                                            const lrWidth = lrEndPx - lrStartPx;
                                                            return (
                                                                <div style={{
                                                                    position: 'absolute', left: `${lrStartPx}px`, top: 0,
                                                                    width: `${lrWidth}px`, height: '100%',
                                                                    background: 'rgba(255,169,77,0.12)',
                                                                    border: '1px solid rgba(255,169,77,0.4)',
                                                                    borderRadius: '2px',
                                                                    pointerEvents: 'none', zIndex: 7
                                                                }}>
                                                                    {/* Loop range label */}
                                                                    <span style={{
                                                                        position: 'absolute', top: '2px', left: '4px',
                                                                        fontSize: '8px', fontWeight: 700,
                                                                        color: '#ffa94d', opacity: 0.7,
                                                                        letterSpacing: '0.5px', pointerEvents: 'none'
                                                                    }}>{t('arrange.loop')}</span>
                                                                    {/* Clear button */}
                                                                    {onSetAudioLoopRange && (
                                                                        <div
                                                                            style={{
                                                                                position: 'absolute', top: '1px', right: '2px',
                                                                                width: '12px', height: '12px',
                                                                                fontSize: '9px', lineHeight: '12px',
                                                                                textAlign: 'center', color: '#ffa94d',
                                                                                cursor: 'pointer', pointerEvents: 'all',
                                                                                borderRadius: '2px', opacity: 0.7
                                                                            }}
                                                                            onClick={(e) => { e.stopPropagation(); onSetAudioLoopRange(null); }}
                                                                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                                                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                                                                            title={t('arrange.clearLoopRange')}
                                                                        >×</div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        {/* Automation overlay for audio lane */}
                                                        {(() => {
                                                            const autoTrackId = row.trackId || row.id;
                                                            if (!automationVisibleTracks.has(autoTrackId)) return null;
                                                            const paramKey = automationSelectedParam[autoTrackId] || 'volume';
                                                            const points = trackAutomation?.[autoTrackId]?.[paramKey] || [];
                                                            if (points.length === 0) return null;
                                                            const cellW = totalWidth;
                                                            const cellH = row.height - 2;
                                                            const totalBarsCalc = totalBars;
                                                            const toX = (bar) => (bar / totalBarsCalc) * cellW;
                                                            const toY = (val) => cellH - (val * cellH);
                                                            const sortedPts = [...points].sort((a, b) => a.bar - b.bar);
                                                            let pathD = `M ${toX(sortedPts[0].bar)} ${toY(sortedPts[0].value)}`;
                                                            for (let i = 1; i < sortedPts.length; i++) {
                                                                pathD += ` L ${toX(sortedPts[i].bar)} ${toY(sortedPts[i].value)}`;
                                                            }
                                                            const fillD = pathD + ` L ${toX(sortedPts[sortedPts.length - 1].bar)} ${cellH} L ${toX(sortedPts[0].bar)} ${cellH} Z`;
                                                            const autoColor = '#2ecc71';
                                                            return (
                                                                <svg style={{
                                                                    position: 'absolute', left: 0, top: 0,
                                                                    width: cellW, height: cellH,
                                                                    pointerEvents: 'none', zIndex: 5
                                                                }} viewBox={`0 0 ${cellW} ${cellH}`} preserveAspectRatio="none">
                                                                    <path d={fillD} fill={`${autoColor}18`} />
                                                                    <path d={pathD} fill="none" stroke={autoColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            })()}
                                            {/* ── MIDI clips (positioned blocks, like audio clips) ── */}
                                            {row.type === 'midi' && row.trackId && (() => {
                                                const mt = midiTracks.find(t => t.id === row.trackId);
                                                const midiClips = mt?.clips || [];
                                                const clipColor = row.color;
                                                const cellH = row.height - 2;
                                                // Helper: find section at a given bar position
                                                const sectionAtBar = (bar) => {
                                                    let cumBars = 0;
                                                    for (const s of arrangement) {
                                                        if (cumBars + s.bars > bar) return s;
                                                        cumBars += s.bars;
                                                    }
                                                    return arrangement[arrangement.length - 1] || arrangement[0];
                                                };
                                                return (
                                                    <div
                                                        style={{
                                                            position: 'absolute', left: 0, top: '1px',
                                                            width: `${totalWidth}px`, height: `${cellH}px`,
                                                            overflow: 'visible', zIndex: 2
                                                        }}
                                                        onClick={(e) => {
                                                            if (clipClickedRef.current) return;
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const relX = e.clientX - rect.left;
                                                            const clickedBar = relX / pixelsPerBar;
                                                            setSelectedRow(row.id);
                                                            setSelectedMidiClipId(null);
                                                            setSelectedMidiClipTrackId(row.trackId);
                                                            setSelectedAudioClipId(null);
                                                            const sec = sectionAtBar(clickedBar);
                                                            if (sec) onSelectSection(sec.id);
                                                            if (onSetAudioInsertionBar) onSetAudioInsertionBar(clickedBar);
                                                        }}
                                                        onMouseDown={(e) => {
                                                            // Shift+drag: create new MIDI clip
                                                            if (e.shiftKey && onAddMidiClip) {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const startBar = Math.max(0, Math.floor((e.clientX - rect.left) / pixelsPerBar));
                                                                setMidiClipCreation({ trackId: row.trackId, startBar, currentBar: startBar + 1, rowColor: clipColor });
                                                                const onMove = (ev) => {
                                                                    const relX = ev.clientX - rect.left;
                                                                    const curBar = Math.max(startBar + 1, Math.min(startBar + 64, Math.ceil(relX / pixelsPerBar)));
                                                                    setMidiClipCreation(prev => prev ? { ...prev, currentBar: curBar } : null);
                                                                };
                                                                const onUp = () => {
                                                                    window.removeEventListener('mousemove', onMove);
                                                                    window.removeEventListener('mouseup', onUp);
                                                                    setMidiClipCreation(prev => {
                                                                        if (prev && prev.trackId === row.trackId) {
                                                                            const bars = Math.max(1, Math.min(64, prev.currentBar - prev.startBar));
                                                                            onAddMidiClip(row.trackId, {
                                                                                timelineBar: prev.startBar,
                                                                                bars,
                                                                                pattern: [],
                                                                                name: t('arrange.midiClip'),
                                                                                color: null
                                                                            });
                                                                        }
                                                                        return null;
                                                                    });
                                                                };
                                                                window.addEventListener('mousemove', onMove);
                                                                window.addEventListener('mouseup', onUp);
                                                            }
                                                        }}
                                                        onDoubleClick={(e) => {
                                                            // Double-click on empty area: create a 4-bar clip
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const relX = e.clientX - rect.left;
                                                            const clickedBar = Math.floor(relX / pixelsPerBar);
                                                            // Check if we clicked on a clip
                                                            const clickedClip = midiClips.find(c => {
                                                                const cStart = c.timelineBar || 0;
                                                                return clickedBar >= cStart && clickedBar < cStart + (c.bars || 4);
                                                            });
                                                            if (!clickedClip && onAddMidiClip) {
                                                                onAddMidiClip(row.trackId, {
                                                                    timelineBar: clickedBar,
                                                                    bars: 4,
                                                                    pattern: [],
                                                                    name: t('arrange.midiClip'),
                                                                    color: null
                                                                });
                                                            }
                                                        }}
                                                        onContextMenu={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const relX = e.clientX - rect.left;
                                                            const clickedBar = relX / pixelsPerBar;
                                                            const sec = sectionAtBar(clickedBar) || arrangement[0];
                                                            handleRowContextMenu(e, row, sec);
                                                        }}
                                                        onDragOver={(e) => {
                                                            if (draggingClipBetweenTracks && (draggingClipBetweenTracks.clipType === 'midi' || draggingClipBetweenTracks.clipType === 'noteClip' || draggingClipBetweenTracks.clipType === 'drumLaneClip')) {
                                                                e.preventDefault();
                                                                e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move';
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropBar = Math.max(0, (e.clientX - rect.left) / pixelsPerBar);
                                                                const midiDurBars = draggingClipBetweenTracks.durationBars || 4;
                                                                setClipDropGhost({ targetRowId: row.id, bar: dropBar, widthBars: midiDurBars, patternSvg: draggingClipBetweenTracks.patternSvg || null });
                                                            }
                                                        }}
                                                        onDragLeave={() => {
                                                            if (clipDropGhost?.targetRowId === row.id) setClipDropGhost(null);
                                                        }}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setClipDropGhost(null);
                                                            const src = draggingClipBetweenTracks;
                                                            // Handle MIDI clip data (from MIDI rows)
                                                            const midiClipData = e.dataTransfer.getData('application/x-wavloom-midi-clip');
                                                            if (midiClipData && onAddMidiClip) {
                                                                const { trackId: srcTrackId, clipId: srcClipId, clip: srcClip } = JSON.parse(midiClipData);
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropBar = Math.max(0, Math.floor((e.clientX - rect.left) / pixelsPerBar));
                                                                const srcBars = srcClip?.bars || 4;
                                                                overwriteMidiClipsInRegion(row.trackId, dropBar, dropBar + srcBars);
                                                                onAddMidiClip(row.trackId, {
                                                                    timelineBar: dropBar,
                                                                    bars: srcBars,
                                                                    pattern: (srcClip?.pattern || []).map(n => ({ ...n })),
                                                                    name: srcClip?.name || t('arrange.midiClip'),
                                                                    color: srcClip?.color || null
                                                                });
                                                                if (!(e.ctrlKey || e.metaKey) && srcTrackId && srcClipId && onRemoveMidiClip) {
                                                                    onRemoveMidiClip(srcTrackId, srcClipId);
                                                                }
                                                            }
                                                            // Handle note clip data (from chords/melody/bass rows)
                                                            else if (src && src.clipType === 'noteClip' && onAddMidiClip) {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropBar = Math.max(0, Math.floor((e.clientX - rect.left) / pixelsPerBar));
                                                                const srcClip = src.clip;
                                                                const srcBars = srcClip?.bars || 4;
                                                                overwriteMidiClipsInRegion(row.trackId, dropBar, dropBar + srcBars);
                                                                onAddMidiClip(row.trackId, {
                                                                    timelineBar: dropBar,
                                                                    bars: srcBars,
                                                                    pattern: (srcClip?.pattern || []).map(n => ({ ...n })),
                                                                    name: srcClip?.name || t('arrange.midiClip'),
                                                                    color: srcClip?.color || null
                                                                });
                                                                if (!(e.ctrlKey || e.metaKey) && src.sourceTrackKey) {
                                                                    const noteRemoveMap = { chords: onRemoveChordClip, melody: onRemoveMelodyClip, bass: onRemoveBassClip };
                                                                    const removeFn = noteRemoveMap[src.sourceTrackKey];
                                                                    if (removeFn) removeFn(srcClip.id);
                                                                }
                                                            }
                                                            // Handle drum lane clip data → convert to MIDI note pattern
                                                            else if (src && src.clipType === 'drumLaneClip' && onAddMidiClip) {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropBar = Math.max(0, Math.floor((e.clientX - rect.left) / pixelsPerBar));
                                                                const srcClip = src.clip;
                                                                const bars = srcClip?.bars || 4;
                                                                const steps = bars * 32;
                                                                const notePattern = [];
                                                                if (srcClip?.laneData?.lanes) {
                                                                    for (const lane of Object.values(srcClip.laneData.lanes)) {
                                                                        if (lane.pattern) {
                                                                            lane.pattern.forEach((hit, si) => {
                                                                                if (hit && si < steps) {
                                                                                    notePattern.push({ time: si, duration: (lane.duration || [])[si] || 1, note: 60, velocity: ((lane.velocity || [])[si] || 100) / 127 });
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                overwriteMidiClipsInRegion(row.trackId, dropBar, dropBar + bars);
                                                                onAddMidiClip(row.trackId, {
                                                                    timelineBar: dropBar, bars,
                                                                    pattern: notePattern,
                                                                    name: srcClip?.name || t('arrange.midiClip'),
                                                                    color: srcClip?.color || null
                                                                });
                                                                if (!(e.ctrlKey || e.metaKey) && src.sourceDrumId && onRemoveDrumLaneClip) {
                                                                    onRemoveDrumLaneClip(src.sourceDrumId, srcClip.id);
                                                                }
                                                            }
                                                            setDraggingClipBetweenTracks(null);
                                                        }}
                                                    >
                                                        {/* Faint section boundary lines */}
                                                        {arrangement.map((section, si) => {
                                                            if (si === 0) return null;
                                                            const bx = sectionOffsets[si] * pixelsPerBar;
                                                            return (
                                                                <div key={`sb-${si}`} style={{
                                                                    position: 'absolute', left: `${bx}px`, top: 0,
                                                                    width: '1px', height: '100%',
                                                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                                                    pointerEvents: 'none', zIndex: 0,
                                                                    borderLeft: '1px dashed',
                                                                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                                                                }} />
                                                            );
                                                        })}
                                                        {/* Shift+drag creation ghost */}
                                                        {midiClipCreation && midiClipCreation.trackId === row.trackId && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                left: `${midiClipCreation.startBar * pixelsPerBar}px`,
                                                                top: 0,
                                                                width: `${(midiClipCreation.currentBar - midiClipCreation.startBar) * pixelsPerBar}px`,
                                                                height: '100%',
                                                                background: `${clipColor}33`,
                                                                border: `1px dashed ${clipColor}`,
                                                                borderRadius: '3px',
                                                                pointerEvents: 'none',
                                                                zIndex: 10
                                                            }} />
                                                        )}
                                                        {/* Clip drop ghost */}
                                                        {clipDropGhost && clipDropGhost.targetRowId === row.id && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                left: `${clipDropGhost.bar * pixelsPerBar}px`,
                                                                top: 0,
                                                                width: `${clipDropGhost.widthBars * pixelsPerBar}px`,
                                                                height: '100%',
                                                                background: `${clipColor}22`,
                                                                border: `2px dashed ${clipColor}88`,
                                                                borderRadius: '3px',
                                                                pointerEvents: 'none',
                                                                zIndex: 10,
                                                                overflow: 'hidden'
                                                            }}>
                                                                {clipDropGhost.patternSvg && (
                                                                    <div style={{ width: '100%', height: '100%', opacity: 0.6 }}
                                                                        dangerouslySetInnerHTML={{ __html: clipDropGhost.patternSvg }} />
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* Render each MIDI clip */}
                                                        {midiClips.map((clip) => {
                                                            const clipStartPx = (clip.timelineBar || 0) * pixelsPerBar;
                                                            const clipW = Math.max(8, (clip.bars || 4) * pixelsPerBar);
                                                            const isSelected = selectedMidiClipId === clip.id;
                                                            // Mini piano roll preview: render note bars
                                                            const notes = clip.pattern || [];
                                                            const clipSteps = (clip.bars || 4) * 32;
                                                            const noteMin = notes.length > 0 ? Math.min(...notes.map(n => n.note)) : 60;
                                                            const noteMax = notes.length > 0 ? Math.max(...notes.map(n => n.note)) : 72;
                                                            const noteRange = Math.max(1, noteMax - noteMin + 1);
                                                            return (
                                                                <div
                                                                    key={clip.id}
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.stopPropagation();
                                                                        e.dataTransfer.effectAllowed = 'copyMove';
                                                                        e.dataTransfer.setData('application/x-wavloom-midi-clip', JSON.stringify({
                                                                            trackId: row.trackId, clipId: clip.id,
                                                                            clip: { bars: clip.bars, pattern: clip.pattern, name: clip.name, color: clip.color }
                                                                        }));
                                                                        // Center ghost preview under cursor
                                                                        const elRect = e.currentTarget.getBoundingClientRect();
                                                                        e.dataTransfer.setDragImage(e.currentTarget, e.clientX - elRect.left, e.clientY - elRect.top);
                                                                        // Build SVG string for ghost preview
                                                                        const mSteps = (clip.bars || 4) * 32;
                                                                        const mNotes = clip.pattern || [];
                                                                        const mMin = mNotes.length > 0 ? Math.min(...mNotes.map(n => n.note)) : 60;
                                                                        const mMax = mNotes.length > 0 ? Math.max(...mNotes.map(n => n.note)) : 72;
                                                                        const mRange = Math.max(1, mMax - mMin + 1);
                                                                        const mRects = mNotes.map(n => {
                                                                            if (n.time >= mSteps) return '';
                                                                            const w = Math.min(Math.max(1, n.duration || 2), mSteps - n.time);
                                                                            return `<rect x="${n.time}" y="${mMax - n.note}" width="${w}" height="0.8" fill="${clipColor}" opacity="0.7"/>`;
                                                                        }).join('');
                                                                        const mSvg = `<svg viewBox="0 0 ${mSteps} ${mRange}" preserveAspectRatio="none" style="width:100%;height:100%">${mRects}</svg>`;
                                                                        setDraggingClipBetweenTracks({
                                                                            clip, sourceTrackId: row.trackId, sourceRowId: row.id,
                                                                            clipType: 'midi', durationBars: clip.bars || 4,
                                                                            patternSvg: mSvg
                                                                        });
                                                                    }}
                                                                    onDragEnd={() => {
                                                                        setDraggingClipBetweenTracks(null);
                                                                        setClipDropGhost(null);
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        clipClickedRef.current = true;
                                                                        setSelectedRow(row.id);
                                                                        setSelectedMidiClipId(clip.id);
                                                                        setSelectedMidiClipTrackId(row.trackId);
                                                                        setSelectedAudioClipId(null);
                                                                        setSelectedDrumClipId(null);
                                                                        setSelectedNoteClipId(null);
                                                                        setSelectedNoteClipTrackKey(null);
                                                                        setSelectedDrumLaneClipDrumId(null);
                                                                        if (arrangement.length > 0) onSelectSection(arrangement[0].id);
                                                                    }}
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Open piano roll editor for this clip
                                                                        if (onSetEditingMidiTrack && onSetEditingMidiClipId) {
                                                                            onSetEditingMidiTrack(row.trackId);
                                                                            onSetEditingMidiClipId(clip.id);
                                                                        }
                                                                    }}
                                                                    onContextMenu={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setSelectedMidiClipId(clip.id);
                                                                        setSelectedMidiClipTrackId(row.trackId);
                                                                        setContextMenu(null);
                                                                        setRowContextMenu(null);
                                                                        // Show MIDI clip context menu
                                                                        setAudioClipContextMenu({
                                                                            x: e.clientX, y: e.clientY,
                                                                            clip: clip, trackId: row.trackId,
                                                                            isMidiClip: true,
                                                                            clipColor: clipColor
                                                                        });
                                                                    }}
                                                                    onMouseDown={(e) => {
                                                                        // Prevent native drag when on resize edge
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        if (e.clientX >= rect.right - 10) {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        position: 'absolute', left: `${clipStartPx}px`, top: 0,
                                                                        width: `${clipW}px`, height: '100%',
                                                                        background: isSelected
                                                                            ? `${clipColor}${isDark ? '70' : '60'}`
                                                                            : `${clipColor}${isDark ? '28' : '30'}`,
                                                                        border: isSelected ? `2px solid ${clipColor}` : `1px solid ${clipColor}66`,
                                                                        borderRadius: '3px',
                                                                        overflow: 'hidden',
                                                                        cursor: 'pointer',
                                                                        zIndex: isSelected ? 5 : 3
                                                                    }}
                                                                >
                                                                    {/* Clip name label */}
                                                                    <div style={{
                                                                        position: 'absolute', top: 0, left: '3px',
                                                                        fontSize: '9px', fontWeight: 600,
                                                                        color: clipColor,
                                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                                        maxWidth: clipW - 6, pointerEvents: 'none',
                                                                        lineHeight: '14px'
                                                                    }}>
                                                                        {clip.name || t('arrange.midiClip')}
                                                                    </div>
                                                                    {/* Mini piano roll preview */}
                                                                    {notes.length > 0 && (
                                                                        <svg style={{
                                                                            position: 'absolute', left: 0, top: '14px',
                                                                            width: clipW, height: Math.max(1, cellH - 16),
                                                                            pointerEvents: 'none'
                                                                        }} viewBox={`0 0 ${clipSteps} ${noteRange}`} preserveAspectRatio="none">
                                                                            {notes.map((n, ni) => {
                                                                                if (n.time >= clipSteps) return null;
                                                                                const w = Math.min(Math.max(1, n.duration || 2), clipSteps - n.time);
                                                                                return (
                                                                                    <rect
                                                                                        key={ni}
                                                                                        x={n.time}
                                                                                        y={noteMax - n.note}
                                                                                        width={w}
                                                                                        height={0.8}
                                                                                        fill={clipColor}
                                                                                        opacity={0.7}
                                                                                    />
                                                                                );
                                                                            })}
                                                                        </svg>
                                                                    )}
                                                                    {/* Resize handle on right edge */}
                                                                    <div style={{
                                                                        position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px',
                                                                        cursor: 'ew-resize', background: 'transparent', zIndex: 4
                                                                    }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${clipColor}44`; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                        onMouseDown={(e) => {
                                                                            if (!onUpdateMidiClip) return;
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const startW = clipW;
                                                                            const origBars = clip.bars || 4;
                                                                            const origSteps = origBars * 32;
                                                                            const baseNotes = (clip.pattern || []).filter(n => n.time < origSteps);
                                                                            const onMv = (ev) => {
                                                                                const dx = ev.clientX - startX;
                                                                                const newW = Math.max(pixelsPerBar, startW + dx);
                                                                                const newBars = Math.max(1, Math.min(128, Math.round(newW / pixelsPerBar)));
                                                                                if (newBars > origBars && baseNotes.length > 0) {
                                                                                    const newSteps = newBars * 32;
                                                                                    const passes = Math.ceil(newBars / origBars);
                                                                                    const looped = [];
                                                                                    for (let p = 0; p < passes; p++) {
                                                                                        const offset = p * origSteps;
                                                                                        for (const n of baseNotes) {
                                                                                            const t = n.time + offset;
                                                                                            if (t >= newSteps) continue;
                                                                                            looped.push({ ...n, time: t, duration: Math.min(n.duration, newSteps - t) });
                                                                                        }
                                                                                    }
                                                                                    onUpdateMidiClip(row.trackId, clip.id, { bars: newBars, pattern: looped });
                                                                                } else {
                                                                                    onUpdateMidiClip(row.trackId, clip.id, { bars: newBars });
                                                                                }
                                                                            };
                                                                            const onUp = () => {
                                                                                window.removeEventListener('mousemove', onMv);
                                                                                window.removeEventListener('mouseup', onUp);
                                                                            };
                                                                            window.addEventListener('mousemove', onMv);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                            {/* ── Drum clips (positioned blocks on drums-all row) ── */}
                                            {row.type === 'drums-all' && drumClips.length > 0 && (() => {
                                                const clipColor = row.color || '#ff6b6b';
                                                const cellH = row.height - 2;
                                                return (
                                                    <div
                                                        style={{
                                                            position: 'absolute', left: 0, top: '1px',
                                                            width: `${totalWidth}px`, height: `${cellH}px`,
                                                            overflow: 'visible', zIndex: 2
                                                        }}
                                                        onClick={(e) => {
                                                            if (clipClickedRef.current) return;
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const clickedBar = Math.floor((e.clientX - rect.left) / pixelsPerBar);
                                                            setSelectedRow(row.id);
                                                            setSelectedDrumClipId(null);
                                                            setSelectedAudioClipId(null);
                                                            setSelectedMidiClipId(null);
                                                            const sec = (() => { let cum = 0; for (const s of arrangement) { if (cum + s.bars > clickedBar) return s; cum += s.bars; } return arrangement[arrangement.length - 1]; })();
                                                            if (sec) onSelectSection(sec.id);
                                                            if (onSetAudioInsertionBar) onSetAudioInsertionBar(clickedBar);
                                                        }}
                                                    >
                                                        {/* Faint section boundary lines */}
                                                        {arrangement.map((section, si) => {
                                                            if (si === 0) return null;
                                                            const bx = sectionOffsets[si] * pixelsPerBar;
                                                            return (
                                                                <div key={`dsb-${si}`} style={{
                                                                    position: 'absolute', left: `${bx}px`, top: 0,
                                                                    width: '1px', height: '100%',
                                                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                                                    pointerEvents: 'none', zIndex: 0,
                                                                    borderLeft: '1px dashed',
                                                                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                                                                }} />
                                                            );
                                                        })}
                                                        {/* Render each drum clip */}
                                                        {drumClips.map((clip) => {
                                                            const clipStartPx = (clip.timelineBar || 0) * pixelsPerBar;
                                                            const clipW = Math.max(8, (clip.bars || 4) * pixelsPerBar);
                                                            const isSelected = selectedDrumClipId === clip.id;
                                                            const cc = clip.color || clipColor;
                                                            // Mini drum pattern preview: count hits per drum lane
                                                            const drumIds = clip.drumStates ? Object.keys(clip.drumStates) : [];
                                                            const clipSteps = (clip.bars || 4) * 32;
                                                            return (
                                                                <div
                                                                    key={clip.id}
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.stopPropagation();
                                                                        e.dataTransfer.effectAllowed = 'copyMove';
                                                                        e.dataTransfer.setData('application/x-wavloom-drum-clip', JSON.stringify({
                                                                            clipId: clip.id
                                                                        }));
                                                                        // Center ghost preview under cursor
                                                                        const elRect = e.currentTarget.getBoundingClientRect();
                                                                        e.dataTransfer.setDragImage(e.currentTarget, e.clientX - elRect.left, e.clientY - elRect.top);
                                                                    }}
                                                                    onDragEnd={() => {}}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        clipClickedRef.current = true;
                                                                        setSelectedRow(row.id);
                                                                        setSelectedDrumClipId(clip.id);
                                                                        setSelectedMidiClipId(null);
                                                                        setSelectedAudioClipId(null);
                                                                        setSelectedNoteClipId(null);
                                                                        setSelectedNoteClipTrackKey(null);
                                                                        setSelectedDrumLaneClipDrumId(null);
                                                                        if (arrangement.length > 0) onSelectSection(arrangement[0].id);
                                                                    }}
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (onSetEditingDrumClipId) onSetEditingDrumClipId(clip.id);
                                                                    }}
                                                                    onContextMenu={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setSelectedDrumClipId(clip.id);
                                                                        setContextMenu(null);
                                                                        setRowContextMenu(null);
                                                                        setAudioClipContextMenu({
                                                                            x: e.clientX, y: e.clientY,
                                                                            clip: clip, trackId: null,
                                                                            isDrumClip: true,
                                                                            clipColor: cc
                                                                        });
                                                                    }}
                                                                    onMouseDown={(e) => {
                                                                        // Right-edge drag for resize with pattern looping
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const edgeZone = 8;
                                                                        if (e.clientX >= rect.right - edgeZone && onUpdateDrumClip) {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const startW = clipW;
                                                                            const origBars = clip.bars || 4;
                                                                            const origSteps = origBars * 32;
                                                                            // Snapshot original drum states for looping
                                                                            const baseDrumStates = clip.drumStates ? JSON.parse(JSON.stringify(clip.drumStates)) : null;
                                                                            const onMove = (ev) => {
                                                                                const dx = ev.clientX - startX;
                                                                                const newW = Math.max(pixelsPerBar, startW + dx);
                                                                                const newBars = Math.max(1, Math.min(64, Math.round(newW / pixelsPerBar)));
                                                                                const newSteps = newBars * 32;
                                                                                if (newBars > origBars && baseDrumStates) {
                                                                                    // Loop drum pattern to fill extended length
                                                                                    const looped = {};
                                                                                    for (const [dId, drum] of Object.entries(baseDrumStates)) {
                                                                                        const newDrum = { ...drum };
                                                                                        if (drum.lanes && typeof drum.lanes === 'object') {
                                                                                            const newLanes = {};
                                                                                            for (const [lId, lane] of Object.entries(drum.lanes)) {
                                                                                                const newLane = { ...lane };
                                                                                                const loopArr = (arr, defVal) => {
                                                                                                    if (!Array.isArray(arr)) return new Array(newSteps).fill(defVal);
                                                                                                    const srcLen = Math.min(arr.length, origSteps);
                                                                                                    if (srcLen === 0) return new Array(newSteps).fill(defVal);
                                                                                                    const out = new Array(newSteps);
                                                                                                    for (let i = 0; i < newSteps; i++) out[i] = arr[i % srcLen];
                                                                                                    return out;
                                                                                                };
                                                                                                newLane.pattern = loopArr(lane.pattern, false);
                                                                                                newLane.velocity = loopArr(lane.velocity, 100);
                                                                                                newLane.duration = loopArr(lane.duration, 1);
                                                                                                newLanes[lId] = newLane;
                                                                                            }
                                                                                            newDrum.lanes = newLanes;
                                                                                        }
                                                                                        looped[dId] = newDrum;
                                                                                    }
                                                                                    onUpdateDrumClip(clip.id, { bars: newBars, drumStates: looped });
                                                                                } else {
                                                                                    // Shrinking or no drum states — just update bars
                                                                                    onUpdateDrumClip(clip.id, { bars: newBars });
                                                                                }
                                                                            };
                                                                            const onUp = () => {
                                                                                window.removeEventListener('mousemove', onMove);
                                                                                window.removeEventListener('mouseup', onUp);
                                                                            };
                                                                            window.addEventListener('mousemove', onMove);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        } else if (e.clientX <= rect.left + edgeZone && onUpdateDrumClip && onMoveDrumClip) {
                                                                            // Left-edge drag for resize
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const startBar = clip.timelineBar || 0;
                                                                            const startBars = clip.bars || 4;
                                                                            const onMove = (ev) => {
                                                                                const dx = ev.clientX - startX;
                                                                                const barDelta = Math.round(dx / pixelsPerBar);
                                                                                const newStart = Math.max(0, startBar + barDelta);
                                                                                const newBars = Math.max(1, startBars - (newStart - startBar));
                                                                                onMoveDrumClip(clip.id, newStart);
                                                                                onUpdateDrumClip(clip.id, { bars: newBars });
                                                                            };
                                                                            const onUp = () => {
                                                                                window.removeEventListener('mousemove', onMove);
                                                                                window.removeEventListener('mouseup', onUp);
                                                                            };
                                                                            window.addEventListener('mousemove', onMove);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        } else if (onMoveDrumClip) {
                                                                            // Drag to move clip position
                                                                            e.stopPropagation();
                                                                            const startX = e.clientX;
                                                                            const startBar = clip.timelineBar || 0;
                                                                            let moved = false;
                                                                            const onMove = (ev) => {
                                                                                moved = true;
                                                                                const dx = ev.clientX - startX;
                                                                                const newBar = Math.max(0, Math.round(startBar + dx / pixelsPerBar));
                                                                                onMoveDrumClip(clip.id, newBar);
                                                                            };
                                                                            const onUp = () => {
                                                                                window.removeEventListener('mousemove', onMove);
                                                                                window.removeEventListener('mouseup', onUp);
                                                                            };
                                                                            window.addEventListener('mousemove', onMove);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        position: 'absolute', left: `${clipStartPx}px`, top: 0,
                                                                        width: `${clipW}px`, height: '100%',
                                                                        background: isSelected
                                                                            ? `${cc}${isDark ? '70' : '60'}`
                                                                            : `${cc}${isDark ? '28' : '30'}`,
                                                                        border: isSelected ? `2px solid ${cc}` : `1px solid ${cc}66`,
                                                                        borderRadius: '3px',
                                                                        overflow: 'hidden',
                                                                        cursor: 'pointer',
                                                                        zIndex: isSelected ? 5 : 3
                                                                    }}
                                                                >
                                                                    {/* Clip name label */}
                                                                    <div style={{
                                                                        position: 'absolute', top: 0, left: '3px',
                                                                        fontSize: '9px', fontWeight: 600,
                                                                        color: cc,
                                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                                        maxWidth: clipW - 6, pointerEvents: 'none',
                                                                        lineHeight: '14px'
                                                                    }}>
                                                                        {clip.name || 'Drum Clip'}
                                                                    </div>
                                                                    {/* Mini drum pattern preview */}
                                                                    {drumIds.length > 0 && (
                                                                        <svg style={{
                                                                            position: 'absolute', left: 0, top: '14px',
                                                                            width: clipW, height: Math.max(1, cellH - 16),
                                                                            pointerEvents: 'none'
                                                                        }} viewBox={`0 0 ${clipSteps} ${drumIds.length}`} preserveAspectRatio="none">
                                                                            {drumIds.map((drumId, di) => {
                                                                                const drum = clip.drumStates[drumId];
                                                                                if (!drum || !drum.powered) return null;
                                                                                const rootLane = drum.lanes?.root;
                                                                                if (!rootLane) return null;
                                                                                return rootLane.pattern.map((hit, si) => hit ? (
                                                                                    <rect
                                                                                        key={`${di}-${si}`}
                                                                                        x={si}
                                                                                        y={di}
                                                                                        width={1}
                                                                                        height={0.8}
                                                                                        fill={cc}
                                                                                        opacity={0.7}
                                                                                    />
                                                                                ) : null);
                                                                            })}
                                                                        </svg>
                                                                    )}
                                                                    {/* Resize handle on left edge */}
                                                                    <div style={{
                                                                        position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px',
                                                                        cursor: 'ew-resize', background: 'transparent', zIndex: 6
                                                                    }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${cc}44`; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                    />
                                                                    {/* Resize handle on right edge */}
                                                                    <div style={{
                                                                        position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px',
                                                                        cursor: 'ew-resize', background: 'transparent', zIndex: 6
                                                                    }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${cc}44`; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                            {/* ── Note-based clips (chords/melody/bass positioned blocks) ── */}
                                            {row.trackKey && (() => {
                                                const clipMap = { chords: chordClips, melody: melodyClips, bass: bassClips };
                                                const updateMap = { chords: onUpdateChordClip, melody: onUpdateMelodyClip, bass: onUpdateBassClip };
                                                const moveMap = { chords: onMoveChordClip, melody: onMoveMelodyClip, bass: onMoveBassClip };
                                                const editSetMap = { chords: onSetEditingChordClipId, melody: onSetEditingMelodyClipId, bass: onSetEditingBassClipId };
                                                const removeMap = { chords: onRemoveChordClip, melody: onRemoveMelodyClip, bass: onRemoveBassClip };
                                                const editIdMap = { chords: editingChordClipId, melody: editingMelodyClipId, bass: editingBassClipId };
                                                const clips = clipMap[row.trackKey] || [];
                                                const hasDragInProgress = draggingClipBetweenTracks && (draggingClipBetweenTracks.clipType === 'noteClip' || draggingClipBetweenTracks.clipType === 'midi');
                                                if (clips.length === 0 && !hasDragInProgress) return null;
                                                const onUpdate = updateMap[row.trackKey];
                                                const onMove = moveMap[row.trackKey];
                                                const onSetEditing = editSetMap[row.trackKey];
                                                const onRemove = removeMap[row.trackKey];
                                                const clipColor = row.color || '#70a1ff';
                                                const cellH = row.height - 2;
                                                return (
                                                    <div style={{ position: 'absolute', left: 0, top: '1px', width: `${totalWidth}px`, height: `${cellH}px`, overflow: 'visible', zIndex: 2, cursor: 'default' }}
                                                        onClick={(e) => {
                                                            if (clipClickedRef.current) return;
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const clickedBar = Math.floor((e.clientX - rect.left) / pixelsPerBar);
                                                            setSelectedRow(row.id);
                                                            setSelectedMidiClipId(null);
                                                            setSelectedAudioClipId(null);
                                                            const sec = (() => { let cum = 0; for (const s of arrangement) { if (cum + s.bars > clickedBar) return s; cum += s.bars; } return arrangement[arrangement.length - 1]; })();
                                                            if (sec) onSelectSection(sec.id);
                                                            if (onSetAudioInsertionBar) onSetAudioInsertionBar(clickedBar);
                                                        }}
                                                        onDragOver={(e) => {
                                                            if (draggingClipBetweenTracks && (draggingClipBetweenTracks.clipType === 'noteClip' || draggingClipBetweenTracks.clipType === 'midi')) {
                                                                e.preventDefault();
                                                                e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move';
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropBar = Math.max(0, (e.clientX - rect.left) / pixelsPerBar);
                                                                const durBars = draggingClipBetweenTracks.durationBars || 4;
                                                                setClipDropGhost({ targetRowId: row.id, bar: dropBar, widthBars: durBars, patternSvg: draggingClipBetweenTracks.patternSvg || null });
                                                            }
                                                        }}
                                                        onDragLeave={() => {
                                                            if (clipDropGhost?.targetRowId === row.id) setClipDropGhost(null);
                                                        }}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setClipDropGhost(null);
                                                            const src = draggingClipBetweenTracks;
                                                            if (src && (src.clipType === 'noteClip' || src.clipType === 'midi')) {
                                                                const addMap = { chords: onAddChordClip, melody: onAddMelodyClip, bass: onAddBassClip };
                                                                const noteRemoveMap = { chords: onRemoveChordClip, melody: onRemoveMelodyClip, bass: onRemoveBassClip };
                                                                const addFn = addMap[row.trackKey];
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropBar = Math.max(0, Math.floor((e.clientX - rect.left) / pixelsPerBar));
                                                                const srcClip = src.clip;
                                                                const srcPattern = srcClip?.pattern || [];
                                                                const srcBars = srcClip?.bars || 4;
                                                                if (addFn) {
                                                                    const isSameTrack = src.clipType === 'noteClip' && src.sourceTrackKey === row.trackKey;
                                                                    // If moving within same track, remove source FIRST to avoid overwrite collision
                                                                    if (isSameTrack && !(e.ctrlKey || e.metaKey)) {
                                                                        const removeFn = noteRemoveMap[src.sourceTrackKey];
                                                                        if (removeFn) removeFn(srcClip.id);
                                                                    }
                                                                    overwriteNoteClipsInRegion(row.trackKey, dropBar, dropBar + srcBars);
                                                                    // Use target track color for cross-track moves
                                                                    const useColor = isSameTrack ? (srcClip?.color || null) : null;
                                                                    addFn({
                                                                        timelineBar: dropBar,
                                                                        bars: srcBars,
                                                                        pattern: srcPattern.map(n => ({ ...n })),
                                                                        name: srcClip?.name || `${row.trackKey} Clip`,
                                                                        color: useColor
                                                                    });
                                                                    // If not Ctrl (copy) and cross-track, remove from source
                                                                    if (!isSameTrack && !(e.ctrlKey || e.metaKey)) {
                                                                        if (src.clipType === 'noteClip' && src.sourceTrackKey) {
                                                                            const removeFn = noteRemoveMap[src.sourceTrackKey];
                                                                            if (removeFn) removeFn(srcClip.id);
                                                                        } else if (src.clipType === 'midi' && src.sourceTrackId && onRemoveMidiClip) {
                                                                            onRemoveMidiClip(src.sourceTrackId, srcClip.id);
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            setDraggingClipBetweenTracks(null);
                                                        }}
                                                    >
                                                        {arrangement.map((section, si) => {
                                                            if (si === 0) return null;
                                                            const bx = sectionOffsets[si] * pixelsPerBar;
                                                            return (<div key={`nsb-${si}`} style={{ position: 'absolute', left: `${bx}px`, top: 0, width: '1px', height: '100%', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', pointerEvents: 'none', zIndex: 0, borderLeft: '1px dashed', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />);
                                                        })}
                                                        {clips.map((clip) => {
                                                            const clipStartPx = (clip.timelineBar || 0) * pixelsPerBar;
                                                            const clipW = Math.max(8, (clip.bars || 4) * pixelsPerBar);
                                                            const isSelected = selectedNoteClipId === clip.id || editIdMap[row.trackKey] === clip.id;
                                                            const cc = clip.color || clipColor;
                                                            const notes = clip.pattern || [];
                                                            const clipSteps = (clip.bars || 4) * 32;
                                                            const noteMin = notes.length > 0 ? Math.min(...notes.map(n => n.note)) : 60;
                                                            const noteMax = notes.length > 0 ? Math.max(...notes.map(n => n.note)) : 72;
                                                            const noteRange = Math.max(1, noteMax - noteMin + 1);
                                                            return (
                                                                <div key={clip.id}
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.stopPropagation();
                                                                        e.dataTransfer.effectAllowed = 'copyMove';
                                                                        e.dataTransfer.setData('application/x-wavloom-note-clip', JSON.stringify({
                                                                            trackKey: row.trackKey, clipId: clip.id,
                                                                            clip: { bars: clip.bars, pattern: clip.pattern, name: clip.name, color: clip.color }
                                                                        }));
                                                                        // Center ghost preview under cursor
                                                                        const elRect = e.currentTarget.getBoundingClientRect();
                                                                        e.dataTransfer.setDragImage(e.currentTarget, e.clientX - elRect.left, e.clientY - elRect.top);
                                                                        // Build SVG string for ghost preview
                                                                        const cSteps = (clip.bars || 4) * 32;
                                                                        const cNotes = clip.pattern || [];
                                                                        const nMin = cNotes.length > 0 ? Math.min(...cNotes.map(n => n.note)) : 60;
                                                                        const nMax = cNotes.length > 0 ? Math.max(...cNotes.map(n => n.note)) : 72;
                                                                        const nRange = Math.max(1, nMax - nMin + 1);
                                                                        const svgRects = cNotes.map(n => {
                                                                            if (n.time >= cSteps) return '';
                                                                            const w = Math.min(Math.max(1, n.duration || 2), cSteps - n.time);
                                                                            return `<rect x="${n.time}" y="${nMax - n.note}" width="${w}" height="0.8" fill="${cc}" opacity="0.7"/>`;
                                                                        }).join('');
                                                                        const pSvg = `<svg viewBox="0 0 ${cSteps} ${nRange}" preserveAspectRatio="none" style="width:100%;height:100%">${svgRects}</svg>`;
                                                                        setDraggingClipBetweenTracks({
                                                                            clip, sourceTrackKey: row.trackKey, sourceRowId: row.id,
                                                                            clipType: 'noteClip', durationBars: clip.bars || 4,
                                                                            patternSvg: pSvg
                                                                        });
                                                                    }}
                                                                    onDragEnd={() => {
                                                                        setDraggingClipBetweenTracks(null);
                                                                        setClipDropGhost(null);
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        clipClickedRef.current = true;
                                                                        console.log('[NoteClip Click] clipId:', clip.id, 'trackKey:', row.trackKey, 'rowId:', row.id);
                                                                        setSelectedRow(row.id);
                                                                        setSelectedNoteClipId(clip.id);
                                                                        setSelectedNoteClipTrackKey(row.trackKey);
                                                                        setSelectedMidiClipId(null);
                                                                        setSelectedAudioClipId(null);
                                                                        setSelectedDrumClipId(null);
                                                                        setSelectedDrumLaneClipDrumId(null);
                                                                        if (arrangement.length > 0) onSelectSection(arrangement[0].id);
                                                                    }}
                                                                    onDoubleClick={(e) => { e.stopPropagation(); if (onSetEditing) onSetEditing(clip.id); }}
                                                                    onContextMenu={(e) => {
                                                                        e.preventDefault(); e.stopPropagation();
                                                                        setContextMenu(null); setRowContextMenu(null);
                                                                        setAudioClipContextMenu({ x: e.clientX, y: e.clientY, clip, trackId: null, isNoteClip: true, noteClipTrackKey: row.trackKey, clipColor: cc });
                                                                    }}
                                                                    onMouseDown={(e) => {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const edgeZone = 8;
                                                                        if (e.clientX >= rect.right - edgeZone && onUpdate) {
                                                                            // Right-edge resize — prevent native drag, use manual resize
                                                                            e.stopPropagation(); e.preventDefault();
                                                                            const startX = e.clientX; const startW = clipW;
                                                                            const stepsPerPx = 32 / pixelsPerBar;
                                                                            const origBars = clip.bars || 4;
                                                                            const origSteps = origBars * 32;
                                                                            const baseNotes = (clip.pattern || []).filter(n => n.time < origSteps);
                                                                            const onMv = (ev) => {
                                                                                const dx = ev.clientX - startX;
                                                                                const newW = Math.max(pixelsPerBar / 32, startW + dx);
                                                                                const newSteps = Math.max(1, Math.round(newW * stepsPerPx));
                                                                                const newBars = Math.min(128, newSteps / 32);
                                                                                if (newBars > origBars && baseNotes.length > 0) {
                                                                                    const passes = Math.ceil(newSteps / origSteps);
                                                                                    const looped = [];
                                                                                    for (let p = 0; p < passes; p++) {
                                                                                        const offset = p * origSteps;
                                                                                        for (const n of baseNotes) {
                                                                                            const t = n.time + offset;
                                                                                            if (t >= newSteps) continue;
                                                                                            looped.push({ ...n, time: t, duration: Math.min(n.duration, newSteps - t) });
                                                                                        }
                                                                                    }
                                                                                    onUpdate(clip.id, { bars: newBars, pattern: looped });
                                                                                } else {
                                                                                    onUpdate(clip.id, { bars: newBars });
                                                                                }
                                                                            };
                                                                            const onUp = () => { window.removeEventListener('mousemove', onMv); window.removeEventListener('mouseup', onUp); };
                                                                            window.addEventListener('mousemove', onMv); window.addEventListener('mouseup', onUp);
                                                                        } else if (e.clientX <= rect.left + edgeZone && onUpdate && onMove) {
                                                                            // Left-edge resize — prevent native drag, use manual resize
                                                                            e.stopPropagation(); e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const origBar = clip.timelineBar || 0;
                                                                            const origBars = clip.bars || 4;
                                                                            const origEnd = origBar + origBars;
                                                                            const stepsPerPx = 32 / pixelsPerBar;
                                                                            const onMv = (ev) => {
                                                                                const dx = ev.clientX - startX;
                                                                                const deltaSteps = Math.round(dx * stepsPerPx);
                                                                                const deltaBars = deltaSteps / 32;
                                                                                const newStart = Math.max(0, origBar + deltaBars);
                                                                                const newBars = Math.max(1 / 32, origEnd - newStart);
                                                                                onMove(clip.id, newStart);
                                                                                onUpdate(clip.id, { bars: newBars });
                                                                            };
                                                                            const onUp = () => { window.removeEventListener('mousemove', onMv); window.removeEventListener('mouseup', onUp); };
                                                                            window.addEventListener('mousemove', onMv); window.addEventListener('mouseup', onUp);
                                                                        }
                                                                        // Middle area: let native drag handle cross-row movement
                                                                    }}
                                                                    style={{
                                                                        position: 'absolute', left: `${clipStartPx}px`, top: 0, width: `${clipW}px`, height: '100%',
                                                                        background: isSelected ? `${cc}${isDark ? '70' : '60'}` : `${cc}${isDark ? '28' : '30'}`,
                                                                        border: isSelected ? `2px solid ${cc}` : `1px solid ${cc}66`,
                                                                        borderRadius: '3px', overflow: 'hidden', cursor: 'default', zIndex: isSelected ? 5 : 3
                                                                    }}
                                                                >
                                                                    <div style={{ position: 'absolute', top: 0, left: '3px', fontSize: '9px', fontWeight: 600, color: cc, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: clipW - 6, pointerEvents: 'none', lineHeight: '14px' }}>
                                                                        {clip.name || `${row.trackKey} Clip`}
                                                                    </div>
                                                                    {notes.length > 0 && (
                                                                        <svg style={{ position: 'absolute', left: 0, top: '14px', width: clipW, height: Math.max(1, cellH - 16), pointerEvents: 'none' }} viewBox={`0 0 ${clipSteps} ${noteRange}`} preserveAspectRatio="none">
                                                                            {notes.map((n, ni) => {
                                                                                if (n.time >= clipSteps) return null;
                                                                                const w = Math.min(Math.max(1, n.duration || 2), clipSteps - n.time);
                                                                                return <rect key={ni} x={n.time} y={noteMax - n.note} width={w} height={0.8} fill={cc} opacity={0.7} />;
                                                                            })}
                                                                        </svg>
                                                                    )}
                                                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', background: 'transparent', zIndex: 4 }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${cc}44`; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                    />
                                                                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', background: 'transparent', zIndex: 4 }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${cc}44`; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                        {/* Note clip drop ghost */}
                                                        {clipDropGhost && clipDropGhost.targetRowId === row.id && (() => {
                                                            const gX = clipDropGhost.bar * pixelsPerBar;
                                                            const gW = Math.max(8, (clipDropGhost.widthBars || 4) * pixelsPerBar);
                                                            return (
                                                                <div style={{
                                                                    position: 'absolute', left: `${gX}px`, top: 0,
                                                                    width: `${gW}px`, height: '100%',
                                                                    background: isDark ? 'rgba(84,160,255,0.25)' : 'rgba(84,160,255,0.2)',
                                                                    border: '2px dashed rgba(84,160,255,0.7)',
                                                                    borderRadius: '3px', zIndex: 7,
                                                                    pointerEvents: 'none',
                                                                    transition: 'left 0.05s ease-out',
                                                                    overflow: 'hidden'
                                                                }}>
                                                                    {clipDropGhost.patternSvg && (
                                                                        <div style={{ width: '100%', height: '100%', opacity: 0.6 }}
                                                                            dangerouslySetInnerHTML={{ __html: clipDropGhost.patternSvg }} />
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            })()}
                                            {/* ── Drum lane clips (individual drum rows: 808, kick, snare, etc.) ── */}
                                            {row.type === 'drum' && row.drumId && (() => {
                                                const clips = drumLaneClips[row.drumId] || [];
                                                const hasDrumDragInProgress = draggingClipBetweenTracks && draggingClipBetweenTracks.clipType === 'drumLaneClip';
                                                if (clips.length === 0 && !hasDrumDragInProgress) return null;
                                                const clipColor = row.color || '#ff6b6b';
                                                const cellH = row.height - 2;
                                                return (
                                                    <div style={{ position: 'absolute', left: 0, top: '1px', width: `${totalWidth}px`, height: `${cellH}px`, overflow: 'visible', zIndex: 2, cursor: 'default' }}
                                                        onClick={(e) => {
                                                            if (clipClickedRef.current) return; // clip click handled it
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const clickedBar = Math.floor((e.clientX - rect.left) / pixelsPerBar);
                                                            setSelectedRow(row.id);
                                                            setSelectedDrumClipId(null);
                                                            setSelectedMidiClipId(null);
                                                            setSelectedAudioClipId(null);
                                                            setSelectedNoteClipId(null);
                                                            const sec = (() => { let cum = 0; for (const s of arrangement) { if (cum + s.bars > clickedBar) return s; cum += s.bars; } return arrangement[arrangement.length - 1]; })();
                                                            if (sec) onSelectSection(sec.id);
                                                            if (onSetAudioInsertionBar) onSetAudioInsertionBar(clickedBar);
                                                        }}
                                                        onDragOver={(e) => {
                                                            if (draggingClipBetweenTracks && draggingClipBetweenTracks.clipType === 'drumLaneClip') {
                                                                e.preventDefault();
                                                                e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move';
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropBar = Math.max(0, (e.clientX - rect.left) / pixelsPerBar);
                                                                const durBars = draggingClipBetweenTracks.durationBars || 4;
                                                                setClipDropGhost({ targetRowId: row.id, bar: dropBar, widthBars: durBars, patternSvg: draggingClipBetweenTracks.patternSvg || null });
                                                            }
                                                        }}
                                                        onDragLeave={() => {
                                                            if (clipDropGhost?.targetRowId === row.id) setClipDropGhost(null);
                                                        }}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setClipDropGhost(null);
                                                            const src = draggingClipBetweenTracks;
                                                            if (src && src.clipType === 'drumLaneClip' && onAddDrumLaneClip) {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const dropBar = Math.max(0, Math.floor((e.clientX - rect.left) / pixelsPerBar));
                                                                const srcBars = src.clip.bars || 4;
                                                                overwriteDrumLaneClipsInRegion(row.drumId, dropBar, dropBar + srcBars);
                                                                onAddDrumLaneClip(row.drumId, {
                                                                    timelineBar: dropBar,
                                                                    bars: srcBars,
                                                                    laneData: src.clip.laneData ? JSON.parse(JSON.stringify(src.clip.laneData)) : null,
                                                                    name: src.clip.name || row.drumId,
                                                                    color: src.clip.color || null
                                                                });
                                                                if (!(e.ctrlKey || e.metaKey) && src.sourceDrumId && onRemoveDrumLaneClip) {
                                                                    onRemoveDrumLaneClip(src.sourceDrumId, src.clip.id);
                                                                }
                                                            }
                                                            // noteClip/midi drops on drum lanes are rejected — incompatible track types
                                                            setDraggingClipBetweenTracks(null);
                                                        }}
                                                    >
                                                        {/* Section boundary lines */}
                                                        {arrangement.map((section, si) => {
                                                            if (si === 0) return null;
                                                            const bx = sectionOffsets[si] * pixelsPerBar;
                                                            return <div key={`sb-${si}`} style={{ position: 'absolute', left: `${bx}px`, top: 0, width: '1px', height: '100%', pointerEvents: 'none', zIndex: 0, borderLeft: '1px dashed', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />;
                                                        })}
                                                        {/* Render each drum lane clip */}
                                                        {clips.map((clip) => {
                                                            const clipStartPx = (clip.timelineBar || 0) * pixelsPerBar;
                                                            const clipW = Math.max(8, (clip.bars || 4) * pixelsPerBar);
                                                            const isSelected = selectedDrumClipId === clip.id;
                                                            const cc = clip.color || clipColor;
                                                            const laneData = clip.laneData;
                                                            const clipSteps = (clip.bars || 4) * 32;
                                                            return (
                                                                <div key={clip.id}
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.stopPropagation();
                                                                        e.dataTransfer.effectAllowed = 'copyMove';
                                                                        e.dataTransfer.setData('application/x-wavloom-drumlane-clip', JSON.stringify({
                                                                            drumId: row.drumId, clipId: clip.id,
                                                                            clip: { bars: clip.bars, laneData: clip.laneData, name: clip.name, color: clip.color }
                                                                        }));
                                                                        // Center ghost preview under cursor
                                                                        const elRect = e.currentTarget.getBoundingClientRect();
                                                                        e.dataTransfer.setDragImage(e.currentTarget, e.clientX - elRect.left, e.clientY - elRect.top);
                                                                        // Build drum pattern SVG for ghost — piano-roll style
                                                                        let dlSvg = null;
                                                                        if (laneData && laneData.lanes) {
                                                                            const dlLanes = Object.values(laneData.lanes);
                                                                            const dlLaneCount = dlLanes.length || 1;
                                                                            const dRects = dlLanes.flatMap((lane, li) =>
                                                                                (lane.pattern || []).map((hit, si) => {
                                                                                    if (!hit || si >= clipSteps) return '';
                                                                                    const dur = Math.max(1, lane.duration?.[si] || 1);
                                                                                    const w = Math.min(dur, clipSteps - si);
                                                                                    return `<rect x="${si}" y="${li}" width="${w}" height="0.85" fill="${cc}" opacity="0.7" rx="0.2"/>`;
                                                                                })
                                                                            ).join('');
                                                                            dlSvg = `<svg viewBox="0 0 ${clipSteps} ${dlLaneCount}" preserveAspectRatio="none" style="width:100%;height:100%">${dRects}</svg>`;
                                                                        }
                                                                        setDraggingClipBetweenTracks({
                                                                            clip, sourceDrumId: row.drumId, sourceRowId: row.id,
                                                                            clipType: 'drumLaneClip', durationBars: clip.bars || 4,
                                                                            patternSvg: dlSvg
                                                                        });
                                                                    }}
                                                                    onDragEnd={() => {
                                                                        setDraggingClipBetweenTracks(null);
                                                                        setClipDropGhost(null);
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        clipClickedRef.current = true;
                                                                        console.log('[DrumLaneClip Click] clipId:', clip.id, 'drumId:', row.drumId, 'rowId:', row.id);
                                                                        setSelectedRow(row.id);
                                                                        setSelectedDrumClipId(clip.id);
                                                                        setSelectedDrumLaneClipDrumId(row.drumId);
                                                                        setSelectedMidiClipId(null);
                                                                        setSelectedAudioClipId(null);
                                                                        setSelectedNoteClipId(null);
                                                                        setSelectedNoteClipTrackKey(null);
                                                                        if (arrangement.length > 0) onSelectSection(arrangement[0].id);
                                                                    }}
                                                                    onDoubleClick={(e) => { e.stopPropagation(); }}
                                                                    onContextMenu={(e) => {
                                                                        e.preventDefault(); e.stopPropagation();
                                                                        setSelectedDrumClipId(clip.id);
                                                                        setSelectedDrumLaneClipDrumId(row.drumId);
                                                                        setContextMenu(null); setRowContextMenu(null);
                                                                        setAudioClipContextMenu({ x: e.clientX, y: e.clientY, clip, trackId: null, isDrumLaneClip: true, drumLaneId: row.drumId, clipColor: cc });
                                                                    }}
                                                                    onMouseDown={(e) => {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const edgeZone = 8;
                                                                        if (e.clientX >= rect.right - edgeZone && onUpdateDrumLaneClip) {
                                                                            // Right-edge resize with pattern looping
                                                                            e.stopPropagation(); e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const startW = clipW;
                                                                            const origBars = clip.bars || 4;
                                                                            const origSteps = origBars * 32;
                                                                            const baseLane = laneData ? JSON.parse(JSON.stringify(laneData)) : null;
                                                                            const onMove = (ev) => {
                                                                                const dx = ev.clientX - startX;
                                                                                const newW = Math.max(pixelsPerBar, startW + dx);
                                                                                const newBars = Math.max(1, Math.min(64, Math.round(newW / pixelsPerBar)));
                                                                                const newSteps = newBars * 32;
                                                                                if (newBars > origBars && baseLane && baseLane.lanes) {
                                                                                    const loopedLane = { ...baseLane, lanes: {} };
                                                                                    for (const [lId, lane] of Object.entries(baseLane.lanes)) {
                                                                                        const nl = { ...lane };
                                                                                        const loopArr = (arr, def) => {
                                                                                            if (!Array.isArray(arr)) return new Array(newSteps).fill(def);
                                                                                            const src = Math.min(arr.length, origSteps);
                                                                                            if (src === 0) return new Array(newSteps).fill(def);
                                                                                            const out = new Array(newSteps);
                                                                                            for (let i = 0; i < newSteps; i++) out[i] = arr[i % src];
                                                                                            return out;
                                                                                        };
                                                                                        nl.pattern = loopArr(lane.pattern, false);
                                                                                        nl.velocity = loopArr(lane.velocity, 100);
                                                                                        nl.duration = loopArr(lane.duration, 1);
                                                                                        loopedLane.lanes[lId] = nl;
                                                                                    }
                                                                                    onUpdateDrumLaneClip(row.drumId, clip.id, { bars: newBars, laneData: loopedLane });
                                                                                } else {
                                                                                    onUpdateDrumLaneClip(row.drumId, clip.id, { bars: newBars });
                                                                                }
                                                                            };
                                                                            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                                                                            window.addEventListener('mousemove', onMove);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        } else if (e.clientX <= rect.left + edgeZone && onUpdateDrumLaneClip && onMoveDrumLaneClip) {
                                                                            // Left-edge resize
                                                                            e.stopPropagation(); e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const startBar = clip.timelineBar || 0;
                                                                            const startBars = clip.bars || 4;
                                                                            const onMove = (ev) => {
                                                                                const dx = ev.clientX - startX;
                                                                                const barDelta = Math.round(dx / pixelsPerBar);
                                                                                const newStart = Math.max(0, startBar + barDelta);
                                                                                const newBars = Math.max(1, startBars - (newStart - startBar));
                                                                                onMoveDrumLaneClip(row.drumId, clip.id, newStart);
                                                                                onUpdateDrumLaneClip(row.drumId, clip.id, { bars: newBars });
                                                                            };
                                                                            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                                                                            window.addEventListener('mousemove', onMove);
                                                                            window.addEventListener('mouseup', onUp);
                                                                        }
                                                                        // Middle area: let native drag handle cross-row movement
                                                                    }}
                                                                    style={{
                                                                        position: 'absolute', left: `${clipStartPx}px`, top: 0,
                                                                        width: `${clipW}px`, height: '100%',
                                                                        background: isSelected ? `${cc}${isDark ? '70' : '60'}` : `${cc}${isDark ? '28' : '30'}`,
                                                                        border: isSelected ? `2px solid ${cc}` : `1px solid ${cc}66`,
                                                                        borderRadius: '3px', overflow: 'hidden', cursor: 'default', zIndex: isSelected ? 5 : 3
                                                                    }}
                                                                >
                                                                    {/* Clip name */}
                                                                    <div style={{ position: 'absolute', top: 0, left: '3px', fontSize: '8px', fontWeight: 600, color: cc, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: clipW - 6, pointerEvents: 'none', lineHeight: '12px' }}>
                                                                        {clip.name || row.label || row.drumId}
                                                                    </div>
                                                                    {/* Mini pattern preview — piano-roll style with lanes and durations */}
                                                                    {laneData && laneData.lanes && (() => {
                                                                        const lanes = Object.values(laneData.lanes);
                                                                        const laneCount = lanes.length || 1;
                                                                        return (
                                                                            <svg style={{ position: 'absolute', left: 0, top: '12px', width: clipW, height: Math.max(1, cellH - 14), pointerEvents: 'none' }}
                                                                                viewBox={`0 0 ${clipSteps} ${laneCount}`} preserveAspectRatio="none">
                                                                                {lanes.map((lane, li) =>
                                                                                    lane.pattern ? lane.pattern.map((hit, si) => {
                                                                                        if (!hit || si >= clipSteps) return null;
                                                                                        const dur = Math.max(1, lane.duration?.[si] || 1);
                                                                                        const w = Math.min(dur, clipSteps - si);
                                                                                        return (
                                                                                            <rect key={`${li}-${si}`} x={si} y={li} width={w} height={0.85} fill={cc} opacity={0.7} rx={0.2} />
                                                                                        );
                                                                                    }) : null
                                                                                )}
                                                                            </svg>
                                                                        );
                                                                    })()}
                                                                    {/* Left resize handle */}
                                                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', background: 'transparent', zIndex: 6 }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${cc}44`; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                    />
                                                                    {/* Right resize handle */}
                                                                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', background: 'transparent', zIndex: 6 }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${cc}44`; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                        {/* Drum lane clip drop ghost */}
                                                        {clipDropGhost && clipDropGhost.targetRowId === row.id && (() => {
                                                            const gX = clipDropGhost.bar * pixelsPerBar;
                                                            const gW = Math.max(8, (clipDropGhost.widthBars || 4) * pixelsPerBar);
                                                            return (
                                                                <div style={{
                                                                    position: 'absolute', left: `${gX}px`, top: 0,
                                                                    width: `${gW}px`, height: '100%',
                                                                    background: isDark ? 'rgba(84,160,255,0.25)' : 'rgba(84,160,255,0.2)',
                                                                    border: '2px dashed rgba(84,160,255,0.7)',
                                                                    borderRadius: '3px', zIndex: 7,
                                                                    pointerEvents: 'none',
                                                                    transition: 'left 0.05s ease-out',
                                                                    overflow: 'hidden'
                                                                }}>
                                                                    {clipDropGhost.patternSvg && (
                                                                        <div style={{ width: '100%', height: '100%', opacity: 0.6 }}
                                                                            dangerouslySetInnerHTML={{ __html: clipDropGhost.patternSvg }} />
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            })()}
                                            {/* ── Section cells (fallback when no clips exist for a row) ── */}
                                            {(row.type !== 'audio' && row.type !== 'midi' && !(row.type === 'drums-all' && drumClips.length > 0) && !(row.trackKey && ({ chords: chordClips, melody: melodyClips, bass: bassClips }[row.trackKey] || []).length > 0) && !(row.type === 'drum' && row.drumId && (drumLaneClips[row.drumId] || []).length > 0)) && arrangement.map((section, si) => {
                                                const x = sectionOffsets[si] * pixelsPerBar;
                                                const w = section.bars * pixelsPerBar;
                                                const isActive = section.id === activeSection;
                                                const isCellSelected = (isRowSelected && isActive);

                                                // Get pattern data for this row
                                                let clipData = null;
                                                let hasContent = false;

                                                // Audio clips for this row/section (supports multiple)
                                                let audioClips = [];

                                                if (row.type === 'drum' && row.drumId) {
                                                    const drums = section.patterns?.drums;
                                                    if (drums && !Array.isArray(drums) && drums[row.drumId]) {
                                                        clipData = drums;
                                                        hasContent = true;
                                                    }
                                                } else if (row.type === 'drums-all') {
                                                    const drums = section.patterns?.drums;
                                                    hasContent = drums && !Array.isArray(drums) && Object.keys(drums).length > 0;
                                                } else if (row.type === 'audio' && row.trackId) {
                                                    // Render clips that START in this section (not all overlapping ones).
                                                    // With overflow:visible, clips visually extend into subsequent sections.
                                                    const track = audioTracks.find(t => t.id === row.trackId);
                                                    if (track) {
                                                        const sIdx = arrangement.indexOf(section);
                                                        const sectionStartBar = sIdx >= 0 && sectionOffsets[sIdx] != null ? sectionOffsets[sIdx] : 0;
                                                        const sectionEndBar = sectionStartBar + section.bars;
                                                        audioClips = track.clips.filter(c => {
                                                            const cBar = c.timelineBar != null ? c.timelineBar : (function() {
                                                                let cum = 0;
                                                                for (const s of arrangement) {
                                                                    if (s.id === c.sectionId) return cum + (c.startBar || 0);
                                                                    cum += s.bars;
                                                                }
                                                                return c.startBar || 0;
                                                            })();
                                                            // Only include clips whose START falls within this section
                                                            return cBar >= sectionStartBar && cBar < sectionEndBar;
                                                        }).map(c => ({
                                                            ...c,
                                                            _absBar: c.timelineBar != null ? c.timelineBar : (function() {
                                                                let cum = 0;
                                                                for (const s of arrangement) {
                                                                    if (s.id === c.sectionId) return cum + (c.startBar || 0);
                                                                    cum += s.bars;
                                                                }
                                                                return c.startBar || 0;
                                                            })(),
                                                            _sectionStartBar: sectionStartBar
                                                        }));
                                                    }
                                                    hasContent = audioClips.length > 0;
                                                } else if (row.trackKey) {
                                                    clipData = section.patterns?.[row.trackKey];
                                                    hasContent = Array.isArray(clipData) && clipData.length > 0;
                                                }

                                                // Use the row's color for clip styling
                                                const clipColor = row.color;
                                                const isDropping = dropTarget?.rowId === row.id && dropTarget?.sectionId === section.id;
                                                const isSplitDrop = isDropping && dropTarget?.splitMode;

                                                const isCellMultiSelected = selectedCells.some(c => c.rowId === row.id && c.sectionId === section.id);

                                                return (
                                                    <div
                                                        key={section.id}
                                                        onClick={(e) => {
                                                            if (clipClickedRef.current) return;
                                                            if (e.ctrlKey || e.metaKey) {
                                                                // Ctrl+Click: toggle row in multi-selection (cross-section, max 2 for swap)
                                                                onSelectSection(section.id);
                                                                setSelectedCells(prev => {
                                                                    const exists = prev.some(c => c.rowId === row.id && c.sectionId === section.id);
                                                                    if (exists) return prev.filter(c => !(c.rowId === row.id && c.sectionId === section.id));
                                                                    const next = [...prev, { rowId: row.id, sectionId: section.id }];
                                                                    // Keep max 2 cells for swap — drop the oldest if exceeding
                                                                    if (next.length > 2) return next.slice(-2);
                                                                    return next;
                                                                });
                                                            } else {
                                                                // Normal click: single select
                                                                onSelectSection(section.id);
                                                                setSelectedRow(row.id);
                                                                setSelectedCells([]);
                                                                setSelectedAudioClipId(null);
                                                                setSelectedAudioClipTrackId(null);
                                                                // Set insertion bar from click position for all track types
                                                                {
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    const relX = e.clientX - rect.left;
                                                                    const sectionBars = section.bars;
                                                                    let sectionStartBarCalc = 0;
                                                                    for (const s of arrangement) {
                                                                        if (s.id === section.id) break;
                                                                        sectionStartBarCalc += s.bars;
                                                                    }
                                                                    const cellW = Math.max(1, w - 2);
                                                                    const clickedBar = sectionStartBarCalc + (relX / cellW) * sectionBars;
                                                                    if (onSetAudioInsertionBar) onSetAudioInsertionBar(clickedBar);
                                                                }
                                                            }
                                                        }}
                                                        onDoubleClick={() => {
                                                            onSelectSection(section.id);
                                                            if (row.type === 'audio' && audioClips.length > 0) {
                                                                setFocusedAudioClip({
                                                                    clip: audioClips[0],
                                                                    trackId: row.trackId,
                                                                    trackName: row.label,
                                                                    sectionName: section.name
                                                                });
                                                            } else {
                                                                setFocusedClip({ row, section });
                                                                if (row.type === 'midi' && onFocusMidiClip) onFocusMidiClip(row.trackId);
                                                            }
                                                        }}
                                                        onContextMenu={(e) => handleRowContextMenu(e, row, section)}
                                                        onDragOver={(e) => handleDragOver(e, row.id, section.id)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, row, section)}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${x + 1}px`,
                                                            top: '1px',
                                                            width: `${Math.max(1, w - 2)}px`,
                                                            height: `${row.height - 2}px`,
                                                            borderRadius: '2px',
                                                            overflow: row.type === 'audio' ? 'visible' : 'hidden',
                                                            cursor: 'default',
                                                            zIndex: row.type === 'audio' ? 1 : 'auto',
                                                            background: isSplitDrop
                                                                ? `${ac}${isDark ? '25' : '35'}`
                                                                : isDropping
                                                                    ? `${clipColor}${isDark ? '30' : '40'}`
                                                                    : isCellMultiSelected
                                                                        ? `${clipColor}${isDark ? '25' : '30'}`
                                                                        : loopSectionIds.has(section.id) && !hasContent
                                                                            ? (isDark ? 'rgba(100,200,255,0.06)' : 'rgba(60,160,255,0.08)')
                                                                            : hasContent
                                                                                ? `${clipColor}${isDark ? '18' : '22'}`
                                                                                : 'transparent',
                                                            border: isSplitDrop
                                                                ? `2px dashed ${ac}`
                                                                : isDropping
                                                                    ? `2px dashed ${clipColor}`
                                                                    : isCellMultiSelected
                                                                        ? `1.5px solid ${clipColor}`
                                                                        : isCellSelected
                                                                            ? `1.5px solid ${clipColor}`
                                                                            : hasContent
                                                                                ? `1px solid ${clipColor}${isDark ? '30' : '40'}`
                                                                                : `1px solid transparent`,
                                                            transition: 'border-color 0.1s, background 0.1s',
                                                            boxShadow: (isCellSelected || isCellMultiSelected) && hasContent
                                                                ? `inset 0 0 0 1px ${clipColor}66, 0 0 6px ${clipColor}33`
                                                                : isSplitDrop
                                                                    ? `0 0 12px ${ac}44`
                                                                    : isDropping
                                                                        ? `0 0 12px ${clipColor}44`
                                                                        : 'none'
                                                        }}
                                                    >
                                                        {isSplitDrop && w > 40 && (
                                                            <div style={{
                                                                position: 'absolute', inset: 0, display: 'flex',
                                                                alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '9px', fontWeight: 600, color: ac,
                                                                letterSpacing: '0.5px', pointerEvents: 'none', zIndex: 2,
                                                            }}>
                                                                Split → New Tracks
                                                            </div>
                                                        )}
                                                        {hasContent && w > 8 && audioClips.length > 0 && (() => {
                                                            const tempo = section.settings?.tempo || globalTempo;
                                                            const secondsPerBar = 4 * 60 / tempo;
                                                            return audioClips.map((ac) => {
                                                                const bufDur = ac.buffer ? ac.buffer.duration : 0;
                                                                const effectiveDur = Math.max(0.01, (bufDur - (ac.trimStart || 0) - (ac.trimEnd || 0)) / (ac.playbackRate || 1));
                                                                const clipBars = effectiveDur / secondsPerBar;
                                                                // Position clip at absolute bar relative to this section's start
                                                                const absBar = ac._absBar != null ? ac._absBar : (ac.startBar || 0);
                                                                const sectionStartBar = ac._sectionStartBar || 0;
                                                                const relativeBar = absBar - sectionStartBar;
                                                                const clipStartPx = relativeBar * pixelsPerBar;
                                                                // Clip can extend beyond section bounds (it will be visible in the next section too)
                                                                const clipW = Math.max(8, clipBars * pixelsPerBar);
                                                                return (
                                                                    <div
                                                                        key={ac.id}
                                                                        style={{
                                                                            position: 'absolute', left: `${clipStartPx}px`, top: 0,
                                                                            width: `${clipW}px`, height: '100%',
                                                                            background: (selectedAudioClipId === ac.id || selectedAudioClipIds.has(ac.id))
                                                                                ? `${clipColor}${isDark ? '70' : '60'}`
                                                                                : `${clipColor}${isDark ? '22' : '28'}`,
                                                                            borderRight: `2px solid ${clipColor}88`,
                                                                            border: (selectedAudioClipId === ac.id || selectedAudioClipIds.has(ac.id)) ? `2px solid ${clipColor}` : undefined,
                                                                            borderRadius: '2px', overflow: 'hidden'
                                                                        }}
                                                                        onMouseEnter={() => setHoveredAudioClipId(ac.id)}
                                                                        onMouseLeave={() => setHoveredAudioClipId(null)}
                                                                        onContextMenu={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setContextMenu(null);
                                                                            setRowContextMenu(null);
                                                                            setSelectedAudioClipId(ac.id);
                                                                            setSelectedAudioClipTrackId(row.trackId);
                                                                            onSelectSection(section.id);
                                                                            setAudioClipContextMenu({
                                                                                x: e.clientX, y: e.clientY,
                                                                                clip: ac, trackId: row.trackId,
                                                                                sectionId: section.id,
                                                                                clipColor: clipColor
                                                                            });
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onSelectSection(section.id);
                                                                            setSelectedAudioClipTrackId(row.trackId);
                                                                            if (e.ctrlKey || e.metaKey) {
                                                                                // Multi-select: toggle this clip
                                                                                setSelectedAudioClipIds(prev => {
                                                                                    const next = new Set(prev);
                                                                                    if (next.has(ac.id)) next.delete(ac.id);
                                                                                    else next.add(ac.id);
                                                                                    return next;
                                                                                });
                                                                                setSelectedAudioClipId(ac.id);
                                                                            } else {
                                                                                // Single select: clear multi-select
                                                                                setSelectedAudioClipId(ac.id);
                                                                                setSelectedAudioClipIds(new Set([ac.id]));
                                                                            }
                                                                        }}
                                                                        onDoubleClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onSelectSection(section.id);
                                                                            setFocusedAudioClip({
                                                                                clip: ac, trackId: row.trackId,
                                                                                trackName: row.label, sectionName: section.name
                                                                            });
                                                                        }}
                                                                        onMouseDown={(e) => {
                                                                            // Right-edge drag for time stretch
                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                            const edgeZone = 8;
                                                                            if (e.clientX >= rect.right - edgeZone && onUpdateClip && row.trackId) {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                const startX = e.clientX;
                                                                                const startClipW = clipW;
                                                                                const startClipBars = clipBars;
                                                                                const acStartBar = ac.startBar || 0;
                                                                                // Find clips that come after this one
                                                                                const laterClips = audioClips.filter(c => c.id !== ac.id && (c.startBar || 0) >= acStartBar + clipBars - 0.001);
                                                                                const laterStartBars = laterClips.map(c => ({ id: c.id, startBar: c.startBar || 0 }));
                                                                                const onMove = (ev) => {
                                                                                    const dx = ev.clientX - startX;
                                                                                    const newClipW = Math.max(8, startClipW + dx);
                                                                                    const newBars = newClipW / pixelsPerBar;
                                                                                    const newDur = newBars * secondsPerBar;
                                                                                    const rawDur = bufDur - (ac.trimStart || 0) - (ac.trimEnd || 0);
                                                                                    const newRate = Math.max(0.25, Math.min(4, rawDur / newDur));
                                                                                    onUpdateClip(row.trackId, ac.id, {
                                                                                        playbackRate: Math.round(newRate * 1000) / 1000
                                                                                    });
                                                                                    // Push later clips by the bar delta
                                                                                    const actualNewBars = rawDur / (newRate * secondsPerBar);
                                                                                    const barDelta = actualNewBars - startClipBars;
                                                                                    for (const lc of laterStartBars) {
                                                                                        onUpdateClip(row.trackId, lc.id, {
                                                                                            startBar: Math.max(0, Math.round((lc.startBar + barDelta) * 1000) / 1000)
                                                                                        });
                                                                                    }
                                                                                };
                                                                                const onUp = () => {
                                                                                    window.removeEventListener('mousemove', onMove);
                                                                                    window.removeEventListener('mouseup', onUp);
                                                                                };
                                                                                window.addEventListener('mousemove', onMove);
                                                                                window.addEventListener('mouseup', onUp);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <WaveformClipCanvas
                                                                            audioBuffer={ac.buffer}
                                                                            width={Math.max(1, clipW - 2)}
                                                                            height={row.height - 4}
                                                                            color={clipColor}
                                                                            trimStart={ac.trimStart || 0}
                                                                            trimEnd={ac.trimEnd || 0}
                                                                            reversed={ac.reversed || false}
                                                                            fadeIn={ac.fadeIn || 0}
                                                                            fadeOut={ac.fadeOut || 0}
                                                                            fadeInCurve={ac.fadeInCurve || 0}
                                                                            fadeOutCurve={ac.fadeOutCurve || 0}
                                                                            isDark={isDark}
                                                                        />
                                                                        {/* Drag handle on right edge */}
                                                                        <div style={{
                                                                            position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px',
                                                                            cursor: 'ew-resize', background: 'transparent'
                                                                        }}
                                                                            onMouseEnter={(e) => { e.currentTarget.style.background = `${clipColor}44`; }}
                                                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                                        />
                                                                        {/* Clip deletion: use Delete key or right-click → Remove (no X button) */}
                                                                        {/* Fade in/out drag handles + middle curve dots — visible on hover or selection */}
                                                                        {(selectedAudioClipId === ac.id || hoveredAudioClipId === ac.id) && clipW > 30 && onUpdateClip && (() => {
                                                                            const fadeDur = effectiveDur || bufDur || 1;
                                                                            const pxPerSec = clipW / fadeDur;
                                                                            const minGapSec = 10 / pxPerSec; // 10px minimum gap between handles
                                                                            const fadeInVal = ac.fadeIn || 0;
                                                                            const fadeOutVal = ac.fadeOut || 0;
                                                                            const fadeInPx = (fadeInVal / fadeDur) * clipW;
                                                                            const fadeOutPx = (fadeOutVal / fadeDur) * clipW;
                                                                            const clipH = row.height - 4;
                                                                            const orangeColor = isDark ? 'rgba(255,159,67,0.9)' : 'rgba(230,150,40,0.9)';
                                                                            const handleStyle = (handleKey) => ({
                                                                                position: 'absolute', top: 0,
                                                                                width: '8px', height: '8px',
                                                                                background: draggingFadeHandle === handleKey ? '#fff' : orangeColor,
                                                                                borderRadius: '50%', cursor: 'ew-resize', zIndex: 6,
                                                                                boxShadow: draggingFadeHandle === handleKey ? '0 0 6px rgba(255,255,255,0.8)' : '0 0 4px rgba(255,159,67,0.5)',
                                                                                transform: 'translate(-50%, 0)'
                                                                            });
                                                                            const midDotStyle = (handleKey) => ({
                                                                                position: 'absolute',
                                                                                width: '6px', height: '6px',
                                                                                background: draggingFadeHandle === handleKey ? '#fff' : orangeColor,
                                                                                borderRadius: '50%', cursor: 'ns-resize', zIndex: 6,
                                                                                boxShadow: draggingFadeHandle === handleKey ? '0 0 6px rgba(255,255,255,0.8)' : '0 0 3px rgba(255,159,67,0.4)',
                                                                                transform: 'translate(-50%, -50%)'
                                                                            });
                                                                            // Fade handle drag (horizontal)
                                                                            const startFadeDrag = (e, isFadeIn) => {
                                                                                e.stopPropagation(); e.preventDefault();
                                                                                const key = isFadeIn ? 'fadeIn' : 'fadeOut';
                                                                                setDraggingFadeHandle(key);
                                                                                const startX = e.clientX;
                                                                                const startVal = isFadeIn ? fadeInVal : fadeOutVal;
                                                                                const otherVal = isFadeIn ? fadeOutVal : fadeInVal;
                                                                                const maxFade = Math.max(0, fadeDur - otherVal - minGapSec);
                                                                                const onMove = (ev) => {
                                                                                    const dx = isFadeIn ? (ev.clientX - startX) : (startX - ev.clientX);
                                                                                    const dSec = dx / pxPerSec;
                                                                                    const newVal = Math.max(0, Math.min(maxFade, startVal + dSec));
                                                                                    const rounded = Math.round(newVal * 1000) / 1000;
                                                                                    onUpdateClip(row.trackId, ac.id, isFadeIn ? { fadeIn: rounded } : { fadeOut: rounded });
                                                                                };
                                                                                const onUp = () => {
                                                                                    setDraggingFadeHandle(null);
                                                                                    window.removeEventListener('mousemove', onMove);
                                                                                    window.removeEventListener('mouseup', onUp);
                                                                                };
                                                                                window.addEventListener('mousemove', onMove);
                                                                                window.addEventListener('mouseup', onUp);
                                                                            };
                                                                            // Curve middle dot drag (vertical)
                                                                            const startCurveDrag = (e, isFadeIn) => {
                                                                                e.stopPropagation(); e.preventDefault();
                                                                                const key = isFadeIn ? 'fadeInCurve' : 'fadeOutCurve';
                                                                                setDraggingFadeHandle(key);
                                                                                const startY = e.clientY;
                                                                                const startVal = isFadeIn ? (ac.fadeInCurve || 0) : (ac.fadeOutCurve || 0);
                                                                                const onMove = (ev) => {
                                                                                    const dy = startY - ev.clientY; // up = positive
                                                                                    const dCurve = dy / (clipH * 0.5); // normalize to half-height
                                                                                    const newVal = Math.max(-1, Math.min(1, startVal + dCurve));
                                                                                    const rounded = Math.round(newVal * 100) / 100;
                                                                                    onUpdateClip(row.trackId, ac.id, isFadeIn ? { fadeInCurve: rounded } : { fadeOutCurve: rounded });
                                                                                };
                                                                                const onUp = () => {
                                                                                    setDraggingFadeHandle(null);
                                                                                    window.removeEventListener('mousemove', onMove);
                                                                                    window.removeEventListener('mouseup', onUp);
                                                                                };
                                                                                window.addEventListener('mousemove', onMove);
                                                                                window.addEventListener('mouseup', onUp);
                                                                            };
                                                                            // Compute middle dot positions on the bezier curve
                                                                            const fadeInCurveVal = ac.fadeInCurve || 0;
                                                                            const fadeOutCurveVal = ac.fadeOutCurve || 0;
                                                                            // Quadratic bezier at t=0.5: B(0.5) = 0.25*P0 + 0.5*CP + 0.25*P2
                                                                            const fiMidX = fadeInPx * 0.5;
                                                                            const fiCpY = clipH * (0.5 - fadeInCurveVal * 0.5);
                                                                            const fiMidY = 0.25 * clipH + 0.5 * fiCpY + 0.25 * 0; // P0=(0,clipH), CP, P2=(fadePx,0)
                                                                            const foMidX = clipW - fadeOutPx * 0.5;
                                                                            const foCpY = clipH * (0.5 - fadeOutCurveVal * 0.5);
                                                                            const foMidY = 0.25 * 0 + 0.5 * foCpY + 0.25 * clipH; // P0=(fadeStart,0), CP, P2=(w,clipH)
                                                                            return (
                                                                                <>
                                                                                    {/* Fade In handle */}
                                                                                    <div style={{ ...handleStyle('fadeIn'), left: `${fadeInPx}px` }}
                                                                                        onMouseDown={(e) => startFadeDrag(e, true)}
                                                                                        title={`Fade In: ${fadeInVal.toFixed(2)}s`}
                                                                                    />
                                                                                    {/* Fade Out handle */}
                                                                                    <div style={{ ...handleStyle('fadeOut'), left: 'auto', right: `${fadeOutPx}px`, transform: 'translate(50%, 0)' }}
                                                                                        onMouseDown={(e) => startFadeDrag(e, false)}
                                                                                        title={`Fade Out: ${fadeOutVal.toFixed(2)}s`}
                                                                                    />
                                                                                    {/* Fade In curve middle dot */}
                                                                                    {fadeInVal > 0 && fadeInPx > 14 && (
                                                                                        <div style={{ ...midDotStyle('fadeInCurve'), left: `${fiMidX}px`, top: `${fiMidY}px` }}
                                                                                            onMouseDown={(e) => startCurveDrag(e, true)}
                                                                                            title={`Curve: ${fadeInCurveVal.toFixed(2)}`}
                                                                                        />
                                                                                    )}
                                                                                    {/* Fade Out curve middle dot */}
                                                                                    {fadeOutVal > 0 && fadeOutPx > 14 && (
                                                                                        <div style={{ ...midDotStyle('fadeOutCurve'), left: `${foMidX}px`, top: `${foMidY}px` }}
                                                                                            onMouseDown={(e) => startCurveDrag(e, false)}
                                                                                            title={`Curve: ${fadeOutCurveVal.toFixed(2)}`}
                                                                                        />
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                        {/* Live recording waveform overlay */}
                                                        {isRecording && row.type === 'audio' && row.trackId && recordingTrackId === row.trackId && recorderRef && section.id === recordingStartSection && (
                                                            <div style={{
                                                                position: 'absolute', left: 0, top: 0,
                                                                width: '100%', height: '100%',
                                                                pointerEvents: 'none', zIndex: 3,
                                                                overflow: 'visible'
                                                            }}>
                                                                <RecordingWaveform
                                                                    recorderRef={recorderRef}
                                                                    width={Math.max(1, w - 4)}
                                                                    height={row.height - 4}
                                                                    color="#ff4444"
                                                                    isDark={isDark}
                                                                    tempo={globalTempo}
                                                                    pixelsPerBar={pixelsPerBar}
                                                                />
                                                            </div>
                                                        )}
                                                        {hasContent && w > 8 && audioClips.length === 0 && (
                                                            <ClipCanvas
                                                                data={clipData}
                                                                type={row.type}
                                                                drumId={row.drumId}
                                                                bars={section.bars}
                                                                color={clipColor}
                                                                width={Math.max(1, w - 4)}
                                                                height={row.height - 4}
                                                                isDark={isDark}
                                                            />
                                                        )}
                                                        {/* Right-edge drag handle for MIDI section resize */}
                                                        {row.type !== 'audio' && hasContent && w > 30 && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    right: 0,
                                                                    top: 0,
                                                                    width: '6px',
                                                                    height: '100%',
                                                                    cursor: 'col-resize',
                                                                    zIndex: 10,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    const startX = e.clientX;
                                                                    const startBars = section.bars;
                                                                    const sectionId = section.id;

                                                                    const onMove = (ev) => {
                                                                        const dx = ev.clientX - startX;
                                                                        const deltaBars = Math.round(dx / pixelsPerBar);
                                                                        const newBars = Math.max(1, Math.min(64, startBars + deltaBars));
                                                                        handleResizeSection(sectionId, newBars);
                                                                    };

                                                                    const onUp = () => {
                                                                        document.removeEventListener('mousemove', onMove);
                                                                        document.removeEventListener('mouseup', onUp);
                                                                    };

                                                                    document.addEventListener('mousemove', onMove);
                                                                    document.addEventListener('mouseup', onUp);
                                                                }}
                                                            >
                                                                <div style={{
                                                                    width: '2px',
                                                                    height: '16px',
                                                                    borderRadius: '1px',
                                                                    background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                                                    opacity: 0
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                                                                />
                                                            </div>
                                                        )}
                                                        {/* ── Automation Lane SVG Overlay ── */}
                                                        {(() => {
                                                            const autoTrackId = row.type === 'drum' || row.type === 'drums-all' ? 'drums'
                                                                : row.type === 'melodic' ? (row.trackKey || row.id)
                                                                : (row.trackId || row.id);
                                                            if (!automationVisibleTracks.has(autoTrackId)) return null;
                                                            const paramKey = automationSelectedParam[autoTrackId] || 'volume';
                                                            const points = trackAutomation?.[autoTrackId]?.[paramKey] || [];
                                                            const sectionBars = section.bars;
                                                            // Calculate section start bar for absolute positioning
                                                            let sectionStartBar = 0;
                                                            for (const s of arrangement) {
                                                                if (s.id === section.id) break;
                                                                sectionStartBar += s.bars;
                                                            }
                                                            const sectionEndBar = sectionStartBar + sectionBars;
                                                            const cellW = Math.max(1, w - 2);
                                                            const cellH = row.height - 2;
                                                            // Filter points within this section's range (with margin)
                                                            const visiblePoints = points.filter(p =>
                                                                p.bar >= sectionStartBar - 0.5 && p.bar <= sectionEndBar + 0.5
                                                            );
                                                            // Build SVG path for the automation line
                                                            const toX = (bar) => ((bar - sectionStartBar) / sectionBars) * cellW;
                                                            const toY = (val) => cellH - (val * cellH);
                                                            let pathD = '';
                                                            if (points.length > 0) {
                                                                // Draw from section start to section end
                                                                const sortedPts = [...points].sort((a, b) => a.bar - b.bar);
                                                                // Get value at section start
                                                                const startVal = interpolateAutomation(sortedPts, sectionStartBar);
                                                                const endVal = interpolateAutomation(sortedPts, sectionEndBar);
                                                                const allPts = [];
                                                                if (startVal !== null) allPts.push({ bar: sectionStartBar, value: startVal });
                                                                visiblePoints.forEach(p => allPts.push(p));
                                                                if (endVal !== null) allPts.push({ bar: sectionEndBar, value: endVal });
                                                                allPts.sort((a, b) => a.bar - b.bar);
                                                                // Remove duplicates at same bar position
                                                                const uniquePts = [];
                                                                for (const p of allPts) {
                                                                    if (uniquePts.length === 0 || Math.abs(p.bar - uniquePts[uniquePts.length - 1].bar) > 0.001) {
                                                                        uniquePts.push(p);
                                                                    }
                                                                }
                                                                if (uniquePts.length > 0) {
                                                                    pathD = `M ${toX(uniquePts[0].bar)} ${toY(uniquePts[0].value)}`;
                                                                    for (let i = 1; i < uniquePts.length; i++) {
                                                                        pathD += ` L ${toX(uniquePts[i].bar)} ${toY(uniquePts[i].value)}`;
                                                                    }
                                                                }
                                                            }
                                                            // Fill path (area under curve)
                                                            let fillD = '';
                                                            if (pathD) {
                                                                fillD = pathD + ` L ${toX(points.length > 0 ? Math.min(sectionEndBar, Math.max(...points.map(p => p.bar), sectionEndBar)) : sectionEndBar)} ${cellH} L ${toX(sectionStartBar)} ${cellH} Z`;
                                                            }
                                                            const autoColor = '#2ecc71';
                                                            return (
                                                                <svg
                                                                    style={{
                                                                        position: 'absolute', left: 0, top: 0,
                                                                        width: cellW, height: cellH,
                                                                        pointerEvents: 'none', zIndex: 5
                                                                    }}
                                                                    viewBox={`0 0 ${cellW} ${cellH}`}
                                                                    preserveAspectRatio="none"
                                                                >
                                                                    {/* Fill under curve */}
                                                                    {fillD && (
                                                                        <path d={fillD} fill={`${autoColor}18`} />
                                                                    )}
                                                                    {/* Automation line */}
                                                                    {pathD && (
                                                                        <path d={pathD} fill="none" stroke={autoColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                    )}
                                                                    {/* Automation points (interactive) */}
                                                                    {visiblePoints.map((pt, pi) => {
                                                                        const ptIdx = points.indexOf(pt);
                                                                        const cx = toX(pt.bar);
                                                                        const cy = toY(pt.value);
                                                                        return (
                                                                            <circle
                                                                                key={pi}
                                                                                cx={cx} cy={cy} r={4}
                                                                                fill={autoColor} stroke="#fff" strokeWidth="1.5"
                                                                                style={{ pointerEvents: 'all', cursor: 'grab' }}
                                                                                onMouseDown={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();
                                                                                    const startX = e.clientX;
                                                                                    const startY = e.clientY;
                                                                                    const startBar = pt.bar;
                                                                                    const startVal = pt.value;
                                                                                    const onMove = (ev) => {
                                                                                        const dx = ev.clientX - startX;
                                                                                        const dy = ev.clientY - startY;
                                                                                        const barDelta = (dx / cellW) * sectionBars;
                                                                                        const valDelta = -(dy / cellH);
                                                                                        const newBar = Math.max(0, startBar + barDelta);
                                                                                        const newVal = Math.max(0, Math.min(1, startVal + valDelta));
                                                                                        if (onSetTrackAutomation) {
                                                                                            onSetTrackAutomation(prev => {
                                                                                                const updated = { ...prev };
                                                                                                const trackData = { ...(updated[autoTrackId] || {}) };
                                                                                                trackData[paramKey] = moveAutomationPoint(
                                                                                                    trackData[paramKey] || [], ptIdx, newBar, newVal
                                                                                                );
                                                                                                updated[autoTrackId] = trackData;
                                                                                                return updated;
                                                                                            });
                                                                                        }
                                                                                    };
                                                                                    const onUp = () => {
                                                                                        document.removeEventListener('mousemove', onMove);
                                                                                        document.removeEventListener('mouseup', onUp);
                                                                                    };
                                                                                    document.addEventListener('mousemove', onMove);
                                                                                    document.addEventListener('mouseup', onUp);
                                                                                }}
                                                                                onContextMenu={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    if (onSetTrackAutomation) {
                                                                                        onSetTrackAutomation(prev => {
                                                                                            const updated = { ...prev };
                                                                                            const trackData = { ...(updated[autoTrackId] || {}) };
                                                                                            trackData[paramKey] = removeAutomationPoint(
                                                                                                trackData[paramKey] || [], ptIdx
                                                                                            );
                                                                                            updated[autoTrackId] = trackData;
                                                                                            return updated;
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            />
                                                                        );
                                                                    })}
                                                                </svg>
                                                            );
                                                        })()}
                                                        {/* Click-to-add automation point overlay */}
                                                        {(() => {
                                                            const autoTrackId = row.type === 'drum' || row.type === 'drums-all' ? 'drums'
                                                                : row.type === 'melodic' ? (row.trackKey || row.id)
                                                                : (row.trackId || row.id);
                                                            if (!automationVisibleTracks.has(autoTrackId)) return null;
                                                            const paramKey = automationSelectedParam[autoTrackId] || 'volume';
                                                            const sectionBars = section.bars;
                                                            let sectionStartBar = 0;
                                                            for (const s of arrangement) {
                                                                if (s.id === section.id) break;
                                                                sectionStartBar += s.bars;
                                                            }
                                                            const cellW = Math.max(1, w - 2);
                                                            const cellH = row.height - 2;
                                                            return (
                                                                <div
                                                                    style={{
                                                                        position: 'absolute', left: 0, top: 0,
                                                                        width: cellW, height: cellH,
                                                                        zIndex: 6, cursor: 'crosshair'
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const relX = e.clientX - rect.left;
                                                                        const relY = e.clientY - rect.top;
                                                                        const bar = sectionStartBar + (relX / cellW) * sectionBars;
                                                                        const value = 1 - (relY / cellH);
                                                                        if (onSetTrackAutomation) {
                                                                            onSetTrackAutomation(prev => {
                                                                                const updated = { ...prev };
                                                                                const trackData = { ...(updated[autoTrackId] || {}) };
                                                                                trackData[paramKey] = addAutomationPoint(
                                                                                    trackData[paramKey] || [],
                                                                                    { bar, value: Math.max(0, Math.min(1, value)), curve: 0 }
                                                                                );
                                                                                updated[autoTrackId] = trackData;
                                                                                return updated;
                                                                            });
                                                                        }
                                                                    }}
                                                                />
                                                            );
                                                        })()}
                                                        {/* Audio insertion point indicator — only on selected row, blinking */}
                                                        {row.type === 'audio' && audioInsertionBar != null && selectedRow === row.id && !globalIsPlaying && !isRecording && (() => {
                                                            const sectionBars = section.bars;
                                                            let sectionStartBarCalc = 0;
                                                            for (const s of arrangement) {
                                                                if (s.id === section.id) break;
                                                                sectionStartBarCalc += s.bars;
                                                            }
                                                            const cellW = Math.max(1, w - 2);
                                                            const relBar = audioInsertionBar - sectionStartBarCalc;
                                                            if (relBar < 0 || relBar > sectionBars) return null;
                                                            const ipX = (relBar / sectionBars) * cellW;
                                                            return (
                                                                <div style={{
                                                                    position: 'absolute', left: `${ipX}px`, top: 0,
                                                                    width: '2px', height: '100%',
                                                                    background: '#ffa94d', zIndex: 8,
                                                                    pointerEvents: 'none',
                                                                    boxShadow: '0 0 6px #ffa94d',
                                                                    animation: 'blink 1s step-end infinite'
                                                                }} />
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>

            </div>

            {/* ── Detail Panel Toggle Bar ── */}
            <div
                onClick={() => setShowDetailPanel(prev => !prev)}
                title={showDetailPanel ? t('arrange.hideDetailPanel') : t('arrange.showDetailPanel')}
                style={{
                    height: '18px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    cursor: 'pointer', userSelect: 'none',
                    background: isDark ? '#1a1a24' : '#e8e8f0',
                    borderTop: `1px solid ${isDark ? `${ac}22` : `${ac}33`}`,
                    color: ac, fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? '#222230' : '#dddde8'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? '#1a1a24' : '#e8e8f0'}
            >
                <span style={{ fontSize: '8px' }}>{showDetailPanel ? '\u25BC' : '\u25B2'}</span>
                <span>{t('arrange.detail')}</span>
                <span style={{ fontSize: '8px' }}>{showDetailPanel ? '\u25BC' : '\u25B2'}</span>
            </div>

            {/* ── Detail Panel Draggable Divider (double-click to maximize/restore) ── */}
            {showDetailPanel && (
                <div
                    onMouseDown={handleDetailDividerMouseDown}
                    onDoubleClick={handleDetailDividerDoubleClick}
                    style={{
                        height: '5px', flexShrink: 0,
                        cursor: 'ns-resize',
                        background: isDark ? '#222' : '#ddd',
                        borderTop: `1px solid ${isDark ? `${ac}22` : `${ac}33`}`,
                        borderBottom: `1px solid ${isDark ? `${ac}22` : `${ac}33`}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <div style={{
                        width: '30px', height: '2px', borderRadius: '1px',
                        background: isDark ? '#555' : '#aaa',
                    }} />
                </div>
            )}

            {/* ── Detail Panel (Effects Chain) ── */}
            {showDetailPanel && (
                <div style={{
                    height: `${detailPanelHeight}px`, flexShrink: 0,
                    overflow: 'hidden',
                }}>
                    <DetailPanel
                        trackId={trackRows.find(r => r.id === selectedRow)?.effectTrackId || selectedRow}
                        trackLabel={trackRows.find(r => r.id === selectedRow)?.label || null}
                        trackColor={trackRows.find(r => r.id === selectedRow)?.color || ac}
                        trackType={trackRows.find(r => r.id === selectedRow)?.type || null}
                        effectsManager={effectsManager}
                        onEffectsChanged={onEffectsChanged}
                        effectsVersion={effectsVersion}
                        isDark={isDark}
                        accentColors={accentColors}
                        panelHeight={detailPanelHeight}
                        isMaximized={detailPanelMaximized}
                        onToggleMaximize={handleDetailDividerDoubleClick}
                        vst3Plugins={vst3Plugins}
                        vst3TrackPlugins={vst3TrackPlugins}
                        onLoadVST3OnTrack={onLoadVST3OnTrack}
                        onRemoveVST3FromTrack={onRemoveVST3FromTrack}
                        onOpenVST3Editor={onOpenVST3Editor}
                    />
                </div>
            )}

            {/* Main Mixer Panel — toggled by MIX button */}
            {showMixer && (
                <div style={{
                    minHeight: '180px', maxHeight: '260px',
                    borderTop: `2px solid ${isDark ? '#9775fa44' : '#9775fa66'}`,
                    display: 'flex', overflow: 'auto', flexShrink: 0,
                }}>
                    <ArrangementMixer
                        ref={arrangementMixerRef}
                        audioTracks={audioTracks}
                        sampler={sampler}
                        masterVolume={masterVolume}
                        setMasterVolume={setMasterVolume}
                        isDark={isDark}
                        trackOrder={trackOrder}
                        trackMix={trackMixState}
                        setTrackMix={setTrackMixState}
                        globalMutes={globalMutes}
                        setGlobalMutes={setGlobalMutes}
                        globalSolos={globalSolos}
                        updateGlobalSolo={updateGlobalSolo}
                    />
                </div>
            )}

            {/* Audio Clip Context Menu */}
            {/* Grid Resolution Context Menu */}
            {gridContextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        left: Math.min(gridContextMenu.x, window.innerWidth - 180),
                        top: Math.min(gridContextMenu.y, window.innerHeight - 340),
                        background: isDark ? '#1a1a22' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        borderRadius: '8px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        zIndex: 2147483647,
                        padding: '6px 0',
                        minWidth: '160px',
                        fontSize: '11px'
                    }}
                    onMouseLeave={() => setGridContextMenu(null)}
                >
                    {/* Global Bars */}
                    <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: 700, color: isDark ? '#888' : '#999', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Global Bars
                    </div>
                    {[4, 8, 16, 32, 64].map(b => (
                        <div
                            key={`bars-${b}`}
                            onClick={() => { if (setGlobalBars) setGlobalBars(b); setGridContextMenu(null); }}
                            style={{
                                padding: '5px 14px', cursor: 'pointer', color: isDark ? '#ddd' : '#333',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: globalBarsFromParent === b ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = globalBarsFromParent === b ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent'}
                        >
                            <span style={{ width: '14px', textAlign: 'center', color: accentColors?.accent || '#ff6b6b' }}>
                                {globalBarsFromParent === b ? '✓' : ''}
                            </span>
                            {b} Bars
                        </div>
                    ))}
                    {/* Grid Resolution */}
                    <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '4px 0' }} />
                    <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: 700, color: isDark ? '#888' : '#999', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Grid
                    </div>
                    {[
                        { label: '1/4', res: 4 },
                        { label: '1/8', res: 8 },
                        { label: '1/16', res: 16 },
                        { label: '1/32', res: 32 },
                    ].map(opt => (
                        <div
                            key={opt.res}
                            onClick={() => {
                                if (setGlobalResolution) setGlobalResolution(opt.res);
                                setTimelineGridRes(opt.res);
                                setGridContextMenu(null);
                            }}
                            style={{
                                padding: '5px 14px', cursor: 'pointer', color: isDark ? '#ddd' : '#333',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: globalResolution === opt.res ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = globalResolution === opt.res ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent'}
                        >
                            <span style={{ width: '14px', textAlign: 'center', color: accentColors?.accent || '#ff6b6b' }}>
                                {globalResolution === opt.res ? '✓' : ''}
                            </span>
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}

            {audioClipContextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        left: Math.min(audioClipContextMenu.x, window.innerWidth - 200),
                        top: Math.min(audioClipContextMenu.y, window.innerHeight - 400),
                        background: isDark ? '#1a1a22' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        borderRadius: '8px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        zIndex: 9999, padding: '4px 0', minWidth: '190px', fontSize: '12px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{
                        padding: '4px 12px 6px', fontSize: '9px', fontWeight: 800,
                        color: audioClipContextMenu.clipColor,
                        letterSpacing: '0.5px',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#eee'}`,
                        marginBottom: '3px', textTransform: 'uppercase'
                    }}>
                        {audioClipContextMenu.clip?.name || t('arrange.audioClip')}
                    </div>
                    <CtxItem label={t('arrange.duplicateClip')} isDark={isDark} onClick={() => {
                        const c = audioClipContextMenu.clip;
                        if (onAddClip) {
                            const dur = c.buffer ? c.buffer.duration : 1;
                            const effDur = Math.max(0.01, (dur - (c.trimStart || 0) - (c.trimEnd || 0)) / (c.playbackRate || 1));
                            const secPerBar = 4 * 60 / globalTempo;
                            const bars = effDur / secPerBar;
                            const dupBar = (c.timelineBar ?? (c.startBar || 0)) + bars;
                            overwriteAudioClipsInRegion(audioClipContextMenu.trackId, dupBar, dupBar + bars);
                            onAddClip(audioClipContextMenu.trackId, audioClipContextMenu.sectionId, c.buffer, c.name + ' (copy)', {
                                startBar: 0,
                                timelineBar: dupBar,
                                playbackRate: c.playbackRate || 1, trimStart: c.trimStart || 0, trimEnd: c.trimEnd || 0,
                                reversed: c.reversed || false, pitch: c.pitch || 0,
                                fadeIn: c.fadeIn || 0, fadeOut: c.fadeOut || 0
                            });
                        }
                        setAudioClipContextMenu(null);
                    }} />
                    <CtxItem label={t('arrange.reverse')} isDark={isDark} onClick={() => {
                        if (onUpdateClip) onUpdateClip(audioClipContextMenu.trackId, audioClipContextMenu.clip.id, { reversed: !audioClipContextMenu.clip.reversed });
                        setAudioClipContextMenu(null);
                    }} />
                    <CtxItem label={t('arrange.openEditor')} isDark={isDark} onClick={() => {
                        setFocusedAudioClip({
                            clip: audioClipContextMenu.clip, trackId: audioClipContextMenu.trackId,
                            trackName: '', sectionName: ''
                        });
                        setAudioClipContextMenu(null);
                    }} />
                    {audioLoopRange && (() => {
                        const c = audioClipContextMenu.clip;
                        const loopBars = audioLoopRange.endBar - audioLoopRange.startBar;
                        const secPerBar = 4 * 60 / globalTempo;
                        const loopDurSecs = loopBars * secPerBar;
                        const bufDur = c.buffer ? c.buffer.duration : 0;
                        const rawDur = Math.max(0.01, bufDur - (c.trimStart || 0) - (c.trimEnd || 0));
                        const track = audioTracks.find(t => t.id === audioClipContextMenu.trackId);
                        const isVocal = track?.trackType === 'vocal';
                        return loopDurSecs > 0 && rawDur > 0 ? (
                            <>
                                <CtxItem label={isVocal ? t('arrange.stretchVocalToLoop') : t('arrange.stretchAudioToLoop')} isDark={isDark} onClick={() => {
                                    // Compute playbackRate so clip fills the loop range exactly
                                    const newRate = rawDur / loopDurSecs;
                                    if (onUpdateClip) {
                                        onUpdateClip(audioClipContextMenu.trackId, c.id, {
                                            playbackRate: Math.round(newRate * 10000) / 10000,
                                            timelineBar: audioLoopRange.startBar
                                        });
                                    }
                                    setAudioClipContextMenu(null);
                                }} />
                            </>
                        ) : null;
                    })()}
                    {/* Stretch to Section — stretch clip to fill a named section's bars */}
                    {arrangement.length > 0 && (() => {
                        const c = audioClipContextMenu.clip;
                        const bufDur = c.buffer ? c.buffer.duration : 0;
                        const rawDur = Math.max(0.01, bufDur - (c.trimStart || 0) - (c.trimEnd || 0));
                        if (rawDur <= 0) return null;
                        const secPerBar = 4 * 60 / globalTempo;
                        let cumBars = 0;
                        const items = arrangement.map(s => {
                            const startBar = cumBars;
                            cumBars += s.bars;
                            const sectionDurSecs = s.bars * secPerBar;
                            const newRate = rawDur / sectionDurSecs;
                            return { name: s.name || s.type, bars: s.bars, startBar, newRate };
                        });
                        return (
                            <>
                                <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                                <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: 700, color: isDark ? '#888' : '#999', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    {t('arrange.stretchToSection')}
                                </div>
                                {items.map((item, i) => (
                                    <CtxItem key={i} label={`${item.name} (${item.bars} ${t('arrange.bars')})`} isDark={isDark} onClick={() => {
                                        if (onUpdateClip) {
                                            onUpdateClip(audioClipContextMenu.trackId, c.id, {
                                                playbackRate: Math.round(item.newRate * 10000) / 10000,
                                                timelineBar: item.startBar
                                            });
                                        }
                                        setAudioClipContextMenu(null);
                                    }} />
                                ))}
                            </>
                        );
                    })()}
                    {/* Stretch to bar count — for audio clips (not MIDI or note clips) */}
                    {!audioClipContextMenu.isMidiClip && !audioClipContextMenu.isNoteClip && (() => {
                        const c = audioClipContextMenu.clip;
                        const bufDur = c.buffer ? c.buffer.duration : 0;
                        const rawDur = Math.max(0.01, bufDur - (c.trimStart || 0) - (c.trimEnd || 0));
                        if (rawDur <= 0) return null;
                        const secPerBar = 4 * 60 / globalTempo;
                        return (
                            <>
                                <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                                <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: 700, color: isDark ? '#888' : '#999', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    Stretch to...
                                </div>
                                {[4, 8, 16, 32, 64].map(b => {
                                    const targetDur = b * secPerBar;
                                    const newRate = rawDur / targetDur;
                                    if (newRate < 0.1 || newRate > 8) return null;
                                    return (
                                        <CtxItem key={b} label={`${b} Bars`} isDark={isDark} onClick={() => {
                                            if (onUpdateClip) {
                                                onUpdateClip(audioClipContextMenu.trackId, c.id, {
                                                    playbackRate: Math.round(newRate * 10000) / 10000
                                                });
                                            }
                                            setAudioClipContextMenu(null);
                                        }} />
                                    );
                                })}
                            </>
                        );
                    })()}
                    <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                    <CtxItem label={t('arrange.separateStemsAudio')} isDark={isDark} onClick={() => {
                        setStemSepModal({ mode: 'audio', clip: audioClipContextMenu.clip, trackId: audioClipContextMenu.trackId, sectionId: audioClipContextMenu.sectionId });
                        setAudioClipContextMenu(null);
                    }} />
                    {onBounceToGenerators && (
                        <CtxItem label={t('arrange.bounceToGenerators')} isDark={isDark} onClick={() => {
                            onBounceToGenerators(audioClipContextMenu.clip);
                            setAudioClipContextMenu(null);
                        }} />
                    )}
                    {/* MIDI clip: Loop to bar count */}
                    {audioClipContextMenu.isMidiClip && onUpdateMidiClip && (() => {
                        const c = audioClipContextMenu.clip;
                        const origBars = c.bars || 4;
                        const origSteps = origBars * 32;
                        const baseNotes = (c.pattern || []).filter(n => n.time < origSteps);
                        const loopTo = (targetBars) => {
                            if (baseNotes.length === 0) {
                                onUpdateMidiClip(audioClipContextMenu.trackId, c.id, { bars: targetBars });
                            } else {
                                const newSteps = targetBars * 32;
                                const passes = Math.ceil(targetBars / origBars);
                                const looped = [];
                                for (let p = 0; p < passes; p++) {
                                    const offset = p * origSteps;
                                    for (const n of baseNotes) {
                                        const t = n.time + offset;
                                        if (t >= newSteps) continue;
                                        looped.push({ ...n, time: t, duration: Math.min(n.duration, newSteps - t) });
                                    }
                                }
                                onUpdateMidiClip(audioClipContextMenu.trackId, c.id, { bars: targetBars, pattern: looped });
                            }
                            setAudioClipContextMenu(null);
                        };
                        return (
                            <>
                                <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                                <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: 700, color: isDark ? '#888' : '#999', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    Loop to...
                                </div>
                                {[4, 8, 16, 32, 64].map(b => (
                                    <CtxItem key={b} label={`${b} Bars`} isDark={isDark} onClick={() => loopTo(b)} />
                                ))}
                            </>
                        );
                    })()}
                    {/* Note clips (chords/melody/bass): Loop to bar count */}
                    {audioClipContextMenu.isNoteClip && audioClipContextMenu.noteClipTrackKey && (() => {
                        const c = audioClipContextMenu.clip;
                        const origBars = c.bars || 4;
                        const origSteps = origBars * 32;
                        const baseNotes = (c.pattern || []).filter(n => n.time < origSteps);
                        const updateMap = { chords: onUpdateChordClip, melody: onUpdateMelodyClip, bass: onUpdateBassClip };
                        const onUpd = updateMap[audioClipContextMenu.noteClipTrackKey];
                        if (!onUpd) return null;
                        const loopTo = (targetBars) => {
                            if (baseNotes.length === 0) {
                                onUpd(c.id, { bars: targetBars });
                            } else {
                                const newSteps = targetBars * 32;
                                const passes = Math.ceil(targetBars / origBars);
                                const looped = [];
                                for (let p = 0; p < passes; p++) {
                                    const offset = p * origSteps;
                                    for (const n of baseNotes) {
                                        const t = n.time + offset;
                                        if (t >= newSteps) continue;
                                        looped.push({ ...n, time: t, duration: Math.min(n.duration, newSteps - t) });
                                    }
                                }
                                onUpd(c.id, { bars: targetBars, pattern: looped });
                            }
                            setAudioClipContextMenu(null);
                        };
                        return (
                            <>
                                <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                                <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: 700, color: isDark ? '#888' : '#999', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    Loop to...
                                </div>
                                {[4, 8, 16, 32, 64].map(b => (
                                    <CtxItem key={b} label={`${b} Bars`} isDark={isDark} onClick={() => loopTo(b)} />
                                ))}
                            </>
                        );
                    })()}
                    {/* Drum clip (collapsed): Loop to bar count */}
                    {audioClipContextMenu.isDrumClip && onUpdateDrumClip && (() => {
                        const c = audioClipContextMenu.clip;
                        const origBars = c.bars || 4;
                        const origSteps = origBars * 32;
                        const baseDrumStates = c.drumStates ? JSON.parse(JSON.stringify(c.drumStates)) : null;
                        const loopTo = (targetBars) => {
                            const newSteps = targetBars * 32;
                            if (targetBars > origBars && baseDrumStates) {
                                const looped = {};
                                for (const [dId, drum] of Object.entries(baseDrumStates)) {
                                    const nd = { ...drum };
                                    if (drum.lanes && typeof drum.lanes === 'object') {
                                        const nl = {};
                                        for (const [lId, lane] of Object.entries(drum.lanes)) {
                                            const newLane = { ...lane };
                                            const loopArr = (arr, def) => {
                                                if (!Array.isArray(arr)) return new Array(newSteps).fill(def);
                                                const src = Math.min(arr.length, origSteps);
                                                if (src === 0) return new Array(newSteps).fill(def);
                                                const out = new Array(newSteps);
                                                for (let i = 0; i < newSteps; i++) out[i] = arr[i % src];
                                                return out;
                                            };
                                            newLane.pattern = loopArr(lane.pattern, false);
                                            newLane.velocity = loopArr(lane.velocity, 100);
                                            newLane.duration = loopArr(lane.duration, 1);
                                            nl[lId] = newLane;
                                        }
                                        nd.lanes = nl;
                                    }
                                    looped[dId] = nd;
                                }
                                onUpdateDrumClip(c.id, { bars: targetBars, drumStates: looped });
                            } else {
                                onUpdateDrumClip(c.id, { bars: targetBars });
                            }
                            setAudioClipContextMenu(null);
                        };
                        return (
                            <>
                                <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                                <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: 700, color: isDark ? '#888' : '#999', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    Loop to...
                                </div>
                                {[4, 8, 16, 32, 64].map(b => (
                                    <CtxItem key={b} label={`${b} Bars`} isDark={isDark} onClick={() => loopTo(b)} />
                                ))}
                            </>
                        );
                    })()}
                    {/* Drum lane clip (individual drum row): Loop to bar count */}
                    {audioClipContextMenu.isDrumLaneClip && audioClipContextMenu.drumLaneId && onUpdateDrumLaneClip && (() => {
                        const c = audioClipContextMenu.clip;
                        const drumId = audioClipContextMenu.drumLaneId;
                        const origBars = c.bars || 4;
                        const origSteps = origBars * 32;
                        const baseLane = c.laneData ? JSON.parse(JSON.stringify(c.laneData)) : null;
                        const loopTo = (targetBars) => {
                            const newSteps = targetBars * 32;
                            if (targetBars > origBars && baseLane && baseLane.lanes) {
                                const loopedLane = { ...baseLane, lanes: {} };
                                for (const [lId, lane] of Object.entries(baseLane.lanes)) {
                                    const nl = { ...lane };
                                    const loopArr = (arr, def) => {
                                        if (!Array.isArray(arr)) return new Array(newSteps).fill(def);
                                        const src = Math.min(arr.length, origSteps);
                                        if (src === 0) return new Array(newSteps).fill(def);
                                        const out = new Array(newSteps);
                                        for (let i = 0; i < newSteps; i++) out[i] = arr[i % src];
                                        return out;
                                    };
                                    nl.pattern = loopArr(lane.pattern, false);
                                    nl.velocity = loopArr(lane.velocity, 100);
                                    nl.duration = loopArr(lane.duration, 1);
                                    loopedLane.lanes[lId] = nl;
                                }
                                onUpdateDrumLaneClip(drumId, c.id, { bars: targetBars, laneData: loopedLane });
                            } else {
                                onUpdateDrumLaneClip(drumId, c.id, { bars: targetBars });
                            }
                            setAudioClipContextMenu(null);
                        };
                        return (
                            <>
                                <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                                <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: 700, color: isDark ? '#888' : '#999', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    Loop to...
                                </div>
                                {[4, 8, 16, 32, 64].map(b => (
                                    <CtxItem key={b} label={`${b} Bars`} isDark={isDark} onClick={() => loopTo(b)} />
                                ))}
                            </>
                        );
                    })()}
                    <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                    <CtxItem label={t('arrange.deleteClip')} isDark={isDark} danger onClick={() => {
                        if (audioClipContextMenu.isMidiClip && onRemoveMidiClip) {
                            onRemoveMidiClip(audioClipContextMenu.trackId, audioClipContextMenu.clip.id);
                        } else if (audioClipContextMenu.isNoteClip) {
                            const removeMap = { chords: onRemoveChordClip, melody: onRemoveMelodyClip, bass: onRemoveBassClip };
                            const remFn = removeMap[audioClipContextMenu.noteClipTrackKey];
                            if (remFn) remFn(audioClipContextMenu.clip.id);
                        } else if (audioClipContextMenu.isDrumLaneClip && audioClipContextMenu.drumLaneId && onRemoveDrumLaneClip) {
                            onRemoveDrumLaneClip(audioClipContextMenu.drumLaneId, audioClipContextMenu.clip.id);
                        } else if (audioClipContextMenu.isDrumClip && onRemoveDrumClip) {
                            onRemoveDrumClip(audioClipContextMenu.clip.id);
                        } else if (onRemoveClip) {
                            onRemoveClip(audioClipContextMenu.trackId, audioClipContextMenu.clip.id);
                        }
                        setAudioClipContextMenu(null);
                        setSelectedAudioClipId(null);
                        setSelectedAudioClipTrackId(null);
                    }} />
                </div>
            )}

            {/* Stem Separation Modal */}
            {stemSepModal && (
                <StemSeparationModal
                    isOpen={true}
                    mode={stemSepModal.mode}
                    clipName={stemSepModal.clip?.name || t('arrange.audioClip')}
                    isDark={isDark}
                    accentColors={accentColors}
                    onClose={() => { if (!stemProcessing) setStemSepModal(null); }}
                    onConfirm={handleStemSeparation}
                    processing={stemProcessing}
                    progress={stemProgress}
                />
            )}

            {/* Focused Clip Piano Roll Overlay */}
            {focusedClip && (
                <ClipPianoRoll
                    section={arrangement.find(s => s.id === focusedClip.section.id) || focusedClip.section}
                    row={focusedClip.row}
                    isDark={isDark}
                    onClose={() => { setFocusedClip(null); if (onFocusMidiClip) onFocusMidiClip(null); }}
                    onGenerateRow={() => onGenerateSection(focusedClip.row.id)}
                    onUpdateSection={onUpdateSection}
                    globalKey={globalKey}
                    globalScale={globalScale}
                    globalResolution={globalResolution}
                    globalCurrentStep={globalCurrentStep}
                    globalTempo={globalTempo}
                    sampler={sampler}
                    midiTracks={midiTracks}
                    onRenameMidiTrack={onRenameMidiTrack}
                    onUpdateMidiTrackInstrument={onUpdateMidiTrackInstrument}
                    accentColors={accentColors}
                    globalMutes={globalMutes}
                    setGlobalMutes={setGlobalMutes}
                    globalSolos={globalSolos}
                    updateGlobalSolo={updateGlobalSolo}
                    onBounceMidiTrack={onBounceMidiTrack}
                    selectedFolder={selectedFolder}
                />
            )}

            {/* Focused Audio Clip Waveform Editor */}
            {focusedAudioClip && (
                <WaveformEditor
                    clip={focusedAudioClip.clip}
                    trackName={focusedAudioClip.trackName}
                    sectionName={focusedAudioClip.sectionName}
                    isDark={isDark}
                    onClose={() => setFocusedAudioClip(null)}
                    onUpdate={(updates) => {
                        if (onUpdateClip) {
                            onUpdateClip(focusedAudioClip.trackId, focusedAudioClip.clip.id, updates);
                        }
                    }}
                    globalTempo={globalTempo}
                    sampler={sampler}
                    onLoadSlicedInstrument={onLoadSlicedInstrument}
                    trackId={focusedAudioClip.trackId}
                    trackAutomation={trackAutomation}
                    onSetTrackAutomation={onSetTrackAutomation}
                    tempo={globalTempo}
                />
            )}

            {/* Row Context Menu */}
            {rowContextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        left: Math.min(rowContextMenu.x, window.innerWidth - 200),
                        top: Math.min(rowContextMenu.y, window.innerHeight - 300),
                        background: isDark ? '#1a1a22' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        borderRadius: '8px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        zIndex: 9999, padding: '4px 0', minWidth: '170px', fontSize: '12px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ padding: '4px 12px 6px', fontSize: '9px', fontWeight: '800', color: rowContextMenu.row.color, letterSpacing: '0.5px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#eee'}`, marginBottom: '3px' }}>
                        {rowContextMenu.row.label.toUpperCase()} — {rowContextMenu.section.name}
                    </div>
                    <CtxItem label={t('arrange.copy')} isDark={isDark} onClick={() => {
                        handleCopyRow();
                        setRowContextMenu(null);
                    }} />
                    <CtxItem label={t('arrange.pasteAsNewSection')} isDark={isDark} disabled={!clipboard || arrangement.length >= MAX_SECTIONS}
                        onClick={() => { handlePasteRow(); setRowContextMenu(null); }} />
                    <CtxItem label={t('arrange.cloneToNext')} isDark={isDark}
                        disabled={arrangement.length >= MAX_SECTIONS && arrangement.findIndex(s => s.id === rowContextMenu.section.id) >= arrangement.length - 1}
                        onClick={() => { handleCloneRow(rowContextMenu.section.id, rowContextMenu.row.id); setRowContextMenu(null); }} />
                    <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                    <CtxItem label={t('arrange.generate', { label: rowContextMenu.row.label })} isDark={isDark}
                        onClick={() => { onGenerateSection(rowContextMenu.row.id); setRowContextMenu(null); }} />
                    {rowContextMenu.row.type === 'midi' && onBounceMidiTrack && (
                        <>
                            <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                            <CtxItem label={t('arrange.bounceToAudio')} isDark={isDark}
                                onClick={() => { onBounceMidiTrack(rowContextMenu.row.trackId, rowContextMenu.section, 'audio'); setRowContextMenu(null); }} />
                            <CtxItem label={t('arrange.bounceToVocal')} isDark={isDark}
                                onClick={() => { onBounceMidiTrack(rowContextMenu.row.trackId, rowContextMenu.section, 'vocal'); setRowContextMenu(null); }} />
                        </>
                    )}
                    {rowContextMenu.row.type !== 'drum' && onReorderTrack && (() => {
                        const order = trackOrder || [];
                        const orderId = rowContextMenu.row.orderEntry?.id || rowContextMenu.row.id;
                        const orderIdx = order.findIndex(e => e.id === orderId);
                        if (orderIdx < 0) return null;
                        return (
                            <>
                                <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                                <CtxItem label={t('arrange.moveUp')} isDark={isDark} disabled={orderIdx === 0}
                                    onClick={() => { onReorderTrack(orderId, -1); setRowContextMenu(null); }} />
                                <CtxItem label={t('arrange.moveDown')} isDark={isDark} disabled={orderIdx === order.length - 1}
                                    onClick={() => { onReorderTrack(orderId, 1); setRowContextMenu(null); }} />
                            </>
                        );
                    })()}
                    <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', margin: '3px 0' }} />
                    <CtxItem label={t('arrange.clear')} isDark={isDark} danger
                        onClick={() => { handleClearRow(rowContextMenu.section.id, rowContextMenu.row.id); setRowContextMenu(null); }} />
                    {rowContextMenu.row.type === 'midi' && onRemoveMidiTrack && (
                        <CtxItem label={t('arrange.removeMidiTrack')} isDark={isDark} danger
                            onClick={() => {
                                if (window.confirm(t('arrange.deleteConfirm', { name: rowContextMenu.row.label }))) {
                                    const savedTop = scrollContainerRef.current?.scrollTop;
                                    const delIdx = trackRows.findIndex(r => r.id === rowContextMenu.row.id);
                                    onRemoveMidiTrack(rowContextMenu.row.trackId);
                                    const nextRow = delIdx >= 0 && delIdx + 1 < trackRows.length ? trackRows[delIdx + 1]
                                        : delIdx - 1 >= 0 ? trackRows[delIdx - 1] : null;
                                    setSelectedRow(nextRow ? nextRow.id : null);
                                    if (savedTop != null && scrollContainerRef.current) {
                                        requestAnimationFrame(() => {
                                            scrollContainerRef.current.scrollTop = savedTop;
                                            if (labelScrollRef.current) labelScrollRef.current.scrollTop = savedTop;
                                        });
                                    }
                                }
                                setRowContextMenu(null);
                            }} />
                    )}
                    {rowContextMenu.row.type === 'audio' && onRemoveAudioTrack && (
                        <CtxItem label={rowContextMenu.row.isVocal ? t('arrange.removeVocalTrack') : t('arrange.removeAudioTrack')} isDark={isDark} danger
                            onClick={() => {
                                if (window.confirm(t('arrange.deleteConfirm', { name: rowContextMenu.row.label }))) {
                                    const savedTop = scrollContainerRef.current?.scrollTop;
                                    const delIdx = trackRows.findIndex(r => r.id === rowContextMenu.row.id);
                                    onRemoveAudioTrack(rowContextMenu.row.trackId);
                                    const nextRow = delIdx >= 0 && delIdx + 1 < trackRows.length ? trackRows[delIdx + 1]
                                        : delIdx - 1 >= 0 ? trackRows[delIdx - 1] : null;
                                    setSelectedRow(nextRow ? nextRow.id : null);
                                    if (savedTop != null && scrollContainerRef.current) {
                                        requestAnimationFrame(() => {
                                            scrollContainerRef.current.scrollTop = savedTop;
                                            if (labelScrollRef.current) labelScrollRef.current.scrollTop = savedTop;
                                        });
                                    }
                                }
                                setRowContextMenu(null);
                            }} />
                    )}
                </div>
            )}

            {/* Section Context Menu removed — continuous timeline has no sections */}

            {/* Instant track label tooltip */}
            {trackTooltip && (
                <div style={{
                    position: 'fixed',
                    left: `${trackTooltip.x}px`,
                    top: `${trackTooltip.y}px`,
                    background: isDark ? '#222' : '#333',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: '600',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    zIndex: 20000,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    maxWidth: '300px',
                    wordBreak: 'break-word'
                }}>
                    {trackTooltip.text}
                </div>
            )}

            {/* VST3 Plugin Picker Dropdown */}
            {vst3PickerRow && vst3Plugins.length > 0 && (
                <div
                    ref={vst3PickerRef}
                    style={{
                        position: 'fixed',
                        left: `${vst3PickerRow.x}px`,
                        ...(vst3PickerRow.openAbove
                            ? { bottom: `${window.innerHeight - vst3PickerRow.y}px` }
                            : { top: `${vst3PickerRow.y}px` }
                        ),
                        background: isDark ? '#1a1a24' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        borderRadius: '6px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 10000,
                        padding: '4px 0',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        minWidth: '180px',
                        maxWidth: '260px',
                    }}
                >
                    <div style={{ padding: '4px 10px 2px', fontSize: '8px', fontWeight: '700', color: ac, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t('arrange.vst3Plugins')}
                    </div>
                    {/* Plugin list — instruments only for MIDI tracks, effects for all tracks */}
                    {(() => {
                        const instruments = vst3Plugins.filter(p => {
                            const cats = (p.categories || []).join(' ').toLowerCase();
                            return cats.includes('instrument') || cats.includes('synth') ||
                                cats.includes('sampler') || cats.includes('generator') || p.hasMidiInput === true;
                        });
                        const effects = vst3Plugins.filter(p => !instruments.includes(p));
                        // Only MIDI tracks can load instruments; drums/melodic/audio only get effects
                        const showInstruments = vst3PickerRow.rowType === 'midi' && instruments.length > 0;

                        return (
                            <>
                                {showInstruments && (
                                    <>
                                        <div style={{ padding: '3px 10px 1px', fontSize: '7px', fontWeight: '700', color: isDark ? '#888' : '#999', textTransform: 'uppercase' }}>
                                            {t('arrange.instruments')}
                                        </div>
                                        {instruments.map((p, i) => (
                                            <div
                                                key={`inst-${i}`}
                                                onClick={() => {
                                                    if (onLoadVST3OnTrack) {
                                                        onLoadVST3OnTrack(vst3PickerRow.trackId, p, true);
                                                    }
                                                    setVst3PickerRow(null);
                                                }}
                                                title={p.name}
                                                style={{
                                                    padding: '4px 10px', fontSize: '10px', cursor: 'pointer',
                                                    color: isDark ? '#ccc' : '#333',
                                                    background: 'transparent',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ fontWeight: '600' }}>{p.name}</div>
                                                {p.vendor && <div style={{ fontSize: '8px', color: isDark ? '#666' : '#aaa' }}>{p.vendor}</div>}
                                            </div>
                                        ))}
                                    </>
                                )}
                                {effects.length > 0 && (
                                    <>
                                        <div style={{ padding: '3px 10px 1px', fontSize: '7px', fontWeight: '700', color: isDark ? '#888' : '#999', textTransform: 'uppercase', borderTop: showInstruments ? `1px solid ${isDark ? '#333' : '#eee'}` : 'none', marginTop: showInstruments ? '2px' : 0, paddingTop: showInstruments ? '4px' : '3px' }}>
                                            {t('arrange.effects')}
                                        </div>
                                        {effects.map((p, i) => (
                                            <div
                                                key={`fx-${i}`}
                                                onClick={() => {
                                                    if (onLoadVST3OnTrack) {
                                                        onLoadVST3OnTrack(vst3PickerRow.trackId, p, false);
                                                    }
                                                    setVst3PickerRow(null);
                                                }}
                                                title={p.name}
                                                style={{
                                                    padding: '4px 10px', fontSize: '10px', cursor: 'pointer',
                                                    color: isDark ? '#ccc' : '#333',
                                                    background: 'transparent',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ fontWeight: '600' }}>{p.name}</div>
                                                {p.vendor && <div style={{ fontSize: '8px', color: isDark ? '#666' : '#aaa' }}>{p.vendor}</div>}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

// Piano Roll overlay for focused clip — editable for both melodic and drum tracks
function ClipPianoRoll({ section, row, isDark, onClose, onGenerateRow, onUpdateSection, globalKey, globalScale, globalResolution, globalCurrentStep, globalTempo, sampler, midiTracks, onRenameMidiTrack, onUpdateMidiTrackInstrument, accentColors, globalMutes, setGlobalMutes, globalSolos, updateGlobalSolo, onBounceMidiTrack, selectedFolder }) {
    const { t } = useTranslation();
    const isDrum = row.type === 'drum' && row.drumId;
    const isMidi = row.type === 'midi';
    const data = isDrum ? section.patterns?.drums : (row.trackKey ? section.patterns?.[row.trackKey] : null);
    const midiTrack = isMidi ? midiTracks?.find(t => t.id === row.trackId) : null;

    const [localResolution, setLocalResolution] = useState(globalResolution || 16);
    const [dragOver, setDragOver] = useState(false);
    const [locked, setLocked] = useState(false);

    // Compute mute/solo IDs for the current row
    const muteId = row.type === 'drum' || row.type === 'drums-all' ? 'drums'
        : row.type === 'melodic' ? (row.trackKey || row.id)
        : (row.type === 'audio' || row.type === 'midi') ? row.trackId : null;
    const isMuted = muteId && globalMutes?.has(muteId);
    const isSoloed = muteId && globalSolos?.has(muteId);

    // Save melodic pattern changes back to the arrangement section
    const handleMelodicPatternChange = useCallback((newPattern) => {
        if (!onUpdateSection || !row.trackKey) return;
        onUpdateSection(section.id, {
            patterns: { ...section.patterns, [row.trackKey]: newPattern }
        });
    }, [onUpdateSection, section.id, section.patterns, row.trackKey]);

    // Escape key closes the editor — capture phase ensures it fires before other handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [onClose]);

    // Drag and drop for MIDI tracks — load audio samples or MIDI files
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (!isMidi || !sampler || !midiTrack) return;
        const items = e.dataTransfer?.items;
        if (!items) return;
        for (const item of items) {
            if (item.kind !== 'file') continue;
            const file = item.getAsFile();
            if (file.name.match(/\.(wav|mp3|ogg|flac|aiff|aif|webm)$/i)) {
                try {
                    const instrumentId = `midi_inst_${midiTrack.id}_${Date.now()}`;
                    await sampler.loadInstrumentFromFiles(instrumentId, [file], file.name);
                    if (onUpdateMidiTrackInstrument) onUpdateMidiTrackInstrument(midiTrack.id, instrumentId, file.name);
                } catch (err) { console.error('[ClipPianoRoll] sample drop error:', err); }
                return;
            }
            if (file.name.match(/\.(mid|midi)$/i)) {
                try {
                    const { default: MIDIParser } = await import('./MIDIParser');
                    const parser = new MIDIParser();
                    const midiData = await parser.loadMIDIFile(file);
                    let notes = [];
                    for (const trk of midiData.tracks) {
                        const trackNotes = parser.eventsToNotes(trk.events);
                        if (trackNotes.length > 0) { notes = trackNotes; break; }
                    }
                    if (notes.length > 0) {
                        const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
                        const newPattern = notes.map(n => ({
                            time: Math.floor(n.startTick / ticksPerStep),
                            duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                            note: n.note,
                            velocity: n.velocity / 127
                        })).filter(n => n.time < section.bars * 32);
                        handleMelodicPatternChange(newPattern);
                    }
                } catch (err) { console.error('[ClipPianoRoll] MIDI drop error:', err); }
                return;
            }
        }
    }, [isMidi, sampler, midiTrack, onUpdateMidiTrackInstrument, handleMelodicPatternChange, section.bars]);

    const bg = isDark ? '#0c0c11' : '#f7f7fa';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
    const noteCount = isDrum ? '' : (Array.isArray(data) ? t('arrange.notes', { count: data.length }) : t('arrange.zeroNotes'));
    const resOptions = [4, 8, 16, 32];
    const btnSm = (active) => ({
        padding: '2px 6px', borderRadius: '3px', fontSize: '8px', fontWeight: '700', cursor: 'pointer',
        border: `1px solid ${active ? (row.color || '#888') : (isDark ? '#333' : '#ccc')}`,
        background: active ? `${row.color || '#888'}22` : 'transparent',
        color: active ? (row.color || '#888') : (isDark ? '#777' : '#999'),
    });

    return (
        <div
            style={{
                position: 'absolute', inset: 0, zIndex: 100,
                background: `${bg}f5`,
                display: 'flex', flexDirection: 'column',
                backdropFilter: 'blur(4px)'
            }}
            onDragOver={isMidi ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
            onDragLeave={isMidi ? () => setDragOver(false) : undefined}
            onDrop={isMidi ? handleDrop : undefined}
        >
            {/* Drag overlay for MIDI tracks */}
            {dragOver && isMidi && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 200,
                    background: `${row.color}15`, border: `2px dashed ${row.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: '700', color: row.color, pointerEvents: 'none'
                }}>
                    {t('arrange.dropAudioOrMidi')}
                </div>
            )}

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', padding: '6px 12px', gap: '8px', flexWrap: 'wrap',
                background: isDark ? 'rgba(18,18,24,0.95)' : '#eeeef2',
                borderBottom: `1px solid ${borderColor}`
            }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: row.color }} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: row.color }}>{row.label.toUpperCase()}</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#888' : '#777' }}>
                    — {section.name} · {section.bars} {t('arrange.bars')}
                </span>
                {noteCount && <span style={{ fontSize: '9px', color: isDark ? '#555' : '#aaa' }}>{noteCount}</span>}

                {/* Instrument name for MIDI tracks */}
                {isMidi && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '4px',
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}>
                        <span style={{ fontSize: '7px', fontWeight: '800', color: row.color, letterSpacing: '0.5px' }}>{t('arrange.inst')}</span>
                        <span style={{ fontSize: '9px', fontWeight: '600', color: midiTrack?.instrumentName ? (isDark ? '#bbb' : '#444') : (isDark ? '#555' : '#aaa') }}>
                            {midiTrack?.instrumentName || t('arrange.dropSample')}
                        </span>
                    </div>
                )}

                {/* Resolution controls */}
                {!isDrum && (
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <span style={{ fontSize: '7px', fontWeight: '700', color: isDark ? '#555' : '#999', marginRight: '2px' }}>{t('arrange.res')}</span>
                        {resOptions.map(r => (
                            <button key={r} onClick={() => setLocalResolution(r)} style={btnSm(localResolution === r)}>
                                1/{r}
                            </button>
                        ))}
                    </div>
                )}

                {/* S / M / Lock / STX buttons */}
                {muteId && (
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <button onClick={() => { if (updateGlobalSolo) updateGlobalSolo(muteId, !isSoloed, false); }} style={{
                            ...btnSm(isSoloed), background: isSoloed ? '#ffa50233' : undefined,
                            border: `1px solid ${isSoloed ? '#ffa502' : (isDark ? '#333' : '#ccc')}`,
                            color: isSoloed ? '#ffa502' : undefined,
                        }} title={isSoloed ? t('arrange.unsolo') : t('common.soloCtrl')}>S</button>
                        <button onClick={() => { if (setGlobalMutes) setGlobalMutes(prev => { const next = new Set(prev); if (next.has(muteId)) next.delete(muteId); else next.add(muteId); return next; }); }} style={{
                            ...btnSm(isMuted), background: isMuted ? '#ff475733' : undefined,
                            border: `1px solid ${isMuted ? '#ff4757' : (isDark ? '#333' : '#ccc')}`,
                            color: isMuted ? '#ff4757' : undefined,
                        }} title={isMuted ? t('arrange.unmute') : t('common.mute')}>M</button>
                        <button onClick={() => setLocked(prev => !prev)} style={{
                            ...btnSm(locked), background: locked ? '#ffa50233' : undefined,
                            border: `1px solid ${locked ? '#ffa502' : (isDark ? '#333' : '#ccc')}`,
                            color: locked ? '#ffa502' : undefined,
                        }} title={locked ? t('common.unlock') : t('common.lock')}>{locked ? '\uD83D\uDD12' : '\uD83D\uDD13'}</button>
                        {isMidi && (
                            <button onClick={async () => {
                                if (!selectedFolder) return alert(t('common.selectFolderFirst'));
                                try {
                                    const audioFiles = await collectAudioFiles(selectedFolder);
                                    if (audioFiles.length === 0) return alert(t('common.noAudioFiles'));
                                    const pick = audioFiles[Math.floor(Math.random() * audioFiles.length)];
                                    const file = await getFileFromItem(pick);
                                    const sampleName = pick.name.replace(/\.[^.]+$/, '');
                                    const instrumentId = `midi_rand_${row.trackId}_${Date.now()}`;
                                    await sampler.loadInstrumentFromFiles(instrumentId, [file], sampleName);
                                    if (onUpdateMidiTrackInstrument) onUpdateMidiTrackInstrument(row.trackId, instrumentId, sampleName);
                                } catch (err) { console.error('[STX] Randomize error:', err); }
                            }} style={btnSm(false)} title={t('arrange.randomizeInstrument')}>{t('arrange.stx')}</button>
                        )}
                    </div>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    {row.type !== 'midi' && row.type !== 'audio' && (
                        <button onClick={onGenerateRow} style={{
                            background: isDark ? `${row.color}15` : `${row.color}20`,
                            border: `1px solid ${isDark ? `${row.color}30` : `${row.color}40`}`,
                            borderRadius: '4px', color: row.color, fontSize: '9px', fontWeight: '800',
                            padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.3px'
                        }}>
                            {t('arrange.generateTrack', { label: row.label.toUpperCase() })}
                        </button>
                    )}
                    <button onClick={onClose} style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#e8e8ec',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#d5d5d9'}`,
                        borderRadius: '4px', color: isDark ? '#888' : '#666', fontSize: '9px', fontWeight: '800',
                        padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.3px'
                    }}>
                        {t('arrange.escBack')}
                    </button>
                </div>
            </div>

            {/* Editor body */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0, background: isDark ? '#000' : '#fff' }}>
                {isDrum ? (
                    <DrumClipEditor
                        section={section}
                        drumId={row.drumId}
                        color={row.color}
                        isDark={isDark}
                        onUpdateSection={onUpdateSection}
                        globalResolution={globalResolution || 16}
                    />
                ) : (
                    <PianoRollEditor
                        pattern={Array.isArray(data) ? data : []}
                        onPatternChange={handleMelodicPatternChange}
                        bars={section.bars}
                        globalResolution={localResolution}
                        globalKey={globalKey || 'C'}
                        globalScale={globalScale || 'Minor'}
                        theme={isDark ? 'dark' : 'light'}
                        height={500}
                        currentStep={globalCurrentStep}
                        globalPlayStartTime={0}
                        globalTempo={globalTempo || 120}
                        accentColors={accentColors}
                    />
                )}
            </div>
        </div>
    );
}

// MIDI note number to note name
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const note = NOTE_NAMES[midi % 12];
    return `${note}${octave}`;
}

// Drum step-grid editor for arrangement clip editing
function DrumClipEditor({ section, drumId, color, isDark, onUpdateSection, globalResolution }) {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const scrollRef = useRef(null);
    const [dragMode, setDragMode] = useState(null); // 'toggle-on', 'toggle-off', 'velocity', 'selecting', 'right-delete', 'box-select'
    const dragLaneRef = useRef(null);
    const [selectedSteps, setSelectedSteps] = useState(new Set()); // Set of "laneId:step" keys
    const [drumClipboard, setDrumClipboard] = useState([]); // [{laneId, step, velocity, duration}]
    const [insertionPoint, setInsertionPoint] = useState(null); // { step, laneIdx } or null
    const [gridRes, setGridRes] = useState(globalResolution || 16); // toggleable: 4, 8, 16, 32
    const [drumZoom, setDrumZoom] = useState(1.0); // 0.5 = fit more bars, 3.0 = zoom in

    // Box selection state — pixel coordinates for rubber-band rectangle
    const boxSelectStart = useRef(null); // { x, y } pixel coords on canvas
    const [boxSelectRect, setBoxSelectRect] = useState(null); // { x, y, w, h } or null

    const drumData = section.patterns?.drums?.[drumId];
    const laneKeys = useMemo(() => drumData?.lanes ? Object.keys(drumData.lanes) : [], [drumData]);
    const totalSteps = section.bars * 32;
    const snapInterval = Math.max(1, Math.round(32 / gridRes));

    // Get note name for a lane using its pitch offset + drum base octave (C1 default)
    const getLaneNoteName = useCallback((laneId) => {
        const lane = drumData?.lanes?.[laneId];
        const pitch = lane?.pitch ?? 0;
        // Drums default to octave 1 (C1 = MIDI 24), base note is C
        const baseMidi = 24; // C1
        return midiToNoteName(baseMidi + pitch);
    }, [drumData]);

    // Clone drum data for immutable updates
    const cloneDrum = useCallback(() => {
        return JSON.parse(JSON.stringify(drumData || { lanes: {} }));
    }, [drumData]);

    // Save drum changes back to the arrangement
    const saveDrum = useCallback((newDrumData) => {
        if (!onUpdateSection) return;
        const newDrums = { ...(section.patterns?.drums || {}) };
        newDrums[drumId] = newDrumData;
        onUpdateSection(section.id, { patterns: { ...section.patterns, drums: newDrums } });
    }, [onUpdateSection, section.id, section.patterns, drumId]);

    // Map mouse position to grid coordinates
    const getGridPos = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const LABEL_W = 60;
        const VEL_H = 30;
        const gridH = rect.height - VEL_H;
        const laneH = laneKeys.length > 0 ? gridH / laneKeys.length : gridH;
        const gridW = rect.width - LABEL_W;
        const stepW = gridW / totalSteps;

        const laneIdx = Math.floor(y / laneH);
        const step = Math.floor((x - LABEL_W) / stepW);
        const snappedStep = Math.max(0, Math.min(Math.floor(step / snapInterval) * snapInterval, totalSteps - 1));
        const isVelArea = y > gridH;
        const velValue = isVelArea ? Math.max(0, Math.min(100, Math.round(100 * (1 - (y - gridH) / VEL_H)))) : null;

        return {
            laneIdx: Math.max(0, Math.min(laneIdx, laneKeys.length - 1)),
            laneId: laneKeys[Math.max(0, Math.min(laneIdx, laneKeys.length - 1))],
            step: snappedStep,
            isVelArea,
            velValue,
            x, y
        };
    }, [laneKeys, totalSteps, snapInterval]);

    // Toggle a step on/off
    const toggleStep = useCallback((laneId, step, forceOn) => {
        const clone = cloneDrum();
        if (!clone.lanes[laneId]) return;
        const isOn = clone.lanes[laneId].pattern[step];
        if (forceOn !== undefined) {
            clone.lanes[laneId].pattern[step] = forceOn;
        } else {
            clone.lanes[laneId].pattern[step] = !isOn;
        }
        if (clone.lanes[laneId].pattern[step] && !clone.lanes[laneId].velocity[step]) {
            clone.lanes[laneId].velocity[step] = 100;
        }
        if (clone.lanes[laneId].pattern[step] && !clone.lanes[laneId].duration[step]) {
            clone.lanes[laneId].duration[step] = snapInterval;
        }
        saveDrum(clone);
    }, [cloneDrum, saveDrum, snapInterval]);

    // Helper: compute all notes inside a pixel rect → Set of "laneId:step" keys
    const getNotesInRect = useCallback((rect) => {
        const canvas = canvasRef.current;
        if (!canvas || !rect || laneKeys.length === 0) return new Set();
        const cw = canvas.getBoundingClientRect().width;
        const ch = canvas.getBoundingClientRect().height;
        const LABEL_W = 60;
        const VEL_H = 30;
        const gridH = ch - VEL_H;
        const laneH = gridH / laneKeys.length;
        const gridW = cw - LABEL_W;
        const stepW = gridW / totalSteps;

        // Normalize rect so x/y is always top-left
        const rx = Math.min(rect.x, rect.x + rect.w);
        const ry = Math.min(rect.y, rect.y + rect.h);
        const rw = Math.abs(rect.w);
        const rh = Math.abs(rect.h);

        const result = new Set();
        laneKeys.forEach((lk, li) => {
            const lane = drumData?.lanes?.[lk];
            if (!lane) return;
            const laneY = li * laneH;
            // Check if lane overlaps with rect vertically
            if (laneY + laneH < ry || laneY > ry + rh) return;
            for (let s = 0; s < totalSteps; s++) {
                if (!lane.pattern[s]) continue;
                const noteX = LABEL_W + s * stepW;
                const dur = lane.duration?.[s] || 1;
                const noteW = Math.max(2, dur * stepW - 1);
                // Check if note overlaps with rect horizontally
                if (noteX + noteW < rx || noteX > rx + rw) continue;
                result.add(`${lk}:${s}`);
            }
        });
        return result;
    }, [laneKeys, drumData, totalSteps]);

    // Mouse handlers
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        const pos = getGridPos(e);
        if (!pos) return;

        // Right-click: start drag-to-delete mode
        if (e.button === 2) {
            setDragMode('right-delete');
            const lane = drumData?.lanes?.[pos.laneId];
            if (lane?.pattern[pos.step]) {
                toggleStep(pos.laneId, pos.step, false);
            }
            return;
        }

        if (pos.isVelArea) {
            // Velocity editing
            setDragMode('velocity');
            dragLaneRef.current = pos.laneId;
            if (pos.velValue != null) {
                const clone = cloneDrum();
                laneKeys.forEach(lk => {
                    if (clone.lanes[lk]?.pattern[pos.step]) {
                        clone.lanes[lk].velocity[pos.step] = pos.velValue;
                    }
                });
                saveDrum(clone);
            }
            return;
        }

        const lane = drumData?.lanes?.[pos.laneId];
        if (!lane) return;
        const isOn = lane.pattern[pos.step];
        const stepKey = `${pos.laneId}:${pos.step}`;

        // Ctrl+click: toggle selection without toggling the step
        if (e.ctrlKey || e.metaKey) {
            setSelectedSteps(prev => {
                const next = new Set(prev);
                if (next.has(stepKey)) next.delete(stepKey); else if (isOn) next.add(stepKey);
                return next;
            });
            return;
        }

        // Normal click on active note: select just that note
        if (isOn) {
            setSelectedSteps(new Set([stepKey]));
            setInsertionPoint(null);
            setDragMode('selecting');
            dragLaneRef.current = pos.laneId;
            return;
        }

        // Click on empty space: start box selection
        setSelectedSteps(new Set());
        setInsertionPoint(null);
        boxSelectStart.current = { x: pos.x, y: pos.y };
        setBoxSelectRect(null);
        setDragMode('box-select');
        dragLaneRef.current = pos.laneId;
    }, [getGridPos, drumData, cloneDrum, saveDrum, toggleStep, laneKeys]);

    const handleMouseMove = useCallback((e) => {
        if (!dragMode) return;
        const pos = getGridPos(e);
        if (!pos) return;

        if (dragMode === 'velocity' && pos.isVelArea && pos.velValue != null) {
            const clone = cloneDrum();
            laneKeys.forEach(lk => {
                if (clone.lanes[lk]?.pattern[pos.step]) {
                    clone.lanes[lk].velocity[pos.step] = pos.velValue;
                }
            });
            saveDrum(clone);
        } else if (dragMode === 'right-delete') {
            const lane = drumData?.lanes?.[pos.laneId];
            if (lane?.pattern[pos.step]) {
                toggleStep(pos.laneId, pos.step, false);
            }
        } else if (dragMode === 'selecting') {
            const stepKey = `${pos.laneId}:${pos.step}`;
            const lane = drumData?.lanes?.[pos.laneId];
            if (lane?.pattern[pos.step]) {
                setSelectedSteps(prev => {
                    const next = new Set(prev);
                    next.add(stepKey);
                    return next;
                });
            }
        } else if (dragMode === 'box-select' && boxSelectStart.current) {
            // Update rubber-band rectangle and live-select notes inside it
            const start = boxSelectStart.current;
            const rect = {
                x: Math.min(start.x, pos.x),
                y: Math.min(start.y, pos.y),
                w: Math.abs(pos.x - start.x),
                h: Math.abs(pos.y - start.y)
            };
            setBoxSelectRect(rect);
            // Live-highlight: select all notes within the box
            const notesInBox = getNotesInRect(rect);
            setSelectedSteps(notesInBox);
        }
    }, [dragMode, getGridPos, drumData, cloneDrum, saveDrum, toggleStep, laneKeys, getNotesInRect]);

    const handleMouseUp = useCallback(() => {
        if (dragMode === 'box-select' && boxSelectRect) {
            // Finalize: select all notes in the rect
            const notesInBox = getNotesInRect(boxSelectRect);
            setSelectedSteps(notesInBox);
            // If nothing was selected, set insertion point at start of box
            if (notesInBox.size === 0 && boxSelectStart.current) {
                const canvas = canvasRef.current;
                if (canvas) {
                    const cw = canvas.getBoundingClientRect().width;
                    const ch = canvas.getBoundingClientRect().height;
                    const LABEL_W = 60;
                    const VEL_H = 30;
                    const gridH = ch - VEL_H;
                    const laneH = laneKeys.length > 0 ? gridH / laneKeys.length : gridH;
                    const gridW = cw - LABEL_W;
                    const stepW = gridW / totalSteps;
                    const step = Math.max(0, Math.min(Math.floor((boxSelectStart.current.x - LABEL_W) / stepW / snapInterval) * snapInterval, totalSteps - 1));
                    const laneIdx = Math.max(0, Math.min(Math.floor(boxSelectStart.current.y / laneH), laneKeys.length - 1));
                    setInsertionPoint({ step, laneIdx });
                }
            }
        }
        setDragMode(null);
        setBoxSelectRect(null);
        boxSelectStart.current = null;
        dragLaneRef.current = null;
    }, [dragMode, boxSelectRect, getNotesInRect, laneKeys, totalSteps, snapInterval]);

    // Double-click: toggle a step on/off (add or delete note)
    const handleDoubleClick = useCallback((e) => {
        const pos = getGridPos(e);
        if (!pos || pos.isVelArea) return;
        toggleStep(pos.laneId, pos.step);
    }, [getGridPos, toggleStep]);

    // Keyboard shortcuts: Ctrl+C/V/D, Delete, Ctrl+A
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            // Ctrl+A: select all active steps
            if (isCtrl && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                const all = new Set();
                laneKeys.forEach(lk => {
                    const lane = drumData?.lanes?.[lk];
                    if (!lane) return;
                    lane.pattern.forEach((active, s) => { if (active) all.add(`${lk}:${s}`); });
                });
                setSelectedSteps(all);
                return;
            }
            // Ctrl+C: copy selected steps
            if (isCtrl && e.key.toLowerCase() === 'c' && selectedSteps.size > 0) {
                e.preventDefault();
                const items = [];
                selectedSteps.forEach(key => {
                    const [lk, s] = key.split(':');
                    const step = parseInt(s);
                    const lane = drumData?.lanes?.[lk];
                    if (lane?.pattern[step]) {
                        items.push({ laneId: lk, step, velocity: lane.velocity?.[step] || 100, duration: lane.duration?.[step] || 1 });
                    }
                });
                setDrumClipboard(items);
                return;
            }
            // Ctrl+V: paste at insertion point, selected step, or step 0
            if (isCtrl && e.key.toLowerCase() === 'v' && drumClipboard.length > 0) {
                e.preventDefault();
                const minStep = Math.min(...drumClipboard.map(i => i.step));
                let pasteOffset = 0;
                if (insertionPoint) {
                    pasteOffset = insertionPoint.step - minStep;
                } else if (selectedSteps.size > 0) {
                    const firstKey = Array.from(selectedSteps)[0];
                    pasteOffset = parseInt(firstKey.split(':')[1]) - minStep;
                }
                const clone = cloneDrum();
                drumClipboard.forEach(item => {
                    const newStep = item.step + pasteOffset;
                    if (newStep >= 0 && newStep < totalSteps && clone.lanes[item.laneId]) {
                        clone.lanes[item.laneId].pattern[newStep] = true;
                        clone.lanes[item.laneId].velocity[newStep] = item.velocity;
                        clone.lanes[item.laneId].duration[newStep] = item.duration;
                    }
                });
                saveDrum(clone);
                return;
            }
            // Ctrl+D: duplicate selected steps (offset by snap interval)
            if (isCtrl && e.key.toLowerCase() === 'd' && selectedSteps.size > 0) {
                e.preventDefault();
                const items = [];
                selectedSteps.forEach(key => {
                    const [lk, s] = key.split(':');
                    const step = parseInt(s);
                    const lane = drumData?.lanes?.[lk];
                    if (lane?.pattern[step]) {
                        items.push({ laneId: lk, step, velocity: lane.velocity?.[step] || 100, duration: lane.duration?.[step] || 1 });
                    }
                });
                if (items.length === 0) return;
                const maxStep = Math.max(...items.map(i => i.step));
                const minStep = Math.min(...items.map(i => i.step));
                const offset = maxStep - minStep + snapInterval;
                const clone = cloneDrum();
                const newSelection = new Set();
                items.forEach(item => {
                    const newStep = item.step + offset;
                    if (newStep >= 0 && newStep < totalSteps && clone.lanes[item.laneId]) {
                        clone.lanes[item.laneId].pattern[newStep] = true;
                        clone.lanes[item.laneId].velocity[newStep] = item.velocity;
                        clone.lanes[item.laneId].duration[newStep] = item.duration;
                        newSelection.add(`${item.laneId}:${newStep}`);
                    }
                });
                saveDrum(clone);
                setSelectedSteps(newSelection);
                return;
            }
            // Number keys 2/4/6/8: split selected notes into N evenly-spaced hits (drum roll)
            if (!isCtrl && ['2', '4', '6', '8'].includes(e.key) && selectedSteps.size > 0) {
                e.preventDefault();
                const splitCount = parseInt(e.key);
                const clone = cloneDrum();
                const newSelection = new Set();

                // Group selected steps by laneId
                const byLane = {};
                selectedSteps.forEach(key => {
                    const [lk, s] = key.split(':');
                    if (!byLane[lk]) byLane[lk] = [];
                    byLane[lk].push(parseInt(s));
                });

                Object.entries(byLane).forEach(([lk, steps]) => {
                    if (!clone.lanes[lk]) return;
                    steps.sort((a, b) => a - b);
                    steps.forEach(step => {
                        const vel = clone.lanes[lk].velocity?.[step] || 100;
                        const dur = clone.lanes[lk].duration?.[step] || snapInterval;
                        // The span to fill: use the note's duration or snap interval
                        const span = Math.max(dur, snapInterval);
                        const subStep = span / splitCount;

                        // Remove original note
                        clone.lanes[lk].pattern[step] = false;

                        // Add N evenly-spaced notes
                        for (let i = 0; i < splitCount; i++) {
                            const newStep = Math.round(step + i * subStep);
                            if (newStep >= 0 && newStep < totalSteps) {
                                clone.lanes[lk].pattern[newStep] = true;
                                clone.lanes[lk].velocity[newStep] = vel;
                                clone.lanes[lk].duration[newStep] = Math.max(1, Math.round(subStep));
                                newSelection.add(`${lk}:${newStep}`);
                            }
                        }
                    });
                });

                saveDrum(clone);
                setSelectedSteps(newSelection);
                return;
            }
            // Delete/Backspace: remove selected steps
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSteps.size > 0) {
                e.preventDefault();
                const clone = cloneDrum();
                selectedSteps.forEach(key => {
                    const [lk, s] = key.split(':');
                    const step = parseInt(s);
                    if (clone.lanes[lk]) {
                        clone.lanes[lk].pattern[step] = false;
                    }
                });
                saveDrum(clone);
                setSelectedSteps(new Set());
                return;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedSteps, drumClipboard, drumData, laneKeys, totalSteps, snapInterval, cloneDrum, saveDrum, insertionPoint]);

    // Draw the drum grid
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const scroll = scrollRef.current;
        if (!canvas || !container) return;
        const containerW = container.clientWidth;
        const h = container.clientHeight;
        const w = Math.max(containerW, Math.round(containerW * drumZoom));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        if (laneKeys.length === 0) {
            ctx.fillStyle = isDark ? '#333' : '#ccc';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No drum data — click Generate', w / 2, h / 2);
            return;
        }

        const LABEL_W = 60;
        const VEL_H = 30;
        const gridH = h - VEL_H;
        const laneH = gridH / laneKeys.length;
        const gridW = w - LABEL_W;
        const stepW = gridW / totalSteps;

        // Background
        ctx.fillStyle = isDark ? '#0a0a0f' : '#f8f8fa';
        ctx.fillRect(0, 0, w, h);

        // Lane backgrounds and labels
        laneKeys.forEach((lk, li) => {
            const y = li * laneH;
            // Alternate lane bg
            if (li % 2 === 0) {
                ctx.fillStyle = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)';
                ctx.fillRect(0, y, w, laneH);
            }
            // Lane label — show note name instead of lane ID
            ctx.fillStyle = isDark ? '#888' : '#777';
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(getLaneNoteName(lk), 4, y + laneH / 2 + 3);
            // Lane divider
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(LABEL_W, y + laneH);
            ctx.lineTo(w, y + laneH);
            ctx.stroke();
        });

        // Vertical grid lines at resolution intervals + bar.beat markers
        for (let s = 0; s <= totalSteps; s += snapInterval) {
            const x = LABEL_W + s * stepW;
            const isBar = s % 32 === 0;
            const isBeat = s % 8 === 0;
            ctx.strokeStyle = isBar
                ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')
                : isBeat
                    ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)')
                    : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)');
            ctx.lineWidth = isBar ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gridH);
            ctx.stroke();
            // Bar.beat label (1.1, 1.2, 1.3, 1.4, 2.1, ...)
            if (isBeat && s < totalSteps) {
                const barNum = Math.floor(s / 32) + 1;
                const beatNum = Math.floor((s % 32) / 8) + 1;
                const isDownbeat = beatNum === 1;
                ctx.fillStyle = isDownbeat
                    ? (isDark ? '#777' : '#888')
                    : (isDark ? '#444' : '#bbb');
                ctx.font = isDownbeat ? 'bold 8px monospace' : '7px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(`${barNum}.${beatNum}`, x + 2, 10);
            }
        }

        // Draw step cells and notes
        laneKeys.forEach((lk, li) => {
            const lane = drumData?.lanes?.[lk];
            if (!lane) return;
            const y = li * laneH;

            for (let s = 0; s < totalSteps; s++) {
                if (!lane.pattern[s]) continue;
                const x = LABEL_W + s * stepW;
                const dur = lane.duration?.[s] || 1;
                const vel = (lane.velocity?.[s] || 100) / 100;
                const noteW = Math.max(2, dur * stepW - 1);

                const isSelected = selectedSteps.has(`${lk}:${s}`);
                ctx.fillStyle = isSelected ? '#fff' : color;
                ctx.globalAlpha = isSelected ? 0.9 : (0.3 + vel * 0.7);
                ctx.fillRect(x, y + 2, noteW, laneH - 4);
                // Border
                ctx.strokeStyle = isSelected ? '#fff' : color;
                ctx.globalAlpha = 0.9;
                ctx.lineWidth = isSelected ? 1.5 : 0.5;
                ctx.strokeRect(x, y + 2, noteW, laneH - 4);
            }
        });
        ctx.globalAlpha = 1;

        // Draw insertion point cursor
        if (insertionPoint) {
            const ipX = LABEL_W + insertionPoint.step * stepW;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.8;
            ctx.setLineDash([3, 2]);
            ctx.beginPath();
            ctx.moveTo(ipX, 0);
            ctx.lineTo(ipX, gridH);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        // Velocity area divider
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gridH);
        ctx.lineTo(w, gridH);
        ctx.stroke();

        // Velocity label
        ctx.fillStyle = isDark ? '#444' : '#bbb';
        ctx.font = '8px monospace';
        ctx.fillText(t('arrange.vel'), 4, gridH + 12);

        // Velocity bars
        for (let s = 0; s < totalSteps; s++) {
            let maxVel = 0;
            let hasNote = false;
            laneKeys.forEach(lk => {
                const lane = drumData?.lanes?.[lk];
                if (lane?.pattern[s]) {
                    hasNote = true;
                    maxVel = Math.max(maxVel, lane.velocity?.[s] || 100);
                }
            });
            if (hasNote) {
                const x = LABEL_W + s * stepW;
                const barH = Math.max(2, (maxVel / 100) * (VEL_H - 4));
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.5 + (maxVel / 100) * 0.5;
                ctx.fillRect(x, h - barH - 2, Math.max(1, stepW - 1), barH);
            }
        }
        // Draw box selection rectangle (rubber-band)
        if (boxSelectRect) {
            ctx.save();
            // Fill
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.08;
            ctx.fillRect(boxSelectRect.x, boxSelectRect.y, boxSelectRect.w, boxSelectRect.h);
            // Border — dashed
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.6;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(boxSelectRect.x, boxSelectRect.y, boxSelectRect.w, boxSelectRect.h);
            ctx.setLineDash([]);
            // Corner accents — small solid squares at corners
            const cSize = 4;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            const corners = [
                [boxSelectRect.x, boxSelectRect.y],
                [boxSelectRect.x + boxSelectRect.w - cSize, boxSelectRect.y],
                [boxSelectRect.x, boxSelectRect.y + boxSelectRect.h - cSize],
                [boxSelectRect.x + boxSelectRect.w - cSize, boxSelectRect.y + boxSelectRect.h - cSize]
            ];
            corners.forEach(([cx, cy]) => ctx.fillRect(cx, cy, cSize, cSize));
            ctx.restore();
        }

        ctx.globalAlpha = 1;
    }, [section, drumData, laneKeys, totalSteps, color, isDark, selectedSteps, insertionPoint, getLaneNoteName, gridRes, snapInterval, drumZoom, boxSelectRect, t]);

    const RES_OPTIONS = [4, 8, 16, 32];
    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'default', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar: Grid resolution + Zoom slider */}
            <div style={{
                height: '24px', display: 'flex', alignItems: 'center', gap: '3px', padding: '0 8px',
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`
            }}>
                <span style={{ fontSize: '8px', color: isDark ? '#555' : '#aaa', fontWeight: '700', marginRight: '4px' }}>{t('arrange.grid')}</span>
                {RES_OPTIONS.map(r => (
                    <button key={r} onClick={() => setGridRes(r)} style={{
                        background: gridRes === r ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)') : 'transparent',
                        border: `1px solid ${gridRes === r ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : 'transparent'}`,
                        borderRadius: '3px', color: gridRes === r ? (isDark ? '#ddd' : '#333') : (isDark ? '#666' : '#999'),
                        fontSize: '8px', fontWeight: '700', padding: '1px 5px', cursor: 'pointer'
                    }}>1/{r}</button>
                ))}
                <div style={{ width: '1px', height: '12px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '0 6px' }} />
                <span style={{ fontSize: '8px', color: isDark ? '#555' : '#aaa', fontWeight: '700' }}>{t('arrange.zoom')}</span>
                <input
                    type="range" min="0.5" max="4" step="0.1" value={drumZoom}
                    onChange={(e) => setDrumZoom(parseFloat(e.target.value))}
                    style={{ width: '80px', height: '3px', accentColor: color, cursor: 'pointer' }}
                    title={`Zoom: ${Math.round(drumZoom * 100)}%`}
                />
                <span style={{ fontSize: '8px', color: isDark ? '#666' : '#999', fontWeight: '600', minWidth: '28px' }}>
                    {Math.round(drumZoom * 100)}%
                </span>
                <button onClick={() => setDrumZoom(1.0)} style={{
                    background: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: '3px', color: isDark ? '#666' : '#999', fontSize: '7px', fontWeight: '700',
                    padding: '1px 5px', cursor: 'pointer', letterSpacing: '0.5px'
                }}>{t('arrange.fit')}</button>
            </div>
            <div ref={scrollRef} style={{ flex: 1, position: 'relative', minHeight: 0, overflowX: drumZoom > 1 ? 'auto' : 'hidden', overflowY: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    style={{ width: drumZoom > 1 ? `${Math.round(100 * drumZoom)}%` : '100%', height: '100%', display: 'block' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={(e) => e.preventDefault()}
                />
            </div>
        </div>
    );
}

// Small reusable sub-components
function ZoomBtn({ label, title, onClick, isDark }) {
    return (
        <button onClick={onClick} title={title} style={{
            background: isDark ? 'rgba(255,255,255,0.05)' : '#e8e8ec',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#d5d5d9'}`,
            borderRadius: '3px', color: isDark ? '#888' : '#666',
            fontSize: '12px', fontWeight: '800', width: '20px', height: '18px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
        }}>
            {label}
        </button>
    );
}

function ActionBtn({ label, color, isDark, onClick, disabled }) {
    return (
        <button disabled={disabled} onClick={disabled ? undefined : onClick} style={{
            background: isDark ? `${color}15` : `${color}20`,
            border: `1px solid ${isDark ? `${color}30` : `${color}40`}`,
            borderRadius: '4px', color, fontSize: '9px', fontWeight: '800',
            padding: '2px 8px', cursor: disabled ? 'default' : 'pointer',
            letterSpacing: '0.3px', opacity: disabled ? 0.4 : 1,
            pointerEvents: disabled ? 'none' : 'auto'
        }}>
            {label}
        </button>
    );
}

function CtxItem({ label, isDark, onClick, active, danger, disabled, ac: acProp }) {
    const ac = acProp || '#ff6b6b';
    const [h, setH] = useState(false);
    return (
        <div onClick={disabled ? undefined : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
            style={{
                padding: '5px 12px', cursor: disabled ? 'default' : 'pointer',
                color: disabled ? (isDark ? '#444' : '#ccc') : danger ? '#ff4757' : (isDark ? '#ccc' : '#333'),
                background: h && !disabled ? (isDark ? hexToRgba(ac, 0.1) : '#f5f5f5') : 'transparent',
                fontWeight: active ? '700' : '500', fontSize: '11px',
                display: 'flex', alignItems: 'center', gap: '6px', opacity: disabled ? 0.4 : 1
            }}>
            {active && <span style={{ color: ac, fontSize: '8px' }}>●</span>}
            {label}
        </div>
    );
}

function CtxSubmenu({ label, isDark, children }) {
    const [open, setOpen] = useState(false);
    return (
        <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ position: 'relative' }}>
            <div style={{
                padding: '5px 12px', cursor: 'pointer', fontSize: '11px',
                color: isDark ? '#ccc' : '#333',
                background: open ? (isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5') : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                {label}
                <span style={{ fontSize: '8px', opacity: 0.4 }}>▶</span>
            </div>
            {open && (
                <div style={{
                    position: 'absolute', left: '100%', top: 0,
                    background: isDark ? '#1a1a22' : '#fff',
                    border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                    borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    zIndex: 10000, padding: '4px 0', minWidth: '130px'
                }}>
                    {children}
                </div>
            )}
        </div>
    );
}
