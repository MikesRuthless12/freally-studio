import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { DrumSynthEngine, DRUM_TYPES, DRUM_LABELS, PARAM_DEFS, PRESETS, getDefaults } from './DrumSynthEngine';
import Knob from './Knob';
import './DrumSynthStudio.css';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';
import { analyzeBuffer, loudnessMatchGain, spectrumForDisplay } from './synth/ReferenceAB.js';

const engine = new DrumSynthEngine();

// Maps for translating engine data
const DSS_TYPE_MAP = {
    'Kick': 'drumSynth.type.kick', '808 / Sub': 'drumSynth.type.808', 'Snare': 'drumSynth.type.snare',
    'Ghost Snare': 'drumSynth.type.ghostSnare', 'Clap': 'drumSynth.type.clap', 'Rim Shot': 'drumSynth.type.rimShot',
    'Closed Hat': 'drumSynth.type.closedHat', 'Open Hat': 'drumSynth.type.openHat', 'Percussion': 'drumSynth.type.percussion'
};
const DSS_PARAM_MAP = {
    'Pitch': 'drumSynth.param.pitch', 'P.Decay': 'drumSynth.param.pDecay', 'Click': 'drumSynth.param.click',
    'Decay': 'drumSynth.param.decay', 'Drive': 'drumSynth.param.drive', 'Tone': 'drumSynth.param.tone',
    'Attack': 'drumSynth.param.attack', 'Volume': 'drumSynth.param.volume', 'Noise': 'drumSynth.param.noise',
    'N.Decay': 'drumSynth.param.nDecay', 'Snap': 'drumSynth.param.snap', 'Body': 'drumSynth.param.body',
    'Reverb': 'drumSynth.param.reverb', 'Distort': 'drumSynth.param.distort', 'Start Hz': 'drumSynth.param.startHz',
    'Sustain': 'drumSynth.param.sustain', 'HP Freq': 'drumSynth.param.hpFreq', 'Reso': 'drumSynth.param.reso',
    'Spread': 'drumSynth.param.spread', 'Layers': 'drumSynth.param.layers', 'Color': 'drumSynth.param.color',
    'Tail': 'drumSynth.param.tail', 'Metal': 'drumSynth.param.metal', 'BP Freq': 'drumSynth.param.bpFreq',
    'Wave': 'drumSynth.param.wave', 'Filter': 'drumSynth.param.filter'
};
const DSS_PRESET_MAP = {
    'Trap Kick': 'drumSynth.preset.trapKick', 'Boom Bap Kick': 'drumSynth.preset.boomBapKick',
    'House Kick': 'drumSynth.preset.houseKick', 'Techno Kick': 'drumSynth.preset.technoKick',
    'DnB Kick': 'drumSynth.preset.dnbKick', 'Lo-Fi Kick': 'drumSynth.preset.lofiKick',
    'Drill Kick': 'drumSynth.preset.drillKick', 'Cinematic Kick': 'drumSynth.preset.cinematicKick',
    'Trap 808': 'drumSynth.preset.trap808', 'Drill 808': 'drumSynth.preset.drill808',
    'Phonk 808': 'drumSynth.preset.phonk808', 'Cloud 808': 'drumSynth.preset.cloud808',
    'Deep Sub': 'drumSynth.preset.deepSub', 'Lo-Fi Sub': 'drumSynth.preset.lofiSub',
    'Trap Snare': 'drumSynth.preset.trapSnare', 'Boom Bap Snare': 'drumSynth.preset.boomBapSnare',
    'House Snare': 'drumSynth.preset.houseSnare', 'DnB Snare': 'drumSynth.preset.dnbSnare',
    'Rock Snare': 'drumSynth.preset.rockSnare', 'Lo-Fi Snare': 'drumSynth.preset.lofiSnare',
    'Techno Snare': 'drumSynth.preset.technoSnare', 'Soft Ghost': 'drumSynth.preset.softGhost',
    'Jazz Brush': 'drumSynth.preset.jazzBrush', 'R&B Ghost': 'drumSynth.preset.rnbGhost',
    'Trap Ghost': 'drumSynth.preset.trapGhost', 'Trap Clap': 'drumSynth.preset.trapClap',
    'House Clap': 'drumSynth.preset.houseClap', 'Techno Clap': 'drumSynth.preset.technoClap',
    'Boom Bap Clap': 'drumSynth.preset.boomBapClap', 'Lo-Fi Clap': 'drumSynth.preset.lofiClap',
    'Trap Rim': 'drumSynth.preset.trapRim', 'House Rim': 'drumSynth.preset.houseRim',
    'Jazz Rim': 'drumSynth.preset.jazzRim', 'Latin Rim': 'drumSynth.preset.latinRim',
    'Trap CH': 'drumSynth.preset.trapCH', 'House CH': 'drumSynth.preset.houseCH',
    'Lo-Fi CH': 'drumSynth.preset.lofiCH', 'Techno CH': 'drumSynth.preset.technoCH',
    'DnB CH': 'drumSynth.preset.dnbCH', 'Trap OH': 'drumSynth.preset.trapOH',
    'House OH': 'drumSynth.preset.houseOH', 'DnB OH': 'drumSynth.preset.dnbOH',
    'Techno OH': 'drumSynth.preset.technoOH', 'Conga': 'drumSynth.preset.conga',
    'Bongo': 'drumSynth.preset.bongo', 'Tom': 'drumSynth.preset.tom',
    'Shaker': 'drumSynth.preset.shaker', 'Woodblock': 'drumSynth.preset.woodblock',
    'Taiko': 'drumSynth.preset.taiko'
};
const DSS_GENRE_MAP = {
    'Trap': 'drumSynth.genre.trap', 'Boom Bap': 'drumSynth.genre.boomBap',
    'House': 'drumSynth.genre.house', 'Techno': 'drumSynth.genre.techno',
    'DnB': 'drumSynth.genre.dnb', 'Lo-Fi': 'drumSynth.genre.lofi',
    'Drill': 'drumSynth.genre.drill', 'Cinematic': 'drumSynth.genre.cinematic',
    'Cloud Rap': 'drumSynth.genre.cloudRap', 'Deep House': 'drumSynth.genre.deepHouse',
    'Rock': 'drumSynth.genre.rock', 'Jazz': 'drumSynth.genre.jazz',
    'R&B': 'drumSynth.genre.rnb', 'Latin': 'drumSynth.genre.latin', 'Hip Hop': 'drumSynth.genre.hipHop'
};

const DrumSynthStudio = ({ theme, onClose, accentColors}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const isDark = theme === 'dark';
    const [drumType, setDrumType] = useState('kick');
    const [params, setParams] = useState(getDefaults('kick'));
    const [activePreset, setActivePreset] = useState(null);
    const [filename, setFilename] = useState('Kick_01.wav');
    const [waveformData, setWaveformData] = useState(null);
    const [isRendering, setIsRendering] = useState(false);
    // Finishing chain (TASK-A08): default ON, 'auto' picks the per-drum chain
    const [finishOn, setFinishOn] = useState(true);
    const [chainPreset, setChainPreset] = useState('auto');
    const finishOpts = { finish: finishOn, chainPreset: chainPreset === 'auto' ? null : chainPreset };

    // Reference A/B panel (TASK-A13)
    const [refBuffer, setRefBuffer] = useState(null);
    const [refName, setRefName] = useState('');
    const [blindSwap, setBlindSwap] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const abCanvasRef = useRef(null);

    // Remember the last used directory handle for convenience
    const [lastDirHandle, setLastDirHandle] = useState(null);

    const canvasRef = useRef(null);
    const renderTimerRef = useRef(null);

    // Switch drum type
    const handleTypeChange = useCallback((type) => {
        setDrumType(type);
        setParams(getDefaults(type));
        setActivePreset(null);
        setWaveformData(null);
        const label = DRUM_LABELS[type].replace(/[\s\/]/g, '');
        setFilename(`${label}_01.wav`);
    }, []);

    // Load preset
    const handlePresetSelect = useCallback((preset) => {
        setParams({ ...getDefaults(drumType), ...preset.params });
        setActivePreset(preset.name);
        const label = preset.name.replace(/\s+/g, '_');
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
                const maxDur = drumType === '808' ? 3.0 : drumType === 'kick' ? 1.5 : 1.0;
                const { buffer } = await engine.renderToBuffer(drumType, params, maxDur, finishOpts);
                setWaveformData(buffer.getChannelData(0));
            } catch (e) { console.error('Render error:', e); }
        }, 150);
        return () => clearTimeout(renderTimerRef.current);
    }, [params, drumType, finishOn, chainPreset]);

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
        ctx.strokeStyle = acSec;
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
    const handleAudition = () => { engine.preview(drumType, params, finishOpts); };

    // ─── Reference A/B (TASK-A13) ───
    const refData = useMemo(
        () => (refBuffer ? refBuffer.getChannelData(0) : null), [refBuffer]);
    const synthAnalysis = useMemo(
        () => (waveformData ? analyzeBuffer(waveformData, 44100) : null), [waveformData]);
    const refAnalysis = useMemo(
        () => (refBuffer ? analyzeBuffer(refData, refBuffer.sampleRate) : null),
        [refBuffer, refData]);

    const handleRefDrop = useCallback(async (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        try {
            const arrayBuf = await file.arrayBuffer();
            const decoded = await engine.ctx.decodeAudioData(arrayBuf);
            setRefBuffer(decoded);
            setRefName(file.name);
            setBlindSwap(Math.random() < 0.5);
            setRevealed(false);
        } catch (err) {
            console.error('Reference decode failed:', err);
        }
    }, []);

    // Plays the exact rendered buffer (what the analysis measured), with the
    // reference loudness-matched to the synth render (equal RMS).
    const playAB = useCallback((side) => {
        const playRef = (side === 'B') !== blindSwap;
        if (engine.ctx.state === 'suspended') engine.ctx.resume();
        const src = engine.ctx.createBufferSource();
        const gain = engine.ctx.createGain();
        if (playRef) {
            if (!refBuffer) return;
            src.buffer = refBuffer;
            gain.gain.value = waveformData ? loudnessMatchGain(waveformData, refData) : 1;
        } else {
            if (!waveformData) return;
            const buf = engine.ctx.createBuffer(1, waveformData.length, 44100);
            buf.getChannelData(0).set(waveformData);
            src.buffer = buf;
            gain.gain.value = 1;
        }
        src.connect(gain);
        gain.connect(engine.ctx.destination);
        src.start();
    }, [blindSwap, refBuffer, refData, waveformData]);

    // Spectrum overlay: synth (accent) vs reference (gray)
    useEffect(() => {
        const canvas = abCanvasRef.current;
        if (!canvas || !waveformData) return;
        const ctx2d = canvas.getContext('2d');
        const w = canvas.width = canvas.offsetWidth * 2;
        const h = canvas.height = 120;
        ctx2d.clearRect(0, 0, w, h);
        const drawSpectrum = (spec, color) => {
            ctx2d.beginPath();
            ctx2d.strokeStyle = color;
            ctx2d.lineWidth = 1.5;
            for (let i = 0; i < spec.length; i++) {
                const x = (i / spec.length) * w;
                const y = (-spec[i] / 80) * h; // 0 dB top → −80 dB bottom
                if (i === 0) ctx2d.moveTo(x, y);
                else ctx2d.lineTo(x, y);
            }
            ctx2d.stroke();
        };
        if (refBuffer) drawSpectrum(spectrumForDisplay(refData, refBuffer.sampleRate), isDark ? '#888' : '#999');
        drawSpectrum(spectrumForDisplay(waveformData, 44100), acSec);
    }, [waveformData, refBuffer, refData, isDark, acSec]);

    // Export WAV
    const handleExport = async () => {
        setIsRendering(true);
        try {
            const maxDur = drumType === '808' ? 4.0 : drumType === 'kick' ? 2.0 : 1.5;
            const { buffer, trimEnd } = await engine.renderToBuffer(drumType, params, maxDur, finishOpts);
            const blob = engine.exportWAV(buffer, trimEnd);

            // Native File System API save - Session Based
            try {
                // 1. Get or request the master session folder
                if (!window.freallySessionExportDir) {
                    alert(t('common.selectMasterFolder'));
                    window.freallySessionExportDir = await window.showDirectoryPicker({
                        mode: 'readwrite'
                    });
                }

                const rootDir = window.freallySessionExportDir;

                // 2. Ensure "Drum Synthesis Studio" subfolder exists
                const studioDir = await rootDir.getDirectoryHandle('Drum Synthesis Studio', { create: true });

                // 3. Write file
                const fileHandle = await studioDir.getFileHandle(filename.endsWith('.wav') ? filename : filename + '.wav', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                // 4. Alert FileExplorer to auto-mount/rescan this specific auto-generated subfolder
                try {
                    window.dispatchEvent(new CustomEvent('freally:autoMountFolder', { detail: { handle: studioDir } }));
                } catch (e) { }

            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Save failed:', err);
                    alert(t('common.saveFailed') + ': ' + err.message);
                }
            }
        } catch (e) {
            console.error('Export failed:', e);
            alert(t('common.exportFailed') + ': ' + e.message);
        } finally {
            setIsRendering(false);
        }
    };

    const defs = PARAM_DEFS[drumType] || [];
    const presets = PRESETS[drumType] || [];

    return (
        <div className={`dss-overlay ${isDark ? 'dark' : 'light'}`} style={{
            '--accent': ac,
            '--accent-secondary': acSec,
            '--accent-gradient': acGrad,
            '--accent-glow': hexToRgba(ac, 0.35),
        }}>
            {/* Header */}
            <div className="dss-header">
                <div className="dss-title">{t('drumSynth.title')}</div>
                <button className="dss-close-btn" onClick={onClose} title={t('drumSynth.close')}>✕</button>
            </div>

            {/* Drum Type Tabs */}
            <div className="dss-tabs">
                {DRUM_TYPES.map(dtype => (
                    <button
                        key={dtype}
                        className={`dss-tab ${drumType === dtype ? 'active' : ''}`}
                        onClick={() => handleTypeChange(dtype)}
                    >
                        {DSS_TYPE_MAP[DRUM_LABELS[dtype]] ? t(DSS_TYPE_MAP[DRUM_LABELS[dtype]]) : DRUM_LABELS[dtype]}
                    </button>
                ))}
            </div>

            {/* Body */}
            <div className="dss-body">
                {/* Presets */}
                <div className="dss-presets">
                    <div className="dss-presets-title">{t('drumSynth.presets')}</div>
                    <div className="dss-preset-list">
                        {presets.map((p, i) => (
                            <div
                                key={i}
                                className={`dss-preset-item ${activePreset === p.name ? 'active' : ''}`}
                                onClick={() => handlePresetSelect(p)}
                            >
                                {DSS_PRESET_MAP[p.name] ? t(DSS_PRESET_MAP[p.name]) : p.name}
                                <span className="dss-preset-genre">{DSS_GENRE_MAP[p.genre] ? t(DSS_GENRE_MAP[p.genre]) : p.genre}</span>
                            </div>
                        ))}
                        {presets.length === 0 && (
                            <div style={{ padding: 16, opacity: 0.4, fontSize: 12, textAlign: 'center' }}>
                                {t('drumSynth.noPresets')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className="dss-editor">
                    {/* Waveform */}
                    <div className="dss-waveform-wrap">
                        <div className="dss-waveform-header">
                            <span className="dss-waveform-label">{t('drumSynth.waveformPreview')}</span>
                            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={finishOn}
                                        onChange={(e) => setFinishOn(e.target.checked)}
                                    />
                                    Finish
                                </label>
                                <select
                                    value={chainPreset}
                                    onChange={(e) => setChainPreset(e.target.value)}
                                    disabled={!finishOn}
                                    style={{ fontSize: 11 }}
                                    title="Finishing chain preset"
                                >
                                    <option value="auto">Auto</option>
                                    <option value="kick">Kick</option>
                                    <option value="808">808</option>
                                    <option value="snare">Snare</option>
                                    <option value="hats">Hats</option>
                                    <option value="clap">Clap</option>
                                    <option value="clean">Clean</option>
                                </select>
                            </span>
                        </div>
                        <canvas ref={canvasRef} className="dss-waveform-canvas" />
                    </div>

                    {/* Reference A/B (TASK-A13) */}
                    <div
                        className="dss-waveform-wrap"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleRefDrop}
                    >
                        <div className="dss-waveform-header">
                            <span className="dss-waveform-label">Reference A/B</span>
                            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }}>
                                {refName || 'Drop a reference sample here'}
                            </span>
                        </div>
                        <canvas ref={abCanvasRef} style={{ width: '100%', height: 60, display: 'block' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 11 }}>
                            <button className="dss-btn dss-btn-ghost" onClick={() => playAB('A')} disabled={!refBuffer}>
                                ▶ A{revealed ? (blindSwap ? ' (ref)' : ' (synth)') : ''}
                            </button>
                            <button className="dss-btn dss-btn-ghost" onClick={() => playAB('B')} disabled={!refBuffer}>
                                ▶ B{revealed ? (blindSwap ? ' (synth)' : ' (ref)') : ''}
                            </button>
                            <button
                                className="dss-btn dss-btn-ghost"
                                onClick={() => { setBlindSwap(Math.random() < 0.5); setRevealed(false); }}
                                disabled={!refBuffer}
                                title="Re-shuffle the blind A/B assignment"
                            >
                                ⇄ Flip
                            </button>
                            <button className="dss-btn dss-btn-ghost" onClick={() => setRevealed(r => !r)} disabled={!refBuffer}>
                                {revealed ? 'Hide' : 'Reveal'}
                            </button>
                            {synthAnalysis && (
                                <span style={{ marginLeft: 'auto', opacity: 0.75 }}>
                                    synth: sub {synthAnalysis.subEnergyPct.toFixed(0)}% ·
                                    {' '}{(synthAnalysis.centroidHz / 1000).toFixed(2)} kHz ·
                                    {' '}atk {synthAnalysis.attackMs.toFixed(1)} ms ·
                                    {' '}crest {synthAnalysis.crestDb.toFixed(1)} dB
                                    {refAnalysis && (
                                        <>
                                            {' '}| ref: sub {refAnalysis.subEnergyPct.toFixed(0)}% ·
                                            {' '}{(refAnalysis.centroidHz / 1000).toFixed(2)} kHz ·
                                            {' '}atk {refAnalysis.attackMs.toFixed(1)} ms ·
                                            {' '}crest {refAnalysis.crestDb.toFixed(1)} dB
                                        </>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Knobs */}
                    <div className="dss-knobs-section">
                        <div className="dss-knobs-title">{t('drumSynth.parameters', { name: DSS_TYPE_MAP[DRUM_LABELS[drumType]] ? t(DSS_TYPE_MAP[DRUM_LABELS[drumType]]) : DRUM_LABELS[drumType] })}</div>
                        <div className="dss-knobs-row">
                            {defs.map(d => (
                                <div key={d.key} className="dss-knob-wrap">
                                    <Knob
                                        label={DSS_PARAM_MAP[d.label] ? t(DSS_PARAM_MAP[d.label]) : d.label}
                                        value={params[d.key] ?? d.default}
                                        min={d.min}
                                        max={d.max}
                                        onChange={(v) => handleParamChange(d.key, v)}
                                        color={acSec}
                                        size={56}
                                    />
                                    <span className="dss-knob-value">
                                        {(params[d.key] ?? d.default).toFixed(d.max >= 100 ? 0 : 2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="dss-actions">
                <button className="dss-btn dss-btn-ghost" style={{ marginRight: `auto`, fontSize: 11 }} onClick={async () => {
                    try {
                        const newDir = await window.showDirectoryPicker({ mode: 'readwrite' });
                        window.freallySessionExportDir = newDir;
                        alert(t('common.masterFolderUpdated'));
                    } catch (e) { }
                }}>
                    {t('drumSynth.changeMasterFolder')}
                </button>
                <button className="dss-btn dss-btn-primary" onClick={handleAudition}>
                    ▶ {t('drumSynth.preview')}
                </button>
                <input
                    type="text"
                    className="dss-filename-input"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder={t('drumSynth.filename')}
                    spellCheck={false}
                />
                <button
                    className="dss-btn dss-btn-secondary"
                    onClick={handleExport}
                    disabled={isRendering}
                >
                    {isRendering ? t('drumSynth.rendering') : t('drumSynth.exportWav')}
                </button>
            </div>
        </div>
    );
};

export default DrumSynthStudio;
