import React from 'react';

const ImportProgressModal = ({ isOpen, progress, theme }) => {
    if (!isOpen) return null;

    const { 
        currentFile = '', 
        processedCount = 0, 
        totalCount = 0, 
        files = [],
        status = 'scanning' // 'scanning', 'processing', 'complete', 'error'
    } = progress;

    const percentage = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: theme.panel,
                border: `2px solid ${theme.accent}`,
                borderRadius: '8px',
                padding: '24px',
                minWidth: '500px',
                maxWidth: '700px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        fontSize: '32px',
                        animation: status === 'processing' ? 'spin 2s linear infinite' : 'none'
                    }}>
                        {status === 'scanning' && '🔍'}
                        {status === 'processing' && '⚙️'}
                        {status === 'complete' && '✅'}
                        {status === 'error' && '❌'}
                    </div>
                    <div>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: theme.accent
                        }}>
                            {status === 'scanning' && 'Scanning Folder...'}
                            {status === 'processing' && 'Importing Samples'}
                            {status === 'complete' && 'Import Complete!'}
                            {status === 'error' && 'Import Error'}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: theme.textMuted,
                            marginTop: '4px'
                        }}>
                            {processedCount} of {totalCount} files processed
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: theme.bg,
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '16px'
                }}>
                    <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: theme.accent,
                        transition: 'width 0.3s ease',
                        boxShadow: `0 0 10px ${theme.accent}`
                    }} />
                </div>

                {/* Current File */}
                {currentFile && (
                    <div style={{
                        padding: '10px 12px',
                        backgroundColor: theme.bg,
                        borderRadius: '4px',
                        marginBottom: '16px',
                        border: `1px solid ${theme.panelBorder}`
                    }}>
                        <div style={{
                            fontSize: '10px',
                            color: theme.textMuted,
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Currently Processing
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: theme.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontFamily: 'monospace'
                        }}>
                            📄 {currentFile}
                        </div>
                    </div>
                )}

                {/* File List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    backgroundColor: theme.bg,
                    borderRadius: '4px',
                    padding: '12px',
                    border: `1px solid ${theme.panelBorder}`,
                    maxHeight: '300px'
                }}>
                    <div style={{
                        fontSize: '10px',
                        color: theme.textMuted,
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontWeight: 'bold'
                    }}>
                        Files ({files.length})
                    </div>
                    {files.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            color: theme.textMuted,
                            fontSize: '11px',
                            padding: '20px'
                        }}>
                            Scanning for audio files...
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {files.map((file, idx) => {
                                const isProcessed = idx < processedCount;
                                const isCurrent = idx === processedCount;
                                
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '6px 8px',
                                            backgroundColor: isCurrent ? theme.highlight : 'transparent',
                                            borderRadius: '3px',
                                            fontSize: '11px',
                                            color: isProcessed ? theme.textDim : theme.text,
                                            transition: 'all 0.2s',
                                            opacity: isProcessed ? 0.6 : 1
                                        }}
                                    >
                                        <span style={{ fontSize: '14px' }}>
                                            {isProcessed ? '✓' : isCurrent ? '⏳' : '⏺'}
                                        </span>
                                        <span style={{
                                            flex: 1,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            textDecoration: isProcessed ? 'line-through' : 'none'
                                        }}>
                                            {file.name}
                                        </span>
                                        <span style={{
                                            fontSize: '9px',
                                            color: theme.textMuted,
                                            backgroundColor: theme.cellInactive,
                                            padding: '2px 6px',
                                            borderRadius: '2px'
                                        }}>
                                            {file.type || 'audio'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Stats Footer */}
                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: theme.bg,
                    borderRadius: '4px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    border: `1px solid ${theme.panelBorder}`
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: theme.accent
                        }}>
                            {totalCount}
                        </div>
                        <div style={{
                            fontSize: '9px',
                            color: theme.textMuted,
                            marginTop: '2px'
                        }}>
                            Total Files
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: theme.highlight
                        }}>
                            {processedCount}
                        </div>
                        <div style={{
                            fontSize: '9px',
                            color: theme.textMuted,
                            marginTop: '2px'
                        }}>
                            Processed
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: theme.text
                        }}>
                            {percentage}%
                        </div>
                        <div style={{
                            fontSize: '9px',
                            color: theme.textMuted,
                            marginTop: '2px'
                        }}>
                            Complete
                        </div>
                    </div>
                </div>

                {/* Close Button (only show when complete) */}
                {status === 'complete' && (
                    <button
                        onClick={() => window.closeImportModal?.()}
                        style={{
                            marginTop: '16px',
                            padding: '10px',
                            backgroundColor: theme.accent,
                            color: theme.accentText,
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }}
                    >
                        CLOSE
                    </button>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ImportProgressModal;
