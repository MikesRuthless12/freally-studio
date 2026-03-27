import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from './i18n/I18nContext';
import { isElectron, getPlatform } from './electronBridge';

const RECENT_PROJECTS_KEY = 'wavloom_recent_projects';
const isMac = getPlatform() === 'darwin';
const MOD = isMac ? '⌘' : 'Ctrl';
const MAX_RECENT = 10;

/**
 * Read recent projects list from localStorage.
 */
function getRecentProjects() {
    try {
        const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

/**
 * Save recent projects list to localStorage.
 */
function saveRecentProjects(list) {
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(list));
}

/**
 * Add a project to the recent list (deduplicates by path, caps at MAX_RECENT).
 */
export function addRecentProject(name, filePath) {
    const list = getRecentProjects().filter(p => p.path !== filePath);
    list.unshift({ name, path: filePath, timestamp: Date.now() });
    saveRecentProjects(list.slice(0, MAX_RECENT));
}

/**
 * MenuToolbar — traditional desktop-style menu bar.
 *
 * Menus: File, Edit, View, Generate, Help
 * Each item shows its keyboard shortcut.
 * File > Recent Projects shows up to 10 recent .wlz files with clear option.
 */
const MenuToolbar = ({
    isDark,
    ac,
    hexToRgba,
    // File actions
    onNewProject,
    onSaveProject,
    onExportAudio,
    onLoadProject,
    onShowSettings,
    // Edit actions
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    // View actions
    onToggleSidebar,
    isBrowserVisible,
    onToggleFullscreen,
    onSetActiveTab,
    activeTab,
    onToggleTheme,
    themeName,
    // Generate actions
    onGlobalGenerate,
    onTapTempo,
    onToggleMetronome,
    metronomeEnabled,
    // State for disabled conditions
    isPlaying,
    hasPatterns,
    // Help actions
    onShowShortcuts,
    onShowTour,
}) => {
    const { t } = useTranslation();
    const [openMenu, setOpenMenu] = useState(null);
    const [recentSub, setRecentSub] = useState(false);
    const [recentProjects, setRecentProjects] = useState([]);
    const barRef = useRef(null);

    // Refresh recent list whenever File menu opens
    useEffect(() => {
        if (openMenu === 'file') {
            const list = getRecentProjects();
            // In Electron, validate paths exist and prune stale entries
            if (isElectron() && window.electronAPI?.fs?.exists) {
                Promise.all(list.map(async (p) => {
                    const exists = await window.electronAPI.fs.exists(p.path);
                    return exists ? p : null;
                })).then(results => {
                    const valid = results.filter(Boolean);
                    if (valid.length !== list.length) saveRecentProjects(valid);
                    setRecentProjects(valid);
                });
            } else {
                setRecentProjects(list);
            }
        }
    }, [openMenu]);

    // Close menu when clicking outside
    useEffect(() => {
        if (!openMenu) return;
        const handleClick = (e) => {
            if (barRef.current && !barRef.current.contains(e.target)) {
                setOpenMenu(null);
                setRecentSub(false);
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [openMenu]);

    // Close menus on Escape
    useEffect(() => {
        if (!openMenu) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') { setOpenMenu(null); setRecentSub(false); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [openMenu]);

    const closeAll = useCallback(() => { setOpenMenu(null); setRecentSub(false); }, []);

    // Dispatch a synthetic keyboard shortcut so the active piano roll / editor handles it
    const dispatchShortcut = useCallback((key, ctrlKey = false, shiftKey = false) => {
        closeAll();
        setTimeout(() => {
            const code = key === 'Delete' ? 'Delete' : `Key${key.toUpperCase()}`;
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key, code, ctrlKey, shiftKey, metaKey: false,
                bubbles: true, cancelable: true,
            }));
        }, 16);
    }, [closeAll]);

    const handleOpenProject = useCallback(async () => {
        closeAll();
        if (isElectron() && window.electronAPI?.fs?.showOpenDialog) {
            const result = await window.electronAPI.fs.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'WavLoom Project', extensions: ['wlz'] }]
            });
            if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const { data, error } = await window.electronAPI.fs.readFile(filePath);
                if (!error && data) {
                    const fileName = filePath.split(/[\\/]/).pop();
                    const blob = new Blob([data]);
                    const file = new File([blob], fileName, { type: 'application/zip' });
                    onLoadProject(file, filePath);
                }
            }
        } else {
            document.getElementById('project-load-input')?.click();
        }
    }, [onLoadProject, closeAll]);

    const handleOpenRecent = useCallback(async (project) => {
        closeAll();
        if (isElectron() && window.electronAPI?.fs?.readFile) {
            const { data, error } = await window.electronAPI.fs.readFile(project.path);
            if (!error && data) {
                const fileName = project.path.split(/[\\/]/).pop();
                const blob = new Blob([data]);
                const file = new File([blob], fileName, { type: 'application/zip' });
                onLoadProject(file, project.path);
            }
        }
    }, [onLoadProject, closeAll]);

    const handleClearRecent = useCallback(() => {
        saveRecentProjects([]);
        setRecentProjects([]);
    }, []);

    // ---- Styles ----
    const barBg = isDark ? 'rgba(18, 18, 24, 0.95)' : 'rgba(248, 248, 252, 0.98)';
    const barBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    const menuBg = isDark ? '#1a1a28' : '#fff';
    const menuBorder = isDark ? '#333' : '#ddd';
    const hoverBg = isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.1);
    const textColor = isDark ? '#ccc' : '#333';
    const textMuted = isDark ? '#666' : '#999';
    const disabledColor = isDark ? '#444' : '#bbb';
    const separatorColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

    const menuBtnStyle = (menuId) => ({
        padding: '3px 10px',
        background: openMenu === menuId ? hoverBg : 'transparent',
        border: 'none',
        borderRadius: '3px',
        color: openMenu === menuId ? ac : textColor,
        fontSize: '12px',
        cursor: 'pointer',
        fontWeight: openMenu === menuId ? 600 : 400,
        transition: 'all 0.12s',
        position: 'relative',
        whiteSpace: 'nowrap',
    });

    const dropdownStyle = {
        position: 'absolute',
        top: '100%',
        left: 0,
        minWidth: '240px',
        background: menuBg,
        border: `1px solid ${menuBorder}`,
        borderRadius: '6px',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.15)',
        padding: '4px 0',
        zIndex: 10000,
        marginTop: '2px',
    };

    const itemStyle = (disabled) => ({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 16px',
        fontSize: '12px',
        color: disabled ? disabledColor : textColor,
        cursor: disabled ? 'default' : 'pointer',
        background: 'transparent',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        transition: 'background 0.1s',
        gap: '24px',
        whiteSpace: 'nowrap',
    });

    const shortcutStyle = {
        fontSize: '11px',
        color: textMuted,
        marginLeft: 'auto',
        fontFamily: 'monospace',
        opacity: 0.8,
    };

    const separatorEl = <div style={{ height: '1px', background: separatorColor, margin: '4px 8px' }} />;

    const handleItemHover = (e) => { e.currentTarget.style.background = hoverBg; };
    const handleItemLeave = (e) => { e.currentTarget.style.background = 'transparent'; };

    const MenuItem = ({ label, shortcut, onClick, disabled, checked }) => (
        <button
            style={itemStyle(disabled)}
            onClick={disabled ? undefined : () => { onClick?.(); closeAll(); }}
            onMouseEnter={disabled ? undefined : handleItemHover}
            onMouseLeave={handleItemLeave}
            disabled={disabled}
        >
            <span>{checked !== undefined ? (checked ? '\u2713 ' : '\u2003 ') : ''}{label}</span>
            {shortcut && <span style={shortcutStyle}>{shortcut}</span>}
        </button>
    );

    const toggleMenu = (menuId) => {
        setOpenMenu(prev => prev === menuId ? null : menuId);
        setRecentSub(false);
    };

    const handleMenuHover = (menuId) => {
        if (openMenu && openMenu !== menuId) {
            setOpenMenu(menuId);
            setRecentSub(false);
        }
    };

    const tabs = [
        { id: 'drums', label: t('menu.viewDrums'), key: '1' },
        { id: 'chords', label: t('menu.viewChords'), key: '2' },
        { id: 'melody', label: t('menu.viewMelody'), key: '3' },
        { id: 'bass', label: t('menu.viewBass'), key: '4' },
        { id: 'lyrics', label: t('menu.viewLyrics'), key: '5' },
        { id: 'mixer', label: t('menu.viewMixer'), key: '6' },
        { id: 'arrange', label: t('menu.viewArrange'), key: '7' },
        { id: 'drumsynth', label: t('menu.viewDrumSynth'), key: '8' },
        { id: 'instrsynth', label: t('menu.viewInstSynth'), key: '9' },
    ];

    return (
        <div
            ref={barRef}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: '0 12px',
                height: '28px',
                background: barBg,
                borderBottom: `1px solid ${barBorder}`,
                flexShrink: 0,
                WebkitAppRegion: 'no-drag',
                zIndex: 200,
                position: 'relative',
            }}
        >
            {/* ---- FILE ---- */}
            <div style={{ position: 'relative' }}>
                <button
                    style={menuBtnStyle('file')}
                    onClick={() => toggleMenu('file')}
                    onMouseEnter={() => handleMenuHover('file')}
                >
                    {t('menu.file')}
                </button>
                {openMenu === 'file' && (
                    <div style={dropdownStyle}>
                        <MenuItem label={t('menu.newProject')} shortcut={`${MOD}+N`} onClick={onNewProject} />
                        <MenuItem label={t('menu.openProject')} shortcut={`${MOD}+O`} onClick={handleOpenProject} />

                        {/* Recent Projects submenu */}
                        <div
                            style={{ position: 'relative' }}
                            onMouseEnter={() => setRecentSub(true)}
                            onMouseLeave={() => setRecentSub(false)}
                        >
                            <button
                                style={{ ...itemStyle(false), justifyContent: 'space-between' }}
                                onMouseEnter={handleItemHover}
                                onMouseLeave={handleItemLeave}
                            >
                                <span>{t('menu.recentProjects')}</span>
                                <span style={{ fontSize: '10px', color: textMuted }}>&#9656;</span>
                            </button>
                            {recentSub && (
                                <div style={{
                                    ...dropdownStyle,
                                    position: 'absolute',
                                    top: '-4px',
                                    left: '100%',
                                    minWidth: '280px',
                                }}>
                                    <button
                                        style={itemStyle(recentProjects.length === 0)}
                                        onClick={recentProjects.length > 0 ? handleClearRecent : undefined}
                                        onMouseEnter={recentProjects.length > 0 ? handleItemHover : undefined}
                                        onMouseLeave={handleItemLeave}
                                    >
                                        <span>{t('menu.clearRecentProjects')}</span>
                                    </button>
                                    {recentProjects.length > 0 && separatorEl}
                                    {recentProjects.length === 0 && (
                                        <div style={{ padding: '6px 16px', fontSize: '11px', color: textMuted, fontStyle: 'italic' }}>
                                            {t('menu.noRecentProjects')}
                                        </div>
                                    )}
                                    {recentProjects.map((p, i) => (
                                        <button
                                            key={i}
                                            style={itemStyle(false)}
                                            onClick={() => handleOpenRecent(p)}
                                            onMouseEnter={handleItemHover}
                                            onMouseLeave={handleItemLeave}
                                            title={p.path}
                                        >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
                                                {p.name || p.path.split(/[\\/]/).pop()}
                                            </span>
                                            <span style={{ fontSize: '10px', color: textMuted }}>
                                                {new Date(p.timestamp).toLocaleDateString()}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {separatorEl}
                        <MenuItem label={t('menu.saveProject')} shortcut={`${MOD}+S`} onClick={onSaveProject} />
                        <MenuItem label={t('menu.exportAudio')} shortcut={`${MOD}+E`} onClick={onExportAudio} disabled={!hasPatterns} />
                        {separatorEl}
                        <MenuItem label={t('menu.settings')} onClick={onShowSettings} />
                        {isElectron() && (
                            <>
                                {separatorEl}
                                <MenuItem label={isMac ? t('menu.quit') : t('menu.exit')} shortcut={isMac ? '⌘+Q' : 'Alt+F4'} onClick={() => window.electronAPI?.window?.close()} />
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ---- EDIT ---- */}
            <div style={{ position: 'relative' }}>
                <button
                    style={menuBtnStyle('edit')}
                    onClick={() => toggleMenu('edit')}
                    onMouseEnter={() => handleMenuHover('edit')}
                >
                    {t('menu.edit')}
                </button>
                {openMenu === 'edit' && (
                    <div style={dropdownStyle}>
                        <MenuItem label={t('menu.undo')} shortcut={`${MOD}+Z`} onClick={onUndo} disabled={!canUndo} />
                        <MenuItem label={t('menu.redo')} shortcut={`${MOD}+Shift+Z`} onClick={onRedo} disabled={!canRedo} />
                        {separatorEl}
                        <MenuItem label={t('menu.selectAll')} shortcut={`${MOD}+A`} onClick={() => dispatchShortcut('a', true)} />
                        <MenuItem label={t('menu.cut')} shortcut={`${MOD}+X`} onClick={() => dispatchShortcut('x', true)} />
                        <MenuItem label={t('menu.copy')} shortcut={`${MOD}+C`} onClick={() => dispatchShortcut('c', true)} />
                        <MenuItem label={t('menu.paste')} shortcut={`${MOD}+V`} onClick={() => dispatchShortcut('v', true)} />
                        {separatorEl}
                        <MenuItem label={t('menu.duplicate')} shortcut={`${MOD}+D`} onClick={() => dispatchShortcut('d', true)} />
                        <MenuItem label={t('menu.delete')} shortcut="Del" onClick={() => dispatchShortcut('Delete')} />
                    </div>
                )}
            </div>

            {/* ---- VIEW ---- */}
            <div style={{ position: 'relative' }}>
                <button
                    style={menuBtnStyle('view')}
                    onClick={() => toggleMenu('view')}
                    onMouseEnter={() => handleMenuHover('view')}
                >
                    {t('menu.view')}
                </button>
                {openMenu === 'view' && (
                    <div style={dropdownStyle}>
                        <MenuItem
                            label={isBrowserVisible ? t('menu.hideSidebar') : t('menu.showSidebar')}
                            onClick={onToggleSidebar}
                        />
                        <MenuItem label={t('menu.toggleFullscreen')} shortcut="F" onClick={onToggleFullscreen} />
                        <MenuItem
                            label={themeName === 'dark' ? t('menu.switchToLight') : t('menu.switchToDark')}
                            onClick={onToggleTheme}
                        />
                        {separatorEl}
                        {tabs.map(tab => (
                            <MenuItem
                                key={tab.id}
                                label={tab.label}
                                shortcut={tab.key}
                                onClick={() => onSetActiveTab(tab.id)}
                                checked={activeTab === tab.id}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ---- GENERATE ---- */}
            <div style={{ position: 'relative' }}>
                <button
                    style={menuBtnStyle('generate')}
                    onClick={() => toggleMenu('generate')}
                    onMouseEnter={() => handleMenuHover('generate')}
                >
                    {t('menu.generate')}
                </button>
                {openMenu === 'generate' && (
                    <div style={dropdownStyle}>
                        <MenuItem label={t('menu.globalGenerate')} shortcut="G" onClick={onGlobalGenerate} disabled={isPlaying} />
                        {separatorEl}
                        <MenuItem label={t('menu.tapTempo')} shortcut="T" onClick={onTapTempo} />
                        <MenuItem label={t('menu.toggleMetronome')} shortcut="K" onClick={onToggleMetronome} checked={metronomeEnabled} />
                    </div>
                )}
            </div>

            {/* ---- HELP ---- */}
            <div style={{ position: 'relative' }}>
                <button
                    style={menuBtnStyle('help')}
                    onClick={() => toggleMenu('help')}
                    onMouseEnter={() => handleMenuHover('help')}
                >
                    {t('menu.help')}
                </button>
                {openMenu === 'help' && (
                    <div style={dropdownStyle}>
                        <MenuItem label={t('menu.keyboardShortcuts')} shortcut="?" onClick={onShowShortcuts} />
                        <MenuItem label={t('menu.guidedTour')} onClick={onShowTour} />
                        {separatorEl}
                        <MenuItem label={t('menu.aboutWavLoom')} onClick={() => {
                            closeAll();
                            alert('WavLoom Studio\nBrowser-based DAW\nhttps://wavloom.com');
                        }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MenuToolbar;
