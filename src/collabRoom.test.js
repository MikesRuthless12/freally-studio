/**
 * Collaboration Room — Comprehensive Unit Tests
 * Tests room creation and invite link generation
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Mock browser globals
beforeEach(() => {
    globalThis.window = globalThis.window || globalThis;
    window.location = {
        search: '',
        href: 'https://wavloom.studio/',
    };
    window.electronAPI = undefined; // non-Electron by default
});

describe('Room — getOrCreateRoom', () => {
    it('should return a room ID from URL params', async () => {
        window.location.search = '?room=testroom123';
        const { getOrCreateRoom } = await import('./collab/Room.js');
        const room = getOrCreateRoom();
        expect(room).toBe('testroom123');
    });

    it('should generate a random room ID when none in URL', async () => {
        window.location.search = '';
        // Re-import to get fresh module
        const mod = await import('./collab/Room.js');
        const room = mod.getOrCreateRoom();
        expect(room).toBeDefined();
        expect(typeof room).toBe('string');
        expect(room.length).toBeGreaterThan(0);
    });
});

describe('Room — createInviteLink', () => {
    it('should create a web invite link with room parameter', async () => {
        window.electronAPI = undefined;
        window.location.href = 'https://wavloom.studio/';
        const { createInviteLink } = await import('./collab/Room.js');
        const link = createInviteLink('myroom');
        expect(link).toContain('room=myroom');
        expect(link).toContain('wavloom.studio');
    });

    it('should create Electron protocol link when in Electron', async () => {
        window.electronAPI = { isElectron: true };
        const { createInviteLink } = await import('./collab/Room.js');
        const link = createInviteLink('myroom');
        expect(link).toContain('wavloom://');
        expect(link).toContain('room=myroom');
    });

    it('should URL-encode the room ID', async () => {
        window.electronAPI = { isElectron: true };
        const { createInviteLink } = await import('./collab/Room.js');
        const link = createInviteLink('room with spaces');
        expect(link).toContain(encodeURIComponent('room with spaces'));
    });
});
