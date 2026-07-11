// Fader — flat fader with pointer drag; double-click resets (TASK-C05)
import React, { useRef, useState, useCallback } from 'react';
import './ui-kit.css';

const Fader = ({
    value, min = 0, max = 1, onChange, defaultValue = null,
    vertical = true, length = 96, thickness = 18, disabled = false, title, style,
}) => {
    const trackRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const norm = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));

    const valueFromEvent = useCallback((e) => {
        const rect = trackRef.current.getBoundingClientRect();
        const frac = vertical
            ? 1 - (e.clientY - rect.top) / rect.height
            : (e.clientX - rect.left) / rect.width;
        return min + Math.max(0, Math.min(1, frac)) * (max - min);
    }, [vertical, min, max]);

    const handlePointerDown = (e) => {
        if (disabled) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        if (onChange) onChange(valueFromEvent(e));
    };

    const handleSize = 10;
    const handlePos = `calc(${(norm * 100).toFixed(2)}% - ${handleSize / 2}px)`;

    return (
        <span
            ref={trackRef}
            className={[
                'fui-fader',
                vertical ? '' : 'fui-horizontal',
                dragging ? 'fui-dragging' : '',
                disabled ? 'fui-disabled' : '',
            ].filter(Boolean).join(' ')}
            style={{
                display: 'inline-block',
                width: vertical ? thickness : length,
                height: vertical ? length : thickness,
                ...style,
            }}
            role="slider"
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            title={title}
            onPointerDown={handlePointerDown}
            onPointerMove={(e) => { if (dragging && onChange) onChange(valueFromEvent(e)); }}
            onPointerUp={(e) => { setDragging(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
            onDoubleClick={() => {
                if (!disabled && defaultValue != null && onChange) onChange(defaultValue);
            }}
            onKeyDown={(e) => {
                if (disabled || !onChange) return;
                const step = (max - min) / 50;
                if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(max, value + step));
                if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(min, value - step));
            }}
        >
            {vertical ? (
                <>
                    <span className="fui-fader-track" style={{ left: '50%', top: 2, bottom: 2, width: 2, transform: 'translateX(-50%)' }} />
                    <span className="fui-fader-fill" style={{ left: '50%', bottom: 2, width: 2, height: `${(norm * 100).toFixed(2)}%`, transform: 'translateX(-50%)' }} />
                    <span className="fui-fader-handle" style={{ left: 2, right: 2, height: handleSize, bottom: handlePos }} />
                </>
            ) : (
                <>
                    <span className="fui-fader-track" style={{ top: '50%', left: 2, right: 2, height: 2, transform: 'translateY(-50%)' }} />
                    <span className="fui-fader-fill" style={{ top: '50%', left: 2, height: 2, width: `${(norm * 100).toFixed(2)}%`, transform: 'translateY(-50%)' }} />
                    <span className="fui-fader-handle" style={{ top: 2, bottom: 2, width: handleSize, left: handlePos }} />
                </>
            )}
        </span>
    );
};

export default Fader;
