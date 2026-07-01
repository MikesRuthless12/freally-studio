# Freally Pattern Engine — Research Findings & Implementation Guide

## How Professional Tools Generate MIDI Patterns

This document summarizes deep research into how industry-leading MIDI generators create professional-quality patterns across drums, chords, melodies, and basslines, and maps each technique to the implementation in `PatternEngine.js`.

---

## 1. DRUM PATTERNS

### How the Pros Do It

**Euclidean Rhythms** (used by Ableton's Generators, Drummer-1, Playbeat, modular synths):
- The Bjorklund/Toussaint algorithm distributes `k` hits across `n` steps as evenly as possible
- E(3,8) = `[x . . x . . x .]` — the Cuban tresillo, used in reggaeton, Latin, Afrobeat
- E(4,16) = `[x . . . x . . . x . . . x . . .]` — standard four-on-the-floor
- E(5,8) = `[x . x x . x x .]` — the classic Cuban Cinquillo
- E(7,16) — common Afrobeat bell pattern
- **Rotation** shifts the pattern start, creating syncopation from the same parameters
- Drummer-1 and Playbeat use Euclidean distribution as their foundation, then layer genre templates on top

**Genre Skeleton + Refinement** (used by Drum Monkey, XDrummer, EZDrummer):
- Phase 1: Place guaranteed hits on genre-defining positions (e.g., kick on 1 & 3 for house, snare on 3 only for half-time trap)
- Phase 2: Fill in ghost notes, 16th rolls, and accents using probability gates tied to a "density" parameter
- Phase 3: Humanize velocity with downbeat accents and micro-timing variations

**Humanization** (Magenta Studio's GrooVAE):
- Google trained neural networks on 15 hours of real drummer performances
- The model learned that downbeats are 15–20% louder, offbeats have micro-timing delays of 5–15ms
- Ghost notes (soft hits between main beats) run at 40–60% velocity
- Our implementation uses a deterministic velocity curve that approximates these findings

### PatternEngine.js Implementation

| Technique | Function | How It Works |
|-----------|----------|-------------|
| Euclidean distribution | `euclidean()` | Bresenham-line algorithm: hit at step `i` if `floor(k*i/n) ≠ floor(k*(i-1)/n)` |
| Euclidean drums | `generateEuclideanDrumVoice()` | Wraps euclidean() with per-instrument velocity curves, swing, and multi-bar expansion |
| Velocity humanization | `humanizeVelocity()` | Downbeat +15%, backbeat +9%, offbeat 16ths at 60% ghost level, ±5% micro-variation |
| Genre skeletons | Existing `drumPatterns.js` | 7 families × 19 variants with skeleton + refinement pipeline (unchanged) |

---

## 2. CHORD PATTERNS

### How the Pros Do It

**Voice Leading** (used by Captain Chords, Scaler 2, Orb Chords):
- Rule #1: Minimize total semitone movement between consecutive chords
- When moving from C major (C-E-G) to F major, keep E→F (1 semitone) and use 1st inversion F/A to get A→G (2 semitones) instead of root position which would jump C→F (5 semitones)
- Professional tools try every inversion and pick the one with minimum aggregate voice movement

**Voicing Strategies** (Scaler 2, Hookpad, Captain Chords):
- **Close voicing**: All notes within one octave (pop, simple)
- **Open voicing**: 2nd voice raised an octave (jazz, cinematic)
- **Drop-2**: Second-from-top voice dropped an octave (jazz standard)
- **Shell voicing**: Root + 3rd + 7th only, skip the 5th (jazz economy)
- **Spread voicing**: Alternating voices raised an octave (orchestral, cinematic)

**Rhythmic Styles** (Orb Chords, Captain Chords):
- **Pad**: Single attack, sustained across the full duration — ambient, cinematic, ballads
- **Stab**: Short rhythmic hits on strong beats — funk, EDM drops, trap
- **Arpeggio**: Notes played sequentially, up-down pattern — trance, progressive, synthwave
- **Pulse**: Steady 8th/16th-note pumping — house, techno, EDM
- **Strum**: Slight time offset per voice (guitar simulation) — folk, reggae, soul

### PatternEngine.js Implementation

| Technique | Location | Details |
|-----------|----------|---------|
| Genre progression selection | `generateChordPattern()` | Reads `typicalProgressionType` from genre → picks from 24 progression categories |
| Roman numeral resolution | `romanToDegree()`, `flatSemitoneOffset()` | Handles I–VII, bVI/bVII/bIII, 7th/9th/dim/aug extensions |
| Voice leading | `voiceLead()` | Tests all inversions + octave shifts, picks minimum aggregate semitone distance |
| 5 voicing strategies | `VOICING_STRATEGIES` | close, open, drop-2, spread, shell — weighted by genre complexity |
| 5 rhythm styles | `CHORD_RHYTHM_STYLES` | pad, stab, arpeggio, pulse, strum — auto-selected by genre grooveStyle |
| Genre→rhythm mapping | `selectChordRhythm()` | Maps 20+ grooveStyle values to appropriate chord rhythm |

---

## 3. MELODY PATTERNS

### How the Pros Do It

**Weighted Interval Markov Chains** (academic research, Magenta's MelodyRNN):
- Rather than choosing random scale notes, weight transitions by musical interval
- Stepwise motion (1–2 semitones) should be 2–4× more likely than leaps (5+ semitones)
- This single technique is the biggest differentiator between "random notes" and "musical phrases"
- First-order chains use only the current note; second-order uses the last two notes for context

**Contour Shaping** (Orb Melody, Captain Melody):
- Before selecting individual notes, define the overall pitch trajectory
- Common contours: Arch (rise-fall), Valley (fall-rise), Ascending, Descending, Wave, Plateau
- The contour biases the Markov chain: if contour says "go up", upward intervals get 1.5× weight

**Chord-Tone Targeting** (professional songwriting rule #1):
- Notes on strong beats (1, 2, 3, 4) should land on chord tones (root, 3rd, 5th, 7th)
- Passing tones and neighbor tones go on weak beats (offbeat 8ths and 16ths)
- Approach notes: chromatic step up or down into the next chord tone
- This technique is used by every professional melody generator and is fundamental to jazz improvisation

**Motif Development** (Captain Melody, Hookpad):
- Generate a short 1–2 bar phrase (the "motif")
- Develop it across the song using: exact repetition, transposition (shift up/down), inversion (mirror intervals), rhythmic displacement, diminution (halve durations)
- This creates coherent, memorable melodies rather than random note streams

**Genre-Specific Profiles**:
- Each genre has characteristic density, note grid, leap size, and rest probability
- Hip-hop melodies: sparse, 8th-note grid, small leaps, 40% rest probability
- EDM leads: dense, 16th-note grid, larger leaps, arch contour, 15% rests
- Jazz: dense, 16th-note grid, chromatic passing tones, wave/arch contours

### PatternEngine.js Implementation

| Technique | Location | Details |
|-----------|----------|---------|
| Markov interval weights | `INTERVAL_WEIGHTS` | Whole steps (4.0), half steps (3.0), minor 3rds (2.5), perfect 4ths (1.8), repeats (1.5), octaves (0.8) |
| Next-note selection | `nextMelodyDegree()` | Builds candidate list from nearby scale degrees, weights by interval + contour bias |
| 7 contour shapes | `CONTOURS` | arch, valley, ascending, descending, wave, plateau, static — each a math function |
| Chord-tone targeting | In `generateMelodyPattern()` | On strong beats, finds nearest chord tone within a minor 3rd and snaps to it |
| Motif development | Phase 2 of `generateMelodyPattern()` | 5 variation techniques: transpose, exact, rhythmShift, invert, diminish — weighted random |
| 36 genre profiles | `MELODY_PROFILES` | Maps every `melodyStyle` to density, stepGrid, maxLeap, restProb, preferred contours |
| Chord-tone map | `buildChordToneMap()` | Pre-computes active chord tones at every time step for O(1) lookups |

---

## 4. BASSLINE PATTERNS

### How the Pros Do It

**Root-Fifth-Octave Framework** (universal bass method):
- Rule #1: Play the root of the chord. Everything else is extra.
- Rule #2: The fifth (7 semitones above) is the most compatible addition — it's in every major, minor, and power chord
- Rule #3: Octave shifts (±12 semitones) add movement without changing harmony
- This three-note vocabulary covers 80%+ of all basslines across all genres

**Genre-Specific Bass Behaviors**:
- **808 (Trap/Hip-Hop)**: Long sustaining sub-bass notes, follows kick pattern, mainly root, glides between notes
- **Walking (Jazz)**: Stepwise quarter-note motion through root→3rd→5th→approach note, leading smoothly into next chord
- **Pumping (House/EDM)**: Steady 8th notes on root, sidechain-pumping rhythm, minimal pitch movement
- **Slap (Funk)**: Syncopated hits on & of 2, beat 4, & of 4; ghost notes at 55% velocity between accents
- **Tumbao (Latin)**: Anticipated bass on & of 4 leading into next bar — the classic Afro-Cuban bass feel
- **Drone (Ambient/Cinematic)**: Sustained pedal tone, single note held for entire section
- **Reese (DnB)**: Sustained with subtle detuning, occasional movement to 5th
- **Wobble (Dubstep)**: Rapid retriggering with slight pitch variation simulating LFO modulation

**Chord Following**:
- Bass generator receives the chord pattern output
- Groups chord notes by start time, takes lowest note as the chord root
- Each bass segment plays in the key of the current chord

**Kick Synchronization** (Trap, House, EDM):
- In trap, the 808 bass fires on every kick hit with pitch matching
- In house, the bass pumps in sync with the four-on-the-floor kick
- The bass pattern is derived from or aligned with the kick pattern timing

### PatternEngine.js Implementation

| Technique | Location | Details |
|-----------|----------|---------|
| 27+ bass styles | `BASS_STYLES` | 808, 808_slide, walking, pumping, driving, slap, roots, root-heavy, deep, rolling, sub-heavy, sub, tumbao, mellow, heavy, wobble, reese, modulated, drone, smooth, pounding, subtle, sub-808, synth-bass, groovy, cowbell, complex |
| Chord following | `extractChordRoots()` | Groups chord pattern notes by time, extracts lowest note as root, creates time segments |
| Genre auto-selection | `generateBassPattern()` | Reads `bassStyle` from `GENRE_DEFINITIONS` to pick the right function |
| Root-fifth-octave | Each style function | All styles use `chordRoot`, `chordRoot + scale[4]` (fifth), `chordRoot ± 12` (octave) as primary targets |
| Approach notes | Walking, 808_slide styles | Chromatic ±1/±2 semitone or scale-7th approach into next chord root |
| Humanization | Applied via `humanizeVelocity()` | Accent on downbeats, softer ghost notes, ±5% micro-variation |

---

## 5. UNIFIED GENERATION FLOW

The `generateAllPatterns()` function follows the professional production workflow:

```
1. CHORDS FIRST → generateChordPattern()
   ↓ (chord pattern passed to melody & bass)
2. MELODY AWARE OF CHORDS → generateMelodyPattern({ chordPattern })
   - Strong beats snap to chord tones
   - Contour and motif development layer musicality
3. BASS FOLLOWS CHORDS → generateBassPattern({ chordPattern })
   - Extracts root from each chord change
   - Applies genre-specific bass style
4. DRUMS (existing system) → drumPatterns.js getProPattern()
   - Supplemented by generateEuclideanDrumVoice() for Euclidean patterns
```

This ensures all four parts are **harmonically linked** — the melody targets chord tones, the bass follows chord roots, and the drums provide rhythmic foundation.

---

## 6. INTEGRATION WITH FREALLY

### How to use in ChordGeneratorEnhanced.jsx:

```javascript
import { generateChordPattern } from './PatternEngine';

// Replace the existing generateChords() body:
const newPattern = generateChordPattern({
    key: globalKey, scale: globalScale, genre: currentGenre,
    mood: globalMood, bars: globalBars, complexity,
    octave: Math.floor(rootPitch / 12) - 1
});
setChordPattern(newPattern);
```

### How to use in MelodyBassGeneratorEnhanced.jsx:

```javascript
import { generateMelodyPattern, generateBassPattern } from './PatternEngine';

// For melody type:
const newPattern = generateMelodyPattern({
    key: globalKey, scale: globalScale, genre: currentGenre,
    mood: globalMood, bars: globalBars, complexity,
    octave: globalOctave, chordPattern: chordNotes  // pass chord data
});

// For bass type:
const newPattern = generateBassPattern({
    key: globalKey, scale: globalScale, genre: currentGenre,
    mood: globalMood, bars: globalBars, complexity,
    octave: globalOctave - 2, chordPattern: chordNotes
});
```

### How to use the unified generator (in FreallyAppComplete.jsx):

```javascript
import { generateAllPatterns } from './PatternEngine';

const { chords, melody, bass } = generateAllPatterns({
    key: globalKey, scale: globalScale, genre: currentGenre,
    mood: globalMood, bars: globalBars, complexity: 'complex'
});
// Feed each into their respective generators
```

---

## 7. KEY DIFFERENCES FROM CURRENT IMPLEMENTATION

| Aspect | Current Code | PatternEngine.js |
|--------|-------------|-----------------|
| Melody notes | Random scale degree, flat probability | Weighted Markov chain, contour-shaped, chord-tone targeted |
| Melody structure | No repetition/development | 2-bar motif + 5 variation techniques |
| Melody profiles | One-size-fits-all | 36 genre-specific profiles |
| Chord voicing | Root position only | 5 voicing strategies with voice leading |
| Chord rhythm | Sustained or random pulse | 5 rhythmic styles auto-selected by genre |
| Chord inversions | None | Minimum-movement voice leading across inversions |
| Bass generation | Not separate from melody | 27+ genre-specific bass style functions |
| Bass-chord link | None | Extracts chord roots, bass follows changes |
| Drum Euclidean | Not available | Full Euclidean algorithm with rotation and swing |
| Velocity | Flat or random | Humanized curves: downbeat accents, ghost notes, micro-variation |

---

*Generated from research on: Orb Producer Suite 3, Captain Chords/Melody, Scaler 2, Playbeat 3, Drum Monkey, Magenta Studio (GrooVAE/Drumify), Drummer-1, MIDI Agent, Hookpad, Bass Dragon, EZDrummer, and academic papers on Euclidean rhythms (Toussaint 2005), Markov chains for music generation, and voice leading algorithms.*
