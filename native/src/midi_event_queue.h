#pragma once
/**
 * Lock-free SPSC ring buffer for MIDI events.
 * The JS/main thread pushes note-on/off/CC events,
 * the audio processing thread drains them during processBlock.
 */

#include <atomic>
#include <cstdint>
#include <cstddef>

struct MidiEvent {
    enum Type : uint8_t { NoteOn, NoteOff, CC };
    Type type;
    uint8_t channel;
    uint8_t data1;     // note number or CC number
    float data2;       // velocity (0-1) or CC value (0-1)
    int32_t sampleOffset; // offset within the current processing buffer
};

class MidiEventQueue {
public:
    static constexpr size_t CAPACITY = 512;

    MidiEventQueue() : head_(0), tail_(0) {}

    /**
     * Push a MIDI event (called from main/JS thread).
     */
    bool push(const MidiEvent& event) {
        size_t head = head_.load(std::memory_order_relaxed);
        size_t next = (head + 1) % CAPACITY;
        if (next == tail_.load(std::memory_order_acquire)) {
            return false; // full
        }
        buffer_[head] = event;
        head_.store(next, std::memory_order_release);
        return true;
    }

    /**
     * Pop a single MIDI event (called from audio thread).
     */
    bool pop(MidiEvent& out) {
        size_t tail = tail_.load(std::memory_order_relaxed);
        if (tail == head_.load(std::memory_order_acquire)) {
            return false; // empty
        }
        out = buffer_[tail];
        tail_.store((tail + 1) % CAPACITY, std::memory_order_release);
        return true;
    }

    /**
     * Drain all available events into an output array (called from audio thread).
     * Returns the number of events drained.
     */
    size_t drain(MidiEvent* outArray, size_t maxCount) {
        size_t count = 0;
        MidiEvent evt;
        while (count < maxCount && pop(evt)) {
            outArray[count++] = evt;
        }
        return count;
    }

private:
    MidiEvent buffer_[CAPACITY];
    std::atomic<size_t> head_;
    std::atomic<size_t> tail_;
};
