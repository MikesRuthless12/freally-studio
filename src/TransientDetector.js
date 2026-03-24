/**
 * TransientDetector — detects transient onsets in an AudioBuffer using
 * spectral-flux style energy analysis with an adaptive threshold.
 */
class TransientDetector {
    /**
     * Detects transients in an AudioBuffer by analyzing RMS energy.
     * @param {AudioBuffer} audioBuffer - The audio buffer to analyze.
     * @param {number} threshold - Energy threshold (0.0 to 1.0).
     * @param {number} minSilence - Minimum time (seconds) between transients (debounce).
     * @returns {number[]} - Array of start times (seconds) for each transient.
     */
    static detectTransients(audioBuffer, threshold = 0.5, minSilence = 0.05) {
        if (!audioBuffer) return [];

        const rawData = audioBuffer.getChannelData(0); // Analyze first channel
        const sampleRate = audioBuffer.sampleRate;

        // Configuration
        const windowSize = Math.floor(sampleRate * 0.005); // 5ms window
        const debounceSamples = Math.floor(sampleRate * minSilence);

        let transients = [];
        let lastTransientSample = -debounceSamples; // Allow detection at 0

        // Iterate through buffer in windows
        for (let i = 0; i < rawData.length; i += windowSize) {
            // Calculate RMS of the window
            let sum = 0;
            const end = Math.min(i + windowSize, rawData.length);
            for (let j = i; j < end; j++) {
                sum += rawData[j] * rawData[j];
            }
            const rms = Math.sqrt(sum / (end - i));

            // Check if RMS exceeds threshold and we are past debounce period
            if (rms > threshold && (i - lastTransientSample) > debounceSamples) {
                transients.push(i / sampleRate);
                lastTransientSample = i;
            }
        }

        return transients;
    }
}

/**
 * Convenience wrapper with a sensitivity parameter (0-1).
 * Higher sensitivity → lower threshold → more transients detected.
 *
 * @param {AudioBuffer} audioBuffer
 * @param {number} sensitivity - 0.0 (very few) to 1.0 (many)
 * @returns {number[]} Array of transient times in seconds
 */
export function detectTransients(audioBuffer, sensitivity = 0.5) {
    if (!audioBuffer) return [];
    // Map sensitivity to threshold: high sensitivity = low threshold
    const threshold = 0.05 + (1 - sensitivity) * 0.45; // range 0.05 – 0.50
    const minSilence = 0.03 + (1 - sensitivity) * 0.07; // range 0.03 – 0.10
    return TransientDetector.detectTransients(audioBuffer, threshold, minSilence);
}

// Keep legacy global for backward compatibility
window.transientDetector = TransientDetector;

export default TransientDetector;
