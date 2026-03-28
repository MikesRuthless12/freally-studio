/**
 * Enhanced Audio Exporter
 * Exports audio with sampler-rendered MIDI patterns
 */

// lamejs and JSZip loaded dynamically on first use to avoid 6.5MB+ startup cost
import { formatMixFilename, formatStemFilename, formatArrangementFilename, formatStemsZipFilename } from './filenameUtils';

export class AudioExporterEnhanced {
    constructor(sampler) {
        this.sampler = sampler;
    }

    /**
     * Calculate precise duration in seconds for perfect looping
     */
    getExactDuration(bars, tempo) {
        // (Bars * 4 beats/bar * 60 seconds/minute) / BPM
        return (bars * 240) / tempo;
    }

    /**
     * Export all tracks to audio (Combined or Stems)
     * @param {Object} tracks - { drums, chords, melody, bass }
     * @param {Object} options - { format, sampleRate, bitrate, tempo, bars, type: 'combined'|'stems' }
     */
    /**
     * Estimate export file sizes before rendering
     * @returns {{ stems: { [trackName]: { uncompressed, compressed } }, combined: { uncompressed, compressed }, total: { uncompressed, compressed } }}
     */
    estimateExportSizes(options = {}) {
        const {
            format = 'wav',
            sampleRate = 44100,
            bitrate = 192,
            bitDepth = 16,
            tempo = 120,
            bars = 4,
            type = 'combined',
            tracks = {},
            arrangement = null,
            audioTracks = []
        } = options;

        let totalDuration;
        if (arrangement && arrangement.length > 0) {
            totalDuration = arrangement.reduce((sum, sec) => {
                const t = sec.settings?.tempo || tempo;
                return sum + this.getExactDuration(sec.bars, t);
            }, 0);
        } else {
            totalDuration = this.getExactDuration(bars, tempo);
        }

        const trackNames = Object.keys(tracks).filter(k => tracks[k]);
        // Include audio tracks
        audioTracks.forEach(at => {
            if (at.clips && at.clips.length > 0) trackNames.push(at.id);
        });
        const numTracks = Math.max(1, trackNames.length);

        const bytesPerSample = bitDepth / 8;
        const numChannels = 2;

        // Per-track uncompressed WAV size
        const samplesPerTrack = Math.ceil(totalDuration * sampleRate);
        const wavDataSize = samplesPerTrack * numChannels * bytesPerSample;
        const wavFileSize = wavDataSize + 44; // WAV header

        // MP3 estimation: bitrate * duration / 8
        const mp3FileSize = Math.ceil((bitrate * 1000 * totalDuration) / 8);

        const perTrackSize = format === 'wav' ? wavFileSize : mp3FileSize;

        const stems = {};
        trackNames.forEach(name => {
            stems[name] = {
                uncompressed: perTrackSize,
                compressed: Math.ceil(perTrackSize * 0.95) // ZIP doesn't compress audio much
            };
        });

        const combinedSize = perTrackSize; // Mixed to one file
        const stemsTotal = perTrackSize * numTracks;
        const stemsZipSize = Math.ceil(stemsTotal * 0.95);

        return {
            stems,
            combined: { uncompressed: combinedSize, compressed: combinedSize },
            stemsZip: { uncompressed: stemsTotal, compressed: stemsZipSize },
            total: type === 'stems'
                ? { uncompressed: stemsTotal, compressed: stemsZipSize }
                : { uncompressed: combinedSize, compressed: combinedSize },
            duration: totalDuration,
            numTracks
        };
    }

    async exportTracks(tracks, options = {}) {
        const {
            format = 'wav',
            sampleRate = 44100,
            bitrate = 192,
            bitDepth = 16,
            tempo = 120,
            bars = 4,
            type = 'combined', // 'combined' | 'stems'
            projectName = 'Untitled',
            key = 'C',
            scale = 'Minor',
            trackMix = null, // per-track volume/pan: { drums: { volume, pan }, ... }
            onProgress = null // (percent, statusText) => void
        } = options;

        const duration = this.getExactDuration(bars, tempo);

        // DAW-standard naming: ProjectName_120BPM_Cmin_Mix
        const mixFilename = formatMixFilename(projectName, tempo, key, scale);

        // Count total rendering steps for progress
        const trackKeys = Object.keys(tracks).filter(k => tracks[k]);
        const totalSteps = trackKeys.length + 2; // tracks + mixing + encoding
        let completedSteps = 0;
        const report = (msg) => {
            completedSteps++;
            if (onProgress) onProgress((completedSteps / totalSteps) * 100, msg);
        };

        // Render each track
        const renderedTracks = {};

        // Render drums — prefer clip-based if available
        if (options.drumClips && options.drumClips.length > 0) {
            if (onProgress) onProgress((completedSteps / totalSteps) * 100, { key: 'exportProgress.renderingDrums' });
            renderedTracks.drums = await this.renderDrumClips(options.drumClips, sampleRate, duration, tempo);
            report('Drums rendered (clips)');
        } else if (tracks.drums) {
            if (onProgress) onProgress((completedSteps / totalSteps) * 100, { key: 'exportProgress.renderingDrums' });
            renderedTracks.drums = await this.renderDrums(tracks.drums, sampleRate, duration, tempo);
            report('Drums rendered');
        }

        // Render sampler tracks — prefer clip-based if available
        const noteClipMap = { chords: options.chordClips, melody: options.melodyClips, bass: options.bassClips };
        for (const [key, track] of Object.entries(tracks)) {
            if (key === 'drums') continue;
            const noteClips = noteClipMap[key];
            if (noteClips && noteClips.length > 0 && track?.instrumentId) {
                if (onProgress) onProgress((completedSteps / totalSteps) * 100, { key: 'exportProgress.renderingTrack', params: { track: key } });
                // Build a merged pattern from clips at absolute positions
                const mergedPattern = [];
                for (const clip of noteClips) {
                    const clipOffsetSteps = (clip.timelineBar || 0) * 32;
                    for (const n of (clip.pattern || [])) {
                        mergedPattern.push({ ...n, time: n.time + clipOffsetSteps });
                    }
                }
                // Skip if merged pattern has no notes
                if (mergedPattern.length > 0) {
                    renderedTracks[key] = await this.sampler.renderPattern(
                        track.instrumentId, mergedPattern, tempo, duration, sampleRate
                    );
                }
                report(`${key} rendered (clips)`);
            } else if (track && track.instrumentId && track.pattern && track.pattern.length > 0) {
                if (onProgress) onProgress((completedSteps / totalSteps) * 100, { key: 'exportProgress.renderingTrack', params: { track: key } });
                renderedTracks[key] = await this.sampler.renderPattern(
                    track.instrumentId,
                    track.pattern,
                    tempo,
                    duration,
                    sampleRate
                );
                report(`${key} rendered`);
            }
        }

        // Remove tracks that rendered as null (no audible content)
        for (const key of Object.keys(renderedTracks)) {
            if (!renderedTracks[key]) delete renderedTracks[key];
        }

        // Nothing to export — no tracks had audible content
        if (Object.keys(renderedTracks).length === 0) {
            throw new Error('Nothing to export — no tracks contain audio content. Generate patterns or load samples first.');
        }

        // Apply per-track volume and pan if provided
        if (trackMix) {
            for (const [trackName, buffer] of Object.entries(renderedTracks)) {
                const mix = trackMix[trackName];
                if (mix) {
                    this.applyTrackMix(buffer, mix.volume ?? 1, mix.pan ?? 0);
                }
            }
        }

        if (type === 'stems') {
            return this.exportStemsZip(renderedTracks, format, sampleRate, bitrate, bitDepth, projectName, tempo, key, scale, onProgress);
        } else {
            // Mix all tracks
            const buffers = Object.values(renderedTracks);
            const mixedBuffer = this.mixBuffers(buffers, sampleRate, duration);

            // Export to format
            if (format === 'wav') {
                return this.exportWAV(mixedBuffer, sampleRate, mixFilename, bitDepth);
            } else if (format === 'mp3') {
                return await this.exportMP3(mixedBuffer, sampleRate, bitrate, mixFilename);
            }
        }

        throw new Error(`Unsupported format: ${format}`);
    }

    /**
     * Package individual tracks into a Zip file
     */
    async exportStemsZip(renderedTracks, format, sampleRate, bitrate, bitDepth, projectName, tempo, key, scale, onProgress = null) {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const trackEntries = Object.entries(renderedTracks);
        const totalStems = trackEntries.length;

        for (let si = 0; si < trackEntries.length; si++) {
            const [trackName, buffer] = trackEntries[si];
            let fileData;
            let ext;

            if (onProgress) onProgress(((si) / (totalStems + 1)) * 100, { key: 'exportProgress.encodingStem', params: { track: trackName } });

            // DAW-standard stem naming: ProjectName_120BPM_Cmin_Drums
            const stemName = formatStemFilename(projectName, tempo, key, scale, trackName);

            if (format === 'mp3') {
                const result = await this.exportMP3(buffer, sampleRate, bitrate, stemName);
                fileData = result.blob;
                ext = 'mp3';
            } else {
                const result = this.exportWAV(buffer, sampleRate, stemName, bitDepth);
                fileData = result.blob;
                ext = 'wav';
            }

            zip.file(`${stemName}.${ext}`, fileData);
        }

        if (onProgress) onProgress(((totalStems) / (totalStems + 1)) * 100, 'Compressing ZIP...');

        const zipFilename = formatStemsZipFilename(projectName, tempo, key, scale);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        if (onProgress) onProgress(100, 'Export complete');
        return {
            blob: zipBlob,
            filename: `${zipFilename}.zip`
        };
    }

    /**
     * Render drum pattern to audio buffer
     */
    async renderDrums(drumData, sampleRate, duration, tempo) {
        // Precise frame count for looping
        const numFrames = Math.floor(duration * sampleRate);
        const offlineContext = new OfflineAudioContext(2, numFrames, sampleRate);

        const beatDuration = 60 / tempo;
        const stepDuration = beatDuration / 8; // 32 steps/bar = 8 steps/beat

        // Handle structure: drumData might BE the drumStates object, or contain it
        const states = drumData.drumStates || drumData;

        // Schedule all drum hits
        let hitCount = 0;
        Object.keys(states).forEach(drumId => {
            const state = states[drumId];
            if (!state.powered || state.mute) return;
            if (!state.sample || !state.sample.buffer) return;

            const patternLength = state.lanes.root.pattern.length;
            const patternDuration = patternLength * stepDuration;

            // Loop pattern until total duration is filled
            for (let currentTime = 0; currentTime < duration; currentTime += patternDuration) {

                state.lanes.root.pattern.forEach((active, step) => {
                    if (!active) return;

                    const hitTime = currentTime + (step * stepDuration);
                    if (hitTime >= duration) return;

                    const velocity = (state.lanes.root.velocity[step] || 100) / 100;

                    const source = offlineContext.createBufferSource();
                    source.buffer = state.sample.buffer;

                    const gainNode = offlineContext.createGain();
                    gainNode.gain.value = velocity;

                    source.connect(gainNode);
                    gainNode.connect(offlineContext.destination);

                    source.start(hitTime);
                    hitCount++;
                });
            }
        });

        // No audible content — skip this track
        if (hitCount === 0) return null;

        return await offlineContext.startRendering();
    }

    /**
     * Render drum clips to audio buffer (clip-based timeline)
     * @param {Array} clips - Array of drum clip objects with timelineBar, bars, drumStates
     * @param {number} sampleRate
     * @param {number} duration - total duration in seconds
     * @param {number} tempo
     * @returns {AudioBuffer}
     */
    async renderDrumClips(clips, sampleRate, duration, tempo) {
        const numFrames = Math.floor(duration * sampleRate);
        const offlineContext = new OfflineAudioContext(2, numFrames, sampleRate);
        const beatDuration = 60 / tempo;
        const stepDuration = beatDuration / 8;
        let hitCount = 0;

        for (const clip of clips) {
            const clipStartTime = (clip.timelineBar || 0) * 4 * beatDuration; // bars to seconds
            const ds = clip.drumStates;
            if (!ds) continue;

            Object.keys(ds).forEach(drumId => {
                const state = ds[drumId];
                if (!state.powered || state.mute) return;

                // Look up sample buffer from sampler
                let sampleBuffer = null;
                if (this.sampler) {
                    const instrument = this.sampler.instruments?.get(drumId);
                    if (instrument && instrument.samples?.size > 0) {
                        const entry = instrument.samples.values().next().value;
                        if (entry?.buffer) sampleBuffer = entry.buffer;
                    }
                }
                if (!sampleBuffer) return;

                Object.values(state.lanes).forEach(lane => {
                    lane.pattern.forEach((active, step) => {
                        if (!active) return;
                        const hitTime = clipStartTime + step * stepDuration;
                        if (hitTime >= duration || hitTime < 0) return;
                        const velocity = (lane.velocity[step] || 100) / 100;
                        const source = offlineContext.createBufferSource();
                        source.buffer = sampleBuffer;
                        const gainNode = offlineContext.createGain();
                        gainNode.gain.value = velocity;
                        source.connect(gainNode);
                        gainNode.connect(offlineContext.destination);
                        source.start(hitTime);
                        hitCount++;
                    });
                });
            });
        }

        // No audible content — skip this track
        if (hitCount === 0) return null;

        return await offlineContext.startRendering();
    }

    /**
     * Apply volume and pan to a rendered AudioBuffer in-place
     * Pan uses constant-power panning law for smooth stereo image
     * @param {AudioBuffer} buffer - stereo AudioBuffer
     * @param {number} volume - 0 to 1
     * @param {number} pan - -1 (left) to 1 (right)
     */
    applyTrackMix(buffer, volume, pan) {
        const numChannels = buffer.numberOfChannels;
        if (numChannels < 2) {
            // Mono — just apply volume
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] *= volume;
            }
            return;
        }

        // Constant-power pan: angle = pan * pi/4 (45 degrees)
        const angle = (pan + 1) * Math.PI / 4; // 0 to pi/2
        const leftGain = Math.cos(angle) * volume;
        const rightGain = Math.sin(angle) * volume;

        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        for (let i = 0; i < left.length; i++) {
            left[i] *= leftGain;
            right[i] *= rightGain;
        }
    }

    /**
     * Mix multiple audio buffers with peak normalization
     */
    mixBuffers(buffers, sampleRate, duration) {
        // Reuse the shared AudioContext for buffer creation
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
        }
        const sharedCtx = window.sharedAnalysisCtx;

        if (buffers.length === 0) {
            // Return silence
            const numFrames = Math.floor(duration * sampleRate);
            return sharedCtx.createBuffer(2, numFrames, sampleRate);
        }

        // Find longest buffer (should be equal due to strict duration, but safety first)
        const maxLength = Math.max(...buffers.map(b => b.length));
        const numChannels = 2;

        // Create output buffer
        const mixedBuffer = sharedCtx.createBuffer(numChannels, maxLength, sampleRate);

        // Sum all buffers
        for (let channel = 0; channel < numChannels; channel++) {
            const outputData = mixedBuffer.getChannelData(channel);

            buffers.forEach(buffer => {
                const channelData = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));

                for (let i = 0; i < channelData.length; i++) {
                    outputData[i] += channelData[i];
                }
            });
        }

        // Peak-normalize: find the loudest sample across all channels and scale
        // so peaks hit ~0 dBFS.  Without this, summing multiple tracks easily
        // exceeds ±1.0 and hard-clips in the WAV encoder, producing flat-topped
        // waveforms and audible distortion.
        let peak = 0;
        for (let channel = 0; channel < numChannels; channel++) {
            const data = mixedBuffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                const abs = Math.abs(data[i]);
                if (abs > peak) peak = abs;
            }
        }

        if (peak > 1.0) {
            const gain = 1.0 / peak;
            for (let channel = 0; channel < numChannels; channel++) {
                const data = mixedBuffer.getChannelData(channel);
                for (let i = 0; i < data.length; i++) {
                    data[i] *= gain;
                }
            }
        }

        return mixedBuffer;
    }

    /**
     * Export to WAV format
     */
    exportWAV(audioBuffer, sampleRate, filenamePrefix = 'export', bitDepth = 16) {
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;

        // Interleave channels as float
        const interleaved = new Float32Array(length * numChannels);
        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                interleaved[i * numChannels + channel] = channelData[i];
            }
        }

        // Create WAV file with the requested bit depth
        const wavData = this.encodeWAV(interleaved, sampleRate, numChannels, bitDepth);

        return {
            blob: new Blob([wavData], { type: 'audio/wav' }),
            filename: `${filenamePrefix}.wav`
        };
    }

    /**
     * Encode WAV file — supports 8/16/24-bit PCM and 32-bit IEEE float
     * @param {Float32Array} floatSamples - interleaved float samples (-1..1)
     */
    encodeWAV(floatSamples, sampleRate, numChannels, bitDepth) {
        const isFloat = bitDepth === 32;
        const formatCode = isFloat ? 3 : 1; // 3 = IEEE float, 1 = PCM
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataSize = floatSamples.length * bytesPerSample;

        // 32-bit float uses extended fmt (size=18) + fact chunk (12 bytes)
        const fmtChunkSize = isFloat ? 18 : 16;
        const factChunkSize = isFloat ? 12 : 0;
        const headerSize = 12 + (8 + fmtChunkSize) + factChunkSize + 8; // RIFF(12) + fmt(8+size) + fact? + data(8)
        const fileSize = headerSize + dataSize;

        const buffer = new ArrayBuffer(fileSize);
        const view = new DataView(buffer);
        let offset = 0;

        // RIFF header
        this.writeString(view, offset, 'RIFF'); offset += 4;
        view.setUint32(offset, fileSize - 8, true); offset += 4;
        this.writeString(view, offset, 'WAVE'); offset += 4;

        // fmt chunk
        this.writeString(view, offset, 'fmt '); offset += 4;
        view.setUint32(offset, fmtChunkSize, true); offset += 4;
        view.setUint16(offset, formatCode, true); offset += 2;
        view.setUint16(offset, numChannels, true); offset += 2;
        view.setUint32(offset, sampleRate, true); offset += 4;
        view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
        view.setUint16(offset, blockAlign, true); offset += 2;
        view.setUint16(offset, bitDepth, true); offset += 2;
        if (isFloat) {
            view.setUint16(offset, 0, true); offset += 2; // cbSize = 0
        }

        // fact chunk (required for non-PCM formats)
        if (isFloat) {
            this.writeString(view, offset, 'fact'); offset += 4;
            view.setUint32(offset, 4, true); offset += 4;
            view.setUint32(offset, floatSamples.length / numChannels, true); offset += 4;
        }

        // data chunk
        this.writeString(view, offset, 'data'); offset += 4;
        view.setUint32(offset, dataSize, true); offset += 4;

        // Write samples based on bit depth
        for (let i = 0; i < floatSamples.length; i++) {
            const s = Math.max(-1, Math.min(1, floatSamples[i]));
            if (bitDepth === 8) {
                // 8-bit unsigned PCM: 0-255, 128 = silence
                view.setUint8(offset, Math.round((s + 1) * 127.5));
                offset += 1;
            } else if (bitDepth === 16) {
                // 16-bit signed PCM
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                offset += 2;
            } else if (bitDepth === 24) {
                // 24-bit signed PCM (3 bytes, little-endian)
                const val = Math.round(s < 0 ? s * 0x800000 : s * 0x7FFFFF);
                view.setUint8(offset, val & 0xFF);
                view.setUint8(offset + 1, (val >> 8) & 0xFF);
                view.setUint8(offset + 2, (val >> 16) & 0xFF);
                offset += 3;
            } else {
                // 32-bit IEEE float
                view.setFloat32(offset, s, true);
                offset += 4;
            }
        }

        return buffer;
    }

    /**
     * Export to MP3 format
     */
    async exportMP3(audioBuffer, sampleRate, bitrate, filenamePrefix = 'export') {
        const lamejs = (await import('lamejs')).default;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;

        // Convert to 16-bit PCM
        const leftChannel = this.floatTo16BitPCM(audioBuffer.getChannelData(0));
        const rightChannel = numChannels > 1
            ? this.floatTo16BitPCM(audioBuffer.getChannelData(1))
            : leftChannel;

        // Encode MP3
        const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
        const mp3Data = [];

        const sampleBlockSize = 1152;
        for (let i = 0; i < length; i += sampleBlockSize) {
            const leftChunk = leftChannel.subarray(i, i + sampleBlockSize);
            const rightChunk = rightChannel.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        return {
            blob: new Blob(mp3Data, { type: 'audio/mp3' }),
            filename: `${filenamePrefix}.mp3`
        };
    }

    /**
     * Convert float samples to 16-bit PCM
     */
    floatTo16BitPCM(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16Array;
    }

    /**
     * Write string to DataView
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Download exported file
     */
    download(exportData) {
        const url = URL.createObjectURL(exportData.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportData.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export individual track
     */
    async exportTrack(trackName, trackData, options = {}) {
        const tracks = { [trackName]: trackData };
        return await this.exportTracks(tracks, options);
    }

    /**
     * Export an entire arrangement (multiple sections concatenated)
     * @param {Array} arrangement - array of section objects with { bars, patterns, settings }
     * @param {Object} options - export options (format, sampleRate, etc.)
     * @returns {{ blob, filename }}
     */
    async exportArrangement(arrangement, options = {}) {
        const {
            format = 'wav',
            sampleRate = 44100,
            bitrate = 192,
            bitDepth = 16,
            tempo: globalTempo = 120,
            projectName = 'Untitled',
            key: globalKey = 'C',
            scale: globalScale = 'Minor',
            trackMix = null,
            audioTracks = [],
            globalMutes = new Set(),
            onProgress = null,
            // New clip-based props
            drumClips = [],
            chordClips = [],
            melodyClips = [],
            bassClips = [],
            timelineBars = null
        } = options;

        // Calculate total duration from clips or arrangement
        let totalDurationBars;
        if (timelineBars != null) {
            // Use clip-based calculation: max(clip.timelineBar + clip.bars) across all clips
            let maxBar = 0;
            for (const c of drumClips) maxBar = Math.max(maxBar, (c.timelineBar || 0) + (c.bars || 4));
            for (const c of chordClips) maxBar = Math.max(maxBar, (c.timelineBar || 0) + (c.bars || 4));
            for (const c of melodyClips) maxBar = Math.max(maxBar, (c.timelineBar || 0) + (c.bars || 4));
            for (const c of bassClips) maxBar = Math.max(maxBar, (c.timelineBar || 0) + (c.bars || 4));
            if (audioTracks) {
                for (const t of audioTracks) {
                    if (t.clips) {
                        for (const c of t.clips) {
                            const clipBar = c.timelineBar != null ? c.timelineBar : 0;
                            const clipDurBars = c.buffer ? (c.buffer.duration / (240 / globalTempo)) : 0;
                            maxBar = Math.max(maxBar, clipBar + clipDurBars);
                        }
                    }
                }
            }
            totalDurationBars = Math.max(maxBar, 1);
        } else {
            // Legacy section-based calculation
            totalDurationBars = arrangement.reduce((sum, s) => sum + s.bars, 0);
        }

        const totalDuration = this.getExactDuration(totalDurationBars, globalTempo);
        const totalLength = Math.floor(totalDuration * sampleRate);
        const finalBuffer = window.sharedAnalysisCtx.createBuffer(2, totalLength, sampleRate);

        if (onProgress) onProgress(10, { key: 'exportProgress.renderingSection', params: { current: 1, total: 1, name: 'Timeline' } });

        // Render MIDI clips at absolute positions into finalBuffer
        const secondsPerBar = 240 / globalTempo;

        // Helper: render a melodic clip into the final buffer at its bar position
        const renderClipToBuffer = async (clip, trackKey) => {
            if (!clip.pattern || !Array.isArray(clip.pattern) || clip.pattern.length === 0) return;
            const clipBar = clip.timelineBar || 0;
            const clipBars = clip.bars || 4;
            const clipDuration = this.getExactDuration(clipBars, globalTempo);
            const clipOffsetFrames = Math.floor(clipBar * secondsPerBar * sampleRate);

            // Find instrument for this track
            const instrumentId = trackKey;
            if (!this.sampler.instruments.has(instrumentId)) return;

            const rendered = await this.sampler.renderPattern(
                instrumentId, clip.pattern, globalTempo, clipDuration, sampleRate
            );
            if (!rendered) return;

            // Apply mix
            const mix = trackMix ? trackMix[trackKey] : null;
            const vol = mix ? (mix.volume ?? 0.5) : 0.5;
            const pan = mix ? (mix.pan ?? 0) : 0;
            this.applyTrackMix(rendered, vol, pan);

            // Mix into final buffer
            for (let ch = 0; ch < 2; ch++) {
                const dst = finalBuffer.getChannelData(ch);
                const src = rendered.getChannelData(Math.min(ch, rendered.numberOfChannels - 1));
                for (let i = 0; i < src.length && clipOffsetFrames + i < dst.length; i++) {
                    dst[clipOffsetFrames + i] += src[i];
                }
            }
        };

        // Render drum clips
        if (!globalMutes.has('drums')) {
            for (const clip of drumClips) {
                if (!clip.drumStates) continue;
                const clipBar = clip.timelineBar || 0;
                const clipBars = clip.bars || 4;
                const clipDuration = this.getExactDuration(clipBars, globalTempo);
                const clipOffsetFrames = Math.floor(clipBar * secondsPerBar * sampleRate);
                const rendered = await this.renderDrums(clip.drumStates, sampleRate, clipDuration, globalTempo);
                if (!rendered) continue;
                const mix = trackMix ? trackMix['drums'] : null;
                const vol = mix ? (mix.volume ?? 0.5) : 0.5;
                const pan = mix ? (mix.pan ?? 0) : 0;
                this.applyTrackMix(rendered, vol, pan);
                for (let ch = 0; ch < 2; ch++) {
                    const dst = finalBuffer.getChannelData(ch);
                    const src = rendered.getChannelData(Math.min(ch, rendered.numberOfChannels - 1));
                    for (let i = 0; i < src.length && clipOffsetFrames + i < dst.length; i++) {
                        dst[clipOffsetFrames + i] += src[i];
                    }
                }
            }
        }

        // Render chord/melody/bass clips
        if (!globalMutes.has('chords')) {
            for (const clip of chordClips) await renderClipToBuffer(clip, 'chords');
        }
        if (!globalMutes.has('melody')) {
            for (const clip of melodyClips) await renderClipToBuffer(clip, 'melody');
        }
        if (!globalMutes.has('bass')) {
            for (const clip of bassClips) await renderClipToBuffer(clip, 'bass');
        }

        // Legacy section-based rendering fallback (if no clips but sections exist)
        if (drumClips.length === 0 && chordClips.length === 0 && melodyClips.length === 0 && bassClips.length === 0 && arrangement.length > 0) {
            let sectionOffset = 0;
            for (const section of arrangement) {
                const sectionTempo = section.settings?.tempo || globalTempo;
                const sectionDuration = this.getExactDuration(section.bars, sectionTempo);
                const sectionOffsetFrames = Math.floor(sectionOffset * sampleRate);

                const renderedTracks = {};
                if (section.patterns.drums) {
                    renderedTracks.drums = await this.renderDrums(section.patterns.drums, sampleRate, sectionDuration, sectionTempo);
                }
                for (const [trackKey, track] of Object.entries(section.patterns)) {
                    if (trackKey === 'drums') continue;
                    if (track && track.instrumentId && track.pattern) {
                        renderedTracks[trackKey] = await this.sampler.renderPattern(track.instrumentId, track.pattern, sectionTempo, sectionDuration, sampleRate);
                    }
                }
                if (trackMix) {
                    for (const [trackName, buffer] of Object.entries(renderedTracks)) {
                        const mix = trackMix[trackName];
                        if (mix) this.applyTrackMix(buffer, mix.volume ?? 1, mix.pan ?? 0);
                    }
                }
                const buffers = Object.values(renderedTracks);
                if (buffers.length > 0) {
                    const mixed = this.mixBuffers(buffers, sampleRate, sectionDuration);
                    for (let ch = 0; ch < 2; ch++) {
                        const dst = finalBuffer.getChannelData(ch);
                        const src = mixed.getChannelData(Math.min(ch, mixed.numberOfChannels - 1));
                        for (let i = 0; i < src.length && sectionOffsetFrames + i < dst.length; i++) {
                            dst[sectionOffsetFrames + i] += src[i];
                        }
                    }
                }
                sectionOffset += sectionDuration;
            }
        }

        if (onProgress) onProgress(70, { key: 'exportProgress.mixingAudio' });

        // Render audio clips at absolute timeline positions into finalBuffer
        if (audioTracks && audioTracks.length > 0) {
            const secondsPerBar = 4 * 60 / globalTempo;
            // Compute cumulative bars for legacy clip migration
            const cumBarsMap = {};
            let cumBars = 0;
            for (const sec of arrangement) {
                cumBarsMap[sec.id] = cumBars;
                cumBars += sec.bars;
            }

            for (const track of audioTracks) {
                if (globalMutes.has(track.id)) continue;
                if (!track.clips || track.clips.length === 0) continue;

                for (const clip of track.clips) {
                    if (!clip.buffer) continue;
                    let srcBuffer = clip.buffer;
                    const playbackRate = clip.playbackRate || Math.pow(2, (clip.pitch || 0) / 12);
                    const trimStart = clip.trimStart || 0;
                    const trimEnd = clip.trimEnd || 0;
                    const fadeIn = clip.fadeIn || 0;
                    const fadeOut = clip.fadeOut || 0;

                    // Compute absolute bar position (timelineBar or legacy fallback)
                    let absBar = clip.timelineBar;
                    if (absBar == null) {
                        absBar = (cumBarsMap[clip.sectionId] || 0) + (clip.startBar || 0);
                    }
                    const clipOffsetFrames = Math.floor(absBar * secondsPerBar * sampleRate);

                    // Handle reverse
                    if (clip.reversed) {
                        const revBuf = window.sharedAnalysisCtx.createBuffer(srcBuffer.numberOfChannels, srcBuffer.length, srcBuffer.sampleRate);
                        for (let ch = 0; ch < srcBuffer.numberOfChannels; ch++) {
                            const src = srcBuffer.getChannelData(ch);
                            const dst = revBuf.getChannelData(ch);
                            for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i];
                        }
                        srcBuffer = revBuf;
                    }

                    const srcSR = srcBuffer.sampleRate;
                    const trimStartSamples = Math.floor(trimStart * srcSR);
                    const trimEndSamples = Math.floor(trimEnd * srcSR);
                    const srcLen = srcBuffer.length - trimStartSamples - trimEndSamples;
                    const fadeInSamples = Math.floor(fadeIn * sampleRate / playbackRate);
                    const fadeOutFrames = Math.floor(fadeOut * sampleRate / playbackRate);

                    // Apply track mix
                    const mix = trackMix ? trackMix[track.id] : null;
                    const vol = mix ? (mix.volume ?? 0.5) : 0.5;
                    const pan = mix ? (mix.pan ?? 0) : 0;
                    const leftGain = vol * Math.cos((pan + 1) * Math.PI / 4);
                    const rightGain = vol * Math.sin((pan + 1) * Math.PI / 4);
                    const gains = [leftGain, rightGain];

                    for (let ch = 0; ch < 2; ch++) {
                        const srcCh = srcBuffer.getChannelData(Math.min(ch, srcBuffer.numberOfChannels - 1));
                        const dstCh = finalBuffer.getChannelData(ch);
                        const g = gains[ch];
                        for (let i = 0; i < totalLength - clipOffsetFrames; i++) {
                            const srcIdx = trimStartSamples + (i * playbackRate * srcSR / sampleRate);
                            if (srcIdx >= srcBuffer.length - trimEndSamples) break;
                            const idx0 = Math.floor(srcIdx);
                            const frac = srcIdx - idx0;
                            const s0 = srcCh[idx0] || 0;
                            const s1 = srcCh[Math.min(idx0 + 1, srcCh.length - 1)] || 0;
                            let sample = s0 + (s1 - s0) * frac;
                            // Fade in
                            const outputSample = i * playbackRate;
                            if (fadeIn > 0 && outputSample < fadeInSamples) {
                                sample *= outputSample / fadeInSamples;
                            }
                            // Fade out
                            const totalOutputSamples = srcLen / playbackRate * sampleRate / srcSR;
                            if (fadeOut > 0 && i > totalOutputSamples - fadeOutFrames) {
                                const rem = totalOutputSamples - i;
                                sample *= Math.max(0, rem / fadeOutFrames);
                            }
                            dstCh[clipOffsetFrames + i] += sample * g;
                        }
                    }
                }
            }
        }

        if (onProgress) onProgress(((totalSections + 1) / (totalSections + 2)) * 100, { key: 'exportProgress.encodingFormat', params: { format: format.toUpperCase() } });

        const arrFilename = formatArrangementFilename(projectName, globalTempo, globalKey, globalScale);

        let result;
        if (format === 'wav') {
            result = this.exportWAV(finalBuffer, sampleRate, arrFilename, bitDepth);
        } else if (format === 'mp3') {
            result = await this.exportMP3(finalBuffer, sampleRate, bitrate, arrFilename);
        } else {
            throw new Error(`Unsupported format: ${format}`);
        }

        if (onProgress) onProgress(100, 'Export complete');
        return result;
    }

    /**
     * Export selected tracks
     */
    async exportSelected(selectedTracks, allTracks, options = {}) {
        const tracksToExport = {};

        selectedTracks.forEach(trackName => {
            if (allTracks[trackName]) {
                tracksToExport[trackName] = allTracks[trackName];
            }
        });

        return await this.exportTracks(tracksToExport, options);
    }
}

export default AudioExporterEnhanced;
