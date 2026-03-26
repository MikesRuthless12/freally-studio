#pragma once

/**
 * Lock-free SPSC (single-producer, single-consumer) ring buffer writer
 * that operates on externally-owned SharedArrayBuffer memory.
 *
 * The reader lives in a JavaScript AudioWorklet (using Atomics API).
 * The writer lives in the native WASAPI capture thread (this class).
 *
 * Memory layout:
 *
 *   State buffer (Int32Array, 8 elements):
 *     [0] writePos   — sample offset of next write (writer updates, reader reads)
 *     [1] readPos    — sample offset of next read  (reader updates, writer reads)
 *     [2] capacity   — total samples in data buffer (set once at attach)
 *     [3] channels   — number of audio channels     (set once at attach)
 *     [4] sampleRate — capture sample rate           (set once at attach)
 *     [5] overruns   — overrun count (writer increments when ring is full)
 *     [6] capturing  — 1 while capturing, 0 when stopped
 *     [7] reserved
 *
 *   Data buffer (Float32Array, capacity elements):
 *     Circular buffer of interleaved float32 audio samples.
 *
 * Protocol:
 *   - One slot is always kept empty to distinguish full from empty.
 *   - Writer: load readPos (acquire), compute space, write data,
 *             store writePos (release).
 *   - Reader: load writePos (acquire), compute available, read data,
 *             store readPos (release).
 *
 * On x86, aligned int32 reads/writes are naturally atomic. We use
 * std::atomic reinterpret_cast for correct compiler barriers and
 * cross-platform correctness.
 */

#include <atomic>
#include <cstdint>
#include <cstring>

class RingBufferWriter {
public:
    // State slot indices — must match AudioWorklet reader (capture-ring-reader.js)
    static constexpr int WRITE_POS   = 0;
    static constexpr int READ_POS    = 1;
    static constexpr int CAPACITY    = 2;
    static constexpr int CHANNELS    = 3;
    static constexpr int SAMPLE_RATE = 4;
    static constexpr int OVERRUNS    = 5;
    static constexpr int CAPTURING   = 6;

    RingBufferWriter() = default;

    /**
     * Attach to externally-owned SharedArrayBuffer memory.
     *
     * @param statePtr   Pointer to 8 x int32 (state SharedArrayBuffer data)
     * @param dataPtr    Pointer to float array (data SharedArrayBuffer data)
     * @param capacity   Total float samples in the data buffer
     * @param channels   Number of audio channels (1=mono, 2=stereo)
     * @param sampleRate Capture sample rate in Hz
     */
    void attach(int32_t* statePtr, float* dataPtr, uint32_t capacity,
                uint32_t channels, uint32_t sampleRate) {
        m_state = statePtr;
        m_data = dataPtr;
        m_capacity = capacity;

        // Initialize state via atomic stores for cross-thread/process visibility
        auto* s = reinterpret_cast<std::atomic<int32_t>*>(m_state);
        s[WRITE_POS].store(0, std::memory_order_release);
        s[READ_POS].store(0, std::memory_order_release);
        s[CAPACITY].store(static_cast<int32_t>(capacity), std::memory_order_release);
        s[CHANNELS].store(static_cast<int32_t>(channels), std::memory_order_release);
        s[SAMPLE_RATE].store(static_cast<int32_t>(sampleRate), std::memory_order_release);
        s[OVERRUNS].store(0, std::memory_order_release);
        s[CAPTURING].store(1, std::memory_order_release);

        m_attached.store(true, std::memory_order_release);
    }

    /**
     * Detach from the shared memory. Sets CAPTURING=0 so the worklet
     * knows the capture has ended.
     */
    void detach() {
        if (m_state) {
            auto* s = reinterpret_cast<std::atomic<int32_t>*>(m_state);
            s[CAPTURING].store(0, std::memory_order_release);
        }
        m_attached.store(false, std::memory_order_release);
        m_state = nullptr;
        m_data = nullptr;
        m_capacity = 0;
    }

    /** Thread-safe check — can be called from the capture thread. */
    bool isAttached() const {
        return m_attached.load(std::memory_order_acquire);
    }

    /**
     * Write samples into the ring buffer. Lock-free, safe to call from
     * the WASAPI capture thread.
     *
     * @param samples  Pointer to interleaved float32 samples
     * @param count    Number of float samples to write
     * @return         Number of samples actually written (< count = overrun)
     */
    uint32_t write(const float* samples, uint32_t count) {
        if (!m_attached.load(std::memory_order_relaxed) || !m_state || !m_data || count == 0)
            return 0;

        auto* s = reinterpret_cast<std::atomic<int32_t>*>(m_state);
        const uint32_t cap = m_capacity;
        const uint32_t wp = static_cast<uint32_t>(
            s[WRITE_POS].load(std::memory_order_relaxed));
        const uint32_t rp = static_cast<uint32_t>(
            s[READ_POS].load(std::memory_order_acquire));

        // Available space (one slot always empty to distinguish full/empty)
        const uint32_t used = (wp >= rp) ? (wp - rp) : (cap - rp + wp);
        const uint32_t space = cap - used - 1;

        if (space == 0) {
            s[OVERRUNS].fetch_add(1, std::memory_order_relaxed);
            return 0;
        }

        const uint32_t toWrite = (count <= space) ? count : space;

        // Two-pass memcpy for wrap-around
        const uint32_t firstChunk = (wp + toWrite <= cap) ? toWrite : (cap - wp);
        std::memcpy(m_data + wp, samples, firstChunk * sizeof(float));
        if (firstChunk < toWrite) {
            std::memcpy(m_data, samples + firstChunk,
                        (toWrite - firstChunk) * sizeof(float));
        }

        // Advance write position with release — reader sees data before new position
        const uint32_t newWp = (wp + toWrite) % cap;
        s[WRITE_POS].store(static_cast<int32_t>(newWp), std::memory_order_release);

        if (toWrite < count) {
            s[OVERRUNS].fetch_add(1, std::memory_order_relaxed);
        }

        return toWrite;
    }

    /** Signal capture state to the worklet reader. */
    void setCapturing(bool capturing) {
        if (m_state) {
            auto* s = reinterpret_cast<std::atomic<int32_t>*>(m_state);
            s[CAPTURING].store(capturing ? 1 : 0, std::memory_order_release);
        }
    }

private:
    int32_t*  m_state    = nullptr;
    float*    m_data     = nullptr;
    uint32_t  m_capacity = 0;
    std::atomic<bool> m_attached{false};
};
