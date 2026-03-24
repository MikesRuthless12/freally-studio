import React, { useState } from 'react';
import './ExportDialog.css';
import { useTranslation } from './i18n/I18nContext.jsx';

const ExportDialog = ({ isOpen, onClose, onExport, projectName = 'WavLoom_Project' }) => {
    const { t } = useTranslation();
    const [exportType, setExportType] = useState('audio'); // 'audio' or 'midi'
    const [audioFormat, setAudioFormat] = useState('wav'); // 'wav' or 'mp3'
    const [exportMode, setExportMode] = useState('combined'); // 'combined' or 'stems'
    const [filename, setFilename] = useState(projectName);

    // Audio settings
    const [sampleRate, setSampleRate] = useState(44100);
    const [bitDepth, setBitDepth] = useState(16); // For WAV
    const [mp3BitRate, setMp3BitRate] = useState(192); // For MP3
    const [numberOfChannels, setNumberOfChannels] = useState(2);

    // Stem selection
    const [includeStems, setIncludeStems] = useState({
        drums: true,
        chords: true,
        melody: true,
        bass: true
    });

    const handleExport = () => {
        const settings = {
            exportType,
            audioFormat,
            exportMode,
            filename,
            sampleRate,
            bitDepth,
            mp3BitRate,
            numberOfChannels,
            includeStems: exportMode === 'stems' ? includeStems : null
        };

        onExport(settings);
    };

    const toggleStem = (stem) => {
        setIncludeStems(prev => ({
            ...prev,
            [stem]: !prev[stem]
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="export-dialog-overlay" onClick={onClose}>
            <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="export-dialog-header">
                    <h2>{t('export.title')}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="export-dialog-content">
                    {/* Export Type */}
                    <div className="export-section">
                        <label className="section-label">{t('export.exportType')}</label>
                        <div className="button-group">
                            <button
                                className={exportType === 'audio' ? 'active' : ''}
                                onClick={() => setExportType('audio')}
                            >
                                {t('export.audio')}
                            </button>
                            <button
                                className={exportType === 'midi' ? 'active' : ''}
                                onClick={() => setExportType('midi')}
                            >
                                {t('export.midi')}
                            </button>
                        </div>
                    </div>

                    {/* Audio Format (only for audio export) */}
                    {exportType === 'audio' && (
                        <div className="export-section">
                            <label className="section-label">{t('export.audioFormat')}</label>
                            <div className="button-group">
                                <button
                                    className={audioFormat === 'wav' ? 'active' : ''}
                                    onClick={() => setAudioFormat('wav')}
                                >
                                    {t('export.wav')}
                                </button>
                                <button
                                    className={audioFormat === 'mp3' ? 'active' : ''}
                                    onClick={() => setAudioFormat('mp3')}
                                >
                                    {t('export.mp3')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Export Mode */}
                    <div className="export-section">
                        <label className="section-label">{t('export.exportMode')}</label>
                        <div className="button-group">
                            <button
                                className={exportMode === 'combined' ? 'active' : ''}
                                onClick={() => setExportMode('combined')}
                            >
                                {t('export.combinedMix')}
                            </button>
                            <button
                                className={exportMode === 'stems' ? 'active' : ''}
                                onClick={() => setExportMode('stems')}
                            >
                                {t('export.separateStems')}
                            </button>
                        </div>
                    </div>

                    {/* Stem Selection (only for stems mode) */}
                    {exportMode === 'stems' && (
                        <div className="export-section">
                            <label className="section-label">{t('export.includeStems')}</label>
                            <div className="stem-checkboxes">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={includeStems.drums}
                                        onChange={() => toggleStem('drums')}
                                    />
                                    <span>{t('app.drums')}</span>
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={includeStems.chords}
                                        onChange={() => toggleStem('chords')}
                                    />
                                    <span>{t('app.chords')}</span>
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={includeStems.melody}
                                        onChange={() => toggleStem('melody')}
                                    />
                                    <span>{t('app.melody')}</span>
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={includeStems.bass}
                                        onChange={() => toggleStem('bass')}
                                    />
                                    <span>{t('app.bass')}</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Audio Settings (only for audio export) */}
                    {exportType === 'audio' && (
                        <>
                            <div className="export-section">
                                <label className="section-label">{t('export.sampleRate')}</label>
                                <select
                                    value={sampleRate}
                                    onChange={(e) => setSampleRate(Number(e.target.value))}
                                    className="export-select"
                                >
                                    <option value={44100}>44.1 kHz</option>
                                    <option value={48000}>48 kHz</option>
                                    <option value={96000}>96 kHz</option>
                                </select>
                            </div>

                            {audioFormat === 'wav' && (
                                <div className="export-section">
                                    <label className="section-label">{t('export.bitDepth')}</label>
                                    <select
                                        value={bitDepth}
                                        onChange={(e) => setBitDepth(Number(e.target.value))}
                                        className="export-select"
                                    >
                                        <option value={16}>16-bit</option>
                                        <option value={24}>24-bit</option>
                                        <option value={32}>32-bit Float</option>
                                    </select>
                                </div>
                            )}

                            {audioFormat === 'mp3' && (
                                <div className="export-section">
                                    <label className="section-label">{t('export.mp3BitRate')}</label>
                                    <select
                                        value={mp3BitRate}
                                        onChange={(e) => setMp3BitRate(Number(e.target.value))}
                                        className="export-select"
                                    >
                                        <option value={128}>128 kbps</option>
                                        <option value={192}>192 kbps</option>
                                        <option value={256}>256 kbps</option>
                                        <option value={320}>320 kbps</option>
                                    </select>
                                </div>
                            )}

                            <div className="export-section">
                                <label className="section-label">{t('export.channels')}</label>
                                <select
                                    value={numberOfChannels}
                                    onChange={(e) => setNumberOfChannels(Number(e.target.value))}
                                    className="export-select"
                                >
                                    <option value={1}>{t('export.mono')}</option>
                                    <option value={2}>{t('export.stereo')}</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Filename */}
                    <div className="export-section">
                        <label className="section-label">{t('export.filename')}</label>
                        <input
                            type="text"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            className="export-input"
                            placeholder={t('export.enterFilename')}
                        />
                    </div>
                </div>

                <div className="export-dialog-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        {t('export.cancel')}
                    </button>
                    <button className="export-btn" onClick={handleExport}>
                        {t('export.export')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportDialog;
