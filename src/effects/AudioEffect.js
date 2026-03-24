/**
 * AudioEffect — Abstract base class for all audio effects in WavLoom Studio.
 *
 * Each effect subclass implements _buildGraph(ctx) to construct its internal
 * Web Audio node chain. The base class handles bypass (dry/wet crossfade),
 * serialization, and lifecycle management.
 *
 * Works with both live AudioContext and OfflineAudioContext.
 */

let _effectIdCounter = 0;

export class AudioEffect {
    constructor(name, defaultParams = {}) {
        this.name = name;
        this.id = `${name}_${Date.now()}_${++_effectIdCounter}`;
        this.bypassed = false;
        this.params = { ...defaultParams };
        this.input = null;
        this.output = null;
        this._dryGain = null;
        this._wetGain = null;
        this._ctx = null;
        this._nodes = [];
    }

    /**
     * Create all Web Audio nodes for this effect.
     * @param {BaseAudioContext} audioContext — live or offline
     * @returns {AudioEffect} this
     */
    createNodes(audioContext) {
        this._ctx = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        this._dryGain = audioContext.createGain();
        this._wetGain = audioContext.createGain();

        // Dry path: input → dryGain → output (active when bypassed)
        this.input.connect(this._dryGain);
        this._dryGain.connect(this.output);

        // Wet path: subclass builds input → [...nodes] → _wetGain
        this._wetGain.connect(this.output);

        this._buildGraph(audioContext);
        this._applyBypass();
        this._applyAllParams();

        return this;
    }

    /**
     * Subclasses MUST override this to build their internal node graph.
     * Connect: this.input → [...internal nodes] → this._wetGain
     */
    _buildGraph(_ctx) {
        throw new Error(`${this.name}: _buildGraph() not implemented`);
    }

    /**
     * Subclasses override to apply a single param change to live nodes.
     */
    _applyParam(_key, _value) {
        // Override per effect
    }

    /**
     * Apply all current params to live nodes.
     */
    _applyAllParams() {
        if (!this._ctx) return;
        for (const [k, v] of Object.entries(this.params)) {
            this._applyParam(k, v);
        }
    }

    setParam(key, value) {
        this.params[key] = value;
        if (this._ctx) this._applyParam(key, value);
    }

    setParams(params) {
        Object.assign(this.params, params);
        if (this._ctx) {
            for (const [k, v] of Object.entries(params)) {
                this._applyParam(k, v);
            }
        }
    }

    getParams() {
        return { ...this.params };
    }

    setBypassed(bypassed) {
        this.bypassed = bypassed;
        this._applyBypass();
    }

    _applyBypass() {
        if (!this._ctx) return;
        const t = this._ctx.currentTime;
        if (this.bypassed) {
            this._dryGain.gain.setTargetAtTime(1, t, 0.005);
            this._wetGain.gain.setTargetAtTime(0, t, 0.005);
        } else {
            this._dryGain.gain.setTargetAtTime(0, t, 0.005);
            this._wetGain.gain.setTargetAtTime(1, t, 0.005);
        }
    }

    /**
     * Serialize for project save / section mix storage.
     */
    serialize() {
        return {
            type: this.name,
            id: this.id,
            bypassed: this.bypassed,
            params: this.getParams()
        };
    }

    /**
     * Register an internal node for automatic cleanup.
     */
    _registerNode(node) {
        this._nodes.push(node);
        return node;
    }

    /**
     * Disconnect and cleanup all nodes.
     */
    dispose() {
        this._nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* already disconnected */ } });
        try { this.input?.disconnect(); } catch (e) {}
        try { this.output?.disconnect(); } catch (e) {}
        try { this._dryGain?.disconnect(); } catch (e) {}
        try { this._wetGain?.disconnect(); } catch (e) {}
        this._nodes = [];
        this._ctx = null;
    }

    // --- Static effect registry for deserialization ---

    static _registry = new Map();

    static register(name, EffectClass) {
        AudioEffect._registry.set(name, EffectClass);
    }

    /**
     * Create an effect instance by type name.
     * @param {string} name — registered effect type
     * @param {object} [params] — optional initial params
     * @returns {AudioEffect}
     */
    static create(name, params) {
        const Cls = AudioEffect._registry.get(name);
        if (!Cls) throw new Error(`Unknown effect type: "${name}"`);
        const instance = new Cls();
        if (params) instance.setParams(params);
        return instance;
    }

    /**
     * Get all registered effect type names.
     */
    static getRegisteredTypes() {
        return [...AudioEffect._registry.keys()];
    }
}
