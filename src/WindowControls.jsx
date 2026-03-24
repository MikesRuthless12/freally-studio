import React, { useState, useEffect } from 'react';
import { isElectron } from './electronBridge.js';
import { useTranslation } from './i18n/I18nContext';

const WindowControls = ({ theme }) => {
    const { t } = useTranslation();
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isPoppedOut, setIsPoppedOut] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [popoutWindow, setPopoutWindow] = useState(null);
    const inElectron = isElectron();

    useEffect(() => {
        if (inElectron) {
            // Query initial maximize state
            window.electronAPI.window.isMaximized().then(setIsMaximized);
            // Listen for maximize/restore changes
            window.electronAPI.window.onMaximizeChange(setIsMaximized);
            return;
        }

        // Browser mode: listen for fullscreen changes
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && document.fullscreenElement) {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        };

        const handleF11 = (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                handleFullScreen();
            }
        };

        document.addEventListener('fullscreenchange', handleFullScreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
        document.addEventListener('mozfullscreenchange', handleFullScreenChange);
        document.addEventListener('msfullscreenchange', handleFullScreenChange);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keydown', handleF11);

        setIsPoppedOut(window.opener !== null);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullScreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
            document.removeEventListener('msfullscreenchange', handleFullScreenChange);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keydown', handleF11);
        };
    }, []);

    const handleFullScreen = async () => {
        try {
            if (!document.fullscreenElement) {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) {
                    await elem.webkitRequestFullscreen();
                } else if (elem.mozRequestFullScreen) {
                    await elem.mozRequestFullScreen();
                } else if (elem.msRequestFullscreen) {
                    await elem.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    await document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    await document.msExitFullscreen();
                }
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };

    const handlePopOut = () => {
        if (isPoppedOut) return;
        const url = window.location.href;
        const width = 1400;
        const height = 900;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`;
        const newWindow = window.open(url, 'WavLoomStudio', features);
        if (newWindow) {
            setPopoutWindow(newWindow);
        }
    };

    const handleMinimize = () => {
        if (isPoppedOut && window.opener) {
            window.close();
        } else if (isFullScreen) {
            handleFullScreen();
        } else {
            alert('Minimize is only available in pop-out window mode. Use "Pop Out" to open in a separate window.');
        }
    };

    const handleRestore = () => {
        if (isFullScreen) {
            handleFullScreen();
        } else if (isPoppedOut) {
            if (window.opener && !window.opener.closed) {
                window.opener.focus();
                window.close();
            }
        }
    };

    // ---- Electron mode: native window controls ----
    if (inElectron) {
        const btnBase = {
            width: '46px',
            height: '32px',
            border: 'none',
            background: 'transparent',
            color: theme.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            transition: 'background 0.15s',
            WebkitAppRegion: 'no-drag',
        };

        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                WebkitAppRegion: 'no-drag',
            }}>
                {/* Minimize */}
                <button
                    onClick={() => window.electronAPI.window.minimize()}
                    title={t('ui.minimize')}
                    style={btnBase}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <svg width="12" height="1" viewBox="0 0 12 1">
                        <rect width="12" height="1" fill="currentColor" />
                    </svg>
                </button>

                {/* Maximize / Restore */}
                <button
                    onClick={() => window.electronAPI.window.maximize()}
                    title={isMaximized ? 'Restore' : 'Maximize'}
                    style={btnBase}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                    {isMaximized ? (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect x="2" y="0" width="10" height="10" rx="0" fill="none" stroke="currentColor" strokeWidth="1" />
                            <rect x="0" y="2" width="10" height="10" rx="0" fill={theme.bg || '#1a1a2e'} stroke="currentColor" strokeWidth="1" />
                        </svg>
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect x="0.5" y="0.5" width="11" height="11" rx="0" fill="none" stroke="currentColor" strokeWidth="1" />
                        </svg>
                    )}
                </button>

                {/* Close */}
                <button
                    onClick={() => window.electronAPI.window.close()}
                    title={t('ui.close')}
                    style={btnBase}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.text; }}
                >
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.2" />
                        <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                </button>
            </div>
        );
    }

    // ---- Browser mode: existing fullscreen/pop-out controls ----
    const getCurrentMode = () => {
        if (isFullScreen) return 'Full Screen';
        if (isPoppedOut) return 'Pop-out Window';
        return 'Browser';
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            {/* Mode Indicator */}
            <div style={{
                fontSize: '9px',
                color: theme.textMuted,
                backgroundColor: theme.bg,
                padding: '3px 8px',
                borderRadius: '3px',
                border: `1px solid ${theme.panelBorder}`,
                marginRight: '4px'
            }}>
                {isFullScreen && '\u{1F5A5}\u{FE0F}'}
                {isPoppedOut && '\u{1FA9F}'}
                {!isFullScreen && !isPoppedOut && '\u{1F310}'}
                {' '}
                {getCurrentMode()}
            </div>

            {/* Full Screen Button */}
            <button
                onClick={handleFullScreen}
                title={isFullScreen ? 'Exit Full Screen (ESC)' : 'Enter Full Screen (F11)'}
                style={{
                    padding: '4px 8px',
                    backgroundColor: isFullScreen ? theme.accent : theme.cellInactive,
                    color: isFullScreen ? theme.accentText : theme.text,
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    fontWeight: 'bold'
                }}
                onMouseEnter={(e) => {
                    if (!isFullScreen) e.currentTarget.style.backgroundColor = '#8b4fc9';
                }}
                onMouseLeave={(e) => {
                    if (!isFullScreen) e.currentTarget.style.backgroundColor = theme.cellInactive;
                }}
            >
                {isFullScreen ? '\u26CB' : '\u26F6'}
            </button>

            {/* Pop Out Button */}
            {!isPoppedOut && (
                <button
                    onClick={handlePopOut}
                    title={t('ui.openInSeparateWindow')}
                    style={{
                        padding: '4px 8px',
                        backgroundColor: theme.cellInactive,
                        color: theme.text,
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#8b4fc9';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme.cellInactive;
                    }}
                >
                    {'\u{1F5D7}'}
                </button>
            )}

            {/* Minimize Button */}
            <button
                onClick={handleMinimize}
                title={isPoppedOut ? 'Close Window' : isFullScreen ? 'Exit Full Screen' : 'Minimize (Pop-out only)'}
                style={{
                    padding: '4px 8px',
                    backgroundColor: theme.cellInactive,
                    color: theme.text,
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'all 0.2s',
                    opacity: (!isPoppedOut && !isFullScreen) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                    if (isPoppedOut || isFullScreen) {
                        e.currentTarget.style.backgroundColor = '#8b4fc9';
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.cellInactive;
                }}
            >
                {'\u2212'}
            </button>

            {/* Restore Button */}
            {(isFullScreen || isPoppedOut) && (
                <button
                    onClick={handleRestore}
                    title={t('ui.restoreToBrowser')}
                    style={{
                        padding: '4px 10px',
                        backgroundColor: theme.highlight,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#8b4fc9';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme.highlight;
                    }}
                >
                    {'\u{1F504}'} RESTORE
                </button>
            )}

            {/* Keyboard Shortcuts Info */}
            <div style={{
                fontSize: '8px',
                color: theme.textMuted,
                marginLeft: '8px',
                padding: '2px 6px',
                backgroundColor: theme.bg,
                borderRadius: '2px',
                border: `1px solid ${theme.panelBorder}`
            }}>
                F11: Full Screen &bull; ESC: Exit
            </div>
        </div>
    );
};

export default WindowControls;
