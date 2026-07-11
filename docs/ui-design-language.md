# Freally Studio — UI Design Language (TASK-C01)

The goal of Phase C: screenshots of any two views read as **ONE product**.
Today they read as five. This document is the law, the evidence, and the
target. The tokens live in `src/ui/tokens.css`; skins (TASK-C03) may change
token *values*, never component styles.

## The Design Law (Ableton-style)

```
DESIGN LAW (Ableton-style):
- Flat surfaces only. NO gradients, NO glassmorphism, NO glow/shadows-for-decoration.
- 1 px hairline borders (--border-hairline). 4 px spacing grid.
- One UI font, 11–13 px, single type scale (11/12/13/15 only).
- Desaturated neutral base: surfaces --surface-0..3. ONE accent color.
- Saturated color appears ONLY on clips, track color chips, and meters.
- Every control comes from src/components/ui/. No view-local control styles.
- Every color comes from a token. Raw hex/rgb in a component = build failure.
```

## Violation inventory (measured 2026-07-11)

Counted by regex over each file: `gradients` = linear/radial/conic-gradient
occurrences; `unique hex` = distinct `#rrggbb` literals; `color refs` = all
hex/rgb()/hsl() literals; `font sizes` = distinct numeric sizes.

| File | Gradients | Unique hex | Color refs | Font sizes (px) |
|---|---|---|---|---|
| `ArrangementViewEnhanced.jsx` | 0 | 5 | 18 | 7 (9,10,11,12,14,16,20) |
| `ArrangementTimeline.jsx`* | 7 | 82 | 582 | 9 (7,8,9,10,11,12,13,14,15) |
| `MixerPanel.jsx` | 19 | 58 | 103 | 6 (7,9,10,11,12,16) |
| `DrumGeneratorEnhanced.jsx` | 1 | 38 | 205 | 9 (7,8,9,10,11,12,14,16,18) |
| `BrowserEnhanced.jsx` | 0 | 2 | 3 | 5 (8,9,10,11,14) |
| `Browser.jsx`* | 3 | 37 | 273 | 9 (8,9,10,11,12,14,16,18,28) |
| `SettingsModal.jsx` | 0 | 24 | 111 | 6 (9,10,11,12,14,18) |
| `freally-daw-theme.css` | 1 | 51 | 108 | 1 (11) |

\* Not named in TASK-C01 but included because they are the actual heavy
implementations behind the arrangement view and the browser panel —
`BrowserEnhanced.jsx` is a thin wrapper; `Browser.jsx` carries the styles.

### What the numbers say

- **~300 distinct colors** exist across these eight files alone, where the
  law allows ~40 tokens (of which 16 are clip colors).
- **31 gradients** decorate chrome (mixer strips are the worst offender at
  19) — the law allows zero.
- **11 distinct font sizes** (7–28 px) against a 4-step scale (11/12/13/15).
- Every view defines its own buttons, knobs, sliders and list rows inline;
  none share a component kit.

## The target

1. Every color in `src/**` resolves to a `var(--…)` from `tokens.css`
   (enforced by `scripts/check-raw-colors.js`, TASK-C04 — reporting first,
   then blocking after TASK-C09).
2. Views are rebuilt from `src/components/ui/` (TASK-C05) — flat,
   hairline-bordered, token-colored, sizes S/M.
3. Saturated color survives only in three places: clip bodies
   (`--clip-01..16`), track color chips, meters (`--meter-*`).
4. Side-by-side screenshots of Arrangement, Mixer, Generators, Browser and
   Settings must look like frames of the same application: same surfaces,
   same hairlines, same type scale, one accent.

Progress ritual per reskin task (C06–C09): before/after screenshots of the
same project + re-run the violation count above — the numbers must go DOWN
in every touched file, and the total must approach zero by TASK-C09, when
`check-raw-colors` flips to blocking in `npm run check`.
