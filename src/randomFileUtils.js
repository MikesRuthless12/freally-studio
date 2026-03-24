// Shared utilities for the "Random File From Selected Folder" feature.
// Used by DrumGeneratorEnhanced, ChordGeneratorEnhanced, and MelodyBassGeneratorEnhanced.

/**
 * Collect audio files from a selectedFolder object.
 * Uses pre-scanned `samples` array if available (recursive),
 * falls back to scanning `handle.entries()` (top-level only).
 * Returns { name, handle } objects for each audio file.
 */
export async function collectAudioFiles(selectedFolder) {
    // 1. Pre-scanned samples (recursive, already filtered to audio)
    if (selectedFolder.samples && selectedFolder.samples.length > 0) {
        return selectedFolder.samples
            .filter(s => s.handle && s.kind === 'file')
            .map(s => ({ name: s.name, handle: s.handle }));
    }

    // 2. Fallback: scan top-level via directory handle
    if (!selectedFolder.handle) return [];

    const files = [];
    try {
        for await (const [name, handle] of selectedFolder.handle.entries()) {
            if (handle.kind === 'file' && /\.(wav|mp3|ogg|flac|m4a)$/i.test(name)) {
                files.push({ name, handle });
            }
        }
    } catch (err) {
        console.error('[collectAudioFiles] Failed to read folder:', err);
    }
    return files;
}

/**
 * Collect MIDI files from a selectedFolder object.
 * Uses pre-scanned `files` tree if available (recursive),
 * falls back to scanning `handle.entries()` (top-level only).
 */
export async function collectMidiFiles(selectedFolder) {
    // 1. Pre-scanned file tree (recursive)
    if (selectedFolder.files && selectedFolder.files.length > 0) {
        const midiFiles = [];
        const flatten = (items) => {
            items.forEach(item => {
                if (item.kind === 'file' && item.type === 'midi') {
                    midiFiles.push({ name: item.name, handle: item.handle });
                }
                if (item.children) flatten(item.children);
            });
        };
        flatten(selectedFolder.files);
        return midiFiles;
    }

    // 2. Fallback: scan top-level via directory handle
    if (!selectedFolder.handle) return [];

    const files = [];
    try {
        for await (const [name, handle] of selectedFolder.handle.entries()) {
            if (handle.kind === 'file' && /\.(mid|midi)$/i.test(name)) {
                files.push({ name, handle });
            }
        }
    } catch (err) {
        console.error('[collectMidiFiles] Failed to read folder:', err);
    }
    return files;
}

/**
 * Fisher-Yates shuffle. Returns a new shuffled copy.
 */
export function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
