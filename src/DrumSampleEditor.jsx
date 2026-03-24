import React, { useState, useEffect, useRef } from 'react';
import SampleWaveform from './SampleWaveform';
import Knob from './Knob';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

const DrumSampleEditor = ({ drumId, sample, params, onParamChange, onClose, theme, accentColors}) => {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const [activeTab, setActiveTab] = useState('envelope');
    const isDark = theme === 'dark';

    // Theme Colors
    const accentColor = ac; // Reddish/Orangish
    const bgColor = isDark ? '#1a1a1a' : '#f5f5f5';
    const panelColor = isDark ? '#252525' : '#ffffff';
    const textColor = isDark ? '#e0e0e0' : '#333333';
    const gridColor = isDark ? '#333' : '#ddd';

    // ADSR SVG Logic
    const svgRef = useRef(null);
    const [draggingPoint, setDraggingPoint] = useState(null);

    const handleAdsrDrag = (e, point) => {
        // Implement drag logic for A, D, S, R dots
        // This requires mapping mouse position to ADSR values
        // For now, let's just use the knobs to drive the state, and maybe simple drag later if complexity allows
        // The prompt specifically asked for "draggable dots", so I must implement it.
    };

    // Helper to map 0-1 values to SVG coordinates
    const width = 600;
    const height = 150;
    const padding = 20;

    // Calculate coordinates based on params
    // Attack: 0 to 1s (mapped to x: 0-25%)
    // Decay: 0 to 1s (mapped to x: 25-50%)
    // Sustain: 0 to 1 (mapped to y: 100-0%)
    // Release: 0 to 1s (mapped to x: 50-100% relative to sustain end)

    // Simplified fixed-width segments for visualization
    const segW = (width - padding * 2) / 3;

    const safeParams = {
        attack: params?.attack || 0.05,
        decay: params?.decay || 0.1,
        sustain: params?.sustain !== undefined ? params.sustain : 1.0,
        release: params?.release || 0.1
    };

    const ax = padding + (safeParams.attack * 1000) / 10;
    // Let's us proportional mapping for visual editor
    const totalTime = 2.0; // Assume graph represents 2 seconds

    const scaleX = (tv) => padding + (tv / totalTime) * (width - padding * 2);
    const scaleY = (v) => height - padding - (v * (height - padding * 2));
    const unscaleX = (x) => ((x - padding) / (width - padding * 2)) * totalTime;
    const unscaleY = (y) => 1 - ((y - padding) / (height - padding * 2));

    const xA = scaleX(safeParams.attack);
    const yA = scaleY(1.0);

    const xD = scaleX(safeParams.attack + safeParams.decay);
    const yD = scaleY(safeParams.sustain);

    const xS = scaleX(safeParams.attack + safeParams.decay + 0.5); // Hold sustain for 0.5s visual
    const yS = scaleY(safeParams.sustain);

    const xR = scaleX(safeParams.attack + safeParams.decay + 0.5 + safeParams.release);
    const yR = scaleY(0);

    // Drag Handlers
    const svgMouseMove = (e) => {
        if (!draggingPoint || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const timeVal = Math.max(0, unscaleX(x));
        const v = Math.max(0, Math.min(1, unscaleY(y)));

        if (draggingPoint === 'A') {
            onParamChange('attack', Math.max(0.001, timeVal));
        } else if (draggingPoint === 'D') {
            const newDecay = Math.max(0.001, timeVal - safeParams.attack);
            onParamChange('decay', newDecay);
            onParamChange('sustain', v);
        } else if (draggingPoint === 'S') {
            // Sustain level only, keep time fixed relative to D
            onParamChange('sustain', v);
        } else if (draggingPoint === 'R') {
            const relStart = safeParams.attack + safeParams.decay + 0.5;
            onParamChange('release', Math.max(0.001, timeVal - relStart));
        }
    };

    const svgMouseUp = () => {
        setDraggingPoint(null);
        window.removeEventListener('mousemove', svgMouseMove);
        window.removeEventListener('mouseup', svgMouseUp);
    };

    const startDrag = (point) => {
        setDraggingPoint(point);
        window.addEventListener('mousemove', svgMouseMove);
        window.addEventListener('mouseup', svgMouseUp);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, color: textColor, fontFamily: 'Inter, sans-serif',
        }} onClick={onClose}>
            <div style={{
                width: '800px', height: '500px',
                background: bgColor, border: `2px solid ${accentColor}`,
                borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '10px 20px', borderBottom: `1px solid ${gridColor}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: panelColor
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '12px', height: '12px', borderRadius: '50%', background: accentColor,
                            boxShadow: `0 0 10px ${accentColor}`
                        }} />
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' }}>
                            {drumId.toUpperCase()}
                        </h2>
                        <span style={{ fontSize: '12px', opacity: 0.6 }}>{sample?.name || t('drumSampleEditor.noSample')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => {/* Preview logic */ }}
                            style={{
                                padding: '8px 20px', background: hexToRgba(ac, 0.1),
                                border: `1px solid ${accentColor}`, color: accentColor,
                                borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >
                            ▶ {t('drumSampleEditor.preview')}
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px 12px', background: 'transparent',
                                border: 'none', color: textColor, fontSize: '16px',
                                cursor: 'pointer'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Waveform Visualizer */}
                <div style={{
                    height: '120px', background: isDark ? '#111' : '#eee', position: 'relative',
                    borderBottom: `1px solid ${gridColor}`
                }}>
                    {sample?.buffer ? (
                        <SampleWaveform
                            audioBuffer={sample.buffer}
                            width={window.innerWidth}
                            height={120}
                            color={accentColor}
                            interactive={true}
                        />
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.5 }}>
                            {t('drumSampleEditor.noSampleLoaded')}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', background: panelColor, borderBottom: `1px solid ${gridColor}` }}>
                    {['envelope', 'sample', 'fatten', 'fx'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, padding: '15px', background: 'transparent', border: 'none',
                                borderBottom: activeTab === tab ? `3px solid ${accentColor}` : 'none',
                                color: activeTab === tab ? accentColor : textColor,
                                fontWeight: 'bold', cursor: 'pointer',
                                textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px'
                            }}
                        >
                            {tab === 'envelope' ? '⌃ ' : ''}
                            {tab === 'sample' ? '◎ ' : ''}
                            {tab === 'fatten' ? '⦿ ' : ''}
                            {tab === 'fx' ? '❖ ' : ''}
                            {t(`drumSampleEditor.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
                        </button>
                    ))}
                </div>

                {/* Content Content */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                    {activeTab === 'envelope' && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* ADSR Graph */}
                            <div style={{ flex: 1, marginBottom: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', position: 'relative' }}>
                                <svg
                                    ref={svgRef}
                                    width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}
                                    style={{ overflow: 'visible' }}
                                >
                                    <defs>
                                        <linearGradient id="fillGradient" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor={accentColor} stopOpacity="0.5" />
                                            <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
                                        </linearGradient>
                                    </defs>

                                    {/* Fill */}
                                    <path
                                        d={`M ${padding} ${height - padding} L ${xA} ${yA} L ${xD} ${yD} L ${xS} ${yS} L ${xR} ${yR} v ${height - padding - yR} h -${xR - padding} Z`}
                                        fill="url(#fillGradient)"
                                    />

                                    {/* Line */}
                                    <path
                                        d={`M ${padding} ${height - padding} L ${xA} ${yA} L ${xD} ${yD} L ${xS} ${yS} L ${xR} ${yR}`}
                                        fill="none" stroke={accentColor} strokeWidth="3"
                                    />

                                    {/* Dots */}
                                    {[
                                        { x: xA, y: yA, id: 'A', label: t('drumSampleEditor.atkLabel', { value: (params?.attack || 0).toFixed(2) }) },
                                        { x: xD, y: yD, id: 'D', label: t('drumSampleEditor.decLabel', { value: (params?.decay || 0).toFixed(2) }) },
                                        { x: xS, y: yS, id: 'S', label: t('drumSampleEditor.susLabel', { value: ((params?.sustain || 0) * 100).toFixed(0) }) },
                                        { x: xR, y: yR, id: 'R', label: t('drumSampleEditor.relLabel', { value: (params?.release || 0).toFixed(2) }) }
                                    ].map(pt => (
                                        <g key={pt.id} onMouseDown={() => startDrag(pt.id)} style={{ cursor: 'pointer' }}>
                                            <circle cx={pt.x} cy={pt.y} r="8" fill={panelColor} stroke={accentColor} strokeWidth="3" />
                                            <circle cx={pt.x} cy={pt.y} r="4" fill={accentColor} />
                                            <text x={pt.x} y={height + 15} textAnchor="middle" fill={textColor} fontSize="10">{pt.label}</text>
                                        </g>
                                    ))}
                                </svg>
                            </div>

                            {/* Controls */}
                            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px' }}>
                                <Knob label={t('drumSampleEditor.attack')} value={safeParams.attack} min={0.001} max={1.0} onChange={(v) => onParamChange('attack', v)} color={accentColor} />
                                <Knob label={t('drumSampleEditor.decay')} value={safeParams.decay} min={0.001} max={1.0} onChange={(v) => onParamChange('decay', v)} color={accentColor} />
                                <Knob label={t('drumSampleEditor.sustain')} value={safeParams.sustain} min={0} max={1.0} onChange={(v) => onParamChange('sustain', v)} color={accentColor} />
                                <Knob label={t('drumSampleEditor.release')} value={safeParams.release} min={0.001} max={1.0} onChange={(v) => onParamChange('release', v)} color={accentColor} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'sample' && (
                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%' }}>
                            <Knob label={t('drumSampleEditor.pitch')} value={params?.pitch || 0} min={-12} max={12} onChange={(v) => onParamChange('pitch', v)} color={accentColor} />
                            <Knob label={t('drumSampleEditor.start')} value={params?.sampleStart || 0} min={0} max={100} onChange={(v) => onParamChange('sampleStart', v)} color={accentColor} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <button
                                    onClick={() => onParamChange('reverse', !params?.reverse)}
                                    style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: params?.reverse ? accentColor : 'transparent',
                                        border: `2px solid ${accentColor}`, color: params?.reverse ? '#fff' : accentColor,
                                        cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    ⟲
                                </button>
                                <span style={{ fontSize: '10px', marginTop: '5px' }}>{t('drumSampleEditor.reverse')}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fatten' && (
                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%' }}>
                            <Knob label={t('drumSampleEditor.fatten')} value={params?.fatten || 0} min={0} max={1.0} onChange={(v) => onParamChange('fatten', v)} color={accentColor} />
                            <Knob label={t('drumSampleEditor.drive')} value={params?.drive || 0} min={0} max={1.0} onChange={(v) => onParamChange('drive', v)} color={accentColor} />
                            <Knob label={t('drumSampleEditor.bassBoost')} value={params?.bassBoost || 0} min={0} max={1.0} onChange={(v) => onParamChange('bassBoost', v)} color={accentColor} />
                        </div>
                    )}

                    {activeTab === 'fx' && (
                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%' }}>
                            <Knob label={t('drumSampleEditor.delayTime')} value={params?.delayTime || 0} min={0} max={1.0} onChange={(v) => onParamChange('delayTime', v)} color={accentColor} />
                            <Knob label={t('drumSampleEditor.feedback')} value={params?.delayFeedback || 0} min={0} max={0.9} onChange={(v) => onParamChange('delayFeedback', v)} color={accentColor} />
                            <Knob label={t('drumSampleEditor.wet')} value={params?.delayMix || 0} min={0} max={1.0} onChange={(v) => onParamChange('delayMix', v)} color={accentColor} />
                        </div>
                    )}
                </div>

                {/* Footer Footer */}
                <div style={{
                    padding: '15px 30px', background: panelColor, borderTop: `1px solid ${gridColor}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', gap: '30px' }}>
                        <Knob label={t('drumSampleEditor.pan')} value={params?.pan || 0} min={-1} max={1} onChange={(v) => onParamChange('pan', v)} color={accentColor} size={40} />
                        <Knob label={t('drumSampleEditor.volume')} value={params?.volume !== undefined ? params.volume : 1.0} min={0} max={1.5} onChange={(v) => onParamChange('volume', v)} color={accentColor} size={40} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DrumSampleEditor;
