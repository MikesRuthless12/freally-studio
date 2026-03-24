/**
 * MidiPreviewSynth — Ableton-style sine beep synth for MIDI file preview.
 * Uses Web Audio API to schedule sine oscillators with short attack/decay envelopes.
 */
export class MidiPreviewSynth {
    constructor(audioContext) {
        // Reuse the shared AudioContext to avoid competing for audio hardware
        if (!audioContext) {
            if (!window.sharedAnalysisCtx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
            }
            audioContext = window.sharedAnalysisCtx;
        }
        this.audioContext = audioContext;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 0.3;
        this.gainNode.connect(this.audioContext.destination);
        this.activeOscillators = [];
        this.scheduledTimeouts = [];
        this._playing = false;
        this._startTime = 0;
        this._duration = 0;
        this._onEnd = null;
        this._endTimeout = null;
    }

    /**
     * Convert MIDI note number to frequency in Hz.
     */
    midiToFreq(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    /**
     * Play parsed MIDI notes with sine beep sounds.
     * @param {Array} notes - Array of { note, startTick, duration, velocity }
     * @param {number} tempo - BPM for playback
     * @param {number} ticksPerBeat - MIDI ticks per beat (usually 480)
     * @param {Function} onEnd - Callback when playback finishes
     */
    playMidi(notes, tempo = 120, ticksPerBeat = 480, onEnd = null) {
        this.stop();
        // Cancel any pending idle suspend from a previous preview
        if (this._idleSuspendTimer) {
            clearTimeout(this._idleSuspendTimer);
            this._idleSuspendTimer = null;
        }

        if (!notes || notes.length === 0) return;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this._playing = true;
        this._onEnd = onEnd;
        const now = this.audioContext.currentTime;
        this._startTime = now;

        const secondsPerTick = (60 / tempo) / ticksPerBeat;

        // Find total duration
        const maxEndTick = Math.max(...notes.map(n => n.startTick + n.duration));
        this._duration = maxEndTick * secondsPerTick;

        notes.forEach(note => {
            const startSec = note.startTick * secondsPerTick;
            const durSec = Math.min(note.duration * secondsPerTick, 2.0); // Cap at 2s per note
            const freq = this.midiToFreq(note.note);
            const vel = (note.velocity || 100) / 127;

            // Create oscillator
            const osc = this.audioContext.createOscillator();
            const noteGain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            // ADSR-like envelope: quick attack, short sustain, gentle release
            const attackTime = 0.005;
            const releaseTime = Math.min(0.08, durSec * 0.3);
            const peakGain = vel * 0.4;

            noteGain.gain.setValueAtTime(0, now + startSec);
            noteGain.gain.linearRampToValueAtTime(peakGain, now + startSec + attackTime);
            noteGain.gain.setValueAtTime(peakGain, now + startSec + durSec - releaseTime);
            noteGain.gain.linearRampToValueAtTime(0, now + startSec + durSec);

            osc.connect(noteGain);
            noteGain.connect(this.gainNode);

            osc.start(now + startSec);
            osc.stop(now + startSec + durSec + 0.01);

            this.activeOscillators.push({ osc, noteGain });

            // Cleanup reference when done
            osc.onended = () => {
                const idx = this.activeOscillators.findIndex(o => o.osc === osc);
                if (idx !== -1) this.activeOscillators.splice(idx, 1);
            };
        });

        // End callback + idle suspend so context doesn't run forever
        this._endTimeout = setTimeout(() => {
            this._playing = false;
            if (this._onEnd) this._onEnd();
            // Suspend after a grace period so the context doesn't stay running idle
            this._idleSuspendTimer = setTimeout(() => {
                if (!this._playing && this.audioContext && this.audioContext.state === 'running') {
                    this.audioContext.suspend().catch(() => {});
                }
            }, 4000);
        }, this._duration * 1000 + 100);
    }

    /**
     * Stop all playback.
     */
    stop() {
        this._playing = false;

        if (this._endTimeout) {
            clearTimeout(this._endTimeout);
            this._endTimeout = null;
        }

        this.activeOscillators.forEach(({ osc, noteGain }) => {
            try {
                noteGain.gain.cancelScheduledValues(this.audioContext.currentTime);
                noteGain.gain.setValueAtTime(0, this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 0.01);
            } catch (e) { /* already stopped */ }
        });

        this.activeOscillators = [];
    }

    /**
     * Check if currently playing.
     */
    isPlaying() {
        return this._playing;
    }

    /**
     * Get playback progress (0 to 1).
     */
    getProgress() {
        if (!this._playing || this._duration <= 0) return 0;
        const elapsed = this.audioContext.currentTime - this._startTime;
        return Math.min(1, elapsed / this._duration);
    }

    /**
     * Get total duration in seconds.
     */
    getDuration() {
        return this._duration;
    }

    /**
     * Get elapsed time in seconds.
     */
    getElapsed() {
        if (!this._playing) return 0;
        return this.audioContext.currentTime - this._startTime;
    }

    /**
     * Set volume (0 to 1).
     */
    setVolume(vol) {
        this.gainNode.gain.value = Math.max(0, Math.min(1, vol)) * 0.5;
    }
}

export default MidiPreviewSynth;
