import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GM_DRUM_MAP } from './MIDIInput';
import { hexToRgba } from './accentThemes';

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiNoteToName(note) {
    const octave = Math.floor(note / 12) - 1;
    return `${NOTE_NAMES_SHARP[note % 12]}${octave}`;
}

/**
 * MIDIInputPanel — compact collapsible panel for MIDI controller settings.
 *
 * Props:
 *  midiInput        — MIDIInput instance
 *  isDark           — theme flag
 *  activeTab        — 'drums'|'chords'|'melody'|'bass'
 *  globalIsPlaying  — playback state
 *  globalCurrentStepRef — ref to current step (polled in rAF)
 *  globalResolution — grid resolution (4/8/16/32)
 *  globalBars       — total bars
 *  globalTempo      — BPM
 *  samplerRef       — ref to SamplerEngine
 *  loadedInstruments — { chords, melody, bass } instrument ids
 *  patterns         — { drums, chords, melody, bass } current patterns
 *  setPatterns      — state setter for patterns
 *  drumRef          — ref to DrumGeneratorEnhanced (for drum state updates)
 *  octaveOffset     — controlled from parent
 *  setOctaveOffset  — setter
 */
const MIDIInputPanel = ({
    midiInput,
    isDark,
    activeTab,
    globalIsPlaying,
    globalCurrentStepRef,
    globalResolution,
    globalBars,
    globalTempo,
    samplerRef,
    loadedInstruments,
    patterns,
    setPatterns,
    drumRef,
    octaveOffset,
    setOctaveOffset, accentColors}) => {
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const [expanded, setExpanded] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [connected, setConnected] = useState(false);
    const [inputMode, setInputMode] = useState('live'); // 'live' | 'stepInput' | 'realtime'
    const [overdub, setOverdub] = useState(true);
    const [channelFilter, setChannelFilter] = useState(0); // 0=All
    const [lastNote, setLastNote] = useState(null); // { name, velocity }

    // Step-input cursor
    const stepCursorRef = useRef(0);

    // Chord grouping for step input (multiple notes within 50ms)
    const chordBufferRef = useRef([]);
    const chordTimerRef = useRef(null);

    // Real-time recording: track active notes for duration calculation
    const activeNotesRef = useRef(new Map()); // midiNote → { startStep }

    // Refresh devices list
    const refreshDevices = useCallback(() => {
        if (!midiInput) return;
        const list = midiInput.getInputDevices();
        setDevices(list);
        if (midiInput.activeInput) {
            setSelectedDevice(midiInput.activeInput.id);
            setConnected(true);
        }
    }, [midiInput]);

    // Init MIDI on mount
    useEffect(() => {
        if (!midiInput) return;
        midiInput.init().then((ok) => {
            if (ok) refreshDevices();
        });
    }, [midiInput, refreshDevices]);

    // Refresh devices periodically (hot-plug)
    useEffect(() => {
        const interval = setInterval(refreshDevices, 3000);
        return () => clearInterval(interval);
    }, [refreshDevices]);

    // Device selection
    const handleDeviceChange = useCallback((e) => {
        const id = e.target.value;
        setSelectedDevice(id);
        if (id && midiInput) {
            midiInput.selectInput(id);
            setConnected(true);
        } else {
            midiInput?.disconnect();
            setConnected(false);
        }
    }, [midiInput]);

    // Channel filter sync
    useEffect(() => {
        if (midiInput) midiInput.channelFilter = channelFilter;
    }, [midiInput, channelFilter]);

    // ==========================================
    // Core MIDI event handlers
    // ==========================================

    const applyOctaveOffset = useCallback((note) => {
        return Math.max(0, Math.min(127, note + octaveOffset * 12));
    }, [octaveOffset]);

    // ---------- Live monitor + Step/Realtime recording ----------

    const handleNoteOn = useCallback((rawNote, velocity, _channel) => {
        const note = applyOctaveOffset(rawNote);
        const vel = velocity / 127; // normalise to 0-1
        setLastNote({ name: midiNoteToName(note), velocity });

        const sampler = samplerRef?.current;
        const totalSteps = globalBars * 32;

        // --- Drums tab ---
        if (activeTab === 'drums') {
            const drumId = GM_DRUM_MAP[rawNote] || GM_DRUM_MAP[note]; // try raw first (GM standard)
            if (drumId && sampler) {
                // Play the hit immediately through the sampler
                const pitch = 48 + (rawNote % 12); // centre around C3
                sampler.playNote(drumId, pitch, vel, 0.3, null, 'drums');
            }

            // Step input for drums — add to pattern at cursor
            if (inputMode === 'stepInput' && drumId && drumRef?.current) {
                // We don't directly call updateNote on the drum generator because
                // it's not exposed via ref. Instead dispatch a custom event the
                // drum generator can optionally listen to.
                window.dispatchEvent(new CustomEvent('midi-drum-step', {
                    detail: { drumId, step: stepCursorRef.current % totalSteps, velocity: vel }
                }));
                // Advance cursor
                const stepSize = Math.max(1, 32 / globalResolution);
                stepCursorRef.current = (stepCursorRef.current + stepSize) % totalSteps;
            }

            // Real-time recording for drums
            if (inputMode === 'realtime' && globalIsPlaying && drumId) {
                const currentStep = globalCurrentStepRef?.current ?? 0;
                const stepSize = Math.max(1, 32 / globalResolution);
                const quantized = Math.round(currentStep / stepSize) * stepSize;
                window.dispatchEvent(new CustomEvent('midi-drum-step', {
                    detail: { drumId, step: quantized % totalSteps, velocity: vel }
                }));
            }
            return;
        }

        // --- Melodic tabs (chords / melody / bass) ---
        const trackId = activeTab; // 'chords' | 'melody' | 'bass'
        const instrumentId = loadedInstruments?.[trackId];

        // Always play the note for live monitoring
        if (sampler) {
            const stepDur = 60 / globalTempo / 8; // seconds per step
            const dur = stepDur * Math.max(1, 32 / globalResolution);
            sampler.playNote(instrumentId || trackId, note, vel, dur, null, trackId);
        }

        // Highlight on piano roll via custom event
        window.dispatchEvent(new CustomEvent('midi-note-highlight', {
            detail: { note, on: true }
        }));

        // --- Step input ---
        if (inputMode === 'stepInput') {
            const stepSize = Math.max(1, 32 / globalResolution);
            const noteObj = {
                time: stepCursorRef.current % totalSteps,
                duration: stepSize,
                note,
                velocity: vel
            };

            // Buffer for chord grouping (50ms window)
            chordBufferRef.current.push(noteObj);
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
            chordTimerRef.current = setTimeout(() => {
                const notes = [...chordBufferRef.current];
                chordBufferRef.current = [];
                setPatterns(prev => ({
                    ...prev,
                    [trackId]: [...(prev[trackId] || []), ...notes]
                }));
                // Advance cursor after chord group
                stepCursorRef.current = (stepCursorRef.current + stepSize) % totalSteps;
                // Notify piano roll of cursor move
                window.dispatchEvent(new CustomEvent('midi-step-cursor', {
                    detail: { step: stepCursorRef.current }
                }));
            }, 50);
            return;
        }

        // --- Real-time recording ---
        if (inputMode === 'realtime' && globalIsPlaying) {
            const currentStep = globalCurrentStepRef?.current ?? 0;
            const stepSize = Math.max(1, 32 / globalResolution);
            const quantized = Math.round(currentStep / stepSize) * stepSize;
            activeNotesRef.current.set(note, { startStep: quantized % totalSteps });
        }
    }, [activeTab, applyOctaveOffset, globalBars, globalIsPlaying, globalCurrentStepRef,
        globalResolution, globalTempo, inputMode, loadedInstruments, samplerRef, setPatterns, drumRef]);

    const handleNoteOff = useCallback((rawNote, _channel) => {
        const note = applyOctaveOffset(rawNote);

        // Clear piano roll highlight
        window.dispatchEvent(new CustomEvent('midi-note-highlight', {
            detail: { note, on: false }
        }));

        // Real-time recording: finalize note duration
        if (inputMode === 'realtime' && activeNotesRef.current.has(note)) {
            const { startStep } = activeNotesRef.current.get(note);
            activeNotesRef.current.delete(note);

            const currentStep = globalCurrentStepRef?.current ?? 0;
            const totalSteps = globalBars * 32;
            const stepSize = Math.max(1, 32 / globalResolution);
            const quantizedEnd = Math.round(currentStep / stepSize) * stepSize;

            let duration = quantizedEnd - startStep;
            if (duration <= 0) duration = stepSize; // minimum 1 grid unit
            if (duration > totalSteps) duration = totalSteps;

            const trackId = activeTab;
            const vel = 0.8; // default; we stored velocity on noteOn if needed

            const noteObj = { time: startStep % totalSteps, duration, note, velocity: vel };

            setPatterns(prev => {
                const existing = prev[trackId] || [];
                if (!overdub) {
                    // Replace mode: remove notes overlapping this region
                    const filtered = existing.filter(n =>
                        !(n.time >= noteObj.time && n.time < noteObj.time + noteObj.duration && n.note === noteObj.note)
                    );
                    return { ...prev, [trackId]: [...filtered, noteObj] };
                }
                return { ...prev, [trackId]: [...existing, noteObj] };
            });
        }
    }, [activeTab, applyOctaveOffset, globalBars, globalCurrentStepRef, globalResolution, inputMode, overdub, setPatterns]);

    const handleCC = useCallback((_cc, _value, _channel) => {
        // Placeholder for future CC mapping (volume knobs, mod wheel, etc.)
    }, []);

    // Wire callbacks into midiInput
    useEffect(() => {
        if (!midiInput) return;
        midiInput.onNoteOn = handleNoteOn;
        midiInput.onNoteOff = handleNoteOff;
        midiInput.onCC = handleCC;
        return () => {
            midiInput.onNoteOn = null;
            midiInput.onNoteOff = null;
            midiInput.onCC = null;
        };
    }, [midiInput, handleNoteOn, handleNoteOff, handleCC]);

    // ==========================================
    // Render
    // ==========================================

    const midiAvailable = !!midiInput?.isAvailable;
    const indicatorColor = connected ? '#39ff14' : '#666';

    return (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            {/* Compact toggle button */}
            <button
                onClick={() => setExpanded(!expanded)}
                title="MIDI Controller Input"
                style={{
                    background: connected
                        ? (isDark ? 'rgba(57, 255, 20, 0.1)' : 'rgba(57, 255, 20, 0.2)')
                        : (isDark ? 'rgba(255,255,255,0.05)' : '#eee'),
                    border: `1px solid ${connected ? '#39ff14' : (isDark ? '#444' : '#ccc')}`,
                    borderRadius: '6px',
                    padding: '5px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: isDark ? '#ccc' : '#333',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                }}
            >
                <span style={{ fontSize: '14px' }}>MIDI</span>
                <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: indicatorColor,
                    boxShadow: connected ? `0 0 6px ${indicatorColor}` : 'none',
                    transition: 'all 0.3s'
                }} />
            </button>

            {/* Expanded panel */}
            {expanded && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: isDark ? '#1a1a2e' : '#fff',
                    border: `1px solid ${isDark ? '#333' : '#ccc'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    minWidth: '280px',
                    zIndex: 1000,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    fontSize: '11px',
                    color: isDark ? '#ccc' : '#333'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', color: isDark ? acSec : '#333' }}>
                        MIDI Controller
                    </div>

                    {!midiAvailable && (
                        <div style={{
                            padding: '8px 10px',
                            background: isDark ? 'rgba(255,200,0,0.08)' : '#fff3cd',
                            border: `1px solid ${isDark ? '#665500' : '#ffc107'}`,
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: isDark ? '#ffa' : '#856404',
                            marginBottom: '8px'
                        }}>
                            MIDI input requires Chrome or Edge over HTTPS.
                        </div>
                    )}

                    {/* Device selector */}
                    <div style={{ marginBottom: '8px' }}>
                        <label style={labelStyle(isDark)}>DEVICE</label>
                        <select
                            value={selectedDevice}
                            onChange={handleDeviceChange}
                            style={selectStyle(isDark)}
                        >
                            <option value="">-- None --</option>
                            {devices.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Input mode */}
                    <div style={{ marginBottom: '8px' }}>
                        <label style={labelStyle(isDark)}>MODE</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[
                                { value: 'live', label: 'Live' },
                                { value: 'stepInput', label: 'Step' },
                                { value: 'realtime', label: 'Record' },
                            ].map(m => (
                                <button
                                    key={m.value}
                                    onClick={() => {
                                        setInputMode(m.value);
                                        stepCursorRef.current = 0;
                                        activeNotesRef.current.clear();
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '4px 6px',
                                        borderRadius: '4px',
                                        border: `1px solid ${inputMode === m.value ? ac : (isDark ? '#444' : '#ccc')}`,
                                        background: inputMode === m.value
                                            ? (isDark ? hexToRgba(ac, 0.2) : `${ac}22`)
                                            : (isDark ? '#2a2a3e' : '#f0f0f0'),
                                        color: inputMode === m.value ? ac : (isDark ? '#aaa' : '#666'),
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Overdub toggle for realtime mode */}
                    {inputMode === 'realtime' && (
                        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <label style={{ ...labelStyle(isDark), marginBottom: 0 }}>OVERDUB</label>
                            <button
                                onClick={() => setOverdub(!overdub)}
                                style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    border: `1px solid ${overdub ? '#39ff14' : '#ff3939'}`,
                                    background: overdub
                                        ? (isDark ? 'rgba(57,255,20,0.15)' : '#39ff1422')
                                        : (isDark ? 'rgba(255,57,57,0.15)' : '#ff393922'),
                                    color: overdub ? '#39ff14' : '#ff3939',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                {overdub ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    )}

                    {/* Channel filter */}
                    <div style={{ marginBottom: '8px' }}>
                        <label style={labelStyle(isDark)}>CHANNEL</label>
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(parseInt(e.target.value))}
                            style={selectStyle(isDark)}
                        >
                            <option value={0}>All</option>
                            {Array.from({ length: 16 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                            ))}
                        </select>
                    </div>

                    {/* Octave offset */}
                    <div style={{ marginBottom: '8px' }}>
                        <label style={labelStyle(isDark)}>OCTAVE OFFSET</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={() => setOctaveOffset(Math.max(-2, octaveOffset - 1))} style={smallBtn(isDark)}>-</button>
                            <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{octaveOffset > 0 ? `+${octaveOffset}` : octaveOffset}</span>
                            <button onClick={() => setOctaveOffset(Math.min(2, octaveOffset + 1))} style={smallBtn(isDark)}>+</button>
                        </div>
                    </div>

                    {/* Last note display */}
                    <div style={{
                        padding: '6px 8px',
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f5',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: lastNote ? (isDark ? '#39ff14' : '#2d7d2d') : (isDark ? '#555' : '#aaa'),
                        textAlign: 'center'
                    }}>
                        {lastNote ? `${lastNote.name}  vel:${lastNote.velocity}` : 'No input'}
                    </div>

                    {/* Active tab / mode info */}
                    <div style={{
                        marginTop: '6px',
                        fontSize: '9px',
                        color: isDark ? '#666' : '#999',
                        textAlign: 'center'
                    }}>
                        Target: {activeTab.toUpperCase()} | {inputMode === 'live' ? 'Live Monitor' : inputMode === 'stepInput' ? 'Step Input' : 'Real-Time Record'}
                    </div>
                </div>
            )}
        </div>
    );
};

// ---- Style helpers ----

const labelStyle = (isDark) => ({
    display: 'block',
    fontSize: '9px',
    color: isDark ? '#888' : '#666',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
    marginBottom: '3px'
});

const selectStyle = (isDark) => ({
    width: '100%',
    padding: '4px 6px',
    background: isDark ? '#2a2a3e' : '#f0f0f0',
    border: `1px solid ${isDark ? '#444' : '#ccc'}`,
    borderRadius: '4px',
    color: isDark ? '#fff' : '#000',
    fontSize: '11px',
    outline: 'none',
    cursor: 'pointer'
});

const smallBtn = (isDark) => ({
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: `1px solid ${isDark ? '#444' : '#ccc'}`,
    background: isDark ? '#2a2a3e' : '#f0f0f0',
    color: isDark ? '#ccc' : '#333',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
});

export default MIDIInputPanel;
