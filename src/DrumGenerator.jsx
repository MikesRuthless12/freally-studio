import React, { useState, useRef, useEffect } from 'react';
import SampleWaveform from './SampleWaveform';
import DrumSampleEditor from './DrumSampleEditor';

const DrumGenerator = ({ selectedFolder, theme, onExport }) => {
    const isDark = theme === 'dark';

    // Drum elements
    const drumElements = [
        { id: 'kick', name: 'KICK', color: '#ff6b6b' },
        { id: 'clap', name: 'CLAP', color: '#ff9f43' },
        { id: 'snare', name: 'OFF SNARE', color: '#ff7675' },
        { id: 'closedHat', name: 'CLOSED HAT', color: '#fdcb6e' },
        { id: 'openHat', name: 'OPEN HAT', color: '#e17055' },
        { id: 'midTom', name: 'MID TOM', color: '#d63031' },
        { id: 'perc1', name: 'PERC', color: '#fab1a0' },
        { id: 'perc2', name: 'PERC', color: '#e84393' }
    ];

    const [bars, setBars] = useState(4);
    const [genre, setGenre] = useState('HIP HOP & RAP');
    const stepsPerBar = 16;
    const totalSteps = bars * stepsPerBar;

    // State for each drum
    const [drumStates, setDrumStates] = useState(
        drumElements.reduce((acc, drum) => ({
            ...acc,
            [drum.id]: {
                powered: true,
                visible: true,
                solo: false,
                mute: false,
                sample: { name: `Default ${drum.name}`, buffer: null },
                pattern: Array(totalSteps).fill(false),
                velocity: Array(totalSteps).fill(100),
                params: {
                    attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.1,
                    volume: 1.0, pan: 0, pitch: 0,
                    fatten: 0, drive: 0, bassBoost: 0,
                    delayTime: 0, delayFeedback: 0, delayMix: 0,
                    sampleStart: 0, reverse: false
                }
            }
        }), {})
    );

    const [selectedCells, setSelectedCells] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [editingDrumId, setEditingDrumId] = useState(null);

    // Update pattern length when bars change
    useEffect(() => {
        setDrumStates(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(drumId => {
                const newLength = bars * stepsPerBar;
                const oldPattern = updated[drumId].pattern;
                const oldVelocity = updated[drumId].velocity;

                updated[drumId].pattern = Array(newLength).fill(false).map((_, i) =>
                    i < oldPattern.length ? oldPattern[i] : false
                );
                updated[drumId].velocity = Array(newLength).fill(100).map((_, i) =>
                    i < oldVelocity.length ? oldVelocity[i] : 100
                );
            });
            return updated;
        });
    }, [bars]);

    // Toggle drum power
    const togglePower = (drumId) => {
        setDrumStates(prev => ({
            ...prev,
            [drumId]: { ...prev[drumId], powered: !prev[drumId].powered }
        }));
    };

    // Toggle visibility
    const toggleVisibility = (drumId) => {
        setDrumStates(prev => ({
            ...prev,
            [drumId]: { ...prev[drumId], visible: !prev[drumId].visible }
        }));
    };

    // Toggle solo
    const toggleSolo = (drumId) => {
        setDrumStates(prev => ({
            ...prev,
            [drumId]: { ...prev[drumId], solo: !prev[drumId].solo }
        }));
    };

    // Toggle mute
    const toggleMute = (drumId) => {
        setDrumStates(prev => ({
            ...prev,
            [drumId]: { ...prev[drumId], mute: !prev[drumId].mute }
        }));
    };

    // Toggle note in grid
    const toggleNote = (drumId, step) => {
        if (!drumStates[drumId].powered) return;

        setDrumStates(prev => ({
            ...prev,
            [drumId]: {
                ...prev[drumId],
                pattern: prev[drumId].pattern.map((val, i) => i === step ? !val : val)
            }
        }));
    };

    // Random sample from folder
    const randomizeSample = (drumId) => {
        if (!selectedFolder || !selectedFolder.samples) {
            alert('Please select a folder in the file explorer first');
            return;
        }

        // Filter samples by drum type
        const drumName = drumElements.find(d => d.id === drumId)?.name.toLowerCase();
        const matchingSamples = selectedFolder.samples.filter(s =>
            s.name.toLowerCase().includes(drumId.toLowerCase()) ||
            s.name.toLowerCase().includes(drumName)
        );

        const samplesToUse = matchingSamples.length > 0 ? matchingSamples : selectedFolder.samples;

        if (samplesToUse.length > 0) {
            const randomSample = samplesToUse[Math.floor(Math.random() * samplesToUse.length)];
            setDrumStates(prev => ({
                ...prev,
                [drumId]: {
                    ...prev[drumId],
                    sample: {
                        name: randomSample.name,
                        buffer: randomSample.buffer
                    }
                }
            }));
        }
    };

    // Clear row
    const clearRow = (drumId) => {
        setDrumStates(prev => ({
            ...prev,
            [drumId]: {
                ...prev[drumId],
                pattern: Array(totalSteps).fill(false)
            }
        }));
    };

    // Handle mouse down on grid cell
    const handleMouseDown = (drumId, step) => {
        setIsDragging(true);
        setDragStart({ drumId, step });
        toggleNote(drumId, step);
    };

    // Handle mouse enter while dragging
    const handleMouseEnter = (drumId, step) => {
        if (isDragging && dragStart.drumId === drumId) {
            toggleNote(drumId, step);
        }
    };

    // Handle mouse up
    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
    };

    // Export MIDI
    const handleExportMIDI = () => {
        const midiData = {
            type: 'drums',
            bars,
            tempo: 120,
            drums: drumElements.map(drum => ({
                id: drum.id,
                name: drum.name,
                pattern: drumStates[drum.id].pattern,
                velocity: drumStates[drum.id].velocity,
                powered: drumStates[drum.id].powered
            }))
        };

        if (onExport) {
            onExport({ type: 'midi', data: midiData });
        }
    };

    // Export Audio
    const handleExportAudio = () => {
        const audioData = {
            type: 'drums',
            bars,
            tempo: 120,
            drums: drumElements.map(drum => ({
                id: drum.id,
                name: drum.name,
                pattern: drumStates[drum.id].pattern,
                velocity: drumStates[drum.id].velocity,
                sample: drumStates[drum.id].sample,
                powered: drumStates[drum.id].powered
            }))
        };

        if (onExport) {
            onExport({ type: 'audio', data: audioData });
        }
    };

    // Update Drum Params
    const handleParamChange = (drumId, param, value) => {
        setDrumStates(prev => ({
            ...prev,
            [drumId]: {
                ...prev[drumId],
                params: {
                    ...prev[drumId].params,
                    [param]: value
                }
            }
        }));

        // Update Audio Engine
        if (window.samplerEngine) {
            window.samplerEngine.setDrumParam(drumId, param, value);
        }
    };

    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: isDark ? '#2a2a3e' : '#e8e8e8',
                overflow: 'hidden',
                position: 'relative' // For overlay
            }}
            onMouseUp={handleMouseUp}
        >
            {editingDrumId && (
                <DrumSampleEditor
                    drumId={editingDrumId}
                    sample={drumStates[editingDrumId].sample}
                    params={drumStates[editingDrumId].params}
                    onParamChange={(p, v) => handleParamChange(editingDrumId, p, v)}
                    onClose={() => setEditingDrumId(null)}
                    theme={theme}
                />
            )}
            {/* Top Controls */}
            <div style={{
                padding: '20px',
                background: isDark ? '#1a1a2e' : '#f5f5f5',
                borderBottom: `2px solid ${isDark ? '#333' : '#ddd'}`,
                display: 'flex',
                gap: '20px',
                alignItems: 'center'
            }}>
                <div>
                    <label style={{
                        display: 'block',
                        fontSize: '11px',
                        marginBottom: '5px',
                        color: isDark ? '#888' : '#666',
                        fontWeight: 'bold'
                    }}>GENRE</label>
                    <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        style={{
                            padding: '8px 15px',
                            background: isDark ? '#2a2a3e' : '#fff',
                            border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                            borderRadius: '4px',
                            color: isDark ? '#fff' : '#333',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }}
                    >
                        <option>HIP HOP & RAP</option>
                        <option>TRAP</option>
                        <option>DRILL</option>
                        <option>LO-FI</option>
                        <option>HOUSE</option>
                        <option>TECHNO</option>
                    </select>
                </div>

                <div>
                    <label style={{
                        display: 'block',
                        fontSize: '11px',
                        marginBottom: '5px',
                        color: isDark ? '#888' : '#666',
                        fontWeight: 'bold'
                    }}>LENGTH</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {[4, 8].map(b => (
                            <button
                                key={b}
                                onClick={() => setBars(b)}
                                style={{
                                    padding: '8px 20px',
                                    background: bars === b ? '#667eea' : (isDark ? '#2a2a3e' : '#fff'),
                                    border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                                    borderRadius: '4px',
                                    color: bars === b ? '#fff' : (isDark ? '#fff' : '#333'),
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                {b} BARS
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sample Cards */}
            <div style={{
                padding: '15px',
                background: isDark ? '#16213e' : '#f0f0f0',
                display: 'flex',
                gap: '10px',
                overflowX: 'auto'
            }}>
                {drumElements.map(drum => (
                    <div
                        key={drum.id}
                        style={{
                            minWidth: '140px',
                            background: isDark ? '#1a1a2e' : '#fff',
                            borderRadius: '8px',
                            padding: '10px',
                            border: `2px solid ${drumStates[drum.id].powered ? drum.color : '#555'}`
                        }}
                    >
                        {/* Power Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <button
                                onClick={() => togglePower(drum.id)}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: drumStates[drum.id].powered ? drum.color : '#555',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}
                            >
                                {drumStates[drum.id].powered ? '●' : '○'}
                            </button>

                            <button
                                onClick={() => randomizeSample(drum.id)}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: '#667eea',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    fontSize: '10px'
                                }}
                                title="Random sample"
                            >
                                R
                            </button>
                        </div>

                        {/* Settings Button (Wrench) */}
                        <button
                            onClick={() => setEditingDrumId(drum.id)}
                            style={{
                                width: '100%',
                                padding: '4px',
                                marginBottom: '8px',
                                background: 'transparent',
                                border: `1px solid ${drum.color}`,
                                borderRadius: '4px',
                                color: drum.color,
                                cursor: 'pointer',
                                fontSize: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                            }}
                        >
                            <span>🔧</span> SETTINGS
                        </button>

                        {/* Drum Name */}
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: drum.color,
                            marginBottom: '8px'
                        }}>
                            {drum.name}
                        </div>

                        {/* Waveform */}
                        <div style={{
                            height: '50px',
                            background: isDark ? '#0a0a0f' : '#f9f9f9',
                            borderRadius: '4px',
                            marginBottom: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {drumStates[drum.id].sample.buffer ? (
                                <SampleWaveform
                                    audioBuffer={drumStates[drum.id].sample.buffer}
                                    width={120}
                                    height={50}
                                    color={drum.color}
                                />
                            ) : (
                                <div style={{ fontSize: '10px', color: '#666' }}>No sample</div>
                            )}
                        </div>

                        {/* Sample Name */}
                        <div style={{
                            fontSize: '9px',
                            color: isDark ? '#888' : '#666',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {drumStates[drum.id].sample.name}
                        </div>
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '15px',
                background: isDark ? '#2a2a3e' : '#e8e8e8'
            }}>
                {/* Beat Numbers */}
                <div style={{ display: 'flex', marginBottom: '10px', paddingLeft: '150px' }}>
                    {Array.from({ length: bars }).map((_, bar) => (
                        <div key={bar} style={{ flex: 1, display: 'flex' }}>
                            {Array.from({ length: 4 }).map((_, beat) => (
                                <div
                                    key={beat}
                                    style={{
                                        flex: 1,
                                        textAlign: 'center',
                                        fontSize: '10px',
                                        color: isDark ? '#666' : '#999',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {bar + 1}.{beat + 1}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Drum Rows */}
                {drumElements.map(drum => (
                    <div key={drum.id} style={{ marginBottom: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {/* Row Controls */}
                            <div style={{
                                width: '140px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px',
                                background: isDark ? '#1a1a2e' : '#fff',
                                borderRadius: '4px'
                            }}>
                                {/* Power */}
                                <button
                                    onClick={() => togglePower(drum.id)}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: drumStates[drum.id].powered ? drum.color : '#555',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        color: '#fff'
                                    }}
                                    title="Power"
                                >
                                    {drumStates[drum.id].powered ? '●' : '○'}
                                </button>

                                {/* Solo */}
                                <button
                                    onClick={() => toggleSolo(drum.id)}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        background: drumStates[drum.id].solo ? '#f39c12' : (isDark ? '#333' : '#ddd'),
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontSize: '9px',
                                        fontWeight: 'bold',
                                        color: drumStates[drum.id].solo ? '#fff' : (isDark ? '#888' : '#666')
                                    }}
                                    title="Solo"
                                >
                                    S
                                </button>

                                {/* Mute */}
                                <button
                                    onClick={() => toggleMute(drum.id)}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        background: drumStates[drum.id].mute ? '#e74c3c' : (isDark ? '#333' : '#ddd'),
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontSize: '9px',
                                        fontWeight: 'bold',
                                        color: drumStates[drum.id].mute ? '#fff' : (isDark ? '#888' : '#666')
                                    }}
                                    title="Mute"
                                >
                                    M
                                </button>

                                {/* Visibility */}
                                <button
                                    onClick={() => toggleVisibility(drum.id)}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        background: isDark ? '#333' : '#ddd',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        color: isDark ? '#888' : '#666'
                                    }}
                                    title="Show/Hide"
                                >
                                    {drumStates[drum.id].visible ? '▼' : '▶'}
                                </button>

                                {/* Name */}
                                {/* Name */}
                                <span style={{
                                    flex: 1,
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    color: drum.color,
                                    textAlign: 'right'
                                }}>
                                    {drum.name}
                                </span>

                                {/* Edit Button in Row */}
                                <button
                                    onClick={() => setEditingDrumId(drum.id)}
                                    style={{
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    🔧
                                </button>
                            </div>

                            {/* Grid Cells */}
                            {drumStates[drum.id].visible && (
                                <div style={{ flex: 1, display: 'flex', gap: '2px' }}>
                                    {drumStates[drum.id].pattern.map((active, step) => (
                                        <div
                                            key={step}
                                            onMouseDown={() => handleMouseDown(drum.id, step)}
                                            onMouseEnter={() => handleMouseEnter(drum.id, step)}
                                            style={{
                                                flex: 1,
                                                height: '24px',
                                                background: active ? drum.color : (isDark ? '#1a1a2e' : '#fff'),
                                                border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                                                borderRadius: '2px',
                                                cursor: 'pointer',
                                                opacity: drumStates[drum.id].powered ? 1 : 0.3,
                                                transition: 'all 0.1s'
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Clear Button */}
                            <button
                                onClick={() => clearRow(drum.id)}
                                style={{
                                    width: '30px',
                                    height: '24px',
                                    background: '#e74c3c',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: '#fff',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                                title="Clear row"
                            >
                                CLR
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Export Buttons */}
            <div style={{
                padding: '20px',
                background: isDark ? '#1a1a2e' : '#f5f5f5',
                borderTop: `2px solid ${isDark ? '#333' : '#ddd'}`,
                display: 'flex',
                gap: '15px',
                justifyContent: 'center'
            }}>
                <button
                    onClick={handleExportMIDI}
                    style={{
                        padding: '15px 40px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                >
                    DRAG & DROP MIDI
                </button>

                <button
                    onClick={handleExportAudio}
                    style={{
                        padding: '15px 40px',
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                >
                    DRAG & DROP AUDIO
                </button>
            </div>
        </div >
    );
};

export default DrumGenerator;
