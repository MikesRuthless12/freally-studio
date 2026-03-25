/**
 * Get a File object from a browser item — works for both File System Access API
 * handles and Electron native paths (where items have nativePath but no handle).
 */
export const getFileFromItem = async (item) => {
    // Handle-based (File System Access API / virtual handle)
    if (item.handle && typeof item.handle.getFile === 'function') {
        return item.handle.getFile();
    }
    // Electron native path
    if (item.nativePath && window.electronAPI?.fs?.readFile) {
        const result = await window.electronAPI.fs.readFile(item.nativePath);
        if (result.error) throw new Error(result.error);
        const ext = (item.name || '').split('.').pop().toLowerCase();
        const mimeMap = {
            wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg',
            flac: 'audio/flac', aiff: 'audio/aiff', aif: 'audio/aiff',
            mid: 'audio/midi', midi: 'audio/midi',
        };
        const mime = mimeMap[ext] || 'application/octet-stream';
        return new File([result.data], item.name || 'unknown', { type: mime });
    }
    // Direct file object
    if (item.file) {
        return item.file;
    }
    throw new Error('No handle or nativePath available for file: ' + (item.name || 'unknown'));
};
