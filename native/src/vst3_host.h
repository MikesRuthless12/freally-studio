#pragma once
/**
 * VST3Host — Singleton managing all VST3 plugin instances.
 *
 * Provides plugin loading/unloading, global sample rate/block size,
 * and shared transport state (tempo, position, time sig).
 */

#ifdef VST3_SDK_AVAILABLE

#include "plugin_instance.h"
#include <unordered_map>
#include <memory>
#include <mutex>
#include <atomic>
#include <string>
#include <cstdint>

class VST3Host {
public:
    static VST3Host& instance();

    // Plugin lifecycle
    std::string loadPlugin(const std::string& path, const std::string& uid = "");
    bool unloadPlugin(const std::string& instanceId);
    PluginInstance* getPlugin(const std::string& instanceId);
    std::vector<std::string> getLoadedPluginIds() const;

    // Global audio settings
    void setSampleRate(double rate);
    void setBlockSize(int32_t size);
    double getSampleRate() const { return sampleRate_; }
    int32_t getBlockSize() const { return blockSize_; }

    // Transport state (shared across all plugin instances)
    void setTransportState(double tempo, double positionBeats,
                           int32_t timeSigNum, int32_t timeSigDen,
                           bool playing, bool recording, bool looping,
                           double loopStartBeats = 0.0, double loopEndBeats = 0.0);

    struct TransportState {
        std::atomic<double> tempo{120.0};
        std::atomic<double> positionBeats{0.0};
        std::atomic<int32_t> timeSigNumerator{4};
        std::atomic<int32_t> timeSigDenominator{4};
        std::atomic<bool> playing{false};
        std::atomic<bool> recording{false};
        std::atomic<bool> looping{false};
        std::atomic<double> loopStartBeats{0.0};
        std::atomic<double> loopEndBeats{0.0};
    };

    const TransportState& getTransport() const { return transport_; }
    TransportState& getTransport() { return transport_; }

    // Cleanup
    void unloadAll();

private:
    VST3Host();
    ~VST3Host();

    // No copy/move
    VST3Host(const VST3Host&) = delete;
    VST3Host& operator=(const VST3Host&) = delete;

    std::unordered_map<std::string, std::unique_ptr<PluginInstance>> instances_;
    mutable std::mutex instanceMutex_;

    double sampleRate_ = 44100.0;
    int32_t blockSize_ = 1024;

    TransportState transport_;

    uint64_t nextInstanceId_ = 1;
    std::string generateInstanceId();
};

#endif // VST3_SDK_AVAILABLE
