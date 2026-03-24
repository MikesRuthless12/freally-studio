import React, { useRef, useEffect } from 'react';
import { hexToRgba } from './accentThemes';

// ═══════════════════════════════════════════════════════════════════
// VST3-Style Effect Visualizers for WavLoom Studio
// Canvas-based real-time visualizations for all 18 effect types
// ═══════════════════════════════════════════════════════════════════

export const W = 480;
export const H = 270;
export const S = 1.5; // scale factor (480/320)

// ─── Dark VST Palette (default values, mutable for theme switching) ───
export let BG       = '#0d0d14';
export let GRID     = '#1a1a2e';
export let GRID_LT  = '#252540';
export let TXT      = '#777';
export let TXT_DIM  = '#444';
export let GREEN    = '#4caf50';
export let YELLOW   = '#ffb74d';
export let RED_WARN = '#f44336';
export let BLUE_L   = '#6bafff';
export let RED_R    = '#ff6b6b';

// ─── Sub-element colors (mutable for theme switching) ───
let METER_BG     = '#080810';
let METER_STROKE = '#2a2a3a';
let LED_OFF      = '#1a1a24';
let LED_STROKE   = '#333';
let SECT_BG      = '#0a0a12';
let SECT_BG_ACT  = '#0f0f1a';
let GRID_SUB     = '#151528';

// ─── Secondary accent (set per frame from InteractiveCanvas) ───
export let AC_SEC = '#ff9f43';

/**
 * Set the palette for the current render frame.
 * Call this before any draw functions to switch between dark/light mode.
 */
export function setFramePalette(isDark, secondaryAccent) {
    if (secondaryAccent) AC_SEC = secondaryAccent;
    if (isDark === false) {
        BG = '#f0f0f5'; GRID = '#d0d0e0'; GRID_LT = '#e0e0ea'; GRID_SUB = '#e8e8f0'; TXT = '#555'; TXT_DIM = '#999';
        METER_BG = '#d8d8e0'; METER_STROKE = '#bbb'; LED_OFF = '#d0d0d8'; LED_STROKE = '#999';
        SECT_BG = '#e0e0e8'; SECT_BG_ACT = '#eaeaf0';
        GREEN = '#2e7d32'; YELLOW = '#e65100'; RED_WARN = '#c62828';
        BLUE_L = '#1565c0'; RED_R = '#c62828';
    } else {
        BG = '#0d0d14'; GRID = '#1a1a2e'; GRID_LT = '#252540'; GRID_SUB = '#151528'; TXT = '#777'; TXT_DIM = '#444';
        METER_BG = '#080810'; METER_STROKE = '#2a2a3a'; LED_OFF = '#1a1a24'; LED_STROKE = '#333';
        SECT_BG = '#0a0a12'; SECT_BG_ACT = '#0f0f1a';
        GREEN = '#4caf50'; YELLOW = '#ffb74d'; RED_WARN = '#f44336';
        BLUE_L = '#6bafff'; RED_R = '#ff6b6b';
    }
}

// ═══════════════════ SHARED DRAWING HELPERS ════════════════════

export function clear(ctx) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
}

export function drawGrid(ctx, rows, cols) {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 0.5;
    for (let r = 1; r < rows; r++) {
        const y = (H / rows) * r;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let c = 1; c < cols; c++) {
        const x = (W / cols) * c;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
}

export function drawGlow(ctx, pts, color, lw) {
    if (pts.length < 2) return;
    lw = lw || 2;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Use accent gradient when the color is the primary accent
    var strokeColor = color;
    var minX = pts[0][0], maxX = pts[0][0];
    for (let i = 1; i < pts.length; i++) {
        if (pts[i][0] < minX) minX = pts[i][0];
        if (pts[i][0] > maxX) maxX = pts[i][0];
    }
    if (maxX - minX > 30 && AC_SEC && color.length <= 7) {
        try {
            var grad = ctx.createLinearGradient(minX, 0, maxX, 0);
            grad.addColorStop(0, color);
            grad.addColorStop(1, AC_SEC);
            strokeColor = grad;
        } catch (e) { strokeColor = color; }
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lw + 6;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.restore();
}

export function drawFilledGlow(ctx, pts, color) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[pts.length - 1][0], H);
    ctx.lineTo(pts[0][0], H);
    // Use gradient fill when secondary accent is available
    ctx.closePath();
    ctx.fillStyle = color + '15';
    ctx.fill();
    ctx.restore();
    drawGlow(ctx, pts, color);
}

export function drawMeter(ctx, x, y, w, h, val, color, vertical) {
    if (vertical === undefined) vertical = true;
    ctx.fillStyle = METER_BG;
    ctx.fillRect(x, y, w, h);
    const fill = Math.max(0, Math.min(1, Math.abs(val)));
    if (vertical) {
        const fh = h * fill;
        const grad = ctx.createLinearGradient(x, y + h, x, y);
        grad.addColorStop(0, GREEN);
        grad.addColorStop(0.6, YELLOW);
        grad.addColorStop(0.9, color);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + h - fh, w - 2, fh);
    } else {
        const fw = w * fill;
        ctx.fillStyle = color;
        ctx.fillRect(x, y + 1, fw, h - 2);
    }
    ctx.strokeStyle = METER_STROKE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
}

export function drawLabel(ctx, text, x, y, color, size, align) {
    ctx.fillStyle = color || TXT;
    ctx.font = 'bold ' + (size || 9) + 'px "Courier New", monospace';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

export function drawLED(ctx, x, y, r, on, color) {
    if (on) {
        // Double-layer glow for powered LEDs
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = color + '18';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = color + '33';
        ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = on ? color : LED_OFF;
    ctx.fill();
    ctx.strokeStyle = LED_STROKE;
    ctx.lineWidth = 1;
    ctx.stroke();
}

export function dashed(ctx, x1, y1, x2, y2, color, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(dash || [4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

export function alphaColor(hex, a) {
    var alpha = Math.max(0, Math.min(255, Math.round(a)));
    return hex + alpha.toString(16).padStart(2, '0');
}

// ═══════════════════ ENHANCED VST3 DRAWING HELPERS ═════════════

/** Radial vignette overlay — recessed hardware screen look */
export function drawVignette(ctx) {
    var grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

/** Enhanced grid with sub-grid lines, brighter center line, and edge fade */
export function drawGridEnhanced(ctx, rows, cols) {
    // Sub-grid (2x density, very faint)
    ctx.strokeStyle = GRID_SUB;
    ctx.lineWidth = 0.3;
    for (var r = 1; r < rows * 2; r++) {
        var y = (H / (rows * 2)) * r;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (var c = 1; c < cols * 2; c++) {
        var x = (W / (cols * 2)) * c;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    // Main grid
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 0.5;
    for (var r2 = 1; r2 < rows; r2++) {
        var y2 = (H / rows) * r2;
        // Center line brighter
        if (r2 === Math.floor(rows / 2)) {
            ctx.strokeStyle = GRID_LT;
            ctx.lineWidth = 0.8;
        }
        ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke();
        ctx.strokeStyle = GRID;
        ctx.lineWidth = 0.5;
    }
    for (var c2 = 1; c2 < cols; c2++) {
        var x2 = (W / cols) * c2;
        ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, H); ctx.stroke();
    }
}

/** Enhanced glow with extra outer bloom for premium look */
export function drawGlowLine(ctx, pts, color, lw) {
    if (pts.length < 2) return;
    lw = lw || 2;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    var strokeColor = color;
    var minX = pts[0][0], maxX = pts[0][0];
    for (var i = 1; i < pts.length; i++) {
        if (pts[i][0] < minX) minX = pts[i][0];
        if (pts[i][0] > maxX) maxX = pts[i][0];
    }
    if (maxX - minX > 30 && AC_SEC && color.length <= 7) {
        try {
            var grad = ctx.createLinearGradient(minX, 0, maxX, 0);
            grad.addColorStop(0, color);
            grad.addColorStop(1, AC_SEC);
            strokeColor = grad;
        } catch (e) { strokeColor = color; }
    }
    // Outer bloom (very soft, wide)
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lw + 14;
    ctx.globalAlpha = 0.03;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.stroke();
    // Mid glow
    ctx.lineWidth = lw + 6;
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.stroke();
    // Core line
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var m = 1; m < pts.length; m++) ctx.lineTo(pts[m][0], pts[m][1]);
    ctx.stroke();
    ctx.restore();
}

/** Enhanced filled glow with premium bloom */
export function drawFilledGlowEnhanced(ctx, pts, color) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[pts.length - 1][0], H);
    ctx.lineTo(pts[0][0], H);
    ctx.closePath();
    // Gradient fill from top (more opaque) to bottom (transparent)
    try {
        var minY = H, maxY = 0;
        for (var j = 0; j < pts.length; j++) {
            if (pts[j][1] < minY) minY = pts[j][1];
            if (pts[j][1] > maxY) maxY = pts[j][1];
        }
        var fillGrad = ctx.createLinearGradient(0, minY, 0, H);
        fillGrad.addColorStop(0, color + '22');
        fillGrad.addColorStop(0.5, color + '0d');
        fillGrad.addColorStop(1, color + '03');
        ctx.fillStyle = fillGrad;
    } catch (e) {
        ctx.fillStyle = color + '12';
    }
    ctx.fill();
    ctx.restore();
    drawGlowLine(ctx, pts, color);
}

/** Enhanced meter with rounded corners, glass highlight, and segments */
export function drawMeterEnhanced(ctx, x, y, w, h, val, color, vertical) {
    if (vertical === undefined) vertical = true;
    var r = Math.min(3 * S, w / 2, h / 2);
    // Background with rounded rect
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = METER_BG;
    ctx.fill();
    ctx.strokeStyle = METER_STROKE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    var fill = Math.max(0, Math.min(1, Math.abs(val)));
    if (fill < 0.005) {
        return; // nothing to draw
    }

    ctx.save();
    // Clip to rounded rect
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1));
    ctx.clip();

    if (vertical) {
        var fh = (h - 2) * fill;
        var grad = ctx.createLinearGradient(x, y + h, x, y);
        grad.addColorStop(0, GREEN);
        grad.addColorStop(0.6, YELLOW);
        grad.addColorStop(0.9, color);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + h - 1 - fh, w - 2, fh);
        // Segment lines
        var segHeight = (h - 2) / 12;
        ctx.strokeStyle = METER_BG;
        ctx.lineWidth = 1;
        for (var s = 1; s < 12; s++) {
            var sy = y + h - 1 - s * segHeight;
            ctx.beginPath(); ctx.moveTo(x + 1, sy); ctx.lineTo(x + w - 1, sy); ctx.stroke();
        }
        // Glass highlight
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 1, y + h - 1 - fh, Math.ceil(w / 3), fh);
    } else {
        var fw = (w - 2) * fill;
        var hGrad = ctx.createLinearGradient(x, 0, x + w, 0);
        hGrad.addColorStop(0, GREEN);
        hGrad.addColorStop(0.6, YELLOW);
        hGrad.addColorStop(0.9, color);
        ctx.fillStyle = hGrad;
        ctx.fillRect(x + 1, y + 1, fw, h - 2);
        // Segment lines
        var segW = (w - 2) / 12;
        ctx.strokeStyle = METER_BG;
        ctx.lineWidth = 1;
        for (var s2 = 1; s2 < 12; s2++) {
            var sx = x + 1 + s2 * segW;
            ctx.beginPath(); ctx.moveTo(sx, y + 1); ctx.lineTo(sx, y + h - 1); ctx.stroke();
        }
        // Glass highlight
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 1, y + 1, fw, Math.ceil(h / 3));
    }
    ctx.restore();
}

// ═══════════════════ EFFECT DRAW FUNCTIONS ═════════════════════

// ─── 1. Compressor ────────────────────────────────────────────
function drawCompressor(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var threshold = p.threshold != null ? p.threshold : -24;
    var ratio = p.ratio != null ? p.ratio : 4;
    var knee = p.knee != null ? p.knee : 10;
    var reduction = fx._compressor ? fx._compressor.reduction : 0;

    var cw = W * 0.76;
    var mx = cw + 14 * S;
    var mw = W - mx - 14 * S;
    var pad = 12 * S;

    drawGridEnhanced(ctx, 4, 4);
    var dbMin = -60, dbMax = 0;
    var dbToX = function(db) { return pad + ((db - dbMin) / (dbMax - dbMin)) * (cw - pad * 2); };
    var dbToY = function(db) { return H - pad - ((db - dbMin) / (dbMax - dbMin)) * (H - pad * 2); };

    dashed(ctx, dbToX(dbMin), dbToY(dbMin), dbToX(dbMax), dbToY(dbMax), GRID_LT, [6, 6]);
    dashed(ctx, dbToX(threshold), pad, dbToX(threshold), H - pad, ac + '44', [6, 6]);

    var pts = [];
    for (var db = dbMin; db <= dbMax; db += 0.5) {
        var out;
        if (knee > 0) {
            var hk = knee / 2;
            if (db < threshold - hk) { out = db; }
            else if (db > threshold + hk) { out = threshold + (db - threshold) / ratio; }
            else { var xk = db - threshold + hk; out = db + ((1 / ratio - 1) * xk * xk) / (2 * knee); }
        } else {
            out = db < threshold ? db : threshold + (db - threshold) / ratio;
        }
        pts.push([dbToX(db), dbToY(out)]);
    }
    drawGlowLine(ctx, pts, ac, 3 * S);

    drawLabel(ctx, threshold.toFixed(0) + 'dB', dbToX(threshold), pad + 12 * S, ac + 'aa', 11 * S);
    drawLabel(ctx, ratio.toFixed(1) + ':1', cw - 40 * S, H - pad - 8 * S, ac, 12 * S);

    var grDb = Math.abs(reduction);
    var grNorm = Math.min(grDb / 30, 1);
    drawMeterEnhanced(ctx, mx, pad, mw, H - pad * 2 - 22 * S, grNorm, ac);
    drawLabel(ctx, 'GR', mx + mw / 2, H - 22 * S, TXT, 11 * S);
    drawLabel(ctx, '-' + grDb.toFixed(1), mx + mw / 2, H - 10 * S, ac, 11 * S);
    drawVignette(ctx);
}

// ─── 2. Glue Compressor ──────────────────────────────────────
function drawGlueCompressor(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var threshold = p.threshold != null ? p.threshold : -20;
    var ratio = p.ratio != null ? p.ratio : 2;
    var reduction = fx._compressor ? fx._compressor.reduction : 0;

    var vuW = W * 0.6;
    var pad = 12 * S;
    var cx = vuW / 2;
    var cy = H - 26 * S;
    var radius = Math.min(vuW, H) * 0.5;

    drawGridEnhanced(ctx, 4, 6);

    // VU arc with gradient
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 0, false);
    ctx.strokeStyle = GRID_LT;
    ctx.lineWidth = 3 * S;
    ctx.stroke();

    for (var i = 0; i <= 10; i++) {
        var angle = Math.PI + (i / 10) * Math.PI;
        var cos = Math.cos(angle), sin = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(cx + cos * (radius - 12 * S), cy + sin * (radius - 12 * S));
        ctx.lineTo(cx + cos * (radius - 3 * S), cy + sin * (radius - 3 * S));
        ctx.strokeStyle = i >= 7 ? RED_WARN : TXT;
        ctx.lineWidth = i % 5 === 0 ? 2.5 * S : 1.5;
        ctx.stroke();
    }

    // Tick labels
    var tickLabels = ['-20', '-10', '-3', '0', '+3'];
    var tickPositions = [0, 0.25, 0.425, 0.5, 0.575];
    for (var ti = 0; ti < tickLabels.length; ti++) {
        var ta = Math.PI + tickPositions[ti] * Math.PI;
        drawLabel(ctx, tickLabels[ti], cx + Math.cos(ta) * (radius + 10 * S), cy + Math.sin(ta) * (radius + 10 * S), TXT_DIM, 8 * S);
    }

    var grDb = Math.abs(reduction);
    var grNorm = Math.min(grDb / 20, 1);
    var needleAngle = Math.PI + grNorm * Math.PI;
    // Needle with metallic gradient
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (radius - 16 * S), cy + Math.sin(needleAngle) * (radius - 16 * S));
    ctx.strokeStyle = ac;
    ctx.lineWidth = 2.5 * S;
    ctx.stroke();

    // Needle pivot
    ctx.beginPath();
    ctx.arc(cx, cy, 5 * S, 0, Math.PI * 2);
    ctx.fillStyle = ac;
    ctx.fill();

    drawLabel(ctx, 'GAIN REDUCTION', cx, 16 * S, TXT, 11 * S);
    drawLabel(ctx, '-' + grDb.toFixed(1) + ' dB', cx, 32 * S, ac, 14 * S);

    // Mini transfer curve on right
    var curveX = vuW + 14 * S, curveW = W - vuW - 28 * S;
    var dbMin = -60, dbMax = 0;
    var dbToXc = function(db) { return curveX + ((db - dbMin) / (dbMax - dbMin)) * curveW; };
    var dbToYc = function(db) { return pad + (H - pad * 2) - ((db - dbMin) / (dbMax - dbMin)) * (H - pad * 2); };

    dashed(ctx, dbToXc(dbMin), dbToYc(dbMin), dbToXc(dbMax), dbToYc(dbMax), GRID_LT, [6, 6]);
    var pts = [];
    for (var db = dbMin; db <= dbMax; db += 1) {
        var out = db < threshold ? db : threshold + (db - threshold) / ratio;
        pts.push([dbToXc(db), dbToYc(out)]);
    }
    drawGlowLine(ctx, pts, ac, 2 * S);
    drawLabel(ctx, ratio + ':1', curveX + curveW / 2, H - 8 * S, ac, 11 * S);
    drawVignette(ctx);
}

// ─── 3. Limiter ──────────────────────────────────────────────
function drawLimiter(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var ceiling = p.ceiling != null ? p.ceiling : 0;
    var reduction = fx._compressor ? fx._compressor.reduction : 0;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 6);

    var ceilY = pad + 12 * S;
    dashed(ctx, pad, ceilY, W - pad, ceilY, ac + '44', [6, 6]);
    drawLabel(ctx, 'CEILING: ' + ceiling.toFixed(1) + ' dB', W / 2, ceilY - 8 * S, ac, 11 * S);

    // Ceiling LED
    var isLimiting = Math.abs(reduction) > 0.1;
    drawLED(ctx, W - pad - 10 * S, ceilY, 5 * S, isLimiting, ac);

    var grDb = Math.abs(reduction);
    var grNorm = Math.min(grDb / 20, 1);
    var barY = 44 * S, barH = 28 * S;
    drawMeterEnhanced(ctx, pad, barY, W - pad * 2, barH, grNorm, ac, false);
    drawLabel(ctx, 'GR: -' + grDb.toFixed(1) + ' dB', W / 2, barY + barH / 2, '#fff', 12 * S);

    var mH = H - barY - barH - 50 * S;
    var mY = barY + barH + 26 * S;
    var mW = 26 * S;
    var leftX = W / 2 - 58 * S;
    var rightX = W / 2 + 32 * S;

    var inDb = fx.getInputLevel ? fx.getInputLevel() : -20;
    var outDb = fx.getOutputLevel ? fx.getOutputLevel() : -20;
    var peakIn = Math.max(0, Math.min(1, (inDb + 60) / 60));
    var peakOut = Math.max(0, Math.min(1, (outDb + 60) / 60));

    drawMeterEnhanced(ctx, leftX, mY, mW, mH, peakIn, YELLOW);
    drawLabel(ctx, 'IN', leftX + mW / 2, mY + mH + 12 * S, TXT, 10 * S);
    drawMeterEnhanced(ctx, rightX, mY, mW, mH, peakOut, GREEN);
    drawLabel(ctx, 'OUT', rightX + mW / 2, mY + mH + 12 * S, TXT, 10 * S);

    // dB scale ticks
    ctx.font = 'bold ' + (10 * S) + 'px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    var dbMarks = [0, -12, -24, -48];
    for (var d = 0; d < dbMarks.length; d++) {
        var dbVal2 = dbMarks[d];
        var tickN = (dbVal2 + 60) / 60;
        var tickY = mY + mH * (1 - tickN);
        var dbStr = dbVal2 === 0 ? ' 0' : String(dbVal2);
        ctx.textAlign = 'right';
        ctx.fillStyle = TXT;
        ctx.fillText(dbStr, leftX - 6 * S, tickY);
        ctx.textAlign = 'left';
        ctx.fillText(dbStr, rightX + mW + 6 * S, tickY);
    }

    var inDbDisplay = peakIn > 0.001 ? inDb.toFixed(1) : '-inf';
    var outDbDisplay = peakOut > 0.001 ? outDb.toFixed(1) : '-inf';
    drawLabel(ctx, inDbDisplay + ' dB', leftX + mW / 2, mY - 8 * S, YELLOW, 9 * S);
    drawLabel(ctx, outDbDisplay + ' dB', rightX + mW / 2, mY - 8 * S, GREEN, 9 * S);
    drawVignette(ctx);
}

// ─── 4. Gate ─────────────────────────────────────────────────
function drawGate(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var threshold = p.threshold != null ? p.threshold : -40;
    var gateOpen = fx._gateOpen || false;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 6);

    var inputLevel = -60;
    if (fx._analyser) {
        try {
            var data = new Float32Array(fx._analyser.fftSize);
            fx._analyser.getFloatTimeDomainData(data);
            var sum = 0;
            for (var i = 0; i < data.length; i++) sum += data[i] * data[i];
            var rms = Math.sqrt(sum / data.length);
            inputLevel = 20 * Math.log10(Math.max(rms, 0.00001));
        } catch (e) { /* not connected */ }
    }

    var dbMin = -60, dbMax = 0;
    var dbToY = function(db) { return pad + (1 - (db - dbMin) / (dbMax - dbMin)) * (H - pad * 2); };

    var mX = pad, mW = 42 * S;
    var levelNorm = Math.max(0, (inputLevel - dbMin) / (dbMax - dbMin));
    drawMeterEnhanced(ctx, mX, pad, mW, H - pad * 2, levelNorm, ac);
    drawLabel(ctx, 'IN', mX + mW / 2, H - 4 * S, TXT, 11 * S);

    var threshY = dbToY(threshold);
    ctx.strokeStyle = ac;
    ctx.lineWidth = 2 * S;
    ctx.setLineDash([8 * S, 4 * S]);
    ctx.beginPath();
    ctx.moveTo(mX + mW + 14 * S, threshY);
    ctx.lineTo(W - 86 * S, threshY);
    ctx.stroke();
    ctx.setLineDash([]);
    drawLabel(ctx, 'THRESH: ' + threshold.toFixed(0) + ' dB', (mX + mW + 14 * S + W - 86 * S) / 2, threshY - 14 * S, ac, 11 * S);

    var ledX = W - 50 * S;
    drawLED(ctx, ledX, H / 2 - 14 * S, 10 * S, gateOpen, GREEN);
    drawLabel(ctx, gateOpen ? 'OPEN' : 'CLOSED', ledX, H / 2 + 14 * S, gateOpen ? GREEN : RED_WARN, 12 * S);

    drawLabel(ctx, 'ATK ' + ((p.attack || 0.001) * 1000).toFixed(0) + 'ms', W - 50 * S, H - 34 * S, TXT, 10 * S);
    drawLabel(ctx, 'REL ' + ((p.release || 0.05) * 1000).toFixed(0) + 'ms', W - 50 * S, H - 18 * S, TXT, 10 * S);
    drawVignette(ctx);
}

// ─── 5. Sidechain Compressor ─────────────────────────────────
function drawSidechain(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var isDucking = fx._isDucking || false;
    var duckAmount = p.depth != null ? p.depth : 0.8;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 6);

    var keyLevel = 0;
    if (fx._keyAnalyser) {
        try {
            var data = new Float32Array(fx._keyAnalyser.fftSize);
            fx._keyAnalyser.getFloatTimeDomainData(data);
            var sum = 0;
            for (var i = 0; i < data.length; i++) sum += data[i] * data[i];
            keyLevel = Math.sqrt(sum / data.length);
        } catch (e) {}
    }

    var duckNorm = isDucking ? duckAmount : 0;
    drawMeterEnhanced(ctx, pad, pad, 34 * S, H - pad * 2, Math.min(keyLevel * 5, 1), YELLOW);
    drawLabel(ctx, 'KEY', pad + 17 * S, H - 4 * S, TXT, 11 * S);

    drawMeterEnhanced(ctx, pad + 48 * S, pad, 34 * S, H - pad * 2, duckNorm, ac);
    drawLabel(ctx, 'DUCK', pad + 65 * S, H - 4 * S, TXT, 11 * S);

    // Ducking waveform with enhanced glow
    var waveX = pad + 104 * S, waveW = W - waveX - 72 * S, mid = H / 2;
    var pts = [];
    for (var j = 0; j < waveW; j++) {
        var x = waveX + j;
        var phase = (j / waveW) * Math.PI * 4 + t * 2;
        var env = isDucking ? Math.max(0.1, 1 - duckAmount * Math.exp(-j / (waveW * 0.3))) : 1;
        pts.push([x, mid + Math.sin(phase) * 42 * S * env]);
    }
    drawGlowLine(ctx, pts, ac, 2 * S);

    var ledX = W - 36 * S;
    drawLED(ctx, ledX, H / 2 - 14 * S, 10 * S, isDucking, ac);
    drawLabel(ctx, isDucking ? 'DUCK' : 'PASS', ledX, H / 2 + 14 * S, isDucking ? ac : GREEN, 11 * S);
    drawVignette(ctx);
}

// ─── 6. EQ Eight ─────────────────────────────────────────────
function drawEQEight(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var bands = p.bands || [];
    var pad = 12 * S;

    var plotX = pad + 32 * S, plotW = W - plotX - pad;
    var plotY = pad, plotH = H - pad * 2 - 14 * S;
    var fMin = 20, fMax = 20000, dbRange = 18;

    var freqToX = function(f) { return plotX + (Math.log10(f / fMin) / Math.log10(fMax / fMin)) * plotW; };
    var dbToY = function(db) { return plotY + plotH / 2 - (db / dbRange) * (plotH / 2); };

    // Subtle animated spectrum analyzer behind the curve
    if (t) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        var specBins = 64;
        var binW = plotW / specBins;
        for (var b = 0; b < specBins; b++) {
            var bFreq = fMin * Math.pow(fMax / fMin, b / specBins);
            var bx = freqToX(bFreq);
            // Simulated spectrum with noise
            var specH = (0.3 + 0.4 * Math.sin(b * 0.3 + t * 1.5) + 0.3 * Math.sin(b * 0.7 + t * 2.3)) * plotH * 0.5;
            specH *= Math.max(0.1, 1 - b / specBins); // roll off at high freq
            var specGrad = ctx.createLinearGradient(bx, plotY + plotH, bx, plotY + plotH - specH);
            specGrad.addColorStop(0, ac + '44');
            specGrad.addColorStop(0.5, ac + '22');
            specGrad.addColorStop(1, ac + '08');
            ctx.fillStyle = specGrad;
            ctx.fillRect(bx, plotY + plotH - specH, binW - 1, specH);
        }
        ctx.restore();
    }

    // Frequency grid lines with labels
    var freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    freqs.forEach(function(f) {
        var x = freqToX(f);
        ctx.strokeStyle = GRID;
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x, plotY); ctx.lineTo(x, plotY + plotH); ctx.stroke();
        var label = f >= 1000 ? (f / 1000) + 'k' : '' + f;
        drawLabel(ctx, label, x, plotY + plotH + 8 * S, TXT_DIM, 9 * S);
    });

    // dB grid lines
    [-12, -6, 0, 6, 12].forEach(function(db) {
        var y = dbToY(db);
        ctx.strokeStyle = db === 0 ? GRID_LT : GRID;
        ctx.lineWidth = db === 0 ? 1.5 : 0.5;
        ctx.beginPath(); ctx.moveTo(plotX, y); ctx.lineTo(plotX + plotW, y); ctx.stroke();
    });
    // Sub-grid dB lines
    [-15, -9, -3, 3, 9, 15].forEach(function(db) {
        var y = dbToY(db);
        ctx.strokeStyle = GRID_SUB;
        ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(plotX, y); ctx.lineTo(plotX + plotW, y); ctx.stroke();
    });
    drawLabel(ctx, '+12', plotX - 20 * S, dbToY(12), TXT_DIM, 9 * S);
    drawLabel(ctx, '+6', plotX - 20 * S, dbToY(6), TXT_DIM, 8 * S);
    drawLabel(ctx, '0dB', plotX - 20 * S, dbToY(0), TXT, 10 * S);
    drawLabel(ctx, '-6', plotX - 20 * S, dbToY(-6), TXT_DIM, 8 * S);
    drawLabel(ctx, '-12', plotX - 20 * S, dbToY(-12), TXT_DIM, 9 * S);

    // Frequency response curve with enhanced glow
    var numP = 300, pts = [];
    for (var i = 0; i < numP; i++) {
        var logF = Math.log10(fMin) + (i / (numP - 1)) * Math.log10(fMax / fMin);
        var freq = Math.pow(10, logF);
        var totalDb = 0;
        bands.forEach(function(band) {
            if (!band.enabled) return;
            var f0 = band.frequency, gain = band.gain, Q = band.Q || 1, type = band.type;
            var logRatio = Math.log2(freq / f0);
            if (type === 'peaking') {
                var bw = 0.5 / Q;
                totalDb += gain * Math.exp(-0.5 * Math.pow(logRatio / bw, 2));
            } else if (type === 'lowshelf') {
                totalDb += gain * 0.5 * (1 - Math.tanh(logRatio * Q * 2));
            } else if (type === 'highshelf') {
                totalDb += gain * 0.5 * (1 + Math.tanh(logRatio * Q * 2));
            } else if (type === 'highpass') {
                if (freq < f0) totalDb += -12 * Math.log2(f0 / freq);
            } else if (type === 'lowpass') {
                if (freq > f0) totalDb += -12 * Math.log2(freq / f0);
            }
        });
        totalDb = Math.max(-dbRange, Math.min(dbRange, totalDb));
        pts.push([freqToX(freq), dbToY(totalDb)]);
    }
    drawFilledGlowEnhanced(ctx, pts, ac);

    // Band dots are drawn by InteractionConfigs overlay for interactivity
    drawVignette(ctx);
}

// ─── 7. Saturation ───────────────────────────────────────────
function drawSaturation(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var drive = p.drive != null ? p.drive : 5;
    var mode = p.mode || 'analog';
    var pad = 16 * S;

    drawGridEnhanced(ctx, 4, 4);
    var cW = W - pad * 2, cH = H - pad * 2;
    var toX = function(v) { return pad + ((v + 1) / 2) * cW; };
    var toY = function(v) { return pad + (1 - (v + 1) / 2) * cH; };

    dashed(ctx, toX(-1), toY(-1), toX(1), toY(1), GRID_LT, [6, 6]);
    dashed(ctx, toX(0), pad, toX(0), H - pad, GRID + '88', [3, 6]);
    dashed(ctx, pad, toY(0), W - pad, toY(0), GRID + '88', [3, 6]);

    // Harmonic overtone indicators
    var driveAmt = 1 + drive * 2;
    ctx.save();
    ctx.globalAlpha = 0.08;
    for (var h = 2; h <= 6; h++) {
        var hx = toX(1 / h);
        ctx.fillStyle = ac;
        ctx.fillRect(hx - 1, pad, 2, cH * 0.3 * (drive / 10) / h);
    }
    ctx.restore();

    var pts = [];
    for (var i = 0; i <= 100; i++) {
        var input = (i / 50) - 1;
        var output;
        if (mode === 'digital') { output = Math.max(-1, Math.min(1, input * driveAmt)); }
        else if (mode === 'tape') { var xv = input * driveAmt; output = xv / (1 + Math.abs(xv)); }
        else { output = Math.tanh(input * driveAmt) / Math.tanh(driveAmt); }
        pts.push([toX(input), toY(output)]);
    }
    drawGlowLine(ctx, pts, ac, 3 * S);

    drawLED(ctx, W - 56 * S, pad + 12 * S, 5 * S, true, ac);
    drawLabel(ctx, mode.toUpperCase(), W - 40 * S, pad + 12 * S, ac, 12 * S);
    drawLabel(ctx, 'DRIVE: ' + drive.toFixed(1), W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

// ─── 8. Distortion ───────────────────────────────────────────
function drawDistortion(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var gain = p.gain != null ? p.gain : 10;
    var mode = p.mode || 'hardClip';
    var pad = 16 * S;

    drawGridEnhanced(ctx, 4, 4);
    var cW = W - pad * 2, cH = H - pad * 2;
    var toX = function(v) { return pad + ((v + 1) / 2) * cW; };
    var toY = function(v) { return pad + (1 - (v + 1) / 2) * cH; };

    dashed(ctx, toX(-1), toY(-1), toX(1), toY(1), GRID_LT, [6, 6]);
    dashed(ctx, toX(0), pad, toX(0), H - pad, GRID + '88', [3, 6]);
    dashed(ctx, pad, toY(0), W - pad, toY(0), GRID + '88', [3, 6]);

    var pts = [], drv = 1 + gain * 0.5;
    for (var i = 0; i <= 100; i++) {
        var input = (i / 50) - 1;
        var x = input * drv, output;
        switch (mode) {
            case 'softClip': output = Math.tanh(x); break;
            case 'foldback': output = Math.sin(x * Math.PI / 2); break;
            case 'bitCrush':
                var bits = Math.max(2, 16 - gain);
                var steps = Math.pow(2, bits);
                output = Math.round(Math.max(-1, Math.min(1, x)) * steps) / steps;
                break;
            default: output = Math.max(-1, Math.min(1, x)); break;
        }
        pts.push([toX(input), toY(output)]);
    }
    drawGlowLine(ctx, pts, ac, 3 * S);

    drawLED(ctx, W - 62 * S, pad + 12 * S, 5 * S, true, ac);
    drawLabel(ctx, mode.toUpperCase(), W - 44 * S, pad + 12 * S, ac, 12 * S);
    drawLabel(ctx, 'GAIN: ' + gain.toFixed(1), W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

// ─── 9. Reverb ───────────────────────────────────────────────
function drawReverb(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var preDelay = p.preDelay != null ? p.preDelay : 0.02;
    var roomSize = p.roomSize != null ? p.roomSize : 0.7;
    var decay = p.decay != null ? p.decay : 2.5;
    var damping = p.damping != null ? p.damping : 3000;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 8);
    var tMax = Math.max(decay * 1.5, 3);
    var toX = function(time) { return pad + (time / tMax) * (W - pad * 2); };
    var toY = function(amp) { return H - pad - amp * (H - pad * 2); };

    var pdX = toX(preDelay);
    // Pre-delay zone with gradient
    try {
        var pdGrad = ctx.createLinearGradient(pad, 0, pdX, 0);
        pdGrad.addColorStop(0, ac + '0a');
        pdGrad.addColorStop(1, ac + '18');
        ctx.fillStyle = pdGrad;
    } catch (e) { ctx.fillStyle = ac + '0a'; }
    ctx.fillRect(pad, pad, pdX - pad, H - pad * 2);
    dashed(ctx, pdX, pad, pdX, H - pad, ac + '44', [6, 6]);

    // Early reflections with gradient fill
    var erEnd = preDelay + 0.05 * roomSize;
    for (var i = 0; i < 10; i++) {
        var time = preDelay + (i / 10) * (erEnd - preDelay);
        var amp = (0.8 - i * 0.05) * roomSize;
        var x = toX(time);
        var h = amp * (H - pad * 2) * 0.5;
        var erGrad = ctx.createLinearGradient(0, toY(0) - h, 0, toY(0));
        erGrad.addColorStop(0, ac + '88');
        erGrad.addColorStop(1, ac + '22');
        ctx.fillStyle = erGrad;
        ctx.fillRect(x - 1.5 * S, toY(0) - h, 3 * S, h);
    }

    // Decay tail with enhanced gradient fill
    var pts = [];
    for (var j = 0; j < 200; j++) {
        var tme = erEnd + (j / 200) * (tMax - erEnd);
        var elapsed = tme - erEnd;
        var dampF = 1 - (1 - damping / 20000) * 0.3;
        var a = 0.7 * Math.exp(-elapsed / (decay * 0.5 * dampF)) * roomSize;
        pts.push([toX(tme), toY(a)]);
    }
    drawFilledGlowEnhanced(ctx, pts, ac);

    drawLabel(ctx, 'PRE ' + (preDelay * 1000).toFixed(0) + 'ms', pdX + 6 * S, pad + 12 * S, ac, 10 * S, 'left');
    drawLabel(ctx, 'DECAY ' + decay.toFixed(1) + 's', W / 2, H - 6 * S, TXT, 11 * S);
    drawLabel(ctx, 'SIZE ' + (roomSize * 100).toFixed(0) + '%', W - 56 * S, pad + 12 * S, TXT, 10 * S);
    drawLabel(ctx, 'DAMP ' + (damping / 1000).toFixed(1) + 'k', W - 56 * S, pad + 26 * S, TXT_DIM, 9 * S);
    drawVignette(ctx);
}

// ─── 10. Delay (Ping-Pong) ──────────────────────────────────
function drawDelay(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var delayTime = p.delayTime != null ? p.delayTime : 0.375;
    var feedback = p.feedback != null ? p.feedback : 0.4;
    var pingPong = p.pingPong !== false;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 8);
    var mid = H / 2;
    var numTaps = 8;
    var barW = (W - pad * 2) / (numTaps + 1);

    drawLabel(ctx, 'L', pad + 6 * S, pad + 12 * S, BLUE_L, 11 * S, 'left');
    drawLabel(ctx, 'R', pad + 6 * S, H - pad - 6 * S, RED_R, 11 * S, 'left');
    dashed(ctx, pad, mid, W - pad, mid, GRID_LT, [3, 6]);

    // Decay envelope curve connecting tap peaks
    var envPts = [];
    for (var i = 0; i < numTaps; i++) {
        var x = pad + barW * (i + 0.5) + barW * 0.3;
        var amplitude = Math.pow(feedback, i);
        if (amplitude < 0.02) break;

        var barH = amplitude * (mid - pad - 8 * S);
        var isLeft = pingPong ? (i % 2 === 0) : true;
        var isRight = pingPong ? (i % 2 === 1) : true;
        var a = Math.min(255, Math.round(amplitude * 220));

        // Gradient-filled bars
        if (isLeft) {
            var lGrad = ctx.createLinearGradient(0, mid - barH - 2, 0, mid);
            lGrad.addColorStop(0, alphaColor(ac, a));
            lGrad.addColorStop(1, alphaColor(ac, Math.round(a * 0.3)));
            ctx.fillStyle = lGrad;
            ctx.fillRect(x - barW * 0.1, mid - barH - 2, barW * 0.6, barH);
        }
        if (isRight) {
            var rGrad = ctx.createLinearGradient(0, mid, 0, mid + barH + 2);
            rGrad.addColorStop(0, alphaColor(ac, Math.round(a * 0.3)));
            rGrad.addColorStop(1, alphaColor(ac, a));
            ctx.fillStyle = rGrad;
            ctx.fillRect(x - barW * 0.1, mid + 2, barW * 0.6, barH);
        }

        envPts.push([x, mid - barH - 2]);

        if (i < 4) {
            var tms = (delayTime * (i + 1) * 1000).toFixed(0);
            drawLabel(ctx, tms, x, pad + 12 * S, TXT_DIM, 9 * S);
        }
    }
    // Decay envelope line
    if (envPts.length > 1) drawGlowLine(ctx, envPts, ac + '55', 1.5);

    drawLED(ctx, W - 64 * S, pad + 10 * S, 5 * S, pingPong, ac);
    drawLabel(ctx, pingPong ? 'PING-PONG' : 'STEREO', W - 44 * S, pad + 10 * S, ac, 11 * S);
    drawLabel(ctx, (delayTime * 1000).toFixed(0) + 'ms  FB ' + (feedback * 100).toFixed(0) + '%', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

// ─── 11. Echo ────────────────────────────────────────────────
function drawEcho(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var time1 = p.time1 != null ? p.time1 : 0.25;
    var time2 = p.time2 != null ? p.time2 : 0.5;
    var time3 = p.time3 != null ? p.time3 : 0.75;
    var feedback = p.feedback != null ? p.feedback : 0.3;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 6);
    var mid = H / 2;
    var times = [0, time1, time2, time3];
    var maxTime = Math.max(time1, time2, time3) * 2;
    dashed(ctx, pad, mid, W - pad, mid, GRID_LT, [3, 6]);

    times.forEach(function(time, idx) {
        var x = pad + (time / maxTime) * (W - pad * 2);
        var amplitude = idx === 0 ? 1.0 : 0.7 * Math.pow(feedback, idx - 1);
        var barH = amplitude * (mid - pad - 12 * S);
        var a = Math.min(255, Math.round(amplitude * 220));

        // Gradient-filled bars
        var bGrad = ctx.createLinearGradient(0, mid - barH, 0, mid);
        bGrad.addColorStop(0, idx === 0 ? ac : alphaColor(ac, a));
        bGrad.addColorStop(1, idx === 0 ? ac + '44' : alphaColor(ac, Math.round(a * 0.3)));
        ctx.fillStyle = bGrad;
        ctx.fillRect(x - 5 * S, mid - barH, 10 * S, barH);
        var bGrad2 = ctx.createLinearGradient(0, mid, 0, mid + barH);
        bGrad2.addColorStop(0, idx === 0 ? ac + '44' : alphaColor(ac, Math.round(a * 0.3)));
        bGrad2.addColorStop(1, idx === 0 ? ac : alphaColor(ac, a));
        ctx.fillStyle = bGrad2;
        ctx.fillRect(x - 5 * S, mid, 10 * S, barH);

        if (idx > 0) {
            ctx.beginPath(); ctx.arc(x, mid, 4 * S, 0, Math.PI * 2);
            ctx.fillStyle = ac; ctx.fill();
            drawLabel(ctx, 'T' + idx + ': ' + (time * 1000).toFixed(0) + 'ms', x, pad + 12 * S, ac, 10 * S);
        }

        // Feedback echoes
        for (var fb = 1; fb <= 3; fb++) {
            var fbAmp = amplitude * Math.pow(feedback, fb);
            if (fbAmp < 0.05) break;
            var fbX = pad + ((time + time * fb * 0.4) / maxTime) * (W - pad * 2);
            if (fbX > W - pad) break;
            var fbH = fbAmp * (mid - pad - 12 * S);
            ctx.fillStyle = alphaColor(ac, Math.round(fbAmp * 100));
            ctx.fillRect(fbX - 3 * S, mid - fbH, 6 * S, fbH);
            ctx.fillRect(fbX - 3 * S, mid, 6 * S, fbH);
        }
    });

    drawLabel(ctx, 'FB ' + (feedback * 100).toFixed(0) + '%', W - 50 * S, H - 8 * S, TXT, 11 * S);
    drawVignette(ctx);
}

// ─── 12. Chorus ──────────────────────────────────────────────
function drawChorus(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var rate = p.rate != null ? p.rate : 1.5;
    var depth = p.depth != null ? p.depth : 0.7;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 8);
    var mid = H / 2;
    var amp = depth * (mid - pad - 14 * S);

    // Multiple detuned voice copies (faint)
    for (var v = 1; v <= 3; v++) {
        var voicePts = [];
        var detune = v * 0.15;
        for (var vi = 0; vi < W - pad * 2; vi++) {
            var vx = pad + vi;
            var vphase = (vi / (W - pad * 2)) * Math.PI * 4 + t * rate * Math.PI * 2 + detune * Math.PI;
            voicePts.push([vx, mid + Math.sin(vphase) * amp * (1 - v * 0.15)]);
        }
        ctx.save();
        ctx.globalAlpha = 0.12 / v;
        ctx.strokeStyle = ac;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(voicePts[0][0], voicePts[0][1]);
        for (var vj = 1; vj < voicePts.length; vj++) ctx.lineTo(voicePts[vj][0], voicePts[vj][1]);
        ctx.stroke();
        ctx.restore();
    }

    // Main wave
    var pts = [];
    for (var i = 0; i < W - pad * 2; i++) {
        var x = pad + i;
        var phase = (i / (W - pad * 2)) * Math.PI * 4 + t * rate * Math.PI * 2;
        pts.push([x, mid + Math.sin(phase) * amp]);
    }
    drawFilledGlowEnhanced(ctx, pts, ac);
    dashed(ctx, pad, mid, W - pad, mid, GRID_LT, [3, 6]);

    // Depth bracket
    var arrowX = W - 40 * S;
    ctx.strokeStyle = ac + '66';
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    ctx.moveTo(arrowX, mid - amp); ctx.lineTo(arrowX - 5 * S, mid - amp + 8 * S);
    ctx.moveTo(arrowX, mid - amp); ctx.lineTo(arrowX + 5 * S, mid - amp + 8 * S);
    ctx.moveTo(arrowX, mid - amp); ctx.lineTo(arrowX, mid + amp);
    ctx.moveTo(arrowX, mid + amp); ctx.lineTo(arrowX - 5 * S, mid + amp - 8 * S);
    ctx.moveTo(arrowX, mid + amp); ctx.lineTo(arrowX + 5 * S, mid + amp - 8 * S);
    ctx.stroke();

    drawLabel(ctx, 'RATE ' + rate.toFixed(1) + 'Hz', pad + 56 * S, pad + 12 * S, ac, 11 * S, 'left');
    drawLabel(ctx, 'DEPTH ' + (depth * 100).toFixed(0) + '%', pad + 56 * S, H - 8 * S, TXT, 11 * S, 'left');
    drawVignette(ctx);
}

// ─── 13. Phaser ──────────────────────────────────────────────
function drawPhaser(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var rate = p.rate != null ? p.rate : 0.5;
    var depth = p.depth != null ? p.depth : 0.7;
    var centerFreq = p.centerFreq != null ? p.centerFreq : 1000;
    var feedback = p.feedback != null ? p.feedback : 0.5;
    var stages = p.stages != null ? p.stages : 4;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 8);
    var fMin = 100, fMax = 10000;
    var toX = function(f) { return pad + (Math.log10(f / fMin) / Math.log10(fMax / fMin)) * (W - pad * 2); };

    var phase = t * rate * Math.PI * 2;
    var sweep = Math.sin(phase) * depth;

    var pts = [];
    for (var i = 0; i < 300; i++) {
        var logF = Math.log10(fMin) + (i / 299) * Math.log10(fMax / fMin);
        var freq = Math.pow(10, logF);
        var magnitude = 1.0;
        for (var s = 0; s < stages; s++) {
            var notchFreq = centerFreq * Math.pow(2, sweep + s * 0.5);
            var logRatio = Math.log2(freq / notchFreq);
            var nw = 0.15 + feedback * 0.2;
            var nd = 0.5 + feedback * 0.5;
            magnitude *= 1 - nd * Math.exp(-0.5 * Math.pow(logRatio / nw, 2));
        }
        pts.push([toX(freq), pad + (1 - magnitude) * (H - pad * 2)]);
    }
    drawFilledGlowEnhanced(ctx, pts, ac);

    var sweepFreq = centerFreq * Math.pow(2, sweep);
    dashed(ctx, toX(sweepFreq), pad, toX(sweepFreq), H - pad, ac + '33', [4 * S, 4 * S]);

    // Stage indicator dots
    for (var si = 0; si < stages; si++) {
        var stageX = pad + 20 * S + si * 14 * S;
        drawLED(ctx, stageX, H - 20 * S, 4 * S, true, ac);
    }

    [200, 500, 1000, 2000, 5000].forEach(function(f) {
        drawLabel(ctx, f >= 1000 ? (f / 1000) + 'k' : '' + f, toX(f), H - 6 * S, TXT_DIM, 9 * S);
    });
    drawLabel(ctx, 'RATE ' + rate.toFixed(1) + 'Hz', W - 70 * S, pad + 12 * S, ac, 11 * S);
    drawLabel(ctx, stages + ' STAGES', pad + 44 * S, pad + 12 * S, TXT, 11 * S, 'left');
    drawVignette(ctx);
}

// ─── 14. Stereo Widener ─────────────────────────────────────
function drawStereoWidener(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var width = p.width != null ? p.width : 1.2;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 6);
    var midX = W / 2;
    var maxAngle = Math.PI * 0.4;
    var fieldAngle = maxAngle * Math.min(width / 2, 1);
    var radius = H * 0.4;
    var baseY = H * 0.72;

    // Outer arc
    ctx.beginPath();
    ctx.arc(midX, baseY, radius, Math.PI + Math.PI / 2 - maxAngle, Math.PI + Math.PI / 2 + maxAngle);
    ctx.strokeStyle = GRID_LT;
    ctx.lineWidth = 3 * S;
    ctx.stroke();

    // Active cone with gradient fill
    ctx.beginPath();
    ctx.moveTo(midX, baseY);
    ctx.arc(midX, baseY, radius, Math.PI + Math.PI / 2 - fieldAngle, Math.PI + Math.PI / 2 + fieldAngle);
    ctx.closePath();
    try {
        var coneGrad = ctx.createRadialGradient(midX, baseY, 0, midX, baseY, radius);
        coneGrad.addColorStop(0, ac + '28');
        coneGrad.addColorStop(1, ac + '08');
        ctx.fillStyle = coneGrad;
    } catch (e) { ctx.fillStyle = ac + '18'; }
    ctx.fill();
    ctx.strokeStyle = ac;
    ctx.lineWidth = 2.5 * S;
    ctx.stroke();

    var lAngle = Math.PI + Math.PI / 2 - fieldAngle;
    var rAngle = Math.PI + Math.PI / 2 + fieldAngle;
    ctx.beginPath();
    ctx.moveTo(midX, baseY);
    ctx.lineTo(midX + Math.cos(lAngle) * radius, baseY + Math.sin(lAngle) * radius);
    ctx.strokeStyle = BLUE_L; ctx.lineWidth = 2 * S; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, baseY);
    ctx.lineTo(midX + Math.cos(rAngle) * radius, baseY + Math.sin(rAngle) * radius);
    ctx.strokeStyle = RED_R; ctx.lineWidth = 2 * S; ctx.stroke();

    drawLabel(ctx, 'L', midX + Math.cos(lAngle) * (radius + 16 * S), baseY + Math.sin(lAngle) * (radius + 16 * S), BLUE_L, 13 * S);
    drawLabel(ctx, 'R', midX + Math.cos(rAngle) * (radius + 16 * S), baseY + Math.sin(rAngle) * (radius + 16 * S), RED_R, 13 * S);

    // Width bar at top with enhanced meter
    var barY = pad, barH = 14 * S, barX = pad + 44 * S, barW = W - pad * 2 - 88 * S;
    var widthNorm = Math.min(width / 2, 1);
    drawMeterEnhanced(ctx, barX, barY, barW, barH, widthNorm, ac, false);
    drawLabel(ctx, 'M', barX - 12 * S, barY + barH / 2, TXT, 10 * S);
    drawLabel(ctx, 'S', barX + barW + 12 * S, barY + barH / 2, TXT, 10 * S);

    drawLabel(ctx, 'WIDTH: ' + (width * 100).toFixed(0) + '%', midX, H - 6 * S, ac, 12 * S);
    drawVignette(ctx);
}

// ─── 15. Auto Pan ────────────────────────────────────────────
function drawAutoPan(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var rate = p.rate != null ? p.rate : 2;
    var depth = p.depth != null ? p.depth : 1;
    var shape = p.shape || 'sine';
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 8);
    var phase = t * rate * Math.PI * 2;
    var panPos;
    if (shape === 'triangle') { panPos = (2 / Math.PI) * Math.asin(Math.sin(phase)); }
    else { panPos = Math.sin(phase); }
    panPos *= depth;

    var trackY = H / 2 - 22 * S, trackH = 44 * S;
    var trackX = pad + 28 * S, trackW = W - pad * 2 - 56 * S;
    ctx.fillStyle = METER_BG;
    ctx.beginPath();
    ctx.roundRect(trackX, trackY, trackW, trackH, 6 * S);
    ctx.fill();
    ctx.strokeStyle = METER_STROKE;
    ctx.lineWidth = 1;
    ctx.stroke();

    var centerX = trackX + trackW / 2;
    dashed(ctx, centerX, trackY, centerX, trackY + trackH, GRID_LT, [3, 6]);

    var ballX = centerX + panPos * (trackW / 2);
    var ballY = trackY + trackH / 2;
    // Outer glow ring
    ctx.beginPath();
    ctx.arc(ballX, ballY, 20 * S, 0, Math.PI * 2);
    ctx.fillStyle = ac + '12'; ctx.fill();
    ctx.beginPath();
    ctx.arc(ballX, ballY, 16 * S, 0, Math.PI * 2);
    ctx.fillStyle = ac + '1a'; ctx.fill();
    // Gradient-filled ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, 11 * S, 0, Math.PI * 2);
    try {
        var ballGrad = ctx.createRadialGradient(ballX - 3 * S, ballY - 3 * S, 1, ballX, ballY, 11 * S);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.3, AC_SEC);
        ballGrad.addColorStop(1, ac);
        ctx.fillStyle = ballGrad;
    } catch (e) { ctx.fillStyle = ac; }
    ctx.fill();

    drawLabel(ctx, 'L', trackX - 14 * S, trackY + trackH / 2, BLUE_L, 13 * S);
    drawLabel(ctx, 'R', trackX + trackW + 14 * S, trackY + trackH / 2, RED_R, 13 * S);

    // LFO wave below
    var waveY = trackY + trackH + 16 * S;
    var waveH = H - waveY - pad - 6 * S;
    var waveMid = waveY + waveH / 2;
    var pts = [];
    for (var i = 0; i < trackW; i++) {
        var x = trackX + i;
        var ph = (i / trackW) * Math.PI * 4 + t * rate * Math.PI * 2;
        var val;
        if (shape === 'triangle') { val = (2 / Math.PI) * Math.asin(Math.sin(ph)); }
        else { val = Math.sin(ph); }
        val *= depth;
        pts.push([x, waveMid - val * (waveH / 2)]);
    }
    drawGlowLine(ctx, pts, ac + '88', 1.5 * S);

    var syncLabel = p.sync && p.sync !== 'free' ? p.sync + ' BARS' : rate.toFixed(1) + 'Hz';
    drawLabel(ctx, syncLabel + '  ' + shape.toUpperCase(), W / 2, pad + 8 * S, ac, 11 * S);
    drawVignette(ctx);
}

// ─── 16. Utility ─────────────────────────────────────────────
function drawUtility(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var gain = p.gain != null ? p.gain : 0;
    var pan = p.pan != null ? p.pan : 0;
    var phaseInvert = p.phaseInvert || false;
    var mono = p.mono || false;
    var pad = 14 * S;

    drawGridEnhanced(ctx, 4, 6);

    var gainNorm = Math.max(0, Math.min(1, (gain + 24) / 48));
    drawMeterEnhanced(ctx, pad, pad + 14 * S, 34 * S, H - pad * 2 - 28 * S, gainNorm, ac);
    drawLabel(ctx, 'GAIN', pad + 17 * S, pad + 6 * S, TXT, 10 * S);
    drawLabel(ctx, (gain >= 0 ? '+' : '') + gain.toFixed(1), pad + 17 * S, H - 6 * S, ac, 10 * S);

    // Pan indicator with rounded track
    var panX = 86 * S, panW = W - 176 * S, panY = H / 2 - 12 * S, panH = 24 * S;
    ctx.fillStyle = METER_BG;
    ctx.beginPath();
    ctx.roundRect(panX, panY, panW, panH, 6 * S);
    ctx.fill();
    ctx.strokeStyle = METER_STROKE;
    ctx.lineWidth = 1;
    ctx.stroke();

    var panCenter = panX + panW / 2;
    dashed(ctx, panCenter, panY, panCenter, panY + panH, GRID_LT, [3, 3]);

    var panPos = panCenter + pan * (panW / 2);
    try {
        var panGrad = ctx.createLinearGradient(Math.min(panCenter, panPos), 0, Math.max(panCenter, panPos), 0);
        panGrad.addColorStop(0, ac);
        panGrad.addColorStop(1, AC_SEC);
        ctx.fillStyle = panGrad;
    } catch (e) { ctx.fillStyle = ac; }
    ctx.fillRect(Math.min(panCenter, panPos), panY + 3, Math.abs(panPos - panCenter), panH - 6);
    // Pan position dot
    ctx.beginPath();
    ctx.arc(panPos, panY + panH / 2, 7 * S, 0, Math.PI * 2);
    try {
        var dotGrad = ctx.createRadialGradient(panPos - 2 * S, panY + panH / 2 - 2 * S, 0, panPos, panY + panH / 2, 7 * S);
        dotGrad.addColorStop(0, '#ffffff');
        dotGrad.addColorStop(0.4, ac);
        dotGrad.addColorStop(1, ac + 'cc');
        ctx.fillStyle = dotGrad;
    } catch (e) { ctx.fillStyle = ac; }
    ctx.fill();

    drawLabel(ctx, 'L', panX - 12 * S, panY + panH / 2, BLUE_L, 11 * S);
    drawLabel(ctx, 'R', panX + panW + 12 * S, panY + panH / 2, RED_R, 11 * S);
    var panStr = pan === 0 ? 'C' : (pan < 0 ? 'L' + Math.abs(pan * 100).toFixed(0) : 'R' + (pan * 100).toFixed(0));
    drawLabel(ctx, 'PAN: ' + panStr, panCenter, panY - 14 * S, ac, 11 * S);

    drawLED(ctx, W - 72 * S, H - 28 * S, 7 * S, phaseInvert, '#ff4444');
    drawLabel(ctx, '\u00D8', W - 72 * S, H - 44 * S, phaseInvert ? '#ff4444' : TXT, 12 * S);
    drawLED(ctx, W - 30 * S, H - 28 * S, 7 * S, mono, YELLOW);
    drawLabel(ctx, 'M', W - 30 * S, H - 44 * S, mono ? YELLOW : TXT, 12 * S);
    drawVignette(ctx);
}

// ─── 17. Tuner ───────────────────────────────────────────────
function drawTuner(ctx, fx, ac) {
    clear(ctx);
    var pad = 14 * S;
    var pitch = null;
    if (fx.getDetectedPitch) {
        try { pitch = fx.getDetectedPitch(); } catch (e) {}
    }

    var note = pitch ? pitch.note : '--';
    var octave = pitch ? pitch.octave : '';
    var cents = pitch ? pitch.cents : 0;
    var freq = pitch ? pitch.frequency : 0;
    var confidence = pitch ? pitch.confidence : 0;
    var cx = W / 2, cy = H * 0.30;

    drawGridEnhanced(ctx, 4, 6);

    // Note display with glow
    var noteColor = confidence > 0.5 ? ac : TXT;
    ctx.save();
    ctx.shadowColor = noteColor;
    ctx.shadowBlur = confidence > 0.5 ? 12 * S : 0;
    ctx.fillStyle = noteColor;
    ctx.font = 'bold ' + (50 * S) + 'px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('' + note + octave, cx, cy);
    ctx.restore();

    drawLabel(ctx, freq > 0 ? freq.toFixed(1) + ' Hz' : '-- Hz', cx, cy + 36 * S, TXT, 13 * S);

    // Cents gauge with rounded track
    var gaugeW = W - pad * 2 - 56 * S, gaugeX = pad + 28 * S, gaugeY = H * 0.66, gaugeH = 12 * S;
    ctx.fillStyle = METER_BG;
    ctx.beginPath();
    ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 4 * S);
    ctx.fill();
    ctx.strokeStyle = METER_STROKE;
    ctx.lineWidth = 1;
    ctx.stroke();

    var gaugeMid = gaugeX + gaugeW / 2;
    ctx.fillStyle = GRID_LT;
    ctx.fillRect(gaugeMid - 1.5, gaugeY - 3 * S, 3, gaugeH + 6 * S);

    var centsNorm = Math.max(-50, Math.min(50, cents)) / 50;
    var needleX = gaugeMid + centsNorm * (gaugeW / 2);
    var inTune = Math.abs(cents) < 5;
    var color = inTune ? GREEN : (Math.abs(cents) < 15 ? YELLOW : ac);

    // Needle with glow
    ctx.beginPath();
    ctx.arc(needleX, gaugeY + gaugeH / 2, 9 * S, 0, Math.PI * 2);
    ctx.fillStyle = color + '22'; ctx.fill();
    ctx.beginPath();
    ctx.arc(needleX, gaugeY + gaugeH / 2, 7 * S, 0, Math.PI * 2);
    try {
        var nGrad = ctx.createRadialGradient(needleX - 2 * S, gaugeY + gaugeH / 2 - 2 * S, 0, needleX, gaugeY + gaugeH / 2, 7 * S);
        nGrad.addColorStop(0, '#ffffff');
        nGrad.addColorStop(0.4, color);
        nGrad.addColorStop(1, color + 'cc');
        ctx.fillStyle = nGrad;
    } catch (e) { ctx.fillStyle = color; }
    ctx.fill();

    drawLabel(ctx, (cents >= 0 ? '+' : '') + cents.toFixed(0) + '\u00A2', cx, gaugeY + gaugeH + 18 * S, color, 13 * S);
    drawLabel(ctx, '-50', gaugeX, gaugeY - 10 * S, TXT_DIM, 9 * S, 'left');
    drawLabel(ctx, '+50', gaugeX + gaugeW, gaugeY - 10 * S, TXT_DIM, 9 * S, 'right');

    drawLED(ctx, W - 28 * S, pad + 14 * S, 8 * S, inTune && confidence > 0.5, GREEN);
    drawMeterEnhanced(ctx, pad, pad, 12 * S, H - pad * 2, confidence, ac);
    drawVignette(ctx);
}

// ─── 18. Vocoder ─────────────────────────────────────────────
function drawVocoder(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var numBands = p.numBands || 16;
    var pad = 14 * S;
    var gap = 3 * S;
    var barW = (W - pad * 2) / numBands - gap;
    var maxH = H - pad * 2 - 20 * S;

    drawGridEnhanced(ctx, 4, 0);

    for (var i = 0; i < numBands; i++) {
        var level = 0;
        if (fx._envelopeGains && fx._envelopeGains[i]) {
            try { level = fx._envelopeGains[i].gain.value; } catch (e) {}
        }

        var x = pad + i * ((W - pad * 2) / numBands) + gap / 2;
        var barH = Math.max(2, level * maxH);
        var grad = ctx.createLinearGradient(x, pad + maxH, x, pad + maxH - barH);
        grad.addColorStop(0, GREEN);
        grad.addColorStop(0.5, YELLOW);
        grad.addColorStop(1, ac);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, pad + maxH - barH, barW, barH, 2 * S);
        ctx.fill();
        // Peak indicator
        ctx.fillStyle = ac;
        ctx.beginPath();
        ctx.roundRect(x, pad + maxH - barH, barW, 3 * S, [2 * S, 2 * S, 0, 0]);
        ctx.fill();
    }

    drawLabel(ctx, 'VOCODER', W / 2, H - 6 * S, TXT, 11 * S);
    drawLabel(ctx, numBands + ' BANDS', W - 56 * S, pad + 10 * S, ac, 11 * S);
    drawVignette(ctx);
}

// ─── 19. LoomSauce ────────────────────────────────────────────
function drawLoomSauce(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var pad = 8 * S;
    var secW = (W - pad * 2) / 6;
    var secH = H - pad * 2;

    var sections = [
        { label: 'COMP', bypass: p.compBypass },
        { label: 'ENHANCE', bypass: p.enhBypass },
        { label: 'EQ', bypass: p.eqBypass },
        { label: 'MULT', bypass: p.multBypass },
        { label: 'SPACE', bypass: p.spaceBypass },
        { label: 'GAIN', bypass: p.gainBypass }
    ];

    for (var i = 0; i < 6; i++) {
        var sec = sections[i];
        var sx = pad + i * secW;
        var sy = pad;

        // Section background with subtle gradient
        try {
            var secGrad = ctx.createLinearGradient(sx, sy, sx, sy + secH);
            secGrad.addColorStop(0, sec.bypass ? SECT_BG : SECT_BG_ACT);
            secGrad.addColorStop(1, sec.bypass ? SECT_BG + 'cc' : SECT_BG_ACT + 'cc');
            ctx.fillStyle = secGrad;
        } catch (e) { ctx.fillStyle = sec.bypass ? SECT_BG : SECT_BG_ACT; }
        ctx.beginPath();
        ctx.roundRect(sx + 1, sy, secW - 2, secH, 3 * S);
        ctx.fill();
        ctx.strokeStyle = sec.bypass ? LED_OFF : ac + '33';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        var lblAlpha = sec.bypass ? '44' : 'cc';
        drawLabel(ctx, sec.label, sx + secW / 2, sy + 14 * S, ac + lblAlpha, 10 * S);

        drawLED(ctx, sx + secW / 2, sy + 30 * S, 4 * S, !sec.bypass, sec.bypass ? '#333' : ac);

        if (sec.bypass) continue;

        var visY = sy + 44 * S;
        var visH = secH - 52 * S;
        var cx = sx + secW / 2;

        if (i === 0) {
            var thresh = p.compThreshold != null ? p.compThreshold : -18;
            var ratio = p.compRatio != null ? p.compRatio : 3;
            var thN = Math.max(0, Math.min(1, (thresh + 60) / 60));
            var raN = Math.max(0, Math.min(1, (ratio - 1) / 19));
            var bW3 = 11 * S;
            drawMeterEnhanced(ctx, cx - bW3 - 4 * S, visY + 3, bW3, visH - 16 * S, thN, ac);
            drawMeterEnhanced(ctx, cx + 4 * S, visY + 3, bW3, visH - 16 * S, raN, YELLOW);
            drawLabel(ctx, 'TH', cx - bW3 / 2 - 4 * S, visY + visH - 6 * S, TXT_DIM, 8 * S);
            drawLabel(ctx, 'RA', cx + bW3 / 2 + 4 * S, visY + visH - 6 * S, TXT_DIM, 8 * S);
        } else if (i === 1) {
            var bars = [
                { v: p.enhAir || 0, l: 'A' },
                { v: p.enhWarmth || 0, l: 'W' },
                { v: p.enhPresence || 0, l: 'P' }
            ];
            var bW = 11 * S, gap2 = 5 * S;
            var totalW = bars.length * bW + (bars.length - 1) * gap2;
            var startX = cx - totalW / 2;
            for (var b = 0; b < bars.length; b++) {
                var bx = startX + b * (bW + gap2);
                drawMeterEnhanced(ctx, bx, visY + 3, bW, visH - 16 * S, bars[b].v, ac);
                drawLabel(ctx, bars[b].l, bx + bW / 2, visY + visH - 6 * S, TXT_DIM, 8 * S);
            }
        } else if (i === 2) {
            var eqPts = [];
            var eqW = secW - 12 * S;
            for (var j = 0; j < eqW; j++) {
                var fRatio = j / eqW;
                var dbVal = 0;
                dbVal += (p.eqLowGain || 0) * 0.5 * (1 - Math.tanh((fRatio - 0.15) * 10));
                var mf = ((p.eqMidFreq || 1000) - 200) / 7800;
                dbVal += (p.eqMidGain || 0) * Math.exp(-0.5 * Math.pow((fRatio - mf) / 0.1, 2));
                dbVal += (p.eqHighGain || 0) * 0.5 * (1 + Math.tanh((fRatio - 0.75) * 10));
                var ey = visY + visH / 2 - (dbVal / 12) * (visH / 2);
                eqPts.push([sx + 6 * S + j, ey]);
            }
            dashed(ctx, sx + 6 * S, visY + visH / 2, sx + secW - 6 * S, visY + visH / 2, GRID_LT, [3, 3]);
            drawGlowLine(ctx, eqPts, ac, 2 * S);
        } else if (i === 3) {
            var amt = p.multAmount || 0;
            var wdt = p.multWidth || 0.5;
            var midY = visY + visH / 2;
            var spread = wdt * (secW / 2 - 8 * S);
            ctx.beginPath();
            ctx.arc(cx, midY, 4 * S, 0, Math.PI * 2);
            ctx.fillStyle = ac; ctx.fill();
            if (amt > 0.01) {
                var lx = cx - spread, rx = cx + spread;
                ctx.beginPath();
                ctx.arc(lx, midY, (3 + amt * 4) * S, 0, Math.PI * 2);
                ctx.fillStyle = BLUE_L + Math.round(amt * 180).toString(16).padStart(2, '0');
                ctx.fill();
                ctx.beginPath();
                ctx.arc(rx, midY, (3 + amt * 4) * S, 0, Math.PI * 2);
                ctx.fillStyle = RED_R + Math.round(amt * 180).toString(16).padStart(2, '0');
                ctx.fill();
                drawLabel(ctx, 'L', lx, midY + 16 * S, BLUE_L, 9 * S);
                drawLabel(ctx, 'R', rx, midY + 16 * S, RED_R, 9 * S);
            }
        } else if (i === 4) {
            var szN = p.spaceSize || 0.3;
            var mixN = p.spaceMix || 0.15;
            var bW2 = 14 * S;
            drawMeterEnhanced(ctx, cx - bW2 - 4 * S, visY + 3, bW2, visH - 16 * S, szN, ac);
            drawMeterEnhanced(ctx, cx + 4 * S, visY + 3, bW2, visH - 16 * S, mixN, GREEN);
            drawLabel(ctx, 'SZ', cx - bW2 / 2 - 4 * S, visY + visH - 6 * S, TXT_DIM, 8 * S);
            drawLabel(ctx, 'MX', cx + bW2 / 2 + 4 * S, visY + visH - 6 * S, TXT_DIM, 8 * S);
        } else if (i === 5) {
            var lvl = p.gainLevel != null ? p.gainLevel : 1.0;
            var lvlN = Math.min(lvl / 2, 1);
            drawMeterEnhanced(ctx, cx - 7 * S, visY + 3, 14 * S, visH - 28 * S, lvlN, ac);
            var limEnabled = p.gainLimiter !== false;
            var limActive = limEnabled && fx.getLimiterReduction && Math.abs(fx.getLimiterReduction()) > 0.1;
            drawLED(ctx, cx, visY + visH - 12 * S, 4 * S, limActive, limActive ? GREEN : limEnabled ? '#333' : '#222');
            drawLabel(ctx, 'LIM', cx, visY + visH - 2 * S, limActive ? GREEN : limEnabled ? TXT_DIM : '#333', 8 * S);
        }
    }

    // Signal flow arrows
    ctx.strokeStyle = ac + '55';
    ctx.lineWidth = 1.5 * S;
    for (var a = 0; a < 5; a++) {
        var ax = pad + (a + 1) * secW;
        ctx.beginPath();
        ctx.moveTo(ax - 4 * S, H / 2);
        ctx.lineTo(ax + 4 * S, H / 2);
        ctx.lineTo(ax + 2 * S, H / 2 - 3 * S);
        ctx.moveTo(ax + 4 * S, H / 2);
        ctx.lineTo(ax + 2 * S, H / 2 + 3 * S);
        ctx.stroke();
    }
    drawVignette(ctx);
}

// ═══════════════════ NEW EFFECT VISUALIZERS ═══════════════════

function drawSoftClipper(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var drive = p.drive != null ? p.drive : 0.3;
    var knee = p.knee != null ? p.knee : 2;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 4);
    var cW = W - pad * 2, cH = H - pad * 2;
    var toX = function(v) { return pad + ((v + 1) / 2) * cW; };
    var toY = function(v) { return pad + (1 - (v + 1) / 2) * cH; };
    // Reference lines
    ctx.strokeStyle = GRID_LT; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(toX(-1), toY(-1)); ctx.lineTo(toX(1), toY(1)); ctx.stroke();
    ctx.setLineDash([3, 6]); ctx.strokeStyle = GRID + '88';
    ctx.beginPath(); ctx.moveTo(toX(0), pad); ctx.lineTo(toX(0), H - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, toY(0)); ctx.lineTo(W - pad, toY(0)); ctx.stroke();
    ctx.setLineDash([]);
    // Ceiling line
    if (p.ceiling != null) {
        var ceilLin = Math.pow(10, p.ceiling / 20);
        var cy = toY(ceilLin);
        ctx.strokeStyle = YELLOW + '66'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pad, cy); ctx.lineTo(W - pad, cy); ctx.stroke();
        ctx.setLineDash([]);
    }
    // Transfer curve
    var pts = [], drv = 1 + drive * 20;
    for (var i = 0; i <= 100; i++) {
        var input = (i / 50) - 1;
        var x = input * drv;
        var absX = Math.abs(x);
        var output = x / Math.pow(1 + Math.pow(absX, knee), 1 / knee);
        pts.push([toX(input), toY(output)]);
    }
    drawGlowLine(ctx, pts, ac, 3 * S);
    drawLabel(ctx, 'SOFT CLIP', W / 2, pad + 12 * S, ac, 12 * S);
    drawLabel(ctx, 'KNEE: ' + knee.toFixed(1), W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawTremolo(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var rate = p.rate != null ? p.rate : 4;
    var depth = p.depth != null ? p.depth : 0.5;
    var shape = p.shape || 'sine';
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 6);
    // LFO waveform
    var pts = [];
    for (var i = 0; i <= 200; i++) {
        var phase = (i / 200) * Math.PI * 4 + (t || 0) * rate;
        var lfo;
        switch (shape) {
            case 'triangle': lfo = 2 * Math.abs(2 * ((phase / (2 * Math.PI)) % 1) - 1) - 1; break;
            case 'square': lfo = Math.sin(phase) >= 0 ? 1 : -1; break;
            case 'sawtooth': lfo = 2 * ((phase / (2 * Math.PI)) % 1) - 1; break;
            default: lfo = Math.sin(phase);
        }
        var amp = 1 - depth * 0.5 + lfo * depth * 0.5;
        var x = pad + (i / 200) * (W - pad * 2);
        var y = H / 2 - amp * (H / 2 - pad) * Math.sin(phase * 8);
        pts.push([x, y]);
    }
    drawGlowLine(ctx, pts, ac, 2 * S);
    // LFO shape overlay
    var lpts = [];
    for (var j = 0; j <= 200; j++) {
        var ph = (j / 200) * Math.PI * 4 + (t || 0) * rate;
        var lv;
        switch (shape) {
            case 'triangle': lv = 2 * Math.abs(2 * ((ph / (2 * Math.PI)) % 1) - 1) - 1; break;
            case 'square': lv = Math.sin(ph) >= 0 ? 1 : -1; break;
            case 'sawtooth': lv = 2 * ((ph / (2 * Math.PI)) % 1) - 1; break;
            default: lv = Math.sin(ph);
        }
        lpts.push([pad + (j / 200) * (W - pad * 2), H / 2 - lv * (H / 4)]);
    }
    ctx.save(); ctx.globalAlpha = 0.3;
    drawGlowLine(ctx, lpts, AC_SEC, 1.5 * S);
    ctx.restore();
    drawLabel(ctx, 'TREMOLO', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, shape.toUpperCase() + ' ' + rate.toFixed(1) + 'Hz', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawRingMod(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var freq = p.carrierFreq != null ? p.carrierFreq : 440;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 6);
    // Input waveform (simulated sine)
    var pts1 = [], pts2 = [], ptsR = [];
    for (var i = 0; i <= 200; i++) {
        var x = pad + (i / 200) * (W - pad * 2);
        var phase = (i / 200) * Math.PI * 6 + (t || 0);
        var input = Math.sin(phase);
        var carrier = Math.sin(phase * (freq / 100));
        var result = input * carrier;
        pts1.push([x, H * 0.25 - input * H * 0.12]);
        pts2.push([x, H * 0.25 - carrier * H * 0.12]);
        ptsR.push([x, H * 0.7 - result * H * 0.18]);
    }
    ctx.save(); ctx.globalAlpha = 0.4;
    drawGlowLine(ctx, pts1, TXT, 1 * S);
    drawGlowLine(ctx, pts2, AC_SEC, 1 * S);
    ctx.restore();
    drawGlowLine(ctx, ptsR, ac, 2.5 * S);
    drawLabel(ctx, 'RING MOD', W / 2, pad + 8 * S, ac, 12 * S);
    drawLabel(ctx, freq + 'Hz', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawFlanger(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var rate = p.rate != null ? p.rate : 0.3;
    var feedback = p.feedback != null ? p.feedback : 0.5;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 8);
    // Comb filter frequency response (notches sweeping)
    var sweep = Math.sin((t || 0) * rate * 2) * 0.5 + 0.5;
    var baseDelay = 0.003 + sweep * 0.007;
    var pts = [];
    for (var i = 0; i <= 200; i++) {
        var freq = 20 + (i / 200) * 19980;
        var x = pad + (i / 200) * (W - pad * 2);
        // Comb filter magnitude: |1 + fb * e^(-j*2pi*f*d)| approximation
        var phase = 2 * Math.PI * freq * baseDelay;
        var mag = Math.sqrt(1 + feedback * feedback + 2 * feedback * Math.cos(phase));
        var dbMag = 20 * Math.log10(Math.max(0.01, mag));
        var y = H / 2 - (dbMag / 20) * (H / 2 - pad);
        pts.push([x, Math.max(pad, Math.min(H - pad, y))]);
    }
    drawGlowLine(ctx, pts, ac, 2.5 * S);
    drawLabel(ctx, 'FLANGER', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, 'FB: ' + Math.round(feedback * 100) + '%', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawBitCrusher(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var bits = p.bitDepth != null ? p.bitDepth : 8;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 6);
    var levels = Math.pow(2, Math.max(1, Math.round(bits)));
    // Smooth sine
    var pts1 = [], pts2 = [];
    for (var i = 0; i <= 200; i++) {
        var x = pad + (i / 200) * (W - pad * 2);
        var input = Math.sin((i / 200) * Math.PI * 4);
        var crushed = Math.round(input * levels) / levels;
        pts1.push([x, H / 2 - input * (H / 2 - pad) * 0.8]);
        pts2.push([x, H / 2 - crushed * (H / 2 - pad) * 0.8]);
    }
    ctx.save(); ctx.globalAlpha = 0.25;
    drawGlowLine(ctx, pts1, TXT, 1.5 * S);
    ctx.restore();
    drawGlowLine(ctx, pts2, ac, 2.5 * S);
    drawLabel(ctx, 'BIT CRUSHER', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, Math.round(bits) + ' BIT', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawFreqShifter(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var shift = p.shift != null ? p.shift : 0;
    var dir = p.direction || 'up';
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 6);
    // Frequency peaks (original and shifted)
    var peakFreqs = [200, 600, 1200, 3000];
    var barW = 20 * S;
    for (var i = 0; i < peakFreqs.length; i++) {
        var freq = peakFreqs[i];
        var x1 = pad + (Math.log10(freq / 20) / Math.log10(1000)) * (W - pad * 2) * 0.5;
        var shifted = dir === 'up' ? freq + shift : Math.max(20, freq - shift);
        var x2 = pad + (Math.log10(shifted / 20) / Math.log10(1000)) * (W - pad * 2) * 0.5;
        var h = (H - pad * 2) * (0.3 + 0.5 * (1 - i / peakFreqs.length));
        // Original (dim)
        ctx.fillStyle = TXT + '44';
        ctx.fillRect(x1 - barW / 4, H - pad - h, barW / 2, h);
        // Shifted
        ctx.fillStyle = ac + '88';
        ctx.fillRect(x2 + barW / 2 - barW / 4, H - pad - h, barW / 2, h);
        // Arrow
        ctx.strokeStyle = ac + '66'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, H - pad - h / 2); ctx.lineTo(x2 + barW / 2, H - pad - h / 2); ctx.stroke();
    }
    drawLabel(ctx, 'FREQ SHIFT', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, dir.toUpperCase() + ' ' + Math.round(shift) + 'Hz', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawTape(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var drive = p.drive != null ? p.drive : 0.3;
    var flutter = p.flutter != null ? p.flutter : 0.2;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 2, 2);
    // Tape reels
    var time = (t || 0) * 2;
    var r1x = W * 0.25, r2x = W * 0.75, ry = H * 0.4, rr = 40 * S;
    for (var ri = 0; ri < 2; ri++) {
        var rx = ri === 0 ? r1x : r2x;
        ctx.strokeStyle = ac + '44'; ctx.lineWidth = 2 * S;
        ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.stroke();
        // Spokes (rotating)
        for (var sp = 0; sp < 3; sp++) {
            var ang = time + sp * Math.PI * 2 / 3 + ri * Math.PI;
            ctx.strokeStyle = ac + '33';
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + Math.cos(ang) * rr * 0.8, ry + Math.sin(ang) * rr * 0.8);
            ctx.stroke();
        }
    }
    // Tape path with flutter
    var tapePts = [];
    for (var i = 0; i <= 40; i++) {
        var tx = r1x + rr + (i / 40) * (r2x - r1x - rr * 2);
        var wobble = Math.sin(time * 4 + i * 0.3) * flutter * 8 * S;
        tapePts.push([tx, ry + rr + 10 * S + wobble]);
    }
    drawGlowLine(ctx, tapePts, ac, 2 * S);
    drawLabel(ctx, 'TAPE', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, 'DRIVE: ' + Math.round(drive * 100) + '%', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawVinyl(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var crackle = p.crackle != null ? p.crackle : 0.2;
    var wobble = p.wobble != null ? p.wobble : 0.15;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 2, 2);
    var cx = W / 2, cy = H / 2;
    var time = (t || 0);
    // Vinyl record (concentric grooves)
    for (var r = 20 * S; r < 100 * S; r += 6 * S) {
        var off = Math.sin(time * 0.8) * wobble * 3 * S;
        ctx.strokeStyle = r % (12 * S) < 6 * S ? (ac + '18') : (GRID + '44');
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx + off, cy + off * 0.5, r, 0, Math.PI * 2); ctx.stroke();
    }
    // Spindle
    ctx.fillStyle = ac + '44';
    ctx.beginPath(); ctx.arc(cx, cy, 4 * S, 0, Math.PI * 2); ctx.fill();
    // Crackle particles
    if (crackle > 0) {
        ctx.fillStyle = ac + '55';
        for (var c = 0; c < Math.round(crackle * 15); c++) {
            var ca = (time * 0.3 + c * 1.7) * 2;
            var cr = 25 * S + ((c * 37 + Math.floor(time * 3)) % 70) * S;
            var cx2 = cx + Math.cos(ca) * cr;
            var cy2 = cy + Math.sin(ca) * cr;
            ctx.fillRect(cx2 - 1, cy2 - 1, 2, 2);
        }
    }
    drawLabel(ctx, 'VINYL', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, 'CRACKLE: ' + Math.round(crackle * 100) + '%', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawCabinet(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var cab = p.cabinet || '1x12';
    var pad = 16 * S;
    drawGridEnhanced(ctx, 2, 2);
    var cx = W / 2, cy = H / 2;
    // Cabinet box
    var bw = 160 * S, bh = 140 * S;
    ctx.strokeStyle = ac + '44'; ctx.lineWidth = 2 * S;
    ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    // Speaker cones based on cabinet type
    var speakers = cab === '4x12' ? [[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]] :
                   cab === '2x12' ? [[-.25,0],[.25,0]] :
                   [[0, 0]];
    for (var i = 0; i < speakers.length; i++) {
        var sx = cx + speakers[i][0] * bw * 0.7;
        var sy = cy + speakers[i][1] * bh * 0.7;
        var sr = (speakers.length > 2 ? 22 : speakers.length > 1 ? 30 : 40) * S;
        // Outer ring
        ctx.strokeStyle = ac + '55'; ctx.lineWidth = 2 * S;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.stroke();
        // Inner cone
        ctx.strokeStyle = ac + '33'; ctx.lineWidth = 1 * S;
        ctx.beginPath(); ctx.arc(sx, sy, sr * 0.6, 0, Math.PI * 2); ctx.stroke();
        // Dust cap
        ctx.fillStyle = ac + '22';
        ctx.beginPath(); ctx.arc(sx, sy, sr * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    drawLabel(ctx, cab.toUpperCase(), W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, 'CABINET', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawTransientShaper(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var atk = p.attack != null ? p.attack : 0;
    var sus = p.sustain != null ? p.sustain : 0;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 6);
    // Transient envelope shape
    var pts = [];
    for (var i = 0; i <= 200; i++) {
        var x = pad + (i / 200) * (W - pad * 2);
        var t = i / 200;
        var env;
        if (t < 0.05) {
            // Attack phase
            env = (t / 0.05) * (1 + atk * 0.5);
        } else if (t < 0.15) {
            // Decay
            var decay = 1 - (t - 0.05) / 0.1;
            env = (1 + atk * 0.5) * decay + (0.3 + sus * 0.2) * (1 - decay);
        } else {
            // Sustain decay
            env = (0.3 + sus * 0.2) * Math.exp(-(t - 0.15) * 3);
        }
        pts.push([x, H * 0.8 - env * (H * 0.6)]);
    }
    drawGlowLine(ctx, pts, ac, 2.5 * S);
    // Attack region highlight
    var atkEnd = pad + 0.15 * (W - pad * 2);
    ctx.fillStyle = ac + '0a';
    ctx.fillRect(pad, pad, atkEnd - pad, H - pad * 2);
    // Sustain region highlight
    ctx.fillStyle = AC_SEC + '08';
    ctx.fillRect(atkEnd, pad, W - pad - atkEnd, H - pad * 2);
    drawLabel(ctx, 'TRANSIENT', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, 'ATK:' + Math.round(atk * 100) + '% SUS:' + Math.round(sus * 100) + '%', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawDeEsser(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var freq = p.frequency != null ? p.frequency : 6000;
    var threshold = p.threshold != null ? p.threshold : -20;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 6);
    // Frequency spectrum
    var pts = [];
    for (var i = 0; i <= 200; i++) {
        var f = 20 * Math.pow(1000, i / 200);
        var x = pad + (i / 200) * (W - pad * 2);
        // Simulated spectrum with sibilance peak
        var mag = -20 + 10 * Math.exp(-Math.pow((f - freq) / 1000, 2));
        var y = H / 2 - (mag / 40) * (H / 2 - pad);
        pts.push([x, Math.max(pad, Math.min(H - pad, y))]);
    }
    drawGlowLine(ctx, pts, ac, 2 * S);
    // Sibilance region
    var fNorm = Math.log10(freq / 20) / Math.log10(1000);
    var bandX = pad + fNorm * (W - pad * 2);
    var bandW = 40 * S;
    ctx.fillStyle = RED_WARN + '15';
    ctx.fillRect(bandX - bandW / 2, pad, bandW, H - pad * 2);
    ctx.strokeStyle = RED_WARN + '44'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(bandX, pad); ctx.lineTo(bandX, H - pad); ctx.stroke();
    ctx.setLineDash([]);
    drawLabel(ctx, 'DE-ESSER', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, Math.round(freq) + 'Hz ' + threshold + 'dB', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawMultibandComp(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var xLow = p.crossLow != null ? p.crossLow : 200;
    var xHigh = p.crossHigh != null ? p.crossHigh : 4000;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 6);
    var cW = W - pad * 2;
    // Crossover lines
    var x1 = pad + (Math.log10(xLow / 20) / Math.log10(1000)) * cW;
    var x2 = pad + (Math.log10(xHigh / 20) / Math.log10(1000)) * cW;
    ctx.strokeStyle = ac + '55'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x1, pad); ctx.lineTo(x1, H - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, pad); ctx.lineTo(x2, H - pad); ctx.stroke();
    ctx.setLineDash([]);
    // Band labels
    var bands = [
        { label: 'LOW', x: (pad + x1) / 2, thr: p.lowThreshold || -20, gain: p.lowGain || 0 },
        { label: 'MID', x: (x1 + x2) / 2, thr: p.midThreshold || -18, gain: p.midGain || 0 },
        { label: 'HIGH', x: (x2 + W - pad) / 2, thr: p.highThreshold || -16, gain: p.highGain || 0 },
    ];
    var colors = [BLUE_L, ac, AC_SEC];
    for (var i = 0; i < bands.length; i++) {
        var b = bands[i];
        // GR meter placeholder
        var mh = Math.abs(b.thr) / 40 * (H * 0.4);
        var mw = 20 * S;
        ctx.fillStyle = colors[i] + '33';
        ctx.fillRect(b.x - mw / 2, H / 2 - mh / 2, mw, mh);
        ctx.strokeStyle = colors[i] + '66'; ctx.lineWidth = 1;
        ctx.strokeRect(b.x - mw / 2, H / 2 - mh / 2, mw, mh);
        drawLabel(ctx, b.label, b.x, H - pad - 16 * S, colors[i], 10 * S);
        drawLabel(ctx, b.thr + 'dB', b.x, H - pad - 4 * S, TXT_DIM, 8 * S);
    }
    drawLabel(ctx, 'MULTIBAND', W / 2, pad + 10 * S, ac, 12 * S);
    drawVignette(ctx);
}

function drawHalfTime(ctx, fx, ac, t) {
    clear(ctx);
    var p = fx.params;
    var amount = p.amount != null ? p.amount : 0.5;
    var pad = 16 * S;
    drawGridEnhanced(ctx, 4, 6);
    // Original tempo waveform (top)
    var pts1 = [], pts2 = [];
    for (var i = 0; i <= 200; i++) {
        var x = pad + (i / 200) * (W - pad * 2);
        var phase = (i / 200) * Math.PI * 8 + (t || 0) * 3;
        var orig = Math.sin(phase) * 0.7;
        var halved = Math.sin(phase * (1 - amount * 0.4)) * 0.6;
        pts1.push([x, H * 0.3 - orig * H * 0.15]);
        pts2.push([x, H * 0.7 - halved * H * 0.15]);
    }
    ctx.save(); ctx.globalAlpha = 0.35;
    drawGlowLine(ctx, pts1, TXT, 1.5 * S);
    ctx.restore();
    drawGlowLine(ctx, pts2, ac, 2.5 * S);
    // Speed arrows
    drawLabel(ctx, '1x', pad + 20 * S, H * 0.3 + 20 * S, TXT, 10 * S);
    drawLabel(ctx, '½x', pad + 20 * S, H * 0.7 + 20 * S, ac, 10 * S);
    // Divider
    ctx.strokeStyle = GRID_LT; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad, H / 2); ctx.lineTo(W - pad, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    drawLabel(ctx, 'HALF-TIME', W / 2, pad + 10 * S, ac, 12 * S);
    drawLabel(ctx, Math.round(amount * 100) + '%', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

function drawMasteringRack(ctx, fx, ac) {
    clear(ctx);
    var p = fx.params;
    var pad = 12 * S;
    drawGridEnhanced(ctx, 4, 8);
    // 4-section display
    var sectionW = (W - pad * 2) / 4;
    var sections = [
        { label: 'EQ', bypass: p.eqBypass, color: BLUE_L },
        { label: 'COMP', bypass: p.compBypass, color: ac },
        { label: 'WIDTH', bypass: p.widthBypass, color: AC_SEC },
        { label: 'LIMITER', bypass: p.limBypass, color: RED_WARN },
    ];
    for (var i = 0; i < 4; i++) {
        var s = sections[i];
        var sx = pad + i * sectionW;
        var col = s.bypass ? TXT_DIM : s.color;
        // Section background
        ctx.fillStyle = col + '08';
        ctx.fillRect(sx + 2, pad, sectionW - 4, H - pad * 2);
        // Section border
        ctx.strokeStyle = col + '33'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + 2, pad, sectionW - 4, H - pad * 2);
        // Label
        drawLabel(ctx, s.label, sx + sectionW / 2, pad + 14 * S, col, 10 * S);
        // Simple meter per section
        var meterH;
        switch (i) {
            case 0: meterH = (Math.abs(p.eqLowGain || 0) + Math.abs(p.eqMidGain || 0) + Math.abs(p.eqHighGain || 0)) / 24; break;
            case 1: meterH = Math.abs(p.compThreshold || -12) / 40; break;
            case 2: meterH = p.widthAmount || 0.5; break;
            case 3: meterH = Math.abs(p.limCeiling || -0.3) / 6; break;
            default: meterH = 0.3;
        }
        var barH = meterH * (H - pad * 2 - 30 * S);
        ctx.fillStyle = col + '44';
        ctx.fillRect(sx + sectionW / 2 - 8 * S, H - pad - barH, 16 * S, barH);
    }
    // Signal flow arrows
    ctx.strokeStyle = ac + '33'; ctx.lineWidth = 1;
    for (var j = 0; j < 3; j++) {
        var ax = pad + (j + 1) * sectionW;
        ctx.beginPath(); ctx.moveTo(ax - 4 * S, H / 2); ctx.lineTo(ax + 4 * S, H / 2); ctx.stroke();
    }
    drawLabel(ctx, 'MASTERING RACK', W / 2, H - 6 * S, TXT, 11 * S);
    drawVignette(ctx);
}

// ═══════════════════ DISPATCH MAP ═════════════════════════════

export var DRAW_MAP = {
    Compressor: drawCompressor,
    GlueCompressor: drawGlueCompressor,
    Limiter: drawLimiter,
    Gate: drawGate,
    SidechainCompressor: drawSidechain,
    EQEight: drawEQEight,
    Saturation: drawSaturation,
    Distortion: drawDistortion,
    Reverb: drawReverb,
    Delay: drawDelay,
    Echo: drawEcho,
    Chorus: drawChorus,
    Phaser: drawPhaser,
    StereoWidener: drawStereoWidener,
    AutoPan: drawAutoPan,
    Utility: drawUtility,
    Tuner: drawTuner,
    Vocoder: drawVocoder,
    LoomSauce: drawLoomSauce,
    SoftClipper: drawSoftClipper,
    Tremolo: drawTremolo,
    RingModulator: drawRingMod,
    Flanger: drawFlanger,
    BitCrusher: drawBitCrusher,
    FrequencyShifter: drawFreqShifter,
    Tape: drawTape,
    Vinyl: drawVinyl,
    Cabinet: drawCabinet,
    TransientShaper: drawTransientShaper,
    DeEsser: drawDeEsser,
    MultibandCompressor: drawMultibandComp,
    HalfTime: drawHalfTime,
    MasteringRack: drawMasteringRack
};

// ═══════════════════ REACT COMPONENT ══════════════════════════

export default function EffectVisualizer({ effect, theme, accentColors }) {
    var canvasRef = useRef(null);
    var rafRef = useRef(null);
    var lastFrameRef = useRef(0);
    var timeRef = useRef(0);
    var ac = accentColors?.accent || (theme ? theme.accentColor : '#ff6b6b');
    var acSec = accentColors?.secondary || '#ff9f43';
    var isDarkMode = theme?.isDark ?? true;

    useEffect(function() {
        var canvas = canvasRef.current;
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var drawFn = DRAW_MAP[effect.name];
        if (!drawFn) return;

        var FPS_INTERVAL = 1000 / 30;

        function animate(timestamp) {
            rafRef.current = requestAnimationFrame(animate);
            var delta = timestamp - lastFrameRef.current;
            if (delta < FPS_INTERVAL) return;
            lastFrameRef.current = timestamp - (delta % FPS_INTERVAL);
            timeRef.current = timestamp / 1000;
            try {
                setFramePalette(isDarkMode, acSec);
                drawFn(ctx, effect, ac, timeRef.current);
            } catch (e) {
                // Silently handle draw errors (nodes not yet created)
            }
        }

        rafRef.current = requestAnimationFrame(animate);

        return function() {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [effect, ac, acSec, isDarkMode]);

    return React.createElement('canvas', {
        ref: canvasRef,
        width: W,
        height: H,
        style: {
            width: '100%',
            maxWidth: '640px',
            height: 'auto',
            display: 'block',
            margin: '0 auto',
            imageRendering: 'auto'
        }
    });
}
