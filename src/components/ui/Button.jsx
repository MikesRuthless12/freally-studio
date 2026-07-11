// Button — flat, hairline-bordered kit button (TASK-C05)
import React from 'react';
import './ui-kit.css';

const Button = ({
    size = 'm', variant = 'default', active = false, disabled = false,
    onClick, title, children, style, type = 'button',
}) => (
    <button
        type={type}
        className={[
            'fui-btn',
            size === 's' ? 'fui-s' : 'fui-m',
            variant === 'primary' ? 'fui-primary' : '',
            variant === 'danger' ? 'fui-danger' : '',
            active ? 'fui-active' : '',
        ].filter(Boolean).join(' ')}
        disabled={disabled}
        onClick={onClick}
        title={title}
        style={style}
    >
        {children}
    </button>
);

export default Button;
