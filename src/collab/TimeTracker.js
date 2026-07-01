import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'freally_time_tracker';

function loadStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : { projects: {} };
    } catch {
        return { projects: {} };
    }
}

function saveStore(store) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch { /* quota exceeded — silently ignore */ }
}

function getProjectData(store, projectId) {
    return store.projects[projectId] || { totalMs: 0, sessions: [] };
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Hook that tracks current session time, collaboration time, and per-project total time.
 * @param {boolean} hasCollabPeers — true when at least one remote peer is connected
 * @param {string} projectName — current project name (used as key for per-project totals)
 */
export function useTimeTracker(hasCollabPeers, projectName) {
    const projectId = (projectName || 'Untitled').trim();
    const projectIdRef = useRef(projectId);
    const sessionStartRef = useRef(Date.now());
    const collabAccumRef = useRef(0);
    const collabStretchStartRef = useRef(null);
    const persistedRef = useRef(false); // guard against double-persist

    const [sessionMs, setSessionMs] = useState(0);
    const [collabMs, setCollabMs] = useState(0);
    const [totalMs, setTotalMs] = useState(() => getProjectData(loadStore(), projectId).totalMs);

    // When project changes, persist time to old project and reset session
    useEffect(() => {
        const prevId = projectIdRef.current;
        if (prevId !== projectId) {
            // Persist elapsed time to previous project
            const elapsed = Date.now() - sessionStartRef.current;
            if (elapsed > 2000) {
                const store = loadStore();
                const prev = getProjectData(store, prevId);
                prev.totalMs += elapsed;
                prev.sessions.push({
                    start: sessionStartRef.current,
                    end: Date.now(),
                    duration: elapsed,
                    collabMs: collabAccumRef.current + (collabStretchStartRef.current ? Date.now() - collabStretchStartRef.current : 0)
                });
                if (prev.sessions.length > 100) prev.sessions = prev.sessions.slice(-100);
                store.projects[prevId] = prev;
                saveStore(store);
            }

            // Reset for new project
            sessionStartRef.current = Date.now();
            collabAccumRef.current = 0;
            collabStretchStartRef.current = hasCollabPeers ? Date.now() : null;
            persistedRef.current = false;
            projectIdRef.current = projectId;

            setSessionMs(0);
            setCollabMs(0);
            setTotalMs(getProjectData(loadStore(), projectId).totalMs);
        }
    }, [projectId, hasCollabPeers]);

    // Track collab stretches
    useEffect(() => {
        if (hasCollabPeers) {
            if (collabStretchStartRef.current === null) {
                collabStretchStartRef.current = Date.now();
            }
        } else {
            if (collabStretchStartRef.current !== null) {
                collabAccumRef.current += Date.now() - collabStretchStartRef.current;
                collabStretchStartRef.current = null;
            }
        }
    }, [hasCollabPeers]);

    // 1-second tick
    useEffect(() => {
        const iv = setInterval(() => {
            const now = Date.now();
            const sess = now - sessionStartRef.current;
            setSessionMs(sess);

            let collab = collabAccumRef.current;
            if (collabStretchStartRef.current !== null) {
                collab += now - collabStretchStartRef.current;
            }
            setCollabMs(collab);

            const stored = getProjectData(loadStore(), projectIdRef.current);
            setTotalMs(stored.totalMs + sess);
        }, 1000);

        return () => clearInterval(iv);
    }, []);

    // Persist session on unmount / page unload
    const persistSession = useCallback(() => {
        if (persistedRef.current) return;
        persistedRef.current = true;
        const duration = Date.now() - sessionStartRef.current;
        if (duration < 2000) return;
        const store = loadStore();
        const proj = getProjectData(store, projectIdRef.current);
        proj.totalMs += duration;
        proj.sessions.push({
            start: sessionStartRef.current,
            end: Date.now(),
            duration,
            collabMs: collabAccumRef.current + (collabStretchStartRef.current ? Date.now() - collabStretchStartRef.current : 0)
        });
        if (proj.sessions.length > 100) proj.sessions = proj.sessions.slice(-100);
        store.projects[projectIdRef.current] = proj;
        saveStore(store);
    }, []);

    useEffect(() => {
        const handleUnload = () => persistSession();
        window.addEventListener('beforeunload', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            persistSession();
        };
    }, [persistSession]);

    return {
        sessionMs,
        collabMs,
        totalMs,
        sessionFormatted: formatTime(sessionMs),
        collabFormatted: formatTime(collabMs),
        totalFormatted: formatTime(totalMs),
    };
}

export { formatTime };
