import React, { useRef, useEffect, useState } from 'react';
import { hexToRgba } from './accentThemes';

const WaveformCanvas = ({
    buffer,
    audioBuffer,
    transients = [],
    color = '#39ff14',
    height = 200,
    // New props
    tempo = 0,
    showBeatGrid = false,
    detectedBPM = null,
    detectedKey = null,
    theme = 'dark', accentColors}) => {
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const activeBuffer = buffer || audioBuffer;
    const canvasRef = useRef(null);
    const waveformCacheRef = useRef(null);
    const [zoom, setZoom] = useState(1);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragCurrentX, setDragCurrentX] = useState(0);

    const isDark = theme === 'dark';

    // Resolve beat grid tempo: use explicit prop, or fall back to detected
    const gridTempo = tempo || detectedBPM || 0;

    // Waveform rendering cache
    useEffect(() => {
        if (!activeBuffer) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const width = canvas.width;
        const canvasHeight = canvas.height;

        if (!waveformCacheRef.current) {
            waveformCacheRef.current = document.createElement('canvas');
        }
        waveformCacheRef.current.width = width;
        waveformCacheRef.current.height = canvasHeight;

        const ctx = waveformCacheRef.current.getContext('2d');
        ctx.clearRect(0, 0, width, canvasHeight);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        const data = activeBuffer.getChannelData(0);
        const step = Math.max(1, Math.ceil(data.length / (width * zoom)));
        const amp = canvasHeight / 2;

        ctx.beginPath();

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            const startIndex = i * step;

            if (startIndex >= data.length) break;

            for (let j = 0; j < step; j++) {
                if (startIndex + j < data.length) {
                    const datum = data[startIndex + j];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
            }
            ctx.moveTo(i, (1 - min) * amp);
            ctx.lineTo(i, (1 - max) * amp);
        }
        ctx.stroke();

    }, [activeBuffer, zoom, color, height]); // Re-cache when buffer, zoom, or styles change

    // Main Render Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const render = () => {
            const cw = canvas.width;
            const ch = canvas.height;

            // 0. Clear Main Canvas
            ctx.clearRect(0, 0, cw, ch);

            // 1. Draw beat grid (behind waveform)
            if (showBeatGrid && gridTempo > 0 && activeBuffer) {
                const duration = activeBuffer.duration;
                const visibleDuration = duration / zoom;
                const beatInterval = 60 / gridTempo;
                const totalBeats = Math.floor(visibleDuration / beatInterval);

                for (let b = 0; b <= totalBeats; b++) {
                    const t = b * beatInterval;
                    const x = (t / visibleDuration) * cw;
                    const isDownbeat = b % 4 === 0;

                    ctx.strokeStyle = isDownbeat
                        ? hexToRgba(ac, 0.30)
                        : hexToRgba(ac, 0.15);
                    ctx.lineWidth = isDownbeat ? 1.5 : 0.75;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, ch);
                    ctx.stroke();
                }
            }

            // 2. Draw Cached Waveform
            if (waveformCacheRef.current) {
                ctx.drawImage(waveformCacheRef.current, 0, 0);
            }

            if (activeBuffer) {
                const duration = activeBuffer.duration;
                const visibleDuration = duration / zoom;

                // 3. Draw Transients (Orange Markers)
                if (transients && transients.length > 0) {
                    ctx.strokeStyle = '#ff9900';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 2]);
                    ctx.beginPath();

                    transients.forEach(time => {
                        if (time <= visibleDuration) {
                            const x = (time / visibleDuration) * cw;
                            ctx.moveTo(x, 0);
                            ctx.lineTo(x, ch);
                        }
                    });

                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Small triangle markers at top
                    ctx.fillStyle = '#ffaa00';
                    transients.forEach(time => {
                        if (time <= visibleDuration) {
                            const x = (time / visibleDuration) * cw;
                            ctx.beginPath();
                            ctx.moveTo(x, 1);
                            ctx.lineTo(x - 3, 7);
                            ctx.lineTo(x + 3, 7);
                            ctx.closePath();
                            ctx.fill();
                        }
                    });
                }

                // 4. Draw Loop Region
                let renderStart = 0;
                let renderEnd = 0;
                let hasSelection = false;

                if (isDragging) {
                    const t1 = (dragStartX / cw) * visibleDuration;
                    const t2 = (dragCurrentX / cw) * visibleDuration;
                    renderStart = Math.min(t1, t2);
                    renderEnd = Math.max(t1, t2);
                    hasSelection = true;
                } else if (window.audioEngine) {
                    const loopState = window.audioEngine.getLoopState?.();
                    if (loopState) {
                        const { isLooping, loopStart, loopEnd } = loopState;
                        if (isLooping && (loopStart > 0 || loopEnd > 0)) {
                            renderStart = loopStart;
                            renderEnd = loopEnd > 0 ? loopEnd : duration;
                            hasSelection = true;
                        }
                    }
                }

                if (hasSelection) {
                    const x1 = (renderStart / visibleDuration) * cw;
                    const x2 = (renderEnd / visibleDuration) * cw;

                    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
                    ctx.fillRect(x1, 0, x2 - x1, ch);

                    ctx.strokeStyle = '#00ff00';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x1, 0); ctx.lineTo(x1, ch);
                    ctx.moveTo(x2, 0); ctx.lineTo(x2, ch);
                    ctx.stroke();
                }
            }

            // 5. BPM / Key badge overlay
            if (detectedBPM || detectedKey) {
                let badge = '';
                if (detectedBPM) badge += `${Math.round(detectedBPM)} BPM`;
                if (detectedBPM && detectedKey) badge += '  ';
                if (detectedKey) badge += detectedKey;

                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                const pad = 4;
                const tw = ctx.measureText(badge).width;
                ctx.fillStyle = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
                ctx.fillRect(cw - tw - pad * 2 - 2, 2, tw + pad * 2, 16);
                ctx.fillStyle = isDark ? '#ddd' : '#333';
                ctx.fillText(badge, cw - pad - 2, pad + 1);
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [activeBuffer, zoom, transients, isDragging, dragStartX, dragCurrentX,
        showBeatGrid, gridTempo, detectedBPM, detectedKey, isDark]);

    const handleWheel = (e) => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prevZoom => Math.max(1, prevZoom * delta));
    };

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setDragStartX(x);
        setDragCurrentX(x);
        setIsDragging(true);
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const rect = canvasRef.current.getBoundingClientRect();
        setDragCurrentX(e.clientX - rect.left);
    };

    const handleMouseUp = () => {
        if (!isDragging) return;
        setIsDragging(false);

        const dragDistance = Math.abs(dragCurrentX - dragStartX);
        if (dragDistance < 5) {
            // Click -> Seek
            if (!activeBuffer) return;
            const visibleDuration = activeBuffer.duration / zoom;
            const time = (dragStartX / canvasRef.current.width) * visibleDuration;
            if (window.audioEngine?.seek) window.audioEngine.seek(time);
        } else {
            // Drag -> Loop Region
            if (!activeBuffer) return;
            const visibleDuration = activeBuffer.duration / zoom;
            const t1 = (dragStartX / canvasRef.current.width) * visibleDuration;
            const t2 = (dragCurrentX / canvasRef.current.width) * visibleDuration;
            if (window.audioEngine?.setLoopRegion) window.audioEngine.setLoopRegion(Math.min(t1, t2), Math.max(t1, t2));
        }
    };

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={200}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
                width: '100%',
                height: `${height}px`,
                backgroundColor: 'transparent',
                cursor: isDragging ? 'e-resize' : 'crosshair',
                display: 'block',
                userSelect: 'none'
            }}
        />
    );
};

export default WaveformCanvas;
