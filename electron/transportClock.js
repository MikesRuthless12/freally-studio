/**
 * Native Transport Clock
 *
 * High-resolution master clock for playback synchronization.
 * Uses process.hrtime.bigint() for nanosecond-precision timing,
 * preventing drift over long playback sessions.
 *
 * The renderer sends commands (play/stop/seek/tempo) via IPC.
 * This clock sends position updates back at ~60fps.
 */

class TransportClock {
    constructor() {
        this.isPlaying = false;
        this.isPaused = false;
        this.tempo = 120;          // BPM
        this.positionBeats = 0;    // Current position in beats
        this.totalBars = 4;
        this.startHrTime = null;   // process.hrtime.bigint() at play start
        this.pauseOffsetNs = 0n;   // Nanoseconds elapsed before last pause

        // Loop state
        this.loopEnabled = false;
        this.loopStartBeats = 0;
        this.loopEndBeats = 16;    // 4 bars default
        this.loopCount = 0;

        // Tick interval for sending position updates
        this.tickInterval = null;
        this.sendCallback = null;  // Set by main.js to send IPC messages
    }

    /**
     * Set the callback for sending position updates to the renderer
     * @param {Function} callback - (positionData) => void
     */
    setSendCallback(callback) {
        this.sendCallback = callback;
    }

    /**
     * Start playback
     */
    play() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.isPaused = false;

        // Calculate start reference time accounting for paused position
        const beatsPerSecond = this.tempo / 60;
        const positionNs = BigInt(Math.round((this.positionBeats / beatsPerSecond) * 1e9));
        this.startHrTime = process.hrtime.bigint() - positionNs;

        this._startTicking();
        this._sendPosition();
    }

    /**
     * Pause playback (preserves position)
     */
    pause() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this.isPaused = true;

        // Freeze current position
        this._updatePosition();
        this._stopTicking();
        this._sendPosition();
    }

    /**
     * Stop playback (resets to 0)
     */
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.positionBeats = 0;
        this.startHrTime = null;
        this.loopCount = 0;

        this._stopTicking();
        this._sendPosition();
    }

    /**
     * Seek to a specific position in beats
     * @param {number} beats - Position in beats
     */
    seek(beats) {
        const maxBeats = this.totalBars * 4;
        this.positionBeats = Math.max(0, Math.min(maxBeats, beats));

        if (this.isPlaying) {
            // Recalculate start reference so position stays correct
            const beatsPerSecond = this.tempo / 60;
            const positionNs = BigInt(Math.round((this.positionBeats / beatsPerSecond) * 1e9));
            this.startHrTime = process.hrtime.bigint() - positionNs;
        }

        this._sendPosition();
    }

    /**
     * Set tempo (BPM)
     * @param {number} bpm - Beats per minute
     */
    setTempo(bpm) {
        if (bpm <= 0 || bpm > 999) return;

        if (this.isPlaying) {
            // Recalculate reference point to maintain current position
            this._updatePosition();
            const beatsPerSecond = bpm / 60;
            const positionNs = BigInt(Math.round((this.positionBeats / beatsPerSecond) * 1e9));
            this.startHrTime = process.hrtime.bigint() - positionNs;
        }

        this.tempo = bpm;
        this._sendPosition();
    }

    /**
     * Set total bars
     * @param {number} bars - Number of bars
     */
    setBars(bars) {
        this.totalBars = bars;
        // Clamp position if beyond new end
        const maxBeats = bars * 4;
        if (this.positionBeats > maxBeats) {
            this.seek(maxBeats);
        }
        // Update loop end if it was at the default
        if (this.loopEndBeats > maxBeats) {
            this.loopEndBeats = maxBeats;
        }
    }

    /**
     * Set loop configuration
     * @param {boolean} enabled - Loop on/off
     * @param {number} startBeats - Loop start in beats
     * @param {number} endBeats - Loop end in beats
     */
    setLoop(enabled, startBeats, endBeats) {
        this.loopEnabled = enabled;
        if (startBeats !== undefined) {
            this.loopStartBeats = Math.max(0, startBeats);
        }
        if (endBeats !== undefined) {
            this.loopEndBeats = Math.min(this.totalBars * 4, endBeats);
        }
        if (!enabled) {
            this.loopCount = 0;
        }
    }

    /**
     * Update the current position from hrtime (called internally)
     */
    _updatePosition() {
        if (!this.isPlaying || !this.startHrTime) return;

        const now = process.hrtime.bigint();
        const elapsedNs = now - this.startHrTime;
        const beatsPerSecond = this.tempo / 60;

        // Position = elapsed_seconds * beats_per_second
        // Using BigInt for nanosecond precision, convert to float at the end
        this.positionBeats = (Number(elapsedNs) / 1e9) * beatsPerSecond;

        const maxBeats = this.totalBars * 4;

        // Handle looping
        if (this.loopEnabled) {
            if (this.positionBeats >= this.loopEndBeats) {
                this.loopCount++;
                const loopDuration = this.loopEndBeats - this.loopStartBeats;
                if (loopDuration > 0) {
                    this.positionBeats = this.loopStartBeats +
                        ((this.positionBeats - this.loopStartBeats) % loopDuration);
                } else {
                    this.positionBeats = this.loopStartBeats;
                }
                // Recalculate reference to prevent drift accumulation
                const positionNs = BigInt(Math.round((this.positionBeats / beatsPerSecond) * 1e9));
                this.startHrTime = process.hrtime.bigint() - positionNs;
            }
        } else {
            // No loop — stop at end
            if (this.positionBeats >= maxBeats) {
                this.positionBeats = 0;
                this.isPlaying = false;
                this.startHrTime = null;
                this._stopTicking();
            }
        }
    }

    /**
     * Build position data object for sending to renderer
     */
    _getPositionData() {
        const maxBeats = this.totalBars * 4;
        const bar = Math.floor(this.positionBeats / 4);
        const beatInBar = this.positionBeats % 4;
        const beat = Math.floor(beatInBar);
        const tick = Math.round((beatInBar - beat) * 960); // 960 PPQN

        // SMPTE-style timecode string: BAR:BEAT:TICK
        const smpteStr = `${String(bar + 1).padStart(3, '0')}:${beat + 1}:${String(tick).padStart(3, '0')}`;

        return {
            positionBeats: this.positionBeats,
            bar,
            beat,
            tick,
            progress: maxBeats > 0 ? this.positionBeats / maxBeats : 0,
            tempo: this.tempo,
            smpteStr,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            loopEnabled: this.loopEnabled,
            loopCount: this.loopCount,
            totalBars: this.totalBars
        };
    }

    /**
     * Send position update to renderer
     */
    _sendPosition() {
        if (this.sendCallback) {
            this.sendCallback(this._getPositionData());
        }
    }

    /**
     * Start the tick interval (~60fps position updates)
     */
    _startTicking() {
        this._stopTicking();
        this.tickInterval = setInterval(() => {
            this._updatePosition();
            this._sendPosition();
        }, 16); // ~62.5fps (16ms interval)
    }

    /**
     * Stop the tick interval
     */
    _stopTicking() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }

    /**
     * Clean up
     */
    destroy() {
        this.stop();
        this.sendCallback = null;
    }
}

module.exports = { TransportClock };
