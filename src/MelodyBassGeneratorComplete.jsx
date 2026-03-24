import React, { useState, useRef } from 'react';
import PianoRollEditor from './PianoRollEditor';
import { ChordAwareGenerator } from './ChordAwareGenerator';

const MelodyBassGeneratorComplete = ({ 
    type = 'melody', // 'melody' or 'bass'
    selectedFolder, 
    sampler, 
    theme, 
    globalKey, 
    globalScale, 
    globalTempo,
    globalBars,
    globalGenre,
    globalSubGenre,
    chordProgression = [],
    onPatternChange,
    onInstrumentLoad
}) => {
    const isDark = theme === 'dark';
    const generatorRef = useRef(new ChordAwareGenerator());
    
    const [pattern, setPattern] = useState([]);
    const [loadedInstrument, setLoadedInstrument] = useState(null);
    const [instrumentName, setInstrumentName] = useState('');
    const [complexity, setComplexity] = useState('simple');
    const [isPlaying, setIsPlaying] = useState(false);
    
    const title = type === 'melody' ? 'Melody' : 'Bassline';
    const icon = type === 'melody' ? '🎵' : '🎸';
    
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
            const instrumentId = `${type}_${Date.now()}`;
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
     * Generate pattern
     */
    const generatePattern = () => {
        // Use chord progression if available, otherwise generate one
        let chords = chordProgression;
        if (!chords || chords.length === 0) {
            chords = generatorRef.current.generateChordProgression(
                globalKey,
                globalScale,
                globalBars,
                complexity,
                globalSubGenre
            );
        }
        
        const newPattern = type === 'melody'
            ? generatorRef.current.generateMelody(chords, globalKey, globalScale, complexity, globalSubGenre)
            : generatorRef.current.generateBassline(chords, globalKey, globalScale, complexity, globalSubGenre);
        
        setPattern(newPattern);
        if (onPatternChange) onPatternChange(newPattern);
    };
    
    /**
     * Generate next variation
     */
    const generateNext = () => {
        if (pattern.length === 0) {
            generatePattern();
        } else {
            // Generate variation
            let chords = chordProgression;
            if (!chords || chords.length === 0) {
                chords = generatorRef.current.generateChordProgression(
                    globalKey,
                    globalScale,
                    globalBars,
                    complexity,
                    globalSubGenre
                );
            }
            
            const variation = generatorRef.current.generateVariation(
                pattern,
                chords,
                type,
                complexity
            );
            setPattern(variation);
            if (onPatternChange) onPatternChange(variation);
        }
    };
    
    /**
     * Play pattern
     */
    const playPattern = () => {
        if (!loadedInstrument || !sampler || pattern.length === 0) {
            alert(`Please load an instrument and generate ${title.toLowerCase()} first`);
            return;
        }
        
        setIsPlaying(true);
        sampler.playPattern(loadedInstrument, pattern, globalTempo);
        
        const lastNote = pattern[pattern.length - 1];
        const totalDuration = ((lastNote.time + lastNote.duration) / 4) * (60 / globalTempo) * 1000;
        
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
        setPattern([]);
        if (onPatternChange) onPatternChange([]);
    };
    
    /**
     * Handle pattern change from piano roll
     */
    const handlePatternChange = (newPattern) => {
        setPattern(newPattern);
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
                {/* Title */}
                <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: isDark ? '#fff' : '#333'
                }}>
                    {icon} {title} Generator
                </div>
                
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
                    onClick={generatePattern}
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
                    disabled={pattern.length === 0}
                    style={{
                        padding: '8px 20px',
                        background: pattern.length > 0 ? '#ff6b6b' : '#555',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: pattern.length > 0 ? 'pointer' : 'not-allowed'
                    }}
                >
                    🗑️ CLEAR
                </button>
                
                {/* Playback Controls */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={playPattern}
                        disabled={!loadedInstrument || pattern.length === 0 || isPlaying}
                        style={{
                            padding: '8px 24px',
                            background: (loadedInstrument && pattern.length > 0 && !isPlaying) ? '#4ecdc4' : '#555',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: (loadedInstrument && pattern.length > 0 && !isPlaying) ? 'pointer' : 'not-allowed'
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
                {pattern.length > 0 ? (
                    <PianoRollEditor
                        pattern={pattern}
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
                        Click "GENERATE" to create a {title.toLowerCase()}
                        {chordProgression.length > 0 && ' (will follow chord progression)'}
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
                💡 <strong>Tip:</strong> {title} follows the chord progression and stays in scale. 
                Edit notes in piano roll with arrow keys (↑↓=semitone, Ctrl+↑↓=octave).
                {chordProgression.length > 0 && ` Currently following ${chordProgression.length} chords.`}
            </div>
        </div>
    );
};

export default MelodyBassGeneratorComplete;
