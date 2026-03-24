// Pattern Generator - Generate new MIDI patterns based on folder analysis

import { getScaleNotes, getChordNotes, quantizeToScale } from './MusicTheory';

export class PatternGenerator {
    constructor() {
        this.randomSeed = Date.now();
    }

    /**
     * Generate chord progression based on folder analysis
     */
    generateChords(folderCharacteristics, bars = 4) {
        const { key, scale, chordProgressions, complexity } = folderCharacteristics;

        // If we have existing chord progressions, use them as templates
        if (chordProgressions && chordProgressions.length > 0) {
            return this.generateChordsFromTemplate(chordProgressions, key, scale, bars, complexity);
        }

        // Otherwise generate from scratch using music theory
        return this.generateChordsFromTheory(key, scale, bars, complexity);
    }

    /**
     * Generate chords from existing templates in folder
     */
    generateChordsFromTemplate(templates, key, scale, bars, complexity) {
        // Pick a random template
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        const stepsPerBar = 16;
        const totalSteps = bars * stepsPerBar;
        const chordPattern = [];

        // Use template chord types and rhythm
        template.forEach((templateChord, index) => {
            const startStep = Math.floor((index / template.length) * totalSteps);
            const duration = Math.floor(totalSteps / template.length);

            // Transpose chord to new key
            const transposedNotes = this.transposeChord(templateChord.notes, key);
            
            // Quantize to scale
            const scaledNotes = transposedNotes.map(note => quantizeToScale(note, key, scale));

            chordPattern.push({
                id: Date.now() + index,
                startStep,
                duration,
                notes: scaledNotes,
                velocity: 0.8,
                type: templateChord.type || 'unknown'
            });
        });

        return chordPattern;
    }

    /**
     * Generate chords from music theory
     */
    generateChordsFromTheory(key, scale, bars, complexity) {
        const stepsPerBar = 16;
        const totalSteps = bars * stepsPerBar;
        const chordPattern = [];

        // Common progressions
        const simpleProgressions = [
            ['I', 'V', 'vi', 'IV'],
            ['I', 'IV', 'V', 'I'],
            ['vi', 'IV', 'I', 'V'],
            ['I', 'vi', 'IV', 'V']
        ];

        const complexProgressions = [
            ['I', 'iii', 'vi', 'IV', 'I', 'IV', 'V', 'I'],
            ['vi', 'IV', 'I', 'V', 'vi', 'iii', 'IV', 'V'],
            ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
            ['ii', 'V', 'I', 'vi', 'ii', 'V', 'I', 'IV']
        ];

        const progressions = complexity === 'complex' ? complexProgressions : simpleProgressions;
        const progression = progressions[Math.floor(Math.random() * progressions.length)];

        const stepsPerChord = Math.floor(totalSteps / progression.length);

        progression.forEach((roman, index) => {
            const startStep = index * stepsPerChord;
            const chordNotes = getChordNotes(roman, key, scale, 4, complexity);

            chordPattern.push({
                id: Date.now() + index,
                roman,
                startStep,
                duration: stepsPerChord,
                notes: chordNotes,
                velocity: 0.8
            });
        });

        return chordPattern;
    }

    /**
     * Generate melody based on folder analysis
     */
    generateMelody(folderCharacteristics, bars = 4, chordProgression = []) {
        const { key, scale, melodicPatterns, complexity, rhythmPatterns } = folderCharacteristics;

        // If we have existing melodic patterns, use them as templates
        if (melodicPatterns && melodicPatterns.length > 0) {
            return this.generateMelodyFromTemplate(melodicPatterns, key, scale, bars, complexity);
        }

        // Otherwise generate from scratch
        return this.generateMelodyFromTheory(key, scale, bars, complexity, chordProgression);
    }

    /**
     * Generate melody from existing templates
     */
    generateMelodyFromTemplate(templates, key, scale, bars, complexity) {
        // Pick a random template
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        const stepsPerBar = 16;
        const totalSteps = bars * stepsPerBar;
        const melodyPattern = [];

        // Use template intervals and rhythm
        if (template.notes && template.notes.length > 0) {
            const scaleFactor = totalSteps / Math.max(...template.notes.map(n => n.step));

            template.notes.forEach((note, index) => {
                const scaledStep = Math.floor(note.step * scaleFactor);
                if (scaledStep < totalSteps) {
                    // Transpose to new key
                    const transposedNote = this.transposeNote(note.note, key);
                    
                    // Quantize to scale
                    const scaledNote = quantizeToScale(transposedNote, key, scale);

                    melodyPattern.push({
                        id: Date.now() + index,
                        step: scaledStep,
                        note: scaledNote,
                        velocity: note.velocity || 0.8,
                        duration: 1
                    });
                }
            });
        }

        return melodyPattern;
    }

    /**
     * Generate melody from music theory
     */
    generateMelodyFromTheory(key, scale, bars, complexity, chordProgression) {
        const stepsPerBar = 16;
        const totalSteps = bars * stepsPerBar;
        const melodyPattern = [];

        const scaleNotes = getScaleNotes(key, scale);
        const octave = 5; // Middle octave
        const baseNote = 12 * (octave + 1);

        // Generate melody notes
        const noteDensity = complexity === 'complex' ? 0.4 : 0.25;
        const numNotes = Math.floor(totalSteps * noteDensity);

        for (let i = 0; i < numNotes; i++) {
            const step = Math.floor((i / numNotes) * totalSteps);
            
            // Pick note from scale
            const scaleIndex = Math.floor(Math.random() * scaleNotes.length);
            const noteOffset = scaleNotes[scaleIndex];
            const note = baseNote + noteOffset;

            // Add some variation
            const octaveVariation = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1 octave
            const finalNote = note + (octaveVariation * 12);

            melodyPattern.push({
                id: Date.now() + i,
                step,
                note: finalNote,
                velocity: 0.7 + Math.random() * 0.2,
                duration: complexity === 'complex' ? Math.floor(Math.random() * 3) + 1 : 2
            });
        }

        return melodyPattern;
    }

    /**
     * Generate bassline based on folder analysis
     */
    generateBass(folderCharacteristics, bars = 4, chordProgression = []) {
        const { key, scale, melodicPatterns, complexity, rhythmPatterns } = folderCharacteristics;

        // If we have existing patterns, use them as templates
        if (melodicPatterns && melodicPatterns.length > 0) {
            return this.generateBassFromTemplate(melodicPatterns, key, scale, bars, complexity, chordProgression);
        }

        // Otherwise generate from scratch
        return this.generateBassFromTheory(key, scale, bars, complexity, chordProgression);
    }

    /**
     * Generate bass from existing templates
     */
    generateBassFromTemplate(templates, key, scale, bars, complexity, chordProgression) {
        // Pick a random template
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        const stepsPerBar = 16;
        const totalSteps = bars * stepsPerBar;
        const bassPattern = [];

        // Use template rhythm but lower octave
        if (template.notes && template.notes.length > 0) {
            const scaleFactor = totalSteps / Math.max(...template.notes.map(n => n.step));

            template.notes.forEach((note, index) => {
                const scaledStep = Math.floor(note.step * scaleFactor);
                if (scaledStep < totalSteps) {
                    // Transpose to new key and lower by 2 octaves
                    const transposedNote = this.transposeNote(note.note, key) - 24;
                    
                    // Quantize to scale
                    const scaledNote = quantizeToScale(transposedNote, key, scale);

                    bassPattern.push({
                        id: Date.now() + index,
                        step: scaledStep,
                        note: scaledNote,
                        velocity: note.velocity || 0.9,
                        duration: 2
                    });
                }
            });
        }

        return bassPattern;
    }

    /**
     * Generate bass from music theory
     */
    generateBassFromTheory(key, scale, bars, complexity, chordProgression) {
        const stepsPerBar = 16;
        const totalSteps = bars * stepsPerBar;
        const bassPattern = [];

        const scaleNotes = getScaleNotes(key, scale);
        const octave = 2; // Low octave for bass
        const baseNote = 12 * (octave + 1);

        if (chordProgression && chordProgression.length > 0) {
            // Follow chord roots
            chordProgression.forEach(chord => {
                const rootNote = chord.notes[0] - 24; // Lower by 2 octaves
                
                // Add root on strong beats
                const stepsInChord = chord.duration;
                const beatsInChord = stepsInChord / 4;

                for (let beat = 0; beat < beatsInChord; beat++) {
                    const step = chord.startStep + (beat * 4);
                    
                    if (complexity === 'complex' && beat % 2 === 1) {
                        // Add fifth on weak beats
                        const fifthNote = rootNote + 7;
                        bassPattern.push({
                            id: Date.now() + step,
                            step,
                            note: fifthNote,
                            velocity: 0.7,
                            duration: 2
                        });
                    } else {
                        // Root note
                        bassPattern.push({
                            id: Date.now() + step,
                            step,
                            note: rootNote,
                            velocity: 0.9,
                            duration: 2
                        });
                    }
                }
            });
        } else {
            // Generate simple bass pattern
            const noteDensity = complexity === 'complex' ? 0.3 : 0.2;
            const numNotes = Math.floor(totalSteps * noteDensity);

            for (let i = 0; i < numNotes; i++) {
                const step = Math.floor((i / numNotes) * totalSteps);
                
                // Pick note from scale
                const scaleIndex = Math.floor(Math.random() * Math.min(5, scaleNotes.length));
                const noteOffset = scaleNotes[scaleIndex];
                const note = baseNote + noteOffset;

                bassPattern.push({
                    id: Date.now() + i,
                    step,
                    note,
                    velocity: 0.9,
                    duration: 2
                });
            }
        }

        return bassPattern;
    }

    /**
     * Transpose chord to new key
     */
    transposeChord(notes, targetKey) {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const targetKeyIndex = keys.indexOf(targetKey);
        
        // Assume first note is root
        if (notes.length === 0) return notes;
        
        const currentKeyIndex = notes[0] % 12;
        const semitoneShift = targetKeyIndex - currentKeyIndex;
        
        return notes.map(note => note + semitoneShift);
    }

    /**
     * Transpose single note to new key
     */
    transposeNote(midiNote, targetKey) {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const targetKeyIndex = keys.indexOf(targetKey);
        const currentKeyIndex = midiNote % 12;
        const semitoneShift = targetKeyIndex - currentKeyIndex;
        return midiNote + semitoneShift;
    }

    /**
     * Generate drum pattern from rhythm analysis
     */
    generateDrums(folderCharacteristics, bars = 4) {
        const { rhythmPatterns, tempo, complexity } = folderCharacteristics;

        const stepsPerBar = 16;
        const totalSteps = bars * stepsPerBar;

        // Basic drum pattern structure
        const drumPattern = {
            kick: Array(totalSteps).fill(false),
            snare: Array(totalSteps).fill(false),
            closedHat: Array(totalSteps).fill(false),
            openHat: Array(totalSteps).fill(false),
            clap: Array(totalSteps).fill(false)
        };

        // Kick pattern (on beats 1 and 3)
        for (let bar = 0; bar < bars; bar++) {
            const barStart = bar * stepsPerBar;
            drumPattern.kick[barStart] = true; // Beat 1
            drumPattern.kick[barStart + 8] = true; // Beat 3
            
            if (complexity === 'complex') {
                drumPattern.kick[barStart + 6] = true; // Syncopation
            }
        }

        // Snare/Clap pattern (on beats 2 and 4)
        for (let bar = 0; bar < bars; bar++) {
            const barStart = bar * stepsPerBar;
            drumPattern.snare[barStart + 4] = true; // Beat 2
            drumPattern.clap[barStart + 12] = true; // Beat 4
        }

        // Hi-hat pattern (8th or 16th notes)
        const hatDensity = complexity === 'complex' ? 2 : 4; // Every 2 or 4 steps
        for (let step = 0; step < totalSteps; step += hatDensity) {
            drumPattern.closedHat[step] = true;
        }

        // Open hi-hat on off-beats
        if (complexity === 'complex') {
            for (let bar = 0; bar < bars; bar++) {
                const barStart = bar * stepsPerBar;
                drumPattern.openHat[barStart + 6] = true;
                drumPattern.openHat[barStart + 14] = true;
            }
        }

        return drumPattern;
    }
}

export default PatternGenerator;
