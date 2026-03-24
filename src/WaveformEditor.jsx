import React, { useRef, useEffect, useState, useCallback } from 'react';
import SampleSlicerEditor from './SampleSlicerEditor.jsx';
import { hexToRgba } from './accentThemes';
import { interpolateAutomation, addAutomationPoint, removeAutomationPoint, moveAutomationPoint } from './automationUtils';

/**
 * WaveformEditor — full-screen overlay for editing an audio clip.
 * Opened by double-clicking an audio clip in the arrangement.
 *
 * Features: reverse, pitch shift, fade in/out, trim, rename,
 *           per-clip time-stretch, sample slicer.
 * Theme: orange/yellow + black (dark mode), warm tones (light mode).
 */
export default function WaveformEditor({
    clip, trackName, sectionName, isDark, onClose, onUpdate,
    globalTempo, sampler, onLoadSlicedInstrument, accentColors,
    trackAutomation, onSetTrackAutomation, trackId, tempo}) {
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [clipName, setClipName] = useState(clip.name || 'Audio Clip');
    const [reversed, setReversed] = useState(clip.reversed || false);
    const [pitch, setPitch] = useState(clip.pitch || 0); // semitones: -12 to +12
    const [fadeIn, setFadeIn] = useState(clip.fadeIn || 0); // seconds
    const [fadeOut, setFadeOut] = useState(clip.fadeOut || 0); // seconds
    const [trimStart, setTrimStart] = useState(clip.trimStart || 0);
    const [trimEnd, setTrimEnd] = useState(clip.trimEnd || 0);
    const [fadeInCurve, setFadeInCurve] = useState(clip.fadeInCurve ?? 0.5); // 0-1, vertical curve midpoint
    const [fadeOutCurve, setFadeOutCurve] = useState(clip.fadeOutCurve ?? 0.5);

    // Time-stretch per-clip state
    const [timeStretch, setTimeStretch] = useState(clip.timeStretch || false);
    const [originalBpm, setOriginalBpm] = useState(() => {
        if (clip.originalBpm) return clip.originalBpm;
        // Auto-detect from filename
        const match = clip.name?.match(/(\d{2,3})\s*(?:BPM|bpm)/i);
        return match ? parseInt(match[1]) : null;
    });
    const [bpmInput, setBpmInput] = useState(originalBpm ? String(originalBpm) : '');

    // Slicer state
    const [showSlicer, setShowSlicer] = useState(false);

    // Automation overlay state
    const [automationParam, setAutomationParam] = useState('volume');
    const [draggingPointIdx, setDraggingPointIdx] = useState(null);
    const automationSvgRef = useRef(null);

    const buffer = clip.buffer;
    const duration = buffer ? buffer.duration : 0;

    // Orange/yellow accent palette
    const accentColor = isDark ? acSec : '#e8870f';
    const accentRgb = '255,159,67';
    const bg = isDark ? '#0a0a0f' : '#faf8f5';
    const headerBg = isDark ? 'rgba(14,12,10,0.97)' : '#f5f0ea';
    const borderColor = isDark ? 'rgba(255,159,67,0.12)' : 'rgba(200,160,80,0.2)';
    const waveColor = isDark ? acSec : '#d4841a';
    const mutedText = isDark ? '#777' : '#998870';
    const btnOff = isDark ? 'rgba(255,255,255,0.04)' : '#ece6de';
    const btnBorderOff = isDark ? 'rgba(255,159,67,0.15)' : 'rgba(200,160,80,0.25)';

    // Stretch ratio calculation
    const stretchRatio = (timeStretch && originalBpm && globalTempo) ? (globalTempo / originalBpm) : null;
    const stretchPercent = stretchRatio ? Math.abs((stretchRatio - 1) * 100) : 0;
    const stretchColor = stretchPercent < 10 ? '#22c55e' : stretchPercent < 20 ? acSec : ac;

    // Apply changes back to parent
    const applyChanges = useCallback(() => {
        if (!onUpdate) return;
        onUpdate({
            name: clipName,
            reversed,
            pitch,
            playbackRate: Math.pow(2, pitch / 12),
            fadeIn,
            fadeOut,
            fadeInCurve,
            fadeOutCurve,
            trimStart,
            trimEnd,
            timeStretch,
            originalBpm
        });
    }, [clipName, reversed, pitch, fadeIn, fadeOut, fadeInCurve, fadeOutCurve, trimStart, trimEnd, timeStretch, originalBpm, onUpdate]);

    // Auto-apply on change
    useEffect(() => { applyChanges(); }, [applyChanges]);

    // Draw waveform
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
        const sampleRate = buffer.sampleRate;
        const totalSamples = channelData.length;
        const startSample = Math.floor(trimStart * sampleRate);
        const endSample = Math.max(startSample + 1, totalSamples - Math.floor(trimEnd * sampleRate));
        const activeSamples = endSample - startSample;

        if (activeSamples <= 0) return;

        // Draw trimmed regions (darker)
        const trimStartPx = (trimStart / duration) * w;
        const trimEndPx = (trimEnd / duration) * w;
        if (trimStartPx > 0) {
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)';
            ctx.fillRect(0, 0, trimStartPx, h);
        }
        if (trimEndPx > 0) {
            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)';
            ctx.fillRect(w - trimEndPx, 0, trimEndPx, h);
        }

        // Draw fade regions (warm orange tint)
        if (fadeIn > 0) {
            const fadePx = (fadeIn / duration) * w;
            const grad = ctx.createLinearGradient(trimStartPx, 0, trimStartPx + fadePx, 0);
            grad.addColorStop(0, isDark ? 'rgba(255,159,67,0.25)' : 'rgba(230,150,40,0.15)');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(trimStartPx, 0, fadePx, h);
        }
        if (fadeOut > 0) {
            const fadePx = (fadeOut / duration) * w;
            const fadeStart = w - trimEndPx - fadePx;
            const grad = ctx.createLinearGradient(fadeStart, 0, fadeStart + fadePx, 0);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, isDark ? 'rgba(255,159,67,0.25)' : 'rgba(230,150,40,0.15)');
            ctx.fillStyle = grad;
            ctx.fillRect(fadeStart, 0, fadePx, h);
        }

        // Draw waveform (orange)
        const samplesPerPixel = totalSamples / w;
        const mid = h / 2;
        ctx.fillStyle = waveColor;

        for (let px = 0; px < w; px++) {
            const sampleStart = Math.floor(px * samplesPerPixel);
            const sampleEnd = Math.min(Math.floor((px + 1) * samplesPerPixel), totalSamples);
            let max = 0;
            for (let i = sampleStart; i < sampleEnd; i++) {
                const idx = reversed ? (totalSamples - 1 - i) : i;
                const abs = Math.abs(channelData[idx] || 0);
                if (abs > max) max = abs;
            }
            const barH = max * mid * 0.9;
            if (barH < 0.5) continue;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(px, mid - barH, 1, barH * 2);
        }
        ctx.globalAlpha = 1;

        // Center line
        ctx.strokeStyle = isDark ? 'rgba(255,159,67,0.08)' : 'rgba(200,150,50,0.12)';
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
    }, [buffer, reversed, trimStart, trimEnd, fadeIn, fadeOut, duration, isDark, waveColor]);

    // Keyboard: ESC to close (capture phase so it fires before arrangement handler)
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (showSlicer) {
                    setShowSlicer(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [onClose, showSlicer]);

    const sliderStyleId = 'waveform-editor-slider-styles';
    useEffect(() => {
        if (document.getElementById(sliderStyleId)) return;
        const style = document.createElement('style');
        style.id = sliderStyleId;
        style.textContent = `
            .wf-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 3px; outline: none; cursor: pointer; }
            .wf-slider::-webkit-slider-track { height: 6px; border-radius: 3px; }
            .wf-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; cursor: grab; border: 2px solid ${acSec}; transition: box-shadow 0.15s, transform 0.15s; }
            .wf-slider::-webkit-slider-thumb:hover { transform: scale(1.2); box-shadow: 0 0 8px rgba(255,159,67,0.5); }
            .wf-slider::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.1); box-shadow: 0 0 12px rgba(255,159,67,0.7); }
            .wf-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; cursor: grab; border: 2px solid ${acSec}; transition: box-shadow 0.15s, transform 0.15s; }
            .wf-slider::-moz-range-thumb:hover { transform: scale(1.2); box-shadow: 0 0 8px rgba(255,159,67,0.5); }
            .wf-slider::-moz-range-track { height: 6px; border-radius: 3px; border: none; }
            .wf-slider.dark-slider { background: rgba(255,159,67,0.12); }
            .wf-slider.dark-slider::-webkit-slider-thumb { background: ${acSec}; }
            .wf-slider.dark-slider::-moz-range-thumb { background: ${acSec}; }
            .wf-slider.dark-slider::-moz-range-track { background: rgba(255,159,67,0.12); }
            .wf-slider.light-slider { background: rgba(200,150,50,0.15); }
            .wf-slider.light-slider::-webkit-slider-thumb { background: #e8870f; border-color: #e8870f; }
            .wf-slider.light-slider::-moz-range-thumb { background: #e8870f; border-color: #e8870f; }
            .wf-slider.light-slider::-moz-range-track { background: rgba(200,150,50,0.15); }
        `;
        document.head.appendChild(style);
    }, []);

    const pillBtn = (active, color = accentColor) => ({
        padding: `6px 14px`, borderRadius: '4px', cursor: 'pointer',
        fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px',
        background: active ? (isDark ? `${color}20` : `${color}18`) : btnOff,
        border: `1px solid ${active ? color : btnBorderOff}`,
        color: active ? color : mutedText,
        transition: 'all 0.15s',
    });

    const SliderControl = ({ label, value, min, max, step, unit, onChange }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: '700', color: mutedText, letterSpacing: '0.5px' }}>{label}</span>
                <span style={{ fontSize: '9px', fontWeight: '600', color: accentColor }}>{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}{unit || ''}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className={`wf-slider ${isDark ? 'dark-slider' : 'light-slider'}`}
            />
        </div>
    );

    // Track canvas width for fade handle positioning
    const [canvasWidth, setCanvasWidth] = useState(0);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const ro = new ResizeObserver(() => setCanvasWidth(container.clientWidth));
        ro.observe(container);
        setCanvasWidth(container.clientWidth);
        return () => ro.disconnect();
    }, []);

    // Fade drag handlers (horizontal drag to set fade duration)
    const startFadeDrag = useCallback((e, isFadeIn) => {
        e.stopPropagation();
        e.preventDefault();
        const startX = e.clientX;
        const startVal = isFadeIn ? fadeIn : fadeOut;
        const otherVal = isFadeIn ? fadeOut : fadeIn;
        const minGapSec = 0.05;
        const maxFade = Math.max(0, duration - otherVal - minGapSec);
        const pxPerSec = canvasWidth / (duration || 1);
        const onMove = (ev) => {
            const dx = isFadeIn ? (ev.clientX - startX) : (startX - ev.clientX);
            const dSec = dx / pxPerSec;
            const newVal = Math.max(0, Math.min(maxFade, startVal + dSec));
            if (isFadeIn) setFadeIn(newVal);
            else setFadeOut(newVal);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [fadeIn, fadeOut, duration, canvasWidth]);

    // Fade curve drag handlers (vertical drag to adjust curve shape)
    const startCurveDrag = useCallback((e, isFadeIn) => {
        e.stopPropagation();
        e.preventDefault();
        const startY = e.clientY;
        const startVal = isFadeIn ? fadeInCurve : fadeOutCurve;
        const containerH = containerRef.current ? containerRef.current.clientHeight : 200;
        const onMove = (ev) => {
            const dy = startY - ev.clientY; // up = higher value
            const dNorm = dy / containerH;
            const newVal = Math.max(0, Math.min(1, startVal + dNorm));
            if (isFadeIn) setFadeInCurve(newVal);
            else setFadeOutCurve(newVal);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [fadeInCurve, fadeOutCurve]);

    // Slicer handler
    const handleSlicerLoad = useCallback((data) => {
        if (onLoadSlicedInstrument) {
            onLoadSlicedInstrument({ ...data, targetTrack: null });
        }
    }, [onLoadSlicedInstrument]);

    // === Automation overlay data ===
    const effectiveTempo = tempo || globalTempo || 120;
    const secondsPerBar = (4 * 60) / effectiveTempo;
    const clipStartBar = clip.timelineBar ?? clip.startBar ?? 0;
    const clipDurationBars = duration > 0 ? duration / secondsPerBar : 4;
    const clipEndBar = clipStartBar + clipDurationBars;
    const automationPoints = trackAutomation?.[trackId]?.[automationParam] || [];

    // Helper: update automation points via setter
    const updateAutomationPoints = useCallback((newPoints) => {
        if (!onSetTrackAutomation || !trackId) return;
        onSetTrackAutomation(prev => {
            const prevTrack = prev?.[trackId] || {};
            return {
                ...prev,
                [trackId]: {
                    ...prevTrack,
                    [automationParam]: newPoints
                }
            };
        });
    }, [onSetTrackAutomation, trackId, automationParam]);

    // Helper: convert pixel position to bar/value within clip range
    const pxToBarValue = useCallback((clientX, clientY) => {
        const svg = automationSvgRef.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;
        const w = rect.width;
        const h = rect.height;
        const bar = clipStartBar + (relX / w) * clipDurationBars;
        const value = 1 - (relY / h); // top=1, bottom=0
        return {
            bar: Math.max(clipStartBar, Math.min(clipEndBar, bar)),
            value: Math.max(0, Math.min(1, value))
        };
    }, [clipStartBar, clipEndBar, clipDurationBars]);

    // Helper: convert bar/value to pixel position
    const barValueToPx = useCallback((bar, value, w, h) => {
        const x = ((bar - clipStartBar) / clipDurationBars) * w;
        const y = (1 - value) * h;
        return { x, y };
    }, [clipStartBar, clipDurationBars]);

    // Check if a point is within the clip's time range
    const isPointInRange = useCallback((pt) => {
        return pt.bar >= clipStartBar - 0.01 && pt.bar <= clipEndBar + 0.01;
    }, [clipStartBar, clipEndBar]);

    // Click on empty area to add a new point
    const handleAutomationClick = useCallback((e) => {
        // Ignore if we just finished dragging
        if (draggingPointIdx !== null) return;
        const bv = pxToBarValue(e.clientX, e.clientY);
        if (!bv) return;
        const newPoints = addAutomationPoint(automationPoints, { bar: bv.bar, value: bv.value, curve: 0 });
        updateAutomationPoints(newPoints);
    }, [pxToBarValue, automationPoints, updateAutomationPoints, draggingPointIdx]);

    // Start dragging a point
    const handlePointDragStart = useCallback((e, idx) => {
        e.stopPropagation();
        e.preventDefault();
        const pt = automationPoints[idx];
        if (!pt || !isPointInRange(pt)) return;
        setDraggingPointIdx(idx);
        const onMove = (ev) => {
            const bv = pxToBarValue(ev.clientX, ev.clientY);
            if (!bv) return;
            // Clamp bar within clip range
            const clampedBar = Math.max(clipStartBar, Math.min(clipEndBar, bv.bar));
            const newPoints = moveAutomationPoint(automationPoints, idx, clampedBar, bv.value);
            updateAutomationPoints(newPoints);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            // Small delay to prevent click-to-add firing right after drag end
            setTimeout(() => setDraggingPointIdx(null), 50);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [automationPoints, isPointInRange, pxToBarValue, updateAutomationPoints, clipStartBar, clipEndBar]);

    // Right-click to delete a point
    const handlePointRightClick = useCallback((e, idx) => {
        e.stopPropagation();
        e.preventDefault();
        const newPoints = removeAutomationPoint(automationPoints, idx);
        updateAutomationPoints(newPoints);
    }, [automationPoints, updateAutomationPoints]);

    // If slicer is open, render it instead
    if (showSlicer && buffer) {
        return (
            <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
                <SampleSlicerEditor
                    buffer={buffer}
                    name={clipName}
                    isDark={isDark}
                    onClose={() => setShowSlicer(false)}
                    onLoadToGenerator={handleSlicerLoad}
                    sampler={sampler}
                    globalTempo={globalTempo}
                />
            </div>
        );
    }

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: `${bg}f5`, display: 'flex', flexDirection: 'column',
            backdropFilter: 'blur(4px)'
        }}>
            {/* Header */}
            <div style={{
                height: '40px', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '10px',
                background: headerBg,
                borderBottom: `1px solid ${borderColor}`
            }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: accentColor }} />
                <input
                    value={clipName}
                    onChange={(e) => setClipName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') e.target.blur(); }}
                    style={{
                        fontSize: '12px', fontWeight: '800', color: accentColor,
                        background: 'transparent', border: 'none', outline: 'none',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,159,67,0.2)' : 'rgba(200,150,50,0.2)'}`,
                        padding: '2px 4px', fontFamily: 'inherit', width: '200px'
                    }}
                />
                <span style={{ fontSize: '11px', fontWeight: '600', color: mutedText }}>
                    — {trackName} · {sectionName} · {duration.toFixed(2)}s
                </span>
                {/* Stretch ratio indicator */}
                {timeStretch && originalBpm && globalTempo && (
                    <span style={{ fontSize: '10px', fontWeight: '700', color: stretchColor }}>
                        {originalBpm} &rarr; {globalTempo} BPM ({stretchRatio.toFixed(2)}x)
                    </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Automation parameter selector */}
                    {trackId && onSetTrackAutomation && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '9px', fontWeight: '700', color: '#2ecc71', letterSpacing: '0.5px' }}>AUTO</span>
                            <select
                                value={automationParam}
                                onChange={(e) => setAutomationParam(e.target.value)}
                                style={{
                                    fontSize: '10px', fontWeight: '700',
                                    background: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(46,204,113,0.08)',
                                    border: `1px solid rgba(46,204,113,0.3)`,
                                    borderRadius: '4px', color: '#2ecc71',
                                    padding: '3px 6px', cursor: 'pointer',
                                    outline: 'none', fontFamily: 'inherit'
                                }}
                            >
                                <option value="volume">Volume</option>
                                <option value="pan">Pan</option>
                            </select>
                        </div>
                    )}
                    <button onClick={onClose} style={{
                        background: btnOff,
                        border: `1px solid ${btnBorderOff}`,
                        borderRadius: '4px', color: mutedText, fontSize: '9px', fontWeight: '800',
                        padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.3px'
                    }}>
                        ESC — BACK
                    </button>
                </div>
            </div>

            {/* Waveform display */}
            <div ref={containerRef} style={{
                flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0,
                background: isDark ? '#080808' : '#fffcf7'
            }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

                {/* Fade drag handle overlay */}
                {duration > 0 && canvasWidth > 0 && (() => {
                    const containerH = containerRef.current ? containerRef.current.clientHeight : 200;
                    const fadeInPx = (fadeIn / duration) * canvasWidth;
                    const fadeOutPx = (fadeOut / duration) * canvasWidth;
                    const dotSize = 10;
                    const half = dotSize / 2;
                    const dotStyle = (left, top) => ({
                        position: 'absolute',
                        left: `${left - half}px`,
                        top: `${top - half}px`,
                        width: `${dotSize}px`,
                        height: `${dotSize}px`,
                        borderRadius: '50%',
                        background: 'rgba(255,159,67,0.9)',
                        cursor: 'ew-resize',
                        zIndex: 2,
                        boxShadow: '0 0 4px rgba(255,159,67,0.5)',
                        border: `1px solid rgba(255,255,255,0.4)`,
                    });
                    const curveDotStyle = (left, top) => ({
                        position: 'absolute',
                        left: `${left - half}px`,
                        top: `${top - half}px`,
                        width: `${dotSize}px`,
                        height: `${dotSize}px`,
                        borderRadius: '50%',
                        background: 'rgba(255,159,67,0.6)',
                        cursor: 'ns-resize',
                        zIndex: 2,
                        boxShadow: '0 0 3px rgba(255,159,67,0.3)',
                        border: `1px solid rgba(255,255,255,0.3)`,
                    });
                    // Fade-in line from top-left (0,0) down to (fadeInPx, containerH)
                    // Curve midpoint at horizontal midpoint of fade, vertical position from fadeInCurve
                    const fiMidX = fadeInPx / 2;
                    const fiMidY = containerH * (1 - fadeInCurve);
                    // Fade-out line from (canvasWidth - fadeOutPx, containerH) up to (canvasWidth, 0)
                    const foMidX = canvasWidth - fadeOutPx / 2;
                    const foMidY = containerH * (1 - fadeOutCurve);
                    // Label style
                    const labelStyle = (left, align) => ({
                        position: 'absolute',
                        left: `${left}px`,
                        top: '2px',
                        fontSize: '9px',
                        fontWeight: '700',
                        color: 'rgba(255,159,67,0.8)',
                        pointerEvents: 'none',
                        transform: align === 'right' ? 'translateX(-100%)' : 'none',
                        textShadow: isDark ? '0 0 3px rgba(0,0,0,0.8)' : '0 0 3px rgba(255,255,255,0.8)',
                        whiteSpace: 'nowrap',
                    });
                    return (
                        <div style={{
                            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                        }}>
                            {/* Fade-in duration handle (top, at fadeInPx from left) */}
                            <div
                                style={{ ...dotStyle(fadeInPx, 0 + half), pointerEvents: 'auto' }}
                                onMouseDown={(e) => startFadeDrag(e, true)}
                                title={`Fade in: ${fadeIn.toFixed(2)}s — drag left/right`}
                            />
                            {/* Fade-in curve midpoint (visible when fadeIn > 0) */}
                            {fadeIn > 0.01 && (
                                <div
                                    style={{ ...curveDotStyle(fiMidX, fiMidY), pointerEvents: 'auto' }}
                                    onMouseDown={(e) => startCurveDrag(e, true)}
                                    title={`Fade-in curve: ${fadeInCurve.toFixed(2)} — drag up/down`}
                                />
                            )}
                            {/* Fade-in label */}
                            {fadeIn > 0.01 && (
                                <span style={labelStyle(fadeInPx + 4, 'left')}>
                                    {fadeIn.toFixed(2)}s
                                </span>
                            )}

                            {/* Fade-out duration handle (top, at fadeOutPx from right) */}
                            <div
                                style={{ ...dotStyle(canvasWidth - fadeOutPx, 0 + half), pointerEvents: 'auto' }}
                                onMouseDown={(e) => startFadeDrag(e, false)}
                                title={`Fade out: ${fadeOut.toFixed(2)}s — drag left/right`}
                            />
                            {/* Fade-out curve midpoint (visible when fadeOut > 0) */}
                            {fadeOut > 0.01 && (
                                <div
                                    style={{ ...curveDotStyle(foMidX, foMidY), pointerEvents: 'auto' }}
                                    onMouseDown={(e) => startCurveDrag(e, false)}
                                    title={`Fade-out curve: ${fadeOutCurve.toFixed(2)} — drag up/down`}
                                />
                            )}
                            {/* Fade-out label */}
                            {fadeOut > 0.01 && (
                                <span style={labelStyle(canvasWidth - fadeOutPx - 4, 'right')}>
                                    {fadeOut.toFixed(2)}s
                                </span>
                            )}

                            {/* Connecting lines (SVG) */}
                            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }}>
                                {/* Fade-in curve line */}
                                {fadeIn > 0.01 && (
                                    <path
                                        d={`M 0 ${containerH} Q ${fiMidX} ${fiMidY} ${fadeInPx} 0`}
                                        fill="none"
                                        stroke="rgba(255,159,67,0.5)"
                                        strokeWidth="1.5"
                                        strokeDasharray="3,3"
                                    />
                                )}
                                {/* Fade-out curve line */}
                                {fadeOut > 0.01 && (
                                    <path
                                        d={`M ${canvasWidth - fadeOutPx} ${containerH} Q ${foMidX} ${foMidY} ${canvasWidth} 0`}
                                        fill="none"
                                        stroke="rgba(255,159,67,0.5)"
                                        strokeWidth="1.5"
                                        strokeDasharray="3,3"
                                    />
                                )}
                            </svg>
                        </div>
                    );
                })()}

                {/* Automation overlay */}
                {trackId && onSetTrackAutomation && canvasWidth > 0 && (() => {
                    const containerH = containerRef.current ? containerRef.current.clientHeight : 200;
                    const w = canvasWidth;
                    const h = containerH;
                    const pts = automationPoints;

                    // Build polyline points and fill polygon for visible points
                    const visiblePts = pts.map((pt, i) => {
                        const pos = barValueToPx(pt.bar, pt.value, w, h);
                        const inRange = isPointInRange(pt);
                        return { ...pt, idx: i, px: pos.x, py: pos.y, inRange };
                    });

                    // Build line path through all points (even out-of-range for continuity)
                    let linePath = '';
                    let fillPath = '';
                    if (visiblePts.length > 0) {
                        linePath = `M ${visiblePts[0].px} ${visiblePts[0].py}`;
                        fillPath = `M ${visiblePts[0].px} ${h}`;
                        fillPath += ` L ${visiblePts[0].px} ${visiblePts[0].py}`;
                        for (let i = 1; i < visiblePts.length; i++) {
                            linePath += ` L ${visiblePts[i].px} ${visiblePts[i].py}`;
                            fillPath += ` L ${visiblePts[i].px} ${visiblePts[i].py}`;
                        }
                        fillPath += ` L ${visiblePts[visiblePts.length - 1].px} ${h} Z`;
                    }

                    return (
                        <div
                            style={{
                                position: 'absolute', inset: 0, zIndex: 3,
                                cursor: 'crosshair',
                            }}
                            onClick={handleAutomationClick}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            <svg
                                ref={automationSvgRef}
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                                viewBox={`0 0 ${w} ${h}`}
                                preserveAspectRatio="none"
                            >
                                {/* Semi-transparent fill below the line */}
                                {fillPath && (
                                    <path
                                        d={fillPath}
                                        fill="rgba(46,204,113,0.08)"
                                        stroke="none"
                                    />
                                )}
                                {/* Connected line segments */}
                                {linePath && (
                                    <path
                                        d={linePath}
                                        fill="none"
                                        stroke="#2ecc71"
                                        strokeWidth={Math.max(1.5, 1.5 * (h / containerH))}
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        opacity="0.8"
                                    />
                                )}
                                {/* Automation point handles */}
                                {visiblePts.map((vp) => {
                                    const r = 6 * (h / containerH); // scale radius with viewBox
                                    return (
                                        <circle
                                            key={vp.idx}
                                            cx={vp.px}
                                            cy={vp.py}
                                            r={r}
                                            fill={vp.inRange ? '#2ecc71' : 'rgba(46,204,113,0.3)'}
                                            stroke={vp.inRange ? '#fff' : 'rgba(255,255,255,0.2)'}
                                            strokeWidth={Math.max(1, 1 * (h / containerH))}
                                            style={{
                                                cursor: vp.inRange ? 'grab' : 'not-allowed',
                                                pointerEvents: 'auto',
                                                filter: vp.inRange ? 'drop-shadow(0 0 3px rgba(46,204,113,0.5))' : 'none',
                                            }}
                                            onMouseDown={(e) => {
                                                if (e.button === 0 && vp.inRange) handlePointDragStart(e, vp.idx);
                                            }}
                                            onContextMenu={(e) => {
                                                if (vp.inRange) handlePointRightClick(e, vp.idx);
                                            }}
                                        />
                                    );
                                })}
                            </svg>
                            {/* Bar grid lines for reference */}
                            {(() => {
                                const barLines = [];
                                const startBarFloor = Math.ceil(clipStartBar);
                                for (let b = startBarFloor; b <= Math.floor(clipEndBar); b++) {
                                    const x = ((b - clipStartBar) / clipDurationBars) * 100;
                                    if (x >= 0 && x <= 100) {
                                        barLines.push(
                                            <div key={`bl-${b}`} style={{
                                                position: 'absolute',
                                                left: `${x}%`,
                                                top: 0, bottom: 0,
                                                width: '1px',
                                                background: 'rgba(46,204,113,0.08)',
                                                pointerEvents: 'none',
                                            }} />
                                        );
                                    }
                                }
                                return barLines;
                            })()}
                        </div>
                    );
                })()}
            </div>

            {/* Controls bar */}
            <div style={{
                height: '80px', minHeight: '80px', display: 'flex', alignItems: 'center',
                padding: '8px 16px', gap: '12px',
                background: headerBg,
                borderTop: `1px solid ${borderColor}`,
                overflowX: 'auto'
            }}>
                {/* Reverse toggle */}
                <button onClick={() => setReversed(!reversed)} style={pillBtn(reversed)}>
                    REVERSE {reversed ? 'ON' : 'OFF'}
                </button>

                <div style={{ width: '1px', height: '40px', background: borderColor, flexShrink: 0 }} />

                {/* Time-Stretch toggle */}
                <button onClick={() => setTimeStretch(!timeStretch)} style={pillBtn(timeStretch, '#00d2d2')}>
                    STRETCH {timeStretch ? 'ON' : 'OFF'}
                </button>

                {/* BPM input (shown when stretch is on) */}
                {timeStretch && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: mutedText }}>BPM</span>
                        <input
                            type="number"
                            min={40} max={300}
                            value={bpmInput}
                            placeholder="..."
                            onChange={(e) => {
                                setBpmInput(e.target.value);
                                const v = parseInt(e.target.value);
                                if (v >= 40 && v <= 300) setOriginalBpm(v);
                            }}
                            style={{
                                width: '50px', padding: '4px 6px',
                                fontSize: '11px', fontWeight: '700',
                                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                                border: `1px solid ${isDark ? 'rgba(0,210,210,0.3)' : 'rgba(0,180,180,0.3)'}`,
                                borderRadius: '4px', color: '#00d2d2',
                                textAlign: 'center', outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>
                )}

                <div style={{ width: '1px', height: '40px', background: borderColor, flexShrink: 0 }} />

                {/* Slicer button */}
                <button onClick={() => setShowSlicer(true)} style={pillBtn(false, acSec)}>
                    SLICER
                </button>

                <div style={{ width: '1px', height: '40px', background: borderColor, flexShrink: 0 }} />

                <SliderControl label="PITCH" value={pitch} min={-12} max={12} step={1} unit=" st" onChange={setPitch} />
                <SliderControl label="TRIM START" value={trimStart} min={0} max={Math.max(0.01, duration * 0.9)} step={0.01} unit="s" onChange={setTrimStart} />
                <SliderControl label="TRIM END" value={trimEnd} min={0} max={Math.max(0.01, duration * 0.9)} step={0.01} unit="s" onChange={setTrimEnd} />
            </div>
        </div>
    );
}
