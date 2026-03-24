import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from './i18n/I18nContext.jsx';

const ArrangementViewEnhanced = ({ theme, audioEngine }) => {
    const { t } = useTranslation();
    const defaultTracks = useMemo(() => [
        { id: 1, name: t('arrange.drums'), clips: [], color: '#ff6b6b', height: 80 },
        { id: 2, name: t('arrange.bass'), clips: [], color: '#4ecdc4', height: 80 },
        { id: 3, name: t('arrange.melody'), clips: [], color: '#45b7d1', height: 80 },
        { id: 4, name: t('arrange.chords'), clips: [], color: '#f9ca24', height: 80 }
    ], [t]);
    const [tracks, setTracks] = useState(defaultTracks);

    const [isPlaying, setIsPlaying] = useState(false);
    const [playheadPosition, setPlayheadPosition] = useState(0);
    const [zoom, setZoom] = useState(50); // pixels per second
    const [selectedClip, setSelectedClip] = useState(null);
    const [loopEnabled, setLoopEnabled] = useState(false);
    const [loopStart, setLoopStart] = useState(0);
    const [loopEnd, setLoopEnd] = useState(8);
    const [isDraggingLoop, setIsDraggingLoop] = useState(null); // 'start', 'end', or 'region'
    const [showClipMenu, setShowClipMenu] = useState(null);
    
    const containerRef = useRef(null);
    const animationFrameRef = useRef(null);
    const lastTimeRef = useRef(0);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Spacebar - Play/Stop
            if (e.code === 'Space' && !e.ctrlKey) {
                e.preventDefault();
                togglePlayback();
            }
            // Ctrl+Space - Play from start
            else if (e.code === 'Space' && e.ctrlKey) {
                e.preventDefault();
                playFromStart();
            }
            // L - Toggle loop
            else if (e.code === 'KeyL' && e.ctrlKey) {
                e.preventDefault();
                setLoopEnabled(!loopEnabled);
            }
            // [ - Set loop start at playhead
            else if (e.code === 'BracketLeft') {
                e.preventDefault();
                setLoopStart(playheadPosition);
            }
            // ] - Set loop end at playhead
            else if (e.code === 'BracketRight') {
                e.preventDefault();
                setLoopEnd(playheadPosition);
            }
            // Delete - Remove selected clip
            else if (e.code === 'Delete' && selectedClip) {
                e.preventDefault();
                removeClip(selectedClip);
            }
            // Ctrl+D - Duplicate selected clip
            else if (e.code === 'KeyD' && e.ctrlKey && selectedClip) {
                e.preventDefault();
                duplicateClip(selectedClip);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, loopEnabled, playheadPosition, selectedClip]);

    // Playback animation
    useEffect(() => {
        if (isPlaying) {
            lastTimeRef.current = performance.now();
            animate();
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, loopEnabled, loopStart, loopEnd]);

    const animate = () => {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
        lastTimeRef.current = currentTime;

        setPlayheadPosition(prev => {
            let newPosition = prev + deltaTime;

            // Loop behavior
            if (loopEnabled) {
                if (newPosition >= loopEnd) {
                    newPosition = loopStart;
                }
            }

            return newPosition;
        });

        animationFrameRef.current = requestAnimationFrame(animate);
    };

    const togglePlayback = () => {
        setIsPlaying(!isPlaying);
    };

    const playFromStart = () => {
        setPlayheadPosition(loopEnabled ? loopStart : 0);
        setIsPlaying(true);
    };

    const stopPlayback = () => {
        setIsPlaying(false);
        setPlayheadPosition(loopEnabled ? loopStart : 0);
    };

    const removeClip = (clipId) => {
        setTracks(tracks.map(track => ({
            ...track,
            clips: track.clips.filter(clip => clip.id !== clipId)
        })));
        setSelectedClip(null);
    };

    const duplicateClip = (clipId) => {
        setTracks(tracks.map(track => {
            const clip = track.clips.find(c => c.id === clipId);
            if (clip) {
                const newClip = {
                    ...clip,
                    id: Date.now(),
                    startTime: clip.startTime + clip.duration
                };
                return {
                    ...track,
                    clips: [...track.clips, newClip]
                };
            }
            return track;
        }));
    };

    const handleLoopMarkerMouseDown = (e, type) => {
        e.stopPropagation();
        setIsDraggingLoop(type);
    };

    const handleMouseMove = useCallback((e) => {
        if (isDraggingLoop && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = Math.max(0, x / zoom);

            if (isDraggingLoop === 'start') {
                setLoopStart(Math.min(time, loopEnd - 0.1));
            } else if (isDraggingLoop === 'end') {
                setLoopEnd(Math.max(time, loopStart + 0.1));
            } else if (isDraggingLoop === 'region') {
                const duration = loopEnd - loopStart;
                setLoopStart(time);
                setLoopEnd(time + duration);
            }
        }
    }, [isDraggingLoop, zoom, loopStart, loopEnd]);

    const handleMouseUp = useCallback(() => {
        setIsDraggingLoop(null);
    }, []);

    useEffect(() => {
        if (isDraggingLoop) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDraggingLoop, handleMouseMove, handleMouseUp]);

    const handleTimelineClick = (e) => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = Math.max(0, x / zoom);
            setPlayheadPosition(time);
        }
    };

    const handleClipContextMenu = (e, clip) => {
        e.preventDefault();
        setShowClipMenu({ x: e.clientX, y: e.clientY, clip });
    };

    const applyClipEffect = async (effect) => {
        if (!showClipMenu) return;

        const clip = showClipMenu.clip;
        
        // Apply effect based on type
        switch (effect) {
            case 'reverse':
                // Call audioClipEditor.reverseAudio()
                console.log('Reversing clip:', clip.id);
                break;
            case 'timeStretch':
                console.log('Time stretching clip:', clip.id);
                break;
            case 'pitchShift':
                console.log('Pitch shifting clip:', clip.id);
                break;
            case 'normalize':
                console.log('Normalizing clip:', clip.id);
                break;
            case 'fadeIn':
                console.log('Adding fade in:', clip.id);
                break;
            case 'fadeOut':
                console.log('Adding fade out:', clip.id);
                break;
        }

        setShowClipMenu(null);
    };

    const renderTrack = (track) => {
        return (
            <div
                key={track.id}
                style={{
                    height: `${track.height}px`,
                    borderBottom: `1px solid ${theme.panelBorder}`,
                    display: 'flex',
                    position: 'relative'
                }}
            >
                {/* Track Header */}
                <div style={{
                    width: '150px',
                    backgroundColor: theme.panel,
                    borderRight: `1px solid ${theme.panelBorder}`,
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: track.color
                    }}>
                        {track.name}
                    </div>
                    <div style={{
                        fontSize: '9px',
                        color: theme.textMuted
                    }}>
                        {t('arrange.clips', { count: track.clips.length })}
                    </div>
                </div>

                {/* Track Timeline */}
                <div style={{
                    flex: 1,
                    position: 'relative',
                    backgroundColor: theme.bg
                }}>
                    {/* Grid lines */}
                    {Array.from({ length: 32 }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                left: `${i * zoom}px`,
                                top: 0,
                                bottom: 0,
                                width: '1px',
                                backgroundColor: i % 4 === 0 ? theme.panelBorder : theme.cellInactive,
                                opacity: i % 4 === 0 ? 0.5 : 0.2
                            }}
                        />
                    ))}

                    {/* Clips */}
                    {track.clips.map(clip => (
                        <div
                            key={clip.id}
                            onClick={() => setSelectedClip(clip.id)}
                            onContextMenu={(e) => handleClipContextMenu(e, clip)}
                            style={{
                                position: 'absolute',
                                left: `${clip.startTime * zoom}px`,
                                top: '4px',
                                width: `${clip.duration * zoom}px`,
                                height: `${track.height - 8}px`,
                                backgroundColor: track.color,
                                borderRadius: '4px',
                                border: selectedClip === clip.id ? `2px solid #fff` : 'none',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                boxShadow: selectedClip === clip.id ? `0 0 15px ${track.color}` : 'none',
                                transition: 'box-shadow 0.2s'
                            }}
                        >
                            {/* Clip name */}
                            <div style={{
                                padding: '4px 6px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                color: '#fff',
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {clip.name}
                            </div>

                            {/* Waveform placeholder */}
                            <div style={{
                                padding: '0 4px',
                                height: 'calc(100% - 24px)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1px'
                            }}>
                                {Array.from({ length: Math.floor(clip.duration * 10) }).map((_, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            width: '2px',
                                            height: `${Math.random() * 80 + 20}%`,
                                            backgroundColor: 'rgba(255, 255, 255, 0.5)',
                                            borderRadius: '1px'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.bg
        }}>
            {/* Transport Controls */}
            <div style={{
                padding: '12px 16px',
                backgroundColor: theme.panel,
                borderBottom: `1px solid ${theme.panelBorder}`,
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
            }}>
                <button
                    onClick={playFromStart}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: theme.cellInactive,
                        color: theme.text,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                    title={t('arrange.playFromStart')}
                >
                    ⏮
                </button>

                <button
                    onClick={togglePlayback}
                    style={{
                        padding: '8px 24px',
                        backgroundColor: isPlaying ? theme.danger : theme.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        boxShadow: isPlaying ? `0 0 15px ${theme.danger}` : `0 0 15px ${theme.accent}`
                    }}
                    title={t('arrange.playPause')}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>

                <button
                    onClick={stopPlayback}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: theme.cellInactive,
                        color: theme.text,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                    title={t('arrange.stop')}
                >
                    ⏹
                </button>

                <div style={{
                    width: '1px',
                    height: '30px',
                    backgroundColor: theme.panelBorder
                }} />

                <button
                    onClick={() => setLoopEnabled(!loopEnabled)}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: loopEnabled ? theme.accent : theme.cellInactive,
                        color: loopEnabled ? '#fff' : theme.text,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        boxShadow: loopEnabled ? `0 0 15px ${theme.accent}` : 'none',
                        transition: 'all 0.2s'
                    }}
                    title={t('arrange.toggleLoop')}
                >
                    🔁 {t('arrange.loopLabel')}
                </button>

                <div style={{
                    fontSize: '11px',
                    color: theme.textMuted,
                    display: 'flex',
                    gap: '8px'
                }}>
                    <span>{t('arrange.loopLabel')}: {loopStart.toFixed(2)}s - {loopEnd.toFixed(2)}s</span>
                </div>

                <div style={{ flex: 1 }} />

                <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: theme.accent,
                    fontFamily: 'monospace'
                }}>
                    {playheadPosition.toFixed(2)}s
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span style={{ fontSize: '11px', color: theme.textMuted }}>Zoom:</span>
                    <input
                        type="range"
                        min="20"
                        max="200"
                        value={zoom}
                        onChange={(e) => setZoom(parseInt(e.target.value))}
                        style={{ width: '100px' }}
                    />
                </div>
            </div>

            {/* Timeline Ruler */}
            <div
                ref={containerRef}
                onClick={handleTimelineClick}
                style={{
                    height: '40px',
                    backgroundColor: theme.panel,
                    borderBottom: `1px solid ${theme.panelBorder}`,
                    position: 'relative',
                    cursor: 'pointer',
                    marginLeft: '150px'
                }}
            >
                {/* Time markers */}
                {Array.from({ length: 32 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${i * zoom}px`,
                            top: '8px',
                            fontSize: '10px',
                            color: theme.textMuted
                        }}
                    >
                        {i}s
                    </div>
                ))}

                {/* Loop region */}
                {loopEnabled && (
                    <>
                        <div
                            onMouseDown={(e) => handleLoopMarkerMouseDown(e, 'region')}
                            style={{
                                position: 'absolute',
                                left: `${loopStart * zoom}px`,
                                width: `${(loopEnd - loopStart) * zoom}px`,
                                top: 0,
                                bottom: 0,
                                backgroundColor: `${theme.accent}30`,
                                border: `2px solid ${theme.accent}`,
                                cursor: 'move',
                                pointerEvents: 'auto'
                            }}
                        />
                        
                        {/* Loop start marker */}
                        <div
                            onMouseDown={(e) => handleLoopMarkerMouseDown(e, 'start')}
                            style={{
                                position: 'absolute',
                                left: `${loopStart * zoom - 5}px`,
                                top: 0,
                                width: '10px',
                                height: '100%',
                                backgroundColor: theme.accent,
                                cursor: 'ew-resize',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                boxShadow: `0 0 10px ${theme.accent}`
                            }}
                        >
                            [
                        </div>

                        {/* Loop end marker */}
                        <div
                            onMouseDown={(e) => handleLoopMarkerMouseDown(e, 'end')}
                            style={{
                                position: 'absolute',
                                left: `${loopEnd * zoom - 5}px`,
                                top: 0,
                                width: '10px',
                                height: '100%',
                                backgroundColor: theme.accent,
                                cursor: 'ew-resize',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                boxShadow: `0 0 10px ${theme.accent}`
                            }}
                        >
                            ]
                        </div>
                    </>
                )}

                {/* Playhead */}
                <div
                    style={{
                        position: 'absolute',
                        left: `${playheadPosition * zoom}px`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: '#fff',
                        boxShadow: '0 0 10px #fff',
                        pointerEvents: 'none',
                        zIndex: 100
                    }}
                >
                    <div style={{
                        width: '0',
                        height: '0',
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: '8px solid #fff',
                        marginLeft: '-5px'
                    }} />
                </div>
            </div>

            {/* Tracks */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                position: 'relative'
            }}>
                {tracks.map(renderTrack)}

                {/* Playhead (extends through tracks) */}
                <div
                    style={{
                        position: 'absolute',
                        left: `${150 + playheadPosition * zoom}px`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: '#fff',
                        opacity: 0.5,
                        pointerEvents: 'none',
                        zIndex: 50
                    }}
                />

                {/* Loop region overlay on tracks */}
                {loopEnabled && (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${150 + loopStart * zoom}px`,
                            width: `${(loopEnd - loopStart) * zoom}px`,
                            top: 0,
                            bottom: 0,
                            backgroundColor: `${theme.accent}10`,
                            border: `1px solid ${theme.accent}40`,
                            pointerEvents: 'none',
                            zIndex: 1
                        }}
                    />
                )}
            </div>

            {/* Clip Context Menu */}
            {showClipMenu && (
                <>
                    <div
                        onClick={() => setShowClipMenu(null)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 999
                        }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            left: showClipMenu.x,
                            top: showClipMenu.y,
                            backgroundColor: theme.panel,
                            border: `1px solid ${theme.panelBorder}`,
                            borderRadius: '6px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                            zIndex: 1000,
                            minWidth: '180px'
                        }}
                    >
                        {[
                            { label: '🔄 Reverse', action: 'reverse' },
                            { label: '⏱️ Time Stretch', action: 'timeStretch' },
                            { label: '🎵 Pitch Shift', action: 'pitchShift' },
                            { label: '📊 Normalize', action: 'normalize' },
                            { label: '📈 Fade In', action: 'fadeIn' },
                            { label: '📉 Fade Out', action: 'fadeOut' }
                        ].map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => applyClipEffect(item.action)}
                                style={{
                                    padding: '10px 16px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: theme.text,
                                    borderBottom: idx < 5 ? `1px solid ${theme.panelBorder}` : 'none',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.accent;
                                    e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = theme.text;
                                }}
                            >
                                {item.label}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ArrangementViewEnhanced;
