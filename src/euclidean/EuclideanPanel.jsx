import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { euclidean } from '../PatternEngine';
import { hexToRgba } from '../accentThemes';

const STEP_OPTIONS = [4, 8, 12, 16, 24, 32];

const PRESETS = [
    { label: 'Tresillo E(3,8)', pulses: 3, steps: 8, rotation: 0 },
    { label: 'Son Clave E(3,16) rot:14', pulses: 3, steps: 16, rotation: 14 },
    { label: 'Rumba E(5,16) rot:2', pulses: 5, steps: 16, rotation: 2 },
    { label: 'Bossa Nova E(5,16)', pulses: 5, steps: 16, rotation: 0 },
    { label: 'Soukous E(5,12)', pulses: 5, steps: 12, rotation: 0 },
    { label: 'Aksak E(4,9)', pulses: 4, steps: 9, rotation: 0 },
    { label: 'Khafif E(2,5)', pulses: 2, steps: 5, rotation: 0 },
];

const LANE_OPTIONS = [
    { id: 'lane_2', label: '+2' },
    { id: 'lane_1', label: '+1' },
    { id: 'root', label: '0 (root)' },
    { id: 'lane_neg1', label: '-1' },
    { id: 'lane_neg2', label: '-2' },
];

export default function EuclideanPanel({ drumElements, globalBars, onApply, onClose, theme, accentColors }) {
    const ac = accentColors?.accent || '#ff6b6b';
    const isDark = theme === 'dark';

    const [targetDrum, setTargetDrum] = useState('closedHat');
    const [targetLane, setTargetLane] = useState('root');
    const [pulses, setPulses] = useState(5);
    const [steps, setSteps] = useState(16);
    const [rotation, setRotation] = useState(0);
    const [velocity, setVelocity] = useState(80);
    const [applyPerBar, setApplyPerBar] = useState(true);

    // Clamp pulses when steps change
    const safePulses = Math.min(pulses, steps);
    const safeRotation = Math.min(rotation, steps - 1);

    const pattern = useMemo(
        () => euclidean(safePulses, steps, safeRotation),
        [safePulses, steps, safeRotation]
    );

    const handlePreset = useCallback((preset) => {
        setPulses(preset.pulses);
        setSteps(preset.steps);
        setRotation(preset.rotation);
    }, []);

    const handleApply = useCallback(() => {
        onApply({
            targetDrum,
            targetLane,
            pulses: safePulses,
            steps,
            rotation: safeRotation,
            velocity,
            applyPerBar,
            pattern,
        });
    }, [targetDrum, targetLane, safePulses, steps, safeRotation, velocity, applyPerBar, pattern, onApply]);

    // --- Circular visualization ---
    const circleSize = 180;
    const cx = circleSize / 2;
    const cy = circleSize / 2;
    const radius = circleSize / 2 - 16;

    const points = useMemo(() => {
        return Array.from({ length: steps }, (_, i) => {
            const angle = (2 * Math.PI * i) / steps - Math.PI / 2;
            return {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
                hit: pattern[i],
            };
        });
    }, [steps, pattern, cx, cy, radius]);

    // Lines connecting consecutive hits
    const hitIndices = useMemo(() => points.reduce((acc, p, i) => p.hit ? [...acc, i] : acc, []), [points]);

    const selectStyle = {
        padding: '6px 10px',
        background: isDark ? '#1a1a1f' : '#fff',
        border: `1px solid ${isDark ? '#2a2a2f' : '#ccc'}`,
        borderRadius: '4px',
        color: isDark ? '#ddd' : '#333',
        fontSize: '11px',
        fontWeight: 'bold',
    };

    const labelStyle = {
        display: 'block',
        fontSize: '9px',
        marginBottom: '4px',
        color: isDark ? '#666' : '#888',
        fontWeight: 'bold',
        letterSpacing: '1px',
        textTransform: 'uppercase',
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                background: isDark ? '#141418' : '#fff',
                borderRadius: '12px',
                border: `1px solid ${isDark ? '#2a2a2f' : '#ddd'}`,
                padding: '24px',
                width: '520px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
                {/* Title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: isDark ? '#fff' : '#333' }}>
                            Euclidean Rhythm
                        </h3>
                        <span style={{ fontSize: '13px', color: ac, fontWeight: 'bold', fontFamily: 'monospace' }}>
                            E({safePulses}, {steps}){safeRotation > 0 ? ` rot:${safeRotation}` : ''}
                        </span>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: isDark ? '#666' : '#999',
                        fontSize: '20px', cursor: 'pointer', padding: '4px 8px',
                    }}>&times;</button>
                </div>

                {/* Circular Visualization + Linear Preview */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', alignItems: 'center' }}>
                    <svg width={circleSize} height={circleSize} style={{ flexShrink: 0 }}>
                        {/* Outer ring */}
                        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={isDark ? '#2a2a2f' : '#ddd'} strokeWidth="1" />
                        {/* Lines between consecutive hits */}
                        {hitIndices.length > 1 && hitIndices.map((hi, idx) => {
                            const nextIdx = (idx + 1) % hitIndices.length;
                            const p1 = points[hi];
                            const p2 = points[hitIndices[nextIdx]];
                            return (
                                <line key={`line-${idx}`}
                                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                    stroke={hexToRgba(ac, 0.4)} strokeWidth="1.5"
                                />
                            );
                        })}
                        {/* Step dots */}
                        {points.map((p, i) => (
                            <circle key={i}
                                cx={p.x} cy={p.y}
                                r={p.hit ? 6 : 3}
                                fill={p.hit ? ac : (isDark ? '#333' : '#ccc')}
                                stroke={p.hit ? ac : 'none'}
                                strokeWidth="2"
                            />
                        ))}
                    </svg>

                    {/* Linear preview */}
                    <div style={{ flex: 1 }}>
                        <div style={{ ...labelStyle, marginBottom: '6px' }}>Linear Preview</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                            {pattern.map((hit, i) => (
                                <div key={i} style={{
                                    width: steps <= 16 ? '20px' : '14px',
                                    height: steps <= 16 ? '20px' : '14px',
                                    borderRadius: '3px',
                                    background: hit ? ac : (isDark ? '#1a1a1f' : '#eee'),
                                    border: `1px solid ${hit ? ac : (isDark ? '#2a2a2f' : '#ddd')}`,
                                    transition: 'all 0.15s',
                                }} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                        <label style={labelStyle}>Pulses (hits)</label>
                        <input type="range" min={1} max={steps} value={safePulses}
                            onChange={(e) => setPulses(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: ac }} />
                        <div style={{ fontSize: '11px', color: isDark ? '#aaa' : '#666', textAlign: 'center', fontWeight: 'bold' }}>{safePulses}</div>
                    </div>
                    <div>
                        <label style={labelStyle}>Steps per bar</label>
                        <select value={steps} onChange={(e) => {
                            const newSteps = parseInt(e.target.value);
                            setSteps(newSteps);
                            if (pulses > newSteps) setPulses(newSteps);
                            if (rotation >= newSteps) setRotation(0);
                        }} style={selectStyle}>
                            {STEP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Rotation</label>
                        <input type="range" min={0} max={steps - 1} value={safeRotation}
                            onChange={(e) => setRotation(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: ac }} />
                        <div style={{ fontSize: '11px', color: isDark ? '#aaa' : '#666', textAlign: 'center', fontWeight: 'bold' }}>{safeRotation}</div>
                    </div>
                    <div>
                        <label style={labelStyle}>Velocity</label>
                        <input type="range" min={1} max={100} value={velocity}
                            onChange={(e) => setVelocity(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: ac }} />
                        <div style={{ fontSize: '11px', color: isDark ? '#aaa' : '#666', textAlign: 'center', fontWeight: 'bold' }}>{velocity}</div>
                    </div>
                </div>

                {/* Target selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                        <label style={labelStyle}>Target Drum</label>
                        <select value={targetDrum} onChange={(e) => setTargetDrum(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                            {drumElements.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Target Lane</label>
                        <select value={targetLane} onChange={(e) => setTargetLane(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                            {LANE_OPTIONS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isDark ? '#aaa' : '#666', cursor: 'pointer' }}>
                            <input type="checkbox" checked={applyPerBar} onChange={(e) => setApplyPerBar(e.target.checked)}
                                style={{ accentColor: ac }} />
                            Per-bar
                        </label>
                    </div>
                </div>

                {/* Presets */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={labelStyle}>Common Patterns</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                        {PRESETS.map((preset) => (
                            <button key={preset.label} onClick={() => handlePreset(preset)}
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    background: isDark ? hexToRgba(ac, 0.08) : '#f5f5f5',
                                    border: `1px solid ${isDark ? '#2a2a2f' : '#ddd'}`,
                                    borderRadius: '4px',
                                    color: isDark ? '#ccc' : '#555',
                                    cursor: 'pointer',
                                }}>
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{
                        padding: '10px 20px', fontSize: '11px', fontWeight: '900',
                        background: isDark ? '#1a1a1f' : '#eee',
                        border: `1px solid ${isDark ? '#2a2a2f' : '#ccc'}`,
                        borderRadius: '6px',
                        color: isDark ? '#aaa' : '#666',
                        cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={handleApply} style={{
                        padding: '10px 20px', fontSize: '11px', fontWeight: '900',
                        background: ac, border: `1px solid ${ac}`,
                        borderRadius: '6px', color: '#fff', cursor: 'pointer',
                    }}>Apply</button>
                </div>
            </div>
        </div>
    );
}

/**
 * Inline mini Euclidean control for individual drum lane rows.
 * Shows pulses/steps/rotation sliders in a compact popover.
 */
export function EuclideanMiniButton({ drumId, laneId, totalSteps, barsCount, lockedRows, onApply, theme, accentColor, isOpen, onToggle }) {
    const [pulses, setPulses] = useState(5);
    const [steps, setSteps] = useState(16);
    const [rotation, setRotation] = useState(0);
    const isDark = theme === 'dark';
    const ac = accentColor || '#ff6b6b';
    const popoverRef = useRef(null);
    const btnRef = useRef(null);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, flipped: false });

    const safePulses = Math.min(pulses, steps);
    const safeRotation = Math.min(rotation, steps - 1);

    // Compute position when opened
    useEffect(() => {
        if (!isOpen || !btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const popoverHeight = 200; // approximate height of popover
        const spaceBelow = window.innerHeight - rect.bottom;
        const flipped = spaceBelow < popoverHeight;
        setPopoverPos({
            left: rect.right + 4,
            top: flipped ? rect.top - popoverHeight + rect.height : rect.top,
            flipped,
        });
    }, [isOpen]);

    // Close on Escape or click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => { if (e.key === 'Escape') onToggle(null); };
        const handleClick = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target) &&
                btnRef.current && !btnRef.current.contains(e.target)) onToggle(null);
        };
        document.addEventListener('keydown', handleKey);
        document.addEventListener('mousedown', handleClick);
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.removeEventListener('mousedown', handleClick);
        };
    }, [isOpen, onToggle]);

    const handleApply = () => {
        if (lockedRows && lockedRows.has(drumId)) return;
        const pat = euclidean(safePulses, steps, safeRotation);
        onApply(drumId, laneId, pat, steps, barsCount);
        onToggle(null);
    };

    if (!isOpen) {
        return (
            <button
                ref={btnRef}
                onClick={(e) => { e.stopPropagation(); onToggle(`${drumId}:${laneId}`); }}
                title="Euclidean"
                style={{
                    width: '18px', height: '14px',
                    fontSize: '8px', fontWeight: '900',
                    background: isDark ? '#1a1a1f' : '#eee',
                    border: `1px solid ${isDark ? '#2a2a2f' : '#ccc'}`,
                    borderRadius: '3px',
                    color: isDark ? '#888' : '#666',
                    cursor: 'pointer', padding: 0,
                    lineHeight: '14px',
                }}
            >E</button>
        );
    }

    return (
        <>
        <button
            ref={btnRef}
            onClick={(e) => { e.stopPropagation(); onToggle(null); }}
            title="Euclidean"
            style={{
                width: '18px', height: '14px',
                fontSize: '8px', fontWeight: '900',
                background: ac,
                border: `1px solid ${ac}`,
                borderRadius: '3px',
                color: '#fff',
                cursor: 'pointer', padding: 0,
                lineHeight: '14px',
            }}
        >E</button>
        <div ref={popoverRef} onClick={(e) => e.stopPropagation()} style={{
            position: 'fixed', left: popoverPos.left, top: popoverPos.top, zIndex: 9998,
            background: isDark ? '#1a1a1f' : '#fff',
            border: `1px solid ${isDark ? '#333' : '#ccc'}`,
            borderRadius: '6px', padding: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            width: '180px',
        }}>
            <div style={{ fontSize: '9px', fontWeight: '900', color: ac, marginBottom: '6px' }}>
                E({safePulses},{steps}){safeRotation > 0 ? ` r:${safeRotation}` : ''}
            </div>
            <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '8px', color: isDark ? '#666' : '#888', fontWeight: 'bold' }}>Pulses</div>
                <input type="range" min={1} max={steps} value={safePulses}
                    onChange={(e) => setPulses(parseInt(e.target.value))}
                    style={{ width: '100%', height: '12px', accentColor: ac }} />
            </div>
            <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '8px', color: isDark ? '#666' : '#888', fontWeight: 'bold' }}>Steps</div>
                <select value={steps} onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setSteps(v);
                    if (pulses > v) setPulses(v);
                    if (rotation >= v) setRotation(0);
                }} style={{ fontSize: '9px', padding: '2px', background: isDark ? '#141418' : '#fff', color: isDark ? '#ccc' : '#333', border: `1px solid ${isDark ? '#333' : '#ccc'}`, borderRadius: '3px' }}>
                    {STEP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '8px', color: isDark ? '#666' : '#888', fontWeight: 'bold' }}>Rotation</div>
                <input type="range" min={0} max={steps - 1} value={safeRotation}
                    onChange={(e) => setRotation(parseInt(e.target.value))}
                    style={{ width: '100%', height: '12px', accentColor: ac }} />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={handleApply} style={{
                    flex: 1, fontSize: '9px', fontWeight: '900', padding: '4px',
                    background: ac, border: 'none', borderRadius: '3px', color: '#fff', cursor: 'pointer',
                }}>Apply</button>
                <button onClick={() => onToggle(null)} style={{
                    flex: 1, fontSize: '9px', fontWeight: '900', padding: '4px',
                    background: isDark ? '#2a2a2f' : '#eee', border: 'none', borderRadius: '3px',
                    color: isDark ? '#888' : '#666', cursor: 'pointer',
                }}>Close</button>
            </div>
        </div>
        </>
    );
}

