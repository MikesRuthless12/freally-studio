import React, { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import MixerPanel from './MixerPanel';
import { PanelHeader } from './components/ui';

/**
 * ArrangementMixer — wraps MixerPanel to show the global main mix.
 * No longer section-specific — one global mix for the entire timeline.
 */
const ArrangementMixer = forwardRef(function ArrangementMixer({
    audioTracks, sampler, masterVolume, setMasterVolume, isDark, trackOrder,
    trackMix, setTrackMix, globalMutes, setGlobalMutes, globalSolos, updateGlobalSolo
}, ref) {
    const mixerPanelRef = useRef(null);

    // Expose tryCollapse to parent (ArrangementTimeline)
    useImperativeHandle(ref, () => ({
        tryCollapse() {
            return mixerPanelRef.current?.tryCollapse?.() || false;
        }
    }));

    const isAnySoloed = globalSolos?.size > 0;

    return (
        <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {/* Header label */}
            <PanelHeader title="MAIN MIX" style={{ flexShrink: 0 }}>
                <span style={{ fontSize: 'var(--text-size-s)', color: 'var(--text-2)' }}>
                    ESC to close
                </span>
            </PanelHeader>
            {/* Full MixerPanel */}
            <MixerPanel
                ref={mixerPanelRef}
                sampler={sampler}
                trackMix={trackMix || {}}
                setTrackMix={setTrackMix || (() => {})}
                globalMutes={globalMutes || new Set()}
                setGlobalMutes={setGlobalMutes || (() => {})}
                globalSolos={globalSolos || new Set()}
                updateGlobalSolo={updateGlobalSolo || (() => {})}
                isAnythingSoloed={isAnySoloed}
                masterVolume={masterVolume ?? 0.7}
                setMasterVolume={setMasterVolume}
                isDark={isDark}
                isVisible={true}
                audioTracks={audioTracks}
                trackOrder={trackOrder}
                idPrefix="mainmix-"
            />
        </div>
    );
});

export default ArrangementMixer;
