/**
 * trackOrderUtils — Comprehensive Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CORE_ORDER, buildDefaultTrackOrder } from './trackOrderUtils';

// ── DEFAULT_CORE_ORDER ────���────────────────────────────────────────────────

describe('DEFAULT_CORE_ORDER', () => {
    it('should have exactly 4 core tracks', () => {
        expect(DEFAULT_CORE_ORDER).toHaveLength(4);
    });

    it('should be in correct order: drums, chords, melody, bass', () => {
        expect(DEFAULT_CORE_ORDER[0]).toEqual({ type: 'core', id: 'drums' });
        expect(DEFAULT_CORE_ORDER[1]).toEqual({ type: 'core', id: 'chords' });
        expect(DEFAULT_CORE_ORDER[2]).toEqual({ type: 'core', id: 'melody' });
        expect(DEFAULT_CORE_ORDER[3]).toEqual({ type: 'core', id: 'bass' });
    });

    it('all entries should have type "core"', () => {
        DEFAULT_CORE_ORDER.forEach(entry => {
            expect(entry.type).toBe('core');
        });
    });
});

// ── buildDefaultTrackOrder ��────────────────────────────────────────────────

describe('buildDefaultTrackOrder', () => {
    it('should return core tracks when no MIDI or audio tracks', () => {
        const order = buildDefaultTrackOrder();
        expect(order).toHaveLength(4);
        expect(order).toEqual(DEFAULT_CORE_ORDER);
    });

    it('should append MIDI tracks after core tracks', () => {
        const midiTracks = [
            { id: 'midi_1', name: 'MIDI 1' },
            { id: 'midi_2', name: 'MIDI 2' },
        ];
        const order = buildDefaultTrackOrder(midiTracks);
        expect(order).toHaveLength(6);
        expect(order[4]).toEqual({ type: 'midi', id: 'midi_1' });
        expect(order[5]).toEqual({ type: 'midi', id: 'midi_2' });
    });

    it('should append audio tracks after MIDI tracks', () => {
        const audioTracks = [
            { id: 'audio_1', name: 'Audio 1' },
        ];
        const order = buildDefaultTrackOrder([], audioTracks);
        expect(order).toHaveLength(5);
        expect(order[4]).toEqual({ type: 'audio', id: 'audio_1' });
    });

    it('should handle both MIDI and audio tracks', () => {
        const midiTracks = [{ id: 'midi_1' }];
        const audioTracks = [{ id: 'audio_1' }, { id: 'audio_2' }];
        const order = buildDefaultTrackOrder(midiTracks, audioTracks);
        expect(order).toHaveLength(7);
        // Core: 0-3, MIDI: 4, Audio: 5-6
        expect(order[4].type).toBe('midi');
        expect(order[5].type).toBe('audio');
        expect(order[6].type).toBe('audio');
    });

    it('should not mutate DEFAULT_CORE_ORDER', () => {
        const before = [...DEFAULT_CORE_ORDER];
        buildDefaultTrackOrder([{ id: 'x' }], [{ id: 'y' }]);
        expect(DEFAULT_CORE_ORDER).toEqual(before);
    });
});
