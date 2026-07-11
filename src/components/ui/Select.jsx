// Select — flat native select (TASK-C05)
import React from 'react';
import './ui-kit.css';

const Select = ({ value, onChange, options = [], size = 'm', disabled = false, title, style }) => (
    <select
        className={`fui-select ${size === 's' ? 'fui-s' : 'fui-m'}`}
        value={value}
        disabled={disabled}
        title={title}
        style={style}
        onChange={(e) => onChange && onChange(e.target.value)}
    >
        {options.map(opt => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label ?? opt.value}
            </option>
        ))}
    </select>
);

export default Select;
