import React, { useState } from 'react';
import './FolderSelectorDialog.css';
import { FolderAnalyzer } from './FolderAnalyzer';
import { PatternGenerator } from './PatternGenerator';

const FolderSelectorDialog = ({ 
    isOpen, 
    onClose, 
    onGenerate, 
    generatorType = 'melody',
    currentSettings = {}
}) => {
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [folderCharacteristics, setFolderCharacteristics] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);

    const folderAnalyzer = new FolderAnalyzer();
    const patternGenerator = new PatternGenerator();

    /**
     * Handle folder selection
     */
    const handleSelectFolder = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setSelectedFiles(files);
        setAnalyzing(true);
        setProgress(0);

        try {
            // Analyze folder
            setProgress(20);
            const characteristics = await folderAnalyzer.analyzeFolder(files);
            
            setProgress(100);
            setFolderCharacteristics(characteristics);
            setAnalyzing(false);

            console.log('Folder Analysis:', characteristics);
        } catch (error) {
            console.error('Error analyzing folder:', error);
            alert('Error analyzing folder. Please try again.');
            setAnalyzing(false);
        }
    };

    /**
     * Generate pattern from analysis
     */
    const handleGenerate = () => {
        if (!folderCharacteristics) {
            alert('Please select a folder first');
            return;
        }

        let pattern;
        const { key, scale, tempo, genre, complexity } = folderCharacteristics;

        // Generate based on type
        if (generatorType === 'chords') {
            pattern = patternGenerator.generateChords(folderCharacteristics, currentSettings.bars || 4);
        } else if (generatorType === 'melody') {
            pattern = patternGenerator.generateMelody(
                folderCharacteristics, 
                currentSettings.bars || 4,
                currentSettings.chordProgression || []
            );
        } else if (generatorType === 'bass') {
            pattern = patternGenerator.generateBass(
                folderCharacteristics,
                currentSettings.bars || 4,
                currentSettings.chordProgression || []
            );
        } else if (generatorType === 'drums') {
            pattern = patternGenerator.generateDrums(folderCharacteristics, currentSettings.bars || 4);
        }

        // Return generated pattern and detected settings
        onGenerate({
            pattern,
            detectedSettings: {
                key,
                scale,
                tempo,
                genre,
                complexity
            }
        });

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="folder-selector-overlay" onClick={onClose}>
            <div className="folder-selector-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="folder-selector-header">
                    <h2>Generate from Folder</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="folder-selector-content">
                    <div className="folder-selector-info">
                        <p>Select a folder containing MIDI files or audio samples.</p>
                        <p>The system will analyze the musical characteristics and generate a new pattern matching that style.</p>
                    </div>

                    <div className="folder-selector-input">
                        <label className="folder-select-btn">
                            {selectedFiles.length === 0 ? '📁 Select Folder' : `📁 ${selectedFiles.length} files selected`}
                            <input
                                type="file"
                                webkitdirectory="true"
                                directory="true"
                                multiple
                                onChange={handleSelectFolder}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    {analyzing && (
                        <div className="analysis-progress">
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p>Analyzing folder... {progress}%</p>
                        </div>
                    )}

                    {folderCharacteristics && (
                        <div className="analysis-results">
                            <h3>Detected Characteristics</h3>
                            
                            <div className="result-grid">
                                <div className="result-item">
                                    <span className="result-label">Key:</span>
                                    <span className="result-value">{folderCharacteristics.key}</span>
                                </div>
                                
                                <div className="result-item">
                                    <span className="result-label">Scale:</span>
                                    <span className="result-value">{folderCharacteristics.scale}</span>
                                </div>
                                
                                <div className="result-item">
                                    <span className="result-label">Tempo:</span>
                                    <span className="result-value">{folderCharacteristics.tempo} BPM</span>
                                </div>
                                
                                <div className="result-item">
                                    <span className="result-label">Genre:</span>
                                    <span className="result-value">{folderCharacteristics.genre}</span>
                                </div>
                                
                                <div className="result-item">
                                    <span className="result-label">Complexity:</span>
                                    <span className="result-value">{folderCharacteristics.complexity}</span>
                                </div>
                                
                                <div className="result-item">
                                    <span className="result-label">Confidence:</span>
                                    <span className="result-value">{folderCharacteristics.confidence}%</span>
                                </div>
                            </div>

                            <div className="analysis-details">
                                <p>📊 Analyzed {folderCharacteristics.midiCount} MIDI files and {folderCharacteristics.audioCount} audio files</p>
                                {folderCharacteristics.chordProgressions && folderCharacteristics.chordProgressions.length > 0 && (
                                    <p>🎹 Found {folderCharacteristics.chordProgressions.length} chord progressions</p>
                                )}
                                {folderCharacteristics.melodicPatterns && folderCharacteristics.melodicPatterns.length > 0 && (
                                    <p>🎵 Found {folderCharacteristics.melodicPatterns.length} melodic patterns</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="folder-selector-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button 
                        className="generate-btn" 
                        onClick={handleGenerate}
                        disabled={!folderCharacteristics || analyzing}
                    >
                        Generate Pattern
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FolderSelectorDialog;
