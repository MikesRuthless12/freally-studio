import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from './i18n/I18nContext';

const BrowserEnhanced = ({ theme, onPreview, onDrop }) => {
    const { t } = useTranslation();
    const [samples, setSamples] = useState([]);
    const [folders, setFolders] = useState([]);
    const [selectedSample, setSelectedSample] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [filterTags, setFilterTags] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [filterGenre, setFilterGenre] = useState('');
    const [filterBPM, setFilterBPM] = useState('');
    const [filterKey, setFilterKey] = useState('');
    const [filterInstrument, setFilterInstrument] = useState('');
    const [showTagDialog, setShowTagDialog] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [waveformCache, setWaveformCache] = useState({});
    const [view, setView] = useState('samples'); // 'samples' or 'folders'
    const canvasRef = useRef(null);

    // Load samples and folders on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        if (!window.sampleDatabase) return;
        
        const samplesData = await window.sampleDatabase.getAllSamples();
        const foldersData = await window.sampleDatabase.getFolders();
        const tagsData = await window.sampleDatabase.getAllTags();
        
        setSamples(samplesData);
        setFolders(foldersData);
        setAllTags(tagsData);
    };

    // Filter samples
    const filteredSamples = samples.filter(sample => {
        if (searchText && !sample.name.toLowerCase().includes(searchText.toLowerCase())) {
            return false;
        }
        if (filterTags.length > 0 && !filterTags.every(tag => sample.tags.includes(tag))) {
            return false;
        }
        if (filterGenre && sample.genre !== filterGenre) {
            return false;
        }
        if (filterBPM && sample.bpm && Math.abs(sample.bpm - parseInt(filterBPM)) > 5) {
            return false;
        }
        if (filterKey && sample.key !== filterKey) {
            return false;
        }
        if (filterInstrument && sample.instrument !== filterInstrument) {
            return false;
        }
        return true;
    });

    // Add folder
    const handleAddFolder = async () => {
        try {
            const dirHandle = await window.showDirectoryPicker();
            const folderId = await window.sampleDatabase.addFolder(dirHandle, dirHandle.name);
            
            // Scan folder for audio files
            await scanFolder(dirHandle, folderId);
            await loadData();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error adding folder:', err);
            }
        }
    };

    const scanFolder = async (dirHandle, folderId, path = '') => {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                if (file.type.startsWith('audio/')) {
                    // Extract metadata
                    const metadata = await extractMetadata(file);
                    
                    await window.sampleDatabase.addSample({
                        name: file.name,
                        folder: folderId,
                        path: path + '/' + file.name,
                        type: 'audio',
                        duration: metadata.duration,
                        waveformData: metadata.waveformData,
                        lastModified: file.lastModified
                    });
                }
            } else if (entry.kind === 'directory') {
                await scanFolder(entry, folderId, path + '/' + entry.name);
            }
        }
    };

    const extractMetadata = async (file) => {
        return new Promise((resolve) => {
            // Reuse shared AudioContext instead of creating a new one per file
            if (!window.sharedAnalysisCtx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
            }
            const audioContext = window.sharedAnalysisCtx;
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const audioBuffer = await audioContext.decodeAudioData(e.target.result);
                    const waveformData = generateWaveformData(audioBuffer);
                    
                    resolve({
                        duration: audioBuffer.duration,
                        waveformData: waveformData
                    });
                } catch (err) {
                    console.error('Error decoding audio:', err);
                    resolve({ duration: null, waveformData: null });
                }
            };
            
            reader.readAsArrayBuffer(file);
        });
    };

    const generateWaveformData = (audioBuffer) => {
        const rawData = audioBuffer.getChannelData(0);
        const samples = 100; // Number of bars in waveform
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        
        for (let i = 0; i < samples; i++) {
            let blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[blockStart + j]);
            }
            filteredData.push(sum / blockSize);
        }
        
        return filteredData;
    };

    // Draw waveform
    const drawWaveform = (sample) => {
        if (!canvasRef.current || !sample.waveformData) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = theme.accent || '#39ff14';
        
        const data = sample.waveformData;
        const barWidth = width / data.length;
        
        data.forEach((value, i) => {
            const barHeight = value * height;
            const x = i * barWidth;
            const y = (height - barHeight) / 2;
            ctx.fillRect(x, y, barWidth - 1, barHeight);
        });
    };

    useEffect(() => {
        if (selectedSample) {
            drawWaveform(selectedSample);
        }
    }, [selectedSample]);

    // Tag management
    const handleAddTag = async () => {
        if (!selectedSample || !newTag.trim()) return;
        
        await window.sampleDatabase.addTag(selectedSample.id, newTag.trim());
        setNewTag('');
        await loadData();
        
        // Update selected sample
        const updated = await window.sampleDatabase.getSample(selectedSample.id);
        setSelectedSample(updated);
    };

    const handleRemoveTag = async (tag) => {
        if (!selectedSample) return;
        
        await window.sampleDatabase.removeTag(selectedSample.id, tag);
        await loadData();
        
        const updated = await window.sampleDatabase.getSample(selectedSample.id);
        setSelectedSample(updated);
    };

    const handleUpdateMetadata = async (field, value) => {
        if (!selectedSample) return;
        
        await window.sampleDatabase.updateSample(selectedSample.id, { [field]: value });
        await loadData();
        
        const updated = await window.sampleDatabase.getSample(selectedSample.id);
        setSelectedSample(updated);
    };

    const handleRemoveFolder = async (folderId) => {
        if (confirm(t('browser.removeFolderConfirm'))) {
            await window.sampleDatabase.removeFolder(folderId);
            await loadData();
        }
    };

    const toggleFilterTag = (tag) => {
        if (filterTags.includes(tag)) {
            setFilterTags(filterTags.filter(t => t !== tag));
        } else {
            setFilterTags([...filterTags, tag]);
        }
    };

    return (
        <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            backgroundColor: theme.panel, 
            borderRight: `1px solid ${theme.panelBorder}`,
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ 
                padding: '10px', 
                borderBottom: `1px solid ${theme.panelBorder}`,
                backgroundColor: theme.bg
            }}>
                <h3 style={{ margin: '0 0 10px 0', color: theme.accent, fontSize: '14px' }}>
                    SAMPLE LIBRARY
                </h3>
                
                {/* View Tabs */}
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                    <button 
                        onClick={() => setView('samples')}
                        style={{ 
                            flex: 1, 
                            padding: '5px', 
                            fontSize: '10px',
                            backgroundColor: view === 'samples' ? theme.accent : theme.cellInactive,
                            color: view === 'samples' ? theme.accentText : theme.text,
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        SAMPLES
                    </button>
                    <button 
                        onClick={() => setView('folders')}
                        style={{ 
                            flex: 1, 
                            padding: '5px', 
                            fontSize: '10px',
                            backgroundColor: view === 'folders' ? theme.accent : theme.cellInactive,
                            color: view === 'folders' ? theme.accentText : theme.text,
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        FOLDERS
                    </button>
                </div>

                {/* Search */}
                <input
                    type="text"
                    placeholder={t('browser.searchSamples')}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '5px',
                        backgroundColor: theme.bg,
                        color: theme.text,
                        border: `1px solid ${theme.panelBorder}`,
                        borderRadius: '3px',
                        fontSize: '11px',
                        marginBottom: '5px'
                    }}
                />

                {/* Add Folder Button */}
                <button
                    onClick={handleAddFolder}
                    style={{
                        width: '100%',
                        padding: '5px',
                        backgroundColor: theme.accent,
                        color: theme.accentText,
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    }}
                >
                    + ADD FOLDER
                </button>
            </div>

            {/* Filters */}
            <div style={{ 
                padding: '10px', 
                borderBottom: `1px solid ${theme.panelBorder}`,
                fontSize: '10px'
            }}>
                <div style={{ marginBottom: '5px', color: theme.textDim, fontWeight: 'bold' }}>FILTERS</div>
                
                {/* Tag Filter */}
                <div style={{ marginBottom: '5px' }}>
                    <div style={{ color: theme.textMuted, marginBottom: '3px' }}>Tags:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {allTags.map(tag => (
                            <span
                                key={tag}
                                onClick={() => toggleFilterTag(tag)}
                                style={{
                                    padding: '2px 5px',
                                    backgroundColor: filterTags.includes(tag) ? theme.accent : theme.cellInactive,
                                    color: filterTags.includes(tag) ? theme.accentText : theme.textDim,
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontSize: '9px'
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Other Filters */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                    <input
                        type="text"
                        placeholder={t('browser.bpmPlaceholder')}
                        value={filterBPM}
                        onChange={(e) => setFilterBPM(e.target.value)}
                        style={{
                            padding: '3px',
                            backgroundColor: theme.bg,
                            color: theme.text,
                            border: `1px solid ${theme.panelBorder}`,
                            borderRadius: '2px',
                            fontSize: '9px'
                        }}
                    />
                    <input
                        type="text"
                        placeholder={t('browser.keyPlaceholder')}
                        value={filterKey}
                        onChange={(e) => setFilterKey(e.target.value)}
                        style={{
                            padding: '3px',
                            backgroundColor: theme.bg,
                            color: theme.text,
                            border: `1px solid ${theme.panelBorder}`,
                            borderRadius: '2px',
                            fontSize: '9px'
                        }}
                    />
                </div>

                {filterTags.length > 0 || filterBPM || filterKey ? (
                    <button
                        onClick={() => {
                            setFilterTags([]);
                            setFilterBPM('');
                            setFilterKey('');
                            setFilterGenre('');
                            setFilterInstrument('');
                        }}
                        style={{
                            marginTop: '5px',
                            width: '100%',
                            padding: '3px',
                            backgroundColor: theme.danger,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '9px'
                        }}
                    >
                        CLEAR FILTERS
                    </button>
                ) : null}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {view === 'samples' ? (
                    <>
                        <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: '5px' }}>
                            {filteredSamples.length} sample(s)
                        </div>
                        {filteredSamples.map(sample => (
                            <div
                                key={sample.id}
                                onClick={() => setSelectedSample(sample)}
                                style={{
                                    padding: '8px',
                                    marginBottom: '5px',
                                    backgroundColor: selectedSample?.id === sample.id ? theme.highlight : theme.bg,
                                    border: `1px solid ${theme.panelBorder}`,
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontSize: '11px'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', color: theme.text, marginBottom: '3px' }}>
                                    {sample.name}
                                </div>
                                {sample.tags.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '3px' }}>
                                        {sample.tags.map(tag => (
                                            <span
                                                key={tag}
                                                style={{
                                                    padding: '1px 4px',
                                                    backgroundColor: theme.accent,
                                                    color: theme.accentText,
                                                    borderRadius: '2px',
                                                    fontSize: '8px'
                                                }}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: '9px', color: theme.textMuted, marginTop: '3px' }}>
                                    {sample.bpm && `${sample.bpm} BPM`}
                                    {sample.key && ` • ${sample.key}`}
                                    {sample.duration && ` • ${sample.duration.toFixed(1)}s`}
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: '5px' }}>
                            {folders.length} folder(s)
                        </div>
                        {folders.map(folder => (
                            <div
                                key={folder.id}
                                style={{
                                    padding: '8px',
                                    marginBottom: '5px',
                                    backgroundColor: theme.bg,
                                    border: `1px solid ${theme.panelBorder}`,
                                    borderRadius: '3px',
                                    fontSize: '11px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: theme.text }}>
                                            📁 {folder.name}
                                        </div>
                                        <div style={{ fontSize: '9px', color: theme.textMuted }}>
                                            {folder.path}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveFolder(folder.id)}
                                        style={{
                                            padding: '2px 5px',
                                            backgroundColor: theme.danger,
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '2px',
                                            cursor: 'pointer',
                                            fontSize: '9px'
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Sample Details Panel */}
            {selectedSample && (
                <div style={{ 
                    padding: '10px', 
                    borderTop: `1px solid ${theme.panelBorder}`,
                    backgroundColor: theme.bg,
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: theme.accent, marginBottom: '5px' }}>
                        {selectedSample.name}
                    </div>

                    {/* Waveform */}
                    <canvas
                        ref={canvasRef}
                        width={230}
                        height={60}
                        style={{
                            width: '100%',
                            height: '60px',
                            backgroundColor: theme.gridBg,
                            marginBottom: '10px',
                            borderRadius: '3px'
                        }}
                    />

                    {/* Metadata */}
                    <div style={{ fontSize: '10px', marginBottom: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '5px' }}>
                            <div>
                                <label style={{ color: theme.textMuted, display: 'block', marginBottom: '2px' }}>BPM</label>
                                <input
                                    type="number"
                                    value={selectedSample.bpm || ''}
                                    onChange={(e) => handleUpdateMetadata('bpm', parseInt(e.target.value) || null)}
                                    placeholder="120"
                                    style={{
                                        width: '100%',
                                        padding: '3px',
                                        backgroundColor: theme.gridBg,
                                        color: theme.text,
                                        border: `1px solid ${theme.panelBorder}`,
                                        borderRadius: '2px',
                                        fontSize: '10px'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ color: theme.textMuted, display: 'block', marginBottom: '2px' }}>Key</label>
                                <input
                                    type="text"
                                    value={selectedSample.key || ''}
                                    onChange={(e) => handleUpdateMetadata('key', e.target.value || null)}
                                    placeholder="C"
                                    style={{
                                        width: '100%',
                                        padding: '3px',
                                        backgroundColor: theme.gridBg,
                                        color: theme.text,
                                        border: `1px solid ${theme.panelBorder}`,
                                        borderRadius: '2px',
                                        fontSize: '10px'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '5px' }}>
                            <label style={{ color: theme.textMuted, display: 'block', marginBottom: '2px' }}>Genre</label>
                            <input
                                type="text"
                                value={selectedSample.genre || ''}
                                onChange={(e) => handleUpdateMetadata('genre', e.target.value || null)}
                                placeholder="Trap"
                                style={{
                                    width: '100%',
                                    padding: '3px',
                                    backgroundColor: theme.gridBg,
                                    color: theme.text,
                                    border: `1px solid ${theme.panelBorder}`,
                                    borderRadius: '2px',
                                    fontSize: '10px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ color: theme.textMuted, display: 'block', marginBottom: '2px' }}>Instrument</label>
                            <input
                                type="text"
                                value={selectedSample.instrument || ''}
                                onChange={(e) => handleUpdateMetadata('instrument', e.target.value || null)}
                                placeholder="Kick"
                                style={{
                                    width: '100%',
                                    padding: '3px',
                                    backgroundColor: theme.gridBg,
                                    color: theme.text,
                                    border: `1px solid ${theme.panelBorder}`,
                                    borderRadius: '2px',
                                    fontSize: '10px'
                                }}
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div style={{ fontSize: '10px' }}>
                        <div style={{ color: theme.textMuted, marginBottom: '3px' }}>Tags:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '5px' }}>
                            {selectedSample.tags.map(tag => (
                                <span
                                    key={tag}
                                    style={{
                                        padding: '2px 5px',
                                        backgroundColor: theme.accent,
                                        color: theme.accentText,
                                        borderRadius: '2px',
                                        fontSize: '9px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                    }}
                                >
                                    {tag}
                                    <span
                                        onClick={() => handleRemoveTag(tag)}
                                        style={{ cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        ✕
                                    </span>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '3px' }}>
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                                placeholder={t('browser.addTag')}
                                style={{
                                    flex: 1,
                                    padding: '3px',
                                    backgroundColor: theme.gridBg,
                                    color: theme.text,
                                    border: `1px solid ${theme.panelBorder}`,
                                    borderRadius: '2px',
                                    fontSize: '9px'
                                }}
                            />
                            <button
                                onClick={handleAddTag}
                                style={{
                                    padding: '3px 8px',
                                    backgroundColor: theme.accent,
                                    color: theme.accentText,
                                    border: 'none',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    fontSize: '9px'
                                }}
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrowserEnhanced;
