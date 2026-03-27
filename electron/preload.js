const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,

    // Debug log forwarding — renderer logs appear in the terminal
    debug: {
        log: (...args) => ipcRenderer.send('debug:log', ...args),
    },

    // Splash screen
    splash: {
        done: () => ipcRenderer.send('splash:done'),
    },

    // Window controls
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
        onMaximizeChange: (callback) => {
            ipcRenderer.on('window:maximizeChanged', (_event, isMaximized) => callback(isMaximized));
        },
    },

    // File system dialogs
    fs: {
        showOpenDialog: (options) => ipcRenderer.invoke('fs:showOpenDialog', options),
        showSaveDialog: (options) => ipcRenderer.invoke('fs:showSaveDialog', options),
        readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
        writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
        readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
        stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
        exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
        mkdir: (dirPath, options) => ipcRenderer.invoke('fs:mkdir', dirPath, options),
    },

    // Scanned folders persistence
    folders: {
        save: (folderPaths) => ipcRenderer.invoke('folders:save', folderPaths),
        load: () => ipcRenderer.invoke('folders:load'),
        scan: (dirPath) => ipcRenderer.invoke('folders:scan', dirPath),
        watch: (dirPath) => ipcRenderer.invoke('folders:watch', dirPath),
        unwatch: (dirPath) => ipcRenderer.invoke('folders:unwatch', dirPath),
        onChanged: (callback) => {
            ipcRenderer.on('folders:changed', (_event, data) => callback(data));
        },
        removeChangedListener: () => {
            ipcRenderer.removeAllListeners('folders:changed');
        },
    },

    // Shell operations
    shell: {
        openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
        showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
    },

    // Deep-link collab invites (wavloom://join?room=xxx)
    deeplink: {
        onRoom: (callback) => {
            ipcRenderer.on('deeplink:room', (_event, room) => callback(room));
        },
        removeRoomListener: () => {
            ipcRenderer.removeAllListeners('deeplink:room');
        },
    },

    // App info
    app: {
        getPath: (name) => ipcRenderer.invoke('app:getPath', name),
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
    },

    // System metrics (CPU + memory from os module)
    system: {
        getMetrics: () => ipcRenderer.invoke('system:getMetrics'),
    },

    // VST3 plugin scanner
    vst3: {
        scan: (forceRescan) => ipcRenderer.invoke('vst3:scan', forceRescan),
        getCache: () => ipcRenderer.invoke('vst3:getCache'),
        clearCache: () => ipcRenderer.invoke('vst3:clearCache'),
        getPluginInfo: (pluginPath) => ipcRenderer.invoke('vst3:getPluginInfo', pluginPath),
        getCustomPaths: () => ipcRenderer.invoke('vst3:getCustomPaths'),
        setCustomPaths: (paths) => ipcRenderer.invoke('vst3:setCustomPaths', paths),
        browseForFolder: () => ipcRenderer.invoke('vst3:browseForFolder'),
        onScanProgress: (callback) => {
            ipcRenderer.on('vst3:scanProgress', (_event, data) => callback(data));
        },
        removeScanProgressListener: () => {
            ipcRenderer.removeAllListeners('vst3:scanProgress');
        },
    },

    // VST3 plugin hosting (native C++ addon)
    vst3Host: {
        isAvailable: () => ipcRenderer.invoke('vst3host:isAvailable'),
        loadPlugin: (path, uid) => ipcRenderer.invoke('vst3host:loadPlugin', path, uid),
        unloadPlugin: (instanceId) => ipcRenderer.invoke('vst3host:unloadPlugin', instanceId),
        processBlock: (instanceId, inputBuffer, numFrames, numInCh, numOutCh) =>
            ipcRenderer.invoke('vst3host:processBlock', instanceId, inputBuffer, numFrames, numInCh, numOutCh),
        noteOn: (instanceId, ch, note, vel) => ipcRenderer.invoke('vst3host:noteOn', instanceId, ch, note, vel),
        noteOff: (instanceId, ch, note, vel) => ipcRenderer.invoke('vst3host:noteOff', instanceId, ch, note, vel),
        sendCC: (instanceId, ch, cc, val) => ipcRenderer.invoke('vst3host:sendCC', instanceId, ch, cc, val),
        setParameter: (instanceId, paramId, value) => ipcRenderer.invoke('vst3host:setParameter', instanceId, paramId, value),
        getParameter: (instanceId, paramId) => ipcRenderer.invoke('vst3host:getParameter', instanceId, paramId),
        getParameterList: (instanceId) => ipcRenderer.invoke('vst3host:getParameterList', instanceId),
        getPluginState: (instanceId) => ipcRenderer.invoke('vst3host:getPluginState', instanceId),
        setPluginState: (instanceId, stateData) => ipcRenderer.invoke('vst3host:setPluginState', instanceId, stateData),
        setSampleRate: (rate) => ipcRenderer.invoke('vst3host:setSampleRate', rate),
        setBlockSize: (size) => ipcRenderer.invoke('vst3host:setBlockSize', size),
        unloadAll: () => ipcRenderer.invoke('vst3host:unloadAll'),
        // Transport state (direct set, bypasses transport clock interval delay)
        setTransportState: (state) => ipcRenderer.invoke('vst3host:setTransportState', state),
        // Editor (plugin GUI window)
        openEditor: (instanceId) => ipcRenderer.invoke('vst3host:openEditor', instanceId),
        closeEditor: (instanceId) => ipcRenderer.invoke('vst3host:closeEditor', instanceId),
        isEditorOpen: (instanceId) => ipcRenderer.invoke('vst3host:isEditorOpen', instanceId),
        // Spacebar passthrough from VST3 editor windows
        onTogglePlayback: (callback) => {
            ipcRenderer.on('vst3:togglePlayback', () => callback());
        },
        removeTogglePlaybackListener: () => {
            ipcRenderer.removeAllListeners('vst3:togglePlayback');
        },
    },

    // Audio capture (native WASAPI addon)
    audioCapture: {
        isAvailable: () => ipcRenderer.invoke('audio-capture:isAvailable'),
        listDevices: () => ipcRenderer.invoke('audio-capture:list-devices'),
        start: (deviceId, sampleRate, channels) => ipcRenderer.invoke('audio-capture:start', deviceId, sampleRate, channels),
        stop: () => ipcRenderer.invoke('audio-capture:stop'),
        getLevel: () => ipcRenderer.invoke('audio-capture:level'),
        isCapturing: () => ipcRenderer.invoke('audio-capture:isCapturing'),
        // Ring buffer: the preload creates the SharedArrayBuffers in its own
        // JS world (avoiding contextBridge clone failures), sends TypedArray
        // views to main via IPC, and returns the raw SABs to the renderer so
        // it can share them with the AudioWorklet.
        createRingBuffer: async (capacity, channels, sampleRate) => {
            const stateBuffer = new SharedArrayBuffer(32);
            const dataBuffer = new SharedArrayBuffer(capacity * 4);
            const stateView = new Int32Array(stateBuffer);
            const dataView = new Float32Array(dataBuffer);
            const result = await ipcRenderer.invoke(
                'audio-capture:attach-ring-buffer',
                stateView, dataView, capacity, channels, sampleRate
            );
            if (result && result.error) {
                return { stateBuffer: null, dataBuffer: null, error: result.error };
            }
            return { stateBuffer, dataBuffer, error: null };
        },
        detachRingBuffer: () => ipcRenderer.invoke('audio-capture:detach-ring-buffer'),
    },

    // Transport clock (native high-res playback sync)
    transport: {
        play: () => ipcRenderer.send('transport:play'),
        stop: () => ipcRenderer.send('transport:stop'),
        pause: () => ipcRenderer.send('transport:pause'),
        seek: (positionBeats) => ipcRenderer.send('transport:seek', { positionBeats }),
        setTempo: (bpm) => ipcRenderer.send('transport:setTempo', { bpm }),
        setBars: (bars) => ipcRenderer.send('transport:setBars', { bars }),
        setLoop: (enabled, startBeats, endBeats) => ipcRenderer.send('transport:setLoop', { enabled, startBeats, endBeats }),
        getState: () => ipcRenderer.invoke('transport:getState'),
        onPosition: (callback) => {
            ipcRenderer.on('transport:position', (_event, data) => callback(data));
        },
        removePositionListener: () => {
            ipcRenderer.removeAllListeners('transport:position');
        },
    },
});
