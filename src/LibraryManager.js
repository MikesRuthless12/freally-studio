class LibraryManager {
    constructor() {
        this.dbName = 'FreallyDB';
        this.version = 2; // Bump version for new store
        this.db = null;
        this.init();
    }

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('presets')) {
                    db.createObjectStore('presets', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('samples')) {
                    db.createObjectStore('samples', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('folders')) {
                    db.createObjectStore('folders', { keyPath: 'name' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('LibraryManager: IndexedDB initialized');
                resolve();
            };

            request.onerror = (event) => {
                console.error('LibraryManager Error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // --- Folders & Browser ---

    async addFolder(handle) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['folders'], 'readwrite');
            const store = tx.objectStore('folders');
            // Determine a name (handle.name)
            const request = store.put({ name: handle.name, handle: handle, timestamp: Date.now() });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async removeFolder(name) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['folders'], 'readwrite');
            const store = tx.objectStore('folders');
            const request = store.delete(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getFolders() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['folders'], 'readonly');
            const store = tx.objectStore('folders');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async scanFolder(dirHandle, path = '', onProgress = null) {
        // Validate handle is still usable (handles from IndexedDB may lose their prototype)
        if (!dirHandle || typeof dirHandle.values !== 'function') {
            throw new Error('Directory handle is no longer valid — please re-add the folder');
        }

        // First pass: count folders for percentage calculation if top level
        let totalEntries = 0;
        let processedEntries = 0;

        if (path === '' && onProgress) {
            const countFolders = async (handle) => {
                let c = 0;
                for await (const entry of handle.values()) {
                    if (entry.kind === 'directory') {
                        c += 1 + await countFolders(entry);
                    }
                }
                return c;
            };
            totalEntries = await countFolders(dirHandle);
            if (totalEntries === 0) totalEntries = 1;
        }

        const scan = async (handle, currentPath) => {
            const files = [];
            for await (const entry of handle.values()) {
                const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

                if (entry.kind === 'directory') {
                    processedEntries++;
                    if (onProgress && totalEntries > 0) {
                        onProgress({
                            percent: Math.min((processedEntries / totalEntries) * 100, 100),
                            path: entryPath
                        });
                    }
                    const children = await scan(entry, entryPath);
                    files.push({
                        name: entry.name,
                        path: entryPath,
                        kind: 'directory',
                        handle: entry,
                        children: children
                    });
                } else if (entry.kind === 'file') {
                    if (entry.name.match(/\.(wav|mp3|ogg|flac|mid|midi)$/i)) {
                        const tags = this.extractTags(entry.name);
                        files.push({
                            name: entry.name,
                            path: entryPath,
                            kind: 'file',
                            handle: entry,
                            tags: tags,
                            type: entry.name.endsWith('.mid') || entry.name.endsWith('.midi') ? 'midi' : 'audio'
                        });
                    }
                }
            }
            return files.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : (a.kind === 'directory' ? -1 : 1));
        };

        return await scan(dirHandle, path);
    }

    async verifyPermission(handle, { allowRequest = true } = {}) {
        try {
            // Electron shim handles and handles that lost methods after IndexedDB
            // round-trip may not have queryPermission — treat as granted.
            if (typeof handle.queryPermission !== 'function') {
                return true;
            }
            if ((await handle.queryPermission({ mode: 'read' })) === 'granted') {
                return true;
            }
            // requestPermission requires a user gesture — never call it during silent/auto scans
            if (!allowRequest) return false;
            if (typeof handle.requestPermission === 'function' &&
                (await handle.requestPermission({ mode: 'read' })) === 'granted') {
                return true;
            }
        } catch (e) {
            console.error("Permission check failed", e);
        }
        return false;
    }

    async getFileByPath(path) {
        if (!this.db) await this.init();
        const folders = await this.getFolders();

        // Path is usually "FolderName/Sub/File.wav"
        const parts = path.split('/');
        const rootFolderName = parts[0];
        const folder = folders.find(f => f.name === rootFolderName);
        if (!folder) return null;

        const findInHandle = async (handle, remainingParts) => {
            if (remainingParts.length === 0) return handle;
            const nextName = remainingParts[0];
            for await (const entry of handle.values()) {
                if (entry.name === nextName) {
                    return await findInHandle(entry, remainingParts.slice(1));
                }
            }
            return null;
        };

        return await findInHandle(folder.handle, parts.slice(1));
    }

    extractTags(filename) {
        const parts = filename.split(/[\s\-_.]+/);
        const tags = [];
        // Detect BPM
        const bpmMatch = filename.match(/(\d+)\s?bpm/i);
        if (bpmMatch) tags.push(`${bpmMatch[1]} BPM`);
        // Detect Key
        const keyMatch = filename.match(/([A-G][#b]?\s?(?:maj|min|m|M))/i);
        if (keyMatch) tags.push(keyMatch[1]);
        // Detect Type
        if (filename.match(/kick/i)) tags.push('Kick');
        if (filename.match(/snare/i)) tags.push('Snare');
        if (filename.match(/hat|hihat/i)) tags.push('Hat');
        if (filename.match(/loop/i)) tags.push('Loop');
        if (filename.match(/one\s?shot/i)) tags.push('OneShot');
        return tags;
    }

    // --- Presets ---

    async savePreset(name, data) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['presets'], 'readwrite');
            const store = tx.objectStore('presets');
            const request = store.put({ name, data, timestamp: Date.now() });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadPreset(name) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['presets'], 'readonly');
            const store = tx.objectStore('presets');
            const request = store.get(name);

            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllPresets() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['presets'], 'readonly');
            const store = tx.objectStore('presets');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Samples ---

    async saveSample(name, arrayBuffer) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['samples'], 'readwrite');
            const store = tx.objectStore('samples');
            // Store as Blob or consistent ArrayBuffer
            const request = store.put({ name, buffer: arrayBuffer, timestamp: Date.now() });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadSample(name) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['samples'], 'readonly');
            const store = tx.objectStore('samples');
            const request = store.get(name);

            request.onsuccess = () => resolve(request.result ? request.result.buffer : null);
            request.onerror = () => reject(request.error);
        });
    }
}

window.libraryManager = new LibraryManager();
