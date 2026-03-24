import React, { useState, useRef, useCallback } from 'react';
import { hexToRgba } from '../accentThemes';

/**
 * useToast — lightweight toast notification hook.
 * Returns { toasts, addToast, removeToast }.
 */
export function useToast() {
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(0);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = nextId.current++;
        setToasts(prev => [...prev, { id, message, type, duration }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
}

const borderColors = {
    success: '#39ff14',
    error: '#ff4b4b',
    warning: '#ff9f43',
    info: '#4facfe'
};

/**
 * ToastContainer — renders a stack of toasts at bottom-center.
 */
export function ToastContainer({ toasts, removeToast }) {
    if (!toasts || toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'none'
        }}>
            {toasts.map(toast => (
                <div key={toast.id} style={{
                    background: 'rgba(30, 30, 35, 0.95)',
                    borderLeft: `4px solid ${borderColors[toast.type] || borderColors.info}`,
                    borderRadius: '8px',
                    padding: '12px 20px',
                    fontSize: '13px',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(10px)',
                    minWidth: '250px',
                    maxWidth: '450px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    pointerEvents: 'auto',
                    animation: 'fadeInUp 0.25s ease-out'
                }}>
                    <span>{toast.message}</span>
                    <button
                        onClick={() => removeToast(toast.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#666',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '0 2px',
                            lineHeight: 1
                        }}
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}

export default ToastContainer;
