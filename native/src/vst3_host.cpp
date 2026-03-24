/**
 * VST3Host implementation.
 */

#ifdef VST3_SDK_AVAILABLE

#include "vst3_host.h"
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include <sstream>
#include <iostream>

using namespace Steinberg;
using namespace Steinberg::Vst;

// --- Singleton ---

VST3Host& VST3Host::instance() {
    static VST3Host host;
    return host;
}

VST3Host::VST3Host() = default;
VST3Host::~VST3Host() {
    unloadAll();
}

// --- Plugin lifecycle ---

std::string VST3Host::generateInstanceId() {
    std::ostringstream oss;
    oss << "vst3_" << nextInstanceId_++;
    return oss.str();
}

std::string VST3Host::loadPlugin(const std::string& path, const std::string& uid) {
    std::string errorMsg;

    // Load the VST3 module (platform-specific .vst3 bundle loading)
    auto module = VST3::Hosting::Module::create(path, errorMsg);
    if (!module) {
        throw std::runtime_error("Failed to load VST3 module: " + errorMsg);
    }

    // Get the plugin factory
    auto factory = module->getFactory();
    if (!factory.get()) {
        throw std::runtime_error("No factory found in VST3 module");
    }

    // Find the audio processor class
    // If uid is provided, search for that specific class; otherwise take the first audio class
    // Fallback: if uid doesn't match any class UID, use the first audio class found
    VST3::Hosting::ClassInfo targetClass;
    VST3::Hosting::ClassInfo firstAudioClass;
    bool found = false;
    bool hasAnyAudioClass = false;

    for (auto& classInfo : factory.classInfos()) {
        if (classInfo.category() == kVstAudioEffectClass) {
            if (!hasAnyAudioClass) {
                firstAudioClass = classInfo;
                hasAnyAudioClass = true;
            }
            if (uid.empty()) {
                targetClass = classInfo;
                found = true;
                break;
            }
            // Compare UID string
            auto classUid = classInfo.ID().toString();
            if (classUid == uid) {
                targetClass = classInfo;
                found = true;
                break;
            }
        }
    }

    // Fallback to first audio class if uid didn't match (scanner may pass path as uid)
    if (!found && hasAnyAudioClass) {
        targetClass = firstAudioClass;
        found = true;
        std::cout << "[VST3Host] UID '" << uid << "' not found, using first audio class" << std::endl;
    }

    if (!found) {
        throw std::runtime_error("No audio processor class found in VST3 module");
    }

    // Create the component
    IPtr<IComponent> component;
    auto result = factory.get()->createInstance(targetClass.ID().data(),
                                                 IComponent::iid,
                                                 reinterpret_cast<void**>(&component));
    if (result != kResultOk || !component) {
        throw std::runtime_error("Failed to create IComponent");
    }

    // Query for IAudioProcessor
    IPtr<IAudioProcessor> processor;
    result = component->queryInterface(IAudioProcessor::iid, reinterpret_cast<void**>(&processor));
    if (result != kResultOk || !processor) {
        throw std::runtime_error("Component does not implement IAudioProcessor");
    }

    // Query for IEditController (may be separate or combined)
    IPtr<IEditController> controller;
    result = component->queryInterface(IEditController::iid, reinterpret_cast<void**>(&controller));
    if (result == kResultOk && controller) {
        std::cout << "[VST3Host] Controller obtained via queryInterface (combined)" << std::endl;
    } else {
        std::cout << "[VST3Host] queryInterface for IEditController failed, trying separate controller..." << std::endl;
        // Try to get separate edit controller
        TUID controllerCID;
        if (component->getControllerClassId(controllerCID) == kResultOk) {
            result = factory.get()->createInstance(controllerCID,
                                                    IEditController::iid,
                                                    reinterpret_cast<void**>(&controller));
            if (result == kResultOk && controller) {
                std::cout << "[VST3Host] Separate controller created successfully" << std::endl;
            } else {
                std::cout << "[VST3Host] Failed to create separate controller" << std::endl;
            }
        } else {
            std::cout << "[VST3Host] No controller class ID found" << std::endl;
        }
    }
    if (!controller) {
        std::cout << "[VST3Host] WARNING: No edit controller available — editor will not work" << std::endl;
    }

    // Create PluginInstance wrapper
    auto instance = std::make_unique<PluginInstance>(
        module, component.get(), processor.get(), controller.get()
    );

    // Set the plugin name from the factory class info
    instance->setName(targetClass.name());
    instance->setVendor(targetClass.vendor());

    // Initialize with current host settings
    if (!instance->initialize(sampleRate_, blockSize_)) {
        throw std::runtime_error("Failed to initialize plugin");
    }

    // Activate
    if (!instance->activate()) {
        throw std::runtime_error("Failed to activate plugin");
    }

    // Store and return ID
    std::string instanceId = generateInstanceId();

    std::lock_guard<std::mutex> lock(instanceMutex_);
    instances_[instanceId] = std::move(instance);

    return instanceId;
}

bool VST3Host::unloadPlugin(const std::string& instanceId) {
    std::lock_guard<std::mutex> lock(instanceMutex_);
    auto it = instances_.find(instanceId);
    if (it == instances_.end()) return false;

    // Close editor FIRST — the plugin view must be detached before deactivation
    it->second->closeEditor();
    it->second->deactivate();
    it->second->terminate();
    instances_.erase(it);
    return true;
}

PluginInstance* VST3Host::getPlugin(const std::string& instanceId) {
    std::lock_guard<std::mutex> lock(instanceMutex_);
    auto it = instances_.find(instanceId);
    return (it != instances_.end()) ? it->second.get() : nullptr;
}

std::vector<std::string> VST3Host::getLoadedPluginIds() const {
    std::lock_guard<std::mutex> lock(instanceMutex_);
    std::vector<std::string> ids;
    ids.reserve(instances_.size());
    for (const auto& pair : instances_) {
        ids.push_back(pair.first);
    }
    return ids;
}

// --- Global settings ---

void VST3Host::setSampleRate(double rate) {
    sampleRate_ = rate;
    // Note: changing sample rate on live plugins requires deactivate→reinit→activate
    // which is handled by the caller if needed
}

void VST3Host::setBlockSize(int32_t size) {
    blockSize_ = size;
}

// --- Transport ---

void VST3Host::setTransportState(double tempo, double positionBeats,
                                  int32_t timeSigNum, int32_t timeSigDen,
                                  bool playing, bool recording, bool looping,
                                  double loopStartBeats, double loopEndBeats) {
    transport_.tempo.store(tempo, std::memory_order_relaxed);
    transport_.positionBeats.store(positionBeats, std::memory_order_relaxed);
    transport_.timeSigNumerator.store(timeSigNum, std::memory_order_relaxed);
    transport_.timeSigDenominator.store(timeSigDen, std::memory_order_relaxed);
    transport_.playing.store(playing, std::memory_order_relaxed);
    transport_.recording.store(recording, std::memory_order_relaxed);
    transport_.looping.store(looping, std::memory_order_relaxed);
    transport_.loopStartBeats.store(loopStartBeats, std::memory_order_relaxed);
    transport_.loopEndBeats.store(loopEndBeats, std::memory_order_relaxed);
}

// --- Cleanup ---

void VST3Host::unloadAll() {
    std::lock_guard<std::mutex> lock(instanceMutex_);
    for (auto& pair : instances_) {
        pair.second->closeEditor();
        pair.second->deactivate();
        pair.second->terminate();
    }
    instances_.clear();
}

#endif // VST3_SDK_AVAILABLE
