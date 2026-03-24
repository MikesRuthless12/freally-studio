import { AudioEffect } from './AudioEffect.js';

/**
 * LoomSauce — Compound vocal chain plugin for WavLoom Studio.
 *
 * 6-section processing chain:
 *   Input → COMPRESS → ENHANCE → EQ → MULTIPLY → SPACE → GAIN → Output
 *
 * Each section can be independently bypassed.
 */

const DEFAULTS = {
    compBypass: false, compThreshold: -18, compRatio: 3,
    compAttack: 0.01, compRelease: 0.15, compMakeup: 0,
    enhBypass: false, enhAir: 0.3, enhWarmth: 0.2, enhPresence: 0.3,
    eqBypass: false, eqLowGain: 0, eqMidGain: 0, eqMidFreq: 1000, eqHighGain: 0,
    multBypass: true, multAmount: 0, multWidth: 0.5, multDetune: 10,
    spaceBypass: false, spaceSize: 0.3, spaceDamping: 0.5, spacePreDelay: 0.02, spaceMix: 0.15,
    gainBypass: false, gainLevel: 1.0, gainPan: 0, gainLimiter: true,
};

function pr(name, ov) { return { name, params: { ...DEFAULTS, ...ov } }; }

export const LOOMSAUCE_FACTORY_PRESETS = [
    pr('Init', {}),
    pr('Crystal Clear', { compThreshold: -16, compRatio: 2, compMakeup: 2, enhAir: 0.4, enhWarmth: 0.05, enhPresence: 0.2, eqHighGain: 2, spaceMix: 0.08 }),
    pr('Silk & Satin', { compThreshold: -22, compRatio: 3, compMakeup: 3, enhAir: 0.2, enhWarmth: 0.4, enhPresence: 0.15, eqLowGain: -2, eqMidGain: 1, spaceMix: 0.12 }),
    pr('Warm Honey', { compThreshold: -20, compRatio: 2.5, compMakeup: 4, enhAir: 0.15, enhWarmth: 0.6, enhPresence: 0.2, eqLowGain: 2, eqMidGain: -1, eqHighGain: -1, spaceMix: 0.1 }),
    pr('Radio Ready', { compThreshold: -24, compRatio: 5, compMakeup: 6, enhAir: 0.5, enhWarmth: 0.3, enhPresence: 0.5, eqLowGain: -3, eqMidGain: 2, eqHighGain: 3, spaceMix: 0.05 }),
    pr('Cloud Nine', { compThreshold: -14, compRatio: 2, enhAir: 0.7, enhWarmth: 0.1, enhPresence: 0.1, eqHighGain: 3, multBypass: false, multAmount: 0.2, multWidth: 0.7, spaceSize: 0.6, spaceMix: 0.3, spacePreDelay: 0.04 }),
    pr('Velvet Voice', { compThreshold: -20, compRatio: 3, compMakeup: 3, enhAir: 0.1, enhWarmth: 0.5, enhPresence: 0.1, eqLowGain: 1, eqMidGain: -2, eqHighGain: -3, spaceMix: 0.1 }),
    pr('Morning Dew', { compThreshold: -15, compRatio: 2, compMakeup: 1, enhAir: 0.5, enhWarmth: 0.1, enhPresence: 0.3, eqHighGain: 2, spaceMix: 0.12, spaceSize: 0.4 }),
    pr('Midnight Smooth', { compThreshold: -22, compRatio: 3.5, compMakeup: 4, enhAir: 0.05, enhWarmth: 0.5, enhPresence: 0.15, eqLowGain: 2, eqMidGain: -1, eqHighGain: -4, spaceMix: 0.15, spaceSize: 0.5 }),
    pr('Golden Hour', { compThreshold: -18, compRatio: 2.5, compMakeup: 3, enhAir: 0.3, enhWarmth: 0.5, enhPresence: 0.25, eqLowGain: 1, eqMidGain: 1, eqMidFreq: 2000, spaceMix: 0.1 }),
    pr('Lo-Fi Bedroom', { compThreshold: -24, compRatio: 4, compMakeup: 2, enhAir: 0.0, enhWarmth: 0.7, enhPresence: 0.1, eqLowGain: -1, eqHighGain: -5, spaceMix: 0.2, spaceDamping: 0.8 }),
    pr('Stadium Anthem', { compThreshold: -26, compRatio: 5, compMakeup: 8, enhAir: 0.6, enhWarmth: 0.3, enhPresence: 0.6, eqMidGain: 3, eqHighGain: 2, multBypass: false, multAmount: 0.4, multWidth: 0.8, spaceSize: 0.7, spaceMix: 0.25, spacePreDelay: 0.05 }),
    pr('Whisper Close', { compThreshold: -12, compRatio: 2, compMakeup: 1, enhAir: 0.4, enhWarmth: 0.3, enhPresence: 0.1, eqLowGain: -4, spaceMix: 0.05, spaceSize: 0.15 }),
    pr('Power Ballad', { compThreshold: -22, compRatio: 4, compMakeup: 5, enhAir: 0.4, enhWarmth: 0.35, enhPresence: 0.4, eqMidGain: 2, eqHighGain: 1, multBypass: false, multAmount: 0.15, multWidth: 0.4, spaceSize: 0.5, spaceMix: 0.2 }),
    pr('Bright Pop', { compThreshold: -20, compRatio: 3.5, compMakeup: 4, enhAir: 0.6, enhWarmth: 0.1, enhPresence: 0.5, eqLowGain: -2, eqHighGain: 4, spaceMix: 0.08 }),
    pr('Dark RnB', { compThreshold: -22, compRatio: 3, compMakeup: 3, enhAir: 0.1, enhWarmth: 0.4, enhPresence: 0.2, eqLowGain: 3, eqMidGain: -2, eqHighGain: -3, spaceMix: 0.12, spaceDamping: 0.7 }),
    pr('Vocal Fry Fix', { compThreshold: -25, compRatio: 4, compMakeup: 5, enhAir: 0.3, enhWarmth: 0.15, enhPresence: 0.35, eqLowGain: -4, eqMidGain: 2, eqMidFreq: 800 }),
    pr('Crisp Podcast', { compThreshold: -20, compRatio: 4, compMakeup: 4, enhAir: 0.3, enhWarmth: 0.05, enhPresence: 0.4, eqLowGain: -3, eqMidGain: 1, eqMidFreq: 3000, eqHighGain: -2, spaceBypass: true }),
    pr('Airy Dreamer', { compThreshold: -14, compRatio: 2, enhAir: 0.8, enhWarmth: 0.05, enhPresence: 0.1, eqHighGain: 4, multBypass: false, multAmount: 0.25, multWidth: 0.8, spaceSize: 0.7, spaceMix: 0.35, spacePreDelay: 0.05, spaceDamping: 0.3 }),
    pr('Thick & Creamy', { compThreshold: -24, compRatio: 4, compMakeup: 5, enhAir: 0.2, enhWarmth: 0.6, enhPresence: 0.3, eqLowGain: 2, multBypass: false, multAmount: 0.35, multWidth: 0.6, spaceMix: 0.1 }),
    pr('Vintage Vinyl', { compThreshold: -20, compRatio: 3, compMakeup: 2, enhAir: 0.0, enhWarmth: 0.7, enhPresence: 0.15, eqLowGain: 1, eqHighGain: -4, spaceMix: 0.08, spaceDamping: 0.9 }),
    pr('Modern Pop', { compThreshold: -22, compRatio: 4, compMakeup: 5, enhAir: 0.5, enhWarmth: 0.2, enhPresence: 0.5, eqLowGain: -2, eqMidGain: 1, eqHighGain: 3, spaceMix: 0.08 }),
    pr('Hip Hop Lead', { compThreshold: -26, compRatio: 5, compMakeup: 7, enhAir: 0.3, enhWarmth: 0.4, enhPresence: 0.5, eqLowGain: -2, eqMidGain: 3, eqMidFreq: 2500, eqHighGain: 1, spaceBypass: true }),
    pr('Trap Vocal', { compThreshold: -28, compRatio: 6, compMakeup: 8, enhAir: 0.5, enhWarmth: 0.3, enhPresence: 0.6, eqLowGain: -3, eqMidGain: 2, eqHighGain: 3, multBypass: false, multAmount: 0.2, multWidth: 0.7, spaceMix: 0.06 }),
    pr('Soul Kitchen', { compThreshold: -18, compRatio: 2.5, compMakeup: 3, enhAir: 0.2, enhWarmth: 0.5, enhPresence: 0.2, eqLowGain: 1, eqMidGain: 1, eqMidFreq: 1500, spaceMix: 0.15, spaceSize: 0.4 }),
    pr('Jazz Lounge', { compThreshold: -14, compRatio: 2, compMakeup: 1, enhAir: 0.15, enhWarmth: 0.3, enhPresence: 0.1, eqHighGain: -1, spaceMix: 0.12, spaceSize: 0.3 }),
    pr('Rock Shout', { compThreshold: -26, compRatio: 5, compMakeup: 7, enhAir: 0.3, enhWarmth: 0.5, enhPresence: 0.6, eqLowGain: -3, eqMidGain: 4, eqMidFreq: 2000, eqHighGain: 1, spaceBypass: true }),
    pr('Indie Folk', { compThreshold: -14, compRatio: 2, compMakeup: 1, enhAir: 0.3, enhWarmth: 0.2, enhPresence: 0.15, spaceMix: 0.1, spaceSize: 0.25 }),
    pr('EDM Topline', { compThreshold: -24, compRatio: 4, compMakeup: 6, enhAir: 0.6, enhWarmth: 0.15, enhPresence: 0.5, eqLowGain: -4, eqHighGain: 4, multBypass: false, multAmount: 0.3, multWidth: 0.8, spaceMix: 0.1 }),
    pr('Deep House Vox', { compThreshold: -20, compRatio: 3, compMakeup: 3, enhAir: 0.2, enhWarmth: 0.4, enhPresence: 0.2, eqLowGain: -2, eqHighGain: -2, spaceMix: 0.25, spaceSize: 0.5, spaceDamping: 0.6 }),
    pr('Drill Vocal', { compThreshold: -28, compRatio: 6, compMakeup: 9, enhAir: 0.2, enhWarmth: 0.4, enhPresence: 0.6, eqLowGain: -4, eqMidGain: 3, eqMidFreq: 2000, eqHighGain: -1, spaceBypass: true }),
    pr('Afrobeats Lead', { compThreshold: -20, compRatio: 3, compMakeup: 4, enhAir: 0.5, enhWarmth: 0.3, enhPresence: 0.4, eqMidGain: 2, eqHighGain: 2, spaceMix: 0.1 }),
    pr('Latin Heat', { compThreshold: -18, compRatio: 3, compMakeup: 3, enhAir: 0.3, enhWarmth: 0.35, enhPresence: 0.35, eqLowGain: 1, eqMidGain: 2, eqMidFreq: 1800, spaceMix: 0.12 }),
    pr('Gospel Choir', { compThreshold: -16, compRatio: 2.5, compMakeup: 2, enhAir: 0.5, enhWarmth: 0.2, enhPresence: 0.3, multBypass: false, multAmount: 0.3, multWidth: 0.7, spaceSize: 0.6, spaceMix: 0.25, spacePreDelay: 0.04 }),
    pr('Acoustic Session', { compThreshold: -15, compRatio: 2, compMakeup: 1, enhAir: 0.25, enhWarmth: 0.25, enhPresence: 0.15, spaceMix: 0.1, spaceSize: 0.25 }),
    pr('Bad Mic Rescue', { compThreshold: -22, compRatio: 4, compMakeup: 5, enhAir: 0.4, enhWarmth: 0.3, enhPresence: 0.4, eqLowGain: -5, eqMidGain: 2, eqMidFreq: 3000, eqHighGain: 3 }),
    pr('Nasal Fix', { enhPresence: 0.1, eqMidGain: -4, eqMidFreq: 1200, eqHighGain: 2 }),
    pr('Muddy Cleaner', { eqLowGain: -6, eqMidGain: 2, eqMidFreq: 2500, eqHighGain: 3, enhAir: 0.4, enhPresence: 0.3 }),
    pr('Harsh Tamer', { enhAir: 0.0, enhPresence: 0.0, eqMidGain: -3, eqMidFreq: 3500, eqHighGain: -4 }),
    pr('Sibilance Smoother', { enhAir: 0.0, enhPresence: 0.0, eqHighGain: -5, eqMidGain: -2, eqMidFreq: 6000 }),
    pr('Telephone Filter', { eqLowGain: -12, eqHighGain: -12, eqMidGain: 4, eqMidFreq: 1500, enhAir: 0.0, enhWarmth: 0.6, enhPresence: 0.0, compThreshold: -26, compRatio: 6, compMakeup: 4, spaceBypass: true, multBypass: true }),
];

export class LoomSauce extends AudioEffect {
    constructor() {
        super('LoomSauce', { ...DEFAULTS });
        this._sections = {};
        this._comp = null;
        this._compMakeup = null;
        this._enhAir = null;
        this._enhPresence = null;
        this._enhWarmth = null;
        this._eqLow = null;
        this._eqMid = null;
        this._eqHigh = null;
        this._multDirect = null;
        this._multDelayA = null;
        this._multDelayB = null;
        this._multGainA = null;
        this._multGainB = null;
        this._multPanA = null;
        this._multPanB = null;
        this._multLfo = null;
        this._multLfoGainA = null;
        this._multLfoGainB = null;
        this._spaceDirect = null;
        this._spacePreDelay = null;
        this._spaceAP1 = null;
        this._spaceAP2 = null;
        this._spaceComb = null;
        this._spaceFB = null;
        this._spaceDamp = null;
        this._spaceWet = null;
        this._outGain = null;
        this._outPan = null;
        this._outLimiter = null;
    }

    /** Create a bypass-able section with dry/wet crossfade */
    _makeSection(ctx) {
        const inNode = ctx.createGain();
        const outNode = ctx.createGain();
        const dry = ctx.createGain(); dry.gain.value = 1;
        const wet = ctx.createGain(); wet.gain.value = 0;
        inNode.connect(dry);
        dry.connect(outNode);
        wet.connect(outNode);
        [inNode, outNode, dry, wet].forEach(n => this._registerNode(n));
        return { in: inNode, out: outNode, dry, wet };
    }

    _setSectionBypass(section, bypassed) {
        if (!section || !this._ctx) return;
        const t = this._ctx.currentTime;
        section.dry.gain.setTargetAtTime(bypassed ? 1 : 0, t, 0.005);
        section.wet.gain.setTargetAtTime(bypassed ? 0 : 1, t, 0.005);
    }

    _buildGraph(ctx) {
        const sec = {};
        ['comp', 'enh', 'eq', 'mult', 'space', 'gain'].forEach(k => {
            sec[k] = this._makeSection(ctx);
        });
        this._sections = sec;

        // ─── COMPRESS: DynamicsCompressor → MakeupGain ───
        const comp = ctx.createDynamicsCompressor();
        const compMkup = ctx.createGain();
        [comp, compMkup].forEach(n => this._registerNode(n));
        sec.comp.in.connect(comp);
        comp.connect(compMkup);
        compMkup.connect(sec.comp.wet);
        this._comp = comp;
        this._compMakeup = compMkup;

        // ─── ENHANCE: AirFilter → PresenceFilter → WarmthShaper ───
        const air = ctx.createBiquadFilter();
        air.type = 'highshelf'; air.frequency.value = 10000; air.gain.value = 0;
        const pres = ctx.createBiquadFilter();
        pres.type = 'peaking'; pres.frequency.value = 4000; pres.Q.value = 1.2; pres.gain.value = 0;
        const warmth = ctx.createWaveShaper();
        warmth.oversample = '2x';
        [air, pres, warmth].forEach(n => this._registerNode(n));
        sec.enh.in.connect(air);
        air.connect(pres);
        pres.connect(warmth);
        warmth.connect(sec.enh.wet);
        this._enhAir = air;
        this._enhPresence = pres;
        this._enhWarmth = warmth;

        // ─── EQ: LowShelf → MidPeak → HighShelf ───
        const low = ctx.createBiquadFilter();
        low.type = 'lowshelf'; low.frequency.value = 200; low.gain.value = 0;
        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 1.0; mid.gain.value = 0;
        const high = ctx.createBiquadFilter();
        high.type = 'highshelf'; high.frequency.value = 8000; high.gain.value = 0;
        [low, mid, high].forEach(n => this._registerNode(n));
        sec.eq.in.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(sec.eq.wet);
        this._eqLow = low;
        this._eqMid = mid;
        this._eqHigh = high;

        // ─── MULTIPLY: Direct + 2 delayed/panned voices + LFO ───
        const mDirect = ctx.createGain(); mDirect.gain.value = 1.0;
        const mDelA = ctx.createDelay(0.1); mDelA.delayTime.value = 0.015;
        const mDelB = ctx.createDelay(0.1); mDelB.delayTime.value = 0.022;
        const mGainA = ctx.createGain(); mGainA.gain.value = 0;
        const mGainB = ctx.createGain(); mGainB.gain.value = 0;
        const mPanA = ctx.createStereoPanner(); mPanA.pan.value = -0.5;
        const mPanB = ctx.createStereoPanner(); mPanB.pan.value = 0.5;
        const mLfo = ctx.createOscillator();
        mLfo.type = 'sine'; mLfo.frequency.value = 0.5;
        const mLfoGA = ctx.createGain(); mLfoGA.gain.value = 0.001;
        const mLfoGB = ctx.createGain(); mLfoGB.gain.value = -0.001;
        [mDirect, mDelA, mDelB, mGainA, mGainB, mPanA, mPanB, mLfo, mLfoGA, mLfoGB]
            .forEach(n => this._registerNode(n));
        sec.mult.in.connect(mDirect); mDirect.connect(sec.mult.wet);
        sec.mult.in.connect(mDelA); mDelA.connect(mGainA); mGainA.connect(mPanA); mPanA.connect(sec.mult.wet);
        sec.mult.in.connect(mDelB); mDelB.connect(mGainB); mGainB.connect(mPanB); mPanB.connect(sec.mult.wet);
        mLfo.connect(mLfoGA); mLfo.connect(mLfoGB);
        mLfoGA.connect(mDelA.delayTime); mLfoGB.connect(mDelB.delayTime);
        mLfo.start();
        this._multDirect = mDirect;
        this._multDelayA = mDelA; this._multDelayB = mDelB;
        this._multGainA = mGainA; this._multGainB = mGainB;
        this._multPanA = mPanA; this._multPanB = mPanB;
        this._multLfo = mLfo;
        this._multLfoGainA = mLfoGA; this._multLfoGainB = mLfoGB;

        // ─── SPACE: Direct + PreDelay → Allpass → Comb feedback → WetGain ───
        const sDirect = ctx.createGain(); sDirect.gain.value = 1.0;
        const sPreDel = ctx.createDelay(0.5); sPreDel.delayTime.value = 0.02;
        const sAP1 = ctx.createBiquadFilter(); sAP1.type = 'allpass'; sAP1.frequency.value = 200;
        const sAP2 = ctx.createBiquadFilter(); sAP2.type = 'allpass'; sAP2.frequency.value = 350;
        const sComb = ctx.createDelay(0.5); sComb.delayTime.value = 0.035;
        const sFB = ctx.createGain(); sFB.gain.value = 0.5;
        const sDamp = ctx.createBiquadFilter(); sDamp.type = 'lowpass'; sDamp.frequency.value = 8000;
        const sWetG = ctx.createGain(); sWetG.gain.value = 0.15;
        [sDirect, sPreDel, sAP1, sAP2, sComb, sFB, sDamp, sWetG]
            .forEach(n => this._registerNode(n));
        sec.space.in.connect(sDirect); sDirect.connect(sec.space.wet);
        sec.space.in.connect(sPreDel); sPreDel.connect(sAP1); sAP1.connect(sAP2); sAP2.connect(sComb);
        sComb.connect(sDamp); sDamp.connect(sFB); sFB.connect(sComb);
        sComb.connect(sWetG); sWetG.connect(sec.space.wet);
        this._spaceDirect = sDirect; this._spacePreDelay = sPreDel;
        this._spaceAP1 = sAP1; this._spaceAP2 = sAP2;
        this._spaceComb = sComb; this._spaceFB = sFB;
        this._spaceDamp = sDamp; this._spaceWet = sWetG;

        // ─── GAIN: GainNode → PanNode → LimiterNode ───
        const oGain = ctx.createGain(); oGain.gain.value = 1.0;
        const oPan = ctx.createStereoPanner(); oPan.pan.value = 0;
        const oLim = ctx.createDynamicsCompressor();
        oLim.threshold.value = -1; oLim.ratio.value = 20;
        oLim.attack.value = 0.001; oLim.release.value = 0.01; oLim.knee.value = 0;
        [oGain, oPan, oLim].forEach(n => this._registerNode(n));
        sec.gain.in.connect(oGain); oGain.connect(oPan); oPan.connect(oLim); oLim.connect(sec.gain.wet);
        this._outGain = oGain; this._outPan = oPan; this._outLimiter = oLim;

        // ─── Chain sections: input → comp → enh → eq → mult → space → gain → _wetGain ───
        this.input.connect(sec.comp.in);
        sec.comp.out.connect(sec.enh.in);
        sec.enh.out.connect(sec.eq.in);
        sec.eq.out.connect(sec.mult.in);
        sec.mult.out.connect(sec.space.in);
        sec.space.out.connect(sec.gain.in);
        sec.gain.out.connect(this._wetGain);
    }

    _applyParam(key, value) {
        if (!this._ctx) return;
        const t = this._ctx.currentTime;

        // Section bypasses
        if (key === 'compBypass') { this._setSectionBypass(this._sections.comp, value); return; }
        if (key === 'enhBypass') { this._setSectionBypass(this._sections.enh, value); return; }
        if (key === 'eqBypass') { this._setSectionBypass(this._sections.eq, value); return; }
        if (key === 'multBypass') { this._setSectionBypass(this._sections.mult, value); return; }
        if (key === 'spaceBypass') { this._setSectionBypass(this._sections.space, value); return; }
        if (key === 'gainBypass') { this._setSectionBypass(this._sections.gain, value); return; }

        // COMPRESS
        if (key === 'compThreshold' && this._comp) this._comp.threshold.setValueAtTime(value, t);
        if (key === 'compRatio' && this._comp) this._comp.ratio.setValueAtTime(value, t);
        if (key === 'compAttack' && this._comp) this._comp.attack.setValueAtTime(value, t);
        if (key === 'compRelease' && this._comp) this._comp.release.setValueAtTime(value, t);
        if (key === 'compMakeup' && this._compMakeup) this._compMakeup.gain.setValueAtTime(Math.pow(10, value / 20), t);

        // ENHANCE
        if (key === 'enhAir' && this._enhAir) this._enhAir.gain.setValueAtTime(value * 8, t);
        if (key === 'enhPresence' && this._enhPresence) this._enhPresence.gain.setValueAtTime(value * 6, t);
        if (key === 'enhWarmth') this._updateWarmthCurve(value);

        // EQ
        if (key === 'eqLowGain' && this._eqLow) this._eqLow.gain.setValueAtTime(value, t);
        if (key === 'eqMidGain' && this._eqMid) this._eqMid.gain.setValueAtTime(value, t);
        if (key === 'eqMidFreq' && this._eqMid) this._eqMid.frequency.setValueAtTime(value, t);
        if (key === 'eqHighGain' && this._eqHigh) this._eqHigh.gain.setValueAtTime(value, t);

        // MULTIPLY
        if (key === 'multAmount') {
            if (this._multGainA) this._multGainA.gain.setValueAtTime(value * 0.5, t);
            if (this._multGainB) this._multGainB.gain.setValueAtTime(value * 0.5, t);
        }
        if (key === 'multWidth') {
            if (this._multPanA) this._multPanA.pan.setValueAtTime(-value, t);
            if (this._multPanB) this._multPanB.pan.setValueAtTime(value, t);
        }
        if (key === 'multDetune') {
            const depth = value * 0.0001;
            if (this._multLfoGainA) this._multLfoGainA.gain.setValueAtTime(depth, t);
            if (this._multLfoGainB) this._multLfoGainB.gain.setValueAtTime(-depth, t);
        }

        // SPACE
        if (key === 'spaceSize') {
            if (this._spaceComb) this._spaceComb.delayTime.setValueAtTime(0.01 + value * 0.07, t);
            if (this._spaceFB) this._spaceFB.gain.setValueAtTime(0.3 + value * 0.4, t);
        }
        if (key === 'spaceDamping' && this._spaceDamp) {
            this._spaceDamp.frequency.setValueAtTime(2000 + (1 - value) * 18000, t);
        }
        if (key === 'spacePreDelay' && this._spacePreDelay) {
            this._spacePreDelay.delayTime.setValueAtTime(value, t);
        }
        if (key === 'spaceMix' && this._spaceWet) {
            this._spaceWet.gain.setValueAtTime(value, t);
        }

        // GAIN
        if (key === 'gainLevel' && this._outGain) this._outGain.gain.setValueAtTime(value, t);
        if (key === 'gainPan' && this._outPan) this._outPan.pan.setValueAtTime(value, t);
        if (key === 'gainLimiter' && this._outLimiter) {
            if (value) {
                this._outLimiter.threshold.setValueAtTime(-1, t);
                this._outLimiter.ratio.setValueAtTime(20, t);
            } else {
                this._outLimiter.threshold.setValueAtTime(0, t);
                this._outLimiter.ratio.setValueAtTime(1, t);
            }
        }
    }

    _updateWarmthCurve(warmth) {
        if (!this._enhWarmth) return;
        const n = 256;
        const curve = new Float32Array(n);
        if (warmth < 0.01) {
            for (let i = 0; i < n; i++) curve[i] = (i / (n - 1)) * 2 - 1;
        } else {
            const drive = 1 + warmth * 5;
            const td = Math.tanh(drive);
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * 2 - 1;
                const sat = Math.tanh(x * drive) / td;
                curve[i] = x * (1 - warmth) + sat * warmth;
            }
        }
        this._enhWarmth.curve = curve;
    }

    /** Get compressor gain reduction for visualizer */
    getReduction() {
        return this._comp ? this._comp.reduction : 0;
    }

    /** Get limiter gain reduction (negative dB when limiting) */
    getLimiterReduction() {
        return this._outLimiter ? this._outLimiter.reduction : 0;
    }

    dispose() {
        if (this._multLfo) { try { this._multLfo.stop(); } catch (e) {} }
        super.dispose();
    }
}

AudioEffect.register('LoomSauce', LoomSauce);
