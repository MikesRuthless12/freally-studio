# Caesura (Dash) Placement Audit Report

Generated: 2026-03-29T06:23:58.298Z
Total song generations: 780
Total lyric lines: 16080
Lines with dash: 15586
Lines without dash: 494

---

## Overall Caesura Accuracy

| Metric | Value |
|--------|-------|
| Lines with correct dash placement | 14852 / 15586 |
| **Dash placement accuracy** | **95.29%** |
| Lines with issues (incl. missing) | 744 |
| Missing breaks (6+ word lines) | 10 |

## Issue Breakdown by Rule

| Rule | Count | Description |
|------|-------|-------------|
| TOO_EARLY | 334 | Less than 2 words before dash |
| BREAK_AFTER_VERB_ING | 288 | Dash after -ing verb before its preposition |
| SINGLE_CHAR_START | 113 | Second half starts with single char |
| MISSING_BREAK | 10 | Long line (8+) missing any dash |
| BREAK_AFTER_PREPOSITION | 5 | Preposition left dangling before dash |
| SPLITS_COMPOUND | 4 | Dash splits a compound phrase |

## Stats by Genre

| Genre | Total Lines | With Dash | Issues | Accuracy |
|-------|-------------|-----------|--------|----------|
| country | 960 | 954 | 36 | 96.2% |
| edm | 960 | 928 | 33 | 96.4% |
| folk | 960 | 949 | 55 | 94.2% |
| gospel | 1680 | 1657 | 76 | 95.4% |
| hiphop | 2400 | 2185 | 249 | 88.6% |
| indie | 1680 | 1653 | 74 | 95.5% |
| jazz | 960 | 953 | 65 | 93.2% |
| kpop | 1680 | 1631 | 32 | 98.0% |
| latin | 960 | 923 | 32 | 96.5% |
| metal | 960 | 932 | 21 | 97.7% |
| pop | 960 | 934 | 31 | 96.7% |
| rnb | 960 | 941 | 24 | 97.4% |
| rock | 960 | 946 | 16 | 98.3% |

## Stats by Mood

| Mood | Total Lines | With Dash | Issues | Accuracy |
|------|-------------|-----------|--------|----------|
| aggressive | 1876 | 1821 | 90 | 95.1% |
| dark | 1876 | 1804 | 90 | 95.0% |
| dreamy | 1876 | 1826 | 98 | 94.6% |
| epic | 1608 | 1562 | 74 | 95.3% |
| happy | 1876 | 1818 | 87 | 95.2% |
| hopeful | 1608 | 1550 | 66 | 95.7% |
| melancholic | 1608 | 1573 | 79 | 95.0% |
| romantic | 1876 | 1816 | 82 | 95.5% |
| sad | 1876 | 1816 | 78 | 95.7% |

## Stats by Section Type

| Section | Total Lines | With Dash | Issues | Accuracy |
|---------|-------------|-----------|--------|----------|
| bridge | 960 | 950 | 43 | 95.5% |
| chorus | 6480 | 6218 | 5 | 99.9% |
| intro | 240 | 238 | 67 | 71.8% |
| outro | 240 | 237 | 12 | 94.9% |
| prechorus | 240 | 240 | 3 | 98.8% |
| verse | 7920 | 7703 | 614 | 92.0% |

## Flagged Lines with Bad Dash Placement (734 total, showing 200)

| # | Genre | Mood | Section | Line | Issues |
|---|-------|------|---------|------|--------|
| 1 | pop | sad | Verse 2 | the city sleeping - in a hush | BREAK_AFTER_VERB_ING: "sleeping - in" |
| 2 | pop | sad | Verse 2 | the feeling - of the golden crush | BREAK_AFTER_VERB_ING: "feeling - of" |
| 3 | pop | dreamy | Verse 2 | appreciate - the moments of illumination | TOO_EARLY: only 1 word(s) before dash |
| 4 | pop | epic | Verse 1 | wondering - just how we got this far | TOO_EARLY: only 1 word(s) before dash |
| 5 | pop | melancholic | Verse 1 | unforgettable - the way you illuminate | TOO_EARLY: only 1 word(s) before dash |
| 6 | pop | romantic | Verse 2 | your smile could light - a city burning bright | SINGLE_CHAR_START: "- a" |
| 7 | pop | aggressive | Verse 1 | i saw the colors painting - at the break of day | BREAK_AFTER_VERB_ING: "painting - at" |
| 8 | pop | dark | Verse 2 | rewatching rom-coms looking - for a sign | BREAK_AFTER_VERB_ING: "looking - for" |
| 9 | pop | happy | Verse 1 | rewatching rom-coms looking - for a sign | BREAK_AFTER_VERB_ING: "looking - for" |
| 10 | pop | romantic | Verse 1 | memories - from another day | TOO_EARLY: only 1 word(s) before dash |
| 11 | pop | happy | Chorus | I sing - through the night | BREAK_AFTER_VERB_ING: "sing - through" |
| 12 | pop | happy | Chorus | I sing - through the night | BREAK_AFTER_VERB_ING: "sing - through" |
| 13 | pop | aggressive | Verse 1 | channeling - Beyonce with the spotlight bright | TOO_EARLY: only 1 word(s) before dash |
| 14 | pop | dreamy | Verse 1 | the feeling - of the golden crush | BREAK_AFTER_VERB_ING: "feeling - of" |
| 15 | pop | epic | Verse 1 | appreciate - the moments of illumination | TOO_EARLY: only 1 word(s) before dash |
| 16 | pop | aggressive | Verse 1 | I sing - through the night | BREAK_AFTER_VERB_ING: "sing - through" |
| 17 | pop | dreamy | Verse 2 | I sing - into the dawn | BREAK_AFTER_VERB_ING: "sing - into" |
| 18 | pop | dark | Verse 1 | polaroid memories fading - to gold | BREAK_AFTER_VERB_ING: "fading - to" |
| 19 | pop | happy | Verse 2 | my heart is pounding - with the beat | BREAK_AFTER_VERB_ING: "pounding - with" |
| 20 | pop | sad | Verse 2 | wondering - just how we got this far | TOO_EARLY: only 1 word(s) before dash |
| 21 | pop | aggressive | Verse 1 | I sing - through the rain | BREAK_AFTER_VERB_ING: "sing - through" |
| 22 | pop | dark | Verse 2 | the memories replay - a broken heart | SINGLE_CHAR_START: "- a" |
| 23 | pop | hopeful | Verse 1 | singing - like Adele with tears on my face | TOO_EARLY: only 1 word(s) before dash |
| 24 | pop | melancholic | Verse 1 | I keep searching - for a way | BREAK_AFTER_VERB_ING: "searching - for" |
| 25 | pop | happy | Verse 2 | beautiful - and everything I ever anticipated | TOO_EARLY: only 1 word(s) before dash |
| 26 | pop | sad | Verse 2 | I am the main character in this coming - of age | BREAK_AFTER_VERB_ING: "coming - of" |
| 27 | pop | romantic | Verse 1 | appreciate - the moments of illumination | TOO_EARLY: only 1 word(s) before dash |
| 28 | pop | romantic | Verse 2 | Something - changed inside of me | TOO_EARLY: only 1 word(s) before dash |
| 29 | pop | dark | Verse 1 | i saw the colors painting - at the break of day | BREAK_AFTER_VERB_ING: "painting - at" |
| 30 | hiphop | happy | Verse 1 | intimidation - never slowed my acceleration | TOO_EARLY: only 1 word(s) before dash |
| 31 | hiphop | happy | Verse 1 | inception - deeper in the imagination | TOO_EARLY: only 1 word(s) before dash |
| 32 | hiphop | happy | Verse 1 | improvisation - meets the fascination | TOO_EARLY: only 1 word(s) before dash |
| 33 | hiphop | happy | Verse 1 | pristine - guillotine of the routine | TOO_EARLY: only 1 word(s) before dash |
| 34 | hiphop | happy | Verse 2 | nonstop hustle grinding - at daybreak | BREAK_AFTER_VERB_ING: "grinding - at" |
| 35 | hiphop | happy | Verse 3 | outside looking - from the inside | BREAK_AFTER_VERB_ING: "looking - from" |
| 36 | hiphop | sad | Verse 2 | revenue - from the avenue | TOO_EARLY: only 1 word(s) before dash |
| 37 | hiphop | sad | Verse 2 | spreading - on the bedding | BREAK_AFTER_VERB_ING: "spreading - on"; TOO_EARLY: only 1 word(s) before dash |
| 38 | hiphop | sad | Verse 3 | esteem - from the downstream stream | TOO_EARLY: only 1 word(s) before dash |
| 39 | hiphop | romantic | Verse 1 | kryptonite - in the starlight | TOO_EARLY: only 1 word(s) before dash |
| 40 | hiphop | romantic | Verse 1 | magnet - on the granite | TOO_EARLY: only 1 word(s) before dash |
| 41 | hiphop | romantic | Verse 2 | negligee - on the resume | TOO_EARLY: only 1 word(s) before dash |
| 42 | hiphop | romantic | Verse 2 | mushroom - in the classroom | TOO_EARLY: only 1 word(s) before dash |
| 43 | hiphop | romantic | Verse 3 | heartless - but the flow's insane kanye | TOO_EARLY: only 1 word(s) before dash |
| 44 | hiphop | aggressive | Verse 2 | pronto - in the toronto | TOO_EARLY: only 1 word(s) before dash |
| 45 | hiphop | aggressive | Verse 3 | inception - dreams in slow motion | TOO_EARLY: only 1 word(s) before dash |
| 46 | hiphop | dreamy | Verse 1 | newsreel - of the ordeal heal | TOO_EARLY: only 1 word(s) before dash |
| 47 | hiphop | dreamy | Verse 2 | no delays I got nothing - to say | BREAK_AFTER_VERB_ING: "nothing - to" |
| 48 | hiphop | dreamy | Verse 2 | ricochet - on the halfway | TOO_EARLY: only 1 word(s) before dash |
| 49 | hiphop | dreamy | Verse 2 | incomplete - but i can't be beat | TOO_EARLY: only 1 word(s) before dash |
| 50 | hiphop | dreamy | Verse 2 | mincemeat - on the receipt sheet | TOO_EARLY: only 1 word(s) before dash |
| 51 | hiphop | dreamy | Verse 3 | gourmet - on the relay hooray | TOO_EARLY: only 1 word(s) before dash |
| 52 | hiphop | dreamy | Verse 3 | buffet - at the halfway relay | TOO_EARLY: only 1 word(s) before dash |
| 53 | hiphop | dark | Verse 1 | sundown - in the boomtown | TOO_EARLY: only 1 word(s) before dash |
| 54 | hiphop | dark | Verse 2 | kazaam - magic shaquille o'neal | TOO_EARLY: only 1 word(s) before dash |
| 55 | hiphop | dark | Verse 3 | thunderstruck - with the good luck | TOO_EARLY: only 1 word(s) before dash |
| 56 | hiphop | epic | Verse 1 | editor - of the senator | TOO_EARLY: only 1 word(s) before dash |
| 57 | hiphop | epic | Verse 1 | predator - or the competitor | TOO_EARLY: only 1 word(s) before dash |
| 58 | hiphop | epic | Verse 2 | diamond - in the rough reveal | TOO_EARLY: only 1 word(s) before dash |
| 59 | hiphop | epic | Verse 2 | wholesale - on the nightingale | TOO_EARLY: only 1 word(s) before dash |
| 60 | hiphop | epic | Verse 2 | nobody cares the betrayal - a bronx tale | SINGLE_CHAR_START: "- a" |
| 61 | hiphop | epic | Verse 3 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 62 | hiphop | epic | Verse 3 | shellshock - but i never stop | TOO_EARLY: only 1 word(s) before dash |
| 63 | hiphop | hopeful | Verse 1 | obtuse - excuse from the recluse | TOO_EARLY: only 1 word(s) before dash |
| 64 | hiphop | hopeful | Verse 2 | they tried to box me in - but I broke the mold | BREAK_AFTER_PREPOSITION: "in - but" |
| 65 | hiphop | hopeful | Verse 2 | whole life building - on this fundament | BREAK_AFTER_VERB_ING: "building - on" |
| 66 | hiphop | hopeful | Verse 2 | accumulated - wealth through dedication | TOO_EARLY: only 1 word(s) before dash |
| 67 | hiphop | melancholic | Verse 2 | every bar - a bigger deal | SINGLE_CHAR_START: "- a" |
| 68 | hiphop | melancholic | Verse 2 | wholesale - on the nightingale | TOO_EARLY: only 1 word(s) before dash |
| 69 | hiphop | melancholic | Verse 3 | walking - proof of the experiment | TOO_EARLY: only 1 word(s) before dash |
| 70 | hiphop | melancholic | Verse 3 | spellbind - the unkind mankind | TOO_EARLY: only 1 word(s) before dash |
| 71 | hiphop | melancholic | Verse 3 | undermined - but i'm still refined | TOO_EARLY: only 1 word(s) before dash |
| 72 | hiphop | happy | Verse 2 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 73 | hiphop | happy | Verse 3 | heirloom - in the ballroom | TOO_EARLY: only 1 word(s) before dash |
| 74 | hiphop | sad | Verse 1 | merry-go-round - of the breakdown | TOO_EARLY: only 1 word(s) before dash |
| 75 | hiphop | sad | Verse 3 | champagne - on the cellophane | TOO_EARLY: only 1 word(s) before dash |
| 76 | hiphop | sad | Verse 3 | domain - of the terrain campaign | TOO_EARLY: only 1 word(s) before dash |
| 77 | hiphop | sad | Verse 3 | spitting - fire through the rain | TOO_EARLY: only 1 word(s) before dash |
| 78 | hiphop | romantic | Verse 1 | prankster - on the plank blank | TOO_EARLY: only 1 word(s) before dash |
| 79 | hiphop | aggressive | Verse 1 | drawback - of the kickback rack | TOO_EARLY: only 1 word(s) before dash |
| 80 | hiphop | aggressive | Verse 2 | showdown - countdown to the lockdown | TOO_EARLY: only 1 word(s) before dash |
| 81 | hiphop | aggressive | Verse 2 | kazaam - magic shaquille o'neal | TOO_EARLY: only 1 word(s) before dash |
| 82 | hiphop | aggressive | Verse 3 | hindsight - in the oversight light | TOO_EARLY: only 1 word(s) before dash |
| 83 | hiphop | dreamy | Verse 1 | migraine - from the hurricane | TOO_EARLY: only 1 word(s) before dash |
| 84 | hiphop | dreamy | Verse 1 | marigold - in the stranglehold | TOO_EARLY: only 1 word(s) before dash |
| 85 | hiphop | dreamy | Verse 2 | undermined - but i'm still refined | TOO_EARLY: only 1 word(s) before dash |
| 86 | hiphop | dreamy | Verse 3 | intimidation - never slowed my acceleration | TOO_EARLY: only 1 word(s) before dash |
| 87 | hiphop | dreamy | Verse 3 | hallucination - or the revelation | TOO_EARLY: only 1 word(s) before dash |
| 88 | hiphop | dreamy | Verse 3 | manifestation - of the transformation | TOO_EARLY: only 1 word(s) before dash |
| 89 | hiphop | dark | Verse 1 | accumulated - wealth through dedication | TOO_EARLY: only 1 word(s) before dash |
| 90 | hiphop | dark | Verse 1 | congregation - of the innovation | TOO_EARLY: only 1 word(s) before dash |
| 91 | hiphop | dark | Verse 1 | manifestation - of the transformation | TOO_EARLY: only 1 word(s) before dash |
| 92 | hiphop | dark | Verse 1 | polarization - of the nation | TOO_EARLY: only 1 word(s) before dash |
| 93 | hiphop | dark | Verse 1 | foundation - of the reputation | TOO_EARLY: only 1 word(s) before dash |
| 94 | hiphop | dark | Verse 1 | starvation - in the isolation | TOO_EARLY: only 1 word(s) before dash |
| 95 | hiphop | dark | Verse 2 | I was dreaming - of the floodlight | BREAK_AFTER_VERB_ING: "dreaming - of" |
| 96 | hiphop | dark | Verse 2 | the spotlight follows me left - and right | SPLITS_COMPOUND: splits "left and right" |
| 97 | hiphop | dark | Verse 3 | the strategy - a state of mind | SINGLE_CHAR_START: "- a" |
| 98 | hiphop | dark | Verse 3 | colorblind - but the vision refined | TOO_EARLY: only 1 word(s) before dash |
| 99 | hiphop | dark | Verse 3 | spellbind - the unkind mankind | TOO_EARLY: only 1 word(s) before dash |
| 100 | hiphop | epic | Verse 1 | ladybug - on the jitterbug rug | TOO_EARLY: only 1 word(s) before dash |
| 101 | hiphop | epic | Verse 2 | trademark - of the matriarch's marker | TOO_EARLY: only 1 word(s) before dash |
| 102 | hiphop | epic | Verse 3 | patchy - on the natchy | TOO_EARLY: only 1 word(s) before dash |
| 103 | hiphop | hopeful | Verse 1 | rejoice - with the right choice | TOO_EARLY: only 1 word(s) before dash |
| 104 | hiphop | hopeful | Verse 3 | the champion standing - in the light | BREAK_AFTER_VERB_ING: "standing - in" |
| 105 | hiphop | melancholic | Verse 1 | elvis presley the king - of the nation | BREAK_AFTER_VERB_ING: "king - of" |
| 106 | hiphop | melancholic | Verse 2 | wholesale - on the nightingale | TOO_EARLY: only 1 word(s) before dash |
| 107 | hiphop | melancholic | Verse 3 | racetrack - to the smokestack | TOO_EARLY: only 1 word(s) before dash |
| 108 | hiphop | melancholic | Verse 3 | pathway - to the gateway | TOO_EARLY: only 1 word(s) before dash |
| 109 | hiphop | melancholic | Verse 3 | backtrack - on the paperback | TOO_EARLY: only 1 word(s) before dash |
| 110 | hiphop | melancholic | Verse 3 | mayday - to the heyday | TOO_EARLY: only 1 word(s) before dash |
| 111 | hiphop | happy | Verse 3 | foxglove - in the treasure trove | TOO_EARLY: only 1 word(s) before dash |
| 112 | hiphop | sad | Verse 2 | capitalized - on every single situation | TOO_EARLY: only 1 word(s) before dash |
| 113 | hiphop | romantic | Verse 3 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 114 | hiphop | aggressive | Verse 1 | gourmet - on the relay hooray | TOO_EARLY: only 1 word(s) before dash |
| 115 | hiphop | aggressive | Verse 2 | automobile - on the pinwheel | TOO_EARLY: only 1 word(s) before dash |
| 116 | hiphop | aggressive | Verse 2 | battle - scream in the mainstream | TOO_EARLY: only 1 word(s) before dash |
| 117 | hiphop | aggressive | Verse 2 | keeping - it real with mass appeal | TOO_EARLY: only 1 word(s) before dash |
| 118 | hiphop | aggressive | Verse 2 | goodwill - on the windmill | TOO_EARLY: only 1 word(s) before dash |
| 119 | hiphop | aggressive | Verse 2 | wu-tang ain't nothing - to scheme with cream | BREAK_AFTER_VERB_ING: "nothing - to" |
| 120 | hiphop | aggressive | Verse 3 | ignite - dynamite in the firefight | TOO_EARLY: only 1 word(s) before dash |
| 121 | hiphop | aggressive | Verse 3 | aftershock - from the livestock | TOO_EARLY: only 1 word(s) before dash |
| 122 | hiphop | dreamy | Verse 1 | tombstone - but i've never been overthrown | TOO_EARLY: only 1 word(s) before dash |
| 123 | hiphop | dreamy | Verse 1 | soundtrack - of the city motown | TOO_EARLY: only 1 word(s) before dash |
| 124 | hiphop | dreamy | Verse 1 | showdown - countdown to the lockdown | TOO_EARLY: only 1 word(s) before dash |
| 125 | hiphop | dreamy | Verse 2 | flowing - like the golden stream | TOO_EARLY: only 1 word(s) before dash |
| 126 | hiphop | dreamy | Verse 2 | blaspheme - in the mainstream beam | TOO_EARLY: only 1 word(s) before dash |
| 127 | hiphop | dreamy | Verse 2 | protect - ya neck upstream | TOO_EARLY: only 1 word(s) before dash |
| 128 | hiphop | dreamy | Verse 3 | throne - to the microphone | TOO_EARLY: only 1 word(s) before dash |
| 129 | hiphop | dreamy | Verse 3 | organized - crime al capone | TOO_EARLY: only 1 word(s) before dash |
| 130 | hiphop | dreamy | Verse 3 | milestone - after milestone shown | TOO_EARLY: only 1 word(s) before dash |
| 131 | hiphop | dreamy | Verse 3 | cornerstone - of the unknown | TOO_EARLY: only 1 word(s) before dash |
| 132 | hiphop | dark | Verse 1 | a championship ring - on my fingertip | BREAK_AFTER_VERB_ING: "ring - on" |
| 133 | hiphop | dark | Verse 1 | permission - of the admission | TOO_EARLY: only 1 word(s) before dash |
| 134 | hiphop | dark | Verse 2 | flowerpot - on the melting pot | TOO_EARLY: only 1 word(s) before dash |
| 135 | hiphop | epic | Verse 1 | remote - control of the whole console | TOO_EARLY: only 1 word(s) before dash |
| 136 | hiphop | epic | Verse 2 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 137 | hiphop | epic | Verse 3 | authorization - for the collaboration | TOO_EARLY: only 1 word(s) before dash |
| 138 | hiphop | epic | Verse 3 | dedication - to the occupation | TOO_EARLY: only 1 word(s) before dash |
| 139 | hiphop | epic | Verse 3 | improvisation - at the celebration | TOO_EARLY: only 1 word(s) before dash |
| 140 | hiphop | hopeful | Verse 2 | the matrix unplugging - from the mainframe brain | BREAK_AFTER_VERB_ING: "unplugging - from" |
| 141 | hiphop | hopeful | Verse 3 | love yourz the bottom line - j cole | SINGLE_CHAR_START: "- j" |
| 142 | hiphop | hopeful | Verse 3 | potluck - and the nunchuck | TOO_EARLY: only 1 word(s) before dash |
| 143 | hiphop | hopeful | Verse 3 | dollar - and a dream j. cole | TOO_EARLY: only 1 word(s) before dash |
| 144 | hiphop | melancholic | Verse 1 | undermined - but i'm still refined | TOO_EARLY: only 1 word(s) before dash |
| 145 | hiphop | melancholic | Verse 2 | showdown - on the breakdown | TOO_EARLY: only 1 word(s) before dash |
| 146 | hiphop | melancholic | Verse 3 | merry-go-round - of the breakdown | TOO_EARLY: only 1 word(s) before dash |
| 147 | hiphop | happy | Verse 1 | woodstock - to the penthouse stock | TOO_EARLY: only 1 word(s) before dash |
| 148 | hiphop | happy | Verse 1 | the bars are dripping - from the jaw | BREAK_AFTER_VERB_ING: "dripping - from" |
| 149 | hiphop | sad | Verse 1 | cornmeal - of the sex appeal | TOO_EARLY: only 1 word(s) before dash |
| 150 | hiphop | sad | Verse 1 | newsreel - of the ordeal heal | TOO_EARLY: only 1 word(s) before dash |
| 151 | hiphop | sad | Verse 2 | blaspheme - in the mainstream beam | TOO_EARLY: only 1 word(s) before dash |
| 152 | hiphop | sad | Verse 3 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 153 | hiphop | sad | Verse 3 | bravado - in the avocado | TOO_EARLY: only 1 word(s) before dash |
| 154 | hiphop | sad | Verse 3 | casino - in the volcano | TOO_EARLY: only 1 word(s) before dash |
| 155 | hiphop | romantic | Verse 1 | flowing - like the golden stream | TOO_EARLY: only 1 word(s) before dash |
| 156 | hiphop | romantic | Verse 1 | supreme - team on the extreme | TOO_EARLY: only 1 word(s) before dash |
| 157 | hiphop | romantic | Verse 2 | turnin' - the whole ship around | TOO_EARLY: only 1 word(s) before dash |
| 158 | hiphop | romantic | Verse 2 | remote - control of the whole console | TOO_EARLY: only 1 word(s) before dash |
| 159 | hiphop | romantic | Verse 3 | inception - deeper in the imagination | TOO_EARLY: only 1 word(s) before dash |
| 160 | hiphop | aggressive | Verse 2 | showdown - in the downtown | TOO_EARLY: only 1 word(s) before dash |
| 161 | hiphop | aggressive | Verse 2 | turnin' - the whole ship around | TOO_EARLY: only 1 word(s) before dash |
| 162 | hiphop | aggressive | Verse 3 | cartwheel - on the commonweal | TOO_EARLY: only 1 word(s) before dash |
| 163 | hiphop | dreamy | Verse 1 | no delays I got nothing - to say | BREAK_AFTER_VERB_ING: "nothing - to" |
| 164 | hiphop | dreamy | Verse 2 | I been getting - to the bag | BREAK_AFTER_VERB_ING: "getting - to" |
| 165 | hiphop | dreamy | Verse 3 | victory - has been won | TOO_EARLY: only 1 word(s) before dash |
| 166 | hiphop | dark | Verse 3 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 167 | hiphop | epic | Verse 1 | initialization - of the operation | TOO_EARLY: only 1 word(s) before dash |
| 168 | hiphop | epic | Verse 1 | dedication - to the occupation | TOO_EARLY: only 1 word(s) before dash |
| 169 | hiphop | epic | Verse 1 | inception - deeper in the imagination | TOO_EARLY: only 1 word(s) before dash |
| 170 | hiphop | epic | Verse 2 | playwright - of the oversight | TOO_EARLY: only 1 word(s) before dash |
| 171 | hiphop | epic | Verse 2 | ricochet - on the halfway | TOO_EARLY: only 1 word(s) before dash |
| 172 | hiphop | epic | Verse 3 | standing - at the minibar | BREAK_AFTER_VERB_ING: "standing - at"; TOO_EARLY: only 1 word(s) before dash |
| 173 | hiphop | hopeful | Verse 1 | defying - all the gravity | TOO_EARLY: only 1 word(s) before dash |
| 174 | hiphop | hopeful | Verse 2 | suffering - and the reckoning | TOO_EARLY: only 1 word(s) before dash |
| 175 | hiphop | hopeful | Verse 3 | drawback - of the kickback rack | TOO_EARLY: only 1 word(s) before dash |
| 176 | hiphop | melancholic | Verse 2 | mastermind - of the undefined | TOO_EARLY: only 1 word(s) before dash |
| 177 | hiphop | melancholic | Verse 3 | workshop - on the rooftop clock | TOO_EARLY: only 1 word(s) before dash |
| 178 | hiphop | happy | Verse 1 | risque - on the croquet | TOO_EARLY: only 1 word(s) before dash |
| 179 | hiphop | happy | Verse 2 | midnight - in the copyright | TOO_EARLY: only 1 word(s) before dash |
| 180 | hiphop | happy | Verse 3 | seesaw - on the chainsaw draw | TOO_EARLY: only 1 word(s) before dash |
| 181 | hiphop | sad | Verse 1 | pathway - to the gateway | TOO_EARLY: only 1 word(s) before dash |
| 182 | hiphop | sad | Verse 1 | gourmet - on the relay hooray | TOO_EARLY: only 1 word(s) before dash |
| 183 | hiphop | sad | Verse 2 | improvisation - at the celebration | TOO_EARLY: only 1 word(s) before dash |
| 184 | hiphop | sad | Verse 3 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 185 | hiphop | romantic | Verse 1 | magnet - on the granite | TOO_EARLY: only 1 word(s) before dash |
| 186 | hiphop | romantic | Verse 2 | dynamite - in the satellite flight | TOO_EARLY: only 1 word(s) before dash |
| 187 | hiphop | romantic | Verse 2 | the spotlight follows me left - and right | SPLITS_COMPOUND: splits "left and right" |
| 188 | hiphop | romantic | Verse 3 | bloodstream - to the jetstream | TOO_EARLY: only 1 word(s) before dash |
| 189 | hiphop | romantic | Verse 3 | wu-tang ain't nothing - to scheme with cream | BREAK_AFTER_VERB_ING: "nothing - to" |
| 190 | hiphop | romantic | Verse 3 | supreme - team on the extreme | TOO_EARLY: only 1 word(s) before dash |
| 191 | hiphop | romantic | Verse 3 | blaspheme - in the mainstream beam | TOO_EARLY: only 1 word(s) before dash |
| 192 | hiphop | aggressive | Verse 1 | tadpole - to the magnolia sole | TOO_EARLY: only 1 word(s) before dash |
| 193 | hiphop | aggressive | Verse 3 | whole life building - on this fundament | BREAK_AFTER_VERB_ING: "building - on" |
| 194 | hiphop | dreamy | Verse 1 | authenticity - in everything I do | TOO_EARLY: only 1 word(s) before dash |
| 195 | hiphop | dreamy | Verse 1 | barrio - and the ratio | TOO_EARLY: only 1 word(s) before dash |
| 196 | hiphop | dreamy | Verse 1 | portfolio - of the domino | TOO_EARLY: only 1 word(s) before dash |
| 197 | hiphop | dreamy | Verse 2 | ricochet - on the halfway | TOO_EARLY: only 1 word(s) before dash |
| 198 | hiphop | dreamy | Verse 3 | underground - to the foreground | TOO_EARLY: only 1 word(s) before dash |
| 199 | hiphop | dreamy | Verse 3 | setback - on the racetrack | TOO_EARLY: only 1 word(s) before dash |
| 200 | hiphop | dark | Verse 3 | no delays I got nothing - to say | BREAK_AFTER_VERB_ING: "nothing - to" |

## Lines Missing Dash (6+ words, 10 total, showing 10)

- [pop/happy] Verse 2: `a lavender sky at the end of the day`
- [pop/sad] Verse 2: `a lavender sky at the end of the day`
- [hiphop/epic] Verse 2: `i break the law with a fatal flaw`
- [folk/dreamy] Verse 4: `the thunderstorm was rumbling through the mountain air`
- [folk/hopeful] Verse 4: `the thunderstorm was rumbling through the mountain air`
- [metal/melancholic] Verse 2: `the battle drums are thundering across the blackened plain`
- [metal/dreamy] Verse 2: `the battle drums are thundering across the blackened plain`
- [latin/sad] Verse 1: `the adrenaline is coursing through the summer night`
- [latin/melancholic] Verse 2: `the adrenaline is coursing through the summer night`
- [latin/epic] Verse 1: `the adrenaline is coursing through the summer night`

## Correctly Placed Dash Examples (showing 30)

- [pop/happy] `i glow along - the shore`
- [pop/happy] `I keep on wanting - just a little more`
- [pop/happy] `I fade - through the night`
- [pop/happy] `Mamma Mia here we go - again tonight`
- [pop/happy] `bubblegum lewk - and neon flame`
- [pop/happy] `and if this was a movie - we'd freeze the frame`
- [pop/happy] `the sprinklers catch the sunlight - just right`
- [pop/happy] `we glow - in the spotlight`
- [pop/happy] `the way you touch my skin - it feels so right`
- [pop/happy] `your love is like a compass - you will lead the way`
- [pop/happy] `bubblegum lewk - and neon flame`
- [pop/happy] `and if this was a movie - we'd freeze the frame`
- [pop/happy] `the sprinklers catch the sunlight - just right`
- [pop/happy] `we glow - in the spotlight`
- [pop/sad] `under skies of gold - and grey`
- [pop/sad] `I break - through the rain`
- [pop/sad] `I wish that you had chosen - just to stay`
- [pop/sad] `the corner store - that sold our cheap champagne`
- [pop/sad] `we are the fire - we are the flame`
- [pop/sad] `i need you here tonight - so hold me tight`
- [pop/sad] `nothing in this - world's the same`
- [pop/sad] `Ariana said no tears - left to cry tonight`
- [pop/sad] `i dance - in the moonlight`
- [pop/sad] `Mamma Mia here we go - again tonight`
- [pop/sad] `we are the fire - we are the flame`
- [pop/sad] `i need you here tonight - so hold me tight`
- [pop/sad] `nothing in this - world's the same`
- [pop/sad] `Ariana said no tears - left to cry tonight`
- [pop/romantic] `the mirror shows a braver - version now`
- [pop/romantic] `every lyric sounds - like you somehow`

