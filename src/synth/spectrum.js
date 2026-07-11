// spectrum.js — small spectral analysis helpers (TASK-A02+)
// Used by the golden-ear tests (kick/snare/hats spectral targets) and by
// the Reference A/B readouts (TASK-A13). Pure functions, no Web Audio.

/**
 * In-place iterative radix-2 Cooley–Tukey FFT.
 * @param {Float64Array} re real parts (length must be a power of 2)
 * @param {Float64Array} im imaginary parts (same length)
 */
export function fft(re, im) {
    const n = re.length;
    if ((n & (n - 1)) !== 0) throw new Error('fft length must be a power of 2');
    // bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        const wRe = Math.cos(ang), wIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let curRe = 1, curIm = 0;
            for (let k = 0; k < len / 2; k++) {
                const uRe = re[i + k], uIm = im[i + k];
                const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
                const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
                re[i + k] = uRe + vRe; im[i + k] = uIm + vIm;
                re[i + k + len / 2] = uRe - vRe; im[i + k + len / 2] = uIm - vIm;
                const nextRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = nextRe;
            }
        }
    }
}

/**
 * Power spectrum of a signal (zero-padded to the next power of 2).
 * @param {Float32Array|number[]} signal
 * @returns {{ power: Float64Array, binHz: number }} power per bin, bin width
 */
export function powerSpectrum(signal, sampleRate) {
    let n = 1;
    while (n < signal.length) n <<= 1;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < signal.length; i++) re[i] = signal[i];
    fft(re, im);
    const half = n / 2;
    const power = new Float64Array(half);
    for (let i = 0; i < half; i++) power[i] = re[i] * re[i] + im[i] * im[i];
    return { power, binHz: sampleRate / n };
}

/** Total power in [fLo, fHi) Hz. */
export function bandEnergy(power, binHz, fLo, fHi) {
    const lo = Math.max(0, Math.floor(fLo / binHz));
    const hi = Math.min(power.length, Math.ceil(fHi / binHz));
    let e = 0;
    for (let i = lo; i < hi; i++) e += power[i];
    return e;
}

/** Power-weighted mean frequency in Hz. */
export function spectralCentroid(power, binHz) {
    let num = 0, den = 0;
    for (let i = 0; i < power.length; i++) {
        num += i * binHz * power[i];
        den += power[i];
    }
    return den > 0 ? num / den : 0;
}
