/**
 * Electron Bridge
 *
 * Provides unified APIs that work in both browser and Electron environments.
 * When running in Electron, delegates to native IPC. When running in browser,
 * falls back to Web APIs (showDirectoryPicker, showOpenFilePicker, etc.).
 */

export function isElectron() {
    return !!(window.electronAPI && window.electronAPI.isElectron);
}

export function getPlatform() {
    if (isElectron()) return window.electronAPI.platform;
    return navigator.platform.includes('Win') ? 'win32'
        : navigator.platform.includes('Mac') ? 'darwin'
        : 'linux';
}

/**
 * Show a folder picker dialog.
 * Returns { path: string } or null if cancelled.
 */
export async function showFolderPicker(title = 'Select Folder') {
    if (isElectron()) {
        const result = await window.electronAPI.fs.showOpenDialog({
            title,
            properties: ['openDirectory'],
        });
        if (result.canceled || !result.filePaths.length) return null;
        return { path: result.filePaths[0] };
    }

    // Browser fallback: showDirectoryPicker
    if (typeof window.showDirectoryPicker === 'function') {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'read' });
            return { path: handle.name, handle };
        } catch (err) {
            if (err.name === 'AbortError') return null;
            throw err;
        }
    }

    return null;
}

/**
 * Show a file open dialog.
 * Returns { paths: string[], files: File[] } or null if cancelled.
 *
 * @param {Object} options
 * @param {string} options.title - Dialog title
 * @param {Array<{name: string, extensions: string[]}>} options.filters - File type filters
 * @param {boolean} options.multiple - Allow multiple selection
 */
export async function showOpenFilePicker(options = {}) {
    const { title = 'Open File', filters = [], multiple = false } = options;

    if (isElectron()) {
        const properties = ['openFile'];
        if (multiple) properties.push('multiSelections');

        const result = await window.electronAPI.fs.showOpenDialog({
            title,
            filters: filters.length ? filters : [{ name: 'All Files', extensions: ['*'] }],
            properties,
        });
        if (result.canceled || !result.filePaths.length) return null;
        return { paths: result.filePaths };
    }

    // Browser fallback: showOpenFilePicker or <input type="file">
    if (typeof window.showOpenFilePicker === 'function') {
        try {
            const types = filters.map(f => ({
                description: f.name,
                accept: { '*/*': f.extensions.map(e => `.${e}`) },
            }));
            const handles = await window.showOpenFilePicker({
                multiple,
                types: types.length ? types : undefined,
            });
            const files = await Promise.all(handles.map(h => h.getFile()));
            return { paths: files.map(f => f.name), files };
        } catch (err) {
            if (err.name === 'AbortError') return null;
            throw err;
        }
    }

    // Final fallback: hidden input element
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = multiple;
        if (filters.length) {
            input.accept = filters.flatMap(f => f.extensions.map(e => `.${e}`)).join(',');
        }
        input.onchange = () => {
            if (!input.files || !input.files.length) {
                resolve(null);
                return;
            }
            const files = Array.from(input.files);
            resolve({ paths: files.map(f => f.name), files });
        };
        input.click();
    });
}

/**
 * Show a save file dialog.
 * Returns { path: string } or null if cancelled.
 */
export async function showSaveFilePicker(options = {}) {
    const { title = 'Save File', defaultPath = '', filters = [] } = options;

    if (isElectron()) {
        const result = await window.electronAPI.fs.showSaveDialog({
            title,
            defaultPath,
            filters: filters.length ? filters : [{ name: 'All Files', extensions: ['*'] }],
        });
        if (result.canceled || !result.filePath) return null;
        return { path: result.filePath };
    }

    // Browser fallback: showSaveFilePicker
    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const types = filters.map(f => ({
                description: f.name,
                accept: { '*/*': f.extensions.map(e => `.${e}`) },
            }));
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultPath,
                types: types.length ? types : undefined,
            });
            return { path: handle.name, handle };
        } catch (err) {
            if (err.name === 'AbortError') return null;
            throw err;
        }
    }

    return null;
}

/**
 * Read a file by path (Electron only).
 * In browser, use the File object directly.
 */
export async function readFile(filePath) {
    if (!isElectron()) throw new Error('readFile requires Electron');
    const result = await window.electronAPI.fs.readFile(filePath);
    if (result.error) throw new Error(result.error);
    return new Uint8Array(result.data);
}

/**
 * Write data to a file by path (Electron only).
 * In browser, use download or File System Access API.
 */
export async function writeFile(filePath, data) {
    if (!isElectron()) throw new Error('writeFile requires Electron');
    const result = await window.electronAPI.fs.writeFile(filePath, data);
    if (result.error) throw new Error(result.error);
}

/**
 * Read directory contents (Electron only).
 */
export async function readDir(dirPath) {
    if (!isElectron()) throw new Error('readDir requires Electron');
    const result = await window.electronAPI.fs.readDir(dirPath);
    if (result.error) throw new Error(result.error);
    return result.entries;
}

/**
 * Check if a file/directory exists (Electron only).
 */
export async function fileExists(filePath) {
    if (!isElectron()) return false;
    return window.electronAPI.fs.exists(filePath);
}

/**
 * Get file stats (Electron only).
 */
export async function fileStat(filePath) {
    if (!isElectron()) throw new Error('fileStat requires Electron');
    const result = await window.electronAPI.fs.stat(filePath);
    if (result.error) throw new Error(result.error);
    return result;
}

/**
 * Open a URL in the system default browser.
 */
export async function openExternal(url) {
    if (isElectron()) {
        return window.electronAPI.shell.openExternal(url);
    }
    window.open(url, '_blank');
}

/**
 * Show a file in the system file manager.
 */
export async function showInFolder(filePath) {
    if (!isElectron()) return;
    return window.electronAPI.shell.showItemInFolder(filePath);
}
