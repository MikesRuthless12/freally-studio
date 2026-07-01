import Peer from "peerjs";
import { MSG } from "./PeerProtocol";

// SECURITY NOTE (B6): This implementation uses PeerJS's PUBLIC broker
// (0.peerjs.com). That broker can observe peer IDs and signaling metadata
// for rooms. Production deployments should run a private PeerJS server.
// The `onBrokerNotice` callback (set via constructor options) is invoked
// once at startup so consumers can surface a UI warning.

const MAX_JSON_BYTES = 10 * 1024 * 1024; // 10 MB hard cap on inbound JSON
const MAX_WAVDATA_BYTES = 5 * 1024 * 1024; // 5 MB cap on inbound binary samples
const RATE_LIMIT_MSGS_PER_SEC = 60;

/** Constant-time hex string compare. Both inputs must be strings. */
function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/** Approximate JSON byte size of a message without allocating a giant string twice. */
function approximateMessageBytes(msg) {
    try {
        // wavData ArrayBuffers are not JSON-serializable but PeerJS will pass them
        // as-is on the data channel. Account for them separately.
        if (msg && msg.wavData) {
            const buf = msg.wavData instanceof ArrayBuffer
                ? msg.wavData
                : (msg.wavData?.buffer || null);
            const wavLen = buf ? buf.byteLength : 0;
            return wavLen + 1024; // wav payload + small json envelope
        }
        return JSON.stringify(msg).length;
    } catch (_) {
        return Infinity;
    }
}

export class PeerManager {
    /**
     * @param {string} myId
     * @param {Function} onData (peerId, data) => void
     * @param {Function} onStream (peerId, stream) => void
     * @param {Function} onOpen (id) => void
     * @param {Function} onVoiceStream (peerId, stream) => void
     * @param {Function} onRecordingStream (peerId, stream) => void
     * @param {Function} onError (errType, err) => void
     * @param {Object}   options
     * @param {string}   options.roomSecret  Shared secret all clients must present (hex).
     * @param {Function} [options.onBrokerNotice]  Called once with a broker-warning string.
     * @param {Function} [options.onIncomingCall]  (peerId, kind) => Promise<boolean>
     *                                             Return true to accept call. Default = reject.
     */
    constructor(myId, onData, onStream, onOpen, onVoiceStream, onRecordingStream, onError, options = {}) {
        this.myId = myId;
        this.peer = new Peer(myId);
        this.connections = {};
        this.calls = {};
        this.onData = onData;
        this.onStream = onStream;
        this.onVoiceStream = onVoiceStream;
        this.onRecordingStream = onRecordingStream;
        this.onOpen = onOpen;
        this.onError = onError;
        this.intendedConnections = new Set();
        this.reconnectTimeout = null;
        this.retryCount = 0;

        // --- Security state ---
        this.roomSecret = options.roomSecret || '';
        this.onIncomingCall = options.onIncomingCall || null; // optional consent callback
        this.onBrokerNotice = options.onBrokerNotice || null;

        /** Peers that have presented the correct shared secret. */
        this.authenticatedPeers = new Set();
        /** Calls buffered until the data conn authenticates: { [peerId]: [call, ...] } */
        this.pendingCalls = {};
        /** Per-peer rate-limit token buckets: { [peerId]: { count, windowStart } } */
        this.rateBuckets = {};

        this.setupPeerHandlers();

        // Surface broker warning to consumer (B6).
        if (this.onBrokerNotice) {
            try {
                this.onBrokerNotice('Freally collaboration uses the public PeerJS broker. Peer IDs and signaling metadata are visible to that broker. Use a private signaling server for sensitive sessions.');
            } catch (_) {}
        }
    }

    /** Update the shared secret (e.g. when joining a new room). */
    setRoomSecret(secret) {
        this.roomSecret = secret || '';
    }

    setupPeerHandlers() {
        this.peer.on("open", id => {
            console.log("Peer: signaling server connection opened:", id);
            this.retryCount = 0;
            if (this.onOpen) this.onOpen(id);
            this.intendedConnections.forEach(pid => {
                if (!this.connections[pid]) this.connect(pid);
            });
        });

        this.peer.on("connection", conn => {
            console.log("Peer: incoming connection from", conn.peer);
            this.setupConnection(conn, /*outgoing=*/false);
        });

        // B1/B8: NEVER auto-answer. Either reject (no callback) or buffer until
        // the data conn is authenticated and then ask consumer for consent.
        this.peer.on("call", call => {
            const callType = call.metadata?.type || 'media';
            console.log(`Peer: incoming ${callType} call from`, call.peer);

            const remote = call.peer;
            // If peer not yet authenticated, buffer the call and wait.
            if (!this.authenticatedPeers.has(remote)) {
                if (!this.pendingCalls[remote]) this.pendingCalls[remote] = [];
                this.pendingCalls[remote].push(call);
                // Safety timeout: discard pending calls if auth never arrives.
                setTimeout(() => {
                    if (!this.authenticatedPeers.has(remote)) {
                        const list = this.pendingCalls[remote] || [];
                        list.forEach(c => { try { c.close(); } catch (_) {} });
                        delete this.pendingCalls[remote];
                    }
                }, 15000);
                return;
            }
            this._processIncomingCall(call);
        });

        this.peer.on("disconnected", () => {
            console.warn("Peer: disconnected from signaling server. Reconnecting...");
            this.attemptReconnect();
        });

        this.peer.on("error", err => {
            console.error("PeerJS Error:", err);
            if (err.type === 'peer-unavailable') {
                if (this.onError) this.onError('peer-unavailable', err);
            } else if (err.type === 'server-error' || err.type === 'network' || err.type === 'disconnected') {
                this.attemptReconnect();
            }
        });
    }

    /** Process an incoming call after the peer has authenticated (B8 consent). */
    async _processIncomingCall(call) {
        const callType = call.metadata?.type || 'media';
        const remote = call.peer;

        // Voice may auto-accept (peer is already authenticated). Screen always
        // requires consumer consent.
        let accept = false;
        if (callType === 'voice') {
            accept = true;
        } else if (this.onIncomingCall) {
            try {
                accept = !!(await this.onIncomingCall(remote, callType));
            } catch (_) {
                accept = false;
            }
        } else {
            accept = false; // No consent callback => reject (B8 default).
        }

        if (!accept) {
            try { call.close(); } catch (_) {}
            return;
        }

        try { call.answer(); } catch (_) {}

        if (callType === 'voice') {
            this.setupVoiceCall(call);
        } else if (callType === 'recording') {
            this.setupRecordingCall(call);
        } else {
            this.setupCall(call);
        }
    }

    attemptReconnect() {
        if (this.reconnectTimeout) return;
        if (this.peer.destroyed) return;

        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
        this.retryCount++;

        console.log(`Peer: reconnecting in ${delay}ms...`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.peer.destroyed) return;
            if (this.peer.disconnected) {
                try {
                    this.peer.reconnect();
                } catch (err) {
                    console.warn("Peer: reconnect failed (peer likely destroyed)", err.message);
                }
            }
        }, delay);
    }

    connect(id) {
        if (id === this.myId) return;
        this.intendedConnections.add(id);

        if (this.connections[id] && this.connections[id].open) return;

        console.log("Peer: connecting to", id);
        try {
            const conn = this.peer.connect(id);
            this.setupConnection(conn, /*outgoing=*/true);
        } catch (err) {
            console.error("Connect failed:", err);
        }
    }

    setupConnection(conn, outgoing) {
        this.connections[conn.peer] = conn;
        // Track auth state per-conn so we don't dispatch user data before auth.
        conn._wlAuthed = false;

        conn.on("open", () => {
            console.log("Peer: Connection open with", conn.peer);
            // B1: outgoing connector sends AUTH first.
            if (outgoing) {
                try {
                    conn.send({ type: MSG.AUTH, secret: this.roomSecret });
                } catch (e) {
                    console.warn("Peer: failed to send AUTH", e);
                }
            }
        });

        conn.on("data", data => {
            // --- B12: payload size cap ---
            const bytes = approximateMessageBytes(data);
            if (bytes > MAX_JSON_BYTES) {
                console.warn("Peer: dropping oversized message from", conn.peer, bytes);
                return;
            }
            if (data && data.wavData) {
                const wavBuf = data.wavData instanceof ArrayBuffer
                    ? data.wavData
                    : (data.wavData?.buffer || null);
                if (wavBuf && wavBuf.byteLength > MAX_WAVDATA_BYTES) {
                    console.warn("Peer: dropping oversized wavData from", conn.peer);
                    return;
                }
            }

            // --- B12: per-peer rate limit ---
            if (!this._allowMessageRate(conn.peer)) {
                console.warn("Peer: rate-limit drop from", conn.peer);
                return;
            }

            // --- B1: AUTH handshake ---
            if (data && data.type === MSG.AUTH) {
                const ok = constantTimeEqual(String(data.secret || ''), String(this.roomSecret || ''));
                if (!ok) {
                    console.warn("Peer: auth failed from", conn.peer);
                    try { conn.close(); } catch (_) {}
                    return;
                }
                conn._wlAuthed = true;
                this.authenticatedPeers.add(conn.peer);
                // If incoming, echo AUTH back so the other side authenticates us too.
                if (!outgoing) {
                    try { conn.send({ type: MSG.AUTH, secret: this.roomSecret }); } catch (_) {}
                }
                // Flush any pending media calls now that the peer is auth'd.
                const queued = this.pendingCalls[conn.peer] || [];
                delete this.pendingCalls[conn.peer];
                queued.forEach(call => this._processIncomingCall(call));
                return;
            }

            // Drop everything else until authed.
            if (!conn._wlAuthed) {
                console.warn("Peer: dropping pre-auth message from", conn.peer, data?.type);
                return;
            }

            if (this.onData) this.onData(conn.peer, data);
        });

        conn.on("close", () => {
            console.log("Peer: Connection closed with", conn.peer);
            delete this.connections[conn.peer];
            this.authenticatedPeers.delete(conn.peer);
            delete this.rateBuckets[conn.peer];
            // Drop any queued calls for this peer.
            const queued = this.pendingCalls[conn.peer] || [];
            queued.forEach(c => { try { c.close(); } catch (_) {} });
            delete this.pendingCalls[conn.peer];

            if (this.intendedConnections.has(conn.peer)) {
                setTimeout(() => this.connect(conn.peer), 5000);
            }
        });
        conn.on("error", (err) => {
            console.error("Connection error:", err);
            conn.close();
        });
    }

    /** Returns true if peer is allowed to send another message right now. */
    _allowMessageRate(peerId) {
        const now = Date.now();
        let bucket = this.rateBuckets[peerId];
        if (!bucket || now - bucket.windowStart >= 1000) {
            bucket = { count: 0, windowStart: now };
            this.rateBuckets[peerId] = bucket;
        }
        bucket.count++;
        return bucket.count <= RATE_LIMIT_MSGS_PER_SEC;
    }

    broadcast(data) {
        // B12: outbound size cap (don't ship oversized frames either).
        const bytes = approximateMessageBytes(data);
        if (bytes > MAX_JSON_BYTES) {
            console.warn("Peer: refusing to broadcast oversized message", bytes);
            return;
        }
        Object.values(this.connections).forEach(conn => {
            if (conn.open) {
                try { conn.send(data); } catch (e) { console.warn("Peer: send failed", e); }
            }
        });
    }

    callPeer(peerId, stream, options = {}) {
        if (!stream) return;
        console.log(`Peer: calling ${peerId}${options.metadata?.type ? ` (${options.metadata.type})` : ''}`);
        try {
            const call = this.peer.call(peerId, stream, { metadata: options.metadata });
            if (options.metadata?.type === 'voice') {
                this.setupVoiceCall(call);
            } else if (options.metadata?.type === 'recording') {
                this.setupRecordingCall(call);
            } else {
                this.setupCall(call);
            }
        } catch (err) {
            console.error("Call failed:", err);
        }
    }

    setupCall(call) {
        const key = `${call.peer}_media`;
        this.calls[key] = call;
        call.on("stream", stream => {
            if (this.onStream) this.onStream(call.peer, stream);
        });
        call.on("close", () => {
            console.log("Peer: Call closed with", call.peer);
            delete this.calls[key];
        });
        call.on("error", (err) => {
            console.error("Call error:", err);
            call.close();
        });
    }

    setupVoiceCall(call) {
        const key = `${call.peer}_voice`;
        this.calls[key] = call;
        call.on("stream", stream => {
            if (this.onVoiceStream) this.onVoiceStream(call.peer, stream);
        });
        call.on("close", () => {
            console.log("Peer: Voice call closed with", call.peer);
            delete this.calls[key];
        });
        call.on("error", (err) => {
            console.error("Voice call error:", err);
            call.close();
        });
    }

    setupRecordingCall(call) {
        const key = `${call.peer}_recording`;
        this.calls[key] = call;
        call.on("stream", stream => {
            if (this.onRecordingStream) this.onRecordingStream(call.peer, stream);
        });
        call.on("close", () => {
            console.log("Peer: Recording call closed with", call.peer);
            delete this.calls[key];
        });
        call.on("error", (err) => {
            console.error("Recording call error:", err);
            call.close();
        });
    }

    destroy() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.peer.removeAllListeners();
        this.peer.destroy();
    }
}
