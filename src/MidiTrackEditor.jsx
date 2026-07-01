import React, { useState, useCallback, useEffect } from 'react';
import PianoRollEditor from './PianoRollEditor';
import { SCALES } from './MusicTheory';
import { collectAudioFiles } from './randomFileUtils';
import MIDIParser from './MIDIParser';
import { getFileFromItem } from './getFileFromItem.js';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

/**
 * MidiTrackEditor — Modal piano-roll editor for a single MIDI track.
 * Opens as an overlay (like DrumSampleEditor) when double-clicking a MIDI track strip in the mixer.
 * Pattern data and instrument state are owned by parent (FreallyAppComplete).
 */
const MidiTrackEditor = ({
    track,             // { id, name, color, clips, instrumentId, instrumentName, octave }
    clip,              // optional: { id, timelineBar, bars, pattern, name, color } — specific clip to edit
    sampler,
    theme,
    globalKey,
    globalScale,
    globalTempo,
    globalBars,
    globalResolution,
    globalCurrentStep,
    globalPlayStartTime,
    globalMutes,
    globalSolos,
    setGlobalMutes,
    updateGlobalSolo,
    isAnythingSoloed,
    selectedFolder,
    onPatternChange,   // (trackId, newPattern) => void
    onInstrumentChange,// (trackId, instrumentId, instrumentName) => void
    onOctaveChange,    // (trackId, octave) => void
    onRename,          // (trackId, newName) => void
    onRemove,          // (trackId) => void
    onBounce,          // (trackId) => void
    onClose,
    onSampleLoadingChange,
    accentColors,
    isDark,
}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';

    // Use clip's pattern/bars when editing a specific clip, otherwise first clip or empty
    const currentPattern = clip ? (clip.pattern || []) : ((track.clips || [])[0]?.pattern || []);
    const editorTitle = clip ? (clip.name || t('midiEditor.midiClip')) : track.name;

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(editorTitle);
    const [dragOver, setDragOver] = useState(false);
    const [localResolution, setLocalResolution] = useState(globalResolution || 8);

    // Escape key closes the modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isRenaming) {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, isRenaming]);

    const keyOffset = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(globalKey || 'C');
    const rootPitch = ((track.octave + 1) * 12) + (keyOffset >= 0 ? keyOffset : 0);

    const muted = globalMutes?.has(track.id) || false;
    const isSoloed = globalSolos?.has(track.id);

    const toggleMute = useCallback(() => {
        if (!setGlobalMutes) return;
        setGlobalMutes(prev => {
            const next = new Set(prev);
            if (next.has(track.id)) {
                next.delete(track.id);
                if (sampler?.setTrackVolume) sampler.setTrackVolume(track.id, 0.5);
            } else {
                next.add(track.id);
                if (sampler?.setTrackVolume) sampler.setTrackVolume(track.id, 0);
            }
            return next;
        });
    }, [setGlobalMutes, sampler, track.id]);

    const toggleSolo = (e) => {
        if (updateGlobalSolo) updateGlobalSolo(track.id, !isSoloed, e.ctrlKey);
    };

    // Pattern editing
    const handlePatternChange = useCallback((newPattern) => {
        if (onPatternChange) onPatternChange(track.id, newPattern);
    }, [onPatternChange, track.id]);

    // Generate simple random pattern
    const handleGenerate = useCallback(() => {
        const totalSteps = globalBars * 32;
        const scaleIntervals = SCALES[globalScale] || SCALES['Minor'] || [0, 2, 3, 5, 7, 8, 10];
        const notes = [];
        const density = 0.25 + Math.random() * 0.3;
        for (let step = 0; step < totalSteps; step += 4) {
            if (Math.random() < density) {
                const degree = Math.floor(Math.random() * scaleIntervals.length);
                const octaveShift = Math.floor(Math.random() * 2) * 12;
                const note = rootPitch + scaleIntervals[degree] + octaveShift;
                const duration = [2, 4, 8, 16][Math.floor(Math.random() * 4)];
                notes.push({
                    time: step,
                    note: Math.max(0, Math.min(127, note)),
                    duration: Math.min(duration, totalSteps - step),
                    velocity: 0.5 + Math.random() * 0.4
                });
            }
        }
        if (onPatternChange) onPatternChange(track.id, notes);
    }, [globalBars, globalScale, rootPitch, onPatternChange, track.id]);

    // Load sample from folder
    const handleLoadFromFolder = useCallback(async () => {
        if (!selectedFolder || !sampler) return;
        if (onSampleLoadingChange) onSampleLoadingChange(true);
        try {
            const audioFiles = await collectAudioFiles(selectedFolder);
            if (audioFiles.length === 0) { alert(t('midiEditor.noAudioFound')); return; }
            const randomFile = audioFiles[Math.floor(Math.random() * audioFiles.length)];
            const file = await getFileFromItem(randomFile);
            const instrumentId = `midi_inst_${track.id}_${Date.now()}`;
            await sampler.loadInstrumentFromFiles(instrumentId, [file], file.name);
            if (onInstrumentChange) onInstrumentChange(track.id, instrumentId, file.name);
        } catch (err) {
            console.error('[MidiTrack] load error:', err);
        } finally {
            if (onSampleLoadingChange) onSampleLoadingChange(false);
        }
    }, [selectedFolder, sampler, track.id, onInstrumentChange, onSampleLoadingChange]);

    // Drag and drop
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const items = e.dataTransfer?.items;
        if (items) {
            for (const item of items) {
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file.name.match(/\.(mid|midi)$/i)) {
                        try {
                            const parser = new MIDIParser();
                            const midiData = await parser.loadMIDIFile(file);
                            let notes = [];
                            for (const trk of midiData.tracks) {
                                const trackNotes = parser.eventsToNotes(trk.events);
                                if (trackNotes.length > 0) { notes = trackNotes; break; }
                            }
                            if (notes.length > 0) {
                                const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
                                const newPattern = notes.map(n => ({
                                    time: Math.floor(n.startTick / ticksPerStep),
                                    duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                                    note: n.note,
                                    velocity: n.velocity / 127
                                })).filter(n => n.time < globalBars * 32);
                                if (onPatternChange) onPatternChange(track.id, newPattern);
                            }
                        } catch (err) { console.error('[MidiTrack] MIDI drop error:', err); }
                        return;
                    }
                    if (file.name.match(/\.(wav|mp3|ogg|flac|aiff|aif|webm)$/i)) {
                        try {
                            const instrumentId = `midi_inst_${track.id}_${Date.now()}`;
                            await sampler.loadInstrumentFromFiles(instrumentId, [file], file.name);
                            if (onInstrumentChange) onInstrumentChange(track.id, instrumentId, file.name);
                        } catch (err) { console.error('[MidiTrack] sample drop error:', err); }
                        return;
                    }
                }
            }
        }

        const json = e.dataTransfer?.getData('application/json');
        if (json) {
            try {
                const data = JSON.parse(json);
                const dragItem = window.draggedItem;
                if (dragItem && (dragItem.handle || dragItem.nativePath)) {
                    const file = await getFileFromItem(dragItem);
                    if (file.name.match(/\.(wav|mp3|ogg|flac|aiff|aif|webm)$/i)) {
                        const instrumentId = `midi_inst_${track.id}_${Date.now()}`;
                        await sampler.loadInstrumentFromFiles(instrumentId, [file], file.name);
                        if (onInstrumentChange) onInstrumentChange(track.id, instrumentId, file.name);
                    } else if (file.name.match(/\.(mid|midi)$/i)) {
                        const parser = new MIDIParser();
                        const midiData = await parser.loadMIDIFile(file);
                        let notes = [];
                        for (const t of midiData.tracks) {
                            const trackNotes = parser.eventsToNotes(t.events);
                            if (trackNotes.length > 0) { notes = trackNotes; break; }
                        }
                        if (notes.length > 0) {
                            const ticksPerStep = (midiData.ticksPerBeat || 480) / 8;
                            const newPattern = notes.map(n => ({
                                time: Math.floor(n.startTick / ticksPerStep),
                                duration: Math.max(1, Math.floor(n.duration / ticksPerStep)),
                                note: n.note,
                                velocity: n.velocity / 127
                            })).filter(n => n.time < globalBars * 32);
                            if (onPatternChange) onPatternChange(track.id, newPattern);
                        }
                    }
                }
            } catch (_) {}
        }
    }, [globalBars, sampler, track.id, onPatternChange, onInstrumentChange]);

    const handleRenameSubmit = useCallback(() => {
        const trimmed = renameValue.trim();
        if (trimmed && onRename) onRename(track.id, trimmed);
        setIsRenaming(false);
    }, [renameValue, onRename, track.id]);

    const handleClear = useCallback(() => {
        if (onPatternChange) onPatternChange(track.id, []);
        if (onInstrumentChange) onInstrumentChange(track.id, null, '');
    }, [track.id, onPatternChange, onInstrumentChange]);

    // Transpose pattern notes by semitone offset
    const handleTranspose = useCallback((semitones) => {
        if (!currentPattern?.length || !onPatternChange) return;
        const transposed = currentPattern.map(n => ({
            ...n,
            note: Math.max(0, Math.min(127, n.note + semitones))
        }));
        onPatternChange(track.id, transposed);
    }, [track.id, currentPattern, onPatternChange]);

    const btnStyle = (active, color) => ({
        padding: '5px 12px',
        borderRadius: '4px',
        border: `1px solid ${active ? color : (isDark ? '#333' : '#ccc')}`,
        background: active ? hexToRgba(color, 0.2) : 'transparent',
        color: active ? color : (isDark ? '#888' : '#666'),
        fontSize: '10px',
        fontWeight: '700',
        cursor: 'pointer',
        letterSpacing: '0.5px',
    });

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div
                style={{
                    width: '90vw', maxWidth: '1400px', height: '80vh',
                    background: isDark ? '#1a1a1a' : '#fff',
                    borderRadius: '12px',
                    border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: '10px',
                    background: isDark ? '#111' : '#f8f8f8',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '12px', height: '12px', borderRadius: '50%',
                            background: track.color, flexShrink: 0
                        }} />
                        {isRenaming ? (
                            <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value.slice(0, 30))}
                                onBlur={handleRenameSubmit}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameSubmit();
                                    if (e.key === 'Escape') { setRenameValue(track.name); setIsRenaming(false); }
                                }}
                                style={{
                                    fontSize: '16px', fontWeight: '700', background: isDark ? '#111' : '#fff',
                                    color: track.color, border: `1px solid ${track.color}`, borderRadius: '4px',
                                    padding: '2px 8px', outline: 'none', width: '200px'
                                }}
                            />
                        ) : (
                            <h3
                                style={{ margin: 0, fontSize: '16px', cursor: 'pointer', color: track.color }}
                                onDoubleClick={() => { setRenameValue(editorTitle); setIsRenaming(true); }}
                                title={t('midiEditor.doubleClickRename')}
                            >
                                {editorTitle}
                            </h3>
                        )}
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '1px',
                            padding: '2px 10px', borderRadius: '6px',
                            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            minWidth: '120px',
                        }}>
                            <span style={{ fontSize: '8px', fontWeight: '800', letterSpacing: '0.5px', color: track.color, textTransform: 'uppercase' }}>
                                {t('midiEditor.instrument')}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: track.instrumentName ? (isDark ? '#ccc' : '#333') : (isDark ? '#555' : '#aaa') }}>
                                {track.instrumentName || t('midiEditor.dropSampleMidi')}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                            value={track.octave}
                            onChange={e => onOctaveChange && onOctaveChange(track.id, Number(e.target.value))}
                            style={{
                                fontSize: '10px', padding: '5px 6px', borderRadius: '4px',
                                background: isDark ? '#222' : '#f5f5f5', color: isDark ? '#ccc' : '#333',
                                border: `1px solid ${isDark ? '#444' : '#ccc'}`, cursor: 'pointer'
                            }}
                        >
                            {[0,1,2,3,4,5,6].map(o => <option key={o} value={o}>C{o}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center', borderRadius: '4px', border: `1px solid ${isDark ? '#333' : '#ccc'}`, padding: '1px 2px' }}>
                            <button onClick={() => handleTranspose(-12)} disabled={!currentPattern?.length} style={{ ...btnStyle(false, '#70a1ff'), padding: '4px 6px', border: 'none', fontSize: '8px' }} title={t('midiEditor.transposeDownOctave')}>{t('midiEditor.minusOct')}</button>
                            <button onClick={() => handleTranspose(-1)} disabled={!currentPattern?.length} style={{ ...btnStyle(false, '#70a1ff'), padding: '4px 6px', border: 'none', fontSize: '8px' }} title={t('midiEditor.transposeDownSemitone')}>{t('midiEditor.minusSem')}</button>
                            <button onClick={() => handleTranspose(1)} disabled={!currentPattern?.length} style={{ ...btnStyle(false, '#70a1ff'), padding: '4px 6px', border: 'none', fontSize: '8px' }} title={t('midiEditor.transposeUpSemitone')}>{t('midiEditor.plusSem')}</button>
                            <button onClick={() => handleTranspose(12)} disabled={!currentPattern?.length} style={{ ...btnStyle(false, '#70a1ff'), padding: '4px 6px', border: 'none', fontSize: '8px' }} title={t('midiEditor.transposeUpOctave')}>{t('midiEditor.plusOct')}</button>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center', borderRadius: '4px', border: `1px solid ${isDark ? '#333' : '#ccc'}`, padding: '1px 2px' }}>
                            <span style={{ fontSize: '7px', fontWeight: '700', color: isDark ? '#555' : '#999', padding: '0 2px' }}>{t('midiEditor.res')}</span>
                            {[4, 8, 16, 32].map(r => (
                                <button key={r} onClick={() => setLocalResolution(r)} style={{
                                    ...btnStyle(localResolution === r, '#70a1ff'), padding: '4px 5px', border: 'none', fontSize: '8px',
                                    background: localResolution === r ? hexToRgba('#70a1ff', 0.2) : 'transparent',
                                }} title={t('midiEditor.resolution', { r })}>1/{r}</button>
                            ))}
                        </div>
                        <button onClick={handleGenerate} style={btnStyle(false, ac)} title={t('midiEditor.generateRandom')}>{t('midiEditor.gen')}</button>
                        <button onClick={handleLoadFromFolder} disabled={!selectedFolder} style={btnStyle(false, acSec)} title={t('midiEditor.loadFromFolder')}>{t('midiEditor.load')}</button>
                        <button onClick={toggleMute} style={btnStyle(muted, '#ff4757')} title={t('common.mute')}>M</button>
                        <button onClick={toggleSolo} style={btnStyle(isSoloed, '#ffa502')} title={t('common.soloCtrl')}>S</button>
                        {onBounce && (
                            <button onClick={() => onBounce(track.id)} disabled={!currentPattern?.length || !track.instrumentId} style={btnStyle(false, '#2ed573')} title={t('midiEditor.bounceToAudio')}>{t('midiEditor.bounce')}</button>
                        )}
                        <button onClick={handleClear} style={btnStyle(false, '#ff6348')} title={t('common.clear')}>{t('midiEditor.clr')}</button>
                        {onRemove && (
                            <button onClick={() => { if (window.confirm(t('midiEditor.deleteConfirm', { name: track.name }))) { onRemove(track.id); onClose(); } }} style={btnStyle(false, '#ff4757')} title={t('midiEditor.deleteTrack')}>{t('midiEditor.del')}</button>
                        )}
                        <button onClick={onClose} style={{ ...btnStyle(false, isDark ? '#888' : '#666'), marginLeft: '8px', fontSize: '14px', padding: '4px 10px' }} title={t('common.close')}>✕</button>
                    </div>
                </div>

                {/* Drag overlay */}
                {dragOver && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 100,
                        background: hexToRgba(track.color, 0.1),
                        border: `2px dashed ${track.color}`,
                        borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', fontWeight: '700', color: track.color,
                        pointerEvents: 'none'
                    }}>
                        {t('midiEditor.dropAudioOrMidi')}
                    </div>
                )}

                {/* Piano Roll */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <PianoRollEditor
                        pattern={currentPattern}
                        onPatternChange={handlePatternChange}
                        bars={globalBars}
                        globalResolution={localResolution}
                        globalKey={globalKey}
                        globalScale={globalScale}
                        theme={theme}
                        height={600}
                        currentStep={globalCurrentStep}
                        globalPlayStartTime={globalPlayStartTime}
                        globalTempo={globalTempo}
                        rootPitch={rootPitch}
                        accentColors={accentColors}
                        onDrop={handleDrop}
                    />
                </div>
            </div>
        </div>
    );
};

export default MidiTrackEditor;
