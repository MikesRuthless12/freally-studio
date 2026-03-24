import React, { useState, useRef, useEffect } from 'react';
import './FileExplorerPanel.css';
import { FolderAnalyzer } from './FolderAnalyzer';

const FileExplorerPanel = ({ onGenerateFromFolder, onFolderSelect, onDragSample, theme = 'dark' }) => {
    const [rootFolders, setRootFolders] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [playingSample, setPlayingSample] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [analyzingFolder, setAnalyzingFolder] = useState(null);
    const [previewDuration, setPreviewDuration] = useState(0);
    const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

    // Reuse shared AudioContext — avoid creating competing contexts
    const audioContextRef = useRef(null);
    if (!audioContextRef.current) {
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
        }
        audioContextRef.current = window.sharedAnalysisCtx;
    }
    const currentSourceRef = useRef(null);
    const currentBufferRef = useRef(null);
    const playbackStartTimeRef = useRef(0);
    const seekOffsetRef = useRef(0);
    const timerRef = useRef(null);
    const folderAnalyzer = new FolderAnalyzer();

    /**
     * Import folder structure
     */
    const handleImportFolder = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Build folder tree structure
        const folderTree = buildFolderTree(files);
        setRootFolders(prev => {
            const next = [...prev, folderTree];
            saveFolders(next);
            return next;
        });
    };

    /**
     * Remove a root folder
     */
    const handleRemoveFolder = (folderId) => {
        setRootFolders(prev => {
            const next = prev.filter(f => f.id !== folderId);
            saveFolders(next);
            return next;
        });
        setContextMenu(null);
        if (selectedItem && selectedItem.id === folderId) {
            setSelectedItem(null);
        }
    };

    /**
     * Save folders to localStorage (metadata only)
     */
    const saveFolders = (folders) => {
        try {
            // We can't save File objects, so we save a JSON structure of names/paths
            // This is useful for remembering WHAT folders were open.
            const serialized = folders.map(f => ({
                name: f.name,
                path: f.path,
                id: f.id,
                type: 'folder',
                children: serializeChildren(f.children),
                files: f.files.map(file => ({
                    name: file.name,
                    path: file.path,
                    type: file.type,
                    id: file.id
                }))
            }));
            localStorage.setItem('wavloom_folders', JSON.stringify(serialized));
        } catch (e) {
            console.error("Failed to save folder state", e);
        }
    };

    const serializeChildren = (children) => {
        return children.map(c => ({
            name: c.name,
            path: c.path,
            id: c.id,
            type: 'folder',
            children: serializeChildren(c.children),
            files: c.files.map(file => ({
                name: file.name,
                path: file.path,
                type: file.type,
                id: file.id
            }))
        }));
    };

    /**
     * Load folders from localStorage
     */
    const loadFolders = () => {
        const saved = localStorage.getItem('wavloom_folders');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Note: File contents will be missing (offline state)
                // In a real app, we'd prompt to re-link or use File System Access API
                setRootFolders(parsed);
            } catch (e) {
                console.error("Failed to parse saved folders", e);
            }
        }
    };

    useEffect(() => {
        loadFolders();
    }, []);

    /**
     * Build hierarchical folder structure from flat file list
     */
    const buildFolderTree = (files) => {
        const tree = {
            name: files[0].webkitRelativePath.split('/')[0] || 'Imported Folder',
            path: files[0].webkitRelativePath.split('/')[0],
            type: 'folder',
            children: [],
            files: [],
            expanded: false,
            id: Date.now()
        };

        files.forEach(file => {
            const parts = file.webkitRelativePath.split('/');
            let currentLevel = tree;

            // Navigate/create folder structure
            for (let i = 1; i < parts.length - 1; i++) {
                const folderName = parts[i];
                let folder = currentLevel.children.find(c => c.name === folderName && c.type === 'folder');

                if (!folder) {
                    folder = {
                        name: folderName,
                        path: parts.slice(0, i + 1).join('/'),
                        type: 'folder',
                        children: [],
                        files: [],
                        expanded: false,
                        id: Date.now() + Math.random()
                    };
                    currentLevel.children.push(folder);
                }

                currentLevel = folder;
            }

            // Add file to current folder
            const fileName = parts[parts.length - 1];
            const fileExt = fileName.split('.').pop().toLowerCase();

            if (['wav', 'mp3', 'ogg', 'm4a', 'mid', 'midi'].includes(fileExt)) {
                currentLevel.files.push({
                    name: fileName,
                    path: file.webkitRelativePath,
                    type: fileExt === 'mid' || fileExt === 'midi' ? 'midi' : 'audio',
                    file: file,
                    id: Date.now() + Math.random()
                });
            }
        });

        // Sort folders and files
        sortFolderTree(tree);

        return tree;
    };

    /**
     * Sort folder tree alphabetically
     */
    const sortFolderTree = (folder) => {
        folder.children.sort((a, b) => a.name.localeCompare(b.name));
        folder.files.sort((a, b) => a.name.localeCompare(b.name));
        folder.children.forEach(sortFolderTree);
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
        setSelectedItem(item);

        // Notify parent when folder is selected
        if (item.type === 'folder' && onFolderSelect) {
            onFolderSelect(item);
        }

        if (item.type === 'audio') {
            previewSample(item);
        }
    };

    /**
     * Preview audio sample
     */
    const previewSample = async (fileItem, offset = 0) => {
        // Stop current playback
        stopPlayback();

        try {
            let audioBuffer;
            if (currentBufferRef.current && playingSample === fileItem.id && offset > 0) {
                audioBuffer = currentBufferRef.current;
            } else {
                if (!fileItem.file) {
                    alert("This file is from a previous session and its contents are no longer in memory. Please re-import the folder to play it.");
                    return;
                }
                const arrayBuffer = await fileItem.file.arrayBuffer();
                audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                currentBufferRef.current = audioBuffer;
            }

            setPreviewDuration(audioBuffer.duration);
            seekOffsetRef.current = offset;
            playbackStartTimeRef.current = audioContextRef.current.currentTime;

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start(0, offset);

            currentSourceRef.current = source;
            setPlayingSample(fileItem.id);

            source.onended = () => {
                if (seekOffsetRef.current + (audioContextRef.current.currentTime - playbackStartTimeRef.current) >= audioBuffer.duration - 0.1) {
                    setPlayingSample(null);
                    currentSourceRef.current = null;
                    setPreviewCurrentTime(0);
                    clearInterval(timerRef.current);
                }
            };

            // Start timer for progress
            clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
                setPreviewCurrentTime(seekOffsetRef.current + elapsed);
            }, 100);

        } catch (error) {
            console.error('Error playing sample:', error);
        }
    };

    const handleSeek = (e) => {
        const newOffset = parseFloat(e.target.value);
        if (selectedItem && selectedItem.type === 'audio') {
            previewSample(selectedItem, newOffset);
        }
    };

    /**
     * Stop playback
     */
    const stopPlayback = () => {
        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch (e) { }
            currentSourceRef.current = null;
        }
        clearInterval(timerRef.current);
        setPlayingSample(null);
        setPreviewCurrentTime(0);
    };

    /**
     * Handle drag start
     */
    const handleDragStart = (e, item) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: item.type,
            name: item.name,
            path: item.path,
            file: item.file
        }));

        if (onDragSample) {
            onDragSample(item);
        }
    };

    /**
     * Handle right-click context menu
     */
    const handleContextMenu = (e, item) => {
        e.preventDefault();
        if (item.type === 'folder') {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                item
            });
        }
    };

    /**
     * Analyze folder and generate
     */
    const handleAnalyzeFolder = async (folder) => {
        setContextMenu(null);
        setAnalyzingFolder(folder.id);

        try {
            // Collect all files in folder and subfolders
            const allFiles = collectAllFiles(folder);

            // Analyze
            const characteristics = await folderAnalyzer.analyzeFolder(allFiles, folder.name);

            setAnalyzingFolder(null);

            // Callback to parent with results
            if (onGenerateFromFolder) {
                onGenerateFromFolder({
                    folder,
                    characteristics,
                    files: allFiles
                });
            }
        } catch (error) {
            console.error('Error analyzing folder:', error);
            alert('Error analyzing folder');
            setAnalyzingFolder(null);
        }
    };

    /**
     * Collect all files from folder recursively
     */
    const collectAllFiles = (folder) => {
        let files = [...folder.files.map(f => f.file)];
        folder.children.forEach(child => {
            files = files.concat(collectAllFiles(child));
        });
        return files;
    };

    /**
     * Get folder file count
     */
    const getFolderFileCount = (folder) => {
        let count = folder.files.length;
        folder.children.forEach(child => {
            count += getFolderFileCount(child);
        });
        return count;
    };

    /**
     * Filter items by search query
     */
    const filterItems = (items, query) => {
        if (!query) return items;
        const lowerQuery = query.toLowerCase();
        return items.filter(item => item.name.toLowerCase().includes(lowerQuery));
    };

    /**
     * Render folder tree recursively
     */
    const renderFolderTree = (folder, depth = 0) => {
        const isExpanded = expandedFolders.has(folder.id);
        const fileCount = getFolderFileCount(folder);
        const isAnalyzing = analyzingFolder === folder.id;

        return (
            <div key={folder.id} className="folder-tree-item">
                <div
                    className={`folder-row ${selectedItem?.id === folder.id ? 'selected' : ''}`}
                    style={{ paddingLeft: `${depth * 20 + 8}px` }}
                    onClick={() => toggleFolder(folder.id)}
                    onContextMenu={(e) => handleContextMenu(e, folder)}
                >
                    <span className="folder-icon">
                        {isExpanded ? '📂' : '📁'}
                    </span>
                    <span className="folder-name">{folder.name}</span>
                    <span className="file-count">{fileCount}</span>
                    {isAnalyzing && <span className="analyzing-badge">Analyzing...</span>}
                </div>

                {isExpanded && (
                    <div className="folder-contents">
                        {/* Render child folders */}
                        {folder.children.map(child => renderFolderTree(child, depth + 1))}

                        {/* Render files */}
                        {filterItems(folder.files, searchQuery).map(file => (
                            <div
                                key={file.id}
                                className={`file-row ${selectedItem?.id === file.id ? 'selected' : ''} ${playingSample === file.id ? 'playing' : ''}`}
                                style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}
                                onClick={() => handleSelect(file)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, file)}
                            >
                                <span className="file-icon">
                                    {file.type === 'midi' ? '🎹' : '🎵'}
                                </span>
                                <span className="file-name">{file.name}</span>
                                {playingSample === file.id && (
                                    <button
                                        className="stop-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            stopPlayback();
                                        }}
                                    >
                                        ⏹
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    /**
     * Close context menu
     */
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className={`file-explorer-panel ${theme}`}>
            <div className="file-explorer-header">
                <h3>File Explorer</h3>
                <label className="import-folder-btn" title="Import Folder">
                    +
                    <input
                        type="file"
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        onChange={handleImportFolder}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>

            <div className="file-explorer-search">
                <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="file-explorer-tree">
                {rootFolders.length === 0 ? (
                    <div className="empty-state">
                        <p>No folders imported</p>
                        <p className="empty-hint">Click + to import a folder</p>
                    </div>
                ) : (
                    rootFolders.map(folder => renderFolderTree(folder))
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="context-menu"
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => handleAnalyzeFolder(contextMenu.item)}>
                        🔍 Analyze & Generate
                    </button>
                    <button onClick={() => handleRemoveFolder(contextMenu.item.id)} style={{ color: '#ff4444' }}>
                        🗑 Remove Folder
                    </button>
                    <button onClick={() => {
                        toggleFolder(contextMenu.item.id);
                        setContextMenu(null);
                    }}>
                        {expandedFolders.has(contextMenu.item.id) ? '📁 Collapse' : '📂 Expand'}
                    </button>
                </div>
            )}

            {/* Sample Preview Panel */}
            {selectedItem && selectedItem.type === 'audio' && (
                <div className="sample-preview-panel">
                    <div className="preview-header">
                        <span className="preview-title">{selectedItem.name}</span>
                        <div className="preview-controls">
                            <button
                                className="preview-play-btn"
                                onClick={() => {
                                    if (playingSample === selectedItem.id) {
                                        stopPlayback();
                                    } else {
                                        previewSample(selectedItem, previewCurrentTime);
                                    }
                                }}
                            >
                                {playingSample === selectedItem.id ? '⏹ Stop' : '▶ Play'}
                            </button>
                        </div>
                    </div>

                    <div className="seek-container">
                        <input
                            type="range"
                            className="preview-seek-bar"
                            min="0"
                            max={previewDuration || 100}
                            step="0.01"
                            value={previewCurrentTime}
                            onChange={handleSeek}
                        />
                        <div className="time-display">
                            {formatTime(previewCurrentTime)} / {formatTime(previewDuration)}
                        </div>
                    </div>

                    <div className="preview-hint">
                        Drag to generator to use this sample
                    </div>
                </div>
            )}
        </div>
    );
};

const formatTime = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default FileExplorerPanel;
