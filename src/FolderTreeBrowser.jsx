import React, { useState, useEffect } from 'react';
import ImportProgressModal from './ImportProgressModal';
import { useTranslation } from './i18n/I18nContext';

const FolderTreeBrowser = ({ theme, onSampleDragStart }) => {
    const { t } = useTranslation();
    const [folders, setFolders] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [currentExpandedFolder, setCurrentExpandedFolder] = useState(null);
    const [samples, setSamples] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTags, setFilterTags] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [importProgress, setImportProgress] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);

    useEffect(() => {
        loadFolders();
        loadAllTags();
    }, []);

    // Update global reference to current expanded folder
    useEffect(() => {
        window.currentExpandedFolder = currentExpandedFolder;
    }, [currentExpandedFolder]);

    const loadFolders = async () => {
        if (window.sampleDatabase) {
            const dbFolders = await window.sampleDatabase.getFolders();
            setFolders(buildFolderTree(dbFolders));
        }
    };

    const loadAllTags = async () => {
        if (window.sampleDatabase) {
            const tags = await window.sampleDatabase.getAllTags();
            setAllTags(tags);
        }
    };

    const buildFolderTree = (flatFolders) => {
        // Build hierarchical tree from flat folder list
        const folderMap = {};
        const rootFolders = [];

        flatFolders.forEach(folder => {
            folderMap[folder.id] = { ...folder, children: [] };
        });

        flatFolders.forEach(folder => {
            if (folder.parentId && folderMap[folder.parentId]) {
                folderMap[folder.parentId].children.push(folderMap[folder.id]);
            } else {
                rootFolders.push(folderMap[folder.id]);
            }
        });

        return rootFolders;
    };

    const toggleFolder = async (folder) => {
        const newExpandedFolders = new Set(expandedFolders);
        
        if (expandedFolders.has(folder.id)) {
            // Collapse
            newExpandedFolders.delete(folder.id);
            setExpandedFolders(newExpandedFolders);
            
            // If this was the current expanded folder, clear it
            if (currentExpandedFolder?.id === folder.id) {
                setCurrentExpandedFolder(null);
            }
        } else {
            // Expand
            newExpandedFolders.add(folder.id);
            setExpandedFolders(newExpandedFolders);
            
            // Set as current expanded folder
            setCurrentExpandedFolder(folder);
            
            // Load samples for this folder
            await loadSamplesForFolder(folder.id);
        }
    };

    const loadSamplesForFolder = async (folderId) => {
        if (window.sampleDatabase) {
            const folderSamples = await window.sampleDatabase.getSamplesByFolder(folderId);
            
            // Apply filters
            let filtered = folderSamples;
            
            if (searchQuery) {
                filtered = filtered.filter(s => 
                    s.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }
            
            if (filterTags.length > 0) {
                filtered = filtered.filter(s => 
                    filterTags.every(tag => s.tags?.includes(tag))
                );
            }
            
            setSamples(prev => ({
                ...prev,
                [folderId]: filtered
            }));
        }
    };

    const handleAddFolder = async () => {
        try {
            // Use File System Access API to select folder
            const dirHandle = await window.showDirectoryPicker();
            
            setShowImportModal(true);
            setImportProgress({
                status: 'scanning',
                currentFile: '',
                processedCount: 0,
                totalCount: 0,
                files: []
            });

            // Scan folder for audio files
            const audioFiles = [];
            const scanFolder = async (handle, path = '') => {
                for await (const entry of handle.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        if (file.type.startsWith('audio/') || 
                            /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name)) {
                            audioFiles.push({ name: file.name, path, type: file.type });
                            setImportProgress(prev => ({
                                ...prev,
                                files: [...audioFiles],
                                totalCount: audioFiles.length
                            }));
                        }
                    } else if (entry.kind === 'directory') {
                        await scanFolder(entry, `${path}/${entry.name}`);
                    }
                }
            };

            await scanFolder(dirHandle);

            // Process files
            setImportProgress(prev => ({ ...prev, status: 'processing' }));
            
            if (window.sampleDatabase) {
                for (let i = 0; i < audioFiles.length; i++) {
                    setImportProgress(prev => ({
                        ...prev,
                        currentFile: audioFiles[i].name,
                        processedCount: i
                    }));
                    
                    // Small delay to show progress
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                await window.sampleDatabase.addFolder(dirHandle, dirHandle.name);
                await loadFolders();

                setImportProgress(prev => ({
                    ...prev,
                    status: 'complete',
                    processedCount: audioFiles.length
                }));
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error adding folder:', err);
                setImportProgress(prev => ({ ...prev, status: 'error' }));
            } else {
                setShowImportModal(false);
            }
        }
    };

    // Close modal handler
    useEffect(() => {
        window.closeImportModal = () => {
            setShowImportModal(false);
            setImportProgress(null);
        };
        return () => {
            delete window.closeImportModal;
        };
    }, []);

    const handleRemoveFolder = async (folderId) => {
        if (confirm(t('browser.removeFolderLibraryConfirm'))) {
            if (window.sampleDatabase) {
                await window.sampleDatabase.removeFolder(folderId);
                await loadFolders();
                
                // Clear from samples state
                setSamples(prev => {
                    const newSamples = { ...prev };
                    delete newSamples[folderId];
                    return newSamples;
                });
                
                // Clear if it was current
                if (currentExpandedFolder?.id === folderId) {
                    setCurrentExpandedFolder(null);
                }
            }
        }
    };

    const handleSampleDragStart = (e, sample) => {
        e.dataTransfer.setData('application/json', JSON.stringify(sample));
        e.dataTransfer.effectAllowed = 'copy';
        
        if (onSampleDragStart) {
            onSampleDragStart(sample);
        }
    };

    const handleTagFilter = (tag) => {
        setFilterTags(prev => {
            if (prev.includes(tag)) {
                return prev.filter(t => t !== tag);
            } else {
                return [...prev, tag];
            }
        });
    };

    const renderFolder = (folder, depth = 0) => {
        const isExpanded = expandedFolders.has(folder.id);
        const isCurrent = currentExpandedFolder?.id === folder.id;
        const folderSamples = samples[folder.id] || [];
        const hasChildren = folder.children && folder.children.length > 0;

        return (
            <div key={folder.id} style={{ marginLeft: `${depth * 12}px` }}>
                {/* Folder Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 6px',
                        backgroundColor: isCurrent ? theme.highlight : 'transparent',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        marginBottom: '2px',
                        transition: 'background-color 0.2s'
                    }}
                    onClick={() => toggleFolder(folder)}
                    onMouseEnter={(e) => {
                        if (!isCurrent) e.currentTarget.style.backgroundColor = theme.cellInactive;
                    }}
                    onMouseLeave={(e) => {
                        if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <span style={{ 
                        fontSize: '10px', 
                        marginRight: '4px',
                        color: theme.textDim,
                        width: '12px',
                        textAlign: 'center'
                    }}>
                        {hasChildren || folderSamples.length > 0 ? (isExpanded ? '▼' : '▶') : '·'}
                    </span>
                    <span style={{ 
                        fontSize: '10px',
                        color: isCurrent ? '#fff' : theme.text,
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        📁 {folder.name}
                    </span>
                    {folderSamples.length > 0 && (
                        <span style={{
                            fontSize: '9px',
                            color: theme.accent,
                            backgroundColor: theme.bg,
                            padding: '1px 4px',
                            borderRadius: '2px',
                            marginLeft: '4px'
                        }}>
                            {folderSamples.length}
                        </span>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFolder(folder.id);
                        }}
                        style={{
                            marginLeft: '4px',
                            padding: '1px 4px',
                            fontSize: '9px',
                            backgroundColor: 'transparent',
                            color: theme.danger,
                            border: 'none',
                            cursor: 'pointer',
                            opacity: 0.6
                        }}
                        title={t('browser.removeFolder')}
                    >
                        ✕
                    </button>
                </div>

                {/* Samples (only if expanded) */}
                {isExpanded && folderSamples.length > 0 && (
                    <div style={{ marginLeft: '16px', marginBottom: '4px' }}>
                        {folderSamples.map(sample => (
                            <div
                                key={sample.id}
                                draggable
                                onDragStart={(e) => handleSampleDragStart(e, sample)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '3px 6px',
                                    marginBottom: '2px',
                                    backgroundColor: theme.bg,
                                    borderRadius: '2px',
                                    cursor: 'grab',
                                    fontSize: '9px',
                                    color: theme.textDim,
                                    border: `1px solid ${theme.panelBorder}`,
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.cellBeat;
                                    e.currentTarget.style.borderColor = theme.accent;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.bg;
                                    e.currentTarget.style.borderColor = theme.panelBorder;
                                }}
                            >
                                <span style={{ marginRight: '4px' }}>🎵</span>
                                <span style={{ 
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {sample.name}
                                </span>
                    {sample.bpm && (
                        <span style={{
                            fontSize: '8px',
                            color: theme.highlight,
                            backgroundColor: theme.cellInactive,
                            padding: '1px 4px',
                            borderRadius: '2px',
                            marginLeft: '4px'
                        }}>
                            {sample.bpm} BPM
                        </span>
                    )}
                    {sample.tags && sample.tags.length > 0 && (
                        <span style={{
                            fontSize: '8px',
                            color: theme.accent,
                            marginLeft: '4px'
                        }}>
                            {sample.tags.slice(0, 2).join(', ')}
                        </span>
                    )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Child Folders */}
                {isExpanded && hasChildren && (
                    <div>
                        {folder.children.map(child => renderFolder(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.panel,
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '10px',
                borderBottom: `1px solid ${theme.panelBorder}`,
                backgroundColor: theme.bg
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                }}>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: theme.accent
                    }}>
                        SAMPLE LIBRARY
                    </div>
                    <button
                        onClick={handleAddFolder}
                        style={{
                            padding: '4px 8px',
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

                {/* Search */}
                <input
                    type="text"
                    placeholder={t('browser.searchSamples')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '6px 8px',
                        backgroundColor: theme.gridBg,
                        color: theme.text,
                        border: `1px solid ${theme.panelBorder}`,
                        borderRadius: '3px',
                        fontSize: '10px',
                        outline: 'none'
                    }}
                />

                {/* Tag Filters */}
                {allTags.length > 0 && (
                    <div style={{
                        marginTop: '6px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px'
                    }}>
                        {allTags.slice(0, 8).map(tag => (
                            <button
                                key={tag}
                                onClick={() => handleTagFilter(tag)}
                                style={{
                                    padding: '2px 6px',
                                    fontSize: '9px',
                                    backgroundColor: filterTags.includes(tag) ? theme.accent : theme.cellInactive,
                                    color: filterTags.includes(tag) ? theme.accentText : theme.textDim,
                                    border: 'none',
                                    borderRadius: '2px',
                                    cursor: 'pointer'
                                }}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Current Folder Indicator */}
            {currentExpandedFolder && (
                <div style={{
                    padding: '6px 10px',
                    backgroundColor: theme.highlight,
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    borderBottom: `1px solid ${theme.panelBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span>🎯 ACTIVE:</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentExpandedFolder.name}
                    </span>
                    <span style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        padding: '2px 6px',
                        borderRadius: '2px'
                    }}>
                        {samples[currentExpandedFolder.id]?.length || 0} samples
                    </span>
                </div>
            )}

            {/* Folder Tree */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px'
            }}>
                {folders.length === 0 ? (
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: theme.textMuted,
                        fontSize: '10px',
                        lineHeight: '1.6'
                    }}>
                        <div style={{ fontSize: '24px', marginBottom: '10px' }}>📂</div>
                        <div>No folders added yet</div>
                        <div style={{ marginTop: '8px', fontSize: '9px' }}>
                            Click "+ ADD FOLDER" to import samples
                        </div>
                    </div>
                ) : (
                    folders.map(folder => renderFolder(folder))
                )}
            </div>

            {/* Footer Info */}
            <div style={{
                padding: '8px 10px',
                borderTop: `1px solid ${theme.panelBorder}`,
                backgroundColor: theme.bg,
                fontSize: '9px',
                color: theme.textMuted,
                lineHeight: '1.4'
            }}>
                💡 Expand a folder to enable randomization • Drag samples to drum slots
            </div>

            {/* Import Progress Modal */}
            <ImportProgressModal 
                isOpen={showImportModal}
                progress={importProgress}
                theme={theme}
            />
        </div>
    );
};

export default FolderTreeBrowser;
