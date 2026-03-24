// Audio Export System - WAV and MP3 with configurable settings

import lamejs from 'lamejs';

export class AudioExporter {
    constructor() {
        // Reuse the shared AudioContext to avoid competing for audio hardware
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
        }
        this.audioContext = window.sharedAnalysisCtx;
    }

    /**
     * Export audio to WAV format
     * @param {AudioBuffer} audioBuffer - The audio buffer to export
     * @param {Object} options - Export options
     * @returns {Blob} WAV file blob
     */
    exportToWAV(audioBuffer, options = {}) {
        const {
            sampleRate = 44100,
            bitDepth = 16,
            numberOfChannels = 2
        } = options;

        // Resample if needed
        const resampledBuffer = this.resampleBuffer(audioBuffer, sampleRate);
        
        // Convert to interleaved PCM
        const interleaved = this.interleave(resampledBuffer, numberOfChannels);
        
        // Convert to desired bit depth
        const pcmData = this.convertBitDepth(interleaved, bitDepth);
        
        // Create WAV file
        const wavBlob = this.encodeWAV(pcmData, sampleRate, numberOfChannels, bitDepth);
        
        return wavBlob;
    }

    /**
     * Export audio to MP3 format
     * @param {AudioBuffer} audioBuffer - The audio buffer to export
     * @param {Object} options - Export options
     * @returns {Promise<Blob>} MP3 file blob
     */
    async exportToMP3(audioBuffer, options = {}) {
        const {
            sampleRate = 44100,
            bitRate = 192, // kbps
            numberOfChannels = 2
        } = options;

        // Resample if needed
        const resampledBuffer = this.resampleBuffer(audioBuffer, sampleRate);
        
        // Get channel data
        const leftChannel = resampledBuffer.getChannelData(0);
        const rightChannel = numberOfChannels === 2 && resampledBuffer.numberOfChannels > 1
            ? resampledBuffer.getChannelData(1)
            : leftChannel;
        
        // Convert to 16-bit PCM
        const leftPCM = this.floatTo16BitPCM(leftChannel);
        const rightPCM = this.floatTo16BitPCM(rightChannel);
        
        // Encode to MP3
        const mp3Data = this.encodeMP3(leftPCM, rightPCM, sampleRate, bitRate, numberOfChannels);
        
        return new Blob([mp3Data], { type: 'audio/mp3' });
    }

    /**
     * Resample audio buffer to target sample rate
     */
    resampleBuffer(audioBuffer, targetSampleRate) {
        if (audioBuffer.sampleRate === targetSampleRate) {
            return audioBuffer;
        }

        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.duration * targetSampleRate,
            targetSampleRate
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start(0);

        return offlineContext.startRendering();
    }

    /**
     * Interleave multiple channels
     */
    interleave(audioBuffer, numberOfChannels = 2) {
        const length = audioBuffer.length * numberOfChannels;
        const result = new Float32Array(length);

        const channels = [];
        for (let i = 0; i < numberOfChannels; i++) {
            if (i < audioBuffer.numberOfChannels) {
                channels.push(audioBuffer.getChannelData(i));
            } else {
                channels.push(audioBuffer.getChannelData(0)); // Duplicate first channel
            }
        }

        let index = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                result[index++] = channels[channel][i];
            }
        }

        return result;
    }

    /**
     * Convert float samples to specified bit depth
     */
    convertBitDepth(samples, bitDepth) {
        switch (bitDepth) {
            case 16:
                return this.floatTo16BitPCM(samples);
            case 24:
                return this.floatTo24BitPCM(samples);
            case 32:
                return samples; // 32-bit float
            default:
                return this.floatTo16BitPCM(samples);
        }
    }

    /**
     * Convert float samples to 16-bit PCM
     */
    floatTo16BitPCM(samples) {
        const buffer = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return buffer;
    }

    /**
     * Convert float samples to 24-bit PCM
     */
    floatTo24BitPCM(samples) {
        const buffer = new Int32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            buffer[i] = s < 0 ? s * 0x800000 : s * 0x7FFFFF;
        }
        return buffer;
    }

    /**
     * Encode PCM data to WAV format
     */
    encodeWAV(samples, sampleRate, numberOfChannels, bitDepth) {
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numberOfChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = samples.length * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // audio format (1 = PCM, 3 = IEEE float)
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Write PCM data
        if (bitDepth === 16) {
            for (let i = 0; i < samples.length; i++) {
                view.setInt16(44 + i * 2, samples[i], true);
            }
        } else if (bitDepth === 24) {
            for (let i = 0; i < samples.length; i++) {
                const value = samples[i];
                view.setUint8(44 + i * 3, value & 0xFF);
                view.setUint8(44 + i * 3 + 1, (value >> 8) & 0xFF);
                view.setUint8(44 + i * 3 + 2, (value >> 16) & 0xFF);
            }
        } else if (bitDepth === 32) {
            for (let i = 0; i < samples.length; i++) {
                view.setFloat32(44 + i * 4, samples[i], true);
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Encode PCM data to MP3 format using lamejs
     */
    encodeMP3(leftChannel, rightChannel, sampleRate, bitRate, numberOfChannels) {
        const mp3encoder = new lamejs.Mp3Encoder(numberOfChannels, sampleRate, bitRate);
        const mp3Data = [];
        
        const sampleBlockSize = 1152; // LAME encoding block size
        
        for (let i = 0; i < leftChannel.length; i += sampleBlockSize) {
            const leftChunk = leftChannel.subarray(i, i + sampleBlockSize);
            const rightChunk = numberOfChannels === 2 
                ? rightChannel.subarray(i, i + sampleBlockSize)
                : leftChunk;
            
            const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }
        
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
        
        return new Blob(mp3Data, { type: 'audio/mp3' });
    }

    /**
     * Write string to DataView
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Render MIDI pattern to audio buffer using samples
     */
    async renderPatternToAudio(pattern, samples, tempo, duration) {
        const sampleRate = this.audioContext.sampleRate;
        const bufferLength = Math.ceil(duration * sampleRate);
        const audioBuffer = this.audioContext.createBuffer(2, bufferLength, sampleRate);
        
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        
        // Calculate step duration in seconds
        const beatsPerBar = 4;
        const stepsPerBeat = 4; // 16th notes
        const secondsPerBeat = 60 / tempo;
        const secondsPerStep = secondsPerBeat / stepsPerBeat;
        
        // Render each note
        for (const note of pattern) {
            const { step, track, velocity = 0.8, sample } = note;
            
            if (!sample || !sample.buffer) continue;
            
            const startTime = step * secondsPerStep;
            const startSample = Math.floor(startTime * sampleRate);
            
            // Mix sample into buffer
            const sampleBuffer = sample.buffer;
            const sampleLength = Math.min(
                sampleBuffer.length,
                bufferLength - startSample
            );
            
            for (let i = 0; i < sampleLength; i++) {
                const sampleIndex = startSample + i;
                if (sampleIndex >= bufferLength) break;
                
                // Get sample data (handle mono/stereo)
                const leftSample = sampleBuffer.getChannelData(0)[i] * velocity;
                const rightSample = sampleBuffer.numberOfChannels > 1
                    ? sampleBuffer.getChannelData(1)[i] * velocity
                    : leftSample;
                
                // Mix into output buffer
                leftChannel[sampleIndex] += leftSample;
                rightChannel[sampleIndex] += rightSample;
            }
        }
        
        // Normalize to prevent clipping
        this.normalizeBuffer(audioBuffer);
        
        return audioBuffer;
    }

    /**
     * Normalize audio buffer to prevent clipping
     */
    normalizeBuffer(audioBuffer) {
        let maxAmplitude = 0;
        
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const data = audioBuffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                maxAmplitude = Math.max(maxAmplitude, Math.abs(data[i]));
            }
        }
        
        if (maxAmplitude > 1.0) {
            const scale = 0.95 / maxAmplitude; // Leave some headroom
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const data = audioBuffer.getChannelData(channel);
                for (let i = 0; i < data.length; i++) {
                    data[i] *= scale;
                }
            }
        }
    }

    /**
     * Download blob as file
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export default AudioExporter;
