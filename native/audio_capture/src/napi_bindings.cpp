/**
 * N-API module entry point for wavloom_audio_capture.
 *
 * Exposes WASAPI audio capture functionality to Node.js:
 *   - listInputDevices()  → array of device info objects
 *   - startCapture(deviceId, sampleRate, channels) → void
 *   - stopCapture()       → Float32Array of captured samples
 *   - getLevel()          → number (RMS level 0.0–1.0)
 *   - getVersion()        → string
 *   - isCapturing()       → boolean
 *   - attachRingBuffer(stateView, dataView, capacity, channels, sampleRate) → void
 *   - detachRingBuffer()  → void
 */

#include <napi.h>

#ifdef _WIN32
#include "audio_capture.h"
#include <locale>
#include <codecvt>

// Singleton capture instance
static AudioCapture g_capture;

// Persistent references to SharedArrayBuffer-backed TypedArrays.
// Prevents GC while the native capture thread holds raw pointers into them.
static Napi::ObjectReference g_ringStateRef;
static Napi::ObjectReference g_ringDataRef;

// UTF-16 <-> UTF-8 conversion helpers
static std::string WideToUtf8(const std::wstring& wide) {
    if (wide.empty()) return {};
    int size = WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), static_cast<int>(wide.size()),
                                   nullptr, 0, nullptr, nullptr);
    std::string result(size, '\0');
    WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), static_cast<int>(wide.size()),
                        &result[0], size, nullptr, nullptr);
    return result;
}

static std::wstring Utf8ToWide(const std::string& utf8) {
    if (utf8.empty()) return {};
    int size = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                                   nullptr, 0);
    std::wstring result(size, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()),
                        &result[0], size);
    return result;
}

// ---- N-API exported functions ----

/**
 * listInputDevices() → [{ id: string, name: string, sampleRate: number, channels: number }]
 */
static Napi::Value ListInputDevices(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        auto devices = g_capture.listInputDevices();
        Napi::Array result = Napi::Array::New(env, devices.size());

        for (size_t i = 0; i < devices.size(); ++i) {
            Napi::Object obj = Napi::Object::New(env);
            obj.Set("id", Napi::String::New(env, WideToUtf8(devices[i].id)));
            obj.Set("name", Napi::String::New(env, WideToUtf8(devices[i].name)));
            obj.Set("sampleRate", Napi::Number::New(env, devices[i].sampleRate));
            obj.Set("channels", Napi::Number::New(env, devices[i].channels));
            result.Set(static_cast<uint32_t>(i), obj);
        }

        return result;

    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("listInputDevices failed: ") + e.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

/**
 * startCapture(deviceId: string, sampleRate: number, channels: number) → void
 *
 * deviceId: device id from listInputDevices(), or empty string for default device.
 */
static Napi::Value StartCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: deviceId, sampleRate, channels")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "deviceId must be a string").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!info[1].IsNumber()) {
        Napi::TypeError::New(env, "sampleRate must be a number").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!info[2].IsNumber()) {
        Napi::TypeError::New(env, "channels must be a number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string deviceIdUtf8 = info[0].As<Napi::String>().Utf8Value();
    uint32_t sampleRate = info[1].As<Napi::Number>().Uint32Value();
    uint32_t channels = info[2].As<Napi::Number>().Uint32Value();

    if (sampleRate == 0 || sampleRate > 384000) {
        Napi::RangeError::New(env, "sampleRate must be between 1 and 384000")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (channels == 0 || channels > 32) {
        Napi::RangeError::New(env, "channels must be between 1 and 32")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    try {
        g_capture.startCapture(Utf8ToWide(deviceIdUtf8), sampleRate, channels);
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("startCapture failed: ") + e.what())
            .ThrowAsJavaScriptException();
    }

    return env.Undefined();
}

/**
 * stopCapture() → Float32Array of all captured samples (interleaved if multi-channel)
 */
static Napi::Value StopCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    try {
        std::vector<float> samples = g_capture.stopCapture();

        // Create a Float32Array backed by a new ArrayBuffer
        size_t byteLength = samples.size() * sizeof(float);
        Napi::ArrayBuffer buffer = Napi::ArrayBuffer::New(env, byteLength);
        if (!samples.empty()) {
            std::memcpy(buffer.Data(), samples.data(), byteLength);
        }

        return Napi::Float32Array::New(env, samples.size(), buffer, 0);

    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("stopCapture failed: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

/**
 * getLevel() → number (RMS level, 0.0 to ~1.0)
 */
static Napi::Value GetLevel(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), g_capture.getLevel());
}

/**
 * isCapturing() → boolean
 */
static Napi::Value IsCapturing(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), g_capture.isCapturing());
}

/**
 * attachRingBuffer(stateView: Int32Array, dataView: Float32Array,
 *                  capacity: number, channels: number, sampleRate: number) → void
 *
 * Attaches SharedArrayBuffer-backed memory for lock-free real-time streaming
 * from the WASAPI capture thread to the renderer's AudioWorklet.
 */
static Napi::Value AttachRingBuffer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 5) {
        Napi::TypeError::New(env,
            "Expected 5 arguments: stateView, dataView, capacity, channels, sampleRate")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    if (!info[0].IsTypedArray() || !info[1].IsTypedArray()) {
        Napi::TypeError::New(env, "stateView and dataView must be TypedArrays")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Int32Array stateView = info[0].As<Napi::Int32Array>();
    Napi::Float32Array dataView = info[1].As<Napi::Float32Array>();
    uint32_t capacity = info[2].As<Napi::Number>().Uint32Value();
    uint32_t channels = info[3].As<Napi::Number>().Uint32Value();
    uint32_t sampleRate = info[4].As<Napi::Number>().Uint32Value();

    if (stateView.ElementLength() < 8) {
        Napi::RangeError::New(env, "stateView must have at least 8 Int32 elements")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (dataView.ElementLength() < capacity) {
        Napi::RangeError::New(env, "dataView must have at least 'capacity' Float32 elements")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int32_t* statePtr = stateView.Data();
    float* dataPtr = dataView.Data();

    // Store persistent references to prevent GC of the backing SharedArrayBuffers
    g_ringStateRef = Napi::Persistent(stateView.As<Napi::Object>());
    g_ringDataRef = Napi::Persistent(dataView.As<Napi::Object>());

    try {
        g_capture.attachRingBuffer(statePtr, dataPtr, capacity, channels, sampleRate);
    } catch (const std::exception& e) {
        g_ringStateRef.Reset();
        g_ringDataRef.Reset();
        Napi::Error::New(env, std::string("attachRingBuffer failed: ") + e.what())
            .ThrowAsJavaScriptException();
    }

    return env.Undefined();
}

/**
 * detachRingBuffer() → void
 *
 * Detaches the ring buffer. The capture thread stops writing to it.
 */
static Napi::Value DetachRingBuffer(const Napi::CallbackInfo& info) {
    g_capture.detachRingBuffer();
    g_ringStateRef.Reset();
    g_ringDataRef.Reset();
    return info.Env().Undefined();
}

#else

// Non-Windows stub — WASAPI is Windows-only
static Napi::Value NotSupported(const Napi::CallbackInfo& info) {
    Napi::Error::New(info.Env(), "Audio capture is only supported on Windows (WASAPI)")
        .ThrowAsJavaScriptException();
    return info.Env().Undefined();
}

#endif // _WIN32

/**
 * getVersion() → string
 */
static Napi::Value GetVersion(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), "1.0.0");
}

// ---- Module initialization ----

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    napi_env nenv = env;

    exports.Set("getVersion", Napi::Function::New<GetVersion>(nenv));

#ifdef _WIN32
    exports.Set("listInputDevices", Napi::Function::New<ListInputDevices>(nenv));
    exports.Set("startCapture", Napi::Function::New<StartCapture>(nenv));
    exports.Set("stopCapture", Napi::Function::New<StopCapture>(nenv));
    exports.Set("getLevel", Napi::Function::New<GetLevel>(nenv));
    exports.Set("isCapturing", Napi::Function::New<IsCapturing>(nenv));
    exports.Set("attachRingBuffer", Napi::Function::New<AttachRingBuffer>(nenv));
    exports.Set("detachRingBuffer", Napi::Function::New<DetachRingBuffer>(nenv));
#else
    exports.Set("listInputDevices", Napi::Function::New<NotSupported>(nenv));
    exports.Set("startCapture", Napi::Function::New<NotSupported>(nenv));
    exports.Set("stopCapture", Napi::Function::New<NotSupported>(nenv));
    exports.Set("getLevel", Napi::Function::New<NotSupported>(nenv));
    exports.Set("isCapturing", Napi::Function::New<NotSupported>(nenv));
    exports.Set("attachRingBuffer", Napi::Function::New<NotSupported>(nenv));
    exports.Set("detachRingBuffer", Napi::Function::New<NotSupported>(nenv));
#endif

    return exports;
}

NODE_API_MODULE(wavloom_audio_capture, Init)
