#pragma once
/**
 * Audio buffer conversion utilities.
 * Handles interleaved ↔ deinterleaved channel conversion
 * and N-API Float32Array data access.
 */

#include <cstdint>

namespace wavloom {

/**
 * Deinterleave stereo audio: [L0,R0,L1,R1,...] → separate L/R buffers.
 */
inline void deinterleaveFloat32(const float* interleaved, float* left, float* right, int32_t frames) {
    for (int32_t i = 0; i < frames; i++) {
        left[i] = interleaved[i * 2];
        right[i] = interleaved[i * 2 + 1];
    }
}

/**
 * Interleave separate L/R buffers → [L0,R0,L1,R1,...].
 */
inline void interleaveFloat32(const float* left, const float* right, float* interleaved, int32_t frames) {
    for (int32_t i = 0; i < frames; i++) {
        interleaved[i * 2] = left[i];
        interleaved[i * 2 + 1] = right[i];
    }
}

/**
 * Zero-fill a buffer.
 */
inline void zeroBuffer(float* buffer, int32_t count) {
    for (int32_t i = 0; i < count; i++) {
        buffer[i] = 0.0f;
    }
}

} // namespace wavloom
