// buttonHover.js — WinForms-style hover props for buttons
// Spread onto any <button> to get a clear brightness + outline hover effect.
// Usage: <button {...hoverProps} onClick={...}>Label</button>

export const hoverProps = {
    onMouseEnter: (e) => {
        e.currentTarget.style.filter = 'brightness(1.6)';
        e.currentTarget.style.outline = '2px solid rgba(255,255,255,0.4)';
        e.currentTarget.style.outlineOffset = '-1px';
    },
    onMouseLeave: (e) => {
        e.currentTarget.style.filter = '';
        e.currentTarget.style.outline = '';
        e.currentTarget.style.outlineOffset = '';
    },
    onMouseDown: (e) => {
        e.currentTarget.style.filter = 'brightness(0.7)';
    },
    onMouseUp: (e) => {
        e.currentTarget.style.filter = 'brightness(1.6)';
    },
};
