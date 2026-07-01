#pragma once
/**
 * N-API wrapper functions for VST3Host and PluginInstance.
 * These bridge between JavaScript values and C++ types.
 */

#include <napi.h>

namespace freally_napi {

// Plugin lifecycle
Napi::Value LoadPlugin(const Napi::CallbackInfo& info);
Napi::Value UnloadPlugin(const Napi::CallbackInfo& info);
Napi::Value UnloadAll(const Napi::CallbackInfo& info);

// Audio processing
Napi::Value ProcessBlock(const Napi::CallbackInfo& info);

// MIDI
Napi::Value SendNoteOn(const Napi::CallbackInfo& info);
Napi::Value SendNoteOff(const Napi::CallbackInfo& info);
Napi::Value SendCC(const Napi::CallbackInfo& info);

// Parameters
Napi::Value SetParameter(const Napi::CallbackInfo& info);
Napi::Value GetParameter(const Napi::CallbackInfo& info);
Napi::Value GetParameterList(const Napi::CallbackInfo& info);

// Transport
Napi::Value SetTransportState(const Napi::CallbackInfo& info);

// Audio settings
Napi::Value SetSampleRate(const Napi::CallbackInfo& info);
Napi::Value SetBlockSize(const Napi::CallbackInfo& info);

// State (presets)
Napi::Value GetPluginState(const Napi::CallbackInfo& info);
Napi::Value SetPluginState(const Napi::CallbackInfo& info);

// Editor (plugin GUI window)
Napi::Value OpenEditor(const Napi::CallbackInfo& info);
Napi::Value CloseEditor(const Napi::CallbackInfo& info);
Napi::Value IsEditorOpen(const Napi::CallbackInfo& info);

// Editor key callback (spacebar passthrough)
Napi::Value RegisterEditorKeyCallback(const Napi::CallbackInfo& info);

} // namespace freally_napi
