// Step Resolution System - Support for 1/4, 1/8, 1/16, 1/32 notes

export const STEP_RESOLUTIONS = {
    '1/4': {
        name: 'Quarter Notes',
        stepsPerBeat: 1,
        stepsPerBar: 4,
        division: 4
    },
    '1/8': {
        name: 'Eighth Notes',
        stepsPerBeat: 2,
        stepsPerBar: 8,
        division: 8
    },
    '1/16': {
        name: 'Sixteenth Notes',
        stepsPerBeat: 4,
        stepsPerBar: 16,
        division: 16
    },
    '1/32': {
        name: 'Thirty-second Notes',
        stepsPerBeat: 8,
        stepsPerBar: 32,
        division: 32
    }
};

/**
 * Get steps per bar for a resolution
 */
export const getStepsPerBar = (resolution) => {
    return STEP_RESOLUTIONS[resolution]?.stepsPerBar || 16;
};

/**
 * Get steps per beat for a resolution
 */
export const getStepsPerBeat = (resolution) => {
    return STEP_RESOLUTIONS[resolution]?.stepsPerBeat || 4;
};

/**
 * Convert pattern from one resolution to another
 */
export const convertPatternResolution = (pattern, fromResolution, toResolution) => {
    const fromSteps = getStepsPerBar(fromResolution);
    const toSteps = getStepsPerBar(toResolution);
    const ratio = toSteps / fromSteps;
    
    return pattern.map(note => ({
        ...note,
        step: Math.round(note.step * ratio),
        duration: note.duration ? Math.round(note.duration * ratio) : 1
    }));
};

/**
 * Get grid line positions for resolution
 */
export const getGridLines = (resolution, bars) => {
    const stepsPerBar = getStepsPerBar(resolution);
    const stepsPerBeat = getStepsPerBeat(resolution);
    const totalSteps = stepsPerBar * bars;
    
    const lines = [];
    
    for (let step = 0; step <= totalSteps; step++) {
        const isBar = step % stepsPerBar === 0;
        const isBeat = step % stepsPerBeat === 0;
        
        lines.push({
            step,
            isBar,
            isBeat,
            weight: isBar ? 'heavy' : isBeat ? 'medium' : 'light'
        });
    }
    
    return lines;
};

/**
 * Get recommended canvas width for resolution
 */
export const getCanvasWidth = (resolution, bars) => {
    const stepsPerBar = getStepsPerBar(resolution);
    const totalSteps = stepsPerBar * bars;
    
    // Minimum 20px per step for visibility
    const minPixelsPerStep = 20;
    
    // For 1/32 notes, we need more width
    const pixelsPerStep = resolution === '1/32' ? 15 : 
                          resolution === '1/16' ? 20 :
                          resolution === '1/8' ? 30 : 40;
    
    return Math.max(1200, totalSteps * pixelsPerStep);
};

/**
 * Quantize step to resolution
 */
export const quantizeStep = (step, resolution) => {
    const stepsPerBar = getStepsPerBar(resolution);
    return Math.max(0, Math.min(step, stepsPerBar - 1));
};

/**
 * Get step duration in seconds
 */
export const getStepDuration = (tempo, resolution) => {
    const beatsPerMinute = tempo;
    const beatsPerSecond = beatsPerMinute / 60;
    const secondsPerBeat = 1 / beatsPerSecond;
    const stepsPerBeat = getStepsPerBeat(resolution);
    return secondsPerBeat / stepsPerBeat;
};

/**
 * Format step as musical notation
 */
export const formatStepPosition = (step, resolution, bars) => {
    const stepsPerBar = getStepsPerBar(resolution);
    const stepsPerBeat = getStepsPerBeat(resolution);
    
    const bar = Math.floor(step / stepsPerBar) + 1;
    const stepInBar = step % stepsPerBar;
    const beat = Math.floor(stepInBar / stepsPerBeat) + 1;
    const subdivision = (stepInBar % stepsPerBeat) + 1;
    
    if (stepsPerBeat === 1) {
        return `${bar}.${beat}`;
    } else {
        return `${bar}.${beat}.${subdivision}`;
    }
};

export default {
    STEP_RESOLUTIONS,
    getStepsPerBar,
    getStepsPerBeat,
    convertPatternResolution,
    getGridLines,
    getCanvasWidth,
    quantizeStep,
    getStepDuration,
    formatStepPosition
};
