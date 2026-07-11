// packRenderer.test.js — TASK-B01 batch renderer tests
// Counts, trim/fade, WAV round-trip, seeds, pitch grid, progress callbacks.

import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import { renderPack, supportsPitchGrid, midiToName } from './PackRenderer.js';
import { PRESETS, getDefaults } from '../DrumSynthEngine.js';

globalThis.OfflineAudioContext = OfflineAudioContext;

const kickItem = () => ({
    kind: 'drum', type: 'kick', name: 'Trap Kick',
    params: { ...getDefaults('kick'), ...PRESETS.kick[0].params },
});
const item808 = () => ({
    kind: 'drum', type: '808', name: 'Trap 808',
    params: { ...getDefaults('808'), ...PRESETS['808'][0].params },
});

function parseWavHeader(bytes) {
    const v = new DataView(bytes);
    const str = (o, n) => {
        let s = '';
        for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(o + i));
        return s;
    };
    expect(str(0, 4)).toBe('RIFF');
    expect(str(8, 4)).toBe('WAVE');
    expect(str(12, 4)).toBe('fmt ');
    const fmtSize = v.getUint32(16, true);
    const format = v.getUint16(20, true);
    const channels = v.getUint16(22, true);
    const sampleRate = v.getUint32(24, true);
    const bitDepth = v.getUint16(34, true);
    const dataOffset = 20 + fmtSize + (format === 3 ? 12 : 0);
    expect(str(dataOffset, 4)).toBe('data');
    const dataSize = v.getUint32(dataOffset + 4, true);
    return { format, channels, sampleRate, bitDepth, dataSize };
}

describe('PackRenderer', () => {
    it('counts = items × pitches × velocities × variations, with progress', async () => {
        const progress = [];
        const results = await renderPack({
            items: [item808(), item808()],
            pitchGrid: [24, 31, 36],
            velocityLayers: [0.65, 1.0],
            variations: 2,
            onProgress: (done, total) => progress.push([done, total]),
        });
        expect(results).toHaveLength(2 * 3 * 2 * 2);
        expect(progress).toHaveLength(24);
        expect(progress[23]).toEqual([24, 24]);
    });

    it('non-trackable items ignore the pitch grid', async () => {
        expect(supportsPitchGrid(kickItem())).toBe(false);
        expect(supportsPitchGrid(item808())).toBe(true);
        const results = await renderPack({
            items: [kickItem()],
            pitchGrid: [24, 36, 48],
        });
        expect(results).toHaveLength(1);
    });

    it('trims the tail below −60 dBFS and fades to true zero', async () => {
        const [r] = await renderPack({ items: [kickItem()] });
        // trimmed shorter than the full 1.5 s render window
        expect(r.buffer.length).toBeLessThan(1.5 * 44100);
        expect(r.buffer.length).toBeGreaterThan(0.1 * 44100);
        const data = r.buffer.channels[0];
        expect(Math.abs(data[data.length - 1])).toBeLessThan(1e-4); // faded out
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
        expect(peak).toBeCloseTo(Math.pow(10, -0.3 / 20), 2); // normalized −0.3 dBFS
    });

    it('writes valid 24-bit WAV bytes (parse back)', async () => {
        const [r] = await renderPack({ items: [kickItem()], bitDepth: 24 });
        const h = parseWavHeader(r.wavBytes);
        expect(h.format).toBe(1);
        expect(h.bitDepth).toBe(24);
        expect(h.channels).toBe(1);
        expect(h.sampleRate).toBe(44100);
        expect(h.dataSize).toBe(r.buffer.length * 3);
    });

    it('variations use distinct round-robin seeds and differ', async () => {
        const results = await renderPack({ items: [kickItem()], variations: 2 });
        const [a, b] = results.map(r => r.buffer.channels[0]);
        expect(a.length).toBeGreaterThan(0);
        let diff = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            diff = Math.max(diff, Math.abs(a[i] - b[i]));
        }
        expect(diff).toBeGreaterThan(0.002);
        expect(results[0].meta.seed).not.toBe(results[1].meta.seed);
    });

    it('pitch grid key-tracks the 808 (octave doubles the rate)', async () => {
        const results = await renderPack({
            items: [item808()],
            pitchGrid: [24, 36], // C1 → C2
        });
        const zc = (data) => {
            let n = 0;
            const end = Math.min(data.length, 44100);
            for (let i = 1; i < end; i++) {
                if ((data[i - 1] < 0) !== (data[i] < 0)) n++;
            }
            return n;
        };
        const low = zc(results[0].buffer.channels[0]);
        const high = zc(results[1].buffer.channels[0]);
        expect(high).toBeGreaterThan(low * 1.5);
        expect(results[0].name).toContain('C1');
        expect(results[1].name).toContain('C2');
    });

    it('names carry note / velocity / variation suffixes', async () => {
        const results = await renderPack({
            items: [item808()],
            pitchGrid: [33],
            velocityLayers: [0.5, 1.0],
            variations: 2,
        });
        expect(midiToName(33)).toBe('A1');
        expect(results.map(r => r.name)).toEqual([
            'Trap_808_A1_v1_rr1', 'Trap_808_A1_v1_rr2',
            'Trap_808_A1_v2_rr1', 'Trap_808_A1_v2_rr2',
        ]);
    });
});
