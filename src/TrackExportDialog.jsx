import React, { useState } from 'react';
import './TrackExportDialog.css';

const TrackExportDialog = ({ 
    isOpen, 
    onClose, 
    onExport, 
    availableTracks = [],
    projectName = 'WavLoom_Project' 
}) => {
    const [selectedTracks, setSelectedTracks] = useState([]);
    const [audioFormat, setAudioFormat] = useState('wav');
    const [sampleRate, setSampleRate] = useState(44100);
    const [bitDepth, setBitDepth] = useState(16);
    const [mp3BitRate, setMp3BitRate] = useState(192);
    const [filename, setFilename] = useState(projectName);
    const [isDragging, setIsDragging] = useState(false);

    const toggleTrack = (trackId) => {
        setSelectedTracks(prev => {
            if (prev.includes(trackId)) {
                return prev.filter(id => id !== trackId);
            } else {
                return [...prev, trackId];
            }
        });
    };

    const selectAll = () => {
        if (selectedTracks.length === availableTracks.length) {
            setSelectedTracks([]);
        } else {
            setSelectedTracks(availableTracks.map(t => t.id));
        }
    };

    const handleExportAudio = () => {
        if (selectedTracks.length === 0) {
            alert('Please select at least one track to export');
            return;
        }

        const settings = {
            exportType: 'audio',
            audioFormat,
            filename,
            sampleRate,
            bitDepth,
            mp3BitRate,
            numberOfChannels: 2,
            tracks: availableTracks.filter(t => selectedTracks.includes(t.id))
        };

        onExport(settings);
    };

    const handleExportMIDI = () => {
        if (selectedTracks.length === 0) {
            alert('Please select at least one track to export');
            return;
        }

        const settings = {
            exportType: 'midi',
            filename,
            tracks: availableTracks.filter(t => selectedTracks.includes(t.id))
        };

        onExport(settings);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleExportMIDI();
    };

    if (!isOpen) return null;

    const allSelected = selectedTracks.length === availableTracks.length && availableTracks.length > 0;

    return (
        <div className="track-export-overlay" onClick={onClose}>
            <div className="track-export-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="track-export-header">
                    <h2>Export Tracks</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="track-export-content">
                    {/* Track Selection List */}
                    <div className="track-list">
                        <div 
                            className={`track-item ${allSelected ? 'selected' : ''}`}
                            onClick={selectAll}
                        >
                            <span className="track-name">ALL</span>
                            <button className="add-track-btn">
                                {allSelected ? '−' : '+'}
                            </button>
                        </div>

                        {availableTracks.map(track => (
                            <div
                                key={track.id}
                                className={`track-item ${selectedTracks.includes(track.id) ? 'selected' : ''}`}
                                onClick={() => toggleTrack(track.id)}
                            >
                                <span className="track-name">{track.name}</span>
                                <button className="add-track-btn">
                                    {selectedTracks.includes(track.id) ? '−' : '+'}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Drag & Drop MIDI Export Zone */}
                    <div
                        className={`midi-drop-zone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleExportMIDI}
                    >
                        <div className="drop-icon">▲</div>
                        <div className="drop-text">DRAG & DROP MIDI</div>
                        <div className="drop-hint">or click to export</div>
                    </div>

                    {/* Export Settings */}
                    <div className="export-settings">
                        <div className="settings-row">
                            <label>Format:</label>
                            <div className="format-buttons">
                                <button
                                    className={audioFormat === 'wav' ? 'active' : ''}
                                    onClick={() => setAudioFormat('wav')}
                                >
                                    WAV
                                </button>
                                <button
                                    className={audioFormat === 'mp3' ? 'active' : ''}
                                    onClick={() => setAudioFormat('mp3')}
                                >
                                    MP3
                                </button>
                            </div>
                        </div>

                        <div className="settings-row">
                            <label>Sample Rate:</label>
                            <select
                                value={sampleRate}
                                onChange={(e) => setSampleRate(Number(e.target.value))}
                            >
                                <option value={44100}>44.1 kHz</option>
                                <option value={48000}>48 kHz</option>
                                <option value={96000}>96 kHz</option>
                            </select>
                        </div>

                        {audioFormat === 'wav' && (
                            <div className="settings-row">
                                <label>Bit Depth:</label>
                                <select
                                    value={bitDepth}
                                    onChange={(e) => setBitDepth(Number(e.target.value))}
                                >
                                    <option value={16}>16-bit</option>
                                    <option value={24}>24-bit</option>
                                    <option value={32}>32-bit</option>
                                </select>
                            </div>
                        )}

                        {audioFormat === 'mp3' && (
                            <div className="settings-row">
                                <label>Bit Rate:</label>
                                <select
                                    value={mp3BitRate}
                                    onChange={(e) => setMp3BitRate(Number(e.target.value))}
                                >
                                    <option value={128}>128 kbps</option>
                                    <option value={192}>192 kbps</option>
                                    <option value={256}>256 kbps</option>
                                    <option value={320}>320 kbps</option>
                                </select>
                            </div>
                        )}

                        <div className="settings-row">
                            <label>Filename:</label>
                            <input
                                type="text"
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                placeholder="Enter filename"
                            />
                        </div>
                    </div>
                </div>

                <div className="track-export-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button 
                        className="export-audio-btn"
                        onClick={handleExportAudio}
                        disabled={selectedTracks.length === 0}
                    >
                        Export Audio ({selectedTracks.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrackExportDialog;
