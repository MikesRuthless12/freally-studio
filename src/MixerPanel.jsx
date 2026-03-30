import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import Knob from './Knob';
import { hexToRgba } from './accentThemes';
import { buildDefaultTrackOrder } from './trackOrderUtils';
import { useTranslation } from './i18n/I18nContext.jsx';

const TRACKS = ['drums', 'chords', 'melody', 'bass'];
const TRACK_LABEL_KEYS = { drums: 'app.drums', chords: 'app.chords', melody: 'app.melody', bass: 'app.bass' };
const TRACK_COLORS = { drums: '#ff6b6b', chords: '#6bafff', melody: '#6bffb8', bass: '#ffb86b' };

const DRUM_LANES = [
    { id: '808', label: '808', color: '#9b59b6' },
    { id: 'kick', label: 'KICK', color: '#e74c3c' },
    { id: 'clap', label: 'CLAP', color: '#e67e22' },
    { id: 'snare', label: 'SNR', color: '#f39c12' },
    { id: 'offSnare', label: 'OFF', color: '#d4a017' },
    { id: 'closedHat', label: 'CH', color: '#e08455' },
    { id: 'openHat', label: 'OH', color: '#c0392b' },
    { id: 'rim', label: 'RIM', color: '#d35400' },
    { id: 'perc', label: 'PERC', color: '#e84393' }
];

/** Convert linear gain (0-1) to dB string */
const gainToDb = (v) => {
    if (v <= 0.001) return '-inf';
    const db = 20 * Math.log10(v);
    return db.toFixed(1);
};

/**
 * Custom vertical fader with a hardware-style rectangular thumb
 */
const Fader = ({ value, onChange, color, height = 200 }) => {
    const trackRef = useRef(null);
    const dragging = useRef(false);

    const thumbH = 20;
    const trackPad = thumbH / 2;
    const usableH = height - thumbH;
    const thumbY = (1 - value) * usableH;

    const calcValue = useCallback((clientY) => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        const y = clientY - rect.top - trackPad;
        const clamped = Math.max(0, Math.min(usableH, y));
        return 1 - clamped / usableH;
    }, [usableH, trackPad, value]);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragging.current) return;
            e.preventDefault();
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const v = calcValue(clientY);
            onChange(Math.round(v * 100) / 100);
        };
        const onUp = () => { dragging.current = false; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [calcValue, onChange]);

    const onStart = (e) => {
        dragging.current = true;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const v = calcValue(clientY);
        onChange(Math.round(v * 100) / 100);
    };

    return (
        <div
            ref={trackRef}
            onMouseDown={onStart}
            onTouchStart={onStart}
            style={{
                width: '36px',
                height: `${height}px`,
                position: 'relative',
                cursor: 'pointer',
                touchAction: 'none',
                flexShrink: 0
            }}
        >
            {/* Track groove */}
            <div style={{
                position: 'absolute',
                left: '50%',
                top: `${trackPad}px`,
                width: '4px',
                height: `${usableH}px`,
                transform: 'translateX(-50%)',
                background: '#111118',
                borderRadius: '2px',
                border: '1px solid #222230',
                overflow: 'hidden'
            }}>
                {/* Fill from bottom */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '100%',
                    height: `${value * 100}%`,
                    background: `linear-gradient(to top, ${color}88, ${color}44)`,
                    borderRadius: '1px'
                }} />
            </div>

            {/* Center tick marks */}
            {[0, 0.25, 0.5, 0.75, 1].map(tick => (
                <div key={tick} style={{
                    position: 'absolute',
                    top: `${trackPad + (1 - tick) * usableH}px`,
                    left: '3px',
                    width: '5px',
                    height: '1px',
                    background: tick === 0.75 ? '#555' : '#2a2a36',
                    pointerEvents: 'none'
                }} />
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map(tick => (
                <div key={`r${tick}`} style={{
                    position: 'absolute',
                    top: `${trackPad + (1 - tick) * usableH}px`,
                    right: '3px',
                    width: '5px',
                    height: '1px',
                    background: tick === 0.75 ? '#555' : '#2a2a36',
                    pointerEvents: 'none'
                }} />
            ))}

            {/* Thumb — rectangular hardware fader cap */}
            <div style={{
                position: 'absolute',
                top: `${thumbY}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '30px',
                height: `${thumbH}px`,
                borderRadius: '3px',
                background: 'linear-gradient(180deg, #555 0%, #3a3a44 30%, #2a2a34 70%, #222 100%)',
                border: '1px solid #555',
                boxShadow: '0 1px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {/* Center notch line */}
                <div style={{
                    width: '16px',
                    height: '2px',
                    borderRadius: '1px',
                    background: color,
                    boxShadow: `0 0 4px ${color}66`
                }} />
            </div>
        </div>
    );
};

const MixerPanel = forwardRef(({
    sampler,
    trackMix,
    setTrackMix,
    globalMutes,
    setGlobalMutes,
    globalSolos,
    updateGlobalSolo,
    isAnythingSoloed,
    masterVolume,
    setMasterVolume,
    isDark,
    isVisible,
    audioTracks = [],
    onAddAudioTrack,
    onRemoveAudioTrack,
    onRenameAudioTrack,
    midiTracks = [],
    onAddMidiTrack,
    onRemoveMidiTrack,
    onRenameMidiTrack,
    onEditMidiTrack,
    activeSectionId = null, // For filtering clips to active section
    accentColors,
    trackOrder,
    idPrefix = ''}, ref) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const rafRef = useRef(null);
    const mixerScrollRef = useRef(null);
    const prevTrackCountRef = useRef({ midi: midiTracks.length, audio: audioTracks.length });
    const [drumsExpanded, setDrumsExpanded] = useState(false);
    const [expandedAudioTracks, setExpandedAudioTracks] = useState(new Set());

    // Expose tryCollapse to parent: collapses any expanded sections, returns true if something was collapsed
    useImperativeHandle(ref, () => ({
        tryCollapse() {
            if (drumsExpanded || expandedAudioTracks.size > 0) {
                setDrumsExpanded(false);
                setExpandedAudioTracks(new Set());
                return true;
            }
            return false;
        }
    }), [drumsExpanded, expandedAudioTracks]);
    // Auto-scroll to the end when a new track is added
    useEffect(() => {
        const prev = prevTrackCountRef.current;
        const midiGrew = midiTracks.length > prev.midi;
        const audioGrew = audioTracks.length > prev.audio;
        prevTrackCountRef.current = { midi: midiTracks.length, audio: audioTracks.length };
        if ((midiGrew || audioGrew) && mixerScrollRef.current) {
            requestAnimationFrame(() => {
                if (mixerScrollRef.current) {
                    mixerScrollRef.current.scrollLeft = mixerScrollRef.current.scrollWidth;
                }
            });
        }
    }, [midiTracks.length, audioTracks.length]);

    const [renamingTrack, setRenamingTrack] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    // Get clips for a given audio track (filtered by active section if set)
    const getClipsForTrack = useCallback((trackId) => {
        const track = audioTracks.find(t => t.id === trackId);
        if (!track || !track.clips) return [];
        if (activeSectionId) {
            return track.clips.filter(c => c.sectionId === activeSectionId);
        }
        return track.clips;
    }, [audioTracks, activeSectionId]);

    // All track IDs (MIDI + audio + drum lanes + clip IDs when expanded) for VU meter updates
    const allTrackIds = useMemo(() => {
        const ids = [...TRACKS, ...midiTracks.map(t => t.id), ...audioTracks.map(t => t.id), 'master'];
        if (drumsExpanded) {
            DRUM_LANES.forEach(lane => ids.push(`drum_${lane.id}`));
        }
        expandedAudioTracks.forEach(trackId => {
            const clips = getClipsForTrack(trackId);
            clips.forEach(clip => ids.push(`clip_${clip.id}`));
        });
        return ids;
    }, [audioTracks, midiTracks, drumsExpanded, expandedAudioTracks, getClipsForTrack]);

    // VU meter animation — direct DOM updates, NO React state / re-renders.
    useEffect(() => {
        if (!isVisible || !sampler) return;
        let frameCount = 0;
        const tick = () => {
            frameCount++;
            // Update every 3rd frame (~20 fps) — plenty smooth for VU meters
            if (frameCount % 3 === 0) {
                for (const id of allTrackIds) {
                    const level = sampler.getTrackLevel ? sampler.getTrackLevel(id) : 0;
                    const overlay = document.getElementById(`vu-overlay-${idPrefix}${id}`);
                    if (overlay) {
                        let meterPct = 0;
                        if (level > 0.00001) {
                            const dB = 20 * Math.log10(level);
                            meterPct = Math.max(0, Math.min(100, ((dB + 48) / 48) * 100));
                        }
                        overlay.style.height = `${100 - meterPct}%`;
                    }
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [isVisible, sampler, allTrackIds, idPrefix]);

    const handleVolumeChange = useCallback((trackId, value) => {
        setTrackMix(prev => ({ ...prev, [trackId]: { ...prev[trackId], volume: value } }));
        if (sampler?.setTrackVolume && !globalMutes.has(trackId)) {
            sampler.setTrackVolume(trackId, value);
        }
    }, [sampler, setTrackMix, globalMutes]);

    const handlePanChange = useCallback((trackId, value) => {
        setTrackMix(prev => ({ ...prev, [trackId]: { ...prev[trackId], pan: value } }));
        if (trackId === 'master') {
            if (sampler?.setMasterPan) sampler.setMasterPan(value);
        } else {
            if (sampler?.setTrackPan) sampler.setTrackPan(trackId, value);
        }
    }, [sampler, setTrackMix]);

    const handleMute = useCallback((trackId) => {
        setGlobalMutes(prev => {
            const next = new Set(prev);
            if (next.has(trackId)) {
                next.delete(trackId);
                if (sampler?.setTrackVolume) sampler.setTrackVolume(trackId, trackMix[trackId]?.volume ?? 0.5);
            } else {
                next.add(trackId);
                if (sampler?.setTrackVolume) sampler.setTrackVolume(trackId, 0);
            }
            return next;
        });
    }, [sampler, setGlobalMutes, trackMix]);

    const handleSolo = useCallback((trackId, e) => {
        updateGlobalSolo(trackId, !globalSolos.has(trackId), e?.ctrlKey || e?.metaKey);
    }, [updateGlobalSolo, globalSolos]);

    const handleMasterVolumeChange = useCallback((value) => {
        setMasterVolume(value);
        if (sampler?.masterGain) {
            sampler.masterGain.gain.setTargetAtTime(value, sampler.audioContext.currentTime, 0.01);
        }
    }, [sampler, setMasterVolume]);

    const renderStrip = (trackId, color, label, vol, pan, isMuted, isSoloed, dimmed, isMaster = false, onLabelClick = null, isExpanded = false) => {
        const dbStr = gainToDb(vol);
        return (
            <div
                key={trackId}
                style={{
                    flex: 1,
                    maxWidth: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '14px 6px 10px',
                    borderRadius: '6px',
                    background: isMaster
                        ? (isDark ? 'linear-gradient(180deg, #201818 0%, #181214 100%)' : 'linear-gradient(180deg, #f0eaea 0%, #e8e0e0 100%)')
                        : (isDark ? 'linear-gradient(180deg, #18181f 0%, #12121a 100%)' : 'linear-gradient(180deg, #eaeaee 0%, #e2e2e8 100%)'),
                    border: `1px solid ${isDark ? (isMaster ? '#2a2020' : '#1e1e2a') : '#d0d0d8'}`,
                    opacity: dimmed ? 0.3 : 1,
                    transition: 'opacity 0.15s',
                    gap: '6px',
                    minHeight: 0,
                    overflow: 'hidden'
                }}
            >
                {/* Track Label — clickable for expandable tracks */}
                <div
                    onClick={onLabelClick || undefined}
                    style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        color: color,
                        letterSpacing: '1.5px',
                        textShadow: isDark ? `0 0 10px ${color}44` : 'none',
                        flexShrink: 0,
                        cursor: onLabelClick ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        maxWidth: '100%',
                        wordBreak: 'break-word',
                        textAlign: 'center',
                        lineHeight: '1.3',
                        flexWrap: 'wrap'
                    }}
                >
                    {onLabelClick && <span style={{ fontSize: '7px' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>}
                    {label}
                </div>

                {/* Fader + Meter + dB area */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flex: 1,
                    minHeight: 0,
                    justifyContent: 'center'
                }}>
                    {/* VU Meter (updated via direct DOM, not React state) */}
                    <div style={{
                        width: '6px',
                        height: '100%',
                        borderRadius: '3px',
                        position: 'relative',
                        overflow: 'hidden',
                        border: `1px solid ${isDark ? '#1a1a28' : '#b8b8c0'}`,
                        flexShrink: 0
                    }}>
                        {/* Full-height gradient — colors at fixed positions */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            width: '100%',
                            height: '100%',
                            background: isMuted
                                ? '#333'
                                : 'linear-gradient(to top, #22c55e 0%, #22c55e 60%, #eab308 82%, #ef4444 100%)',
                            borderRadius: '2px'
                        }} />
                        {/* Dark overlay — height driven by rAF loop via DOM id */}
                        <div
                            id={`vu-overlay-${idPrefix}${trackId}`}
                            style={{
                                position: 'absolute',
                                top: 0,
                                width: '100%',
                                height: '100%',
                                background: isDark ? '#0a0a12' : '#c8c8d0',
                                borderRadius: '2px',
                                transition: 'height 0.05s linear',
                                zIndex: 1
                            }}
                        />
                    </div>

                    {/* Custom Fader */}
                    <FaderAutoHeight
                        value={vol}
                        onChange={isMaster ? handleMasterVolumeChange : (v) => handleVolumeChange(trackId, v)}
                        color={color}
                    />

                    {/* dB Readout */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minWidth: '28px',
                        flexShrink: 0
                    }}>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: vol <= 0.001 ? '#555'
                                : vol > 0.95 ? '#ef4444'
                                : (isDark ? '#aaa' : '#555'),
                            fontFamily: "'JetBrains Mono', 'Consolas', monospace"
                        }}>
                            {dbStr === '-inf' ? '-\u221E' : dbStr}
                        </span>
                        <span style={{ fontSize: '7px', color: '#555', fontWeight: '600' }}>{t('mixer.dB')}</span>
                    </div>
                </div>

                {/* Pan Knob */}
                <div style={{ flexShrink: 0 }}>
                    <Knob
                        label={t('mixer.pan')}
                        value={pan}
                        min={-1}
                        max={1}
                        onChange={(v) => handlePanChange(trackId, v)}
                        color={color}
                        size={34}
                    />
                </div>

                {/* M / S Buttons (tracks) or Volume % (master) */}
                {isMaster ? (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, height: '22px', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#666' }}>
                            {Math.round(vol * 100)}%
                        </span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button
                            onClick={() => handleMute(trackId)}
                            style={{
                                width: '32px',
                                height: '22px',
                                fontSize: '9px',
                                fontWeight: '900',
                                border: `1px solid ${isMuted ? '#ff4444' : '#2a2a36'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                background: isMuted
                                    ? 'linear-gradient(180deg, #ff5555 0%, #cc3333 100%)'
                                    : 'linear-gradient(180deg, #222230 0%, #1a1a24 100%)',
                                color: isMuted ? '#fff' : '#666',
                                padding: 0
                            }}
                            title={t('mixer.mute')}
                        >
                            M
                        </button>
                        <button
                            onClick={(e) => handleSolo(trackId, e)}
                            style={{
                                width: '32px',
                                height: '22px',
                                fontSize: '9px',
                                fontWeight: '900',
                                border: `1px solid ${isSoloed ? '#ddaa00' : '#2a2a36'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                background: isSoloed
                                    ? 'linear-gradient(180deg, #ffdd33 0%, #ccaa00 100%)'
                                    : 'linear-gradient(180deg, #222230 0%, #1a1a24 100%)',
                                color: isSoloed ? '#111' : '#666',
                                padding: 0
                            }}
                            title={t('mixer.soloCtrl')}
                        >
                            S
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: isDark
                ? 'linear-gradient(180deg, #0e0e14 0%, #0a0a10 100%)'
                : '#f5f5f8',
            fontFamily: "'Inter', system-ui, sans-serif",
            userSelect: 'none',
            padding: '16px 20px',
            boxSizing: 'border-box',
            overflow: 'hidden'
        }}>
            <div ref={mixerScrollRef} style={{
                flex: 1,
                display: 'flex',
                gap: '6px',
                minHeight: 0,
                justifyContent: (audioTracks.length + midiTracks.length > 4) ? 'flex-start' : 'center',
                alignItems: 'stretch',
                overflowX: 'auto',
                overflowY: 'hidden'
            }}>
                {/* Track strips in unified order */}
                {(trackOrder || buildDefaultTrackOrder(midiTracks, audioTracks)).map((entry, idx, arr) => {
                    // Dynamic separator when type changes
                    const prevType = idx > 0 ? arr[idx - 1].type : null;
                    const showSep = prevType && prevType !== entry.type;
                    const sepEl = showSep ? (
                        <div key={`sep-${idx}`} style={{
                            width: '1px',
                            background: 'linear-gradient(180deg, #555 0%, #1a1a24 100%)',
                            margin: '14px 4px',
                            flexShrink: 0
                        }} />
                    ) : null;

                    if (entry.type === 'core' && entry.id === 'drums') {
                        const trackId = 'drums';
                        const isMuted = globalMutes.has(trackId);
                        const isSoloed = globalSolos.has(trackId);
                        const vol = trackMix[trackId]?.volume ?? 0.5;
                        const pan = trackMix[trackId]?.pan ?? 0;
                        const color = ac;
                        const dimmed = isAnythingSoloed && !isSoloed;
                        return (
                            <React.Fragment key={trackId}>
                                {sepEl}
                                <div style={{ flex: 1, maxWidth: '180px', display: 'flex', flexDirection: 'column' }}>
                                    {renderStrip(trackId, color, t(TRACK_LABEL_KEYS[trackId]), vol, pan, isMuted, isSoloed, dimmed, false, () => setDrumsExpanded(prev => !prev), drumsExpanded)}
                                </div>
                                {drumsExpanded && (
                                    <>
                                        <div style={{
                                            width: '1px',
                                            background: `linear-gradient(180deg, ${color}44 0%, ${color}11 100%)`,
                                            margin: '14px 1px',
                                            flexShrink: 0
                                        }} />
                                        {DRUM_LANES.map(lane => {
                                            const laneVol = trackMix[`drum_${lane.id}`]?.volume ?? 0.5;
                                            const lanePan = trackMix[`drum_${lane.id}`]?.pan ?? 0;
                                            const laneMuted = globalMutes.has(`drum_${lane.id}`);
                                            const laneSoloed = globalSolos.has(`drum_${lane.id}`);
                                            const laneDimmed = isAnythingSoloed && !laneSoloed;
                                            return (
                                                <div key={lane.id} style={{ flex: 0.6, maxWidth: '100px', display: 'flex', flexDirection: 'column' }}>
                                                    {renderStrip(`drum_${lane.id}`, lane.color, lane.label, laneVol, lanePan, laneMuted, laneSoloed, laneDimmed)}
                                                </div>
                                            );
                                        })}
                                        <div style={{
                                            width: '1px',
                                            background: `linear-gradient(180deg, ${color}44 0%, ${color}11 100%)`,
                                            margin: '14px 1px',
                                            flexShrink: 0
                                        }} />
                                    </>
                                )}
                            </React.Fragment>
                        );
                    }

                    if (entry.type === 'core') {
                        const trackId = entry.id;
                        const isMuted = globalMutes.has(trackId);
                        const isSoloed = globalSolos.has(trackId);
                        const vol = trackMix[trackId]?.volume ?? 0.5;
                        const pan = trackMix[trackId]?.pan ?? 0;
                        const color = ac;
                        const dimmed = isAnythingSoloed && !isSoloed;
                        return (
                            <React.Fragment key={trackId}>
                                {sepEl}
                                {renderStrip(trackId, color, t(TRACK_LABEL_KEYS[trackId]), vol, pan, isMuted, isSoloed, dimmed)}
                            </React.Fragment>
                        );
                    }

                    if (entry.type === 'midi') {
                        const mt = midiTracks.find(t => t.id === entry.id);
                        if (!mt) return null;
                        const isMuted = globalMutes.has(mt.id);
                        const isSoloed = globalSolos.has(mt.id);
                        const vol = trackMix[mt.id]?.volume ?? 0.5;
                        const pan = trackMix[mt.id]?.pan ?? 0;
                        const dimmed = isAnythingSoloed && !isSoloed;
                        return (
                            <React.Fragment key={mt.id}>
                                {sepEl}
                                <div
                                    onDoubleClick={() => { if (onEditMidiTrack) onEditMidiTrack(mt.id); }}
                                    style={{ flex: 1, maxWidth: '180px', display: 'flex', flexDirection: 'column', position: 'relative', cursor: 'pointer' }}
                                    title={t('ui.doubleClickPianoRoll')}
                                >
                                    {renamingTrack === mt.id ? (
                                        <input
                                            autoFocus
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value.slice(0, 30))}
                                            onBlur={() => {
                                                if (renameValue.trim() && onRenameMidiTrack) onRenameMidiTrack(mt.id, renameValue.trim());
                                                setRenamingTrack(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (renameValue.trim() && onRenameMidiTrack) onRenameMidiTrack(mt.id, renameValue.trim());
                                                    setRenamingTrack(null);
                                                }
                                                if (e.key === 'Escape') setRenamingTrack(null);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                            style={{
                                                position: 'absolute', top: '6px', left: '6px', right: '6px', zIndex: 10,
                                                fontSize: '9px', fontWeight: '700', background: isDark ? '#1a1a22' : '#fff',
                                                color: mt.color, border: `1px solid ${mt.color}`, borderRadius: '3px',
                                                padding: '2px 4px', outline: 'none', textAlign: 'center',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    ) : null}
                                    {renderStrip(mt.id, mt.color, mt.name.toUpperCase(), vol, pan, isMuted, isSoloed, dimmed)}
                                </div>
                            </React.Fragment>
                        );
                    }

                    if (entry.type === 'audio') {
                        const at = audioTracks.find(t => t.id === entry.id);
                        if (!at) return null;
                        const isMuted = globalMutes.has(at.id);
                        const isSoloed = globalSolos.has(at.id);
                        const vol = trackMix[at.id]?.volume ?? 0.5;
                        const pan = trackMix[at.id]?.pan ?? 0;
                        const dimmed = isAnythingSoloed && !isSoloed;
                        const isExpanded = expandedAudioTracks.has(at.id);
                        const clips = getClipsForTrack(at.id);
                        const hasClips = clips.length > 0;
                        return (
                            <React.Fragment key={at.id}>
                                {sepEl}
                                <div
                                    onDoubleClick={() => { setRenamingTrack(at.id); setRenameValue(at.name); }}
                                    style={{ flex: 1, maxWidth: '180px', display: 'flex', flexDirection: 'column', position: 'relative' }}
                                >
                                    {renamingTrack === at.id ? (
                                        <input
                                            autoFocus
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value.slice(0, 30))}
                                            onBlur={() => {
                                                if (renameValue.trim() && onRenameAudioTrack) onRenameAudioTrack(at.id, renameValue.trim());
                                                setRenamingTrack(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (renameValue.trim() && onRenameAudioTrack) onRenameAudioTrack(at.id, renameValue.trim());
                                                    setRenamingTrack(null);
                                                }
                                                if (e.key === 'Escape') setRenamingTrack(null);
                                            }}
                                            style={{
                                                position: 'absolute', top: '6px', left: '6px', right: '6px', zIndex: 10,
                                                fontSize: '9px', fontWeight: '700', background: isDark ? '#1a1a22' : '#fff',
                                                color: at.color, border: `1px solid ${at.color}`, borderRadius: '3px',
                                                padding: '2px 4px', outline: 'none', textAlign: 'center',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    ) : null}
                                    {renderStrip(at.id, at.color, at.name.toUpperCase(), vol, pan, isMuted, isSoloed, dimmed, false,
                                        hasClips ? () => setExpandedAudioTracks(prev => {
                                            const next = new Set(prev);
                                            if (next.has(at.id)) next.delete(at.id);
                                            else next.add(at.id);
                                            return next;
                                        }) : null,
                                        isExpanded
                                    )}
                                </div>
                                {isExpanded && hasClips && (
                                    <>
                                        <div style={{
                                            width: '1px',
                                            background: `linear-gradient(180deg, ${at.color}44 0%, ${at.color}11 100%)`,
                                            margin: '14px 1px',
                                            flexShrink: 0
                                        }} />
                                        {clips.map((clip, ci) => {
                                            const clipKey = `clip_${clip.id}`;
                                            const clipVol = trackMix[clipKey]?.volume ?? 0.5;
                                            const clipPan = trackMix[clipKey]?.pan ?? 0;
                                            const clipMuted = globalMutes.has(clipKey);
                                            const clipSoloed = globalSolos.has(clipKey);
                                            const clipDimmed = isAnythingSoloed && !clipSoloed;
                                            const clipLabel = (clip.name || `Clip ${ci + 1}`).toUpperCase().slice(0, 8);
                                            return (
                                                <div key={clip.id} style={{ flex: 0.6, maxWidth: '100px', display: 'flex', flexDirection: 'column' }}>
                                                    {renderStrip(clipKey, at.color, clipLabel, clipVol, clipPan, clipMuted, clipSoloed, clipDimmed)}
                                                </div>
                                            );
                                        })}
                                        <div style={{
                                            width: '1px',
                                            background: `linear-gradient(180deg, ${at.color}44 0%, ${at.color}11 100%)`,
                                            margin: '14px 1px',
                                            flexShrink: 0
                                        }} />
                                    </>
                                )}
                            </React.Fragment>
                        );
                    }

                    return null;
                })}

                {/* Add Track buttons */}
                {onAddMidiTrack && midiTracks.length < 100 && (
                    <div
                        onClick={onAddMidiTrack}
                        title={t('mixer.addMidiTrack')}
                        style={{
                            width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', borderRadius: '6px', flexShrink: 0,
                            border: `1px dashed ${isDark ? '#333' : '#bbb'}`,
                            color: isDark ? '#555' : '#aaa', fontSize: '12px', fontWeight: '700',
                            transition: 'border-color 0.15s, color 0.15s',
                            flexDirection: 'column', gap: '2px'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c56cf0'; e.currentTarget.style.color = '#c56cf0'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDark ? '#333' : '#bbb'; e.currentTarget.style.color = isDark ? '#555' : '#aaa'; }}
                    >
                        <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
                        <span style={{ fontSize: '7px', letterSpacing: '0.3px' }}>{t('mixer.midi')}</span>
                    </div>
                )}
                {onAddAudioTrack && audioTracks.length < 100 && (
                    <div
                        onClick={onAddAudioTrack}
                        title={t('mixer.addAudioTrack')}
                        style={{
                            width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', borderRadius: '6px', flexShrink: 0,
                            border: `1px dashed ${isDark ? '#333' : '#bbb'}`,
                            color: isDark ? '#555' : '#aaa', fontSize: '12px', fontWeight: '700',
                            transition: 'border-color 0.15s, color 0.15s',
                            flexDirection: 'column', gap: '2px'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ff9ff3'; e.currentTarget.style.color = '#ff9ff3'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDark ? '#333' : '#bbb'; e.currentTarget.style.color = isDark ? '#555' : '#aaa'; }}
                    >
                        <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
                        <span style={{ fontSize: '7px', letterSpacing: '0.3px' }}>{t('mixer.audio')}</span>
                    </div>
                )}

                {/* Separator */}
                <div style={{
                    width: '1px',
                    background: 'linear-gradient(180deg, #333 0%, #1a1a24 100%)',
                    margin: '14px 4px',
                    flexShrink: 0
                }} />

                {/* Master */}
                {renderStrip('master', ac, t('mixer.master'), masterVolume, trackMix.master?.pan ?? 0, false, false, false, true)}
            </div>
        </div>
    );
});

/**
 * Wrapper that measures its parent and passes height to Fader
 */
const FaderAutoHeight = ({ value, onChange, color }) => {
    const ref = useRef(null);
    const [h, setH] = useState(200);

    useEffect(() => {
        if (!ref.current) return;
        const ro = new ResizeObserver(([entry]) => {
            setH(Math.floor(entry.contentRect.height));
        });
        ro.observe(ref.current.parentElement);
        return () => ro.disconnect();
    }, []);

    return (
        <div ref={ref} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
            <Fader value={value} onChange={onChange} color={color} height={Math.max(60, h)} />
        </div>
    );
};

export default MixerPanel;
