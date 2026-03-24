/**
 * Chord-Aware Music Generation System
 * Generates melodies and basslines that follow chord progressions
 */

// Rhythm templates for melody - each array is step offsets within a 4-beat (8-step) bar
const MELODY_RHYTHM_TEMPLATES = {
    straight: [
        [0, 1, 2, 3],                     // quarter notes
        [0, 2, 4, 6],                     // 8th notes on beats
        [0, 1, 2, 3, 4, 5, 6, 7],         // constant 8ths
        [0, 2, 4, 6, 8, 10, 12, 14],      // full 8th note pattern (16 steps)
        [0, 4],                            // half notes
        [0, 2, 4],                         // dotted half feel
        [0, 1, 2, 3, 4, 5],               // six steady notes
        [0, 2, 4, 6, 7],                  // 8ths with pickup
        [0, 1, 4, 5],                     // paired quarters
        [0, 3, 4, 7],                     // spaced quarters
    ],
    syncopated: [
        [0, 3, 4, 7],                     // push on "and"
        [1, 2, 5, 6],                     // offbeat accents
        [0, 3, 5, 6],                     // syncopated pop
        [1, 3, 5, 7],                     // all offbeats
        [0, 1, 3, 4, 6, 7],               // grouped pairs off-grid
        [0, 3, 4, 5, 7],                  // push with fill
        [1, 4, 5, 7],                     // delayed entry
        [0, 2, 3, 5, 7],                  // Latin-style
        [0, 3, 6],                        // dotted syncopation
        [1, 2, 4, 7],                     // offbeat clusters
        [0, 1, 5, 6],                     // call-response syncopation
        [2, 3, 5, 6],                     // backbeat push
    ],
    sparse: [
        [0, 4],                            // half notes
        [0, 6],                            // dotted half + quarter
        [0, 2, 6],                         // sparse with pickup
        [0],                               // whole note
        [0, 3],                            // long-short
        [0, 5],                            // wide spacing
        [0, 4, 6],                         // sparse with tail
        [0, 7],                            // bookend
        [0, 2],                            // opening pair
        [4, 6],                            // late entry
    ],
    melodic: [
        [0, 1, 2, 4, 5, 6],               // scalar run then rest
        [0, 2, 3, 4, 6, 7],               // call-response
        [0, 1, 3, 4, 6, 7],               // grouped pairs
        [0, 1, 2, 3, 6, 7],               // run then answer
        [0, 1, 2, 5, 6, 7],               // bookend runs
        [0, 2, 3, 5, 6],                  // pentatonic feel
        [0, 1, 4, 5, 6, 7],               // gap in middle
        [0, 1, 2, 3, 4],                  // opening phrase
        [3, 4, 5, 6, 7],                  // late phrase
        [0, 1, 2, 4, 6, 7],               // skip and resolve
    ],
    arpeggiated: [
        [0, 1, 2, 3, 4, 5, 6, 7],         // flowing arpeggios
        [0, 2, 4, 6],                     // broken chord
        [0, 1, 2, 4, 5, 6],               // run-rest-run
        [0, 2, 4, 7],                     // wide arpeggio
        [0, 3, 4, 7],                     // arp with skip
        [0, 1, 3, 4, 6, 7],               // rolling arpeggio
        [0, 2, 3, 5, 6],                  // cascading
        [0, 1, 4, 5],                     // octave bounce
        [0, 2, 5, 7],                     // spread arpeggio
        [0, 1, 2, 3, 5, 7],               // arp with passing tones
    ]
};

// Rhythm templates for bass patterns within a chord change
const BASS_RHYTHM_TEMPLATES = {
    root_heavy: [
        [0],                               // whole note root
        [0, 4],                            // half note root
        [0, 2, 4, 6],                     // walking quarter
        [0, 6],                            // root with pickup
        [0, 4, 6],                         // root-rest-movement
        [0, 2],                            // half note pair
        [0, 2, 4],                         // three hits
        [0, 4, 5, 6],                     // root then walk
        [0, 3, 4],                         // root with anticipation
        [0, 2, 6],                         // sparse root pattern
    ],
    walking: [
        [0, 1, 2, 3],                     // classic walking bass
        [0, 2, 4, 6],                     // quarter note walk
        [0, 1, 2, 3, 4, 5, 6, 7],         // running 8ths
        [0, 1, 4, 5],                     // paired walking
        [0, 2, 3, 4, 6, 7],               // chromatic walk
        [0, 1, 2, 4, 5, 6],               // walk with gap
        [0, 1, 3, 4, 5, 7],               // dotted walk
        [0, 2, 4, 5, 6, 7],               // walk into next
        [0, 1, 2, 3, 6, 7],               // walk then leap
        [0, 3, 4, 5, 6, 7],               // late walk
    ],
    syncopated: [
        [0, 3, 4, 7],                     // off-beat push
        [0, 3, 6],                         // dotted pattern
        [0, 5, 6],                         // anticipation
        [1, 3, 5, 7],                     // all offbeats
        [0, 3, 5],                         // syncopated triplet feel
        [0, 1, 3, 6],                     // Latin bass
        [0, 2, 5, 7],                     // reggae-style
        [0, 3, 4, 6],                     // funk push
        [1, 4, 5, 7],                     // delayed entry
        [0, 3, 7],                         // wide syncopation
    ],
    octave: [
        [0, 4],                            // root + octave jump on 3
        [0, 2, 4, 6],                     // alternating octave
        [0, 1, 4, 5],                     // paired octave jumps
        [0, 4, 6],                         // root-octave-pickup
        [0, 3, 4, 7],                     // octave with syncopation
        [0, 2, 4],                         // three-note octave
        [0, 4, 5],                         // octave then step
        [0, 6, 7],                         // root then octave end
        [0, 2, 4, 5, 7],                  // octave walk
        [0, 1, 4, 6],                     // bouncing octave
    ],
    pedal: [
        [0, 2, 4, 6],                     // repeated root
        [0, 1, 2, 3, 4, 5, 6, 7],         // driving 8ths
        [0, 1, 4, 5],                     // pulsing pedal
        [0, 2, 3, 4, 6, 7],               // pedal with ghost notes
        [0, 4],                            // half note pedal
        [0, 1, 2, 4, 5, 6],               // pedal run
        [0, 2, 4, 7],                     // spaced pedal
        [0, 1, 3, 4, 5, 7],               // pedal with accents
        [0, 3, 4, 7],                     // wide pedal
        [0, 1, 2, 3],                     // four-on-floor pedal
    ]
};

// Contour shapes that guide melodic direction
// intervals are scale-degree offsets (0-7) that bias pitch selection
const MELODY_CONTOURS = [
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
    { name: 'rocket', intervals: [0, 0, 1, 2, 4, 5, 6, 7] },
    { name: 'dive', intervals: [7, 7, 6, 5, 3, 2, 1, 0] },
    { name: 'pendulum', intervals: [4, 6, 2, 5, 3, 7, 1, 4] },
    { name: 'flat', intervals: [3, 3, 4, 4, 3, 3, 4, 4] },
    { name: 'hill', intervals: [2, 3, 5, 6, 6, 5, 3, 2] },
    { name: 'double_arch', intervals: [0, 3, 6, 3, 0, 3, 6, 3] },
];

export class ChordAwareGenerator {
    constructor() {
        this.scaleIntervals = {
            'Major': [0, 2, 4, 5, 7, 9, 11],
            'Minor': [0, 2, 3, 5, 7, 8, 10],
            'Dorian': [0, 2, 3, 5, 7, 9, 10],
            'Phrygian': [0, 1, 3, 5, 7, 8, 10],
            'Lydian': [0, 2, 4, 6, 7, 9, 11],
            'Mixolydian': [0, 2, 4, 5, 7, 9, 10]
        };
    }

    /**
     * Get scale notes in MIDI numbers
     */
    getScaleNotes(key, scale, octave = 4) {
        const keyOffset = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(key);
        const intervals = this.scaleIntervals[scale] || this.scaleIntervals['Major'];
        const baseNote = 12 * octave + keyOffset;
        
        return intervals.map(i => baseNote + i);
    }

    /**
     * Generate chord progression
     */
    generateChordProgression(key, scale, bars, complexity, subGenre) {
        const scaleNotes = this.getScaleNotes(key, scale, 4);
        
        // Chord progressions based on mood/subgenre
        const progressions = {
            'Dark': [
                [5, 3, 0, 4], // vi-IV-I-V (minor feel)
                [5, 0, 3, 4], // vi-I-IV-V
                [0, 5, 3, 4]  // i-vi-IV-V
            ],
            'Happy': [
                [0, 4, 5, 3], // I-V-vi-IV (pop progression)
                [0, 3, 4, 5], // I-IV-V-vi
                [0, 5, 4, 3]  // I-vi-V-IV
            ],
            'Sad': [
                [5, 3, 0, 4], // vi-IV-I-V (sad)
                [0, 3, 5, 4], // I-IV-vi-V
                [5, 4, 3, 0]  // vi-V-IV-I
            ],
            'Energetic': [
                [0, 4, 1, 5], // I-V-ii-vi
                [0, 5, 4, 3], // I-vi-V-IV
                [0, 3, 4, 5]  // I-IV-V-vi
            ],
            'Melodic': [
                [0, 5, 3, 4], // I-vi-IV-V
                [0, 3, 5, 4], // I-IV-vi-V
                [5, 3, 4, 0]  // vi-IV-V-I
            ]
        };

        const moodProgressions = progressions[subGenre] || progressions['Dark'];
        const baseProgression = moodProgressions[Math.floor(Math.random() * moodProgressions.length)];

        const chords = [];
        const beatsPerBar = 4;
        
        // ENSURE ONE CHORD PER BAR - Repeat progression to fill all bars
        for (let bar = 0; bar < bars; bar++) {
            const degree = baseProgression[bar % baseProgression.length];
            const root = scaleNotes[degree];
            const third = scaleNotes[(degree + 2) % 7];
            const fifth = scaleNotes[(degree + 4) % 7];

            const notes = complexity === 'complex'
                ? [root, third, fifth, scaleNotes[(degree + 6) % 7]] // Add 7th
                : [root, third, fifth];

            chords.push({
                time: bar * beatsPerBar,
                duration: beatsPerBar,
                notes: notes,
                velocity: 0.7,
                root: root % 12,
                degree: degree
            });
        }

        return chords;
    }

    /**
     * Generate melody that follows chord progression
     */
    generateMelody(chordProgression, key, scale, complexity, subGenre) {
        const scaleNotes = this.getScaleNotes(key, scale, 5); // Higher octave for melody
        const melody = [];

        // Pick a random rhythm template category and template
        const rhythmCategories = Object.keys(MELODY_RHYTHM_TEMPLATES);
        const rhythmCategory = rhythmCategories[Math.floor(Math.random() * rhythmCategories.length)];
        const rhythmTemplates = MELODY_RHYTHM_TEMPLATES[rhythmCategory];
        const rhythmTemplate = rhythmTemplates[Math.floor(Math.random() * rhythmTemplates.length)];

        // Pick a random contour shape
        const contour = MELODY_CONTOURS[Math.floor(Math.random() * MELODY_CONTOURS.length)];

        // ENSURE EVERY BAR HAS MELODY NOTES
        chordProgression.forEach((chord, chordIdx) => {
            const chordTones = chord.notes.map(n => n % 12);
            const stepsInBar = 8; // 8 sub-steps per 4-beat bar
            const stepDuration = chord.duration / stepsInBar;

            // Use rhythm template to determine which steps get notes
            rhythmTemplate.forEach((stepOffset, noteIdx) => {
                // Skip steps that exceed this chord's range
                if (stepOffset >= stepsInBar) return;

                const time = chord.time + (stepOffset * stepDuration);

                // Use contour to bias note selection
                const contourIdx = noteIdx % contour.intervals.length;
                const contourOffset = contour.intervals[contourIdx]; // 0-7 scale degree offset

                // Emphasize chord tones on strong beats (first in template and every other)
                const isStrongBeat = noteIdx % 2 === 0;
                let note;

                if (isStrongBeat || Math.random() > 0.6) {
                    // Use chord tone, biased by contour
                    const chordTone = chordTones[Math.floor(Math.random() * chordTones.length)];
                    note = scaleNotes.find(n => n % 12 === chordTone) || scaleNotes[0];
                    // Apply contour offset within scale
                    const scaleIdx = scaleNotes.indexOf(note);
                    if (scaleIdx !== -1) {
                        const contourTarget = Math.min(scaleNotes.length - 1, Math.max(0, scaleIdx + Math.floor(contourOffset / 2) - 2));
                        // Blend between chord tone and contour target
                        if (Math.random() > 0.5) {
                            note = scaleNotes[contourTarget];
                        }
                    }
                } else {
                    // Use scale note guided by contour
                    const targetIdx = Math.floor((contourOffset / 7) * (scaleNotes.length - 1));
                    note = scaleNotes[Math.min(scaleNotes.length - 1, Math.max(0, targetIdx))];
                }

                // Smooth melodic motion - avoid large jumps
                if (melody.length > 0) {
                    const lastNote = melody[melody.length - 1].note;
                    const interval = Math.abs(note - lastNote);

                    // Avoid large jumps in simple mode
                    if (complexity === 'simple' && interval > 7) {
                        note = lastNote + (Math.random() > 0.5 ? 2 : -2);
                    }
                }

                // Ensure note is within scale
                const closestScaleNote = scaleNotes.reduce((prev, curr) =>
                    Math.abs(curr - note) < Math.abs(prev - note) ? curr : prev
                );

                // Vary duration based on position in template
                const isLastInTemplate = noteIdx === rhythmTemplate.length - 1;
                const durationMultiplier = isLastInTemplate ? 1.5 : (Math.random() > 0.7 ? 0.5 : 1);

                melody.push({
                    time,
                    duration: stepDuration * Math.min(durationMultiplier, 2),
                    note: closestScaleNote,
                    velocity: 0.6 + Math.random() * 0.2
                });
            });
        });

        return melody;
    }

    /**
     * Generate bassline that follows chord progression
     */
    generateBassline(chordProgression, key, scale, complexity, subGenre) {
        const scaleNotes = this.getScaleNotes(key, scale, 2); // Lower octave for bass
        const bassline = [];

        // Pick a random bass rhythm template category and template
        const bassCategories = Object.keys(BASS_RHYTHM_TEMPLATES);
        // Bias category selection based on complexity
        let categoryPool;
        if (complexity === 'simple') {
            categoryPool = ['root_heavy', 'pedal', 'octave'];
        } else {
            categoryPool = bassCategories;
        }
        const bassCategory = categoryPool[Math.floor(Math.random() * categoryPool.length)];
        const bassTemplates = BASS_RHYTHM_TEMPLATES[bassCategory];
        const bassTemplate = bassTemplates[Math.floor(Math.random() * bassTemplates.length)];

        const isWalking = bassCategory === 'walking';

        // ENSURE EVERY BAR HAS BASSLINE
        chordProgression.forEach(chord => {
            const root = chord.notes[0] - 24; // Two octaves down
            const fifth = chord.notes[2] - 24;
            const third = chord.notes[1] - 24;
            const octaveUp = root + 12;

            const stepsInBar = 8; // 8 sub-steps per 4-beat bar
            const stepDuration = chord.duration / stepsInBar;

            // Use bass template to determine when notes play
            bassTemplate.forEach((stepOffset, noteIdx) => {
                // Skip steps that exceed this chord's range
                if (stepOffset >= stepsInBar) return;

                const time = chord.time + (stepOffset * stepDuration);
                let note;

                if (noteIdx === 0) {
                    // First note is always root
                    note = root;
                } else if (isWalking) {
                    // Walking bass: use passing tones between chord tones
                    const chordTonesArr = [root, third, fifth];
                    const walkIdx = noteIdx % chordTonesArr.length;
                    note = chordTonesArr[walkIdx];
                    // Add chromatic passing tones between chord tones
                    if (Math.random() > 0.6) {
                        const target = chordTonesArr[(walkIdx + 1) % chordTonesArr.length];
                        note = note + Math.sign(target - note); // step toward next chord tone
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

                // Determine duration based on gap to next note in template
                const nextStepIdx = bassTemplate.indexOf(stepOffset) + 1;
                const nextStep = nextStepIdx < bassTemplate.length ? bassTemplate[nextStepIdx] : stepsInBar;
                const gapSteps = nextStep - stepOffset;
                const duration = stepDuration * Math.min(gapSteps, 4); // Cap at half-bar

                bassline.push({
                    time,
                    duration,
                    note,
                    velocity: noteIdx === 0 ? 0.85 : 0.75 + Math.random() * 0.1
                });
            });
        });

        return bassline;
    }

    /**
     * Generate endless variations
     */
    generateVariation(previousPattern, chordProgression, type, complexity) {
        // Generate new pattern with slight variations
        if (type === 'melody') {
            // Vary rhythm and note choices while keeping chord awareness
            return previousPattern.map(note => ({
                ...note,
                note: note.note + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 2 : -2) : 0),
                duration: note.duration * (Math.random() > 0.7 ? 0.5 : 1)
            }));
        } else if (type === 'bass') {
            // Vary rhythm pattern
            return previousPattern.map(note => ({
                ...note,
                duration: note.duration * (Math.random() > 0.6 ? 0.5 : 1)
            }));
        }

        return previousPattern;
    }

    /**
     * Get chord at specific time
     */
    getChordAtTime(chordProgression, time) {
        for (let i = chordProgression.length - 1; i >= 0; i--) {
            if (time >= chordProgression[i].time) {
                return chordProgression[i];
            }
        }
        return chordProgression[0];
    }

    /**
     * Validate note against current chord
     */
    isChordTone(note, chord) {
        const noteClass = note % 12;
        const chordTones = chord.notes.map(n => n % 12);
        return chordTones.includes(noteClass);
    }

    /**
     * Snap note to nearest chord tone
     */
    snapToChordTone(note, chord) {
        const chordTones = chord.notes;
        let closest = chordTones[0];
        let minDistance = Math.abs(note - closest);

        chordTones.forEach(chordNote => {
            const distance = Math.abs(note - chordNote);
            if (distance < minDistance) {
                minDistance = distance;
                closest = chordNote;
            }
        });

        return closest;
    }
}

export default ChordAwareGenerator;
