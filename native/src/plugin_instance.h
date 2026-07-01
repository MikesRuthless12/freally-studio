#pragma once
/**
 * PluginInstance — Wraps a single loaded VST3 plugin.
 *
 * Manages the full lifecycle: initialize → activate → process → deactivate → terminate.
 * Provides audio processing, MIDI input, parameter control, and state save/load.
 */

#ifdef VST3_SDK_AVAILABLE

#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivstprocesscontext.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/gui/iplugview.h"
#include "pluginterfaces/gui/iplugviewcontentscalesupport.h"
#include "public.sdk/source/vst/hosting/module.h"
#include "parameter_queue.h"
#include "midi_event_queue.h"

#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <cstdint>

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

class PluginInstance {
public:
    PluginInstance(VST3::Hosting::Module::Ptr module,
                  Steinberg::Vst::IComponent* component,
                  Steinberg::Vst::IAudioProcessor* processor,
                  Steinberg::Vst::IEditController* controller);
    ~PluginInstance();

    // Lifecycle
    bool initialize(double sampleRate, int32_t blockSize);
    bool activate();
    bool deactivate();
    void terminate();

    // Audio processing
    void processBlock(float** inputBuffers, float** outputBuffers,
                      int32_t numSamples, int32_t numInputChannels,
                      int32_t numOutputChannels,
                      const Steinberg::Vst::ProcessContext* context);

    // MIDI events (queued, consumed during processBlock)
    void sendNoteOn(int32_t channel, int32_t note, float velocity);
    void sendNoteOff(int32_t channel, int32_t note, float velocity);
    void sendCC(int32_t channel, int32_t cc, float value);

    // Parameters
    struct ParamInfo {
        uint32_t id;
        std::string name;
        std::string units;
        double defaultValue;
        double minValue;
        double maxValue;
        int32_t stepCount;
        bool canAutomate;
    };
    int32_t getParameterCount() const;
    ParamInfo getParameterInfo(int32_t index) const;
    double getParameterValue(uint32_t paramId) const;
    void setParameterValue(uint32_t paramId, double value);

    // Plugin info
    std::string getName() const { return name_; }
    std::string getVendor() const { return vendor_; }
    void setName(const std::string& name) { name_ = name; }
    void setVendor(const std::string& vendor) { vendor_ = vendor; }
    bool isInstrument() const { return isInstrument_; }
    int32_t getNumInputChannels() const { return numInputChannels_; }
    int32_t getNumOutputChannels() const { return numOutputChannels_; }
    int32_t getNumOutputBuses() const { return numOutputBuses_; }
    const std::vector<int32_t>& getOutputBusChannelCounts() const { return outputBusChannelCounts_; }
    bool hasMidiInput() const { return hasMidiInput_; }

    // State (preset save/load)
    std::vector<uint8_t> getState() const;
    bool setState(const std::vector<uint8_t>& data);

    // Editor (plugin GUI window)
    // Returns empty string on success, or error description on failure
    std::string openEditor();
    void closeEditor();
    bool isEditorOpen() const { return editorOpen_; }

    // Static callback for editor key events (spacebar passthrough to host)
    using EditorKeyCallback = std::function<void(int keyCode)>;
    static void setEditorKeyCallback(EditorKeyCallback cb);

private:
    VST3::Hosting::Module::Ptr module_;
    Steinberg::IPtr<Steinberg::Vst::IComponent> component_;
    Steinberg::IPtr<Steinberg::Vst::IAudioProcessor> processor_;
    Steinberg::IPtr<Steinberg::Vst::IEditController> controller_;

    bool initialized_ = false;
    bool active_ = false;
    double sampleRate_ = 44100.0;
    int32_t blockSize_ = 1024;

    // Plugin metadata
    std::string name_;
    std::string vendor_;
    bool isInstrument_ = false;
    int32_t numInputChannels_ = 0;
    int32_t numOutputChannels_ = 2;
    int32_t numOutputBuses_ = 1;
    std::vector<int32_t> outputBusChannelCounts_;
    bool hasMidiInput_ = false;

    // Lock-free queues
    ParameterQueue paramQueue_;
    MidiEventQueue midiQueue_;

    // Editor (plugin GUI)
    Steinberg::IPtr<Steinberg::IPlugView> plugView_;
    Steinberg::IPtr<Steinberg::IPlugFrame> plugFrame_;
    bool editorOpen_ = false;
#ifdef _WIN32
    HWND editorWindow_ = nullptr;
    static LRESULT CALLBACK EditorWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
    static bool windowClassRegistered_;
    void resizeWindowToView(int32_t viewWidth, int32_t viewHeight);
#endif

    // Internal helpers
    void queryBusInfo();
    void queryPluginInfo();

    friend class FreallyPlugFrame;
};

#endif // VST3_SDK_AVAILABLE
