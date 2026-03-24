import React, { useRef, useEffect, useState, useCallback } from 'react';
import { detectTransients } from './TransientDetector';
import { hexToRgba } from './accentThemes';

/**
 * Universal Waveform Visualizer
 * Supports audio buffers, MIDI patterns, beat grid overlay,
 * transient markers, loop regions (draggable), and a smooth playhead.
 *
 * The waveform + static overlays are drawn on a cached canvas so only
 * the playhead needs to be updated every frame.
 */
const WaveformVisualizer = ({
    audioBuffer = null,
    midiPattern = null,
    width = 200,
    height = 60,
    color = '#39ff14',
    backgroundColor = 'transparent',
    // Playback
    showPlayhead = false,
    playheadPosition = 0,       // normalised 0-1
    playbackPosition,           // alias (takes precedence when defined)
    // Beat grid
    tempo = 0,
    showBeatGrid = false,
    // Transients
    showTransients = false,
    // Loop region
    showLoopRegion = false,
    loopStart = 0,              // normalised 0-1
    loopEnd = 1,                // normalised 0-1
    onLoopChange = null,
    // Analysis badges
    detectedBPM = null,
    detectedKey = null,
    // Misc
    onClick = null,
    theme = 'dark', accentColors}) => {
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const staticCanvasRef = useRef(null);   // waveform + overlays
    const overlayCanvasRef = useRef(null);  // playhead (redrawn per frame)
    const [hoverX, setHoverX] = useState(null);
    const transientCacheRef = useRef(null);
    const transientBufferRef = useRef(null);

    // Loop drag state
    const [dragHandle, setDragHandle] = useState(null); // 'start' | 'end' | null
    const [localLoopStart, setLocalLoopStart] = useState(loopStart);
    const [localLoopEnd, setLocalLoopEnd] = useState(loopEnd);

    // Keep local loop in sync with props (when not dragging)
    useEffect(() => {
        if (!dragHandle) {
            setLocalLoopStart(loopStart);
            setLocalLoopEnd(loopEnd);
        }
    }, [loopStart, loopEnd, dragHandle]);

    const isDark = theme === 'dark';

    // Resolve playback position (prefer explicit prop)
    const resolvedPlayhead = playbackPosition !== undefined ? playbackPosition : playheadPosition;
    const shouldShowPlayhead = showPlayhead || playbackPosition !== undefined;

    // ------- Transient detection (memoised on buffer) -------
    useEffect(() => {
        if (!showTransients || !audioBuffer || typeof audioBuffer.getChannelData !== 'function') {
            transientCacheRef.current = null;
            transientBufferRef.current = null;
            return;
        }
        if (transientBufferRef.current === audioBuffer) return; // already cached
        transientBufferRef.current = audioBuffer;
        transientCacheRef.current = detectTransients(audioBuffer, 0.5);
    }, [audioBuffer, showTransients]);

    // ======================================================
    //  Static canvas: waveform + beat grid + transients + loop
    // ======================================================
    useEffect(() => {
        const canvas = staticCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        // Clear
        if (backgroundColor === 'transparent') {
            ctx.clearRect(0, 0, width, height);
        } else {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }

        // ---- Loop region shading (draw first so waveform sits on top) ----
        if (showLoopRegion && audioBuffer && (localLoopStart > 0 || localLoopEnd < 1)) {
            // Dim outside loop
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.15)';
            if (localLoopStart > 0) {
                ctx.fillRect(0, 0, localLoopStart * width, height);
            }
            if (localLoopEnd < 1) {
                ctx.fillRect(localLoopEnd * width, 0, (1 - localLoopEnd) * width, height);
            }
            // Active region highlight
            const lx = localLoopStart * width;
            const lw = (localLoopEnd - localLoopStart) * width;
            ctx.fillStyle = 'rgba(57, 255, 20, 0.06)';
            ctx.fillRect(lx, 0, lw, height);
        }

        // ---- Beat grid ----
        if (showBeatGrid && tempo > 0 && audioBuffer && typeof audioBuffer.getChannelData === 'function') {
            const duration = audioBuffer.duration;
            const beatInterval = 60 / tempo;          // seconds per beat
            const totalBeats = Math.floor(duration / beatInterval);

            for (let b = 0; b <= totalBeats; b++) {
                const t = b * beatInterval;
                const x = (t / duration) * width;
                const isDownbeat = b % 4 === 0;

                ctx.strokeStyle = isDownbeat
                    ? hexToRgba(ac, 0.30)
                    : hexToRgba(ac, 0.15);
                ctx.lineWidth = isDownbeat ? 1.5 : 0.75;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        }

        // ---- Waveform / MIDI ----
        if (audioBuffer && typeof audioBuffer.getChannelData === 'function') {
            drawAudioWaveform(ctx, audioBuffer, width, height, color);
        } else if (midiPattern) {
            drawMidiPattern(ctx, midiPattern, width, height, color, isDark);
        } else {
            drawEmptyState(ctx, width, height, isDark);
        }

        // ---- Transient markers ----
        if (showTransients && transientCacheRef.current && audioBuffer) {
            const duration = audioBuffer.duration;
            const transients = transientCacheRef.current;
            const triH = 6;
            ctx.fillStyle = '#ffaa00';
            transients.forEach(t => {
                const x = (t / duration) * width;
                // Small inverted triangle above center-line
                ctx.beginPath();
                ctx.moveTo(x, 1);
                ctx.lineTo(x - 3, 1 + triH);
                ctx.lineTo(x + 3, 1 + triH);
                ctx.closePath();
                ctx.fill();
            });
        }

        // ---- Loop region handles ----
        if (showLoopRegion && audioBuffer && (localLoopStart > 0 || localLoopEnd < 1)) {
            const drawHandle = (xPos, col) => {
                ctx.fillStyle = col;
                ctx.fillRect(xPos - 2, 0, 4, height);
                // Small grip triangle
                ctx.beginPath();
                ctx.moveTo(xPos, height / 2 - 6);
                ctx.lineTo(xPos + 5, height / 2);
                ctx.lineTo(xPos, height / 2 + 6);
                ctx.closePath();
                ctx.fill();
            };
            drawHandle(localLoopStart * width, '#39ff14');
            drawHandle(localLoopEnd * width, '#39ff14');
        }

        // ---- Analysis badges ----
        if (detectedBPM || detectedKey) {
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            let badge = '';
            if (detectedBPM) badge += `${Math.round(detectedBPM)} BPM`;
            if (detectedBPM && detectedKey) badge += '  ';
            if (detectedKey) badge += detectedKey;

            const pad = 3;
            const tw = ctx.measureText(badge).width;
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
            ctx.fillRect(width - tw - pad * 2 - 2, 2, tw + pad * 2, 14);
            ctx.fillStyle = isDark ? '#ccc' : '#333';
            ctx.fillText(badge, width - pad - 2, pad + 1);
        }

        // ---- Hover indicator ----
        if (hoverX !== null) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hoverX, 0);
            ctx.lineTo(hoverX, height);
            ctx.stroke();
        }

    }, [audioBuffer, midiPattern, width, height, color, backgroundColor, isDark,
        showBeatGrid, tempo, showTransients, showLoopRegion,
        localLoopStart, localLoopEnd, detectedBPM, detectedKey, hoverX]);

    // ======================================================
    //  Overlay canvas: smooth playhead via rAF
    // ======================================================
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    }, [width, height]);

    useEffect(() => {
        if (!shouldShowPlayhead) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        let raf;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const pos = resolvedPlayhead;
            if (pos >= 0 && pos <= 1) {
                const x = pos * width * dpr;
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 2 * dpr;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height * dpr);
                ctx.stroke();
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [shouldShowPlayhead, resolvedPlayhead, width, height]);

    // ------- Drawing helpers (same logic as original) -------

    const drawAudioWaveform = (ctx, buffer, w, h, col) => {
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / w);
        const amp = h / 2;

        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < w; i++) {
            let min = 1.0;
            let max = -1.0;

            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }

            const yMin = (1 + min) * amp;
            const yMax = (1 + max) * amp;

            if (i === 0) {
                ctx.moveTo(i, yMin);
            }

            ctx.lineTo(i, yMin);
            ctx.lineTo(i, yMax);
        }

        ctx.stroke();
    };

    const drawMidiPattern = (ctx, pattern, w, h, col, dark) => {
        if (!pattern || pattern.length === 0) {
            drawEmptyState(ctx, w, h, dark);
            return;
        }

        let minNote = 127;
        let maxNote = 0;

        pattern.forEach(note => {
            const noteNum = typeof note.note === 'number' ? note.note : note.notes?.[0] || 60;
            if (noteNum < minNote) minNote = noteNum;
            if (noteNum > maxNote) maxNote = noteNum;
        });

        const noteRange = maxNote - minNote || 12;
        const padding = 5;

        ctx.fillStyle = col;

        pattern.forEach(note => {
            const noteNum = typeof note.note === 'number' ? note.note : note.notes?.[0] || 60;
            const startStep = note.startStep || note.step || 0;
            const duration = note.duration || 1;
            const velocity = note.velocity || 0.8;

            const totalSteps = Math.max(...pattern.map(n => (n.startStep || n.step || 0) + (n.duration || 1)));
            const x = (startStep / totalSteps) * w;
            const noteWidth = (duration / totalSteps) * w;
            const y = padding + ((maxNote - noteNum) / noteRange) * (h - padding * 2);
            const noteHeight = Math.max(2, (h - padding * 2) / noteRange);

            ctx.globalAlpha = velocity;
            ctx.fillRect(x, y, Math.max(noteWidth, 2), noteHeight);
            ctx.globalAlpha = 1.0;
        });
    };

    const drawEmptyState = (ctx, w, h, dark) => {
        ctx.strokeStyle = dark ? '#333' : '#ddd';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = dark ? '#666' : '#999';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No waveform', w / 2, h / 2 + 4);
    };

    // ------- Interaction handlers -------

    const handleMouseMove = useCallback((e) => {
        const rect = staticCanvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;

        if (dragHandle && onLoopChange) {
            const norm = Math.max(0, Math.min(1, x / width));
            if (dragHandle === 'start') {
                const ns = Math.min(norm, localLoopEnd - 0.01);
                setLocalLoopStart(ns);
            } else {
                const ne = Math.max(norm, localLoopStart + 0.01);
                setLocalLoopEnd(ne);
            }
        } else {
            setHoverX(x);
        }
    }, [dragHandle, localLoopStart, localLoopEnd, onLoopChange, width]);

    const handleMouseDown = useCallback((e) => {
        if (!showLoopRegion || !onLoopChange || !audioBuffer) return;
        const rect = staticCanvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const norm = x / width;
        const handleThreshold = 8 / width; // 8px grab zone

        if (Math.abs(norm - localLoopStart) < handleThreshold) {
            setDragHandle('start');
            e.preventDefault();
        } else if (Math.abs(norm - localLoopEnd) < handleThreshold) {
            setDragHandle('end');
            e.preventDefault();
        }
    }, [showLoopRegion, onLoopChange, audioBuffer, localLoopStart, localLoopEnd, width]);

    const handleMouseUp = useCallback(() => {
        if (dragHandle && onLoopChange) {
            onLoopChange(localLoopStart, localLoopEnd);
        }
        setDragHandle(null);
    }, [dragHandle, onLoopChange, localLoopStart, localLoopEnd]);

    const handleMouseLeave = useCallback(() => {
        setHoverX(null);
        if (dragHandle) {
            if (onLoopChange) onLoopChange(localLoopStart, localLoopEnd);
            setDragHandle(null);
        }
    }, [dragHandle, onLoopChange, localLoopStart, localLoopEnd]);

    const handleClick = useCallback((e) => {
        if (dragHandle) return; // don't fire click after drag
        if (!onClick) return;
        const rect = staticCanvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        onClick(x / width);
    }, [onClick, width, dragHandle]);

    // Determine cursor
    let cursor = onClick ? 'pointer' : 'default';
    if (dragHandle) cursor = 'ew-resize';
    else if (showLoopRegion && onLoopChange && hoverX !== null) {
        const norm = hoverX / width;
        const handleThreshold = 8 / width;
        if (Math.abs(norm - localLoopStart) < handleThreshold || Math.abs(norm - localLoopEnd) < handleThreshold) {
            cursor = 'ew-resize';
        }
    }

    return (
        <div style={{ position: 'relative', width: `${width}px`, height: `${height}px`, display: 'inline-block' }}>
            <canvas
                ref={staticCanvasRef}
                style={{ position: 'absolute', top: 0, left: 0, display: 'block' }}
            />
            <canvas
                ref={overlayCanvasRef}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                style={{
                    position: 'absolute', top: 0, left: 0,
                    cursor,
                    display: 'block'
                }}
            />
        </div>
    );
};

export default WaveformVisualizer;
