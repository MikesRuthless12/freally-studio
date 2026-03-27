import Peer from "peerjs";

export class PeerManager {
    constructor(myId, onData, onStream, onOpen, onVoiceStream, onRecordingStream, onError) {
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
        this.intendedConnections = new Set(); // Peer IDs we want to stay connected to
        this.reconnectTimeout = null;
        this.retryCount = 0;

        this.setupPeerHandlers();
    }

    setupPeerHandlers() {
        this.peer.on("open", id => {
            console.log("Peer: signaling server connection opened:", id);
            this.retryCount = 0;
            if (this.onOpen) this.onOpen(id);
            // Restore intended connections if any were lost
            this.intendedConnections.forEach(pid => {
                if (!this.connections[pid]) this.connect(pid);
            });
        });

        this.peer.on("connection", conn => {
            console.log("Peer: incoming connection from", conn.peer);
            this.setupConnection(conn);
        });

        this.peer.on("call", call => {
            const callType = call.metadata?.type || 'media';
            console.log(`Peer: incoming ${callType} call from`, call.peer);
            call.answer(); // Automatic answer
            if (callType === 'voice') {
                this.setupVoiceCall(call);
            } else if (callType === 'recording') {
                this.setupRecordingCall(call);
            } else {
                this.setupCall(call);
            }
        });

        this.peer.on("disconnected", () => {
            console.warn("Peer: disconnected from signaling server. Reconnecting...");
            this.attemptReconnect();
        });

        this.peer.on("error", err => {
            console.error("PeerJS Error:", err);
            if (err.type === 'peer-unavailable') {
                // The peer we tried to connect to doesn't exist (host left / session expired)
                if (this.onError) this.onError('peer-unavailable', err);
            } else if (err.type === 'server-error' || err.type === 'network' || err.type === 'disconnected') {
                this.attemptReconnect();
            }
        });
    }

    attemptReconnect() {
        if (this.reconnectTimeout) return;
        if (this.peer.destroyed) return;

        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
        this.retryCount++;

        console.log(`Peer: reconnecting in ${delay}ms...`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            // Re-check destroyed state: peer may have been destroyed while timeout was pending
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
            this.setupConnection(conn);
        } catch (err) {
            console.error("Connect failed:", err);
        }
    }

    setupConnection(conn) {
        this.connections[conn.peer] = conn;
        conn.on("open", () => {
            console.log("Peer: Connection open with", conn.peer);
        });
        conn.on("data", data => {
            if (this.onData) this.onData(conn.peer, data);
        });
        conn.on("close", () => {
            console.log("Peer: Connection closed with", conn.peer);
            delete this.connections[conn.peer];
            // Auto-reconnect if it was intended
            if (this.intendedConnections.has(conn.peer)) {
                setTimeout(() => this.connect(conn.peer), 5000); // Wait 5s before retry
            }
        });
        conn.on("error", (err) => {
            console.error("Connection error:", err);
            conn.close();
        });
    }

    broadcast(data) {
        Object.values(this.connections).forEach(conn => {
            if (conn.open) {
                conn.send(data);
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
        // Remove all event listeners before destroying to prevent post-destroy callbacks
        this.peer.removeAllListeners();
        this.peer.destroy();
    }
}
