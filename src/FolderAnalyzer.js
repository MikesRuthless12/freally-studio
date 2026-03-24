// Folder Analyzer - Detect key, BPM, genre, and patterns from folder contents

import { MIDIParser } from './MIDIParser';
import { AudioAnalyzer } from './AudioAnalyzer';

export class FolderAnalyzer {
    constructor() {
        this.midiParser = new MIDIParser();
        this.audioAnalyzer = new AudioAnalyzer();
    }

    /**
     * Parse BPM, Key, Genre, and Mood from filename
     */
    parseMetadataFromFilename(filename) {
        const metadata = {
            bpm: null,
            key: null,
            scale: null,
            genre: null,
            mood: null
        };

        const name = filename.toUpperCase();

        // 1. Detect BPM (e.g. 128BPM or 128_BPM)
        const bpmMatch = name.match(/(\d+)\s?BPM/);
        if (bpmMatch) metadata.bpm = parseInt(bpmMatch[1]);

        // 2. Detect Key (e.g. Cmin, F#_MAJ, Am)
        const keys = ['C', 'C#', 'DB', 'D', 'D#', 'EB', 'E', 'F', 'F#', 'GB', 'G', 'G#', 'AB', 'A', 'A#', 'BB', 'B'];

        // Sort by length descending so "D#" is evaluated before "D" to prevent substring hijacking
        keys.sort((a, b) => b.length - a.length);

        for (const k of keys) {
            const safeK = k.replace('#', '\\#');
            // Strict regex: match key but ensure it's not part of another word
            const regex = new RegExp(`(?:^|[\\s_\\-])(${safeK})(?:MAJ|MIN|MAJOR|MINOR|M|m)?(?:[\\s_\\-]|$)`, 'i');
            const match = name.match(regex);
            if (match) {
                metadata.key = k.replace('DB', 'C#').replace('EB', 'D#').replace('GB', 'F#').replace('AB', 'G#').replace('BB', 'A#');

                // Look specifically for minor/major suffixes right after the key or in the string
                const scaleRegex = new RegExp(`(?:${safeK})(MAJ|MIN|MAJOR|MINOR|M(?![A-Z]))`, 'i');
                const scaleMatch = name.match(scaleRegex);
                const suffix = (scaleMatch ? scaleMatch[1] : '').toUpperCase();

                const isMinor = suffix.includes('MIN') || suffix === 'M' || name.includes('MINOR') || name.includes(' MIN') || name.includes('_MIN');
                metadata.scale = isMinor ? 'Minor' : 'Major';
                break;
            }
        }

        // 3. Detect Genre & Musical Archetype
        const genreGroups = {
            'FUNK_DISCO': ['FUNK', 'DISCO', 'CHIC', 'GROOVE', 'STRUT'],
            'SOULFUL_R&B': ['GOSPEL', 'JAZZ', 'R&B', 'SOUL', 'CLASSICAL', 'CHORAL', 'NEOSOUL'],
            'ROCK_METAL': ['ROCK', 'METAL', 'GRUNGE', 'PUNK', 'GUITAR'],
            'DRUM_BASS': ['DNB', 'JUNGLE', 'LIQUID', 'BREAKCORE'],
            'TRAP_DRILL_LOFI': ['TRAP', 'DRILL', 'LOFI', 'LO-FI', 'HIPHOP', 'BOOMBAP', 'PHONK'],
            'ELECTRONIC': ['HOUSE', 'TECHNO', 'EDM', 'DANCE', 'AMBIENT', 'GLITCH']
        };

        for (const [group, keywords] of Object.entries(genreGroups)) {
            if (keywords.some(k => name.includes(k))) {
                metadata.genre = group;
                break;
            }
        }


        // 4. Detect Mood
        const moods = {
            'DARK': ['DARK', 'EVIL', 'SPOOKY', 'OMINOUS', 'GRITTY'],
            'HAPPY': ['HAPPY', 'BRIGHT', 'CHILL', 'VIBEY', 'UPBEAT', 'POSITIVE'],
            'SAD': ['SAD', 'MELANCHOLY', 'EMOTIONAL', 'DEPRESSED', 'LONGING'],
            'HARD': ['HARD', 'AGGRESSIVE', 'POWERFUL', 'HEAVY', 'BRUTAL'],
            'SOULFUL': ['SOULFUL', 'WARM', 'GOSPEL', 'DEEP', 'LUSH'],
            'GROOVY': ['GROOVY', 'FUNKY', 'DANCE', 'DISCO']
        };

        for (const [m, keywords] of Object.entries(moods)) {
            if (keywords.some(k => name.includes(k))) {
                metadata.mood = m;
                break;
            }
        }

        return metadata;
    }


    /**
     * Analyze entire folder for musical characteristics
     */
    async analyzeFolder(files, folderName = '', onProgress = null, abortSignal = null) {
        const midiFiles = files.filter(f => f.name.toLowerCase().endsWith('.mid') || f.name.toLowerCase().endsWith('.midi'));
        const audioFiles = files.filter(f =>
            f.name.toLowerCase().endsWith('.wav') ||
            f.name.toLowerCase().endsWith('.mp3') ||
            f.name.toLowerCase().endsWith('.ogg') ||
            f.name.toLowerCase().endsWith('.m4a')
        );

        const totalToAnalyze = midiFiles.length + audioFiles.length;
        let analyzedCount = 0;

        const reportProgress = (status, path, overridePercent = null) => {
            if (onProgress) {
                const percent = overridePercent !== null ? overridePercent : (analyzedCount / totalToAnalyze) * 100;
                onProgress({
                    percent: parseFloat(percent.toFixed(2)),
                    path,
                    status
                });
            }
        };

        const checkAbort = () => {
            if (abortSignal && abortSignal.aborted) {
                throw new DOMException('Analysis cancelled', 'AbortError');
            }
        };

        console.log(`Analyzing folder: ${midiFiles.length} MIDI files, ${audioFiles.length} audio files`);

        // 1. Analyze MIDI files (Fast)
        const midiAnalyses = [];
        for (const file of midiFiles) {
            checkAbort();
            try {
                reportProgress('Analyzing MIDI...', file.name);
                const analysis = await this.analyzeMIDIFile(file);
                if (analysis) {
                    const meta = this.parseMetadataFromFilename(file.name);
                    midiAnalyses.push({ ...analysis, ...meta });
                }
                analyzedCount++;
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                console.error(`Error analyzing MIDI ${file.name}:`, error);
            }
        }

        checkAbort();

        // 2. Analyze Audio files (Intensive)
        const audioResults = await this.audioAnalyzer.analyzeMultipleFiles(audioFiles, (audioProgress) => {
            if (abortSignal && abortSignal.aborted) return;
            const audioStartIndex = midiFiles.length;
            const currentAudioIndex = Math.min(Math.floor((audioProgress / 100) * audioFiles.length), audioFiles.length - 1);
            const overallPercent = ((audioStartIndex + (audioProgress / 100) * audioFiles.length) / totalToAnalyze) * 100;
            reportProgress('Analyzing Audio DNA...', audioFiles[currentAudioIndex]?.name || '...', overallPercent);
        });

        checkAbort();

        // Add metadata to audio results
        audioResults.analyses = audioResults.analyses.map(a => ({
            ...a,
            ...this.parseMetadataFromFilename(a.filename)
        }));

        reportProgress('Finalizing...', 'All files processed', 100);

        // 3. Aggregate results
        return this.aggregateAnalyses(midiAnalyses, audioResults, files, folderName);
    }




    /**
     * Analyze single MIDI file
     */
    async analyzeMIDIFile(file) {
        try {
            const midiData = await this.midiParser.loadMIDIFile(file);

            // Combine all tracks
            const allNotes = [];
            midiData.tracks.forEach(track => {
                const notes = this.midiParser.eventsToNotes(track.events);
                allNotes.push(...notes);
            });

            if (allNotes.length === 0) {
                return null;
            }

            // Analyze pattern
            const analysis = this.midiParser.analyzePattern(allNotes);

            return {
                filename: file.name,
                ...analysis,
                ticksPerBeat: midiData.ticksPerBeat
            };
        } catch (error) {
            console.error(`Error parsing MIDI ${file.name}:`, error);
            return null;
        }
    }

    /**
     * Detects if the file is likely Bass, Chords, or Melody from its name/contents
     */
    detectFileRole(filename, analysis) {
        const name = filename.toUpperCase();

        // 1. Filename heuristics (strongest)
        if (name.includes('BASS') || name.includes('SUB') || name.includes('808') || name.includes('REESE')) return 'bass';
        if (name.includes('CHORD') || name.includes('PAD') || name.includes('KEYS') || name.includes('PIANO') || name.includes('RHODES')) return 'chords';
        if (name.includes('MELOD') || name.includes('LEAD') || name.includes('PLUCK') || name.includes('VOX') || name.includes('VOCAL') || name.includes('ARP') || name.includes('GUITAR') || name.includes('FLUTE') || name.includes('BRASS') || name.includes('STRING')) return 'melody';

        // 2. Content heuristics (if MIDI)
        if (analysis) {
            // Chords: if more than 25% of the steps with notes have chords (3+ notes)
            if (analysis.chords && analysis.notesInSteps) {
                const uniqueStepsWithNotes = new Set(analysis.notesInSteps.map(n => n.step)).size;
                if (uniqueStepsWithNotes > 0 && (analysis.chords.length / uniqueStepsWithNotes) > 0.25) {
                    return 'chords';
                }
            }

            // Bass: low pitch
            const avgPitch = analysis.notesInSteps ?
                analysis.notesInSteps.reduce((sum, n) => sum + n.note, 0) / analysis.notesInSteps.length :
                (analysis.pitches && analysis.pitches.length > 0 ? analysis.pitches.reduce((sum, n) => sum + n.midiNote, 0) / analysis.pitches.length : 60);

            if (avgPitch < 50) return 'bass';

            // Distinct melody heuristic: largely monophonic lines spanning wider ranges or sitting mid-high
            if (avgPitch >= 60) return 'melody';
        }

        return 'melody'; // default
    }

    /**
     * Aggregate all analyses to determine folder characteristics
     */
    aggregateAnalyses(midiAnalyses, audioAnalyses, allFiles, folderName = '') {
        // Parse folder name for global priority
        const folderMeta = this.parseMetadataFromFilename(folderName);

        // Detect key/scale with folder priority
        const detectedKey = this.detectKey(midiAnalyses, audioAnalyses, folderMeta.key);

        // Detect tempo with folder priority
        const detectedTempo = this.detectTempo(midiAnalyses, audioAnalyses, folderMeta.bpm);

        // Detect genre
        const detectedGenre = this.detectGenre(allFiles, detectedTempo, midiAnalyses, audioAnalyses, folderName);

        // Detect Mood
        const detectedMood = this.detectMood(midiAnalyses, audioAnalyses, folderName);

        // Extract chord progressions
        const chordProgressions = this.extractChordProgressions(midiAnalyses);

        // Extract melodic patterns
        const melodicPatterns = this.extractMelodicPatterns(midiAnalyses);

        // Extract rhythm patterns
        const rhythmPatterns = this.extractRhythmPatterns(midiAnalyses, audioAnalyses);

        // Detect scale type with folder priority
        const detectedScale = this.detectScale(midiAnalyses, audioAnalyses, folderMeta.scale) || 'Minor';

        // Collect and split motifs by type cleanly using filename and polyphony heuristics
        const allAnalyses = [
            ...midiAnalyses,
            ...(audioAnalyses && audioAnalyses.analyses ? audioAnalyses.analyses : [])
        ];

        const motifsByType = {
            bass: [],
            chords: [],
            melody: []
        };

        allAnalyses.forEach(analysis => {
            if (!analysis.motifs || analysis.motifs.length === 0) return;
            const role = this.detectFileRole(analysis.filename, analysis);
            if (motifsByType[role]) {
                motifsByType[role].push(...analysis.motifs);
            }
        });

        // Calculate complexity
        const complexity = this.calculateComplexity(midiAnalyses);


        // Detect folder content type
        const folderType = this.detectFolderType(allFiles, midiAnalyses, audioAnalyses);

        return {
            key: detectedKey,
            scale: detectedScale,
            tempo: detectedTempo,
            genre: detectedGenre,
            genreGroup: detectedGenre, // Use group as primary genre
            mood: detectedMood,
            chordProgressions,
            melodicPatterns,
            rhythmPatterns,
            motifsByType,
            complexity,
            folderType
        };
    }




    /**
     * Detect most likely key from analyses
     */
    detectKey(midiAnalyses, audioAnalyses, folderKey = null) {
        // High priority: Folder name label
        if (folderKey) return folderKey;

        // Priority to explicit metadata from individual files (filenames)
        const allAnalyses = [...midiAnalyses, ...(audioAnalyses ? audioAnalyses.analyses : [])];
        const keyVotes = new Map();

        allAnalyses.forEach(a => {
            if (a.key) {
                keyVotes.set(a.key, (keyVotes.get(a.key) || 0) + 2); // Metadata weighted heavily
            }
            if (a.likelyKey) {
                const weight = a.pitches ? 0.8 : 1.0; // MIDI weighted more
                keyVotes.set(a.likelyKey, (keyVotes.get(a.likelyKey) || 0) + weight);
            }
        });

        if (keyVotes.size === 0) return 'C';

        return Array.from(keyVotes.entries())
            .sort((a, b) => b[1] - a[1])[0][0];
    }


    /**
     * Detect scale type (Major, Minor, etc.)
     */
    detectScale(midiAnalyses, audioAnalyses, folderScale = null) {
        // High priority: Folder name label
        if (folderScale) return folderScale;

        const allAnalyses = [...midiAnalyses, ...(audioAnalyses ? audioAnalyses.analyses : [])];
        if (allAnalyses.length === 0) return 'Minor';

        const scaleVotes = new Map();
        allAnalyses.forEach(a => {
            if (a.scale) {
                scaleVotes.set(a.scale, (scaleVotes.get(a.scale) || 0) + 2);
            }
            if (a.likelyScale) {
                scaleVotes.set(a.likelyScale, (scaleVotes.get(a.likelyScale) || 0) + (a.pitches ? 0.8 : 1));
            }
        });

        if (scaleVotes.size === 0) return 'Minor';

        return Array.from(scaleVotes.entries())
            .sort((a, b) => b[1] - a[1])[0][0];
    }


    /**
     * Detect tempo from analyses
     */
    detectTempo(midiAnalyses, audioAnalyses, folderBpm = null) {
        // High priority: Folder name label
        if (folderBpm) return folderBpm;

        // Priority to metadata
        const allAnalyses = [...midiAnalyses, ...(audioAnalyses ? audioAnalyses.analyses : [])];
        const metaTempo = allAnalyses.find(a => a.bpm)?.bpm;
        if (metaTempo) return metaTempo;

        const tempos = [];

        // From audio
        if (audioAnalyses && audioAnalyses.analyses) {
            audioAnalyses.analyses.forEach(analysis => {
                if (analysis.tempo) tempos.push(analysis.tempo);
            });
        }

        // From MIDI
        midiAnalyses.forEach(analysis => {
            if (analysis.notesInSteps && analysis.notesInSteps.length > 0) {
                tempos.push(120); // Fallback
            }
        });

        if (tempos.length === 0) return 120;
        const sortedTempos = tempos.sort((a, b) => a - b);
        return Math.round(sortedTempos[Math.floor(sortedTempos.length / 2)]);
    }


    /**
     * Detect genre from folder name and characteristics
     */
    detectGenre(files, tempo, midiAnalyses, audioResults, folderName = '') {
        // 1. Priority to metadata
        const allAnalyses = [...midiAnalyses, ...(audioResults ? audioResults.analyses : [])];
        const metaGenre = allAnalyses.find(a => a.genre)?.genre;
        if (metaGenre) return metaGenre;

        // 2. Filename keyword mapping
        const allNames = folderName.toUpperCase() + ' ' + files.map(f => f.name.toUpperCase()).join(' ');
        const genreGroups = {
            'FUNK_DISCO': ['FUNK', 'DISCO', 'GROOVE'],
            'SOULFUL_R&B': ['GOSPEL', 'JAZZ', 'R&B', 'SOUL', 'CLASSICAL', 'NEOSOUL'],
            'ROCK_METAL': ['ROCK', 'METAL', 'GUITAR'],
            'DRUM_BASS': ['DNB', 'JUNGLE', 'BREAKCORE', 'DRUM AND BASS'],
            'TRAP_DRILL_LOFI': ['TRAP', 'DRILL', 'LOFI', 'LO-FI', 'HIPHOP', 'BOOMBAP', 'PHONK', '808'],
            'ELECTRONIC': ['HOUSE', 'TECHNO', 'EDM', 'DANCE']
        };

        for (const [group, keywords] of Object.entries(genreGroups)) {
            if (keywords.some(k => allNames.includes(k))) return group;
        }

        // 3. Fallback to tempo
        if (tempo >= 165) return 'DRUM_BASS';
        if (tempo >= 120 && tempo < 165) return 'TRAP_DRILL_LOFI';
        if (tempo > 115) return 'ELECTRONIC';

        return 'TRAP_DRILL_LOFI';
    }

    /**
     * Detect Mood
     */
    detectMood(midiAnalyses, audioResults, folderName = '') {
        // Priority to metadata
        const allAnalyses = [...midiAnalyses, ...(audioResults ? audioResults.analyses : [])];
        const metaMood = allAnalyses.find(a => a.mood)?.mood;
        if (metaMood) return metaMood;

        const folderUpper = folderName.toUpperCase();

        const moods = {
            'Dark': ['DARK', 'EVIL', 'SPOOKY', 'OMINOUS', 'GRITTY'],
            'Happy': ['HAPPY', 'BRIGHT', 'CHILL', 'VIBEY', 'UPBEAT', 'POSITIVE'],
            'Sad': ['SAD', 'MELANCHOLY', 'EMOTIONAL', 'DEPRESSED', 'LONGING'],
            'Energetic': ['HARD', 'AGGRESSIVE', 'POWERFUL', 'HEAVY', 'BRUTAL', 'ENERGETIC'],
            'Melodic': ['SOULFUL', 'WARM', 'GOSPEL', 'DEEP', 'LUSH', 'MELODIC'],
        };

        for (const [m, keywords] of Object.entries(moods)) {
            if (keywords.some(k => folderUpper.includes(k))) {
                return m;
            }
        }

        return 'Standard';
    }


    /**
     * Extract chord progressions from MIDI analyses
     */
    extractChordProgressions(midiAnalyses) {
        const progressions = [];

        midiAnalyses.forEach(analysis => {
            if (analysis.chords && analysis.chords.length > 0) {
                progressions.push(analysis.chords);
            }
        });

        return progressions;
    }

    /**
     * Extract melodic patterns
     */
    extractMelodicPatterns(midiAnalyses) {
        const patterns = [];

        midiAnalyses.forEach(analysis => {
            if (analysis.notesInSteps && analysis.notesInSteps.length > 0) {
                // Extract melodic contour (intervals between notes)
                const notes = analysis.notesInSteps.sort((a, b) => a.step - b.step);
                const intervals = [];
                for (let i = 1; i < notes.length; i++) {
                    intervals.push(notes[i].note - notes[i - 1].note);
                }

                patterns.push({
                    notes: notes.map(n => ({ note: n.note, step: n.step, velocity: n.velocity || 100 })),
                    intervals,
                    range: analysis.range,
                    density: analysis.density
                });
            }
        });

        return patterns;
    }

    /**
     * Extract rhythm patterns
     */
    extractRhythmPatterns(midiAnalyses, audioAnalyses) {
        const patterns = [];

        // From MIDI
        midiAnalyses.forEach(analysis => {
            if (analysis.rhythmPattern) {
                patterns.push({
                    type: 'midi',
                    pattern: analysis.rhythmPattern
                });
            }
        });

        // From audio
        audioAnalyses.analyses.forEach(analysis => {
            if (analysis.rhythmPattern) {
                patterns.push({
                    type: 'audio',
                    pattern: analysis.rhythmPattern
                });
            }
        });

        return patterns;
    }

    /**
     * Calculate complexity level
     */
    calculateComplexity(midiAnalyses) {
        if (midiAnalyses.length === 0) return 'simple';

        const avgNoteCount = midiAnalyses.reduce((sum, a) => sum + (a.noteCount || 0), 0) / midiAnalyses.length;
        const avgRange = midiAnalyses.reduce((sum, a) => sum + (a.range || 0), 0) / midiAnalyses.length;
        const avgDensity = midiAnalyses.reduce((sum, a) => sum + (a.density || 0), 0) / midiAnalyses.length;

        // Simple heuristic
        const complexityScore = (avgNoteCount / 20) + (avgRange / 24) + (avgDensity * 10);

        return complexityScore > 1.5 ? 'complex' : 'simple';
    }

    /**
     * Calculate confidence in detection
     */
    calculateConfidence(midiAnalyses, audioAnalyses) {
        const totalFiles = midiAnalyses.length + audioAnalyses.length;
        if (totalFiles === 0) return 0;

        // More files = higher confidence
        const fileConfidence = Math.min(totalFiles / 5, 1);

        // MIDI files give higher confidence than audio
        const midiWeight = midiAnalyses.length / totalFiles;
        const confidence = fileConfidence * (0.5 + midiWeight * 0.5);

        return Math.round(confidence * 100);
    }

    /**
     * Generate pattern based on folder analysis
     */
    generateFromAnalysis(folderCharacteristics, type = 'melody', bars = 4, complexity = 'simple') {
        const { motifsByType, key, scale, chordProgressions } = folderCharacteristics;

        if (type === 'chords' && chordProgressions?.length > 0) {
            // Pick a random progression and transpose
            return this.generateChordsFromTemplate(chordProgressions[Math.floor(Math.random() * chordProgressions.length)], key, scale, complexity);
        }

        // For rhythm types (drums/perc), we prioritize extracted rhythm patterns
        if (type === 'drums' && folderCharacteristics.rhythmPatterns?.length > 0) {
            const drumPatterns = this.generateDrumsFromRhythms(folderCharacteristics.rhythmPatterns, bars);
            // ONLY return if we actually found something meaningful, otherwise return null to allow procedural gen
            if (drumPatterns) return drumPatterns;
        }

        // Use type-specific motifs if available
        const motifs = motifsByType?.[type] || [];

        if (motifs && motifs.length > 0) {
            // Professional generative approach using specialized motifs
            const pattern = this.generateProfessionalPattern(motifs, key, scale, bars, complexity, type);
            // Ensure pattern has actual notes before returning
            if (pattern && pattern.length > 0) return pattern;
        }

        return null; // Signals the app wrapper to algorithmically generate this part cleanly
    }

    /**
     * Synthesize drum patterns from extracted rhythm data
     */
    generateDrumsFromRhythms(rhythms, bars) {
        // Collect common step positions for kicks, snares, hats based on statistical density 
        // to pass directly into DrumGeneratorEnhanced as an externalPattern block

        const totalSteps = bars * 32;
        const result = {
            kick: { root: { pattern: Array(totalSteps).fill(false), duration: Array(totalSteps).fill(1), velocity: Array(totalSteps).fill(100), pitch: 0 } },
            snare: { root: { pattern: Array(totalSteps).fill(false), duration: Array(totalSteps).fill(1), velocity: Array(totalSteps).fill(100), pitch: 0 } },
            closedHat: { root: { pattern: Array(totalSteps).fill(false), duration: Array(totalSteps).fill(1), velocity: Array(totalSteps).fill(100), pitch: 0 } },
        };

        let hasData = false;

        // Map MIDI/Audio rhythm pulses to specific drum tracks
        rhythms.forEach(r => {
            if (Array.isArray(r.pattern)) {
                r.pattern.forEach(p => {
                    const step = Array.isArray(p) ? p[0] : p.time;
                    const count = Array.isArray(p) ? p[1] : 1;
                    const velocity = p.velocity ? Math.round(p.velocity * 127) : 100;

                    const mappedStep = Math.round(step * 2); // 16th to 32nd mapping 
                    if (mappedStep < totalSteps) {

                        const sixteenthBeat = mappedStep % 8; // Offset within a quarter note (0, 2, 4, 6)
                        const barStep = mappedStep % 32;

                        // Heuristic distribution (refined to be less "every beat"):
                        // Kick: Beat 1 (0) ALWAYS, Beat 3 (16) if strong, and syncopations (offbeats)
                        if (barStep === 0) {
                            result.kick.root.pattern[mappedStep] = true;
                            result.kick.root.velocity[mappedStep] = Math.max(velocity, 110);
                            hasData = true;
                        }
                        // Syncopated kick: e.g. "and of 2" (12) or "and of 4" (28)
                        else if ((barStep === 12 || barStep === 28) && count > 1) {
                            result.kick.root.pattern[mappedStep] = true;
                            result.kick.root.velocity[mappedStep] = velocity;
                            hasData = true;
                        }

                        // Snare: Beat 2 (8) and Beat 4 (24) backbeat
                        else if (barStep === 8 || barStep === 24) {
                            result.snare.root.pattern[mappedStep] = true;
                            result.snare.root.velocity[mappedStep] = Math.max(velocity, 105);
                            hasData = true;
                        }

                        // Closed Hat: Any 8th (0, 4) or 16th (2, 6) if not already a kick/snare
                        else if ((sixteenthBeat === 0 || sixteenthBeat === 4 || sixteenthBeat === 2 || sixteenthBeat === 6) && count > 2) {
                            result.closedHat.root.pattern[mappedStep] = true;
                            result.closedHat.root.velocity[mappedStep] = Math.max(velocity, 85);
                            hasData = true;
                        }
                    }
                });
            }
        });

        return hasData ? result : null;
    }



    /**
     * Generate original pattern by weaving motifs together (Professional Style)
     */
    generateProfessionalPattern(motifs, targetKey, targetScale, bars, complexity = 'simple', role = 'melody') {
        const totalSteps = bars * 32;
        const pattern = [];
        let currentStep = 0;

        // Shuffle motifs to avoid exact replication
        const shuffled = [...motifs].sort(() => 0.5 - Math.random());
        let motifIndex = 0;

        while (currentStep < totalSteps) {
            const motif = shuffled[motifIndex % shuffled.length];
            motifIndex++;

            // 8, 16, or 32 steps duration for the segment (cleaner chunks max to a bar)
            let durationSteps = 8 + Math.floor(Math.random() * 3) * 8;
            if (complexity === 'complex') {
                durationSteps = 4 + Math.floor(Math.random() * 3) * 4;
            }

            // Cap at total steps
            if (currentStep + durationSteps > totalSteps) {
                durationSteps = totalSteps - currentStep;
            }

            // Ensure we are shifting the Motif's base starting note to fit the target key/scale
            // without necessarily ruining its internal relational jumps
            const anchorNote = motif[0] ? motif[0].note || (motif[0].relNote + 60) : 60;
            let targetAnchor = this.transposeToKey(anchorNote, targetKey);

            // Squash the anchor note into the optimal octave bounds to prevent jumping
            let baseMidi = 60; // C4 for melody
            if (role === 'bass') baseMidi = 36; // C2 for bass
            else if (role === 'chords') baseMidi = 48; // C3 for chords
            else if (role === 'melody') baseMidi = 60; // C4 for melody

            while (targetAnchor < baseMidi) targetAnchor += 12;
            while (targetAnchor >= baseMidi + 12) targetAnchor -= 12;

            const shiftAmount = targetAnchor - anchorNote;

            motif.forEach((note, index) => {
                const noteRelTime = note.relStep || 0;
                if (noteRelTime < durationSteps && currentStep + noteRelTime < totalSteps) {

                    // Sparsity/Density Filter: Don't just dump every note.
                    // Simple = less notes, Complex = more notes, Melody = sparser than Chords
                    const isDownbeat = (noteRelTime % 8) === 0;
                    const isUpbeat = (noteRelTime % 4) === 0;

                    let keepProbability = 1.0;
                    if (role === 'melody') {
                        keepProbability = complexity === 'simple' ? 0.4 : 0.7;
                        if (isDownbeat) keepProbability += 0.3; // Favor downbeats
                    } else if (role === 'bass') {
                        keepProbability = complexity === 'simple' ? 0.5 : 0.8;
                        if (isUpbeat) keepProbability += 0.2;
                    } else if (role === 'chords') {
                        // Chords need to be sustained mostly, drop rapid passing chords
                        keepProbability = complexity === 'simple' ? 0.3 : 0.6;
                        if (isDownbeat) keepProbability = 1.0;
                    }

                    // Always keep the very first note of a motif to establish the anchor
                    if (index > 0 && Math.random() > keepProbability) {
                        return; // Skip this note to create sparsity
                    }

                    const originalPitch = note.note || (anchorNote + note.relNote);
                    let finalPitch = originalPitch + shiftAmount;

                    // Apply strict bounds based on role to prevent pitch tracker noise from causing massive jumps
                    // Melody: 60 - 76 (C4 to E5)
                    // Chords: 48 - 64 (C3 to E4)
                    // Bass: 36 - 47 (C2 to B2)
                    const minMidi = baseMidi;
                    const maxMidi = role === 'bass' ? baseMidi + 11 : baseMidi + 16;

                    while (finalPitch < minMidi) finalPitch += 12;
                    while (finalPitch > maxMidi) finalPitch -= 12;

                    // Ensure final pitch resides within target scale for absolute safety
                    finalPitch = this.snapToScale(finalPitch, targetKey, targetScale);

                    pattern.push({
                        time: currentStep + noteRelTime,
                        duration: role === 'chords' ? Math.max(note.duration || 4, 8) : (note.duration || 2),
                        note: finalPitch,
                        velocity: 0.7 + Math.random() * 0.2
                    });
                }
            });

            currentStep += durationSteps;
        }

        // Deduplicate notes landing on exactly the same time/pitch
        const uniquePattern = [];
        const seen = new Set();
        for (const n of pattern) {
            const key = `${n.time}-${n.note}`;
            if (!seen.has(key)) {
                uniquePattern.push(n);
                seen.add(key);
            }
        }

        return uniquePattern;
    }

    /**
     * Help transpose a note to fit specifically within the target scale
     */
    transposeToScale(midiNote, targetKey, targetScale) {
        const keyOffset = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(targetKey);
        const scaleIntervals = {
            'Major': [0, 2, 4, 5, 7, 9, 11],
            'Minor': [0, 2, 3, 5, 7, 8, 10],
            'Dorian': [0, 2, 3, 5, 7, 9, 10],
            'Phrygian': [0, 1, 3, 5, 7, 8, 10],
            'Lydian': [0, 2, 4, 6, 7, 9, 11],
            'Mixolydian': [0, 2, 4, 5, 7, 9, 10]
        }[targetScale] || [0, 2, 3, 5, 7, 8, 10];

        const octave = Math.floor(midiNote / 12);
        const pitch = midiNote % 12;

        // Find closest pitch in scale
        let closestPitch = scaleIntervals[0];
        let minDiff = 12;

        scaleIntervals.forEach(interval => {
            const scalePitch = (keyOffset + interval) % 12;
            const diff = Math.abs(pitch - scalePitch);
            if (diff < minDiff) {
                minDiff = diff;
                closestPitch = scalePitch;
            }
        });

        return (octave * 12) + closestPitch;
    }


    /**
     * Generate chords from template
     */
    generateChordsFromTemplate(template, key, scale, complexity = 'simple') {
        const notes = [];
        let currentTime = 0;

        // Simple = 32 steps per chord
        // Complex = 16 steps per chord, or stab rhythm
        const chordDuration = complexity === 'simple' ? 32 : 16;

        template.forEach(chord => {
            chord.notes.forEach(note => {
                notes.push({
                    time: currentTime,
                    duration: chordDuration - 1, // Leave slight gap
                    note: this.transposeToKey(note, key),
                    velocity: 0.75 + Math.random() * 0.15
                });
            });
            currentTime += chordDuration;
        });

        return notes;
    }

    /**
     * Generate melody from template
     */
    generateMelodyFromTemplate(template, key, scale) {
        // Use template intervals but transpose to new key
        const baseNote = this.getKeyMIDINote(key, 4);
        const newNotes = [];

        template.notes.forEach(note => {
            const transposedNote = this.transposeToKey(note.note, key);
            newNotes.push({
                ...note,
                note: transposedNote
            });
        });

        return newNotes;
    }

    /**
     * Generate bass from template
     */
    generateBassFromTemplate(template, key, scale) {
        // Use template rhythm but lower octave
        const baseNote = this.getKeyMIDINote(key, 2);
        const newNotes = [];

        template.notes.forEach(note => {
            const transposedNote = this.transposeToKey(note.note, key) - 24; // Two octaves lower
            newNotes.push({
                ...note,
                note: transposedNote
            });
        });

        return newNotes;
    }

    /**
     * Transpose note to new key
     */
    transposeToKey(midiNote, targetKey) {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const targetKeyIndex = keys.indexOf(targetKey);
        const currentKeyIndex = midiNote % 12;
        const semitoneShift = targetKeyIndex - currentKeyIndex;
        return midiNote + semitoneShift;
    }

    /**
     * Force a MIDI pitch into the current scale
     */
    snapToScale(midiNote, targetKey, targetScale) {
        const keyOffset = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(targetKey);
        const scaleIntervals = {
            'Major': [0, 2, 4, 5, 7, 9, 11],
            'Minor': [0, 2, 3, 5, 7, 8, 10],
            'Dorian': [0, 2, 3, 5, 7, 9, 10],
            'Phrygian': [0, 1, 3, 5, 7, 8, 10],
            'Lydian': [0, 2, 4, 6, 7, 9, 11],
            'Mixolydian': [0, 2, 4, 5, 7, 9, 10]
        }[targetScale] || [0, 2, 3, 5, 7, 8, 10];

        const octave = Math.floor(midiNote / 12);
        const pitch = midiNote % 12;

        let closestPitch = scaleIntervals[0];
        let minDiff = 12;

        scaleIntervals.forEach(interval => {
            const scalePitch = (keyOffset + interval) % 12;
            const diff = Math.min(Math.abs(pitch - scalePitch), 12 - Math.abs(pitch - scalePitch));
            if (diff < minDiff) {
                minDiff = diff;
                closestPitch = scalePitch;
            }
        });

        // Resolve absolute note
        let resolvedNote = (octave * 12) + closestPitch;

        // Fix octave boundary cross (e.g. if B snapped to C but actually should go up)
        if (Math.abs(resolvedNote - midiNote) > 6) {
            if (resolvedNote > midiNote) resolvedNote -= 12;
            else resolvedNote += 12;
        }

        return resolvedNote;
    }

    /**
     * Detect whether a folder contains primarily drum samples, melodic content, or a mix.
     * Returns 'drums', 'melodic', or 'mixed'.
     */
    detectFolderType(files, midiAnalyses, audioAnalyses) {
        const drumKeywords = ['kick', 'snare', 'hat', 'hihat', 'hi-hat', 'clap', 'perc', 'tom', 'crash', 'ride', 'cymbal', '808', 'rim', 'shaker', 'drum'];
        const melodicKeywords = ['melody', 'chord', 'bass', 'pad', 'synth', 'piano', 'keys', 'lead', 'strings', 'vocal', 'vox', 'arp', 'pluck'];

        let drumCount = 0;
        let melodicCount = 0;

        for (const file of files) {
            const name = file.name.toLowerCase();
            const isDrum = drumKeywords.some(k => name.includes(k));
            const isMelodic = melodicKeywords.some(k => name.includes(k));

            if (isDrum) drumCount++;
            if (isMelodic) melodicCount++;
        }

        const totalMatched = drumCount + melodicCount;

        if (totalMatched > 0) {
            if (drumCount / totalMatched > 0.6) return 'drums';
            if (melodicCount / totalMatched > 0.6) return 'melodic';
            return 'mixed';
        }

        // No keyword matches — check audio durations if available
        const audioArr = audioAnalyses && audioAnalyses.analyses ? audioAnalyses.analyses : [];
        if (audioArr.length > 0) {
            const durations = audioArr.map(a => a.duration || 0).filter(d => d > 0);
            if (durations.length > 0) {
                const avgDuration = durations.reduce((s, d) => s + d, 0) / durations.length;
                return avgDuration < 2 ? 'drums' : 'melodic';
            }
        }

        return 'mixed';
    }

    /**
     * Map internal genre group names (e.g. 'TRAP_DRILL_LOFI') to display genre names
     * used by the app's setGlobalGenre (e.g. 'Trap').
     */
    static mapGenreGroupToName(genreGroup) {
        const mapping = {
            'TRAP_DRILL_LOFI': 'Trap',
            'ELECTRONIC': 'House',
            'DRUM_BASS': 'Drum & Bass',
            'ROCK_METAL': 'Rock',
            'FUNK_DISCO': 'Funk',
            'SOULFUL_R&B': 'R&B'
        };
        return mapping[genreGroup] || 'Trap';
    }

    /**
     * Get MIDI note number for key at octave
     */
    getKeyMIDINote(key, octave) {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const keyIndex = keys.indexOf(key);
        return 12 * (octave + 1) + keyIndex;
    }
}

export default FolderAnalyzer;
