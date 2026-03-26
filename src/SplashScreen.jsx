import React, { useRef, useCallback, useEffect } from 'react';

export default function SplashScreen({ onFinished }) {
    const videoRef = useRef(null);

    // Make page fully transparent during splash so only the video is visible
    useEffect(() => {
        const prevBody = document.body.style.backgroundColor;
        const prevHtml = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
        return () => {
            document.body.style.backgroundColor = prevBody;
            document.documentElement.style.backgroundColor = prevHtml;
        };
    }, []);

    const handleEnded = useCallback(() => {
        // Tell Electron main process to restore window background
        if (window.electronAPI?.splash?.done) {
            window.electronAPI.splash.done();
        }
        if (onFinished) onFinished();
    }, [onFinished]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <video
                ref={videoRef}
                src="/SauceWare_Audio_WavLoom.mp4"
                autoPlay
                muted={false}
                playsInline
                onEnded={handleEnded}
                style={{
                    width: '33vw',
                    height: 'auto',
                    display: 'block',
                    border: 'none',
                    outline: 'none',
                }}
            />
        </div>
    );
}
