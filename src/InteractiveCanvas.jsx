/**
 * InteractiveCanvas.jsx — Unified interactive canvas for all effect visualizers.
 *
 * Draws the base visualization via DRAW_MAP, then overlays interactive handles
 * from INTERACTION_CONFIGS. Supports drag, hover, click, and right-click.
 *
 * Effects without an interaction config get static-only rendering.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { W, H, DRAW_MAP, setFramePalette } from './EffectVisualizers';
import { INTERACTION_CONFIGS } from './InteractionConfigs';
import { hexToRgba } from './accentThemes';

const FPS_INTERVAL = 1000 / 15;

const InteractiveCanvas = ({ effect, onUpdate, theme, accentColors, canvasStyle}) => {
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const lastFrameRef = useRef(0);
    const dragRef = useRef(null);   // { id, startX, startY, moved }
    const hoverRef = useRef(null);  // handle id or null
    const themeAc = theme?.accentColor || ac;
    const isDarkMode = theme?.isDark ?? true;

    const config = INTERACTION_CONFIGS[effect.name] || null;

    const getCoords = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (W / rect.width),
            y: (e.clientY - rect.top) * (H / rect.height)
        };
    }, []);

    // ── Mouse down on canvas ──
    const handleMouseDown = useCallback((e) => {
        if (!config) return;
        const c = getCoords(e);
        if (!c) return;
        const hit = config.hitTest(c.x, c.y, effect);
        if (!hit) return;
        e.preventDefault();
        if (hit.clickOnly && config.onClick) {
            config.onClick(hit.id, effect);
            onUpdate();
        } else {
            dragRef.current = { id: hit.id, startX: c.x, startY: c.y, moved: false };
            if (canvasRef.current) canvasRef.current.style.cursor = hit.cursor || 'grabbing';
        }
    }, [effect, config, getCoords, onUpdate]);

    // ── Hover on canvas (non-drag) ──
    const handleCanvasMove = useCallback((e) => {
        if (dragRef.current || !config) return;
        const c = getCoords(e);
        if (!c) return;
        const hit = config.hitTest(c.x, c.y, effect);
        const canvas = canvasRef.current;
        if (hit) {
            if (canvas) canvas.style.cursor = hit.cursor || 'pointer';
            hoverRef.current = hit.id;
        } else {
            if (canvas) canvas.style.cursor = 'default';
            hoverRef.current = null;
        }
    }, [effect, config, getCoords]);

    // ── Right-click ──
    const handleContextMenu = useCallback((e) => {
        if (!config?.onContextMenu) return;
        const c = getCoords(e);
        if (!c) return;
        e.preventDefault();
        if (config.onContextMenu(c.x, c.y, effect)) onUpdate();
    }, [effect, config, onUpdate, getCoords]);

    // ── Global drag + mouseup ──
    useEffect(() => {
        const onMove = (e) => {
            if (!dragRef.current || !config) return;
            const c = getCoords(e);
            if (!c) return;
            if (!dragRef.current.moved) {
                const dx = c.x - dragRef.current.startX;
                const dy = c.y - dragRef.current.startY;
                if (Math.sqrt(dx * dx + dy * dy) > 3) dragRef.current.moved = true;
            }
            if (dragRef.current.moved) {
                config.onDrag(dragRef.current.id, c.x, c.y, effect);
                onUpdate();
            }
        };
        const onUp = () => {
            if (dragRef.current) {
                if (!dragRef.current.moved && config?.onClick) {
                    config.onClick(dragRef.current.id, effect);
                    onUpdate();
                }
                dragRef.current = null;
                hoverRef.current = null;
                if (canvasRef.current) canvasRef.current.style.cursor = 'default';
            }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [effect, config, onUpdate, getCoords]);

    // ── Animation loop ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const drawFn = DRAW_MAP[effect.name];
        if (!drawFn) return;

        function animate(ts) {
            rafRef.current = requestAnimationFrame(animate);
            const delta = ts - lastFrameRef.current;
            if (delta < FPS_INTERVAL) return;
            lastFrameRef.current = ts - (delta % FPS_INTERVAL);
            const t = ts / 1000;
            try {
                setFramePalette(isDarkMode, acSec);
                drawFn(ctx, effect, ac, t);
            } catch (e) { /* nodes not yet created */ }
            // Overlays
            if (config?.drawOverlays) {
                try {
                    config.drawOverlays(ctx, effect, ac, dragRef.current?.id ?? null, hoverRef.current);
                } catch (e) { /* handle gracefully */ }
            }
        }

        rafRef.current = requestAnimationFrame(animate);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [effect, config, ac, isDarkMode]);

    return (
        <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onMouseDown={config ? handleMouseDown : undefined}
            onMouseMove={config ? handleCanvasMove : undefined}
            onContextMenu={config?.onContextMenu ? handleContextMenu : undefined}
            style={{
                width: '100%',
                maxWidth: '640px',
                height: 'auto',
                display: 'block',
                margin: '0 auto',
                cursor: 'default',
                imageRendering: 'auto',
                ...(canvasStyle || {})
            }}
        />
    );
};

export default InteractiveCanvas;
