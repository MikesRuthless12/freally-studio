// MIDI File Parser - Extract patterns from .mid files
import { SCALES } from './MusicTheory';

export class MIDIParser {
    constructor() {
        this.ticksPerBeat = 480;
    }

    /**
     * Parse MIDI file from ArrayBuffer
     */
    async parseMIDIFile(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        let offset = 0;

        // Parse header chunk
        const header = this.parseHeader(dataView, offset);
        offset += 14;

        // Parse tracks
        const tracks = [];
        for (let i = 0; i < header.numTracks; i++) {
            const track = this.parseTrack(dataView, offset);
            tracks.push(track);
            offset += track.length + 8;
        }

        // Extract tempo from first setTempo event across all tracks
        let midiTempo = null;
        for (const track of tracks) {
            for (const ev of track.events) {
                if (ev.type === 'setTempo') {
                    midiTempo = ev.bpm;
                    break;
                }
            }
            if (midiTempo) break;
        }

        return {
            format: header.format,
            numTracks: header.numTracks,
            ticksPerBeat: header.ticksPerBeat,
            tempo: midiTempo,
            tracks
        };
    }

    /**
     * Parse MIDI header
     */
    parseHeader(dataView, offset) {
        // Check "MThd" identifier
        const id = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );

        if (id !== 'MThd') {
            throw new Error('Invalid MIDI file: Missing MThd header');
        }

        const length = dataView.getUint32(offset + 4);
        const format = dataView.getUint16(offset + 8);
        const numTracks = dataView.getUint16(offset + 10);
        const ticksPerBeat = dataView.getUint16(offset + 12);

        this.ticksPerBeat = ticksPerBeat;

        return { format, numTracks, ticksPerBeat };
    }

    /**
     * Parse MIDI track
     */
    parseTrack(dataView, offset) {
        // Check "MTrk" identifier
        const id = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );

        if (id !== 'MTrk') {
            throw new Error('Invalid MIDI track: Missing MTrk header');
        }

        const length = dataView.getUint32(offset + 4);
        const events = [];
        let eventOffset = offset + 8;
        const trackEnd = offset + 8 + length;
        let currentTick = 0;
        let runningStatus = 0;

        while (eventOffset < trackEnd) {
            // Read delta time
            const deltaTime = this.readVariableLength(dataView, eventOffset);
            eventOffset += deltaTime.length;
            currentTick += deltaTime.value;

            // Read event
            let statusByte = dataView.getUint8(eventOffset);

            // Handle running status
            if (statusByte < 0x80) {
                statusByte = runningStatus;
            } else {
                eventOffset++;
                runningStatus = statusByte;
            }

            const eventType = statusByte & 0xF0;
            const channel = statusByte & 0x0F;

            if (eventType === 0x90) {
                // Note On
                const note = dataView.getUint8(eventOffset);
                const velocity = dataView.getUint8(eventOffset + 1);
                eventOffset += 2;

                events.push({
                    type: 'noteOn',
                    tick: currentTick,
                    note,
                    velocity,
                    channel
                });
            } else if (eventType === 0x80) {
                // Note Off
                const note = dataView.getUint8(eventOffset);
                const velocity = dataView.getUint8(eventOffset + 1);
                eventOffset += 2;

                events.push({
                    type: 'noteOff',
                    tick: currentTick,
                    note,
                    velocity,
                    channel
                });
            } else if (eventType === 0xB0) {
                // Control Change
                eventOffset += 2;
            } else if (eventType === 0xC0) {
                // Program Change
                eventOffset += 1;
            } else if (eventType === 0xE0) {
                // Pitch Bend
                eventOffset += 2;
            } else if (statusByte === 0xFF) {
                // Meta Event
                const metaType = dataView.getUint8(eventOffset);
                eventOffset++;
                const metaLength = this.readVariableLength(dataView, eventOffset);
                eventOffset += metaLength.length;

                // Extract tempo from Set Tempo meta event (0x51)
                if (metaType === 0x51 && metaLength.value === 3) {
                    const usPerBeat = (dataView.getUint8(eventOffset) << 16) |
                                      (dataView.getUint8(eventOffset + 1) << 8) |
                                       dataView.getUint8(eventOffset + 2);
                    events.push({
                        type: 'setTempo',
                        tick: currentTick,
                        microsecondsPerBeat: usPerBeat,
                        bpm: Math.round(60000000 / usPerBeat)
                    });
                }

                eventOffset += metaLength.value;
            } else if (statusByte === 0xF0 || statusByte === 0xF7) {
                // SysEx
                const sysexLength = this.readVariableLength(dataView, eventOffset);
                eventOffset += sysexLength.length + sysexLength.value;
            }
        }

        return { length, events };
    }

    /**
     * Read variable length quantity
     */
    readVariableLength(dataView, offset) {
        let value = 0;
        let length = 0;
        let byte;

        do {
            byte = dataView.getUint8(offset + length);
            value = (value << 7) | (byte & 0x7F);
            length++;
        } while (byte & 0x80);

        return { value, length };
    }
    /**
     * Convert MIDI events to note list
     */
    eventsToNotes(events) {
        const notes = [];
        const activeNotes = new Map();


        events.forEach(event => {
            if (event.type === 'noteOn' && event.velocity > 0) {
                activeNotes.set(event.note, {
                    startTick: event.tick,
                    velocity: event.velocity,
                    channel: event.channel
                });
            } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
                const activeNote = activeNotes.get(event.note);
                if (activeNote) {
                    notes.push({
                        note: event.note,
                        startTick: activeNote.startTick,
                        endTick: event.tick,
                        duration: event.tick - activeNote.startTick,
                        velocity: activeNote.velocity,
                        channel: activeNote.channel
                    });
                    activeNotes.delete(event.note);
                }
            }
        });

        return notes;
    }

    /**
     * Convert raw eventsToNotes output (ticks, velocity 0-127) to generator step format
     * (time in 32nd-note steps, velocity 0-1)
     */
    convertToStepFormat(notes) {
        // 32nd notes: 8 per beat
        const ticksPerStep = this.ticksPerBeat / 8;
        return notes.map(n => ({
            note: n.note,
            time: Math.round(n.startTick / ticksPerStep),
            duration: Math.max(1, Math.round(n.duration / ticksPerStep)),
            velocity: Math.min(1.0, n.velocity / 127),
            channel: n.channel
        }));
    }

    /**
     * Smart split notes by musical role using simultaneity detection.
     * 3+ notes at the same step = chords; remaining notes split by register.
     * @param {Array} stepNotes - notes already in step format (from convertToStepFormat)
     * @returns {{ melody: Array, bass: Array, chords: Array }}
     */
    splitByRole(stepNotes) {
        // Group notes by time step
        const stepGroups = new Map();
        stepNotes.forEach(n => {
            const t = Math.round(n.time);
            if (!stepGroups.has(t)) stepGroups.set(t, []);
            stepGroups.get(t).push(n);
        });

        const melody = [];
        const bass = [];
        const chords = [];

        stepGroups.forEach((group) => {
            group.sort((a, b) => a.note - b.note);

            // Absolute Lowest Note goes to Bass
            const bassNote = group[0];
            const isBassRange = bassNote.note < 55; // Relaxed from 48

            // Absolute Highest Note goes to Melody (if >= 48)
            const highNotes = group.filter(n => n.note >= 48);
            const melNote = highNotes.length > 0 ? highNotes[highNotes.length - 1] : null;

            if (isBassRange) {
                bass.push(bassNote);
                // Middle notes go to chords
                group.slice(1).forEach(n => {
                    if (n !== melNote) chords.push(n);
                });
            } else if (group.length > 0) {
                // If the lowest note is too high for bass, it might be a chord root
                group.forEach(n => {
                    if (n !== melNote) chords.push(n);
                });
            }

            if (melNote) {
                melody.push(melNote);
            }
        });

        return { melody, bass, chords };
    }

    /**
     * Finds the track that most likely represents a specific role
     */
    getBestTrackForRole(midiData, role) {
        let bestTrack = null;
        let maxScore = -1;

        midiData.tracks.forEach((track, index) => {
            const notes = this.eventsToNotes(track.events);
            if (notes.length === 0) return;

            const stepNotes = this.convertToStepFormat(notes);
            let score = 0;

            if (role === 'melody') {
                // Melody score: High pitch notes (C3 and up), monophonic density
                const melodyNotes = stepNotes.filter(n => n.note >= 48);
                score = melodyNotes.length * 2;
                // Penalty for too many simultaneous notes
                const steps = new Set(melodyNotes.map(n => n.time));
                score *= (steps.size / melodyNotes.length);
            } else if (role === 'bass') {
                // Bass score: Low pitch notes
                const bassNotes = stepNotes.filter(n => n.note < 50);
                score = bassNotes.length;
            } else if (role === 'chords') {
                // Chords score: Simultaneous notes
                const simCount = stepNotes.length - new Set(stepNotes.map(n => n.time)).size;
                score = simCount;
            }

            if (score > maxScore) {
                maxScore = score;
                bestTrack = stepNotes;
            }
        });

        return bestTrack;
    }

    /**
     * Analyze MIDI pattern characteristics
     */
    analyzePattern(notes, tempo = 120) {
        if (notes.length === 0) {
            return null;
        }

        // Convert ticks to steps (32nd notes to match app resolution)
        const ticksPerStep = this.ticksPerBeat / 8;
        const notesInSteps = notes.map(note => ({
            ...note,
            step: Math.round(note.startTick / ticksPerStep),
            duration: Math.round(note.duration / ticksPerStep)
        }));

        // Analyze characteristics
        const noteNumbers = notes.map(n => n.note);
        const minNote = Math.min(...noteNumbers);
        const maxNote = Math.max(...noteNumbers);
        const avgVelocity = notes.reduce((sum, n) => sum + n.velocity, 0) / notes.length;

        // Detect scale/key
        const noteCounts = new Array(12).fill(0);
        notes.forEach(note => {
            noteCounts[note.note % 12]++;
        });

        const mostCommonNote = noteCounts.indexOf(Math.max(...noteCounts));
        const likelyKey = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][mostCommonNote];

        // Detect rhythm pattern
        const stepCounts = new Map();
        notesInSteps.forEach(note => {
            stepCounts.set(note.step, (stepCounts.get(note.step) || 0) + 1);
        });

        const likelyScale = this.analyzeScale(noteCounts);

        // Detect chords 
        const chords = this.detectChords(notesInSteps);

        // Extract motifs (short rhythmic/melodic fragments)
        const motifs = this.extractMotifs(notesInSteps);

        return {
            noteCount: notes.length,
            minNote,
            maxNote,
            range: maxNote - minNote,
            avgVelocity,
            likelyKey,
            likelyScale,
            notesInSteps,
            chords,
            motifs,
            density: notes.length / (Math.max(...notesInSteps.map(n => n.step), 0) + 1),
            rhythmPattern: Array.from(stepCounts.entries())
        };
    }

    /**
     * Analyze scale type (Major, Minor, Dorian, etc.)
     */
    analyzeScale(noteCounts) {
        let bestScale = 'Minor';
        let bestScore = -1;

        // Try each note as a potential root
        for (let root = 0; root < 12; root++) {
            for (const [name, intervals] of Object.entries(SCALES)) {
                let score = 0;

                intervals.forEach(interval => {
                    score += noteCounts[(root + interval) % 12];
                });

                // Bonus for strong root/fifth
                score += noteCounts[root] * 2;
                score += noteCounts[(root + 7) % 12] * 1.5;

                if (score > bestScore) {
                    bestScore = score;
                    bestScale = name;
                }
            }
        }

        return bestScale;
    }

    /**
     * Extract motifs (short fragments of 4-8 steps)
     */
    extractMotifs(notesInSteps) {
        const motifs = [];
        const sorted = [...notesInSteps].sort((a, b) => a.step - b.step);

        // Group into 8-step windows
        for (let i = 0; i < sorted.length; i += 4) {
            const fragment = sorted.filter(n => n.step >= i && n.step < i + 8);
            if (fragment.length >= 2) {
                // Normalize step to start at 0 for the fragment
                const normalized = fragment.map(n => ({
                    ...n,
                    relStep: n.step - i,
                    relNote: n.note - fragment[0].note // Relative to first note
                }));
                motifs.push(normalized);
            }
        }
        return motifs.slice(0, 20); // Limit count
    }


    /**
     * Detect chords from simultaneous notes
     */
    detectChords(notesInSteps) {
        const chords = [];
        const stepGroups = new Map();

        // Group notes by step
        notesInSteps.forEach(note => {
            if (!stepGroups.has(note.step)) {
                stepGroups.set(note.step, []);
            }
            stepGroups.get(note.step).push(note.note);
        });

        // Identify chords (3+ notes at same step)
        stepGroups.forEach((notes, step) => {
            if (notes.length >= 3) {
                const sortedNotes = notes.sort((a, b) => a - b);
                const intervals = [];
                for (let i = 1; i < sortedNotes.length; i++) {
                    intervals.push((sortedNotes[i] - sortedNotes[0]) % 12);
                }

                chords.push({
                    step,
                    notes: sortedNotes,
                    intervals,
                    type: this.identifyChordType(intervals)
                });
            }
        });

        return chords;
    }

    /**
     * Identify chord type from intervals
     */
    identifyChordType(intervals) {
        const intervalStr = intervals.join(',');

        const chordTypes = {
            '4,7': 'major',
            '3,7': 'minor',
            '4,7,10': 'major7',
            '3,7,10': 'minor7',
            '4,7,11': 'maj7',
            '3,6': 'diminished',
            '4,8': 'augmented',
            '5,7': 'sus4',
            '2,7': 'sus2'
        };

        return chordTypes[intervalStr] || 'unknown';
    }

    /**
     * Load MIDI file from File object
     */
    async loadMIDIFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const midiData = await this.parseMIDIFile(e.target.result);
                    resolve(midiData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }
}

export default MIDIParser;
