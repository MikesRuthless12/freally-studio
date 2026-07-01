#pragma once
/**
 * Helper to build a Steinberg::Vst::ProcessContext from host transport state.
 * Used by PluginInstance::processBlock() to inform plugins about
 * tempo, position, time signature, and playback state.
 */

#ifdef VST3_SDK_AVAILABLE

#include "pluginterfaces/vst/ivstprocesscontext.h"
#include <cstdint>
#include <cmath>
#ifdef _WIN32
#include <windows.h>
#else
#include <chrono>
#endif

namespace freally {

inline Steinberg::Vst::ProcessContext buildProcessContext(
    double sampleRate,
    double tempo,
    double positionBeats,
    int32_t timeSigNumerator,
    int32_t timeSigDenominator,
    bool isPlaying,
    bool isRecording,
    bool isLooping,
    double loopStartBeats = 0.0,
    double loopEndBeats = 0.0
) {
    using namespace Steinberg::Vst;

    ProcessContext ctx = {};

    // Sample rate
    ctx.sampleRate = sampleRate;

    // State flags
    ctx.state = ProcessContext::kTempoValid
              | ProcessContext::kTimeSigValid
              | ProcessContext::kProjectTimeMusicValid
              | ProcessContext::kBarPositionValid
              | ProcessContext::kContTimeValid
              | ProcessContext::kSystemTimeValid
              | ProcessContext::kClockValid;

    if (isPlaying) ctx.state |= ProcessContext::kPlaying;
    if (isRecording) ctx.state |= ProcessContext::kRecording;
    if (isLooping) {
        ctx.state |= ProcessContext::kCycleActive | ProcessContext::kCycleValid;
        ctx.cycleStartMusic = loopStartBeats;
        ctx.cycleEndMusic = loopEndBeats;
    }

    // Tempo
    ctx.tempo = tempo;

    // Time signature
    ctx.timeSigNumerator = timeSigNumerator;
    ctx.timeSigDenominator = timeSigDenominator;

    // Position in quarter notes (beats)
    ctx.projectTimeMusic = positionBeats;

    // Position in samples
    double beatsPerSecond = tempo / 60.0;
    double positionSeconds = positionBeats / beatsPerSecond;
    ctx.projectTimeSamples = static_cast<int64_t>(std::round(positionSeconds * sampleRate));

    // Continuous time in samples (project time without loop wrap)
    ctx.continousTimeSamples = ctx.projectTimeSamples;

    // Bar position (which bar are we in, 0-based in quarter notes from bar start)
    double beatsPerBar = static_cast<double>(timeSigNumerator) * 4.0 / static_cast<double>(timeSigDenominator);
    ctx.barPositionMusic = std::floor(positionBeats / beatsPerBar) * beatsPerBar;

    // MIDI Clock reference: 24 pulses per quarter note (24 PPQN)
    // samplesToNextClock = samples until next 1/24th-beat boundary
    {
        double clocksPerBeat = 24.0;
        double clockPos = positionBeats * clocksPerBeat;
        double fractional = clockPos - std::floor(clockPos);
        double distBeats = (1.0 - fractional) / clocksPerBeat;
        double samplesPerBeat = sampleRate / beatsPerSecond;
        ctx.samplesToNextClock = static_cast<int32_t>(std::round(distBeats * samplesPerBeat));
    }

    // System time in nanoseconds
#ifdef _WIN32
    {
        static LARGE_INTEGER freq = {};
        if (freq.QuadPart == 0) QueryPerformanceFrequency(&freq);
        LARGE_INTEGER now;
        QueryPerformanceCounter(&now);
        ctx.systemTime = static_cast<int64_t>((now.QuadPart * 1000000000LL) / freq.QuadPart);
    }
#else
    {
        auto now = std::chrono::high_resolution_clock::now().time_since_epoch();
        ctx.systemTime = std::chrono::duration_cast<std::chrono::nanoseconds>(now).count();
    }
#endif

    return ctx;
}

} // namespace freally

#endif // VST3_SDK_AVAILABLE
