import React from 'react';

/**
 * Modern segmented vertical audio level meter.
 * 12 segments with green/yellow/red color zones.
 * Props: level (0-1), label, color, isTalking, isMuted, isDark
 */
const SEGMENT_COUNT = 12;
const GAP = 2;
const SEG_HEIGHT = 4;
const SEG_WIDTH = 16;
const METER_HEIGHT = SEGMENT_COUNT * (SEG_HEIGHT + GAP) - GAP;

// Segment color by position: bottom = green, middle = yellow, top = red
function getSegmentColor(index) {
    if (index >= 10) return '#ff3333';  // top 2: red
    if (index >= 7)  return '#ffaa00';  // next 3: yellow/amber
    return '#39ff14';                    // bottom 7: green
}

function getSegmentDimColor(index, isDark) {
    if (index >= 10) return isDark ? 'rgba(255,51,51,0.12)' : 'rgba(255,51,51,0.08)';
    if (index >= 7)  return isDark ? 'rgba(255,170,0,0.12)' : 'rgba(255,170,0,0.08)';
    return isDark ? 'rgba(57,255,20,0.10)' : 'rgba(57,255,20,0.06)';
}

export function VoiceChatMeter({ level = 0, label = 'Peer', color = '#39ff14', isTalking = false, isMuted = false, isDark = true }) {
    const clampedLevel = Math.min(1, Math.max(0, level));
    // How many segments should be lit (0 to SEGMENT_COUNT)
    const litCount = Math.round(clampedLevel * SEGMENT_COUNT);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            opacity: isMuted ? 0.35 : 1,
            transition: 'opacity 0.2s'
        }}>
            {/* Segmented meter bar */}
            <div style={{
                width: `${SEG_WIDTH + 4}px`,
                height: `${METER_HEIGHT + 4}px`,
                padding: '2px',
                background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',
                borderRadius: '4px',
                border: isTalking && !isMuted
                    ? `1px solid ${color}60`
                    : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                boxShadow: isTalking && !isMuted ? `0 0 8px ${color}30` : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                display: 'flex',
                flexDirection: 'column-reverse',
                gap: `${GAP}px`
            }}>
                {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
                    const isLit = i < litCount && !isMuted;
                    const segColor = isLit ? getSegmentColor(i) : getSegmentDimColor(i, isDark);

                    return (
                        <div
                            key={i}
                            style={{
                                width: `${SEG_WIDTH}px`,
                                height: `${SEG_HEIGHT}px`,
                                borderRadius: '1px',
                                background: segColor,
                                boxShadow: isLit ? `0 0 4px ${getSegmentColor(i)}50` : 'none',
                                transition: 'background 0.06s ease-out, box-shadow 0.06s ease-out'
                            }}
                        />
                    );
                })}
            </div>

            {/* Label */}
            <div style={{
                fontSize: '8px',
                fontWeight: 'bold',
                color: isTalking && !isMuted ? color : (isDark ? '#888' : '#999'),
                textAlign: 'center',
                maxWidth: '50px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '0.3px',
                transition: 'color 0.15s'
            }}>
                {isMuted ? <span style={{ textDecoration: 'line-through' }}>{label}</span> : label}
            </div>
        </div>
    );
}

export default VoiceChatMeter;
