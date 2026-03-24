#pragma once
/**
 * Lock-free Single-Producer Single-Consumer (SPSC) ring buffer
 * for parameter changes. The JS/main thread pushes, the audio
 * processing thread pops.
 */

#include <atomic>
#include <cstdint>
#include <cstddef>

struct ParamChange {
    uint32_t paramId;
    double value;
};

class ParameterQueue {
public:
    static constexpr size_t CAPACITY = 256;

    ParameterQueue() : head_(0), tail_(0) {}

    /**
     * Push a parameter change (called from main/JS thread).
     * Returns false if the queue is full.
     */
    bool push(uint32_t paramId, double value) {
        size_t head = head_.load(std::memory_order_relaxed);
        size_t next = (head + 1) % CAPACITY;
        if (next == tail_.load(std::memory_order_acquire)) {
            return false; // full
        }
        buffer_[head] = { paramId, value };
        head_.store(next, std::memory_order_release);
        return true;
    }

    /**
     * Pop a parameter change (called from audio thread).
     * Returns false if the queue is empty.
     */
    bool pop(ParamChange& out) {
        size_t tail = tail_.load(std::memory_order_relaxed);
        if (tail == head_.load(std::memory_order_acquire)) {
            return false; // empty
        }
        out = buffer_[tail];
        tail_.store((tail + 1) % CAPACITY, std::memory_order_release);
        return true;
    }

private:
    ParamChange buffer_[CAPACITY];
    std::atomic<size_t> head_;
    std::atomic<size_t> tail_;
};
