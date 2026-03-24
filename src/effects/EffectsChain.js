/**
 * EffectsChain — Manages an ordered list of AudioEffect instances for a single track/bus.
 *
 * Auto-reconnects the chain when effects are added, removed, or reordered.
 * When empty, directly connects input → output (zero audio change).
 */

import { AudioEffect } from './AudioEffect.js';

export class EffectsChain {
    constructor() {
        this.effects = [];
        this.input = null;
        this.output = null;
        this._ctx = null;
    }

    /**
     * Create input/output GainNodes and wire up the chain.
     * @param {BaseAudioContext} audioContext
     * @returns {EffectsChain} this
     */
    createNodes(audioContext) {
        this._ctx = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();

        // Initialize any effects that haven't been created yet
        this.effects.forEach(fx => {
            if (!fx._ctx) fx.createNodes(audioContext);
        });

        this._reconnect();
        return this;
    }

    /**
     * Rebuild all connections in the chain.
     */
    _reconnect() {
        if (!this._ctx) return;

        // Disconnect everything
        try { this.input.disconnect(); } catch (e) {}
        this.effects.forEach(fx => {
            try { fx.output.disconnect(); } catch (e) {}
        });

        if (this.effects.length === 0) {
            // Pass-through: input → output
            this.input.connect(this.output);
            return;
        }

        // input → first effect
        this.input.connect(this.effects[0].input);

        // Chain: effect[i].output → effect[i+1].input
        for (let i = 0; i < this.effects.length - 1; i++) {
            this.effects[i].output.connect(this.effects[i + 1].input);
        }

        // Last effect → output
        this.effects[this.effects.length - 1].output.connect(this.output);
    }

    /**
     * Add an effect to the chain.
     * @param {AudioEffect} effect
     * @param {number} [index=-1] — insert position (-1 = end)
     * @returns {AudioEffect} the added effect
     */
    addEffect(effect, index = -1) {
        // Limit: max 5 of the same effect type per chain
        if (this.effects.filter(e => e.name === effect.name).length >= 5) return null;

        if (this._ctx && !effect._ctx) {
            effect.createNodes(this._ctx);
        }

        if (index < 0 || index >= this.effects.length) {
            this.effects.push(effect);
        } else {
            this.effects.splice(index, 0, effect);
        }

        this._reconnect();
        return effect;
    }

    /**
     * Remove an effect by ID.
     * @param {string} effectId
     * @returns {boolean} true if removed
     */
    removeEffect(effectId) {
        const idx = this.effects.findIndex(fx => fx.id === effectId);
        if (idx < 0) return false;

        const removed = this.effects.splice(idx, 1)[0];
        removed.dispose();
        this._reconnect();
        return true;
    }

    /**
     * Move an effect from one position to another.
     */
    reorderEffect(fromIdx, toIdx) {
        if (fromIdx < 0 || fromIdx >= this.effects.length) return;
        if (toIdx < 0 || toIdx >= this.effects.length) return;

        const [moved] = this.effects.splice(fromIdx, 1);
        this.effects.splice(toIdx, 0, moved);
        this._reconnect();
    }

    /**
     * Get an effect by ID.
     */
    getEffect(effectId) {
        return this.effects.find(fx => fx.id === effectId) || null;
    }

    /**
     * Serialize the entire chain for storage.
     */
    serialize() {
        return this.effects.map(fx => fx.serialize());
    }

    /**
     * Create an EffectsChain from serialized data (effects not yet connected to a context).
     */
    static deserialize(data) {
        const chain = new EffectsChain();
        (data || []).forEach(fxData => {
            const fx = AudioEffect.create(fxData.type, fxData.params);
            fx.id = fxData.id;
            fx.bypassed = fxData.bypassed || false;
            chain.effects.push(fx);
        });
        return chain;
    }

    /**
     * Cleanup all effects and disconnect.
     */
    dispose() {
        this.effects.forEach(fx => fx.dispose());
        this.effects = [];
        try { this.input?.disconnect(); } catch (e) {}
        try { this.output?.disconnect(); } catch (e) {}
        this._ctx = null;
    }
}
