import { AudioEffect } from './AudioEffect.js';

/**
 * Vocoder — Multi-band vocoder effect with carrier/modulator architecture.
 *
 * Creates a bank of bandpass filters that analyze the modulator (input signal)
 * envelope and applies it to a synthesized carrier signal (sawtooth oscillator).
 *
 * Signal chain:
 *   input → analysisBands[i](bandpass) → envelope followers → gains
 *   carrier(oscillator) → synthesisBands[i](bandpass) → gains[i] → sumGain → _wetGain
 *
 * Params:
 *   bands      — number of filter bands (8, 16, or 32)
 *   carrierFreq — base frequency of carrier oscillator (Hz)
 *   carrierType — oscillator waveform: 'sawtooth', 'square', 'triangle'
 *   release     — envelope follower release time (s)
 *   qFactor     — Q factor for bandpass filters
 *   mix         — dry/wet mix (informational, bypass handled by base)
 */
export class Vocoder extends AudioEffect {
    constructor() {
        super('Vocoder', {
            bands: 16,
            carrierFreq: 110,
            carrierType: 'sawtooth',
            release: 0.03,
            qFactor: 8,
            mix: 0.8
        });
        this._carrier = null;
        this._analysisBands = [];
        this._synthesisBands = [];
        this._envelopeGains = [];
        this._sumGain = null;
        this._pollInterval = null;
        this._analysers = [];
        this._analyserBuffers = [];
    }

    _buildGraph(ctx) {
        const numBands = this.params.bands;
        const minFreq = 100;
        const maxFreq = 8000;

        // Carrier oscillator — rich harmonic source
        const carrier = ctx.createOscillator();
        carrier.type = this.params.carrierType;
        carrier.frequency.value = this.params.carrierFreq;
        this._registerNode(carrier);
        this._carrier = carrier;

        // Sum gain collects all band outputs
        const sumGain = ctx.createGain();
        sumGain.gain.value = 1.0 / Math.sqrt(numBands);
        this._registerNode(sumGain);
        this._sumGain = sumGain;

        this._analysisBands = [];
        this._synthesisBands = [];
        this._envelopeGains = [];
        this._analysers = [];
        this._analyserBuffers = [];

        // Create frequency bands logarithmically spaced
        for (let i = 0; i < numBands; i++) {
            const freq = minFreq * Math.pow(maxFreq / minFreq, i / (numBands - 1));

            // Analysis band — filters the input (modulator)
            const analysisBand = ctx.createBiquadFilter();
            analysisBand.type = 'bandpass';
            analysisBand.frequency.value = freq;
            analysisBand.Q.value = this.params.qFactor;
            this._registerNode(analysisBand);
            this._analysisBands.push(analysisBand);

            // Analyser for envelope detection
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            this._registerNode(analyser);
            this._analysers.push(analyser);
            this._analyserBuffers.push(new Float32Array(analyser.fftSize));

            // Synthesis band — filters the carrier
            const synthesisBand = ctx.createBiquadFilter();
            synthesisBand.type = 'bandpass';
            synthesisBand.frequency.value = freq;
            synthesisBand.Q.value = this.params.qFactor;
            this._registerNode(synthesisBand);
            this._synthesisBands.push(synthesisBand);

            // Envelope gain — modulates the carrier band by the input envelope
            const envGain = ctx.createGain();
            envGain.gain.value = 0;
            this._registerNode(envGain);
            this._envelopeGains.push(envGain);

            // Connections:
            // input → analysisBand → analyser (envelope detection)
            this.input.connect(analysisBand);
            analysisBand.connect(analyser);

            // carrier → synthesisBand → envGain → sumGain
            carrier.connect(synthesisBand);
            synthesisBand.connect(envGain);
            envGain.connect(sumGain);
        }

        // Output: sumGain → _wetGain
        sumGain.connect(this._wetGain);

        // Start carrier
        carrier.start();

        // Start envelope follower polling
        this._startEnvelopeFollower();
    }

    _startEnvelopeFollower() {
        if (this._pollInterval) clearInterval(this._pollInterval);

        this._pollInterval = setInterval(() => {
            if (!this._ctx) return;
            const t = this._ctx.currentTime;
            const release = this.params.release;

            for (let i = 0; i < this._analysers.length; i++) {
                const analyser = this._analysers[i];
                const buffer = this._analyserBuffers[i];
                if (!analyser || !buffer) continue;

                analyser.getFloatTimeDomainData(buffer);

                // Compute RMS envelope
                let sumSq = 0;
                for (let j = 0; j < buffer.length; j++) {
                    sumSq += buffer[j] * buffer[j];
                }
                const rms = Math.sqrt(sumSq / buffer.length);

                // Apply envelope to the carrier band gain
                const envGain = this._envelopeGains[i];
                if (envGain) {
                    // Scale up the RMS for audible effect
                    const level = Math.min(1.0, rms * 4);
                    envGain.gain.setTargetAtTime(level, t, release);
                }
            }
        }, 15);
    }

    _applyParam(key, value) {
        if (!this._carrier) return;
        const t = this._ctx.currentTime;

        switch (key) {
            case 'carrierFreq':
                this._carrier.frequency.setValueAtTime(value, t);
                break;
            case 'carrierType':
                this._carrier.type = value;
                break;
            case 'qFactor':
                for (let i = 0; i < this._analysisBands.length; i++) {
                    this._analysisBands[i].Q.setValueAtTime(value, t);
                    this._synthesisBands[i].Q.setValueAtTime(value, t);
                }
                break;
            case 'release':
            case 'mix':
            case 'bands':
                // bands requires full rebuild; release is read in poll loop
                break;
        }
    }

    dispose() {
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
        super.dispose();
    }
}

AudioEffect.register('Vocoder', Vocoder);
