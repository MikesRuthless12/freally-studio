// Domain: Genre-specific voicing, chord rhythm, inversion, and 808 pattern rules
// Keyed by typicalProgressionType from genre definitions (29 unique values)
// Pure data — zero imports

// ─── 1. Genre Voicing Weights ──────────────────────────────────────────────
// Each entry is an array of [voicingName, weight] pairs for weighted() selection.
// Voicing names must match VOICING_STRATEGIES keys in PatternEngine.js.

export const GENRE_VOICING_WEIGHTS = {
    // Trap / Drill / Phonk — sparse, dark, sub-heavy
    trap:       [['power', 4], ['sparse', 3], ['close', 2]],
    drill:      [['power', 4], ['sparse', 3], ['close', 2]],
    phonk:      [['power', 3], ['sparse', 3], ['close', 2], ['open', 1]],

    // Classic Hip-Hop
    hiphop:     [['close', 3], ['open', 2], ['power', 1]],
    boom_bap:   [['close', 3], ['open', 2], ['power', 1], ['drop-2', 0.5]],

    // Jazz family — rich extensions, rootless voicings
    jazz:       [['drop-2', 4], ['shell', 3], ['rootless', 3], ['close', 1]],

    // Neo-Soul / R&B — lush, inverted
    neosoul:    [['drop-2', 3], ['spread', 2], ['rootless', 2], ['open', 1]],
    soul:       [['drop-2', 3], ['spread', 2], ['rootless', 2], ['open', 1]],

    // Lo-Fi — jazz-influenced, mellow
    lofi:       [['drop-2', 3], ['shell', 2], ['close', 2], ['open', 1]],

    // House / Techno / EDM — clean stabs and pads
    house:      [['close', 3], ['open', 3], ['spread', 1]],
    techno:     [['close', 3], ['open', 2], ['sparse', 1]],
    edm:        [['close', 3], ['open', 3], ['spread', 1]],

    // Trance — wide pads, expansive
    trance:     [['open', 3], ['wide', 3], ['close', 1]],

    // Rock / Metal — power chords dominate
    rock:       [['power', 5], ['close', 1]],
    metal:      [['power', 5], ['close', 1]],

    // Ambient / Cinematic — wide, expansive
    ambient:    [['wide', 4], ['spread', 3], ['open', 1]],
    cinematic:  [['wide', 4], ['spread', 3], ['open', 1], ['close', 0.5]],

    // Pop / K-Pop / Indie — standard triads
    pop:        [['close', 3], ['open', 2], ['drop-2', 0.5]],
    kpop:       [['close', 3], ['open', 2], ['drop-2', 1]],
    indie:      [['close', 3], ['open', 2], ['spread', 0.5]],

    // Groove genres — clear, rhythmic voicings
    funk:       [['close', 3], ['open', 2], ['shell', 1]],
    latin:      [['close', 3], ['open', 2]],
    afrobeat:   [['close', 3], ['open', 2]],
    reggae:     [['close', 3], ['open', 2], ['spread', 0.5]],
    reggaeton:  [['close', 3], ['open', 2]],
    dancehall:  [['close', 3], ['open', 2]],

    // Bass music — aggressive, minimal
    dubstep:    [['close', 3], ['power', 2], ['sparse', 1]],
    dnb:        [['close', 3], ['power', 2], ['sparse', 1]],

    // Retro — wide pads
    synthwave:  [['open', 3], ['close', 2], ['spread', 1]],

    // Gospel — open, spread voicings
    gospel:     [['open', 3], ['spread', 2], ['drop-2', 2]]
};


// ─── 2. Genre Chord Rhythm Map ─────────────────────────────────────────────
// Each entry has { simple: [...], complex: [...] } weighted rhythm choices.
// Rhythm names must match CHORD_RHYTHM_STYLES keys in PatternEngine.js.

export const GENRE_CHORD_RHYTHM_MAP = {
    // Trap / Drill / Phonk
    trap:       { simple: [['pad', 3], ['trap_staccato', 2]],                complex: [['trap_staccato', 3], ['stab', 2], ['pad', 1]] },
    drill:      { simple: [['pad', 3], ['trap_staccato', 2]],                complex: [['trap_staccato', 3], ['stab', 2], ['pad', 1]] },
    phonk:      { simple: [['trap_staccato', 3], ['pad', 2]],                complex: [['trap_staccato', 3], ['stab', 2]] },

    // Classic Hip-Hop
    hiphop:     { simple: [['pad', 3], ['stab', 1]],                         complex: [['stab', 3], ['strum', 2], ['pad', 1]] },
    boom_bap:   { simple: [['pad', 2], ['boom_bap_chop', 2]],                complex: [['boom_bap_chop', 3], ['strum', 2]] },

    // Jazz
    jazz:       { simple: [['strum', 3], ['pad', 1]],                        complex: [['strum', 3], ['stab', 2]] },

    // Neo-Soul / R&B
    neosoul:    { simple: [['pad', 2], ['strum', 2]],                        complex: [['strum', 3], ['pad', 1], ['arpeggio', 1]] },
    soul:       { simple: [['pad', 3], ['strum', 1]],                        complex: [['strum', 3], ['pad', 1]] },

    // Lo-Fi
    lofi:       { simple: [['pad', 3], ['strum', 1]],                        complex: [['strum', 3], ['boom_bap_chop', 1]] },

    // House / Techno / EDM
    house:      { simple: [['pad', 2], ['offbeat', 2]],                      complex: [['offbeat', 3], ['pulse', 2], ['stab', 1]] },
    techno:     { simple: [['pad', 2], ['pulse', 2]],                        complex: [['pulse', 3], ['stab', 2]] },
    edm:        { simple: [['pad', 2], ['pulse', 1]],                        complex: [['pulse', 3], ['arpeggio', 2], ['stab', 1]] },

    // Trance
    trance:     { simple: [['pad', 3], ['arpeggio', 1]],                     complex: [['arpeggio', 3], ['pulse', 2], ['pad', 1]] },

    // Rock / Metal
    rock:       { simple: [['stab', 3], ['pad', 1]],                         complex: [['stab', 3], ['pulse', 2]] },
    metal:      { simple: [['stab', 3], ['pulse', 1]],                       complex: [['pulse', 3], ['stab', 2]] },

    // Ambient / Cinematic
    ambient:    { simple: [['ambient_swell', 3], ['pad', 2]],                complex: [['ambient_swell', 3], ['pad', 2]] },
    cinematic:  { simple: [['ambient_swell', 2], ['pad', 2]],                complex: [['ambient_swell', 3], ['pad', 2], ['arpeggio', 1]] },

    // Pop / K-Pop / Indie
    pop:        { simple: [['pad', 3], ['stab', 1]],                         complex: [['pulse', 2], ['stab', 2], ['arpeggio', 1]] },
    kpop:       { simple: [['pad', 2], ['pulse', 1]],                        complex: [['pulse', 3], ['stab', 2], ['arpeggio', 1]] },
    indie:      { simple: [['pad', 2], ['strum', 2]],                        complex: [['strum', 3], ['stab', 1], ['arpeggio', 1]] },

    // Groove genres
    funk:       { simple: [['stab', 3], ['pad', 1]],                         complex: [['stab', 3], ['pulse', 2]] },
    latin:      { simple: [['stab', 2], ['strum', 2]],                       complex: [['strum', 3], ['stab', 2]] },
    afrobeat:   { simple: [['stab', 2], ['pad', 2]],                         complex: [['stab', 3], ['pulse', 2]] },
    reggae:     { simple: [['offbeat', 3], ['pad', 1]],                      complex: [['offbeat', 3], ['strum', 2]] },
    reggaeton:  { simple: [['stab', 2], ['pad', 2]],                         complex: [['stab', 3], ['pulse', 2]] },
    dancehall:  { simple: [['stab', 2], ['offbeat', 2]],                     complex: [['offbeat', 3], ['stab', 2]] },

    // Bass music
    dubstep:    { simple: [['pad', 2], ['stab', 2]],                         complex: [['stab', 3], ['pulse', 2]] },
    dnb:        { simple: [['pad', 2], ['stab', 2]],                         complex: [['stab', 3], ['pulse', 2], ['arpeggio', 1]] },

    // Retro
    synthwave:  { simple: [['pad', 3], ['arpeggio', 1]],                     complex: [['arpeggio', 3], ['pad', 2], ['pulse', 1]] },

    // Gospel
    gospel:     { simple: [['pad', 2], ['strum', 2]],                        complex: [['strum', 3], ['arpeggio', 2]] }
};


// ─── 3. Genre Inversion Weights ────────────────────────────────────────────
// [rootPosition, firstInversion, secondInversion] probability weights.
// Applied as a gate AFTER voiceLead() to override purely-minimizing behavior.

export const GENRE_INVERSION_WEIGHTS = {
    // Trap / Drill / Phonk — heavily root position
    trap:       [85, 10, 5],
    drill:      [85, 10, 5],
    phonk:      [80, 12, 8],

    // Classic Hip-Hop
    hiphop:     [70, 18, 12],
    boom_bap:   [65, 20, 15],

    // Jazz — free voice leading
    jazz:       [30, 35, 35],

    // Neo-Soul / R&B — frequent inversions
    neosoul:    [30, 35, 35],
    soul:       [35, 35, 30],

    // Lo-Fi — jazz-influenced
    lofi:       [40, 30, 30],

    // House / Techno / EDM
    house:      [50, 30, 20],
    techno:     [55, 25, 20],
    edm:        [50, 30, 20],

    // Trance
    trance:     [45, 30, 25],

    // Rock / Metal — always root position
    rock:       [100, 0, 0],
    metal:      [100, 0, 0],

    // Ambient / Cinematic — free
    ambient:    [33, 34, 33],
    cinematic:  [33, 34, 33],

    // Pop / K-Pop / Indie
    pop:        [60, 25, 15],
    kpop:       [55, 28, 17],
    indie:      [55, 28, 17],

    // Groove genres
    funk:       [50, 30, 20],
    latin:      [50, 30, 20],
    afrobeat:   [55, 25, 20],
    reggae:     [60, 25, 15],
    reggaeton:  [60, 25, 15],
    dancehall:  [60, 25, 15],

    // Bass music
    dubstep:    [75, 15, 10],
    dnb:        [70, 18, 12],

    // Retro
    synthwave:  [50, 30, 20],

    // Gospel
    gospel:     [40, 35, 25]
};


// ─── 4. Genre 808 Bounce Patterns ──────────────────────────────────────────
// Named patterns defining step positions within a chord segment.
// Only applies to trap/drill/phonk; other genres use BASS_STYLES directly.
//
// Each pattern is an array of { step, duration, velocity, slide? } objects.
// 'step' is relative to segment start. 'duration' as fraction of segment
// length (1.0 = full segment). 'sustain' shorthand = 0.85 of segment.

export const BOUNCE_PATTERN_DEFS = {
    /** Long sustaining 808 — one hit, rides the whole chord */
    standard: [
        { step: 0, durationFrac: 0.85, velocity: 0.9 }
    ],

    /** Trap bounce — hit on 1, short hit mid-bar, hit on 3 */
    bounce: [
        { step: 0,  durationFrac: 0.35, velocity: 0.9 },
        { step: 12, durationFrac: 0.12, velocity: 0.7 },
        { step: 16, durationFrac: 0.35, velocity: 0.85 }
    ],

    /** Drill slide — long sustain with slide approaching next chord */
    drill_slide: [
        { step: 0, durationFrac: 0.75, velocity: 0.9 },
        { step: -4, durationFrac: 0.12, velocity: 0.7, slide: true }  // -4 = 4 steps before end
    ],

    /** Rolling 808 — rapid 16th-note hits on root */
    rolling: [
        { step: 0,  durationFrac: 0.12, velocity: 0.9 },
        { step: 4,  durationFrac: 0.12, velocity: 0.7 },
        { step: 8,  durationFrac: 0.12, velocity: 0.75 },
        { step: 12, durationFrac: 0.12, velocity: 0.65 },
        { step: 16, durationFrac: 0.12, velocity: 0.85 },
        { step: 20, durationFrac: 0.12, velocity: 0.65 },
        { step: 24, durationFrac: 0.12, velocity: 0.7 },
        { step: 28, durationFrac: 0.12, velocity: 0.6 }
    ],

    /** Syncopated 808 — off-beat hits */
    syncopated: [
        { step: 4,  durationFrac: 0.22, velocity: 0.8 },
        { step: 14, durationFrac: 0.15, velocity: 0.75 },
        { step: 20, durationFrac: 0.22, velocity: 0.85 },
        { step: 28, durationFrac: 0.12, velocity: 0.7 }
    ]
};

/** Maps typicalProgressionType → weighted bounce pattern selection.
 *  null = genre does not use 808 bounce patterns (uses standard BASS_STYLES). */
export const GENRE_808_PATTERNS = {
    trap:   [['standard', 2], ['bounce', 3], ['rolling', 1]],
    drill:  [['drill_slide', 4], ['standard', 1], ['bounce', 1]],
    phonk:  [['bounce', 3], ['syncopated', 2], ['standard', 1]],

    // All other progression types: null (not applicable)
    hiphop: null, boom_bap: null, jazz: null, neosoul: null, soul: null,
    lofi: null, house: null, techno: null, edm: null, trance: null,
    rock: null, metal: null, ambient: null, cinematic: null,
    pop: null, kpop: null, indie: null, funk: null, latin: null,
    afrobeat: null, reggae: null, reggaeton: null, dancehall: null,
    dubstep: null, dnb: null, synthwave: null, gospel: null
};
