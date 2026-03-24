/**
 * Effect Registry — imports all effect classes and registers them.
 * Import this file once at app startup to make all effects available via AudioEffect.create().
 */

import { AudioEffect } from './AudioEffect.js';

// Dynamics
import { Compressor } from './Compressor.js';
import { GlueCompressor } from './GlueCompressor.js';
import { Limiter } from './Limiter.js';
import { Gate } from './Gate.js';
import { SidechainCompressor } from './SidechainCompressor.js';
import { TransientShaper } from './TransientShaper.js';
import { DeEsser } from './DeEsser.js';
import { MultibandCompressor } from './MultibandCompressor.js';

// EQ / Filter
import { EQEight } from './EQEight.js';

// Saturation / Distortion
import { Saturation } from './Saturation.js';
import { Distortion } from './Distortion.js';
import { SoftClipper } from './SoftClipper.js';

// Time-Based
import { Reverb } from './Reverb.js';
import { Delay } from './Delay.js';
import { Echo } from './Echo.js';
import { Chorus } from './Chorus.js';
import { Phaser } from './Phaser.js';
import { HalfTime } from './HalfTime.js';

// Modulation
import { Flanger } from './Flanger.js';
import { Tremolo } from './Tremolo.js';
import { RingModulator } from './RingModulator.js';
import { FrequencyShifter } from './FrequencyShifter.js';

// Lo-Fi & Character
import { BitCrusher } from './BitCrusher.js';
import { Tape } from './Tape.js';
import { Vinyl } from './Vinyl.js';
import { Cabinet } from './Cabinet.js';

// Stereo / Utility
import { StereoWidener } from './StereoWidener.js';
import { AutoPan } from './AutoPan.js';
import { Utility } from './Utility.js';

// Analysis
import { Tuner } from './Tuner.js';

// Vocal
import { Vocoder } from './Vocoder.js';
import { LoomSauce } from './LoomSauce.js';

// Mastering
import { MasteringRack } from './MasteringRack.js';

/**
 * All available effect types, organized by category for the UI.
 */
export const EFFECT_CATEGORIES = [
    {
        name: 'Dynamics',
        effects: [
            { type: 'Compressor', label: 'Compressor' },
            { type: 'GlueCompressor', label: 'Glue Compressor' },
            { type: 'Limiter', label: 'Limiter' },
            { type: 'Gate', label: 'Gate' },
            { type: 'SidechainCompressor', label: 'Sidechain' },
            { type: 'TransientShaper', label: 'Transient Shaper' },
            { type: 'DeEsser', label: 'De-Esser' },
            { type: 'MultibandCompressor', label: 'Multiband Comp' }
        ]
    },
    {
        name: 'EQ & Filter',
        effects: [
            { type: 'EQEight', label: 'EQ Eight' }
        ]
    },
    {
        name: 'Distortion',
        effects: [
            { type: 'Saturation', label: 'Saturation' },
            { type: 'Distortion', label: 'Distortion' },
            { type: 'SoftClipper', label: 'Soft Clipper' }
        ]
    },
    {
        name: 'Time & Space',
        effects: [
            { type: 'Reverb', label: 'Reverb' },
            { type: 'Delay', label: 'Delay' },
            { type: 'Echo', label: 'Echo' },
            { type: 'Chorus', label: 'Chorus' },
            { type: 'Phaser', label: 'Phaser' },
            { type: 'HalfTime', label: 'Half-Time' }
        ]
    },
    {
        name: 'Modulation',
        effects: [
            { type: 'Flanger', label: 'Flanger' },
            { type: 'Tremolo', label: 'Tremolo' },
            { type: 'RingModulator', label: 'Ring Modulator' },
            { type: 'FrequencyShifter', label: 'Freq Shifter' }
        ]
    },
    {
        name: 'Lo-Fi & Character',
        effects: [
            { type: 'BitCrusher', label: 'Bit Crusher' },
            { type: 'Tape', label: 'Tape' },
            { type: 'Vinyl', label: 'Vinyl' },
            { type: 'Cabinet', label: 'Cabinet' }
        ]
    },
    {
        name: 'Stereo & Utility',
        effects: [
            { type: 'StereoWidener', label: 'Stereo Widener' },
            { type: 'AutoPan', label: 'Auto Pan (Ping-Pong)' },
            { type: 'Utility', label: 'Utility' }
        ]
    },
    {
        name: 'Analysis',
        effects: [
            { type: 'Tuner', label: 'Tuner' }
        ]
    },
    {
        name: 'Vocal',
        effects: [
            { type: 'LoomSauce', label: 'Loom Sauce' },
            { type: 'Vocoder', label: 'Vocoder' }
        ]
    },
    {
        name: 'Mastering',
        effects: [
            { type: 'MasteringRack', label: 'Mastering Rack' }
        ]
    }
];

/**
 * Flat list of all effect type names.
 */
export const ALL_EFFECT_TYPES = EFFECT_CATEGORIES.flatMap(cat => cat.effects.map(e => e.type));
