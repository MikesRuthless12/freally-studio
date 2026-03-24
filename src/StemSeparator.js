// StemSeparator — Frequency-band stem isolation using OfflineAudioContext + BiquadFilterNode
// Provides browser-native spectral filtering (not ML-based source separation)

export class StemSeparator {
    constructor() {
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
        }
        this.audioContext = window.sharedAnalysisCtx;
    }

    /**
     * Separate an AudioBuffer into frequency-band stems
     * @param {AudioBuffer} buffer - Source audio
     * @param {string[]} stems - Array of stem names: 'vocals', 'drums', 'bass', 'other'
     * @param {string} quality - 'fast' (2-pole) or 'high' (4-pole cascaded)
     * @param {Function} onProgress - Progress callback (0-1)
     * @returns {Promise<Object>} Map of stem name → AudioBuffer
     */
    async separateStems(buffer, stems, quality = 'fast', onProgress) {
        const results = {};
        const total = stems.length;
        let completed = 0;

        for (const stem of stems) {
            if (stem === 'drums') {
                results[stem] = await this._separateDrums(buffer, quality);
            } else {
                const filters = STEM_FILTERS[stem]?.[quality] || STEM_FILTERS[stem]?.fast;
                if (filters) {
                    results[stem] = await this._filterStem(buffer, filters);
                }
            }
            completed++;
            if (onProgress) onProgress(completed / total);
        }

        return results;
    }

    /**
     * Apply a chain of BiquadFilters via OfflineAudioContext
     */
    async _filterStem(buffer, filterSpecs) {
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const channels = buffer.numberOfChannels;

        const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;

        let lastNode = source;
        for (const spec of filterSpecs) {
            const filter = offlineCtx.createBiquadFilter();
            filter.type = spec.type;
            filter.frequency.value = spec.frequency;
            filter.Q.value = spec.Q || 0.707;
            if (spec.gain !== undefined) filter.gain.value = spec.gain;
            lastNode.connect(filter);
            lastNode = filter;
        }

        lastNode.connect(offlineCtx.destination);
        source.start(0);
        return await offlineCtx.startRendering();
    }

    /**
     * Drums: parallel low + high paths merged
     * Low path captures kick/toms (< 500 Hz), high path captures cymbals/hats (> 2000 Hz)
     */
    async _separateDrums(buffer, quality) {
        const lowFilters = quality === 'high'
            ? [{ type: 'lowpass', frequency: 500, Q: 0.707 }, { type: 'lowpass', frequency: 500, Q: 0.707 }]
            : [{ type: 'lowpass', frequency: 500, Q: 0.707 }];

        const highFilters = quality === 'high'
            ? [{ type: 'highpass', frequency: 2000, Q: 0.707 }, { type: 'highpass', frequency: 2000, Q: 0.707 }]
            : [{ type: 'highpass', frequency: 2000, Q: 0.707 }];

        const [lowDrums, highDrums] = await Promise.all([
            this._filterStem(buffer, lowFilters),
            this._filterStem(buffer, highFilters)
        ]);

        return this._mixBuffers(lowDrums, highDrums);
    }

    /**
     * Mix two AudioBuffers together (additive)
     */
    _mixBuffers(bufA, bufB) {
        const sampleRate = bufA.sampleRate;
        const length = Math.max(bufA.length, bufB.length);
        const channels = Math.max(bufA.numberOfChannels, bufB.numberOfChannels);

        const ctx = this.audioContext;
        const mixed = ctx.createBuffer(channels, length, sampleRate);

        for (let ch = 0; ch < channels; ch++) {
            const out = mixed.getChannelData(ch);
            const dataA = ch < bufA.numberOfChannels ? bufA.getChannelData(ch) : null;
            const dataB = ch < bufB.numberOfChannels ? bufB.getChannelData(ch) : null;
            for (let i = 0; i < length; i++) {
                const a = dataA && i < dataA.length ? dataA[i] : 0;
                const b = dataB && i < dataB.length ? dataB[i] : 0;
                out[i] = a + b;
            }
        }

        return mixed;
    }
}

// Filter specifications per stem and quality level
const STEM_FILTERS = {
    bass: {
        fast: [
            { type: 'lowpass', frequency: 250, Q: 0.707 }
        ],
        high: [
            { type: 'lowpass', frequency: 250, Q: 0.707 },
            { type: 'lowpass', frequency: 250, Q: 0.707 }
        ]
    },
    vocals: {
        fast: [
            { type: 'highpass', frequency: 300, Q: 0.707 },
            { type: 'lowpass', frequency: 3500, Q: 0.707 }
        ],
        high: [
            { type: 'highpass', frequency: 300, Q: 0.707 },
            { type: 'highpass', frequency: 300, Q: 0.707 },
            { type: 'lowpass', frequency: 3500, Q: 0.707 },
            { type: 'lowpass', frequency: 3500, Q: 0.707 }
        ]
    },
    other: {
        fast: [
            { type: 'highpass', frequency: 250, Q: 0.707 },
            { type: 'lowpass', frequency: 5000, Q: 0.707 }
        ],
        high: [
            { type: 'highpass', frequency: 250, Q: 0.707 },
            { type: 'highpass', frequency: 250, Q: 0.707 },
            { type: 'lowpass', frequency: 5000, Q: 0.707 },
            { type: 'lowpass', frequency: 5000, Q: 0.707 },
            { type: 'notch', frequency: 800, Q: 2 },
            { type: 'notch', frequency: 2500, Q: 2 }
        ]
    }
};

export default StemSeparator;
