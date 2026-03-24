import React, { useState } from 'react';
import { useTranslation } from './i18n/I18nContext.jsx';
import './SavePresetDialog.css';

const SavePresetDialog = ({ isOpen, onClose, onSave, currentSettings = {} }) => {
    const { t } = useTranslation();
    const [presetName, setPresetName] = useState('');
    const [category, setCategory] = useState('User');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');

    const categories = ['User', 'Trap', 'Hip Hop', 'House', 'Techno', 'DnB', 'Other'];

    const handleSave = () => {
        if (!presetName.trim()) {
            alert('Please enter a preset name');
            return;
        }

        const presetData = {
            name: presetName.trim(),
            category,
            description: description.trim(),
            tags: tags.split(',').map(t => t.trim()).filter(t => t),
            ...currentSettings
        };

        onSave(presetData);
        onClose();
        
        // Reset form
        setPresetName('');
        setCategory('User');
        setDescription('');
        setTags('');
    };

    if (!isOpen) return null;

    return (
        <div className="save-preset-overlay" onClick={onClose}>
            <div className="save-preset-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="save-preset-header">
                    <h2>Save Preset</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="save-preset-content">
                    <div className="form-group">
                        <label>Preset Name *</label>
                        <input
                            type="text"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder={t('preset.enterName')}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('preset.optionalDesc')}
                            rows={3}
                        />
                    </div>

                    <div className="form-group">
                        <label>Tags (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="dark, melodic, 808"
                        />
                    </div>

                    <div className="preset-info">
                        <div className="info-row">
                            <span className="info-label">Genre:</span>
                            <span>{currentSettings.genre} - {currentSettings.subGenre}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Tempo:</span>
                            <span>{currentSettings.tempo} BPM</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Key:</span>
                            <span>{currentSettings.key} {currentSettings.scale}</span>
                        </div>
                    </div>
                </div>

                <div className="save-preset-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="save-btn" onClick={handleSave}>
                        Save Preset
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SavePresetDialog;
