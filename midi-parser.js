import fs from 'fs';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

try {
    const midiData = fs.readFileSync('Cymatics - Anthem - 144 BPM D Min.mid');
    const midi = new Midi(midiData);

    const notes = midi.tracks[0].notes;
    const bass = notes.filter(n => n.midi < 55);
    const chords = notes.filter(n => n.midi >= 55 && n.midi < 70);
    const melody = notes.filter(n => n.midi >= 70);

    console.log(`\n=== BASS (${bass.length} notes) ===`);
    bass.slice(0, 10).forEach(n => console.log(`Time: ${n.time.toFixed(3)}s | Dur: ${n.duration.toFixed(3)}s | Midi: ${n.midi}`));

    console.log(`\n=== MELODY (${melody.length} notes) === (bum, bum, bum....bum, bum, bum)`);
    melody.slice(0, 10).forEach(n => console.log(`Time: ${n.time.toFixed(3)}s | Dur: ${n.duration.toFixed(3)}s | Midi: ${n.midi}`));

} catch (error) {
    console.error("Error parsing MIDI:", error.message);
}
