import React, { useState, useEffect, useRef } from 'react';
import './MelodyBassGenerator.css';
import { generateMelodyNotes, generateBassline, getNoteName, NOTE_NAMES, isNoteInScale, quantizeToScale } from './MusicTheory';

const MelodyBassGenerator = ({ 
    sequencer, 
    tempo, 
    key, 
    scale, 
    genre, 
    bars,
    chordProgression = [],
    onMelodyDataChange,
    onBassDataChange
}) => {
    const [activeTab, setActiveTab] = useState('melody'); // 'melody' or 'bass'
    const [melodyPattern, setMelodyPattern] = useState([]);
    const [bassPattern, setBassPattern] = useState([]);
    const [selectedNotes, setSelectedNotes] = useState([]);
    const [isPainting, setIsPainting] = useState(false);
    const [complexity, setComplexity] = useState('simple'); // 'simple' or 'complex'
    const [showScaleHighlight, setShowScaleHighlight] = useState(true);
    const canvasRef = useRef(null);
    
    const MELODY_OCTAVE_RANGE = [3, 4, 5, 6, 7]; // C3 to C7
    const BASS_OCTAVE_RANGE = [1, 2, 3]; // C1 to C3
    const STEPS_PER_BAR = 16;
    const totalSteps = bars * STEPS_PER_BAR;
    
    const currentPattern = activeTab === 'melody' ? melodyPattern : bassPattern;
    const setCurrentPattern = activeTab === 'melody' ? setMelodyPattern : setBassPattern;
    const octaveRange = activeTab === 'melody' ? MELODY_OCTAVE_RANGE : BASS_OCTAVE_RANGE;
    
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (selectedNotes.length === 0) return;
            
            // Ctrl + Up Arrow: Move up one octave
            if (e.ctrlKey && e.key === 'ArrowUp') {
                e.preventDefault();
                moveSelectedNotes(12);
            }
            // Ctrl + Down Arrow: Move down one octave
            else if (e.ctrlKey && e.key === 'ArrowDown') {
                e.preventDefault();
                moveSelectedNotes(-12);
            }
            // Delete: Remove selected notes
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteSelectedNotes();
            }
            // Arrow Up: Move up one semitone (quantized to scale)
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveSelectedNotesInScale(1);
            }
            // Arrow Down: Move down one semitone (quantized to scale)
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveSelectedNotesInScale(-1);
            }
            // Ctrl + A: Select all notes
            else if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                setSelectedNotes(currentPattern.map(n => n.id));
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNotes, currentPattern, key, scale]);
    
    const moveSelectedNotes = (semitones) => {
        const newPattern = currentPattern.map(note => {
            if (selectedNotes.includes(note.id)) {
                return { ...note, note: note.note + semitones };
            }
            return note;
        });
        
        setCurrentPattern(newPattern);
        updateParentData(newPattern);
    };
    
    const moveSelectedNotesInScale = (direction) => {
        const newPattern = currentPattern.map(note => {
            if (selectedNotes.includes(note.id)) {
                const newNote = quantizeToScale(note.note + direction, key, scale);
                return { ...note, note: newNote };
            }
            return note;
        });
        
        setCurrentPattern(newPattern);
        updateParentData(newPattern);
    };
    
    const deleteSelectedNotes = () => {
        const newPattern = currentPattern.filter(n => !selectedNotes.includes(n.id));
        setCurrentPattern(newPattern);
        setSelectedNotes([]);
        updateParentData(newPattern);
    };
    
    const updateParentData = (pattern) => {
        if (activeTab === 'melody' && onMelodyDataChange) {
            onMelodyDataChange(pattern);
        } else if (activeTab === 'bass' && onBassDataChange) {
            onBassDataChange(pattern);
        }
    };
    
    // Generate melody
    const generateMelody = () => {
        const melodyNotes = generateMelodyNotes(key, scale, chordProgression, bars, 5, complexity);
        const newPattern = [];
        
        melodyNotes.forEach((note, step) => {
            if (note) {
                newPattern.push({
                    id: Date.now() + step,
                    step,
                    note,
                    velocity: 0.7 + Math.random() * 0.2,
                    duration: 1
                });
            }
        });
        
        setMelodyPattern(newPattern);
        if (onMelodyDataChange) {
            onMelodyDataChange(newPattern);
        }
    };
    
    // Generate bassline
    const generateBass = () => {
        const bassNotes = generateBassline(key, scale, chordProgression, bars, 2, complexity);
        const newPattern = [];
        
        bassNotes.forEach((note, step) => {
            if (note) {
                newPattern.push({
                    id: Date.now() + step,
                    step,
                    note,
                    velocity: 0.9,
                    duration: 2
                });
            }
        });
        
        setBassPattern(newPattern);
        if (onBassDataChange) {
            onBassDataChange(newPattern);
        }
    };
    
    // Draw piano roll
    useEffect(() => {
        drawPianoRoll();
    }, [currentPattern, selectedNotes, bars, activeTab, showScaleHighlight, key, scale]);
    
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
        const noteCount = 12 * octaveRange.length;
        const noteHeight = height / noteCount;
        const stepWidth = width / totalSteps;
        
        // Draw piano keys background with scale highlighting
        for (let i = 0; i < noteCount; i++) {
            const octave = octaveRange[Math.floor(i / 12)];
            const noteIndex = i % 12;
            const noteName = NOTE_NAMES[noteIndex];
            const midiNote = octave * 12 + noteIndex;
            const y = height - (i + 1) * noteHeight;
            
            // Check if note is in scale
            const inScale = isNoteInScale(midiNote, key, scale);
            
            // Alternate colors for white/black keys with scale highlighting
            const isBlackKey = noteName.includes('#');
            let bgColor;
            
            if (showScaleHighlight && inScale) {
                bgColor = isBlackKey ? '#1a2a1a' : '#1a2a1a'; // Green tint for scale notes
            } else {
                bgColor = isBlackKey ? '#0a0a0a' : '#1a1a1a';
            }
            
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, y, width, noteHeight);
            
            // Draw horizontal grid lines
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            
            // Draw note labels on left
            if (!isBlackKey) {
                ctx.fillStyle = inScale && showScaleHighlight ? '#6a6' : '#666';
                ctx.font = '10px sans-serif';
                ctx.fillText(`${noteName}${octave}`, 4, y + noteHeight - 4);
            }
        }
        
        // Draw vertical grid lines (bars and beats)
        for (let step = 0; step <= totalSteps; step++) {
            const x = step * stepWidth;
            const isBar = step % STEPS_PER_BAR === 0;
            const isBeat = step % 4 === 0;
            
            ctx.strokeStyle = isBar ? '#555' : isBeat ? '#444' : '#2a2a2a';
            ctx.lineWidth = isBar ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Draw notes
        currentPattern.forEach(note => {
            const isSelected = selectedNotes.includes(note.id);
            const minNote = octaveRange[0] * 12;
            const noteIndex = note.note - minNote;
            
            if (noteIndex < 0 || noteIndex >= noteCount) return;
            
            const x = note.step * stepWidth;
            const y = height - (noteIndex + 1) * noteHeight;
            const w = (note.duration || 1) * stepWidth - 2;
            const h = noteHeight - 2;
            
            // Draw note
            const color = activeTab === 'melody' ? '#6366f1' : '#10b981';
            const selectedColor = activeTab === 'melody' ? '#7c3aed' : '#059669';
            
            ctx.fillStyle = isSelected ? selectedColor : color;
            ctx.fillRect(x + 1, y + 1, w, h);
            
            // Draw velocity indicator
            const velocityWidth = w * note.velocity;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(x + 1, y + 1, velocityWidth, h);
            
            // Draw border
            ctx.strokeStyle = isSelected ? '#a78bfa' : '#818cf8';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(x + 1, y + 1, w, h);
        });
    };
    
    const handleCanvasMouseDown = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const stepWidth = canvas.width / totalSteps;
        const noteCount = 12 * octaveRange.length;
        const noteHeight = canvas.height / noteCount;
        
        const clickedStep = Math.floor(x / stepWidth);
        const clickedNote = noteCount - Math.floor(y / noteHeight) - 1;
        const midiNote = octaveRange[0] * 12 + clickedNote;
        
        // Check if clicking existing note
        const existingNote = currentPattern.find(n => 
            n.step === clickedStep && n.note === midiNote
        );
        
        if (existingNote) {
            // Select note (with shift for multi-select)
            if (e.shiftKey) {
                if (selectedNotes.includes(existingNote.id)) {
                    setSelectedNotes(selectedNotes.filter(id => id !== existingNote.id));
                } else {
                    setSelectedNotes([...selectedNotes, existingNote.id]);
                }
            } else {
                setSelectedNotes([existingNote.id]);
            }
        } else {
            // Add note (quantized to scale)
            const quantizedNote = quantizeToScale(midiNote, key, scale);
            const newNote = {
                id: Date.now(),
                step: clickedStep,
                note: quantizedNote,
                velocity: 0.8,
                duration: 1
            };
            
            const newPattern = [...currentPattern, newNote];
            setCurrentPattern(newPattern);
            setSelectedNotes([newNote.id]);
            setIsPainting(true);
            updateParentData(newPattern);
        }
    };
    
    const handleCanvasMouseMove = (e) => {
        if (!isPainting) return;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const stepWidth = canvas.width / totalSteps;
        const noteCount = 12 * octaveRange.length;
        const noteHeight = canvas.height / noteCount;
        
        const clickedStep = Math.floor(x / stepWidth);
        const clickedNote = noteCount - Math.floor(y / noteHeight) - 1;
        const midiNote = octaveRange[0] * 12 + clickedNote;
        
        // Check if note already exists at this position
        const existingNote = currentPattern.find(n => 
            n.step === clickedStep && n.note === midiNote
        );
        
        if (!existingNote) {
            const quantizedNote = quantizeToScale(midiNote, key, scale);
            const newNote = {
                id: Date.now(),
                step: clickedStep,
                note: quantizedNote,
                velocity: 0.8,
                duration: 1
            };
            
            const newPattern = [...currentPattern, newNote];
            setCurrentPattern(newPattern);
            updateParentData(newPattern);
        }
    };
    
    const handleCanvasMouseUp = () => {
        setIsPainting(false);
    };
    
    const clearPattern = () => {
        setCurrentPattern([]);
        setSelectedNotes([]);
        updateParentData([]);
    };
    
    return (
        <div className="melody-bass-generator">
            <div className="melody-bass-tabs">
                <button
                    className={activeTab === 'melody' ? 'active' : ''}
                    onClick={() => setActiveTab('melody')}
                >
                    MELODY
                </button>
                <button
                    className={activeTab === 'bass' ? 'active' : ''}
                    onClick={() => setActiveTab('bass')}
                >
                    BASS
                </button>
            </div>
            
            <div className="melody-bass-controls">
                <button 
                    className="generate-btn" 
                    onClick={activeTab === 'melody' ? generateMelody : generateBass}
                >
                    NEW {activeTab.toUpperCase()}
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
                    onClick={clearPattern}
                    disabled={currentPattern.length === 0}
                >
                    CLEAR
                </button>
                
                <button 
                    className={`scale-highlight-btn ${showScaleHighlight ? 'active' : ''}`}
                    onClick={() => setShowScaleHighlight(!showScaleHighlight)}
                    title="Toggle scale highlighting"
                >
                    SCALE
                </button>
                
                <div className="pattern-info">
                    <span className="note-count">{currentPattern.length} notes</span>
                    {selectedNotes.length > 0 && (
                        <span className="selected-count"> | {selectedNotes.length} selected</span>
                    )}
                </div>
            </div>
            
            <div className="piano-roll-container">
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={500}
                    className="piano-roll-canvas"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                />
            </div>
            
            <div className="keyboard-shortcuts">
                <span className="shortcut-hint">
                    Click to add/select | Shift+Click for multi-select | 
                    Ctrl+↑/↓ move octave | ↑/↓ move in scale | Delete to remove
                </span>
            </div>
        </div>
    );
};

export default MelodyBassGenerator;
