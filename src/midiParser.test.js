/**
 * MIDIParser — Comprehensive Unit Tests
 * Tests MIDI file parsing and note extraction
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MIDIParser } from './MIDIParser';

describe('MIDIParser', () => {
    let parser;

    beforeEach(() => {
        parser = new MIDIParser();
    });

    it('should construct with default ticksPerBeat', () => {
        expect(parser.ticksPerBeat).toBe(480);
    });

    // ── parseHeader ────────────────────────────────────────────────────

    describe('parseHeader', () => {
        it('should parse a valid MIDI header', () => {
            // Standard MIDI header: MThd, length 6, format 1, 1 track, 480 ticks
            const buffer = new ArrayBuffer(14);
            const view = new DataView(buffer);
            // MThd
            view.setUint8(0, 0x4D); // M
            view.setUint8(1, 0x54); // T
            view.setUint8(2, 0x68); // h
            view.setUint8(3, 0x64); // d
            // Length = 6
            view.setUint32(4, 6);
            // Format = 1
            view.setUint16(8, 1);
            // NumTracks = 2
            view.setUint16(10, 2);
            // TicksPerBeat = 480
            view.setUint16(12, 480);

            const result = parser.parseHeader(view, 0);
            expect(result).toBeDefined();
            expect(result.format).toBe(1);
            expect(result.numTracks).toBe(2);
            expect(result.ticksPerBeat).toBe(480);
        });
    });

    // ── readVariableLength ─────────────────────────────────────────────

    describe('readVariableLength', () => {
        it('should read single-byte variable length value', () => {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint8(0, 0x40); // 64, no continuation bit
            const result = parser.readVariableLength(view, 0);
            expect(result.value).toBe(64);
            expect(result.length).toBe(1);
        });

        it('should read multi-byte variable length value', () => {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            // 0x81 0x00 = 128
            view.setUint8(0, 0x81); // continuation bit + 1
            view.setUint8(1, 0x00); // 0
            const result = parser.readVariableLength(view, 0);
            expect(result.value).toBe(128);
            expect(result.length).toBe(2);
        });

        it('should read zero correctly', () => {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint8(0, 0x00);
            const result = parser.readVariableLength(view, 0);
            expect(result.value).toBe(0);
            expect(result.length).toBe(1);
        });

        it('should read max single byte (127)', () => {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint8(0, 0x7F);
            const result = parser.readVariableLength(view, 0);
            expect(result.value).toBe(127);
            expect(result.length).toBe(1);
        });
    });

    // ── Class methods exist ──────��─────────────────────────────────────

    it('should have parseMIDIFile method', () => {
        expect(typeof parser.parseMIDIFile).toBe('function');
    });

    it('should have parseHeader method', () => {
        expect(typeof parser.parseHeader).toBe('function');
    });

    it('should have parseTrack method', () => {
        expect(typeof parser.parseTrack).toBe('function');
    });

    it('should have readVariableLength method', () => {
        expect(typeof parser.readVariableLength).toBe('function');
    });

    it('should have parseTrack method for event parsing', () => {
        expect(typeof parser.parseTrack).toBe('function');
    });
});

// ── MIDIInput constants ────────────────────────────────────────────────────

describe('MIDIInput — GM_DRUM_MAP', () => {
    it('should map GM drum MIDI numbers to names', async () => {
        const { GM_DRUM_MAP } = await import('./MIDIInput');
        expect(GM_DRUM_MAP).toBeDefined();
        expect(GM_DRUM_MAP[36]).toBe('kick'); // Bass Drum 1
        expect(GM_DRUM_MAP[38]).toBe('snare'); // Snare
        expect(GM_DRUM_MAP[39]).toBe('clap'); // Hand Clap
    });

    it('should have multiple drum mappings', async () => {
        const { GM_DRUM_MAP } = await import('./MIDIInput');
        expect(Object.keys(GM_DRUM_MAP).length).toBeGreaterThanOrEqual(5);
    });
});
