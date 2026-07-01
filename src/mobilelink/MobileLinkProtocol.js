/**
 * Mobile Link Protocol — Message Types
 *
 * Defines all message types for the PeerJS data channel between
 * the desktop Freally app and connected mobile clients.
 */

export const MOBILE_MSG = {
    /** mobile → desktop: initial handshake with device info */
    JOIN: 'MOBILE_JOIN',
    /** desktop → mobile: full state dump on connection */
    HELLO: 'MOBILE_HELLO',
    /** desktop → mobile: connection refused (at capacity or PIN mismatch) */
    REJECTED: 'MOBILE_REJECTED',
    /** desktop → mobile: periodic RMS/peak meter data (~25fps) */
    LEVELS: 'MOBILE_LEVELS',
    /** desktop → mobile: solo/mute/volume/transport state update */
    STATE: 'MOBILE_STATE',
    /** mobile → desktop: toggle solo on a track */
    SOLO_TOGGLE: 'MOBILE_SOLO_TOGGLE',
    /** mobile → desktop: toggle mute on a track */
    MUTE_TOGGLE: 'MOBILE_MUTE_TOGGLE',
    /** mobile → desktop: master volume change */
    VOLUME: 'MOBILE_VOLUME',
    /** either direction: clean disconnect */
    DISCONNECT: 'MOBILE_DISCONNECT',
    /** desktop → mobile: transport state (play/stop/tempo/position) */
    TRANSPORT: 'MOBILE_TRANSPORT',
    /** either direction: mute/unmute desktop speaker output */
    DESKTOP_MUTE: 'MOBILE_DESKTOP_MUTE',
};
