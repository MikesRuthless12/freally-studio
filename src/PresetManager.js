// Preset Management System - Save and Load Complete Project States
// Supports drum kit presets (per-slot samples) and instrument presets (multi-sample)

export class PresetManager {
    constructor() {
        this.dbName = 'FreallyPresets';
        this.dbVersion = 2;
        this.db = null;
        this._initPromise = this.initDB();
    }

    /**
     * Initialize IndexedDB for preset storage
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Presets store
                if (!db.objectStoreNames.contains('presets')) {
                    const presetStore = db.createObjectStore('presets', { keyPath: 'id', autoIncrement: true });
                    presetStore.createIndex('name', 'name', { unique: false });
                    presetStore.createIndex('dateCreated', 'dateCreated', { unique: false });
                    presetStore.createIndex('category', 'category', { unique: false });
                    presetStore.createIndex('presetType', 'presetType', { unique: false });
                }

                // Sample cache for presets
                if (!db.objectStoreNames.contains('presetSamples')) {
                    db.createObjectStore('presetSamples', { keyPath: 'id' });
                }
            };
        });
    }

    /** Ensure DB is ready before operations */
    async ensureDB() {
        if (!this.db) await this._initPromise;
    }

    /**
     * Save current state as preset
     * presetType: 'full' | 'drums' | 'instruments'
     */
    async savePreset(presetData) {
        await this.ensureDB();
        const {
            name,
            category = 'User',
            presetType = 'full',
            // Generator patterns
            drumPattern = {},
            chordPattern = [],
            melodyPattern = [],
            bassPattern = [],
            // Drum samples: { [drumId]: { name, buffer } }
            drumSamples = {},
            // Instrument samples: { chords: { name, samples: Map/Object<note, AudioBuffer> }, melody: {...}, bass: {...} }
            instrumentSamples = {},
            // Legacy single-sample support
            chordSample = null,
            melodySample = null,
            bassSample = null,
            // Settings
            tempo = 120,
            key = 'C',
            scale = 'Minor',
            genre = 'Trap',
            subGenre = 'Standard',
            mood = 'Dark',
            bars = 4,
            complexity = 'simple',
            // Metadata
            description = '',
            tags = []
        } = presetData;

        // Convert drum samples: store name + buffer data
        const drumSamplesData = {};
        for (const [drumId, sample] of Object.entries(drumSamples)) {
            if (sample && sample.buffer) {
                const bufData = await this.audioBufferToData(sample.buffer);
                bufData.sampleName = sample.name || drumId;
                drumSamplesData[drumId] = bufData;
            }
        }

        // Convert instrument samples (multi-sample maps)
        const instrumentSamplesData = {};
        for (const [trackId, instrument] of Object.entries(instrumentSamples)) {
            if (!instrument) continue;
            const instData = { name: instrument.name || trackId, samples: {} };
            const samplesMap = instrument.samples instanceof Map
                ? instrument.samples
                : (instrument.samples ? new Map(Object.entries(instrument.samples)) : new Map());
            for (const [note, audioBuffer] of samplesMap) {
                if (audioBuffer) {
                    instData.samples[note] = await this.audioBufferToData(audioBuffer);
                }
            }
            if (Object.keys(instData.samples).length > 0) {
                instrumentSamplesData[trackId] = instData;
            }
        }

        // Legacy: single-sample fallback (for backward compat)
        const chordSampleData = chordSample ? await this.audioBufferToData(chordSample) : null;
        const melodySampleData = melodySample ? await this.audioBufferToData(melodySample) : null;
        const bassSampleData = bassSample ? await this.audioBufferToData(bassSample) : null;

        const preset = {
            name,
            category,
            presetType,
            description,
            tags,
            dateCreated: new Date().toISOString(),
            dateModified: new Date().toISOString(),
            // Patterns
            drumPattern,
            chordPattern,
            melodyPattern,
            bassPattern,
            // Samples
            drumSamplesData,
            instrumentSamplesData,
            // Legacy
            chordSampleData,
            melodySampleData,
            bassSampleData,
            // Settings
            tempo,
            key,
            scale,
            genre,
            subGenre,
            mood,
            bars,
            complexity
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readwrite');
            const store = transaction.objectStore('presets');
            const request = store.add(preset);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load preset by ID — reconstructs AudioBuffers from stored data
     */
    async loadPreset(presetId, audioContext) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readonly');
            const store = transaction.objectStore('presets');
            const request = store.get(presetId);

            request.onsuccess = async () => {
                const preset = request.result;
                if (!preset) {
                    reject(new Error('Preset not found'));
                    return;
                }

                // Use provided audioContext or reuse shared context
                if (!audioContext) {
                    if (!window.sharedAnalysisCtx) {
                        const Ctx = window.AudioContext || window.webkitAudioContext;
                        window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
                    }
                    audioContext = window.sharedAnalysisCtx;
                }
                const ctx = audioContext;

                // Reconstruct drum samples
                const drumSamples = {};
                for (const [drumId, sampleData] of Object.entries(preset.drumSamplesData || {})) {
                    drumSamples[drumId] = {
                        buffer: await this.dataToAudioBuffer(sampleData, ctx),
                        name: sampleData.sampleName || sampleData.name || drumId
                    };
                }

                // Reconstruct multi-sample instruments
                const instrumentSamples = {};
                for (const [trackId, instData] of Object.entries(preset.instrumentSamplesData || {})) {
                    const samplesMap = new Map();
                    for (const [note, bufData] of Object.entries(instData.samples || {})) {
                        samplesMap.set(parseInt(note), await this.dataToAudioBuffer(bufData, ctx));
                    }
                    instrumentSamples[trackId] = {
                        name: instData.name || trackId,
                        samples: samplesMap
                    };
                }

                // Legacy single-sample fallback
                const chordSample = preset.chordSampleData
                    ? await this.dataToAudioBuffer(preset.chordSampleData, ctx)
                    : null;
                const melodySample = preset.melodySampleData
                    ? await this.dataToAudioBuffer(preset.melodySampleData, ctx)
                    : null;
                const bassSample = preset.bassSampleData
                    ? await this.dataToAudioBuffer(preset.bassSampleData, ctx)
                    : null;

                resolve({
                    id: preset.id,
                    name: preset.name,
                    category: preset.category,
                    presetType: preset.presetType || 'full',
                    description: preset.description,
                    tags: preset.tags,
                    dateCreated: preset.dateCreated,
                    dateModified: preset.dateModified,
                    // Patterns
                    drumPattern: preset.drumPattern,
                    chordPattern: preset.chordPattern,
                    melodyPattern: preset.melodyPattern,
                    bassPattern: preset.bassPattern,
                    // Samples
                    drumSamples,
                    instrumentSamples,
                    chordSample,
                    melodySample,
                    bassSample,
                    // Settings
                    tempo: preset.tempo,
                    key: preset.key,
                    scale: preset.scale,
                    genre: preset.genre,
                    subGenre: preset.subGenre,
                    mood: preset.mood,
                    bars: preset.bars,
                    complexity: preset.complexity
                });
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all presets (metadata only, no audio data)
     */
    async getAllPresets() {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readonly');
            const store = transaction.objectStore('presets');
            const request = store.getAll();

            request.onsuccess = () => {
                const presets = request.result.map(preset => ({
                    id: preset.id,
                    name: preset.name,
                    category: preset.category,
                    presetType: preset.presetType || 'full',
                    description: preset.description,
                    tags: preset.tags,
                    dateCreated: preset.dateCreated,
                    dateModified: preset.dateModified,
                    tempo: preset.tempo,
                    key: preset.key,
                    scale: preset.scale,
                    genre: preset.genre,
                    subGenre: preset.subGenre,
                    mood: preset.mood,
                    bars: preset.bars,
                    // Summary info
                    drumSlotCount: Object.keys(preset.drumSamplesData || {}).length,
                    instrumentCount: Object.keys(preset.instrumentSamplesData || {}).length
                }));
                resolve(presets);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete preset
     */
    async deletePreset(presetId) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readwrite');
            const store = transaction.objectStore('presets');
            const request = store.delete(presetId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Rename preset
     */
    async renamePreset(presetId, newName) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readwrite');
            const store = transaction.objectStore('presets');
            const getReq = store.get(presetId);

            getReq.onsuccess = () => {
                const preset = getReq.result;
                if (!preset) { reject(new Error('Preset not found')); return; }
                preset.name = newName;
                preset.dateModified = new Date().toISOString();
                const putReq = store.put(preset);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    /**
     * Export preset to file
     */
    async exportPreset(presetId) {
        const preset = await this.loadPreset(presetId);

        // Create export data
        const exportData = {
            version: '1.0',
            type: 'FreallyPreset',
            preset
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });

        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_')}.wlpreset`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Import preset from file
     */
    async importPreset(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    if (data.type !== 'FreallyPreset') {
                        reject(new Error('Invalid preset file'));
                        return;
                    }

                    // Save imported preset
                    const presetId = await this.savePreset(data.preset);
                    resolve(presetId);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /**
     * Convert AudioBuffer to storable data
     */
    async audioBufferToData(audioBuffer) {
        if (!audioBuffer) return null;

        const channels = [];
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            channels.push(Array.from(audioBuffer.getChannelData(i)));
        }

        return {
            sampleRate: audioBuffer.sampleRate,
            length: audioBuffer.length,
            numberOfChannels: audioBuffer.numberOfChannels,
            channels
        };
    }

    /**
     * Convert stored data back to AudioBuffer
     */
    async dataToAudioBuffer(data, audioContext) {
        if (!data) return null;

        const audioBuffer = audioContext.createBuffer(
            data.numberOfChannels,
            data.length,
            data.sampleRate
        );

        for (let i = 0; i < data.numberOfChannels; i++) {
            audioBuffer.getChannelData(i).set(data.channels[i]);
        }

        return audioBuffer;
    }

    /**
     * Search presets
     */
    async searchPresets(query) {
        const allPresets = await this.getAllPresets();
        const lowerQuery = query.toLowerCase();

        return allPresets.filter(preset =>
            preset.name.toLowerCase().includes(lowerQuery) ||
            preset.description?.toLowerCase().includes(lowerQuery) ||
            preset.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
            preset.genre?.toLowerCase().includes(lowerQuery) ||
            preset.mood?.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Get presets by category
     */
    async getPresetsByCategory(category) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readonly');
            const store = transaction.objectStore('presets');
            const index = store.index('category');
            const request = index.getAll(category);

            request.onsuccess = () => {
                const presets = request.result.map(preset => ({
                    id: preset.id,
                    name: preset.name,
                    category: preset.category,
                    presetType: preset.presetType || 'full',
                    description: preset.description,
                    tags: preset.tags,
                    dateCreated: preset.dateCreated,
                    dateModified: preset.dateModified
                }));
                resolve(presets);
            };

            request.onerror = () => reject(request.error);
        });
    }
}

export default PresetManager;
