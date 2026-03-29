/**
 * Collaboration Protocol — Comprehensive Unit Tests
 * Tests message types and protocol constants
 */
import { describe, it, expect } from 'vitest';
import { MSG } from './collab/PeerProtocol';

describe('PeerProtocol — MSG constants', () => {
    it('should export MSG object', () => {
        expect(MSG).toBeDefined();
        expect(typeof MSG).toBe('object');
    });

    it('should contain all core peer message types', () => {
        expect(MSG.JOIN).toBe('JOIN');
        expect(MSG.JOIN_ACK).toBe('JOIN_ACK');
        expect(MSG.LEAVE).toBe('LEAVE');
        expect(MSG.TAB_ASSIGN).toBe('TAB_ASSIGN');
        expect(MSG.SCREEN_AVAILABLE).toBe('SCREEN_AVAILABLE');
        expect(MSG.SCREEN_REQUEST).toBe('SCREEN_REQUEST');
        expect(MSG.SAMPLE_SYNC).toBe('SAMPLE_SYNC');
        expect(MSG.AUDIO_SYNC).toBe('AUDIO_SYNC');
        expect(MSG.MOUSE_MOVE).toBe('MOUSE_MOVE');
        expect(MSG.HOST_SYNC).toBe('HOST_SYNC');
    });

    it('should contain ping/pong messages', () => {
        expect(MSG.PING).toBe('PING');
        expect(MSG.PONG).toBe('PONG');
    });

    it('should contain chat message type', () => {
        expect(MSG.CHAT).toBe('CHAT');
    });

    it('should contain tab and access messages', () => {
        expect(MSG.TAB_CHANGE).toBe('TAB_CHANGE');
        expect(MSG.ACCESS_REQUEST).toBe('ACCESS_REQUEST');
        expect(MSG.ACCESS_RESPONSE).toBe('ACCESS_RESPONSE');
    });

    it('should contain collaboration management messages', () => {
        expect(MSG.SAVE_NOTIFICATION).toBe('SAVE_NOTIFICATION');
        expect(MSG.FREE_FOR_ALL).toBe('FREE_FOR_ALL');
        expect(MSG.PERMISSIONS_UPDATE).toBe('PERMISSIONS_UPDATE');
        expect(MSG.HOST_DISCONNECT).toBe('HOST_DISCONNECT');
    });

    it('should contain voice/communication messages', () => {
        expect(MSG.PTT_STATE).toBe('PTT_STATE');
        expect(MSG.COMM_MODE).toBe('COMM_MODE');
        expect(MSG.VOICE_READY).toBe('VOICE_READY');
        expect(MSG.PEER_MUTE).toBe('PEER_MUTE');
    });

    it('should contain library sync messages', () => {
        expect(MSG.LIBRARY_MANIFEST).toBe('LIBRARY_MANIFEST');
        expect(MSG.SAMPLE_REQUEST).toBe('SAMPLE_REQUEST');
        expect(MSG.SAMPLE_DATA).toBe('SAMPLE_DATA');
    });

    it('should contain all mobile link messages', () => {
        expect(MSG.MOBILE_JOIN).toBe('MOBILE_JOIN');
        expect(MSG.MOBILE_HELLO).toBe('MOBILE_HELLO');
        expect(MSG.MOBILE_REJECTED).toBe('MOBILE_REJECTED');
        expect(MSG.MOBILE_LEVELS).toBe('MOBILE_LEVELS');
        expect(MSG.MOBILE_STATE).toBe('MOBILE_STATE');
        expect(MSG.MOBILE_SOLO_TOGGLE).toBe('MOBILE_SOLO_TOGGLE');
        expect(MSG.MOBILE_MUTE_TOGGLE).toBe('MOBILE_MUTE_TOGGLE');
        expect(MSG.MOBILE_VOLUME).toBe('MOBILE_VOLUME');
        expect(MSG.MOBILE_DISCONNECT).toBe('MOBILE_DISCONNECT');
        expect(MSG.MOBILE_TRANSPORT).toBe('MOBILE_TRANSPORT');
    });

    it('all values should be unique strings', () => {
        const values = Object.values(MSG);
        expect(values.every(v => typeof v === 'string')).toBe(true);
        expect(new Set(values).size).toBe(values.length);
    });

    it('should have at least 30 message types', () => {
        expect(Object.keys(MSG).length).toBeGreaterThanOrEqual(30);
    });
});
