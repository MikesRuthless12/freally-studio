/**
 * Generate a cryptographically random hex string.
 * @param {number} byteLen number of random bytes (output length is 2*byteLen hex chars)
 * @returns {string}
 */
export function cryptoRandomId(byteLen = 8) {
    const arr = new Uint8Array(byteLen);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
    } else {
        // Fallback (should never happen in modern browsers)
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateRoom() {
    const params = new URLSearchParams(window.location.search);
    let room = params.get('room');
    if (!room) {
        // 16 hex chars = 8 random bytes; cryptographically secure
        room = cryptoRandomId(8);
        // Do not force URL update here to avoid accidental reload loops
    }
    return room;
}

export function createInviteLink(roomId, secret) {
    // In Electron, use wavloom:// protocol so the link opens the desktop app.
    // Secret is appended in the fragment so it isn't sent to brokers/loggers.
    if (window.electronAPI?.isElectron) {
        const base = `wavloom://join?room=${encodeURIComponent(roomId)}`;
        return secret ? `${base}#s=${encodeURIComponent(secret)}` : base;
    }
    // Build a clean URL: origin + pathname + ?room=ID + #s=SECRET.
    // (Drop any existing hash/query so we don't leak state into the invite.)
    // Parse from href so test envs that set `window.location.href` directly —
    // without propagating to `.origin`/`.pathname` — still produce a valid URL.
    let origin = '';
    let pathname = '/';
    try {
        const url = new URL(window.location.href);
        origin = url.origin;
        pathname = url.pathname;
    } catch {
        origin = window.location.origin || '';
        pathname = window.location.pathname || '/';
    }
    const base = `${origin}${pathname}?room=${encodeURIComponent(roomId)}`;
    return secret ? `${base}#s=${encodeURIComponent(secret)}` : base;
}
