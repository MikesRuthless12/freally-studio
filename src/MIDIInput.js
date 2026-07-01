/**
 * MIDIInput — Web MIDI API connection manager.
 *
 * Handles requesting MIDI access, listing devices, routing
 * noteOn / noteOff / CC messages, and channel filtering.
 */

// General MIDI drum map  (note number → Freally drum element id)
export const GM_DRUM_MAP = {
    35: 'kick',       // Acoustic Bass Drum
    36: 'kick',       // Bass Drum 1
    37: 'rim',        // Side Stick
    38: 'snare',      // Acoustic Snare
    39: 'clap',       // Hand Clap
    40: 'offSnare',   // Electric Snare
    41: '808',        // Low Floor Tom  → 808 sub
    42: 'closedHat',  // Closed Hi-Hat
    43: '808',        // High Floor Tom → 808 sub
    44: 'closedHat',  // Pedal Hi-Hat
    45: 'perc',       // Low Tom
    46: 'openHat',    // Open Hi-Hat
    47: 'perc',       // Low-Mid Tom
    48: 'perc',       // Hi-Mid Tom
    49: 'openHat',    // Crash Cymbal 1
    50: 'perc',       // High Tom
    51: 'closedHat',  // Ride Cymbal 1
    52: 'openHat',    // Chinese Cymbal
    53: 'rim',        // Ride Bell
    54: 'perc',       // Tambourine
    56: 'rim',        // Cowbell
    75: 'clap',       // Claves
};

export class MIDIInput {
    constructor() {
        this.midiAccess = null;
        this.activeInput = null;
        this.onNoteOn = null;   // (note, velocity, channel) => void
        this.onNoteOff = null;  // (note, channel) => void
        this.onCC = null;       // (cc, value, channel) => void

        this.isAvailable = false;
        this.channelFilter = 0; // 0 = all channels, 1-16 = specific
        this._boundHandler = this._handleMessage.bind(this);
    }

    /** Request MIDI access and auto-select the first input (if any). */
    async init() {
        if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
            this.isAvailable = false;
            return false;
        }
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            this.isAvailable = true;

            // Listen for hot-plug / unplug
            this.midiAccess.onstatechange = () => {
                // If our active input was disconnected, clear it
                if (this.activeInput && this.activeInput.state === 'disconnected') {
                    this.activeInput.onmidimessage = null;
                    this.activeInput = null;
                }
            };

            // Auto-select first available input
            const devices = this.getInputDevices();
            if (devices.length > 0) {
                this.selectInput(devices[0].id);
            }
            return true;
        } catch (err) {
            console.warn('Web MIDI access denied or unavailable:', err);
            this.isAvailable = false;
            return false;
        }
    }

    /** Returns array of { id, name, state } for each MIDI input. */
    getInputDevices() {
        if (!this.midiAccess) return [];
        const devices = [];
        this.midiAccess.inputs.forEach((input) => {
            devices.push({ id: input.id, name: input.name || 'Unknown Device', state: input.state });
        });
        return devices;
    }

    /** Attach listener to a specific MIDI input by deviceId. */
    selectInput(deviceId) {
        // Disconnect previous
        if (this.activeInput) {
            this.activeInput.onmidimessage = null;
        }
        this.activeInput = null;

        if (!this.midiAccess) return;
        const input = this.midiAccess.inputs.get(deviceId);
        if (!input) return;

        input.onmidimessage = this._boundHandler;
        this.activeInput = input;
    }

    disconnect() {
        if (this.activeInput) {
            this.activeInput.onmidimessage = null;
            this.activeInput = null;
        }
    }

    /** Internal: parse raw MIDI messages and dispatch callbacks. */
    _handleMessage(event) {
        const [status, data1, data2] = event.data;
        const msgType = status & 0xF0;
        const channel = (status & 0x0F) + 1; // 1-16

        // Channel filter
        if (this.channelFilter > 0 && channel !== this.channelFilter) return;

        switch (msgType) {
            case 0x90: // Note On
                if (data2 > 0) {
                    this.onNoteOn?.(data1, data2, channel);
                } else {
                    // velocity 0 = note off
                    this.onNoteOff?.(data1, channel);
                }
                break;
            case 0x80: // Note Off
                this.onNoteOff?.(data1, channel);
                break;
            case 0xB0: // Control Change
                this.onCC?.(data1, data2, channel);
                break;
            default:
                break;
        }
    }
}
