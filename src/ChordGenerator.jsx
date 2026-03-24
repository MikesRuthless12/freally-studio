import React, { useState, useEffect, useRef } from 'react';
import './ChordGenerator.css';
import { getChordProgressionForGenre, getChordNotes, NOTE_NAMES } from './MusicTheory';

const ChordGenerator = ({ 
    sequencer, 
    tempo, 
    key, 
    scale, 
    genre, 
    bars,
    onChordDataChange 
}) => {
    const [chordPattern, setChordPattern] = useState([]);
    const [selectedChord, setSelectedChord] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [complexity, setComplexity] = useState('simple');
    const canvasRef = useRef(null);
    
    const OCTAVE_RANGE = [2, 3, 4, 5, 6]; // C2 to C6
    const STEPS_PER_BAR = 16;
    const totalSteps = bars * STEPS_PER_BAR;
    
    // Generate chord progression
    const generateChords = () => {
        const progression = getChordProgressionForGenre(genre, key, scale, bars, complexity);
        const stepsPerChord = Math.floor(totalSteps / progression.length);
        
        const newPattern = [];
        progression.forEach((roman, index) => {
            const startStep = index * stepsPerChord;
            const chordNotes = getChordNotes(roman, key, scale, 4, complexity);
            
            newPattern.push({
                id: Date.now() + index,
                roman,
                notes: chordNotes,
                startStep,
                duration: stepsPerChord,
                velocity: 0.8
            });
        });
        
        setChordPattern(newPattern);
        if (onChordDataChange) {
            onChordDataChange(newPattern);
        }
    };
    
    // Draw piano roll
    useEffect(() => {
        drawPianoRoll();
    }, [chordPattern, selectedChord, bars]);
    
    const drawPianoRoll = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // Calculate dimensions
        const noteCount = 12 * OCTAVE_RANGE.length;
        const noteHeight = height / noteCount;
        const stepWidth = width / totalSteps;
        
        // Draw piano keys background
        for (let i = 0; i < noteCount; i++) {
            const octave = OCTAVE_RANGE[Math.floor(i / 12)];
            const noteIndex = i % 12;
            const noteName = NOTE_NAMES[noteIndex];
            const y = height - (i + 1) * noteHeight;
            
            // Alternate colors for white/black keys
            const isBlackKey = noteName.includes('#');
            ctx.fillStyle = isBlackKey ? '#0a0a0a' : '#1a1a1a';
            ctx.fillRect(0, y, width, noteHeight);
            
            // Draw horizontal grid lines
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw vertical grid lines (bars)
        for (let bar = 0; bar <= bars; bar++) {
            const x = bar * STEPS_PER_BAR * stepWidth;
            ctx.strokeStyle = bar % 4 === 0 ? '#555' : '#333';
            ctx.lineWidth = bar % 4 === 0 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Draw chords
        chordPattern.forEach(chord => {
            const isSelected = selectedChord?.id === chord.id;
            
            chord.notes.forEach(midiNote => {
                const noteIndex = midiNote - (OCTAVE_RANGE[0] * 12);
                if (noteIndex < 0 || noteIndex >= noteCount) return;
                
                const x = chord.startStep * stepWidth;
                const y = height - (noteIndex + 1) * noteHeight;
                const w = chord.duration * stepWidth - 2;
                const h = noteHeight - 2;
                
                // Draw note
                ctx.fillStyle = isSelected ? '#7c3aed' : '#6366f1';
                ctx.fillRect(x + 1, y + 1, w, h);
                
                // Draw border
                ctx.strokeStyle = isSelected ? '#a78bfa' : '#818cf8';
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.strokeRect(x + 1, y + 1, w, h);
            });
            
            // Draw chord name
            const x = chord.startStep * stepWidth;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(chord.roman, x + 4, 16);
        });
    };
    
    const handleCanvasClick = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const stepWidth = canvas.width / totalSteps;
        const clickedStep = Math.floor(x / stepWidth);
        
        // Find chord at clicked position
        const chord = chordPattern.find(c => 
            clickedStep >= c.startStep && clickedStep < c.startStep + c.duration
        );
        
        setSelectedChord(chord || null);
    };
    
    const deleteSelectedChord = () => {
        if (!selectedChord) return;
        
        const newPattern = chordPattern.filter(c => c.id !== selectedChord.id);
        setChordPattern(newPattern);
        setSelectedChord(null);
        
        if (onChordDataChange) {
            onChordDataChange(newPattern);
        }
    };
    
    const clearAll = () => {
        setChordPattern([]);
        setSelectedChord(null);
        if (onChordDataChange) {
            onChordDataChange([]);
        }
    };
    
    return (
        <div className="chord-generator">
            <div className="chord-controls">
                <button className="generate-btn" onClick={generateChords}>
                    NEW PROGRESSION
                </button>
                
                <div className="complexity-toggle">
                    <button
                        className={complexity === 'simple' ? 'active' : ''}
                        onClick={() => setComplexity('simple')}
                    >
                        SIMPLE
                    </button>
                    <button
                        className={complexity === 'complex' ? 'active' : ''}
                        onClick={() => setComplexity('complex')}
                    >
                        COMPLEX
                    </button>
                </div>
                <button 
                    className="clear-btn" 
                    onClick={clearAll}
                    disabled={chordPattern.length === 0}
                >
                    CLEAR
                </button>
                <button 
                    className="delete-btn" 
                    onClick={deleteSelectedChord}
                    disabled={!selectedChord}
                >
                    DELETE SELECTED
                </button>
                
                <div className="chord-info">
                    {selectedChord && (
                        <span className="selected-chord-info">
                            Selected: {selectedChord.roman} | 
                            Bar {Math.floor(selectedChord.startStep / STEPS_PER_BAR) + 1}
                        </span>
                    )}
                </div>
            </div>
            
            <div className="piano-roll-container">
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={400}
                    className="piano-roll-canvas"
                    onClick={handleCanvasClick}
                />
            </div>
            
            <div className="chord-pattern-display">
                <div className="pattern-label">Chord Progression:</div>
                <div className="pattern-chords">
                    {chordPattern.length > 0 ? (
                        chordPattern.map((chord, index) => (
                            <span 
                                key={chord.id}
                                className={`chord-tag ${selectedChord?.id === chord.id ? 'selected' : ''}`}
                                onClick={() => setSelectedChord(chord)}
                            >
                                {chord.roman}
                            </span>
                        ))
                    ) : (
                        <span className="empty-message">Click "NEW PROGRESSION" to generate chords</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChordGenerator;
