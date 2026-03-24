import React, { useState, useRef } from 'react';
import PianoRollEditor from './PianoRollEditor';
import { ChordAwareGenerator } from './ChordAwareGenerator';

const ChordGeneratorComplete = ({ 
    selectedFolder, 
    sampler, 
    theme, 
    globalKey, 
    globalScale, 
    globalTempo,
    globalBars,
    globalGenre,
    globalSubGenre,
    onPatternChange,
    onInstrumentLoad
}) => {
    const isDark = theme === 'dark';
    const generatorRef = useRef(new ChordAwareGenerator());
    
    const [chordPattern, setChordPattern] = useState([]);
    const [loadedInstrument, setLoadedInstrument] = useState(null);
    const [instrumentName, setInstrumentName] = useState('');
    const [complexity, setComplexity] = useState('simple');
    const [isPlaying, setIsPlaying] = useState(false);
    
    /**
     * Load instrument from selected folder
     */
    const handleLoadInstrument = async () => {
        if (!selectedFolder || !sampler) {
            alert('Please select a folder with audio samples first');
            return;
        }
        
        const audioFiles = selectedFolder.samples?.filter(s => 
            s.file && s.file.type.startsWith('audio/')
        ) || [];
        
        if (audioFiles.length === 0) {
            alert('No audio files found in selected folder');
            return;
        }
        
        try {
            const instrumentId = `chords_${Date.now()}`;
            await sampler.loadInstrumentFromFiles(
                instrumentId,
                audioFiles.map(s => s.file)
            );
            
            setLoadedInstrument(instrumentId);
            setInstrumentName(selectedFolder.name);
            if (onInstrumentLoad) onInstrumentLoad(instrumentId);
            alert(`Loaded ${audioFiles.length} samples as "${selectedFolder.name}"`);
        } catch (error) {
            console.error('Failed to load instrument:', error);
            alert('Failed to load instrument');
        }
    };
    
    /**
     * Generate chord progression
     */
    const generateChords = () => {
        const chords = generatorRef.current.generateChordProgression(
            globalKey,
            globalScale,
            globalBars,
            complexity,
            globalSubGenre
        );
        
        setChordPattern(chords);
        if (onPatternChange) onPatternChange(chords);
    };
    
    /**
     * Generate next variation
     */
    const generateNext = () => {
        if (chordPattern.length === 0) {
            generateChords();
        } else {
            // Generate variation
            const variation = generatorRef.current.generateVariation(
                chordPattern,
                chordPattern,
                'chords',
                complexity
            );
            setChordPattern(variation);
            if (onPatternChange) onPatternChange(variation);
        }
    };
    
    /**
     * Play pattern
     */
    const playPattern = () => {
        if (!loadedInstrument || !sampler || chordPattern.length === 0) {
            alert('Please load an instrument and generate chords first');
            return;
        }
        
        setIsPlaying(true);
        sampler.playPattern(loadedInstrument, chordPattern, globalTempo);
        
        const lastChord = chordPattern[chordPattern.length - 1];
        const totalDuration = ((lastChord.time + lastChord.duration) / 4) * (60 / globalTempo) * 1000;
        
        setTimeout(() => {
            setIsPlaying(false);
        }, totalDuration);
    };
    
    /**
     * Stop playback
     */
    const stopPlayback = () => {
        if (sampler) {
            sampler.stopAll();
            setIsPlaying(false);
        }
    };
    
    /**
     * Clear pattern
     */
    const clearPattern = () => {
        setChordPattern([]);
        if (onPatternChange) onPatternChange([]);
    };
    
    /**
     * Handle pattern change from piano roll
     */
    const handlePatternChange = (newPattern) => {
        setChordPattern(newPattern);
        if (onPatternChange) onPatternChange(newPattern);
    };
    
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: isDark ? '#0f0f23' : '#fff',
            color: isDark ? '#fff' : '#333'
        }}>
            {/* Header Controls */}
            <div style={{
                padding: '15px 20px',
                background: isDark ? '#16213e' : '#f0f0f0',
                borderBottom: `1px solid ${isDark ? '#2a2a3e' : '#e0e0e0'}`,
                display: 'flex',
                gap: '15px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                {/* Instrument Loading */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{
                        padding: '8px 12px',
                        background: isDark ? '#1a1a2e' : '#fff',
                        borderRadius: '4px',
                        fontSize: '11px',
                        border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                        minWidth: '150px'
                    }}>
                        {loadedInstrument ? `✓ ${instrumentName}` : 'No instrument'}
                    </div>
                    
                    <button
                        onClick={handleLoadInstrument}
                        disabled={!selectedFolder}
                        style={{
                            padding: '8px 16px',
                            background: selectedFolder ? '#667eea' : '#555',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: selectedFolder ? 'pointer' : 'not-allowed'
                        }}
                    >
                        📁 LOAD INSTRUMENT
                    </button>
                </div>
                
                {/* Complexity */}
                <div style={{ display: 'flex', gap: '5px' }}>
                    {['simple', 'complex'].map(level => (
                        <button
                            key={level}
                            onClick={() => setComplexity(level)}
                            style={{
                                padding: '8px 16px',
                                background: complexity === level ? '#667eea' : (isDark ? '#2a2a3e' : '#fff'),
                                border: `1px solid ${isDark ? '#444' : '#ccc'}`,
                                borderRadius: '4px',
                                color: complexity === level ? '#fff' : (isDark ? '#fff' : '#333'),
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            {level}
                        </button>
                    ))}
                </div>
                
                {/* Generation Buttons */}
                <button
                    onClick={generateChords}
                    style={{
                        padding: '8px 20px',
                        background: '#4ecdc4',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    🎲 GENERATE
                </button>
                
                <button
                    onClick={generateNext}
                    style={{
                        padding: '8px 20px',
                        background: '#f9ca24',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#333',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    ⚡ GENERATE NEXT
                </button>
                
                <button
                    onClick={clearPattern}
                    disabled={chordPattern.length === 0}
                    style={{
                        padding: '8px 20px',
                        background: chordPattern.length > 0 ? '#ff6b6b' : '#555',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: chordPattern.length > 0 ? 'pointer' : 'not-allowed'
                    }}
                >
                    🗑️ CLEAR
                </button>
                
                {/* Playback Controls */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={playPattern}
                        disabled={!loadedInstrument || chordPattern.length === 0 || isPlaying}
                        style={{
                            padding: '8px 24px',
                            background: (loadedInstrument && chordPattern.length > 0 && !isPlaying) ? '#4ecdc4' : '#555',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: (loadedInstrument && chordPattern.length > 0 && !isPlaying) ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {isPlaying ? '⏸️ PLAYING...' : '▶️ PLAY'}
                    </button>
                    
                    {isPlaying && (
                        <button
                            onClick={stopPlayback}
                            style={{
                                padding: '8px 24px',
                                background: '#ff6b6b',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            ⏹️ STOP
                        </button>
                    )}
                </div>
            </div>
            
            {/* Piano Roll Editor */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {chordPattern.length > 0 ? (
                    <PianoRollEditor
                        pattern={chordPattern}
                        onPatternChange={handlePatternChange}
                        bars={globalBars}
                        globalKey={globalKey}
                        globalScale={globalScale}
                        theme={theme}
                    />
                ) : (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDark ? '#666' : '#999',
                        fontSize: '14px'
                    }}>
                        Click "GENERATE" to create a chord progression
                    </div>
                )}
            </div>
            
            {/* Info Footer */}
            <div style={{
                padding: '10px 20px',
                background: isDark ? '#16213e' : '#f0f0f0',
                borderTop: `1px solid ${isDark ? '#2a2a3e' : '#e0e0e0'}`,
                fontSize: '11px',
                color: isDark ? '#888' : '#666'
            }}>
                💡 <strong>Tip:</strong> Load instrument samples, generate chords, then edit in piano roll. 
                Use arrow keys to move selected notes, Delete to remove them.
            </div>
        </div>
    );
};

export default ChordGeneratorComplete;
