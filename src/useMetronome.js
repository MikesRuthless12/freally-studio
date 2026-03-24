import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useMetronome — Ableton-style click track
 *
 * Synthesises a high "TICK" on beat 1 and a lower "tock" on beats 2-3-4.
 * Routes directly to audioContext.destination (bypasses track buses)
 * so it is never included in audio exports.
 *
 * Uses the same ref-based setInterval polling pattern as the generators
 * to keep audio scheduling decoupled from React rendering.
 */
export function useMetronome(globalCurrentStepRef, globalIsPlayingRef, globalTempo, globalBars) {
    const [metronomeEnabled, setMetronomeEnabled] = useState(false);
    const [metronomeVolume, setMetronomeVolume] = useState(0.5);

    // Audio nodes — created once
    const ctxRef = useRef(null);
    const metroGainRef = useRef(null);

    // Mirror state into refs for the polling interval
    const metronomeEnabledRef = useRef(metronomeEnabled);
    const metronomeVolumeRef = useRef(metronomeVolume);
    const globalTempoRef = useRef(globalTempo);
    const globalBarsRef = useRef(globalBars);

    useEffect(() => { metronomeEnabledRef.current = metronomeEnabled; }, [metronomeEnabled]);
    useEffect(() => { metronomeVolumeRef.current = metronomeVolume; }, [metronomeVolume]);
    useEffect(() => { globalTempoRef.current = globalTempo; }, [globalTempo]);
    useEffect(() => { globalBarsRef.current = globalBars; }, [globalBars]);

    // --- One-time audio setup ---
    useEffect(() => {
        if (!window.sharedAnalysisCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.sharedAnalysisCtx = new Ctx({ latencyHint: 'playback' });
        }
        ctxRef.current = window.sharedAnalysisCtx;

        // Independent gain node → destination (bypasses track buses & master)
        const gain = ctxRef.current.createGain();
        gain.gain.value = 0.5;
        gain.connect(ctxRef.current.destination);
        metroGainRef.current = gain;

        return () => {
            try { gain.disconnect(); } catch (e) { /* already disconnected */ }
        };
    }, []);

    // Keep the gain node in sync with volume state
    useEffect(() => {
        if (metroGainRef.current && ctxRef.current) {
            metroGainRef.current.gain.setTargetAtTime(
                metronomeVolume,
                ctxRef.current.currentTime,
                0.01
            );
        }
    }, [metronomeVolume]);

    // --- Click synthesis (Ableton-style TICK / tock) ---
    const playClick = useCallback((accented) => {
        const ctx = ctxRef.current;
        const dest = metroGainRef.current;
        if (!ctx || !dest) return;

        const now = ctx.currentTime;
        const freq   = accented ? 1500 : 1000;
        const hpFreq = accented ? 1200 : 800;
        const decay   = accented ? 0.04 : 0.03;
        const amp     = accented ? 1.0  : 0.6;

        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = hpFreq;
        hp.Q.value = 1.0;

        const env = ctx.createGain();
        env.gain.setValueAtTime(amp, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + decay);

        osc.connect(hp);
        hp.connect(env);
        env.connect(dest);

        osc.start(now);
        osc.stop(now + decay + 0.01);

        // Break GC references after the oscillator finishes
        osc.onended = () => {
            osc.disconnect();
            hp.disconnect();
            env.disconnect();
            osc.onended = null;
        };
    }, []);

    // --- Scheduling: ref-based polling (same pattern as generators) ---
    const lastProcessedStepRef = useRef(-1);

    useEffect(() => {
        if (!globalCurrentStepRef || !globalIsPlayingRef) return;

        const poll = () => {
            if (!globalIsPlayingRef.current || !metronomeEnabledRef.current) {
                if (lastProcessedStepRef.current !== -1) {
                    lastProcessedStepRef.current = -1;
                }
                return;
            }

            const currentStep = globalCurrentStepRef.current;
            if (currentStep < 0) return;

            const totalSteps = globalBarsRef.current * 32;

            // Reset on loop-wrap or first run
            if (lastProcessedStepRef.current === -1 || currentStep < lastProcessedStepRef.current) {
                lastProcessedStepRef.current = currentStep - 1;
            }

            if (currentStep === lastProcessedStepRef.current) return;

            // Catch-up loop (handles skipped frames) — capped to prevent burst
            const catchUpStart = Math.max(lastProcessedStepRef.current + 1, currentStep - 3);
            for (let step = catchUpStart; step <= currentStep; step++) {
                const triggerStep = step % totalSteps;

                // Beats land every 8 steps (32 steps/bar, 4 beats/bar)
                if (triggerStep % 8 === 0) {
                    const isDownbeat = (triggerStep % 32 === 0);
                    playClick(isDownbeat);
                }
            }

            lastProcessedStepRef.current = currentStep;
        };

        const id = setInterval(poll, 25); // ~40 Hz — reduced from 125 Hz to lower main-thread pressure
        return () => clearInterval(id);
    }, [globalCurrentStepRef, globalIsPlayingRef, playClick]);

    return { metronomeEnabled, setMetronomeEnabled, metronomeVolume, setMetronomeVolume };
}
