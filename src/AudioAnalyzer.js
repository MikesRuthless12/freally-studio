// Audio Analysis System - Extract musical patterns from audio files

export class AudioAnalyzer {
    constructor() {
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
        }
        this.audioContext = window.sharedAnalysisCtx;
    }

    /**
     * Analyze audio file for pitch and rhythm
     */
    async analyzeAudioFile(audioBuffer) {
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);

        // Detect onset times (rhythm)
        const onsets = this.detectOnsets(channelData, sampleRate);

        // Detect pitch and duration at each onset
        const pitches = [];
        for (let i = 0; i < onsets.length; i++) {
            const onset = onsets[i];
            const nextOnset = onsets[i + 1];
            const pitch = this.detectPitch(channelData, onset.sample, sampleRate);
            if (pitch) {
                // Remove truncation by nextOnset to prevent elongated notes from being chopped
                const maxEndSample = channelData.length;
                const noteDuration = this.analyzeNoteDuration(channelData, onset.sample, maxEndSample, sampleRate);

                pitches.push({
                    time: onset.time,
                    sample: onset.sample,
                    duration: noteDuration,
                    frequency: pitch.frequency,
                    midiNote: pitch.midiNote,
                    confidence: pitch.confidence
                });
            }
        }

        // Analyze rhythm pattern
        const rhythmPattern = this.analyzeRhythm(onsets);

        // Detect tempo
        const tempo = this.detectTempo(onsets);

        const { likelyKey, likelyScale } = this.detectKeyAndScale(pitches.map(p => p.midiNote));

        return {
            onsets,
            pitches,
            rhythmPattern,
            tempo,
            duration: audioBuffer.duration,
            likelyKey,
            likelyScale
        };
    }

    /**
     * Extract MIDI from audio with optional component filtering
     * @param {AudioBuffer} audioBuffer 
     * @param {number} tempo 
     * @param {string} componentType - 'bass', 'melody', 'chords', or 'all'
     */
    /**
     * Async MIDI extraction with FFT spectral peak detection and progress reporting.
     * Finds multiple simultaneous pitches (chords) at each grid position.
     * @param {AudioBuffer} audioBuffer
     * @param {number} tempo
     * @param {string} componentType - 'bass', 'melody', 'chords', 'drums', or 'all'
     * @param {function} onProgress - optional callback(percent: 0-100)
     * @returns {Promise<Array|Object>}
     */
    async extractMIDI(audioBuffer, tempo = 120, componentType = 'all', onProgress) {
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        const stepDuration = 60 / (tempo * 8); // 32nd note in seconds

        if (componentType === 'drums') {
            return this._extractDrums(channelData, sampleRate, stepDuration);
        }

        const fftSize = 4096;
        const totalSteps = Math.ceil(audioBuffer.duration / stepDuration);
        // Scan every 16th note (every 2 × 32nd-note steps)
        const scanInterval = stepDuration * 2;
        const scanSamples = Math.round(scanInterval * sampleRate);
        const totalScans = Math.floor((channelData.length - fftSize) / scanSamples);

        // Frequency range per component
        const freqRange = {
            bass:   { min: 30,  max: 350  },
            melody: { min: 130, max: 4000 },
            chords: { min: 100, max: 3000 },
            all:    { min: 30,  max: 4000 },
        }[componentType] || { min: 30, max: 4000 };

        // --- Pass 1: FFT spectral scan at every grid position ---
        // gridFrames[i] = { step, notes: [midiNote, ...] }
        const gridFrames = [];
        let scanIdx = 0;

        for (let sample = 0; sample + fftSize < channelData.length; sample += scanSamples) {
            const step = Math.round((sample / sampleRate) / stepDuration);
            if (step >= totalSteps) break;

            // Skip silent frames
            const energy = this.getFrameEnergy(channelData, sample, 2048);
            if (energy < 0.00003) { scanIdx++; continue; }

            // FFT spectral peaks (multiple simultaneous notes)
            const fftPeaks = this._detectSpectralPeaks(channelData, sample, sampleRate, fftSize, freqRange);

            // Autocorrelation pitch (reliable single-pitch fallback)
            const acPitch = this.detectPitch(channelData, sample, sampleRate);

            // Merge: start with FFT peaks, ensure autocorrelation result is included
            const noteSet = new Set();
            const frameNotes = [];
            for (const p of fftPeaks) {
                if (!noteSet.has(p.midiNote)) { noteSet.add(p.midiNote); frameNotes.push(p.midiNote); }
            }
            if (acPitch && acPitch.confidence > 0.08) {
                let acNote = acPitch.midiNote;
                // Clamp to range
                if (componentType === 'bass') { while (acNote > 55) acNote -= 12; acNote = Math.max(28, acNote); }
                else if (componentType === 'melody') { while (acNote < 48) acNote += 12; while (acNote > 96) acNote -= 12; }
                if (!noteSet.has(acNote)) { noteSet.add(acNote); frameNotes.push(acNote); }
            }

            if (frameNotes.length > 0) {
                gridFrames.push({ step, notes: frameNotes });
            }

            // Yield to UI every ~50 scans
            scanIdx++;
            if (onProgress && scanIdx % 50 === 0) {
                onProgress(Math.round((scanIdx / totalScans) * 90));
                await new Promise(r => setTimeout(r, 0));
            }
        }

        if (onProgress) onProgress(92);

        console.warn(`[Extract:${componentType}] Scan: ${scanIdx} frames, ${gridFrames.length} with notes`);
        if (gridFrames.length === 0) return [];

        // --- Pass 2: Convert grid frames into note events ---
        // Track active notes per pitch; emit when a pitch disappears from the grid
        const activeNotes = new Map(); // midiNote → { startStep }
        const pattern = [];

        const emitNote = (note, startStep, endStep) => {
            let dur = Math.max(1, endStep - startStep + 2);
            if (componentType === 'bass') dur = Math.max(4, dur);
            pattern.push({ time: startStep, note, velocity: 1.0, duration: dur });
        };

        let prevStep = -999;
        for (const frame of gridFrames) {
            const currentNotes = new Set(frame.notes);
            const gap = frame.step - prevStep;

            // If there's a large gap, end all active notes
            if (gap > 4) {
                for (const [note, info] of activeNotes) {
                    emitNote(note, info.startStep, prevStep);
                }
                activeNotes.clear();
            }

            // End notes no longer present
            for (const [note, info] of activeNotes) {
                if (!currentNotes.has(note)) {
                    emitNote(note, info.startStep, prevStep);
                    activeNotes.delete(note);
                }
            }

            // Start new notes
            for (const note of currentNotes) {
                if (!activeNotes.has(note)) {
                    activeNotes.set(note, { startStep: frame.step });
                }
            }

            prevStep = frame.step;
        }

        // Flush remaining active notes
        for (const [note, info] of activeNotes) {
            emitNote(note, info.startStep, prevStep);
        }

        if (onProgress) onProgress(95);
        console.warn(`[Extract:${componentType}] Emitted ${pattern.length} raw notes`);

        // --- Pass 3: Deduplicate and apply voice filtering ---
        const seen = new Set();
        const uniquePattern = [];
        for (const n of pattern) {
            const key = `${n.time}-${n.note}`;
            if (!seen.has(key)) { uniquePattern.push(n); seen.add(key); }
        }

        const timeGroups = {};
        uniquePattern.forEach(n => {
            if (!timeGroups[n.time]) timeGroups[n.time] = [];
            timeGroups[n.time].push(n);
        });

        const finalPattern = [];
        Object.values(timeGroups).forEach(group => {
            group.sort((a, b) => a.note - b.note);
            if (componentType === 'bass') {
                finalPattern.push(...group.slice(0, 2));
            } else if (componentType === 'chords') {
                finalPattern.push(...(group.length > 6 ? group.slice(group.length - 6) : group));
            } else if (componentType === 'melody') {
                finalPattern.push(group[group.length - 1]); // Highest note
            } else {
                finalPattern.push(...group);
            }
        });

        finalPattern.sort((a, b) => a.time - b.time);
        if (onProgress) onProgress(100);
        return finalPattern;
    }

    /**
     * Radix-2 FFT (in-place, Cooley-Tukey)
     */
    _fft(real, imag) {
        const n = real.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const half = len >> 1;
            const angle = -2 * Math.PI / len;
            const wR = Math.cos(angle), wI = Math.sin(angle);
            for (let i = 0; i < n; i += len) {
                let cR = 1, cI = 0;
                for (let j = 0; j < half; j++) {
                    const uR = real[i + j], uI = imag[i + j];
                    const vR = real[i + j + half] * cR - imag[i + j + half] * cI;
                    const vI = real[i + j + half] * cI + imag[i + j + half] * cR;
                    real[i + j] = uR + vR; imag[i + j] = uI + vI;
                    real[i + j + half] = uR - vR; imag[i + j + half] = uI - vI;
                    const nR = cR * wR - cI * wI; cI = cR * wI + cI * wR; cR = nR;
                }
            }
        }
    }

    /**
     * Find multiple simultaneous pitches via FFT spectral peak detection
     */
    _detectSpectralPeaks(channelData, startSample, sampleRate, fftSize, freqRange) {
        const real = new Float64Array(fftSize);
        const imag = new Float64Array(fftSize);
        const end = Math.min(startSample + fftSize, channelData.length);
        for (let i = 0; i < fftSize && startSample + i < end; i++) {
            real[i] = channelData[startSample + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (fftSize - 1))); // Hann
        }
        this._fft(real, imag);

        const halfN = fftSize / 2;
        const freqRes = sampleRate / fftSize;
        const minBin = Math.max(1, Math.floor(freqRange.min / freqRes));
        const maxBin = Math.min(halfN - 1, Math.ceil(freqRange.max / freqRes));

        // Magnitude spectrum
        const mag = new Float64Array(halfN);
        for (let i = 0; i < halfN; i++) mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);

        // Threshold: 5% of the max magnitude in the frequency range
        let maxMag = 0;
        for (let i = minBin; i < maxBin; i++) { if (mag[i] > maxMag) maxMag = mag[i]; }
        if (maxMag === 0) return [];
        const threshold = maxMag * 0.05;

        // Find spectral peaks
        const rawPeaks = [];
        for (let i = minBin + 1; i < maxBin - 1; i++) {
            if (mag[i] > threshold && mag[i] > mag[i - 1] && mag[i] > mag[i + 1]) {
                // Parabolic interpolation
                const y1 = mag[i - 1], y2 = mag[i], y3 = mag[i + 1];
                const d = 2 * (2 * y2 - y1 - y3);
                const offset = d !== 0 ? (y1 - y3) / d : 0;
                const freq = (i + offset) * freqRes;
                const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
                if (midiNote >= 21 && midiNote <= 108) {
                    rawPeaks.push({ freq, midiNote, magnitude: y2 });
                }
            }
        }

        rawPeaks.sort((a, b) => b.magnitude - a.magnitude);

        // Remove only exact octave harmonics (2×, 4×) — don't remove 3rd/5th as they are real chord tones
        const fundamentals = [];
        for (const peak of rawPeaks) {
            let isOctaveHarmonic = false;
            for (const fund of fundamentals) {
                const ratio = peak.freq / fund.freq;
                if (Math.abs(ratio - 2) < 0.04 || Math.abs(ratio - 4) < 0.04) {
                    isOctaveHarmonic = true; break;
                }
            }
            if (!isOctaveHarmonic) fundamentals.push(peak);
        }

        // Deduplicate same MIDI note
        const noteMap = new Map();
        for (const p of fundamentals) {
            if (!noteMap.has(p.midiNote) || noteMap.get(p.midiNote).magnitude < p.magnitude) {
                noteMap.set(p.midiNote, p);
            }
        }
        return Array.from(noteMap.values()).sort((a, b) => a.midiNote - b.midiNote);
    }

    /**
     * Drum extraction using onset-based detection (percussive transients)
     */
    _extractDrums(channelData, sampleRate, stepDuration) {
        const onsets = this.detectOnsets(channelData, sampleRate);
        const drumPatterns = {
            kick: { root: { pattern: Array(128).fill(false), duration: Array(128).fill(1), velocity: Array(128).fill(100), pitch: 0 } },
            snare: { root: { pattern: Array(128).fill(false), duration: Array(128).fill(1), velocity: Array(128).fill(100), pitch: 0 } },
            closedHat: { root: { pattern: Array(128).fill(false), duration: Array(128).fill(1), velocity: Array(128).fill(100), pitch: 0 } },
        };
        for (const onset of onsets) {
            const step = Math.round(onset.time / stepDuration);
            if (step >= 128) continue;
            const pitch = this.detectPitch(channelData, onset.sample, sampleRate);
            const freq = pitch ? pitch.frequency : 100;
            if (freq < 150) {
                drumPatterns.kick.root.pattern[step] = true;
                drumPatterns.kick.root.velocity[step] = Math.round(onset.energy * 127 * 5);
            } else if (freq < 1000) {
                drumPatterns.snare.root.pattern[step] = true;
                drumPatterns.snare.root.velocity[step] = Math.round(onset.energy * 127 * 5);
            } else {
                drumPatterns.closedHat.root.pattern[step] = true;
                drumPatterns.closedHat.root.velocity[step] = Math.round(onset.energy * 127 * 5);
            }
        }
        return drumPatterns;
    }


    /**
     * Analyze how long a note lasts by checking energy decay
     */
    analyzeNoteDuration(channelData, startSample, maxEndSample, sampleRate) {
        const frameSize = 1024;
        const initialEnergy = this.getFrameEnergy(channelData, startSample, frameSize);
        if (initialEnergy === 0) return 0.1;

        // Threshold for considering a note finished: 15% of initial energy
        const silenceThreshold = initialEnergy * 0.15;
        let lastActiveSample = startSample;

        for (let s = startSample + frameSize; s < maxEndSample; s += frameSize) {
            const currentEnergy = this.getFrameEnergy(channelData, s, frameSize);
            if (currentEnergy > silenceThreshold) {
                lastActiveSample = s;
            } else {
                break;
            }
        }

        return (lastActiveSample - startSample) / sampleRate;
    }

    getFrameEnergy(channelData, startSample, frameSize) {
        let energy = 0;
        const end = Math.min(startSample + frameSize, channelData.length);
        for (let i = startSample; i < end; i++) {
            energy += channelData[i] ** 2;
        }
        return energy / frameSize;
    }

    /**
     * Applies a 2-pole biquad Low-Pass Filter (Butterworth, 12dB/oct)
     */
    applyLowPassFilter(buffer, cutoffFreq, sampleRate) {
        const w0 = 2 * Math.PI * cutoffFreq / sampleRate;
        const Q = 0.707; // Butterworth
        const alpha = Math.sin(w0) / (2 * Q);

        const b0 = (1 - Math.cos(w0)) / 2;
        const b1 = 1 - Math.cos(w0);
        const b2 = (1 - Math.cos(w0)) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;

        return this._applyBiquad(buffer, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
    }

    /**
     * Applies a 2-pole biquad High-Pass Filter (Butterworth, 12dB/oct)
     */
    applyHighPassFilter(buffer, cutoffFreq, sampleRate) {
        const w0 = 2 * Math.PI * cutoffFreq / sampleRate;
        const Q = 0.707; // Butterworth
        const alpha = Math.sin(w0) / (2 * Q);

        const b0 = (1 + Math.cos(w0)) / 2;
        const b1 = -(1 + Math.cos(w0));
        const b2 = (1 + Math.cos(w0)) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;

        return this._applyBiquad(buffer, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
    }

    /**
     * Applies a band-pass filter by cascading low-pass and high-pass
     */
    applyBandPassFilter(buffer, lowFreq, highFreq, sampleRate) {
        const highPassed = this.applyHighPassFilter(buffer, lowFreq, sampleRate);
        return this.applyLowPassFilter(highPassed, highFreq, sampleRate);
    }

    /**
     * Generic biquad filter implementation (Direct Form I)
     */
    _applyBiquad(buffer, b0, b1, b2, a1, a2) {
        const filtered = new Float32Array(buffer.length);
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

        for (let i = 0; i < buffer.length; i++) {
            const x0 = buffer[i];
            filtered[i] = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            x2 = x1; x1 = x0;
            y2 = y1; y1 = filtered[i];
        }
        return filtered;
    }


    /**
     * Detect onsets (note starts) using energy-based method
     */
    detectOnsets(channelData, sampleRate) {
        const onsets = [];
        const hopSize = 512;
        const windowSize = 2048;

        // Calculate energy in each frame
        const energies = [];
        for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += channelData[i + j] ** 2;
            }
            energies.push(energy / windowSize);
        }

        // Find peaks in energy (onsets)
        const threshold = this.calculateThreshold(energies);
        for (let i = 1; i < energies.length - 1; i++) {
            // Added a minimum absolute energy check to avoid detecting pure noise floor as onsets
            if (energies[i] > threshold &&
                energies[i] > 0.0001 &&
                energies[i] > energies[i - 1] &&
                energies[i] > energies[i + 1]) {
                const sample = i * hopSize;
                const time = sample / sampleRate;
                onsets.push({ sample, time, energy: energies[i] });
            }
        }

        return onsets;
    }

    /**
     * Calculate adaptive threshold for onset detection
     */
    calculateThreshold(energies) {
        const mean = energies.reduce((sum, e) => sum + e, 0) / energies.length;
        const variance = energies.reduce((sum, e) => sum + (e - mean) ** 2, 0) / energies.length;
        const stdDev = Math.sqrt(variance);
        // Lower multiplier to catch subtle melodic onsets (piano, synth pads)
        return mean + 0.8 * stdDev;
    }

    /**
     * Detect pitch using autocorrelation with parabolic interpolation
     */
    detectPitch(channelData, startSample, sampleRate) {
        const windowSize = 4096; // Increased from 2048 for better low-frequency resolution
        const endSample = Math.min(startSample + windowSize, channelData.length);
        const window = channelData.slice(startSample, endSample);

        if (window.length < windowSize / 2) {
            return null;
        }

        // Autocorrelation
        const autocorr = this.autocorrelation(window);

        // Find first peak after zero lag
        const minLag = Math.floor(sampleRate / 1000); // Max 1000 Hz
        const maxLag = Math.floor(sampleRate / 50);   // Min 50 Hz

        let maxCorr = 0;
        let bestLag = 0;

        for (let lag = minLag; lag < maxLag && lag < autocorr.length; lag++) {
            if (autocorr[lag] > maxCorr) {
                maxCorr = autocorr[lag];
                bestLag = lag;
            }
        }

        if (maxCorr < 0.1 || bestLag === 0) {
            return null; // No clear pitch detected
        }

        // Parabolic Interpolation for accurate fractional lag
        let refinedLag = bestLag;
        if (bestLag > 0 && bestLag < autocorr.length - 1) {
            const y1 = autocorr[bestLag - 1];
            const y2 = autocorr[bestLag];
            const y3 = autocorr[bestLag + 1];

            const denominator = 2 * (2 * y2 - y1 - y3);
            if (denominator !== 0) {
                const fraction = (y1 - y3) / denominator;
                refinedLag = bestLag + fraction;
            }
        }

        const frequency = sampleRate / refinedLag;
        const midiNote = this.frequencyToMIDI(frequency);

        return {
            frequency,
            midiNote: Math.round(midiNote),
            confidence: maxCorr
        };
    }

    /**
     * Autocorrelation function
     */
    autocorrelation(signal) {
        const length = signal.length;
        const autocorr = new Array(length).fill(0);

        for (let lag = 0; lag < length; lag++) {
            let sum = 0;
            for (let i = 0; i < length - lag; i++) {
                sum += signal[i] * signal[i + lag];
            }
            autocorr[lag] = sum / (length - lag);
        }

        // Normalize
        const max = Math.max(...autocorr);
        return autocorr.map(v => v / max);
    }

    /**
     * Convert frequency to MIDI note number
     */
    frequencyToMIDI(frequency) {
        return 69 + 12 * Math.log2(frequency / 440);
    }

    /**
     * Analyze rhythm pattern from onsets
     */
    analyzeRhythm(onsets) {
        if (onsets.length < 2) {
            return null;
        }

        // Calculate inter-onset intervals
        const intervals = [];
        for (let i = 1; i < onsets.length; i++) {
            intervals.push(onsets[i].time - onsets[i - 1].time);
        }

        // Find most common intervals (quantized to 16th notes)
        const quantizedIntervals = intervals.map(interval => {
            // Assuming 120 BPM, 16th note = 0.125 seconds
            const sixteenthNote = 0.125;
            return Math.round(interval / sixteenthNote);
        });

        // Count interval occurrences
        const intervalCounts = new Map();
        quantizedIntervals.forEach(interval => {
            intervalCounts.set(interval, (intervalCounts.get(interval) || 0) + 1);
        });

        return {
            intervals,
            quantizedIntervals,
            mostCommonInterval: Array.from(intervalCounts.entries())
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 1
        };
    }

    /**
     * Detect tempo from onsets
     */
    detectTempo(onsets) {
        console.log("--- Freally AudioAnalyzer V2 (FORCE_RELOAD CHECK) ---");
        if (onsets.length < 4) {
            return 120; // Default tempo
        }

        // Calculate inter-onset intervals
        const intervals = [];
        for (let i = 1; i < onsets.length; i++) {
            const interval = onsets[i].time - onsets[i - 1].time;
            if (interval > 0.05) { // Ignore extremely fast micro-transients
                intervals.push(interval);
            }
        }

        if (intervals.length === 0) return 120;

        // Find median interval (more robust than mean)
        const sortedIntervals = intervals.sort((a, b) => a - b);
        const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

        // Convert to BPM (assuming interval is quarter note)
        let tempo = 60 / medianInterval;

        // Normalize to standard range 60-190 BPM (Trap/House/Lofi)
        let iterations = 0;
        while (tempo > 200 && iterations < 5) {
            tempo /= 2;
            iterations++;
        }
        iterations = 0;
        while (tempo < 60 && iterations < 5) {
            tempo *= 2;
            iterations++;
        }

        // Final safety clamp
        if (isNaN(tempo) || tempo > 300 || tempo < 30) {
            console.warn("[Analyzer] Detected unrealistic tempo, defaulting: ", tempo);
            return 120;
        }

        const finalTempo = Math.round(tempo);
        console.log(`[Analyzer] Detected Tempo: ${finalTempo} BPM (Normalized from original guess)`);
        return finalTempo;
    }

    /**
     * Load audio file from File object
     */
    async loadAudioFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const audioBuffer = await this.audioContext.decodeAudioData(e.target.result);
                    resolve(audioBuffer);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Compute the most likely key and scale from an array of MIDI notes
     * @param {number[]} pitches 
     * @returns {{likelyKey: string, likelyScale: string}}
     */
    detectKeyAndScale(pitches) {
        if (!pitches || pitches.length === 0) return { likelyKey: 'C', likelyScale: 'Minor' };

        const noteCounts = new Array(12).fill(0);
        pitches.forEach(note => {
            noteCounts[note % 12]++;
        });

        const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Scale profiles (Weighted to emphasize root, 3rd, 5th)
        const scaleProfiles = {
            'Major': [1.0, 0, 0.5, 0, 0.8, 0.4, 0, 0.9, 0, 0.4, 0, 0.3], // Intervals: 0, 2, 4, 5, 7, 9, 11
            'Minor': [1.0, 0, 0.4, 0.8, 0, 0.4, 0, 0.9, 0.4, 0, 0.4, 0]  // Intervals: 0, 2, 3, 5, 7, 8, 10
        };

        let bestScore = -1;
        let bestKey = 'C';
        let bestScale = 'Minor';

        // Check all 12 keys against all scale types
        for (let rootNote = 0; rootNote < 12; rootNote++) {
            for (const [scaleName, profile] of Object.entries(scaleProfiles)) {
                let currentScore = 0;

                // Calculate correlation score
                for (let i = 0; i < 12; i++) {
                    const profileIndex = (i - rootNote + 12) % 12;
                    currentScore += noteCounts[i] * profile[profileIndex];
                }

                if (currentScore > bestScore) {
                    bestScore = currentScore;
                    bestKey = keyNames[rootNote];
                    bestScale = scaleName;
                }
            }
        }

        return { likelyKey: bestKey, likelyScale: bestScale };
    }

    /**
     * Analyze multiple audio files and find common patterns
     */
    async analyzeMultipleFiles(files, onProgress) {
        const analyses = [];
        const total = files.length;

        for (let i = 0; i < total; i++) {
            const file = files[i];
            try {
                const audioBuffer = await this.loadAudioFile(file);

                // Only analyze short loops/one-shots (under 60 seconds for deeper analysis)
                if (audioBuffer.duration > 60) {
                    console.log(`Skipping ${file.name}: too long.`);
                    continue;
                }

                const analysis = await this.analyzeAudioFile(audioBuffer);
                const extractedMidi = await this.extractMIDI(audioBuffer, analysis.tempo);

                analyses.push({
                    filename: file.name,
                    ...analysis,
                    motifs: this.convertToMotifs(extractedMidi)
                });
            } catch (error) {
                console.error(`Error analyzing ${file.name}:`, error);
            }

            if (onProgress) {
                onProgress(((i + 1) / total) * 100);
            }
        }


        // Find common characteristics
        const avgTempo = analyses.reduce((sum, a) => sum + a.tempo, 0) / analyses.length;

        // Collect all pitches
        const allPitches = analyses.flatMap(a => a.pitches.map(p => p.midiNote));

        const { likelyKey, likelyScale } = this.detectKeyAndScale(allPitches);

        // Placeholder for mood/genre based on tempo and density
        const genre = avgTempo > 130 ? 'TRAP' : (avgTempo > 115 ? 'HOUSE' : 'LO-FI');
        const mood = avgTempo > 120 ? 'ENERGETIC' : 'CHILL';

        return {
            analyses,
            avgTempo: Math.round(avgTempo),
            likelyKey,
            likelyScale,
            genre,
            mood,
            totalNotes: allPitches.length,
            noteRange: {
                min: Math.min(...allPitches),
                max: Math.max(...allPitches)
            }
        };
    }

    /**
     * Convert step-based MIDI to motifs
     */
    convertToMotifs(midiPattern) {
        if (midiPattern.length < 2) return [];

        // 1. Quantize & Clean Raw Audio Notes
        const cleanPattern = [];
        const activeSteps = new Map();

        // Sort by loudness/duration roughly to keep dominant notes
        const sorted = [...midiPattern].sort((a, b) => b.duration - a.duration);

        sorted.forEach(n => {
            // Quantize to nearest 1/8th or 1/16th note (multiples of 2 or 4 steps)
            const quantSize = 2; // 16th note resolution
            const qTime = Math.round(n.time / quantSize) * quantSize;

            // Simple monophonic filter: take the longest note occurring at this step
            if (!activeSteps.has(qTime)) {
                // Ignore micro-transients
                if (n.duration > 0.5) {
                    const cleanNote = {
                        time: qTime,
                        note: n.note,
                        duration: Math.max(Math.round(n.duration), 2) // Minimum 16th note duration
                    };
                    cleanPattern.push(cleanNote);
                    activeSteps.set(qTime, true);
                }
            }
        });

        // Re-sort temporally
        cleanPattern.sort((a, b) => a.time - b.time);

        // Group into 8-step windows
        const motifs = [];
        for (let i = 0; i < 32; i += 8) {
            const fragment = cleanPattern.filter(n => n.time >= i && n.time < i + 8);
            if (fragment.length >= 2) {
                motifs.push(fragment.map(n => ({
                    ...n,
                    relStep: n.time - i,
                    note: n.note,
                    duration: n.duration
                })));
            }
        }
        return motifs;
    }
}

export default AudioAnalyzer;
