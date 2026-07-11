// packFactory.test.js — TASK-B06 full pipeline test
// render small pack → golden-ear thresholds → zip → unzip → manifest valid.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import JSZip from 'jszip';
import { renderPack } from './PackRenderer.js';
import { buildPackZip } from './PackNaming.js';
import { powerSpectrum, bandEnergy } from '../synth/spectrum.js';
import { PRESETS, getDefaults } from '../DrumSynthEngine.js';

globalThis.OfflineAudioContext = OfflineAudioContext;

const PEAK_LO = Math.pow(10, -0.5 / 20);
const PEAK_HI = Math.pow(10, -0.2 / 20);

describe('Pack factory — full pipeline', () => {
    // 12 offline renders + zip round-trip: give it room under full-suite load
    it('render → golden-ear gates → zip → unzip → manifest schema', { timeout: 30000 }, async () => {
        // 1. render a small pack
        const results = await renderPack({
            items: [
                {
                    kind: 'drum', type: 'kick', name: 'Trap Kick', genre: 'Trap',
                    params: { ...getDefaults('kick'), ...PRESETS.kick[0].params },
                },
                {
                    kind: 'drum', type: '808', name: 'Trap 808', genre: 'Trap',
                    params: { ...getDefaults('808'), ...PRESETS['808'][0].params },
                },
            ],
            pitchGrid: [33], // A1
            velocityLayers: [0.7, 1.0],
            variations: 2,
        });
        expect(results).toHaveLength(1 * 2 * 2 + 1 * 1 * 2 * 2); // kick ignores grid

        // 2. golden-ear thresholds on every rendered sample
        for (const r of results) {
            const data = r.buffer.channels[0];
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
                expect(Number.isNaN(data[i])).toBe(false);
                peak = Math.max(peak, Math.abs(data[i]));
            }
            expect(peak, `${r.name} peak`).toBeGreaterThanOrEqual(PEAK_LO * 0.999);
            expect(peak, `${r.name} clip`).toBeLessThanOrEqual(PEAK_HI * 1.001);
            const { power, binHz } = powerSpectrum(data, r.buffer.sampleRate);
            if (r.meta.type === 'kick' || r.meta.type === '808') {
                expect(bandEnergy(power, binHz, 20, 100), `${r.name} sub dominance`)
                    .toBeGreaterThan(bandEnergy(power, binHz, 1000, 12000));
            }
        }

        // 3. zip → 4. unzip
        const blob = await buildPackZip(results, { packName: 'Pipeline Pack', bpm: 140 });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir);
        expect(paths.filter(p => p.endsWith('.wav'))).toHaveLength(results.length);
        expect(paths).toContain('manifest.json');
        expect(paths).toContain('license.txt');

        // 5. manifest schema
        const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
        expect(manifest.name).toBe('Pipeline Pack');
        expect(manifest.createdWith).toBe('Freally Studio');
        expect(Array.isArray(manifest.items)).toBe(true);
        expect(manifest.items).toHaveLength(results.length);
        for (const item of manifest.items) {
            expect(typeof item.file).toBe('string');
            expect(paths).toContain(item.file);
            expect(typeof item.type).toBe('string');
            expect(item).toHaveProperty('key');
            expect(item.bpm).toBe(140);
            expect(Array.isArray(item.tags)).toBe(true);
        }
        // 808s carry their key
        const with808 = manifest.items.filter(i => i.type === '808');
        expect(with808.length).toBeGreaterThan(0);
        with808.forEach(i => expect(i.key).toBe('A1'));

        // 6. WAV bytes in the zip decode to valid RIFF headers
        const firstWav = paths.find(p => p.endsWith('.wav'));
        const bytes = await zip.file(firstWav).async('arraybuffer');
        const v = new DataView(bytes);
        const tag = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
        expect(tag).toBe('RIFF');
    });
});
