
const fs = require('fs');
const path = require('path');

// Mock a DOM-less version of MIDIParser for Node
class MIDIParser {
    constructor() {
        this.ticksPerBeat = 480;
    }

    async parseMIDIFile(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        let offset = 0;
        const header = this.parseHeader(dataView, offset);
        offset += 14;
        const tracks = [];
        for (let i = 0; i < header.numTracks; i++) {
            const track = this.parseTrack(dataView, offset);
            tracks.push(track);
            offset += track.length + 8;
        }
        return { ticksPerBeat: header.ticksPerBeat, tracks };
    }

    parseHeader(dataView, offset) {
        const id = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );
        if (id !== 'MThd') throw new Error('Invalid MIDI file');
        const length = dataView.getUint32(offset + 4);
        const format = dataView.getUint16(offset + 8);
        const numTracks = dataView.getUint16(offset + 10);
        const ticksPerBeat = dataView.getUint16(offset + 12);
        this.ticksPerBeat = ticksPerBeat;
        return { format, numTracks, ticksPerBeat };
    }

    parseTrack(dataView, offset) {
        const id = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );
        const length = dataView.getUint32(offset + 4);
        const events = [];
        let eventOffset = offset + 8;
        const trackEnd = offset + 8 + length;
        let currentTick = 0;
        let runningStatus = 0;

        while (eventOffset < trackEnd) {
            const deltaTime = this.readVariableLength(dataView, eventOffset);
            eventOffset += deltaTime.length;
            currentTick += deltaTime.value;
            let statusByte = dataView.getUint8(eventOffset);
            if (statusByte < 0x80) {
                statusByte = runningStatus;
            } else {
                eventOffset++;
                runningStatus = statusByte;
            }
            const eventType = statusByte & 0xF0;
            const channel = statusByte & 0x0F;
            if (eventType === 0x90) {
                const note = dataView.getUint8(eventOffset);
                const velocity = dataView.getUint8(eventOffset + 1);
                eventOffset += 2;
                events.push({ type: 'noteOn', tick: currentTick, note, velocity, channel });
            } else if (eventType === 0x80) {
                const note = dataView.getUint8(eventOffset);
                const velocity = dataView.getUint8(eventOffset + 1);
                eventOffset += 2;
                events.push({ type: 'noteOff', tick: currentTick, note, velocity, channel });
            } else if (eventType === 0xB0 || eventType === 0xE0) {
                eventOffset += 2;
            } else if (eventType === 0xC0 || eventType === 0xD0) {
                eventOffset += 1;
            } else if (statusByte === 0xFF) {
                eventOffset++; // type
                const metaLength = this.readVariableLength(dataView, eventOffset);
                eventOffset += metaLength.length + metaLength.value;
            } else if (statusByte === 0xF0 || statusByte === 0xF7) {
                const sysexLength = this.readVariableLength(dataView, eventOffset);
                eventOffset += sysexLength.length + sysexLength.value;
            }
        }
        return { length, events };
    }

    readVariableLength(dataView, offset) {
        let value = 0, length = 0, byte;
        do {
            byte = dataView.getUint8(offset + length);
            value = (value << 7) | (byte & 0x7F);
            length++;
        } while (byte & 0x80);
        return { value, length };
    }

    eventsToNotes(events) {
        const notes = [];
        const activeNotes = new Map();
        events.forEach(event => {
            if (event.type === 'noteOn' && event.velocity > 0) {
                activeNotes.set(event.note, { startTick: event.tick, velocity: event.velocity, channel: event.channel });
            } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
                const activeNote = activeNotes.get(event.note);
                if (activeNote) {
                    notes.push({ note: event.note, startTick: activeNote.startTick, duration: event.tick - activeNote.startTick, channel: activeNote.channel });
                    activeNotes.delete(event.note);
                }
            }
        });
        return notes;
    }

    convertToStepFormat(notes) {
        const ticksPerStep = this.ticksPerBeat / 8;
        return notes.map(n => ({
            note: n.note,
            time: Math.round(n.startTick / ticksPerStep),
            duration: Math.max(1, Math.round(n.duration / ticksPerStep)),
            channel: n.channel
        }));
    }

    splitByRole(stepNotes) {
        const stepGroups = new Map();
        stepNotes.forEach(n => {
            const t = Math.round(n.time);
            if (!stepGroups.has(t)) stepGroups.set(t, []);
            stepGroups.get(t).push(n);
        });

        const melody = [], bass = [], chords = [];

        stepGroups.forEach((group) => {
            group.sort((a, b) => a.note - b.note);

            // Absolute Lowest Note goes to Bass
            const bassNote = group[0];
            const isBassRange = bassNote && bassNote.note < 55;

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
}

async function test() {
    const filePath = path.join(__dirname, 'Cymatics - Anthem - 144 BPM D Min.mid');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const parser = new MIDIParser();
    const midiData = await parser.parseMIDIFile(arrayBuffer);

    console.log(`Ticks Per Beat: ${midiData.ticksPerBeat}`);
    let allNotes = [];
    midiData.tracks.forEach((track, i) => {
        const notes = parser.eventsToNotes(track.events);
        console.log(`Track ${i} has ${notes.length} notes`);
        allNotes.push(...notes);
    });

    const stepNotes = parser.convertToStepFormat(allNotes).filter(n => n.channel !== 9);
    const roles = parser.splitByRole(stepNotes);

    console.log('\n--- MELODY (Up to 8 Bars) ---');
    roles.melody.filter(n => n.time < 256).sort((a, b) => a.time - b.time).forEach(n => {
        console.log(`Time: ${n.time}, Note: ${n.note}, Duration: ${n.duration}, Channel: ${n.channel}`);
    });
    console.log('\n--- CHORDS (Up to 8 Bars) ---');
    roles.chords.filter(n => n.time < 256).sort((a, b) => a.time - b.time).forEach(n => {
        console.log(`Time: ${n.time}, Note: ${n.note}, Duration: ${n.duration}, Channel: ${n.channel}`);
    });
    console.log('\n--- BASS (Up to 8 Bars) ---');
    roles.bass.filter(n => n.time < 256).sort((a, b) => a.time - b.time).forEach(n => {
        console.log(`Time: ${n.time}, Note: ${n.note}, Duration: ${n.duration}, Channel: ${n.channel}`);
    });
}

test();
