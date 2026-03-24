import React, { useState, useEffect, useRef, useMemo } from 'react';
import { hexToRgba } from './accentThemes';

const Knob = ({ label, value, min, max, onChange, color = '#ff6b6b', size = 50, accentColors, isDark}) => {
    const ac = accentColors?.accent || color;
    const acSec = accentColors?.secondary || '#ff9f43';

    const [dragging, setDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [startValue, setStartValue] = useState(0);

    const handleMouseDown = (e) => {
        setDragging(true);
        setStartY(e.clientY);
        setStartValue(value);
        document.body.style.cursor = 'ns-resize';
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragging) return;
            const deltaY = startY - e.clientY;
            const range = max - min;
            const step = range / 200; // sensitivity
            let newValue = startValue + deltaY * step;
            newValue = Math.max(min, Math.min(max, newValue));
            onChange(newValue);
        };

        const handleMouseUp = () => {
            setDragging(false);
            document.body.style.cursor = 'default';
        };

        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, startY, startValue, min, max, onChange]);

    const dark = isDark !== false;

    // Arc geometry
    const strokeWidth = Math.max(2.5, size * 0.06);
    const arcRadius = size / 2 - strokeWidth - 2;
    const bodyRadius = arcRadius - strokeWidth - 1;
    const recessRadius = bodyRadius - Math.max(3, size * 0.06);
    const center = size / 2;
    const startAngle = 135 * (Math.PI / 180);
    const endAngle = 405 * (Math.PI / 180);
    const angleRange = endAngle - startAngle;

    // Normalize value 0-1
    const norm = (value - min) / (max - min);
    const currentAngle = startAngle + norm * angleRange;

    // Arc path coordinates
    const trackStartX = center + arcRadius * Math.cos(startAngle);
    const trackStartY = center + arcRadius * Math.sin(startAngle);
    const trackEndX = center + arcRadius * Math.cos(endAngle);
    const trackEndY = center + arcRadius * Math.sin(endAngle);
    const activeEndX = center + arcRadius * Math.cos(currentAngle);
    const activeEndY = center + arcRadius * Math.sin(currentAngle);

    const largeArcFlag = (currentAngle - startAngle) > Math.PI ? 1 : 0;
    const trackPath = `M ${trackStartX} ${trackStartY} A ${arcRadius} ${arcRadius} 0 1 1 ${trackEndX} ${trackEndY}`;
    const activePath = `M ${trackStartX} ${trackStartY} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 1 ${activeEndX} ${activeEndY}`;

    // Position indicator dot
    const dotRadius = Math.max(2, size * 0.05);

    // Unique IDs for gradients (avoid SVG ID conflicts when multiple knobs render)
    const gradId = useMemo(() => 'knob-' + Math.random().toString(36).slice(2, 8), []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
            <div
                onMouseDown={handleMouseDown}
                style={{ width: size, height: size, position: 'relative', cursor: 'pointer' }}
            >
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <defs>
                        {/* Outer body gradient — convex bevel */}
                        <radialGradient id={gradId + '-body'} cx="35%" cy="35%" r="65%">
                            <stop offset="0%" stopColor={dark ? '#4a4a56' : '#f0f0f5'} />
                            <stop offset="100%" stopColor={dark ? '#1a1a22' : '#c0c0c8'} />
                        </radialGradient>
                        {/* Inner recess gradient — concave */}
                        <radialGradient id={gradId + '-recess'} cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor={dark ? '#0d0d14' : '#e8e8f0'} />
                            <stop offset="100%" stopColor={dark ? '#1e1e28' : '#d0d0d8'} />
                        </radialGradient>
                        {/* Active arc gradient */}
                        <linearGradient id={gradId + '-arc'} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={ac} />
                            <stop offset="100%" stopColor={acSec} />
                        </linearGradient>
                        {/* Glow filter */}
                        <filter id={gradId + '-glow'} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation={Math.max(1.5, size * 0.03)} />
                        </filter>
                    </defs>

                    {/* Outer body circle (3D convex bevel) */}
                    <circle
                        cx={center} cy={center} r={bodyRadius}
                        fill={`url(#${gradId}-body)`}
                        stroke={dark ? '#2a2a36' : '#b0b0b8'}
                        strokeWidth={0.5}
                    />

                    {/* Inner recess (concave center) */}
                    <circle
                        cx={center} cy={center} r={recessRadius}
                        fill={`url(#${gradId}-recess)`}
                        stroke={dark ? '#111118' : '#c8c8d0'}
                        strokeWidth={0.5}
                    />

                    {/* Background arc track */}
                    <path
                        d={trackPath}
                        fill="none"
                        stroke={dark ? '#2a2a36' : '#d0d0d8'}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Glow behind active arc */}
                    <path
                        d={activePath}
                        fill="none"
                        stroke={ac}
                        strokeWidth={strokeWidth + 4}
                        strokeLinecap="round"
                        filter={`url(#${gradId}-glow)`}
                        opacity={0.35}
                    />

                    {/* Active arc with gradient */}
                    <path
                        d={activePath}
                        fill="none"
                        stroke={`url(#${gradId}-arc)`}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Position indicator dot at arc endpoint */}
                    <circle
                        cx={activeEndX} cy={activeEndY} r={dotRadius + 2}
                        fill={ac} opacity={0.2}
                    />
                    <circle
                        cx={activeEndX} cy={activeEndY} r={dotRadius}
                        fill="#fff"
                    />

                    {/* Subtle top highlight on body for 3D effect */}
                    <ellipse
                        cx={center} cy={center - bodyRadius * 0.35}
                        rx={bodyRadius * 0.45} ry={bodyRadius * 0.2}
                        fill="white" opacity={dark ? 0.04 : 0.15}
                    />
                </svg>
                {/* Value text */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: Math.max(8, size * 0.18) + 'px',
                    color: dark ? '#e0e0e0' : '#333',
                    fontWeight: '600',
                    fontFamily: '"Courier New", monospace',
                    letterSpacing: '-0.5px',
                    pointerEvents: 'none',
                }}>
                    {value.toFixed(1)}
                </div>
            </div>
            {label && (
                <span style={{
                    fontSize: Math.max(8, size * 0.18) + 'px',
                    color: dark ? '#999' : '#666',
                    marginTop: '3px',
                    fontWeight: '600',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                    fontFamily: '"Courier New", monospace',
                }}>
                    {label}
                </span>
            )}
        </div>
    );
};

export default Knob;
