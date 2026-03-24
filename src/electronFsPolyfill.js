/**
 * Electron File System Polyfill
 *
 * Patches window.showDirectoryPicker and window.showSaveFilePicker in Electron
 * so that existing code using the browser File System Access API works
 * transparently with native Electron dialogs.
 *
 * Call installElectronFsPolyfill() once at app startup (in main.jsx).
 * In browser mode, this is a no-op.
 */

import { ElectronDirectoryHandle, ElectronFileHandle } from './electronFsHandles.js';

/**
 * Install the polyfill. No-op if not running in Electron.
 */
export function installElectronFsPolyfill() {
    if (!window.electronAPI?.isElectron) {
        return; // Browser mode — do nothing
    }

    // --- Patch showDirectoryPicker ---
    window.showDirectoryPicker = async (options = {}) => {
        const result = await window.electronAPI.fs.showOpenDialog({
            properties: ['openDirectory'],
            title: options.id ? `Select Folder (${options.id})` : 'Select Folder',
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            // Match the browser behavior: throw AbortError when user cancels
            throw new DOMException('The user aborted a request.', 'AbortError');
        }

        const dirPath = result.filePaths[0];
        // Normalize backslashes to forward slashes for consistency
        const normalized = dirPath.replace(/\\/g, '/');
        const name = normalized.split('/').pop();

        return new ElectronDirectoryHandle(name, normalized);
    };

    // --- Patch showSaveFilePicker ---
    window.showSaveFilePicker = async (options = {}) => {
        const dialogOptions = {
            title: options.suggestedName ? `Save ${options.suggestedName}` : 'Save File',
        };

        // Map the types option to Electron's filters format
        if (options.types && options.types.length > 0) {
            dialogOptions.filters = options.types.map(t => {
                const extensions = [];
                if (t.accept) {
                    for (const exts of Object.values(t.accept)) {
                        for (const ext of (Array.isArray(exts) ? exts : [exts])) {
                            extensions.push(ext.replace(/^\./, ''));
                        }
                    }
                }
                return {
                    name: t.description || 'File',
                    extensions,
                };
            });
        }

        if (options.suggestedName) {
            dialogOptions.defaultPath = options.suggestedName;
        }

        const result = await window.electronAPI.fs.showSaveDialog(dialogOptions);

        if (result.canceled || !result.filePath) {
            throw new DOMException('The user aborted a request.', 'AbortError');
        }

        const filePath = result.filePath.replace(/\\/g, '/');
        const name = filePath.split('/').pop();

        return new ElectronFileHandle(name, filePath);
    };

    // --- Patch showOpenFilePicker ---
    window.showOpenFilePicker = async (options = {}) => {
        const dialogOptions = {
            properties: ['openFile'],
            title: 'Open File',
        };

        if (options.multiple) {
            dialogOptions.properties.push('multiSelections');
        }

        if (options.types && options.types.length > 0) {
            dialogOptions.filters = options.types.map(t => {
                const extensions = [];
                if (t.accept) {
                    for (const exts of Object.values(t.accept)) {
                        for (const ext of (Array.isArray(exts) ? exts : [exts])) {
                            extensions.push(ext.replace(/^\./, ''));
                        }
                    }
                }
                return {
                    name: t.description || 'File',
                    extensions,
                };
            });
        }

        const result = await window.electronAPI.fs.showOpenDialog(dialogOptions);

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            throw new DOMException('The user aborted a request.', 'AbortError');
        }

        return result.filePaths.map(fp => {
            const normalized = fp.replace(/\\/g, '/');
            const name = normalized.split('/').pop();
            return new ElectronFileHandle(name, normalized);
        });
    };
}
