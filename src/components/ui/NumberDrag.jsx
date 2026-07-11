// NumberDrag — numeric readout you drag vertically; double-click to type (TASK-C05)
import React, { useState, useRef } from 'react';
import './ui-kit.css';

const NumberDrag = ({
    value, min = 0, max = 100, step = 1, onChange,
    format = (v) => String(Math.round(v * 100) / 100),
    size = 'm', disabled = false, title, style,
}) => {
    const [dragging, setDragging] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const startRef = useRef({ y: 0, value: 0 });

    const clamp = (v) => Math.max(min, Math.min(max, v));

    const commitEdit = () => {
        setEditing(false);
        const parsed = parseFloat(editText);
        if (!Number.isNaN(parsed) && onChange) onChange(clamp(parsed));
    };

    if (editing) {
        return (
            <span className={`fui-numberdrag ${size === 's' ? 'fui-s' : 'fui-m'}`} style={style}>
                <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                />
            </span>
        );
    }

    return (
        <span
            className={[
                'fui-numberdrag',
                size === 's' ? 'fui-s' : 'fui-m',
                dragging ? 'fui-dragging' : '',
                disabled ? 'fui-disabled' : '',
            ].filter(Boolean).join(' ')}
            role="spinbutton"
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            title={title}
            style={style}
            onPointerDown={(e) => {
                if (disabled) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                startRef.current = { y: e.clientY, value };
                setDragging(true);
            }}
            onPointerMove={(e) => {
                if (!dragging || !onChange) return;
                const delta = (startRef.current.y - e.clientY) * step * 0.5;
                onChange(clamp(startRef.current.value + delta));
            }}
            onPointerUp={(e) => { setDragging(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
            onDoubleClick={() => {
                if (disabled) return;
                setEditText(String(value));
                setEditing(true);
            }}
            onKeyDown={(e) => {
                if (disabled || !onChange) return;
                if (e.key === 'ArrowUp') onChange(clamp(value + step));
                if (e.key === 'ArrowDown') onChange(clamp(value - step));
            }}
        >
            {format(value)}
        </span>
    );
};

export default NumberDrag;
