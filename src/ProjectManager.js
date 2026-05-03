/**
 * Project Manager for .wlz files
 * Handles Saving and Loading of Project State, Samples, and MIDI Stems.
 */

import JSZip from 'jszip';
// We need AudioExporter for WAV encoding logic
// Assuming AudioExporterEnhanced can be instantiated or we use its methods
import { AudioExporterEnhanced } from './AudioExporterEnhanced';
import MidiExporter from './MIDIExporter'; // Importing default instance or class? It exports default instance.

export class ProjectManager {
    constructor(sampler, audioExporter) {
        this.sampler = sampler;
        this.audioExporter = audioExporter || new AudioExporterEnhanced(sampler);
        this.midiExporter = MidiExporter; // The existing instance
    }

    /**
     * Save Project to .wlz file
     * @param {Object} projectState - { patterns, globalSettings, trackStatus, mixer, drumParams, projectName }
     * @param {Function} onProgress - Callback (percent, currentAction)
     */
    async saveProject(projectState, onProgress) {
        const zip = new JSZip();
        // projectState now includes loadedInstrumentNames
        const { globalSettings, patterns, projectName = 'Untitled Project', loadedInstrumentNames } = projectState;

        if (onProgress) onProgress(0, "Initializing...");

        // Extract naming fields early — used for sample, MIDI, and project filenames
        const bpm = globalSettings.tempo;
        const key = globalSettings.key;
        const scale = globalSettings.scale;
        const genre = globalSettings.genre || 'Unknown';
        const mood = globalSettings.mood || 'Unknown';
        const safeProjectName = projectName.replace(/[^a-z0-9 ]/gi, '').trim();
        const safeGenre = genre.replace(/[^a-z0-9 ]/gi, '').trim();
        const safeMood = mood.replace(/[^a-z0-9 ]/gi, '').trim();

        // Capture DSP Params from Sampler
        const drumParams = {};
        if (this.sampler.drumChannels) {
            this.sampler.drumChannels.forEach((channel, drumId) => {
                drumParams[drumId] = channel.params;
            });
        }

        // 1. Project Manifest (JSON)
        const manifest = {
            version: '2.0.0', // v2.0.0: continuous timeline with clips
            timestamp: Date.now(),
            projectName,
            globalSettings,
            patterns,
            trackStatus: projectState.trackStatus,
            mixer: projectState.mixer,
            loadedInstrumentNames: loadedInstrumentNames || {}, // Save IDs
            drumParams, // Save DSP params
            instrumentMeta: {}, // Save display names
            sampleMap: {},
            // Continuous timeline data
            timelineBars: projectState.timelineBars || 48,
            arrangementMode: projectState.arrangementMode || false,
            arrangement: projectState.arrangement || null,
            // Clip data
            drumClips: projectState.drumClips || [],
            chordClips: projectState.chordClips || [],
            melodyClips: projectState.melodyClips || [],
            bassClips: projectState.bassClips || [],
            // Loop range
            loopRange: projectState.loopRange || null
        };

        // 2. Collect and Save Used Samples
        const sampleFolder = zip.folder("samples");
        const sampleMap = manifest.sampleMap;

        // A. Drum Samples
        // Iterate sampler instruments. If logic maps drumId -> instrumentId.
        // In this app, drumIds ('kick', 'snare') ARE the instrumentIds in sampler.
        // But sampler stores them as 'kick', 'snare', etc.

        // We only want USED samples.
        // Actually, for drums, if the slot is populated, it's "used" even if no pattern yet? 
        // User said "all used samples". Let's assume anything loaded in a slot is "used".

        const loadedInstruments = this.sampler.instruments; // Map
        const totalInstruments = loadedInstruments.size;
        let processedCount = 0;

        for (const [instrumentId, instrument] of loadedInstruments.entries()) {
            // Check if this instrument is actually used in the project?
            // For now, let's save ALL loaded instruments to be safe, 
            // OR checks against trackStatus/loadedInstruments state passed in projectState.

            // Re-encoding AudioBuffer to WAV
            // Instrument has 'samples' Map: note -> AudioBuffer
            const sampleCount = instrument.samples.size;
            let sampleIndex = 0;

            for (const [note, buffer] of instrument.samples.entries()) {
                const instLabel = (instrument.name || instrumentId).charAt(0).toUpperCase() + (instrument.name || instrumentId).slice(1);
                // Append note number for multi-sample instruments to avoid filename collisions
                const noteSuffix = sampleCount > 1 ? ` ${note}` : '';
                const filename = `${safeGenre} - ${safeMood} - ${key} ${scale} - ${bpm} BPM - ${instLabel}${noteSuffix}.wav`;

                if (!manifest.instrumentMeta) manifest.instrumentMeta = {};
                // If it's a drum, use its engine name (e.g. "MyKick.wav")
                manifest.instrumentMeta[instrumentId] = instrument.name;

                // Encode to WAV
                const wavData = this.audioExporter.exportWAV(buffer, this.sampler.audioContext.sampleRate, 'temp');

                // Add to Zip
                sampleFolder.file(filename, wavData.blob);

                // Record in manifest
                if (!sampleMap[instrumentId]) sampleMap[instrumentId] = {};
                sampleMap[instrumentId][note] = `samples/${filename}`;

                sampleIndex++;

                // Progress (0-40% reserved for samples)
                if (onProgress) {
                    const instProgress = processedCount / totalInstruments;
                    const subProgress = sampleIndex / sampleCount;
                    const total = (instProgress + (subProgress / totalInstruments)) * 40;
                    onProgress(total, `Encoding ${filename}...`);
                }
            }
            processedCount++;
        }

        // 3. Generate MIDI Stems
        const midiFolder = zip.folder("midi");

        // Naming Convention: "{Genre} - {Mood} - {Key} {Scale} - {BPM} BPM - {Instrument}.mid"

        if (onProgress) onProgress(45, "Generating MIDI Stems...");

        // A. Drum Stems (One per drum lane)
        if (patterns.drums) {
            Object.entries(patterns.drums).forEach(([id, drum]) => {
                const drumName = id.charAt(0).toUpperCase() + id.slice(1); // e.g., "Kick"
                // Naming: "Genre - Mood - Key Scale - BPM BPM - Instrument.mid"
                const filename = `${safeGenre} - ${safeMood} - ${key} ${scale} - ${bpm} BPM - ${drumName}.mid`;

                // Generate MIDI for this single drum
                const midiBlob = this.generateSingleDrumMidi(drum, id, bpm);
                if (midiBlob) {
                    midiFolder.file(filename, midiBlob);
                }
            });
        }

        // B. Melodic Stems
        ['chords', 'melody', 'bass'].forEach(type => {
            if (patterns[type]) {
                const name = type.charAt(0).toUpperCase() + type.slice(1);
                // Naming: "Genre - Mood - Key Scale - BPM BPM - Instrument.mid"
                const filename = `${safeGenre} - ${safeMood} - ${key} ${scale} - ${bpm} BPM - ${name}.mid`;

                // Pass correct structure to generateMelodicMidi
                const midiBlob = this.generateMelodicMidi(type, patterns[type], bpm);
                if (midiBlob) {
                    midiFolder.file(filename, midiBlob);
                }
            }
        });

        // 4. Save Audio Tracks (clips encoded as WAV)
        if (projectState.audioTracks && projectState.audioTracks.length > 0) {
            const audioClipsFolder = zip.folder("audio-clips");
            const audioTracksMeta = [];
            let clipIdx = 0;
            for (const track of projectState.audioTracks) {
                const trackMeta = { id: track.id, name: track.name, color: track.color, clips: [] };
                for (const clip of track.clips) {
                    if (!clip.buffer) continue;
                    const clipFilename = `clip_${clipIdx++}.wav`;
                    const wavData = this.audioExporter.exportWAV(clip.buffer, clip.buffer.sampleRate || 44100, 'temp');
                    audioClipsFolder.file(clipFilename, wavData.blob);
                    trackMeta.clips.push({
                        id: clip.id, sectionId: clip.sectionId, name: clip.name,
                        path: `audio-clips/${clipFilename}`,
                        playbackRate: clip.playbackRate, trimStart: clip.trimStart, trimEnd: clip.trimEnd,
                        reversed: clip.reversed, pitch: clip.pitch, fadeIn: clip.fadeIn, fadeOut: clip.fadeOut,
                        startBar: clip.startBar || 0,
                        timelineBar: clip.timelineBar != null ? clip.timelineBar : null
                    });
                    if (onProgress) onProgress(45 + (clipIdx / (projectState.audioTracks.reduce((s, t) => s + t.clips.length, 0) || 1)) * 3, `Encoding ${clip.name}...`);
                }
                audioTracksMeta.push(trackMeta);
            }
            manifest.audioTracks = audioTracksMeta;
        }

        // 5. Save Vocal Engine State + Audio
        if (projectState.vocalState && projectState.vocalState.hasAudio && projectState.vocalState.audioBuffer) {
            if (onProgress) onProgress(48, "Encoding vocal audio...");
            const vocalFolder = zip.folder("vocal");
            const vocalBuffer = projectState.vocalState.audioBuffer;
            const wavData = this.audioExporter.exportWAV(vocalBuffer, vocalBuffer.sampleRate || 44100, 'vocal-audio');
            vocalFolder.file("audio.wav", wavData.blob);
            // Save engine state as JSON (correction params, note regions, pitch data, etc.)
            vocalFolder.file("state.json", JSON.stringify(projectState.vocalState.engineData, null, 2));
            manifest.vocalState = {
                hasAudio: true,
                audioPath: "vocal/audio.wav",
                statePath: "vocal/state.json",
                audioFileName: projectState.vocalState.audioFileName || null,
                uiState: projectState.vocalState.uiState || null
            };
        } else if (projectState.vocalState && projectState.vocalState.engineData) {
            // No audio but engine params exist (correction settings etc.)
            const vocalFolder = zip.folder("vocal");
            vocalFolder.file("state.json", JSON.stringify(projectState.vocalState.engineData, null, 2));
            manifest.vocalState = {
                hasAudio: false,
                statePath: "vocal/state.json",
                audioFileName: projectState.vocalState.audioFileName || null,
                uiState: projectState.vocalState.uiState || null
            };
        }

        // Add manifest to zip
        zip.file("project.json", JSON.stringify(manifest, null, 2));

        if (onProgress) onProgress(50, "Compressing Project...");

        // Generate Final Zip
        const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
            if (onProgress) {
                const zipPercent = metadata.percent;
                // Map 0-100 to 50-100
                const totalPercent = 50 + (zipPercent * 0.5);
                onProgress(totalPercent, `Compressing: ${metadata.currentFile || 'data'}...`);
            }
        });

        if (onProgress) onProgress(100, "Done!");

        return {
            blob: content,
            // Zip Filename: "Genre - Mood - Key Scale - BPM BPM.wlz"
            filename: `${safeGenre} - ${safeMood} - ${key} ${scale} - ${bpm} BPM.wlz`
        };
    }

    /**
     * D5: Validate manifest schema. Ensures plain object, clamps numeric DSP fields,
     * caps string lengths, and drops dangerous shapes. Returns sanitized manifest.
     */
    _validateManifest(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new Error('Invalid project manifest: not an object');
        }

        const STR_MAX = 1024;
        const clampStr = (s) => (typeof s === 'string' ? s.slice(0, STR_MAX) : s);
        const clampNum = (v, lo, hi, fallback) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
            return Math.min(hi, Math.max(lo, v));
        };

        // Sanitize globalSettings (BPM/key/scale/genre/mood/etc.)
        const gs = (raw.globalSettings && typeof raw.globalSettings === 'object' && !Array.isArray(raw.globalSettings))
            ? { ...raw.globalSettings } : {};
        if ('tempo' in gs) gs.tempo = clampNum(gs.tempo, 20, 999, 120);
        if ('bars' in gs) gs.bars = clampNum(gs.bars, 1, 1024, 4);
        if ('octaves' in gs) gs.octaves = clampNum(gs.octaves, 1, 10, 4);
        if ('resolution' in gs) gs.resolution = clampNum(gs.resolution, 1, 64, 16);
        if (typeof gs.key === 'string') gs.key = clampStr(gs.key);
        if (typeof gs.scale === 'string') gs.scale = clampStr(gs.scale);
        if (typeof gs.genre === 'string') gs.genre = clampStr(gs.genre);
        if (typeof gs.mood === 'string') gs.mood = clampStr(gs.mood);
        raw.globalSettings = gs;

        // Sanitize drumParams (numeric DSP fields used by setDrumParam)
        if (raw.drumParams && typeof raw.drumParams === 'object' && !Array.isArray(raw.drumParams)) {
            const dp = {};
            for (const [drumId, params] of Object.entries(raw.drumParams)) {
                if (typeof drumId !== 'string' || drumId.length > STR_MAX) continue;
                if (!params || typeof params !== 'object' || Array.isArray(params)) continue;
                const sanitized = {};
                for (const [k, v] of Object.entries(params)) {
                    if (typeof k !== 'string' || k.length > STR_MAX) continue;
                    if (typeof v === 'number' && Number.isFinite(v)) {
                        // Generic safe clamp for any numeric DSP field
                        sanitized[k] = clampNum(v, -100000, 100000, 0);
                    } else if (typeof v === 'string') {
                        sanitized[k] = clampStr(v);
                    } else if (typeof v === 'boolean') {
                        sanitized[k] = v;
                    }
                }
                dp[drumId] = sanitized;
            }
            raw.drumParams = dp;
        } else if (raw.drumParams !== undefined) {
            raw.drumParams = {};
        }

        // Sanitize mixer numeric fields (volume, pan, gain)
        if (raw.mixer && typeof raw.mixer === 'object' && !Array.isArray(raw.mixer)) {
            for (const trackKey of Object.keys(raw.mixer)) {
                const tr = raw.mixer[trackKey];
                if (!tr || typeof tr !== 'object' || Array.isArray(tr)) continue;
                if ('volume' in tr) tr.volume = clampNum(tr.volume, 0, 4, 1);
                if ('pan' in tr) tr.pan = clampNum(tr.pan, -1, 1, 0);
                if ('gain' in tr) tr.gain = clampNum(tr.gain, 0, 4, 1);
            }
        }

        // Cap top-level numeric / string fields
        if ('timelineBars' in raw) raw.timelineBars = clampNum(raw.timelineBars, 1, 4096, 48);
        if (typeof raw.projectName === 'string') raw.projectName = clampStr(raw.projectName);
        if (typeof raw.version === 'string') raw.version = clampStr(raw.version);

        // sampleMap, instrumentMeta: ensure plain objects
        if (raw.sampleMap && (typeof raw.sampleMap !== 'object' || Array.isArray(raw.sampleMap))) {
            raw.sampleMap = {};
        }
        if (raw.instrumentMeta && (typeof raw.instrumentMeta !== 'object' || Array.isArray(raw.instrumentMeta))) {
            raw.instrumentMeta = {};
        }

        return raw;
    }

    /**
     * Load Project from .wlz
     */
    async loadProject(file) {
        // D2: File size cap (200 MB)
        if (file && typeof file.size === 'number' && file.size > 200 * 1024 * 1024) {
            throw new Error('Project file too large (> 200 MB)');
        }

        const zip = await JSZip.loadAsync(file);

        // D2: Entry count + total uncompressed size caps
        const entryNames = Object.keys(zip.files);
        if (entryNames.length > 1024) {
            throw new Error('Project archive has too many entries (> 1024)');
        }
        let totalUncompressed = 0;
        for (const name of entryNames) {
            const ent = zip.files[name];
            if (ent && ent._data && typeof ent._data.uncompressedSize === 'number') {
                totalUncompressed += ent._data.uncompressedSize;
            }
        }
        if (totalUncompressed > 1024 * 1024 * 1024) {
            throw new Error('Project archive uncompressed size exceeds 1 GB');
        }

        // 1. Read Manifest
        const manifestFile = zip.file("project.json");
        if (!manifestFile) throw new Error('Project archive missing project.json');
        const manifestStr = await manifestFile.async("string");
        let manifest = JSON.parse(manifestStr);

        // D5: Validate manifest is a plain object and sanitize known fields
        manifest = this._validateManifest(manifest);

        // D2: Path allowlist for any zip entries referenced by manifest
        const safePathRe = /^(samples|midi|audio-clips|vocal)\/[A-Za-z0-9._\-\/ ]+$/;
        const isSafePath = (p) => typeof p === 'string'
            && p.length <= 1024
            && !p.includes('..')
            && safePathRe.test(p);

        // 2. Load Samples
        // We need to fetch blobs from zip and decode them
        const sampleMap = manifest.sampleMap || {};

        // D2: Move clearAll() to AFTER manifest validation succeeds
        this.sampler.clearAll();

        for (const [instrumentId, noteMap] of Object.entries(sampleMap)) {
            const samples = [];

            for (const [note, path] of Object.entries(noteMap)) {
                // D2: Validate path against allowlist
                if (!isSafePath(path)) {
                    console.warn(`[ProjectManager] Rejecting unsafe sample path: ${path}`);
                    continue;
                }
                const sampleFile = zip.file(path);
                if (!sampleFile) {
                    console.warn(`[ProjectManager] Sample missing in archive: ${path}`);
                    continue;
                }
                // D2: Per-sample try/catch — one bad file shouldn't abort the load
                try {
                    const fileData = await sampleFile.async("arraybuffer");
                    const audioBuffer = await this.sampler.audioContext.decodeAudioData(fileData);
                    samples.push({
                        note: parseInt(note),
                        buffer: audioBuffer,
                        name: instrumentId // Simple name
                    });
                } catch (e) {
                    console.warn(`[ProjectManager] Failed to decode sample ${path}:`, e);
                }
            }

            // Fetch display name if saved
            const displayName = manifest.instrumentMeta ? manifest.instrumentMeta[instrumentId] : null;

            // Load into sampler
            this.sampler.loadInstrument(instrumentId, samples, displayName);
        }

        // 3. Restore DSP Params
        if (manifest.drumParams) {
            Object.entries(manifest.drumParams).forEach(([drumId, params]) => {
                // Apply each param to sampler
                Object.entries(params).forEach(([param, value]) => {
                    this.sampler.setDrumParam(drumId, param, value);
                });
            });
        }

        // 4. Load Audio Tracks
        if (manifest.audioTracks && manifest.audioTracks.length > 0) {
            const loadedAudioTracks = [];
            for (const trackMeta of manifest.audioTracks) {
                // Create audio bus in sampler
                this.sampler.addTrackBus(trackMeta.id);
                const clips = [];
                for (const clipMeta of trackMeta.clips) {
                    try {
                        // D2: Validate path
                        if (!isSafePath(clipMeta.path)) {
                            console.warn(`[ProjectManager] Rejecting unsafe clip path: ${clipMeta.path}`);
                            continue;
                        }
                        const clipFile = zip.file(clipMeta.path);
                        if (!clipFile) continue;
                        const arrayBuf = await clipFile.async("arraybuffer");
                        const audioBuffer = await this.sampler.audioContext.decodeAudioData(arrayBuf);
                        clips.push({
                            id: clipMeta.id, sectionId: clipMeta.sectionId, buffer: audioBuffer,
                            name: clipMeta.name, playbackRate: clipMeta.playbackRate || 1.0,
                            trimStart: clipMeta.trimStart || 0, trimEnd: clipMeta.trimEnd || 0,
                            reversed: clipMeta.reversed || false, pitch: clipMeta.pitch || 0,
                            fadeIn: clipMeta.fadeIn || 0, fadeOut: clipMeta.fadeOut || 0,
                            startBar: clipMeta.startBar || 0,
                            timelineBar: clipMeta.timelineBar != null ? clipMeta.timelineBar : null
                        });
                    } catch (e) {
                        console.warn(`Failed to load audio clip ${clipMeta.name}:`, e);
                    }
                }
                loadedAudioTracks.push({ id: trackMeta.id, name: trackMeta.name, color: trackMeta.color, clips });
            }
            manifest.audioTracks = loadedAudioTracks;
        }

        // 5. Load Vocal State + Audio
        if (manifest.vocalState) {
            const vs = manifest.vocalState;
            // Load vocal engine params
            if (vs.statePath) {
                try {
                    if (!isSafePath(vs.statePath)) {
                        console.warn(`[ProjectManager] Rejecting unsafe vocal state path: ${vs.statePath}`);
                    } else {
                        const stateFile = zip.file(vs.statePath);
                        if (stateFile) {
                            const stateStr = await stateFile.async("string");
                            manifest.vocalState.engineData = JSON.parse(stateStr);
                        }
                    }
                } catch (e) {
                    console.warn('[ProjectManager] Failed to load vocal state:', e);
                }
            }
            // Load vocal audio buffer
            if (vs.hasAudio && vs.audioPath) {
                try {
                    if (!isSafePath(vs.audioPath)) {
                        console.warn(`[ProjectManager] Rejecting unsafe vocal audio path: ${vs.audioPath}`);
                    } else {
                        const audioFile = zip.file(vs.audioPath);
                        if (audioFile) {
                            const arrayBuf = await audioFile.async("arraybuffer");
                            const audioBuffer = await this.sampler.audioContext.decodeAudioData(arrayBuf);
                            manifest.vocalState.audioBuffer = audioBuffer;
                        }
                    }
                } catch (e) {
                    console.warn('[ProjectManager] Failed to load vocal audio:', e);
                }
            }
        }

        // Backward compatibility: migrate old section-based projects to clip-based
        if (!manifest.version || manifest.version < '2.0.0') {
            if (manifest.arrangement && Array.isArray(manifest.arrangement) && manifest.arrangement.length > 0) {
                const drumClips = [];
                const chordClips = [];
                const melodyClips = [];
                const bassClips = [];
                let barOffset = 0;

                for (const section of manifest.arrangement) {
                    const bars = section.bars || 4;
                    // Convert section patterns to clips at absolute bar positions
                    if (section.patterns?.drums) {
                        drumClips.push({
                            id: `migrated_drum_${barOffset}`,
                            timelineBar: barOffset,
                            bars,
                            drumStates: section.patterns.drums,
                            name: `Drums (${section.name || 'Section'})`,
                            color: section.color || '#ff6b6b'
                        });
                    }
                    if (section.patterns?.chords && Array.isArray(section.patterns.chords) && section.patterns.chords.length > 0) {
                        chordClips.push({
                            id: `migrated_chord_${barOffset}`,
                            timelineBar: barOffset,
                            bars,
                            pattern: section.patterns.chords,
                            name: `Chords (${section.name || 'Section'})`,
                            color: section.color || '#3498db'
                        });
                    }
                    if (section.patterns?.melody && Array.isArray(section.patterns.melody) && section.patterns.melody.length > 0) {
                        melodyClips.push({
                            id: `migrated_melody_${barOffset}`,
                            timelineBar: barOffset,
                            bars,
                            pattern: section.patterns.melody,
                            name: `Melody (${section.name || 'Section'})`,
                            color: section.color || '#2ecc71'
                        });
                    }
                    if (section.patterns?.bass && Array.isArray(section.patterns.bass) && section.patterns.bass.length > 0) {
                        bassClips.push({
                            id: `migrated_bass_${barOffset}`,
                            timelineBar: barOffset,
                            bars,
                            pattern: section.patterns.bass,
                            name: `Bass (${section.name || 'Section'})`,
                            color: section.color || '#9b59b6'
                        });
                    }
                    barOffset += bars;
                }

                manifest.drumClips = drumClips;
                manifest.chordClips = chordClips;
                manifest.melodyClips = melodyClips;
                manifest.bassClips = bassClips;
                manifest.timelineBars = Math.max(barOffset, 48);
                // Use first section's mix as global mix if available
                manifest.loopRange = null;
                manifest.version = '2.0.0';
            } else {
                manifest.timelineBars = 48;
                manifest.drumClips = manifest.drumClips || [];
                manifest.chordClips = manifest.chordClips || [];
                manifest.melodyClips = manifest.melodyClips || [];
                manifest.bassClips = manifest.bassClips || [];
                manifest.loopRange = null;
            }
        }

        return manifest; // Return state for App to update React state
    }

    // --- MIDI Helpers ---

    generateSingleDrumMidi(drumData, drumId, bpm) {
        if (!drumData || !drumData.lanes || !drumData.lanes.root) return null;

        // Create a single track MIDI
        // Use MidiExporter's helpers if possible, or replicate simple logic

        const track = [];
        track.push({ deltaTime: 0, type: 'trackName', text: drumId });

        const ticksPerQuarter = 480;
        // Steps per beat = 4 (for 16th notes usually)
        // 1 step = ticksPerQuarter / 4

        const events = [];
        const pattern = drumData.lanes.root.pattern;

        pattern.forEach((isActive, step) => {
            if (isActive) {
                const tick = step * (ticksPerQuarter / 4);
                events.push({ tick, type: 'noteOn', note: 60, velocity: 100, channel: 9 });
                events.push({ tick: tick + (ticksPerQuarter / 8), type: 'noteOff', note: 60, velocity: 0, channel: 9 });
            }
        });

        return this.encodeMidiTrack(track, events, bpm);
    }

    generateMelodicMidi(type, pattern, bpm) {
        if (!pattern || !Array.isArray(pattern)) return null;

        const track = [];
        track.push({ deltaTime: 0, type: 'trackName', text: type });
        const events = [];
        const ticksPerQuarter = 480;
        const ticksPerStep = ticksPerQuarter / 8; // 32 steps per 4 beats (1 bar) -> 8 steps per beat

        pattern.forEach(n => {
            const tick = n.time * ticksPerStep;
            const duration = (n.duration || 1) * ticksPerStep;
            const note = n.note || 60;
            const velocity = Math.floor((n.velocity || 0.8) * 127);

            events.push({ tick, type: 'noteOn', note, velocity, channel: 0 });
            events.push({ tick: tick + duration, type: 'noteOff', note, velocity: 0, channel: 0 });
        });

        return this.encodeMidiTrack(track, events, bpm);
    }

    // Helper to encode a single track MIDI file using MidiExporter's low-level methods
    encodeMidiTrack(trackHeaderEvents, noteEvents, bpm) {
        // Sort note events
        noteEvents.sort((a, b) => a.tick - b.tick);

        // Convert to delta
        let lastTick = 0;
        noteEvents.forEach(e => {
            const delta = e.tick - lastTick;
            trackHeaderEvents.push({
                deltaTime: delta,
                type: e.type,
                channel: e.channel,
                noteNumber: e.note,
                velocity: e.velocity
            });
            lastTick = e.tick;
        });
        trackHeaderEvents.push({ deltaTime: 0, type: 'endOfTrack' });

        // Create buffer
        // Borrowing methods from MidiExporter instance
        if (!this.midiExporter) return null;

        const trackChunk = this.midiExporter.writeMidiTrack(trackHeaderEvents);

        // Create Header (1 track)
        const header = this.midiExporter.writeMidiHeader(1);

        // Combine
        const total = header.length + trackChunk.length;
        const buffer = new Uint8Array(total);
        buffer.set(header, 0);
        buffer.set(trackChunk, header.length);

        return new Blob([buffer], { type: 'audio/midi' });
    }
}
