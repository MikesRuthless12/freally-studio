// recipes/808.js — 808 v2 melodic engine (TASK-A03)
//
// Sound architecture (one-shot pad and melodic engine share it):
//   osc(sine, pitch env) → stage-1 tanh (ALWAYS on — phone-speaker audibility)
//   → [dry + stage-2 hard tanh × 'distortion' in parallel] → tone lowpass
//   → note envelope → highpass 25 Hz (DC/rumble guard) → soft clip → mono out
//
// Key tracking: noteToHz(midiNote) + per-preset 'tuneOffset' semitones —
// presets store an offset, never an absolute melodic pitch. The legacy
// 'pitch' (Hz) param still drives the untracked drum-pad one-shot.
//
// Glide: Melodic808Engine reuses its single voice — a noteOn while sounding
// exponential-ramps frequency over 'glide' ms and re-energizes the envelope
// from its current value. Legato: nothing retriggers, nothing clicks.

import { semitoneRatio } from '../DrumVoice.js';

export function noteToHz(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

const ENV_FLOOR = 0.001;

function tanhCurve(ctx, k, normalize) {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / (n - 1) - 1;
        curve[i] = normalize ? Math.tanh(k * x) / k : Math.tanh(k * x);
    }
    const ws = ctx.createWaveShaper();
    ws.curve = curve;
    ws.oversample = '4x';
    return ws;
}

/**
 * Builds the shared post-oscillator chain. Returns { input, envGain, output }.
 * Caller connects an oscillator to input and output to the destination.
 */
export function build808Chain(ctx, p) {
    const input = ctx.createGain();

    // stage 1 — gentle tanh, always on
    const stage1 = tanhCurve(ctx, 2, false);
    input.connect(stage1);

    // stage 2 — harder drive, mixed in parallel by 'distortion'
    const distortion = p.distortion ?? 0.1;
    const mix = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1 - distortion * 0.5;
    stage1.connect(dry);
    dry.connect(mix);
    if (distortion > 0.01) {
        const stage2 = tanhCurve(ctx, 8, false);
        const wet = ctx.createGain();
        wet.gain.value = distortion;
        stage1.connect(stage2);
        stage2.connect(wet);
        wet.connect(mix);
    }

    // tone (legacy lowpass mapping)
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120 + (p.tone ?? 0.3) * 2000;
    mix.connect(lp);

    // note envelope
    const envGain = ctx.createGain();
    envGain.gain.value = 0;
    lp.connect(envGain);

    // DC/rumble guard
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 25;
    hp.Q.value = 0.707;
    envGain.connect(hp);

    // soft clip, then explicit mono
    const clip = tanhCurve(ctx, 1.2, true);
    hp.connect(clip);
    const output = ctx.createGain();
    output.channelCount = 1;
    output.channelCountMode = 'explicit';
    clip.connect(output);

    return { input, envGain, output };
}

// Legacy-shaped envelope with a ≤2 ms anti-click attack:
// 0 → peak (2 ms) → sustain·peak (by pitchDecay) → exp decay to floor.
function scheduleEnvelope(envGain, when, p) {
    const peak = p.volume ?? 0.85;
    const sustain = Math.max((p.sustain ?? 0.6) * peak, ENV_FLOOR);
    envGain.gain.setValueAtTime(0, when);
    envGain.gain.linearRampToValueAtTime(peak, when + 0.002);
    envGain.gain.exponentialRampToValueAtTime(sustain, when + Math.max(p.pitchDecay ?? 0.15, 0.003));
    envGain.gain.exponentialRampToValueAtTime(ENV_FLOOR, when + (p.decay ?? 1.5));
}

/**
 * One-shot 808 for the drum pad path (DrumSynthEngine.synth808).
 * All legacy params work: pitch, decay, distortion, pitchDecay, startPitch,
 * sustain, tone, volume.
 */
export function oneShot808(ctx, dest, time, p) {
    const chain = build808Chain(ctx, p);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(p.startPitch ?? 120, time);
    osc.frequency.exponentialRampToValueAtTime(p.pitch ?? 40, time + (p.pitchDecay ?? 0.15));
    osc.connect(chain.input);
    scheduleEnvelope(chain.envGain, time, p);
    chain.output.connect(dest);
    osc.start(time);
    osc.stop(time + (p.decay ?? 1.5) + 0.1);
}

/**
 * Melodic 808 with key tracking and legato glide — the piano-roll API.
 *
 *   const bass = new Melodic808Engine(ctx, params);
 *   bass.connect(dest);
 *   bass.noteOn(36, when);        // slides if a note is already sounding
 *   bass.noteOff(when + 0.5);
 *   bass.dispose();
 */
export class Melodic808Engine {
    constructor(ctx, params = {}) {
        this.ctx = ctx;
        this.params = params;
        this._chain = build808Chain(ctx, params);
        this._osc = null;
        this._activeUntil = 0; // time the current note stops sounding
        this._lastHz = 0;      // JS-tracked pitch (param .value is unreliable pre-render)
        this._env = null;      // JS-tracked envelope schedule of the active note
    }

    // Envelope value at time t, computed from the JS-tracked schedule —
    // needed to anchor legato ramps when scheduling into an offline context,
    // where AudioParam.value can't report mid-automation values.
    _envValueAt(t) {
        const e = this._env;
        if (!e || t <= e.t0) return ENV_FLOOR;
        const expInterp = (v0, v1, f) => v0 * Math.pow(v1 / v0, f);
        if (t < e.t0 + 0.002) return Math.max((e.peak * (t - e.t0)) / 0.002, ENV_FLOOR);
        if (t < e.attackEnd) return expInterp(e.peak, e.sustain, (t - e.t0 - 0.002) / (e.attackEnd - e.t0 - 0.002));
        if (t < e.end) return expInterp(e.sustain, ENV_FLOOR, (t - e.attackEnd) / (e.end - e.attackEnd));
        return ENV_FLOOR;
    }

    connect(dest) { this._chain.output.connect(dest); return this; }

    setParams(params) { this.params = { ...this.params, ...params }; }

    _hz(midiNote) {
        return noteToHz(midiNote) * semitoneRatio(this.params.tuneOffset ?? 0);
    }

    noteOn(midiNote, when = this.ctx.currentTime, velocity = 1) {
        const p = this.params;
        const hz = this._hz(midiNote);
        const glide = Math.min(Math.max(p.glide ?? 60, 30), 120) / 1000;
        const gain = this._chain.envGain.gain;
        const peak = (p.volume ?? 0.85) * velocity;
        const sustain = Math.max((p.sustain ?? 0.6) * peak, ENV_FLOOR);

        if (!this._osc) {
            this._osc = this.ctx.createOscillator();
            this._osc.type = 'sine';
            this._osc.frequency.setValueAtTime(hz, when);
            this._osc.connect(this._chain.input);
            this._osc.start(when);
        }

        const decayEnd = when + (p.decay ?? 1.5);
        if (when < this._activeUntil) {
            // Legato slide: glide the pitch, re-energize the envelope from its
            // value at `when` — no retrigger, no discontinuity.
            this._osc.frequency.cancelScheduledValues(when);
            this._osc.frequency.setValueAtTime(Math.max(this._lastHz, 1), when);
            this._osc.frequency.exponentialRampToValueAtTime(hz, when + glide);
            const current = this._envValueAt(when);
            gain.cancelScheduledValues(when);
            gain.setValueAtTime(current, when);
            gain.linearRampToValueAtTime(sustain, when + glide);
            gain.exponentialRampToValueAtTime(ENV_FLOOR, decayEnd);
            this._env = { t0: when - 0.002, peak: sustain, sustain, attackEnd: when + glide, end: decayEnd };
        } else {
            // Fresh note: jump pitch, restart envelope with ≤2 ms attack.
            this._osc.frequency.cancelScheduledValues(when);
            this._osc.frequency.setValueAtTime(hz, when);
            gain.cancelScheduledValues(when);
            gain.setValueAtTime(0, when);
            gain.linearRampToValueAtTime(peak, when + 0.002);
            gain.exponentialRampToValueAtTime(sustain, when + Math.max(p.pitchDecay ?? 0.15, 0.003));
            gain.exponentialRampToValueAtTime(ENV_FLOOR, decayEnd);
            this._env = { t0: when, peak, sustain, attackEnd: when + Math.max(p.pitchDecay ?? 0.15, 0.003), end: decayEnd };
        }
        this._lastHz = hz;
        this._activeUntil = decayEnd;
    }

    noteOff(when = this.ctx.currentTime, release = 0.08) {
        const gain = this._chain.envGain.gain;
        const current = this._envValueAt(when);
        gain.cancelScheduledValues(when);
        gain.setValueAtTime(current, when);
        gain.exponentialRampToValueAtTime(ENV_FLOOR, when + release);
        this._activeUntil = Math.min(this._activeUntil, when + release);
        if (this._env) this._env.end = Math.min(this._env.end, when + release);
    }

    dispose() {
        if (this._osc) {
            try { this._osc.stop(); } catch { /* already stopped */ }
            this._osc.disconnect();
            this._osc = null;
        }
        this._chain.output.disconnect();
    }
}

export default Melodic808Engine;
