// Knob — flat kit knob (TASK-C05). Consolidates the old src/Knob.jsx:
// same prop shape (label, value, min, max, onChange, size, plus the legacy
// color/accentColors/isDark props, now ignored — colors come from tokens).
// Adds: defaultValue (double-click reset), disabled, formatValue.
import React, { useState, useRef } from 'react';
import './ui-kit.css';

const Knob = ({
    label, value, min = 0, max = 1, onChange,
    size = 50, defaultValue = null, disabled = false,
    formatValue = (v) => v.toFixed(1),
    // legacy props, accepted and unused (token colors apply):
    color: _color, accentColors: _accentColors, isDark: _isDark,
}) => {
    const [dragging, setDragging] = useState(false);
    const startRef = useRef({ y: 0, value: 0 });

    const norm = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    const startAngle = 135;
    const sweep = 270;
    const angle = startAngle + norm * sweep;
    const center = size / 2;
    const stroke = Math.max(2, size * 0.06);
    const radius = center - stroke - 1;

    const arcPoint = (deg) => {
        const rad = (deg * Math.PI) / 180;
        return [center + radius * Math.cos(rad), center + radius * Math.sin(rad)];
    };
    const [sx, sy] = arcPoint(startAngle);
    const [ex, ey] = arcPoint(startAngle + sweep);
    const [ax, ay] = arcPoint(angle);
    const largeTrack = 1;
    const largeActive = angle - startAngle > 180 ? 1 : 0;

    return (
        <span
            className={`fui-knob ${disabled ? 'fui-disabled' : ''}`}
            role="slider"
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
                if (disabled || !onChange) return;
                const step = (max - min) / 50;
                if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(max, value + step));
                if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(min, value - step));
            }}
        >
            <span
                style={{ width: size, height: size, position: 'relative', display: 'inline-block', cursor: disabled ? 'not-allowed' : 'ns-resize' }}
                onPointerDown={(e) => {
                    if (disabled) return;
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    startRef.current = { y: e.clientY, value };
                    setDragging(true);
                }}
                onPointerMove={(e) => {
                    if (!dragging || !onChange) return;
                    const delta = (startRef.current.y - e.clientY) * ((max - min) / 200);
                    onChange(Math.max(min, Math.min(max, startRef.current.value + delta)));
                }}
                onPointerUp={(e) => { setDragging(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
                onDoubleClick={() => {
                    if (!disabled && defaultValue != null && onChange) onChange(defaultValue);
                }}
            >
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {/* flat body */}
                    <circle
                        cx={center} cy={center} r={radius - stroke}
                        style={{ fill: 'var(--surface-2)', stroke: 'var(--border-hairline)', strokeWidth: 1 }}
                    />
                    {/* track arc */}
                    <path
                        d={`M ${sx} ${sy} A ${radius} ${radius} 0 ${largeTrack} 1 ${ex} ${ey}`}
                        style={{ fill: 'none', stroke: 'var(--border-hairline)', strokeWidth: stroke, strokeLinecap: 'butt' }}
                    />
                    {/* active arc */}
                    <path
                        d={`M ${sx} ${sy} A ${radius} ${radius} 0 ${largeActive} 1 ${ax} ${ay}`}
                        style={{
                            fill: 'none',
                            stroke: disabled ? 'var(--text-disabled)' : dragging ? 'var(--accent)' : 'var(--accent-muted)',
                            strokeWidth: stroke,
                            strokeLinecap: 'butt',
                        }}
                    />
                    {/* pointer line */}
                    <line
                        x1={center + (radius - stroke - 3) * Math.cos((angle * Math.PI) / 180)}
                        y1={center + (radius - stroke - 3) * Math.sin((angle * Math.PI) / 180)}
                        x2={center + (radius - stroke * 2 - 7) * Math.cos((angle * Math.PI) / 180)}
                        y2={center + (radius - stroke * 2 - 7) * Math.sin((angle * Math.PI) / 180)}
                        style={{ stroke: 'var(--text-1)', strokeWidth: Math.max(1.5, size * 0.035) }}
                    />
                </svg>
                <span className="fui-knob-value" style={{ fontSize: Math.max(8, size * 0.17) }}>
                    {formatValue(value)}
                </span>
            </span>
            {label && <span className="fui-knob-label" style={{ fontSize: Math.max(8, size * 0.16) }}>{label}</span>}
        </span>
    );
};

export default Knob;
