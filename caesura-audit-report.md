# Caesura (Dash) Placement Audit Report

Generated: 2026-04-02T19:42:12.308Z
Total song generations: 780
Total lyric lines: 16080
Lines with dash: 15573
Lines without dash: 507

---

## Overall Caesura Accuracy

| Metric | Value |
|--------|-------|
| Lines with correct dash placement | 14797 / 15573 |
| **Dash placement accuracy** | **95.02%** |
| Lines with issues (incl. missing) | 782 |
| Missing breaks (6+ word lines) | 6 |

## Issue Breakdown by Rule

| Rule | Count | Description |
|------|-------|-------------|
| TOO_EARLY | 341 | Less than 2 words before dash |
| BREAK_AFTER_VERB_ING | 332 | Dash after -ing verb before its preposition |
| SINGLE_CHAR_START | 99 | Second half starts with single char |
| BREAK_AFTER_PREPOSITION | 10 | Preposition left dangling before dash |
| MISSING_BREAK | 6 | Long line (8+) missing any dash |
| SPLITS_COMPOUND | 1 | Dash splits a compound phrase |

## Stats by Genre

| Genre | Total Lines | With Dash | Issues | Accuracy |
|-------|-------------|-----------|--------|----------|
| country | 960 | 941 | 42 | 95.5% |
| edm | 960 | 942 | 19 | 98.0% |
| folk | 960 | 954 | 64 | 93.3% |
| gospel | 1680 | 1651 | 67 | 95.9% |
| hiphop | 2400 | 2165 | 264 | 87.8% |
| indie | 1680 | 1652 | 84 | 94.9% |
| jazz | 960 | 948 | 63 | 93.4% |
| kpop | 1680 | 1637 | 35 | 97.9% |
| latin | 960 | 924 | 31 | 96.6% |
| metal | 960 | 933 | 23 | 97.5% |
| pop | 960 | 930 | 43 | 95.4% |
| rnb | 960 | 943 | 30 | 96.8% |
| rock | 960 | 953 | 17 | 98.2% |

## Stats by Mood

| Mood | Total Lines | With Dash | Issues | Accuracy |
|------|-------------|-----------|--------|----------|
| aggressive | 1876 | 1811 | 74 | 95.9% |
| dark | 1876 | 1832 | 94 | 94.9% |
| dreamy | 1876 | 1810 | 103 | 94.3% |
| epic | 1608 | 1563 | 81 | 94.8% |
| happy | 1876 | 1819 | 102 | 94.4% |
| hopeful | 1608 | 1560 | 79 | 94.9% |
| melancholic | 1608 | 1554 | 81 | 94.8% |
| romantic | 1876 | 1820 | 81 | 95.5% |
| sad | 1876 | 1804 | 87 | 95.2% |

## Stats by Section Type

| Section | Total Lines | With Dash | Issues | Accuracy |
|---------|-------------|-----------|--------|----------|
| bridge | 960 | 943 | 38 | 96.0% |
| chorus | 6480 | 6182 | 8 | 99.9% |
| intro | 240 | 236 | 57 | 75.8% |
| outro | 240 | 237 | 16 | 93.2% |
| prechorus | 240 | 239 | 4 | 98.3% |
| verse | 7920 | 7736 | 659 | 91.5% |

## Flagged Lines with Bad Dash Placement (776 total, showing 200)

| # | Genre | Mood | Section | Line | Issues |
|---|-------|------|---------|------|--------|
| 1 | pop | happy | Verse 1 | the fire burning - in my heart | BREAK_AFTER_VERB_ING: "burning - in" |
| 2 | pop | aggressive | Verse 1 | the city sleeping - in a hush | BREAK_AFTER_VERB_ING: "sleeping - in" |
| 3 | pop | dark | Chorus | I sing - into the dawn | BREAK_AFTER_VERB_ING: "sing - into" |
| 4 | pop | dark | Verse 2 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 5 | pop | dark | Chorus | I sing - into the dawn | BREAK_AFTER_VERB_ING: "sing - into" |
| 6 | pop | happy | Verse 1 | I sing - through the rain | BREAK_AFTER_VERB_ING: "sing - through" |
| 7 | pop | happy | Verse 2 | I sing - in the spotlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 8 | pop | romantic | Verse 1 | I sing - across the sky | BREAK_AFTER_VERB_ING: "sing - across" |
| 9 | pop | romantic | Verse 1 | channeling - Beyonce with the spotlight bright | TOO_EARLY: only 1 word(s) before dash |
| 10 | pop | aggressive | Verse 1 | channeling - Beyonce with the spotlight bright | TOO_EARLY: only 1 word(s) before dash |
| 11 | pop | dreamy | Verse 1 | sending - signals through the atmosphere | TOO_EARLY: only 1 word(s) before dash |
| 12 | pop | dreamy | Verse 2 | unforgettable - the way you illuminate | TOO_EARLY: only 1 word(s) before dash |
| 13 | pop | dreamy | Verse 2 | irresistible - I cannot help but celebrate | TOO_EARLY: only 1 word(s) before dash |
| 14 | pop | epic | Chorus | irresistible - I cannot help but celebrate | TOO_EARLY: only 1 word(s) before dash |
| 15 | pop | epic | Chorus | irresistible - I cannot help but celebrate | TOO_EARLY: only 1 word(s) before dash |
| 16 | pop | hopeful | Verse 1 | appreciate - the moments of illumination | TOO_EARLY: only 1 word(s) before dash |
| 17 | pop | happy | Verse 1 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 18 | pop | aggressive | Verse 2 | I was looking - for a sign | BREAK_AFTER_VERB_ING: "looking - for" |
| 19 | pop | epic | Verse 1 | I was looking - for a sign | BREAK_AFTER_VERB_ING: "looking - for" |
| 20 | pop | sad | Verse 1 | the city sleeping - in a hush | BREAK_AFTER_VERB_ING: "sleeping - in" |
| 21 | pop | sad | Verse 1 | the neon fading - in a blush | BREAK_AFTER_VERB_ING: "fading - in" |
| 22 | pop | romantic | Verse 2 | i saw the colors painting - at the break of day | BREAK_AFTER_VERB_ING: "painting - at" |
| 23 | pop | dreamy | Verse 1 | wondering - just how we got this far | TOO_EARLY: only 1 word(s) before dash |
| 24 | pop | hopeful | Verse 1 | the neon fading - in a blush | BREAK_AFTER_VERB_ING: "fading - in" |
| 25 | pop | hopeful | Verse 1 | the city sleeping - in a hush | BREAK_AFTER_VERB_ING: "sleeping - in" |
| 26 | pop | hopeful | Verse 1 | the feeling - of the golden crush | BREAK_AFTER_VERB_ING: "feeling - of" |
| 27 | pop | hopeful | Verse 2 | unforgettable - the way you illuminate | TOO_EARLY: only 1 word(s) before dash |
| 28 | pop | sad | Verse 1 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 29 | pop | aggressive | Verse 1 | beautiful - and everything I ever anticipated | TOO_EARLY: only 1 word(s) before dash |
| 30 | pop | dark | Verse 2 | I sing - into the dawn | BREAK_AFTER_VERB_ING: "sing - into" |
| 31 | pop | melancholic | Verse 1 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 32 | pop | melancholic | Verse 1 | sending - signals through the atmosphere | TOO_EARLY: only 1 word(s) before dash |
| 33 | pop | melancholic | Verse 2 | everything - will be alright | TOO_EARLY: only 1 word(s) before dash |
| 34 | pop | sad | Verse 1 | everything - will be alright | TOO_EARLY: only 1 word(s) before dash |
| 35 | pop | dark | Verse 2 | i saw the colors painting - at the break of day | BREAK_AFTER_VERB_ING: "painting - at" |
| 36 | pop | hopeful | Verse 2 | champagne bubbles rising - to the beat | BREAK_AFTER_VERB_ING: "rising - to" |
| 37 | pop | melancholic | Verse 2 | polaroid memories fading - to gold | BREAK_AFTER_VERB_ING: "fading - to" |
| 38 | pop | happy | Verse 1 | sending - signals through the atmosphere | TOO_EARLY: only 1 word(s) before dash |
| 39 | pop | happy | Verse 2 | beautiful - and everything I ever anticipated | TOO_EARLY: only 1 word(s) before dash |
| 40 | pop | sad | Chorus | I sing - in the moonlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 41 | pop | sad | Chorus | I sing - in the moonlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 42 | pop | dreamy | Chorus | I sing - in the moonlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 43 | pop | dreamy | Chorus | I sing - in the moonlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 44 | hiphop | happy | Verse 1 | roadkill - to the overkill | TOO_EARLY: only 1 word(s) before dash |
| 45 | hiphop | happy | Verse 1 | diamond - in the rough reveal | TOO_EARLY: only 1 word(s) before dash |
| 46 | hiphop | happy | Verse 2 | capitalized - on every single situation | TOO_EARLY: only 1 word(s) before dash |
| 47 | hiphop | happy | Verse 2 | globalization - of the sensation | TOO_EARLY: only 1 word(s) before dash |
| 48 | hiphop | happy | Verse 2 | turnin' - the whole ship around | TOO_EARLY: only 1 word(s) before dash |
| 49 | hiphop | happy | Verse 3 | mesmerize - when i harmonize | TOO_EARLY: only 1 word(s) before dash |
| 50 | hiphop | happy | Verse 3 | spellbound - by the sound around | TOO_EARLY: only 1 word(s) before dash |
| 51 | hiphop | sad | Verse 1 | centerfold - of the household | TOO_EARLY: only 1 word(s) before dash |
| 52 | hiphop | sad | Verse 2 | renaissance - the jubilee beyonce | TOO_EARLY: only 1 word(s) before dash |
| 53 | hiphop | sad | Verse 2 | castaway - on the waterway | TOO_EARLY: only 1 word(s) before dash |
| 54 | hiphop | sad | Verse 3 | spaceship - and the rocket ship | TOO_EARLY: only 1 word(s) before dash |
| 55 | hiphop | romantic | Verse 1 | remote - control of the whole console | TOO_EARLY: only 1 word(s) before dash |
| 56 | hiphop | romantic | Verse 2 | I was dreaming - of the sellout | BREAK_AFTER_VERB_ING: "dreaming - of" |
| 57 | hiphop | aggressive | Verse 1 | backseat - to the elite | TOO_EARLY: only 1 word(s) before dash |
| 58 | hiphop | aggressive | Verse 1 | intimidation - never slowed my acceleration | TOO_EARLY: only 1 word(s) before dash |
| 59 | hiphop | aggressive | Verse 2 | envelope - of the isotope | TOO_EARLY: only 1 word(s) before dash |
| 60 | hiphop | aggressive | Verse 3 | eliminated - every obstacle with precision | TOO_EARLY: only 1 word(s) before dash |
| 61 | hiphop | dreamy | Verse 1 | minecraft - the avenue breakthrough | TOO_EARLY: only 1 word(s) before dash |
| 62 | hiphop | dreamy | Verse 2 | copyright - on the hindsight | TOO_EARLY: only 1 word(s) before dash |
| 63 | hiphop | dark | Verse 2 | surname - became a brand name | TOO_EARLY: only 1 word(s) before dash |
| 64 | hiphop | dark | Verse 3 | setback - in the comeback | TOO_EARLY: only 1 word(s) before dash |
| 65 | hiphop | dark | Verse 3 | counterattack - on the railroad track | TOO_EARLY: only 1 word(s) before dash |
| 66 | hiphop | epic | Verse 2 | breaking - free from the blindfold | TOO_EARLY: only 1 word(s) before dash |
| 67 | hiphop | epic | Verse 2 | blindfold - on the scaffold bold | TOO_EARLY: only 1 word(s) before dash |
| 68 | hiphop | epic | Verse 2 | manifold - on the threshold hold | TOO_EARLY: only 1 word(s) before dash |
| 69 | hiphop | epic | Verse 3 | ricochet - on the runway bouquet | TOO_EARLY: only 1 word(s) before dash |
| 70 | hiphop | epic | Verse 3 | negligee - on the resume | TOO_EARLY: only 1 word(s) before dash |
| 71 | hiphop | epic | Verse 3 | castaway - on the waterway | TOO_EARLY: only 1 word(s) before dash |
| 72 | hiphop | epic | Verse 3 | fiance - in the entryway | TOO_EARLY: only 1 word(s) before dash |
| 73 | hiphop | hopeful | Verse 1 | eliminated - every obstacle with precision | TOO_EARLY: only 1 word(s) before dash |
| 74 | hiphop | hopeful | Verse 2 | rawhide - on the hillside stride | TOO_EARLY: only 1 word(s) before dash |
| 75 | hiphop | hopeful | Verse 2 | gymnasium - from the whim | TOO_EARLY: only 1 word(s) before dash |
| 76 | hiphop | hopeful | Verse 2 | empirica - of the america | TOO_EARLY: only 1 word(s) before dash |
| 77 | hiphop | hopeful | Verse 3 | the warrior rising - from the dust | BREAK_AFTER_VERB_ING: "rising - from" |
| 78 | hiphop | hopeful | Verse 3 | underdogs - in the cogs | TOO_EARLY: only 1 word(s) before dash |
| 79 | hiphop | melancholic | Verse 1 | dumbstruck - and the starstruck | TOO_EARLY: only 1 word(s) before dash |
| 80 | hiphop | melancholic | Verse 1 | woodchuck - in the dump truck | TOO_EARLY: only 1 word(s) before dash |
| 81 | hiphop | melancholic | Verse 2 | earthbound - to the skybound | TOO_EARLY: only 1 word(s) before dash |
| 82 | hiphop | melancholic | Verse 2 | housebound - in the background | TOO_EARLY: only 1 word(s) before dash |
| 83 | hiphop | melancholic | Verse 3 | I built my searchlight from nothing - to foresight | BREAK_AFTER_VERB_ING: "nothing - to" |
| 84 | hiphop | happy | Verse 1 | negligee - on the resume | TOO_EARLY: only 1 word(s) before dash |
| 85 | hiphop | happy | Verse 2 | rejoice - with the right choice | TOO_EARLY: only 1 word(s) before dash |
| 86 | hiphop | happy | Verse 2 | diamond in the rough - a jewel | SINGLE_CHAR_START: "- a" |
| 87 | hiphop | happy | Verse 3 | spellbound - by the sound around | TOO_EARLY: only 1 word(s) before dash |
| 88 | hiphop | happy | Verse 3 | showdown - countdown to the lockdown | TOO_EARLY: only 1 word(s) before dash |
| 89 | hiphop | sad | Verse 1 | sundown - in the boomtown | TOO_EARLY: only 1 word(s) before dash |
| 90 | hiphop | sad | Verse 2 | campaign - on the mountain terrain | TOO_EARLY: only 1 word(s) before dash |
| 91 | hiphop | sad | Verse 2 | the matrix unplugging - from the mainframe brain | BREAK_AFTER_VERB_ING: "unplugging - from" |
| 92 | hiphop | sad | Verse 3 | riding - in the limousine | BREAK_AFTER_VERB_ING: "riding - in"; TOO_EARLY: only 1 word(s) before dash |
| 93 | hiphop | sad | Verse 3 | godfather - i'll make him decline | TOO_EARLY: only 1 word(s) before dash |
| 94 | hiphop | romantic | Verse 2 | sidebar - from the repertoire | TOO_EARLY: only 1 word(s) before dash |
| 95 | hiphop | romantic | Verse 3 | chimichangas - the whirlpool deadpool | TOO_EARLY: only 1 word(s) before dash |
| 96 | hiphop | aggressive | Verse 2 | newfound - on the campground | TOO_EARLY: only 1 word(s) before dash |
| 97 | hiphop | aggressive | Verse 2 | midstream - of the laser beam | TOO_EARLY: only 1 word(s) before dash |
| 98 | hiphop | aggressive | Verse 3 | grammar - in the glamour | TOO_EARLY: only 1 word(s) before dash |
| 99 | hiphop | dreamy | Verse 1 | mistletoe - in the bungalow | TOO_EARLY: only 1 word(s) before dash |
| 100 | hiphop | dreamy | Verse 2 | genocide - of the pesticide | TOO_EARLY: only 1 word(s) before dash |
| 101 | hiphop | dreamy | Verse 3 | potluck - and the nunchuck | TOO_EARLY: only 1 word(s) before dash |
| 102 | hiphop | dreamy | Verse 3 | sundown - in the boomtown | TOO_EARLY: only 1 word(s) before dash |
| 103 | hiphop | dreamy | Verse 3 | awestruck - by the lightning struck | TOO_EARLY: only 1 word(s) before dash |
| 104 | hiphop | dark | Verse 2 | sunshine - after the decline | TOO_EARLY: only 1 word(s) before dash |
| 105 | hiphop | dark | Verse 2 | alkaline - and the landmine fine | TOO_EARLY: only 1 word(s) before dash |
| 106 | hiphop | dark | Verse 3 | standing - tall in the spotlight | TOO_EARLY: only 1 word(s) before dash |
| 107 | hiphop | epic | Verse 2 | party like - a bacardi | SINGLE_CHAR_START: "- a" |
| 108 | hiphop | hopeful | Verse 1 | copyright - on the hindsight | TOO_EARLY: only 1 word(s) before dash |
| 109 | hiphop | hopeful | Verse 1 | shellshock - but i never stop | TOO_EARLY: only 1 word(s) before dash |
| 110 | hiphop | hopeful | Verse 1 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 111 | hiphop | hopeful | Verse 3 | kazaam - magic shaquille o'neal | TOO_EARLY: only 1 word(s) before dash |
| 112 | hiphop | melancholic | Verse 1 | baddest - on the magazine | TOO_EARLY: only 1 word(s) before dash |
| 113 | hiphop | melancholic | Verse 1 | diamond - in the rough reveal | TOO_EARLY: only 1 word(s) before dash |
| 114 | hiphop | melancholic | Verse 2 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 115 | hiphop | melancholic | Verse 2 | castaway - on the waterway | TOO_EARLY: only 1 word(s) before dash |
| 116 | hiphop | happy | Verse 1 | wholesale - on the nightingale | TOO_EARLY: only 1 word(s) before dash |
| 117 | hiphop | happy | Verse 1 | betrayal - on the holy grail | TOO_EARLY: only 1 word(s) before dash |
| 118 | hiphop | happy | Verse 2 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 119 | hiphop | happy | Verse 3 | merry-go-round - on the playground | TOO_EARLY: only 1 word(s) before dash |
| 120 | hiphop | happy | Verse 3 | outbound - from the homebound | TOO_EARLY: only 1 word(s) before dash |
| 121 | hiphop | sad | Verse 1 | namesake - of the double take | TOO_EARLY: only 1 word(s) before dash |
| 122 | hiphop | sad | Verse 2 | mindset - on the asset set | TOO_EARLY: only 1 word(s) before dash |
| 123 | hiphop | sad | Verse 2 | absurd - like a mockingbird | TOO_EARLY: only 1 word(s) before dash |
| 124 | hiphop | romantic | Verse 2 | I built my spellbind from nothing - to mankind | BREAK_AFTER_VERB_ING: "nothing - to" |
| 125 | hiphop | romantic | Verse 3 | everything - i touch is an earthquake | TOO_EARLY: only 1 word(s) before dash |
| 126 | hiphop | aggressive | Verse 1 | blaspheme - in the mainstream beam | TOO_EARLY: only 1 word(s) before dash |
| 127 | hiphop | aggressive | Verse 3 | betrayal - on the holy grail | TOO_EARLY: only 1 word(s) before dash |
| 128 | hiphop | dreamy | Verse 1 | sophomore - on the dance floor | TOO_EARLY: only 1 word(s) before dash |
| 129 | hiphop | dreamy | Verse 1 | editor - of the senator | TOO_EARLY: only 1 word(s) before dash |
| 130 | hiphop | dreamy | Verse 2 | protocol - of the free-for-all | TOO_EARLY: only 1 word(s) before dash |
| 131 | hiphop | dreamy | Verse 2 | loophole - in the protocol | TOO_EARLY: only 1 word(s) before dash |
| 132 | hiphop | dreamy | Verse 2 | cannonball - at the carnival | TOO_EARLY: only 1 word(s) before dash |
| 133 | hiphop | dreamy | Verse 3 | gourmet - on the relay hooray | TOO_EARLY: only 1 word(s) before dash |
| 134 | hiphop | dreamy | Verse 3 | matinee - in the cabaret | TOO_EARLY: only 1 word(s) before dash |
| 135 | hiphop | dark | Verse 1 | flashing - lights kanye west | TOO_EARLY: only 1 word(s) before dash |
| 136 | hiphop | dark | Verse 2 | grinding - hard i represent | TOO_EARLY: only 1 word(s) before dash |
| 137 | hiphop | dark | Verse 2 | walking - proof of the experiment | TOO_EARLY: only 1 word(s) before dash |
| 138 | hiphop | dark | Verse 3 | lifelong - in the singalong song | TOO_EARLY: only 1 word(s) before dash |
| 139 | hiphop | dark | Verse 3 | independent - on my own ascent | TOO_EARLY: only 1 word(s) before dash |
| 140 | hiphop | epic | Verse 1 | worksheet - on the spreadsheet neat | TOO_EARLY: only 1 word(s) before dash |
| 141 | hiphop | epic | Verse 2 | merry-go-round - of the breakdown | TOO_EARLY: only 1 word(s) before dash |
| 142 | hiphop | hopeful | Verse 1 | diamond - in the rough reveal | TOO_EARLY: only 1 word(s) before dash |
| 143 | hiphop | hopeful | Verse 1 | I built my minotaur from nothing - to senator | BREAK_AFTER_VERB_ING: "nothing - to" |
| 144 | hiphop | hopeful | Verse 2 | accumulated - wealth through dedication | TOO_EARLY: only 1 word(s) before dash |
| 145 | hiphop | hopeful | Verse 2 | confrontation - at the graduation | TOO_EARLY: only 1 word(s) before dash |
| 146 | hiphop | hopeful | Verse 2 | paradise - behind my eyes | TOO_EARLY: only 1 word(s) before dash |
| 147 | hiphop | hopeful | Verse 2 | education - of the population | TOO_EARLY: only 1 word(s) before dash |
| 148 | hiphop | hopeful | Verse 2 | energize - and i'll supervise | TOO_EARLY: only 1 word(s) before dash |
| 149 | hiphop | hopeful | Verse 3 | bravado - in the avocado | TOO_EARLY: only 1 word(s) before dash |
| 150 | hiphop | hopeful | Verse 3 | soundtrack - of the city motown | TOO_EARLY: only 1 word(s) before dash |
| 151 | hiphop | hopeful | Verse 3 | embryo - to the dynamo flow | TOO_EARLY: only 1 word(s) before dash |
| 152 | hiphop | melancholic | Verse 3 | goodwill - on the windmill | TOO_EARLY: only 1 word(s) before dash |
| 153 | hiphop | melancholic | Verse 3 | automobile - on the pinwheel | TOO_EARLY: only 1 word(s) before dash |
| 154 | hiphop | happy | Verse 3 | snatch - moves from brad pitt | TOO_EARLY: only 1 word(s) before dash |
| 155 | hiphop | sad | Verse 1 | artistry - of the mystery | TOO_EARLY: only 1 word(s) before dash |
| 156 | hiphop | sad | Verse 1 | colorblind - but the vision refined | TOO_EARLY: only 1 word(s) before dash |
| 157 | hiphop | sad | Verse 1 | gentry - in the inventory | TOO_EARLY: only 1 word(s) before dash |
| 158 | hiphop | sad | Verse 1 | annihilated everything - in my trajectory | BREAK_AFTER_VERB_ING: "everything - in" |
| 159 | hiphop | sad | Verse 2 | cockatiel - on the ferris wheel | TOO_EARLY: only 1 word(s) before dash |
| 160 | hiphop | sad | Verse 3 | unconfined - by the daily grind | TOO_EARLY: only 1 word(s) before dash |
| 161 | hiphop | romantic | Verse 1 | exhale - on the detail trail | TOO_EARLY: only 1 word(s) before dash |
| 162 | hiphop | romantic | Verse 1 | operation - doomsday mf doom | TOO_EARLY: only 1 word(s) before dash |
| 163 | hiphop | romantic | Verse 2 | assassination - of the reputation | TOO_EARLY: only 1 word(s) before dash |
| 164 | hiphop | romantic | Verse 3 | they tried to box me in - but I broke the frame | BREAK_AFTER_PREPOSITION: "in - but" |
| 165 | hiphop | aggressive | Verse 1 | intimidation - is my reputation | TOO_EARLY: only 1 word(s) before dash |
| 166 | hiphop | dark | Verse 1 | holiday - in the hideaway | TOO_EARLY: only 1 word(s) before dash |
| 167 | hiphop | dark | Verse 2 | legend - status in the town | TOO_EARLY: only 1 word(s) before dash |
| 168 | hiphop | dark | Verse 2 | cornmeal - of the sex appeal | TOO_EARLY: only 1 word(s) before dash |
| 169 | hiphop | dark | Verse 2 | oatmeal - on the windshield feel | TOO_EARLY: only 1 word(s) before dash |
| 170 | hiphop | dark | Verse 3 | odyssey - of the bourgeoisie | TOO_EARLY: only 1 word(s) before dash |
| 171 | hiphop | dark | Verse 3 | masterpiece - for all to see | TOO_EARLY: only 1 word(s) before dash |
| 172 | hiphop | epic | Verse 2 | midnight - in the copyright | TOO_EARLY: only 1 word(s) before dash |
| 173 | hiphop | epic | Verse 2 | fortnight - in the neon light | TOO_EARLY: only 1 word(s) before dash |
| 174 | hiphop | epic | Verse 2 | shellshock - but i never stop | TOO_EARLY: only 1 word(s) before dash |
| 175 | hiphop | epic | Verse 3 | apparently - i'm j. cole | TOO_EARLY: only 1 word(s) before dash |
| 176 | hiphop | epic | Verse 3 | parole - from the rigmarole | TOO_EARLY: only 1 word(s) before dash |
| 177 | hiphop | hopeful | Verse 1 | impossible - is nothing ali | TOO_EARLY: only 1 word(s) before dash |
| 178 | hiphop | hopeful | Verse 1 | masterpiece - for all to see | TOO_EARLY: only 1 word(s) before dash |
| 179 | hiphop | hopeful | Verse 1 | guarantee - of the jubilee | TOO_EARLY: only 1 word(s) before dash |
| 180 | hiphop | hopeful | Verse 2 | defying - all the gravity | TOO_EARLY: only 1 word(s) before dash |
| 181 | hiphop | hopeful | Verse 3 | headline - on the grapevine | TOO_EARLY: only 1 word(s) before dash |
| 182 | hiphop | melancholic | Verse 2 | I been getting - to the bag | BREAK_AFTER_VERB_ING: "getting - to" |
| 183 | hiphop | melancholic | Verse 3 | the strategy - a state of mind | SINGLE_CHAR_START: "- a" |
| 184 | hiphop | melancholic | Verse 3 | reality - beyond the scheme | TOO_EARLY: only 1 word(s) before dash |
| 185 | hiphop | happy | Verse 2 | paradise - behind my eyes | TOO_EARLY: only 1 word(s) before dash |
| 186 | hiphop | happy | Verse 2 | undermined - but i'm still refined | TOO_EARLY: only 1 word(s) before dash |
| 187 | hiphop | sad | Verse 1 | standing - tall in the spotlight | TOO_EARLY: only 1 word(s) before dash |
| 188 | hiphop | sad | Verse 1 | cliche - in the alleyway | TOO_EARLY: only 1 word(s) before dash |
| 189 | hiphop | sad | Verse 2 | loophole - in the protocol | TOO_EARLY: only 1 word(s) before dash |
| 190 | hiphop | sad | Verse 2 | unstoppable - and i'm breaking free | TOO_EARLY: only 1 word(s) before dash |
| 191 | hiphop | romantic | Verse 1 | protege - on the getaway | TOO_EARLY: only 1 word(s) before dash |
| 192 | hiphop | romantic | Verse 1 | holiday - in the hideaway | TOO_EARLY: only 1 word(s) before dash |
| 193 | hiphop | romantic | Verse 1 | risque - on the croquet | TOO_EARLY: only 1 word(s) before dash |
| 194 | hiphop | romantic | Verse 2 | membrane - of the campaign | TOO_EARLY: only 1 word(s) before dash |
| 195 | hiphop | romantic | Verse 2 | the matrix unplugging - from the mainframe brain | BREAK_AFTER_VERB_ING: "unplugging - from" |
| 196 | hiphop | romantic | Verse 2 | weather vane spinning - in the acid rain | BREAK_AFTER_VERB_ING: "spinning - in" |
| 197 | hiphop | romantic | Verse 2 | campaign - trail to the champagne | TOO_EARLY: only 1 word(s) before dash |
| 198 | hiphop | romantic | Verse 2 | lemonade - and gucci mane | TOO_EARLY: only 1 word(s) before dash |
| 199 | hiphop | romantic | Verse 3 | sundown - in the boomtown | TOO_EARLY: only 1 word(s) before dash |
| 200 | hiphop | romantic | Verse 3 | merry-go-round - of the breakdown | TOO_EARLY: only 1 word(s) before dash |

## Lines Missing Dash (6+ words, 6 total, showing 6)

- [folk/romantic] Verse 4: `the thunderstorm was rumbling through the mountain air`
- [metal/epic] Verse 2: `the battle drums are thundering across the blackened plain`
- [metal/dreamy] Verse 2: `the battle drums are thundering across the blackened plain`
- [latin/sad] Verse 2: `the adrenaline is coursing through the summer night`
- [latin/dreamy] Verse 2: `the adrenaline is coursing through the summer night`
- [latin/melancholic] Verse 2: `the adrenaline is coursing through the summer night`

## Correctly Placed Dash Examples (showing 30)

- [pop/happy] `the pieces of my world - just fall apart`
- [pop/happy] `I heard our song - in someone else's car`
- [pop/happy] `the summer breeze keeps whispering - your name into my ear`
- [pop/happy] `we came to captivate we - came to know`
- [pop/happy] `hold on to me - and don't let go`
- [pop/happy] `the sunset wrote our names - across the cloudless blue`
- [pop/happy] `I counted shooting stars - and named them after you`
- [pop/happy] `a sunset dip inside - the ocean blue`
- [pop/happy] `the sunflower field - reminded me of you`
- [pop/happy] `I drift - through the rain`
- [pop/happy] `Sabrina's nonsense - running through my brain`
- [pop/happy] `we came to captivate we - came to know`
- [pop/happy] `hold on to me - and don't let go`
- [pop/happy] `the sunset wrote our names - across the cloudless blue`
- [pop/happy] `I counted shooting stars - and named them after you`
- [pop/sad] `I melt - in the spotlight`
- [pop/sad] `I rise - along the shore`
- [pop/sad] `the sprinklers catch the sunlight - just right`
- [pop/sad] `I keep on wanting - just a little more`
- [pop/sad] `you turned a comma - into an exclamation`
- [pop/sad] `I painted over all - the cracks we made`
- [pop/sad] `tonight we - own the constellation`
- [pop/sad] `you were the remix - of my quietest day`
- [pop/sad] `I bloom - through the night`
- [pop/sad] `you painted over every shade - of grey`
- [pop/sad] `I crash - in the moonlight`
- [pop/sad] `you turned a comma - into an exclamation`
- [pop/sad] `I painted over all - the cracks we made`
- [pop/sad] `tonight we - own the constellation`
- [pop/romantic] `the crowd went silent - when our eyes aligned`

