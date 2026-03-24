import React, { useState, useRef, useEffect, useCallback } from 'react';
import './FileExplorerPanel.css';
import { FolderAnalyzer } from './FolderAnalyzer';
import WaveformVisualizer from './WaveformVisualizer';
import { MidiPreviewSynth } from './MidiPreviewSynth';
import MIDIParser from './MIDIParser';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext';

const FileExplorerPanelEnhanced = ({ onGenerateFromFolder, onFolderSelect, onRemoveFolder, onExtractMIDI, onDragSample, theme = 'dark', accentColors}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';


    const isDark = theme === 'dark';
    const [rootFolders, setRootFolders] = useState([]);
    const [explorerTab, setExplorerTab] = useState('local');
    const [factoryFolders, setFactoryFolders] = useState([]);
    const [factoryLoading, setFactoryLoading] = useState(false);
    const [factoryLoadProgress, setFactoryLoadProgress] = useState({ loaded: 0, total: 0, currentFile: '', status: '' });
    const [factoryLoaded, setFactoryLoaded] = useState(false);

    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [contextMenu, setContextMenu] = useState(null);
    const [analyzingFolder, setAnalyzingFolder] = useState(null);
    const [analysisProgress, setAnalysisProgress] = useState({ percent: 0, path: '', status: '' });
    const [draggedSample, setDraggedSample] = useState(null);
    const [midiPlaybackProgress, setMidiPlaybackProgress] = useState(0);
    const [isMidiPlaying, setIsMidiPlaying] = useState(false);
    const [saveAlertMsg, setSaveAlertMsg] = useState('');

    const audioContextRef = useRef(null);
    const midiSynthRef = useRef(null);
    const midiProgressIntervalRef = useRef(null);
    const midiCanvasRef = useRef(null);

    // Initialize AudioContext and MidiPreviewSynth lazily — reuse shared context
    const getMidiSynth = useCallback(() => {
        if (!audioContextRef.current) {
            if (!window.sharedAnalysisCtx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
            }
            audioContextRef.current = window.sharedAnalysisCtx;
        }
        if (!midiSynthRef.current) {
            midiSynthRef.current = new MidiPreviewSynth(audioContextRef.current);
        }
        return midiSynthRef.current;
    }, []);

    const folderAnalyzer = new FolderAnalyzer();
    const audioEngine = window.audioEngine;

    // ========== External Save / Auto-Mount Listener ==========
    useEffect(() => {
        const handleExternalSave = (e) => {
            const fileName = e.detail?.name || 'File';
            setSaveAlertMsg(`${fileName} was saved! Click the 🔄 icon on its parent folder to refresh this view.`);
            setTimeout(() => setSaveAlertMsg(''), 6000);
        };

        const handleAutoMount = async (e) => {
            const handle = e.detail?.handle;
            if (!handle) return;

            try {
                // Build the tree for this new subfolder
                const folderTree = await buildFolderTreeFromHandle(handle, handle.name, true);

                // Add or update it in the root folders array so it appears immediately!
                setRootFolders(prev => {
                    const existing = prev.findIndex(f => f.name === handle.name);
                    if (existing >= 0) {
                        const next = [...prev];
                        next[existing] = folderTree;
                        return next;
                    }
                    return [...prev, folderTree];
                });

                setSaveAlertMsg(`Successfully exported and mounted ${handle.name}!`);
                setTimeout(() => setSaveAlertMsg(''), 4000);
            } catch (err) {
                console.error('Auto-mount failed', err);
            }
        };

        window.addEventListener('wavloom:externalSave', handleExternalSave);
        window.addEventListener('wavloom:autoMountFolder', handleAutoMount);
        return () => {
            window.removeEventListener('wavloom:externalSave', handleExternalSave);
            window.removeEventListener('wavloom:autoMountFolder', handleAutoMount);
        };
    }, []);

    // ========== Factory Samples Auto-Load ==========
    useEffect(() => {
        if (factoryLoaded) return;
        loadFactorySamples();
    }, []);

    const loadFactorySamples = async () => {
        setFactoryLoading(true);
        setFactoryLoadProgress({ loaded: 0, total: 0, currentFile: '', status: 'Fetching manifest...' });

        try {
            const res = await fetch('/factory-manifest.json');
            if (!res.ok) throw new Error('Factory manifest not found');
            const manifest = await res.json();

            // Count total files across ALL folders
            let totalFiles = 0;
            const countFiles = (folders) => {
                for (const folder of folders) {
                    totalFiles += (folder.files || []).length;
                    if (folder.children) countFiles(folder.children);
                }
            };
            countFiles(manifest.folders);

            setFactoryLoadProgress(prev => ({ ...prev, total: totalFiles, status: `Scanning ${totalFiles} files across all folders...` }));

            // Ensure AudioContext exists for decoding — reuse shared context
            if (!audioContextRef.current) {
                if (!window.sharedAnalysisCtx) {
                    const Ctx = window.AudioContext || window.webkitAudioContext;
                    window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
                }
                audioContextRef.current = window.sharedAnalysisCtx;
            }

            let loadedCount = 0;

            // Build folder tree from manifest, loading all audio files
            const buildFactoryTree = async (manifestFolders, basePath = '') => {
                const result = [];
                for (const mFolder of manifestFolders) {
                    const folderPath = mFolder.path || (basePath ? `${basePath}/${mFolder.name}` : mFolder.name);
                    const folderNode = {
                        name: mFolder.name,
                        path: folderPath,
                        type: 'folder',
                        children: [],
                        files: [],
                        samples: [],
                        expanded: false,
                        isFactory: true,
                        id: `factory-${folderPath}-${Date.now()}`
                    };

                    // Load files in this folder
                    if (mFolder.files && mFolder.files.length > 0) {
                        for (const fileName of mFolder.files) {
                            const filePath = `/${folderPath}/${fileName}`;
                            const encodedPath = `/${folderPath}/${encodeURIComponent(fileName)}`;
                            setFactoryLoadProgress(prev => ({
                                ...prev,
                                loaded: loadedCount,
                                currentFile: fileName,
                                status: `Loading: ${mFolder.name}/${fileName}`
                            }));

                            try {
                                const audioRes = await fetch(encodedPath);
                                if (!audioRes.ok) throw new Error(`HTTP ${audioRes.status}`);
                                const arrayBuffer = await audioRes.arrayBuffer();
                                const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

                                const fileObj = {
                                    name: fileName,
                                    path: filePath,
                                    type: 'audio',
                                    buffer: audioBuffer,
                                    duration: audioBuffer.duration,
                                    isFactory: true,
                                    id: `factory-file-${filePath}-${Date.now() + Math.random()}`
                                };
                                folderNode.files.push(fileObj);
                                folderNode.samples.push(fileObj);
                            } catch (err) {
                                console.warn(`[Factory] Failed to load: ${filePath}`, err);
                            }

                            loadedCount++;
                            setFactoryLoadProgress(prev => ({
                                ...prev,
                                loaded: loadedCount
                            }));
                        }
                    }

                    // Recurse into children
                    if (mFolder.children && mFolder.children.length > 0) {
                        folderNode.children = await buildFactoryTree(mFolder.children, folderPath);
                    }

                    result.push(folderNode);
                }
                return result;
            };

            const factoryTree = await buildFactoryTree(manifest.folders);
            setFactoryFolders(factoryTree);
            setFactoryLoaded(true);
            setFactoryLoadProgress(prev => ({ ...prev, loaded: totalFiles, status: 'Complete!' }));

            // Brief delay to show completion before hiding
            setTimeout(() => {
                setFactoryLoading(false);
            }, 600);

        } catch (err) {
            console.error('[Factory] Failed to load factory samples:', err);
            setFactoryLoading(false);
            setFactoryLoadProgress({ loaded: 0, total: 0, currentFile: '', status: 'Failed to load' });
        }
    };

    /**
     * Import folder structure
     */
    /**
     * Import folder structure via FileSystem Access API
     */
    const handleImportFolder = async () => {
        try {
            const dirHandle = await window.showDirectoryPicker();
            const folderTree = await buildFolderTreeFromHandle(dirHandle, dirHandle.name, true);
            setRootFolders(prev => {
                const existing = prev.findIndex(f => f.name === dirHandle.name);
                if (existing >= 0) {
                    const next = [...prev];
                    next[existing] = folderTree;
                    return next;
                }
                return [...prev, folderTree];
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Import failed', err);
            }
        }
    };

    /**
     * Rescan a previously loaded folder handle
     */
    const handleRescanFolder = async (folderNode) => {
        if (!folderNode.handle) {
            console.warn('Cannot rescan, no directory handle available.');
            return;
        }
        try {
            if (typeof folderNode.handle.queryPermission === 'function') {
                if ((await folderNode.handle.queryPermission({ mode: 'read' })) !== 'granted') {
                    if (typeof folderNode.handle.requestPermission === 'function' &&
                        (await folderNode.handle.requestPermission({ mode: 'read' })) !== 'granted') {
                        console.warn('Permission denied for rescan');
                        return;
                    }
                }
            }
            const newTree = await buildFolderTreeFromHandle(folderNode.handle, folderNode.name, true);
            newTree.id = folderNode.id;
            newTree.expanded = folderNode.expanded;

            setRootFolders(prev => prev.map(f => f.id === folderNode.id ? newTree : f));
        } catch (err) {
            console.error('Rescan failed', err);
        }
    };

    /**
     * Recursively build hierarchical folder structure from FileSystemDirectoryHandle
     */
    const buildFolderTreeFromHandle = async (dirHandle, pathPrefix, isRoot = false) => {
        const tree = {
            name: dirHandle.name,
            path: pathPrefix,
            type: 'folder',
            children: [],
            files: [],
            samples: [],
            expanded: false,
            id: Date.now() + Math.random(),
            handle: dirHandle
        };

        for await (const [name, handle] of dirHandle.entries()) {
            const itemPath = `${pathPrefix}/${name}`;
            if (handle.kind === 'directory') {
                const childFolder = await buildFolderTreeFromHandle(handle, itemPath, false);
                tree.children.push(childFolder);
                tree.samples.push(...childFolder.samples);
            } else if (handle.kind === 'file') {
                const lName = name.toLowerCase();
                if (lName.endsWith('.wav') || lName.endsWith('.mp3') || lName.endsWith('.ogg') || lName.endsWith('.flac')) {
                    try {
                        const file = await handle.getFile();
                        const arrayBuffer = await file.arrayBuffer();
                        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

                        const fileObj = {
                            name: file.name,
                            path: itemPath,
                            type: 'audio',
                            file: file,
                            buffer: audioBuffer,
                            duration: audioBuffer.duration,
                            id: Date.now() + Math.random()
                        };
                        tree.files.push(fileObj);
                        tree.samples.push(fileObj);
                    } catch (err) {
                        console.error('Audio decode err:', name, err);
                    }
                } else if (lName.endsWith('.mid') || lName.endsWith('.midi')) {
                    try {
                        const file = await handle.getFile();
                        const parser = new MIDIParser();
                        const midiData = await parser.loadMIDIFile(file);
                        let allNotes = [];
                        midiData.tracks.forEach(track => {
                            allNotes = [...allNotes, ...parser.eventsToNotes(track.events)];
                        });
                        const ticksPerBeat = midiData.ticksPerBeat || 480;
                        const maxEndTick = allNotes.length > 0 ? Math.max(...allNotes.map(n => n.startTick + n.duration)) : 0;
                        const estimatedDuration = maxEndTick * (60 / 120) / ticksPerBeat;

                        const fileObj = {
                            name: file.name,
                            path: itemPath,
                            type: 'midi',
                            file: file,
                            midiNotes: allNotes,
                            ticksPerBeat: ticksPerBeat,
                            noteCount: allNotes.length,
                            estimatedDuration: estimatedDuration,
                            id: Date.now() + Math.random()
                        };
                        tree.files.push(fileObj);
                    } catch (err) {
                        console.warn('Failed to parse MIDI file:', name, err);
                    }
                }
            }
        }

        tree.children.sort((a, b) => a.name.localeCompare(b.name));
        tree.files.sort((a, b) => a.name.localeCompare(b.name));

        return tree;
    };

    /**
     * Toggle folder expansion
     */
    const toggleFolder = (folderId) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };

    /**
     * Handle file/folder selection
     */
    const handleSelect = (item) => {
        // Stop any MIDI playback when switching items
        if (selectedItem?.id !== item.id && isMidiPlaying) {
            stopMidiPlayback();
        }

        setSelectedItem(item);

        // Notify parent when folder is selected
        if (item.type === 'folder' && onFolderSelect) {
            onFolderSelect(item);
        }

        if (item.type === 'audio') {
            // Don't auto-play, wait for spacebar or click
        }
    };

    /**
     * Lazily parse MIDI data from a file item (caches result on the item)
     */
    const parseMidiItem = async (midiFile) => {
        // Already parsed? Return cached data
        if (midiFile.midiNotes && midiFile.midiNotes.length > 0) {
            return midiFile;
        }

        try {
            let file;
            if (midiFile.handle && midiFile.handle.getFile) {
                file = await midiFile.handle.getFile();
            } else if (midiFile.file) {
                file = midiFile.file;
            } else {
                console.warn('[MIDI] No file handle or file object for:', midiFile.name);
                return midiFile;
            }

            const parser = new MIDIParser();
            const midiData = await parser.loadMIDIFile(file);
            let allNotes = [];
            midiData.tracks.forEach(track => {
                allNotes = [...allNotes, ...parser.eventsToNotes(track.events)];
            });

            // Cache on the item so we don't re-parse
            midiFile.midiNotes = allNotes;
            midiFile.ticksPerBeat = midiData.ticksPerBeat || 480;
            midiFile.noteCount = allNotes.length;
            const maxEndTick = allNotes.length > 0 ? Math.max(...allNotes.map(n => n.startTick + n.duration)) : 0;
            midiFile.estimatedDuration = maxEndTick * (60 / 120) / midiFile.ticksPerBeat;

            console.log(`[MIDI] Parsed ${midiFile.name}: ${allNotes.length} notes`);
        } catch (err) {
            console.error('[MIDI] Parse error:', midiFile.name, err);
            midiFile.midiNotes = [];
            midiFile.ticksPerBeat = 480;
            midiFile.noteCount = 0;
        }

        return midiFile;
    };

    /**
     * Toggle MIDI preview playback — parses MIDI on-demand if needed
     */
    const toggleMidiPlayback = async (midiFile) => {
        if (!midiFile || midiFile.type !== 'midi') return;

        const synth = getMidiSynth();

        if (isMidiPlaying && selectedItem?.id === midiFile.id) {
            stopMidiPlayback();
            return;
        }

        // Stop any audio playback
        stopPlayback();

        // Parse MIDI on-demand if not already parsed
        await parseMidiItem(midiFile);

        if (!midiFile.midiNotes || midiFile.midiNotes.length === 0) {
            console.warn('[MIDI] No notes found in:', midiFile.name);
            return;
        }

        // Force re-render to show inline visualization
        setSelectedItem({ ...midiFile });

        synth.playMidi(midiFile.midiNotes, 120, midiFile.ticksPerBeat, () => {
            setIsMidiPlaying(false);
            setMidiPlaybackProgress(0);
            if (midiProgressIntervalRef.current) {
                clearInterval(midiProgressIntervalRef.current);
                midiProgressIntervalRef.current = null;
            }
        });

        setIsMidiPlaying(true);
        setMidiPlaybackProgress(0);

        // Poll progress
        midiProgressIntervalRef.current = setInterval(() => {
            if (synth.isPlaying()) {
                setMidiPlaybackProgress(synth.getProgress());
            } else {
                clearInterval(midiProgressIntervalRef.current);
                midiProgressIntervalRef.current = null;
            }
        }, 50);
    };

    /**
     * Stop MIDI preview playback
     */
    const stopMidiPlayback = () => {
        if (midiSynthRef.current) {
            midiSynthRef.current.stop();
        }
        setIsMidiPlaying(false);
        setMidiPlaybackProgress(0);
        if (midiProgressIntervalRef.current) {
            clearInterval(midiProgressIntervalRef.current);
            midiProgressIntervalRef.current = null;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (midiSynthRef.current) midiSynthRef.current.stop();
            if (midiProgressIntervalRef.current) clearInterval(midiProgressIntervalRef.current);
        };
    }, []);

    // Pre-warm AudioContext on first user click to eliminate playback delay
    useEffect(() => {
        const warmUp = () => {
            // Pre-create the synth so AudioContext is ready for instant playback
            const synth = getMidiSynth();
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }
            // Also pre-warm the audio engine for regular audio playback
            if (window.audioEngine && window.audioEngine.audioContext && window.audioEngine.audioContext.state === 'suspended') {
                window.audioEngine.audioContext.resume();
            }
            // Schedule idle suspend so pre-warm doesn't leave the context running
            if (window.__samplerRef?._scheduleIdleSuspend) window.__samplerRef._scheduleIdleSuspend();
            window.removeEventListener('click', warmUp);
            window.removeEventListener('mousedown', warmUp);
        };
        window.addEventListener('click', warmUp);
        window.addEventListener('mousedown', warmUp);
        return () => {
            window.removeEventListener('click', warmUp);
            window.removeEventListener('mousedown', warmUp);
        };
    }, [getMidiSynth]);

    // Draw mini piano roll for selected MIDI file
    useEffect(() => {
        if (!midiCanvasRef.current || !selectedItem || selectedItem.type !== 'midi' || !selectedItem.midiNotes) return;

        const canvas = midiCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const notes = selectedItem.midiNotes;
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);

        if (notes.length === 0) return;

        const minNote = Math.min(...notes.map(n => n.note));
        const maxNote = Math.max(...notes.map(n => n.note));
        const noteRange = Math.max(maxNote - minNote + 1, 12);
        const maxTick = Math.max(...notes.map(n => n.startTick + n.duration));

        notes.forEach(n => {
            const x = (n.startTick / maxTick) * w;
            const noteW = Math.max(1, (n.duration / maxTick) * w);
            const y = h - ((n.note - minNote + 1) / noteRange) * h;
            const noteH = Math.max(1, h / noteRange);
            const vel = (n.velocity || 100) / 127;

            ctx.fillStyle = hexToRgba(ac, 0.3 + vel * 0.7);
            ctx.fillRect(x, y, noteW, noteH - 0.5);
        });

        // Draw playhead if playing
        if (isMidiPlaying && midiPlaybackProgress > 0) {
            const px = midiPlaybackProgress * w;
            ctx.strokeStyle = `#fff`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.stroke();
        }
    }, [selectedItem, isMidiPlaying, midiPlaybackProgress]);

    /**
     * Play/pause sample
     */
    const togglePlayback = (sample) => {
        if (!sample || sample.type !== 'audio') return;

        if (isPlaying && selectedItem?.id === sample.id) {
            // Stop current playback
            stopPlayback();
        } else {
            // Start new playback
            playSample(sample);
        }
    };

    /**
     * Play sample from specific position
     */
    const playSample = (sample, startPosition = 0) => {
        if (!window.audioEngine) return;

        window.audioEngine.stop();
        window.audioEngine.pausedAt = startPosition * sample.duration;
        window.audioEngine.play(sample.buffer, () => {
            setIsPlaying(false);
            setPlaybackPosition(0);
        });

        setIsPlaying(true);
        setPlaybackPosition(startPosition);
    };

    /**
     * Stop playback
     */
    const stopPlayback = () => {
        if (window.audioEngine) window.audioEngine.stop();
        setIsPlaying(false);
        setPlaybackPosition(0);
    };

    // Polling for playback progress
    useEffect(() => {
        let interval;
        if (isPlaying && window.audioEngine) {
            interval = setInterval(() => {
                const time = window.audioEngine.getCurrentTime();
                const dur = window.audioEngine.getDuration();
                if (dur > 0) {
                    setPlaybackPosition(time / dur);
                }
            }, 50);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    /**
     * Handle waveform click for seeking
     */
    const handleWaveformClick = (sample, position) => {
        if (!window.audioEngine) return;
        playSample(sample, position);
    };

    /**
     * Get flattened list of all visible files from folder trees for arrow key navigation
     */
    const getFlatFileList = useCallback(() => {
        const files = [];
        const folders = explorerTab === 'local' ? rootFolders : factoryFolders;

        const collectFiles = (folder) => {
            if (expandedFolders.has(folder.id)) {
                folder.children.forEach(child => collectFiles(child));
                folder.files.forEach(file => files.push(file));
            }
        };

        // Also collect top-level items (folder headers themselves are selectable)
        const collectAll = (folder) => {
            files.push(folder); // the folder itself
            if (expandedFolders.has(folder.id)) {
                folder.children.forEach(child => collectAll(child));
                folder.files.forEach(file => files.push(file));
            }
        };

        folders.forEach(folder => collectAll(folder));
        return files;
    }, [explorerTab, rootFolders, factoryFolders, expandedFolders]);

    /**
     * Handle keyboard shortcuts
     */
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Spacebar: play/pause selected sample
            if (e.code === 'Space' && selectedItem?.type === 'audio') {
                e.preventDefault();
                togglePlayback(selectedItem);
            }

            // Spacebar: play/pause selected MIDI
            if (e.code === 'Space' && selectedItem?.type === 'midi') {
                e.preventDefault();
                toggleMidiPlayback(selectedItem);
            }

            // Escape: stop playback
            if (e.code === 'Escape') {
                stopPlayback();
                stopMidiPlayback();
            }

            // Arrow Up: navigate to previous item
            if (e.code === 'ArrowUp') {
                e.preventDefault();
                const items = getFlatFileList();
                if (items.length === 0) return;
                const currentIndex = items.findIndex(f => f.id === selectedItem?.id);
                const newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                const newItem = items[newIndex];
                handleSelect(newItem);
                if (newItem.type === 'folder') {
                    toggleFolder(newItem.id);
                }
            }

            // Arrow Down: navigate to next item
            if (e.code === 'ArrowDown') {
                e.preventDefault();
                const items = getFlatFileList();
                if (items.length === 0) return;
                const currentIndex = items.findIndex(f => f.id === selectedItem?.id);
                const newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                const newItem = items[newIndex];
                handleSelect(newItem);
                if (newItem.type === 'folder') {
                    toggleFolder(newItem.id);
                }
            }

            // Arrow Right: replay selected audio sample from the start
            if (e.code === 'ArrowRight' && selectedItem?.type === 'audio') {
                e.preventDefault();
                stopPlayback();
                playSample(selectedItem, 0);
            }

            // Arrow Right: replay selected MIDI from start
            if (e.code === 'ArrowRight' && selectedItem?.type === 'midi') {
                e.preventDefault();
                stopMidiPlayback();
                toggleMidiPlayback(selectedItem);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem, getFlatFileList]);

    /**
     * Handle drag start — supports both audio and MIDI files
     * For MIDI: parses notes on-demand and caches them on the item
     */
    const handleDragStart = async (e, sample) => {
        if (sample.type !== 'audio' && sample.type !== 'midi') return;

        // For MIDI files, parse notes on-demand before drag
        if (sample.type === 'midi') {
            await parseMidiItem(sample);
        }

        setDraggedSample(sample);

        // Store on window for cross-component drop handling
        window.draggedItem = sample;

        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify({
            name: sample.name,
            path: sample.path,
            type: sample.type,
            noteCount: sample.noteCount || 0
        }));

        // Create drag image
        const icon = sample.type === 'midi' ? '🎹' : '🎵';
        const dragImage = document.createElement('div');
        dragImage.textContent = `${icon} ${sample.name}`;
        dragImage.style.cssText = `position: absolute; top: -1000px; padding: 8px; background: ${ac}; color: white; border-radius: 4px; font-size: 12px;`;
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
    };

    /**
     * Handle drag end
     */
    const handleDragEnd = () => {
        setDraggedSample(null);
        window.draggedItem = null;
    };

    /**
     * Handle context menu
     */
    const handleContextMenu = (e, target, isFolder = true) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            target,
            isFolder
        });
    };

    const handleExtractMIDI = async (file, dest) => {
        setContextMenu(null);
        try {
            const analyzer = new (await import('./AudioAnalyzer')).default();
            const buffer = await analyzer.loadAudioFile(file);

            if (dest === 'all') {
                // Extract 3 separate patterns using range filtering
                const patterns = {
                    melody: analyzer.extractMIDI(buffer, 120, 'melody'),
                    bass: analyzer.extractMIDI(buffer, 120, 'bass'),
                    chords: analyzer.extractMIDI(buffer, 120, 'chords')
                };
                if (onExtractMIDI) onExtractMIDI(patterns, 'all');
            } else {
                const pattern = analyzer.extractMIDI(buffer, 120, dest);
                if (onExtractMIDI) onExtractMIDI(pattern, dest);
            }
        } catch (err) {
            console.error("MIDI Extraction failed:", err);
        }
    };


    /**
     * Close context menu
     */
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            window.addEventListener('click', handleClick);
            return () => window.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    /**
     * Handle analyze and generate
     */
    const handleAnalyzeAndGenerate = async (folder) => {
        setContextMenu(null);
        setAnalyzingFolder(folder.id);
        setAnalysisProgress({ percent: 0, path: 'Scanning...', status: 'Initializing deep analysis...' });

        try {
            const files = getAllFilesFromFolder(folder);
            const characteristics = await folderAnalyzer.analyzeFolder(files, folder.name, (progress) => {
                setAnalysisProgress(progress);
            });

            if (onGenerateFromFolder) {
                onGenerateFromFolder({
                    folder,
                    characteristics,
                    files
                });
            }
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Failed to analyze folder: ' + error.message);
        } finally {
            setAnalyzingFolder(null);
            setAnalysisProgress({ percent: 0, path: '', status: '' });
        }
    };


    /**
     * Get all files from folder recursively
     */
    const getAllFilesFromFolder = (folder) => {
        let files = [...folder.files];
        folder.children.forEach(child => {
            if (child.type === 'folder') {
                files = files.concat(getAllFilesFromFolder(child));
            }
        });
        return files;
    };

    /**
     * Inline mini MIDI roll with playhead — matches WaveformVisualizer style
     */
    const MidiMiniRoll = React.memo(({ notes, width, height, isPlaying, progress }) => {
        const canvasRef = React.useRef(null);

        React.useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas || !notes || notes.length === 0) return;

            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            // Draw background
            ctx.fillStyle = 'rgba(10, 10, 15, 0.6)';
            ctx.fillRect(0, 0, w, h);

            const minNote = Math.min(...notes.map(n => n.note));
            const maxNote = Math.max(...notes.map(n => n.note));
            const noteRange = Math.max(maxNote - minNote + 1, 12);
            const maxTick = Math.max(...notes.map(n => n.startTick + n.duration));

            // Draw notes
            notes.forEach(n => {
                const x = (n.startTick / maxTick) * w;
                const nw = Math.max(1, (n.duration / maxTick) * w);
                const y = h - ((n.note - minNote + 1) / noteRange) * h;
                const nh = Math.max(1, h / noteRange);
                const vel = (n.velocity || 100) / 127;

                ctx.fillStyle = isPlaying
                    ? `rgba(255, 68, 68, ${0.3 + vel * 0.7})`
                    : `rgba(102, 126, 234, ${0.3 + vel * 0.7})`;
                ctx.fillRect(x, y, nw, nh - 0.5);
            });

            // Draw playhead
            if (isPlaying && progress > 0) {
                const px = progress * w;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.moveTo(px, 0);
                ctx.lineTo(px, h);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }, [notes, width, height, isPlaying, progress]);

        return (
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{ width: `${width}px`, height: `${height}px`, borderRadius: '3px', display: 'block' }}
            />
        );
    });

    /**
     * Render folder tree
     */
    const renderFolder = (folder, depth = 0) => {
        const isExpanded = expandedFolders.has(folder.id);
        const isAnalyzing = analyzingFolder === folder.id;
        const fileCount = getAllFilesFromFolder(folder).length;

        return (
            <div key={folder.id}>
                <div
                    className={`folder-row ${selectedItem?.id === folder.id ? 'selected' : ''}`}
                    style={{ paddingLeft: `${depth * 20 + 8}px` }}
                    onClick={() => {
                        toggleFolder(folder.id);
                        handleSelect(folder);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, folder)}
                >
                    <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
                    <span className="folder-name">{folder.name}</span>
                    <span className="file-count">{fileCount}</span>

                    {depth === 0 && folder.handle && (
                        <button
                            title={t('browser.rescanFolder')}
                            className="rescan-button"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 'auto', fontSize: '13px' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRescanFolder(folder);
                            }}
                        >
                            🔄
                        </button>
                    )}

                    {isAnalyzing && <span className="analyzing">⏳</span>}
                </div>

                {isExpanded && (
                    <>
                        {folder.children.map(child => renderFolder(child, depth + 1))}
                        {folder.files.map(file => renderFile(file, depth + 1))}
                    </>
                )}
            </div>
        );
    };

    /**
     * Render file
     */
    const renderFile = (file, depth) => {
        const isFilePlaying = (isPlaying && selectedItem?.id === file.id) || (isMidiPlaying && selectedItem?.id === file.id);
        const isSelected = selectedItem?.id === file.id;

        return (
            <div
                key={file.id}
                className={`file-row ${isSelected ? 'selected' : ''} ${isFilePlaying ? 'playing' : ''}`}
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
                onClick={() => handleSelect(file)}
                onDoubleClick={() => {
                    if (file.type === 'audio') togglePlayback(file);
                    else if (file.type === 'midi') toggleMidiPlayback(file);
                }}
                draggable={file.type === 'audio' || file.type === 'midi'}
                onDragStart={(e) => handleDragStart(e, file)}
                onDragEnd={handleDragEnd}
                onContextMenu={(e) => handleContextMenu(e, file, false)}
            >

                <span className="file-icon">{file.type === 'audio' ? '🎵' : '🎹'}</span>
                <div className="file-content">
                    <div className="file-name">{file.name}</div>
                    {file.type === 'audio' && file.buffer && (
                        <div className="file-waveform">
                            <WaveformVisualizer
                                audioBuffer={file.buffer}
                                width={180}
                                height={30}
                                color={isFilePlaying ? '#ff4444' : '#667eea'}
                                showPlayhead={isFilePlaying}
                                playheadPosition={playbackPosition}
                                onClick={(pos) => handleWaveformClick(file, pos)}
                                theme={theme}
                            />
                        </div>
                    )}
                    {file.type === 'audio' && (
                        <div className="file-duration">
                            {file.duration.toFixed(1)}s
                            {isFilePlaying && ' ▶'}
                        </div>
                    )}
                    {file.type === 'midi' && (
                        <div className="file-duration" style={{ color: acSec }}>
                            {file.noteCount || 0} notes
                            {isFilePlaying && ' ▶'}
                        </div>
                    )}
                    {file.type === 'midi' && file.midiNotes && file.midiNotes.length > 0 && (
                        <div className="file-waveform" style={{ position: 'relative' }}>
                            <MidiMiniRoll notes={file.midiNotes} width={180} height={30} isPlaying={isFilePlaying} progress={isMidiPlaying && selectedItem?.id === file.id ? midiPlaybackProgress : 0} />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    /**
     * Filter files by search query
     */
    const filterFolder = (folder) => {
        if (!searchQuery) return folder;

        const query = searchQuery.toLowerCase();
        const matchesName = folder.name.toLowerCase().includes(query);
        const matchingChildren = folder.children.map(filterFolder).filter(Boolean);
        const matchingFiles = folder.files.filter(f => f.name.toLowerCase().includes(query));

        if (matchesName || matchingChildren.length > 0 || matchingFiles.length > 0) {
            return {
                ...folder,
                children: matchingChildren,
                files: matchingFiles
            };
        }

        return null;
    };

    const filteredFolders = rootFolders.map(filterFolder).filter(Boolean);
    const filteredFactoryFolders = factoryFolders.map(filterFolder).filter(Boolean);

    const factoryProgressPercent = factoryLoadProgress.total > 0
        ? (factoryLoadProgress.loaded / factoryLoadProgress.total) * 100
        : 0;

    return (
        <div className={`file-explorer ${theme}`}>
            {/* Tab Bar */}
            <div className="explorer-tabs">
                <button
                    className={`explorer-tab ${explorerTab === 'local' ? 'active' : ''}`}
                    onClick={() => setExplorerTab('local')}
                >
                    📁 Local Samples
                </button>
                <button
                    className={`explorer-tab ${explorerTab === 'factory' ? 'active' : ''}`}
                    onClick={() => setExplorerTab('factory')}
                >
                    🏭 Factory Samples
                    {factoryLoading && <span className="tab-loading-dot">●</span>}
                </button>
            </div>

            {/* Search Bar (shown on both tabs) */}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder={explorerTab === 'local' ? 'Search local files...' : 'Search factory samples...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* ===== LOCAL SAMPLES TAB ===== */}
            {explorerTab === 'local' && (
                <>
                    {saveAlertMsg && (
                        <div style={{
                            background: 'rgba(0, 200, 100, 0.2)', border: '1px solid rgba(0,250,150,0.5)',
                            color: '#8f8', padding: '8px', fontSize: '11px', borderRadius: '4px', margin: '4px', textAlign: 'center'
                        }}>
                            ✅ {saveAlertMsg}
                        </div>
                    )}
                    <div className="tab-action-bar">
                        <button className="import-button" onClick={handleImportFolder} title={t('browser.importFolderSystemApi')}>
                            + Import Folder
                        </button>
                    </div>
                    <div className="folder-tree">
                        {filteredFolders.length === 0 ? (
                            <div className="empty-state">
                                <p>No folders imported</p>
                                <p className="hint">Click + Import Folder to add your samples</p>
                            </div>
                        ) : (
                            filteredFolders.map(folder => renderFolder(folder))
                        )}
                    </div>
                </>
            )}

            {/* ===== FACTORY SAMPLES TAB ===== */}
            {explorerTab === 'factory' && (
                <>
                    {/* Factory Loading Progress */}
                    {factoryLoading && (
                        <div className="factory-loading">
                            <div className="factory-loading-header">
                                <span className="factory-loading-icon">🔄</span>
                                <span className="factory-loading-status">{factoryLoadProgress.status}</span>
                            </div>
                            <div className="factory-progress-bar-container">
                                <div
                                    className="factory-progress-bar-fill"
                                    style={{ width: `${factoryProgressPercent}%` }}
                                />
                            </div>
                            <div className="factory-loading-detail">
                                {factoryLoadProgress.loaded} / {factoryLoadProgress.total} files loaded
                            </div>
                            <div className="factory-loading-file">
                                {factoryLoadProgress.currentFile}
                            </div>
                        </div>
                    )}
                    <div className="folder-tree">
                        {!factoryLoading && filteredFactoryFolders.length === 0 ? (
                            <div className="empty-state">
                                <p>No factory samples found</p>
                                <p className="hint">Factory library may not be installed</p>
                            </div>
                        ) : (
                            filteredFactoryFolders.map(folder => renderFolder(folder))
                        )}
                    </div>
                </>
            )}

            {analyzingFolder && (
                <div className="analysis-overlay" style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 2000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    textAlign: 'center',
                    color: '#fff',
                    borderRadius: '8px'
                }}>
                    <div className="dna-loader" style={{ marginBottom: '20px', fontSize: '24px' }}>🧬</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                        {analysisProgress.status}
                    </div>
                    <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '15px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {analysisProgress.path}
                    </div>

                    <div className="progress-container" style={{
                        width: '100%',
                        height: '10px',
                        background: '#333',
                        borderRadius: '5px',
                        overflow: 'hidden',
                        marginBottom: '8px'
                    }}>
                        <div className="progress-fill" style={{
                            width: `${analysisProgress.percent}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${ac} 0%, ${acSec} 100%)`,
                            transition: `width 0.1s ease-out`,
                            boxShadow: `0 0 10px ${hexToRgba(ac, 0.5)}`
                        }} />
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: ac, fontVariantNumeric: 'tabular-nums' }}>
                        {analysisProgress.percent.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
                        TRANSCRIPTION IN PROGRESS...
                    </div>
                </div>
            )}


            {contextMenu && (
                <div
                    className="context-menu"
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        zIndex: 1000,
                        background: isDark ? '#1a1a2e' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ccc'}`,
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        overflow: 'hidden',
                        padding: '4px 0',
                        minWidth: '160px'
                    }}
                >
                    {contextMenu.isFolder ? (
                        <>
                            <div
                                className="context-menu-item"
                                style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}
                                onClick={() => handleAnalyzeAndGenerate(contextMenu.target)}
                            >
                                🔍 Analyze Folder
                            </div>
                            <div
                                className="context-menu-item"
                                style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '13px', color: '#ff4444' }}
                                onClick={() => {
                                    if (window.confirm(`Remove folder "${contextMenu.target.name}"?`)) {
                                        setRootFolders(prev => prev.filter(f => f.id !== contextMenu.target.id));
                                        setContextMenu(null);
                                        if (onRemoveFolder) onRemoveFolder(contextMenu.target);
                                    }
                                }}
                            >
                                🗑️ Remove Folder
                            </div>
                        </>
                    ) : (
                        <>
                            {contextMenu.target.type === 'audio' && (
                                <>
                                    <div style={{ padding: '4px 16px', fontSize: '10px', color: '#888', fontWeight: 'bold' }}>EXTRACT MIDI TO:</div>
                                    <div
                                        className="context-menu-item"
                                        style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}
                                        onClick={() => handleExtractMIDI(contextMenu.target.handle ? contextMenu.target : contextMenu.target, 'melody')}
                                    >
                                        🎹 Melody Track
                                    </div>
                                    <div
                                        className="context-menu-item"
                                        style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}
                                        onClick={() => handleExtractMIDI(contextMenu.target.handle ? contextMenu.target : contextMenu.target, 'bass')}
                                    >
                                        🎸 Bass Track
                                    </div>
                                    <div
                                        className="context-menu-item"
                                        style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}
                                        onClick={() => handleExtractMIDI(contextMenu.target.handle ? contextMenu.target : contextMenu.target, 'chords')}
                                    >
                                        🎼 Chord Track
                                    </div>
                                    <div
                                        className="context-menu-item"
                                        style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', borderTop: '1px solid #333' }}
                                        onClick={() => handleExtractMIDI(contextMenu.target, 'all')}
                                    >
                                        🎹 All 3 Tracks (Melody + Bass + Chord)
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}



            {playingSample && (
                <div className="playback-info">
                    <div className="playback-name">▶ {playingSample.name}</div>
                    <button onClick={stopPlayback} className="stop-button">⏹ Stop</button>
                </div>
            )}

            {/* MIDI Preview Panel */}
            {selectedItem?.type === 'midi' && selectedItem.midiNotes && (
                <div className="midi-preview-panel" style={{
                    borderTop: '1px solid #333',
                    padding: '10px',
                    background: '#111118'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <button
                            onClick={() => toggleMidiPlayback(selectedItem)}
                            style={{
                                width: '32px', height: '32px',
                                background: isMidiPlaying ? ac : '#333',
                                border: 'none', borderRadius: '50%',
                                color: '#fff', fontSize: '14px',
                                cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isMidiPlaying ? '⏸' : '▶'}
                        </button>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', color: '#eee', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selectedItem.name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#888' }}>
                                {selectedItem.noteCount} notes • {selectedItem.estimatedDuration?.toFixed(1)}s
                            </div>
                        </div>
                        {isMidiPlaying && (
                            <button
                                onClick={stopMidiPlayback}
                                style={{
                                    background: 'transparent', border: '1px solid #555',
                                    borderRadius: '4px', color: ac,
                                    fontSize: '11px', padding: '4px 8px',
                                    cursor: 'pointer'
                                }}
                            >
                                ⏹
                            </button>
                        )}
                    </div>

                    {/* Progress bar */}
                    {isMidiPlaying && (
                        <div style={{ width: '100%', height: '3px', background: '#222', borderRadius: '2px', marginBottom: '6px' }}>
                            <div style={{
                                width: `${midiPlaybackProgress * 100}%`,
                                height: '100%',
                                background: acGrad,
                                borderRadius: '2px',
                                transition: 'width 0.05s linear'
                            }} />
                        </div>
                    )}

                    {/* Mini piano roll */}
                    <canvas
                        ref={midiCanvasRef}
                        width={260}
                        height={60}
                        style={{ width: '100%', height: '60px', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => toggleMidiPlayback(selectedItem)}
                    />
                </div>
            )}
        </div>
    );
};

export default FileExplorerPanelEnhanced;
