// MidiExporter.js - Export MIDI files from sequencer patterns
import JSZip from 'jszip';

class MidiExporter {
    constructor() {
        this.ticksPerQuarterNote = 480;
    }

    // Export current pattern to MIDI file (Combined)
    exportPattern(sequencer) {
        const tracks = [];

        // Track 0: Tempo and time signature
        const tempoTrack = this.createTempoTrack(sequencer.tempo);
        tracks.push(tempoTrack);

        // Track 1: Drums
        if (sequencer.drumGrid) {
            const drumTrack = this.createDrumTrack(sequencer);
            tracks.push(drumTrack);
        }

        // Track 2: Melody
        if (sequencer.melodyGrid) {
            const melodyTrack = this.createMelodyTrack(sequencer);
            tracks.push(melodyTrack);
        }

        // Track 3: Chords
        if (sequencer.chordGrid) {
            const chordTrack = this.createChordTrack(sequencer);
            tracks.push(chordTrack);
        }

        return this.createMidiFile(tracks);
    }

    /**
     * Export individual tracks as a Zip of MIDI files
     */
    async exportStems(sequencer) {
        const zip = new JSZip();
        const tempoTrack = this.createTempoTrack(sequencer.tempo);

        // Drums
        if (sequencer.drumGrid) {
            const drumTrack = this.createDrumTrack(sequencer);
            const midiData = this.createMidiFile([tempoTrack, drumTrack]);
            zip.file('Drums.mid', midiData);
        }

        // Melody
        if (sequencer.melodyGrid) {
            const melodyTrack = this.createMelodyTrack(sequencer);
            const midiData = this.createMidiFile([tempoTrack, melodyTrack]);
            zip.file('Melody.mid', midiData);
        }

        // Chords
        if (sequencer.chordGrid) {
            const chordTrack = this.createChordTrack(sequencer);
            const midiData = this.createMidiFile([tempoTrack, chordTrack]);
            zip.file('Chords.mid', midiData);
        }

        // Bass (if it exists in sequencer, need to check data structure)
        // Assuming AudioExporter had it, let's check if sequencer has it.
        // The original code didn't have Bass in exportPattern, but AudioExporter did.
        // Use sequencer.bassGrid if available.
        if (sequencer.bassGrid) {
            const bassTrack = this.createBassTrack(sequencer);
            const midiData = this.createMidiFile([tempoTrack, bassTrack]);
            zip.file('Bass.mid', midiData);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        return {
            blob: zipBlob,
            filename: `freally_midi_stems_${Date.now()}.zip`
        };
    }

    createTempoTrack(bpm) {
        const track = [];

        // Track name
        track.push({ deltaTime: 0, type: 'trackName', text: 'Tempo Track' });

        // Time signature (4/4)
        track.push({
            deltaTime: 0,
            type: 'timeSignature',
            numerator: 4,
            denominator: 4,
            metronome: 24,
            thirtyseconds: 8
        });

        // Tempo
        const microsecondsPerBeat = Math.floor(60000000 / bpm);
        track.push({ deltaTime: 0, type: 'setTempo', microsecondsPerBeat });

        // End of track
        track.push({ deltaTime: 0, type: 'endOfTrack' });

        return track;
    }

    createDrumTrack(sequencer) {
        const track = [];
        track.push({ deltaTime: 0, type: 'trackName', text: 'Drums' });

        // MIDI drum map (General MIDI)
        const drumNoteMap = {
            0: 36, // Kick -> Bass Drum 1
            1: 38, // Snare -> Acoustic Snare
            2: 42, // Closed Hat -> Closed Hi-Hat
            3: 46, // Open Hat -> Open Hi-Hat
            4: 47, // Tom -> Low-Mid Tom
            5: 39  // Clap -> Hand Clap
        };

        const events = [];

        // Convert grid to MIDI events
        for (let row = 0; row < sequencer.drumRows; row++) {
            const midiNote = drumNoteMap[row];
            if (!midiNote) continue;

            for (let step = 0; step < sequencer.steps; step++) {
                if (sequencer.drumGrid[row][step]) {
                    const tick = step * (this.ticksPerQuarterNote / 4); // 16th notes
                    events.push({
                        tick,
                        type: 'noteOn',
                        channel: 9, // Drum channel
                        note: midiNote,
                        velocity: 100
                    });
                    events.push({
                        tick: tick + (this.ticksPerQuarterNote / 8), // Short note
                        type: 'noteOff',
                        channel: 9,
                        note: midiNote,
                        velocity: 0
                    });
                }
            }
        }

        // Sort events by tick
        events.sort((a, b) => a.tick - b.tick);

        // Convert to delta time
        let lastTick = 0;
        events.forEach(event => {
            const deltaTime = event.tick - lastTick;
            track.push({
                deltaTime,
                type: event.type === 'noteOn' ? 'noteOn' : 'noteOff',
                channel: event.channel,
                noteNumber: event.note,
                velocity: event.velocity
            });
            lastTick = event.tick;
        });

        track.push({ deltaTime: 0, type: 'endOfTrack' });
        return track;
    }

    /**
     * Create a MIDI drum track from drum clips (clip-based timeline)
     */
    createDrumTrackFromClips(clips) {
        const track = [];
        track.push({ deltaTime: 0, type: 'trackName', text: 'Drums' });

        // GM drum map by drum ID
        const drumMidiMap = {
            kick: 36, snare: 38, closedHat: 42, openHat: 46,
            clap: 39, offSnare: 37, '808': 35, rim: 37, perc: 47
        };

        const events = [];
        const ticksPerStep = this.ticksPerQuarterNote / 8; // 32 steps per bar = 8 steps per beat

        for (const clip of clips) {
            const clipStartTick = (clip.timelineBar || 0) * 4 * this.ticksPerQuarterNote; // bars to ticks
            const ds = clip.drumStates;
            if (!ds) continue;

            Object.entries(ds).forEach(([drumId, drum]) => {
                if (!drum.powered || drum.mute) return;
                const midiNote = drumMidiMap[drumId] || 47;

                Object.values(drum.lanes).forEach(lane => {
                    lane.pattern.forEach((active, step) => {
                        if (!active) return;
                        const tick = clipStartTick + step * ticksPerStep;
                        const velocity = Math.round(((lane.velocity[step] || 100) / 100) * 127);
                        events.push({ tick, type: 'noteOn', channel: 9, note: midiNote, velocity });
                        events.push({ tick: tick + ticksPerStep / 2, type: 'noteOff', channel: 9, note: midiNote, velocity: 0 });
                    });
                });
            });
        }

        events.sort((a, b) => a.tick - b.tick);

        let lastTick = 0;
        events.forEach(event => {
            const deltaTime = event.tick - lastTick;
            track.push({
                deltaTime,
                type: event.type === 'noteOn' ? 'noteOn' : 'noteOff',
                channel: event.channel,
                noteNumber: event.note,
                velocity: event.velocity
            });
            lastTick = event.tick;
        });

        track.push({ deltaTime: 0, type: 'endOfTrack' });
        return track;
    }

    /**
     * Create a MIDI track from note-based clips (chords/melody/bass)
     */
    createNoteTrackFromClips(clips, trackName, channel = 0) {
        const track = [];
        track.push({ deltaTime: 0, type: 'trackName', text: trackName });
        const events = [];
        const ticksPerStep = this.ticksPerQuarterNote / 8;

        for (const clip of clips) {
            const clipOffsetTicks = (clip.timelineBar || 0) * 4 * this.ticksPerQuarterNote;
            for (const n of (clip.pattern || [])) {
                const tick = clipOffsetTicks + n.time * ticksPerStep;
                const durTicks = Math.max(ticksPerStep / 2, n.duration * ticksPerStep);
                const velocity = Math.round((n.velocity || 0.8) * 127);
                events.push({ tick, type: 'noteOn', channel, note: n.note, velocity });
                events.push({ tick: tick + durTicks, type: 'noteOff', channel, note: n.note, velocity: 0 });
            }
        }

        events.sort((a, b) => a.tick - b.tick);
        let lastTick = 0;
        events.forEach(event => {
            track.push({ deltaTime: event.tick - lastTick, type: event.type === 'noteOn' ? 'noteOn' : 'noteOff', channel: event.channel, noteNumber: event.note, velocity: event.velocity });
            lastTick = event.tick;
        });
        track.push({ deltaTime: 0, type: 'endOfTrack' });
        return track;
    }

    createMelodyTrack(sequencer) {
        const track = [];
        track.push({ deltaTime: 0, type: 'trackName', text: 'Melody' });

        const events = [];

        for (let row = 0; row < sequencer.melodyRows; row++) {
            for (let step = 0; step < sequencer.steps; step++) {
                const noteData = sequencer.melodyGrid[row][step];
                if (noteData) {
                    const tick = step * (this.ticksPerQuarterNote / 4);
                    const duration = (noteData.length || 1) * (this.ticksPerQuarterNote / 4);
                    const velocity = noteData.velocity || 80;

                    events.push({
                        tick,
                        type: 'noteOn',
                        channel: 0,
                        note: row, // Row index IS the MIDI note (C0-C8)
                        velocity
                    });
                    events.push({
                        tick: tick + duration,
                        type: 'noteOff',
                        channel: 0,
                        note: row,
                        velocity: 0
                    });
                }
            }
        }

        events.sort((a, b) => a.tick - b.tick);

        let lastTick = 0;
        events.forEach(event => {
            const deltaTime = event.tick - lastTick;
            track.push({
                deltaTime,
                type: event.type === 'noteOn' ? 'noteOn' : 'noteOff',
                channel: event.channel,
                noteNumber: event.note,
                velocity: event.velocity
            });
            lastTick = event.tick;
        });

        track.push({ deltaTime: 0, type: 'endOfTrack' });
        return track;
    }

    createChordTrack(sequencer) {
        const track = [];
        track.push({ deltaTime: 0, type: 'trackName', text: 'Chords' });

        const events = [];

        for (let row = 0; row < sequencer.chordRows; row++) {
            for (let step = 0; step < sequencer.steps; step++) {
                if (sequencer.chordGrid[row][step]) {
                    const tick = step * (this.ticksPerQuarterNote / 4);
                    const duration = this.ticksPerQuarterNote; // Whole beat

                    // Build chord notes
                    const scaleArr = sequencer.scaleIntervals[sequencer.scale] || sequencer.scaleIntervals['Minor'];
                    const extendedScale = [...scaleArr, ...scaleArr.map(n => n + 12)];
                    const notes = [
                        sequencer.rootNote + extendedScale[row],
                        sequencer.rootNote + extendedScale[row + 2],
                        sequencer.rootNote + extendedScale[row + 4]
                    ];

                    // Add note on/off for each chord note
                    notes.forEach(note => {
                        events.push({
                            tick,
                            type: 'noteOn',
                            channel: 1,
                            note,
                            velocity: 70
                        });
                        events.push({
                            tick: tick + duration,
                            type: 'noteOff',
                            channel: 1,
                            note,
                            velocity: 0
                        });
                    });
                }
            }
        }

        events.sort((a, b) => a.tick - b.tick);

        let lastTick = 0;
        events.forEach(event => {
            const deltaTime = event.tick - lastTick;
            track.push({
                deltaTime,
                type: event.type === 'noteOn' ? 'noteOn' : 'noteOff',
                channel: event.channel,
                noteNumber: event.note,
                velocity: event.velocity
            });
            lastTick = event.tick;
        });

        track.push({ deltaTime: 0, type: 'endOfTrack' });
        return track;
    }

    // Basic Bass implemented for completion
    createBassTrack(sequencer) {
        const track = [];
        track.push({ deltaTime: 0, type: 'trackName', text: 'Bass' });

        const events = [];

        // Similar logic to melody but for bass
        for (let row = 0; row < (sequencer.bassRows || 0); row++) {
            for (let step = 0; step < sequencer.steps; step++) {
                const noteData = sequencer.bassGrid[row][step];
                if (noteData) {
                    const tick = step * (this.ticksPerQuarterNote / 4);
                    const duration = (noteData.length || 1) * (this.ticksPerQuarterNote / 4);
                    const velocity = noteData.velocity || 80;

                    events.push({
                        tick,
                        type: 'noteOn',
                        channel: 2,
                        note: row,
                        velocity
                    });
                    events.push({
                        tick: tick + duration,
                        type: 'noteOff',
                        channel: 2,
                        note: row,
                        velocity: 0
                    });
                }
            }
        }

        events.sort((a, b) => a.tick - b.tick);

        let lastTick = 0;
        events.forEach(event => {
            const deltaTime = event.tick - lastTick;
            track.push({
                deltaTime,
                type: event.type === 'noteOn' ? 'noteOn' : 'noteOff',
                channel: event.channel,
                noteNumber: event.note,
                velocity: event.velocity
            });
            lastTick = event.tick;
        });

        track.push({ deltaTime: 0, type: 'endOfTrack' });
        return track;
    }


    createMidiFile(tracks) {
        // Simple MIDI file format implementation
        const header = this.writeMidiHeader(tracks.length);
        const trackChunks = tracks.map(track => this.writeMidiTrack(track));

        // Combine all chunks
        const totalLength = header.length + trackChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const buffer = new Uint8Array(totalLength);

        let offset = 0;
        buffer.set(header, offset);
        offset += header.length;

        trackChunks.forEach(chunk => {
            buffer.set(chunk, offset);
            offset += chunk.length;
        });

        return buffer;
    }

    writeMidiHeader(numTracks) {
        const buffer = new Uint8Array(14);

        // "MThd"
        buffer[0] = 0x4D;
        buffer[1] = 0x54;
        buffer[2] = 0x68;
        buffer[3] = 0x64;

        // Header length (6 bytes)
        buffer[4] = 0x00;
        buffer[5] = 0x00;
        buffer[6] = 0x00;
        buffer[7] = 0x06;

        // Format type (1 = multiple tracks, synchronous)
        buffer[8] = 0x00;
        buffer[9] = 0x01;

        // Number of tracks
        buffer[10] = (numTracks >> 8) & 0xFF;
        buffer[11] = numTracks & 0xFF;

        // Ticks per quarter note
        buffer[12] = (this.ticksPerQuarterNote >> 8) & 0xFF;
        buffer[13] = this.ticksPerQuarterNote & 0xFF;

        return buffer;
    }

    writeMidiTrack(events) {
        // Convert events to bytes
        const eventBytes = [];

        events.forEach(event => {
            // Write delta time as variable length
            const deltaBytes = this.writeVariableLength(event.deltaTime);
            eventBytes.push(...deltaBytes);

            // Write event
            if (event.type === 'noteOn') {
                eventBytes.push(0x90 | event.channel); // Note On
                eventBytes.push(event.noteNumber);
                eventBytes.push(event.velocity);
            } else if (event.type === 'noteOff') {
                eventBytes.push(0x80 | event.channel); // Note Off
                eventBytes.push(event.noteNumber);
                eventBytes.push(event.velocity);
            } else if (event.type === 'trackName') {
                eventBytes.push(0xFF, 0x03); // Track name meta event
                const nameBytes = this.stringToBytes(event.text);
                eventBytes.push(...this.writeVariableLength(nameBytes.length));
                eventBytes.push(...nameBytes);
            } else if (event.type === 'timeSignature') {
                eventBytes.push(0xFF, 0x58, 0x04); // Time signature meta event
                eventBytes.push(event.numerator);
                eventBytes.push(Math.log2(event.denominator));
                eventBytes.push(event.metronome);
                eventBytes.push(event.thirtyseconds);
            } else if (event.type === 'setTempo') {
                eventBytes.push(0xFF, 0x51, 0x03); // Set tempo meta event
                eventBytes.push((event.microsecondsPerBeat >> 16) & 0xFF);
                eventBytes.push((event.microsecondsPerBeat >> 8) & 0xFF);
                eventBytes.push(event.microsecondsPerBeat & 0xFF);
            } else if (event.type === 'endOfTrack') {
                eventBytes.push(0xFF, 0x2F, 0x00); // End of track
            }
        });

        // Create track chunk
        const trackLength = eventBytes.length;
        const buffer = new Uint8Array(8 + trackLength);

        // "MTrk"
        buffer[0] = 0x4D;
        buffer[1] = 0x54;
        buffer[2] = 0x72;
        buffer[3] = 0x6B;

        // Track length
        buffer[4] = (trackLength >> 24) & 0xFF;
        buffer[5] = (trackLength >> 16) & 0xFF;
        buffer[6] = (trackLength >> 8) & 0xFF;
        buffer[7] = trackLength & 0xFF;

        // Track data
        buffer.set(eventBytes, 8);

        return buffer;
    }

    writeVariableLength(value) {
        const bytes = [];
        bytes.push(value & 0x7F);

        value >>= 7;
        while (value > 0) {
            bytes.unshift((value & 0x7F) | 0x80);
            value >>= 7;
        }

        return bytes;
    }

    stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    }

    /**
     * Export selected generator patterns as MIDI files.
     * @param {Object} patternData - { drums, chords, melody, bass } raw pattern data
     * @param {number} tempo - BPM
     * @param {Object} selected - { drums: bool, chords: bool, melody: bool, bass: bool }
     * @param {string} projectName - for filename
     * @returns {Promise<{blob: Blob, filename: string}>}
     */
    async exportGeneratorMIDI(patternData, tempo, selected, projectName = 'Freally') {
        const tempoTrack = this.createTempoTrack(tempo);
        const generatedTracks = [];
        const labels = [];

        // Drums — wrap drum states as a single clip at bar 0 (skip if empty)
        if (selected.drums && patternData.drums && typeof patternData.drums === 'object' && Object.keys(patternData.drums).length > 0) {
            const clip = { timelineBar: 0, drumStates: patternData.drums };
            const track = this.createDrumTrackFromClips([clip]);
            // Only include if the track has actual note events (not just header/footer)
            const hasNotes = track.some(e => e.type === 'noteOn');
            if (hasNotes) {
                generatedTracks.push({ name: 'Drums', track });
                labels.push('Drums');
            }
        }

        // Chords — wrap note array as a single clip at bar 0
        if (selected.chords && patternData.chords && patternData.chords.length > 0) {
            const clip = { timelineBar: 0, pattern: patternData.chords };
            const track = this.createNoteTrackFromClips([clip], 'Chords', 1);
            generatedTracks.push({ name: 'Chords', track });
            labels.push('Chords');
        }

        // Melody
        if (selected.melody && patternData.melody && patternData.melody.length > 0) {
            const clip = { timelineBar: 0, pattern: patternData.melody };
            const track = this.createNoteTrackFromClips([clip], 'Melody', 0);
            generatedTracks.push({ name: 'Melody', track });
            labels.push('Melody');
        }

        // Bass
        if (selected.bass && patternData.bass && patternData.bass.length > 0) {
            const clip = { timelineBar: 0, pattern: patternData.bass };
            const track = this.createNoteTrackFromClips([clip], 'Bass', 2);
            generatedTracks.push({ name: 'Bass', track });
            labels.push('Bass');
        }

        if (generatedTracks.length === 0) {
            return null; // nothing selected or no data
        }

        // Single generator → single .mid file; multiple → zip
        if (generatedTracks.length === 1) {
            const midiData = this.createMidiFile([tempoTrack, generatedTracks[0].track]);
            const blob = new Blob([midiData], { type: 'audio/midi' });
            return { blob, filename: `${projectName}_${generatedTracks[0].name}.mid` };
        }

        // Multiple generators → zip of .mid files
        const zip = new JSZip();
        for (const gt of generatedTracks) {
            const midiData = this.createMidiFile([tempoTrack, gt.track]);
            zip.file(`${gt.name}.mid`, midiData);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        return { blob: zipBlob, filename: `${projectName}_MIDI_${labels.join('_')}.zip` };
    }

    // Download MIDI file (Updated for Blob/Zip usage mostly)
    downloadMidi(sequencer, filename = 'freally_pattern.mid') {
        const midiData = this.exportPattern(sequencer);
        const blob = new Blob([midiData], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }
}

const midiExporter = new MidiExporter();
window.midiExporter = midiExporter;

export default midiExporter;
