import React, { useState } from 'react';
import FileExplorerPanel from './FileExplorerPanel';
import DrumGenerator from './DrumGenerator';
import ChordGenerator from './ChordGenerator';
import MelodyBassGenerator from './MelodyBassGenerator';
import { PatternGenerator } from './PatternGenerator';
import './App.css';

const FreallyApp = () => {
    const [theme, setTheme] = useState('dark');
    const [activeGenerator, setActiveGenerator] = useState('drums');
    const [key, setKey] = useState('C');
    const [scale, setScale] = useState('Minor');
    const [tempo, setTempo] = useState(140);
    const [genre, setGenre] = useState('Trap');
    const [bars, setBars] = useState(4);

    // Generator states
    const [drumPattern, setDrumPattern] = useState(null);
    const [chordPattern, setChordPattern] = useState([]);
    const [melodyPattern, setMelodyPattern] = useState([]);
    const [bassPattern, setBassPattern] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);

    const isDark = theme === 'dark';

    /**
     * Handle folder selection from file explorer
     */
    const handleFolderSelect = (folder) => {
        setSelectedFolder(folder);
    };

    /**
     * Handle folder analysis and generation
     */
    const handleGenerateFromFolder = ({ folder, characteristics, files }) => {
        console.log('Generating from folder:', folder.name);
        console.log('Detected characteristics:', characteristics);

        // Auto-set detected characteristics
        setKey(characteristics.key);
        setScale(characteristics.scale);
        setTempo(characteristics.tempo);
        setGenre(characteristics.genre);

        // Generate pattern based on active generator
        const generator = new PatternGenerator();

        if (activeGenerator === 'drums') {
            const pattern = generator.generateDrums(characteristics, bars);
            setDrumPattern(pattern);
        } else if (activeGenerator === 'chords') {
            const pattern = generator.generateChords(characteristics, bars);
            setChordPattern(pattern);
        } else if (activeGenerator === 'melody') {
            const pattern = generator.generateMelody(characteristics, bars, chordPattern);
            setMelodyPattern(pattern);
        } else if (activeGenerator === 'bass') {
            const pattern = generator.generateBass(characteristics, bars, chordPattern);
            setBassPattern(pattern);
        }
    };

    /**
     * Toggle theme
     */
    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    /**
     * Render active generator
     */
    const renderGenerator = () => {
        const commonProps = {
            theme,
            scale,
            tempo,
            genre,
            bars,
            selectedFolder
        };

        switch (activeGenerator) {
            case 'drums':
                return (
                    <DrumGenerator
                        {...commonProps}
                        pattern={drumPattern}
                        onPatternChange={setDrumPattern}
                    />
                );
            case 'chords':
                return (
                    <ChordGenerator
                        {...commonProps}
                        chordPattern={chordPattern}
                        onChordPatternChange={setChordPattern}
                    />
                );
            case 'melody':
                return (
                    <MelodyBassGenerator
                        {...commonProps}
                        type="melody"
                        pattern={melodyPattern}
                        onPatternChange={setMelodyPattern}
                        chordProgression={chordPattern}
                    />
                );
            case 'bass':
                return (
                    <MelodyBassGenerator
                        {...commonProps}
                        type="bass"
                        pattern={bassPattern}
                        onPatternChange={setBassPattern}
                        chordProgression={chordPattern}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className={`freally-app ${isDark ? 'dark' : 'light'}`}>
            {/* Header */}
            <div className="freally-header">
                <div className="freally-logo">
                    🌊 Freally MIDI Generator
                </div>

                <div className="freally-controls">
                    {/* Global Settings */}
                    <div className="global-settings">
                        <select value={key} onChange={(e) => setKey(e.target.value)}>
                            {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => (
                                <option key={k} value={k}>{k}</option>
                            ))}
                        </select>

                        <select value={scale} onChange={(e) => setScale(e.target.value)}>
                            <option value="Major">Major</option>
                            <option value="Minor">Minor</option>
                            <option value="Harmonic Minor">Harmonic Minor</option>
                            <option value="Dorian">Dorian</option>
                        </select>

                        <input
                            type="number"
                            value={tempo}
                            onChange={(e) => setTempo(Number(e.target.value))}
                            min="60"
                            max="200"
                            style={{ width: '60px' }}
                        />
                        <span>BPM</span>

                        <select value={bars} onChange={(e) => setBars(Number(e.target.value))}>
                            <option value={4}>4 Bars</option>
                            <option value={8}>8 Bars</option>
                        </select>
                    </div>

                    <button className="theme-toggle" onClick={toggleTheme}>
                        {isDark ? '☀️ Light' : '🌙 Dark'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="freally-main">
                {/* File Explorer */}
                <FileExplorerPanel
                    onGenerateFromFolder={handleGenerateFromFolder}
                    onFolderSelect={handleFolderSelect}
                    theme={theme}
                />

                {/* Generator Area */}
                <div className="generator-area">
                    {/* Generator Tabs */}
                    <div className="generator-tabs">
                        <button
                            className={activeGenerator === 'drums' ? 'active' : ''}
                            onClick={() => setActiveGenerator('drums')}
                        >
                            🥁 Drums
                        </button>
                        <button
                            className={activeGenerator === 'chords' ? 'active' : ''}
                            onClick={() => setActiveGenerator('chords')}
                        >
                            🎹 Chords
                        </button>
                        <button
                            className={activeGenerator === 'melody' ? 'active' : ''}
                            onClick={() => setActiveGenerator('melody')}
                        >
                            🎵 Melody
                        </button>
                        <button
                            className={activeGenerator === 'bass' ? 'active' : ''}
                            onClick={() => setActiveGenerator('bass')}
                        >
                            🎸 Bass
                        </button>
                    </div>

                    {/* Active Generator */}
                    <div className="generator-content">
                        {renderGenerator()}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="freally-footer">
                <div className="footer-info">
                    <span>Genre: {genre}</span>
                    <span>•</span>
                    <span>Key: {key} {scale}</span>
                    <span>•</span>
                    <span>Tempo: {tempo} BPM</span>
                    <span>•</span>
                    <span>Bars: {bars}</span>
                </div>
                <div className="footer-hint">
                    💡 Right-click any folder in File Explorer to analyze and generate patterns
                </div>
            </div>
        </div>
    );
};

export default FreallyApp;
