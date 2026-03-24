/**
 * VST3EffectNode — AudioEffect subclass for VST3 effect plugins.
 *
 * Extends the base AudioEffect class so it slots into EffectsChain
 * identically to built-in effects (Reverb, Delay, etc.).
 *
 * Uses ScriptProcessorNode for audio routing through the native addon
 * via IPC. Audio flow:
 *   this.input → ScriptProcessor → [IPC → native processBlock → IPC] → this._wetGain
 */

import { AudioEffect } from '../effects/AudioEffect.js';

export class VST3EffectNode extends AudioEffect {
    constructor(pluginInfo) {
        super(`VST3:${pluginInfo?.name || 'Plugin'}`, {});
        this.pluginInfo = pluginInfo;
        this.instanceId = null;
        this._loaded = false;
        this._loading = false;
        this._processor = null;
        this._vst3Params = [];
    }

    /**
     * Load the VST3 plugin via IPC. Must be called before createNodes().
     */
    async load() {
        if (this._loaded || this._loading) return;
        if (!window.electronAPI?.vst3Host) {
            throw new Error('VST3 host not available (not running in Electron)');
        }

        this._loading = true;
        try {
            const result = await window.electronAPI.vst3Host.loadPlugin(
                this.pluginInfo.path,
                this.pluginInfo.uid || ''
            );

            if (result.error) {
                throw new Error(result.error);
            }

            this.instanceId = result.instanceId;
            this._loaded = true;

            // Fetch parameter list
            this._vst3Params = await window.electronAPI.vst3Host.getParameterList(this.instanceId);

            return result;
        } finally {
            this._loading = false;
        }
    }

    /**
     * Build the internal audio graph.
     * Creates a ScriptProcessorNode that sends audio to the native addon for processing.
     */
    _buildGraph(ctx) {
        const bufferSize = 1024;
        const processor = ctx.createScriptProcessor(bufferSize, 2, 2);
        this._registerNode(processor);
        this._processor = processor;

        // Track processing state to avoid overlapping IPC calls
        let processing = false;

        processor.onaudioprocess = (e) => {
            const inL = e.inputBuffer.getChannelData(0);
            const inR = e.inputBuffer.getChannelData(1);
            const outL = e.outputBuffer.getChannelData(0);
            const outR = e.outputBuffer.getChannelData(1);

            if (!this._loaded || !this.instanceId || processing) {
                // Pass-through when not loaded or busy
                outL.set(inL);
                outR.set(inR);
                return;
            }

            // Interleave input
            const frames = inL.length;
            const interleaved = new Float32Array(frames * 2);
            for (let i = 0; i < frames; i++) {
                interleaved[i * 2] = inL[i];
                interleaved[i * 2 + 1] = inR[i];
            }

            processing = true;
            window.electronAPI.vst3Host.processBlock(
                this.instanceId, interleaved.buffer, frames, 2, 2
            ).then((outputBuf) => {
                processing = false;
                if (outputBuf) {
                    // Decode base64 string from main process
                    let output;
                    if (typeof outputBuf === 'string') {
                        const binary = atob(outputBuf);
                        const bytes = new Uint8Array(binary.length);
                        for (let j = 0; j < binary.length; j++) {
                            bytes[j] = binary.charCodeAt(j);
                        }
                        output = new Float32Array(bytes.buffer);
                    } else {
                        output = new Float32Array(outputBuf);
                    }
                    for (let i = 0; i < frames; i++) {
                        outL[i] = output[i * 2] || 0;
                        outR[i] = output[i * 2 + 1] || 0;
                    }
                }
            }).catch(() => {
                processing = false;
            });
        };

        this.input.connect(processor);
        processor.connect(this._wetGain);
    }

    /**
     * Set a VST3 plugin parameter.
     * @param {number} paramId — VST3 parameter ID
     * @param {number} value — normalized value (0-1)
     */
    async setVST3Parameter(paramId, value) {
        if (!this._loaded || !this.instanceId) return;
        await window.electronAPI.vst3Host.setParameter(this.instanceId, paramId, value);
    }

    /**
     * Get a VST3 plugin parameter value.
     * @param {number} paramId
     * @returns {Promise<number>}
     */
    async getVST3Parameter(paramId) {
        if (!this._loaded || !this.instanceId) return 0;
        return await window.electronAPI.vst3Host.getParameter(this.instanceId, paramId);
    }

    /**
     * Get the list of VST3 parameters.
     */
    getVST3Params() {
        return this._vst3Params;
    }

    /**
     * Save the plugin state (preset).
     */
    async saveState() {
        if (!this._loaded || !this.instanceId) return null;
        return await window.electronAPI.vst3Host.getPluginState(this.instanceId);
    }

    /**
     * Load a plugin state (preset).
     */
    async loadState(stateData) {
        if (!this._loaded || !this.instanceId) return false;
        return await window.electronAPI.vst3Host.setPluginState(this.instanceId, stateData);
    }

    /**
     * Serialize for project save.
     */
    serialize() {
        return {
            type: 'VST3',
            id: this.id,
            bypassed: this.bypassed,
            params: this.getParams(),
            pluginPath: this.pluginInfo?.path,
            pluginUid: this.pluginInfo?.uid,
            pluginName: this.pluginInfo?.name,
        };
    }

    /**
     * Cleanup: unload the native plugin instance.
     */
    dispose() {
        if (this._loaded && this.instanceId) {
            window.electronAPI?.vst3Host?.unloadPlugin(this.instanceId).catch(() => {});
            this.instanceId = null;
            this._loaded = false;
        }
        super.dispose();
    }
}
