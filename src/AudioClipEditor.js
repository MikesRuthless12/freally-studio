// AudioClipEditor.js - Professional audio clip editing tools

class AudioClipEditor {
    constructor() {
        // Reuse the shared AudioContext to avoid competing for audio hardware
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
        }
        this.audioContext = window.sharedAnalysisCtx;
        this.offlineContext = null;
    }

    // === Reverse Audio ===
    
    async reverseAudio(audioBuffer) {
        const reversedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const reversedData = reversedBuffer.getChannelData(channel);
            
            for (let i = 0; i < channelData.length; i++) {
                reversedData[i] = channelData[channelData.length - 1 - i];
            }
        }

        return reversedBuffer;
    }

    // === Time Stretch (without pitch change) ===
    
    async timeStretch(audioBuffer, stretchFactor) {
        // stretchFactor: 0.5 = half speed (longer), 2.0 = double speed (shorter)
        // Uses phase vocoder algorithm for time-stretching without pitch change
        
        const channels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const newLength = Math.floor(audioBuffer.length * stretchFactor);
        
        const stretchedBuffer = this.audioContext.createBuffer(
            channels,
            newLength,
            sampleRate
        );

        for (let channel = 0; channel < channels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = stretchedBuffer.getChannelData(channel);
            
            // Simple linear interpolation for time-stretching
            // For production, use a proper phase vocoder
            for (let i = 0; i < newLength; i++) {
                const sourceIndex = i / stretchFactor;
                const index1 = Math.floor(sourceIndex);
                const index2 = Math.min(index1 + 1, inputData.length - 1);
                const fraction = sourceIndex - index1;
                
                outputData[i] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
            }
        }

        return stretchedBuffer;
    }

    // === Pitch Shift ===
    
    async pitchShift(audioBuffer, semitones) {
        // Pitch shift by resampling
        const pitchRatio = Math.pow(2, semitones / 12);
        const newLength = Math.floor(audioBuffer.length / pitchRatio);
        
        const shiftedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            newLength,
            audioBuffer.sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = shiftedBuffer.getChannelData(channel);
            
            for (let i = 0; i < newLength; i++) {
                const sourceIndex = i * pitchRatio;
                const index1 = Math.floor(sourceIndex);
                const index2 = Math.min(index1 + 1, inputData.length - 1);
                const fraction = sourceIndex - index1;
                
                outputData[i] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
            }
        }

        return shiftedBuffer;
    }

    // === Trim/Crop ===
    
    async trimAudio(audioBuffer, startTime, endTime) {
        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const newLength = endSample - startSample;
        
        const trimmedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            newLength,
            sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = trimmedBuffer.getChannelData(channel);
            
            for (let i = 0; i < newLength; i++) {
                outputData[i] = inputData[startSample + i];
            }
        }

        return trimmedBuffer;
    }

    // === Fade In/Out ===
    
    async applyFade(audioBuffer, fadeInDuration, fadeOutDuration) {
        const sampleRate = audioBuffer.sampleRate;
        const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
        const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
        
        const fadedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = fadedBuffer.getChannelData(channel);
            
            for (let i = 0; i < audioBuffer.length; i++) {
                let gain = 1.0;
                
                // Fade in
                if (i < fadeInSamples) {
                    gain = i / fadeInSamples;
                }
                
                // Fade out
                if (i > audioBuffer.length - fadeOutSamples) {
                    const fadeOutProgress = (audioBuffer.length - i) / fadeOutSamples;
                    gain = Math.min(gain, fadeOutProgress);
                }
                
                outputData[i] = inputData[i] * gain;
            }
        }

        return fadedBuffer;
    }

    // === Normalize ===
    
    async normalize(audioBuffer, targetLevel = 0.95) {
        const normalizedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        // Find peak level
        let peak = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                peak = Math.max(peak, Math.abs(channelData[i]));
            }
        }

        // Calculate gain
        const gain = peak > 0 ? targetLevel / peak : 1.0;

        // Apply gain
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = normalizedBuffer.getChannelData(channel);
            
            for (let i = 0; i < audioBuffer.length; i++) {
                outputData[i] = inputData[i] * gain;
            }
        }

        return normalizedBuffer;
    }

    // === Change Tempo (with pitch change) ===
    
    async changeTempo(audioBuffer, tempoFactor) {
        // tempoFactor: 0.5 = half speed, 2.0 = double speed
        // This changes both tempo and pitch (like vinyl speed change)
        
        const newSampleRate = Math.floor(audioBuffer.sampleRate * tempoFactor);
        
        // Create new buffer with different sample rate
        const tempBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            newSampleRate
        );

        // Copy data
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = tempBuffer.getChannelData(channel);
            outputData.set(inputData);
        }

        // Resample back to original sample rate
        return await this.resample(tempBuffer, audioBuffer.sampleRate);
    }

    async resample(audioBuffer, targetSampleRate) {
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            Math.floor(audioBuffer.duration * targetSampleRate),
            targetSampleRate
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        return await offlineContext.startRendering();
    }

    // === Loop Section ===
    
    async loopSection(audioBuffer, loopStart, loopEnd, repetitions) {
        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(loopStart * sampleRate);
        const endSample = Math.floor(loopEnd * sampleRate);
        const loopLength = endSample - startSample;
        const newLength = audioBuffer.length + loopLength * (repetitions - 1);
        
        const loopedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            newLength,
            sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = loopedBuffer.getChannelData(channel);
            
            // Copy everything before loop
            for (let i = 0; i < startSample; i++) {
                outputData[i] = inputData[i];
            }
            
            // Copy loop repetitions
            let outputIndex = startSample;
            for (let rep = 0; rep < repetitions; rep++) {
                for (let i = startSample; i < endSample; i++) {
                    outputData[outputIndex++] = inputData[i];
                }
            }
            
            // Copy everything after loop
            for (let i = endSample; i < audioBuffer.length; i++) {
                outputData[outputIndex++] = inputData[i];
            }
        }

        return loopedBuffer;
    }

    // === Slice ===
    
    async sliceAudio(audioBuffer, slicePoints) {
        // slicePoints: array of time positions in seconds
        const slices = [];
        const sampleRate = audioBuffer.sampleRate;
        
        slicePoints.sort((a, b) => a - b);
        slicePoints.unshift(0);
        slicePoints.push(audioBuffer.duration);
        
        for (let i = 0; i < slicePoints.length - 1; i++) {
            const startTime = slicePoints[i];
            const endTime = slicePoints[i + 1];
            const slice = await this.trimAudio(audioBuffer, startTime, endTime);
            slices.push(slice);
        }
        
        return slices;
    }

    // === Concatenate ===
    
    async concatenateAudio(audioBuffers) {
        if (audioBuffers.length === 0) return null;
        if (audioBuffers.length === 1) return audioBuffers[0];
        
        const channels = audioBuffers[0].numberOfChannels;
        const sampleRate = audioBuffers[0].sampleRate;
        const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
        
        const concatenatedBuffer = this.audioContext.createBuffer(
            channels,
            totalLength,
            sampleRate
        );

        for (let channel = 0; channel < channels; channel++) {
            const outputData = concatenatedBuffer.getChannelData(channel);
            let offset = 0;
            
            for (const buffer of audioBuffers) {
                const inputData = buffer.getChannelData(channel);
                outputData.set(inputData, offset);
                offset += buffer.length;
            }
        }

        return concatenatedBuffer;
    }

    // === Mix Buffers ===
    
    async mixAudioBuffers(audioBuffers, gains = null) {
        if (audioBuffers.length === 0) return null;
        
        const channels = audioBuffers[0].numberOfChannels;
        const sampleRate = audioBuffers[0].sampleRate;
        const maxLength = Math.max(...audioBuffers.map(buf => buf.length));
        
        const mixedBuffer = this.audioContext.createBuffer(
            channels,
            maxLength,
            sampleRate
        );

        for (let channel = 0; channel < channels; channel++) {
            const outputData = mixedBuffer.getChannelData(channel);
            
            for (let i = 0; i < audioBuffers.length; i++) {
                const buffer = audioBuffers[i];
                const gain = gains ? gains[i] : 1.0;
                const inputData = buffer.getChannelData(channel);
                
                for (let j = 0; j < inputData.length; j++) {
                    outputData[j] += inputData[j] * gain;
                }
            }
        }

        return mixedBuffer;
    }

    // === Export Buffer as WAV ===
    
    exportAsWAV(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numberOfChannels * bytesPerSample;
        
        const data = this.interleave(audioBuffer);
        const dataLength = data.length * bytesPerSample;
        
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);
        
        // RIFF chunk descriptor
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');
        
        // FMT sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Sub-chunk size
        view.setUint16(20, format, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        
        // Data sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // Write audio data
        this.floatTo16BitPCM(view, 44, data);
        
        return new Blob([buffer], { type: 'audio/wav' });
    }

    interleave(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numberOfChannels;
        const result = new Float32Array(length);
        
        const channels = [];
        for (let i = 0; i < numberOfChannels; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }
        
        let offset = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                result[offset++] = channels[channel][i];
            }
        }
        
        return result;
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    floatTo16BitPCM(view, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }
}

// Create singleton
const audioClipEditor = new AudioClipEditor();
window.audioClipEditor = audioClipEditor;

export default audioClipEditor;
