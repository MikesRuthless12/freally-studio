// Toggle — flat on/off switch (TASK-C05)
import React from 'react';
import './ui-kit.css';

const Toggle = ({ value, onChange, label, size = 'm', disabled = false, title }) => (
    <span
        className={[
            'fui-toggle',
            size === 's' ? 'fui-s' : 'fui-m',
            value ? 'fui-on' : '',
            disabled ? 'fui-disabled' : '',
        ].filter(Boolean).join(' ')}
        role="switch"
        aria-checked={!!value}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        title={title}
        onClick={() => { if (!disabled && onChange) onChange(!value); }}
        onKeyDown={(e) => {
            if (!disabled && onChange && (e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                onChange(!value);
            }
        }}
    >
        <span className="fui-toggle-track"><span className="fui-toggle-thumb" /></span>
        {label && <span>{label}</span>}
    </span>
);

export default Toggle;
