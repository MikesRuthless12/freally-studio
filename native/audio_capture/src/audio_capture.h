#pragma once

/**
 * Freally Audio Capture — WASAPI exclusive-mode audio input.
 *
 * Enumerates audio input devices, opens a capture stream on a selected device,
 * and captures raw PCM float32 samples in a background thread.
 */

#ifndef NOMINMAX
#define NOMINMAX
#endif

#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <functiondiscoverykeys_devpkey.h>
#include <avrt.h>

#include <atomic>
#include <cmath>
#include <cstdint>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "ring_buffer.h"

// RAII COM initializer — one per thread
struct ComInit {
    HRESULT hr;
    ComInit() : hr(CoInitializeEx(nullptr, COINIT_MULTITHREADED)) {}
    ~ComInit() { if (SUCCEEDED(hr)) CoUninitialize(); }
    bool ok() const { return SUCCEEDED(hr); }
};

// Safe COM pointer release
template<typename T>
inline void SafeRelease(T*& p) {
    if (p) { p->Release(); p = nullptr; }
}

// Info returned by listInputDevices()
struct DeviceInfo {
    std::wstring id;
    std::wstring name;
    uint32_t sampleRate;
    uint32_t channels;
};

class AudioCapture {
public:
    AudioCapture();
    ~AudioCapture();

    // Non-copyable
    AudioCapture(const AudioCapture&) = delete;
    AudioCapture& operator=(const AudioCapture&) = delete;

    // Enumerate audio input (capture) devices.
    // Returns a list of DeviceInfo structs.
    // Throws std::runtime_error on COM/WASAPI failures.
    std::vector<DeviceInfo> listInputDevices();

    // Start capturing audio from the given device.
    // deviceId: the id string from DeviceInfo (empty = default device).
    // sampleRate / channels: desired format. If the device doesn't support
    // the exact format in exclusive mode, falls back to shared mode.
    void startCapture(const std::wstring& deviceId, uint32_t sampleRate, uint32_t channels);

    // Stop the capture thread and return all captured samples as a
    // contiguous float32 buffer (interleaved if multi-channel).
    std::vector<float> stopCapture();

    // Get the current RMS level (updated continuously during capture).
    float getLevel() const;

    // Is a capture currently running?
    bool isCapturing() const;

    // Attach a SharedArrayBuffer-backed ring buffer for real-time streaming.
    // Must be called BEFORE startCapture(). The capture thread will write
    // samples into this ring buffer in addition to the internal buffer.
    void attachRingBuffer(int32_t* statePtr, float* dataPtr,
                          uint32_t capacity, uint32_t channels, uint32_t sampleRate);

    // Detach the ring buffer. Safe to call while capturing (the capture
    // thread will stop writing to it) or after stopCapture().
    void detachRingBuffer();

private:
    void captureThreadFunc(std::wstring deviceId, uint32_t sampleRate, uint32_t channels);
    IMMDevice* getDeviceById(IMMDeviceEnumerator* enumerator, const std::wstring& id);

    std::thread m_thread;
    std::atomic<bool> m_capturing{false};
    std::atomic<bool> m_stopRequested{false};
    std::atomic<float> m_rmsLevel{0.0f};

    // Captured sample buffer — written by capture thread, read after stop.
    std::mutex m_bufferMutex;
    std::vector<float> m_capturedSamples;

    // Error from capture thread
    std::mutex m_errorMutex;
    std::string m_captureError;

    // Ring buffer for real-time streaming to AudioWorklet
    RingBufferWriter m_ringBuffer;
};
