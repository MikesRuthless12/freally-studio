/**
 * N-API wrapper implementations for VST3 host functions.
 *
 * Plugin calls are wrapped in __try/__except (SEH) to catch access violations
 * from buggy plugins. The VEH in napi_bindings.cpp NOP-patches crashing
 * instructions for permanent fix; SEH here catches the exception for the
 * current call and returns a clean error to JavaScript.
 */

#include "napi_plugin_wrapper.h"

#ifdef VST3_SDK_AVAILABLE

#include "vst3_host.h"
#include "audio_buffer.h"
#include "process_context.h"
#include <vector>
#include <string>
#include <cmath>

#ifdef _WIN32
#include <windows.h>
#include <cstdio>

// Generic SEH wrapper — calls a function pointer inside __try/__except.
// This function has ZERO C++ objects with destructors, so MSVC allows __try.
// The actual C++ work happens in the called function (via function pointer).
typedef int (*SEH_PluginCallFn)(void* ctx);

static int SEH_CallPlugin(SEH_PluginCallFn fn, void* ctx, const char* desc) {
    int result = -1;
    __try {
        result = fn(ctx);
    } __except(GetExceptionCode() == EXCEPTION_ACCESS_VIOLATION ?
               EXCEPTION_EXECUTE_HANDLER : EXCEPTION_CONTINUE_SEARCH) {
        if (desc) {
            fprintf(stderr, "[WavLoom] Plugin crashed during %s — caught by SEH\n", desc);
            fflush(stderr);
        }
        result = -1;
    }
    return result;
}

// --- Typed context structs and C++ worker functions ---

struct LoadPluginCtx {
    VST3Host* host;
    const char* path;
    const char* uid;
    std::string resultId;
};

static int DoLoadPlugin(void* ctx) {
    auto* c = (LoadPluginCtx*)ctx;
    c->resultId = c->host->loadPlugin(c->path, c->uid);
    return 0;
}

struct ProcessBlockCtx {
    PluginInstance* plugin;
    float** inBuffers;
    float** outBuffers;
    int numFrames;
    int numInCh;
    int pluginOutCh; // Total output channels the plugin needs (all buses)
    Steinberg::Vst::ProcessContext* processCtx;
};

static int DoProcessBlock(void* ctx) {
    auto* c = (ProcessBlockCtx*)ctx;
    c->plugin->processBlock(
        c->numInCh > 0 ? c->inBuffers : nullptr,
        c->outBuffers,
        c->numFrames,
        c->numInCh > 0 ? 2 : 0,
        c->pluginOutCh,
        c->processCtx
    );
    return 0;
}

struct OpenEditorCtx {
    PluginInstance* plugin;
    std::string errorMsg;
    bool success;
};

static int DoOpenEditor(void* ctx) {
    auto* c = (OpenEditorCtx*)ctx;
    c->errorMsg = c->plugin->openEditor();
    c->success = c->errorMsg.empty();
    return 0;
}

#endif // _WIN32

namespace wavloom_napi {

// --- Plugin lifecycle ---

Napi::Value LoadPlugin(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected (path: string, uid?: string)").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string path = info[0].As<Napi::String>().Utf8Value();
    std::string uid = (info.Length() > 1 && info[1].IsString())
        ? info[1].As<Napi::String>().Utf8Value()
        : "";

    std::string instanceId;

#ifdef _WIN32
    {
        LoadPluginCtx ctx;
        ctx.host = &VST3Host::instance();
        ctx.path = path.c_str();
        ctx.uid = uid.c_str();
        int sehResult = SEH_CallPlugin(DoLoadPlugin, &ctx, "loadPlugin");
        if (sehResult != 0) {
            Napi::Error::New(env, "Plugin crashed during loading (access violation). Try loading again.")
                .ThrowAsJavaScriptException();
            return env.Undefined();
        }
        instanceId = std::move(ctx.resultId);
    }
#else
    {
        auto& host = VST3Host::instance();
        instanceId = host.loadPlugin(path, uid);
    }
#endif

    try {
        auto* plugin = VST3Host::instance().getPlugin(instanceId);

        // Return plugin info object
        Napi::Object result = Napi::Object::New(env);
        result.Set("instanceId", Napi::String::New(env, instanceId));
        result.Set("name", Napi::String::New(env, plugin ? plugin->getName() : "Unknown"));
        result.Set("vendor", Napi::String::New(env, plugin ? plugin->getVendor() : "Unknown"));
        result.Set("isInstrument", Napi::Boolean::New(env, plugin ? plugin->isInstrument() : false));
        result.Set("numInputChannels", Napi::Number::New(env, plugin ? plugin->getNumInputChannels() : 0));
        result.Set("numOutputChannels", Napi::Number::New(env, plugin ? plugin->getNumOutputChannels() : 2));
        result.Set("hasMidiInput", Napi::Boolean::New(env, plugin ? plugin->hasMidiInput() : false));
        result.Set("parameterCount", Napi::Number::New(env, plugin ? plugin->getParameterCount() : 0));

        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

Napi::Value UnloadPlugin(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) return Napi::Boolean::New(env, false);

    std::string instanceId = info[0].As<Napi::String>().Utf8Value();
    bool ok = VST3Host::instance().unloadPlugin(instanceId);
    return Napi::Boolean::New(env, ok);
}

Napi::Value UnloadAll(const Napi::CallbackInfo& info) {
    VST3Host::instance().unloadAll();
    return info.Env().Undefined();
}

// --- Audio Processing ---

Napi::Value ProcessBlock(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Args: (instanceId, inputFloat32Array, numFrames, numInputChannels, numOutputChannels)
    if (info.Length() < 5) {
        Napi::TypeError::New(env, "Expected (instanceId, input, numFrames, numInCh, numOutCh)")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string instanceId = info[0].As<Napi::String>().Utf8Value();
    int32_t numFrames = info[2].As<Napi::Number>().Int32Value();
    int32_t numInCh = info[3].As<Napi::Number>().Int32Value();
    int32_t numOutCh = info[4].As<Napi::Number>().Int32Value();

    // SECURITY (A7): bounds-check all caller-supplied counts before any
    // allocation or pointer arithmetic. Block sizes above 8192 frames are
    // not used by Web Audio (typical 128-1024) and channel counts above 32
    // exceed any realistic plugin layout — reject these to avoid huge
    // allocations and to make the deinterleave length checks below sound.
    if (numFrames < 0 || numFrames > 8192) {
        Napi::Error::New(env, "numFrames out of range [0, 8192]").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (numInCh < 0 || numInCh > 32) {
        Napi::Error::New(env, "numInCh out of range [0, 32]").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (numOutCh < 0 || numOutCh > 32) {
        Napi::Error::New(env, "numOutCh out of range [0, 32]").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    auto* plugin = VST3Host::instance().getPlugin(instanceId);
    if (!plugin) {
        return env.Null();
    }

    // Get input data
    float* inputData = nullptr;
    size_t inputLen = 0;
    if (info[1].IsTypedArray()) {
        auto inputArray = info[1].As<Napi::Float32Array>();
        inputData = inputArray.Data();
        inputLen = inputArray.ElementLength();
    }

    // SECURITY (A7): verify the input typed array is large enough for the
    // requested deinterleave (numFrames * numInCh samples). If it is too
    // small, reading inputData[0..numFrames*numInCh) would read past the
    // backing ArrayBuffer.
    if (inputData && numInCh > 0) {
        const size_t needed = static_cast<size_t>(numFrames) * static_cast<size_t>(numInCh);
        if (inputLen < needed) {
            Napi::Error::New(env, "input typed array too small for numFrames*numInCh").ThrowAsJavaScriptException();
            return env.Undefined();
        }
    }

    // Deinterleave input
    std::vector<float> inLeft(numFrames, 0.0f);
    std::vector<float> inRight(numFrames, 0.0f);
    if (inputData && numInCh >= 2) {
        wavloom::deinterleaveFloat32(inputData, inLeft.data(), inRight.data(), numFrames);
    } else if (inputData && numInCh == 1) {
        std::copy(inputData, inputData + numFrames, inLeft.data());
        std::copy(inputData, inputData + numFrames, inRight.data());
    }

    // Setup channel buffer pointers
    float* inBuffers[2] = { inLeft.data(), inRight.data() };

    // Allocate output buffers for ALL plugin output channels (not just stereo).
    // Multi-output plugins like Omnisphere (9 buses × 2ch = 18ch) need valid buffers
    // for every channel, even though we only return the first stereo pair to JS.
    int32_t pluginOutCh = plugin->getNumOutputChannels(); // e.g. 18 for Omnisphere
    if (pluginOutCh < numOutCh) pluginOutCh = numOutCh;
    if (pluginOutCh < 2) pluginOutCh = 2;

    std::vector<std::vector<float>> outChannels(pluginOutCh, std::vector<float>(numFrames, 0.0f));
    std::vector<float*> outBufferPtrs(pluginOutCh);
    for (int32_t i = 0; i < pluginOutCh; i++) {
        outBufferPtrs[i] = outChannels[i].data();
    }

    // Build process context from transport state
    auto& transport = VST3Host::instance().getTransport();
    double sampleRate = VST3Host::instance().getSampleRate();
    double tempo = transport.tempo.load(std::memory_order_relaxed);
    double posBeats = transport.positionBeats.load(std::memory_order_relaxed);
    bool isPlaying = transport.playing.load(std::memory_order_relaxed);
    bool isLooping = transport.looping.load(std::memory_order_relaxed);
    double loopStart = transport.loopStartBeats.load(std::memory_order_relaxed);
    double loopEnd = transport.loopEndBeats.load(std::memory_order_relaxed);

    // Log transport state transitions for debugging
    static bool lastPlayingState = false;
    if (isPlaying != lastPlayingState) {
        fprintf(stderr, "[WavLoom Transport] playing: %s -> %s | tempo=%.1f pos=%.3f\n",
                lastPlayingState ? "true" : "false",
                isPlaying ? "true" : "false",
                tempo, posBeats);
        fflush(stderr);
        lastPlayingState = isPlaying;
    }

    auto processCtx = wavloom::buildProcessContext(
        sampleRate, tempo, posBeats,
        transport.timeSigNumerator.load(std::memory_order_relaxed),
        transport.timeSigDenominator.load(std::memory_order_relaxed),
        isPlaying,
        transport.recording.load(std::memory_order_relaxed),
        isLooping, loopStart, loopEnd
    );

    // Auto-advance position by exact block duration.
    // Each processBlock produces exactly numFrames samples, so the transport
    // must advance by the corresponding beat duration for sample-accurate
    // event alignment. The JS fetch loop gates calls to ~43/s (audio clock
    // rate) via a block counter, preventing cumulative drift.
    if (isPlaying && tempo > 0 && sampleRate > 0) {
        double blockBeats = (static_cast<double>(numFrames) / sampleRate) * (tempo / 60.0);
        double nextPos = posBeats + blockBeats;
        // Wrap at loop boundary if looping
        if (isLooping && loopEnd > loopStart && nextPos >= loopEnd) {
            nextPos = loopStart + std::fmod(nextPos - loopStart, loopEnd - loopStart);
        }
        transport.positionBeats.store(nextPos, std::memory_order_relaxed);
    }

    // Process (SEH-protected: plugin may crash during audio processing)
#ifdef _WIN32
    {
        ProcessBlockCtx ctx;
        ctx.plugin = plugin;
        ctx.inBuffers = inBuffers;
        ctx.outBuffers = outBufferPtrs.data();
        ctx.numFrames = numFrames;
        ctx.numInCh = numInCh;
        ctx.pluginOutCh = pluginOutCh;
        ctx.processCtx = &processCtx;
        int sehResult = SEH_CallPlugin(DoProcessBlock, &ctx, nullptr);
        if (sehResult != 0) {
            // Return silence on crash — VEH has NOP-patched the instruction,
            // so subsequent processBlock calls should work.
            return env.Null();
        }
    }
#else
    plugin->processBlock(
        numInCh > 0 ? inBuffers : nullptr,
        outBufferPtrs.data(),
        numFrames,
        numInCh > 0 ? 2 : 0,
        pluginOutCh,
        &processCtx
    );
#endif

    // Check if bus 0 (main stereo pair) has audio.
    // If it does, use it as-is (plugin provides a mixed output on bus 0).
    // If bus 0 is silent, sum all other buses — some plugins (e.g. Spawn)
    // only output on buses 1+ with bus 0 empty.
    float bus0Peak = 0.0f;
    for (int32_t i = 0; i < numFrames; i++) {
        float v = std::abs(outChannels[0][i]);
        if (v > bus0Peak) bus0Peak = v;
        v = std::abs(outChannels[1][i]);
        if (v > bus0Peak) bus0Peak = v;
    }
    if (bus0Peak < 0.00001f && pluginOutCh > 2) {
        // Bus 0 is silent — sum all other buses into it
        for (int32_t ch = 2; ch < pluginOutCh; ch += 2) {
            for (int32_t i = 0; i < numFrames; i++) {
                outChannels[0][i] += outChannels[ch][i];
                if (ch + 1 < pluginOutCh) {
                    outChannels[1][i] += outChannels[ch + 1][i];
                }
            }
        }
    }

    // Interleave summed stereo and return as Float32Array
    auto outputArray = Napi::Float32Array::New(env, numFrames * numOutCh);
    float* outputData = outputArray.Data();
    if (numOutCh >= 2) {
        wavloom::interleaveFloat32(outChannels[0].data(), outChannels[1].data(), outputData, numFrames);
    } else if (numOutCh == 1) {
        std::copy(outChannels[0].data(), outChannels[0].data() + numFrames, outputData);
    }

    return outputArray;
}

// --- MIDI ---

Napi::Value SendNoteOn(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 4) return env.Undefined();

    std::string id = info[0].As<Napi::String>().Utf8Value();
    int32_t ch = info[1].As<Napi::Number>().Int32Value();
    int32_t note = info[2].As<Napi::Number>().Int32Value();
    float vel = info[3].As<Napi::Number>().FloatValue();

    auto* plugin = VST3Host::instance().getPlugin(id);
    if (plugin) plugin->sendNoteOn(ch, note, vel);
    return env.Undefined();
}

Napi::Value SendNoteOff(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 4) return env.Undefined();

    std::string id = info[0].As<Napi::String>().Utf8Value();
    int32_t ch = info[1].As<Napi::Number>().Int32Value();
    int32_t note = info[2].As<Napi::Number>().Int32Value();
    float vel = info[3].As<Napi::Number>().FloatValue();

    auto* plugin = VST3Host::instance().getPlugin(id);
    if (plugin) plugin->sendNoteOff(ch, note, vel);
    return env.Undefined();
}

Napi::Value SendCC(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 4) return env.Undefined();

    std::string id = info[0].As<Napi::String>().Utf8Value();
    int32_t ch = info[1].As<Napi::Number>().Int32Value();
    int32_t cc = info[2].As<Napi::Number>().Int32Value();
    float val = info[3].As<Napi::Number>().FloatValue();

    auto* plugin = VST3Host::instance().getPlugin(id);
    if (plugin) plugin->sendCC(ch, cc, val);
    return env.Undefined();
}

// --- Parameters ---

Napi::Value SetParameter(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 3) return env.Undefined();

    std::string id = info[0].As<Napi::String>().Utf8Value();
    uint32_t paramId = info[1].As<Napi::Number>().Uint32Value();
    double value = info[2].As<Napi::Number>().DoubleValue();

    auto* plugin = VST3Host::instance().getPlugin(id);
    if (plugin) plugin->setParameterValue(paramId, value);
    return env.Undefined();
}

Napi::Value GetParameter(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) return Napi::Number::New(env, 0.0);

    std::string id = info[0].As<Napi::String>().Utf8Value();
    uint32_t paramId = info[1].As<Napi::Number>().Uint32Value();

    auto* plugin = VST3Host::instance().getPlugin(id);
    double value = plugin ? plugin->getParameterValue(paramId) : 0.0;
    return Napi::Number::New(env, value);
}

Napi::Value GetParameterList(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) return Napi::Array::New(env);

    std::string id = info[0].As<Napi::String>().Utf8Value();
    auto* plugin = VST3Host::instance().getPlugin(id);
    if (!plugin) return Napi::Array::New(env);

    int32_t count = plugin->getParameterCount();
    Napi::Array result = Napi::Array::New(env, count);

    for (int32_t i = 0; i < count; i++) {
        auto pInfo = plugin->getParameterInfo(i);
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("id", Napi::Number::New(env, pInfo.id));
        obj.Set("name", Napi::String::New(env, pInfo.name));
        obj.Set("units", Napi::String::New(env, pInfo.units));
        obj.Set("defaultValue", Napi::Number::New(env, pInfo.defaultValue));
        obj.Set("minValue", Napi::Number::New(env, pInfo.minValue));
        obj.Set("maxValue", Napi::Number::New(env, pInfo.maxValue));
        obj.Set("stepCount", Napi::Number::New(env, pInfo.stepCount));
        obj.Set("canAutomate", Napi::Boolean::New(env, pInfo.canAutomate));
        result.Set(i, obj);
    }

    return result;
}

// --- Transport ---

Napi::Value SetTransportState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject()) return env.Undefined();

    auto state = info[0].As<Napi::Object>();
    auto& host = VST3Host::instance();

    double tempo = state.Has("tempo") ? state.Get("tempo").As<Napi::Number>().DoubleValue() : 120.0;
    double pos = state.Has("positionBeats") ? state.Get("positionBeats").As<Napi::Number>().DoubleValue() : 0.0;
    int32_t tsNum = state.Has("timeSigNumerator") ? state.Get("timeSigNumerator").As<Napi::Number>().Int32Value() : 4;
    int32_t tsDen = state.Has("timeSigDenominator") ? state.Get("timeSigDenominator").As<Napi::Number>().Int32Value() : 4;
    bool playing = state.Has("isPlaying") ? state.Get("isPlaying").As<Napi::Boolean>().Value() : false;
    bool recording = state.Has("isRecording") ? state.Get("isRecording").As<Napi::Boolean>().Value() : false;
    bool looping = state.Has("loopEnabled") ? state.Get("loopEnabled").As<Napi::Boolean>().Value() : false;
    double loopStart = state.Has("loopStartBeats") ? state.Get("loopStartBeats").As<Napi::Number>().DoubleValue() : 0.0;
    double loopEnd = state.Has("loopEndBeats") ? state.Get("loopEndBeats").As<Napi::Number>().DoubleValue() : 0.0;

    host.setTransportState(tempo, pos, tsNum, tsDen, playing, recording, looping, loopStart, loopEnd);
    return env.Undefined();
}

// --- Audio settings ---

Napi::Value SetSampleRate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) return env.Undefined();
    VST3Host::instance().setSampleRate(info[0].As<Napi::Number>().DoubleValue());
    return env.Undefined();
}

Napi::Value SetBlockSize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) return env.Undefined();
    VST3Host::instance().setBlockSize(info[0].As<Napi::Number>().Int32Value());
    return env.Undefined();
}

// --- State (presets) ---

Napi::Value GetPluginState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) return env.Null();

    std::string id = info[0].As<Napi::String>().Utf8Value();
    auto* plugin = VST3Host::instance().getPlugin(id);
    if (!plugin) return env.Null();

    auto state = plugin->getState();
    if (state.empty()) return env.Null();

    auto buffer = Napi::Buffer<uint8_t>::Copy(env, state.data(), state.size());
    return buffer;
}

Napi::Value SetPluginState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) return Napi::Boolean::New(env, false);

    std::string id = info[0].As<Napi::String>().Utf8Value();
    auto* plugin = VST3Host::instance().getPlugin(id);
    if (!plugin) return Napi::Boolean::New(env, false);

    if (info[1].IsBuffer()) {
        auto buf = info[1].As<Napi::Buffer<uint8_t>>();
        std::vector<uint8_t> data(buf.Data(), buf.Data() + buf.Length());
        bool ok = plugin->setState(data);
        return Napi::Boolean::New(env, ok);
    }

    return Napi::Boolean::New(env, false);
}

// --- Editor (Plugin GUI Window) ---

Napi::Value OpenEditor(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);

    if (info.Length() < 1 || !info[0].IsString()) {
        result.Set("success", Napi::Boolean::New(env, false));
        result.Set("error", Napi::String::New(env, "Missing instanceId"));
        return result;
    }

    std::string id = info[0].As<Napi::String>().Utf8Value();
    auto* plugin = VST3Host::instance().getPlugin(id);
    if (!plugin) {
        result.Set("success", Napi::Boolean::New(env, false));
        result.Set("error", Napi::String::New(env, "Plugin instance not found"));
        return result;
    }

#ifdef _WIN32
    {
        OpenEditorCtx ctx;
        ctx.plugin = plugin;
        ctx.success = false;
        int sehResult = SEH_CallPlugin(DoOpenEditor, &ctx, "openEditor");
        if (sehResult != 0) {
            result.Set("success", Napi::Boolean::New(env, false));
            result.Set("error", Napi::String::New(env, "Plugin editor crashed. Try opening again."));
        } else {
            result.Set("success", Napi::Boolean::New(env, ctx.success));
            if (!ctx.success) {
                result.Set("error", Napi::String::New(env, ctx.errorMsg));
            }
        }
    }
#else
    try {
        std::string err = plugin->openEditor();
        bool ok = err.empty();
        result.Set("success", Napi::Boolean::New(env, ok));
        if (!ok) {
            result.Set("error", Napi::String::New(env, err));
        }
    } catch (const std::exception& e) {
        result.Set("success", Napi::Boolean::New(env, false));
        result.Set("error", Napi::String::New(env, e.what()));
    }
#endif

    return result;
}

Napi::Value CloseEditor(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) return env.Undefined();

    std::string id = info[0].As<Napi::String>().Utf8Value();
    auto* plugin = VST3Host::instance().getPlugin(id);
    if (plugin) plugin->closeEditor();
    return env.Undefined();
}

Napi::Value IsEditorOpen(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) return Napi::Boolean::New(env, false);

    std::string id = info[0].As<Napi::String>().Utf8Value();
    auto* plugin = VST3Host::instance().getPlugin(id);
    return Napi::Boolean::New(env, plugin ? plugin->isEditorOpen() : false);
}

// --- Editor key callback (spacebar passthrough) ---

static Napi::ThreadSafeFunction g_editorKeyTsfn;

Napi::Value RegisterEditorKeyCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsFunction()) {
        return env.Undefined();
    }

    // Release previous TSFN if any
    if (g_editorKeyTsfn) {
        g_editorKeyTsfn.Release();
        g_editorKeyTsfn = nullptr;
    }

    g_editorKeyTsfn = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "EditorKeyCallback",
        0,  // unlimited queue
        1   // initial thread count
    );

    // Wire up the static callback on PluginInstance so EditorWndProc can invoke it
    PluginInstance::setEditorKeyCallback([](int keyCode) {
        if (g_editorKeyTsfn) {
            int* data = new int(keyCode);
            g_editorKeyTsfn.NonBlockingCall(data, [](Napi::Env env, Napi::Function fn, int* keyCode) {
                fn.Call({Napi::String::New(env, "space")});
                delete keyCode;
            });
        }
    });

    return env.Undefined();
}

} // namespace wavloom_napi

#endif // VST3_SDK_AVAILABLE
