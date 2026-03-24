import React, { useCallback, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/I18nContext';

/**
 * Push-to-Talk button — hold to talk.
 * Props: onPress, onRelease, disabled, isTalking, isDark, accentColor, disabledReason
 */
export function PTTButton({ onPress, onRelease, disabled = false, isTalking = false, isDark = true, accentColor = '#39ff14', disabledReason = '' }) {
    const { t } = useTranslation();
    const pressedRef = useRef(false);
    const onReleaseRef = useRef(onRelease);
    onReleaseRef.current = onRelease;

    const handleStart = useCallback(async (e) => {
        e.preventDefault();
        if (disabled) return;
        // Always allow a new press — don't guard on pressedRef being true,
        // because a previous press might have gotten stuck (e.g. permission dialog)
        pressedRef.current = true;
        if (onPress) {
            try {
                const result = await onPress();
                // If onPress returned false (e.g. 2-person limit), reset
                if (result === false) {
                    pressedRef.current = false;
                }
            } catch {
                pressedRef.current = false;
            }
        }
    }, [disabled, onPress]);

    const doRelease = useCallback(() => {
        if (!pressedRef.current) return;
        pressedRef.current = false;
        if (onReleaseRef.current) onReleaseRef.current();
    }, []);

    const handleEnd = useCallback((e) => {
        e.preventDefault();
        doRelease();
    }, [doRelease]);

    // Global mouseup/touchend catches releases that happen outside the button
    // (e.g. after permission dialog steals focus, or mouse drifts off)
    useEffect(() => {
        const handleGlobalUp = () => doRelease();
        window.addEventListener('mouseup', handleGlobalUp);
        window.addEventListener('touchend', handleGlobalUp);
        return () => {
            window.removeEventListener('mouseup', handleGlobalUp);
            window.removeEventListener('touchend', handleGlobalUp);
        };
    }, [doRelease]);

    // Safety: if isTalking goes false externally but pressedRef is stuck, reset it
    useEffect(() => {
        if (!isTalking) pressedRef.current = false;
    }, [isTalking]);

    return (
        <button
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            onTouchCancel={handleEnd}
            disabled={disabled}
            title={disabled ? (disabledReason || 'Cannot talk right now') : t('ui.holdToTalk')}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '20px',
                border: isTalking
                    ? `2px solid ${accentColor}`
                    : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#ccc'}`,
                background: isTalking
                    ? `${accentColor}20`
                    : (isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'),
                color: isTalking ? accentColor : (isDark ? '#ccc' : '#555'),
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
                transition: 'all 0.15s',
                opacity: disabled ? 0.4 : 1,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                boxShadow: isTalking ? `0 0 12px ${accentColor}30` : 'none',
                outline: 'none',
                width: '100%',
                maxWidth: '200px'
            }}
        >
            {/* Mic SVG icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <span>{isTalking ? 'Talking...' : t('ui.holdToTalk')}</span>
            {isTalking && (
                <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: accentColor,
                    animation: 'pttPulse 0.8s ease-in-out infinite alternate',
                }} />
            )}
            <style>{`
                @keyframes pttPulse {
                    from { opacity: 0.4; transform: scale(0.8); }
                    to   { opacity: 1;   transform: scale(1.2); }
                }
            `}</style>
        </button>
    );
}

export default PTTButton;
