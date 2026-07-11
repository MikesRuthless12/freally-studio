// PackFactoryPanel.jsx — Sample-Pack Factory UI (TASK-B03)
// Pick presets → choose pitch/velocity/variation options → Render (progress)
// → Export ZIP (folders + manifest + license) or Add to Library.

import React, { useMemo, useState, useCallback } from 'react';
import { PRESETS as DRUM_PRESETS, DRUM_LABELS, getDefaults as drumDefaults } from '../DrumSynthEngine';
import {
    PRESETS as INST_PRESETS, INSTRUMENT_LABELS, getDefaults as instDefaults,
} from '../InstrumentSynthEngine';
import { renderPack, supportsPitchGrid } from './PackRenderer.js';
import { buildPackZip, layoutPack } from './PackNaming.js';
import { hexToRgba } from '../accentThemes';

const VELOCITY_SETS = {
    1: [1.0],
    2: [0.65, 1.0],
    3: [0.4, 0.75, 1.0],
    4: [0.4, 0.65, 0.85, 1.0],
};

function allItems() {
    const items = [];
    for (const [type, presets] of Object.entries(DRUM_PRESETS)) {
        for (const preset of presets) {
            items.push({
                id: `drum:${type}:${preset.name}`,
                kind: 'drum', type, name: preset.name, genre: preset.genre ?? null,
                label: `${DRUM_LABELS[type] ?? type} · ${preset.name}`,
                params: { ...drumDefaults(type), ...preset.params },
            });
        }
    }
    for (const [type, presets] of Object.entries(INST_PRESETS)) {
        for (const preset of presets) {
            items.push({
                id: `inst:${type}:${preset.name}`,
                kind: 'instrument', type, name: preset.name, genre: null,
                label: `${INSTRUMENT_LABELS[type] ?? type} · ${preset.name}`,
                params: { ...instDefaults(type), ...preset.params },
            });
        }
    }
    return items;
}

const PackFactoryPanel = ({ theme, accentColors, onClose }) => {
    const isDark = theme === 'dark';
    const ac = accentColors?.accent || '#ff6b6b';
    const items = useMemo(allItems, []);

    const [selected, setSelected] = useState(() => new Set());
    const [packName, setPackName] = useState('Freally Pack 01');
    const [pitchFrom, setPitchFrom] = useState(24); // C1
    const [pitchTo, setPitchTo] = useState(48);     // C3
    const [usePitchGrid, setUsePitchGrid] = useState(false);
    const [velocityCount, setVelocityCount] = useState(1);
    const [variations, setVariations] = useState(1);
    const [normalizeDb, setNormalizeDb] = useState(-0.3);
    const [bitDepth, setBitDepth] = useState(24);
    const [bpm, setBpm] = useState('');
    const [progress, setProgress] = useState(null); // {done, total}
    const [results, setResults] = useState(null);
    const [busy, setBusy] = useState(false);

    const toggle = useCallback((id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        setResults(null);
    }, []);

    const handleRender = async () => {
        const chosen = items.filter(it => selected.has(it.id));
        if (!chosen.length || busy) return;
        setBusy(true);
        setResults(null);
        setProgress({ done: 0, total: 1 });
        try {
            const pitchGrid = usePitchGrid
                ? Array.from({ length: Math.max(1, pitchTo - pitchFrom + 1) }, (_, i) => pitchFrom + i)
                : null;
            const rendered = await renderPack({
                items: chosen,
                pitchGrid,
                velocityLayers: VELOCITY_SETS[velocityCount],
                variations,
                bitDepth,
                normalizeDb,
                onProgress: (done, total) => setProgress({ done, total }),
            });
            setResults(rendered);
        } catch (e) {
            console.error('Pack render failed:', e);
            alert('Pack render failed: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleExportZip = async () => {
        if (!results) return;
        setBusy(true);
        try {
            const blob = await buildPackZip(results, {
                packName,
                bpm: bpm ? Number(bpm) : null,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${packName.replace(/[^\w-]+/g, '_')}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Zip export failed:', e);
            alert('Zip export failed: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleAddToLibrary = async () => {
        if (!results || !window.libraryManager?.savePack) return;
        setBusy(true);
        try {
            // same layout as the ZIP: folders + manifest, straight into IndexedDB
            const { files, manifest } = layoutPack(results, {
                packName,
                bpm: bpm ? Number(bpm) : null,
            });
            await window.libraryManager.savePack({ name: packName, manifest, files });
            window.dispatchEvent(new CustomEvent('freally:libraryPacksChanged'));
        } catch (e) {
            console.error('Add to library failed:', e);
            alert('Add to library failed: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    const anyTrackable = items.some(it => selected.has(it.id) && supportsPitchGrid(it));
    const box = {
        background: isDark ? '#14141c' : '#f4f4f8',
        border: `1px solid ${isDark ? '#2a2a3e' : '#d8d8e0'}`,
        borderRadius: 6, padding: 10,
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: isDark ? '#0d0d14' : '#ececf2',
            color: isDark ? '#e0e0e8' : '#222',
            display: 'flex', flexDirection: 'column',
            '--accent': ac, '--accent-glow': hexToRgba(ac, 0.35),
        }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${isDark ? '#2a2a3e' : '#d0d0da'}` }}>
                <strong style={{ fontSize: 14 }}>Sample-Pack Factory</strong>
                <input
                    value={packName}
                    onChange={e => setPackName(e.target.value)}
                    style={{ marginLeft: 16, fontSize: 12, padding: '4px 8px', width: 220 }}
                    spellCheck={false}
                />
                <button onClick={onClose} style={{ marginLeft: 'auto', fontSize: 14, cursor: 'pointer' }} title="Close">✕</button>
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 12, padding: 12 }}>
                {/* preset picker */}
                <div style={{ ...box, width: 320, overflowY: 'auto' }}>
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                        Presets ({selected.size} selected)
                    </div>
                    {items.map(it => (
                        <label key={it.id} style={{ display: 'flex', gap: 6, fontSize: 12, padding: '2px 0', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={selected.has(it.id)}
                                onChange={() => toggle(it.id)}
                            />
                            {it.label}
                        </label>
                    ))}
                </div>

                {/* options + actions */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ ...box, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, fontSize: 12 }}>
                        <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                                type="checkbox"
                                checked={usePitchGrid}
                                onChange={e => setUsePitchGrid(e.target.checked)}
                                disabled={!anyTrackable}
                            />
                            Pitch grid (808s / percussion / instruments)
                            <input type="number" min={0} max={96} value={pitchFrom} disabled={!usePitchGrid}
                                onChange={e => setPitchFrom(Number(e.target.value))} style={{ width: 56 }} title="From (MIDI)" />
                            →
                            <input type="number" min={0} max={96} value={pitchTo} disabled={!usePitchGrid}
                                onChange={e => setPitchTo(Number(e.target.value))} style={{ width: 56 }} title="To (MIDI)" />
                        </label>
                        <label>Velocity layers
                            <select value={velocityCount} onChange={e => setVelocityCount(Number(e.target.value))} style={{ width: '100%' }}>
                                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </label>
                        <label>Variations
                            <select value={variations} onChange={e => setVariations(Number(e.target.value))} style={{ width: '100%' }}>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </label>
                        <label>Format
                            <select value={bitDepth} onChange={e => setBitDepth(Number(e.target.value))} style={{ width: '100%' }}>
                                <option value={16}>16-bit WAV</option>
                                <option value={24}>24-bit WAV</option>
                                <option value={32}>32-bit float WAV</option>
                            </select>
                        </label>
                        <label>Normalize (dBFS)
                            <input type="number" step={0.1} max={0} min={-12} value={normalizeDb}
                                onChange={e => setNormalizeDb(Number(e.target.value))} style={{ width: '100%' }} />
                        </label>
                        <label>Pack BPM (tag)
                            <input type="number" min={40} max={300} value={bpm} placeholder="—"
                                onChange={e => setBpm(e.target.value)} style={{ width: '100%' }} />
                        </label>
                    </div>

                    <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={handleRender} disabled={busy || selected.size === 0}
                            style={{ padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}>
                            {busy && progress ? 'Rendering…' : 'Render'}
                        </button>
                        {progress && (
                            <div style={{ flex: 1, height: 8, background: isDark ? '#22222e' : '#ddd', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{
                                    width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`,
                                    height: '100%', background: ac, transition: 'width 120ms',
                                }} />
                            </div>
                        )}
                        {results && (
                            <>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>{results.length} samples</span>
                                <button onClick={handleExportZip} disabled={busy} style={{ padding: '6px 14px', cursor: 'pointer' }}>
                                    Export ZIP
                                </button>
                                <button onClick={handleAddToLibrary} disabled={busy} style={{ padding: '6px 14px', cursor: 'pointer' }}>
                                    Add to Library
                                </button>
                            </>
                        )}
                    </div>

                    {results && (
                        <div style={{ ...box, flex: 1, overflowY: 'auto', fontSize: 11, fontFamily: 'monospace' }}>
                            {results.map((r, i) => (
                                <div key={i}>{r.name}.wav — {(r.meta.durationS).toFixed(2)}s</div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PackFactoryPanel;
