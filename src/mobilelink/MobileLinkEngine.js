/**
 * Mobile Link Engine
 *
 * Core coordinator for mobile monitoring connections.
 * Creates a PeerJS host, streams master audio via WebRTC media call,
 * broadcasts metering data over the data channel, and handles
 * incoming solo/mute/volume commands from mobile clients.
 *
 * USAGE:
 *   const engine = new MobileLinkEngine(samplerEngine);
 *   await engine.activate();
 *   // engine.sessionUrl  → URL for QR code
 *   // engine.broadcastState(solos, mutes, volume, isPlaying, tempo);
 *   engine.onCommand(({ type, trackId, value }) => { ... });
 *   engine.dispose();
 *
 * ARCHITECTURE:
 *   - PeerJS peer with ID `wl-ml-XXXXXXXX` (8 random hex chars)
 *   - Accepts up to MAX_CLIENTS (3) simultaneous mobile connections
 *   - Audio: SamplerEngine.connectMobileStreamDest() → peer.call()
 *   - Metering: 25fps setInterval reads per-track + master levels
 *   - State: pushed via data channel as MOBILE_STATE messages
 *   - Commands: received via data channel, forwarded to registered callback
 */

import Peer from 'peerjs';
import { MOBILE_MSG } from './MobileLinkProtocol';

const MAX_CLIENTS = 3;
const METER_FPS = 10;
const METER_INTERVAL = Math.round(1000 / METER_FPS);
const TRACK_IDS = ['drums', 'chords', 'melody', 'bass'];

// B5: PIN lifecycle constants.
const PIN_GENERATION_TTL_MS = 5 * 60 * 1000;   // expire if no JOIN within 5 min of QR generation.
const PIN_IDLE_TTL_MS = 10 * 60 * 1000;        // expire after 10 min idle (no clients connected).

// SECURITY NOTE (B6): MobileLink uses the public PeerJS broker. Peer IDs are
// visible to that broker's operators. The PIN keeps unauthorized clients from
// joining a known session ID, but anyone observing signaling can still see
// connection metadata.

/**
 * Generate a random 8-char hex session ID.
 * @returns {string}
 */
function generateSessionId() {
    const arr = new Uint8Array(4);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * B5: Generate a 6-digit PIN using crypto.getRandomValues (rejection sampling
 * to avoid modulo bias).
 * @returns {string}
 */
function generatePin() {
    // Use a 32-bit random; reject values that would bias the [0, 999999] range.
    const max = 4294967296; // 2^32
    const limit = max - (max % 1000000);
    const arr = new Uint32Array(1);
    let v;
    do {
        crypto.getRandomValues(arr);
        v = arr[0];
    } while (v >= limit);
    return (v % 1000000).toString().padStart(6, '0');
}

function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
}

export class MobileLinkEngine {
    /**
     * @param {import('../SamplerEngine').SamplerEngine} samplerEngine
     */
    constructor(samplerEngine) {
        /** @type {import('../SamplerEngine').SamplerEngine} */
        this._sampler = samplerEngine;

        /** @type {Peer|null} */
        this._peer = null;

        /** @type {string} */
        this._sessionId = '';

        /** @type {string} Session URL for QR code */
        this.sessionUrl = '';

        /** @type {Map<string, { conn: any, call: any, deviceInfo: any }>} peerId → client */
        this._clients = new Map();

        /** @type {number|null} Metering interval handle */
        this._meterInterval = null;

        /** @type {MediaStream|null} */
        this._audioStream = null;

        /** @type {boolean} */
        this._active = false;

        /** @type {boolean} */
        this._disposed = false;

        /** @type {Function|null} Registered command handler */
        this._commandHandler = null;

        /** @type {Function[]} State change listeners */
        this._stateListeners = [];

        /** @type {number} Reconnect retry count */
        this._retryCount = 0;

        /** @type {number|null} */
        this._reconnectTimeout = null;

        // B5: PIN state.
        /** @type {string} */
        this._pin = '';
        /** @type {number} ms since epoch when PIN was generated. */
        this._pinGeneratedAt = 0;
        /** @type {number|null} timeout handle for the "no JOIN within 5 min" expiry. */
        this._pinJoinDeadlineTimeout = null;
        /** @type {number|null} timeout handle for the "idle 10 min" expiry. */
        this._pinIdleTimeout = null;

        // B6: optional broker-notice callback. Set via setBrokerNoticeHandler().
        this._brokerNoticeHandler = null;
    }

    /**
     * B6: register a one-shot callback that is invoked with a broker warning
     * string. The notice is fired immediately if the engine is already active.
     * @param {Function} cb (notice: string) => void
     */
    setBrokerNoticeHandler(cb) {
        this._brokerNoticeHandler = cb;
        if (cb && this._active) {
            try {
                cb('WavLoom MobileLink uses the public PeerJS broker. Session metadata may be visible to that broker. Use a private signaling server for sensitive sessions.');
            } catch (_) {}
        }
    }

    /**
     * B5: get the current PIN (6-digit). Empty string when inactive.
     * @returns {string}
     */
    get pin() {
        return this._pin;
    }

    /** B5: clear PIN-expiry timers. */
    _clearPinTimers() {
        if (this._pinJoinDeadlineTimeout) {
            clearTimeout(this._pinJoinDeadlineTimeout);
            this._pinJoinDeadlineTimeout = null;
        }
        if (this._pinIdleTimeout) {
            clearTimeout(this._pinIdleTimeout);
            this._pinIdleTimeout = null;
        }
    }

    /** B5: schedule the "no client in 5 min" expiry. */
    _armJoinDeadline() {
        if (this._pinJoinDeadlineTimeout) clearTimeout(this._pinJoinDeadlineTimeout);
        this._pinJoinDeadlineTimeout = setTimeout(() => {
            if (this._active && this._clients.size === 0) {
                console.warn('[MobileLink] PIN expired (no client joined within 5 min).');
                this.deactivate();
            }
        }, PIN_GENERATION_TTL_MS);
    }

    /** B5: arm/reset the idle expiry (no clients for 10 min). */
    _armIdleExpiry() {
        if (this._pinIdleTimeout) clearTimeout(this._pinIdleTimeout);
        this._pinIdleTimeout = setTimeout(() => {
            if (this._active && this._clients.size === 0) {
                console.warn('[MobileLink] Session idle 10 min — expiring.');
                this.deactivate();
            }
        }, PIN_IDLE_TTL_MS);
    }

    // ─── Lifecycle ─────────────────────────────────

    /**
     * Activate the mobile link.
     * Creates PeerJS peer, starts listening for connections.
     * @returns {Promise<string>} Session URL
     */
    activate() {
        if (this._active || this._disposed) {
            return Promise.resolve(this.sessionUrl);
        }

        return new Promise((resolve, reject) => {
            this._sessionId = 'wl-ml-' + generateSessionId();
            // B5: generate PIN at session creation.
            this._pin = generatePin();
            this._pinGeneratedAt = Date.now();

            try {
                this._peer = new Peer(this._sessionId);
            } catch (err) {
                reject(err);
                return;
            }

            this._peer.on('open', (id) => {
                console.log('[MobileLink] Peer open:', id);
                this._active = true;
                this._retryCount = 0;

                // B5: include PIN in the QR payload (URL hash → never sent to server logs).
                const origin = window.location.origin;
                const basePath = window.location.pathname.replace(/\/[^/]*$/, '');
                this.sessionUrl = `${origin}${basePath}/mobile-app/?s=${this._sessionId}#pin=${this._pin}`;

                // B5: arm the "no JOIN in 5 min" deadline.
                this._armJoinDeadline();

                // B6: surface broker notice once.
                if (this._brokerNoticeHandler) {
                    try {
                        this._brokerNoticeHandler('WavLoom MobileLink uses the public PeerJS broker. Session metadata may be visible to that broker. Use a private signaling server for sensitive sessions.');
                    } catch (_) {}
                }

                // Start audio tap
                this._audioStream = this._sampler.connectMobileStreamDest();

                // Start metering
                this._startMetering();

                this._notifyStateListeners();
                resolve(this.sessionUrl);
            });

            this._peer.on('connection', (conn) => {
                this._handleIncomingConnection(conn);
            });

            this._peer.on('call', (call) => {
                // B5/B8: only answer calls from clients we've already authenticated.
                // Mobile clients don't send audio to us, but inbound calls before
                // PIN auth must be rejected.
                const c = this._clients.get(call.peer);
                if (c && c.authed) {
                    try { call.answer(); } catch (_) {}
                } else {
                    try { call.close(); } catch (_) {}
                }
            });

            this._peer.on('disconnected', () => {
                console.warn('[MobileLink] Disconnected from signaling. Reconnecting...');
                this._attemptReconnect();
            });

            this._peer.on('error', (err) => {
                console.error('[MobileLink] PeerJS error:', err);
                if (err.type === 'unavailable-id') {
                    // Session ID collision — regenerate
                    this._sessionId = 'wl-ml-' + generateSessionId();
                    reject(new Error('Session ID taken, please retry'));
                } else if (err.type === 'server-error' || err.type === 'network') {
                    this._attemptReconnect();
                }
            });
        });
    }

    /**
     * Deactivate the mobile link.
     * Disconnects all clients, stops metering, destroys peer.
     */
    deactivate() {
        if (!this._active) return;
        this._active = false;

        // B5: clear PIN + timers.
        this._clearPinTimers();
        this._pin = '';
        this._pinGeneratedAt = 0;

        this._stopMetering();

        // Notify clients of disconnect
        for (const [peerId, client] of this._clients) {
            this._sendToClient(peerId, { type: MOBILE_MSG.DISCONNECT });
            try { client.conn.close(); } catch (_) {}
            try { client.call?.close(); } catch (_) {}
        }
        this._clients.clear();

        // Restore desktop speakers if muted
        this._sampler.muteDesktopOutput(false);

        // Release audio tap
        this._sampler.disconnectMobileStreamDest();
        this._audioStream = null;

        // Destroy peer
        if (this._peer) {
            try { this._peer.destroy(); } catch (_) {}
            this._peer = null;
        }

        if (this._reconnectTimeout) {
            clearTimeout(this._reconnectTimeout);
            this._reconnectTimeout = null;
        }

        this.sessionUrl = '';
        this._sessionId = '';
        this._notifyStateListeners();
    }

    /**
     * Full cleanup. Call on component unmount.
     */
    dispose() {
        this.deactivate();
        this._disposed = true;
        this._commandHandler = null;
        this._stateListeners = [];
    }

    // ─── Connection Handling ───────────────────────

    /** @param {any} conn PeerJS DataConnection */
    _handleIncomingConnection(conn) {
        conn.on('open', () => {
            const peerId = conn.peer;
            console.log('[MobileLink] Mobile connected:', peerId);

            // Check capacity
            if (this._clients.size >= MAX_CLIENTS) {
                conn.send(JSON.stringify({
                    type: MOBILE_MSG.REJECTED,
                    reason: 'max_connections',
                }));
                setTimeout(() => conn.close(), 100);
                return;
            }

            // B5: store client as UNAUTHENTICATED. Audio + state are withheld
            // until a JOIN with the correct PIN is received.
            this._clients.set(peerId, { conn, call: null, deviceInfo: null, authed: false });

            // Listen for data messages
            conn.on('data', (raw) => {
                try {
                    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    this._handleClientMessage(peerId, msg);
                } catch (e) {
                    console.warn('[MobileLink] Bad message from', peerId, e);
                }
            });

            conn.on('close', () => {
                console.log('[MobileLink] Mobile disconnected:', peerId);
                this._removeClient(peerId);
            });

            conn.on('error', (err) => {
                console.warn('[MobileLink] Connection error:', peerId, err);
                this._removeClient(peerId);
            });

            // B5: drop the connection if it never authenticates within 30s.
            setTimeout(() => {
                const c = this._clients.get(peerId);
                if (c && !c.authed) {
                    console.warn('[MobileLink] Auth timeout — closing', peerId);
                    try { c.conn.close(); } catch (_) {}
                    this._removeClient(peerId);
                }
            }, 30000);

            // Don't notify state listeners until authed.
        });
    }

    /**
     * Handle an incoming message from a mobile client.
     * @param {string} peerId
     * @param {Object} msg
     */
    _handleClientMessage(peerId, msg) {
        const client = this._clients.get(peerId);
        if (!client) return;

        // B5: drop pre-auth messages other than JOIN/DISCONNECT.
        if (!client.authed && msg.type !== MOBILE_MSG.JOIN && msg.type !== MOBILE_MSG.DISCONNECT) {
            console.warn('[MobileLink] dropping pre-auth', msg.type, 'from', peerId);
            return;
        }

        switch (msg.type) {
            case MOBILE_MSG.JOIN: {
                // B5: validate PIN.
                const ok = this._pin && constantTimeEqual(String(msg.pin || ''), this._pin);
                if (!ok) {
                    console.warn('[MobileLink] JOIN with bad/missing PIN from', peerId);
                    try {
                        client.conn.send(JSON.stringify({
                            type: MOBILE_MSG.REJECTED,
                            reason: 'bad_pin',
                        }));
                    } catch (_) {}
                    setTimeout(() => { try { client.conn.close(); } catch (_) {} }, 100);
                    return;
                }
                client.authed = true;
                client.deviceInfo = msg.deviceInfo || { name: 'Mobile Device' };

                // First successful JOIN within the deadline cancels the "no-join" timer
                // and arms the idle expiry instead.
                if (this._pinJoinDeadlineTimeout) {
                    clearTimeout(this._pinJoinDeadlineTimeout);
                    this._pinJoinDeadlineTimeout = null;
                }
                this._armIdleExpiry();

                // Send audio stream via media call now that the client is authed.
                if (this._audioStream && this._peer) {
                    const call = this._peer.call(peerId, this._audioStream, {
                        metadata: { type: 'mobile-audio' },
                    });
                    client.call = call;
                }

                // Respond with HELLO (full state dump will be sent by the app via broadcastState)
                this._sendToClient(peerId, {
                    type: MOBILE_MSG.HELLO,
                    sessionId: this._sessionId,
                    trackIds: TRACK_IDS,
                });
                this._notifyStateListeners();
                break;
            }

            case MOBILE_MSG.SOLO_TOGGLE:
            case MOBILE_MSG.MUTE_TOGGLE:
            case MOBILE_MSG.VOLUME:
            case MOBILE_MSG.DESKTOP_MUTE:
            case MOBILE_MSG.DISCONNECT: {
                if (msg.type === MOBILE_MSG.DISCONNECT) {
                    this._removeClient(peerId);
                    return;
                }
                // Forward to registered command handler
                if (this._commandHandler) {
                    this._commandHandler({
                        type: msg.type,
                        trackId: msg.trackId,
                        value: msg.value,
                        peerId,
                    });
                }
                break;
            }

            default:
                break;
        }
    }

    /**
     * Remove a client and clean up.
     * @param {string} peerId
     */
    _removeClient(peerId) {
        const client = this._clients.get(peerId);
        if (!client) return;
        try { client.conn.close(); } catch (_) {}
        try { client.call?.close(); } catch (_) {}
        this._clients.delete(peerId);

        // When the last client disconnects, restore desktop speakers
        if (this._clients.size === 0) {
            this._sampler.muteDesktopOutput(false);
            // B5: re-arm idle expiry so a stale session eventually self-terminates.
            if (this._active) this._armIdleExpiry();
        }

        this._notifyStateListeners();
    }

    // ─── Metering ──────────────────────────────────

    _startMetering() {
        if (this._meterInterval) return;
        this._meterInterval = setInterval(() => {
            if (this._clients.size === 0) return;

            const levels = {};
            for (const id of TRACK_IDS) {
                levels[id] = this._sampler.getTrackLevel(id);
            }
            levels.master = this._sampler.getMasterLevel();

            this._broadcast({
                type: MOBILE_MSG.LEVELS,
                levels,
            });
        }, METER_INTERVAL);
    }

    _stopMetering() {
        if (this._meterInterval) {
            clearInterval(this._meterInterval);
            this._meterInterval = null;
        }
    }

    // ─── State Broadcasting ────────────────────────

    /**
     * Push current app state to all connected mobile clients.
     * Call this whenever solo/mute/volume/transport changes.
     *
     * @param {Object} state
     * @param {string[]} state.solos   Array of solo'd track IDs
     * @param {string[]} state.mutes   Array of muted track IDs
     * @param {number}   state.volume  Master volume 0-1
     * @param {boolean}  state.isPlaying
     * @param {number}   state.tempo
     */
    broadcastState(state) {
        this._broadcast({
            type: MOBILE_MSG.STATE,
            solos: state.solos || [],
            mutes: state.mutes || [],
            volume: state.volume ?? 1,
            isPlaying: !!state.isPlaying,
            tempo: state.tempo || 120,
            desktopMuted: !!state.desktopMuted,
        });
    }

    /**
     * Push transport state to all connected mobile clients.
     *
     * @param {Object} transport
     * @param {boolean} transport.isPlaying
     * @param {number}  transport.tempo
     * @param {number}  transport.position  Current step position
     */
    broadcastTransport(transport) {
        this._broadcast({
            type: MOBILE_MSG.TRANSPORT,
            isPlaying: !!transport.isPlaying,
            tempo: transport.tempo || 120,
            position: transport.position || 0,
        });
    }

    // ─── Messaging Helpers ─────────────────────────

    /**
     * Send a message to all connected clients.
     * @param {Object} msg
     */
    _broadcast(msg) {
        const json = JSON.stringify(msg);
        for (const [peerId, client] of this._clients) {
            if (!client.authed) continue; // B5: only send to authenticated clients.
            this._sendRaw(peerId, json);
        }
    }

    /**
     * Send a message to a specific client.
     * @param {string} peerId
     * @param {Object} msg
     */
    _sendToClient(peerId, msg) {
        this._sendRaw(peerId, JSON.stringify(msg));
    }

    /**
     * Low-level send (pre-serialized).
     * @param {string} peerId
     * @param {string} json
     */
    _sendRaw(peerId, json) {
        const client = this._clients.get(peerId);
        if (!client || !client.conn.open) return;
        try {
            client.conn.send(json);
        } catch (e) {
            console.warn('[MobileLink] Send failed to', peerId, e);
        }
    }

    // ─── Reconnection ──────────────────────────────

    _attemptReconnect() {
        if (this._reconnectTimeout) return;
        if (!this._peer || this._peer.destroyed) return;

        const delay = Math.min(1000 * Math.pow(2, this._retryCount), 10000);
        this._retryCount++;

        console.log(`[MobileLink] Reconnecting in ${delay}ms...`);
        this._reconnectTimeout = setTimeout(() => {
            this._reconnectTimeout = null;
            if (!this._peer || this._peer.destroyed) return;
            if (this._peer.disconnected) {
                try {
                    this._peer.reconnect();
                } catch (err) {
                    console.warn('[MobileLink] Reconnect failed:', err.message);
                }
            }
        }, delay);
    }

    // ─── Public API ────────────────────────────────

    /**
     * Register a callback for incoming mobile commands.
     * @param {Function} handler  ({ type, trackId, value, peerId }) => void
     */
    onCommand(handler) {
        this._commandHandler = handler;
    }

    /**
     * Register a state change listener (for UI updates).
     * Called when clients connect/disconnect or engine activates/deactivates.
     * @param {Function} listener
     * @returns {Function} Unsubscribe function
     */
    onStateChange(listener) {
        this._stateListeners.push(listener);
        return () => {
            this._stateListeners = this._stateListeners.filter(l => l !== listener);
        };
    }

    /** @private */
    _notifyStateListeners() {
        const state = this.getState();
        for (const listener of this._stateListeners) {
            try { listener(state); } catch (_) {}
        }
    }

    /**
     * Get current engine state snapshot.
     * @returns {{ isActive: boolean, sessionUrl: string, connectedCount: number, clients: Array<{ peerId: string, deviceInfo: any }> }}
     */
    getState() {
        const clients = [];
        for (const [peerId, client] of this._clients) {
            // Only report authenticated clients (B5).
            if (!client.authed) continue;
            clients.push({
                peerId,
                deviceInfo: client.deviceInfo || { name: 'Mobile Device' },
            });
        }
        return {
            isActive: this._active,
            sessionUrl: this.sessionUrl,
            pin: this._pin,
            connectedCount: clients.length,
            clients,
        };
    }

    /** @returns {boolean} */
    get isActive() {
        return this._active;
    }

    /** @returns {number} count of authenticated mobile clients. */
    get connectedCount() {
        let n = 0;
        for (const [, c] of this._clients) if (c.authed) n++;
        return n;
    }
}

export default MobileLinkEngine;
