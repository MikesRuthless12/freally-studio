import React, { useState, useEffect } from 'react';
import { useTranslation } from './i18n/I18nContext.jsx';
import './PresetBrowser.css';

const PresetBrowser = ({ isOpen, onClose, presetManager, onLoadPreset }) => {
    const { t } = useTranslation();
    const [presets, setPresets] = useState([]);
    const [filteredPresets, setFilteredPresets] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedPreset, setSelectedPreset] = useState(null);

    const categories = ['All', 'User', 'Trap', 'Hip Hop', 'House', 'Techno', 'DnB', 'Other'];

    useEffect(() => {
        if (isOpen) {
            loadPresets();
        }
    }, [isOpen]);

    useEffect(() => {
        filterPresets();
    }, [presets, searchQuery, selectedCategory]);

    const loadPresets = async () => {
        try {
            const allPresets = await presetManager.getAllPresets();
            setPresets(allPresets);
        } catch (error) {
            console.error('Error loading presets:', error);
        }
    };

    const filterPresets = () => {
        let filtered = presets;

        // Filter by category
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(p => p.category === selectedCategory);
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.description?.toLowerCase().includes(query) ||
                p.genre?.toLowerCase().includes(query) ||
                p.tags?.some(tag => tag.toLowerCase().includes(query))
            );
        }

        setFilteredPresets(filtered);
    };

    const handleLoadPreset = async () => {
        if (!selectedPreset) return;

        try {
            const presetData = await presetManager.loadPreset(selectedPreset.id);
            onLoadPreset(presetData);
            onClose();
        } catch (error) {
            console.error('Error loading preset:', error);
            alert(t('preset.loadFailed'));
        }
    };

    const handleDeletePreset = async (presetId, e) => {
        e.stopPropagation();
        
        if (!confirm(t('preset.deleteConfirm'))) return;

        try {
            await presetManager.deletePreset(presetId);
            loadPresets();
            if (selectedPreset?.id === presetId) {
                setSelectedPreset(null);
            }
        } catch (error) {
            console.error('Error deleting preset:', error);
            alert(t('preset.deleteFailed'));
        }
    };

    const handleExportPreset = async (presetId, e) => {
        e.stopPropagation();
        
        try {
            await presetManager.exportPreset(presetId);
        } catch (error) {
            console.error('Error exporting preset:', error);
            alert(t('preset.exportFailed'));
        }
    };

    const handleImportPreset = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await presetManager.importPreset(file);
            loadPresets();
            alert(t('preset.importSuccess'));
        } catch (error) {
            console.error('Error importing preset:', error);
            alert(t('preset.importFailed'));
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    if (!isOpen) return null;

    return (
        <div className="preset-browser-overlay" onClick={onClose}>
            <div className="preset-browser" onClick={(e) => e.stopPropagation()}>
                <div className="preset-browser-header">
                    <h2>Preset Browser</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="preset-browser-toolbar">
                    <input
                        type="text"
                        className="preset-search"
                        placeholder={t('browser.searchPresets')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    
                    <label className="import-btn">
                        Import
                        <input
                            type="file"
                            accept=".wlpreset"
                            onChange={handleImportPreset}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>

                <div className="preset-browser-content">
                    <div className="preset-categories">
                        {categories.map(category => (
                            <button
                                key={category}
                                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(category)}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    <div className="preset-list">
                        {filteredPresets.length === 0 ? (
                            <div className="empty-message">
                                No presets found. Create your first preset!
                            </div>
                        ) : (
                            filteredPresets.map(preset => (
                                <div
                                    key={preset.id}
                                    className={`preset-item ${selectedPreset?.id === preset.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedPreset(preset)}
                                >
                                    <div className="preset-item-header">
                                        <span className="preset-name">{preset.name}</span>
                                        <div className="preset-actions">
                                            <button
                                                className="preset-action-btn"
                                                onClick={(e) => handleExportPreset(preset.id, e)}
                                                title={t('common.export')}
                                            >
                                                ↓
                                            </button>
                                            <button
                                                className="preset-action-btn delete"
                                                onClick={(e) => handleDeletePreset(preset.id, e)}
                                                title={t('common.delete')}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                    <div className="preset-item-info">
                                        <span className="preset-genre">{preset.genre} {preset.subGenre && `- ${preset.subGenre}`}</span>
                                        <span className="preset-tempo">{preset.tempo} BPM</span>
                                    </div>
                                    {preset.description && (
                                        <div className="preset-description">{preset.description}</div>
                                    )}
                                    <div className="preset-date">{formatDate(preset.dateCreated)}</div>
                                </div>
                            ))
                        )}
                    </div>

                    {selectedPreset && (
                        <div className="preset-details">
                            <h3>{selectedPreset.name}</h3>
                            <div className="preset-detail-row">
                                <span className="detail-label">Genre:</span>
                                <span>{selectedPreset.genre} - {selectedPreset.subGenre}</span>
                            </div>
                            <div className="preset-detail-row">
                                <span className="detail-label">Tempo:</span>
                                <span>{selectedPreset.tempo} BPM</span>
                            </div>
                            <div className="preset-detail-row">
                                <span className="detail-label">Category:</span>
                                <span>{selectedPreset.category}</span>
                            </div>
                            {selectedPreset.tags && selectedPreset.tags.length > 0 && (
                                <div className="preset-detail-row">
                                    <span className="detail-label">Tags:</span>
                                    <div className="preset-tags">
                                        {selectedPreset.tags.map((tag, i) => (
                                            <span key={i} className="preset-tag">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="preset-browser-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="load-btn"
                        onClick={handleLoadPreset}
                        disabled={!selectedPreset}
                    >
                        Load Preset
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PresetBrowser;
