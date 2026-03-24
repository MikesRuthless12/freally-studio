import React, { useEffect, useRef } from 'react';

/**
 * Renders actual waveform from AudioBuffer
 */
const SampleWaveform = ({ audioBuffer, width = 200, height = 60, theme, color }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!audioBuffer || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Clear canvas
        ctx.fillStyle = theme?.gridBg || '#1a1a1a';
        ctx.fillRect(0, 0, w, h);

        // Get audio data
        const channelData = audioBuffer.getChannelData(0); // Use first channel
        const step = Math.ceil(channelData.length / w);
        const amp = h / 2;

        // Draw waveform
        ctx.strokeStyle = color || theme?.accent || '#00ff00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < w; i++) {
            const min = Math.min(...Array.from({ length: step }, (_, j) => channelData[i * step + j] || 0));
            const max = Math.max(...Array.from({ length: step }, (_, j) => channelData[i * step + j] || 0));

            const yMin = (1 + min) * amp;
            const yMax = (1 + max) * amp;

            if (i === 0) {
                ctx.moveTo(i, yMin);
            }

            ctx.lineTo(i, yMin);
            ctx.lineTo(i, yMax);
        }

        ctx.stroke();

        // Draw center line
        ctx.strokeStyle = theme?.panelBorder || '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, amp);
        ctx.lineTo(w, amp);
        ctx.stroke();

    }, [audioBuffer, width, height, theme, color]);

    if (!audioBuffer) {
        return (
            <div style={{
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: theme?.gridBg || '#1a1a1a',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme?.textMuted || '#888',
                fontSize: '11px',
                fontStyle: 'italic'
            }}>
                No sample loaded
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: theme?.gridBg || '#1a1a1a',
                borderRadius: '4px',
                border: `1px solid ${theme?.panelBorder || '#444'}`
            }}
        />
    );
};

export default SampleWaveform;
