/**
 * WavLoom Audio Capture — WASAPI implementation.
 *
 * Device enumeration and background-thread audio capture using
 * Windows Audio Session API (WASAPI) in exclusive mode with
 * automatic fallback to shared mode.
 */

#include "audio_capture.h"
#include <stdexcept>
#include <cstring>

// Helper: build a WAVEFORMATEXTENSIBLE for float32 PCM
static WAVEFORMATEXTENSIBLE MakeFloat32Format(uint32_t sampleRate, uint32_t channels) {
    WAVEFORMATEXTENSIBLE wfx = {};
    wfx.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
    wfx.Format.nChannels = static_cast<WORD>(channels);
    wfx.Format.nSamplesPerSec = sampleRate;
    wfx.Format.wBitsPerSample = 32;
    wfx.Format.nBlockAlign = wfx.Format.nChannels * (wfx.Format.wBitsPerSample / 8);
    wfx.Format.nAvgBytesPerSec = wfx.Format.nSamplesPerSec * wfx.Format.nBlockAlign;
    wfx.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
    wfx.Samples.wValidBitsPerSample = 32;
    if (channels == 1)
        wfx.dwChannelMask = SPEAKER_FRONT_CENTER;
    else
        wfx.dwChannelMask = SPEAKER_FRONT_LEFT | SPEAKER_FRONT_RIGHT;
    wfx.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
    return wfx;
}

// ---- AudioCapture implementation ----

AudioCapture::AudioCapture() {}

AudioCapture::~AudioCapture() {
    if (m_capturing.load()) {
        m_stopRequested.store(true);
        if (m_thread.joinable()) m_thread.join();
    }
}

std::vector<DeviceInfo> AudioCapture::listInputDevices() {
    ComInit com;
    if (!com.ok())
        throw std::runtime_error("COM initialization failed");

    IMMDeviceEnumerator* enumerator = nullptr;
    HRESULT hr = CoCreateInstance(
        __uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
        __uuidof(IMMDeviceEnumerator), reinterpret_cast<void**>(&enumerator));
    if (FAILED(hr))
        throw std::runtime_error("Failed to create IMMDeviceEnumerator (HRESULT=" + std::to_string(hr) + ")");

    IMMDeviceCollection* collection = nullptr;
    hr = enumerator->EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE, &collection);
    if (FAILED(hr)) {
        SafeRelease(enumerator);
        throw std::runtime_error("EnumAudioEndpoints failed (HRESULT=" + std::to_string(hr) + ")");
    }

    UINT count = 0;
    collection->GetCount(&count);

    std::vector<DeviceInfo> devices;
    devices.reserve(count);

    for (UINT i = 0; i < count; ++i) {
        IMMDevice* device = nullptr;
        if (FAILED(collection->Item(i, &device))) continue;

        DeviceInfo info;

        // Device ID
        LPWSTR deviceId = nullptr;
        if (SUCCEEDED(device->GetId(&deviceId))) {
            info.id = deviceId;
            CoTaskMemFree(deviceId);
        }

        // Friendly name
        IPropertyStore* props = nullptr;
        if (SUCCEEDED(device->OpenPropertyStore(STGM_READ, &props))) {
            PROPVARIANT varName;
            PropVariantInit(&varName);
            if (SUCCEEDED(props->GetValue(PKEY_Device_FriendlyName, &varName))) {
                if (varName.vt == VT_LPWSTR && varName.pwszVal)
                    info.name = varName.pwszVal;
            }
            PropVariantClear(&varName);
            SafeRelease(props);
        }

        // Default format (sample rate, channels) via IAudioClient::GetMixFormat
        IAudioClient* audioClient = nullptr;
        if (SUCCEEDED(device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                                        reinterpret_cast<void**>(&audioClient)))) {
            WAVEFORMATEX* mixFormat = nullptr;
            if (SUCCEEDED(audioClient->GetMixFormat(&mixFormat))) {
                info.sampleRate = mixFormat->nSamplesPerSec;
                info.channels = mixFormat->nChannels;
                CoTaskMemFree(mixFormat);
            } else {
                info.sampleRate = 44100;
                info.channels = 2;
            }
            SafeRelease(audioClient);
        } else {
            info.sampleRate = 44100;
            info.channels = 2;
        }

        devices.push_back(std::move(info));
        SafeRelease(device);
    }

    SafeRelease(collection);
    SafeRelease(enumerator);
    return devices;
}

IMMDevice* AudioCapture::getDeviceById(IMMDeviceEnumerator* enumerator, const std::wstring& id) {
    if (id.empty()) {
        // Default capture device
        IMMDevice* device = nullptr;
        HRESULT hr = enumerator->GetDefaultAudioEndpoint(eCapture, eConsole, &device);
        if (FAILED(hr))
            throw std::runtime_error("No default capture device found (HRESULT=" + std::to_string(hr) + ")");
        return device;
    }

    IMMDevice* device = nullptr;
    HRESULT hr = enumerator->GetDevice(id.c_str(), &device);
    if (FAILED(hr))
        throw std::runtime_error("Device not found: HRESULT=" + std::to_string(hr));
    return device;
}

void AudioCapture::startCapture(const std::wstring& deviceId, uint32_t sampleRate, uint32_t channels) {
    if (m_capturing.load())
        throw std::runtime_error("Capture already in progress");

    // Clear previous state
    {
        std::lock_guard<std::mutex> lock(m_bufferMutex);
        m_capturedSamples.clear();
    }
    {
        std::lock_guard<std::mutex> lock(m_errorMutex);
        m_captureError.clear();
    }
    m_rmsLevel.store(0.0f);
    m_stopRequested.store(false);
    m_capturing.store(true);

    m_thread = std::thread(&AudioCapture::captureThreadFunc, this, deviceId, sampleRate, channels);
}

std::vector<float> AudioCapture::stopCapture() {
    if (!m_capturing.load()) {
        // Not capturing — return empty buffer instead of crashing.
        // This can happen when the capture thread died before stop was called.
        if (m_thread.joinable()) m_thread.join();
        std::lock_guard<std::mutex> lock(m_bufferMutex);
        auto partial = std::move(m_capturedSamples);
        m_capturedSamples.clear();
        return partial;
    }

    m_stopRequested.store(true);
    if (m_thread.joinable()) m_thread.join();
    m_capturing.store(false);
    m_rmsLevel.store(0.0f);

    // Check for errors from capture thread — log but don't throw
    {
        std::lock_guard<std::mutex> lock(m_errorMutex);
        if (!m_captureError.empty()) {
            // Error already happened on the capture thread; return whatever was captured
            m_captureError.clear();
        }
    }

    std::lock_guard<std::mutex> lock(m_bufferMutex);
    return std::move(m_capturedSamples);
}

float AudioCapture::getLevel() const {
    return m_rmsLevel.load(std::memory_order_relaxed);
}

bool AudioCapture::isCapturing() const {
    return m_capturing.load(std::memory_order_relaxed);
}

void AudioCapture::attachRingBuffer(int32_t* statePtr, float* dataPtr,
                                     uint32_t capacity, uint32_t channels, uint32_t sampleRate) {
    m_ringBuffer.attach(statePtr, dataPtr, capacity, channels, sampleRate);
}

void AudioCapture::detachRingBuffer() {
    m_ringBuffer.detach();
}

// ---- Background capture thread ----

void AudioCapture::captureThreadFunc(std::wstring deviceId, uint32_t sampleRate, uint32_t channels) {
    ComInit com;
    if (!com.ok()) {
        std::lock_guard<std::mutex> lock(m_errorMutex);
        m_captureError = "COM initialization failed on capture thread";
        m_capturing.store(false);
        return;
    }

    IMMDeviceEnumerator* enumerator = nullptr;
    IMMDevice* device = nullptr;
    IAudioClient* audioClient = nullptr;
    IAudioCaptureClient* captureClient = nullptr;
    bool useSharedMode = false;

    // AVRT thread priority
    HANDLE hTask = nullptr;
    DWORD taskIndex = 0;

    auto cleanup = [&]() {
        if (hTask) AvRevertMmThreadCharacteristics(hTask);
        SafeRelease(captureClient);
        if (audioClient) { audioClient->Stop(); SafeRelease(audioClient); }
        SafeRelease(device);
        SafeRelease(enumerator);
    };

    try {
        // Create enumerator
        HRESULT hr = CoCreateInstance(
            __uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
            __uuidof(IMMDeviceEnumerator), reinterpret_cast<void**>(&enumerator));
        if (FAILED(hr))
            throw std::runtime_error("CoCreateInstance(MMDeviceEnumerator) failed: " + std::to_string(hr));

        // Get device
        device = getDeviceById(enumerator, deviceId);

        // Activate audio client
        hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                              reinterpret_cast<void**>(&audioClient));
        if (FAILED(hr))
            throw std::runtime_error("IAudioClient activation failed: " + std::to_string(hr));

        // Build desired format
        WAVEFORMATEXTENSIBLE wfx = MakeFloat32Format(sampleRate, channels);

        // Try exclusive mode first
        REFERENCE_TIME defaultPeriod = 0, minPeriod = 0;
        audioClient->GetDevicePeriod(&defaultPeriod, &minPeriod);
        if (minPeriod == 0) minPeriod = 100000; // 10ms fallback

        hr = audioClient->Initialize(
            AUDCLNT_SHAREMODE_EXCLUSIVE,
            AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
            minPeriod,
            minPeriod,
            reinterpret_cast<WAVEFORMATEX*>(&wfx),
            nullptr);

        if (FAILED(hr)) {
            // Exclusive mode failed — fall back to shared mode with device mix format.
            printf("[AudioCapture] Exclusive mode failed (hr=0x%08X), trying shared mode...\n", (unsigned)hr);
            fflush(stdout);

            SafeRelease(audioClient);
            hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                                  reinterpret_cast<void**>(&audioClient));
            if (FAILED(hr))
                throw std::runtime_error("IAudioClient re-activation failed: " + std::to_string(hr));

            WAVEFORMATEX* mixFormat = nullptr;
            hr = audioClient->GetMixFormat(&mixFormat);
            if (FAILED(hr))
                throw std::runtime_error("GetMixFormat failed: " + std::to_string(hr));

            printf("[AudioCapture] Device mix format: rate=%u ch=%u bits=%u tag=%u\n",
                   mixFormat->nSamplesPerSec, mixFormat->nChannels,
                   mixFormat->wBitsPerSample, mixFormat->wFormatTag);
            fflush(stdout);

            // Use default period for shared mode
            audioClient->GetDevicePeriod(&defaultPeriod, &minPeriod);

            // Try shared mode with event callback first
            hr = audioClient->Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                defaultPeriod,
                0,
                mixFormat,
                nullptr);

            printf("[AudioCapture] Shared+event init: hr=0x%08X\n", (unsigned)hr);
            fflush(stdout);

            // If event callback fails (common with USB mics), retry without it (polling mode)
            if (FAILED(hr)) {
                printf("[AudioCapture] Event callback failed, trying polling mode...\n");
                fflush(stdout);

                SafeRelease(audioClient);
                hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                                      reinterpret_cast<void**>(&audioClient));
                if (FAILED(hr)) {
                    CoTaskMemFree(mixFormat);
                    throw std::runtime_error("IAudioClient re-activation for polling failed: " + std::to_string(hr));
                }

                // Get fresh period for the new client
                audioClient->GetDevicePeriod(&defaultPeriod, &minPeriod);

                // Use a generous 100ms buffer for USB devices
                REFERENCE_TIME bufferDuration = 1000000; // 100ms in 100ns units

                hr = audioClient->Initialize(
                    AUDCLNT_SHAREMODE_SHARED,
                    0,  // No event callback — use polling
                    bufferDuration,
                    0,
                    mixFormat,
                    nullptr);

                printf("[AudioCapture] Shared+polling init: hr=0x%08X\n", (unsigned)hr);
                fflush(stdout);
            }

            // Save actual format info for conversion
            sampleRate = mixFormat->nSamplesPerSec;
            channels = mixFormat->nChannels;
            CoTaskMemFree(mixFormat);

            if (FAILED(hr))
                throw std::runtime_error("IAudioClient::Initialize (shared) failed: " + std::to_string(hr));

            useSharedMode = true;
        }

        // Create event for buffer-ready notification (only if event callback mode)
        HANDLE hEvent = nullptr;
        if (!useSharedMode || (useSharedMode && audioClient)) {
            // Try to set event handle — if the client was initialized without
            // EVENTCALLBACK flag, SetEventHandle will fail; that's OK, we poll.
            hEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
            if (hEvent) {
                hr = audioClient->SetEventHandle(hEvent);
                if (FAILED(hr)) {
                    // Event mode not supported — fall back to polling
                    CloseHandle(hEvent);
                    hEvent = nullptr;
                }
            }
        }

        // Get capture client
        hr = audioClient->GetService(__uuidof(IAudioCaptureClient),
                                     reinterpret_cast<void**>(&captureClient));
        if (FAILED(hr)) {
            if (hEvent) CloseHandle(hEvent);
            throw std::runtime_error("GetService(IAudioCaptureClient) failed: " + std::to_string(hr));
        }

        // Boost thread priority for low-latency capture
        hTask = AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);

        // Start capture
        hr = audioClient->Start();
        if (FAILED(hr)) {
            if (hEvent) CloseHandle(hEvent);
            throw std::runtime_error("IAudioClient::Start failed: " + std::to_string(hr));
        }

        // Capture loop — event-driven if hEvent is set, polling otherwise
        while (!m_stopRequested.load(std::memory_order_relaxed)) {
            if (hEvent) {
                DWORD waitResult = WaitForSingleObject(hEvent, 100);
                if (waitResult == WAIT_TIMEOUT) continue;
                if (waitResult != WAIT_OBJECT_0) break;
            } else {
                // Polling mode: sleep briefly then check for available packets
                Sleep(5);
            }

            // Drain all available packets
            UINT32 packetLength = 0;
            while (SUCCEEDED(captureClient->GetNextPacketSize(&packetLength)) && packetLength > 0) {
                BYTE* data = nullptr;
                UINT32 numFrames = 0;
                DWORD flags = 0;

                hr = captureClient->GetBuffer(&data, &numFrames, &flags, nullptr, nullptr);
                if (FAILED(hr)) break;

                const uint32_t totalSamples = numFrames * channels;

                if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                    // Write silence to ring buffer (lock-free)
                    if (m_ringBuffer.isAttached()) {
                        static const float s_zeros[4096] = {};
                        uint32_t rem = totalSamples;
                        while (rem > 0) {
                            uint32_t n = rem < 4096 ? rem : 4096;
                            m_ringBuffer.write(s_zeros, n);
                            rem -= n;
                        }
                    }

                    // Silence — append zeros to internal buffer
                    std::lock_guard<std::mutex> lock(m_bufferMutex);
                    m_capturedSamples.resize(m_capturedSamples.size() + totalSamples, 0.0f);
                } else {
                    const float* floatData = reinterpret_cast<const float*>(data);

                    // Compute RMS for VU meter
                    double sumSq = 0.0;
                    for (uint32_t s = 0; s < totalSamples; ++s) {
                        double v = static_cast<double>(floatData[s]);
                        sumSq += v * v;
                    }
                    float rms = static_cast<float>(std::sqrt(sumSq / totalSamples));
                    m_rmsLevel.store(rms, std::memory_order_relaxed);

                    // Write to ring buffer for real-time streaming (lock-free)
                    if (m_ringBuffer.isAttached()) {
                        m_ringBuffer.write(floatData, totalSamples);
                    }

                    // Append to internal buffer
                    std::lock_guard<std::mutex> lock(m_bufferMutex);
                    m_capturedSamples.insert(m_capturedSamples.end(), floatData, floatData + totalSamples);
                }

                captureClient->ReleaseBuffer(numFrames);
            }
        }

        // Stop and cleanup
        audioClient->Stop();
        if (hEvent) CloseHandle(hEvent);

    } catch (const std::exception& e) {
        std::lock_guard<std::mutex> lock(m_errorMutex);
        m_captureError = e.what();
    }

    // Signal ring buffer reader that capture has ended
    m_ringBuffer.setCapturing(false);

    cleanup();

    // If thread exits due to error, mark as not capturing
    if (!m_stopRequested.load())
        m_capturing.store(false);
}
