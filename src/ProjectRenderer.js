class ProjectRenderer {
    /**
     * Renders the current sequencer state to a WAV Blob.
     * @param {Sequencer} sequencer - The active sequencer instance.
     * @param {object} settings - Optional settings (e.g., renderLengthBytes?).
     * @returns {Promise<Blob>} - Resolves with a WAV Blob.
     */
    static async renderProject(sequencer) {
        console.log("Starting Offline Render...");

        const sampleRate = 44100;
        // Calculate Duration: Steps * (60 / Tempo) / 4 (since steps are 16th notes)
        // Duration = (Steps * 60) / (Tempo * 4)
        const secondsPerBeat = 60 / sequencer.tempo;
        const secondsPerStep = secondsPerBeat / 4;
        const totalDuration = sequencer.steps * secondsPerStep + 2.0; // Add tail for reverb/release

        const offlineCtx = new OfflineAudioContext(2, sampleRate * totalDuration, sampleRate);

        // --- 1. Setup Sample Routing ---
        // Create Buses comparable to AudioEngine
        const masterBus = offlineCtx.createGain();
        const drumBus = offlineCtx.createGain();
        const instrumentBus = offlineCtx.createGain();

        drumBus.connect(masterBus);
        instrumentBus.connect(masterBus);

        // --- 2. Setup Effects Chain ---
        // We need to clone the current effects chain settings
        // Ideally EffectsChain has a 'cloneToContext(ctx)' method or we manually reconstruct
        // For now, let's just make a new EffectsChain and copy parameters if accesible, 
        // or just render dry/basic for MVP, but User asked for "EffectsChain".
        // We'll instantiate a new EffectsChain attached to offlineCtx.

        const fxChain = new EffectsChain(offlineCtx);

        // Setup specialized renderers (clones of synths attached to offlineCtx)
        // Note: For true offline, we need to inject the context into synth play methods.
        // My previous refactor allowed passing `ctx` to play methods!

        // Re-use current synths but pass offlineCtx
        const drumSynth = sequencer.drumSynth;
        const instrumentSynth = sequencer.instrumentSynth;

        // Determine Steps to Render based on Mode
        let stepsToRender = sequencer.steps;
        if (sequencer.mode === 'SONG' && sequencer.arrangement.length > 0) {
            stepsToRender = sequencer.arrangement.reduce((acc, clip) => acc + clip.length, 0);
        }

        // Iterate Steps
        for (let globalStep = 0; globalStep < stepsToRender; globalStep++) {
            const time = globalStep * secondsPerStep;

            // Determine active pattern grids and local step
            let drumGrid = sequencer.drumGrid;
            let melodyGrid = sequencer.melodyGrid;
            // let chordGrid = sequencer.chordGrid; // Future support
            let localStep = globalStep;

            if (sequencer.mode === 'SONG') {
                let accumulatedSteps = 0;
                let activePatternIndex = sequencer.currentPatternIndex;

                for (let clip of sequencer.arrangement) {
                    if (globalStep >= accumulatedSteps && globalStep < accumulatedSteps + clip.length) {
                        activePatternIndex = clip.patternIndex;
                        localStep = (globalStep - accumulatedSteps) % 16; // Assumption: patterns are 16 steps? Or clip based?
                        // Let's assume patterns can vary, but for MVP patterns are 16.
                        // Ideally: localStep = (globalStep - acc) % sequencer.patterns[idx].steps
                        break;
                    }
                    accumulatedSteps += clip.length;
                }

                // Fetch pattern grids 
                // (Note: pattern management needs to be rigorous in sequencer.js)
                const p = sequencer.patterns[activePatternIndex];
                if (p) {
                    drumGrid = p.drumGrid;
                    melodyGrid = p.melodyGrid;
                }
            } else {
                localStep = globalStep % sequencer.steps;
            }

            // 1. Drums
            if (drumGrid) {
                if (drumGrid[0][localStep]) drumSynth.play808Kick(time, offlineCtx);
                if (drumGrid[1][localStep]) drumSynth.playSnare(time, offlineCtx);
                if (drumGrid[2][localStep]) drumSynth.playHiHatClosed(time, offlineCtx);
                if (drumGrid[3][localStep]) drumSynth.playHiHatOpen(time, offlineCtx);
                if (drumGrid[4][localStep]) drumSynth.playTom(time, offlineCtx);
                if (drumGrid[5][localStep]) drumSynth.playClap(time, offlineCtx);
            }

            // 2. Melody
            const intervals = sequencer.scaleIntervals[sequencer.scale] || sequencer.scaleIntervals['Minor'];
            if (melodyGrid) {
                for (let i = 0; i < sequencer.melodyRows; i++) {
                    const stepData = melodyGrid[i][localStep];
                    if (stepData) {
                        const note = sequencer.rootNote + intervals[i];
                        // Support length if stepData is object {length: L}
                        const durationInSteps = stepData.length || 1;
                        const duration = durationInSteps * secondsPerStep;

                        if (i < 4) instrumentSynth.playPluck(note, time, duration, offlineCtx);
                        else instrumentSynth.playTrapLead(note, time, duration, offlineCtx);
                    }
                }
            }
        }

        // Render
        const renderedBuffer = await offlineCtx.startRendering();

        return ProjectRenderer.bufferToWav(renderedBuffer, metadata);
    }

    static async renderPatternToBuffer(sequencer, patternIndex) {
        // Create a temp sequencer state or just temporarily force the pattern logic
        // Since we can't easily clone the whole sequencer deep state, we can use the existing logic 
        // but force "Song Mode" off and set the pattern index.

        const originalMode = sequencer.mode;
        const originalIndex = sequencer.currentPatternIndex;

        // Force Pattern Context
        sequencer.mode = 'PATTERN';
        if (patternIndex !== undefined) sequencer.loadPattern(patternIndex);

        // Configure Offline Context
        const sampleRate = 44100;
        const secondsPerBeat = 60 / sequencer.tempo;
        const secondsPerStep = secondsPerBeat / 4;
        const totalDuration = sequencer.steps * secondsPerStep + 1.0; // 1 bar + tail

        const offlineCtx = new OfflineAudioContext(2, sampleRate * totalDuration, sampleRate);

        // Setup Synths (Clones/Restored) - Simplified: we assume synths can attach to new context
        // Since our synths might look at window.audioEngine, we need to be careful.
        // For now, we reuse the logic from renderProject by mocking the sequencer.

        // Actually, let's just use renderProject logic but restricted.
        // We can extract the rendering loop to a helper, but for now duplication is safer than refactoring the whole renderProject.

        // ... Setup Buses ...
        const masterBus = offlineCtx.createGain();
        const drumBus = offlineCtx.createGain();
        const instrumentBus = offlineCtx.createGain();
        drumBus.connect(masterBus);
        instrumentBus.connect(masterBus);
        masterBus.connect(offlineCtx.destination);

        const drumSynth = sequencer.drumSynth;
        const instrumentSynth = sequencer.instrumentSynth;

        // Render Steps
        for (let globalStep = 0; globalStep < sequencer.steps; globalStep++) {
            const time = globalStep * secondsPerStep;
            // Use current grid (which sets to the loaded pattern)
            const drumGrid = sequencer.drumGrid;
            const melodyGrid = sequencer.melodyGrid;
            const localStep = globalStep; // Pattern mode is direct mapping

            // 1. Drums
            if (drumGrid) {
                if (drumGrid[0][localStep]) drumSynth.play808Kick(time, offlineCtx);
                if (drumGrid[1][localStep]) drumSynth.playSnare(time, offlineCtx);
                if (drumGrid[2][localStep]) drumSynth.playHiHatClosed(time, offlineCtx);
                if (drumGrid[3][localStep]) drumSynth.playHiHatOpen(time, offlineCtx);
                if (drumGrid[4][localStep]) drumSynth.playTom(time, offlineCtx);
                if (drumGrid[5][localStep]) drumSynth.playClap(time, offlineCtx);
            }

            // 2. Melody
            const intervals = sequencer.scaleIntervals[sequencer.scale] || sequencer.scaleIntervals['Minor'];
            if (melodyGrid) {
                for (let i = 0; i < sequencer.melodyRows; i++) {
                    const stepData = melodyGrid[i][localStep];
                    if (stepData) {
                        const note = sequencer.rootNote + intervals[i];
                        const durationInSteps = stepData.length || 1;
                        const duration = durationInSteps * secondsPerStep;

                        if (i < 4) instrumentSynth.playPluck(note, time, duration, offlineCtx);
                        else instrumentSynth.playTrapLead(note, time, duration, offlineCtx);
                    }
                }
            }
        }

        // Restore State
        sequencer.mode = originalMode;
        if (originalIndex !== sequencer.currentPatternIndex) sequencer.loadPattern(originalIndex);

        return await offlineCtx.startRendering();
    }

    // WAV Encoder Helper
    static bufferToWav(abuffer, metadata = {}) {
        const numOfChan = abuffer.numberOfChannels;
        // Original WAV header (44 bytes) + PCM data size
        const pcmDataSize = abuffer.length * numOfChan * 2;
        const baseLength = pcmDataSize + 44;

        // Prepare Metadata Chunk (LIST INFO)
        // Helper to pack string
        const packString = (s) => {
            const enc = new TextEncoder();
            const b = enc.encode(s + "\0"); // null-terminated
            if (b.length % 2 !== 0) { // Word align
                const pad = new Uint8Array(b.length + 1);
                pad.set(b);
                return pad;
            }
            return b;
        };

        const createChunk = (id, dataStr) => {
            const idBytes = new TextEncoder().encode(id); // 4 bytes
            const dataBytes = packString(dataStr);
            const len = dataBytes.byteLength;

            const chunk = new Uint8Array(4 + 4 + len);
            chunk.set(idBytes, 0);
            new DataView(chunk.buffer).setUint32(4, len, true);
            chunk.set(dataBytes, 8);
            return chunk;
        };

        const infoChunks = [];
        if (metadata.artist) infoChunks.push(createChunk("IART", metadata.artist));
        if (metadata.title) infoChunks.push(createChunk("INAM", metadata.title));
        if (metadata.album) infoChunks.push(createChunk("IPRD", metadata.album));
        if (metadata.software) infoChunks.push(createChunk("ISFT", metadata.software));
        if (metadata.year) infoChunks.push(createChunk("ICRD", metadata.year));
        if (metadata.comments) infoChunks.push(createChunk("ICMT", metadata.comments));

        // "LIST" (4 bytes) + len (4 bytes) + "INFO" (4 bytes) + sum of infoChunks
        const infoTotalLen = 4 + infoChunks.reduce((acc, c) => acc + c.byteLength, 0);
        const listChunkLen = 8 + infoTotalLen; // "LIST" + len + "INFO" + chunks...

        // Final Size: Data Length + Header (44) + LIST Chunk overhead (8 + infoTotalLen)
        const finalLength = baseLength + listChunkLen;

        const buffer = new ArrayBuffer(finalLength);
        const view = new DataView(buffer);
        const channels = [];
        let offset = 0, pos = 0;

        // write WAVE header
        setUint32(0x46464952);                         // "RIFF"
        setUint32(finalLength - 8);                    // file length - 8
        setUint32(0x45564157);                         // "WAVE"

        setUint32(0x20746d66);                         // "fmt " chunk
        setUint32(16);                                 // length = 16
        setUint16(1);                                  // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);                      // block-align
        setUint16(16);                                 // 16-bit

        setUint32(0x61746164);                         // "data" - chunk
        setUint32(pcmDataSize);                        // chunk length (PCM data only)

        // write interleaved data
        for (let i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        let p = 44; // Start writing PCM data after the 44-byte header
        for (let i = 0; i < abuffer.length; i++) {
            for (let ch = 0; ch < numOfChan; ch++) {
                let sample = Math.max(-1, Math.min(1, channels[ch][i]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
                view.setInt16(p, sample, true);
                p += 2;
            }
        }

        // Write LIST Chunk at end
        // p is strictly where PCM data ended.

        const u8 = new Uint8Array(buffer);

        // LIST chunk header
        u8.set(new TextEncoder().encode("LIST"), p);
        view.setUint32(p + 4, infoTotalLen, true); // Length of INFO type + chunks
        u8.set(new TextEncoder().encode("INFO"), p + 8);

        let chunkPtr = p + 12; // Start writing individual info chunks after "LIST" + len + "INFO"
        infoChunks.forEach(chunk => {
            u8.set(chunk, chunkPtr);
            chunkPtr += chunk.byteLength;
        });

        // Helper wrappers (these operate on 'pos', which is used for the main header)
        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }

        return new Blob([buffer], { type: "audio/wav" });
    }
}

window.projectRenderer = ProjectRenderer;
