import React, { useRef, useEffect } from 'react';
import { resolveColor, getTokenColor } from './ui/SkinEngine.js';
import { hexToRgba } from './accentThemes';

/**
 * WaveformClipCanvas — renders a mini waveform thumbnail for audio clips in the arrangement timeline.
 * Props:
 *   audioBuffer: AudioBuffer
 *   width, height: pixel dimensions
 *   color: waveform color
 *   trimStart: seconds trimmed from start
 *   trimEnd: seconds trimmed from end
 *   reversed: boolean
 *   fadeInCurve / fadeOutCurve: -1 (concave) to 1 (convex), 0 = linear
 */
export default function WaveformClipCanvas({ audioBuffer, width, height, color, trimStart = 0, trimEnd = 0, reversed = false, fadeIn = 0, fadeOut = 0, fadeInCurve = 0, fadeOutCurve = 0, gain = 1.0 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !audioBuffer) return;

        const w = Math.max(1, Math.floor(width));
        const h = Math.max(1, Math.floor(height));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const totalSamples = channelData.length;

        // Apply trim
        const startSample = Math.floor(trimStart * sampleRate);
        const endSample = Math.max(startSample + 1, totalSamples - Math.floor(trimEnd * sampleRate));
        const activeSamples = endSample - startSample;

        if (activeSamples <= 0) return;

        // Compute peaks (one per pixel column)
        const samplesPerPixel = activeSamples / w;
        const peaks = new Float32Array(w);

        for (let px = 0; px < w; px++) {
            const sampleStart = startSample + Math.floor(px * samplesPerPixel);
            const sampleEnd = Math.min(startSample + Math.floor((px + 1) * samplesPerPixel), endSample);
            let max = 0;
            for (let i = sampleStart; i < sampleEnd; i++) {
                const idx = reversed ? (endSample - 1 - (i - startSample) + startSample) : i;
                const abs = Math.abs(channelData[idx] || 0);
                if (abs > max) max = abs;
            }
            peaks[px] = max;
        }

        // Draw waveform (mirrored). color may be a var(--clip-NN) token —
        // canvas needs the computed value (TASK-C04 allowlisted pattern).
        const mid = h / 2;
        ctx.fillStyle = resolveColor(color);
        ctx.globalAlpha = 0.7;

        for (let px = 0; px < w; px++) {
            const barH = peaks[px] * mid * 0.9 * Math.min(gain, 2);
            if (barH < 0.5) continue;
            ctx.fillRect(px, mid - barH, 1, barH * 2);
        }

        ctx.globalAlpha = 1;

        // Fade overlays tinted from the --warn token (canvas reads the
        // computed value; token colors are hex in all built-in skins)
        const warn = getTokenColor('--warn');
        const duration = audioBuffer.duration;
        if (fadeIn > 0 && duration > 0) {
            const fadePx = Math.min(w, (fadeIn / duration) * w);
            const grad = ctx.createLinearGradient(0, 0, fadePx, 0);
            grad.addColorStop(0, hexToRgba(warn, 0.35));
            grad.addColorStop(1, hexToRgba(warn, 0));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, fadePx, h);
            // Fade curve: quadratic bezier from bottom-left to top-right
            // Control point shifts based on fadeInCurve (-1=concave, 0=linear, 1=convex)
            ctx.strokeStyle = hexToRgba(warn, 0.8);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, h);
            const cpX = fadePx * 0.5;
            const cpY = h * (0.5 - fadeInCurve * 0.5);
            ctx.quadraticCurveTo(cpX, cpY, fadePx, 0);
            ctx.stroke();
        }
        if (fadeOut > 0 && duration > 0) {
            const fadePx = Math.min(w, (fadeOut / duration) * w);
            const fadeStart = w - fadePx;
            const grad = ctx.createLinearGradient(fadeStart, 0, w, 0);
            grad.addColorStop(0, hexToRgba(warn, 0));
            grad.addColorStop(1, hexToRgba(warn, 0.35));
            ctx.fillStyle = grad;
            ctx.fillRect(fadeStart, 0, fadePx, h);
            // Fade curve: quadratic bezier from top-left to bottom-right
            ctx.strokeStyle = hexToRgba(warn, 0.8);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(fadeStart, 0);
            const cpX = fadeStart + fadePx * 0.5;
            const cpY = h * (0.5 - fadeOutCurve * 0.5);
            ctx.quadraticCurveTo(cpX, cpY, w, h);
            ctx.stroke();
        }
    }, [audioBuffer, width, height, color, trimStart, trimEnd, reversed, fadeIn, fadeOut, fadeInCurve, fadeOutCurve, gain]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
}
