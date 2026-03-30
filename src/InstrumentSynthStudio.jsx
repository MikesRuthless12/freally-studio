import React, { useState, useRef, useEffect, useCallback } from 'react';
import { InstrumentSynthEngine, INSTRUMENT_TYPES, INSTRUMENT_LABELS, PARAM_DEFS, PRESETS, getDefaults } from './InstrumentSynthEngine';
import Knob from './Knob';
import './InstrumentSynthStudio.css';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

const engine = new InstrumentSynthEngine();

// Note utility to convert "C4" to 261.63Hz
const createNoteOptions = () => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const options = [];
    for (let octave = 1; octave <= 7; octave++) {
        for (let i = 0; i < notes.length; i++) {
            const freq = 440 * Math.pow(2, ((octave - 4) * 12 + i - 9) / 12);
            options.push({ label: `${notes[i]}${octave}`, freq: parseFloat(freq.toFixed(2)) });
        }
    }
    return options;
};

const NOTE_OPTIONS = createNoteOptions();

// Maps for translating engine data labels
const INST_PARAM_MAP = { 'Attack': 'instSynth.param.attack', 'Decay': 'instSynth.param.decay', 'Sustain': 'instSynth.param.sustain', 'Release': 'instSynth.param.release', 'Cutoff': 'instSynth.param.cutoff', 'Resonance': 'instSynth.param.resonance', 'Env Amt': 'instSynth.param.envAmt', 'Drive': 'instSynth.param.drive', 'Vib Rate': 'instSynth.param.vibRate', 'Vib Depth': 'instSynth.param.vibDepth', 'Chorus': 'instSynth.param.chorus', 'Volume': 'instSynth.param.volume', 'Detune': 'instSynth.param.detune', 'PWM': 'instSynth.param.pwm', 'Mod Idx': 'instSynth.param.modIdx', 'Mod Ratio': 'instSynth.param.modRatio', 'Feedback': 'instSynth.param.feedback', 'Pitch Drop': 'instSynth.param.pitchDrop', 'Pitch Decay': 'instSynth.param.pitchDecay', 'Amp Tone': 'instSynth.param.ampTone', 'Cabinet': 'instSynth.param.cabinet', 'String Dec': 'instSynth.param.stringDec', 'Bright': 'instSynth.param.bright', 'Breath': 'instSynth.param.breath', 'Overblow': 'instSynth.param.overblow', 'Tine': 'instSynth.param.tine', 'Body': 'instSynth.param.body', 'Tremolo': 'instSynth.param.tremolo', 'Hammer': 'instSynth.param.hammer', 'String Res': 'instSynth.param.stringRes', 'Bow Noise': 'instSynth.param.bowNoise', 'Body Res': 'instSynth.param.bodyRes', 'Pluck': 'instSynth.param.pluck', 'Growl': 'instSynth.param.growl', 'Duty Cycle': 'instSynth.param.dutyCycle', 'Bitcrush': 'instSynth.param.bitcrush', 'Formant 1': 'instSynth.param.formant1', 'Formant 2': 'instSynth.param.formant2', 'Vowel (A/O/E)': 'instSynth.param.vowel', 'Sub 16"': 'instSynth.param.sub16', 'High 4"': 'instSynth.param.high4' };
const INST_PRESET_MAP = { 'Cinematic Orchestral Stab': 'instSynth.preset.cinematicOrchestralStab', 'Slow Swell Horns': 'instSynth.preset.slowSwellHorns', 'Trap Heavy Brass': 'instSynth.preset.trapHeavyBrass', 'EDM Supersaw': 'instSynth.preset.edmSupersaw', 'G-Funk Sine': 'instSynth.preset.gFunkSine', 'Laser Pluck': 'instSynth.preset.laserPluck', 'Deep House Donk': 'instSynth.preset.deepHouseDonk', 'Soft Analog Ping': 'instSynth.preset.softAnalogPing', 'Nylon Pluck': 'instSynth.preset.nylonPluck', 'Bright Strum': 'instSynth.preset.brightStrum', 'Country Twang': 'instSynth.preset.countryTwang', 'Clean Chorus': 'instSynth.preset.cleanChorus', 'Overdriven Lead': 'instSynth.preset.overdrivenLead', 'Muted Crunch': 'instSynth.preset.mutedCrunch' };

const InstrumentSynthStudio = ({ theme, onClose, accentColors}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const isDark = theme === 'dark';
    const [drumType, setDrumType] = useState('synthLead');
    const [params, setParams] = useState(getDefaults('synthLead'));
    const [activePreset, setActivePreset] = useState(null);
    const [filename, setFilename] = useState('Lead_01.wav');
    const [noteFreq, setNoteFreq] = useState(261.63); // Default C4
    const [waveformData, setWaveformData] = useState(null);
    const [isRendering, setIsRendering] = useState(false);
    const canvasRef = useRef(null);
    const renderTimerRef = useRef(null);

    // Switch instrument type
    const handleTypeChange = useCallback((type) => {
        setDrumType(type);
        setParams(getDefaults(type));
        setActivePreset(null);
        setWaveformData(null);
        const label = INSTRUMENT_LABELS[type].replace(/[\s\/]/g, '');
        setFilename(`${label}_01.wav`);
    }, []);

    // Load preset
    const handlePresetSelect = useCallback((preset) => {
        setParams({ ...getDefaults(drumType), ...preset.params });
        setActivePreset(preset.name);
        const label = preset.name.replace(/[^a-zA-Z0-9]/g, '_');
        setFilename(`${label}_01.wav`);
    }, [drumType]);

    // Update param
    const handleParamChange = useCallback((key, value) => {
        setParams(prev => ({ ...prev, [key]: value }));
        setActivePreset(null);
    }, []);

    // Render waveform preview with debounce
    useEffect(() => {
        if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
        renderTimerRef.current = setTimeout(async () => {
            try {
                // Instruments need a bit longer render usually
                const maxDur = 2.5;
                const { buffer } = await engine.renderToBuffer(drumType, params, maxDur, noteFreq);
                setWaveformData(buffer.getChannelData(0));
            } catch (e) { console.error('Render error:', e); }
        }, 150);
        return () => clearTimeout(renderTimerRef.current);
    }, [params, drumType, noteFreq]);

    // Draw waveform
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !waveformData) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.offsetWidth * 2;
        const h = canvas.height = 240;
        ctx.clearRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = isDark ? '#1a1a28' : '#e0e0e8';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += h / 8) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        // Center line
        ctx.strokeStyle = isDark ? '#2a2a3e' : '#ccc';
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

        // Waveform
        const step = Math.max(1, Math.floor(waveformData.length / w));
        ctx.beginPath();
        ctx.strokeStyle = acSec; // Orange theme
        ctx.lineWidth = 1.5;
        for (let x = 0; x < w; x++) {
            const idx = Math.floor((x / w) * waveformData.length);
            let min = 1, max = -1;
            for (let s = 0; s < step; s++) {
                const val = waveformData[idx + s] || 0;
                if (val < min) min = val;
                if (val > max) max = val;
            }
            const yMin = (1 - max) * h / 2;
            const yMax = (1 - min) * h / 2;
            if (x === 0) ctx.moveTo(x, yMin);
            else { ctx.lineTo(x, yMin); ctx.lineTo(x, yMax); }
        }
        ctx.stroke();

        // Glow
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = acSec;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }, [waveformData, isDark, acSec]);

    // Audition
    const handleAudition = () => { engine.preview(drumType, params, 2.0, noteFreq); };

    // Export WAV
    const handleExport = async () => {
        setIsRendering(true);
        try {
            const maxDur = 4.0; // Export gives it a full 4.0s max to safely decay
            const { buffer } = await engine.renderToBuffer(drumType, params, maxDur, noteFreq);
            const blob = engine.exportWAV(buffer);

            // Native File System API save - Session Based
            try {
                // 1. Get or request the master session folder
                if (!window.wavloomSessionExportDir) {
                    alert(t('common.selectMasterFolder'));
                    window.wavloomSessionExportDir = await window.showDirectoryPicker({
                        mode: 'readwrite'
                    });
                }

                const rootDir = window.wavloomSessionExportDir;

                // 2. Ensure "Instrument Synthesis Studio" subfolder exists
                const studioDir = await rootDir.getDirectoryHandle('Instrument Synthesis Studio', { create: true });

                // 3. Write file
                const fileHandle = await studioDir.getFileHandle(filename.endsWith('.wav') ? filename : filename + '.wav', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                // 4. Alert FileExplorer to auto-mount/rescan
                try {
                    window.dispatchEvent(new CustomEvent('wavloom:autoMountFolder', { detail: { handle: studioDir } }));
                } catch (e) { }

            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Save failed:', err);
                    alert('Save failed: ' + err.message);
                }
            }
        } catch (e) {
            console.error('Export failed:', e);
            alert('Export failed: ' + e.message);
        } finally {
            setIsRendering(false);
        }
    };

    const defs = PARAM_DEFS[drumType] || [];
    const presets = PRESETS[drumType] || [];

    return (
        <div className={`iss-overlay ${isDark ? 'dark' : 'light'}`} style={{
            '--accent': ac,
            '--accent-secondary': acSec,
            '--accent-gradient': acGrad,
            '--accent-glow': hexToRgba(ac, 0.35),
        }}>
            {/* Header */}
            <div className="iss-header">
                <div className="iss-title">{t('instSynth.title')}</div>
                <button className="iss-close-btn" onClick={onClose} title={t('instSynth.close')}>✕</button>
            </div>

            {/* Instrument Type Tabs */}
            <div className="iss-tabs">
                {INSTRUMENT_TYPES.map(iType => (
                    <button
                        key={iType}
                        className={`iss-tab ${drumType === iType ? 'active' : ''}`}
                        onClick={() => handleTypeChange(iType)}
                    >
                        {t('instSynth.type.' + iType)}
                    </button>
                ))}
            </div>

            {/* Body */}
            <div className="iss-body">
                {/* Presets */}
                <div className="iss-presets">
                    <div className="iss-presets-title">{t('instSynth.presets')}</div>
                    <div className="iss-preset-list">
                        {presets.map((p, i) => (
                            <div
                                key={i}
                                className={`iss-preset-item ${activePreset === p.name ? 'active' : ''}`}
                                onClick={() => handlePresetSelect(p)}
                            >
                                {INST_PRESET_MAP[p.name] ? t(INST_PRESET_MAP[p.name]) : p.name}
                            </div>
                        ))}
                        {presets.length === 0 && (
                            <div style={{ padding: 16, opacity: 0.4, fontSize: 12, textAlign: 'center' }}>
                                {t('instSynth.noPresets', { name: t('instSynth.type.' + drumType) })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className="iss-editor">

                    {/* Base Note Selector */}
                    <div className="iss-note-trigger">
                        <label>{t('instSynth.baseNote')} </label>
                        <select
                            className="iss-note-select"
                            value={noteFreq}
                            onChange={(e) => setNoteFreq(parseFloat(e.target.value))}
                        >
                            {NOTE_OPTIONS.map(opt => (
                                <option key={opt.label} value={opt.freq}>{opt.label} ({opt.freq}Hz)</option>
                            ))}
                        </select>
                    </div>

                    {/* Waveform */}
                    <div className="iss-waveform-wrap">
                        <div className="iss-waveform-header">
                            <span className="iss-waveform-label">{t('instSynth.waveformPreview')}</span>
                        </div>
                        <canvas ref={canvasRef} className="iss-waveform-canvas" />
                    </div>

                    {/* Knobs */}
                    <div className="iss-knobs-section">
                        <div className="iss-knobs-title">{t('instSynth.parameters', { name: t('instSynth.type.' + drumType) })}</div>
                        <div className="iss-knobs-row">
                            {defs.map(d => (
                                <div key={d.key} className="iss-knob-wrap">
                                    <Knob
                                        label={INST_PARAM_MAP[d.label] ? t(INST_PARAM_MAP[d.label]) : d.label}
                                        value={params[d.key] ?? d.default}
                                        min={d.min}
                                        max={d.max}
                                        onChange={(val) => handleParamChange(d.key, val)}
                                        size={48}
                                        color={acSec}
                                        trackColor={isDark ? '#2a2a3e' : '#ddd'}
                                    />
                                    <div className="iss-knob-label">{INST_PARAM_MAP[d.label] ? t(INST_PARAM_MAP[d.label]) : d.label}</div>
                                    <div className="iss-knob-value">{Number(params[d.key] ?? d.default).toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Footer */}
            <div className="iss-actions">
                <button className="iss-btn iss-btn-ghost" style={{ marginRight: 'auto', fontSize: 11 }} onClick={async () => {
                    try {
                        const newDir = await window.showDirectoryPicker({ mode: 'readwrite' });
                        window.wavloomSessionExportDir = newDir;
                        alert(t('common.masterFolderUpdated'));
                    } catch (e) { }
                }}>
                    {t('instSynth.changeMasterFolder')}
                </button>
                <button className="iss-btn iss-btn-primary" onClick={handleAudition}>
                    {'▶ '}{t('instSynth.preview')}
                </button>
                <input
                    type="text"
                    className="iss-filename-input"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder={t('instSynth.filename')}
                    spellCheck={false}
                />
                <button className="iss-btn iss-btn-primary" onClick={handleExport} disabled={isRendering}>
                    {isRendering ? t('instSynth.rendering') : t('instSynth.exportWav')}
                </button>
            </div>
        </div>
    );
};

export default InstrumentSynthStudio;
