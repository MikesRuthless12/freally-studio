import React, { useRef, useEffect, useState, useCallback } from 'react';
import { isElectron } from './electronBridge';

const SEGMENTS = 12;
const METER_W = 8;
const METER_H = 28;

/**
 * Single VU meter bar — segmented gradient matching MixerPanel / EffectVisualizers style.
 * Green → Yellow (>70%) → Red (>90%). Percentage label tracks the fill level.
 */
function VuBar({ pct, isDark, ac, hexToRgba, label, hovered }) {
    const scale = hovered ? 2.8 : 1;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            cursor: 'default', userSelect: 'none',
        }}>
            {/* Label */}
            <span style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px',
                color: isDark ? '#666' : '#888', whiteSpace: 'nowrap',
                fontFamily: "'JetBrains Mono', 'Consolas', monospace",
            }}>
                {label}
            </span>

            {/* Meter + Percentage wrapper — scales on hover */}
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                transform: `scale(${scale})`,
                transformOrigin: 'bottom center',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: hovered ? '6px 8px 2px' : '0',
                background: hovered ? (isDark ? 'rgba(10, 10, 18, 0.95)' : 'rgba(240, 240, 245, 0.95)') : 'transparent',
                borderRadius: hovered ? '6px' : '0',
                border: hovered ? `1px solid ${isDark ? '#2a2a3a' : '#ccc'}` : '1px solid transparent',
                boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.4)' : 'none',
            }}>
                {/* VU Meter bar with percentage tracking the fill level */}
                <div style={{
                    width: `${METER_W}px`, height: `${METER_H}px`,
                    borderRadius: '3px', position: 'relative',
                    border: `1px solid ${isDark ? '#1a1a28' : '#b8b8c0'}`,
                    background: isDark ? '#080810' : '#d8d8e0', flexShrink: 0,
                    overflow: 'visible',
                    marginTop: '14px',
                }}>
                    {/* Percentage — positioned at the top of the fill level */}
                    <span style={{
                        position: 'absolute',
                        bottom: `${pct}%`,
                        left: '50%',
                        transform: 'translate(-50%, -2px)',
                        fontSize: hovered ? '8px' : '9px', fontWeight: 800,
                        color: ac,
                        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                        textShadow: hovered ? `0 0 8px ${hexToRgba(ac, 0.5)}` : 'none',
                        whiteSpace: 'nowrap', zIndex: 10,
                        transition: 'bottom 0.15s linear',
                        pointerEvents: 'none',
                    }}>
                        {pct}%
                    </span>

                    {/* Clipped inner for gradient + overlay */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        borderRadius: '2px', overflow: 'hidden',
                    }}>
                        {/* Full-height gradient */}
                        <div style={{
                            position: 'absolute', bottom: 0, width: '100%', height: '100%',
                            background: 'linear-gradient(to top, #22c55e 0%, #22c55e 60%, #eab308 82%, #ef4444 100%)',
                            borderRadius: '2px',
                        }} />
                        {/* Dark overlay — reveals from bottom */}
                        <div style={{
                            position: 'absolute', top: 0, width: '100%',
                            height: `${100 - pct}%`,
                            background: isDark ? '#0a0a12' : '#c8c8d0',
                            borderRadius: '2px', transition: 'height 0.15s linear', zIndex: 1,
                        }} />
                        {/* Segment lines */}
                        {Array.from({ length: SEGMENTS - 1 }, (_, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                bottom: `${((i + 1) / SEGMENTS) * 100}%`,
                                width: '100%', height: '1px',
                                background: isDark ? '#080810' : '#d8d8e0',
                                zIndex: 2, opacity: 0.7,
                            }} />
                        ))}
                        {/* Glass highlight */}
                        <div style={{
                            position: 'absolute', left: 0, bottom: 0, width: '33%',
                            height: `${pct}%`,
                            background: 'rgba(255,255,255,0.06)',
                            zIndex: 3, transition: 'height 0.15s linear',
                        }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * CPU & Memory VU Meters — placed to the right of the main tab bar.
 *
 * Electron: Uses os.cpus() for real system CPU and os.totalmem()/freemem() for real system RAM.
 * Browser fallback: Main-thread busyness via rAF timing + performance.memory for JS heap.
 */
export default function CpuMeter({ isDark, ac, hexToRgba }) {
    const [cpuPct, setCpuPct] = useState(0);
    const [memPct, setMemPct] = useState(0);
    const [hoveredMeter, setHoveredMeter] = useState(null);
    const rafRef = useRef(null);
    const intervalRef = useRef(null);
    const cpuSmoothed = useRef(0);
    const memSmoothed = useRef(0);

    // Browser-only refs for rAF CPU measurement
    const busyAccum = useRef(0);
    const idleAccum = useRef(0);
    const lastFrameTime = useRef(0);
    const lastReportTime = useRef(0);

    const useNative = isElectron() && window.electronAPI?.system?.getMetrics;

    // Electron: poll system metrics via IPC
    useEffect(() => {
        if (!useNative) return;
        const poll = async () => {
            try {
                const { cpuPercent, memPercent } = await window.electronAPI.system.getMetrics();
                cpuSmoothed.current += (cpuPercent - cpuSmoothed.current) * 0.4;
                memSmoothed.current += (memPercent - memSmoothed.current) * 0.4;
                setCpuPct(Math.round(cpuSmoothed.current));
                setMemPct(Math.round(memSmoothed.current));
            } catch { /* ignore */ }
        };
        poll(); // first call returns 0% CPU (no delta yet), second will be accurate
        intervalRef.current = setInterval(poll, 1000);
        return () => clearInterval(intervalRef.current);
    }, [useNative]);

    // Browser fallback: rAF-based CPU + performance.memory
    const measureBrowser = useCallback(() => {
        const now = performance.now();

        if (lastFrameTime.current > 0) {
            const dt = now - lastFrameTime.current;
            const idealFrame = 16.67;
            if (dt > 0 && dt < 500) {
                const busy = Math.max(0, dt - idealFrame);
                busyAccum.current += busy;
                idleAccum.current += idealFrame;
            }
        }
        lastFrameTime.current = now;

        if (now - lastReportTime.current >= 500) {
            lastReportTime.current = now;

            const total = busyAccum.current + idleAccum.current;
            let rawCpu = 0;
            if (total > 0) rawCpu = (busyAccum.current / total) * 100;
            rawCpu = Math.max(0, Math.min(100, rawCpu));
            cpuSmoothed.current += (rawCpu - cpuSmoothed.current) * 0.3;
            setCpuPct(Math.round(cpuSmoothed.current));
            busyAccum.current = 0;
            idleAccum.current = 0;

            const mem = performance.memory;
            if (mem) {
                const rawMem = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
                memSmoothed.current += (rawMem - memSmoothed.current) * 0.3;
                setMemPct(Math.round(memSmoothed.current));
            }
        }

        rafRef.current = requestAnimationFrame(measureBrowser);
    }, []);

    useEffect(() => {
        if (useNative) return;
        lastReportTime.current = performance.now();
        lastFrameTime.current = 0;
        rafRef.current = requestAnimationFrame(measureBrowser);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [useNative, measureBrowser]);

    const hasMemory = useNative || (typeof performance !== 'undefined' && !!performance.memory);

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginLeft: 'auto', paddingLeft: '12px', flexShrink: 0,
            position: 'relative', zIndex: hoveredMeter ? 200 : 1,
        }}>
            <div
                onMouseEnter={() => setHoveredMeter('cpu')}
                onMouseLeave={() => setHoveredMeter(null)}
                title={`CPU Usage: ${cpuPct}%${useNative ? '' : ' (app thread)'}`}
            >
                <VuBar
                    pct={cpuPct}
                    isDark={isDark}
                    ac={ac}
                    hexToRgba={hexToRgba}
                    label="CPU"
                    hovered={hoveredMeter === 'cpu'}
                />
            </div>
            {hasMemory && (
                <div
                    onMouseEnter={() => setHoveredMeter('mem')}
                    onMouseLeave={() => setHoveredMeter(null)}
                    title={`Memory Usage: ${memPct}%${useNative ? '' : ' (JS heap)'}`}
                >
                    <VuBar
                        pct={memPct}
                        isDark={isDark}
                        ac={ac}
                        hexToRgba={hexToRgba}
                        label="MEM"
                        hovered={hoveredMeter === 'mem'}
                    />
                </div>
            )}
        </div>
    );
}
