/**
 * ExportFormatter — Exports generated lyrics to TXT, LRC, JSON, and project formats.
 */

/**
 * Format lyrics as plain text.
 * @param {Array<{label: string, lines: string[]}>} sections
 * @returns {string}
 */
export function formatAsTXT(sections) {
    return sections.map(section => {
        const header = `[${section.label}]`;
        const body = section.lines.join('\n');
        return `${header}\n${body}`;
    }).join('\n\n');
}

/**
 * Format lyrics as LRC (timed lyrics) format.
 * @param {Array<{label: string, lines: string[], timing?: Array<{startMs: number}>}>} sections
 * @param {{ title?: string, artist?: string, album?: string }} metadata
 * @returns {string}
 */
export function formatAsLRC(sections, metadata = {}) {
    const header = [];
    if (metadata.title) header.push(`[ti:${metadata.title}]`);
    if (metadata.artist) header.push(`[ar:${metadata.artist}]`);
    if (metadata.album) header.push(`[al:${metadata.album}]`);
    header.push('[by:WavLoom Lyric Engine]');
    header.push('');

    const lines = [];
    let cumulativeMs = 0;
    const defaultLineMs = 4000; // default 4 seconds per line if no timing

    for (const section of sections) {
        // Add section marker as a timed line
        lines.push(`${msToLRC(cumulativeMs)} [${section.label}]`);
        cumulativeMs += 1000;

        for (let i = 0; i < section.lines.length; i++) {
            const timing = section.timing?.[i];
            const startMs = timing?.startMs ?? cumulativeMs;

            lines.push(`${msToLRC(startMs)} ${section.lines[i]}`);
            cumulativeMs = startMs + (timing?.durationMs || defaultLineMs);
        }

        cumulativeMs += 2000; // gap between sections
    }

    return [...header, ...lines].join('\n');
}

/**
 * Convert milliseconds to LRC timestamp format [mm:ss.xx]
 * @param {number} ms
 * @returns {string}
 */
function msToLRC(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = seconds.toFixed(2).padStart(5, '0');
    return `[${mm}:${ss}]`;
}

/**
 * Format lyrics as JSON.
 * @param {Array<{label: string, type: string, lines: string[], timing?: Array}>} sections
 * @param {object} settings - generation settings used
 * @returns {string}
 */
export function formatAsJSON(sections, settings = {}) {
    const doc = {
        generator: 'WavLoom Lyric Engine',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        settings: {
            genre: settings.genre || '',
            mood: settings.mood || '',
            key: settings.key || '',
            scale: settings.scale || '',
            bpm: settings.bpm || 120,
            structure: settings.structure || '',
            rhymeScheme: settings.rhymeScheme || '',
            language: settings.language || 'English',
            creativity: settings.creativity || 50,
        },
        sections: sections.map(s => ({
            type: s.type,
            label: s.label,
            lines: s.lines,
            timing: s.timing || null,
        })),
    };

    return JSON.stringify(doc, null, 2);
}

/**
 * Format lyrics for WavLoom project integration.
 * @param {Array<{label: string, type: string, lines: string[]}>} sections
 * @param {object} settings
 * @returns {object} - project-compatible lyrics object
 */
export function formatAsProject(sections, settings = {}) {
    return {
        type: 'wavloom-lyrics',
        version: 1,
        settings,
        sections: sections.map(s => ({
            type: s.type,
            label: s.label,
            lines: s.lines,
            locked: false,
        })),
    };
}

/**
 * Trigger a file download in the browser.
 * @param {string} content - file content
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
