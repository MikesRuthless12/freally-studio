# Plan: Fix PSOLA Clicking on Pitch-Shifted Notes

## Problem
Notes that have pitch offset applied click during playback. Unedited notes play clean. The clicking only occurs within PSOLA-processed regions, not at transitions between edited/unedited blobs (that was already fixed).

## Root Cause
**Gap-filling with unshifted original audio inside PSOLA processing.**

When PSOLA repositions grains at the new pitch period, gaps appear between grains. The current code fills those gaps with the **original unshifted input audio** (`_originalInput[]`). This creates periodic pitch jumps within a single shifted note — you hear the shifted pitch for one grain, then a flash of the original pitch in the gap, then shifted again. At the grain rate (~100-200 Hz for vocals), this sounds like buzzy clicking/crackling.

The problem gets **worse at extreme shifts** because:
- Larger shift ratios = larger spacing between output grains = bigger gaps = more original audio leaking in
- Bigger pitch difference between shifted and original = more audible clicks

**Affected code locations:**
- WASM path: Lines 1029-1043 — `this.grainBuf[i] = this._originalInput[i]`
- JS path: Lines 1198-1210 — `out[i] = this._originalInput[i]`
- Ratio-change crossfade: Lines 906-916 — crossfades from `_originalInput` to PSOLA

## Fix (single file: `src/vocal/worklets/pitch-shifter-processor.js`)

### Change 1: WASM path gap-fill — fade to silence instead of original audio
**Lines 1029-1043** — Replace gap-fill logic:
- Currently: fills zeros with original unshifted audio, blends partial coverage with original
- Fix: fade PSOLA grain edges smoothly to silence (no pitch contamination)

### Change 2: JS path gap-fill — same approach
**Lines 1198-1210** — Replace gap-fill logic:
- Currently: fills low-coverage positions with original, blends partial coverage
- Fix: fade based on coverage amount, no mixing with original audio

### Change 3: Ratio-change crossfade — use previous PSOLA output, not original
**Lines 906-916** — When shift ratio changes >0.05:
- Currently: crossfades from `_originalInput` (unshifted) to new PSOLA output
- Fix: crossfade from previous chunk tail `_chunkTail` (already shifted) to new PSOLA output

### Change 4: Gentler IIR filter gap handling
**Lines 984-986 (WASM), 1187-1190 (JS)** — De-emphasis filter gap decay:
- Currently: `prev *= 0.5` (aggressive decay creates small transient when coverage resumes)
- Fix: `prev *= 0.9` (gentler decay, smoother re-entry)

## Files Modified
Only one file: `src/vocal/worklets/pitch-shifter-processor.js`

## Validation
`npm run build` after changes.
