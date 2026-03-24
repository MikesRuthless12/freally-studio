/**
 * PluginInstance implementation.
 */

#ifdef VST3_SDK_AVAILABLE

#include "plugin_instance.h"
#include "audio_buffer.h"
#include "process_context.h"

#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "pluginterfaces/vst/ivstmessage.h"
#include "pluginterfaces/base/ibstream.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"

#include "pluginterfaces/vst/ivstcomponent.h"

#include <cstring>
#include <iostream>
#include <algorithm>

using namespace Steinberg;
using namespace Steinberg::Vst;

// Minimal IComponentHandler — required by many plugins before they create editor views
class MinimalComponentHandler : public IComponentHandler {
public:
    MinimalComponentHandler() : refCount_(1) {}

    // IComponentHandler
    tresult PLUGIN_API beginEdit(ParamID /*id*/) override { return kResultOk; }
    tresult PLUGIN_API performEdit(ParamID /*id*/, ParamValue /*valueNormalized*/) override { return kResultOk; }
    tresult PLUGIN_API endEdit(ParamID /*id*/) override { return kResultOk; }
    tresult PLUGIN_API restartComponent(int32 /*flags*/) override { return kResultOk; }

    // FUnknown
    tresult PLUGIN_API queryInterface(const TUID _iid, void** obj) override {
        if (FUnknownPrivate::iidEqual(_iid, IComponentHandler::iid) ||
            FUnknownPrivate::iidEqual(_iid, FUnknown::iid)) {
            addRef();
            *obj = static_cast<IComponentHandler*>(this);
            return kResultOk;
        }
        *obj = nullptr;
        return kNoInterface;
    }
    uint32 PLUGIN_API addRef() override { return ++refCount_; }
    uint32 PLUGIN_API release() override {
        uint32 r = --refCount_;
        if (r == 0) delete this;
        return r;
    }

private:
    std::atomic<uint32> refCount_;
};

// Simple in-memory stream for state save/load
class MemoryStream : public IBStream {
public:
    MemoryStream() : refCount_(1), pos_(0) {}
    MemoryStream(const uint8_t* data, size_t size)
        : refCount_(1), pos_(0), data_(data, data + size) {}

    tresult PLUGIN_API read(void* buffer, int32 numBytes, int32* numBytesRead) override {
        if (!buffer) return kInvalidArgument;
        int32 available = static_cast<int32>(data_.size() - pos_);
        int32 toRead = std::min(numBytes, available);
        if (toRead > 0) {
            std::memcpy(buffer, data_.data() + pos_, toRead);
            pos_ += toRead;
        }
        if (numBytesRead) *numBytesRead = toRead;
        return kResultOk;
    }

    tresult PLUGIN_API write(void* buffer, int32 numBytes, int32* numBytesWritten) override {
        if (!buffer && numBytes > 0) return kInvalidArgument;
        size_t newPos = pos_ + numBytes;
        if (newPos > data_.size()) data_.resize(newPos);
        if (numBytes > 0) {
            std::memcpy(data_.data() + pos_, buffer, numBytes);
            pos_ = newPos;
        }
        if (numBytesWritten) *numBytesWritten = numBytes;
        return kResultOk;
    }

    tresult PLUGIN_API seek(int64 pos, int32 mode, int64* result) override {
        int64 newPos = 0;
        switch (mode) {
            case kIBSeekSet: newPos = pos; break;
            case kIBSeekCur: newPos = static_cast<int64>(pos_) + pos; break;
            case kIBSeekEnd: newPos = static_cast<int64>(data_.size()) + pos; break;
            default: return kInvalidArgument;
        }
        if (newPos < 0) newPos = 0;
        pos_ = static_cast<size_t>(newPos);
        if (result) *result = static_cast<int64>(pos_);
        return kResultOk;
    }

    tresult PLUGIN_API tell(int64* pos) override {
        if (pos) *pos = static_cast<int64>(pos_);
        return kResultOk;
    }

    tresult PLUGIN_API queryInterface(const TUID _iid, void** obj) override {
        if (FUnknownPrivate::iidEqual(_iid, IBStream::iid) ||
            FUnknownPrivate::iidEqual(_iid, FUnknown::iid)) {
            addRef();
            *obj = static_cast<IBStream*>(this);
            return kResultOk;
        }
        *obj = nullptr;
        return kNoInterface;
    }

    uint32 PLUGIN_API addRef() override { return ++refCount_; }
    uint32 PLUGIN_API release() override {
        uint32 r = --refCount_;
        if (r == 0) delete this;
        return r;
    }

    const std::vector<uint8_t>& getData() const { return data_; }

private:
    std::atomic<uint32> refCount_;
    size_t pos_;
    std::vector<uint8_t> data_;
};

// Simple IParameterChanges / IParamValueQueue implementations for processBlock
class SingleParamValueQueue : public IParamValueQueue {
public:
    SingleParamValueQueue(ParamID id, double value)
        : refCount_(1), paramId_(id), value_(value) {}

    ParamID PLUGIN_API getParameterId() override { return paramId_; }
    int32 PLUGIN_API getPointCount() override { return 1; }
    tresult PLUGIN_API getPoint(int32 index, int32& sampleOffset, ParamValue& value) override {
        if (index != 0) return kInvalidArgument;
        sampleOffset = 0;
        value = value_;
        return kResultOk;
    }
    tresult PLUGIN_API addPoint(int32, ParamValue, int32&) override { return kResultOk; }

    tresult PLUGIN_API queryInterface(const TUID _iid, void** obj) override {
        if (FUnknownPrivate::iidEqual(_iid, IParamValueQueue::iid) ||
            FUnknownPrivate::iidEqual(_iid, FUnknown::iid)) {
            addRef(); *obj = this; return kResultOk;
        }
        *obj = nullptr; return kNoInterface;
    }
    uint32 PLUGIN_API addRef() override { return ++refCount_; }
    uint32 PLUGIN_API release() override { auto r = --refCount_; if (r == 0) delete this; return r; }

private:
    std::atomic<uint32> refCount_;
    ParamID paramId_;
    double value_;
};

class SimpleParameterChanges : public IParameterChanges {
public:
    SimpleParameterChanges() : refCount_(1) {}

    void addChange(ParamID id, double value) {
        queues_.push_back(new SingleParamValueQueue(id, value));
    }

    int32 PLUGIN_API getParameterCount() override {
        return static_cast<int32>(queues_.size());
    }
    IParamValueQueue* PLUGIN_API getParameterData(int32 index) override {
        if (index < 0 || index >= static_cast<int32>(queues_.size())) return nullptr;
        return queues_[index];
    }
    IParamValueQueue* PLUGIN_API addParameterData(const ParamID&, int32&) override {
        return nullptr;
    }

    tresult PLUGIN_API queryInterface(const TUID _iid, void** obj) override {
        if (FUnknownPrivate::iidEqual(_iid, IParameterChanges::iid) ||
            FUnknownPrivate::iidEqual(_iid, FUnknown::iid)) {
            addRef(); *obj = this; return kResultOk;
        }
        *obj = nullptr; return kNoInterface;
    }
    uint32 PLUGIN_API addRef() override { return ++refCount_; }
    uint32 PLUGIN_API release() override {
        auto r = --refCount_;
        if (r == 0) {
            for (auto q : queues_) q->release();
            delete this;
        }
        return r;
    }

private:
    std::atomic<uint32> refCount_;
    std::vector<SingleParamValueQueue*> queues_;
};

// Simple IEventList for MIDI events
class SimpleEventList : public IEventList {
public:
    SimpleEventList() : refCount_(1) {}

    void addNoteOn(int32_t channel, int32_t pitch, float velocity, int32_t sampleOffset) {
        Event e = {};
        e.type = Event::kNoteOnEvent;
        e.sampleOffset = sampleOffset;
        e.noteOn.channel = static_cast<int16>(channel);
        e.noteOn.pitch = static_cast<int16>(pitch);
        e.noteOn.velocity = velocity;
        e.noteOn.noteId = -1;
        e.noteOn.length = 0;
        e.noteOn.tuning = 0.0f;
        events_.push_back(e);
    }

    void addNoteOff(int32_t channel, int32_t pitch, float velocity, int32_t sampleOffset) {
        Event e = {};
        e.type = Event::kNoteOffEvent;
        e.sampleOffset = sampleOffset;
        e.noteOff.channel = static_cast<int16>(channel);
        e.noteOff.pitch = static_cast<int16>(pitch);
        e.noteOff.velocity = velocity;
        e.noteOff.noteId = -1;
        e.noteOff.tuning = 0.0f;
        events_.push_back(e);
    }

    int32 PLUGIN_API getEventCount() override {
        return static_cast<int32>(events_.size());
    }
    tresult PLUGIN_API getEvent(int32 index, Event& e) override {
        if (index < 0 || index >= static_cast<int32>(events_.size())) return kInvalidArgument;
        e = events_[index];
        return kResultOk;
    }
    tresult PLUGIN_API addEvent(Event& e) override {
        events_.push_back(e);
        return kResultOk;
    }

    tresult PLUGIN_API queryInterface(const TUID _iid, void** obj) override {
        if (FUnknownPrivate::iidEqual(_iid, IEventList::iid) ||
            FUnknownPrivate::iidEqual(_iid, FUnknown::iid)) {
            addRef(); *obj = this; return kResultOk;
        }
        *obj = nullptr; return kNoInterface;
    }
    uint32 PLUGIN_API addRef() override { return ++refCount_; }
    uint32 PLUGIN_API release() override { auto r = --refCount_; if (r == 0) delete this; return r; }

private:
    std::atomic<uint32> refCount_;
    std::vector<Event> events_;
};

// --- SEH-protected Win32 message pump ---
// After plugin activation, some plugins (e.g., Omnisphere) queue callbacks via
// PostMessage/SetTimer that fire when the Win32 message pump runs. If these callbacks
// crash (ACCESS_VIOLATION), the Electron process dies. By pumping messages inside
// __try/__except right after activation, we catch the crash and report it gracefully.
// This must be a standalone C function — MSVC prohibits __try/__except in functions
// with C++ objects that have destructors.
#ifdef _WIN32
static bool SEH_PumpPendingMessages(int iterations) {
    for (int i = 0; i < iterations; i++) {
        __try {
            MSG msg;
            while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        } __except(EXCEPTION_EXECUTE_HANDLER) {
            DWORD code = GetExceptionCode();
            fprintf(stderr, "[WavLoom] Plugin callback crash during message pump: 0x%08lX — plugin may be unstable\n", code);
            fflush(stderr);
            return false;
        }
        if (i < iterations - 1) Sleep(10);
    }
    return true;
}
#endif

// --- PluginInstance ---

#ifdef _WIN32
bool PluginInstance::windowClassRegistered_ = false;
static PluginInstance::EditorKeyCallback g_editorKeyCallback;
#endif

void PluginInstance::setEditorKeyCallback(EditorKeyCallback cb) {
#ifdef _WIN32
    g_editorKeyCallback = std::move(cb);
#endif
}

PluginInstance::PluginInstance(VST3::Hosting::Module::Ptr module,
                               IComponent* component,
                               IAudioProcessor* processor,
                               IEditController* controller)
    : module_(module)
    , component_(component)
    , processor_(processor)
    , controller_(controller)
{
    if (component_) component_->addRef();
    if (processor_) processor_->addRef();
    if (controller_) controller_->addRef();
}

PluginInstance::~PluginInstance() {
    closeEditor();
    if (active_) deactivate();
    if (initialized_) terminate();
}

bool PluginInstance::initialize(double sampleRate, int32_t blockSize) {
    if (initialized_) return true;

    sampleRate_ = sampleRate;
    blockSize_ = blockSize;

    // Initialize component with a proper host application context
    // Many plugins require a valid IHostApplication for their editor to work
    static Steinberg::Vst::HostApplication hostApp;
    auto result = component_->initialize(&hostApp);
    std::cout << "[VST3Init] component->initialize returned " << result << std::endl;
    if (result != kResultOk && result != kNotImplemented) {
        return false;
    }

    // Initialize edit controller if separate from component
    if (controller_) {
        // Check if controller is the same object as component (combined architecture)
        FUnknown* compUnk = nullptr;
        FUnknown* ctrlUnk = nullptr;
        component_->queryInterface(FUnknown::iid, reinterpret_cast<void**>(&compUnk));
        controller_->queryInterface(FUnknown::iid, reinterpret_cast<void**>(&ctrlUnk));
        bool isSameObject = (compUnk == ctrlUnk);
        if (compUnk) compUnk->release();
        if (ctrlUnk) ctrlUnk->release();

        std::cout << "[VST3Init] Controller is " << (isSameObject ? "SAME" : "SEPARATE") << " object as component" << std::endl;

        if (!isSameObject) {
            auto initResult = controller_->initialize(&hostApp);
            std::cout << "[VST3Init] controller->initialize returned " << initResult << std::endl;
        }
    }

    // Set component handler on the controller (CRITICAL for editor GUI)
    // Many plugins require this before createView() will succeed
    if (controller_) {
        auto* handler = new MinimalComponentHandler();
        auto handlerResult = controller_->setComponentHandler(handler);
        std::cout << "[VST3Init] setComponentHandler returned " << handlerResult << std::endl;
        handler->release(); // controller holds its own ref
    }

    // Connect component and controller via IConnectionPoint (required for separate architectures)
    if (controller_) {
        FUnknownPtr<Steinberg::Vst::IConnectionPoint> compCP(component_.get());
        FUnknownPtr<Steinberg::Vst::IConnectionPoint> ctrlCP(controller_.get());
        if (compCP && ctrlCP) {
            compCP->connect(ctrlCP);
            ctrlCP->connect(compCP);
            std::cout << "[VST3Init] Component <-> Controller connected via IConnectionPoint" << std::endl;
        }
    }

    // Synchronize component state to controller
    if (controller_) {
        MemoryStream stateStream;
        if (component_->getState(&stateStream) == kResultOk) {
            std::cout << "[VST3Init] component->getState returned 0" << std::endl;
            stateStream.seek(0, IBStream::kIBSeekSet, nullptr);
            auto setStateResult = controller_->setComponentState(&stateStream);
            std::cout << "[VST3Init] controller->setComponentState returned " << setStateResult << std::endl;
        }
    }

    std::cout << "[VST3Init] Setting up processing (sr=" << sampleRate << " bs=" << blockSize << ")..." << std::endl;
    std::cout.flush();

    // Setup processing
    ProcessSetup setup;
    setup.processMode = kRealtime;
    setup.symbolicSampleSize = kSample32;
    setup.maxSamplesPerBlock = blockSize;
    setup.sampleRate = sampleRate;

    result = processor_->setupProcessing(setup);
    std::cout << "[VST3Init] setupProcessing returned " << result << std::endl;
    std::cout.flush();
    if (result != kResultOk && result != kNotImplemented) {
        return false;
    }

    // Query bus info
    std::cout << "[VST3Init] Querying bus info..." << std::endl;
    std::cout.flush();
    queryBusInfo();
    std::cout << "[VST3Init] Bus info: in=" << numInputChannels_ << " out=" << numOutputChannels_
              << " midi=" << hasMidiInput_ << " instrument=" << isInstrument_ << std::endl;
    queryPluginInfo();
    std::cout << "[VST3Init] Plugin: " << name_ << " by " << vendor_ << std::endl;
    std::cout.flush();

    // Activate buses
    // Activate all audio input buses
    int32 numInputBuses = component_->getBusCount(kAudio, kInput);
    std::cout << "[VST3Init] Activating " << numInputBuses << " input bus(es)..." << std::endl;
    std::cout.flush();
    for (int32 i = 0; i < numInputBuses; i++) {
        component_->activateBus(kAudio, kInput, i, true);
    }

    // Activate all audio output buses
    int32 numOutputBuses = component_->getBusCount(kAudio, kOutput);
    std::cout << "[VST3Init] Activating " << numOutputBuses << " output bus(es)..." << std::endl;
    std::cout.flush();
    for (int32 i = 0; i < numOutputBuses; i++) {
        component_->activateBus(kAudio, kOutput, i, true);
    }

    // Activate event (MIDI) input bus if present
    int32 numEventInputBuses = component_->getBusCount(kEvent, kInput);
    std::cout << "[VST3Init] Activating " << numEventInputBuses << " event input bus(es)..." << std::endl;
    std::cout.flush();
    for (int32 i = 0; i < numEventInputBuses; i++) {
        component_->activateBus(kEvent, kInput, i, true);
    }

    std::cout << "[VST3Init] Initialization complete" << std::endl;
    std::cout.flush();

    initialized_ = true;
    return true;
}

bool PluginInstance::activate() {
    if (!initialized_ || active_) return active_;

    std::cout << "[VST3Init] setActive(true)..." << std::endl;
    std::cout.flush();
    auto result = component_->setActive(true);
    std::cout << "[VST3Init] setActive returned " << result << std::endl;
    std::cout.flush();
    if (result != kResultOk && result != kNotImplemented) return false;

    std::cout << "[VST3Init] setProcessing(true)..." << std::endl;
    std::cout.flush();
    result = processor_->setProcessing(true);
    std::cout << "[VST3Init] setProcessing returned " << result << std::endl;
    std::cout.flush();
    if (result != kResultOk && result != kNotImplemented) {
        component_->setActive(false);
        return false;
    }

    active_ = true;
    std::cout << "[VST3Init] Plugin activated successfully" << std::endl;
    std::cout.flush();

#ifdef _WIN32
    // Pump Win32 messages to process any immediate callbacks the plugin queued.
    // This catches ACCESS_VIOLATION crashes from plugin callbacks (e.g., Omnisphere's
    // STEAM engine) before they reach Electron's unprotected message loop.
    std::cout << "[VST3Init] Pumping pending messages..." << std::endl;
    std::cout.flush();
    if (!SEH_PumpPendingMessages(30)) {
        std::cout << "[VST3Init] WARNING: Plugin caused crash during message pump — deactivating" << std::endl;
        std::cout.flush();
        processor_->setProcessing(false);
        component_->setActive(false);
        active_ = false;
        return false;
    }
    std::cout << "[VST3Init] Message pump OK" << std::endl;
    std::cout.flush();
#endif

    return true;
}

bool PluginInstance::deactivate() {
    if (!active_) return true;

    processor_->setProcessing(false);
    component_->setActive(false);
    active_ = false;
    return true;
}

void PluginInstance::terminate() {
    if (!initialized_) return;

    // Disconnect IConnectionPoint before termination (prevents crash on separate architectures)
    if (controller_) {
        FUnknownPtr<IConnectionPoint> compCP(component_.get());
        FUnknownPtr<IConnectionPoint> ctrlCP(controller_.get());
        if (compCP && ctrlCP) {
            compCP->disconnect(ctrlCP);
            ctrlCP->disconnect(compCP);
        }
    }

    if (controller_ && controller_.get() != static_cast<FUnknown*>(component_.get())) {
        controller_->terminate();
    }
    component_->terminate();
    initialized_ = false;
}

void PluginInstance::queryBusInfo() {
    // Count audio input channels
    numInputChannels_ = 0;
    int32 numInputBuses = component_->getBusCount(kAudio, kInput);
    for (int32 i = 0; i < numInputBuses; i++) {
        BusInfo info;
        if (component_->getBusInfo(kAudio, kInput, i, info) == kResultOk) {
            numInputChannels_ += info.channelCount;
        }
    }

    // Count audio output channels and cache per-bus info
    numOutputChannels_ = 0;
    numOutputBuses_ = component_->getBusCount(kAudio, kOutput);
    outputBusChannelCounts_.clear();
    outputBusChannelCounts_.reserve(numOutputBuses_);
    for (int32 i = 0; i < numOutputBuses_; i++) {
        BusInfo info;
        if (component_->getBusInfo(kAudio, kOutput, i, info) == kResultOk) {
            numOutputChannels_ += info.channelCount;
            outputBusChannelCounts_.push_back(info.channelCount);
        } else {
            outputBusChannelCounts_.push_back(2); // Default stereo
        }
    }

    // Check for MIDI/event input
    hasMidiInput_ = component_->getBusCount(kEvent, kInput) > 0;

    // Instrument = has MIDI input and audio output but no audio input
    isInstrument_ = hasMidiInput_ && numOutputChannels_ > 0 && numInputChannels_ == 0;
}

void PluginInstance::queryPluginInfo() {
    // Name and vendor are set by VST3Host::loadPlugin() from factory class info.
    // Only set defaults if they weren't already set.
    if (name_.empty()) name_ = "VST3 Plugin";
    if (vendor_.empty()) vendor_ = "Unknown";
}

// --- Audio Processing ---

void PluginInstance::processBlock(float** inputBuffers, float** outputBuffers,
                                   int32_t numSamples, int32_t numInputChannels,
                                   int32_t numOutputChannels,
                                   const ProcessContext* context) {
    if (!active_ || !processor_) return;

    // Build ProcessData
    ProcessData data;
    data.processMode = kRealtime;
    data.symbolicSampleSize = kSample32;
    data.numSamples = numSamples;

    // Process context (tempo, position, etc.)
    ProcessContext localContext = {};
    if (context) {
        localContext = *context;
    }
    data.processContext = &localContext;

    // Input audio buses
    AudioBusBuffers inputBus;
    inputBus.numChannels = numInputChannels;
    inputBus.channelBuffers32 = inputBuffers;
    inputBus.silenceFlags = 0;

    // Output audio buses — create one AudioBusBuffers per output bus
    // so multi-output plugins (e.g. Omnisphere with 9 buses) get valid buffer pointers
    int32_t actualOutputBuses = (int32_t)outputBusChannelCounts_.size();
    if (actualOutputBuses < 1) actualOutputBuses = 1;

    std::vector<AudioBusBuffers> outputBuses(actualOutputBuses);
    int chOffset = 0;
    for (int32_t i = 0; i < actualOutputBuses; i++) {
        int32_t busChCount = (i < (int32_t)outputBusChannelCounts_.size())
                             ? outputBusChannelCounts_[i] : 2;
        outputBuses[i].numChannels = busChCount;
        // Point to the correct slice of the caller's outputBuffers array
        outputBuses[i].channelBuffers32 = (chOffset < numOutputChannels)
                                          ? &outputBuffers[chOffset] : nullptr;
        outputBuses[i].silenceFlags = 0;
        chOffset += busChCount;
    }

    if (numInputChannels > 0) {
        data.numInputs = 1;
        data.inputs = &inputBus;
    } else {
        data.numInputs = 0;
        data.inputs = nullptr;
    }
    data.numOutputs = actualOutputBuses;
    data.outputs = outputBuses.data();

    // Parameter changes
    auto* paramChanges = new SimpleParameterChanges();
    ParamChange pc;
    while (paramQueue_.pop(pc)) {
        paramChanges->addChange(pc.paramId, pc.value);
    }
    data.inputParameterChanges = paramChanges;
    data.outputParameterChanges = nullptr;

    // MIDI events
    auto* eventList = new SimpleEventList();
    MidiEvent me;
    while (midiQueue_.pop(me)) {
        switch (me.type) {
            case MidiEvent::NoteOn:
                eventList->addNoteOn(me.channel, me.data1, me.data2, me.sampleOffset);
                break;
            case MidiEvent::NoteOff:
                eventList->addNoteOff(me.channel, me.data1, me.data2, me.sampleOffset);
                break;
            case MidiEvent::CC:
                // CCs are typically handled as parameter changes in VST3
                break;
        }
    }
    data.inputEvents = eventList;
    data.outputEvents = nullptr;

    // Zero output buffers before processing
    for (int32_t ch = 0; ch < numOutputChannels; ch++) {
        if (outputBuffers[ch]) {
            wavloom::zeroBuffer(outputBuffers[ch], numSamples);
        }
    }

    // Process!
    processor_->process(data);

    // Cleanup
    paramChanges->release();
    eventList->release();
}

// --- MIDI ---

void PluginInstance::sendNoteOn(int32_t channel, int32_t note, float velocity) {
    MidiEvent e;
    e.type = MidiEvent::NoteOn;
    e.channel = static_cast<uint8_t>(channel);
    e.data1 = static_cast<uint8_t>(note);
    e.data2 = velocity;
    e.sampleOffset = 0;
    midiQueue_.push(e);
}

void PluginInstance::sendNoteOff(int32_t channel, int32_t note, float velocity) {
    MidiEvent e;
    e.type = MidiEvent::NoteOff;
    e.channel = static_cast<uint8_t>(channel);
    e.data1 = static_cast<uint8_t>(note);
    e.data2 = velocity;
    e.sampleOffset = 0;
    midiQueue_.push(e);
}

void PluginInstance::sendCC(int32_t channel, int32_t cc, float value) {
    MidiEvent e;
    e.type = MidiEvent::CC;
    e.channel = static_cast<uint8_t>(channel);
    e.data1 = static_cast<uint8_t>(cc);
    e.data2 = value;
    e.sampleOffset = 0;
    midiQueue_.push(e);
}

// --- Parameters ---

int32_t PluginInstance::getParameterCount() const {
    if (!controller_) return 0;
    return controller_->getParameterCount();
}

PluginInstance::ParamInfo PluginInstance::getParameterInfo(int32_t index) const {
    ParamInfo info = {};
    if (!controller_) return info;

    ParameterInfo vst3Info;
    if (controller_->getParameterInfo(index, vst3Info) == kResultOk) {
        info.id = vst3Info.id;

        // Convert UTF-16 strings to ASCII (simple truncation)
        char nameBuf[128] = {};
        char unitsBuf[128] = {};
        for (int i = 0; i < 128 && vst3Info.title[i]; i++) {
            nameBuf[i] = static_cast<char>(vst3Info.title[i]);
        }
        for (int i = 0; i < 128 && vst3Info.units[i]; i++) {
            unitsBuf[i] = static_cast<char>(vst3Info.units[i]);
        }
        info.name = nameBuf;
        info.units = unitsBuf;
        info.defaultValue = vst3Info.defaultNormalizedValue;
        info.minValue = 0.0;
        info.maxValue = 1.0;
        info.stepCount = vst3Info.stepCount;
        info.canAutomate = (vst3Info.flags & ParameterInfo::kCanAutomate) != 0;
    }
    return info;
}

double PluginInstance::getParameterValue(uint32_t paramId) const {
    if (!controller_) return 0.0;
    return controller_->getParamNormalized(paramId);
}

void PluginInstance::setParameterValue(uint32_t paramId, double value) {
    // Queue for audio-thread-safe application during next processBlock
    paramQueue_.push(paramId, value);
    // Also update the controller immediately for UI feedback
    if (controller_) {
        controller_->setParamNormalized(paramId, value);
    }
}

// --- State (presets) ---

std::vector<uint8_t> PluginInstance::getState() const {
    std::vector<uint8_t> result;
    if (!component_) return result;

    auto* stream = new MemoryStream();
    if (component_->getState(stream) == kResultOk) {
        result = stream->getData();
    }
    stream->release();
    return result;
}

bool PluginInstance::setState(const std::vector<uint8_t>& data) {
    if (!component_ || data.empty()) return false;

    auto* stream = new MemoryStream(data.data(), data.size());
    bool ok = (component_->setState(stream) == kResultOk);
    stream->release();

    // Also update the controller state
    if (ok && controller_) {
        auto* stream2 = new MemoryStream(data.data(), data.size());
        controller_->setComponentState(stream2);
        stream2->release();
    }

    return ok;
}

// --- Editor (Plugin GUI Window) ---

#ifdef _WIN32

// IPlugFrame implementation — handles plugin resize requests
class WavLoomPlugFrame : public Steinberg::IPlugFrame {
public:
    WavLoomPlugFrame(PluginInstance* instance, HWND hwnd)
        : refCount_(1), instance_(instance), hwnd_(hwnd) {}

    tresult PLUGIN_API resizeView(Steinberg::IPlugView* view, Steinberg::ViewRect* newSize) override {
        if (!view || !newSize || !hwnd_) return Steinberg::kInvalidArgument;

        int32_t viewW = newSize->getWidth();
        int32_t viewH = newSize->getHeight();
        if (viewW <= 0 || viewH <= 0) return Steinberg::kInvalidArgument;

        // Resize the host window to fit the new view size
        instance_->resizeWindowToView(viewW, viewH);

        // Confirm the resize to the plugin
        view->onSize(newSize);

        return Steinberg::kResultOk;
    }

    // FUnknown
    tresult PLUGIN_API queryInterface(const Steinberg::TUID _iid, void** obj) override {
        if (Steinberg::FUnknownPrivate::iidEqual(_iid, Steinberg::IPlugFrame::iid) ||
            Steinberg::FUnknownPrivate::iidEqual(_iid, Steinberg::FUnknown::iid)) {
            addRef();
            *obj = static_cast<Steinberg::IPlugFrame*>(this);
            return Steinberg::kResultOk;
        }
        *obj = nullptr;
        return Steinberg::kNoInterface;
    }
    Steinberg::uint32 PLUGIN_API addRef() override { return ++refCount_; }
    Steinberg::uint32 PLUGIN_API release() override {
        auto r = --refCount_;
        if (r == 0) delete this;
        return r;
    }

    void setHWND(HWND hwnd) { hwnd_ = hwnd; }

private:
    std::atomic<Steinberg::uint32> refCount_;
    PluginInstance* instance_;
    HWND hwnd_;
};

void PluginInstance::resizeWindowToView(int32_t viewWidth, int32_t viewHeight) {
    if (!editorWindow_) return;

    DWORD style = static_cast<DWORD>(GetWindowLongPtr(editorWindow_, GWL_STYLE));
    RECT adjustedRect = { 0, 0, static_cast<LONG>(viewWidth), static_cast<LONG>(viewHeight) };
    AdjustWindowRect(&adjustedRect, style, FALSE);
    int windowWidth = adjustedRect.right - adjustedRect.left;
    int windowHeight = adjustedRect.bottom - adjustedRect.top;

    SetWindowPos(editorWindow_, nullptr, 0, 0, windowWidth, windowHeight,
                 SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
}

LRESULT CALLBACK PluginInstance::EditorWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    auto* self = reinterpret_cast<PluginInstance*>(GetWindowLongPtr(hwnd, GWLP_USERDATA));

    switch (msg) {
        case WM_KEYDOWN:
            // Intercept spacebar and forward to host for playback toggle.
            // Bit 30 of lParam = previous key state (1 = was already down / auto-repeat).
            if (wParam == VK_SPACE && !(lParam & 0x40000000)) {
                if (g_editorKeyCallback) {
                    g_editorKeyCallback(static_cast<int>(VK_SPACE));
                }
                return 0; // consumed — don't pass to plugin
            }
            break;

        case WM_CLOSE:
            if (self) {
                // Detach the plug view before destroying the window
                if (self->plugView_) {
                    self->plugView_->setFrame(nullptr);
                    self->plugView_->removed();
                    self->plugView_ = nullptr;
                }
                self->plugFrame_ = nullptr;
                self->editorWindow_ = nullptr;
                self->editorOpen_ = false;
            }
            DestroyWindow(hwnd);
            return 0;

        case WM_DESTROY:
            return 0;

        default:
            break;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

std::string PluginInstance::openEditor() {
    // If already open, bring window to front
    if (editorOpen_ && editorWindow_) {
        SetForegroundWindow(editorWindow_);
        ShowWindow(editorWindow_, SW_RESTORE);
        return ""; // success
    }

    if (!controller_) {
        return "No edit controller — plugin may not support GUI";
    }

    // Create the plug view
    plugView_ = controller_->createView(Steinberg::Vst::ViewType::kEditor);
    if (!plugView_) {
        return "createView returned null — controller exists but has no editor view";
    }

    // Check platform support
    if (plugView_->isPlatformTypeSupported(Steinberg::kPlatformTypeHWND) != Steinberg::kResultOk) {
        plugView_ = nullptr;
        return "Plugin editor does not support Windows HWND";
    }

    // Get preferred view size
    Steinberg::ViewRect viewRect = {};
    plugView_->getSize(&viewRect);
    int32_t viewWidth = viewRect.getWidth();
    int32_t viewHeight = viewRect.getHeight();
    std::cout << "[VST3Editor] Initial view size from plugin: " << viewWidth << "x" << viewHeight << std::endl;
    if (viewWidth <= 0) viewWidth = 800;
    if (viewHeight <= 0) viewHeight = 600;

    // Get system DPI scale factor
    float dpiScale = 1.0f;
    {
        HDC hdc = GetDC(nullptr);
        if (hdc) {
            int dpiX = GetDeviceCaps(hdc, LOGPIXELSX);
            dpiScale = static_cast<float>(dpiX) / 96.0f;
            ReleaseDC(nullptr, hdc);
        }
    }
    std::cout << "[VST3Editor] System DPI scale: " << dpiScale << std::endl;

    // Notify plugin about DPI scale if it supports content scaling
    bool pluginHandlesDpi = false;
    {
        Steinberg::IPtr<Steinberg::IPlugViewContentScaleSupport> scaleSupport;
        plugView_->queryInterface(Steinberg::IPlugViewContentScaleSupport::iid,
                                  reinterpret_cast<void**>(&scaleSupport));
        if (scaleSupport) {
            auto scaleResult = scaleSupport->setContentScaleFactor(dpiScale);
            pluginHandlesDpi = (scaleResult == Steinberg::kResultOk);
            std::cout << "[VST3Editor] setContentScaleFactor(" << dpiScale << ") returned "
                      << scaleResult << (pluginHandlesDpi ? " (plugin handles DPI)" : " (plugin ignores DPI)") << std::endl;

            // Re-read size after setting scale — plugin may have updated its preferred size
            if (pluginHandlesDpi) {
                Steinberg::ViewRect scaledRect = {};
                plugView_->getSize(&scaledRect);
                int32_t sw = scaledRect.getWidth();
                int32_t sh = scaledRect.getHeight();
                if (sw > 0 && sh > 0) {
                    viewWidth = sw;
                    viewHeight = sh;
                    std::cout << "[VST3Editor] Scaled view size: " << viewWidth << "x" << viewHeight << std::endl;
                }
            }
        } else {
            std::cout << "[VST3Editor] Plugin does not support IPlugViewContentScaleSupport" << std::endl;
        }
    }

    // If plugin doesn't handle DPI, we scale the window client area ourselves
    if (!pluginHandlesDpi && dpiScale > 1.01f) {
        viewWidth = static_cast<int32_t>(viewWidth * dpiScale);
        viewHeight = static_cast<int32_t>(viewHeight * dpiScale);
        std::cout << "[VST3Editor] Host-scaled view size: " << viewWidth << "x" << viewHeight << std::endl;
    }

    // Register window class once
    if (!windowClassRegistered_) {
        WNDCLASSEXW wc = {};
        wc.cbSize = sizeof(WNDCLASSEXW);
        wc.lpfnWndProc = PluginInstance::EditorWndProc;
        wc.hInstance = GetModuleHandle(nullptr);
        wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
        wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
        wc.lpszClassName = L"WavLoomVST3Editor";
        if (RegisterClassExW(&wc)) {
            windowClassRegistered_ = true;
        }
    }

    // Calculate window size including frame/title bar
    RECT adjustedRect = { 0, 0, static_cast<LONG>(viewWidth), static_cast<LONG>(viewHeight) };
    DWORD style = WS_OVERLAPPEDWINDOW & ~(WS_THICKFRAME | WS_MAXIMIZEBOX);
    AdjustWindowRect(&adjustedRect, style, FALSE);
    int windowWidth = adjustedRect.right - adjustedRect.left;
    int windowHeight = adjustedRect.bottom - adjustedRect.top;

    // Convert plugin name to wide string for window title
    std::wstring title(name_.begin(), name_.end());
    title += L" - WavLoom";

    // Create the editor window (centered on screen)
    int screenW = GetSystemMetrics(SM_CXSCREEN);
    int screenH = GetSystemMetrics(SM_CYSCREEN);
    int posX = (screenW - windowWidth) / 2;
    int posY = (screenH - windowHeight) / 2;

    editorWindow_ = CreateWindowExW(
        WS_EX_TOPMOST,
        L"WavLoomVST3Editor",
        title.c_str(),
        style,
        posX, posY, windowWidth, windowHeight,
        nullptr, // No parent — standalone window
        nullptr,
        GetModuleHandle(nullptr),
        nullptr
    );

    if (!editorWindow_) {
        DWORD err = GetLastError();
        plugView_ = nullptr;
        return "CreateWindow failed (Win32 error " + std::to_string(err) + ")";
    }

    // Store 'this' pointer in the window for WndProc access
    SetWindowLongPtr(editorWindow_, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(this));

    // Create and set IPlugFrame so the plugin can request resize
    auto* frame = new WavLoomPlugFrame(this, editorWindow_);
    plugFrame_ = frame; // IPtr takes ownership
    frame->release();   // IPtr did addRef, balance our initial refCount of 1
    plugView_->setFrame(plugFrame_);

    // Attach the plug view to the native window
    auto result = plugView_->attached(editorWindow_, Steinberg::kPlatformTypeHWND);
    if (result != Steinberg::kResultOk) {
        plugView_->setFrame(nullptr);
        plugFrame_ = nullptr;
        plugView_ = nullptr;
        DestroyWindow(editorWindow_);
        editorWindow_ = nullptr;
        return "plugView->attached() failed (code " + std::to_string(result) + ")";
    }

    // After attach, re-check the view size (plugin may have resized during attach)
    Steinberg::ViewRect postAttachRect = {};
    if (plugView_->getSize(&postAttachRect) == Steinberg::kResultOk) {
        int32_t newW = postAttachRect.getWidth();
        int32_t newH = postAttachRect.getHeight();
        if (newW > 0 && newH > 0 && (newW != viewWidth || newH != viewHeight)) {
            resizeWindowToView(newW, newH);
        }
    }

    // Show the window
    ShowWindow(editorWindow_, SW_SHOW);
    UpdateWindow(editorWindow_);

    editorOpen_ = true;
    return ""; // success
}

void PluginInstance::closeEditor() {
    if (plugView_) {
        plugView_->setFrame(nullptr);
        plugView_->removed();
        plugView_ = nullptr;
    }
    plugFrame_ = nullptr;
    if (editorWindow_) {
        DestroyWindow(editorWindow_);
        editorWindow_ = nullptr;
    }
    editorOpen_ = false;
}

#else
// macOS / Linux stubs — editor not yet supported on these platforms
std::string PluginInstance::openEditor() {
    return "Editor not supported on this platform";
}

void PluginInstance::closeEditor() {
    editorOpen_ = false;
}
#endif // _WIN32

#endif // VST3_SDK_AVAILABLE
