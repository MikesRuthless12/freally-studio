# Caesura (Dash) Placement Audit Report

Generated: 2026-03-15T07:03:59.767Z
Total song generations: 780
Total lyric lines: 16080
Lines with dash: 15058
Lines without dash: 1022

---

## Overall Caesura Accuracy

| Metric | Value |
|--------|-------|
| Lines with correct dash placement | 15056 / 15058 |
| **Dash placement accuracy** | **99.99%** |
| Lines with issues (incl. missing) | 46 |
| Missing breaks (6+ word lines) | 44 |

## Issue Breakdown by Rule

| Rule | Count | Description |
|------|-------|-------------|
| MISSING_BREAK | 44 | Long line (8+) missing any dash |
| BREAK_AFTER_PREPOSITION | 2 | Preposition left dangling before dash |

## Stats by Genre

| Genre | Total Lines | With Dash | Issues | Accuracy |
|-------|-------------|-----------|--------|----------|
| country | 960 | 941 | 6 | 99.4% |
| edm | 960 | 933 | 3 | 99.7% |
| folk | 960 | 944 | 0 | 100.0% |
| gospel | 1680 | 1644 | 0 | 100.0% |
| hiphop | 2400 | 1889 | 2 | 99.9% |
| indie | 1680 | 1595 | 1 | 99.9% |
| jazz | 960 | 926 | 8 | 99.1% |
| kpop | 1680 | 1654 | 0 | 100.0% |
| latin | 960 | 935 | 1 | 99.9% |
| metal | 960 | 869 | 0 | 100.0% |
| pop | 960 | 920 | 2 | 99.8% |
| rnb | 960 | 905 | 11 | 98.8% |
| rock | 960 | 903 | 12 | 98.7% |

## Stats by Mood

| Mood | Total Lines | With Dash | Issues | Accuracy |
|------|-------------|-----------|--------|----------|
| aggressive | 1876 | 1759 | 7 | 99.6% |
| dark | 1876 | 1743 | 5 | 99.7% |
| dreamy | 1876 | 1736 | 4 | 99.8% |
| epic | 1608 | 1525 | 3 | 99.8% |
| happy | 1876 | 1758 | 5 | 99.7% |
| hopeful | 1608 | 1525 | 8 | 99.5% |
| melancholic | 1608 | 1486 | 4 | 99.7% |
| romantic | 1876 | 1758 | 4 | 99.8% |
| sad | 1876 | 1768 | 6 | 99.7% |

## Stats by Section Type

| Section | Total Lines | With Dash | Issues | Accuracy |
|---------|-------------|-----------|--------|----------|
| bridge | 960 | 935 | 0 | 100.0% |
| chorus | 6480 | 6181 | 2 | 100.0% |
| intro | 240 | 211 | 0 | 100.0% |
| outro | 240 | 235 | 0 | 100.0% |
| prechorus | 240 | 239 | 0 | 100.0% |
| verse | 7920 | 7257 | 44 | 99.4% |

## Flagged Lines with Bad Dash Placement (2 total, showing 2)

| # | Genre | Mood | Section | Line | Issues |
|---|-------|------|---------|------|--------|
| 1 | country | hopeful | Chorus | take me back to - where it all began | BREAK_AFTER_PREPOSITION: "to - where" |
| 2 | country | hopeful | Chorus | take me back to - where it all began | BREAK_AFTER_PREPOSITION: "to - where" |

## Lines Missing Dash (6+ words, 44 total, showing 44)

- [pop/melancholic] Verse 2: `we chase the sun from dawn to dusk`
- [pop/aggressive] Verse 2: `we chase the sun from dawn to dusk`
- [hiphop/epic] Verse 2: `they study my flow in the halls of hip-hop`
- [hiphop/hopeful] Verse 1: `i break the law of the lyrical draw`
- [rock/romantic] Verse 1: `I found salvation in a wall of amplified sound`
- [rock/aggressive] Verse 1: `the amp crackles with the ghosts of every band before`
- [rock/hopeful] Verse 1: `the highway stretches to a point of no return`
- [rock/happy] Verse 2: `the highway stretches to a point of no return`
- [rock/epic] Verse 1: `the highway stretches to a point of no return`
- [rock/aggressive] Verse 2: `the amp crackles with the ghosts of every band before`
- [rock/dreamy] Verse 1: `I found salvation in a wall of amplified sound`
- [rock/dark] Verse 2: `the highway stretches to a point of no return`
- [rock/sad] Verse 1: `the highway stretches to a point of no return`
- [rock/sad] Verse 2: `the amp crackles with the ghosts of every band before`
- [rock/dreamy] Verse 1: `the amp crackles with the ghosts of every band before`
- [rock/dreamy] Verse 2: `the highway stretches to a point of no return`
- [country/sad] Verse 1: `surrender to the beauty of the mountainside at dawn`
- [country/romantic] Verse 2: `surrender to the beauty of the mountainside at dawn`
- [country/happy] Verse 2: `surrender to the beauty of the mountainside at dawn`
- [country/hopeful] Verse 2: `surrender to the beauty of the mountainside at dawn`
- [rnb/romantic] Verse 2: `I synchronized my breathing to your heartbeat slow`
- [rnb/hopeful] Verse 1: `I tune my guitar to the frequency of your laugh exactly`
- [rnb/dark] Verse 2: `you set my soul on fire with a burning fire`
- [rnb/dark] Verse 1: `I synchronized my breathing to your heartbeat slow`
- [rnb/dark] Verse 2: `you set my soul on fire with a burning fire`
- [rnb/melancholic] Verse 2: `you set my soul on fire with a burning fire`
- [rnb/aggressive] Verse 2: `I synchronized my breathing to your heartbeat slow`
- [rnb/melancholic] Verse 1: `you set my soul on fire with a burning fire`
- [rnb/sad] Verse 2: `I count the freckles on your shoulders in the dark`
- [rnb/dark] Verse 2: `I count the freckles on your shoulders in the dark`
- [rnb/aggressive] Verse 2: `I count the freckles on your shoulders in the dark`
- [edm/hopeful] Verse 1: `I found religion in the church of the subwoofer`
- [edm/aggressive] Verse 2: `we turned the dark into a lightshow with our energy`
- [edm/romantic] Verse 1: `we turned the soft into a lightshow with our energy`
- [indie/epic] Verse 1: `I found your annotation in the margin of the shared textbook`
- [jazz/happy] A Section 2: `the arrangement opens up for the bass to take a sixteen-bar solo`
- [jazz/sad] A Section 1: `the arrangement opens up for the bass to take a sixteen-bar solo`
- [jazz/happy] A Section 1: `the arrangement opens up for the bass to take a sixteen-bar solo`
- [jazz/melancholic] A Section 3: `the arrangement opens up for the bass to take a sixteen-bar solo`
- [jazz/dreamy] A Section 2: `the arrangement opens up for the bass to take a sixteen-bar solo`
- [jazz/hopeful] A Section 2: `the arrangement opens up for the bass to take a sixteen-bar solo`
- [jazz/sad] A Section 2: `the arrangement breathes with dynamics from a whisper to a roar`
- [jazz/aggressive] A Section 1: `the arrangement opens up for the bass to take a sixteen-bar solo`
- [latin/happy] Verse 2: `we learned to love by learning to dance to the same beat`

## Correctly Placed Dash Examples (showing 30)

- [pop/happy] `the frequency is - crystal clear`
- [pop/happy] `a satellite of truth - and fear`
- [pop/happy] `I counted shooting stars - and named them after you`
- [pop/happy] `you colored outside - every line I drew`
- [pop/happy] `one more - dream one more heat`
- [pop/happy] `the transformation - started with a single heartbeat`
- [pop/happy] `you painted over every - shade of grey`
- [pop/happy] `screenshot the moment - save the day`
- [pop/happy] `extraordinary how - the universe aligned`
- [pop/happy] `the answers that - I couldn't find`
- [pop/happy] `the way you touch my skin - it feels so right`
- [pop/happy] `the curtain rises - lights are shining bright`
- [pop/happy] `one more - dream one more heat`
- [pop/happy] `the transformation - started with a single heartbeat`
- [pop/happy] `you painted over every - shade of grey`
- [pop/happy] `screenshot the moment - save the day`
- [pop/sad] `the lights go dim - and I can see`
- [pop/sad] `you fascinated me - right from the very start`
- [pop/sad] `you showed me constellations - I can't unsee`
- [pop/sad] `I'll never let - this feeling go`
- [pop/sad] `i know that what we - have is here to stay`
- [pop/sad] `the seeds we planted - start to grow`
- [pop/sad] `our love will - never fade away`
- [pop/sad] `the photo album - tells a different story`
- [pop/sad] `the city - sleeping in a hush`
- [pop/sad] `my imagination painted - every memory`
- [pop/sad] `I'll never let - this feeling go`
- [pop/sad] `i know that what we - have is here to stay`
- [pop/sad] `the seeds we planted - start to grow`
- [pop/sad] `our love will - never fade away`

