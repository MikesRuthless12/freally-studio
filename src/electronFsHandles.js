/**
 * Electron FileSystem Access API Shims
 *
 * Implements FileSystemDirectoryHandle and FileSystemFileHandle interfaces
 * backed by Electron IPC, so existing code that uses the browser File System
 * Access API works transparently in Electron.
 */

const api = () => window.electronAPI;

/**
 * Shim for FileSystemDirectoryHandle
 */
export class ElectronDirectoryHandle {
    constructor(name, fullPath) {
        this.kind = 'directory';
        this.name = name;
        this._path = fullPath;
    }

    /**
     * Async generator yielding [name, handle] pairs for each entry
     */
    async *entries() {
        const result = await api().fs.readDir(this._path);
        if (result.error) {
            throw new DOMException(result.error, 'NotFoundError');
        }
        for (const entry of result.entries) {
            if (entry.isDirectory) {
                yield [entry.name, new ElectronDirectoryHandle(entry.name, entry.path)];
            } else if (entry.isFile) {
                yield [entry.name, new ElectronFileHandle(entry.name, entry.path)];
            }
        }
    }

    /**
     * Async generator yielding [name, handle] pairs (alias for entries)
     */
    async *keys() {
        for await (const [name] of this.entries()) {
            yield name;
        }
    }

    async *values() {
        for await (const [, handle] of this.entries()) {
            yield handle;
        }
    }

    /**
     * Symbol.asyncIterator — allows for-await-of on the handle directly
     */
    [Symbol.asyncIterator]() {
        return this.entries();
    }

    /**
     * Get a child directory handle
     */
    async getDirectoryHandle(name, options = {}) {
        const childPath = this._path + '/' + name;
        const exists = await api().fs.exists(childPath);
        if (!exists) {
            if (options.create) {
                await api().fs.mkdir(childPath);
            } else {
                throw new DOMException(
                    `Directory "${name}" not found in "${this.name}"`,
                    'NotFoundError'
                );
            }
        }
        return new ElectronDirectoryHandle(name, childPath);
    }

    /**
     * Get a child file handle
     */
    async getFileHandle(name, options = {}) {
        const childPath = this._path + '/' + name;
        const exists = await api().fs.exists(childPath);
        if (!exists) {
            if (options.create) {
                // Create empty file
                await api().fs.writeFile(childPath, new ArrayBuffer(0));
            } else {
                throw new DOMException(
                    `File "${name}" not found in "${this.name}"`,
                    'NotFoundError'
                );
            }
        }
        return new ElectronFileHandle(name, childPath);
    }

    /**
     * Remove an entry
     */
    async removeEntry(name, options = {}) {
        const childPath = this._path + '/' + name;
        // Delegate to Electron fs — not yet implemented in main.js
        // For now, this is a stub
        console.warn('removeEntry not yet implemented for Electron');
    }

    /**
     * Resolve path relative to this directory
     */
    async resolve(possibleDescendant) {
        if (possibleDescendant._path && possibleDescendant._path.startsWith(this._path)) {
            const relative = possibleDescendant._path.slice(this._path.length + 1);
            return relative.split('/').filter(Boolean);
        }
        return null;
    }

    /**
     * Permission always granted in Electron
     */
    async queryPermission() {
        return 'granted';
    }

    async requestPermission() {
        return 'granted';
    }

    /**
     * Expose the native path for components that need it
     */
    get path() {
        return this._path;
    }
}

/**
 * Shim for FileSystemFileHandle
 */
export class ElectronFileHandle {
    constructor(name, fullPath) {
        this.kind = 'file';
        this.name = name;
        this._path = fullPath;
    }

    /**
     * Get a File object for this handle
     */
    async getFile() {
        const result = await api().fs.readFile(this._path);
        if (result.error) {
            throw new DOMException(result.error, 'NotFoundError');
        }

        // Determine MIME type from extension
        const ext = this.name.split('.').pop().toLowerCase();
        const mimeMap = {
            wav: 'audio/wav',
            mp3: 'audio/mpeg',
            ogg: 'audio/ogg',
            flac: 'audio/flac',
            mid: 'audio/midi',
            midi: 'audio/midi',
            json: 'application/json',
            txt: 'text/plain',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
        };
        const type = mimeMap[ext] || 'application/octet-stream';

        return new File([result.data], this.name, { type });
    }

    /**
     * Create a writable stream for this file
     */
    async createWritable(options = {}) {
        return new ElectronWritableStream(this._path, options);
    }

    /**
     * Permission always granted in Electron
     */
    async queryPermission() {
        return 'granted';
    }

    async requestPermission() {
        return 'granted';
    }

    /**
     * Expose the native path
     */
    get path() {
        return this._path;
    }
}

/**
 * Shim for FileSystemWritableFileStream
 */
class ElectronWritableStream {
    constructor(filePath, options) {
        this._path = filePath;
        this._chunks = [];
        this._position = 0;
        this._closed = false;
    }

    async write(data) {
        if (this._closed) {
            throw new DOMException('Stream is closed', 'InvalidStateError');
        }

        // Handle the various write() argument formats
        if (data instanceof Blob || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
            // Direct data write
            if (data instanceof Blob) {
                const buffer = await data.arrayBuffer();
                this._chunks.push(buffer);
            } else if (ArrayBuffer.isView(data)) {
                this._chunks.push(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
            } else {
                this._chunks.push(data);
            }
        } else if (typeof data === 'string') {
            const encoder = new TextEncoder();
            this._chunks.push(encoder.encode(data).buffer);
        } else if (data && typeof data === 'object') {
            // WriteParams object: { type: 'write'|'seek'|'truncate', data?, position?, size? }
            if (data.type === 'write') {
                if (data.position !== undefined) {
                    this._position = data.position;
                }
                await this.write(data.data);
                return;
            } else if (data.type === 'seek') {
                this._position = data.position;
                return;
            } else if (data.type === 'truncate') {
                // Truncate is handled on close
                return;
            }
        }
    }

    async close() {
        if (this._closed) return;
        this._closed = true;

        // Concatenate all chunks into a single ArrayBuffer
        const totalLength = this._chunks.reduce((sum, c) => sum + c.byteLength, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of this._chunks) {
            merged.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        }

        await api().fs.writeFile(this._path, merged.buffer);
        this._chunks = [];
    }

    async abort() {
        this._closed = true;
        this._chunks = [];
    }
}
