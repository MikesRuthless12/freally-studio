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
    onSendToArrangement,  // ({ buffers: AudioBuffer[], names: string[], mode: 'replace'|'separate'|'joined' }) => void
    sampler,
    globalTempo, accentColors, trackId}) {
    // Use the actual track bus for playback (same path as arrangement)
    // Always use 'preview' bus for slicer — simpler audio graph, gain=1.0
    const playbackTrackId = 'preview';
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Default keyboard keys mapped to slice indices
    const DEFAULT_SLICE_KEYS = ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'];

    // Slicer state
    const [sliceCount, setSliceCount] = useState(8);
    const [sliceMethod, setSliceMethod] = useState('equal'); // 'equal' | 'transient'
    const [sliceRootNote, setSliceRootNote] = useState(48); // C3
    const [selectedSlice, setSelectedSlice] = useState(null); // last clicked slice for audition highlight
    const [selectedSlices, setSelectedSlices] = useState(new Set()); // multi-select for export
    const [perSliceSettings, setPerSliceSettings] = useState([]);
    const [playingSlice, setPlayingSlice] = useState(null);
    const [draggingBoundary, setDraggingBoundary] = useState(null);
    const [customBoundaries, setCustomBoundaries] = useState(null); // null = auto-computed
    const [selectedBoundaryIdx, setSelectedBoundaryIdx] = useState(null); // which boundary line is selected
    const [sliceKeyMap, setSliceKeyMap] = useState(() => [...DEFAULT_SLICE_KEYS]); // per-slice key assignments

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
            const isMultiSelected = selectedSlices.has(i);
            const isPlaying = playingSlice === i;

            let fillColor = SLICE_COLORS[i % SLICE_COLORS.length];
            if (isPlaying) {
                fillColor = isDark ? 'rgba(77,171,247,0.25)' : 'rgba(77,171,247,0.20)';
            } else if (isMultiSelected) {
                fillColor = isDark ? 'rgba(46,204,113,0.22)' : 'rgba(39,174,96,0.18)';
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

            // Keyboard key label
            if (sliceKeyMap[i]) {
                ctx.fillStyle = isDark ? 'rgba(77,171,247,0.6)' : 'rgba(50,120,200,0.5)';
                ctx.font = 'bold 11px monospace';
                ctx.fillText(sliceKeyMap[i].toUpperCase(), labelX, h - 8);
            }
        });

        // Draw boundary lines (dashed, selected = highlighted)
        sliceBoundaries.forEach((slice, i) => {
            if (i === 0) return; // skip first start
            const x = (slice.start / duration) * w;
            const isSelected = selectedBoundaryIdx === i;
            ctx.strokeStyle = isSelected
                ? (isDark ? '#ff6b6b' : '#e04040')
                : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)');
            ctx.setLineDash(isSelected ? [] : [4, 3]);
            ctx.lineWidth = isSelected ? 2.5 : 1;
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
    }, [buffer, sliceBoundaries, selectedSlice, selectedSlices, playingSlice, duration, isDark, sliceRootNote, selectedBoundaryIdx, sliceKeyMap]);

    // Track active preview source for clean stop
    const activePreviewRef = useRef(null);

    // Playhead position state (0-1 within the full waveform)
    const [playheadPos, setPlayheadPos] = useState(null);
    const playheadAnimRef = useRef(null);

    // Reusable slice playback function — uses sampler's AudioContext to avoid glitches
    const playSliceByIndex = useCallback(async (idx) => {
        if (idx < 0 || idx >= sliceBoundaries.length || !sampler || !buffer) return;
        const _sl = sliceBoundaries[idx];
        console.log(`[Slicer] playSlice idx=${idx}, range=${_sl.start.toFixed(3)}→${_sl.end.toFixed(3)}s (${(_sl.end - _sl.start).toFixed(3)}s), ctxState=${sampler.audioContext?.state}, _audioActive=${sampler._audioActive}, _audioClipsPlaying=${sampler._audioClipsPlaying}, hotSwapInterval=${!!sampler._resetInterval}`);
        // Context should already be running (kept alive on mount)
        if (sampler.audioContext?.state === 'suspended') {
            await sampler.audioContext.resume();
        }
        setSelectedSlice(idx);
        setPlayingSlice(idx);

        // Stop previous preview immediately but cleanly
        if (activePreviewRef.current) {
            try {
                const prev = activePreviewRef.current;
                const pCtx = prev.source?.context;
                if (pCtx && pCtx.state !== 'closed') {
                    const now = pCtx.currentTime;
                    // Immediate zero-crossing fade (3ms) — fast enough for percussion
                    if (prev.gainNode) {
                        prev.gainNode.gain.cancelScheduledValues(now);
                        prev.gainNode.gain.setValueAtTime(prev.gainNode.gain.value, now);
                        prev.gainNode.gain.linearRampToValueAtTime(0, now + 0.003);
                    }
                    prev.source.stop(now + 0.005);
                } else {
                    prev.source?.stop();
                }
            } catch (_) {}
            activePreviewRef.current = null;
        }

        const slice = sliceBoundaries[idx];
        const sliceSettings = perSliceSettings[idx] || {};
        const sliceDur = slice.end - slice.start;
        const pitchRate = Math.pow(2, (sliceSettings.pitch || 0) / 12);

        // Use SAME playback path as arrangement view: sampler.playAudioClip()
        // Play on dedicated slicer AudioContext (shared context is suspended)
        const ctx = slicerCtxRef.current;
        if (!ctx || ctx.state === 'closed') return;
        if (ctx.state === 'suspended') await ctx.resume();
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(1, ctx.currentTime);
        if (sliceSettings.reversed) {
            const sampleRate = buffer.sampleRate;
            const startFrame = Math.floor(slice.start * sampleRate);
            const endFrame = Math.floor(slice.end * sampleRate);
            const frameCount = endFrame - startFrame;
            if (frameCount > 0) {
                const subBuf = ctx.createBuffer(buffer.numberOfChannels, frameCount, sampleRate);
                for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
                    const srcData = buffer.getChannelData(ch);
                    const dst = subBuf.getChannelData(ch);
                    for (let j = 0; j < frameCount; j++) dst[j] = srcData[endFrame - 1 - j];
                }
                source.buffer = subBuf;
                source.playbackRate.value = pitchRate;
                source.start(0);
            }
        } else {
            source.buffer = buffer;
            source.playbackRate.value = pitchRate;
            source.start(0, slice.start, sliceDur);
        }
        source.onended = () => { try { source.disconnect(); gainNode.disconnect(); } catch(_){} };
        activePreviewRef.current = { source, gainNode };
        console.log(`[Slicer] Slice ${idx} playback started, result:`, activePreviewRef.current ? 'OK' : 'NULL');
        // Animate playhead across the slice
        // Animate playhead using DOM directly (no React state updates = no re-renders = no audio stutter)
        if (playheadAnimRef.current) cancelAnimationFrame(playheadAnimRef.current);
        const animStartTime = performance.now();
        const playDurMs = (sliceDur / pitchRate) * 1000;
        const animatePlayhead = () => {
            // Mimic arrangement tick loop: read audioContext.currentTime every frame
            // AND do enough work to prevent Windows from deprioritizing the process.
            // Without this, Realtek WASAPI drops audio buffers when the process is "idle".
            const ctx = sampler?.audioContext;
            if (ctx) {
                if (ctx.state !== 'running') ctx.resume();
                // Force audio clock sync — read currentTime to keep audio thread engaged
                const t = ctx.currentTime;
                // Tiny busy-work to keep process priority high (prevents OS throttling)
                let x = 0; for (let i = 0; i < 100; i++) x += Math.sin(t + i);
                void x;
            }
            const elapsed = performance.now() - animStartTime;
            const progress = Math.min(1, elapsed / playDurMs);
            const pos = (slice.start + progress * (slice.end - slice.start)) / duration;
            const el = document.getElementById('slicer-playhead');
            if (el) el.style.left = `${pos * 100}%`;
            if (progress < 1) {
                playheadAnimRef.current = requestAnimationFrame(animatePlayhead);
            } else {
                if (el) el.style.display = 'none';
                playheadAnimRef.current = null;
            }
        };
        const el = document.getElementById('slicer-playhead');
        if (el) { el.style.display = 'block'; el.style.left = '0%'; }
        playheadAnimRef.current = requestAnimationFrame(animatePlayhead);

        setTimeout(() => {
            console.log(`[Slicer] Slice ${idx} playback timeout — cleaning up`);
            setPlayingSlice(null); activePreviewRef.current = null;
        }, playDurMs + 150);
    }, [buffer, sliceBoundaries, perSliceSettings, sampler, duration]);

    // Play the entire audio clip from start to end
    const playFullClip = useCallback(async () => {
        if (!sampler || !buffer) return;
        console.log(`[Slicer] playFullClip duration=${duration?.toFixed(3)}s, bufDur=${buffer.duration?.toFixed(3)}s, ctxState=${sampler.audioContext?.state}, _audioActive=${sampler._audioActive}, _audioClipsPlaying=${sampler._audioClipsPlaying}, hotSwapInterval=${!!sampler._resetInterval}`);
        // Context should already be running (kept alive on mount)
        if (sampler.audioContext?.state === 'suspended') {
            await sampler.audioContext.resume();
        }
        // Stop previous with anti-click fade
        if (activePreviewRef.current) {
            try {
                const prev = activePreviewRef.current;
                const pCtx = prev.source?.context;
                if (pCtx && pCtx.state !== 'closed' && prev.gainNode) {
                    const now = pCtx.currentTime;
                    prev.gainNode.gain.setValueAtTime(prev.gainNode.gain.value, now);
                    prev.gainNode.gain.linearRampToValueAtTime(0, now + 0.01);
                    prev.source.stop(now + 0.02);
                } else {
                    prev.source?.stop();
                }
            } catch (_) {}
            activePreviewRef.current = null;
        }
        // Use SAME playback path as arrangement view: sampler.playAudioClip()
        // Play on dedicated slicer AudioContext
        const ctx = slicerCtxRef.current;
        if (!ctx || ctx.state === 'closed') return;
        if (ctx.state === 'suspended') await ctx.resume();
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(1, ctx.currentTime);
        source.start(0);
        source.onended = () => {
            try { source.disconnect(); gainNode.disconnect(); } catch(_){}
            setPlayingSlice(null);
        };
        activePreviewRef.current = { source, gainNode };
        setPlayingSlice(-1); // -1 = full clip

        // Animate playhead using DOM directly (no React re-renders)
        if (playheadAnimRef.current) cancelAnimationFrame(playheadAnimRef.current);
        const animStartTime = performance.now();
        const playDurMs = duration * 1000;
        const animatePlayhead = () => {
            const ctx = sampler?.audioContext;
            if (ctx) {
                if (ctx.state !== 'running') ctx.resume();
                const t = ctx.currentTime;
                let x = 0; for (let i = 0; i < 100; i++) x += Math.sin(t + i);
                void x;
            }
            const elapsed = performance.now() - animStartTime;
            const progress = Math.min(1, elapsed / playDurMs);
            const el = document.getElementById('slicer-playhead');
            if (el) el.style.left = `${progress * 100}%`;
            if (progress < 1) {
                playheadAnimRef.current = requestAnimationFrame(animatePlayhead);
            } else {
                if (el) el.style.display = 'none';
                playheadAnimRef.current = null;
            }
        };
        const phEl = document.getElementById('slicer-playhead');
        if (phEl) { phEl.style.display = 'block'; phEl.style.left = '0%'; }
        playheadAnimRef.current = requestAnimationFrame(animatePlayhead);
        setTimeout(() => {
            setPlayingSlice(null); activePreviewRef.current = null;
            // Release AudioContext after playback finishes
            if (window.__samplerRef?.setAudioActive) window.__samplerRef.setAudioActive(false);
            if (window.__samplerRef?._scheduleIdleSuspend) window.__samplerRef._scheduleIdleSuspend();
        }, playDurMs + 150);
    }, [buffer, sampler, duration]);

    // Click waveform to audition slice; Ctrl+click to toggle multi-select
    const handleCanvasClick = useCallback((e) => {
        if (!buffer || !containerRef.current || draggingBoundary !== null) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * duration;

        const idx = sliceBoundaries.findIndex(s => time >= s.start && time < s.end);
        if (idx === -1) return;

        if (e.ctrlKey || e.metaKey) {
            // Toggle multi-select
            setSelectedSlices(prev => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx);
                else next.add(idx);
                return next;
            });
        } else {
            setSelectedSlices(new Set([idx]));
        }
        playSliceByIndex(idx);
    }, [buffer, duration, sliceBoundaries, perSliceSettings, sampler, draggingBoundary, playSliceByIndex]);

    // Drag boundary handlers + select boundary on click
    const handleCanvasMouseDown = useCallback((e) => {
        if (!containerRef.current || !buffer) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * duration;
        const threshold = duration * 0.015; // 1.5% of duration as grab zone

        // Check if near a boundary (skip first=0 and last=duration)
        for (let i = 1; i < sliceBoundaries.length; i++) {
            if (Math.abs(sliceBoundaries[i].start - time) < threshold) {
                if (e.button === 0) {
                    // Left-click: select + start drag
                    setSelectedBoundaryIdx(i);
                    setDraggingBoundary(i);
                    e.preventDefault();
                }
                return;
            }
        }
        // Clicked away from any boundary — deselect
        setSelectedBoundaryIdx(null);
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

    // Double-click waveform to add a new slice point
    const handleCanvasDoubleClick = useCallback((e) => {
        if (!containerRef.current || !buffer) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * duration;
        if (time < 0.02 || time > duration - 0.02) return; // too close to edges

        // Prompt for a key assignment
        const usedKeys = sliceKeyMap.filter(Boolean);
        const newKey = window.prompt(
            `Assign a keyboard key for this slice point.\nAlready used: ${usedKeys.map(k => k.toUpperCase()).join(', ')}`,
            ''
        );
        if (!newKey || newKey.length !== 1) return;
        const keyLower = newKey.toLowerCase();
        if (usedKeys.includes(keyLower)) {
            window.alert(`Key "${newKey.toUpperCase()}" is already assigned to another slice.`);
            return;
        }

        // Find which existing slice this time falls into and split it
        setCustomBoundaries(prev => {
            const bounds = prev || [...sliceBoundaries];
            const splitIdx = bounds.findIndex(s => time > s.start && time < s.end);
            if (splitIdx === -1) return bounds;
            const original = bounds[splitIdx];
            const newBounds = [...bounds];
            newBounds.splice(splitIdx, 1,
                { start: original.start, end: time },
                { start: time, end: original.end }
            );
            return newBounds;
        });

        // Update slice count and key map
        setSliceCount(prev => prev + 1);
        setSliceKeyMap(prev => {
            const splitIdx = sliceBoundaries.findIndex(s => time > s.start && time < s.end);
            const newMap = [...prev];
            // Insert the new key after the split slice
            newMap.splice(splitIdx + 1, 0, keyLower);
            return newMap;
        });
        setPerSliceSettings(prev => {
            const splitIdx = sliceBoundaries.findIndex(s => time > s.start && time < s.end);
            const newSettings = [...prev];
            newSettings.splice(splitIdx + 1, 0, { reversed: false, pitch: 0 });
            return newSettings;
        });
    }, [buffer, duration, sliceBoundaries, sliceKeyMap]);

    // Right-click on a boundary line to remove that slice point
    const handleCanvasContextMenu = useCallback((e) => {
        e.preventDefault();
        if (!containerRef.current || !buffer) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * duration;
        const threshold = duration * 0.015;

        // Find nearest boundary (skip first=0 and last=duration)
        let nearIdx = -1;
        for (let i = 1; i < sliceBoundaries.length; i++) {
            if (Math.abs(sliceBoundaries[i].start - time) < threshold) {
                nearIdx = i;
                break;
            }
        }
        if (nearIdx === -1) return;
        if (sliceBoundaries.length <= 2) return; // need at least 2 slices

        // Merge slice[nearIdx-1] and slice[nearIdx] by removing boundary
        setCustomBoundaries(prev => {
            const bounds = prev || [...sliceBoundaries];
            const newBounds = [...bounds];
            const merged = { start: newBounds[nearIdx - 1].start, end: newBounds[nearIdx].end };
            newBounds.splice(nearIdx - 1, 2, merged);
            return newBounds;
        });
        setSliceCount(prev => Math.max(1, prev - 1));
        setSliceKeyMap(prev => {
            const newMap = [...prev];
            newMap.splice(nearIdx, 1);
            return newMap;
        });
        setPerSliceSettings(prev => {
            const newSettings = [...prev];
            newSettings.splice(nearIdx, 1);
            return newSettings;
        });
        setSelectedBoundaryIdx(null);
    }, [buffer, duration, sliceBoundaries]);

    // Create an AudioBuffer from a slice range, optionally reversed
    const createSliceBuffer = useCallback((slice, reversed = false) => {
        if (!buffer) return null;
        const sr = buffer.sampleRate;
        const startFrame = Math.floor(slice.start * sr);
        const endFrame = Math.min(Math.floor(slice.end * sr), buffer.length);
        const frameCount = endFrame - startFrame;
        if (frameCount <= 0) return null;
        const ctx = new OfflineAudioContext(buffer.numberOfChannels, frameCount, sr);
        const subBuf = ctx.createBuffer(buffer.numberOfChannels, frameCount, sr);
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const src = buffer.getChannelData(ch);
            const dst = subBuf.getChannelData(ch);
            for (let j = 0; j < frameCount; j++) {
                dst[j] = reversed ? src[endFrame - 1 - j] : src[startFrame + j];
            }
        }
        return subBuf;
    }, [buffer]);

    // Send selected slices to arrangement
    const handleSendToArrangement = useCallback((mode) => {
        // mode: 'replace' (single/joined), 'separate'
        if (!onSendToArrangement || !buffer || selectedSlices.size === 0) return;
        const indices = [...selectedSlices].sort((a, b) => a - b);

        if (mode === 'joined' || (mode === 'replace' && indices.length === 1)) {
            // Join all selected slices into one continuous buffer
            const sr = buffer.sampleRate;
            let totalFrames = 0;
            const sliceBuffers = indices.map(i => {
                const slice = sliceBoundaries[i];
                const settings = perSliceSettings[i] || {};
                const buf = createSliceBuffer(slice, settings.reversed);
                if (buf) totalFrames += buf.length;
                return buf;
            }).filter(Boolean);
            if (sliceBuffers.length === 0) return;
            const ctx = new OfflineAudioContext(buffer.numberOfChannels, totalFrames, sr);
            const joined = ctx.createBuffer(buffer.numberOfChannels, totalFrames, sr);
            let offset = 0;
            for (const sb of sliceBuffers) {
                for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
                    joined.getChannelData(ch).set(sb.getChannelData(ch), offset);
                }
                offset += sb.length;
            }
            const sliceNames = indices.map(i => `${name} [${i + 1}]`).join('+');
            onSendToArrangement({ buffers: [joined], names: [sliceNames], mode: 'replace' });
        } else {
            // Separate: each slice as its own clip
            const buffers = [];
            const names = [];
            for (const i of indices) {
                const slice = sliceBoundaries[i];
                const settings = perSliceSettings[i] || {};
                const buf = createSliceBuffer(slice, settings.reversed);
                if (buf) {
                    buffers.push(buf);
                    names.push(`${name} [${i + 1}]`);
                }
            }
            if (buffers.length > 0) {
                onSendToArrangement({ buffers, names, mode: 'separate' });
            }
        }
    }, [buffer, selectedSlices, sliceBoundaries, perSliceSettings, name, onSendToArrangement, createSliceBuffer]);

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

    // Stop any active playback
    const stopPlayback = useCallback(() => {
        console.log(`[Slicer] stopPlayback called, hasActivePreview=${!!activePreviewRef.current}`);
        // Use AudioEngine.stop() for clean stop (same as browser preview)
        if (window.audioEngine?.isPlaying) {
            window.audioEngine.stop();
        }
        if (activePreviewRef.current?._stopTimer) {
            clearTimeout(activePreviewRef.current._stopTimer);
        }
        if (activePreviewRef.current) {
            try {
                const prev = activePreviewRef.current;
                const pCtx = prev.source?.context;
                if (pCtx && pCtx.state !== 'closed' && prev.gainNode) {
                    const now = pCtx.currentTime;
                    prev.gainNode.gain.setValueAtTime(prev.gainNode.gain.value, now);
                    prev.gainNode.gain.linearRampToValueAtTime(0, now + 0.01);
                    prev.source.stop(now + 0.02);
                } else {
                    prev.source?.stop();
                }
            } catch (_) {}
            activePreviewRef.current = null;
        }
        if (playheadAnimRef.current) {
            cancelAnimationFrame(playheadAnimRef.current);
            playheadAnimRef.current = null;
        }
        setPlayheadPos(null);
        setPlayingSlice(null);
    }, []);

    // Dedicated AudioContext for slicer — suspend the shared one to prevent interference
    const slicerCtxRef = useRef(null);
    useEffect(() => {
        const s = window.__samplerRef;
        // Suspend the shared context so it doesn't interfere
        if (s?.audioContext?.state === 'running') {
            s.audioContext.suspend().catch(() => {});
        }
        // Create a fresh, dedicated context
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx({ latencyHint: 'interactive', sampleRate: 48000 });
        slicerCtxRef.current = ctx;
        console.log('[Slicer] Mounted — dedicated AudioContext created, state:', ctx.state);
        return () => {
            stopPlayback();
            // Close dedicated context
            if (slicerCtxRef.current) {
                slicerCtxRef.current.close().catch(() => {});
                slicerCtxRef.current = null;
            }
            // Resume the shared context
            if (s?.audioContext?.state === 'suspended') {
                s.audioContext.resume().catch(() => {});
            }
            console.log('[Slicer] Unmounted — dedicated AudioContext closed');
        };
    }, [stopPlayback]);

    // Keyboard: ESC to close, Space to toggle play all, mapped keys to play slices, Delete to remove boundary
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                onClose?.();
                return;
            }
            // Delete key: remove the selected boundary line
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBoundaryIdx !== null && selectedBoundaryIdx > 0 && selectedBoundaryIdx < sliceBoundaries.length) {
                e.preventDefault();
                e.stopPropagation();
                if (sliceBoundaries.length <= 2) return;
                const idx = selectedBoundaryIdx;
                setCustomBoundaries(prev => {
                    const bounds = prev || [...sliceBoundaries];
                    const newBounds = [...bounds];
                    const merged = { start: newBounds[idx - 1].start, end: newBounds[idx].end };
                    newBounds.splice(idx - 1, 2, merged);
                    return newBounds;
                });
                setSliceCount(prev => Math.max(1, prev - 1));
                setSliceKeyMap(prev => { const m = [...prev]; m.splice(idx, 1); return m; });
                setPerSliceSettings(prev => { const s = [...prev]; s.splice(idx, 1); return s; });
                setSelectedBoundaryIdx(null);
                return;
            }
            // Spacebar: toggle Play All / Stop in slicer (prevent global transport)
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (activePreviewRef.current) {
                    stopPlayback();
                    setPlayingSlice(null);
                } else {
                    playFullClip();
                }
                return;
            }
            // Map keys to slice indices
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const keyIdx = sliceKeyMap.indexOf(e.key.toLowerCase());
                if (keyIdx !== -1 && keyIdx < sliceBoundaries.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    playSliceByIndex(keyIdx);
                }
            }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [onClose, sliceBoundaries, sliceKeyMap, playSliceByIndex, playFullClip, stopPlayback, selectedBoundaryIdx]);

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
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {onSendToArrangement && selectedSlices.size > 0 && (
                        <>
                            <span style={{ fontSize: '9px', color: mutedText }}>{selectedSlices.size} selected</span>
                            <button onClick={() => handleSendToArrangement(selectedSlices.size === 1 ? 'replace' : 'joined')} style={{
                                ...pillBtn(true, acSec),
                                fontWeight: '900',
                            }}>
                                {selectedSlices.size === 1 ? 'USE AS CLIP' : 'JOIN AS ONE CLIP'}
                            </button>
                            {selectedSlices.size > 1 && (
                                <button onClick={() => handleSendToArrangement('separate')} style={{
                                    ...pillBtn(true, accent),
                                    fontWeight: '900',
                                }}>
                                    SEPARATE CLIPS
                                </button>
                            )}
                        </>
                    )}
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
                onDoubleClick={handleCanvasDoubleClick}
                onContextMenu={handleCanvasContextMenu}
            >
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                {/* Playhead line */}
                <div id="slicer-playhead" style={{
                    position: 'absolute', left: '0%', top: 0,
                    width: '2px', height: '100%',
                    background: '#fff', zIndex: 10, pointerEvents: 'none',
                    boxShadow: '0 0 6px rgba(255,255,255,0.5)',
                    display: 'none'
                }} />
            </div>

            {/* Controls bar */}
            <div style={{
                minHeight: '70px', display: 'flex', alignItems: 'center',
                padding: '8px 16px', gap: '12px',
                background: isDark ? 'rgba(18,18,24,0.95)' : '#eeeef2',
                borderTop: `1px solid ${borderColor}`,
                overflowX: 'auto', flexWrap: 'nowrap',
            }}>
                {/* Play full clip button */}
                <button
                    onClick={() => {
                        if (activePreviewRef.current) {
                            stopPlayback();
                            setPlayingSlice(null);
                        } else {
                            playFullClip();
                        }
                    }}
                    style={{
                        ...pillBtn(playingSlice === -1, '#22c55e'),
                        fontWeight: '900', padding: '6px 14px',
                        display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                >
                    {playingSlice === -1 ? '⏹ STOP' : '▶ PLAY'}
                </button>

                <div style={{ width: '1px', height: '40px', background: borderColor, flexShrink: 0 }} />

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
