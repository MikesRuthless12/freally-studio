import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { detectTransients } from './TransientDetector.js';
import { hexToRgba } from './accentThemes';

/**
 * SampleSlicerEditor — Reusable component that divides an audio sample into
 * N slices, each mapped to a MIDI note. Used in both the arrangement clip
 * editor AND the generator tabs.
 *
 * Features:
 *  - Waveform display with slice boundary markers
 *  - Equal or transient-based slicing
 *  - Click-to-audition individual slices
 *  - Drag slice boundaries to adjust manually
 *  - Per-slice reverse and pitch controls
 *  - "Load to Piano Roll" creates a sliced instrument
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(midi) {
    const name = NOTE_NAMES[midi % 12];
    const oct = Math.floor(midi / 12) - 1;
    return `${name}${oct}`;
}

const SLICE_COLORS = [
    'rgba(77,171,247,0.12)',   // blue
    'rgba(140,200,90,0.12)',   // green
    'rgba(255,159,67,0.12)',   // orange
    'rgba(190,100,230,0.12)',  // purple
    'rgba(255,100,120,0.12)',  // red
    'rgba(100,220,200,0.12)',  // teal
    'rgba(255,220,80,0.12)',   // yellow
    'rgba(180,140,100,0.12)',  // brown
];

export default function SampleSlicerEditor({
    buffer,
    name = 'Sample',
    isDark = true,
    onClose,
    onLoadToGenerator,
    sampler,
    globalTempo, accentColors}) {
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Slicer state
    const [sliceCount, setSliceCount] = useState(8);
    const [sliceMethod, setSliceMethod] = useState('equal'); // 'equal' | 'transient'
    const [sliceRootNote, setSliceRootNote] = useState(48); // C3
    const [selectedSlice, setSelectedSlice] = useState(null);
    const [perSliceSettings, setPerSliceSettings] = useState([]);
    const [playingSlice, setPlayingSlice] = useState(null);
    const [draggingBoundary, setDraggingBoundary] = useState(null);
    const [customBoundaries, setCustomBoundaries] = useState(null); // null = auto-computed

    const duration = buffer ? buffer.duration : 0;

    // Compute slice boundaries
    const sliceBoundaries = useMemo(() => {
        if (!buffer || !duration) return [];

        // If user has manually adjusted boundaries, use those
        if (customBoundaries && customBoundaries.length === sliceCount) {
            return customBoundaries;
        }

        if (sliceMethod === 'transient') {
            const transients = detectTransients(buffer, 0.6);
            const boundaries = [];
            // Use transients as boundary points, pad or trim to sliceCount
            const points = [0, ...transients.filter(t => t > 0.01 && t < duration - 0.01), duration];

            if (points.length - 1 >= sliceCount) {
                // More transients than slices — space evenly among detected
                const step = (points.length - 1) / sliceCount;
                for (let i = 0; i < sliceCount; i++) {
                    const startIdx = Math.round(i * step);
                    const endIdx = Math.round((i + 1) * step);
                    boundaries.push({
                        start: points[startIdx],
                        end: points[Math.min(endIdx, points.length - 1)]
                    });
                }
            } else {
                // Fewer transients than slices — use transients then fill rest equally
                for (let i = 0; i < points.length - 1 && i < sliceCount; i++) {
                    boundaries.push({ start: points[i], end: points[i + 1] });
                }
                // Fill remaining slices by splitting the last segment
                while (boundaries.length < sliceCount) {
                    const last = boundaries[boundaries.length - 1];
                    const mid = (last.start + last.end) / 2;
                    boundaries[boundaries.length - 1] = { start: last.start, end: mid };
                    boundaries.push({ start: mid, end: last.end });
                }
            }
            return boundaries;
        }

        // Equal slicing
        const sliceDur = duration / sliceCount;
        return Array.from({ length: sliceCount }, (_, i) => ({
            start: i * sliceDur,
            end: (i + 1) * sliceDur,
        }));
    }, [buffer, duration, sliceCount, sliceMethod, customBoundaries]);

    // Init per-slice settings when slice count changes
    useEffect(() => {
        setPerSliceSettings(prev => {
            const next = Array.from({ length: sliceCount }, (_, i) => ({
                reversed: prev[i]?.reversed || false,
                pitch: prev[i]?.pitch || 0,
            }));
            return next;
        });
        setCustomBoundaries(null); // reset custom boundaries
        setSelectedSlice(null);
    }, [sliceCount, sliceMethod]);

    // Draw waveform + slice markers
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !buffer) return;

        const w = container.clientWidth;
        const h = container.clientHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        const channelData = buffer.getChannelData(0);
        const totalSamples = channelData.length;

        // Draw slice background tints
        sliceBoundaries.forEach((slice, i) => {
            const x1 = (slice.start / duration) * w;
            const x2 = (slice.end / duration) * w;
            const isSelected = selectedSlice === i;
            const isPlaying = playingSlice === i;

            let fillColor = SLICE_COLORS[i % SLICE_COLORS.length];
            if (isPlaying) {
                fillColor = isDark ? 'rgba(77,171,247,0.25)' : 'rgba(77,171,247,0.20)';
            } else if (isSelected) {
                fillColor = isDark ? 'rgba(77,171,247,0.18)' : 'rgba(77,171,247,0.15)';
            }
            ctx.fillStyle = fillColor;
            ctx.fillRect(x1, 0, x2 - x1, h);

            // Slice label at top
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            const labelX = (x1 + x2) / 2;
            ctx.fillText(`${i + 1}`, labelX, 14);

            // MIDI note label
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
            ctx.font = '8px monospace';
            ctx.fillText(midiToName(sliceRootNote + i), labelX, 26);
        });

        // Draw boundary lines (dashed)
        sliceBoundaries.forEach((slice, i) => {
            if (i === 0) return; // skip first start
            const x = (slice.start / duration) * w;
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
            ctx.setLineDash([4, 3]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // Draw waveform
        const samplesPerPixel = totalSamples / w;
        const mid = h / 2;
        ctx.fillStyle = isDark ? '#4dabf7' : '#3498db';

        for (let px = 0; px < w; px++) {
            const sampleStart = Math.floor(px * samplesPerPixel);
            const sampleEnd = Math.min(Math.floor((px + 1) * samplesPerPixel), totalSamples);
            let max = 0;
            for (let j = sampleStart; j < sampleEnd; j++) {
                const abs = Math.abs(channelData[j] || 0);
                if (abs > max) max = abs;
            }
            const barH = max * mid * 0.85;
            if (barH < 0.5) continue;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(px, mid - barH, 1, barH * 2);
        }
        ctx.globalAlpha = 1;

        // Center line
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
    }, [buffer, sliceBoundaries, selectedSlice, playingSlice, duration, isDark, sliceRootNote]);

    // Click waveform to audition slice
    const handleCanvasClick = useCallback((e) => {
        if (!buffer || !containerRef.current || draggingBoundary !== null) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * duration;

        // Find which slice was clicked
        const idx = sliceBoundaries.findIndex(s => time >= s.start && time < s.end);
        if (idx === -1) return;

        setSelectedSlice(idx);

        // Audition the slice
        if (sampler && buffer) {
            setPlayingSlice(idx);
            const slice = sliceBoundaries[idx];
            const sliceSettings = perSliceSettings[idx] || {};
            const sliceDur = slice.end - slice.start;

            // Use playAudioClip for preview
            const pitchRate = Math.pow(2, (sliceSettings.pitch || 0) / 12);

            if (sliceSettings.reversed) {
                // Create reversed sub-buffer for preview
                const sampleRate = buffer.sampleRate;
                const startFrame = Math.floor(slice.start * sampleRate);
                const endFrame = Math.floor(slice.end * sampleRate);
                const frameCount = endFrame - startFrame;
                if (frameCount > 0) {
                    const subBuf = new AudioContext().createBuffer(
                        buffer.numberOfChannels, frameCount, sampleRate
                    );
                    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
                        const src = buffer.getChannelData(ch);
                        const dst = subBuf.getChannelData(ch);
                        for (let j = 0; j < frameCount; j++) {
                            dst[j] = src[endFrame - 1 - j];
                        }
                    }
                    sampler.playAudioClip(subBuf, 'preview', 0, pitchRate, 0, 0);
                }
            } else {
                sampler.playAudioClip(buffer, 'preview', 0, pitchRate, slice.start, sliceDur);
            }

            setTimeout(() => setPlayingSlice(null), sliceDur * 1000 + 100);
        }
    }, [buffer, duration, sliceBoundaries, perSliceSettings, sampler, draggingBoundary]);

    // Drag boundary handlers
    const handleCanvasMouseDown = useCallback((e) => {
        if (!containerRef.current || !buffer) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * duration;
        const threshold = duration * 0.01; // 1% of duration as grab zone

        // Check if near a boundary (skip first=0 and last=duration)
        for (let i = 1; i < sliceBoundaries.length; i++) {
            if (Math.abs(sliceBoundaries[i].start - time) < threshold) {
                setDraggingBoundary(i);
                e.preventDefault();
                return;
            }
        }
    }, [buffer, duration, sliceBoundaries]);

    const handleCanvasMouseMove = useCallback((e) => {
        if (draggingBoundary === null || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = Math.max(0.01, Math.min(duration - 0.01, (x / rect.width) * duration));

        setCustomBoundaries(prev => {
            const bounds = prev || [...sliceBoundaries];
            const newBounds = bounds.map(b => ({ ...b }));
            const idx = draggingBoundary;
            // Constrain between neighbors
            const minT = idx > 0 ? newBounds[idx - 1].start + 0.01 : 0.01;
            const maxT = idx < newBounds.length ? (newBounds[idx]?.end || duration) - 0.01 : duration - 0.01;
            const clamped = Math.max(minT, Math.min(maxT, time));
            // Adjust the boundary: end of previous slice, start of this slice
            if (idx > 0 && idx <= newBounds.length) {
                newBounds[idx - 1] = { ...newBounds[idx - 1], end: clamped };
                newBounds[idx] = { ...newBounds[idx], start: clamped };
            }
            return newBounds;
        });
    }, [draggingBoundary, duration, sliceBoundaries]);

    const handleCanvasMouseUp = useCallback(() => {
        if (draggingBoundary !== null) {
            setDraggingBoundary(null);
        }
    }, [draggingBoundary]);

    // Global mouse up listener for boundary drag
    useEffect(() => {
        if (draggingBoundary !== null) {
            const up = () => setDraggingBoundary(null);
            window.addEventListener('mouseup', up);
            return () => window.removeEventListener('mouseup', up);
        }
    }, [draggingBoundary]);

    // Per-slice setting updaters
    const updateSliceSetting = useCallback((idx, key, value) => {
        setPerSliceSettings(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [key]: value };
            return next;
        });
    }, []);

    // Load to Piano Roll handler
    const handleLoadToPianoRoll = useCallback(() => {
        if (!onLoadToGenerator || !buffer || sliceBoundaries.length === 0) return;

        const slices = sliceBoundaries.map((b, i) => ({
            startTime: b.start,
            endTime: b.end,
            reversed: perSliceSettings[i]?.reversed || false,
            pitch: perSliceSettings[i]?.pitch || 0,
        }));

        onLoadToGenerator({
            buffer,
            slices,
            name: `${name} (Sliced)`,
            rootNote: sliceRootNote,
        });
    }, [buffer, sliceBoundaries, perSliceSettings, name, sliceRootNote, onLoadToGenerator]);

    // ESC to close
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                onClose?.();
            }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [onClose]);

    // Style constants
    const bg = isDark ? '#0c0c11' : '#f7f7fa';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
    const accent = '#4dabf7';
    const mutedText = isDark ? '#666' : '#999';
    const btnOff = isDark ? 'rgba(255,255,255,0.05)' : '#e8e8ec';
    const btnBorderOff = isDark ? 'rgba(255,255,255,0.08)' : '#d5d5d9';
    const textOff = isDark ? '#888' : '#666';

    const pillBtn = (active, color = accent) => ({
        padding: '5px 12px', borderRadius: '4px', cursor: 'pointer',
        fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px',
        background: active ? `${color}25` : btnOff,
        border: `1px solid ${active ? color : btnBorderOff}`,
        color: active ? color : textOff,
        transition: 'all 0.15s',
    });

    const selectedSliceData = selectedSlice !== null ? perSliceSettings[selectedSlice] : null;

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 110,
            background: `${bg}f5`, display: 'flex', flexDirection: 'column',
            backdropFilter: 'blur(4px)',
        }}>
            {/* Header */}
            <div style={{
                height: '40px', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '10px',
                background: isDark ? 'rgba(18,18,24,0.95)' : '#eeeef2',
                borderBottom: `1px solid ${borderColor}`,
            }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: acSec }} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: acSec, letterSpacing: '0.3px' }}>
                    SLICER
                </span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: mutedText }}>
                    {name} &middot; {duration.toFixed(2)}s &middot; {sliceCount} slices
                </span>
                {globalTempo && (
                    <span style={{ fontSize: '10px', color: mutedText }}>
                        @ {globalTempo} BPM
                    </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    <button onClick={handleLoadToPianoRoll} style={{
                        ...pillBtn(true, '#22c55e'),
                        fontWeight: '900',
                    }}>
                        LOAD TO PIANO ROLL
                    </button>
                    <button onClick={onClose} style={{
                        background: btnOff, border: `1px solid ${btnBorderOff}`,
                        borderRadius: '4px', color: textOff, fontSize: '9px', fontWeight: '800',
                        padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.3px',
                    }}>
                        ESC — BACK
                    </button>
                </div>
            </div>

            {/* Waveform with slices */}
            <div
                ref={containerRef}
                style={{
                    flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0,
                    background: isDark ? '#000' : '#fff',
                    cursor: draggingBoundary !== null ? 'col-resize' : 'pointer',
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onClick={handleCanvasClick}
            >
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            </div>

            {/* Controls bar */}
            <div style={{
                minHeight: '70px', display: 'flex', alignItems: 'center',
                padding: '8px 16px', gap: '12px',
                background: isDark ? 'rgba(18,18,24,0.95)' : '#eeeef2',
                borderTop: `1px solid ${borderColor}`,
                overflowX: 'auto', flexWrap: 'nowrap',
            }}>
                {/* Slice count */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '700', color: mutedText, letterSpacing: '0.5px' }}>SLICES</span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                        {[4, 8, 16, 32].map(n => (
                            <button key={n} onClick={() => setSliceCount(n)} style={pillBtn(sliceCount === n)}>
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ width: '1px', height: '40px', background: borderColor, flexShrink: 0 }} />

                {/* Slice method */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '700', color: mutedText, letterSpacing: '0.5px' }}>METHOD</span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                        <button onClick={() => setSliceMethod('equal')} style={pillBtn(sliceMethod === 'equal')}>
                            EQUAL
                        </button>
                        <button onClick={() => setSliceMethod('transient')} style={pillBtn(sliceMethod === 'transient')}>
                            TRANSIENT
                        </button>
                    </div>
                </div>

                <div style={{ width: '1px', height: '40px', background: borderColor, flexShrink: 0 }} />

                {/* Root note */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '700', color: mutedText, letterSpacing: '0.5px' }}>ROOT NOTE</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={() => setSliceRootNote(Math.max(0, sliceRootNote - 12))} style={{
                            ...pillBtn(false), padding: '4px 8px', fontSize: '12px',
                        }}>-</button>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: accent, minWidth: '36px', textAlign: 'center' }}>
                            {midiToName(sliceRootNote)}
                        </span>
                        <button onClick={() => setSliceRootNote(Math.min(108, sliceRootNote + 12))} style={{
                            ...pillBtn(false), padding: '4px 8px', fontSize: '12px',
                        }}>+</button>
                    </div>
                </div>

                <div style={{ width: '1px', height: '40px', background: borderColor, flexShrink: 0 }} />

                {/* Per-slice controls (when a slice is selected) */}
                {selectedSlice !== null && selectedSliceData && (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '9px', fontWeight: '700', color: acSec, letterSpacing: '0.5px' }}>
                                SLICE {selectedSlice + 1} ({midiToName(sliceRootNote + selectedSlice)})
                            </span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                    onClick={() => updateSliceSetting(selectedSlice, 'reversed', !selectedSliceData.reversed)}
                                    style={pillBtn(selectedSliceData.reversed, ac)}
                                >
                                    REV {selectedSliceData.reversed ? 'ON' : 'OFF'}
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '9px', fontWeight: '700', color: mutedText }}>PITCH</span>
                                    <button onClick={() => updateSliceSetting(selectedSlice, 'pitch', Math.max(-12, selectedSliceData.pitch - 1))} style={{
                                        ...pillBtn(false), padding: '3px 7px', fontSize: '11px',
                                    }}>-</button>
                                    <span style={{ fontSize: '10px', fontWeight: '700', color: accent, minWidth: '28px', textAlign: 'center' }}>
                                        {selectedSliceData.pitch > 0 ? '+' : ''}{selectedSliceData.pitch} st
                                    </span>
                                    <button onClick={() => updateSliceSetting(selectedSlice, 'pitch', Math.min(12, selectedSliceData.pitch + 1))} style={{
                                        ...pillBtn(false), padding: '3px 7px', fontSize: '11px',
                                    }}>+</button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {selectedSlice === null && (
                    <span style={{ fontSize: '10px', color: mutedText, fontStyle: 'italic' }}>
                        Click a slice to select &amp; audition
                    </span>
                )}
            </div>
        </div>
    );
}
