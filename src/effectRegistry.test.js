/**
 * Effect Registry — Comprehensive Unit Tests
 * Tests effect categories and type registry
 */
import { describe, it, expect } from 'vitest';

// Mock Web Audio API before importing
class MockAudioParam { constructor() { this.value = 0; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class MockGainNode { constructor() { this.gain = new MockAudioParam(); } connect() { return this; } disconnect() {} }
class MockBiquadFilterNode { constructor() { this.type = 'lowpass'; this.frequency = new MockAudioParam(); this.Q = new MockAudioParam(); this.gain = new MockAudioParam(); this.detune = new MockAudioParam(); } connect() { return this; } disconnect() {} }
class MockDelayNode { constructor() { this.delayTime = new MockAudioParam(); } connect() { return this; } disconnect() {} }
class MockConvolverNode { constructor() { this.buffer = null; } connect() { return this; } disconnect() {} }
class MockDynamicsCompressor { constructor() { this.threshold = new MockAudioParam(); this.knee = new MockAudioParam(); this.ratio = new MockAudioParam(); this.attack = new MockAudioParam(); this.release = new MockAudioParam(); this.reduction = 0; } connect() { return this; } disconnect() {} }
class MockWaveShaperNode { constructor() { this.curve = null; this.oversample = 'none'; } connect() { return this; } disconnect() {} }
class MockOscillatorNode { constructor() { this.type = 'sine'; this.frequency = new MockAudioParam(); this.detune = new MockAudioParam(); } connect() { return this; } disconnect() {} start() {} stop() {} }
class MockStereoPannerNode { constructor() { this.pan = new MockAudioParam(); } connect() { return this; } disconnect() {} }
class MockAnalyserNode { constructor() { this.fftSize = 2048; this.frequencyBinCount = 1024; this.smoothingTimeConstant = 0.8; } connect() { return this; } disconnect() {} getByteFrequencyData() {} getFloatTimeDomainData() {} }
class MockChannelSplitterNode { connect() { return this; } disconnect() {} }
class MockChannelMergerNode { connect() { return this; } disconnect() {} }

class MockAudioContext {
    constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() { return new MockGainNode(); }
    createBiquadFilter() { return new MockBiquadFilterNode(); }
    createDelay() { return new MockDelayNode(); }
    createConvolver() { return new MockConvolverNode(); }
    createDynamicsCompressor() { return new MockDynamicsCompressor(); }
    createWaveShaper() { return new MockWaveShaperNode(); }
    createOscillator() { return new MockOscillatorNode(); }
    createStereoPanner() { return new MockStereoPannerNode(); }
    createAnalyser() { return new MockAnalyserNode(); }
    createChannelSplitter() { return new MockChannelSplitterNode(); }
    createChannelMerger() { return new MockChannelMergerNode(); }
    createBuffer(channels, length, sampleRate) {
        return { sampleRate, length, numberOfChannels: channels, getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
        return { buffer: null, connect() { return this; }, disconnect() {}, start() {}, stop() {}, loop: false, loopStart: 0, loopEnd: 0, playbackRate: new MockAudioParam() };
    }
}

globalThis.AudioContext = MockAudioContext;
globalThis.window = globalThis.window || globalThis;
window.AudioContext = MockAudioContext;

import { EFFECT_CATEGORIES, ALL_EFFECT_TYPES } from './effects/effectRegistry';

// ── EFFECT_CATEGORIES ─────────���────────────────────────────────────────────

describe('EFFECT_CATEGORIES', () => {
    it('should be a non-empty array', () => {
        expect(Array.isArray(EFFECT_CATEGORIES)).toBe(true);
        expect(EFFECT_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('each category should have name and effects array', () => {
        for (const cat of EFFECT_CATEGORIES) {
            expect(cat).toHaveProperty('name');
            expect(cat).toHaveProperty('effects');
            expect(Array.isArray(cat.effects)).toBe(true);
            expect(cat.effects.length).toBeGreaterThan(0);
        }
    });

    it('each effect should have type and label', () => {
        for (const cat of EFFECT_CATEGORIES) {
            for (const effect of cat.effects) {
                expect(effect).toHaveProperty('type');
                expect(effect).toHaveProperty('label');
                expect(typeof effect.type).toBe('string');
                expect(typeof effect.label).toBe('string');
            }
        }
    });

    it('should include Dynamics category', () => {
        const dynamics = EFFECT_CATEGORIES.find(c => c.name === 'Dynamics');
        expect(dynamics).toBeDefined();
        expect(dynamics.effects.length).toBeGreaterThanOrEqual(5);
        expect(dynamics.effects.map(e => e.type)).toContain('Compressor');
        expect(dynamics.effects.map(e => e.type)).toContain('Limiter');
        expect(dynamics.effects.map(e => e.type)).toContain('Gate');
    });

    it('should include EQ & Filter category', () => {
        const eq = EFFECT_CATEGORIES.find(c => c.name === 'EQ & Filter');
        expect(eq).toBeDefined();
        expect(eq.effects.map(e => e.type)).toContain('EQEight');
    });

    it('should include Distortion category', () => {
        const dist = EFFECT_CATEGORIES.find(c => c.name === 'Distortion');
        expect(dist).toBeDefined();
        expect(dist.effects.map(e => e.type)).toContain('Saturation');
        expect(dist.effects.map(e => e.type)).toContain('Distortion');
    });

    it('should include Time & Space category', () => {
        const time = EFFECT_CATEGORIES.find(c => c.name === 'Time & Space');
        expect(time).toBeDefined();
        expect(time.effects.map(e => e.type)).toContain('Reverb');
        expect(time.effects.map(e => e.type)).toContain('Delay');
        expect(time.effects.map(e => e.type)).toContain('Chorus');
    });

    it('should include Modulation category', () => {
        const mod = EFFECT_CATEGORIES.find(c => c.name === 'Modulation');
        expect(mod).toBeDefined();
        expect(mod.effects.map(e => e.type)).toContain('Flanger');
        expect(mod.effects.map(e => e.type)).toContain('Tremolo');
    });

    it('should include Lo-Fi & Character category', () => {
        const lofi = EFFECT_CATEGORIES.find(c => c.name === 'Lo-Fi & Character');
        expect(lofi).toBeDefined();
        expect(lofi.effects.map(e => e.type)).toContain('BitCrusher');
        expect(lofi.effects.map(e => e.type)).toContain('Tape');
        expect(lofi.effects.map(e => e.type)).toContain('Vinyl');
    });

    it('should include Stereo & Utility category', () => {
        const stereo = EFFECT_CATEGORIES.find(c => c.name === 'Stereo & Utility');
        expect(stereo).toBeDefined();
        expect(stereo.effects.map(e => e.type)).toContain('StereoWidener');
    });

    it('should include Analysis category', () => {
        const analysis = EFFECT_CATEGORIES.find(c => c.name === 'Analysis');
        expect(analysis).toBeDefined();
        expect(analysis.effects.map(e => e.type)).toContain('Tuner');
    });

    it('should include Vocal category', () => {
        const vocal = EFFECT_CATEGORIES.find(c => c.name === 'Vocal');
        expect(vocal).toBeDefined();
        expect(vocal.effects.map(e => e.type)).toContain('Vocoder');
        expect(vocal.effects.map(e => e.type)).toContain('LoomSauce');
    });

    it('should include Mastering category', () => {
        const mastering = EFFECT_CATEGORIES.find(c => c.name === 'Mastering');
        expect(mastering).toBeDefined();
        expect(mastering.effects.map(e => e.type)).toContain('MasteringRack');
    });

    it('should have at least 10 categories', () => {
        expect(EFFECT_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    });
});

// ── ALL_EFFECT_TYPES ───────���───────────────────────────────────────────────

describe('ALL_EFFECT_TYPES', () => {
    it('should be a flat array of type strings', () => {
        expect(Array.isArray(ALL_EFFECT_TYPES)).toBe(true);
        ALL_EFFECT_TYPES.forEach(t => expect(typeof t).toBe('string'));
    });

    it('should contain all effects from all categories', () => {
        const expected = EFFECT_CATEGORIES.flatMap(c => c.effects.map(e => e.type));
        expect(ALL_EFFECT_TYPES).toEqual(expected);
    });

    it('should have at least 30 effect types', () => {
        expect(ALL_EFFECT_TYPES.length).toBeGreaterThanOrEqual(30);
    });

    it('all effect type names should be unique', () => {
        expect(new Set(ALL_EFFECT_TYPES).size).toBe(ALL_EFFECT_TYPES.length);
    });

    it('should include key effect types', () => {
        const expected = [
            'Compressor', 'Limiter', 'EQEight', 'Reverb', 'Delay',
            'Chorus', 'Flanger', 'BitCrusher', 'StereoWidener', 'Vocoder'
        ];
        for (const type of expected) {
            expect(ALL_EFFECT_TYPES).toContain(type);
        }
    });
});
