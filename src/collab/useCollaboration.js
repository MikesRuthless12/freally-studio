import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "../i18n/I18nContext";
import { PeerManager } from "./PeerManager";
import { MSG } from "./PeerProtocol";
import { getOrCreateRoom } from "./Room";
import { defaultOwners } from "./DelegationStore";
import { VoiceChatEngine } from "./VoiceChatEngine";

/** Encode an AudioBuffer to a WAV ArrayBuffer (16-bit PCM) for peer transfer */
function audioBufferToWavBuffer(audioBuffer) {
    const numCh = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numCh * 2;
    const buf = new ArrayBuffer(44 + length);
    const dv = new DataView(buf);
    const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    dv.setUint32(4, 36 + length, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true);
    dv.setUint16(22, numCh, true);
    dv.setUint32(24, audioBuffer.sampleRate, true);
    dv.setUint32(28, audioBuffer.sampleRate * numCh * 2, true);
    dv.setUint16(32, numCh * 2, true);
    dv.setUint16(34, 16, true);
    writeStr(36, 'data');
    dv.setUint32(40, length, true);
    const channels = [];
    for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c));
    let off = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let c = 0; c < numCh; c++) {
            const s = Math.max(-1, Math.min(1, channels[c][i]));
            dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            off += 2;
        }
    }
    return buf;
}

export function useCollaboration() {
    const { t } = useTranslation();
    const myIdRef = useRef(null);
    const peerRef = useRef(null);
    const [myId, setMyId] = useState(null);
    const [userProfile, setUserProfile] = useState({ name: '', email: '' });

    const [room] = useState(getOrCreateRoom());
    const [peers, setPeers] = useState({}); // { id: { profile: {...} } }
    const [tabOwners, setTabOwners] = useState(defaultOwners);
    const [freeForAll, setFreeForAll] = useState(false);
    // Per-peer permissions for all delegable tabs + global actions
    const DEFAULT_PERMISSIONS = {
        canEditDrums: true, canEditChords: true, canEditMelody: true, canEditBass: true,
        canEditLyrics: true, canEditLyricEngine: true, canEditBrowser: true,
        canEditMixer: true, canEditArrange: true, canEditDrumSynth: true, canEditInstSynth: true,
        canChangeTempo: true, canExport: true
    };
    const [peerPermissions, setPeerPermissions] = useState({});
    const peerPermissionsRef = useRef({});
    const [screens, setScreens] = useState([]);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [activeStream, setActiveStream] = useState(null);
    const [mousePositions, setMousePositions] = useState({}); // { id: { x, y, name, color } }
    const [isCollapsed, setIsCollapsed] = useState(true);

    // --- Connection Status ---
    const [peerLatencies, setPeerLatencies] = useState({});
    const [connectionStates, setConnectionStates] = useState({});
    const lastPongTime = useRef({});

    // --- Chat ---
    const [chatMessages, setChatMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const chatVisibleRef = useRef(false);

    // --- Follow Mode ---
    const [followingPeer, setFollowingPeer] = useState(null);
    const followingPeerRef = useRef(null);
    const onTabChangeRef = useRef(null);

    // --- Conflict Resolution ---
    const [accessRequests, setAccessRequests] = useState([]);
    const [tabActivity, setTabActivity] = useState({});
    const addToastRef = useRef(null);
    const idleTimers = useRef({});

    // --- Test Mode ---
    const [testModeActive, setTestModeActive] = useState(false);
    const testIntervalRef = useRef(null);

    // --- Save Notification ---
    const saveNotificationHandlerRef = useRef(null);

    // --- Voice Chat ---
    const [commMode, setCommModeState] = useState('both');       // 'both'|'chat'|'audio'|'none'
    const [peerTalkingState, setPeerTalkingState] = useState({}); // { peerId: bool }
    const [peerAudioLevels, setPeerAudioLevels] = useState({});   // { peerId: 0-1 }
    const [localTalking, setLocalTalking] = useState(false);
    const [voiceMasterVolume, setVoiceMasterVolumeState] = useState(0.7);
    const [peerMuteState, setPeerMuteState] = useState({});       // { peerId: { audio: bool, chat: bool } }
    const [voiceInitialized, setVoiceInitialized] = useState(false);
    const [selfMonitorEnabled, setSelfMonitorEnabledState] = useState(true);

    // --- Shared Library ---
    const [sharedLibraryEnabled, setSharedLibraryEnabled] = useState(false);
    const [sharedLibraryStatus, setSharedLibraryStatus] = useState('idle'); // 'idle'|'syncing'|'synced'
    const [peerLibraries, setPeerLibraries] = useState({}); // { peerId: { instruments: [...] } }
    const samplerRefCollab = useRef(null); // reference to the SamplerEngine for sample I/O
    const pendingSampleRequests = useRef({}); // { `${peerId}_${instrumentId}`: { notes: [...], received: 0 } }

    // --- Recording Monitor ---
    const [isRecordingActive, setIsRecordingActive] = useState(false);
    const recordingMonitorNodes = useRef(null); // { source, dest } for mic → peer stream
    const voicePreRecordState = useRef(null); // saved voice state before recording muted it
    const voiceEngineRef = useRef(null);
    const remoteAudioNodes = useRef({});    // { peerId: { source, compressor, gain, analyser } }
    const voiceStreamRef = useRef(null);    // outgoing voice MediaStream
    const duckingGainRef = useRef(null);    // reference to DAW master gain for ducking
    const duckingOriginalRef = useRef(1.0); // original DAW gain before ducking
    const voiceLevelRafRef = useRef(null);
    const commModeRef = useRef('both');
    const peerMuteStateRef = useRef({});
    const voiceMasterVolumeRef = useRef(0.7);
    const localTalkingRef = useRef(false);
    const peerTalkingStateRef = useRef({});

    const myScreenRef = useRef(null);
    const isHost = !window.location.search.includes('room=');

    // Sync followingPeer to ref (avoids stale closure in handleData)
    useEffect(() => { followingPeerRef.current = followingPeer; }, [followingPeer]);

    // Sync userProfile to ref (avoids stale closure in mousemove handler)
    const userProfileRef = useRef(userProfile);
    useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);

    // Sync voice refs
    useEffect(() => { commModeRef.current = commMode; }, [commMode]);
    useEffect(() => { peerMuteStateRef.current = peerMuteState; }, [peerMuteState]);
    useEffect(() => { voiceMasterVolumeRef.current = voiceMasterVolume; }, [voiceMasterVolume]);
    useEffect(() => { localTalkingRef.current = localTalking; }, [localTalking]);
    useEffect(() => { peerTalkingStateRef.current = peerTalkingState; }, [peerTalkingState]);
    useEffect(() => { peerPermissionsRef.current = peerPermissions; }, [peerPermissions]);

    // Generate a unique color for each peer
    const colors = ['#39ff14', '#ff4b4b', '#4facfe', '#f39c12', '#9b59b6'];
    const getPeerColor = (id) => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const handleData = (from, data) => {
        switch (data.type) {
            case MSG.JOIN:
                setPeers(p => ({ ...p, [data.id]: { profile: data.profile || { name: 'Guest' }, color: getPeerColor(data.id) } }));
                peerRef.current.connect(data.id);
                peerRef.current.broadcast({
                    type: MSG.JOIN_ACK,
                    id: myIdRef.current,
                    profile: userProfile
                });
                // Send library manifest to new peer after connection stabilises
                setTimeout(() => {
                    const sampler = samplerRefCollab.current;
                    if (sampler && peerRef.current) {
                        const instruments = [];
                        for (const [id, inst] of sampler.instruments) {
                            instruments.push({ id, name: inst.name, noteCount: inst.samples.size, notes: Array.from(inst.samples.keys()), originalBpm: inst.originalBpm });
                        }
                        if (instruments.length) {
                            peerRef.current.broadcast({ type: MSG.LIBRARY_MANIFEST, manifest: { instruments } });
                        }
                    }
                    // Host sends current permissions to newly joined peer
                    if (isHost && peerRef.current && Object.keys(peerPermissionsRef.current).length > 0) {
                        peerRef.current.broadcast({ type: MSG.PERMISSIONS_UPDATE, permissions: peerPermissionsRef.current });
                    }
                }, 2000);
                break;

            case MSG.JOIN_ACK:
                setPeers(p => ({ ...p, [data.id]: { profile: data.profile || { name: 'Peer' }, color: getPeerColor(data.id) } }));
                peerRef.current.connect(data.id);
                // Send our library manifest to new peer
                setTimeout(() => {
                    const sampler = samplerRefCollab.current;
                    if (sampler && peerRef.current) {
                        const instruments = [];
                        for (const [id, inst] of sampler.instruments) {
                            instruments.push({ id, name: inst.name, noteCount: inst.samples.size, notes: Array.from(inst.samples.keys()), originalBpm: inst.originalBpm });
                        }
                        if (instruments.length) {
                            peerRef.current.broadcast({ type: MSG.LIBRARY_MANIFEST, manifest: { instruments } });
                        }
                    }
                }, 2000);
                break;

            case MSG.LEAVE:
                setPeers(p => {
                    const c = { ...p };
                    delete c[data.id];
                    return c;
                });
                setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[data.id];
                    return next;
                });
                setMousePositions(prev => {
                    const next = { ...prev };
                    delete next[data.id];
                    return next;
                });
                // Clean up latency/connection state for leaving peer
                setPeerLatencies(prev => {
                    const next = { ...prev };
                    delete next[data.id];
                    return next;
                });
                setConnectionStates(prev => {
                    const next = { ...prev };
                    delete next[data.id];
                    return next;
                });
                delete lastPongTime.current[data.id];
                // Stop following if the leaving peer is who we follow
                if (followingPeerRef.current === data.id) {
                    setFollowingPeer(null);
                }
                // Clean up voice audio nodes for leaving peer
                setPeerTalkingState(prev => {
                    const next = { ...prev };
                    delete next[data.id];
                    return next;
                });
                setPeerMuteState(prev => {
                    const next = { ...prev };
                    delete next[data.id];
                    return next;
                });
                if (remoteAudioNodes.current[data.id]) {
                    try {
                        remoteAudioNodes.current[data.id].source?.disconnect();
                        remoteAudioNodes.current[data.id].highpass?.disconnect();
                        remoteAudioNodes.current[data.id].presenceRestore?.disconnect();
                        remoteAudioNodes.current[data.id].compressor?.disconnect();
                        remoteAudioNodes.current[data.id].gain?.disconnect();
                        remoteAudioNodes.current[data.id].analyser?.disconnect();
                    } catch (_) {}
                    delete remoteAudioNodes.current[data.id];
                }
                // Clean up peer library manifest
                setPeerLibraries(prev => {
                    const next = { ...prev };
                    delete next[data.id];
                    return next;
                });
                break;

            case MSG.HOST_DISCONNECT:
                // Host has left — disconnect everyone
                if (addToastRef.current) {
                    addToastRef.current(t('collab.hostEndedSession'), 'warning', 5000);
                }
                setMousePositions({});
                setPeers({});
                setIsCollapsed(true);
                // Trigger re-init by clearing profile (useEffect cleanup will destroy peer)
                setUserProfile({ name: '', email: '' });
                break;

            case MSG.TAB_ASSIGN:
                setTabOwners(data.payload);
                break;

            case MSG.FREE_FOR_ALL:
                setFreeForAll(data.enabled);
                if (data.enabled) {
                    setTabOwners(defaultOwners); // Clear all locks
                }
                if (addToastRef.current) {
                    addToastRef.current(
                        data.enabled ? 'Free-for-all mode enabled — all tabs unlocked!' : 'Tab locking re-enabled by host.',
                        'info'
                    );
                }
                break;

            case MSG.MOUSE_MOVE:
                setMousePositions(prev => ({
                    ...prev,
                    [from]: {
                        x: data.x,
                        y: data.y,
                        name: data.name || (peers[from]?.profile?.name) || 'Peer',
                        color: getPeerColor(from)
                    }
                }));
                break;

            case MSG.SCREEN_AVAILABLE:
                setScreens(s => [...new Set([...s, data.from])]);
                break;

            case MSG.SCREEN_REQUEST:
                if (myScreenRef.current) {
                    peerRef.current.callPeer(from, myScreenRef.current);
                }
                break;

            case MSG.HOST_SYNC:
                if (data.profile) {
                    setPeers(p => ({ ...p, [from]: { ...p[from], profile: data.profile } }));
                }
                break;

            // --- Ping / Pong ---
            case MSG.PING:
                if (peerRef.current?.connections[from]?.open) {
                    peerRef.current.connections[from].send({
                        type: MSG.PONG,
                        timestamp: data.timestamp
                    });
                }
                break;

            case MSG.PONG: {
                const latency = Date.now() - data.timestamp;
                setPeerLatencies(prev => ({ ...prev, [from]: latency }));
                lastPongTime.current[from] = Date.now();
                break;
            }

            // --- Chat ---
            case MSG.CHAT:
                setChatMessages(prev => {
                    const next = [...prev, {
                        id: data.timestamp + '-' + from,
                        from: data.from,
                        displayName: data.displayName,
                        text: data.text,
                        timestamp: data.timestamp
                    }];
                    // Cap at 200 messages
                    return next.length > 200 ? next.slice(-200) : next;
                });
                if (!chatVisibleRef.current) {
                    setUnreadCount(prev => prev + 1);
                }
                break;

            // --- Follow Mode ---
            case MSG.TAB_CHANGE:
                if (followingPeerRef.current === from && onTabChangeRef.current) {
                    onTabChangeRef.current(data.tab);
                }
                break;

            // --- Access Request ---
            case MSG.ACCESS_REQUEST:
                setAccessRequests(prev => {
                    // Deduplicate by from + tab
                    if (prev.some(r => r.from === data.from && r.tab === data.tab)) return prev;
                    return [...prev, {
                        from: data.from,
                        tab: data.tab,
                        displayName: data.displayName || 'Peer',
                        timestamp: Date.now()
                    }];
                });
                break;

            // --- Save Notification ---
            case MSG.SAVE_NOTIFICATION:
                if (addToastRef.current) {
                    addToastRef.current(`${data.displayName || 'A collaborator'} saved the project — save your copy too!`, 'info', 10000);
                }
                if (saveNotificationHandlerRef.current) {
                    saveNotificationHandlerRef.current(data.displayName || 'A collaborator');
                }
                break;

            case MSG.ACCESS_RESPONSE:
                if (data.granted && data.tab && data.to === myIdRef.current) {
                    setTabOwners(prev => ({ ...prev, [data.tab]: myIdRef.current }));
                    if (addToastRef.current) {
                        addToastRef.current(`Access granted to ${data.tab}`, 'success');
                    }
                } else if (!data.granted && data.to === myIdRef.current) {
                    if (addToastRef.current) {
                        addToastRef.current(`Access to ${data.tab} was denied`, 'warning');
                    }
                }
                break;

            // --- Voice Chat ---
            case MSG.PTT_STATE:
                setPeerTalkingState(prev => ({ ...prev, [from]: !!data.talking }));
                // If peer is muted by host, keep their gain at 0
                if (peerMuteStateRef.current[from]?.audio && data.talking) {
                    const nodes = remoteAudioNodes.current[from];
                    if (nodes?.gain) nodes.gain.gain.value = 0;
                }
                break;

            case MSG.COMM_MODE:
                setCommModeState(data.mode || 'both');
                break;

            case MSG.VOICE_READY:
                // Peer's mic is ready — call them with our voice stream if we have one
                if (voiceStreamRef.current && peerRef.current) {
                    peerRef.current.callPeer(from, voiceStreamRef.current, {
                        metadata: { type: 'voice' }
                    });
                }
                break;

            case MSG.PEER_MUTE:
                setPeerMuteState(prev => ({
                    ...prev,
                    [data.peerId]: {
                        audio: !!data.muteAudio,
                        chat: !!data.muteChat
                    }
                }));
                // If this mute targets us, show a toast
                if (data.peerId === myIdRef.current && addToastRef.current) {
                    const parts = [];
                    if (data.muteAudio) parts.push('mic');
                    if (data.muteChat) parts.push('chat');
                    if (parts.length) {
                        addToastRef.current(`Host muted your ${parts.join(' & ')}`, 'warning');
                    } else {
                        addToastRef.current('Host unmuted you', 'success');
                    }
                }
                // Apply audio mute to remote gain node if targeting a peer we have audio from
                if (remoteAudioNodes.current[data.peerId]?.gain) {
                    remoteAudioNodes.current[data.peerId].gain.gain.value =
                        data.muteAudio ? 0 : voiceMasterVolumeRef.current;
                }
                break;

            // --- Peer Permissions ---
            case MSG.PERMISSIONS_UPDATE:
                setPeerPermissions(data.permissions);
                if (addToastRef.current) {
                    addToastRef.current('Host updated your permissions', 'info');
                }
                break;

            // --- Shared Library ---
            case MSG.LIBRARY_MANIFEST:
                setPeerLibraries(prev => ({
                    ...prev,
                    [from]: data.manifest || { instruments: [] }
                }));
                break;

            case MSG.SAMPLE_REQUEST: {
                // A peer wants our samples — send them if we have a sampler
                const sampler = samplerRefCollab.current;
                if (!sampler) break;
                const reqInst = data.instrumentId;
                const instrument = sampler.instruments.get(reqInst);
                if (!instrument) break;
                const conn = peerRef.current?.connections[from];
                if (!conn?.open) break;

                // Send each sample note as a separate SAMPLE_DATA message
                (async () => {
                    for (const [note, audioBuffer] of instrument.samples) {
                        try {
                            // Encode AudioBuffer to WAV ArrayBuffer
                            const wavArrayBuffer = audioBufferToWavBuffer(audioBuffer);
                            conn.send({
                                type: MSG.SAMPLE_DATA,
                                instrumentId: reqInst,
                                instrumentName: instrument.name,
                                note: note,
                                sampleRate: audioBuffer.sampleRate,
                                channels: audioBuffer.numberOfChannels,
                                wavData: wavArrayBuffer,
                                totalNotes: instrument.samples.size,
                                sampleName: instrument.sampleNames?.get(note) || ''
                            });
                        } catch (e) {
                            console.warn('[Library] Failed to send sample:', reqInst, note, e);
                        }
                    }
                })();
                break;
            }

            case MSG.SAMPLE_DATA: {
                // Received a sample from a peer — decode and load into our sampler
                const sampler2 = samplerRefCollab.current;
                if (!sampler2 || !data.wavData) break;
                const instId = data.instrumentId;
                const key = `${from}_${instId}`;

                // Track pending requests
                if (!pendingSampleRequests.current[key]) {
                    pendingSampleRequests.current[key] = {
                        notes: [],
                        received: 0,
                        total: data.totalNotes || 1,
                        name: data.instrumentName || instId
                    };
                    setSharedLibraryStatus('syncing');
                }
                const pending = pendingSampleRequests.current[key];
                pending.received++;

                // Decode WAV ArrayBuffer to AudioBuffer
                (async () => {
                    try {
                        const audioBuffer = await sampler2.audioContext.decodeAudioData(
                            data.wavData instanceof ArrayBuffer ? data.wavData : data.wavData.buffer || data.wavData
                        );
                        pending.notes.push({
                            note: data.note,
                            buffer: audioBuffer,
                            name: data.sampleName || ''
                        });

                        // Once all notes for this instrument are received, load it
                        if (pending.received >= pending.total) {
                            sampler2.loadInstrument(instId, pending.notes, pending.name);
                            delete pendingSampleRequests.current[key];
                            console.log(`[Library] Loaded shared instrument: ${instId} (${pending.notes.length} samples)`);

                            // Check if all pending requests are done
                            if (Object.keys(pendingSampleRequests.current).length === 0) {
                                setSharedLibraryStatus('synced');
                                if (addToastRef.current) {
                                    addToastRef.current('Shared library synced!', 'success');
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[Library] Failed to decode sample:', instId, data.note, e);
                    }
                })();
                break;
            }
        }
    };

    const handleStream = (peerId, stream) => {
        setRemoteStreams(prev => ({ ...prev, [peerId]: stream }));
        if (!activeStream) setActiveStream(peerId);
    };

    const handleVoiceStream = (peerId, stream) => {
        console.log('[Voice] Received voice stream from', peerId);
        const ctx = voiceEngineRef.current?.ctx || new (window.AudioContext || window.webkitAudioContext)();

        const source = ctx.createMediaStreamSource(stream);

        // Highpass at 80 Hz — removes any residual rumble from peer's mic
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 80;
        highpass.Q.value = 0.707;

        // Presence restore at 6 kHz — compensates for Opus codec HF rolloff
        const presenceRestore = ctx.createBiquadFilter();
        presenceRestore.type = 'highshelf';
        presenceRestore.frequency.value = 6000;
        presenceRestore.gain.value = 2;

        // Safety limiter — catches peaks without crushing dynamics
        // (previous -20dB/20:1 hard limiter compressed everything, causing distortion)
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -6;
        compressor.knee.value = 3;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.001;
        compressor.release.value = 0.100;

        // Per-peer gain (controlled by master volume + host mute)
        const gain = ctx.createGain();
        const isMuted = peerMuteStateRef.current[peerId]?.audio;
        gain.gain.value = isMuted ? 0 : voiceMasterVolumeRef.current;

        // Analyser for metering (not connected to speakers)
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;

        // Wire: source -> highpass -> presenceRestore -> compressor -> gain -> speakers
        source.connect(highpass);
        highpass.connect(presenceRestore);
        presenceRestore.connect(compressor);
        compressor.connect(gain);
        gain.connect(ctx.destination);

        // Also wire source -> analyser for level metering
        source.connect(analyser);

        // Clean up old nodes for this peer if they exist
        if (remoteAudioNodes.current[peerId]) {
            try {
                remoteAudioNodes.current[peerId].source.disconnect();
                remoteAudioNodes.current[peerId].highpass?.disconnect();
                remoteAudioNodes.current[peerId].presenceRestore?.disconnect();
                remoteAudioNodes.current[peerId].compressor.disconnect();
                remoteAudioNodes.current[peerId].gain.disconnect();
                remoteAudioNodes.current[peerId].analyser.disconnect();
            } catch (_) {}
        }

        remoteAudioNodes.current[peerId] = { source, highpass, presenceRestore, compressor, gain, analyser };
    };

    const handleRecordingStream = (peerId, stream) => {
        console.log('[Collab] Received recording stream from', peerId);
        // Play the recording audio through speakers so peer can hear what's being recorded
        const ctx = samplerRefCollab.current?.audioContext || voiceEngineRef.current?.ctx;
        if (!ctx) return;
        try {
            const source = ctx.createMediaStreamSource(stream);
            const gain = ctx.createGain();
            gain.gain.value = voiceMasterVolumeRef.current;
            source.connect(gain);
            gain.connect(ctx.destination);
            // Store for cleanup — reuse the voice nodes structure with a recording prefix
            const key = `rec_${peerId}`;
            if (remoteAudioNodes.current[key]) {
                try { remoteAudioNodes.current[key].source.disconnect(); remoteAudioNodes.current[key].gain.disconnect(); } catch (_) {}
            }
            remoteAudioNodes.current[key] = { source, gain, compressor: null, analyser: null };
        } catch (e) {
            console.warn('[Collab] Failed to play recording stream:', e);
        }
    };

    useEffect(() => {
        const id = `${room}-${Math.random().toString(36).slice(2, 6)}`;
        myIdRef.current = id;
        setMyId(id);

        const handleOpen = (id) => {
            peerRef.current.broadcast({ type: MSG.JOIN, id, profile: userProfile });
        };
        const handlePeerError = (type) => {
            if (type === 'peer-unavailable' && !isHost) {
                // Host's session no longer exists
                if (addToastRef.current) {
                    addToastRef.current(t('collab.sessionExpired'), 'error', 8000);
                }
                setMousePositions({});
                setPeers({});
                setIsCollapsed(true);
            }
        };
        peerRef.current = new PeerManager(id, handleData, handleStream, handleOpen, handleVoiceStream, handleRecordingStream, handlePeerError);

        let mouseThrottleTimer = null;
        const handleGlobalMouseMove = (e) => {
            if (mouseThrottleTimer || !peerRef.current) return;
            const prof = userProfileRef.current;
            // Don't track cursor until user has set a display name
            if (!prof.name || !prof.name.trim()) return;
            mouseThrottleTimer = setTimeout(() => { mouseThrottleTimer = null; }, 16); // ~60fps throttle
            const displayName = prof.name;
            // Broadcast to peers only if connections exist
            const conns = peerRef.current.connections;
            if (conns && Object.keys(conns).length > 0) {
                peerRef.current.broadcast({
                    type: MSG.MOUSE_MOVE,
                    x: e.clientX,
                    y: e.clientY,
                    name: displayName
                });
            }
            // Always track own cursor so user can verify their name/color
            setMousePositions(prev => ({
                ...prev,
                [myIdRef.current]: {
                    x: e.clientX,
                    y: e.clientY,
                    name: `${displayName} (you)`,
                    color: getPeerColor(myIdRef.current)
                }
            }));
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);

        // Ping interval for latency measurement
        const pingInterval = setInterval(() => {
            if (!peerRef.current) return;
            const now = Date.now();
            Object.keys(peerRef.current.connections).forEach(peerId => {
                const conn = peerRef.current.connections[peerId];
                if (conn?.open) {
                    conn.send({ type: MSG.PING, timestamp: now });
                }
            });
            // Derive connection states from lastPongTime
            setConnectionStates(prev => {
                const next = {};
                Object.keys(peerRef.current.connections).forEach(pid => {
                    const last = lastPongTime.current[pid] || 0;
                    const elapsed = now - last;
                    if (last === 0) next[pid] = 'connected'; // No pong yet, assume connected
                    else if (elapsed < 10000) next[pid] = 'connected';
                    else if (elapsed < 20000) next[pid] = 'reconnecting';
                    else next[pid] = 'disconnected';
                });
                return next;
            });
            // Clean up state for peers that have been unresponsive > 30s
            Object.keys(lastPongTime.current).forEach(pid => {
                const last = lastPongTime.current[pid] || 0;
                if (last > 0 && now - last > 30000) {
                    delete lastPongTime.current[pid];
                    setPeerLatencies(p => { const n = { ...p }; delete n[pid]; return n; });
                    setMousePositions(p => { const n = { ...p }; delete n[pid]; return n; });
                    // Disconnect stale remote audio nodes
                    if (remoteAudioNodes.current[pid]) {
                        try { remoteAudioNodes.current[pid].source?.disconnect(); } catch (_) {}
                        try { remoteAudioNodes.current[pid].highpass?.disconnect(); } catch (_) {}
                        try { remoteAudioNodes.current[pid].presenceRestore?.disconnect(); } catch (_) {}
                        try { remoteAudioNodes.current[pid].compressor?.disconnect(); } catch (_) {}
                        try { remoteAudioNodes.current[pid].gain?.disconnect(); } catch (_) {}
                        try { remoteAudioNodes.current[pid].analyser?.disconnect(); } catch (_) {}
                        delete remoteAudioNodes.current[pid];
                    }
                }
            });
        }, 5000);

        // --- Audio level metering loop ---
        let levelFrameCount = 0;
        const levelBuf = new Float32Array(256);
        const updateVoiceLevels = () => {
            voiceLevelRafRef.current = requestAnimationFrame(updateVoiceLevels);
            levelFrameCount++;
            if (levelFrameCount % 2 !== 0) return; // ~30fps

            const levels = {};
            // Local mic level
            if (voiceEngineRef.current) {
                levels[myIdRef.current] = voiceEngineRef.current.getLevel();
            }
            // Remote peer levels
            Object.entries(remoteAudioNodes.current).forEach(([pid, nodes]) => {
                if (nodes.analyser) {
                    nodes.analyser.getFloatTimeDomainData(levelBuf);
                    let sum = 0;
                    for (let i = 0; i < levelBuf.length; i++) sum += levelBuf[i] * levelBuf[i];
                    levels[pid] = Math.sqrt(sum / levelBuf.length);
                }
            });

            if (Object.keys(levels).length > 0) {
                setPeerAudioLevels(levels);
            }

            // --- Auto-ducking: lower DAW volume when someone is talking ---
            if (duckingGainRef.current) {
                const anyoneTalking = Object.values(levels).some(l => l > 0.01);
                const target = anyoneTalking ? duckingOriginalRef.current * 0.15 : duckingOriginalRef.current;
                const current = duckingGainRef.current.gain.value;
                // Smooth transition
                if (Math.abs(current - target) > 0.01) {
                    duckingGainRef.current.gain.setTargetAtTime(
                        target,
                        duckingGainRef.current.context.currentTime,
                        anyoneTalking ? 0.05 : 0.3
                    );
                }
            }
        };
        voiceLevelRafRef.current = requestAnimationFrame(updateVoiceLevels);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            clearInterval(pingInterval);
            if (voiceLevelRafRef.current) cancelAnimationFrame(voiceLevelRafRef.current);
            if (testIntervalRef.current) clearInterval(testIntervalRef.current);
            // Remove own cursor entry so name changes don't leave stale cursors
            const oldId = id;
            setMousePositions(prev => {
                const next = { ...prev };
                delete next[oldId];
                return next;
            });
            // Clean up voice engine
            if (voiceEngineRef.current) {
                voiceEngineRef.current.dispose();
                voiceEngineRef.current = null;
            }
            // Clean up remote audio nodes
            Object.values(remoteAudioNodes.current).forEach(nodes => {
                try {
                    nodes.source?.disconnect();
                    nodes.highpass?.disconnect();
                    nodes.presenceRestore?.disconnect();
                    nodes.compressor?.disconnect();
                    nodes.gain?.disconnect();
                    nodes.analyser?.disconnect();
                } catch (_) {}
            });
            remoteAudioNodes.current = {};
            if (peerRef.current) {
                peerRef.current.broadcast({ type: MSG.LEAVE, id });
                peerRef.current.destroy();
            }
        };
    }, [userProfile]); // Re-bind if profile changes

    // --- Auto-release idle tabs ---
    useEffect(() => {
        const myCurrentId = myIdRef.current;
        if (!myCurrentId) return;

        const owned = Object.entries(tabOwners)
            .filter(([, owner]) => owner === myCurrentId)
            .map(([tab]) => tab);

        // Clear timers for tabs we no longer own
        Object.keys(idleTimers.current).forEach(tab => {
            if (!owned.includes(tab)) {
                clearTimeout(idleTimers.current[tab]?.warningTimeout);
                clearTimeout(idleTimers.current[tab]?.releaseTimeout);
                delete idleTimers.current[tab];
            }
        });

        // Set up timers for owned tabs
        owned.forEach(tab => {
            const lastActivity = tabActivity[tab] || Date.now();
            const elapsed = Date.now() - lastActivity;

            if (idleTimers.current[tab]) {
                clearTimeout(idleTimers.current[tab].warningTimeout);
                clearTimeout(idleTimers.current[tab].releaseTimeout);
            }

            const warningDelay = Math.max(0, 60000 - elapsed);
            const releaseDelay = Math.max(0, 90000 - elapsed);

            idleTimers.current[tab] = {
                warningTimeout: setTimeout(() => {
                    if (addToastRef.current) {
                        addToastRef.current(`Idle warning: ${tab} tab will be released in 30s`, 'warning', 5000);
                    }
                }, warningDelay),
                releaseTimeout: setTimeout(() => {
                    setTabOwners(prev => {
                        const updated = { ...prev, [tab]: null };
                        if (peerRef.current) {
                            peerRef.current.broadcast({ type: MSG.TAB_ASSIGN, payload: updated });
                        }
                        return updated;
                    });
                    if (addToastRef.current) {
                        addToastRef.current(`${tab} tab released due to inactivity`, 'info');
                    }
                }, releaseDelay)
            };
        });

        return () => {
            Object.values(idleTimers.current).forEach(t => {
                clearTimeout(t.warningTimeout);
                clearTimeout(t.releaseTimeout);
            });
        };
    }, [tabOwners, tabActivity]);

    // ---- Public methods ----

    const shareScreen = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            myScreenRef.current = stream;
            peerRef.current.broadcast({ type: MSG.SCREEN_AVAILABLE, from: myIdRef.current });
            Object.keys(peerRef.current.connections).forEach(id =>
                peerRef.current.callPeer(id, stream)
            );
        } catch (e) {
            console.error("Screen share failed", e);
        }
    };

    const requestScreen = peerId => {
        peerRef.current.connections[peerId]?.send({
            type: MSG.SCREEN_REQUEST,
            from: myIdRef.current
        });
    };

    const assignTab = (tab, peerId) => {
        if (!isHost) return;
        const updated = { ...tabOwners, [tab]: peerId };
        setTabOwners(updated);
        peerRef.current.broadcast({ type: MSG.TAB_ASSIGN, payload: updated });
    };

    const loginWithGoogle = (profile) => {
        const isSigningOut = !profile.name || !profile.name.trim();
        if (isSigningOut) {
            // If host, tell all peers the session is ending; otherwise just leave
            if (peerRef.current && myIdRef.current) {
                if (isHost) {
                    peerRef.current.broadcast({ type: MSG.HOST_DISCONNECT });
                }
                peerRef.current.broadcast({ type: MSG.LEAVE, id: myIdRef.current });
            }
            setMousePositions({});
            setPeers({});
            setIsCollapsed(true);
        } else {
            // Clear only own cursor entries (old names) — keep remote peers
            setMousePositions(prev => {
                const next = {};
                for (const [id, pos] of Object.entries(prev)) {
                    if (!pos.name?.endsWith('(you)')) next[id] = pos;
                }
                return next;
            });
            if (peerRef.current) {
                peerRef.current.broadcast({ type: MSG.HOST_SYNC, profile });
            }
        }
        setUserProfile(profile);
    };

    const startAudioShare = (audioCtx, masterGain) => {
        if (!audioCtx || !masterGain || !peerRef.current) return;
        console.log("Collab: starting audio share");
        const dest = audioCtx.createMediaStreamDestination();
        masterGain.connect(dest);

        Object.keys(peers).forEach(id => {
            peerRef.current.callPeer(id, dest.stream);
        });

        return dest.stream;
    };

    // --- Chat ---
    const sendChatMessage = useCallback((text) => {
        if (!text.trim() || !peerRef.current) return;
        const displayName = userProfile.email
            ? userProfile.email.split('@')[0]
            : userProfile.name;
        const msg = {
            type: MSG.CHAT,
            from: myIdRef.current,
            displayName,
            text: text.trim(),
            timestamp: Date.now()
        };
        peerRef.current.broadcast(msg);
        // Add to own messages locally
        setChatMessages(prev => {
            const next = [...prev, {
                id: Date.now() + '-' + myIdRef.current,
                from: myIdRef.current,
                displayName,
                text: text.trim(),
                timestamp: Date.now()
            }];
            return next.length > 200 ? next.slice(-200) : next;
        });
    }, [userProfile]);

    const setChatVisible = useCallback((visible) => {
        chatVisibleRef.current = visible;
        if (visible) setUnreadCount(0);
    }, []);

    // --- Follow Mode ---
    const followPeer = useCallback((peerId) => {
        setFollowingPeer(peerId);
    }, []);

    const stopFollowing = useCallback(() => {
        setFollowingPeer(null);
    }, []);

    const broadcastTabChange = useCallback((tab) => {
        if (peerRef.current) {
            peerRef.current.broadcast({ type: MSG.TAB_CHANGE, tab });
        }
    }, []);

    const setTabChangeHandler = useCallback((handler) => {
        onTabChangeRef.current = handler;
    }, []);

    // --- Conflict Resolution ---
    const requestAccess = useCallback((tab) => {
        if (!peerRef.current) return;
        const owner = tabOwners[tab];
        if (!owner) return;
        const displayName = userProfile.email
            ? userProfile.email.split('@')[0]
            : userProfile.name;
        if (peerRef.current.connections[owner]?.open) {
            peerRef.current.connections[owner].send({
                type: MSG.ACCESS_REQUEST,
                from: myIdRef.current,
                tab,
                displayName
            });
        }
        if (addToastRef.current) {
            addToastRef.current('Access request sent', 'info');
        }
    }, [tabOwners, userProfile]);

    const respondToAccessRequest = useCallback((requestIndex, granted) => {
        setAccessRequests(prev => {
            const req = prev[requestIndex];
            if (!req) return prev;

            if (granted) {
                const updated = { ...tabOwners, [req.tab]: req.from };
                setTabOwners(updated);
                if (peerRef.current) {
                    peerRef.current.broadcast({ type: MSG.TAB_ASSIGN, payload: updated });
                    if (peerRef.current.connections[req.from]?.open) {
                        peerRef.current.connections[req.from].send({
                            type: MSG.ACCESS_RESPONSE,
                            granted: true,
                            tab: req.tab,
                            to: req.from
                        });
                    }
                }
            } else {
                if (peerRef.current?.connections[req.from]?.open) {
                    peerRef.current.connections[req.from].send({
                        type: MSG.ACCESS_RESPONSE,
                        granted: false,
                        tab: req.tab,
                        to: req.from
                    });
                }
            }

            return prev.filter((_, i) => i !== requestIndex);
        });
    }, [tabOwners]);

    const recordTabActivity = useCallback((tab) => {
        setTabActivity(prev => ({ ...prev, [tab]: Date.now() }));
    }, []);

    const setAddToast = useCallback((fn) => {
        addToastRef.current = fn;
    }, []);

    // --- Test Mode ---
    const TEST_PEER_ID = 'test-peer-0000';
    const TEST_MESSAGES = [
        "Hey, what are you working on?",
        "That beat sounds great!",
        "Try changing the chord progression",
        "I love the bass line",
        "Should we add more reverb?",
        "The melody needs more variation",
        "Let's try a different key",
        "This is sounding really good!",
        "Maybe add some hi-hats here",
        "The tempo feels right"
    ];
    const TEST_RESPONSES = [
        "Good idea!",
        "I agree, let's try that",
        "Sounds cool!",
        "Nice suggestion",
        "Let me try something on my end",
        "That works perfectly",
        "I'll adjust the drums",
        "Great call on that change"
    ];

    const enableTestMode = useCallback(() => {
        if (testModeActive) return;
        setTestModeActive(true);
        setPeers(p => ({
            ...p,
            [TEST_PEER_ID]: {
                profile: { name: 'TestUser', email: 'testuser@example.com' },
                color: (() => {
                    // Ensure test peer gets a different color than the local user
                    const myColor = getPeerColor(myIdRef.current || '');
                    const testColor = getPeerColor(TEST_PEER_ID);
                    if (testColor !== myColor) return testColor;
                    const available = colors.filter(c => c !== myColor);
                    return available[0] || '#4facfe';
                })()
            }
        }));
        setPeerLatencies(prev => ({ ...prev, [TEST_PEER_ID]: 42 }));
        setConnectionStates(prev => ({ ...prev, [TEST_PEER_ID]: 'connected' }));

        let msgIndex = 0;
        testIntervalRef.current = setInterval(() => {
            const text = TEST_MESSAGES[msgIndex % TEST_MESSAGES.length];
            msgIndex++;
            setChatMessages(prev => {
                const next = [...prev, {
                    id: Date.now() + '-' + TEST_PEER_ID,
                    from: TEST_PEER_ID,
                    displayName: 'testuser',
                    text,
                    timestamp: Date.now()
                }];
                return next.length > 200 ? next.slice(-200) : next;
            });
            if (!chatVisibleRef.current) {
                setUnreadCount(prev => prev + 1);
            }
        }, 8000);

        if (addToastRef.current) {
            addToastRef.current('Test mode enabled — simulated peer connected', 'success');
        }
    }, [testModeActive]);

    const disableTestMode = useCallback(() => {
        setTestModeActive(false);
        if (testIntervalRef.current) {
            clearInterval(testIntervalRef.current);
            testIntervalRef.current = null;
        }
        setPeers(p => { const next = { ...p }; delete next[TEST_PEER_ID]; return next; });
        setPeerLatencies(prev => { const next = { ...prev }; delete next[TEST_PEER_ID]; return next; });
        setConnectionStates(prev => { const next = { ...prev }; delete next[TEST_PEER_ID]; return next; });
        setMousePositions(prev => { const next = { ...prev }; delete next[TEST_PEER_ID]; return next; });
        if (addToastRef.current) {
            addToastRef.current('Test mode disabled', 'info');
        }
    }, []);

    // Wrap sendChatMessage to add test-mode auto-response
    const sendChatMessageWrapped = useCallback((text) => {
        sendChatMessage(text);
        if (testModeActive) {
            setTimeout(() => {
                const response = TEST_RESPONSES[Math.floor(Math.random() * TEST_RESPONSES.length)];
                setChatMessages(prev => {
                    const next = [...prev, {
                        id: Date.now() + '-' + TEST_PEER_ID,
                        from: TEST_PEER_ID,
                        displayName: 'testuser',
                        text: response,
                        timestamp: Date.now()
                    }];
                    return next.length > 200 ? next.slice(-200) : next;
                });
                if (!chatVisibleRef.current) {
                    setUnreadCount(prev => prev + 1);
                }
            }, 1500 + Math.random() * 3000);
        }
    }, [sendChatMessage, testModeActive]);

    // --- Save Notification ---
    const broadcastSaveNotification = useCallback(() => {
        if (!peerRef.current) return;
        const displayName = userProfile.email
            ? userProfile.email.split('@')[0]
            : userProfile.name;
        peerRef.current.broadcast({
            type: MSG.SAVE_NOTIFICATION,
            from: myIdRef.current,
            displayName
        });
    }, [userProfile]);

    const setSaveNotificationHandler = useCallback((handler) => {
        saveNotificationHandlerRef.current = handler;
    }, []);

    // --- Free-for-All Mode ---
    const toggleFreeForAll = useCallback(() => {
        if (!isHost) return;
        const newVal = !freeForAll;
        setFreeForAll(newVal);
        if (newVal) {
            setTabOwners(defaultOwners); // Clear all locks
        }
        if (peerRef.current) {
            peerRef.current.broadcast({ type: MSG.FREE_FOR_ALL, enabled: newVal });
        }
    }, [freeForAll, isHost]);

    // --- Peer Permissions ---
    const updatePeerPermission = useCallback((peerId, permKey, value) => {
        if (!isHost) return;
        setPeerPermissions(prev => {
            const updated = {
                ...prev,
                [peerId]: { ...DEFAULT_PERMISSIONS, ...prev[peerId], [permKey]: value }
            };
            if (peerRef.current) {
                peerRef.current.broadcast({ type: MSG.PERMISSIONS_UPDATE, permissions: updated });
            }
            return updated;
        });
    }, [isHost]);

    const getMyPermissions = useCallback(() => {
        if (isHost) return DEFAULT_PERMISSIONS;
        return { ...DEFAULT_PERMISSIONS, ...peerPermissions[myIdRef.current] };
    }, [isHost, peerPermissions]);

    // --- Voice Chat Methods ---

    /** Lazy-init mic on first PTT press */
    const initVoice = useCallback(async () => {
        if (voiceEngineRef.current) return; // already initialised
        const engine = new VoiceChatEngine();
        const stream = await engine.init();
        voiceEngineRef.current = engine;
        voiceStreamRef.current = stream;
        setVoiceInitialized(true);

        // Call all connected peers with our voice stream
        if (peerRef.current) {
            Object.keys(peerRef.current.connections).forEach(pid => {
                peerRef.current.callPeer(pid, stream, { metadata: { type: 'voice' } });
            });
            // Notify peers our voice is ready
            peerRef.current.broadcast({ type: MSG.VOICE_READY, from: myIdRef.current });
        }
    }, []);

    /** PTT press — start talking (uses refs to avoid stale closures) */
    const startTalking = useCallback(async () => {
        // Enforce 2-person talk limit using refs for fresh values
        const currentTalkers = Object.values(peerTalkingStateRef.current).filter(Boolean).length
            + (localTalkingRef.current ? 1 : 0);
        if (currentTalkers >= 2) return false; // reject

        // Check if audio muted by host
        if (peerMuteStateRef.current[myIdRef.current]?.audio) return false;

        // Lazy init mic if needed
        if (!voiceEngineRef.current) {
            try {
                await initVoice();
            } catch (e) {
                console.error('[Voice] Mic init failed:', e);
                if (addToastRef.current) addToastRef.current('Mic access denied', 'error');
                return false;
            }
        }

        voiceEngineRef.current.startTalking();
        setLocalTalking(true);
        if (peerRef.current) {
            peerRef.current.broadcast({ type: MSG.PTT_STATE, talking: true });
        }
        return true;
    }, [initVoice]);

    /** PTT release — stop talking */
    const stopTalking = useCallback(() => {
        if (voiceEngineRef.current) {
            voiceEngineRef.current.stopTalking();
        }
        setLocalTalking(false);
        if (peerRef.current) {
            peerRef.current.broadcast({ type: MSG.PTT_STATE, talking: false });
        }
    }, []);

    /** Host: set comm mode and broadcast */
    const setCommMode = useCallback((mode) => {
        if (!isHost) return;
        setCommModeState(mode);
        if (peerRef.current) {
            peerRef.current.broadcast({ type: MSG.COMM_MODE, mode });
        }
    }, [isHost]);

    /** Set master voice volume (0-1) for all incoming voice audio */
    const setVoiceMasterVolume = useCallback((v) => {
        const vol = Math.max(0, Math.min(1, v));
        setVoiceMasterVolumeState(vol);
        // Update all remote gain nodes
        Object.entries(remoteAudioNodes.current).forEach(([pid, nodes]) => {
            if (nodes.gain) {
                const isMuted = peerMuteStateRef.current[pid]?.audio;
                nodes.gain.gain.value = isMuted ? 0 : vol;
            }
        });
    }, []);

    /** Host: mute/unmute a peer (audio/chat) */
    const mutePeer = useCallback((peerId, { audio, chat }) => {
        if (!isHost) return;
        setPeerMuteState(prev => ({
            ...prev,
            [peerId]: { audio: !!audio, chat: !!chat }
        }));
        // Apply to remote gain node
        if (remoteAudioNodes.current[peerId]?.gain) {
            remoteAudioNodes.current[peerId].gain.gain.value = audio ? 0 : voiceMasterVolumeRef.current;
        }
        // Broadcast to all peers
        if (peerRef.current) {
            peerRef.current.broadcast({
                type: MSG.PEER_MUTE,
                peerId,
                muteAudio: !!audio,
                muteChat: !!chat
            });
        }
    }, [isHost]);

    /** Set the DAW master gain reference for auto-ducking */
    const setDuckingTarget = useCallback((gainNode, originalVolume) => {
        duckingGainRef.current = gainNode;
        duckingOriginalRef.current = originalVolume || 1.0;
    }, []);

    /** Toggle self-monitor (hear your own voice) */
    const setSelfMonitor = useCallback((enabled) => {
        setSelfMonitorEnabledState(enabled);
        if (voiceEngineRef.current) {
            voiceEngineRef.current.setSelfMonitor(enabled);
        }
    }, []);

    // --- Shared Library Methods ---

    /** Set the sampler engine reference for sample I/O */
    const setSamplerRef = useCallback((sampler) => {
        samplerRefCollab.current = sampler;
    }, []);

    /** Broadcast our library manifest to all peers */
    const broadcastLibraryManifest = useCallback(() => {
        const sampler = samplerRefCollab.current;
        if (!sampler || !peerRef.current) return;
        const instruments = [];
        for (const [id, inst] of sampler.instruments) {
            instruments.push({
                id,
                name: inst.name,
                noteCount: inst.samples.size,
                notes: Array.from(inst.samples.keys()),
                originalBpm: inst.originalBpm
            });
        }
        peerRef.current.broadcast({
            type: MSG.LIBRARY_MANIFEST,
            manifest: { instruments }
        });
    }, []);

    /** Toggle shared library — request samples from all peers */
    const setSharedLibrary = useCallback((enabled) => {
        setSharedLibraryEnabled(enabled);
        if (enabled && peerRef.current) {
            setSharedLibraryStatus('syncing');
            // Request instruments from all peers that have manifests
            Object.entries(peerRef.current.connections).forEach(([pid, conn]) => {
                if (conn?.open) {
                    // Request all instruments listed in their manifest
                    const lib = peerLibraries[pid];
                    if (lib?.instruments?.length) {
                        lib.instruments.forEach(inst => {
                            conn.send({
                                type: MSG.SAMPLE_REQUEST,
                                instrumentId: inst.id
                            });
                        });
                    }
                }
            });
            // If no peer libraries available yet, mark as idle
            const hasLibs = Object.values(peerLibraries).some(l => l?.instruments?.length);
            if (!hasLibs) {
                setSharedLibraryStatus('idle');
                if (addToastRef.current) {
                    addToastRef.current('No peer libraries available yet — waiting for peers to load samples.', 'info');
                }
            }
        } else {
            setSharedLibraryStatus('idle');
        }
    }, [peerLibraries]);

    // --- Recording Monitor Methods ---

    /**
     * Start recording mode: mute voice chat, broadcast mic input to peers.
     * @param {MediaStream} micStream — the mic stream from AudioRecorder
     */
    const startRecordingMonitor = useCallback((micStream) => {
        setIsRecordingActive(true);

        // Save current voice state and mute voice to prevent bleed
        voicePreRecordState.current = {
            wasTalking: localTalkingRef.current,
            voiceVolume: voiceMasterVolumeRef.current
        };
        // Mute all incoming voice audio during recording
        Object.values(remoteAudioNodes.current).forEach(nodes => {
            if (nodes.gain) nodes.gain.gain.setTargetAtTime(0, nodes.gain.context.currentTime, 0.02);
        });
        // Stop own PTT if active
        if (voiceEngineRef.current?.talking) {
            voiceEngineRef.current.stopTalking();
            setLocalTalking(false);
            if (peerRef.current) peerRef.current.broadcast({ type: MSG.PTT_STATE, talking: false });
        }

        // Route mic recording audio to all connected peers so they can hear what's being recorded
        if (micStream && peerRef.current) {
            try {
                const ctx = samplerRefCollab.current?.audioContext;
                if (ctx) {
                    const source = ctx.createMediaStreamSource(micStream);
                    const dest = ctx.createMediaStreamDestination();
                    source.connect(dest);
                    recordingMonitorNodes.current = { source, dest };

                    // Call all peers with the recording mic stream
                    Object.keys(peerRef.current.connections).forEach(pid => {
                        peerRef.current.callPeer(pid, dest.stream, {
                            metadata: { type: 'recording' }
                        });
                    });
                    console.log('[Collab] Recording monitor started — mic audio shared with peers');
                }
            } catch (e) {
                console.warn('[Collab] Failed to start recording monitor:', e);
            }
        }
    }, []);

    /**
     * Stop recording mode: restore voice chat, stop mic broadcast.
     */
    const stopRecordingMonitor = useCallback(() => {
        setIsRecordingActive(false);

        // Disconnect recording monitor nodes
        if (recordingMonitorNodes.current) {
            try {
                recordingMonitorNodes.current.source.disconnect();
                recordingMonitorNodes.current.dest.disconnect();
            } catch (_) {}
            recordingMonitorNodes.current = null;
        }

        // Restore voice volume
        const saved = voicePreRecordState.current;
        if (saved) {
            const vol = saved.voiceVolume;
            Object.entries(remoteAudioNodes.current).forEach(([pid, nodes]) => {
                if (nodes.gain) {
                    const isMuted = peerMuteStateRef.current[pid]?.audio;
                    nodes.gain.gain.setTargetAtTime(isMuted ? 0 : vol, nodes.gain.context.currentTime, 0.1);
                }
            });
            voicePreRecordState.current = null;
        }
        console.log('[Collab] Recording monitor stopped — voice chat restored');
    }, []);

    return {
        // Existing
        myId,
        room,
        peers,
        tabOwners,
        freeForAll,
        toggleFreeForAll,
        screens,
        remoteStreams,
        activeStream,
        setActiveStream,
        assignTab,
        shareScreen,
        requestScreen,
        startAudioShare,
        mousePositions,
        userProfile,
        loginWithGoogle,
        isHost,
        isCollapsed,
        setIsCollapsed,

        // Connection Status
        peerLatencies,
        connectionStates,

        // Chat
        chatMessages,
        sendChatMessage: sendChatMessageWrapped,
        unreadCount,
        setChatVisible,

        // Follow Mode
        followingPeer,
        followPeer,
        stopFollowing,
        broadcastTabChange,
        setTabChangeHandler,

        // Conflict Resolution
        accessRequests,
        requestAccess,
        respondToAccessRequest,
        recordTabActivity,
        setAddToast,

        // Peer Permissions
        peerPermissions,
        updatePeerPermission,
        getMyPermissions,
        DEFAULT_PERMISSIONS,

        // Test Mode
        testModeActive,
        enableTestMode,
        disableTestMode,

        // Save Notification
        broadcastSaveNotification,
        setSaveNotificationHandler,

        // Voice Chat
        commMode,
        setCommMode,
        peerTalkingState,
        peerAudioLevels,
        localTalking,
        voiceInitialized,
        voiceMasterVolume,
        setVoiceMasterVolume,
        peerMuteState,
        initVoice,
        startTalking,
        stopTalking,
        mutePeer,
        setDuckingTarget,
        selfMonitorEnabled,
        setSelfMonitor,

        // Shared Library
        sharedLibraryEnabled,
        setSharedLibrary,
        sharedLibraryStatus,
        peerLibraries,
        setSamplerRef,
        broadcastLibraryManifest,

        // Recording Monitor
        isRecordingActive,
        startRecordingMonitor,
        stopRecordingMonitor,

        // Color helper
        myColor: getPeerColor(myIdRef.current || ''),
        getPeerColor
    };
}
