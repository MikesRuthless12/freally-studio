# Caesura (Dash) Placement Audit Report

Generated: 2026-03-26T18:30:05.795Z
Total song generations: 780
Total lyric lines: 16080
Lines with dash: 15581
Lines without dash: 499

---

## Overall Caesura Accuracy

| Metric | Value |
|--------|-------|
| Lines with correct dash placement | 14818 / 15581 |
| **Dash placement accuracy** | **95.10%** |
| Lines with issues (incl. missing) | 772 |
| Missing breaks (6+ word lines) | 9 |

## Issue Breakdown by Rule

| Rule | Count | Description |
|------|-------|-------------|
| TOO_EARLY | 340 | Less than 2 words before dash |
| BREAK_AFTER_VERB_ING | 303 | Dash after -ing verb before its preposition |
| SINGLE_CHAR_START | 123 | Second half starts with single char |
| MISSING_BREAK | 9 | Long line (8+) missing any dash |
| BREAK_AFTER_PREPOSITION | 5 | Preposition left dangling before dash |
| SPLITS_COMPOUND | 4 | Dash splits a compound phrase |

## Stats by Genre

| Genre | Total Lines | With Dash | Issues | Accuracy |
|-------|-------------|-----------|--------|----------|
| country | 960 | 948 | 39 | 95.9% |
| edm | 960 | 937 | 22 | 97.7% |
| folk | 960 | 951 | 60 | 93.7% |
| gospel | 1680 | 1656 | 65 | 96.1% |
| hiphop | 2400 | 2198 | 255 | 88.4% |
| indie | 1680 | 1639 | 84 | 94.9% |
| jazz | 960 | 951 | 75 | 92.1% |
| kpop | 1680 | 1642 | 30 | 98.2% |
| latin | 960 | 932 | 24 | 97.4% |
| metal | 960 | 927 | 23 | 97.5% |
| pop | 960 | 906 | 45 | 95.0% |
| rnb | 960 | 936 | 24 | 97.4% |
| rock | 960 | 958 | 26 | 97.3% |

## Stats by Mood

| Mood | Total Lines | With Dash | Issues | Accuracy |
|------|-------------|-----------|--------|----------|
| aggressive | 1876 | 1796 | 76 | 95.8% |
| dark | 1876 | 1821 | 87 | 95.2% |
| dreamy | 1876 | 1808 | 105 | 94.2% |
| epic | 1608 | 1554 | 80 | 94.9% |
| happy | 1876 | 1835 | 99 | 94.6% |
| hopeful | 1608 | 1567 | 71 | 95.5% |
| melancholic | 1608 | 1552 | 62 | 96.0% |
| romantic | 1876 | 1826 | 101 | 94.5% |
| sad | 1876 | 1822 | 91 | 95.0% |

## Stats by Section Type

| Section | Total Lines | With Dash | Issues | Accuracy |
|---------|-------------|-----------|--------|----------|
| bridge | 960 | 944 | 48 | 94.9% |
| chorus | 6480 | 6230 | 0 | 100.0% |
| intro | 240 | 238 | 59 | 75.2% |
| outro | 240 | 237 | 12 | 94.9% |
| prechorus | 240 | 239 | 3 | 98.7% |
| verse | 7920 | 7693 | 650 | 91.6% |

## Flagged Lines with Bad Dash Placement (763 total, showing 200)

| # | Genre | Mood | Section | Line | Issues |
|---|-------|------|---------|------|--------|
| 1 | pop | sad | Verse 1 | i sing - in the moonlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 2 | pop | sad | Verse 2 | the fire burning - in my heart | BREAK_AFTER_VERB_ING: "burning - in" |
| 3 | pop | sad | Verse 2 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 4 | pop | dreamy | Verse 2 | I keep searching - for a way | BREAK_AFTER_VERB_ING: "searching - for" |
| 5 | pop | dark | Verse 2 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 6 | pop | epic | Verse 2 | unforgettable - the way you illuminate | TOO_EARLY: only 1 word(s) before dash |
| 7 | pop | hopeful | Verse 1 | I traced the skyline thinking - of your laugh | BREAK_AFTER_VERB_ING: "thinking - of" |
| 8 | pop | happy | Verse 1 | the neon fading - in a blush | BREAK_AFTER_VERB_ING: "fading - in" |
| 9 | pop | happy | Verse 1 | the feeling - of the golden crush | BREAK_AFTER_VERB_ING: "feeling - of" |
| 10 | pop | happy | Verse 2 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 11 | pop | sad | Verse 1 | we sing - in the moonlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 12 | pop | aggressive | Verse 1 | sending - signals through the atmosphere | TOO_EARLY: only 1 word(s) before dash |
| 13 | pop | dreamy | Verse 1 | sending - signals through the atmosphere | TOO_EARLY: only 1 word(s) before dash |
| 14 | pop | dark | Verse 1 | rewatching rom-coms looking - for a sign | BREAK_AFTER_VERB_ING: "looking - for" |
| 15 | pop | epic | Verse 1 | the neon fading - in a blush | BREAK_AFTER_VERB_ING: "fading - in" |
| 16 | pop | happy | Verse 2 | counting - every single star | TOO_EARLY: only 1 word(s) before dash |
| 17 | pop | happy | Verse 2 | wondering - just how we got this far | TOO_EARLY: only 1 word(s) before dash |
| 18 | pop | melancholic | Verse 2 | I keep searching - for a way | BREAK_AFTER_VERB_ING: "searching - for" |
| 19 | pop | happy | Verse 2 | I was looking - for a sign | BREAK_AFTER_VERB_ING: "looking - for" |
| 20 | pop | sad | Verse 2 | wondering - just how we got this far | TOO_EARLY: only 1 word(s) before dash |
| 21 | pop | romantic | Verse 2 | the feeling - of the golden crush | BREAK_AFTER_VERB_ING: "feeling - of" |
| 22 | pop | aggressive | Verse 2 | I keep searching - for a way | BREAK_AFTER_VERB_ING: "searching - for" |
| 23 | pop | dreamy | Verse 2 | everything - will be alright | TOO_EARLY: only 1 word(s) before dash |
| 24 | pop | dark | Verse 1 | memories - from another day | TOO_EARLY: only 1 word(s) before dash |
| 25 | pop | hopeful | Verse 2 | the memories replay - a broken heart | SINGLE_CHAR_START: "- a" |
| 26 | pop | melancholic | Verse 1 | we sing - in the moonlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 27 | pop | romantic | Verse 1 | the city sleeping - in a hush | BREAK_AFTER_VERB_ING: "sleeping - in" |
| 28 | pop | romantic | Verse 1 | the neon fading - in a blush | BREAK_AFTER_VERB_ING: "fading - in" |
| 29 | pop | romantic | Verse 1 | the feeling - of the golden crush | BREAK_AFTER_VERB_ING: "feeling - of" |
| 30 | pop | dreamy | Verse 2 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 31 | pop | dark | Verse 2 | singing - like Adele with tears on my face | TOO_EARLY: only 1 word(s) before dash |
| 32 | pop | epic | Verse 2 | your smile could light - a city burning bright | SINGLE_CHAR_START: "- a" |
| 33 | pop | hopeful | Verse 2 | the neon fading - in a blush | BREAK_AFTER_VERB_ING: "fading - in" |
| 34 | pop | melancholic | Verse 1 | i sing - in the spotlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 35 | pop | happy | Verse 2 | my heart is pounding - with the beat | BREAK_AFTER_VERB_ING: "pounding - with" |
| 36 | pop | sad | Verse 1 | i sing - in the moonlight | BREAK_AFTER_VERB_ING: "sing - in" |
| 37 | pop | dark | Verse 1 | the memories replay - a broken heart | SINGLE_CHAR_START: "- a" |
| 38 | pop | romantic | Verse 2 | the hardest thing - to do is let it go | BREAK_AFTER_VERB_ING: "thing - to" |
| 39 | pop | aggressive | Verse 1 | channeling - Beyonce with the spotlight bright | TOO_EARLY: only 1 word(s) before dash |
| 40 | pop | aggressive | Verse 2 | singing - like Adele with tears on my face | TOO_EARLY: only 1 word(s) before dash |
| 41 | pop | dark | Verse 1 | beautiful - and everything I ever anticipated | TOO_EARLY: only 1 word(s) before dash |
| 42 | pop | dark | Verse 2 | everything - will be alright | TOO_EARLY: only 1 word(s) before dash |
| 43 | hiphop | happy | Verse 1 | matrix - of the analytics | TOO_EARLY: only 1 word(s) before dash |
| 44 | hiphop | happy | Verse 3 | legend - status in the town | TOO_EARLY: only 1 word(s) before dash |
| 45 | hiphop | sad | Verse 1 | headline - on the dateline | TOO_EARLY: only 1 word(s) before dash |
| 46 | hiphop | sad | Verse 1 | mezzanine - of the tangerine | TOO_EARLY: only 1 word(s) before dash |
| 47 | hiphop | sad | Verse 1 | intertwine - the grapevine wine | TOO_EARLY: only 1 word(s) before dash |
| 48 | hiphop | sad | Verse 3 | betrayal - on the holy grail | TOO_EARLY: only 1 word(s) before dash |
| 49 | hiphop | romantic | Verse 1 | accord - and the record lord | TOO_EARLY: only 1 word(s) before dash |
| 50 | hiphop | romantic | Verse 1 | hummingbird - in the word | TOO_EARLY: only 1 word(s) before dash |
| 51 | hiphop | romantic | Verse 2 | living - in the mainstream | BREAK_AFTER_VERB_ING: "living - in"; TOO_EARLY: only 1 word(s) before dash |
| 52 | hiphop | romantic | Verse 2 | flowing - like the golden stream | TOO_EARLY: only 1 word(s) before dash |
| 53 | hiphop | romantic | Verse 2 | blaspheme - in the mainstream beam | TOO_EARLY: only 1 word(s) before dash |
| 54 | hiphop | romantic | Verse 2 | supreme - team on the extreme | TOO_EARLY: only 1 word(s) before dash |
| 55 | hiphop | romantic | Verse 3 | mario jumping - to the hall of fame | BREAK_AFTER_VERB_ING: "jumping - to" |
| 56 | hiphop | aggressive | Verse 2 | redemption - song bob marley | TOO_EARLY: only 1 word(s) before dash |
| 57 | hiphop | aggressive | Verse 3 | namesake - of the double take | TOO_EARLY: only 1 word(s) before dash |
| 58 | hiphop | aggressive | Verse 3 | blanket - in the thankful | TOO_EARLY: only 1 word(s) before dash |
| 59 | hiphop | dreamy | Verse 1 | blaspheme - in the mainstream beam | TOO_EARLY: only 1 word(s) before dash |
| 60 | hiphop | dreamy | Verse 1 | esteem - from the downstream stream | TOO_EARLY: only 1 word(s) before dash |
| 61 | hiphop | dreamy | Verse 1 | lil baby dripping - from the hip | BREAK_AFTER_VERB_ING: "dripping - from" |
| 62 | hiphop | dreamy | Verse 2 | undertow - of the vertigo | TOO_EARLY: only 1 word(s) before dash |
| 63 | hiphop | dreamy | Verse 3 | inception - deeper in the imagination | TOO_EARLY: only 1 word(s) before dash |
| 64 | hiphop | dark | Verse 2 | oversight - to the foresight | TOO_EARLY: only 1 word(s) before dash |
| 65 | hiphop | dark | Verse 2 | midstream - of the laser beam | TOO_EARLY: only 1 word(s) before dash |
| 66 | hiphop | dark | Verse 3 | they tried to box me in - but I broke the mold | BREAK_AFTER_PREPOSITION: "in - but" |
| 67 | hiphop | dark | Verse 3 | breaking - free from the blindfold | TOO_EARLY: only 1 word(s) before dash |
| 68 | hiphop | epic | Verse 1 | everything - reminds me of the lifetime | TOO_EARLY: only 1 word(s) before dash |
| 69 | hiphop | epic | Verse 1 | everything - reminds me of the daytime | TOO_EARLY: only 1 word(s) before dash |
| 70 | hiphop | epic | Verse 3 | monotone - to the ozone | TOO_EARLY: only 1 word(s) before dash |
| 71 | hiphop | epic | Verse 3 | throne - to the microphone | TOO_EARLY: only 1 word(s) before dash |
| 72 | hiphop | hopeful | Verse 1 | context - of the pretext flex | TOO_EARLY: only 1 word(s) before dash |
| 73 | hiphop | hopeful | Verse 2 | iceberg - on the spielberg | TOO_EARLY: only 1 word(s) before dash |
| 74 | hiphop | hopeful | Verse 3 | phenom - in the venom | TOO_EARLY: only 1 word(s) before dash |
| 75 | hiphop | hopeful | Verse 3 | superstition - like stevie wonder | TOO_EARLY: only 1 word(s) before dash |
| 76 | hiphop | melancholic | Verse 1 | alongside - on the broadside guide | TOO_EARLY: only 1 word(s) before dash |
| 77 | hiphop | melancholic | Verse 1 | genocide - of the pesticide | TOO_EARLY: only 1 word(s) before dash |
| 78 | hiphop | melancholic | Verse 2 | pioneer - and the cavalier | TOO_EARLY: only 1 word(s) before dash |
| 79 | hiphop | melancholic | Verse 2 | exhale - on the detail trail | TOO_EARLY: only 1 word(s) before dash |
| 80 | hiphop | melancholic | Verse 2 | frontier - of the premier career | TOO_EARLY: only 1 word(s) before dash |
| 81 | hiphop | happy | Verse 1 | hardcore - to the very core | TOO_EARLY: only 1 word(s) before dash |
| 82 | hiphop | happy | Verse 1 | newsreel - of the ordeal heal | TOO_EARLY: only 1 word(s) before dash |
| 83 | hiphop | happy | Verse 2 | handspring - to the offspring | BREAK_AFTER_VERB_ING: "handspring - to"; TOO_EARLY: only 1 word(s) before dash |
| 84 | hiphop | happy | Verse 2 | from the wellspring - of an inner spring | BREAK_AFTER_VERB_ING: "wellspring - of" |
| 85 | hiphop | happy | Verse 2 | offspring - of the mainspring swing | BREAK_AFTER_VERB_ING: "offspring - of"; TOO_EARLY: only 1 word(s) before dash |
| 86 | hiphop | sad | Verse 1 | iron mike step in the ring - for the fight | BREAK_AFTER_VERB_ING: "ring - for" |
| 87 | hiphop | sad | Verse 2 | monica - and quincy the protocol love and basketball | TOO_EARLY: only 1 word(s) before dash |
| 88 | hiphop | sad | Verse 3 | betrayal - on the holy grail | TOO_EARLY: only 1 word(s) before dash |
| 89 | hiphop | sad | Verse 3 | nobody cares the betrayal - a bronx tale | SINGLE_CHAR_START: "- a" |
| 90 | hiphop | romantic | Verse 2 | spotlight - on the dynamite | TOO_EARLY: only 1 word(s) before dash |
| 91 | hiphop | aggressive | Verse 1 | moonstruck - and the starstruck | TOO_EARLY: only 1 word(s) before dash |
| 92 | hiphop | aggressive | Verse 3 | reality - beyond the scheme | TOO_EARLY: only 1 word(s) before dash |
| 93 | hiphop | dreamy | Verse 1 | spreading - wings from sea to sea | TOO_EARLY: only 1 word(s) before dash |
| 94 | hiphop | dreamy | Verse 2 | fireside - on the poolside guide | TOO_EARLY: only 1 word(s) before dash |
| 95 | hiphop | dreamy | Verse 2 | suicide - to the curbside pride | TOO_EARLY: only 1 word(s) before dash |
| 96 | hiphop | dark | Verse 1 | unconfined - by the daily grind | TOO_EARLY: only 1 word(s) before dash |
| 97 | hiphop | dark | Verse 2 | the future shining - to behold | BREAK_AFTER_VERB_ING: "shining - to" |
| 98 | hiphop | dark | Verse 3 | cornerstone - of the milestone | TOO_EARLY: only 1 word(s) before dash |
| 99 | hiphop | dark | Verse 3 | cornerstone - of the unknown | TOO_EARLY: only 1 word(s) before dash |
| 100 | hiphop | epic | Verse 2 | fulfill - the drill until | TOO_EARLY: only 1 word(s) before dash |
| 101 | hiphop | epic | Verse 3 | heartbeat - of the drumbeat sweet | TOO_EARLY: only 1 word(s) before dash |
| 102 | hiphop | hopeful | Verse 3 | effortless - on the limitless | TOO_EARLY: only 1 word(s) before dash |
| 103 | hiphop | melancholic | Verse 1 | godfather sitting - with the crown | BREAK_AFTER_VERB_ING: "sitting - with" |
| 104 | hiphop | melancholic | Verse 1 | sundown - in the boomtown | TOO_EARLY: only 1 word(s) before dash |
| 105 | hiphop | melancholic | Verse 1 | unconfined - by the daily grind | TOO_EARLY: only 1 word(s) before dash |
| 106 | hiphop | melancholic | Verse 1 | showdown - countdown to the lockdown | TOO_EARLY: only 1 word(s) before dash |
| 107 | hiphop | melancholic | Verse 1 | undermined - but i'm still refined | TOO_EARLY: only 1 word(s) before dash |
| 108 | hiphop | melancholic | Verse 3 | I built my perfume from nothing - to boom | BREAK_AFTER_VERB_ING: "nothing - to" |
| 109 | hiphop | happy | Verse 1 | riding - in the limousine | BREAK_AFTER_VERB_ING: "riding - in"; TOO_EARLY: only 1 word(s) before dash |
| 110 | hiphop | happy | Verse 1 | amphetamine - of the magazine scene | TOO_EARLY: only 1 word(s) before dash |
| 111 | hiphop | happy | Verse 2 | similar - to the particular | TOO_EARLY: only 1 word(s) before dash |
| 112 | hiphop | happy | Verse 3 | energize - and i'll supervise | TOO_EARLY: only 1 word(s) before dash |
| 113 | hiphop | happy | Verse 3 | mesmerize - when i harmonize | TOO_EARLY: only 1 word(s) before dash |
| 114 | hiphop | sad | Verse 2 | riding with my squad - a solid grip | SINGLE_CHAR_START: "- a" |
| 115 | hiphop | sad | Verse 3 | independent - on my own ascent | TOO_EARLY: only 1 word(s) before dash |
| 116 | hiphop | sad | Verse 3 | earner - and the slow burner | TOO_EARLY: only 1 word(s) before dash |
| 117 | hiphop | romantic | Verse 1 | catalogue - in the travelogue | TOO_EARLY: only 1 word(s) before dash |
| 118 | hiphop | romantic | Verse 2 | Eminem - Cleaned Out His Closet on the track | TOO_EARLY: only 1 word(s) before dash |
| 119 | hiphop | romantic | Verse 2 | knickknack - on the quarterback | TOO_EARLY: only 1 word(s) before dash |
| 120 | hiphop | romantic | Verse 3 | the future shining - to behold | BREAK_AFTER_VERB_ING: "shining - to" |
| 121 | hiphop | romantic | Verse 3 | renown - from the background | TOO_EARLY: only 1 word(s) before dash |
| 122 | hiphop | romantic | Verse 3 | outbound - from the homebound | TOO_EARLY: only 1 word(s) before dash |
| 123 | hiphop | aggressive | Verse 2 | I built my prizefight from nothing - to might | BREAK_AFTER_VERB_ING: "nothing - to" |
| 124 | hiphop | aggressive | Verse 3 | showdown - in the downtown | TOO_EARLY: only 1 word(s) before dash |
| 125 | hiphop | aggressive | Verse 3 | intervene - in the unforeseen | TOO_EARLY: only 1 word(s) before dash |
| 126 | hiphop | dreamy | Verse 2 | the warrior standing - at the height | BREAK_AFTER_VERB_ING: "standing - at" |
| 127 | hiphop | dreamy | Verse 3 | boardgame - to the domain flame | TOO_EARLY: only 1 word(s) before dash |
| 128 | hiphop | dreamy | Verse 3 | everything - i built i claim | TOO_EARLY: only 1 word(s) before dash |
| 129 | hiphop | epic | Verse 1 | wholesale - on the nightingale | TOO_EARLY: only 1 word(s) before dash |
| 130 | hiphop | epic | Verse 3 | frontier - of the premier career | TOO_EARLY: only 1 word(s) before dash |
| 131 | hiphop | epic | Verse 3 | mistletoe - in the bungalow | TOO_EARLY: only 1 word(s) before dash |
| 132 | hiphop | epic | Verse 3 | pioneer - and the cavalier | TOO_EARLY: only 1 word(s) before dash |
| 133 | hiphop | epic | Verse 3 | volunteer - in the frontier | TOO_EARLY: only 1 word(s) before dash |
| 134 | hiphop | hopeful | Verse 1 | tombstone - but i've never been overthrown | TOO_EARLY: only 1 word(s) before dash |
| 135 | hiphop | hopeful | Verse 2 | living - life with a guarantee | TOO_EARLY: only 1 word(s) before dash |
| 136 | hiphop | hopeful | Verse 2 | evergreen - on the movie screen | TOO_EARLY: only 1 word(s) before dash |
| 137 | hiphop | hopeful | Verse 2 | greatest - of all time ali | TOO_EARLY: only 1 word(s) before dash |
| 138 | hiphop | hopeful | Verse 3 | annihilated - everything in my trajectory | TOO_EARLY: only 1 word(s) before dash |
| 139 | hiphop | hopeful | Verse 3 | writing - my own history | TOO_EARLY: only 1 word(s) before dash |
| 140 | hiphop | hopeful | Verse 3 | gentry - in the inventory | TOO_EARLY: only 1 word(s) before dash |
| 141 | hiphop | hopeful | Verse 3 | backbone - of the war zone | TOO_EARLY: only 1 word(s) before dash |
| 142 | hiphop | hopeful | Verse 3 | artistry - of the mystery | TOO_EARLY: only 1 word(s) before dash |
| 143 | hiphop | sad | Verse 1 | hindsight - in the oversight light | TOO_EARLY: only 1 word(s) before dash |
| 144 | hiphop | sad | Verse 1 | handspring - to the offspring | BREAK_AFTER_VERB_ING: "handspring - to"; TOO_EARLY: only 1 word(s) before dash |
| 145 | hiphop | sad | Verse 2 | artistry - of the mystery | TOO_EARLY: only 1 word(s) before dash |
| 146 | hiphop | sad | Verse 2 | gentry - in the inventory | TOO_EARLY: only 1 word(s) before dash |
| 147 | hiphop | sad | Verse 2 | annihilated - everything in my trajectory | TOO_EARLY: only 1 word(s) before dash |
| 148 | hiphop | sad | Verse 2 | nuthin' - but a g thang dre | TOO_EARLY: only 1 word(s) before dash |
| 149 | hiphop | sad | Verse 3 | proclamation - of the restoration | TOO_EARLY: only 1 word(s) before dash |
| 150 | hiphop | sad | Verse 3 | inception - deeper in the imagination | TOO_EARLY: only 1 word(s) before dash |
| 151 | hiphop | sad | Verse 3 | education - of the population | TOO_EARLY: only 1 word(s) before dash |
| 152 | hiphop | romantic | Verse 1 | proclamation - of the restoration | TOO_EARLY: only 1 word(s) before dash |
| 153 | hiphop | romantic | Verse 1 | congregation - of the innovation | TOO_EARLY: only 1 word(s) before dash |
| 154 | hiphop | romantic | Verse 2 | dedication - to the occupation | TOO_EARLY: only 1 word(s) before dash |
| 155 | hiphop | romantic | Verse 2 | confrontation - at the graduation | TOO_EARLY: only 1 word(s) before dash |
| 156 | hiphop | romantic | Verse 2 | polarization - of the nation | TOO_EARLY: only 1 word(s) before dash |
| 157 | hiphop | aggressive | Verse 1 | midstream - of the laser beam | TOO_EARLY: only 1 word(s) before dash |
| 158 | hiphop | aggressive | Verse 1 | esteem - from the downstream stream | TOO_EARLY: only 1 word(s) before dash |
| 159 | hiphop | aggressive | Verse 1 | wu-tang ain't nothing - to scheme with cream | BREAK_AFTER_VERB_ING: "nothing - to" |
| 160 | hiphop | aggressive | Verse 1 | submarine - in the mainstream | TOO_EARLY: only 1 word(s) before dash |
| 161 | hiphop | aggressive | Verse 2 | diamond - in the rough reveal | TOO_EARLY: only 1 word(s) before dash |
| 162 | hiphop | aggressive | Verse 2 | wholesale - on the nightingale | TOO_EARLY: only 1 word(s) before dash |
| 163 | hiphop | aggressive | Verse 2 | nobody cares the betrayal - a bronx tale | SINGLE_CHAR_START: "- a" |
| 164 | hiphop | aggressive | Verse 2 | exhale - on the detail trail | TOO_EARLY: only 1 word(s) before dash |
| 165 | hiphop | aggressive | Verse 2 | betrayal - on the holy grail | TOO_EARLY: only 1 word(s) before dash |
| 166 | hiphop | dreamy | Verse 1 | every single verse - a progress report | SINGLE_CHAR_START: "- a" |
| 167 | hiphop | dreamy | Verse 1 | chronic - of the sonic logic | TOO_EARLY: only 1 word(s) before dash |
| 168 | hiphop | dreamy | Verse 2 | bodyguard - on the boulevard | TOO_EARLY: only 1 word(s) before dash |
| 169 | hiphop | dark | Verse 1 | everything - I do is for the real | TOO_EARLY: only 1 word(s) before dash |
| 170 | hiphop | dark | Verse 1 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 171 | hiphop | dark | Verse 1 | goodwill - on the windmill | TOO_EARLY: only 1 word(s) before dash |
| 172 | hiphop | dark | Verse 2 | stampede - of the centipede | TOO_EARLY: only 1 word(s) before dash |
| 173 | hiphop | dark | Verse 3 | defying - all the gravity | TOO_EARLY: only 1 word(s) before dash |
| 174 | hiphop | dark | Verse 3 | risque - on the croquet | TOO_EARLY: only 1 word(s) before dash |
| 175 | hiphop | epic | Verse 1 | dark knight rising - from the black | BREAK_AFTER_VERB_ING: "rising - from" |
| 176 | hiphop | epic | Verse 1 | throwback - on the quarterback sack | TOO_EARLY: only 1 word(s) before dash |
| 177 | hiphop | epic | Verse 2 | newsreel - of the ordeal heal | TOO_EARLY: only 1 word(s) before dash |
| 178 | hiphop | epic | Verse 3 | shellshock - but i never stop | TOO_EARLY: only 1 word(s) before dash |
| 179 | hiphop | epic | Verse 3 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 180 | hiphop | epic | Verse 3 | voodoo - that the guru do | TOO_EARLY: only 1 word(s) before dash |
| 181 | hiphop | hopeful | Verse 1 | living - in the mainstream | BREAK_AFTER_VERB_ING: "living - in"; TOO_EARLY: only 1 word(s) before dash |
| 182 | hiphop | hopeful | Verse 1 | wu-tang ain't nothing - to scheme with cream | BREAK_AFTER_VERB_ING: "nothing - to" |
| 183 | hiphop | hopeful | Verse 2 | unbreakable - with all my might | TOO_EARLY: only 1 word(s) before dash |
| 184 | hiphop | hopeful | Verse 2 | copyright - on the hindsight | TOO_EARLY: only 1 word(s) before dash |
| 185 | hiphop | hopeful | Verse 3 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 186 | hiphop | melancholic | Verse 3 | kitten - in the mitten | TOO_EARLY: only 1 word(s) before dash |
| 187 | hiphop | melancholic | Verse 3 | namesake - of the double take | TOO_EARLY: only 1 word(s) before dash |
| 188 | hiphop | happy | Verse 2 | nickname - became a brand name | TOO_EARLY: only 1 word(s) before dash |
| 189 | hiphop | happy | Verse 2 | acclaim - and the became flame | TOO_EARLY: only 1 word(s) before dash |
| 190 | hiphop | sad | Verse 1 | heartless - but the flow's insane kanye | TOO_EARLY: only 1 word(s) before dash |
| 191 | hiphop | sad | Verse 1 | standing - tall in the spotlight | TOO_EARLY: only 1 word(s) before dash |
| 192 | hiphop | sad | Verse 2 | commonweal - on the ideal reel | TOO_EARLY: only 1 word(s) before dash |
| 193 | hiphop | sad | Verse 2 | nonstop - at the rooftop | TOO_EARLY: only 1 word(s) before dash |
| 194 | hiphop | sad | Verse 3 | submarine - in the mainstream | TOO_EARLY: only 1 word(s) before dash |
| 195 | hiphop | romantic | Verse 1 | copyright - on the hindsight | TOO_EARLY: only 1 word(s) before dash |
| 196 | hiphop | romantic | Verse 1 | moonlight - in the oversight | TOO_EARLY: only 1 word(s) before dash |
| 197 | hiphop | romantic | Verse 1 | oversight - in the copyright might | TOO_EARLY: only 1 word(s) before dash |
| 198 | hiphop | romantic | Verse 2 | regime - of the supreme extreme | TOO_EARLY: only 1 word(s) before dash |
| 199 | hiphop | romantic | Verse 2 | scream - upstream in the mainstream | TOO_EARLY: only 1 word(s) before dash |
| 200 | hiphop | romantic | Verse 3 | shellshock - but i never stop | TOO_EARLY: only 1 word(s) before dash |

## Lines Missing Dash (6+ words, 9 total, showing 9)

- [pop/dreamy] Verse 2: `a lavender sky at the end of the day`
- [pop/romantic] Verse 2: `a lavender sky at the end of the day`
- [pop/dreamy] Verse 2: `a lavender sky at the end of the day`
- [rnb/romantic] Verse 2: `we turned a situationship into a whole studio album`
- [rnb/dark] Verse 2: `we turned a situationship into a whole studio album`
- [folk/epic] Verse 1: `the thunderstorm was rumbling through the mountain air`
- [metal/dark] Verse 1: `the battle drums are thundering across the blackened plain`
- [latin/dark] Verse 2: `the adrenaline is coursing through the summer night`
- [latin/happy] Verse 1: `the adrenaline is coursing through the summer night`

## Correctly Placed Dash Examples (showing 30)

- [pop/happy] `a little sign - from the universe to me`
- [pop/happy] `The world is spinning - and I can see`
- [pop/happy] `the radio is playing - our old song`
- [pop/happy] `the show goes on until the break - of dawn`
- [pop/happy] `the stream is - ours tonight`
- [pop/happy] `we shine - in the moonlight`
- [pop/happy] `the love you gave was truly - one of a kind`
- [pop/happy] `I held the moment - like a candle in the wind`
- [pop/happy] `wherever the four - winds blow`
- [pop/happy] `you live a life of high - and low`
- [pop/happy] `i dance - into the dawn`
- [pop/happy] `replay the moment - like a favorite song`
- [pop/happy] `the stream is - ours tonight`
- [pop/happy] `we shine - in the moonlight`
- [pop/happy] `the love you gave was truly - one of a kind`
- [pop/happy] `I held the moment - like a candle in the wind`
- [pop/sad] `and everything feels magical - whenever you are near`
- [pop/sad] `the summer breeze keeps whispering - your name into my ear`
- [pop/sad] `we built - it from the penlight`
- [pop/sad] `this celebration takes us - all to glory`
- [pop/sad] `I thought I knew the way - but I was blind`
- [pop/sad] `my imagination - painted every memory`
- [pop/sad] `i pushed the heavy - memories left behind`
- [pop/sad] `the way you love me - is a work of art`
- [pop/sad] `the Greatest Showman said - this is the greatest show`
- [pop/sad] `this celebration takes us - all to glory`
- [pop/sad] `I thought I knew the way - but I was blind`
- [pop/sad] `my imagination - painted every memory`
- [pop/sad] `i pushed the heavy - memories left behind`
- [pop/romantic] `i shine - in the moonlight`

