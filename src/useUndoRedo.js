import { useRef, useState, useCallback } from 'react';

const MAX_HISTORY = 20;

export function useUndoRedo() {
    const historyRef = useRef([]);
    const currentIndexRef = useRef(-1);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const updateState = useCallback(() => {
        setCanUndo(currentIndexRef.current > 0);
        setCanRedo(currentIndexRef.current < historyRef.current.length - 1);
    }, []);

    const pushSnapshot = useCallback((stateSnapshot) => {
        try {
            const patternString = JSON.stringify(stateSnapshot.patterns);
            const currentSnapshot = historyRef.current[currentIndexRef.current];
            const currentPatternString = currentSnapshot ? JSON.stringify(currentSnapshot.patterns) : null;

            // Skip if the patterns haven't changed (prevents initial state clutter)
            if (currentPatternString === patternString) {
                return;
            }

            const snapshot = {
                ...stateSnapshot,
                patterns: JSON.parse(patternString), // Ensure deep clone
                timestamp: Date.now()
            };

            // If we're not at the end of history, truncate the future (redo states)
            if (currentIndexRef.current < historyRef.current.length - 1) {
                historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1);
            }

            historyRef.current.push(snapshot);

            if (historyRef.current.length > MAX_HISTORY) {
                historyRef.current.shift();
            }
            currentIndexRef.current = historyRef.current.length - 1;

            updateState();
        } catch (err) {
            console.error("Failed to push undo snapshot:", err);
            // Fallback
            const snapshot = {
                ...stateSnapshot,
                patterns: JSON.parse(JSON.stringify(stateSnapshot.patterns)),
                timestamp: Date.now()
            };

            if (currentIndexRef.current < historyRef.current.length - 1) {
                historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1);
            }
            historyRef.current.push(snapshot);
            if (historyRef.current.length > MAX_HISTORY) {
                historyRef.current.shift();
            }
            currentIndexRef.current = historyRef.current.length - 1;
            updateState();
        }
    }, [updateState]);

    const undo = useCallback(() => {
        if (currentIndexRef.current > 0) {
            currentIndexRef.current -= 1;
            updateState();
            return historyRef.current[currentIndexRef.current];
        }
        return null; // Cannot undo
    }, [updateState]);

    const redo = useCallback(() => {
        if (currentIndexRef.current < historyRef.current.length - 1) {
            currentIndexRef.current += 1;
            updateState();
            return historyRef.current[currentIndexRef.current];
        }
        return null; // Cannot redo
    }, [updateState]);

    return {
        undo,
        redo,
        pushSnapshot,
        canUndo,
        canRedo,
        historyLength: historyRef.current.length
    };
}
