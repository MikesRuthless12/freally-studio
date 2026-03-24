/**
 * InteractionConfigs.js — Per-effect interactive handle definitions.
 *
 * Each config provides:
 *   hitTest(mx, my, effect)         → { id, cursor, clickOnly? } | null
 *   onDrag(id, mx, my, effect)      → mutates effect params
 *   drawOverlays(ctx, effect, ac, dragId, hoverId) → draws interactive handles
 *   onContextMenu?(mx, my, effect)  → returns true if handled
 *   onClick?(id, effect)            → handle click (toggle/cycle)
 */

import { W, H, AC_SEC, BG } from './EffectVisualizers';

// ─── Helpers ────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dst(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }

// Pill shape helper (fallback for browsers without roundRect)
function pill(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
    else { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
}

function drawDot(ctx, x, y, r, ac, active, hover) {
    // Outer glow layers
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = ac + (active ? '33' : hover ? '22' : '08');
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = ac + (active ? '44' : hover ? '33' : '11');
    ctx.fill();
    // Gradient-filled core dot (primary → secondary accent)
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    try {
        var grad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, r);
        grad.addColorStop(0, AC_SEC);
        grad.addColorStop(1, ac);
        ctx.fillStyle = grad;
    } catch (e) { ctx.fillStyle = ac; }
    ctx.fill();
}

function drawVLine(ctx, x, y1, y2, ac, active, hover) {
    ctx.save();
    ctx.strokeStyle = ac + (active ? 'dd' : hover ? 'aa' : '66');
    ctx.lineWidth = active ? 3 : hover ? 2.5 : 2;
    ctx.setLineDash(active ? [] : [6, 3]);
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    const my = (y1 + y2) / 2, s = active ? 6 : hover ? 5 : 4;
    ctx.beginPath();
    ctx.moveTo(x, my - s); ctx.lineTo(x + s, my); ctx.lineTo(x, my + s); ctx.lineTo(x - s, my);
    ctx.closePath(); ctx.fillStyle = ac; ctx.fill();
}

function drawHLine(ctx, y, x1, x2, ac, active, hover) {
    ctx.save();
    ctx.strokeStyle = ac + (active ? 'dd' : hover ? 'aa' : '66');
    ctx.lineWidth = active ? 3 : hover ? 2.5 : 2;
    ctx.setLineDash(active ? [] : [6, 3]);
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    const mx = (x1 + x2) / 2, s = active ? 6 : hover ? 5 : 4;
    ctx.beginPath();
    ctx.moveTo(mx - s, y); ctx.lineTo(mx, y - s); ctx.lineTo(mx + s, y); ctx.lineTo(mx, y + s);
    ctx.closePath(); ctx.fillStyle = ac; ctx.fill();
}

// ════════════════════ EQ EIGHT ═══════════════════════════════════

const EP = 8, EXO = 22, EFMIN = 20, EFMAX = 20000, EDB = 18;
const ETYPES = ['highpass', 'lowshelf', 'peaking', 'highshelf', 'lowpass'];
const ETL = { highpass: 'HP', lowshelf: 'LS', peaking: 'PK', highshelf: 'HS', lowpass: 'LP' };

function eqD() { return { px: EP + EXO, pw: W - EP - EXO - EP, py: EP, ph: H - EP * 2 - 10 }; }
function eqF2X(f, px, pw) { return px + (Math.log10(f / EFMIN) / Math.log10(EFMAX / EFMIN)) * pw; }
function eqX2F(x, px, pw) { return EFMIN * Math.pow(EFMAX / EFMIN, clamp((x - px) / pw, 0, 1)); }
function eqD2Y(db, py, ph) { return py + ph / 2 - (db / EDB) * (ph / 2); }
function eqY2D(y, py, ph) { return -((y - py - ph / 2) / (ph / 2)) * EDB; }

// ════════════════════ COMPRESSOR COORDS ═════════════════════════

function compThreshX(threshold) {
    const cw = W * 0.76, pad = 8, dbMin = -60, dbMax = 0;
    return pad + ((threshold - dbMin) / (dbMax - dbMin)) * (cw - pad * 2);
}
function compXToThresh(x) {
    const cw = W * 0.76, pad = 8, dbMin = -60, dbMax = 0;
    return clamp(dbMin + ((x - pad) / (cw - pad * 2)) * (dbMax - dbMin), -60, 0);
}

// ════════════════════ REVERB COORDS ═════════════════════════════

function revTimeToX(time, tMax) { return 10 + (time / tMax) * (W - 20); }
function revXToTime(x, tMax) { return clamp(((x - 10) / (W - 20)) * tMax, 0, 10); }

// ════════════════════ SATURATION / DISTORTION COORDS ════════════

function curvePt(input, drive, mode, isDist) {
    const pad = 12, cW = W - pad * 2, cH = H - pad * 2;
    let output;
    if (isDist) {
        const drv = 1 + drive * 0.5, x = input * drv;
        switch (mode) {
            case 'softClip': output = Math.tanh(x); break;
            case 'foldback': output = Math.sin(x * Math.PI / 2); break;
            case 'bitCrush': { const bits = Math.max(2, 16 - drive); const st = Math.pow(2, bits); output = Math.round(clamp(x, -1, 1) * st) / st; break; }
            default: output = clamp(x, -1, 1);
        }
    } else {
        const driveAmt = 1 + drive * 2;
        if (mode === 'digital') output = clamp(input * driveAmt, -1, 1);
        else if (mode === 'tape') { const xv = input * driveAmt; output = xv / (1 + Math.abs(xv)); }
        else output = Math.tanh(input * driveAmt) / Math.tanh(driveAmt || 0.001);
    }
    return {
        x: pad + ((input + 1) / 2) * cW,
        y: pad + (1 - (output + 1) / 2) * cH
    };
}

// ════════════════════ ECHO COORDS ═══════════════════════════════

function echoTapX(time, maxTime) { return 10 + (time / maxTime) * (W - 20); }
function echoXToTime(x, maxTime) { return clamp(((x - 10) / (W - 20)) * maxTime, 0.01, 2.0); }

// ════════════════════ CONFIG MAP ════════════════════════════════

export const INTERACTION_CONFIGS = {

    // ───────────── EQ Eight ─────────────────────────────────────
    EQEight: {
        hitTest(mx, my, effect) {
            const bands = effect.getParams().bands || [];
            const { px, pw, py, ph } = eqD();
            for (let i = 0; i < bands.length; i++) {
                if (!bands[i].enabled) continue;
                const bx = eqF2X(bands[i].frequency, px, pw);
                const by = eqD2Y(bands[i].gain, py, ph);
                // Band dot — left-click + drag to change freq/gain
                if (dst(mx, my, bx, by) < 18) return { id: `eq-${i}`, cursor: 'grab' };
            }
            return null;
        },
        onDrag(id, mx, my, effect) {
            const idx = parseInt(id.split('-')[1]);
            const bands = effect.getParams().bands || [];
            if (idx < 0 || idx >= bands.length) return;
            const { px, pw, py, ph } = eqD();
            const freq = clamp(Math.round(eqX2F(mx, px, pw)), 20, 20000);
            const gain = clamp(Math.round(eqY2D(my, py, ph) * 10) / 10, -18, 18);
            effect.setParam('bands', bands.map((b, i) => i === idx ? { ...b, frequency: freq, gain } : b));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const bands = effect.getParams().bands || [];
            const { px, pw, py, ph } = eqD();
            const bandColors = [ac, '#ff6b6b', '#4ecdc4', '#f59e0b', '#a855f7', '#22d3ee', '#ec4899', AC_SEC];
            bands.forEach((band, i) => {
                if (!band.enabled) return;
                const bx = eqF2X(band.frequency, px, pw);
                const by = eqD2Y(band.gain, py, ph);
                const id = `eq-${i}`;
                const active = dragId === id, hover = hoverId === id;
                const bColor = bandColors[i % bandColors.length];
                const dotR = active ? 8 : hover ? 7 : 5;
                // Soft glow halo
                ctx.beginPath(); ctx.arc(bx, by, dotR + 8, 0, Math.PI * 2);
                ctx.fillStyle = bColor + (active ? '30' : hover ? '22' : '15'); ctx.fill();
                ctx.beginPath(); ctx.arc(bx, by, dotR + 4, 0, Math.PI * 2);
                ctx.fillStyle = bColor + (active ? '55' : hover ? '40' : '28'); ctx.fill();
                // Core dot
                ctx.beginPath(); ctx.arc(bx, by, dotR, 0, Math.PI * 2);
                ctx.fillStyle = bColor; ctx.fill();
                // Bright center highlight
                ctx.beginPath(); ctx.arc(bx, by, dotR * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffffcc'; ctx.fill();
                // Type label pill below dot
                const typeLabel = ETL[band.type] || 'PK';
                const tY = by + dotR + 10;
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const tw = ctx.measureText(typeLabel).width + 6;
                ctx.fillStyle = BG + 'cc';
                pill(ctx, bx - tw / 2, tY - 6, tw, 12, 3);
                ctx.fill();
                ctx.strokeStyle = bColor + '66'; ctx.lineWidth = 0.5;
                pill(ctx, bx - tw / 2, tY - 6, tw, 12, 3);
                ctx.stroke();
                ctx.fillStyle = bColor;
                ctx.fillText(typeLabel, bx, tY);
            });
        },
        onContextMenu(mx, my, effect) {
            const bands = effect.getParams().bands || [];
            const { px, pw, py, ph } = eqD();
            for (let i = 0; i < bands.length; i++) {
                if (!bands[i].enabled) continue;
                if (dst(mx, my, eqF2X(bands[i].frequency, px, pw), eqD2Y(bands[i].gain, py, ph)) < 18) {
                    const cur = bands[i].type || 'peaking';
                    const next = ETYPES[(ETYPES.indexOf(cur) + 1) % ETYPES.length];
                    effect.setParam('bands', bands.map((b, j) => j === i ? { ...b, type: next } : b));
                    return true;
                }
            }
            return false;
        }
    },

    // ───────────── Compressor ───────────────────────────────────
    Compressor: {
        hitTest(mx, my, effect) {
            const th = effect.getParams().threshold != null ? effect.getParams().threshold : -24;
            const x = compThreshX(th);
            if (Math.abs(mx - x) < 12 && my > 8 && my < H - 8) return { id: 'thresh', cursor: 'ew-resize' };
            return null;
        },
        onDrag(id, mx, _my, effect) {
            if (id === 'thresh') effect.setParam('threshold', Math.round(compXToThresh(mx) * 2) / 2);
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'thresh', h = hoverId === 'thresh';
            if (a || h) drawVLine(ctx, compThreshX(effect.getParams().threshold ?? -24), 8, H - 8, ac, a, h);
        }
    },

    // ───────────── Glue Compressor ──────────────────────────────
    GlueCompressor: {
        hitTest(mx, my, effect) {
            const th = effect.getParams().threshold != null ? effect.getParams().threshold : -20;
            const ratio = effect.getParams().ratio != null ? effect.getParams().ratio : 2;
            const vuW = W * 0.6, curveX = vuW + 10, curveW = W - vuW - 20, pad = 8;
            const dbMin = -60, dbMax = 0;
            const thX = curveX + ((th - dbMin) / (dbMax - dbMin)) * curveW;
            const thY = pad + (H - pad * 2) - ((th - dbMin) / (dbMax - dbMin)) * (H - pad * 2);
            if (dst(mx, my, thX, thY) < 14) return { id: 'thresh', cursor: 'grab' };
            return null;
        },
        onDrag(id, mx, my, effect) {
            if (id !== 'thresh') return;
            const vuW = W * 0.6, curveX = vuW + 10, curveW = W - vuW - 20, pad = 8;
            const dbMin = -60, dbMax = 0;
            const db = clamp(dbMin + ((mx - curveX) / curveW) * (dbMax - dbMin), -40, 0);
            effect.setParam('threshold', Math.round(db * 2) / 2);
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'thresh', h = hoverId === 'thresh';
            if (!a && !h) return;
            const th = effect.getParams().threshold ?? -20;
            const vuW = W * 0.6, curveX = vuW + 10, curveW = W - vuW - 20, pad = 8;
            const dbMin = -60, dbMax = 0;
            const thX = curveX + ((th - dbMin) / (dbMax - dbMin)) * curveW;
            const thY = pad + (H - pad * 2) - ((th - dbMin) / (dbMax - dbMin)) * (H - pad * 2);
            drawDot(ctx, thX, thY, a ? 8 : 6, ac, a, h);
        }
    },

    // ───────────── Limiter ──────────────────────────────────────
    Limiter: {
        hitTest(mx, my, effect) {
            const ceiling = effect.getParams().ceiling ?? 0;
            const pad = 10;
            const ceilY = pad + 8;
            if (Math.abs(my - ceilY) < 12 && mx > pad && mx < W - pad) return { id: 'ceiling', cursor: 'ns-resize' };
            return null;
        },
        onDrag(id, _mx, my, effect) {
            if (id !== 'ceiling') return;
            // Ceiling line is at pad+8 when ceiling=0. Drag down means more negative ceiling.
            const pad = 10;
            const norm = clamp((my - pad - 8) / (H - pad * 2 - 30), 0, 1);
            effect.setParam('ceiling', clamp(Math.round(-norm * 12 * 10) / 10, -12, 0));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'ceiling', h = hoverId === 'ceiling';
            if (!a && !h) return;
            drawHLine(ctx, 10 + 8, 10, W - 10, ac, a, h);
        }
    },

    // ───────────── Gate ─────────────────────────────────────────
    Gate: {
        hitTest(mx, my, effect) {
            const th = effect.getParams().threshold ?? -40;
            const pad = 10, dbMin = -60, dbMax = 0;
            const thY = pad + (1 - (th - dbMin) / (dbMax - dbMin)) * (H - pad * 2);
            if (Math.abs(my - thY) < 10 && mx > 44 && mx < W - 60) return { id: 'thresh', cursor: 'ns-resize' };
            return null;
        },
        onDrag(id, _mx, my, effect) {
            if (id !== 'thresh') return;
            const pad = 10, dbMin = -60, dbMax = 0;
            const db = clamp(dbMin + (1 - (my - pad) / (H - pad * 2)) * (dbMax - dbMin), -80, 0);
            effect.setParam('threshold', Math.round(db));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'thresh', h = hoverId === 'thresh';
            if (!a && !h) return;
            const th = effect.getParams().threshold ?? -40;
            const pad = 10, dbMin = -60, dbMax = 0;
            const thY = pad + (1 - (th - dbMin) / (dbMax - dbMin)) * (H - pad * 2);
            drawHLine(ctx, thY, 44, W - 60, ac, a, h);
        }
    },

    // ───────────── Sidechain ────────────────────────────────────
    SidechainCompressor: {
        hitTest(mx, my, effect) {
            const depth = effect.getParams().depth ?? 0.8;
            const pad = 10, mX = pad + 34, mW = 24, mH = H - pad * 2;
            const depthY = pad + mH * (1 - depth);
            if (mx >= mX - 4 && mx <= mX + mW + 4 && Math.abs(my - depthY) < 12) return { id: 'depth', cursor: 'ns-resize' };
            return null;
        },
        onDrag(id, _mx, my, effect) {
            if (id !== 'depth') return;
            const pad = 10, mH = H - pad * 2;
            effect.setParam('depth', clamp(Math.round((1 - (my - pad) / mH) * 100) / 100, 0, 1));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'depth', h = hoverId === 'depth';
            if (!a && !h) return;
            const depth = effect.getParams().depth ?? 0.8;
            const pad = 10, mX = pad + 34, mW = 24, mH = H - pad * 2;
            drawHLine(ctx, pad + mH * (1 - depth), mX - 4, mX + mW + 4, ac, a, h);
        }
    },

    // ───────────── Saturation ───────────────────────────────────
    Saturation: {
        hitTest(mx, my, effect) {
            const p = effect.getParams();
            const pt = curvePt(0.5, p.drive ?? 0.5, p.mode || 'tube', false);
            if (dst(mx, my, pt.x, pt.y) < 16) return { id: 'drive', cursor: 'grab' };
            if (mx > W - 60 && my < 20) return { id: 'mode', cursor: 'pointer', clickOnly: true };
            return null;
        },
        onDrag(id, _mx, my, effect) {
            if (id !== 'drive') return;
            const pad = 12, cH = H - pad * 2;
            effect.setParam('drive', clamp(Math.round((1 - (my - pad) / cH) * 100) / 100, 0, 1));
        },
        onClick(id, effect) {
            if (id === 'mode') {
                const modes = ['tube', 'tape', 'digital'];
                const cur = effect.getParams().mode || 'tube';
                effect.setParam('mode', modes[(modes.indexOf(cur) + 1) % modes.length]);
            }
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const p = effect.getParams();
            const isDrive = dragId === 'drive' || hoverId === 'drive';
            if (isDrive) {
                const pt = curvePt(0.5, p.drive ?? 0.5, p.mode || 'tube', false);
                drawDot(ctx, pt.x, pt.y, dragId === 'drive' ? 8 : 6, ac, dragId === 'drive', hoverId === 'drive');
            }
            if (dragId === 'mode' || hoverId === 'mode') {
                ctx.strokeStyle = ac; ctx.lineWidth = 1; ctx.strokeRect(W - 58, 8, 50, 16);
            }
        },
        onContextMenu(mx, my, effect) {
            const modes = ['tube', 'tape', 'digital'];
            const cur = effect.getParams().mode || 'tube';
            effect.setParam('mode', modes[(modes.indexOf(cur) + 1) % modes.length]);
            return true;
        }
    },

    // ───────────── Distortion ───────────────────────────────────
    Distortion: {
        hitTest(mx, my, effect) {
            const p = effect.getParams();
            const pt = curvePt(0.5, p.gain ?? 0.5, p.mode || 'hardClip', true);
            if (dst(mx, my, pt.x, pt.y) < 16) return { id: 'gain', cursor: 'grab' };
            if (mx > W - 62 && my < 20) return { id: 'mode', cursor: 'pointer', clickOnly: true };
            return null;
        },
        onDrag(id, _mx, my, effect) {
            if (id !== 'gain') return;
            const pad = 12, cH = H - pad * 2;
            effect.setParam('gain', clamp(Math.round((1 - (my - pad) / cH) * 100) / 100, 0, 1));
        },
        onClick(id, effect) {
            if (id === 'mode') {
                const modes = ['softClip', 'hardClip', 'foldback', 'bitCrush'];
                const cur = effect.getParams().mode || 'hardClip';
                effect.setParam('mode', modes[(modes.indexOf(cur) + 1) % modes.length]);
            }
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const p = effect.getParams();
            const isGain = dragId === 'gain' || hoverId === 'gain';
            if (isGain) {
                const pt = curvePt(0.5, p.gain ?? 0.5, p.mode || 'hardClip', true);
                drawDot(ctx, pt.x, pt.y, dragId === 'gain' ? 8 : 6, ac, dragId === 'gain', hoverId === 'gain');
            }
            if (dragId === 'mode' || hoverId === 'mode') {
                ctx.strokeStyle = ac; ctx.lineWidth = 1; ctx.strokeRect(W - 63, 8, 56, 16);
            }
        },
        onContextMenu(mx, my, effect) {
            const modes = ['softClip', 'hardClip', 'foldback', 'bitCrush'];
            const cur = effect.getParams().mode || 'hardClip';
            effect.setParam('mode', modes[(modes.indexOf(cur) + 1) % modes.length]);
            return true;
        }
    },

    // ───────────── Reverb ───────────────────────────────────────
    Reverb: {
        hitTest(mx, my, effect) {
            const p = effect.getParams();
            const preDelay = p.preDelay ?? 0.02, decay = p.decay ?? 2.5;
            const tMax = Math.max(decay * 1.5, 3);
            const pdX = revTimeToX(preDelay, tMax);
            if (Math.abs(mx - pdX) < 10 && my > 10 && my < H - 10) return { id: 'preDelay', cursor: 'ew-resize' };
            const dX = revTimeToX(decay, tMax);
            if (Math.abs(mx - dX) < 12 && my > H / 2 - 20 && my < H / 2 + 20) return { id: 'decay', cursor: 'ew-resize' };
            return null;
        },
        onDrag(id, mx, _my, effect) {
            const p = effect.getParams();
            const decay = p.decay ?? 2.5;
            const tMax = Math.max(decay * 1.5, 3);
            if (id === 'preDelay') effect.setParam('preDelay', clamp(Math.round(revXToTime(mx, tMax) * 1000) / 1000, 0, 0.2));
            else if (id === 'decay') effect.setParam('decay', clamp(Math.round(revXToTime(mx, tMax) * 10) / 10, 0.1, 10));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const p = effect.getParams();
            const preDelay = p.preDelay ?? 0.02, decay = p.decay ?? 2.5;
            const tMax = Math.max(decay * 1.5, 3);
            const aPd = dragId === 'preDelay', hPd = hoverId === 'preDelay';
            if (aPd || hPd) drawVLine(ctx, revTimeToX(preDelay, tMax), 10, H - 10, ac, aPd, hPd);
            const aD = dragId === 'decay', hD = hoverId === 'decay';
            if (aD || hD) drawDot(ctx, revTimeToX(decay, tMax), H / 2, aD ? 8 : 6, ac, aD, hD);
        }
    },

    // ───────────── Delay ────────────────────────────────────────
    Delay: {
        hitTest(mx, my, effect) {
            const p = effect.getParams();
            const fb = p.feedback ?? 0.4;
            const pad = 10, mid = H / 2, barW = (W - pad * 2) / 9;
            // Second bar (shows feedback level): amplitude = feedback^1
            const x2 = pad + barW * 1.5 + barW * 0.3;
            const bH = fb * (mid - pad - 6);
            const bTop = mid - bH - 2;
            if (dst(mx, my, x2, bTop) < 14) return { id: 'feedback', cursor: 'ns-resize' };
            return null;
        },
        onDrag(id, _mx, my, effect) {
            if (id !== 'feedback') return;
            const mid = H / 2, pad = 10, maxH = mid - pad - 6;
            effect.setParam('feedback', clamp(Math.round((mid - 2 - my) / maxH * 100) / 100, 0, 0.95));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'feedback', h = hoverId === 'feedback';
            if (!a && !h) return;
            const fb = effect.getParams().feedback ?? 0.4;
            const pad = 10, mid = H / 2, barW = (W - pad * 2) / 9;
            const x2 = pad + barW * 1.5 + barW * 0.3;
            const bH = fb * (mid - pad - 6);
            drawDot(ctx, x2, mid - bH - 2, a ? 7 : 5, ac, a, h);
        }
    },

    // ───────────── Echo ─────────────────────────────────────────
    Echo: {
        hitTest(mx, my, effect) {
            const p = effect.getParams();
            const times = [p.time1 ?? 0.25, p.time2 ?? 0.5, p.time3 ?? 0.75];
            const maxT = Math.max(...times) * 2, mid = H / 2;
            for (let i = 0; i < 3; i++) {
                const x = echoTapX(times[i], maxT);
                if (dst(mx, my, x, mid) < 14) return { id: `tap-${i}`, cursor: 'ew-resize' };
            }
            return null;
        },
        onDrag(id, mx, _my, effect) {
            const idx = parseInt(id.split('-')[1]);
            const keys = ['time1', 'time2', 'time3'];
            const p = effect.getParams();
            const times = [p.time1 ?? 0.25, p.time2 ?? 0.5, p.time3 ?? 0.75];
            const maxT = Math.max(...times) * 2;
            effect.setParam(keys[idx], clamp(Math.round(echoXToTime(mx, maxT) * 100) / 100, 0.01, 2.0));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const p = effect.getParams();
            const times = [p.time1 ?? 0.25, p.time2 ?? 0.5, p.time3 ?? 0.75];
            const maxT = Math.max(...times) * 2, mid = H / 2;
            for (let i = 0; i < 3; i++) {
                const id = `tap-${i}`, a = dragId === id, h = hoverId === id;
                if (a || h) drawDot(ctx, echoTapX(times[i], maxT), mid, a ? 8 : 6, ac, a, h);
            }
        }
    },

    // ───────────── Chorus ───────────────────────────────────────
    Chorus: {
        hitTest(mx, my, effect) {
            const depth = effect.getParams().depth ?? 0.005;
            const pad = 10, mid = H / 2;
            // Normalize depth to visual range: depth is 0.0001-0.02, visual amp is depth * (mid-pad-10)
            // This is very small, so use a scaled version for the handle
            const normDepth = clamp((depth - 0.0001) / (0.02 - 0.0001), 0, 1);
            const amp = normDepth * (mid - pad - 10);
            const arrowX = W - 28;
            if (Math.abs(mx - arrowX) < 14 && (Math.abs(my - (mid - amp)) < 12 || Math.abs(my - (mid + amp)) < 12))
                return { id: 'depth', cursor: 'ns-resize' };
            return null;
        },
        onDrag(id, _mx, my, effect) {
            if (id !== 'depth') return;
            const pad = 10, mid = H / 2, maxAmp = mid - pad - 10;
            const amp = clamp(Math.abs(my - mid), 0, maxAmp);
            const normDepth = amp / maxAmp;
            effect.setParam('depth', clamp(0.0001 + normDepth * (0.02 - 0.0001), 0.0001, 0.02));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'depth', h = hoverId === 'depth';
            if (!a && !h) return;
            const depth = effect.getParams().depth ?? 0.005;
            const pad = 10, mid = H / 2;
            const normDepth = clamp((depth - 0.0001) / (0.02 - 0.0001), 0, 1);
            const amp = normDepth * (mid - pad - 10);
            const arrowX = W - 28;
            drawDot(ctx, arrowX, mid - amp, a ? 6 : 4, ac, a, h);
            drawDot(ctx, arrowX, mid + amp, a ? 6 : 4, ac, a, h);
        }
    },

    // ───────────── Phaser ───────────────────────────────────────
    Phaser: {
        hitTest(mx, my, effect) {
            const p = effect.getParams();
            const centerFreq = p.centerFreq ?? 1000;
            const pad = 10, fMin = 100, fMax = 10000;
            const cx = pad + (Math.log10(centerFreq / fMin) / Math.log10(fMax / fMin)) * (W - pad * 2);
            if (Math.abs(mx - cx) < 12 && my > pad && my < H - pad) return { id: 'center', cursor: 'ew-resize' };
            return null;
        },
        onDrag(id, mx, _my, effect) {
            if (id !== 'center') return;
            const pad = 10, fMin = 100, fMax = 10000;
            const ratio = clamp((mx - pad) / (W - pad * 2), 0, 1);
            const freq = fMin * Math.pow(fMax / fMin, ratio);
            effect.setParam('centerFreq', clamp(Math.round(freq / 10) * 10, 200, 5000));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'center', h = hoverId === 'center';
            if (!a && !h) return;
            const cf = effect.getParams().centerFreq ?? 1000;
            const pad = 10, fMin = 100, fMax = 10000;
            const cx = pad + (Math.log10(cf / fMin) / Math.log10(fMax / fMin)) * (W - pad * 2);
            drawVLine(ctx, cx, pad, H - pad, ac, a, h);
        }
    },

    // ───────────── Stereo Widener ───────────────────────────────
    StereoWidener: {
        hitTest(mx, my, effect) {
            const width = effect.getParams().width ?? 0.5;
            const pad = 10, barY = pad, barH = 10, barX = pad + 30, barW = W - pad * 2 - 60;
            const widthNorm = Math.min(width / 2, 1);
            const endX = barX + barW * widthNorm;
            if (Math.abs(mx - endX) < 10 && Math.abs(my - (barY + barH / 2)) < 12) return { id: 'width', cursor: 'ew-resize' };
            return null;
        },
        onDrag(id, mx, _my, effect) {
            if (id !== 'width') return;
            const pad = 10, barX = pad + 30, barW = W - pad * 2 - 60;
            const norm = clamp((mx - barX) / barW, 0, 1);
            effect.setParam('width', clamp(Math.round(norm * 2 * 100) / 100, 0, 1));
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const a = dragId === 'width', h = hoverId === 'width';
            if (!a && !h) return;
            const width = effect.getParams().width ?? 0.5;
            const pad = 10, barX = pad + 30, barW = W - pad * 2 - 60, barY = pad, barH = 10;
            const endX = barX + barW * Math.min(width / 2, 1);
            drawDot(ctx, endX, barY + barH / 2, a ? 7 : 5, ac, a, h);
        }
    },

    // ───────────── Utility ──────────────────────────────────────
    Utility: {
        hitTest(mx, my, effect) {
            const p = effect.getParams();
            const pan = p.pan ?? 0;
            // Pan ball
            const panX = 60, panW = W - 120, panY = H / 2 - 8, panH = 16;
            const panCenter = panX + panW / 2;
            const ballX = panCenter + pan * (panW / 2);
            if (dst(mx, my, ballX, panY + panH / 2) < 12) return { id: 'pan', cursor: 'ew-resize' };
            // Gain meter
            const pad = 10;
            const gain = p.gain ?? 1;
            const gainNorm = clamp((gain + 24) / 48, 0, 1);
            const meterH = H - pad * 2 - 20;
            const gainY = pad + 10 + meterH * (1 - gainNorm);
            if (mx >= pad && mx <= pad + 24 && Math.abs(my - gainY) < 12) return { id: 'gain', cursor: 'ns-resize' };
            // Phase LED
            if (dst(mx, my, W - 50, H - 20) < 10) return { id: 'phase', cursor: 'pointer', clickOnly: true };
            // Mono LED
            if (dst(mx, my, W - 20, H - 20) < 10) return { id: 'mono', cursor: 'pointer', clickOnly: true };
            return null;
        },
        onDrag(id, mx, my, effect) {
            if (id === 'pan') {
                const panX = 60, panW = W - 120, panCenter = panX + panW / 2;
                effect.setParam('pan', clamp(Math.round((mx - panCenter) / (panW / 2) * 100) / 100, -1, 1));
            } else if (id === 'gain') {
                const pad = 10, meterH = H - pad * 2 - 20;
                const gainNorm = clamp(1 - (my - pad - 10) / meterH, 0, 1);
                // Convert from normalized meter position to linear gain (0-2)
                effect.setParam('gain', clamp(Math.round(gainNorm * 2 * 100) / 100, 0, 2));
            }
        },
        onClick(id, effect) {
            if (id === 'phase') effect.setParam('phaseInvert', !effect.getParams().phaseInvert);
            if (id === 'mono') effect.setParam('mono', !effect.getParams().mono);
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const p = effect.getParams();
            // Pan handle
            const aPan = dragId === 'pan', hPan = hoverId === 'pan';
            if (aPan || hPan) {
                const panX = 60, panW = W - 120, panCenter = panX + panW / 2;
                const ballX = panCenter + (p.pan ?? 0) * (panW / 2);
                drawDot(ctx, ballX, H / 2, aPan ? 8 : 6, ac, aPan, hPan);
            }
            // Gain handle
            const aG = dragId === 'gain', hG = hoverId === 'gain';
            if (aG || hG) {
                const pad = 10, gainNorm = clamp(((p.gain ?? 1) + 24) / 48, 0, 1);
                const meterH = H - pad * 2 - 20;
                const gainY = pad + 10 + meterH * (1 - gainNorm);
                drawHLine(ctx, gainY, pad - 2, pad + 26, ac, aG, hG);
            }
            // LED highlights
            if (hoverId === 'phase' || dragId === 'phase') {
                ctx.strokeStyle = ac; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(W - 50, H - 20, 10, 0, Math.PI * 2); ctx.stroke();
            }
            if (hoverId === 'mono' || dragId === 'mono') {
                ctx.strokeStyle = ac; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(W - 20, H - 20, 10, 0, Math.PI * 2); ctx.stroke();
            }
        }
    },

    // ───────────── Auto Pan ─────────────────────────────────────
    AutoPan: {
        hitTest(mx, my, effect) {
            const p = effect.getParams();
            const depth = p.depth ?? 0.5;
            const pad = 10, trackY = H / 2 - 15, trackH = 30, trackX = pad + 20, trackW = W - pad * 2 - 40;
            const endX = trackX + trackW / 2 + depth * (trackW / 2);
            if (Math.abs(mx - endX) < 12 && my >= trackY && my <= trackY + trackH) return { id: 'depth', cursor: 'ew-resize' };
            // Shape label click
            if (my < pad + 14 && mx > W / 2 - 40 && mx < W / 2 + 40) return { id: 'shape', cursor: 'pointer', clickOnly: true };
            return null;
        },
        onDrag(id, mx, _my, effect) {
            if (id !== 'depth') return;
            const pad = 10, trackX = pad + 20, trackW = W - pad * 2 - 40;
            const center = trackX + trackW / 2;
            effect.setParam('depth', clamp(Math.round(Math.abs(mx - center) / (trackW / 2) * 100) / 100, 0, 1));
        },
        onClick(id, effect) {
            if (id === 'shape') {
                const shapes = ['sine', 'triangle', 'square', 'sawtooth'];
                const cur = effect.getParams().shape || 'sine';
                effect.setParam('shape', shapes[(shapes.indexOf(cur) + 1) % shapes.length]);
            }
        },
        drawOverlays(ctx, effect, ac, dragId, hoverId) {
            const aD = dragId === 'depth', hD = hoverId === 'depth';
            if (aD || hD) {
                const depth = effect.getParams().depth ?? 0.5;
                const pad = 10, trackX = pad + 20, trackW = W - pad * 2 - 40, trackY = H / 2 - 15, trackH = 30;
                const endX = trackX + trackW / 2 + depth * (trackW / 2);
                drawDot(ctx, endX, trackY + trackH / 2, aD ? 7 : 5, ac, aD, hD);
            }
            if (hoverId === 'shape' || dragId === 'shape') {
                ctx.strokeStyle = ac; ctx.lineWidth = 1;
                ctx.strokeRect(W / 2 - 42, 2, 84, 14);
            }
        },
        onContextMenu(mx, my, effect) {
            const shapes = ['sine', 'triangle', 'square', 'sawtooth'];
            const cur = effect.getParams().shape || 'sine';
            effect.setParam('shape', shapes[(shapes.indexOf(cur) + 1) % shapes.length]);
            return true;
        }
    },

    // ════════════════════ LOOM SAUCE ═══════════════════════════════
    LoomSauce: (() => {
        const PAD = 6, SEC_COUNT = 6;
        const secW = (W - PAD * 2) / SEC_COUNT;
        const secH = H - PAD * 2;
        const visY = PAD + 32, visH = secH - 38;
        const bypassKeys = ['compBypass', 'enhBypass', 'eqBypass', 'multBypass', 'spaceBypass', 'gainBypass'];

        function secX(i) { return PAD + i * secW; }
        function secCx(i) { return secX(i) + secW / 2; }
        // LED position for each section
        function ledXY(i) { return { x: secCx(i), y: PAD + 22 }; }

        // Enhance bar positions (section i=1)
        function enhBarX(b) {
            const cx = secCx(1), bW = 8, gap = 4, totalW = 3 * bW + 2 * gap;
            return cx - totalW / 2 + b * (bW + gap);
        }
        const ENH_BW = 8;
        const enhKeys = ['enhAir', 'enhWarmth', 'enhPresence'];

        // EQ section (i=2): 3 control points at low, mid, high positions
        function eqCtrl(p) {
            const sx = secX(2), eqW2 = secW - 8;
            const midFn = ((p.eqMidFreq || 1000) - 200) / 7800;
            return [
                { key: 'eqLowGain', fx: 0.15, val: p.eqLowGain || 0 },
                { key: 'eqMidGain', fx: clamp(midFn, 0.1, 0.9), val: p.eqMidGain || 0 },
                { key: 'eqHighGain', fx: 0.75, val: p.eqHighGain || 0 }
            ].map(c => ({
                ...c,
                x: sx + 4 + c.fx * eqW2,
                y: visY + visH / 2 - (c.val / 12) * (visH / 2)
            }));
        }

        // Comp section (i=0): threshold + ratio bar positions
        const COMP_BW = 8;
        function compBarX() {
            const cx = secCx(0);
            return { threshX: cx - COMP_BW - 3, ratioX: cx + 3, bW: COMP_BW };
        }

        // Space section (i=4) bar positions
        function spaceBarX() {
            const cx = secCx(4), bW2 = 10;
            return { sizeX: cx - bW2 - 3, mixX: cx + 3, bW: bW2 };
        }

        return {
            hitTest(mx, my, effect) {
                const p = effect.getParams();
                // 1. Bypass LEDs (all 6 sections)
                for (let i = 0; i < 6; i++) {
                    const led = ledXY(i);
                    if (dst(mx, my, led.x, led.y) < 10) return { id: `bypass-${i}`, cursor: 'pointer', clickOnly: true };
                }
                // 2. COMP threshold + ratio bars (section 0)
                if (!p.compBypass) {
                    const cb = compBarX();
                    if (mx >= cb.threshX - 2 && mx <= cb.threshX + cb.bW + 2 && my >= visY && my <= visY + visH) {
                        return { id: 'comp-thresh', cursor: 'ns-resize' };
                    }
                    if (mx >= cb.ratioX - 2 && mx <= cb.ratioX + cb.bW + 2 && my >= visY && my <= visY + visH) {
                        return { id: 'comp-ratio', cursor: 'ns-resize' };
                    }
                }
                // 3. GAIN limiter LED (section 5)
                if (!p.gainBypass) {
                    const lx = secCx(5), ly = visY + visH - 8;
                    if (dst(mx, my, lx, ly) < 10) return { id: 'limiter', cursor: 'pointer', clickOnly: true };
                }
                // 3. ENHANCE bars (section 1)
                if (!p.enhBypass) {
                    for (let b = 0; b < 3; b++) {
                        const bx = enhBarX(b);
                        if (mx >= bx - 2 && mx <= bx + ENH_BW + 2 && my >= visY && my <= visY + visH) {
                            return { id: `enh-${b}`, cursor: 'ns-resize' };
                        }
                    }
                }
                // 4. EQ curve control points (section 2)
                if (!p.eqBypass) {
                    const pts = eqCtrl(p);
                    for (let j = 0; j < pts.length; j++) {
                        if (dst(mx, my, pts[j].x, pts[j].y) < 14) return { id: `eq-${j}`, cursor: 'ns-resize' };
                    }
                }
                // 5. MULTIPLY: center dot for amount, side arcs for width (section 3)
                if (!p.multBypass) {
                    const cx = secCx(3), midY = visY + visH / 2;
                    const amt = p.multAmount || 0;
                    const wdt = p.multWidth || 0.5;
                    const spread = wdt * (secW / 2 - 6);
                    if (amt > 0.01) {
                        if (dst(mx, my, cx - spread, midY) < 12) return { id: 'mult-width', cursor: 'ew-resize' };
                        if (dst(mx, my, cx + spread, midY) < 12) return { id: 'mult-width', cursor: 'ew-resize' };
                    }
                    if (dst(mx, my, cx, midY) < 12) return { id: 'mult-amount', cursor: 'ns-resize' };
                }
                // 6. SPACE bars (section 4)
                if (!p.spaceBypass) {
                    const sb = spaceBarX();
                    if (mx >= sb.sizeX - 2 && mx <= sb.sizeX + sb.bW + 2 && my >= visY && my <= visY + visH) {
                        return { id: 'space-size', cursor: 'ns-resize' };
                    }
                    if (mx >= sb.mixX - 2 && mx <= sb.mixX + sb.bW + 2 && my >= visY && my <= visY + visH) {
                        return { id: 'space-mix', cursor: 'ns-resize' };
                    }
                }
                // 7. GAIN meter (section 5)
                if (!p.gainBypass) {
                    const gx = secCx(5) - 5;
                    if (mx >= gx - 2 && mx <= gx + 12 && my >= visY && my <= visY + visH - 20) {
                        return { id: 'gain-level', cursor: 'ns-resize' };
                    }
                }
                return null;
            },

            onDrag(id, mx, my, effect) {
                const p = effect.getParams();
                // Vertical meter drags: map my to 0..1 (bottom=0, top=1)
                const meterVal = clamp(1 - (my - visY) / (visH - 12), 0, 1);

                if (id === 'comp-thresh') {
                    // Map 0..1 to -60..0 dB
                    const th = clamp(meterVal * 60 - 60, -60, 0);
                    effect.setParam('compThreshold', Math.round(th));
                } else if (id === 'comp-ratio') {
                    // Map 0..1 to 1..20
                    const ra = clamp(meterVal * 19 + 1, 1, 20);
                    effect.setParam('compRatio', Math.round(ra * 10) / 10);
                } else if (id.startsWith('enh-')) {
                    const b = +id.split('-')[1];
                    effect.setParam(enhKeys[b], clamp(meterVal, 0, 1));
                } else if (id.startsWith('eq-')) {
                    const j = +id.split('-')[1];
                    const keys = ['eqLowGain', 'eqMidGain', 'eqHighGain'];
                    // Map Y to dB range -12..+12
                    const db = clamp(-((my - visY - visH / 2) / (visH / 2)) * 12, -12, 12);
                    effect.setParam(keys[j], Math.round(db * 10) / 10);
                } else if (id === 'mult-amount') {
                    const cx = secCx(3), midY = visY + visH / 2;
                    // Vertical: top=1, bottom=0
                    const val = clamp(1 - (my - (midY - visH / 3)) / (visH * 2 / 3), 0, 1);
                    effect.setParam('multAmount', Math.round(val * 100) / 100);
                } else if (id === 'mult-width') {
                    const cx = secCx(3), maxSpread = secW / 2 - 6;
                    const spread = clamp(Math.abs(mx - cx) / maxSpread, 0, 1);
                    effect.setParam('multWidth', Math.round(spread * 100) / 100);
                } else if (id === 'space-size') {
                    effect.setParam('spaceSize', clamp(meterVal, 0, 1));
                } else if (id === 'space-mix') {
                    effect.setParam('spaceMix', clamp(meterVal, 0, 1));
                } else if (id === 'gain-level') {
                    // Gain meter maps to 0..2
                    const gMeterVal = clamp(1 - (my - visY) / (visH - 20), 0, 1);
                    effect.setParam('gainLevel', Math.round(gMeterVal * 200) / 100);
                }
            },

            onClick(id, effect) {
                if (id.startsWith('bypass-')) {
                    const i = +id.split('-')[1];
                    const key = bypassKeys[i];
                    effect.setParam(key, !effect.getParams()[key]);
                } else if (id === 'limiter') {
                    effect.setParam('gainLimiter', !effect.getParams().gainLimiter);
                }
            },

            drawOverlays(ctx, effect, ac, dragId, hoverId) {
                const p = effect.getParams();

                // Bypass LED highlights
                for (let i = 0; i < 6; i++) {
                    const led = ledXY(i);
                    const isActive = dragId === `bypass-${i}`;
                    const isHover = hoverId === `bypass-${i}`;
                    if (isActive || isHover) {
                        ctx.beginPath();
                        ctx.arc(led.x, led.y, 8, 0, Math.PI * 2);
                        ctx.strokeStyle = ac + (isActive ? 'aa' : '55');
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                }

                // Comp bar handles (threshold + ratio)
                if (!p.compBypass) {
                    const cb = compBarX();
                    for (const [barId, bx, paramKey, minV, maxV] of [
                        ['comp-thresh', cb.threshX, 'compThreshold', -60, 0],
                        ['comp-ratio', cb.ratioX, 'compRatio', 1, 20]
                    ]) {
                        const active = dragId === barId, hover = hoverId === barId;
                        if (active || hover) {
                            const raw = paramKey === 'compThreshold' ? (p[paramKey] ?? -18) : (p[paramKey] ?? 3);
                            const norm = (raw - minV) / (maxV - minV);
                            const barH = visH - 12;
                            const fillY = visY + 2 + barH * (1 - norm);
                            drawDot(ctx, bx + cb.bW / 2, fillY, active ? 5 : 4, barId.includes('thresh') ? ac : '#ffd93d', active, hover);
                        }
                    }
                }

                // Enhance bar handles
                if (!p.enhBypass) {
                    for (let b = 0; b < 3; b++) {
                        const bId = `enh-${b}`;
                        const active = dragId === bId, hover = hoverId === bId;
                        if (active || hover) {
                            const bx = enhBarX(b);
                            const val = p[enhKeys[b]] || 0;
                            const barH = visH - 12;
                            const fillY = visY + 2 + barH * (1 - val);
                            drawDot(ctx, bx + ENH_BW / 2, fillY, active ? 5 : 4, ac, active, hover);
                        }
                    }
                }

                // EQ control point highlights
                if (!p.eqBypass) {
                    const pts = eqCtrl(p);
                    const labels = ['L', 'M', 'H'];
                    for (let j = 0; j < pts.length; j++) {
                        const eId = `eq-${j}`;
                        const active = dragId === eId, hover = hoverId === eId;
                        if (active || hover) {
                            drawDot(ctx, pts[j].x, pts[j].y, active ? 6 : 5, ac, active, hover);
                        }
                        // Always show small dots on eq curve control points
                        ctx.beginPath();
                        ctx.arc(pts[j].x, pts[j].y, 3, 0, Math.PI * 2);
                        ctx.fillStyle = ac + '88';
                        ctx.fill();
                        // Label
                        ctx.font = 'bold 6px monospace';
                        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                        ctx.fillStyle = '#fff';
                        ctx.shadowColor = '#000'; ctx.shadowBlur = 2;
                        ctx.fillText(labels[j], pts[j].x, pts[j].y - 5);
                        ctx.shadowBlur = 0;
                    }
                }

                // Multiply handles
                if (!p.multBypass) {
                    const cx = secCx(3), midY = visY + visH / 2;
                    const aActive = dragId === 'mult-amount', aHover = hoverId === 'mult-amount';
                    if (aActive || aHover) {
                        drawDot(ctx, cx, midY, aActive ? 6 : 5, ac, aActive, aHover);
                    }
                    const wActive = dragId === 'mult-width', wHover = hoverId === 'mult-width';
                    if (wActive || wHover) {
                        const wdt = p.multWidth || 0.5;
                        const spread = wdt * (secW / 2 - 6);
                        drawDot(ctx, cx - spread, midY, wActive ? 5 : 4, '#4488ff', wActive, wHover);
                        drawDot(ctx, cx + spread, midY, wActive ? 5 : 4, '#ff4444', wActive, wHover);
                    }
                }

                // Space bar handles
                if (!p.spaceBypass) {
                    const sb = spaceBarX();
                    for (const [barId, bx] of [['space-size', sb.sizeX], ['space-mix', sb.mixX]]) {
                        const active = dragId === barId, hover = hoverId === barId;
                        if (active || hover) {
                            const val = barId === 'space-size' ? (p.spaceSize || 0.3) : (p.spaceMix || 0.15);
                            const barH2 = visH - 12;
                            const fillY = visY + 2 + barH2 * (1 - val);
                            drawDot(ctx, bx + sb.bW / 2, fillY, active ? 5 : 4, ac, active, hover);
                        }
                    }
                }

                // Gain meter handle
                if (!p.gainBypass) {
                    const gActive = dragId === 'gain-level', gHover = hoverId === 'gain-level';
                    if (gActive || gHover) {
                        const lvl = p.gainLevel != null ? p.gainLevel : 1.0;
                        const lvlN = Math.min(lvl / 2, 1);
                        const mH = visH - 20;
                        const fillY = visY + 2 + mH * (1 - lvlN);
                        drawDot(ctx, secCx(5), fillY, gActive ? 5 : 4, ac, gActive, gHover);
                    }
                    // Limiter LED highlight
                    const lActive = dragId === 'limiter', lHover = hoverId === 'limiter';
                    if (lActive || lHover) {
                        const lx = secCx(5), ly = visY + visH - 8;
                        ctx.beginPath();
                        ctx.arc(lx, ly, 7, 0, Math.PI * 2);
                        ctx.strokeStyle = ac + (lActive ? 'aa' : '55');
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                }
            }
        };
    })(),
};
