// Meter — segmented level meter from the --meter-* tokens (TASK-C05)
// value 0..1; segments light green below 0.7, yellow to 0.9, red above.
import React from 'react';
import './ui-kit.css';

const Meter = ({ value = 0, segments = 12, vertical = false, width, height, style }) => {
    const lit = Math.round(Math.max(0, Math.min(1, value)) * segments);
    return (
        <span
            className={`fui-meter ${vertical ? 'fui-vertical' : ''}`}
            style={{
                width: width ?? (vertical ? 10 : 96),
                height: height ?? (vertical ? 96 : 10),
                display: vertical ? 'inline-flex' : 'flex',
                ...style,
            }}
            role="meter"
            aria-valuenow={Math.round(value * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            {Array.from({ length: segments }, (_, i) => {
                const level = (i + 1) / segments;
                const cls = i < lit
                    ? (level > 0.9 ? 'fui-lit-red' : level > 0.7 ? 'fui-lit-yellow' : 'fui-lit-green')
                    : '';
                return <span key={i} className={`fui-meter-seg ${cls}`} />;
            })}
        </span>
    );
};

export default Meter;
