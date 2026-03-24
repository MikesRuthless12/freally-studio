import React, { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import MixerPanel from './MixerPanel';

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
            <div style={{
                padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: isDark ? '#111116' : '#eaeaee',
                borderBottom: `1px solid ${isDark ? '#1e1e28' : '#ddd'}`,
                flexShrink: 0
            }}>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#9775fa', letterSpacing: '1px' }}>MAIN MIX</span>
                <span style={{ fontSize: '10px', color: isDark ? '#666' : '#999', fontWeight: '600' }}>
                    ESC to close
                </span>
            </div>
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
