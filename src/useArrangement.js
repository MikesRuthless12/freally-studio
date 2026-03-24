import { useState, useCallback, useRef, useEffect } from 'react';

const SECTION_COLORS = [
    '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c',
    '#4dabf7', '#9775fa', '#f06595', '#20c997',
    '#ff8787', '#74c0fc', '#b197fc', '#63e6be'
];

let sectionIdCounter = 0;
function nextSectionId() {
    return `section_${Date.now()}_${++sectionIdCounter}`;
}

function createSection(overrides = {}) {
    const id = nextSectionId();
    return {
        id,
        name: overrides.name || 'Section A',
        type: overrides.type || 'custom',
        bars: overrides.bars || 4,
        patterns: overrides.patterns || { drums: [], chords: [], melody: [], bass: [] },
        settings: {
            key: null,
            scale: null,
            tempo: null,
            genre: null,
            mood: null,
            ...(overrides.settings || {})
        },
        mix: overrides.mix || {
            master: { volume: 0.7 },
            tracks: {
                drums: { volume: 0.5, pan: 0, muted: false, soloed: false },
                chords: { volume: 0.5, pan: 0, muted: false, soloed: false },
                melody: { volume: 0.5, pan: 0, muted: false, soloed: false },
                bass: { volume: 0.5, pan: 0, muted: false, soloed: false }
            }
        },
        color: overrides.color || SECTION_COLORS[Math.floor(Math.random() * SECTION_COLORS.length)]
    };
}

const SECTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

const MAX_ARRANGEMENT_HISTORY = 50;

export function useArrangement() {
    const [arrangement, setArrangement] = useState([]);
    const [activeSection, setActiveSection] = useState(null);
    const [arrangementMode, setArrangementMode] = useState(true);
    const [canUndoArrangement, setCanUndoArrangement] = useState(false);
    const [canRedoArrangement, setCanRedoArrangement] = useState(false);

    // Track whether we're currently loading a section to avoid sync loops
    const isLoadingSection = useRef(false);

    // Undo/redo history for arrangement
    const historyRef = useRef([]); // Array of { arrangement, activeSection } snapshots
    const historyIndexRef = useRef(-1);
    const isRestoringRef = useRef(false); // Prevent pushing history during undo/redo

    const updateCanUndoRedo = useCallback(() => {
        setCanUndoArrangement(historyIndexRef.current > 0);
        setCanRedoArrangement(historyIndexRef.current < historyRef.current.length - 1);
    }, []);

    // Push current state onto history stack (call AFTER state update settles)
    const pushArrangementHistory = useCallback((arr, activeSec) => {
        if (isRestoringRef.current) return;
        const snapshot = {
            arrangement: JSON.parse(JSON.stringify(arr)),
            activeSection: activeSec
        };
        // Truncate any redo history beyond current index
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(snapshot);
        if (historyRef.current.length > MAX_ARRANGEMENT_HISTORY) {
            historyRef.current.shift();
        }
        historyIndexRef.current = historyRef.current.length - 1;
        updateCanUndoRedo();
    }, [updateCanUndoRedo]);

    // Auto-push history whenever arrangement changes
    const hasInitialSnapshot = useRef(false);
    const pushTimerRef = useRef(null);
    useEffect(() => {
        if (isRestoringRef.current) return;
        if (arrangement.length === 0) return;
        // Always capture the first snapshot immediately (no debounce)
        if (!hasInitialSnapshot.current) {
            hasInitialSnapshot.current = true;
            pushArrangementHistory(arrangement, activeSection);
            return;
        }
        // Debounce subsequent changes
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => {
            pushArrangementHistory(arrangement, activeSection);
        }, 300);
        return () => clearTimeout(pushTimerRef.current);
    }, [arrangement, activeSection, pushArrangementHistory]);

    const undoArrangement = useCallback(() => {
        if (historyIndexRef.current <= 0) return false;
        isRestoringRef.current = true;
        historyIndexRef.current -= 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        setArrangement(snapshot.arrangement);
        setActiveSection(snapshot.activeSection);
        updateCanUndoRedo();
        setTimeout(() => { isRestoringRef.current = false; }, 100);
        return true;
    }, [updateCanUndoRedo]);

    const redoArrangement = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return false;
        isRestoringRef.current = true;
        historyIndexRef.current += 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        setArrangement(snapshot.arrangement);
        setActiveSection(snapshot.activeSection);
        updateCanUndoRedo();
        setTimeout(() => { isRestoringRef.current = false; }, 100);
        return true;
    }, [updateCanUndoRedo]);

    // Initialize arrangement from current patterns when mode is turned on
    // Now creates a single implicit section spanning all timeline bars
    const initFromPatterns = useCallback((currentPatterns, currentBars) => {
        const section = createSection({
            name: 'Main',
            type: 'custom',
            bars: currentBars || 4,
            patterns: JSON.parse(JSON.stringify(currentPatterns)),
            color: SECTION_COLORS[0]
        });
        setArrangement([section]);
        setActiveSection(section.id);
        return section;
    }, []);

    // Section management — kept for backward compat but simplified
    // addSection is now a no-op (continuous timeline doesn't use sections)
    const addSectionGuard = useRef(false);
    const addSection = useCallback((afterId = null, overrides = {}) => {
        // No-op in continuous timeline mode
    }, []);

    const removeSection = useCallback((id) => {
        // No-op — single implicit section
    }, []);

    const duplicateSection = useCallback((id) => {
        // No-op — single implicit section
    }, []);

    const reorderSections = useCallback((fromIndex, toIndex) => {
        // No-op — single implicit section
    }, []);

    const updateSection = useCallback((id, updates) => {
        setArrangement(prev =>
            prev.map(s => s.id === id ? { ...s, ...updates } : s)
        );
    }, []);

    const updateSectionPatterns = useCallback((id, patterns) => {
        if (isLoadingSection.current) return;
        setArrangement(prev =>
            prev.map(s => s.id === id
                ? { ...s, patterns: JSON.parse(JSON.stringify(patterns)) }
                : s
            )
        );
    }, []);

    // Get the active section object
    const getActiveSection = useCallback(() => {
        return arrangement.find(s => s.id === activeSection) || null;
    }, [arrangement, activeSection]);

    // Get total bar count — now returns timelineBars from the single section
    const getTotalBars = useCallback(() => {
        return arrangement.reduce((sum, s) => sum + s.bars, 0);
    }, [arrangement]);

    // Get the section at a given bar offset — always returns the single section
    const getSectionAtBar = useCallback((barOffset) => {
        if (arrangement.length === 0) return null;
        return { section: arrangement[0], localBar: barOffset };
    }, [arrangement]);

    // Update the single section's bar count to match timelineBars
    const updateTimelineBars = useCallback((newBars) => {
        setArrangement(prev => {
            if (prev.length === 0) return prev;
            return prev.map((s, i) => i === 0 ? { ...s, bars: newBars } : s);
        });
    }, []);

    return {
        arrangement,
        setArrangement,
        activeSection,
        setActiveSection,
        arrangementMode,
        setArrangementMode,
        isLoadingSection,
        initFromPatterns,
        addSection,
        removeSection,
        duplicateSection,
        reorderSections,
        updateSection,
        updateSectionPatterns,
        getActiveSection,
        getTotalBars,
        getSectionAtBar,
        updateTimelineBars,
        SECTION_COLORS,
        undoArrangement,
        redoArrangement,
        canUndoArrangement,
        canRedoArrangement
    };
}
