// packNaming.test.js — TASK-B02 naming/manifest/zip tests

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import JSZip from 'jszip';
import {
    formatName, resolveCollisions, folderForItem, buildManifest,
    licenseText, layoutPack, buildPackZip, DEFAULT_TEMPLATE,
} from './PackNaming.js';
import { renderPack } from './PackRenderer.js';
import { PRESETS, getDefaults } from '../DrumSynthEngine.js';

globalThis.OfflineAudioContext = OfflineAudioContext;

describe('formatName', () => {
    it('renders the full token template', () => {
        expect(formatName({ type: '808', genre: 'Drill', key: 'F', bpm: 140, vel: 3, index: 2 }))
            .toBe('808_Drill_F_140_v3_02');
    });

    it('omits missing tokens together with their separator', () => {
        expect(formatName({ type: 'kick', genre: 'Trap', key: null, bpm: null, vel: null, index: 1 }))
            .toBe('kick_Trap_01');
        expect(formatName({ type: 'snare', genre: null, key: null, bpm: null, vel: 2, index: 12 }))
            .toBe('snare_v2_12');
    });

    it('sanitizes messy values', () => {
        expect(formatName({ type: 'clap', genre: 'Boom Bap!', key: null, bpm: null, vel: null, index: 3 }))
            .toBe('clap_Boom-Bap_03');
    });
});

describe('resolveCollisions', () => {
    it('bumps duplicate names with a zero-padded index', () => {
        expect(resolveCollisions(['Kick.wav', 'Kick.wav', 'Kick.wav', 'Snare.wav']))
            .toEqual(['Kick.wav', 'Kick_02.wav', 'Kick_03.wav', 'Snare.wav']);
    });
});

describe('folders & manifest & license', () => {
    it('maps drum types to the folder layout', () => {
        expect(folderForItem({ kind: 'drum', type: 'kick' })).toBe('Kicks');
        expect(folderForItem({ kind: 'drum', type: '808' })).toBe('808s');
        expect(folderForItem({ kind: 'drum', type: 'ghostSnare' })).toBe('Snares');
        expect(folderForItem({ kind: 'drum', type: 'openHat' })).toBe('Hats');
        expect(folderForItem({ kind: 'drum', type: 'clap' })).toBe('Claps');
        expect(folderForItem({ kind: 'drum', type: 'rimShot' })).toBe('Percs');
        expect(folderForItem({ kind: 'instrument', type: 'synthLead' })).toBe('Instruments');
    });

    it('manifest carries name, createdWith, and item schema', () => {
        const m = buildManifest({
            name: 'Test Pack',
            items: [{ file: 'Kicks/a.wav', type: 'kick', tags: ['drum'] }],
        });
        expect(m.name).toBe('Test Pack');
        expect(m.createdWith).toBe('Freally Studio');
        expect(m.items[0]).toEqual({ file: 'Kicks/a.wav', type: 'kick', key: null, bpm: null, tags: ['drum'] });
    });

    it('license mirrors the repo terms', () => {
        const text = licenseText();
        expect(text).toContain('All Rights Reserved');
        expect(text).toContain('Mike Weaver');
    });
});

describe('layoutPack + buildPackZip (end to end)', () => {
    async function smallPack() {
        return renderPack({
            items: [
                {
                    kind: 'drum', type: 'kick', name: 'Trap Kick', genre: 'Trap',
                    params: { ...getDefaults('kick'), ...PRESETS.kick[0].params },
                },
                {
                    kind: 'drum', type: '808', name: 'Drill 808', genre: 'Drill',
                    params: { ...getDefaults('808'), ...PRESETS['808'][1].params },
                },
            ],
            pitchGrid: [29], // F1
        });
    }

    it('lays out folders and manifest entries', async () => {
        const results = await smallPack();
        const { files, manifest } = layoutPack(results, { packName: 'Layout Pack', bpm: 140 });
        expect(files).toHaveLength(2);
        expect(files[0].path.startsWith('Kicks/')).toBe(true);
        expect(files[1].path.startsWith('808s/')).toBe(true);
        expect(files[1].path).toContain('F1');
        expect(files[1].path).toContain('140');
        expect(manifest.items[1].key).toBe('F1');
        expect(manifest.items[1].bpm).toBe(140);
    });

    it('zip contains folders, manifest.json and license.txt', async () => {
        const results = await smallPack();
        const blob = await buildPackZip(results, { packName: 'Zip Pack' });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const paths = Object.keys(zip.files);
        expect(paths).toContain('manifest.json');
        expect(paths).toContain('license.txt');
        expect(paths.some(p => p.startsWith('Kicks/') && p.endsWith('.wav'))).toBe(true);
        expect(paths.some(p => p.startsWith('808s/') && p.endsWith('.wav'))).toBe(true);
        const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
        expect(manifest.createdWith).toBe('Freally Studio');
        expect(manifest.items).toHaveLength(2);
        const license = await zip.file('license.txt').async('string');
        expect(license).toContain('All Rights Reserved');
    });

    it('default template matches the documented shape', () => {
        expect(DEFAULT_TEMPLATE).toBe('{type}_{genre}_{key}_{bpm}_{vel}_{index}');
    });
});
