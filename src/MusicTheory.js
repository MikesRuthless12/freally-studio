// Music Theory Utilities for Professional MIDI Generation
// Re-exports data from domain/, keeps helper functions local

export { NOTE_NAMES } from './domain/keys';
export { SCALES } from './domain/scales';
export { CHORD_TYPES, ROMAN_TO_CHORD, CHORD_PROGRESSIONS, ensureChordsExpansionsLoaded } from './domain/chords';

// Import what helpers need
import { NOTE_NAMES } from './domain/keys';
import { SCALES } from './domain/scales';
import { CHORD_TYPES, ROMAN_TO_CHORD, CHORD_PROGRESSIONS } from './domain/chords';
import { GENRE_DEFINITIONS } from './domain/genres';

// Get MIDI note number from note name and octave
export const getMIDINote = (noteName, octave) => {
    const noteIndex = NOTE_NAMES.indexOf(noteName);
    if (noteIndex === -1) return 60; // Default to middle C
    return (octave + 1) * 12 + noteIndex;
};

// Get note name from MIDI note number
export const getNoteName = (midiNote) => {
    return NOTE_NAMES[midiNote % 12];
};

// Get octave from MIDI note number
export const getOctave = (midiNote) => {
    return Math.floor(midiNote / 12) - 1;
};

// Get scale notes in a key
export const getScaleNotes = (key, scale) => {
    const rootNote = NOTE_NAMES.indexOf(key);
    if (rootNote === -1) return [];

    const scaleIntervals = SCALES[scale] || SCALES['Major'];
    return scaleIntervals.map(interval => (rootNote + interval) % 12);
};

// Check if a MIDI note is in the scale
export const isNoteInScale = (midiNote, key, scale) => {
    const scaleNotes = getScaleNotes(key, scale);
    const noteInOctave = midiNote % 12;
    return scaleNotes.includes(noteInOctave);
};

// Get chord notes from roman numeral
export const getChordNotes = (roman, key, scale, octave = 4, complexity = 'simple') => {
    const scaleNotes = getScaleNotes(key, scale);
    const rootNote = NOTE_NAMES.indexOf(key);

    // Determine chord degree (I, II, III, etc.)
    const degreeMap = {
        'I': 0, 'i': 0, 'I7': 0, 'i7': 0,
        'II': 1, 'ii': 1, 'ii7': 1,
        'III': 2, 'iii': 2,
        'IV': 3, 'iv': 3, 'iv7': 3,
        'V': 4, 'v': 4, 'V7': 4,
        'VI': 5, 'vi': 5, 'vi7': 5,
        'VII': 6, 'vii': 6, 'vii°': 6,
        // New degree mappings
        'bVII': 6, 'bVI': 5, 'bIII': 2,
        'Imaj7': 0, 'IVmaj7': 3, 'IImaj7': 1,
        'V7#9': 4, 'V7b9': 4,
        'viio7': 6, 'iiø7': 1,
        'iii7': 2, 'iv7': 3,
        'I6': 0, 'IV6': 3, 'i6': 0
    };

    const degree = degreeMap[roman];
    if (degree === undefined) return [];

    // Get chord root from scale
    const chordRoot = scaleNotes[degree];

    // Determine chord type
    const chordType = ROMAN_TO_CHORD[roman] || 'major';
    const chordIntervals = CHORD_TYPES[chordType];

    // Build chord
    const baseMIDI = getMIDINote(NOTE_NAMES[chordRoot], octave);
    return chordIntervals.map(interval => baseMIDI + interval);
};

// Get chord progression for genre
export const getChordProgressionForGenre = (genre, key, scale, bars = 4, complexity = 'simple') => {
    // Use genre definition's typicalProgressionType for precise mapping
    const genreData = GENRE_DEFINITIONS[genre];
    const progressionType = genreData ? genreData.typicalProgressionType : 'pop';

    const progressionKey = `${progressionType}_${complexity}`;
    const progressions = CHORD_PROGRESSIONS[progressionKey] || CHORD_PROGRESSIONS['pop_simple'];
    const progression = progressions[Math.floor(Math.random() * progressions.length)];

    // Repeat progression for number of bars
    const repeats = Math.ceil(bars / progression.length);
    const extendedProgression = [];
    for (let i = 0; i < repeats; i++) {
        extendedProgression.push(...progression);
    }

    return extendedProgression.slice(0, bars);
};

// Melody rhythm templates - step offsets within a 16-step chord segment
const MT_MELODY_RHYTHM_TEMPLATES = {
    straight: [
        [0, 4, 8, 12],                    // quarter notes
        [0, 2, 4, 6, 8, 10, 12, 14],      // constant 8ths
        [0, 4, 8, 12, 14],                // quarters with pickup
        [0, 2, 4, 8, 10, 12],             // 8ths with gap
        [0, 4, 6, 8, 12, 14],             // mixed straight
        [0, 2, 8, 10],                    // paired 8ths
        [0, 2, 4, 6],                     // first half only
        [8, 10, 12, 14],                  // second half only
        [0, 4, 8, 10, 12, 14],            // quarters then 8ths
        [0, 2, 4, 6, 8, 12],              // 8ths then quarters
    ],
    syncopated: [
        [1, 3, 5, 7, 9, 11, 13, 15],      // all offbeats
        [0, 3, 4, 7, 8, 11, 12, 15],      // pushed accents
        [0, 3, 6, 9, 12, 15],             // dotted quarter feel
        [1, 4, 9, 12],                    // sparse syncopation
        [0, 3, 8, 11],                    // wide syncopation
        [2, 5, 10, 13],                   // backbeat push
        [0, 3, 5, 8, 11, 13],             // Latin feel
        [0, 6, 8, 14],                    // wide dotted
        [1, 5, 9, 13],                    // offbeat quarters
        [0, 3, 7, 8, 11, 15],             // double push
    ],
    sparse: [
        [0, 8],                            // half notes
        [0, 12],                           // dotted half
        [0],                               // whole note
        [0, 6, 12],                        // sparse trio
        [0, 10],                           // wide gap
        [4, 12],                           // late entry
        [0, 8, 12],                        // half then quarter
        [0, 4],                            // two quarters
        [0, 8, 14],                        // sparse with pickup
        [0, 6],                            // long-short
    ],
    melodic: [
        [0, 2, 4, 6, 8, 10],              // running 8ths first 3 beats
        [0, 2, 4, 8, 10, 12],             // call-response
        [0, 2, 4, 10, 12, 14],            // bookend phrases
        [0, 1, 2, 3, 8, 12],              // 16th run then space
        [4, 6, 8, 10, 12, 14],            // delayed phrase
        [0, 2, 4, 6, 12, 14],             // phrase with gap
        [0, 4, 6, 8, 12, 14],             // lyrical
        [0, 2, 6, 8, 10, 14],             // lilting
        [0, 2, 3, 4, 8, 10, 11, 12],      // double phrase
        [0, 4, 8, 10, 12, 14],            // opening then run
    ],
    arpeggiated: [
        [0, 2, 4, 6, 8, 10, 12, 14],      // flowing arpeggios
        [0, 4, 8, 12],                    // broken chord
        [0, 2, 4, 8, 10, 12],             // arp-rest-arp
        [0, 3, 6, 9, 12],                 // triplet-feel arp
        [0, 2, 4, 8, 12, 14],             // wide arp
        [0, 4, 6, 8, 12, 14],             // spread arp
        [0, 2, 6, 8, 10, 14],             // cascading
        [0, 1, 4, 5, 8, 9, 12, 13],       // paired arp
        [0, 3, 4, 7, 8, 11, 12, 15],      // rolling arp
        [0, 2, 8, 10, 12, 14],            // gap then cascade
    ]
};

// Melody contour shapes for MusicTheory.js (scale degree offsets 0-7)
const MT_MELODY_CONTOURS = [
    { name: 'ascending', intervals: [0, 1, 2, 3, 4, 5, 6, 7] },
    { name: 'descending', intervals: [7, 6, 5, 4, 3, 2, 1, 0] },
    { name: 'arch', intervals: [0, 2, 4, 6, 7, 5, 3, 1] },
    { name: 'valley', intervals: [7, 5, 3, 1, 0, 2, 4, 6] },
    { name: 'zigzag_up', intervals: [0, 3, 1, 4, 2, 5, 3, 6] },
    { name: 'zigzag_down', intervals: [7, 4, 6, 3, 5, 2, 4, 1] },
    { name: 'plateau', intervals: [0, 2, 4, 4, 4, 4, 2, 0] },
    { name: 'peak', intervals: [0, 1, 3, 5, 7, 5, 3, 1] },
    { name: 'trill', intervals: [3, 4, 3, 4, 3, 4, 3, 4] },
    { name: 'wave', intervals: [3, 5, 4, 6, 3, 5, 4, 6] },
    { name: 'rising_wave', intervals: [0, 2, 1, 3, 2, 4, 3, 5] },
    { name: 'falling_wave', intervals: [7, 5, 6, 4, 5, 3, 4, 2] },
    { name: 'step_up', intervals: [0, 0, 2, 2, 4, 4, 6, 6] },
    { name: 'step_down', intervals: [7, 7, 5, 5, 3, 3, 1, 1] },
    { name: 'flat', intervals: [3, 3, 4, 4, 3, 3, 4, 4] },
    { name: 'hill', intervals: [2, 3, 5, 6, 6, 5, 3, 2] },
    { name: 'double_arch', intervals: [0, 3, 6, 3, 0, 3, 6, 3] },
    { name: 'rocket', intervals: [0, 0, 1, 2, 4, 5, 6, 7] },
    { name: 'dive', intervals: [7, 7, 6, 5, 3, 2, 1, 0] },
    { name: 'pendulum', intervals: [4, 6, 2, 5, 3, 7, 1, 4] },
];

// Bass rhythm templates - step offsets within a 16-step chord segment
const MT_BASS_RHYTHM_TEMPLATES = {
    root_heavy: [
        [0],                               // whole note
        [0, 8],                            // half notes
        [0, 4, 8, 12],                    // quarter notes on root
        [0, 12],                           // dotted half
        [0, 8, 12],                        // root with movement
        [0, 4],                            // two hits
        [0, 4, 8],                         // three quarter hits
        [0, 8, 10, 12],                   // root then walk up
        [0, 6, 8],                         // root with anticipation
        [0, 4, 12],                        // spaced root
    ],
    walking: [
        [0, 4, 8, 12],                    // classic walking quarters
        [0, 2, 4, 6, 8, 10, 12, 14],      // running 8ths walk
        [0, 4, 6, 8, 12, 14],             // walk with pickups
        [0, 2, 4, 8, 10, 12],             // walk with rest
        [0, 4, 8, 10, 12, 14],            // walk into next bar
        [0, 2, 8, 10, 12, 14],            // paired walking
        [0, 2, 4, 6, 12, 14],             // walk then leap
        [0, 4, 6, 10, 12, 14],            // chromatic approach
        [0, 2, 4, 8, 12, 14],             // bouncing walk
        [0, 4, 8, 12, 14, 15],            // walk with grace note
    ],
    syncopated: [
        [0, 6, 8, 14],                    // dotted offbeats
        [0, 3, 8, 11],                    // wide syncopation
        [1, 5, 9, 13],                    // all offbeats
        [0, 6, 12],                        // dotted quarters
        [0, 3, 6, 9, 12],                 // triplet feel
        [0, 3, 8, 12],                    // funk push
        [2, 8, 10, 14],                   // delayed entry
        [0, 5, 8, 13],                    // reggae style
        [0, 3, 4, 8, 11, 12],             // double push
        [0, 6, 10, 14],                   // wide dotted
    ],
    octave: [
        [0, 8],                            // root + octave on beat 3
        [0, 4, 8, 12],                    // alternating octave
        [0, 2, 8, 10],                    // paired octave jumps
        [0, 8, 12],                        // root-octave-pickup
        [0, 6, 8, 14],                    // octave with syncopation
        [0, 4, 8],                         // three-note octave
        [0, 8, 10],                        // octave then step
        [0, 12, 14],                       // root then octave end
        [0, 4, 8, 10, 14],                // octave walk
        [0, 2, 8, 12],                    // bouncing octave
    ],
    pedal: [
        [0, 4, 8, 12],                    // repeated root quarters
        [0, 2, 4, 6, 8, 10, 12, 14],      // driving 8ths
        [0, 2, 8, 10],                    // pulsing pedal
        [0, 4, 6, 8, 12, 14],             // pedal with ghost notes
        [0, 8],                            // half note pedal
        [0, 2, 4, 8, 10, 12],             // pedal run
        [0, 4, 8, 14],                    // spaced pedal
        [0, 2, 6, 8, 10, 14],             // pedal with accents
        [0, 6, 8, 14],                    // wide pedal
        [0, 2, 4, 6],                     // four-on-floor pedal
    ]
};

// Generate melody notes that fit scale and chords
export const generateMelodyNotes = (key, scale, chordProgression, bars = 4, octave = 5, complexity = 'simple') => {
    const scaleNotes = getScaleNotes(key, scale);
    const stepsPerBar = 16;
    const totalSteps = bars * stepsPerBar;

    const melody = [];
    const stepsPerChord = Math.floor(totalSteps / chordProgression.length);

    // Complexity settings
    const chordToneProbability = complexity === 'complex' ? 0.5 : 0.7;
    const octaveRange = complexity === 'complex' ? 2 : 1;

    // Pick a random rhythm template category and template
    const rhythmCategories = Object.keys(MT_MELODY_RHYTHM_TEMPLATES);
    const rhythmCategory = rhythmCategories[Math.floor(Math.random() * rhythmCategories.length)];
    const rhythmTemplates = MT_MELODY_RHYTHM_TEMPLATES[rhythmCategory];
    const rhythmTemplate = rhythmTemplates[Math.floor(Math.random() * rhythmTemplates.length)];

    // Pick a random contour shape
    const contour = MT_MELODY_CONTOURS[Math.floor(Math.random() * MT_MELODY_CONTOURS.length)];

    chordProgression.forEach((chord, chordIndex) => {
        const chordNotes = getChordNotes(chord, key, scale, octave, complexity);
        const chordStartStep = chordIndex * stepsPerChord;

        // Fill all steps for this chord with nulls first (rests)
        const chordSlots = new Array(stepsPerChord).fill(null);

        // Use rhythm template to determine which steps get notes
        let noteCounter = 0;
        rhythmTemplate.forEach(stepOffset => {
            // Skip steps that exceed this chord's range
            if (stepOffset >= stepsPerChord) return;

            // Use contour to guide note selection
            const contourIdx = noteCounter % contour.intervals.length;
            const contourValue = contour.intervals[contourIdx]; // 0-7

            // Prefer chord tones and scale notes
            const useChordTone = Math.random() < chordToneProbability;

            if (useChordTone && chordNotes.length > 0) {
                // Use chord tone, biased by contour
                const biasedIdx = Math.floor((contourValue / 7) * (chordNotes.length - 1));
                const note = chordNotes[Math.min(chordNotes.length - 1, Math.max(0, biasedIdx))];
                chordSlots[stepOffset] = note;
            } else {
                // Use scale note guided by contour
                const targetIdx = Math.floor((contourValue / 7) * (scaleNotes.length - 1));
                const scaleNote = scaleNotes[Math.min(scaleNotes.length - 1, Math.max(0, targetIdx))];
                const octaveOffset = complexity === 'complex'
                    ? Math.floor(Math.random() * octaveRange) - Math.floor(octaveRange / 2)
                    : 0;
                const midiNote = getMIDINote(NOTE_NAMES[scaleNote], octave + octaveOffset);
                chordSlots[stepOffset] = midiNote;
            }

            noteCounter++;
        });

        melody.push(...chordSlots);
    });

    return melody.slice(0, totalSteps);
};

// Generate bassline that follows chord roots
export const generateBassline = (key, scale, chordProgression, bars = 4, octave = 2, complexity = 'simple') => {
    const stepsPerBar = 16;
    const totalSteps = bars * stepsPerBar;
    const stepsPerChord = Math.floor(totalSteps / chordProgression.length);

    const bassline = Array(totalSteps).fill(null);

    // Pick a random bass rhythm template category and template
    const bassCategories = Object.keys(MT_BASS_RHYTHM_TEMPLATES);
    // Bias category selection based on complexity
    let categoryPool;
    if (complexity === 'simple') {
        categoryPool = ['root_heavy', 'pedal', 'octave'];
    } else {
        categoryPool = bassCategories;
    }
    const bassCategory = categoryPool[Math.floor(Math.random() * categoryPool.length)];
    const bassTemplates = MT_BASS_RHYTHM_TEMPLATES[bassCategory];
    const bassTemplate = bassTemplates[Math.floor(Math.random() * bassTemplates.length)];

    const isWalking = bassCategory === 'walking';

    chordProgression.forEach((chord, chordIndex) => {
        const chordNotes = getChordNotes(chord, key, scale, octave, complexity);
        const root = chordNotes[0];
        const third = chordNotes.length > 1 ? chordNotes[1] : root + 3;
        const fifth = chordNotes.length > 2 ? chordNotes[2] : root + 7;
        const octaveUp = root + 12;

        const startStep = chordIndex * stepsPerChord;

        // Use bass template to determine which steps get notes
        bassTemplate.forEach((stepOffset, noteIdx) => {
            // Skip steps that exceed this chord's range
            if (stepOffset >= stepsPerChord) return;

            let note;

            if (noteIdx === 0) {
                // First note is always root
                note = root;
            } else if (isWalking) {
                // Walking bass: cycle through chord tones with passing tones
                const chordTonesArr = [root, third, fifth];
                const walkIdx = noteIdx % chordTonesArr.length;
                note = chordTonesArr[walkIdx];
                // Add chromatic passing tones
                if (Math.random() > 0.6) {
                    const target = chordTonesArr[(walkIdx + 1) % chordTonesArr.length];
                    note = note + Math.sign(target - note);
                }
            } else if (bassCategory === 'octave') {
                // Alternate between root and octave
                note = noteIdx % 2 === 0 ? root : octaveUp;
            } else if (bassCategory === 'pedal') {
                // Mostly root with occasional fifth
                note = Math.random() > 0.8 ? fifth : root;
            } else {
                // Root-heavy and syncopated: mix of chord tones
                const roll = Math.random();
                if (roll < 0.5) {
                    note = root;
                } else if (roll < 0.75) {
                    note = fifth;
                } else {
                    note = third;
                }
            }

            bassline[startStep + stepOffset] = note;
        });
    });

    return bassline;
};

// Quantize note to scale
export const quantizeToScale = (midiNote, key, scale) => {
    const scaleNotes = getScaleNotes(key, scale);
    const noteInOctave = midiNote % 12;
    const octave = Math.floor(midiNote / 12);

    // Find closest scale note
    let closestNote = scaleNotes[0];
    let minDistance = 12;

    scaleNotes.forEach(scaleNote => {
        const distance = Math.abs(noteInOctave - scaleNote);
        if (distance < minDistance) {
            minDistance = distance;
            closestNote = scaleNote;
        }
    });

    return octave * 12 + closestNote;
};

export default {
    NOTE_NAMES,
    SCALES,
    CHORD_TYPES,
    ROMAN_TO_CHORD,
    CHORD_PROGRESSIONS,
    getMIDINote,
    getNoteName,
    getOctave,
    getScaleNotes,
    isNoteInScale,
    getChordNotes,
    getChordProgressionForGenre,
    generateMelodyNotes,
    generateBassline,
    quantizeToScale
};
