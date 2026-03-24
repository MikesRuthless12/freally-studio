/**
 * EffectsManager — Manages all effects chains for all tracks and the master bus.
 *
 * Provides methods to get/create chains per track, serialize/deserialize state,
 * and recreate chains in an OfflineAudioContext for export.
 */

import { EffectsChain } from './EffectsChain.js';

export class EffectsManager {
    constructor() {
        this.trackChains = new Map();   // trackId → EffectsChain
        this.masterChain = null;        // EffectsChain for master bus
        this._ctx = null;
    }

    /**
     * Initialize with an AudioContext. Creates the master chain.
     */
    init(audioContext) {
        this._ctx = audioContext;
        this.masterChain = new EffectsChain();
        this.masterChain.createNodes(audioContext);
    }

    /**
     * Get or create an effects chain for a track.
     */
    getOrCreateTrackChain(trackId) {
        if (!this.trackChains.has(trackId)) {
            const chain = new EffectsChain();
            if (this._ctx) chain.createNodes(this._ctx);
            this.trackChains.set(trackId, chain);
        }
        return this.trackChains.get(trackId);
    }

    /**
     * Get a track chain if it exists (does not create).
     */
    getTrackChain(trackId) {
        return this.trackChains.get(trackId) || null;
    }

    /**
     * Remove a track's effects chain.
     */
    removeTrackChain(trackId) {
        const chain = this.trackChains.get(trackId);
        if (chain) {
            chain.dispose();
            this.trackChains.delete(trackId);
        }
    }

    /**
     * Serialize all chains for project save.
     */
    serialize() {
        const tracks = {};
        this.trackChains.forEach((chain, trackId) => {
            const data = chain.serialize();
            if (data.length > 0) {
                tracks[trackId] = data;
            }
        });
        return {
            tracks,
            master: this.masterChain?.serialize() || []
        };
    }

    /**
     * Load state from serialized data into existing chains.
     * Disposes old effects and recreates from data.
     */
    loadState(serializedData) {
        if (!this._ctx || !serializedData) return;

        // Dispose all existing track chains
        this.trackChains.forEach(chain => chain.dispose());
        this.trackChains.clear();

        // Recreate track chains
        if (serializedData.tracks) {
            for (const [trackId, chainData] of Object.entries(serializedData.tracks)) {
                const chain = EffectsChain.deserialize(chainData);
                chain.createNodes(this._ctx);
                this.trackChains.set(trackId, chain);
            }
        }

        // Recreate master chain
        if (this.masterChain) this.masterChain.dispose();
        if (serializedData.master && serializedData.master.length > 0) {
            this.masterChain = EffectsChain.deserialize(serializedData.master);
            this.masterChain.createNodes(this._ctx);
        } else {
            this.masterChain = new EffectsChain();
            this.masterChain.createNodes(this._ctx);
        }
    }

    /**
     * Create a NEW EffectsManager in a different AudioContext (for offline export).
     * Clones all effects from serialized data into the new context.
     */
    static recreateInContext(audioContext, serializedData) {
        const manager = new EffectsManager();
        manager._ctx = audioContext;

        // Master chain
        if (serializedData.master && serializedData.master.length > 0) {
            manager.masterChain = EffectsChain.deserialize(serializedData.master);
            manager.masterChain.createNodes(audioContext);
        } else {
            manager.masterChain = new EffectsChain();
            manager.masterChain.createNodes(audioContext);
        }

        // Track chains
        if (serializedData.tracks) {
            for (const [trackId, chainData] of Object.entries(serializedData.tracks)) {
                const chain = EffectsChain.deserialize(chainData);
                chain.createNodes(audioContext);
                manager.trackChains.set(trackId, chain);
            }
        }

        return manager;
    }

    /**
     * Cleanup everything.
     */
    dispose() {
        this.trackChains.forEach(chain => chain.dispose());
        this.trackChains.clear();
        this.masterChain?.dispose();
        this.masterChain = null;
        this._ctx = null;
    }
}
