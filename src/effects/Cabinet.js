import { AudioEffect } from './AudioEffect.js';

/**
 * Cabinet — Speaker cabinet simulation using ConvolverNode with procedural IR.
 *
 * Signal chain:
 *   input -> ConvolverNode(procedural impulse response) -> cabinetGain -> _wetGain
 *
 * The impulse response is generated procedurally by running a unit impulse
 * through a filter chain that simulates different cabinet types.
 */
export class Cabinet extends AudioEffect {
    constructor() {
        super('Cabinet', {
            cabinet: '1x12',
            character: 0.5,
            resonance: 0.4,
            size: 0.5,
            mix: 1.0
        });
        this._convolver = null;
        this._cabinetGain = null;
    }

    _buildGraph(ctx) {
        const convolver = ctx.createConvolver();
        this._registerNode(convolver);
        this._convolver = convolver;

        const cabinetGain = ctx.createGain();
        cabinetGain.gain.value = 1.0;
        this._registerNode(cabinetGain);
        this._cabinetGain = cabinetGain;

        this.input.connect(convolver);
        convolver.connect(cabinetGain);
        cabinetGain.connect(this._wetGain);

        this._generateIR(ctx);
    }

    async _generateIR(ctx) {
        const cabinetParams = Cabinet.CABINET_PRESETS[this.params.cabinet] || Cabinet.CABINET_PRESETS['1x12'];
        const sampleRate = ctx.sampleRate || 44100;
        const duration = 0.05 + this.params.size * 0.15;
        const length = Math.ceil(sampleRate * duration);

        // Create offline context to render the IR
        const offline = new OfflineAudioContext(2, length, sampleRate);

        // Unit impulse
        const impulseBuffer = offline.createBuffer(1, length, sampleRate);
        const impulseData = impulseBuffer.getChannelData(0);
        impulseData[0] = 1.0;

        const source = offline.createBufferSource();
        source.buffer = impulseBuffer;

        // Build filter chain for this cabinet type
        const lpFreq = cabinetParams.lpFreq + this.params.character * 2000;
        const hpFreq = cabinetParams.hpFreq;
        const resoFreq = cabinetParams.resoFreq;
        const resoQ = 1 + this.params.resonance * 8;

        // High-pass (remove sub bass)
        const hp = offline.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = hpFreq;
        hp.Q.value = 0.7;

        // Resonance peak (cabinet body resonance)
        const reso = offline.createBiquadFilter();
        reso.type = 'peaking';
        reso.frequency.value = resoFreq;
        reso.Q.value = resoQ;
        reso.gain.value = 4 + this.params.resonance * 6;

        // Low-pass (speaker rolloff)
        const lp = offline.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = lpFreq;
        lp.Q.value = 0.7;

        // Second LP for steeper rolloff
        const lp2 = offline.createBiquadFilter();
        lp2.type = 'lowpass';
        lp2.frequency.value = lpFreq * 1.2;
        lp2.Q.value = 0.5;

        source.connect(hp);
        hp.connect(reso);
        reso.connect(lp);
        lp.connect(lp2);
        lp2.connect(offline.destination);
        source.start();

        try {
            const renderedBuffer = await offline.startRendering();
            if (this._convolver) {
                this._convolver.buffer = renderedBuffer;
            }
        } catch (e) {
            // Fallback: create a simple short IR
            const fallback = ctx.createBuffer(2, 128, sampleRate);
            const fd = fallback.getChannelData(0);
            fd[0] = 1.0;
            for (let i = 1; i < 128; i++) {
                fd[i] = Math.exp(-i / 20) * (Math.random() * 0.1);
            }
            if (fallback.numberOfChannels > 1) {
                fallback.getChannelData(1).set(fd);
            }
            if (this._convolver) {
                this._convolver.buffer = fallback;
            }
        }
    }

    _applyParam(key, value) {
        if (!this._convolver || !this._ctx) return;

        switch (key) {
            case 'cabinet':
            case 'character':
            case 'resonance':
            case 'size':
                this._generateIR(this._ctx);
                break;
        }
    }
}

Cabinet.CABINET_PRESETS = {
    '1x12':       { lpFreq: 5000, hpFreq: 80,  resoFreq: 800  },
    '2x12':       { lpFreq: 5500, hpFreq: 70,  resoFreq: 700  },
    '4x12':       { lpFreq: 4500, hpFreq: 60,  resoFreq: 600  },
    'combo':      { lpFreq: 6000, hpFreq: 100, resoFreq: 900  },
    'open-back':  { lpFreq: 7000, hpFreq: 90,  resoFreq: 1000 },
    'closed-back':{ lpFreq: 4000, hpFreq: 60,  resoFreq: 500  },
};

AudioEffect.register('Cabinet', Cabinet);
