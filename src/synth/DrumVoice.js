// DrumVoice.js — Layered drum voice model (TASK-A01)
//
// A DrumVoice is 4 layer slots — transient, body, sub, noise — each an
// independent source → drive → envelope → filter chain. Recipe modules
// (src/synth/recipes/*) turn preset params into layer configs; the voice
// turns configs into Web Audio node graphs in whatever context it is
// given (realtime or OfflineAudioContext), so the same voice renders
// live previews, offline exports, and Node-side tests.
//
// Layer config shape:
// {
//   enabled: true,
//   tune: 0,                  // semitones — scales every source frequency
//   gain: 0,                  // dB — becomes the envelope peak
//   env: {
//     attack: 0.001,          // s, linear 0 → peak
//     decay: 0.5,             // s from trigger to decay target (legacy-compatible)
//     sustainLevel: null,     // 0..1 of peak; decay lands here instead of the floor
//     release: null,          // s, exponential sustain → floor after decay
//   },
//   drive: 0,                 // 0..1 waveshaper between source and envelope
//   startOffset: 0,           // s after trigger time (clap burst staggering)
//   filter: { type: 'lowpass', freq: 8000, Q: 1,
//             sweep: { start, end, time } }               // optional cutoff sweep
//         | [ ...filter specs chained in order ] | null,
//   comb: { delayMs: 5, feedback: 0.4 } | null,           // snare-wire comb
//   source:
//     { kind: 'osc', type: 'sine', freq: 55,
//       pitchEnv: { start: 150, end: 55, time: 0.08 } }   // optional exp sweep
//   | { kind: 'noise', color: 'white' | 'pink' }
//   | { kind: 'oscBank', type: 'square', freqs: [205.3, 304.4, ...] }
//   | [ ...source specs summed ]                          // e.g. detuned pair
// }
//
// Layer slot names beyond the canonical four are allowed — a recipe may use
// any keys (e.g. snare uses body/snap/rattle).
//
// A voice config may also carry `post`: an array of specs applied to the SUM
// of all layers before the destination (clap diffusion/glue):
//   { kind: 'allpass', freq, Q } | { kind: 'tanh', k }

export const LAYER_SLOTS = ['transient', 'body', 'sub', 'noise'];

const ENV_FLOOR = 0.001; // −60 dB exponential-ramp floor (matches legacy engine)
const STOP_GUARD = 0.05; // s of headroom after the envelope floor before source stop

export function dbToGain(db) { return Math.pow(10, db / 20); }
export function gainToDb(g) { return 20 * Math.log10(Math.max(g, 1e-6)); }
export function semitoneRatio(semitones) { return Math.pow(2, semitones / 12); }

// Small deterministic PRNG for seeded round-robin (TASK-A10): same seed →
// bit-identical renders across contexts and processes.
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Per-context noise buffer cache — offline contexts are short-lived, so key
// weakly and let their buffers be collected with them. Seeded noise gets its
// own cache slot so same-seed renders reuse identical sample data.
const noiseCache = new WeakMap();

export function getNoiseBuffer(ctx, color = 'white', seed = null) {
    let byKey = noiseCache.get(ctx);
    if (!byKey) { byKey = {}; noiseCache.set(ctx, byKey); }
    const key = `${color}|${seed == null ? 'live' : seed}`;
    if (byKey[key]) return byKey[key];
    const rand = seed == null ? Math.random : mulberry32(seed);
    const len = Math.ceil(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (color === 'pink') {
        // Paul Kellet's economy pink noise approximation
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
            const w = rand() * 2 - 1;
            b0 = 0.99886 * b0 + w * 0.0555179;
            b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.96900 * b2 + w * 0.1538520;
            b3 = 0.86650 * b3 + w * 0.3104856;
            b4 = 0.55000 * b4 + w * 0.5329522;
            b5 = -0.7616 * b5 - w * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
        }
    } else {
        for (let i = 0; i < len; i++) data[i] = rand() * 2 - 1;
    }
    byKey[key] = buf;
    return buf;
}

// Same transfer curve DrumSynthEngine.createDistortion has always used, so
// migrated presets keep their drive character exactly.
export function makeDriveShaper(ctx, amount) {
    const n = 256;
    const curve = new Float32Array(n);
    const k = amount * 50;
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((3 + k) * x * 57.2958) / (180 + k * Math.abs(x));
    }
    const ws = ctx.createWaveShaper();
    ws.curve = curve;
    ws.oversample = '4x';
    return ws;
}

class DrumVoice {
    constructor(ctx, config = {}) {
        this.ctx = ctx;
        this.layers = config.layers || {};
        this.post = config.post || null;
        this._held = []; // sustaining layers awaiting an explicit stop()
        this._live = []; // every started layer, for choke()
    }

    /**
     * Build and start every enabled layer.
     *
     * velocity (0..1) maps to timbre (TASK-A10): it scales layer gain (with
     * an extra helping on transient/click/snap slots), darkens brightness-
     * type filters by up to 1.5 kHz, and shortens decays by up to 10%.
     * seed (integer) enables ±3% round-robin jitter on pitch/decay/filter
     * and seeds the noise sources — same seed → bit-identical render.
     *
     * @returns {{ stopTime: number }} when the last non-sustaining layer ends
     *   (Infinity if any layer sustains until stop()).
     */
    trigger(dest, when = this.ctx.currentTime, { velocity = 1, seed = null } = {}) {
        this._seed = seed;
        this._rng = seed == null ? null : mulberry32(seed);
        // Voice-level DC blocker (TASK-A11): everything leaves through it
        const guard = this.ctx.createBiquadFilter();
        guard.type = 'highpass';
        guard.frequency.value = 20;
        guard.Q.value = 0.707;
        guard.connect(dest);
        dest = guard;
        let bus = dest;
        if (this.post && this.post.length) {
            // layers sum into a bus that runs through the post chain
            bus = this.ctx.createGain();
            let head = bus;
            for (const spec of this.post) {
                let node;
                if (spec.kind === 'tanh') {
                    const n = 1024;
                    const curve = new Float32Array(n);
                    const k = spec.k ?? 1.5;
                    for (let i = 0; i < n; i++) {
                        const x = (i * 2) / (n - 1) - 1;
                        curve[i] = Math.tanh(k * x);
                    }
                    node = this.ctx.createWaveShaper();
                    node.curve = curve;
                    node.oversample = '4x';
                } else { // allpass
                    node = this.ctx.createBiquadFilter();
                    node.type = 'allpass';
                    node.frequency.value = spec.freq ?? 1200;
                    if (spec.Q != null) node.Q.value = spec.Q;
                }
                head.connect(node);
                head = node;
            }
            head.connect(dest);
        }
        let stopTime = when;
        for (const slot of Object.keys(this.layers)) {
            const layer = this.layers[slot];
            if (!layer || layer.enabled === false) continue;
            const t = this._startLayer(slot, layer, bus, when + (layer.startOffset || 0), velocity);
            stopTime = Math.max(stopTime, t);
        }
        return { stopTime };
    }

    /** Release sustaining layers with a short anti-click fade. */
    stop(when = this.ctx.currentTime, fade = 0.03) {
        for (const { envGain, sources } of this._held) {
            envGain.gain.cancelScheduledValues(when);
            envGain.gain.setValueAtTime(Math.max(envGain.gain.value, ENV_FLOOR), when);
            envGain.gain.exponentialRampToValueAtTime(ENV_FLOOR, when + fade);
            sources.forEach(s => s.stop(when + fade + STOP_GUARD));
        }
        this._held = [];
    }

    /**
     * Cut the whole voice short (hi-hat choke groups). Works when scheduling
     * ahead into an offline context: the envelope is re-anchored at its
     * analytically-computed value so history before `when` is untouched.
     */
    choke(when = this.ctx.currentTime, fade = 0.01) {
        for (const rec of this._live) {
            if (when >= rec.envEnd) continue; // already silent
            const v = Math.max(this._envLevelAt(rec, when), ENV_FLOOR);
            rec.envGain.gain.cancelScheduledValues(when);
            rec.envGain.gain.setValueAtTime(v, when);
            rec.envGain.gain.exponentialRampToValueAtTime(ENV_FLOOR, when + fade);
            rec.sources.forEach(s => {
                try { s.stop(when + fade + STOP_GUARD); } catch { /* already stopped */ }
            });
        }
        this._held = [];
    }

    // Envelope level at time t from the schedule recorded in _startLayer.
    _envLevelAt(rec, t) {
        const expInterp = (v0, v1, f) => v0 * Math.pow(v1 / v0, Math.min(Math.max(f, 0), 1));
        if (t <= rec.t0) return 0;
        if (t < rec.attackEnd) return rec.peak * ((t - rec.t0) / (rec.attackEnd - rec.t0));
        if (t < rec.decayEnd) return expInterp(rec.peak, rec.decayTarget, (t - rec.attackEnd) / (rec.decayEnd - rec.attackEnd));
        if (rec.releaseEnd != null && t < rec.releaseEnd) {
            return expInterp(rec.decayTarget, ENV_FLOOR, (t - rec.decayEnd) / (rec.releaseEnd - rec.decayEnd));
        }
        return rec.decayTarget === ENV_FLOOR || rec.releaseEnd != null ? ENV_FLOOR : rec.decayTarget;
    }

    _startLayer(slot, layer, dest, when, velocity) {
        const ctx = this.ctx;
        const env = layer.env || {};
        // seeded round-robin jitter: ±3% draws, one per parameter class
        const jit = this._rng ? () => 1 + (this._rng() * 2 - 1) * 0.03 : () => 1;
        const pitchJit = jit();
        // velocity → timbre: transient-type slots fade faster than the body
        const transientSlot = slot === 'transient' || slot === 'click' || slot === 'snap';
        const peak = dbToGain(layer.gain || 0) * velocity * (transientSlot ? velocity : 1);
        const attack = Math.max(env.attack || 0, 0);
        const decay = Math.max(env.decay || 0.1, 0.001) * (0.9 + 0.1 * velocity) * jit();
        // brightness follows velocity: up to −1.5 kHz on lowpass/bandpass
        const brightnessOffset = -(1 - velocity) * 1500;
        const filterJit = jit();

        // Envelope gain — peak carries the layer gain so the decay curve is
        // identical to the legacy per-drum node graphs (ramp to an absolute
        // floor, not a scaled one).
        const envGain = ctx.createGain();
        envGain.gain.setValueAtTime(0, when);
        if (attack > 0) {
            envGain.gain.linearRampToValueAtTime(peak, when + attack);
        } else {
            envGain.gain.setValueAtTime(peak, when);
        }

        const floor = Math.min(ENV_FLOOR, Math.max(peak, 1e-6));
        let envEnd;
        let sustains = false;
        let decayTarget = floor;
        let releaseEnd = null;
        if (env.sustainLevel == null) {
            envGain.gain.exponentialRampToValueAtTime(floor, when + decay);
            envEnd = when + decay;
        } else {
            const sustain = Math.max(env.sustainLevel * peak, floor);
            decayTarget = sustain;
            envGain.gain.exponentialRampToValueAtTime(sustain, when + decay);
            if (env.release != null) {
                envGain.gain.exponentialRampToValueAtTime(floor, when + decay + env.release);
                envEnd = when + decay + env.release;
                releaseEnd = envEnd;
            } else {
                sustains = true;
                envEnd = Infinity;
            }
        }

        // source(s) → [drive] → envelope → [filter] → dest
        // Filter sits after the envelope to mirror the legacy kick chain;
        // the biquad is linear so placement does not change the sound.
        const sources = this._buildSources(layer, when, pitchJit);
        const outputs = [...new Set(sources.map(s => s.node))]; // oscBank shares one output node
        let head = envGain;
        if (layer.drive > 0) {
            const shaper = makeDriveShaper(ctx, layer.drive);
            outputs.forEach(node => node.connect(shaper));
            shaper.connect(envGain);
        } else {
            outputs.forEach(node => node.connect(envGain));
        }
        const filters = layer.filter
            ? (Array.isArray(layer.filter) ? layer.filter : [layer.filter])
            : [];
        for (const spec of filters) {
            const f = ctx.createBiquadFilter();
            const type = spec.type || 'lowpass';
            f.type = type;
            // velocity brightness applies to brightness-type filters only,
            // and only above 1 kHz — sub/body filters keep their tuning
            const adjust = (freq) => {
                const bright = (type === 'lowpass' || type === 'bandpass') && freq > 1000
                    ? brightnessOffset : 0;
                return Math.max(40, (freq + bright) * filterJit);
            };
            if (spec.sweep) {
                f.frequency.setValueAtTime(adjust(spec.sweep.start), when);
                f.frequency.exponentialRampToValueAtTime(adjust(spec.sweep.end), when + spec.sweep.time);
            } else {
                f.frequency.value = adjust(spec.freq);
            }
            if (spec.Q != null) f.Q.value = spec.Q;
            head.connect(f);
            head = f;
        }
        if (layer.comb) {
            // feedback comb (snare wires): direct + delayed loop
            const combIn = head;
            const out = ctx.createGain();
            const delay = ctx.createDelay(0.05);
            delay.delayTime.value = Math.max(layer.comb.delayMs ?? 5, 3) / 1000;
            const fb = ctx.createGain();
            fb.gain.value = Math.min(layer.comb.feedback ?? 0.4, 0.9);
            combIn.connect(out);
            combIn.connect(delay);
            delay.connect(fb);
            fb.connect(delay);
            delay.connect(out);
            head = out;
        }
        head.connect(dest);

        const schedulables = sources.map(s => s.schedulable);
        schedulables.forEach(s => s.start(when));
        this._live.push({
            envGain, sources: schedulables,
            t0: when, attackEnd: when + attack, peak,
            decayTarget, decayEnd: when + decay, releaseEnd, envEnd,
        });
        if (sustains) {
            this._held.push({ envGain, sources: schedulables });
            return Infinity;
        }
        // anti-click fade guard (TASK-A11): take the −60 dB floor to true
        // zero over 3 ms before the sources stop
        envGain.gain.linearRampToValueAtTime(0, envEnd + 0.003);
        const stopAt = envEnd + 0.003 + STOP_GUARD;
        schedulables.forEach(s => s.stop(stopAt));
        return stopAt;
    }

    // Returns [{ node, schedulable }] — node is what connects onward,
    // schedulable is what start()/stop() apply to.
    _buildSources(layer, when, pitchJit = 1) {
        const spec = layer.source || { kind: 'osc', type: 'sine', freq: 440 };
        if (Array.isArray(spec)) {
            return spec.flatMap(s => this._buildSource(s, layer, when, pitchJit));
        }
        return this._buildSource(spec, layer, when, pitchJit);
    }

    _buildSource(src, layer, when, pitchJit) {
        const ctx = this.ctx;
        const ratio = semitoneRatio(layer.tune || 0) * pitchJit;

        if (src.kind === 'noise') {
            const n = ctx.createBufferSource();
            // per-layer noise seed drawn from the voice stream, so layers get
            // distinct but reproducible noise
            const noiseSeed = this._rng ? Math.floor(this._rng() * 0xffffffff) : null;
            n.buffer = getNoiseBuffer(ctx, src.color || 'white', noiseSeed);
            n.loop = true;
            return [{ node: n, schedulable: n }];
        }

        if (src.kind === 'oscBank') {
            const bank = ctx.createGain();
            return (src.freqs || []).map(freq => {
                const o = ctx.createOscillator();
                o.type = src.type || 'square';
                o.frequency.value = freq * ratio;
                o.connect(bank);
                return { node: bank, schedulable: o };
            });
        }

        const o = ctx.createOscillator();
        o.type = src.type || 'sine';
        if (src.pitchEnv) {
            o.frequency.setValueAtTime(src.pitchEnv.start * ratio, when);
            o.frequency.exponentialRampToValueAtTime(
                src.pitchEnv.end * ratio, when + src.pitchEnv.time);
        } else {
            o.frequency.value = (src.freq || 440) * ratio;
        }
        return [{ node: o, schedulable: o }];
    }
}

export default DrumVoice;
