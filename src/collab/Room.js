export function getOrCreateRoom() {
    const params = new URLSearchParams(window.location.search);
    let room = params.get('room');
    if (!room) {
        room = Math.random().toString(36).slice(2, 10);
        // Do not force URL update here to avoid accidental reload loops
    }
    return room;
}

export function createInviteLink(roomId) {
    // In Electron, use wavloom:// protocol so the link opens the desktop app
    if (window.electronAPI?.isElectron) {
        return `wavloom://join?room=${encodeURIComponent(roomId)}`;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    return url.toString();
}
