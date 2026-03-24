/**
 * AdaptiveMixEngine — Automatically adjusts mixer parameters based on genre
 * and spectral balance using WebAudio AnalyserNode.
 *
 * Analyzes RMS energy, frequency spectrum, and peak levels per track,
 * then applies genre-aware volume, EQ, stereo width, and compression
 * adjustments via the existing SamplerEngine track buses.
 *
 * When an EffectsManager is provided, effects (EQEight, Compressor,
 * StereoWidener, and genre-specific character effects) are added as real
 * AudioEffect instances to each track's EffectsChain — visible and
 * adjustable in the DetailPanel. Knobs are set using modern mixing
 * methodologies tailored to each instrument type and genre.
 *
 * Public API:
 *   analyzeMix(samplerEngine)                                 → per-track analysis snapshot
 *   applyAdaptiveMix(samplerEngine, genreDNA, effectsManager) → applies mix adjustments
 *   getLastAnalysis()                                         → cached analysis from last run
 *   getAppliedSettings()                                      → last applied mix settings
 *   reset(samplerEngine, effectsManager)                      → revert to neutral defaults
 */

import { AudioEffect } from '../../effects/AudioEffect.js';

// ────────────────────────────────────────────────────────────────
// Genre Mix Profiles
// ────────────────────────────────────────────────────────────────

const GENRE_MIX_PROFILES = {

    // ════════════════════════════════════════════════════════════
    // HIP-HOP & TRAP
    // ════════════════════════════════════════════════════════════

    // ── Hip Hop ──
    // Classic hip-hop: punchy boom-bap drums up front, syncopated melodies,
    // root-heavy bass centered mono, laid-back groove. Moderate compression
    // to preserve dynamic swing feel.
    hiphop: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 3   },
        chords: { volumeDb: -2, pan: 0,    eqLow: -3, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3   },
    },

    // ── Trap ──
    // RULES: Kick +4dB, 808 bass forced mono (stereoWidth 0.0), hi-hats widened
    // (drums stereoWidth 0.6), snare boosted in high shelf for crack/plate
    // reverb presence. 808 sub-bass dominates with heavy low shelf +4dB and
    // aggressive compression (4:1) to keep it consistent. Sparse melodies
    // sit behind the bass. Chords are background texture.
    trap: {
        drums:  { volumeDb: 4,  pan: 0,    eqLow: 3,  eqMid: -1, eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -18, compRatio: 3   },
        chords: { volumeDb: -3, pan: 0,    eqLow: -4, eqMid: 0,  eqHigh: 1,  stereoWidth: 0.7,  compThreshold: -20, compRatio: 2   },
        melody: { volumeDb: -1, pan: 0,    eqLow: -6, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 3,  pan: 0,    eqLow: 4,  eqMid: -2, eqHigh: -6, stereoWidth: 0.0,  compThreshold: -16, compRatio: 4   },
    },

    // ── Drill ──
    // RULES: Aggressive sliding 808 bass — even more sub than trap (+5dB low),
    // 808 forced mono, dark melody style with boosted hi-hats for rhythmic
    // precision. Kick slightly less dominant than trap but snare/hats crispy.
    // Chords minimal and recessed. Very tight low-end compression (4:1, -14dB).
    drill: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 3,  stereoWidth: 0.55, compThreshold: -16, compRatio: 3.5 },
        chords: { volumeDb: -4, pan: 0,    eqLow: -4, eqMid: 1,  eqHigh: 0,  stereoWidth: 0.65, compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: -2, pan: 0,    eqLow: -5, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 2.5 },
        bass:   { volumeDb: 3,  pan: 0,    eqLow: 5,  eqMid: -3, eqHigh: -8, stereoWidth: 0.0,  compThreshold: -14, compRatio: 4   },
    },

    // ── Boom Bap ──
    // RULES: Classic 90s hip-hop — drums are king with punchy kicks and snappy
    // snares. Mid-focused drum EQ for that vinyl warmth (less hi-hat sparkle
    // than trap). Walking bass with warm low end, no extreme sub. Jazz-influenced
    // chords get gentle warmth. Narrower stereo image overall — mono-compatible.
    boom_bap: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: 0,  stereoWidth: 0.45, compThreshold: -18, compRatio: 3   },
        chords: { volumeDb: -2, pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 0,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3   },
    },

    // ── Lo-Fi ──
    // RULES: Deliberately rolled-off highs on everything for that dusty vinyl
    // feel. Drums are not dominant — sit level with chords. EQ cuts highs on
    // drums (-2dB) to simulate tape saturation. Mellow bass, warm mid boost.
    // Jazzy chords sit wider. Very gentle compression — dynamics are part of
    // the aesthetic. Everything feels relaxed and imperfect.
    lofi: {
        drums:  { volumeDb: 0,  pan: 0,    eqLow: 1,  eqMid: -1, eqHigh: -2, stereoWidth: 0.5,  compThreshold: -24, compRatio: 2   },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: -1, stereoWidth: 0.65, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 0,  stereoWidth: 0.6,  compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -22, compRatio: 2.5 },
    },

    // ── Cloud Rap ──
    // RULES: Ethereal, reverb-drenched atmosphere. Unlike standard trap,
    // melody is more prominent and wider (dreamy pads/synths). Sub-heavy bass
    // but less aggressive than trap — softer compression. Hi-hats less dominant.
    // Chords are atmospheric wash — wide stereo, rolled-off lows. Floating feel
    // with less punch than standard trap.
    cloud_rap: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: -1, eqHigh: 1,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.8,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -4, eqMid: 1,  eqHigh: 3,  stereoWidth: 0.7,  compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: -2, eqHigh: -5, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3   },
    },

    // ── Phonk ──
    // RULES: Memphis-inspired — heavy, distorted 808s with midrange grit (+2dB mid
    // on bass). Drums are punchy with boosted mids for cowbell/percussion presence.
    // Melody is bell/synth-focused with mid-high boost. Dark, heavy groove with
    // mono bass. Compressed hard for loudness.
    phonk: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 3,  eqMid: 1,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -16, compRatio: 3   },
        chords: { volumeDb: -2, pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: -1, stereoWidth: 0.6,  compThreshold: -20, compRatio: 2   },
        melody: { volumeDb: -1, pan: 0,    eqLow: -4, eqMid: 3,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -20, compRatio: 2   },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: 2,  eqHigh: -5, stereoWidth: 0.0,  compThreshold: -16, compRatio: 3.5 },
    },

    // ════════════════════════════════════════════════════════════
    // HOUSE
    // ════════════════════════════════════════════════════════════

    // ── House ──
    // RULES: Four-on-the-floor kick center and prominent (+2dB). Bass uses
    // sidechain-style compression (3.5:1, -18dB) to duck under the kick.
    // Pads/chords wide stereo (0.8) for that lush house feel. Uplifting
    // melodies with airy highs. Bass is pumping — tight mono.
    house: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 3   },
        chords: { volumeDb: -2, pan: 0,    eqLow: -3, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.8,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: -1, pan: 0,    eqLow: -5, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.65, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ── Deep House ──
    // RULES: Warmer, more subdued than regular house. Deeper bass with more
    // sub emphasis (+4dB low). Drums slightly quieter — the vibe is groovy,
    // not banging. Atmospheric chords/pads are the star — very wide (0.85).
    // Mids are warm, highs are smooth (not bright). Less compression overall
    // for more dynamic, organic feel.
    deep_house: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 0,  stereoWidth: 0.5,  compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.85, compThreshold: -26, compRatio: 2   },
        melody: { volumeDb: -1, pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.7,  compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Tech House ──
    // RULES: Tighter and more percussive than regular house. Drums are the
    // focus — crisp highs for hats, tight low end. Minimal melodic content,
    // rolling bassline with controlled low end. Chords are subtle texture,
    // not lush pads. Hypnotic groove — tighter stereo than regular house.
    // More aggressive drum compression for punch.
    tech_house: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -18, compRatio: 3.5 },
        chords: { volumeDb: -3, pan: 0,    eqLow: -4, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.65, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: -2, pan: 0,    eqLow: -5, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ── Progressive House ──
    // RULES: Big, building sound. Melody-forward with epic buildups — melody
    // gets +1dB boost. Very wide stereo field on chords (0.9) for that massive
    // arena sound. Bass is driving and consistent. Complex chords with bright
    // highs. Drums are steady, not overpowering. Moderate compression to
    // preserve dynamic builds.
    progressive_house: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 3,  stereoWidth: 0.9,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 4,  stereoWidth: 0.75, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Afro House ──
    // RULES: Polyrhythmic percussion is the star — drums wider (0.65) to
    // accommodate complex layered percussion patterns. Deep bass like deep
    // house but with more organic, groovy feel. Polyrhythmic melody elements
    // sit wider. Warm mids throughout. Bass has slight stereo allowance (0.1)
    // for organic feel but mostly centered.
    afro_house: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.65, compThreshold: -20, compRatio: 2.5 },
        chords: { volumeDb: -1, pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.75, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.65, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.1,  compThreshold: -20, compRatio: 3   },
    },

    // ════════════════════════════════════════════════════════════
    // TECHNO
    // ════════════════════════════════════════════════════════════

    // ── Techno ──
    // RULES: Kick is absolute center and dominant (+3dB). Pounding bass with
    // aggressive compression (4:1) and forced mono. Hypnotic stabs/chords
    // sit in the background, wide for atmosphere. Relentless groove — tight
    // compression on everything. High shelf boost on drums for hi-hat energy.
    techno: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 3,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.45, compThreshold: -18, compRatio: 4   },
        chords: { volumeDb: -4, pan: 0,    eqLow: -5, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.75, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: -2, pan: 0,    eqLow: -6, eqMid: 3,  eqHigh: 2,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: -2, eqHigh: -6, stereoWidth: 0.0,  compThreshold: -16, compRatio: 4   },
    },

    // ── Minimal Techno ──
    // RULES: Stripped-back — everything is subtle and restrained. Drums still
    // lead but less boosted. Bass is subtle, not pounding. Very little melodic
    // content — sparse textures. Narrow stereo field overall for focused,
    // hypnotic feel. Gentle compression — dynamics are part of minimal aesthetic.
    // Less EQ extremes than regular techno.
    minimal_techno: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.4,  compThreshold: -22, compRatio: 3   },
        chords: { volumeDb: -4, pan: 0,    eqLow: -4, eqMid: 1,  eqHigh: 0,  stereoWidth: 0.6,  compThreshold: -26, compRatio: 2   },
        melody: { volumeDb: -3, pan: 0,    eqLow: -5, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.55, compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Detroit Techno ──
    // RULES: Warmer and more soulful than Berlin techno. Chord pads are wider
    // and more prominent — Detroit heritage of soul/funk influence. Warmer
    // mid-range on everything. Bass is driving but less harsh than industrial.
    // Drums have more groove, less mechanical — slightly less compression.
    detroit_techno: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 3   },
        chords: { volumeDb: -2, pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.8,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: -1, pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.65, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: -1, eqHigh: -5, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ── Industrial Techno ──
    // RULES: Harsh, aggressive, and loud. Drums are very compressed (4.5:1)
    // for maximum impact. Bass is pounding with harsh midrange grit (+1dB mid).
    // Everything is tight and aggressive. High-frequency harshness is part of
    // the aesthetic — boosted highs on drums. Narrow stereo on drums for
    // maximum center punch. Very little dynamic range.
    industrial_techno: {
        drums:  { volumeDb: 4,  pan: 0,    eqLow: 3,  eqMid: 2,  eqHigh: 3,  stereoWidth: 0.4,  compThreshold: -14, compRatio: 4.5 },
        chords: { volumeDb: -4, pan: 0,    eqLow: -5, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2.5 },
        melody: { volumeDb: -3, pan: 0,    eqLow: -6, eqMid: 3,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -20, compRatio: 3   },
        bass:   { volumeDb: 3,  pan: 0,    eqLow: 5,  eqMid: 1,  eqHigh: -5, stereoWidth: 0.0,  compThreshold: -14, compRatio: 4.5 },
    },

    // ════════════════════════════════════════════════════════════
    // TRANCE
    // ════════════════════════════════════════════════════════════

    // ── Trance ──
    // RULES: Big euphoric sound. Melody/lead is prominent and wide. Pad/chord
    // layers are very wide (0.85) for the classic trance wall-of-sound. Rolling
    // bass is tight and mono. Drums provide steady foundation. Bright highs
    // across melody and chords for airiness.
    trance: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 3   },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 3,  stereoWidth: 0.85, compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 4,  stereoWidth: 0.7,  compThreshold: -20, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: -1, eqHigh: -5, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ── Psytrance ──
    // RULES: Very tight, mechanical bass — forced mono, heavily compressed (4:1).
    // Driving bass is the backbone, not melodic sub. Psychedelic textures in
    // melody/chords — very wide stereo (0.9 on chords) for trippy spatial effects.
    // Drums are tight and precise. Hypnotic, relentless groove. More aggressive
    // compression than regular trance.
    psytrance: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.45, compThreshold: -18, compRatio: 3.5 },
        chords: { volumeDb: -1, pan: 0,    eqLow: -3, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.9,  compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -5, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.8,  compThreshold: -20, compRatio: 2.5 },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: -1, eqHigh: -6, stereoWidth: 0.0,  compThreshold: -16, compRatio: 4   },
    },

    // ── Uplifting Trance ──
    // RULES: Maximum euphoria. Melody is the star — boosted (+2dB) with very
    // bright highs (+5dB) for those soaring lead lines. Chords are massive
    // wide pads (0.9). Bass is rolling and clean. Drums are steady with good
    // transient attack. Overall bright and airy mix.
    uplifting_trance: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 3   },
        chords: { volumeDb: 1,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 4,  stereoWidth: 0.9,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 2,  pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 5,  stereoWidth: 0.75, compThreshold: -20, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ── Progressive Trance ──
    // RULES: More subtle and building than uplifting. Less in-your-face melody,
    // more evolving textures. Wider chords for atmosphere. Bass is rolling and
    // consistent. Less compression to preserve dynamic build-ups. Mids are
    // warmer. Overall smoother, less bright than uplifting.
    progressive_trance: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.85, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ════════════════════════════════════════════════════════════
    // BASS MUSIC
    // ════════════════════════════════════════════════════════════

    // ── Dubstep ──
    // RULES: Bass is KING — wobble bass dominates with massive low end (+5dB),
    // slight stereo allowance (0.15) for modulation movement. Very heavy
    // compression on bass (5:1, -14dB). Drums are half-time feel, punchy but
    // not overwhelming. Melody sits behind bass. Aggressive midrange on bass
    // for growl texture.
    dubstep: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -18, compRatio: 3.5 },
        chords: { volumeDb: -3, pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: -2, pan: 0,    eqLow: -5, eqMid: 3,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -20, compRatio: 2.5 },
        bass:   { volumeDb: 3,  pan: 0,    eqLow: 5,  eqMid: 1,  eqHigh: -3, stereoWidth: 0.15, compThreshold: -14, compRatio: 5   },
    },

    // ── Drum & Bass ──
    // RULES: Breakbeats are the signature — drums are very prominent (+3dB)
    // with crispy highs for fast hat/cymbal work. Reese bass has sub focus
    // with some mid presence. Very fast, energetic — tight compression on
    // drums (4:1) for punchy breakbeats. Bass slightly wider (0.1) for
    // reese movement. Melody is energetic but secondary.
    dnb: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 3,  stereoWidth: 0.5,  compThreshold: -16, compRatio: 4   },
        chords: { volumeDb: -3, pan: 0,    eqLow: -4, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.75, compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: -1, pan: 0,    eqLow: -5, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.6,  compThreshold: -20, compRatio: 2.5 },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: 0,  eqHigh: -4, stereoWidth: 0.1,  compThreshold: -16, compRatio: 4   },
    },

    // ── Neurofunk ──
    // RULES: Even more aggressive than standard DnB. Bass has heavy midrange
    // processing — modulated bass sounds need mid presence (+2dB mid). Drums
    // are extremely tight and technical — maximum compression (4.5:1). Darker
    // than standard DnB — less brightness on chords. Very tight stereo on bass.
    // Complex, technical groove.
    neurofunk: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 1,  eqMid: 2,  eqHigh: 3,  stereoWidth: 0.45, compThreshold: -14, compRatio: 4.5 },
        chords: { volumeDb: -4, pan: 0,    eqLow: -5, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2.5 },
        melody: { volumeDb: -2, pan: 0,    eqLow: -5, eqMid: 3,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -18, compRatio: 3   },
        bass:   { volumeDb: 3,  pan: 0,    eqLow: 4,  eqMid: 2,  eqHigh: -3, stereoWidth: 0.05, compThreshold: -14, compRatio: 4.5 },
    },

    // ── Future Bass ──
    // RULES: Brighter and more melodic than dubstep. Super-saw chords are the
    // signature — wide (0.85) and bright (+3dB high). Melody is prominent and
    // bouncy. Bass has sub-808 character — less midrange growl than dubstep,
    // more clean sub. Less aggressive compression. Overall brighter, happier
    // mix than dubstep. Bouncy dynamics.
    future_bass: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 1,  eqMid: 0,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -20, compRatio: 3   },
        chords: { volumeDb: 1,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 3,  stereoWidth: 0.85, compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 4,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ════════════════════════════════════════════════════════════
    // POP & R&B
    // ════════════════════════════════════════════════════════════

    // ── Contemporary Pop ──
    // RULES: Vocal/melody-forward — melody is the most prominent element (+2dB)
    // with bright, clear highs. Drums are polished, not aggressive. Bass is
    // clean and supportive. Chords are wide for fullness. Everything is well-
    // compressed for radio-ready loudness. Bright, clear, polished mix.
    pop: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 1,  eqMid: 0,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -22, compRatio: 3   },
        chords: { volumeDb: -1, pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.75, compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 2,  pan: 0,    eqLow: -4, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 2.5 },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── K-Pop ──
    // RULES: Extremely polished and dynamic. More compressed than western pop
    // for that punchy K-pop sound. Drums are tighter with more high-end click.
    // Complex arrangements — chords are wide and dense. Melody is crystal clear
    // with boosted presence. Bass is tight and controlled. Everything is bright
    // and impactful.
    kpop: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 3,  stereoWidth: 0.55, compThreshold: -18, compRatio: 3.5 },
        chords: { volumeDb: -1, pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.8,  compThreshold: -20, compRatio: 2.5 },
        melody: { volumeDb: 2,  pan: 0,    eqLow: -4, eqMid: 3,  eqHigh: 4,  stereoWidth: 0.5,  compThreshold: -18, compRatio: 3   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ── Indie Pop ──
    // RULES: Warmer and more organic than mainstream pop. Less compressed —
    // more dynamic range for that indie character. Drums are less prominent.
    // Quirky melodies with warm mids. Bass is mellow, not punchy. Wider, more
    // relaxed stereo image. Less high-frequency boost — warmer overall tone.
    indie_pop: {
        drums:  { volumeDb: 0,  pan: 0,    eqLow: 1,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.55, compThreshold: -24, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.75, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: -2, stereoWidth: 0.0,  compThreshold: -22, compRatio: 2.5 },
    },

    // ── R&B ──
    // RULES: Smooth, vocal-forward mix. Melody/vocals are the star with warm
    // presence and airy highs. Drums are understated — groove-focused, not
    // punchy. Sub bass is deep but controlled. Chords have smooth warmth.
    // Gentle compression to preserve silky dynamics. Everything serves the
    // vocal/melody space.
    rnb: {
        drums:  { volumeDb: 0,  pan: 0,    eqLow: 1,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -24, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.7,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 2,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.55, compThreshold: -20, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Neo-Soul ──
    // RULES: Even warmer and more organic than R&B. Jazz-influenced chords
    // are wider (0.75) with warm mid emphasis. Bass is organic, walking-style
    // with warmth. Less sub-bass emphasis than modern R&B. Drums have that
    // human, slightly loose feel — less compression. Everything is warm, lush,
    // and organic. Very gentle compression throughout.
    neo_soul: {
        drums:  { volumeDb: -1, pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 0,  stereoWidth: 0.55, compThreshold: -26, compRatio: 2   },
        chords: { volumeDb: 1,  pan: 0,    eqLow: -1, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.75, compThreshold: -26, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -2, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: -2, stereoWidth: 0.0,  compThreshold: -22, compRatio: 2.5 },
    },

    // ════════════════════════════════════════════════════════════
    // JAZZ & FUNK
    // ════════════════════════════════════════════════════════════

    // ── Jazz ──
    // RULES: Natural, acoustic-sounding mix. Minimal compression — preserve
    // the full dynamic range of live performance. Drums sit back, supporting
    // the ensemble. Walking bass is warm with mid presence. Piano/chord comping
    // is natural width. Melody (sax/trumpet/piano solo) is slightly forward.
    // Everything sounds like a room, not a studio.
    jazz: {
        drums:  { volumeDb: -1, pan: 0,    eqLow: 0,  eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -26, compRatio: 2   },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.65, compThreshold: -26, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: -2, stereoWidth: 0.0,  compThreshold: -22, compRatio: 2.5 },
    },

    // ── Bebop ──
    // RULES: Fast, virtuosic jazz — drums are more prominent than in standard
    // jazz because of the fast ride cymbal patterns. Snappy, articulate drums
    // with boosted highs for cymbal clarity. Walking bass is rapid and needs
    // mid-range articulation. Solo melody is very forward — it's a showcase.
    // Slightly more compression than standard jazz for fast passages.
    bebop: {
        drums:  { volumeDb: 0,  pan: 0,    eqLow: 0,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -24, compRatio: 2.5 },
        chords: { volumeDb: -1, pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -26, compRatio: 2   },
        melody: { volumeDb: 2,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -22, compRatio: 2.5 },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: -1, stereoWidth: 0.0,  compThreshold: -22, compRatio: 2.5 },
    },

    // ── Fusion ──
    // RULES: Electric, funky jazz hybrid. Bass is more prominent — slap bass
    // technique needs mid/high articulation. Drums are funkier with more kick
    // and snare presence. Wider stereo field than traditional jazz. Electric
    // keyboards/chords get more presence. More compressed for rock/funk energy.
    fusion: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.7,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2.5 },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: 1,  eqHigh: -1, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Neo-Jazz ──
    // RULES: Modern jazz with electronic/soul influences. Warmer than
    // traditional jazz with more sub-bass presence. Wider stereo field.
    // Neo-soul groove influence — slightly more compression. Chords are
    // lush and modern. Melody sits comfortably, not as forward as bebop.
    neo_jazz: {
        drums:  { volumeDb: 0,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -24, compRatio: 2   },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.7,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -2, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 3,  eqMid: 1,  eqHigh: -2, stereoWidth: 0.0,  compThreshold: -22, compRatio: 2.5 },
    },

    // ── Funk ──
    // RULES: Groove is everything. Bass is prominent with slap technique needing
    // mid/high articulation (+1dB mid, +3dB low). Drums are punchy and tight
    // with emphasis on the snare backbeat. Chord stabs are rhythmic, not sustained
    // — mid-focused. Everything is tight, compressed, and in-the-pocket.
    funk: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 3   },
        chords: { volumeDb: -1, pan: 0,    eqLow: -2, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.65, compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: 1,  eqHigh: -2, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3   },
    },

    // ════════════════════════════════════════════════════════════
    // ROCK & METAL
    // ════════════════════════════════════════════════════════════

    // ── Alternative Rock ──
    // RULES: Guitar-driven — chords (guitars) are wide (0.8) and mid-forward
    // for that wall of sound. Drums are punchy with good kick and snare presence.
    // Melody is angular, mid-focused. Bass is driving, supporting the guitars.
    // More compressed than indie but less than metal. Balanced, energetic mix.
    alt_rock: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -18, compRatio: 3.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.8,  compThreshold: -20, compRatio: 2.5 },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -20, compRatio: 2.5 },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: 1,  eqHigh: -2, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ── Progressive Rock ──
    // RULES: Complex arrangements with dynamic builds. Wider stereo field than
    // alt rock. Chords are varied (keys, guitars) — very wide (0.85). Bass is
    // more articulate with mid presence. Melody is progressive — mid-focused
    // leads. Less compression to preserve dynamic contrast between soft and
    // loud passages. More headroom.
    prog_rock: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.85, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 3,  eqMid: 1,  eqHigh: -1, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Metalcore ──
    // RULES: Maximum aggression. Drums are extremely loud and compressed for
    // blast beats and double kicks. Guitars (chords) are very wide (0.85) for
    // massive wall of distortion — heavy mid boost for crunch. Bass is tight
    // and heavy with lots of low end. Melody (leads/screams) cut through with
    // mid presence. Everything is loud and compressed.
    metal: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 2,  eqMid: 2,  eqHigh: 3,  stereoWidth: 0.5,  compThreshold: -16, compRatio: 4   },
        chords: { volumeDb: 1,  pan: 0,    eqLow: 0,  eqMid: 3,  eqHigh: 1,  stereoWidth: 0.85, compThreshold: -18, compRatio: 3   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -18, compRatio: 3   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 4,  eqMid: 1,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -16, compRatio: 4   },
    },

    // ════════════════════════════════════════════════════════════
    // WORLD & LATIN
    // ════════════════════════════════════════════════════════════

    // ── Latin ──
    // RULES: Rhythm-forward with passionate melodies. Percussion is prominent
    // and wide (0.6) for layered congas/timbales/claves. Bass uses tumbao
    // pattern — rhythmic and articulate with mid presence. Melodic instruments
    // are bright and expressive. Harmonic minor/Phrygian chord influence.
    // Moderate compression — preserve dynamic rhythmic feel.
    latin: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -20, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Reggaeton ──
    // RULES: Dembow rhythm is the signature — heavy, prominent drums with that
    // characteristic boom-ch-boom-chick pattern. Bass is heavier than regular
    // Latin — more sub emphasis. Drums tighter and more aggressive compression
    // for club impact. Melody is passionate but sits behind the rhythm. Bass
    // forced mono for club system compatibility.
    reggaeton: {
        drums:  { volumeDb: 3,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -18, compRatio: 3   },
        chords: { volumeDb: -1, pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.65, compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2.5 },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 4,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3.5 },
    },

    // ── Reggae ──
    // RULES: Offbeat emphasis — chords are actually more prominent than in most
    // genres because the skank/offbeat guitar IS the rhythm. Bass is deep and
    // heavy — roots bass is the foundation (+3dB low). Drums are laid-back with
    // one-drop kick pattern. Melody (vocals/lead) is centered and clear.
    // Relaxed compression. Wide chords for the offbeat groove.
    reggae: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 1,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.5,  compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: 1,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 1,  stereoWidth: 0.55, compThreshold: -24, compRatio: 2   },
        bass:   { volumeDb: 2,  pan: 0,    eqLow: 3,  eqMid: 0,  eqHigh: -4, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3   },
    },

    // ── Dancehall ──
    // RULES: More aggressive and bass-heavy than reggae. Riddim drums are
    // tighter and more electronic-sounding. Heavy bass for sound system culture.
    // More compressed drums for impact. Bouncy groove with more high-end energy
    // than roots reggae. Bass is deeper and more prominent.
    dancehall: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.5,  compThreshold: -18, compRatio: 3   },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2.5 },
        bass:   { volumeDb: 3,  pan: 0,    eqLow: 4,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -16, compRatio: 3.5 },
    },

    // ── Afrobeat ──
    // RULES: Polyrhythmic percussion is central — drums are wide (0.65) to
    // accommodate layered patterns. Groovy bass with mid presence for
    // articulation. Melody is polyrhythmic, sitting wider. Warm, organic
    // sound throughout. Less aggressive compression to preserve polyrhythmic
    // interplay. Bright highs for percussion sparkle.
    afrobeat: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.65, compThreshold: -20, compRatio: 2.5 },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Amapiano ──
    // RULES: Log-drum melody is the signature — melody gets boosted (+1dB) with
    // warm mids for that distinctive log-drum tone. Deep bass similar to deep
    // house. Drums have a bouncy feel — slightly wider for shaker/percussion
    // layers. Less bright than afrobeat — warmer overall. Chords are subtle
    // background pads.
    amapiano: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: -2, pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.7,  compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -2, eqMid: 3,  eqHigh: 1,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 4,  eqMid: -1, eqHigh: -4, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ════════════════════════════════════════════════════════════
    // RETRO & ELECTRONIC
    // ════════════════════════════════════════════════════════════

    // ── Synthwave ──
    // RULES: Retro 80s synth aesthetic. Lush synth pads/chords are very wide
    // (0.85) — the defining characteristic. Retro lead melody is bright and
    // prominent. Synth bass is warm with analog character. Drums are retro-
    // style, not dominant. Bright overall with that 80s sheen. Moderate
    // compression for clean, polished retro sound.
    synthwave: {
        drums:  { volumeDb: 0,  pan: 0,    eqLow: 1,  eqMid: 0,  eqHigh: 2,  stereoWidth: 0.55, compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: 1,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 3,  stereoWidth: 0.85, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 3,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -20, compRatio: 3   },
    },

    // ── Vaporwave ──
    // RULES: Slowed-down, hazy, lo-fi aesthetic. Everything is deliberately
    // dulled — reduced highs across the board for that VHS/tape warble feel.
    // Drums are very recessed. Chopped melody samples are the focus — warm
    // mids, no brightness. Bass is smooth and subtle. Wide, dreamy stereo
    // field. Very gentle compression — the imperfections are the point.
    vaporwave: {
        drums:  { volumeDb: -2, pan: 0,    eqLow: 1,  eqMid: 0,  eqHigh: -2, stereoWidth: 0.6,  compThreshold: -26, compRatio: 2   },
        chords: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: -1, stereoWidth: 0.8,  compThreshold: -26, compRatio: 1.5 },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -2, eqMid: 2,  eqHigh: -1, stereoWidth: 0.75, compThreshold: -26, compRatio: 2   },
        bass:   { volumeDb: -1, pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.1,  compThreshold: -24, compRatio: 2   },
    },

    // ── Ambient ──
    // RULES: Atmospheric, no drums emphasis. Pad/chord layers dominate — very
    // wide (0.9) for immersive spatial feel. Melody is floating, ethereal.
    // Bass is droning, not rhythmic — slight stereo allowance (0.1) for spatial
    // depth. Minimal compression — preserve all the subtle dynamics and
    // textural detail. Drums (if present) are barely there.
    ambient: {
        drums:  { volumeDb: -3, pan: 0,    eqLow: 0,  eqMid: 0,  eqHigh: 1,  stereoWidth: 0.7,  compThreshold: -28, compRatio: 2   },
        chords: { volumeDb: 1,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.9,  compThreshold: -28, compRatio: 1.5 },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 2,  stereoWidth: 0.8,  compThreshold: -26, compRatio: 1.5 },
        bass:   { volumeDb: -1, pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: -2, stereoWidth: 0.1,  compThreshold: -24, compRatio: 2   },
    },

    // ── IDM (Intelligent Dance Music) ──
    // RULES: Experimental and glitchy. Drums use unconventional patterns —
    // widened for spatial interest. Bass is complex and unpredictable. Melody
    // is experimental with unusual timbres. Wider stereo field throughout.
    // Less conventional EQ — more flat/neutral since the music itself is
    // unconventional. Moderate compression.
    idm: {
        drums:  { volumeDb: 1,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.65, compThreshold: -22, compRatio: 2.5 },
        chords: { volumeDb: -1, pan: 0,    eqLow: -2, eqMid: 1,  eqHigh: 1,  stereoWidth: 0.75, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -3, eqMid: 2,  eqHigh: 2,  stereoWidth: 0.7,  compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 3,  eqMid: 0,  eqHigh: -2, stereoWidth: 0.15, compThreshold: -20, compRatio: 3   },
    },

    // ════════════════════════════════════════════════════════════
    // CINEMATIC & GAME
    // ════════════════════════════════════════════════════════════

    // ── Trailer Music ──
    // RULES: Epic, massive, and wide. Everything builds to huge climaxes.
    // Drums (taikos, impacts) are very prominent with big low-end boom.
    // Orchestral chords are extremely wide (0.9) for cinematic scope. Melody
    // is epic — bright and soaring. Bass is deep drone for foundation.
    // Moderate compression to preserve dynamic peaks (the hit matters).
    trailer_music: {
        drums:  { volumeDb: 2,  pan: 0,    eqLow: 3,  eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -20, compRatio: 3   },
        chords: { volumeDb: 1,  pan: 0,    eqLow: 0,  eqMid: 1,  eqHigh: 2,  stereoWidth: 0.9,  compThreshold: -22, compRatio: 2   },
        melody: { volumeDb: 1,  pan: 0,    eqLow: -2, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.7,  compThreshold: -20, compRatio: 2.5 },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 4,  eqMid: 0,  eqHigh: -3, stereoWidth: 0.0,  compThreshold: -18, compRatio: 3   },
    },

    // ── Horror Score ──
    // RULES: Dark, sparse, and unsettling. Bass drones are deep and menacing
    // with heavy sub (+4dB low). Drums are sparse — barely present, only
    // occasional impacts. Dissonant melody textures are wide for spatial
    // unease. Chords are dark — boosted low mids for ominous weight. Very
    // little brightness — highs are cut for darkness. Minimal compression
    // to preserve sudden dynamic scares.
    horror_score: {
        drums:  { volumeDb: -1, pan: 0,    eqLow: 2,  eqMid: 0,  eqHigh: -1, stereoWidth: 0.6,  compThreshold: -26, compRatio: 2   },
        chords: { volumeDb: 1,  pan: 0,    eqLow: 1,  eqMid: 2,  eqHigh: -1, stereoWidth: 0.85, compThreshold: -26, compRatio: 1.5 },
        melody: { volumeDb: 0,  pan: 0,    eqLow: -1, eqMid: 1,  eqHigh: 0,  stereoWidth: 0.8,  compThreshold: -26, compRatio: 1.5 },
        bass:   { volumeDb: 1,  pan: 0,    eqLow: 4,  eqMid: 1,  eqHigh: -4, stereoWidth: 0.1,  compThreshold: -22, compRatio: 2.5 },
    },

    // ── Fantasy RPG ──
    // RULES: Warm, orchestral, and adventurous. Lush string/pad chords are
    // wide (0.85) for that epic fantasy scope. Melody is the hero theme —
    // bright and forward. Drums are moderate (orchestral percussion). Bass
    // is warm and supportive. Overall warm mid-range for that "golden hour"
    // fantasy feel. Less sub-bass than horror/trailer — warmer balance.
    fantasy_rpg: {
        drums:  { volumeDb: 0,  pan: 0,    eqLow: 1,  eqMid: 1,  eqHigh: 1,  stereoWidth: 0.6,  compThreshold: -24, compRatio: 2   },
        chords: { volumeDb: 1,  pan: 0,    eqLow: 0,  eqMid: 2,  eqHigh: 2,  stereoWidth: 0.85, compThreshold: -24, compRatio: 2   },
        melody: { volumeDb: 2,  pan: 0,    eqLow: -2, eqMid: 2,  eqHigh: 3,  stereoWidth: 0.65, compThreshold: -22, compRatio: 2   },
        bass:   { volumeDb: 0,  pan: 0,    eqLow: 2,  eqMid: 1,  eqHigh: -2, stereoWidth: 0.0,  compThreshold: -22, compRatio: 2.5 },
    },
};

// ────────────────────────────────────────────────────────────────
// Genre name → profile key mapping
// ────────────────────────────────────────────────────────────────

const GENRE_TO_PROFILE = {
    // Hip-Hop & Trap
    'Hip Hop':            'hiphop',
    'Trap':               'trap',
    'Drill':              'drill',
    'Boom Bap':           'boom_bap',
    'Lo-Fi':              'lofi',
    'Cloud Rap':          'cloud_rap',
    'Phonk':              'phonk',

    // House
    'House':              'house',
    'Deep House':         'deep_house',
    'Tech House':         'tech_house',
    'Progressive House':  'progressive_house',
    'Afro House':         'afro_house',

    // Techno
    'Techno':             'techno',
    'Minimal Techno':     'minimal_techno',
    'Detroit Techno':     'detroit_techno',
    'Industrial Techno':  'industrial_techno',

    // Trance
    'Trance':             'trance',
    'Psytrance':          'psytrance',
    'Uplifting Trance':   'uplifting_trance',
    'Progressive Trance': 'progressive_trance',

    // Bass Music
    'Dubstep':            'dubstep',
    'Drum & Bass':        'dnb',
    'Neurofunk':          'neurofunk',
    'Future Bass':        'future_bass',

    // Pop & R&B
    'Contemporary Pop':   'pop',
    'K-Pop':              'kpop',
    'Indie Pop':          'indie_pop',
    'R&B':                'rnb',
    'Neo-Soul':           'neo_soul',

    // Jazz & Funk
    'Jazz':               'jazz',
    'Bebop':              'bebop',
    'Fusion':             'fusion',
    'Neo-Jazz':           'neo_jazz',
    'Funk':               'funk',

    // Rock & Metal
    'Alternative Rock':   'alt_rock',
    'Progressive Rock':   'prog_rock',
    'Metalcore':          'metal',

    // World & Latin
    'Latin':              'latin',
    'Reggaeton':          'reggaeton',
    'Reggae':             'reggae',
    'Dancehall':          'dancehall',
    'Afrobeat':           'afrobeat',
    'Amapiano':           'amapiano',

    // Retro & Electronic
    'Synthwave':          'synthwave',
    'Vaporwave':          'vaporwave',
    'Ambient':            'ambient',
    'IDM':                'idm',

    // Cinematic & Game
    'Trailer Music':      'trailer_music',
    'Horror Score':       'horror_score',
    'Fantasy RPG':        'fantasy_rpg',
};

// ────────────────────────────────────────────────────────────────
// Neutral defaults (no change from SamplerEngine init)
// ────────────────────────────────────────────────────────────────

const NEUTRAL = {
    volumeDb: 0,
    pan: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    stereoWidth: 0.5,
    compThreshold: -24,
    compRatio: 2,
};

const TRACK_IDS = ['drums', 'chords', 'melody', 'bass'];

/** Tag placed on effects created by the adaptive mix engine so we can remove them on reset */
const ADAPTIVE_MIX_TAG = '__adaptiveMix';

// ────────────────────────────────────────────────────────────────
// Mood EQ modifiers — applied on top of genre profile
// ────────────────────────────────────────────────────────────────

const MOOD_EQ_MODIFIERS = {
    // Original 6
    Dark:        { eqLowAdj: 1.0,  eqMidAdj: 0,    eqHighAdj: -1.5, compThresholdAdj: 0,   compRatioAdj: 0,    widthAdj: 0     },
    Happy:       { eqLowAdj: 0,    eqMidAdj: 0.5,  eqHighAdj: 1.0,  compThresholdAdj: 0,   compRatioAdj: 0,    widthAdj: 0     },
    Sad:         { eqLowAdj: 0,    eqMidAdj: 1.0,  eqHighAdj: -0.5, compThresholdAdj: 2,   compRatioAdj: -0.5, widthAdj: 0     },
    Energetic:   { eqLowAdj: 0.5,  eqMidAdj: 0,    eqHighAdj: 1.5,  compThresholdAdj: -2,  compRatioAdj: 0.5,  widthAdj: 0     },
    Mystical:    { eqLowAdj: 0,    eqMidAdj: 0.5,  eqHighAdj: 1.0,  compThresholdAdj: 2,   compRatioAdj: 0,    widthAdj: 0.1   },
    Exotic:      { eqLowAdj: 0,    eqMidAdj: 1.0,  eqHighAdj: 0,    compThresholdAdj: 0,   compRatioAdj: 0,    widthAdj: 0.05  },
    // Extended emotional moods
    Euphoric:    { eqLowAdj: 0.5,  eqMidAdj: 0.5,  eqHighAdj: 2.0,  compThresholdAdj: -2,  compRatioAdj: 0.5,  widthAdj: 0.1   },
    Melancholic: { eqLowAdj: 0.5,  eqMidAdj: 1.0,  eqHighAdj: -1.0, compThresholdAdj: 2,   compRatioAdj: -0.5, widthAdj: 0.05  },
    Aggressive:  { eqLowAdj: 1.0,  eqMidAdj: 1.0,  eqHighAdj: 1.0,  compThresholdAdj: -3,  compRatioAdj: 1.0,  widthAdj: 0     },
    Dreamy:      { eqLowAdj: -0.5, eqMidAdj: 0,    eqHighAdj: 1.5,  compThresholdAdj: 3,   compRatioAdj: -0.5, widthAdj: 0.15  },
    Mysterious:  { eqLowAdj: 0.5,  eqMidAdj: 0.5,  eqHighAdj: -0.5, compThresholdAdj: 2,   compRatioAdj: 0,    widthAdj: 0.1   },
    Uplifting:   { eqLowAdj: 0,    eqMidAdj: 0.5,  eqHighAdj: 1.5,  compThresholdAdj: -1,  compRatioAdj: 0,    widthAdj: 0.05  },
    Tense:       { eqLowAdj: 0.5,  eqMidAdj: 1.0,  eqHighAdj: 0.5,  compThresholdAdj: -2,  compRatioAdj: 0.5,  widthAdj: -0.05 },
    Nostalgic:   { eqLowAdj: 0.5,  eqMidAdj: 0.5,  eqHighAdj: -1.0, compThresholdAdj: 1,   compRatioAdj: 0,    widthAdj: 0.05  },
};

// ────────────────────────────────────────────────────────────────
// Compressor attack/release by genre character
// ────────────────────────────────────────────────────────────────

const FAST_GENRES = new Set([
    'trap', 'drill', 'techno', 'industrial_techno', 'dnb', 'neurofunk',
    'metal', 'dubstep', 'phonk', 'tech_house', 'psytrance',
]);
const SMOOTH_GENRES = new Set([
    'jazz', 'bebop', 'neo_jazz', 'lofi', 'ambient', 'neo_soul',
    'vaporwave', 'horror_score', 'fantasy_rpg',
]);

function getCompressorTimings(profileKey) {
    if (FAST_GENRES.has(profileKey))   return { attack: 0.002, release: 0.15 };
    if (SMOOTH_GENRES.has(profileKey)) return { attack: 0.015, release: 0.40 };
    return { attack: 0.005, release: 0.25 }; // standard
}

// ────────────────────────────────────────────────────────────────
// Genre-specific character effects — added on top of EQ/Comp/Width
// ────────────────────────────────────────────────────────────────

const GENRE_CHARACTER_EFFECTS = {
    trap:    { drums: [{ type: 'Saturation', params: { drive: 0.2, mode: 'tape', toneFreq: 4000, mix: 0.25 } }] },
    drill:   { drums: [{ type: 'Saturation', params: { drive: 0.25, mode: 'tape', toneFreq: 3500, mix: 0.3 } }] },
    phonk:   {
        drums: [{ type: 'Saturation', params: { drive: 0.4, mode: 'tape', toneFreq: 3000, mix: 0.4 } }],
        bass:  [{ type: 'Saturation', params: { drive: 0.3, mode: 'tube', toneFreq: 1500, mix: 0.3 } }],
    },
    lofi: {
        drums:  [{ type: 'Tape', params: { speed: 0.5, flutter: 0.3, noise: 0.1, mix: 0.45 } }],
        chords: [{ type: 'Chorus', params: { rate: 0.3, depth: 0.35, mix: 0.2 } }],
        melody: [{ type: 'Tape', params: { speed: 0.4, flutter: 0.25, noise: 0.08, mix: 0.35 } }],
    },
    vaporwave: {
        chords: [{ type: 'Chorus', params: { rate: 0.2, depth: 0.4, mix: 0.25 } }],
        melody: [{ type: 'Chorus', params: { rate: 0.25, depth: 0.35, mix: 0.2 } }],
    },
    cloud_rap: {
        melody: [{ type: 'Reverb', params: { decay: 3.0, damping: 0.4, mix: 0.35 } }],
        chords: [{ type: 'Reverb', params: { decay: 2.5, damping: 0.5, mix: 0.3 } }],
    },
    house: {
        chords: [{ type: 'Reverb', params: { decay: 2.0, damping: 0.5, mix: 0.2 } }],
    },
    deep_house: {
        chords: [{ type: 'Reverb', params: { decay: 2.5, damping: 0.45, mix: 0.25 } }],
    },
    progressive_house: {
        chords: [{ type: 'Reverb', params: { decay: 3.0, damping: 0.4, mix: 0.3 } }],
        melody: [{ type: 'Reverb', params: { decay: 2.0, damping: 0.5, mix: 0.2 } }],
    },
    trance: {
        chords: [{ type: 'Reverb', params: { decay: 2.5, damping: 0.4, mix: 0.25 } }],
        melody: [{ type: 'Reverb', params: { decay: 1.8, damping: 0.5, mix: 0.2 } }],
    },
    uplifting_trance: {
        chords: [{ type: 'Reverb', params: { decay: 3.0, damping: 0.35, mix: 0.3 } }],
        melody: [{ type: 'Reverb', params: { decay: 2.0, damping: 0.4, mix: 0.25 } }],
    },
    dubstep: {
        bass: [{ type: 'Distortion', params: { gain: 0.3, mode: 'softClip', toneFreq: 2000, mix: 0.25 } }],
    },
    neurofunk: {
        bass: [{ type: 'Distortion', params: { gain: 0.35, mode: 'softClip', toneFreq: 2500, mix: 0.3 } }],
    },
    synthwave: {
        chords: [{ type: 'Chorus', params: { rate: 0.5, depth: 0.5, mix: 0.3 } }],
        melody: [{ type: 'Reverb', params: { decay: 1.8, damping: 0.5, mix: 0.2 } }],
    },
    ambient: {
        chords: [{ type: 'Reverb', params: { decay: 4.0, damping: 0.3, mix: 0.4 } }],
        melody: [{ type: 'Reverb', params: { decay: 3.5, damping: 0.35, mix: 0.35 } }],
    },
    boom_bap: {
        drums: [{ type: 'Saturation', params: { drive: 0.15, mode: 'tape', toneFreq: 5000, mix: 0.2 } }],
    },
    industrial_techno: {
        drums: [{ type: 'Distortion', params: { gain: 0.25, mode: 'hardClip', toneFreq: 4000, mix: 0.2 } }],
        bass:  [{ type: 'Distortion', params: { gain: 0.3, mode: 'softClip', toneFreq: 1500, mix: 0.25 } }],
    },
    trailer_music: {
        chords: [{ type: 'Reverb', params: { decay: 3.5, damping: 0.3, mix: 0.35 } }],
        melody: [{ type: 'Reverb', params: { decay: 2.5, damping: 0.4, mix: 0.25 } }],
    },
    horror_score: {
        chords: [{ type: 'Reverb', params: { decay: 4.5, damping: 0.25, mix: 0.45 } }],
        melody: [{ type: 'Reverb', params: { decay: 3.5, damping: 0.3, mix: 0.35 } }],
    },
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/** Convert dB to linear gain */
function dbToGain(db) {
    return Math.pow(10, db / 20);
}

/** Compute RMS from a Uint8Array of time-domain data (0-255 unsigned) */
function computeRMS(timeDomainData) {
    let sum = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
        const sample = (timeDomainData[i] - 128) / 128; // normalize to -1..1
        sum += sample * sample;
    }
    return Math.sqrt(sum / timeDomainData.length);
}

/** Compute peak level from time-domain data */
function computePeak(timeDomainData) {
    let peak = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
        const abs = Math.abs((timeDomainData[i] - 128) / 128);
        if (abs > peak) peak = abs;
    }
    return peak;
}

/** Compute frequency band energies from FFT data (Uint8Array, 0-255) */
function computeSpectrum(frequencyData, sampleRate, fftSize) {
    const binCount = frequencyData.length;
    const binHz = sampleRate / fftSize;

    // Low: 20-300 Hz, Mid: 300-4000 Hz, High: 4000-20000 Hz
    let lowSum = 0, lowCount = 0;
    let midSum = 0, midCount = 0;
    let highSum = 0, highCount = 0;

    for (let i = 0; i < binCount; i++) {
        const freq = i * binHz;
        const val = frequencyData[i] / 255; // normalize 0..1
        if (freq >= 20 && freq < 300) {
            lowSum += val; lowCount++;
        } else if (freq >= 300 && freq < 4000) {
            midSum += val; midCount++;
        } else if (freq >= 4000 && freq <= 20000) {
            highSum += val; highCount++;
        }
    }

    return {
        low:  lowCount  > 0 ? lowSum  / lowCount  : 0,
        mid:  midCount  > 0 ? midSum  / midCount  : 0,
        high: highCount > 0 ? highSum / highCount : 0,
    };
}

// ────────────────────────────────────────────────────────────────
// 8-band EQ builder — modern mixing methodology per instrument
// ────────────────────────────────────────────────────────────────

/** Clamp a value to [-12, 12] (EQEight gain range) */
function clampEQ(v) { return Math.max(-12, Math.min(12, v)); }

/**
 * Build 8-band EQEight bands array for a given track type, using the
 * 3-band genre profile values (eqLow/eqMid/eqHigh) as seeds and
 * distributing them across a full parametric EQ using modern mixing
 * methodology for each instrument's frequency characteristics.
 *
 * Drums: kick sub/thump, anti-mud, snare body, snare crack, hat presence, air
 * Bass:  sub cleanup, 808 weight, mud removal, warmth, growl, attack, roll-off
 * Chords: HP cleanup, warmth, anti-box, body, clarity, sparkle, air
 * Melody: HP cleanup, low roll, body, presence, clarity, brilliance, air
 */
function buildEQBands(trackId, eqLow, eqMid, eqHigh, profileKey) {
    // Dark genres roll off top end; lo-fi/vaporwave/ambient cut brightness
    const isDark = ['lofi', 'vaporwave', 'horror_score', 'boom_bap', 'ambient'].includes(profileKey);
    const lpRolloff = isDark ? -2.0 : 0;

    switch (trackId) {
        case 'drums':
            // Kick fundamental ~60-80Hz, body ~100-200Hz, mud ~300Hz,
            // snare body ~800Hz, snare crack/clap snap ~3.5kHz,
            // hat presence ~8kHz, air/cymbal shimmer ~12kHz+
            return [
                { frequency: 30,    gain: 0,                                    Q: 0.707, type: 'highpass',  enabled: true },
                { frequency: 80,    gain: clampEQ(eqLow * 0.8),                 Q: 0.707, type: 'lowshelf',  enabled: true },
                { frequency: 300,   gain: clampEQ(-1.5 - Math.abs(eqLow * 0.2)),Q: 1.4,   type: 'peaking',   enabled: true }, // anti-mud
                { frequency: 900,   gain: clampEQ(eqMid * 0.6),                 Q: 1.2,   type: 'peaking',   enabled: true }, // snare/clap body
                { frequency: 3500,  gain: clampEQ(eqMid * 0.5 + eqHigh * 0.4), Q: 1.0,   type: 'peaking',   enabled: true }, // snare crack
                { frequency: 8000,  gain: clampEQ(eqHigh * 0.7),                Q: 0.8,   type: 'peaking',   enabled: true }, // hat presence
                { frequency: 12000, gain: clampEQ(eqHigh * 0.5),                Q: 0.707, type: 'highshelf', enabled: true }, // air
                { frequency: 18000, gain: clampEQ(lpRolloff),                    Q: 0.707, type: 'lowpass',   enabled: true },
            ];

        case 'bass':
            // Sub ~30-60Hz, 808 thump ~60-80Hz, mud ~200Hz, warmth ~500Hz,
            // growl/presence ~1.5kHz, attack ~4kHz, roll-off ~8kHz+
            return [
                { frequency: 25,    gain: 0,                                    Q: 0.707, type: 'highpass',  enabled: true },
                { frequency: 60,    gain: clampEQ(eqLow * 0.9),                 Q: 0.707, type: 'lowshelf',  enabled: true }, // sub weight
                { frequency: 200,   gain: clampEQ(-1.5 - Math.abs(eqLow * 0.15)),Q: 1.2,  type: 'peaking',   enabled: true }, // mud removal
                { frequency: 500,   gain: clampEQ(eqMid * 0.5),                 Q: 1.0,   type: 'peaking',   enabled: true }, // warmth
                { frequency: 1500,  gain: clampEQ(eqMid * 0.6),                 Q: 0.8,   type: 'peaking',   enabled: true }, // growl / presence
                { frequency: 4000,  gain: clampEQ(eqHigh * 0.3),                Q: 0.7,   type: 'peaking',   enabled: true }, // attack definition
                { frequency: 8000,  gain: clampEQ(Math.min(0, eqHigh * 0.5)),    Q: 0.707, type: 'highshelf', enabled: true }, // roll-off
                { frequency: 16000, gain: clampEQ(Math.min(0, eqHigh * 0.3 - 2)),Q: 0.707, type: 'lowpass',   enabled: true }, // kill highs
            ];

        case 'chords':
            // HP ~80Hz, warmth ~150Hz, boxiness ~400Hz, body ~1.2kHz,
            // clarity ~3kHz, sparkle ~7kHz, air ~12kHz
            return [
                { frequency: 80,    gain: 0,                                    Q: 0.707, type: 'highpass',  enabled: true },
                { frequency: 150,   gain: clampEQ(eqLow * 0.5),                 Q: 0.707, type: 'lowshelf',  enabled: true }, // warmth
                { frequency: 400,   gain: clampEQ(-1.0 + eqLow * 0.2),          Q: 1.0,   type: 'peaking',   enabled: true }, // anti-box
                { frequency: 1200,  gain: clampEQ(eqMid * 0.7),                 Q: 1.0,   type: 'peaking',   enabled: true }, // body
                { frequency: 3000,  gain: clampEQ(eqMid * 0.4 + eqHigh * 0.3),  Q: 0.8,   type: 'peaking',   enabled: true }, // clarity
                { frequency: 7000,  gain: clampEQ(eqHigh * 0.6),                Q: 0.7,   type: 'peaking',   enabled: true }, // sparkle
                { frequency: 12000, gain: clampEQ(eqHigh * 0.5),                Q: 0.707, type: 'highshelf', enabled: true }, // air
                { frequency: 18000, gain: clampEQ(lpRolloff),                    Q: 0.707, type: 'lowpass',   enabled: true },
            ];

        case 'melody':
            // HP ~120Hz, low cleanup ~200Hz, body ~500Hz, presence ~2kHz,
            // clarity ~4kHz, brilliance ~8kHz, air ~12kHz
            return [
                { frequency: 120,   gain: 0,                                    Q: 0.707, type: 'highpass',  enabled: true },
                { frequency: 200,   gain: clampEQ(eqLow * 0.4),                 Q: 0.707, type: 'lowshelf',  enabled: true }, // low cleanup
                { frequency: 500,   gain: clampEQ(eqMid * 0.3),                 Q: 1.0,   type: 'peaking',   enabled: true }, // body
                { frequency: 2000,  gain: clampEQ(eqMid * 0.7),                 Q: 0.9,   type: 'peaking',   enabled: true }, // presence
                { frequency: 4000,  gain: clampEQ(eqMid * 0.3 + eqHigh * 0.5),  Q: 0.8,   type: 'peaking',   enabled: true }, // clarity
                { frequency: 8000,  gain: clampEQ(eqHigh * 0.6),                Q: 0.7,   type: 'peaking',   enabled: true }, // brilliance
                { frequency: 12000, gain: clampEQ(eqHigh * 0.5),                Q: 0.707, type: 'highshelf', enabled: true }, // air
                { frequency: 18000, gain: clampEQ(lpRolloff),                    Q: 0.707, type: 'lowpass',   enabled: true },
            ];

        default:
            // Generic fallback
            return [
                { frequency: 30,    gain: 0,                      Q: 0.707, type: 'highpass',  enabled: true },
                { frequency: 100,   gain: clampEQ(eqLow * 0.6),   Q: 0.707, type: 'lowshelf',  enabled: true },
                { frequency: 250,   gain: clampEQ(eqLow * 0.3),   Q: 1.0,   type: 'peaking',   enabled: true },
                { frequency: 1000,  gain: clampEQ(eqMid * 0.7),   Q: 1.0,   type: 'peaking',   enabled: true },
                { frequency: 3000,  gain: clampEQ(eqMid * 0.5),   Q: 1.0,   type: 'peaking',   enabled: true },
                { frequency: 8000,  gain: clampEQ(eqHigh * 0.6),  Q: 1.0,   type: 'peaking',   enabled: true },
                { frequency: 12000, gain: clampEQ(eqHigh * 0.4),  Q: 0.707, type: 'highshelf', enabled: true },
                { frequency: 18000, gain: 0,                       Q: 0.707, type: 'lowpass',   enabled: true },
            ];
    }
}

// ────────────────────────────────────────────────────────────────
// AdaptiveMixEngine
// ────────────────────────────────────────────────────────────────

export class AdaptiveMixEngine {
    constructor() {
        this._lastAnalysis = null;
        this._appliedSettings = null;
        this._effectsApplied = false;   // true when real effects have been added via EffectsManager
        // Legacy inline DSP nodes (fallback when no effectsManager)
        this._trackEQNodes = {};
        this._trackCompressors = {};
        this._trackWideners = {};
        this._initialized = false;
    }

    // ────────────────────────────────────────────────────
    // Analysis
    // ────────────────────────────────────────────────────

    /**
     * Analyze the current mix state from SamplerEngine track buses.
     * Reads analyser nodes to compute RMS, peak, and spectral data per track.
     *
     * @param {SamplerEngine} samplerEngine
     * @returns {{ [trackId]: { rms, peak, spectrum: { low, mid, high } } }}
     */
    analyzeMix(samplerEngine) {
        const ctx = samplerEngine.audioContext;
        const sampleRate = ctx.sampleRate;
        const analysis = {};

        for (const trackId of TRACK_IDS) {
            const bus = samplerEngine.getTrackBus(trackId);
            if (!bus || !bus.analyserNode) {
                analysis[trackId] = { rms: 0, peak: 0, spectrum: { low: 0, mid: 0, high: 0 } };
                continue;
            }

            const analyser = bus.analyserNode;
            const fftSize = analyser.fftSize;
            const timeDomain = new Uint8Array(analyser.fftSize);
            const freqData = new Uint8Array(analyser.frequencyBinCount);

            analyser.getByteTimeDomainData(timeDomain);
            analyser.getByteFrequencyData(freqData);

            analysis[trackId] = {
                rms: computeRMS(timeDomain),
                peak: computePeak(timeDomain),
                spectrum: computeSpectrum(freqData, sampleRate, fftSize),
            };
        }

        // Master analysis
        if (samplerEngine.masterAnalyser) {
            const ma = samplerEngine.masterAnalyser;
            const timeDomain = new Uint8Array(ma.fftSize);
            const freqData = new Uint8Array(ma.frequencyBinCount);
            ma.getByteTimeDomainData(timeDomain);
            ma.getByteFrequencyData(freqData);
            analysis.master = {
                rms: computeRMS(timeDomain),
                peak: computePeak(timeDomain),
                spectrum: computeSpectrum(freqData, sampleRate, ma.fftSize),
            };
        }

        this._lastAnalysis = analysis;
        return analysis;
    }

    /**
     * @returns {object|null} Last analysis snapshot
     */
    getLastAnalysis() {
        return this._lastAnalysis;
    }

    // ────────────────────────────────────────────────────
    // EffectsManager integration
    // ────────────────────────────────────────────────────

    /**
     * Remove all effects previously added by the adaptive mix engine
     * from every track chain in the EffectsManager.
     */
    _removeAdaptiveEffects(effectsManager) {
        for (const trackId of TRACK_IDS) {
            const chain = effectsManager.getTrackChain(trackId);
            if (!chain) continue;
            // Iterate backwards so splice indices stay valid
            for (let i = chain.effects.length - 1; i >= 0; i--) {
                if (chain.effects[i]._adaptiveMixTag === ADAPTIVE_MIX_TAG) {
                    chain.removeEffect(chain.effects[i].id);
                }
            }
        }
    }

    /**
     * Create and tag an AudioEffect instance for the adaptive mix system.
     * @param {string} type — registered effect type name
     * @param {object} [params] — initial params
     * @returns {AudioEffect}
     */
    _createTaggedEffect(type, params) {
        try {
            const fx = AudioEffect.create(type, params);
            fx._adaptiveMixTag = ADAPTIVE_MIX_TAG;
            return fx;
        } catch (e) {
            // Effect type not registered (e.g., Tape/Chorus not available) — skip gracefully
            return null;
        }
    }

    /**
     * Apply spectral correction to EQ values based on live analysis.
     * Nudges EQ bands to compensate for frequency imbalances.
     */
    _applySpectralCorrection(trackAnalysis, eqLow, eqMid, eqHigh) {
        let lo = eqLow, mi = eqMid, hi = eqHigh;
        if (trackAnalysis.rms > 0.01) {
            const spec = trackAnalysis.spectrum;
            const avg = (spec.low + spec.mid + spec.high) / 3;
            if (avg > 0.01) {
                if (spec.low > avg * 1.5) lo -= 1;
                if (spec.mid > avg * 1.5) mi -= 1;
                if (spec.high > avg * 1.5) hi -= 1;
                if (spec.low < avg * 0.5) lo += 1;
                if (spec.mid < avg * 0.5) mi += 1;
                if (spec.high < avg * 0.5) hi += 1;
            }
        }
        return {
            eqLow: Math.max(-8, Math.min(8, lo)),
            eqMid: Math.max(-8, Math.min(8, mi)),
            eqHigh: Math.max(-8, Math.min(8, hi)),
        };
    }

    // ────────────────────────────────────────────────────
    // Apply Adaptive Mix
    // ────────────────────────────────────────────────────

    /**
     * Apply genre-aware mix adjustments to all tracks.
     *
     * When effectsManager is provided, real EQEight / Compressor /
     * StereoWidener / character effects are added to each track's
     * EffectsChain so they appear in the DetailPanel with adjustable
     * knobs set to modern-mixing values for the genre, mood, and
     * instrument type.
     *
     * When effectsManager is omitted, falls back to inline DSP nodes
     * (invisible in the UI but still audible).
     *
     * @param {SamplerEngine} samplerEngine
     * @param {object} genreDNA - Must include at minimum { genre: string }.
     *   Optionally { mood, drumPattern, bassStyle, ... } from GENRE_DEFINITIONS.
     * @param {EffectsManager} [effectsManager] - Optional. When provided, adds
     *   real AudioEffect instances visible in the DetailPanel.
     * @returns {{ profile: string, adjustments: object }}
     */
    applyAdaptiveMix(samplerEngine, genreDNA, effectsManager) {
        const genre = genreDNA?.genre || genreDNA?.name || '';
        const mood = genreDNA?.mood || '';
        const profileKey = GENRE_TO_PROFILE[genre] || this._inferProfile(genreDNA);
        const profile = GENRE_MIX_PROFILES[profileKey] || GENRE_MIX_PROFILES.hiphop;

        // Run analysis to inform spectral correction
        const analysis = this.analyzeMix(samplerEngine);

        const ctx = samplerEngine.audioContext;
        const t = ctx.currentTime;
        const rampTime = 0.05;
        const adjustments = {};

        // Get mood modifier (if any)
        const moodMod = MOOD_EQ_MODIFIERS[mood] || null;

        // Compressor attack/release for this genre category
        const compTimings = getCompressorTimings(profileKey);

        // Genre-specific character effects
        const charFx = GENRE_CHARACTER_EFFECTS[profileKey] || {};

        // ── EffectsManager path: add real effects to tracks ──
        if (effectsManager) {
            // Remove any previously-applied adaptive mix effects first
            this._removeAdaptiveEffects(effectsManager);

            for (const trackId of TRACK_IDS) {
                const bus = samplerEngine.getTrackBus(trackId);
                if (!bus) continue;

                const settings = profile[trackId] || NEUTRAL;
                const trackAnalysis = analysis[trackId] || { rms: 0, peak: 0, spectrum: { low: 0, mid: 0, high: 0 } };

                // Apply spectral correction
                let { eqLow, eqMid, eqHigh } = this._applySpectralCorrection(
                    trackAnalysis, settings.eqLow, settings.eqMid, settings.eqHigh
                );

                // Apply mood modifiers
                if (moodMod) {
                    eqLow  = Math.max(-8, Math.min(8, eqLow + moodMod.eqLowAdj));
                    eqMid  = Math.max(-8, Math.min(8, eqMid + moodMod.eqMidAdj));
                    eqHigh = Math.max(-8, Math.min(8, eqHigh + moodMod.eqHighAdj));
                }

                const chain = effectsManager.getOrCreateTrackChain(trackId);

                // ── 1. EQ Eight — 8-band parametric, modern mixing methodology ──
                const bands = buildEQBands(trackId, eqLow, eqMid, eqHigh, profileKey);
                const eqEffect = this._createTaggedEffect('EQEight');
                if (eqEffect) {
                    eqEffect.setParams({ bands });
                    chain.addEffect(eqEffect);
                }

                // ── 2. Compressor — genre-tuned dynamics ──
                let compThresh = settings.compThreshold;
                let compRatio = settings.compRatio;
                if (moodMod) {
                    compThresh = Math.max(-60, Math.min(0, compThresh + (moodMod.compThresholdAdj || 0)));
                    compRatio = Math.max(1, Math.min(20, compRatio + (moodMod.compRatioAdj || 0)));
                }
                const compEffect = this._createTaggedEffect('Compressor', {
                    threshold: compThresh,
                    ratio: compRatio,
                    attack: compTimings.attack,
                    release: compTimings.release,
                    knee: compRatio > 3.5 ? 10 : 20, // tighter knee for aggressive compression
                    makeupGain: 0,
                });
                if (compEffect) {
                    chain.addEffect(compEffect);
                }

                // ── 3. Genre-specific character effects ──
                const trackCharFx = charFx[trackId] || [];
                for (const fxDef of trackCharFx) {
                    const fx = this._createTaggedEffect(fxDef.type, fxDef.params);
                    if (fx) chain.addEffect(fx);
                }

                // ── 4. Stereo Widener — last in chain ──
                let width = settings.stereoWidth;
                if (moodMod) {
                    width = Math.max(0, Math.min(1, width + (moodMod.widthAdj || 0)));
                }
                const swEffect = this._createTaggedEffect('StereoWidener', { width });
                if (swEffect) {
                    chain.addEffect(swEffect);
                }

                // ── Volume (direct on bus — not an effect) ──
                const baseGain = 0.30;
                const adjustedGain = baseGain * dbToGain(settings.volumeDb);
                bus.gainNode.gain.setTargetAtTime(adjustedGain, t, rampTime);

                // ── Pan (direct on bus) ──
                bus.pannerNode.pan.setTargetAtTime(settings.pan, t, rampTime);

                adjustments[trackId] = {
                    volumeDb: settings.volumeDb,
                    gain: adjustedGain,
                    pan: settings.pan,
                    eqLow,
                    eqMid,
                    eqHigh,
                    stereoWidth: width,
                    compThreshold: compThresh,
                    compRatio: compRatio,
                };
            }

            // Wire the new effects into the audio graph
            samplerEngine.syncEffectsFromManager(effectsManager);
            this._effectsApplied = true;

        } else {
            // ── Fallback: inline DSP nodes (no UI visibility) ──
            this._ensureDSPNodes(samplerEngine);

            for (const trackId of TRACK_IDS) {
                const bus = samplerEngine.getTrackBus(trackId);
                if (!bus) continue;

                const settings = profile[trackId] || NEUTRAL;
                const trackAnalysis = analysis[trackId] || { rms: 0, peak: 0, spectrum: { low: 0, mid: 0, high: 0 } };

                let { eqLow: eqLowAdj, eqMid: eqMidAdj, eqHigh: eqHighAdj } = this._applySpectralCorrection(
                    trackAnalysis, settings.eqLow, settings.eqMid, settings.eqHigh
                );

                if (moodMod) {
                    eqLowAdj  = Math.max(-8, Math.min(8, eqLowAdj + moodMod.eqLowAdj));
                    eqMidAdj  = Math.max(-8, Math.min(8, eqMidAdj + moodMod.eqMidAdj));
                    eqHighAdj = Math.max(-8, Math.min(8, eqHighAdj + moodMod.eqHighAdj));
                }

                const baseGain = 0.30;
                const adjustedGain = baseGain * dbToGain(settings.volumeDb);
                bus.gainNode.gain.setTargetAtTime(adjustedGain, t, rampTime);
                bus.pannerNode.pan.setTargetAtTime(settings.pan, t, rampTime);

                const eq = this._trackEQNodes[trackId];
                if (eq) {
                    eq.low.gain.setTargetAtTime(eqLowAdj, t, rampTime);
                    eq.mid.gain.setTargetAtTime(eqMidAdj, t, rampTime);
                    eq.high.gain.setTargetAtTime(eqHighAdj, t, rampTime);
                }

                const comp = this._trackCompressors[trackId];
                if (comp) {
                    comp.threshold.setTargetAtTime(settings.compThreshold, t, rampTime);
                    comp.ratio.setTargetAtTime(settings.compRatio, t, rampTime);
                }

                const widener = this._trackWideners[trackId];
                if (widener) {
                    const width = settings.stereoWidth;
                    widener.midLevel.gain.setTargetAtTime(1.0 - width, t, rampTime);
                    widener.sideLevel.gain.setTargetAtTime(width, t, rampTime);
                }

                adjustments[trackId] = {
                    volumeDb: settings.volumeDb,
                    gain: adjustedGain,
                    pan: settings.pan,
                    eqLow: eqLowAdj,
                    eqMid: eqMidAdj,
                    eqHigh: eqHighAdj,
                    stereoWidth: settings.stereoWidth,
                    compThreshold: settings.compThreshold,
                    compRatio: settings.compRatio,
                };
            }
        }

        this._appliedSettings = { profile: profileKey, adjustments };
        return this._appliedSettings;
    }

    /**
     * @returns {object|null} Last applied settings
     */
    getAppliedSettings() {
        return this._appliedSettings;
    }

    /**
     * Reset all tracks to neutral mix (undo adaptive mix).
     * @param {SamplerEngine} samplerEngine
     * @param {EffectsManager} [effectsManager] - When provided, removes
     *   adaptive-mix effects from chains and re-syncs.
     */
    reset(samplerEngine, effectsManager) {
        const ctx = samplerEngine.audioContext;
        const t = ctx.currentTime;
        const rampTime = 0.05;

        // Reset volume & pan on all track buses
        for (const trackId of TRACK_IDS) {
            const bus = samplerEngine.getTrackBus(trackId);
            if (!bus) continue;
            bus.gainNode.gain.setTargetAtTime(0.30, t, rampTime);
            bus.pannerNode.pan.setTargetAtTime(0, t, rampTime);
        }

        // Remove real effects if we added them
        if (effectsManager && this._effectsApplied) {
            this._removeAdaptiveEffects(effectsManager);
            samplerEngine.syncEffectsFromManager(effectsManager);
            this._effectsApplied = false;
        }

        // Reset inline DSP nodes if they were used
        if (this._initialized) {
            for (const trackId of TRACK_IDS) {
                const eq = this._trackEQNodes[trackId];
                if (eq) {
                    eq.low.gain.setTargetAtTime(0, t, rampTime);
                    eq.mid.gain.setTargetAtTime(0, t, rampTime);
                    eq.high.gain.setTargetAtTime(0, t, rampTime);
                }
                const comp = this._trackCompressors[trackId];
                if (comp) {
                    comp.threshold.setTargetAtTime(-24, t, rampTime);
                    comp.ratio.setTargetAtTime(2, t, rampTime);
                }
                const widener = this._trackWideners[trackId];
                if (widener) {
                    widener.midLevel.gain.setTargetAtTime(0.5, t, rampTime);
                    widener.sideLevel.gain.setTargetAtTime(0.5, t, rampTime);
                }
            }
        }

        this._appliedSettings = null;
    }

    // ────────────────────────────────────────────────────
    // Legacy inline DSP (fallback when no EffectsManager)
    // ────────────────────────────────────────────────────

    /**
     * Insert per-track EQ, compressor, and stereo width nodes into the
     * SamplerEngine signal chain. Idempotent — safe to call multiple times.
     * Used only when no EffectsManager is available.
     */
    _ensureDSPNodes(samplerEngine) {
        if (this._initialized) return;

        const ctx = samplerEngine.audioContext;

        for (const trackId of TRACK_IDS) {
            const bus = samplerEngine.getTrackBus(trackId);
            if (!bus) continue;

            try { bus.pannerNode.disconnect(bus.analyserNode); } catch (_) {}

            const eqLow = ctx.createBiquadFilter();
            eqLow.type = 'lowshelf';
            eqLow.frequency.value = 200;
            eqLow.gain.value = 0;

            const eqMid = ctx.createBiquadFilter();
            eqMid.type = 'peaking';
            eqMid.frequency.value = 1000;
            eqMid.Q.value = 1.0;
            eqMid.gain.value = 0;

            const eqHigh = ctx.createBiquadFilter();
            eqHigh.type = 'highshelf';
            eqHigh.frequency.value = 5000;
            eqHigh.gain.value = 0;

            this._trackEQNodes[trackId] = { low: eqLow, mid: eqMid, high: eqHigh };

            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -24;
            comp.knee.value = 20;
            comp.ratio.value = 2;
            comp.attack.value = 0.010;
            comp.release.value = 0.200;
            this._trackCompressors[trackId] = comp;

            const splitter = ctx.createChannelSplitter(2);
            const merger = ctx.createChannelMerger(2);
            const midGainL = ctx.createGain(); midGainL.gain.value = 0.5;
            const midGainR = ctx.createGain(); midGainR.gain.value = 0.5;
            const midSum = ctx.createGain();   midSum.gain.value = 1.0;
            const sideGainL = ctx.createGain(); sideGainL.gain.value = 0.5;
            const sideGainR = ctx.createGain(); sideGainR.gain.value = -0.5;
            const sideDiff = ctx.createGain();  sideDiff.gain.value = 1.0;
            const sideInvert = ctx.createGain(); sideInvert.gain.value = -1.0;

            splitter.connect(midGainL, 0);
            splitter.connect(midGainR, 1);
            midGainL.connect(midSum);
            midGainR.connect(midSum);
            splitter.connect(sideGainL, 0);
            splitter.connect(sideGainR, 1);
            sideGainL.connect(sideDiff);
            sideGainR.connect(sideDiff);
            midSum.connect(merger, 0, 0);
            midSum.connect(merger, 0, 1);
            sideDiff.connect(merger, 0, 0);
            sideDiff.connect(sideInvert);
            sideInvert.connect(merger, 0, 1);

            this._trackWideners[trackId] = { splitter, merger, midLevel: midSum, sideLevel: sideDiff };

            bus.pannerNode.connect(eqLow);
            eqLow.connect(eqMid);
            eqMid.connect(eqHigh);
            eqHigh.connect(comp);
            comp.connect(splitter);
            merger.connect(bus.analyserNode);
        }

        this._initialized = true;
    }

    /**
     * Dispose all created DSP nodes and disconnect them.
     */
    dispose() {
        for (const trackId of TRACK_IDS) {
            const eq = this._trackEQNodes[trackId];
            if (eq) {
                try { eq.low.disconnect(); } catch (_) {}
                try { eq.mid.disconnect(); } catch (_) {}
                try { eq.high.disconnect(); } catch (_) {}
            }
            const comp = this._trackCompressors[trackId];
            if (comp) {
                try { comp.disconnect(); } catch (_) {}
            }
            const w = this._trackWideners[trackId];
            if (w) {
                try { w.splitter.disconnect(); } catch (_) {}
                try { w.merger.disconnect(); } catch (_) {}
                try { w.midLevel.disconnect(); } catch (_) {}
                try { w.sideLevel.disconnect(); } catch (_) {}
            }
        }
        this._trackEQNodes = {};
        this._trackCompressors = {};
        this._trackWideners = {};
        this._initialized = false;
        this._effectsApplied = false;
        this._appliedSettings = null;
        this._lastAnalysis = null;
    }

    // ────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────

    /**
     * Infer a profile key from genreDNA fields when genre name isn't in the map.
     */
    _inferProfile(genreDNA) {
        if (!genreDNA) return 'hiphop';

        const dp = genreDNA.drumPattern || '';
        const bs = genreDNA.bassStyle || '';
        const ms = genreDNA.melodyStyle || '';
        const gs = genreDNA.grooveStyle || '';
        const cat = (genreDNA.category || '').toLowerCase();

        if (dp === 'drill') return 'drill';
        if (dp === 'trap') {
            if (ms === 'ethereal' || gs === 'floating') return 'cloud_rap';
            if (ms === 'bell' || bs === 'cowbell') return 'phonk';
            return 'trap';
        }
        if (dp === 'four_on_floor') {
            if (cat.includes('pop')) return 'pop';
            if (cat.includes('rock')) return 'alt_rock';
            if (cat.includes('techno') || cat.includes('industrial')) return 'techno';
            if (bs === 'deep') return 'deep_house';
            if (bs === 'rolling') return 'tech_house';
            if (gs === 'progressive') return 'progressive_house';
            return 'house';
        }
        if (dp === 'techno') {
            if (gs === 'minimal') return 'minimal_techno';
            if (gs === 'breakdown') return 'metal';
            if (ms === 'industrial') return 'industrial_techno';
            return 'techno';
        }
        if (dp === 'trance') {
            if (ms === 'psychedelic') return 'psytrance';
            if (ms === 'uplifting-lead' || gs === 'euphoric') return 'uplifting_trance';
            if (gs === 'progressive') return 'progressive_trance';
            return 'trance';
        }
        if (dp === 'dnb') {
            if (ms === 'dark-tech' || gs === 'technical') return 'neurofunk';
            return 'dnb';
        }
        if (dp === 'dubstep') return 'dubstep';
        if (dp === 'future_bass') return 'future_bass';
        if (dp === 'boom_bap') return 'boom_bap';
        if (dp === 'lofi') return bs === 'smooth' ? 'vaporwave' : 'lofi';
        if (dp === 'jazz') {
            if (ms === 'bebop') return 'bebop';
            if (gs === 'neo-soul') return 'neo_jazz';
            return 'jazz';
        }
        if (dp === 'funk') {
            if (cat.includes('jazz')) return 'fusion';
            return 'funk';
        }
        if (dp === 'rnb') {
            if (gs === 'neo-soul') return 'neo_soul';
            return 'rnb';
        }
        if (dp === 'reggae') return 'reggae';
        if (dp === 'reggaeton') {
            if (gs === 'dembow') return 'reggaeton';
            if (gs === 'bouncy') return 'dancehall';
            return 'reggaeton';
        }
        if (dp === 'afrobeat') {
            if (ms === 'log-drum' || gs === 'bounce') return 'amapiano';
            if (bs === 'deep') return 'afro_house';
            return 'afrobeat';
        }
        if (dp === 'latin') return 'latin';
        if (dp === 'retro') return 'synthwave';
        if (dp === 'orchestral') {
            if (ms === 'dissonant' || gs === 'sparse') return 'horror_score';
            if (ms === 'pad' || gs === 'ambient') return 'ambient';
            return 'trailer_music';
        }

        // Bass style fallback
        if (bs === '808' || bs === '808_slide') return 'trap';
        if (bs === 'sub-heavy') return 'cloud_rap';
        if (bs === 'wobble') return 'dubstep';
        if (bs === 'reese' || bs === 'modulated') return 'dnb';
        if (bs === 'walking') return 'jazz';
        if (bs === 'slap') return 'funk';
        if (bs === 'pumping' || bs === 'driving') return 'house';
        if (bs === 'sub-808') return 'future_bass';
        if (bs === 'tumbao') return 'latin';
        if (bs === 'roots') return 'reggae';
        if (bs === 'synth-bass') return 'synthwave';
        if (bs === 'drone') return 'ambient';

        // Category fallback
        if (cat.includes('latin') || cat.includes('world')) return 'latin';
        if (cat.includes('rock')) return 'alt_rock';
        if (cat.includes('metal')) return 'metal';
        if (cat.includes('jazz')) return 'jazz';
        if (cat.includes('funk') || cat.includes('groovy')) return 'funk';
        if (cat.includes('soulful')) return 'rnb';
        if (cat.includes('cinematic') || cat.includes('game')) return 'trailer_music';
        if (cat.includes('pop')) return 'pop';

        return 'hiphop';
    }

    /**
     * Get the list of supported genre profile keys.
     * @returns {string[]}
     */
    static getAvailableProfiles() {
        return Object.keys(GENRE_MIX_PROFILES);
    }

    /**
     * Get the profile key that would be used for a given genre name.
     * @param {string} genreName
     * @returns {string}
     */
    static getProfileForGenre(genreName) {
        return GENRE_TO_PROFILE[genreName] || 'hiphop';
    }
}

export default AdaptiveMixEngine;
