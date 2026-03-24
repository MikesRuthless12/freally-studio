/**
 * Track ordering utilities for WavLoom Studio.
 * Shared between WavLoomAppComplete, ArrangementTimeline, and MixerPanel.
 */

export const DEFAULT_CORE_ORDER = [
    { type: 'core', id: 'drums' },
    { type: 'core', id: 'chords' },
    { type: 'core', id: 'melody' },
    { type: 'core', id: 'bass' }
];

/**
 * Build the default track order array from current MIDI and audio tracks.
 * Core tracks first in fixed order, then MIDI, then audio.
 */
export function buildDefaultTrackOrder(midiTracks = [], audioTracks = []) {
    return [
        ...DEFAULT_CORE_ORDER,
        ...midiTracks.map(t => ({ type: 'midi', id: t.id })),
        ...audioTracks.map(t => ({ type: 'audio', id: t.id }))
    ];
}
